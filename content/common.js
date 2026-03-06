/* ========================================
   JobHunter AI — Common Content Script Utils
   Shared helpers for all job board content scripts
   ======================================== */

const JobHunterContent = {
    // Inject a floating button on the page
    injectButton(container, text, onClick) {
        const btn = document.createElement('button');
        btn.className = 'jh-btn';
        btn.innerHTML = text;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick(e);
        });
        container.appendChild(btn);
        return btn;
    },

    // Show a floating score badge
    showScoreBadge(container, score, prepend = false) {
        // Remove existing badge
        const existing = container.querySelector('.jh-score-badge');
        if (existing) existing.remove();

        const badge = document.createElement('div');
        badge.className = 'jh-score-badge';
        const colorClass = score >= 80 ? 'jh-score-high' : score >= 60 ? 'jh-score-med' : 'jh-score-low';
        badge.classList.add(colorClass);
        badge.innerHTML = `<span class="jh-score-icon">🎯</span> ${score}%`;
        badge.title = 'JobHunter AI Match Score';

        if (prepend && container.firstChild) {
            container.insertBefore(badge, container.firstChild);
        } else {
            container.appendChild(badge);
        }
        return badge;
    },

    // Show floating toast notification
    showToast(message, type = 'info') {
        const existing = document.querySelector('.jh-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `jh-toast jh-toast-${type}`;
        toast.innerHTML = `<span class="jh-toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '🎯'}</span> ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('jh-toast-show'), 10);
        setTimeout(() => {
            toast.classList.remove('jh-toast-show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Extract text content from element, cleaning whitespace
    extractText(el) {
        if (!el) return '';
        return el.innerText?.trim().replace(/\s+/g, ' ') || '';
    },

    // Send message to background script
    async sendMessage(msg) {
        return new Promise((resolve) => {
            try {
                if (!chrome.runtime?.id) { resolve(null); return; }
                chrome.runtime.sendMessage(msg, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('JobHunter AI: extension context changed, please refresh the page.');
                        resolve(null);
                        return;
                    }
                    resolve(response);
                });
            } catch (e) {
                console.warn('JobHunter AI: extension was reloaded. Refresh this page to reconnect.');
                resolve(null);
            }
        });
    },

    // Store job data for analysis
    async storeJobForAnalysis(jobData) {
        try {
            if (!chrome.runtime?.id) return;
            await chrome.storage.local.set({ pendingJobAnalysis: jobData });
        } catch (e) {
            console.warn('JobHunter AI: extension was reloaded. Refresh this page to reconnect.');
        }
    },

    // Check if element already has our injection
    isInjected(el) {
        return el?.querySelector('.jh-btn') || el?.querySelector('.jh-score-badge');
    }
};
