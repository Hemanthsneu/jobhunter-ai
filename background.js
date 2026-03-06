/* ========================================
   JobHunter AI — Background Service Worker
   Scheduled job search, notifications, messaging
   ======================================== */

// Import via dynamic import since service workers use ES modules
const DB_NAME = 'JobHunterAI';
const DB_VERSION = 1;

// ====== Alarm Setup for Scheduled Searches ======
chrome.runtime.onInstalled.addListener(async () => {
    console.log('JobHunter AI installed!');

    // Set default alarm
    const settings = await getSettings();
    setupAlarm(settings.notifInterval || 60);

    // Create notification channel
    chrome.notifications.create('welcome', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'JobHunter AI Installed! 🎯',
        message: 'Click the extension icon to set up your profile and start hunting for jobs.',
        priority: 2
    });
});

// ====== Alarm Handler — Periodic Job Search ======
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'jobSearch') {
        console.log('Running scheduled job search...');
        await runScheduledSearch();
    }
});

async function setupAlarm(intervalMinutes) {
    await chrome.alarms.clear('jobSearch');
    chrome.alarms.create('jobSearch', {
        periodInMinutes: Math.max(1, intervalMinutes)
    });
    console.log(`Job search alarm set for every ${intervalMinutes} minutes`);
}

// ====== Scheduled Search ======
async function runScheduledSearch() {
    const settings = await getSettings();

    if (!settings.serpApiKey || !settings.profileRole) {
        console.log('Skipping scheduled search — no API key or profile role set');
        return;
    }

    try {
        // Search Google Jobs
        const params = new URLSearchParams({
            engine: 'google_jobs',
            q: settings.profileRole,
            api_key: settings.serpApiKey,
            hl: 'en',
            chips: 'date_posted:today'
        });

        if (settings.profileLocations) {
            params.set('location', settings.profileLocations.split(',')[0].trim());
        }

        const response = await fetch(`https://serpapi.com/search.json?${params}`);
        if (!response.ok) return;

        const data = await response.json();
        const jobs = (data.jobs_results || []).map(job => ({
            id: 'gj_' + hashString(job.title + job.company_name),
            title: job.title || '',
            company: job.company_name || '',
            location: job.location || '',
            description: job.description || '',
            postedAt: job.detected_extensions?.posted_at || '',
            salary: job.detected_extensions?.salary || '',
            source: 'google',
            applyLink: job.apply_options?.[0]?.link || '',
            via: job.via || '',
            dateFound: new Date().toISOString(),
            status: 'new'
        }));

        if (jobs.length === 0) return;

        // Score jobs with Claude if key available
        const resume = await getResumeFromDB();
        if (settings.anthropicKey && resume) {
            for (const job of jobs.slice(0, 3)) { // Score top 3 to save API calls
                try {
                    const matchResult = await analyzeJobWithClaude(settings.anthropicKey, resume, job.description, settings);
                    job.matchScore = matchResult.matchScore || 0;
                } catch (e) {
                    console.warn('Scoring failed:', e);
                }
            }
        }

        // Save jobs to DB
        const db = await openDB();
        for (const job of jobs) {
            const tx = db.transaction('jobs', 'readwrite');
            tx.objectStore('jobs').put(job);
        }

        // Check for high-match jobs and notify
        if (settings.notifEnabled) {
            const threshold = settings.notifThreshold || 75;
            const highMatches = jobs.filter(j => (j.matchScore || 0) >= threshold);

            if (highMatches.length > 0) {
                const topJob = highMatches[0];
                chrome.notifications.create('newJobs_' + Date.now(), {
                    type: 'basic',
                    iconUrl: 'icons/icon128.png',
                    title: `🎯 ${highMatches.length} High-Match Job${highMatches.length > 1 ? 's' : ''} Found!`,
                    message: `${topJob.title} at ${topJob.company} (${topJob.matchScore}% match)`,
                    priority: 2,
                    buttons: [
                        { title: 'View Jobs' }
                    ]
                });
            } else if (jobs.length > 0) {
                chrome.notifications.create('newJobs_' + Date.now(), {
                    type: 'basic',
                    iconUrl: 'icons/icon128.png',
                    title: `📋 ${jobs.length} New Job${jobs.length > 1 ? 's' : ''} Found`,
                    message: `${jobs[0].title} at ${jobs[0].company}`,
                    priority: 1
                });
            }
        }

        console.log(`Scheduled search complete: ${jobs.length} jobs found`);
    } catch (e) {
        console.error('Scheduled search failed:', e);
    }
}

