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

        if (!analysisSettings.anthropicKey) {
            document.getElementById('score-section').innerHTML = `
        <h3>📊 ATS Score Analysis</h3>
        <p style="color: var(--warning); padding: 10px;">⚠️ Add your Anthropic API key in Settings for AI-powered analysis.</p>
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
                ClaudeAI.calculateATSScore(analysisSettings.anthropicKey, resumeText, job.description || job.title),
                ClaudeAI.analyzeJobMatch(analysisSettings.anthropicKey, resumeText, job.description || job.title, {
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
            const tailored = await ClaudeAI.tailorResume(
                analysisSettings.anthropicKey,
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

            if (currentJob && settings.anthropicKey) {
                const savedResume = await StorageManager.getResume('primary');
                if (savedResume?.text) {
                    document.getElementById('tailored-content').innerHTML = '<div class="loading-shimmer" style="width:100%; height:100px;"></div>';
                    try {
                        const tailored = await ClaudeAI.tailorResume(
                            settings.anthropicKey,
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

    // Download tailored resume as real PDF using html2pdf.js
    document.getElementById('btn-download-tailored').addEventListener('click', async () => {
        if (currentTailoredResume) {
            const btn = document.getElementById('btn-download-tailored');
            btn.textContent = 'Generating...';
            btn.disabled = true;
            try {
                const html = ResumeTemplates.generateHTML(currentTailoredResume, currentTemplate);
                const jobTitle = (currentJob?.title || 'Tailored_Resume').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');

                // Create a temporary container for html2pdf
                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.top = '0';
                container.style.width = '8.5in';

                // Extract body content from the full HTML template
                const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);

                if (styleMatch) {
                    const styleEl = document.createElement('style');
                    styleEl.textContent = styleMatch[1];
                    container.appendChild(styleEl);
                }

                const content = document.createElement('div');
                content.innerHTML = bodyMatch ? bodyMatch[1] : html;
                container.appendChild(content);
                document.body.appendChild(container);

                // Generate PDF
                await html2pdf().set({
                    margin: [0.4, 0.5, 0.4, 0.5],
                    filename: `${jobTitle}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                    pagebreak: { mode: ['avoid-all'] }
                }).from(container).save();

                document.body.removeChild(container);
                btn.textContent = 'Downloaded!';
            } catch (err) {
                console.error('PDF generation failed:', err);
                btn.textContent = 'Error';
                // Fallback to preview in new tab
                const html = ResumeTemplates.generateHTML(currentTailoredResume, currentTemplate);
                const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                if (chrome.tabs) chrome.tabs.create({ url: URL.createObjectURL(blob) });
            }
            setTimeout(() => { btn.textContent = 'Download PDF'; btn.disabled = false; }, 2000);
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
        if (!currentJob || !settings.anthropicKey) return;

        const btn = document.getElementById('btn-gen-cover');
        const content = document.getElementById('cover-content');
        btn.textContent = '⏳...';
        content.style.display = 'block';
        content.innerHTML = '<div class="loading-shimmer" style="width:100%; height:80px;"></div>';

        try {
            const savedResume = await StorageManager.getResume('primary');
            const letter = await ClaudeAI.generateCoverLetter(
                settings.anthropicKey,
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

    // Generate Interview Prep
    document.getElementById('btn-gen-interview').addEventListener('click', async () => {
        if (!currentJob || !settings.anthropicKey) return;

        const btn = document.getElementById('btn-gen-interview');
        const content = document.getElementById('interview-content');
        btn.textContent = 'Generating...';
        content.style.display = 'block';
        content.innerHTML = '<div class="loading-shimmer" style="width:100%;height:200px;"></div>';

        try {
            const savedResume = await StorageManager.getResume('primary');
            const questions = await ClaudeAI.generateInterviewPrep(
                settings.anthropicKey,
                currentJob.description || currentJob.title,
                savedResume?.text || '',
                currentJob.title || ''
            );

            if (Array.isArray(questions)) {
                const categories = {};
                questions.forEach(q => {
                    if (!categories[q.category]) categories[q.category] = [];
                    categories[q.category].push(q);
                });

                let html = '';
                for (const [cat, qs] of Object.entries(categories)) {
                    html += `<div class="interview-category">
                        <h4 style="margin:12px 0 8px;color:var(--accent);font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">${cat}</h4>`;
                    qs.forEach((q, i) => {
                        html += `<details class="interview-card" style="margin-bottom:8px;background:var(--bg-elevated);border-radius:8px;padding:0;">
                            <summary style="padding:10px 12px;cursor:pointer;font-size:12px;font-weight:500;list-style:none;display:flex;align-items:center;gap:8px;">
                                <span style="background:${q.difficulty === 'Hard' ? 'var(--error)' : q.difficulty === 'Medium' ? 'var(--warning)' : 'var(--success)'};color:white;font-size:9px;padding:2px 6px;border-radius:4px;font-weight:600;">${q.difficulty}</span>
                                ${q.question}
                            </summary>
                            <div style="padding:0 12px 12px;font-size:11px;color:var(--text-secondary);line-height:1.5;">
                                <p style="margin-bottom:6px;"><strong style="color:var(--text-primary);">Why they ask:</strong> ${q.whyTheyAsk}</p>
                                <p style="margin-bottom:6px;"><strong style="color:var(--text-primary);">Answer framework:</strong> ${q.answerFramework}</p>
                                <p><strong style="color:var(--error);">Red flags:</strong> ${q.redFlags}</p>
                            </div>
                        </details>`;
                    });
                    html += '</div>';
                }
                content.innerHTML = html;
            } else {
                content.textContent = 'Could not generate questions. Please try again.';
            }
        } catch (e) {
            content.textContent = 'Error: ' + e.message;
        }
        btn.textContent = 'Generate Questions';
    });

    // Follow-Up Emails
    const followUpHandler = async (stage) => {
        if (!currentJob || !settings.anthropicKey) return;

        const content = document.getElementById('followup-content');
        content.style.display = 'block';
        content.innerHTML = '<div class="loading-shimmer" style="width:100%;height:80px;"></div>';

        try {
            const email = await ClaudeAI.generateFollowUp(
                settings.anthropicKey,
                { company: currentJob.company, title: currentJob.title, resumeSummary: '' },
                stage
            );
            content.innerHTML = `
                <div style="white-space:pre-wrap;font-size:12px;line-height:1.6;padding:12px;background:var(--bg-elevated);border-radius:8px;">${email}</div>
                <button class="panel-btn" id="btn-copy-email" style="margin-top:8px;">Copy to Clipboard</button>
            `;
            document.getElementById('btn-copy-email').addEventListener('click', () => {
                navigator.clipboard.writeText(email);
                document.getElementById('btn-copy-email').textContent = 'Copied!';
                setTimeout(() => document.getElementById('btn-copy-email').textContent = 'Copy to Clipboard', 2000);
            });
        } catch (e) {
            content.textContent = 'Error: ' + e.message;
        }
    };
    document.getElementById('btn-followup-applied').addEventListener('click', () => followUpHandler('applied'));
    document.getElementById('btn-followup-interview').addEventListener('click', () => followUpHandler('interview'));

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
