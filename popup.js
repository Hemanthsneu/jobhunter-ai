/* ========================================
   JobHunter AI — Popup Main Logic
   ======================================== */

(async function () {
    // ====== Init ======
    await StorageManager.init();
    const settings = await StorageManager.getSettings();

    // ====== Tab Navigation ======
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    // ====== Load Settings ======
    function loadSettings() {
        document.getElementById('gemini-key').value = settings.geminiKey || '';
        document.getElementById('serpapi-key').value = settings.serpApiKey || '';
        document.getElementById('profile-role').value = settings.profileRole || '';
        document.getElementById('profile-yoe').value = settings.profileYOE || '';
        document.getElementById('profile-skills').value = settings.profileSkills || '';
        document.getElementById('profile-locations').value = settings.profileLocations || '';
        document.getElementById('profile-salary').value = settings.profileSalary || '';
        document.getElementById('notif-interval').value = settings.notifInterval || 60;
        document.getElementById('notif-threshold').value = settings.notifThreshold || 75;
        document.getElementById('notif-threshold-value').textContent = (settings.notifThreshold || 75) + '%';
        document.getElementById('notif-enabled').checked = settings.notifEnabled !== false;

        // Pre-fill search from profile
        document.getElementById('search-query').value = settings.profileRole || '';
        document.getElementById('search-location').value = settings.profileLocations || '';
    }
    loadSettings();

    // ====== Save Settings ======
    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const newSettings = {
            geminiKey: document.getElementById('gemini-key').value.trim(),
            serpApiKey: document.getElementById('serpapi-key').value.trim(),
            profileRole: document.getElementById('profile-role').value.trim(),
            profileYOE: document.getElementById('profile-yoe').value.trim(),
            profileSkills: document.getElementById('profile-skills').value.trim(),
            profileLocations: document.getElementById('profile-locations').value.trim(),
            profileSalary: document.getElementById('profile-salary').value.trim(),
            notifInterval: parseInt(document.getElementById('notif-interval').value),
            notifThreshold: parseInt(document.getElementById('notif-threshold').value),
            notifEnabled: document.getElementById('notif-enabled').checked,
            selectedTemplate: document.querySelector('.template-btn.active')?.dataset.template || 'jakes'
        };

        await StorageManager.saveSettings(newSettings);
        Object.assign(settings, newSettings);

        // Notify background to update alarm
        chrome.runtime?.sendMessage({ type: 'SETTINGS_UPDATED', settings: newSettings }, () => { if (chrome.runtime.lastError) { /* suppress */ } });

        const feedback = document.getElementById('save-feedback');
        feedback.style.display = 'block';
        setTimeout(() => feedback.style.display = 'none', 2000);
    });

    // Threshold slider
    document.getElementById('notif-threshold').addEventListener('input', (e) => {
        document.getElementById('notif-threshold-value').textContent = e.target.value + '%';
    });

    // Toggle API key visibility
    document.getElementById('toggle-gemini-key').addEventListener('click', () => {
        const inp = document.getElementById('gemini-key');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('toggle-serpapi-key').addEventListener('click', () => {
        const inp = document.getElementById('serpapi-key');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // ====== Template Selection ======
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // ====== Resume Upload ======
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('resume-file');
    let currentResumeText = '';

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleResumeFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleResumeFile(e.target.files[0]);
    });

    async function handleResumeFile(file) {
        const uploadZoneEl = document.getElementById('upload-zone');

        // Show loading state
        if (uploadZoneEl) {
            uploadZoneEl.innerHTML = '<div class="upload-icon">⏳</div><p>Extracting text from resume...</p>';
        }

        let text = '';

        try {
            if (file.name.toLowerCase().endsWith('.pdf')) {
                // For PDFs: use Gemini API which natively parses PDFs
                if (settings.geminiKey) {
                    const base64 = await readFileAsBase64(file);
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.geminiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: 'Extract ALL text content from this PDF resume. Return ONLY the raw text exactly as it appears in the document, preserving the structure. Do not add any commentary, headers, or formatting instructions.' },
                                        { inlineData: { mimeType: 'application/pdf', data: base64 } }
                                    ]
                                }],
                                generationConfig: { temperature: 0, maxOutputTokens: 8192 }
                            })
                        }
                    );
                    const data = await response.json();
                    text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } else {
                    // No Gemini key — can't parse PDF
                    if (uploadZoneEl) {
                        uploadZoneEl.innerHTML = '<div class="upload-icon">⚠️</div><p style="color:#ffa502;">Add your Gemini API key in Settings first to parse PDF resumes.</p><p class="upload-hint">Or upload as a .txt file instead</p>';
                        uploadZoneEl.style.display = 'block';
                    }
                    return;
                }
            } else {
                // Plain text files
                text = await readFileAsText(file);
            }
        } catch (e) {
            console.error('Resume extraction failed:', e);
            text = await readFileAsText(file);
        }

        if (!text || text.trim().length < 20) {
            if (uploadZoneEl) {
                uploadZoneEl.innerHTML = '<div class="upload-icon">❌</div><p style="color:#ff4757;">Could not extract text from this file.</p><p class="upload-hint">Try copying your resume text into a .txt file and uploading that</p>';
                uploadZoneEl.style.display = 'block';
            }
            return;
        }

        currentResumeText = text;

        await StorageManager.saveResume({
            id: 'primary',
            filename: file.name,
            text: text,
            uploadedAt: new Date().toISOString()
        });

        showResumePreview(file.name, text);
    }

    function readFileAsText(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsText(file);
        });
    }

    function readFileAsBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(file);
        });
    }

    function showResumePreview(filename, text) {
        document.getElementById('upload-zone').style.display = 'none';
        document.getElementById('resume-preview').style.display = 'block';
        document.getElementById('resume-filename').textContent = filename;
        document.getElementById('resume-text-preview').textContent = text.substring(0, 500) + (text.length > 500 ? '...' : '');
        document.getElementById('btn-analyze-resume').disabled = false;
    }

    document.getElementById('btn-remove-resume').addEventListener('click', async () => {
        currentResumeText = '';
        await StorageManager.delete('resumes', 'primary');
        document.getElementById('upload-zone').style.display = 'block';
        document.getElementById('resume-preview').style.display = 'none';
        document.getElementById('btn-analyze-resume').disabled = true;
        document.getElementById('ats-result').style.display = 'none';
    });

    // Load existing resume
    const savedResume = await StorageManager.getResume('primary');
    if (savedResume) {
        currentResumeText = savedResume.text;
        showResumePreview(savedResume.filename, savedResume.text);
    }

    // ====== ATS Resume Analysis ======
    document.getElementById('btn-analyze-resume').addEventListener('click', async () => {
        if (!currentResumeText) return;

        const btn = document.getElementById('btn-analyze-resume');
        btn.disabled = true;
        btn.textContent = '⏳ Analyzing...';

        // Quick local ATS score first
        const quickResult = ATSScorer.quickScore(currentResumeText, settings.profileSkills || 'software engineer');
        displayATSScore(quickResult);

        // Deep Gemini analysis if key available
        if (settings.geminiKey) {
            try {
                const deepResult = await GeminiAI.calculateATSScore(
                    settings.geminiKey,
                    currentResumeText,
                    `Role: ${settings.profileRole || 'Senior Software Engineer'}\nRequired Skills: ${settings.profileSkills || 'Not specified'}`
                );
                if (!deepResult.error) {
                    displayATSScore({
                        overallScore: deepResult.overallScore,
                        breakdown: deepResult.breakdown,
                        improvements: deepResult.topImprovements
                    });
                }
            } catch (e) {
                console.error('Gemini ATS analysis failed:', e);
            }
        }

        btn.disabled = false;
        btn.textContent = '📊 Analyze My Resume';
    });

    function displayATSScore(result) {
        const container = document.getElementById('ats-result');
        container.style.display = 'flex';

        const score = result.overallScore || 0;
        const ring = document.getElementById('ats-score-ring');
        const circumference = 2 * Math.PI * 54; // r=54
        ring.style.strokeDashoffset = circumference - (score / 100) * circumference;

        // Color based on score
        if (score >= 90) ring.style.stroke = 'var(--success)';
        else if (score >= 75) ring.style.stroke = 'var(--warning)';
        else ring.style.stroke = 'var(--danger)';

        document.getElementById('ats-score-text').textContent = score;

        const details = document.getElementById('ats-details');
        if (result.breakdown) {
            const items = Object.entries(result.breakdown).slice(0, 5).map(([key, val]) => {
                const s = typeof val === 'object' ? val.score : val;
                const cls = s >= 80 ? 'good' : s >= 60 ? 'okay' : 'bad';
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
                return `<div class="ats-detail-item">
          <span class="ats-detail-label">${label}</span>
          <span class="ats-detail-value ${cls}">${s}%</span>
        </div>`;
            }).join('');
            details.innerHTML = items;
        }
    }

    // ====== Job Search ======
    document.getElementById('btn-search-jobs').addEventListener('click', async () => {
        const query = document.getElementById('search-query').value.trim();
        const location = document.getElementById('search-location').value.trim();
        const hoursAgo = parseInt(document.getElementById('search-age').value);

        if (!query) return;

        const btn = document.getElementById('btn-search-jobs');
        btn.disabled = true;
        btn.textContent = '⏳ Searching...';

        try {
            if (settings.serpApiKey) {
                const jobs = await JobSearch.searchGoogleJobs(settings.serpApiKey, query, location, { hoursAgo });

                // AI score each job if Gemini key available
                if (settings.geminiKey && currentResumeText && jobs.length > 0) {
                    for (const job of jobs.slice(0, 5)) { // Score top 5 to save API calls
                        try {
                            const match = await GeminiAI.analyzeJobMatch(settings.geminiKey, currentResumeText, job.description, {
                                role: settings.profileRole,
                                yoe: settings.profileYOE,
                                skills: settings.profileSkills
                            });
                            job.matchScore = match.matchScore || 0;
                            job.matchDetails = match;
                        } catch (e) {
                            console.warn('Match scoring failed for job:', e);
                        }
                    }
                }

                // Save & display
                for (const job of jobs) {
                    await StorageManager.saveJob(job);
                }

                displayJobs(jobs);
            } else {
                // No SerpApi key — open Google Jobs directly
                const url = `https://www.google.com/search?q=${encodeURIComponent(query + ' jobs')}&ibp=htl;jobs`;
                chrome.tabs?.create({ url });
            }
        } catch (e) {
            console.error('Search failed:', e);
        }

        btn.disabled = false;
        btn.textContent = '🔍 Search Jobs Now';
    });

    // ====== Smart Hunt ======
    document.getElementById('btn-smart-hunt').addEventListener('click', async () => {
        const btn = document.getElementById('btn-smart-hunt');
        const progress = document.getElementById('hunt-progress');
        const progressFill = document.getElementById('hunt-progress-fill');
        const progressText = document.getElementById('hunt-progress-text');

        btn.disabled = true;
        progress.style.display = 'block';

        try {
            const result = await JobSearch.smartHunt(settings, (p) => {
                progressFill.style.width = `${(p.step / p.total) * 100}%`;
                progressText.textContent = p.text;
            });

            // Display jobs from SerpApi
            if (result.jobs.length > 0) {
                for (const job of result.jobs) {
                    await StorageManager.saveJob(job);
                }

                // Switch to jobs tab and show results
                tabBtns[0].click();

                // Score jobs with AI
                if (settings.geminiKey && currentResumeText) {
                    for (const job of result.jobs.slice(0, 5)) {
                        try {
                            const match = await GeminiAI.analyzeJobMatch(settings.geminiKey, currentResumeText, job.description, {
                                role: settings.profileRole,
                                yoe: settings.profileYOE,
                                skills: settings.profileSkills
                            });
                            job.matchScore = match.matchScore || 0;
                            job.matchDetails = match;
                            await StorageManager.saveJob(job);
                        } catch (e) {
                            console.warn('Scoring failed:', e);
                        }
                    }
                }

                displayJobs(result.jobs);
            }

            // Generate quick links
            generateQuickLinks(result.atsSearches);

            progressFill.style.width = '100%';
            progressText.textContent = `Found ${result.jobs.length} jobs + ${result.atsSearches.length} search links ready!`;
        } catch (e) {
            console.error('Smart hunt failed:', e);
            progressText.textContent = 'Error: ' + e.message;
        }

        btn.disabled = false;
    });

    function generateQuickLinks(searches) {
        const container = document.getElementById('quick-links');
        container.innerHTML = searches.map(s => `
      <a class="quick-link" href="${s.directUrl}" target="_blank" data-source="${s.source}">
        <span class="quick-link-icon">${s.icon}</span>
        <span class="quick-link-text">${s.name}</span>
        <span class="quick-link-badge">Open</span>
      </a>
    `).join('');

        // Open in new tab
        container.querySelectorAll('.quick-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs?.create({ url: link.href }) || window.open(link.href, '_blank');
            });
        });
    }

    // Auto-generate quick links based on saved profile
    if (settings.profileRole) {
        const searches = JobSearch.generateATSBoardSearches(settings.profileRole, {
            hoursAgo: 24,
            location: settings.profileLocations || ''
        });
        generateQuickLinks(searches);
    }

    // ====== Display Jobs ======
    async function displayJobs(jobs) {
        const list = document.getElementById('job-list');

        if (!jobs || jobs.length === 0) {
            list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No jobs found yet. Try adjusting your search or click <strong>Smart Hunt</strong>!</p>
        </div>`;
            return;
        }

        list.innerHTML = jobs.map(job => {
            const score = job.matchScore || 0;
            const matchClass = score >= 80 ? 'match-high' : score >= 60 ? 'match-med' : 'match-low';
            const timeAgo = job.postedAt || JobSearch.timeAgo(job.dateFound);

            return `
        <div class="job-card" data-job-id="${job.id}">
          <div class="job-card-header">
            <div class="job-title">${escapeHTML(job.title)}</div>
            ${score > 0 ? `<div class="match-badge ${matchClass}">${score}%</div>` : ''}
          </div>
          <div class="job-company">${escapeHTML(job.company)}</div>
          <div class="job-meta">
            <span>📍 ${escapeHTML(job.location || 'Not specified')}</span>
            <span>⏰ ${escapeHTML(timeAgo)}</span>
            ${job.salary ? `<span>💰 ${escapeHTML(job.salary)}</span>` : ''}
          </div>
          ${job.via ? `<div class="job-tags"><span class="job-tag">${escapeHTML(job.via)}</span></div>` : ''}
          <div class="job-actions">
            <button class="btn btn-sm btn-outline btn-save-job" data-job-id="${job.id}">💾 Save</button>
            <button class="btn btn-sm btn-primary btn-analyze-job" data-job-id="${job.id}">🎯 Analyze</button>
            ${job.applyLink ? `<a class="btn btn-sm btn-accent" href="${job.applyLink}" target="_blank">Apply →</a>` : ''}
          </div>
        </div>`;
        }).join('');

        // Update stats
        document.querySelector('#stat-jobs .stat-value').textContent = jobs.length;

        // Event listeners
        list.querySelectorAll('.btn-save-job').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const jobId = btn.dataset.jobId;
                const job = jobs.find(j => j.id === jobId);
                if (job) {
                    await StorageManager.saveApplication({
                        ...job,
                        status: 'saved',
                        savedAt: new Date().toISOString()
                    });
                    btn.textContent = '✅ Saved';
                    btn.disabled = true;
                    refreshTracker();
                }
            });
        });

        list.querySelectorAll('.btn-analyze-job').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const jobId = btn.dataset.jobId;
                const job = jobs.find(j => j.id === jobId);
                if (job) {
                    await analyzeAndTailorJob(job);
                }
            });
        });
    }

    // ====== Analyze & Tailor for specific job ======
    async function analyzeAndTailorJob(job) {
        if (!settings.geminiKey) {
            alert('Please add your Gemini API key in Settings first.');
            return;
        }
        if (!currentResumeText) {
            alert('Please upload your resume in the Resume tab first.');
            return;
        }

        // Open side panel or show in-popup analysis
        try {
            // Try to open side panel
            if (chrome.sidePanel) {
                await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
                chrome.runtime.sendMessage({
                    type: 'ANALYZE_JOB',
                    job: job,
                    resume: currentResumeText,
                    settings: settings
                }, () => { if (chrome.runtime.lastError) { /* suppress */ } });
            } else {
                // Fallback: show analysis in popup
                await showInlineAnalysis(job);
            }
        } catch (e) {
            await showInlineAnalysis(job);
        }
    }

    async function showInlineAnalysis(job) {
        const template = document.querySelector('.template-btn.active')?.dataset.template || 'jakes';

        // Show loading
        const card = document.querySelector(`.job-card[data-job-id="${job.id}"]`);
        if (card) {
            const actionsDiv = card.querySelector('.job-actions');
            actionsDiv.innerHTML = '<span class="loading">⏳ AI analyzing & tailoring resume...</span>';
        }

        try {
            // Get ATS score
            const atsResult = await GeminiAI.calculateATSScore(settings.geminiKey, currentResumeText, job.description);

            // Tailor resume
            const tailoredResume = await GeminiAI.tailorResume(
                settings.geminiKey,
                currentResumeText,
                job.description,
                template,
                {
                    name: settings.profileName || '',
                    role: settings.profileRole || '',
                    yoe: settings.profileYOE || ''
                }
            );

            // Show results
            if (card) {
                const atsScore = atsResult.overallScore || 0;
                const scoreColor = atsScore >= 90 ? 'good' : atsScore >= 75 ? 'okay' : 'bad';

                card.innerHTML += `
          <div class="tailored-output">
            <div class="tailored-header">
              <h3>🎯 ATS Score: <span class="ats-detail-value ${scoreColor}">${atsScore}%</span></h3>
              <button class="btn btn-sm btn-primary btn-copy-resume">📋 Copy</button>
            </div>
            <div class="tailored-body">${escapeHTML(tailoredResume)}</div>
          </div>`;

                card.querySelector('.btn-copy-resume')?.addEventListener('click', () => {
                    navigator.clipboard.writeText(tailoredResume);
                    card.querySelector('.btn-copy-resume').textContent = '✅ Copied!';
                });
            }
        } catch (e) {
            console.error('Analysis failed:', e);
            if (card) {
                const actionsDiv = card.querySelector('.job-actions') || card;
                actionsDiv.innerHTML = `<span style="color:var(--danger)">❌ Error: ${e.message}</span>`;
            }
        }
    }

    // ====== Application Tracker ======
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            refreshTracker(chip.dataset.status);
        });
    });

    async function refreshTracker(statusFilter = 'all') {
        const apps = await StorageManager.getApplications(statusFilter);
        const list = document.getElementById('tracker-list');

        // Update stats
        const allApps = await StorageManager.getApplications('all');
        document.querySelector('#stat-applied .stat-value').textContent = allApps.filter(a => a.status === 'applied').length;

        if (!apps.length) {
            list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No ${statusFilter === 'all' ? '' : statusFilter + ' '}applications yet.</p>
        </div>`;
            return;
        }

        list.innerHTML = apps.map(app => `
      <div class="tracker-item" data-app-id="${app.id}">
        <div class="tracker-item-header">
          <span class="tracker-item-title">${escapeHTML(app.title)}</span>
          <span class="status-badge status-${app.status}">${app.status}</span>
        </div>
        <div class="tracker-item-company">${escapeHTML(app.company)}</div>
        <div class="tracker-item-date">
          ${app.savedAt ? 'Saved: ' + new Date(app.savedAt).toLocaleDateString() : ''}
          ${app.appliedAt ? ' | Applied: ' + new Date(app.appliedAt).toLocaleDateString() : ''}
        </div>
        <div class="tracker-item-actions">
          <select class="status-select" data-app-id="${app.id}">
            <option value="saved" ${app.status === 'saved' ? 'selected' : ''}>Saved</option>
            <option value="applied" ${app.status === 'applied' ? 'selected' : ''}>Applied</option>
            <option value="interview" ${app.status === 'interview' ? 'selected' : ''}>Interview</option>
            <option value="offer" ${app.status === 'offer' ? 'selected' : ''}>Offer</option>
            <option value="rejected" ${app.status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
          <button class="btn btn-sm btn-danger btn-delete-app" data-app-id="${app.id}">🗑</button>
        </div>
      </div>
    `).join('');

        // Status change handlers
        list.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const appId = select.dataset.appId;
                const app = apps.find(a => a.id === appId);
                if (app) {
                    app.status = e.target.value;
                    if (e.target.value === 'applied') app.appliedAt = new Date().toISOString();
                    await StorageManager.saveApplication(app);
                    refreshTracker(document.querySelector('.filter-chip.active')?.dataset.status || 'all');
                }
            });
        });

        // Delete handlers
        list.querySelectorAll('.btn-delete-app').forEach(btn => {
            btn.addEventListener('click', async () => {
                await StorageManager.delete('applications', btn.dataset.appId);
                refreshTracker(document.querySelector('.filter-chip.active')?.dataset.status || 'all');
            });
        });
    }

    refreshTracker();

    // ====== Refresh Jobs ======
    document.getElementById('btn-refresh-jobs').addEventListener('click', async () => {
        const jobs = await StorageManager.getJobs();
        displayJobs(jobs);
    });

    // Load saved jobs on start
    const savedJobs = await StorageManager.getJobs();
    if (savedJobs.length > 0) displayJobs(savedJobs);

    // ====== Job Filters ======
    document.getElementById('filter-match').addEventListener('change', async (e) => {
        const minMatch = e.target.value === 'all' ? 0 : parseInt(e.target.value);
        const jobs = await StorageManager.getJobs({ minMatch });
        displayJobs(jobs);
    });

    document.getElementById('filter-source').addEventListener('change', async (e) => {
        const jobs = await StorageManager.getJobs({ source: e.target.value });
        displayJobs(jobs);
    });

    // ====== Utility ======
    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
