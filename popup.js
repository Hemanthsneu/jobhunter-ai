/* ========================================
   JobHunter AI — Popup Main Logic v2
   ======================================== */

(async function () {
    // ====== Init ======
    await StorageManager.init();
    const settings = await StorageManager.getSettings();

    // ====== SVG Icon Helpers ======
    const Icons = {
        mapPin: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
        clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        dollar: '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        bookmark: '<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
        target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        externalLink: '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
        check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
        search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        barChart: '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        clipboard: '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
        copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        loader: '<svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
        fileText: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
        trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
    };

    function icon(name, size = 'sm') {
        return `<span class="icon icon-${size}">${Icons[name] || ''}</span>`;
    }

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

    // ====== Onboarding ======
    function checkOnboarding() {
        const hasKey = !!settings.anthropicKey;
        const hasRole = !!settings.profileRole;
        const hasResume = !!currentResumeText;

        const card = document.getElementById('onboarding-card');
        if (!hasKey || !hasRole) {
            card.style.display = 'block';
            const stepApi = document.getElementById('step-api');
            const stepProfile = document.getElementById('step-profile');
            const stepResume = document.getElementById('step-resume');
            if (hasKey) stepApi.classList.add('complete');
            if (hasRole) stepProfile.classList.add('complete');
            if (hasResume) stepResume.classList.add('complete');
        } else {
            card.style.display = 'none';
        }
    }

    document.getElementById('btn-go-settings')?.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="settings"]').classList.add('active');
        document.getElementById('tab-settings').classList.add('active');
    });

    // ====== Load Settings ======
    function loadSettings() {
        document.getElementById('gemini-key').value = settings.anthropicKey || '';
        document.getElementById('serpapi-key').value = settings.serpApiKey || '';
        document.getElementById('profile-name').value = settings.profileName || '';
        document.getElementById('profile-email').value = settings.profileEmail || '';
        document.getElementById('profile-phone').value = settings.profilePhone || '';
        document.getElementById('profile-linkedin').value = settings.profileLinkedin || '';
        document.getElementById('profile-github').value = settings.profileGithub || '';
        document.getElementById('needs-sponsorship').checked = settings.needsSponsorship || false;
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
            anthropicKey: document.getElementById('gemini-key').value.trim(),
            serpApiKey: document.getElementById('serpapi-key').value.trim(),
            profileName: document.getElementById('profile-name').value.trim(),
            profileEmail: document.getElementById('profile-email').value.trim(),
            profilePhone: document.getElementById('profile-phone').value.trim(),
            profileLinkedin: document.getElementById('profile-linkedin').value.trim(),
            profileGithub: document.getElementById('profile-github').value.trim(),
            needsSponsorship: document.getElementById('needs-sponsorship').checked,
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

        chrome.runtime?.sendMessage({ type: 'SETTINGS_UPDATED', settings: newSettings }, () => { if (chrome.runtime.lastError) { /* suppress */ } });

        const feedback = document.getElementById('save-feedback');
        feedback.style.display = 'block';
        setTimeout(() => feedback.style.display = 'none', 2000);
        checkOnboarding();
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

    // ====== Supabase Auth & Sync ======
    // Load Supabase settings
    chrome.storage.sync.get({ supabaseUrl: '', supabaseAnonKey: '' }, (supa) => {
        const urlEl = document.getElementById('supabase-url');
        const keyEl = document.getElementById('supabase-anon-key');
        if (urlEl) urlEl.value = supa.supabaseUrl || '';
        if (keyEl) keyEl.value = supa.supabaseAnonKey || '';
    });

    // Initialize Supabase and check auth state
    async function initSupabase() {
        if (typeof SupabaseClient === 'undefined') return;
        const initialized = await SupabaseClient.init();
        if (!initialized) return;

        const user = await AuthManager.getUser();
        updateAuthUI(user);

        if (user && typeof CloudSync !== 'undefined') {
            CloudSync.initialSync();
        }
    }

    function updateAuthUI(user) {
        const signedOut = document.getElementById('auth-signed-out');
        const signedIn = document.getElementById('auth-signed-in');
        if (!signedOut || !signedIn) return;

        if (user) {
            signedOut.style.display = 'none';
            signedIn.style.display = 'block';
            const emailEl = document.getElementById('auth-user-email');
            if (emailEl) emailEl.textContent = user.email || 'User';
        } else {
            signedOut.style.display = 'block';
            signedIn.style.display = 'none';
        }
    }

    function showAuthError(msg) {
        const el = document.getElementById('auth-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    }

    // Sign In
    document.getElementById('btn-sign-in')?.addEventListener('click', async () => {
        const email = document.getElementById('auth-email')?.value.trim();
        const password = document.getElementById('auth-password')?.value;
        if (!email || !password) { showAuthError('Please enter email and password.'); return; }

        try {
            // Save Supabase settings first
            const supaUrl = document.getElementById('supabase-url')?.value.trim();
            const supaKey = document.getElementById('supabase-anon-key')?.value.trim();
            if (supaUrl && supaKey) {
                await new Promise(r => chrome.storage.sync.set({ supabaseUrl: supaUrl, supabaseAnonKey: supaKey }, r));
                await SupabaseClient.init();
            }

            const data = await AuthManager.signIn(email, password);
            updateAuthUI(data.user);
            if (typeof CloudSync !== 'undefined') CloudSync.initialSync();
        } catch (e) {
            showAuthError(e.message);
        }
    });

    // Sign Up
    document.getElementById('btn-sign-up')?.addEventListener('click', async () => {
        const email = document.getElementById('auth-email')?.value.trim();
        const password = document.getElementById('auth-password')?.value;
        if (!email || !password) { showAuthError('Please enter email and password.'); return; }

        try {
            const supaUrl = document.getElementById('supabase-url')?.value.trim();
            const supaKey = document.getElementById('supabase-anon-key')?.value.trim();
            if (supaUrl && supaKey) {
                await new Promise(r => chrome.storage.sync.set({ supabaseUrl: supaUrl, supabaseAnonKey: supaKey }, r));
                await SupabaseClient.init();
            }

            const data = await AuthManager.signUp(email, password);
            if (data.user) {
                updateAuthUI(data.user);
            } else {
                showAuthError('Check your email to confirm your account.');
            }
        } catch (e) {
            showAuthError(e.message);
        }
    });

    // Sign Out
    document.getElementById('btn-sign-out')?.addEventListener('click', async () => {
        await AuthManager.signOut();
        updateAuthUI(null);
    });

    // Manual Sync
    document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-sync-now');
        btn.textContent = 'Syncing...';
        try {
            await CloudSync.initialSync();
            btn.textContent = 'Synced!';
            setTimeout(() => btn.textContent = 'Sync Now', 2000);
        } catch (e) {
            btn.textContent = 'Sync Failed';
            setTimeout(() => btn.textContent = 'Sync Now', 2000);
        }
    });

    // Init Supabase on popup open
    initSupabase();

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

        if (uploadZoneEl) {
            uploadZoneEl.innerHTML = '<div class="upload-icon"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg></div><p>Extracting text from resume...</p>';
        }

        let text = '';
        try {
            if (file.name.toLowerCase().endsWith('.pdf')) {
                if (typeof PDFExtractor !== 'undefined') {
                    text = await PDFExtractor.extractText(file);
                } else {
                    // Fallback: try reading as text
                    text = await readFileAsText(file);
                    if (!text || text.length < 50) {
                        if (uploadZoneEl) {
                            uploadZoneEl.innerHTML = '<div class="upload-icon" style="color:var(--warning)"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><p style="color:var(--warning)">Could not extract text from this PDF.</p><p class="upload-hint">Try uploading as a .txt file instead</p>';
                            uploadZoneEl.style.display = 'block';
                        }
                        return;
                    }
                }
            } else {
                text = await readFileAsText(file);
            }
        } catch (e) {
            console.error('Resume extraction failed:', e);
            text = await readFileAsText(file);
        }

        if (!text || text.trim().length < 20) {
            if (uploadZoneEl) {
                uploadZoneEl.innerHTML = '<div class="upload-icon" style="color:var(--danger)"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div><p style="color:var(--danger)">Could not extract text from this file.</p><p class="upload-hint">Try copying your resume text into a .txt file</p>';
                uploadZoneEl.style.display = 'block';
            }
            return;
        }

        currentResumeText = text;
        await StorageManager.saveResume({ id: 'primary', filename: file.name, text: text, uploadedAt: new Date().toISOString() });
        showResumePreview(file.name, text);
        checkOnboarding();
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
            reader.onload = (e) => { resolve(e.target.result.split(',')[1]); };
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
        btn.innerHTML = `${icon('loader', 'sm')} Analyzing...`;

        const quickResult = ATSScorer.quickScore(currentResumeText, settings.profileSkills || 'software engineer');
        displayATSScore(quickResult);

        if (settings.anthropicKey) {
            try {
                const deepResult = await ClaudeAI.calculateATSScore(
                    settings.anthropicKey,
                    currentResumeText,
                    `Role: ${settings.profileRole || 'Senior Software Engineer'}\nRequired Skills: ${settings.profileSkills || 'Not specified'}`
                );
                if (!deepResult.error) {
                    displayATSScore({ overallScore: deepResult.overallScore, breakdown: deepResult.breakdown, improvements: deepResult.topImprovements });
                }
            } catch (e) {
                console.error('Claude ATS analysis failed:', e);
            }
        }

        btn.disabled = false;
        btn.innerHTML = `${icon('barChart', 'sm')} Analyze My Resume`;
    });

    function displayATSScore(result) {
        const container = document.getElementById('ats-result');
        container.style.display = 'flex';

        const score = result.overallScore || 0;
        const ring = document.getElementById('ats-score-ring');
        const circumference = 2 * Math.PI * 54;
        ring.style.strokeDashoffset = circumference - (score / 100) * circumference;

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
                return `<div class="ats-detail-item"><span class="ats-detail-label">${label}</span><span class="ats-detail-value ${cls}">${s}%</span></div>`;
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
        btn.innerHTML = `${icon('loader', 'sm')} Searching...`;

        try {
            if (settings.serpApiKey) {
                const jobs = await JobSearch.searchGoogleJobs(settings.serpApiKey, query, location, { hoursAgo });

                if (settings.anthropicKey && currentResumeText && jobs.length > 0) {
                    for (const job of jobs.slice(0, 5)) {
                        try {
                            const match = await ClaudeAI.analyzeJobMatch(settings.anthropicKey, currentResumeText, job.description, {
                                role: settings.profileRole, yoe: settings.profileYOE, skills: settings.profileSkills
                            });
                            job.matchScore = match.matchScore || 0;
                            job.matchDetails = match;
                        } catch (e) { console.warn('Match scoring failed:', e); }
                    }
                }

                for (const job of jobs) { await StorageManager.saveJob(job); }
                displayJobs(jobs);
            } else {
                const url = `https://www.google.com/search?q=${encodeURIComponent(query + ' jobs')}&ibp=htl;jobs`;
                chrome.tabs?.create({ url });
            }
        } catch (e) { console.error('Search failed:', e); }

        btn.disabled = false;
        btn.innerHTML = `${icon('search', 'sm')} Search Jobs`;
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

            if (result.jobs.length > 0) {
                for (const job of result.jobs) { await StorageManager.saveJob(job); }
                tabBtns[0].click();

                if (settings.anthropicKey && currentResumeText) {
                    for (const job of result.jobs.slice(0, 5)) {
                        try {
                            const match = await ClaudeAI.analyzeJobMatch(settings.anthropicKey, currentResumeText, job.description, {
                                role: settings.profileRole, yoe: settings.profileYOE, skills: settings.profileSkills
                            });
                            job.matchScore = match.matchScore || 0;
                            job.matchDetails = match;
                            await StorageManager.saveJob(job);
                        } catch (e) { console.warn('Scoring failed:', e); }
                    }
                }
                displayJobs(result.jobs);
            }

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
        <span class="quick-link-icon">${icon('externalLink', 'sm')}</span>
        <span class="quick-link-text">${s.name}</span>
        <span class="quick-link-badge">Open</span>
      </a>
    `).join('');

        container.querySelectorAll('.quick-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs?.create({ url: link.href }) || window.open(link.href, '_blank');
            });
        });
    }

    if (settings.profileRole) {
        const searches = JobSearch.generateATSBoardSearches(settings.profileRole, { hoursAgo: 24, location: settings.profileLocations || '' });
        generateQuickLinks(searches);
    }

    // ====== Display Jobs ======
    async function displayJobs(jobs) {
        const list = document.getElementById('job-list');

        if (!jobs || jobs.length === 0) {
            list.innerHTML = `
        <div class="empty-state">
          ${icon('search', 'lg')}
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
            <span>${icon('mapPin', 'xs')} ${escapeHTML(job.location || 'Not specified')}</span>
            <span>${icon('clock', 'xs')} ${escapeHTML(timeAgo)}</span>
            ${job.salary ? `<span>${icon('dollar', 'xs')} ${escapeHTML(job.salary)}</span>` : ''}
          </div>
          ${job.via ? `<div class="job-tags"><span class="job-tag">${escapeHTML(job.via)}</span></div>` : ''}
          <div class="job-actions">
            <button class="btn btn-sm btn-ghost btn-save-job" data-job-id="${job.id}">${icon('bookmark', 'xs')} Save</button>
            <button class="btn btn-sm btn-primary btn-analyze-job" data-job-id="${job.id}">${icon('target', 'xs')} Analyze</button>
            ${job.applyLink ? `<a class="btn btn-sm btn-accent" href="${job.applyLink}" target="_blank">${icon('externalLink', 'xs')} Apply</a>` : ''}
          </div>
        </div>`;
        }).join('');

        document.querySelector('#stat-jobs .stat-value').textContent = jobs.length;

        list.querySelectorAll('.btn-save-job').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const jobId = btn.dataset.jobId;
                const job = jobs.find(j => j.id === jobId);
                if (job) {
                    await StorageManager.saveApplication({ ...job, status: 'saved', savedAt: new Date().toISOString() });
                    btn.innerHTML = `${icon('check', 'xs')} Saved`;
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
                if (job) { await analyzeAndTailorJob(job); }
            });
        });
    }

    // ====== Analyze & Tailor for specific job ======
    async function analyzeAndTailorJob(job) {
        if (!settings.anthropicKey) { alert('Please add your Anthropic API key in Settings first.'); return; }
        if (!currentResumeText) { alert('Please upload your resume in the Resume tab first.'); return; }

        try {
            if (chrome.sidePanel) {
                await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
                chrome.runtime.sendMessage({
                    type: 'ANALYZE_JOB', job: job, resume: currentResumeText, settings: settings
                }, () => { if (chrome.runtime.lastError) { /* suppress */ } });
            } else {
                await showInlineAnalysis(job);
            }
        } catch (e) {
            await showInlineAnalysis(job);
        }
    }

    async function showInlineAnalysis(job) {
        const template = document.querySelector('.template-btn.active')?.dataset.template || 'jakes';
        const card = document.querySelector(`.job-card[data-job-id="${job.id}"]`);
        if (card) {
            const actionsDiv = card.querySelector('.job-actions');
            actionsDiv.innerHTML = `<span class="loading">${icon('loader', 'sm')} AI analyzing & tailoring resume...</span>`;
        }

        try {
            const atsResult = await ClaudeAI.calculateATSScore(settings.anthropicKey, currentResumeText, job.description);
            const tailoredResume = await ClaudeAI.tailorResume(settings.anthropicKey, currentResumeText, job.description, template, {
                name: settings.profileName || '', role: settings.profileRole || '', yoe: settings.profileYOE || ''
            });

            if (card) {
                const atsScore = atsResult.overallScore || 0;
                const scoreColor = atsScore >= 90 ? 'good' : atsScore >= 75 ? 'okay' : 'bad';
                card.innerHTML += `
          <div class="tailored-output">
            <div class="tailored-header">
              <h3>ATS Score: <span class="ats-detail-value ${scoreColor}">${atsScore}%</span></h3>
              <button class="btn btn-sm btn-ghost btn-copy-resume">${icon('copy', 'xs')} Copy</button>
            </div>
            <div class="tailored-body">${escapeHTML(tailoredResume)}</div>
          </div>`;

                card.querySelector('.btn-copy-resume')?.addEventListener('click', () => {
                    navigator.clipboard.writeText(tailoredResume);
                    card.querySelector('.btn-copy-resume').innerHTML = `${icon('check', 'xs')} Copied!`;
                });
            }
        } catch (e) {
            console.error('Analysis failed:', e);
            if (card) {
                const actionsDiv = card.querySelector('.job-actions') || card;
                actionsDiv.innerHTML = `<span style="color:var(--danger);font-size:12px;">Analysis failed: ${e.message}</span>`;
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

        const allApps = await StorageManager.getApplications('all');
        document.querySelector('#stat-applied .stat-value').textContent = allApps.filter(a => a.status === 'applied').length;

        if (!apps.length) {
            list.innerHTML = `
        <div class="empty-state">
          ${icon('fileText', 'lg')}
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
          ${app.appliedAt ? ' · Applied: ' + new Date(app.appliedAt).toLocaleDateString() : ''}
        </div>
        <div class="tracker-item-actions">
          <select class="status-select" data-app-id="${app.id}">
            <option value="saved" ${app.status === 'saved' ? 'selected' : ''}>Saved</option>
            <option value="applied" ${app.status === 'applied' ? 'selected' : ''}>Applied</option>
            <option value="interview" ${app.status === 'interview' ? 'selected' : ''}>Interview</option>
            <option value="offer" ${app.status === 'offer' ? 'selected' : ''}>Offer</option>
            <option value="rejected" ${app.status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
          <button class="btn btn-sm btn-danger btn-delete-app" data-app-id="${app.id}">${icon('trash', 'xs')}</button>
        </div>
      </div>
    `).join('');

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

    // Init onboarding check
    checkOnboarding();

})();
