/* ========================================
   JobHunter AI — H1B/Visa Intelligence
   Detect sponsorship signals in job descriptions
   ======================================== */

const VisaIntel = {
    POSITIVE_SIGNALS: [
        'visa sponsorship', 'h1b', 'h-1b', 'will sponsor', 'sponsorship available',
        'open to sponsorship', 'immigration support', 'relocation assistance',
        'work authorization provided', 'f1 opt', 'stem opt', 'sponsor qualified',
        'immigration assistance', 'we sponsor', 'sponsorship is available'
    ],

    NEGATIVE_SIGNALS: [
        'must be authorized', 'no sponsorship', 'citizens only', 'green card required',
        'permanent residents only', 'no visa', 'us work authorization required',
        'must be eligible to work', 'without sponsorship', 'cannot sponsor',
        'will not sponsor', 'do not sponsor', 'not able to sponsor',
        'authorized to work in the united states', 'u.s. citizen',
        'legally authorized', 'not offer sponsorship'
    ],

    analyze(jobDescription) {
        if (!jobDescription) return { status: 'unclear', confidence: 'low', signals: [] };
        const jdLower = jobDescription.toLowerCase();

        const positiveHits = this.POSITIVE_SIGNALS.filter(s => jdLower.includes(s));
        const negativeHits = this.NEGATIVE_SIGNALS.filter(s => jdLower.includes(s));

        if (negativeHits.length > 0) {
            return { status: 'no-sponsor', confidence: 'high', signals: negativeHits };
        }
        if (positiveHits.length > 0) {
            return { status: 'sponsors', confidence: 'high', signals: positiveHits };
        }
        return { status: 'unclear', confidence: 'low', signals: [] };
    },

    getBadgeHTML(status) {
        const configs = {
            'sponsors': { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', text: 'Sponsors H1B' },
            'no-sponsor': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', text: 'No Sponsorship' },
            'unclear': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', text: 'Visa Unclear' }
        };
        const c = configs[status] || configs['unclear'];
        return `<span class="jh-visa-badge" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${c.bg};color:${c.color};border:1px solid ${c.color}30">${c.text}</span>`;
    },

    filterJobs(jobs, userNeedsSponsorship) {
        if (!userNeedsSponsorship) return jobs;
        return jobs.filter(job => {
            const result = this.analyze(job.description || '');
            return result.status !== 'no-sponsor';
        });
    }
};
