/* ========================================
   JobHunter AI — LinkedIn Content Script
   Injects analyze buttons, shows match scores,
   and auto-applies LinkedIn URL time filters
   ======================================== */

(function () {
    'use strict';

    // ====== Auto-apply time filter to LinkedIn job search ======
    function applyTimeFilter() {
        const url = new URL(window.location.href);
        // If no time filter is set, add f_TPR=r86400 (past 24 hours)
        if (!url.searchParams.has('f_TPR') && url.pathname.includes('/jobs/search')) {
            // Don't auto-redirect, but show a suggestion
            showTimeFilterBanner();
        }
    }

    function showTimeFilterBanner() {
        if (document.querySelector('.jh-time-banner')) return;

        const banner = document.createElement('div');
        banner.className = 'jh-time-banner';
        banner.innerHTML = `
      <div class="jh-banner-content">
        <span class="jh-banner-icon">🎯 JobHunter AI</span>
        <span class="jh-banner-text">Filter for latest jobs:</span>
        <button class="jh-banner-btn" data-hours="1">Last Hour</button>
        <button class="jh-banner-btn jh-banner-btn-active" data-hours="24">Last 24h</button>
        <button class="jh-banner-btn" data-hours="168">Last Week</button>
        <button class="jh-banner-close">✕</button>
      </div>
    `;

        // Insert at top of job search
        const target = document.querySelector('.jobs-search-results-list, .scaffold-layout__list, main');
        if (target) {
            target.insertBefore(banner, target.firstChild);
        } else {
            document.body.insertBefore(banner, document.body.firstChild);
        }

        // Handlers
        banner.querySelectorAll('.jh-banner-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const hours = parseInt(btn.dataset.hours);
                const url = new URL(window.location.href);
                url.searchParams.set('f_TPR', `r${hours * 3600}`);
                url.searchParams.set('sortBy', 'DD'); // Sort by date
                window.location.href = url.toString();
            });
        });

        banner.querySelector('.jh-banner-close').addEventListener('click', () => {
            banner.remove();
        });
    }

    // ====== Inject Analyze Buttons on Job Cards ======
    function injectJobButtons() {
        // LinkedIn job cards in search results
        const jobCards = document.querySelectorAll(
            '.job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item, [data-job-id]'
        );

        jobCards.forEach(card => {
            if (JobHunterContent.isInjected(card)) return;

            const titleEl = card.querySelector(
                '.job-card-list__title, .job-card-container__link, a[href*="/jobs/view/"]'
            );

            if (!titleEl) return;

            // Create button container
            const container = document.createElement('div');
            container.className = 'jh-card-actions';

            JobHunterContent.injectButton(container, '🎯 Analyze', async () => {
                const jobData = extractLinkedInJobData(card);
                if (jobData) {
                    JobHunterContent.showToast('Analyzing job with AI...', 'info');
                    await JobHunterContent.storeJobForAnalysis(jobData);

                    // Open sidepanel
                    chrome.runtime.sendMessage({
                        type: 'ANALYZE_JOB',
                        job: jobData
                    });
                }
            });

            // Append after the title/footer area
            const footer = card.querySelector('.job-card-container__footer-wrapper, .job-card-list__footer-wrapper') || card;
            footer.appendChild(container);
        });
    }

    // ====== Inject on Job Detail Page ======
    function injectJobDetailButtons() {
        const detailPane = document.querySelector(
            '.jobs-details, .job-details-jobs-unified-top-card, .jobs-unified-top-card'
        );

        if (!detailPane || JobHunterContent.isInjected(detailPane)) return;

        const container = document.createElement('div');
        container.className = 'jh-detail-actions';

        JobHunterContent.injectButton(container, '🎯 Analyze & Tailor Resume', async () => {
            const jobData = extractLinkedInJobDetailData();
            if (jobData) {
                JobHunterContent.showToast('Analyzing job and tailoring resume...', 'info');
                await JobHunterContent.storeJobForAnalysis(jobData);
                chrome.runtime.sendMessage({ type: 'ANALYZE_JOB', job: jobData });
            }
        });

        JobHunterContent.injectButton(container, '💾 Save to Tracker', async () => {
            const jobData = extractLinkedInJobDetailData();
            if (jobData) {
                chrome.runtime.sendMessage({
                    type: 'SAVE_JOB',
                    job: { ...jobData, source: 'linkedin', status: 'saved', savedAt: new Date().toISOString() }
                });
                JobHunterContent.showToast('Job saved to tracker!', 'success');
            }
        });

        // Insert after the top card
        const topCard = document.querySelector(
            '.jobs-unified-top-card, .job-details-jobs-unified-top-card__container'
        );
        if (topCard) {
            topCard.parentNode.insertBefore(container, topCard.nextSibling);
        } else {
            detailPane.appendChild(container);
        }
    }

    // ====== Extract Job Data ======
    function extractLinkedInJobData(card) {
        const title = card.querySelector('.job-card-list__title, .job-card-container__link')?.textContent?.trim() || '';
        const company = card.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle')?.textContent?.trim() || '';
        const location = card.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption')?.textContent?.trim() || '';
        const link = card.querySelector('a[href*="/jobs/view/"]')?.href || '';

        return {
            id: 'li_' + (link.match(/\/jobs\/view\/(\d+)/)?.[1] || Date.now()),
            title,
            company,
            location,
            source: 'linkedin',
            applyLink: link,
            dateFound: new Date().toISOString()
        };
    }

    function extractLinkedInJobDetailData() {
        const title = document.querySelector(
            '.jobs-unified-top-card__job-title, .job-details-jobs-unified-top-card__job-title, .t-24'
        )?.textContent?.trim() || '';

        const company = document.querySelector(
            '.jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__company-name'
        )?.textContent?.trim() || '';

        const location = document.querySelector(
            '.jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__bullet'
        )?.textContent?.trim() || '';

        const description = document.querySelector(
            '.jobs-description__content, .jobs-box__html-content, #job-details'
        )?.textContent?.trim() || '';

        const link = window.location.href;

        return {
            id: 'li_' + (link.match(/\/jobs\/view\/(\d+)/)?.[1] || Date.now()),
            title,
            company,
            location,
            description,
            source: 'linkedin',
            applyLink: link,
            dateFound: new Date().toISOString()
        };
    }

    // ====== Observer for Dynamic Content ======
    function startObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldInject = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldInject = true;
                    break;
                }
            }
            if (shouldInject) {
                requestAnimationFrame(() => {
                    injectJobButtons();
                    injectJobDetailButtons();
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ====== Init ======
    function init() {
        applyTimeFilter();
        injectJobButtons();
        injectJobDetailButtons();
        startObserver();
        console.log('🎯 JobHunter AI: LinkedIn content script loaded');
    }

    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
