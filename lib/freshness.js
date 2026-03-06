/* ========================================
   JobHunter AI — Ghost Job Freshness Detector
   Score job listings for freshness and ghost signals
   ======================================== */

const FreshnessDetector = {
    GHOST_PHRASES: [
        'building our talent pipeline',
        'future opportunities',
        'talent community',
        'not an active opening',
        'may not have an immediate opening',
        'evergreen requisition',
        'continuous posting',
        'talent pool',
        'proactive sourcing',
        'ongoing recruitment'
    ],

    analyze(jobData) {
        const signals = { score: 100, flags: [], verdict: 'Fresh' };

        // 1. Age check
        const postedDays = this.getDaysSincePosted(jobData.postedDate || jobData.dateFound);
        if (postedDays > 60) { signals.score -= 50; signals.flags.push('Posted 60+ days ago'); }
        else if (postedDays > 30) { signals.score -= 25; signals.flags.push('Posted 30+ days ago'); }
        else if (postedDays > 14) { signals.score -= 10; signals.flags.push('Posted 2+ weeks ago'); }
        else if (postedDays <= 3) { signals.flags.push('Just posted!'); signals.score += 5; }

        // 2. Ghost phrases
        const descLower = (jobData.description || '').toLowerCase();
        this.GHOST_PHRASES.forEach(phrase => {
            if (descLower.includes(phrase)) {
                signals.score -= 30;
                signals.flags.push(`Ghost signal: "${phrase}"`);
            }
        });

        // 3. Applicant count (if available)
        if (jobData.applicantCount) {
            if (jobData.applicantCount > 500) {
                signals.score -= 15;
                signals.flags.push(`${jobData.applicantCount}+ applicants — very competitive`);
            } else if (jobData.applicantCount < 25) {
                signals.score += 10;
                signals.flags.push('Low applicant count — great opportunity');
            }
        }

        // Clamp and set verdict
        signals.score = Math.max(0, Math.min(100, signals.score));
        if (signals.score >= 80) signals.verdict = 'fresh';
        else if (signals.score >= 50) signals.verdict = 'stale';
        else signals.verdict = 'ghost';

        return signals;
    },

    getDaysSincePosted(dateStr) {
        if (!dateStr) return 0;
        const posted = new Date(dateStr);
        if (isNaN(posted.getTime())) return 0;
        const now = new Date();
        return Math.floor((now - posted) / (1000 * 60 * 60 * 24));
    },

    getBadgeHTML(verdict) {
        const configs = {
            'fresh': { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', text: 'Fresh' },
            'stale': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', text: 'Stale' },
            'ghost': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', text: 'Ghost Job' }
        };
        const c = configs[verdict] || configs['fresh'];
        return `<span class="jh-fresh-badge" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${c.bg};color:${c.color};border:1px solid ${c.color}30">${c.text}</span>`;
    }
};