// ====== Message Handler ======
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'SETTINGS_UPDATED':
            if (message.settings?.notifInterval) {
                setupAlarm(message.settings.notifInterval);
            }
            break;

        case 'ANALYZE_JOB':
            // Store job data for side panel to pick up when it opens
            chrome.storage.local.set({ pendingJobAnalysis: message.job });

            // Open side panel — use sender.tab.id if from content script
            (async () => {
                try {
                    if (sender.tab?.id) {
                        await chrome.sidePanel.open({ tabId: sender.tab.id });
                    } else {
                        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (activeTab) {
                            await chrome.sidePanel.open({ tabId: activeTab.id });
                        }
                    }
                } catch (e) {
                    console.warn('Could not open side panel:', e);
                }

                // Forward to side panel (it may have just opened)
                setTimeout(() => {
                    chrome.runtime.sendMessage({
                        type: 'SIDEPANEL_ANALYZE',
                        job: message.job,
                        resume: message.resume,
                        settings: message.settings
                    }, () => {
                        if (chrome.runtime.lastError) {
                            // Side panel will pick it up from storage
                        }
                    });
                }, 500);
            })();
            break;

        case 'SAVE_JOB':
            // Save job from content scripts to IndexedDB
            (async () => {
                try {
                    const db = await openDB();
                    const tx = db.transaction('applications', 'readwrite');
                    tx.objectStore('applications').put(message.job);
                    sendResponse({ success: true });
                } catch (e) {
                    console.error('Failed to save job:', e);
                    sendResponse({ success: false, error: e.message });
                }
            })();
            return true; // Keep channel open for async

        case 'RUN_SEARCH':
            runScheduledSearch().then(() => sendResponse({ success: true }));
            return true; // Keep channel open for async

        case 'GET_JOB_URLS':
            // Generate ATS board URLs for content scripts
            const query = message.query || 'Software Engineer';
            const location = message.location || '';
            sendResponse({
                linkedin: generateLinkedInURL(query, location, { hoursAgo: 1 }),
                greenhouse: `https://www.google.com/search?q=site:boards.greenhouse.io+"${query}"&tbs=qdr:d`,
                ashby: `https://www.google.com/search?q=site:jobs.ashby.io+"${query}"&tbs=qdr:d`,
                lever: `https://www.google.com/search?q=site:jobs.lever.co+"${query}"&tbs=qdr:d`
            });
            break;
    }
});

// ====== Notification Click Handler ======
chrome.notifications.onClicked.addListener((notificationId) => {
    try { chrome.action.openPopup(); } catch (e) {
        // openPopup not always available, fallback
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
        try { chrome.action.openPopup(); } catch (e) {
            chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
        }
    }
});

// ====== Context Menu ======
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'analyzeJob',
            title: 'Analyze with JobHunter AI',
            contexts: ['selection', 'page']
        });
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'analyzeJob') {
        const selectedText = info.selectionText || '';
        if (selectedText) {
            // Store the selected text for the side panel to pick up
            await chrome.storage.local.set({ pendingAnalysis: selectedText });
            try {
                chrome.sidePanel.open({ tabId: tab.id });
            } catch (e) {
                console.warn('Could not open side panel:', e);
            }
        }
    }
});

// ====== Helper Functions ======

function generateLinkedInURL(query, location, options = {}) {
    const params = new URLSearchParams({
        keywords: query,
        location: location,
        sortBy: 'DD',
        f_TPR: `r${(options.hoursAgo || 24) * 3600}`
    });
    return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

async function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({
            anthropicKey: '',
            serpApiKey: '',
            profileRole: '',
            profileYOE: '',
            profileSkills: '',
            profileLocations: '',
            profileSalary: '',
            notifInterval: 60,
            notifThreshold: 75,
            notifEnabled: true
        }, resolve);
    });
}

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('jobs')) {
                const store = db.createObjectStore('jobs', { keyPath: 'id' });
                store.createIndex('source', 'source');
                store.createIndex('matchScore', 'matchScore');
                store.createIndex('dateFound', 'dateFound');
            }
            if (!db.objectStoreNames.contains('applications')) {
                db.createObjectStore('applications', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('resumes')) {
                db.createObjectStore('resumes', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getResumeFromDB() {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('resumes', 'readonly');
            const req = tx.objectStore('resumes').get('primary');
            req.onsuccess = () => resolve(req.result?.text || '');
            req.onerror = () => resolve('');
        });
    } catch {
        return '';
    }
}

async function analyzeJobWithClaude(apiKey, resume, jobDesc, settings) {
    const prompt = `Rate match 0-100 and list key matches/gaps. Resume: ${resume.substring(0, 2000)} | Job: ${jobDesc.substring(0, 2000)} | Target: ${settings.profileRole}. Respond ONLY with JSON: {"matchScore": N, "summary": "..."}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) throw new Error('Claude API error');

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { matchScore: 0 };
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}
