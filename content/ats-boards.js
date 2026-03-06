/* ========================================
   JobHunter AI — ATS Boards Content Script
   For Greenhouse, Ashby, Lever job pages
   ======================================== */

(function () {
    'use strict';

    const hostname = window.location.hostname;

    function detectBoard() {
        if (hostname.includes('greenhouse.io')) return 'greenhouse';
        if (hostname.includes('ashby.io')) return 'ashby';
        if (hostname.includes('lever.co')) return 'lever';
        return 'unknown';
    }

    function injectButtons() {
        const board = detectBoard();
        let jobCards, detailSelectors;

        switch (board) {
            case 'greenhouse':
                jobCards = document.querySelectorAll('.opening, .job-post, [data-mapped="true"]');
                detailSelectors = {
                    title: '#header .app-title, .job__title, h1',
                    company: '.company-name, .header__logo-text',
                    location: '.location, .body--metadata',
                    description: '#content, .job__description, .content'
                };
                break;
            case 'ashby':
                jobCards = document.querySelectorAll('[class*="job-posting-brief"], .ashby-job-posting-brief-list a');
                detailSelectors = {
                    title: 'h1, [class*="posting-headline"]',
                    company: '[class*="company-name"], .ashby-job-posting-brief-list h1',
                    location: '[class*="location"]',
                    description: '[class*="posting-description"], [class*="job-description"]'
                };
                break;
            case 'lever':
                jobCards = document.querySelectorAll('.posting, .posting-title');
                detailSelectors = {
                    title: '.posting-headline h2, .posting-header .posting-title',
                    company: '.main-header-logo, .posting-categories .sort-by-team',
                    location: '.posting-categories .sort-by-location, .location',
                    description: '.posting-page .section-wrapper, [data-qa="job-description"]'
                };
                break;
        }

        // Inject on job listings
        if (jobCards) {
            jobCards.forEach(card => {
                if (JobHunterContent.isInjected(card)) return;

                const container = document.createElement('div');
                container.className = 'jh-card-actions';

                JobHunterContent.injectButton(container, '🎯 Analyze', async () => {
                    const jobData = extractATSJobData(card, board);
                    if (jobData) {
                        JobHunterContent.showToast('Analyzing with JobHunter AI...', 'info');
                        await JobHunterContent.storeJobForAnalysis(jobData);
                        chrome.runtime.sendMessage({ type: 'ANALYZE_JOB', job: jobData });
                    }
                });

                card.appendChild(container);
            });
        }

        // Inject on job detail page
        if (detailSelectors) {
            const titleEl = document.querySelector(detailSelectors.title);
            if (titleEl && !JobHunterContent.isInjected(titleEl.parentElement)) {
                const container = document.createElement('div');
                container.className = 'jh-detail-actions';

                JobHunterContent.injectButton(container, '🎯 Analyze & Tailor Resume', async () => {
                    const jobData = extractATSDetailData(detailSelectors, board);
                    if (jobData) {
                        JobHunterContent.showToast('Analyzing...', 'info');
                        await JobHunterContent.storeJobForAnalysis(jobData);
                        chrome.runtime.sendMessage({ type: 'ANALYZE_JOB', job: jobData });
                    }
                });

                JobHunterContent.injectButton(container, '💾 Save', async () => {
                    const jobData = extractATSDetailData(detailSelectors, board);
                    if (jobData) {
                        chrome.runtime.sendMessage({
                            type: 'SAVE_JOB',
                            job: { ...jobData, status: 'saved', savedAt: new Date().toISOString() }
                        });
                        JobHunterContent.showToast('Saved!', 'success');
                    }
                });

                titleEl.parentElement.appendChild(container);
            }
        }
    }

    function extractATSJobData(card, board) {
        let title = '', company = '', location = '', link = '';

        switch (board) {
            case 'greenhouse':
                title = card.querySelector('a')?.textContent?.trim() || card.textContent?.trim() || '';
                location = card.querySelector('.location')?.textContent?.trim() || '';
                link = card.querySelector('a')?.href || window.location.href;
                company = document.querySelector('.company-name, title')?.textContent?.split(' ')[0] || '';
                break;
            case 'ashby':
                title = card.querySelector('h3, [class*="title"]')?.textContent?.trim() || card.textContent?.trim() || '';
                location = card.querySelector('[class*="location"]')?.textContent?.trim() || '';
                link = card.querySelector('a')?.href || card.href || window.location.href;
                break;
            case 'lever':
                title = card.querySelector('h5, .posting-name')?.textContent?.trim() || card.textContent?.trim() || '';
                location = card.querySelector('.sort-by-location, .posting-categories')?.textContent?.trim() || '';
                link = card.querySelector('a')?.href || card.closest('a')?.href || window.location.href;
                break;
        }

        return {
            id: `${board}_${Date.now()}`,
            title,
            company,
            location,
            source: board,
            applyLink: link,
            dateFound: new Date().toISOString()
        };
    }

    function extractATSDetailData(selectors, board) {
        return {
            id: `${board}_${Date.now()}`,
            title: document.querySelector(selectors.title)?.textContent?.trim() || '',
            company: document.querySelector(selectors.company)?.textContent?.trim() || '',
            location: document.querySelector(selectors.location)?.textContent?.trim() || '',
            description: document.querySelector(selectors.description)?.textContent?.trim() || '',
            source: board,
            applyLink: window.location.href,
            dateFound: new Date().toISOString()
        };
    }

    // Observer
    const observer = new MutationObserver(() => {
        requestAnimationFrame(injectButtons);
    });

    function init() {
        injectButtons();
        observer.observe(document.body, { childList: true, subtree: true });
        console.log(`🎯 JobHunter AI: ${detectBoard()} content script loaded`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
