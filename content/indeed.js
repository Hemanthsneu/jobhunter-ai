/* ========================================
   JobHunter AI — Indeed Content Script
   ======================================== */

(function () {
    'use strict';

    function injectJobButtons() {
        // Indeed job cards
        const jobCards = document.querySelectorAll(
            '.job_seen_beacon, .jobsearch-ResultsList .result, .cardOutline, [data-jk]'
        );

        jobCards.forEach(card => {
            if (JobHunterContent.isInjected(card)) return;

            const container = document.createElement('div');
            container.className = 'jh-card-actions';

            JobHunterContent.injectButton(container, '🎯 Analyze', async () => {
                const jobData = extractIndeedJobData(card);
                if (jobData) {
                    JobHunterContent.showToast('Analyzing with JobHunter AI...', 'info');
                    await JobHunterContent.storeJobForAnalysis(jobData);
                    chrome.runtime.sendMessage({ type: 'ANALYZE_JOB', job: jobData });
                }
            });

            JobHunterContent.injectButton(container, '💾 Save', async () => {
                const jobData = extractIndeedJobData(card);
                if (jobData) {
                    chrome.runtime.sendMessage({
                        type: 'SAVE_JOB',
                        job: { ...jobData, status: 'saved', savedAt: new Date().toISOString() }
                    });
                    JobHunterContent.showToast('Saved to tracker!', 'success');
                }
            });

            card.appendChild(container);
        });
    }

    function injectJobDetailButtons() {
        const detailPane = document.querySelector(
            '.jobsearch-JobInfoHeader-title-container, #jobDescriptionText, .jobsearch-ViewJobLayout'
        );

        if (!detailPane || JobHunterContent.isInjected(detailPane)) return;

        const container = document.createElement('div');
        container.className = 'jh-detail-actions';

        JobHunterContent.injectButton(container, '🎯 Analyze & Tailor Resume', async () => {
            const jobData = extractIndeedDetailData();
            if (jobData) {
                JobHunterContent.showToast('Analyzing...', 'info');
                await JobHunterContent.storeJobForAnalysis(jobData);
                chrome.runtime.sendMessage({ type: 'ANALYZE_JOB', job: jobData });
            }
        });

        detailPane.appendChild(container);
    }

    function extractIndeedJobData(card) {
        const title = card.querySelector('.jobTitle a, .jcs-JobTitle a, h2 a')?.textContent?.trim() || '';
        const company = card.querySelector('.companyName, .company, [data-testid="company-name"]')?.textContent?.trim() || '';
        const location = card.querySelector('.companyLocation, .location, [data-testid="text-location"]')?.textContent?.trim() || '';
        const link = card.querySelector('.jobTitle a, .jcs-JobTitle a')?.href || '';
        const snippet = card.querySelector('.job-snippet, .jobCardShelfContainer')?.textContent?.trim() || '';

        return {
            id: 'in_' + (card.getAttribute('data-jk') || Date.now()),
            title,
            company,
            location,
            description: snippet,
            source: 'indeed',
            applyLink: link,
            dateFound: new Date().toISOString()
        };
    }

    function extractIndeedDetailData() {
        const title = document.querySelector('.jobsearch-JobInfoHeader-title, [data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim() || '';
        const company = document.querySelector('.jobsearch-InlineCompanyRating-companyHeader, [data-testid="inlineHeader-companyName"]')?.textContent?.trim() || '';
        const location = document.querySelector('.jobsearch-InlineCompanyRating .icl-u-xs-mt--xs, [data-testid="job-location"]')?.textContent?.trim() || '';
        const description = document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText')?.textContent?.trim() || '';

        return {
            id: 'in_' + Date.now(),
            title,
            company,
            location,
            description,
            source: 'indeed',
            applyLink: window.location.href,
            dateFound: new Date().toISOString()
        };
    }

    // Observer for dynamic content
    const observer = new MutationObserver(() => {
        requestAnimationFrame(() => {
            injectJobButtons();
            injectJobDetailButtons();
        });
    });

    function init() {
        injectJobButtons();
        injectJobDetailButtons();
        observer.observe(document.body, { childList: true, subtree: true });
        console.log('🎯 JobHunter AI: Indeed content script loaded');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
