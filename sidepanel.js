/* ========================================
   JobHunter AI — Side Panel Logic
   Deep analysis, resume tailoring, cover letter
   ======================================== */

(async function () {
    await StorageManager.init();
    const settings = await StorageManager.getSettings();

    let currentJob = null;
    let currentTailoredResume = '';
    let currentTemplate = 'jakes';

    // Listen for analysis requests
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'SIDEPANEL_ANALYZE' || message.type === 'ANALYZE_JOB') {
            currentJob = message.job;
            startAnalysis(message.job, message.resume, message.settings || settings);
        }
    });

    // Check for pending analysis from context menu or content script
    const pending = await chrome.storage.local.get('pendingJobAnalysis');
    if (pending.pendingJobAnalysis) {
        currentJob = pending.pendingJobAnalysis;
        chrome.storage.local.remove('pendingJobAnalysis');
        startAnalysis(currentJob, null, settings);
    }

    // Also check for text selection pending analysis
    const pendingText = await chrome.storage.local.get('pendingAnalysis');
    if (pendingText.pendingAnalysis) {
        const text = pendingText.pendingAnalysis;
        chrome.storage.local.remove('pendingAnalysis');
        currentJob = {
            id: 'sel_' + Date.now(),
            title: 'Selected Job Description',
            company: 'Unknown',
            description: text,
            source: 'selection'
        };
        startAnalysis(currentJob, null, settings);
    }

    async function startAnalysis(job, resumeText, analysisSettings) {
        const panel = document.getElementById('panel-content');
        const status = document.getElementById('panel-status');

        // Show content, hide status
        status.style.display = 'none';
        panel.style.display = 'block';

        // Set header
        document.getElementById('job-title').textContent = job.title || 'Job Analysis';
        document.getElementById('job-company').textContent = job.company || '';
        document.getElementById('job-location').textContent = job.location || '';

        // Get resume if not passed
        if (!resumeText) {
            const savedResume = await StorageManager.getResume('primary');
            resumeText = savedResume?.text || '';
        }

        if (!resumeText) {
            document.getElementById('score-section').innerHTML = `
        <h3>📊 ATS Score Analysis</h3>
        <p style="color: var(--warning); padding: 10px;">⚠️ Upload your resume in the extension popup first for AI analysis.</p>
      `;
            return;
        }

        if (!analysisSettings.geminiKey) {
            document.getElementById('score-section').innerHTML = `
        <h3>📊 ATS Score Analysis</h3>
        <p style="color: var(--warning); padding: 10px;">⚠️ Add your Gemini API key in Settings for AI-powered analysis.</p>
      `;

            // Still do local ATS scoring
            if (job.description) {
                const localScore = ATSScorer.quickScore(resumeText, job.description);
                if (localScore) displayLocalScore(localScore);
            }
            return;
        }

        // Show loading state
        showLoading();

        try {
            // Run ATS analysis and job match in parallel
            const [atsResult, matchResult] = await Promise.all([
                GeminiAI.calculateATSScore(analysisSettings.geminiKey, resumeText, job.description || job.title),
                GeminiAI.analyzeJobMatch(analysisSettings.geminiKey, resumeText, job.description || job.title, {
                    role: analysisSettings.profileRole,
                    yoe: analysisSettings.profileYOE,
                    skills: analysisSettings.profileSkills
                })
            ]);

            // Display ATS Score
            if (!atsResult.error) {
                displayATSScore(atsResult);
            }

            // Display keyword analysis
            if (!matchResult.error) {
                displayKeywords(matchResult);
            }

            // Display improvements
            if (atsResult.topImprovements) {
                displayImprovements(atsResult.topImprovements);
            }

            // Auto-generate tailored resume
            const tailored = await GeminiAI.tailorResume(
                analysisSettings.geminiKey,
                resumeText,
                job.description || job.title,
                currentTemplate,
                {
                    name: analysisSettings.profileName || '',
                    role: analysisSettings.profileRole || '',
                    yoe: analysisSettings.profileYOE || ''
                }
            );
            currentTailoredResume = tailored;
            document.getElementById('tailored-content').textContent = tailored;

        } catch (err) {
            console.error('Analysis failed:', err);
            document.getElementById('score-section').innerHTML = `
        <h3>📊 ATS Score Analysis</h3>
        <p style="color: var(--danger); padding: 10px;">❌ Analysis failed: ${err.message}</p>
      `;
        }
    }

    function showLoading() {
        const breakdown = document.getElementById('score-breakdown');
        breakdown.innerHTML = `
      <div class="loading-shimmer" style="width:100%; height:14px;"></div>
      <div class="loading-shimmer" style="width:80%; height:14px;"></div>
      <div class="loading-shimmer" style="width:90%; height:14px;"></div>
    `;
        document.getElementById('keywords-match').innerHTML = '<div class="loading-shimmer" style="width:100%; height:24px;"></div>';
        document.getElementById('keywords-missing').innerHTML = '<div class="loading-shimmer" style="width:100%; height:24px;"></div>';
        document.getElementById('improvements-list').innerHTML = '<div class="loading-shimmer" style="width:100%; height:40px;"></div>';
        document.getElementById('tailored-content').innerHTML = '<div class="loading-shimmer" style="width:100%; height:100px;"></div>';
    }

    function displayATSScore(result) {
        const score = result.overallScore || 0;
        const ring = document.getElementById('score-ring');
        const circumference = 2 * Math.PI * 54;

        setTimeout(() => {
            ring.style.strokeDashoffset = circumference - (score / 100) * circumference;
        }, 100);

        if (score >= 90) ring.style.stroke = 'var(--success)';
        else if (score >= 75) ring.style.stroke = 'var(--warning)';
        else ring.style.stroke = 'var(--danger)';

        document.getElementById('score-number').textContent = score;

        const breakdown = document.getElementById('score-breakdown');
        if (result.breakdown) {
            const items = Object.entries(result.breakdown).map(([key, val]) => {
                const s = typeof val === 'object' ? val.score : val;
                const cls = s >= 80 ? 'good' : s >= 60 ? 'okay' : 'bad';
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
                return `<div class="score-item"><span class="score-label">${label}</span><span class="score-val ${cls}">${s}%</span></div>`;
            }).join('');
            breakdown.innerHTML = items;
        }
    }

    function displayLocalScore(result) {
        const score = result.overallScore || 0;
        const ring = document.getElementById('score-ring');
        const circumference = 2 * Math.PI * 54;

        setTimeout(() => {
            ring.style.strokeDashoffset = circumference - (score / 100) * circumference;
        }, 100);

        if (score >= 90) ring.style.stroke = 'var(--success)';
        else if (score >= 75) ring.style.stroke = 'var(--warning)';
        else ring.style.stroke = 'var(--danger)';

        document.getElementById('score-number').textContent = score;

        const breakdown = document.getElementById('score-breakdown');
        const items = Object.entries(result.breakdown).map(([key, val]) => {
            const cls = val.score >= 80 ? 'good' : val.score >= 60 ? 'okay' : 'bad';
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
            return `<div class="score-item"><span class="score-label">${label}</span><span class="score-val ${cls}">${val.score}%</span></div>`;
        }).join('');
        breakdown.innerHTML = items;
    }

    function displayKeywords(matchResult) {
        const matchContainer = document.getElementById('keywords-match');
        const missingContainer = document.getElementById('keywords-missing');

        const matchKeywords = matchResult.keyMatches || [];
        const missingKeywords = matchResult.missingKeywords || [];

        matchContainer.innerHTML = matchKeywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('') || '<span style="color:var(--text-muted);">No matches found</span>';
        missingContainer.innerHTML = missingKeywords.map(kw => `<span class="keyword-tag">${kw}</span>`).join('') || '<span style="color:var(--success);">No critical keywords missing!</span>';
    }

    function displayImprovements(improvements) {
        const list = document.getElementById('improvements-list');
        list.innerHTML = improvements.map((imp, i) => `
      <div class="improvement-item">
        <div class="improvement-priority">${i + 1}</div>
        <div class="improvement-text">
          <div class="improvement-action">${imp.action}</div>
          <div class="improvement-impact">${imp.impact || ''}</div>
        </div>
      </div>
    `).join('');
    }

    // Template switching
    document.querySelectorAll('.tmpl-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.tmpl-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTemplate = btn.dataset.template;

            if (currentJob && settings.geminiKey) {
                const savedResume = await StorageManager.getResume('primary');
                if (savedResume?.text) {
                    document.getElementById('tailored-content').innerHTML = '<div class="loading-shimmer" style="width:100%; height:100px;"></div>';
                    try {
                        const tailored = await GeminiAI.tailorResume(
                            settings.geminiKey,
                            savedResume.text,
                            currentJob.description || currentJob.title,
                            currentTemplate,
                            { role: settings.profileRole, yoe: settings.profileYOE }
                        );
                        currentTailoredResume = tailored;
                        document.getElementById('tailored-content').textContent = tailored;
                    } catch (e) {
                        document.getElementById('tailored-content').textContent = 'Error: ' + e.message;
                    }
                }
            }
        });
    });

    // Copy tailored resume
    document.getElementById('btn-copy-tailored').addEventListener('click', () => {
        if (currentTailoredResume) {
            navigator.clipboard.writeText(currentTailoredResume);
            document.getElementById('btn-copy-tailored').textContent = 'Copied!';
            setTimeout(() => document.getElementById('btn-copy-tailored').textContent = 'Copy', 2000);
        }
    });

    // Download tailored resume as HTML file
    document.getElementById('btn-download-tailored').addEventListener('click', () => {
        if (currentTailoredResume) {
            const html = ResumeTemplates.generateHTML(currentTailoredResume, currentTemplate);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const jobTitle = (currentJob?.title || 'Resume').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
            a.download = `Tailored_Resume_${jobTitle}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            document.getElementById('btn-download-tailored').textContent = 'Downloaded!';
            setTimeout(() => document.getElementById('btn-download-tailored').textContent = 'Download', 2000);
        }
    });

    // Preview tailored resume as HTML
    document.getElementById('btn-preview-tailored').addEventListener('click', () => {
        if (currentTailoredResume) {
            const html = ResumeTemplates.generateHTML(currentTailoredResume, currentTemplate);
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        }
    });

    // Generate cover letter
    document.getElementById('btn-gen-cover').addEventListener('click', async () => {
        if (!currentJob || !settings.geminiKey) return;

        const btn = document.getElementById('btn-gen-cover');
        const content = document.getElementById('cover-content');
        btn.textContent = '⏳...';
        content.style.display = 'block';
        content.innerHTML = '<div class="loading-shimmer" style="width:100%; height:80px;"></div>';

        try {
            const savedResume = await StorageManager.getResume('primary');
            const letter = await GeminiAI.generateCoverLetter(
                settings.geminiKey,
                savedResume?.text || '',
                currentJob.description || currentJob.title,
                currentJob.company || ''
            );
            content.textContent = letter;
        } catch (e) {
            content.textContent = 'Error: ' + e.message;
        }

        btn.textContent = 'Generate';
    });

    // Save job
    document.getElementById('btn-save-job').addEventListener('click', async () => {
        if (currentJob) {
            await StorageManager.saveApplication({
                ...currentJob,
                status: 'saved',
                savedAt: new Date().toISOString()
            });
            document.getElementById('btn-save-job').textContent = '✅ Saved!';
        }
    });

    // Mark applied
    document.getElementById('btn-mark-applied').addEventListener('click', async () => {
        if (currentJob) {
            await StorageManager.saveApplication({
                ...currentJob,
                status: 'applied',
                appliedAt: new Date().toISOString()
            });
            document.getElementById('btn-mark-applied').textContent = '✅ Applied!';
        }
    });

})();
