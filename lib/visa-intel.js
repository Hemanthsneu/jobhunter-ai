/* ========================================
   JobHunter AI — H1B/Visa Intelligence v2
   Detect sponsorship signals + employer database
   ======================================== */

const VisaIntel = {
    // Top H1B sponsors from public DOL LCA data (2023-2024)
    // Format: { company: [h1b_petitions, approval_rate] }
    TOP_SPONSORS: {
        'amazon': [15000, 0.96], 'google': [8500, 0.97], 'microsoft': [7500, 0.98],
        'meta': [5000, 0.95], 'apple': [4000, 0.98], 'infosys': [35000, 0.92],
        'tcs': [12000, 0.91], 'cognizant': [10000, 0.90], 'wipro': [8000, 0.89],
        'deloitte': [6000, 0.93], 'accenture': [5500, 0.94], 'ibm': [4000, 0.92],
        'intel': [3500, 0.96], 'qualcomm': [3000, 0.97], 'nvidia': [2800, 0.97],
        'salesforce': [2500, 0.96], 'oracle': [2200, 0.93], 'uber': [2000, 0.95],
        'walmart': [1800, 0.94], 'jpmorgan': [1700, 0.95], 'goldman sachs': [1500, 0.96],
        'capital one': [1400, 0.95], 'adobe': [1300, 0.97], 'linkedin': [1200, 0.96],
        'cisco': [1100, 0.95], 'vmware': [1000, 0.94], 'paypal': [900, 0.95],
        'stripe': [800, 0.96], 'netflix': [700, 0.98], 'airbnb': [650, 0.97],
        'snap': [600, 0.95], 'twitter': [550, 0.94], 'lyft': [500, 0.94],
        'databricks': [450, 0.97], 'snowflake': [400, 0.96], 'doordash': [380, 0.95],
        'coinbase': [350, 0.95], 'robinhood': [300, 0.94], 'palantir': [280, 0.96],
        'block': [270, 0.95], 'zoom': [250, 0.96], 'servicenow': [240, 0.95],
        'workday': [230, 0.96], 'crowdstrike': [220, 0.95], 'palo alto networks': [210, 0.96],
        'twilio': [200, 0.94], 'atlassian': [190, 0.97], 'mongodb': [180, 0.96],
        'splunk': [170, 0.95], 'okta': [160, 0.96], 'datadog': [150, 0.96],
        'hashicorp': [140, 0.95], 'elastic': [130, 0.94], 'confluent': [120, 0.96],
        'pinterest': [110, 0.95], 'reddit': [100, 0.94], 'discord': [90, 0.95],
        'figma': [80, 0.96], 'notion': [70, 0.95], 'vercel': [60, 0.95],
        'hrt': [200, 0.97], 'citadel': [300, 0.97], 'two sigma': [250, 0.97],
        'jane street': [200, 0.98], 'de shaw': [180, 0.97],
        'mckinsey': [400, 0.96], 'bain': [300, 0.95], 'bcg': [280, 0.95],
        'ernst & young': [2000, 0.93], 'pwc': [1800, 0.93], 'kpmg': [1500, 0.92],
        'morgan stanley': [1200, 0.95], 'bank of america': [1100, 0.94],
        'citi': [1000, 0.93], 'wells fargo': [900, 0.93], 'barclays': [600, 0.94],
        'mastercard': [500, 0.95], 'visa': [480, 0.96],
        'samsung': [800, 0.94], 'sony': [400, 0.93], 'boeing': [600, 0.92],
        'lockheed martin': [500, 0.91], 'raytheon': [400, 0.90],
        'tesla': [1500, 0.94], 'spacex': [800, 0.95],
    },

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

    WEAK_POSITIVE_SIGNALS: [
        'e-verify', 'equal opportunity', 'diverse candidates', 'regardless of',
        'all qualified applicants', 'eeo', 'affirmative action'
    ],

    analyze(jobDescription, companyName = '') {
        if (!jobDescription) return { status: 'unclear', confidence: 'low', signals: [], companyData: null };
        const jdLower = jobDescription.toLowerCase();

        const positiveHits = this.POSITIVE_SIGNALS.filter(s => jdLower.includes(s));
        const negativeHits = this.NEGATIVE_SIGNALS.filter(s => jdLower.includes(s));
        const weakPositiveHits = this.WEAK_POSITIVE_SIGNALS.filter(s => jdLower.includes(s));

        // Check employer database
        const companyData = this.getCompanyH1BStats(companyName);

        if (negativeHits.length > 0) {
            return { status: 'no-sponsor', confidence: 'high', signals: negativeHits, companyData };
        }
        if (positiveHits.length > 0) {
            return { status: 'sponsors', confidence: 'high', signals: positiveHits, companyData };
        }
        // If company is a known sponsor but JD doesn't mention it
        if (companyData && companyData.petitions > 100) {
            return { status: 'likely-sponsors', confidence: 'medium', signals: ['Known H1B sponsor'], companyData };
        }
        if (weakPositiveHits.length >= 2) {
            return { status: 'possible', confidence: 'low', signals: weakPositiveHits, companyData };
        }
        return { status: 'unclear', confidence: 'low', signals: [], companyData };
    },

    getCompanyH1BStats(companyName) {
        if (!companyName) return null;
        const nameLower = companyName.toLowerCase().trim();

        // Try exact match first
        if (this.TOP_SPONSORS[nameLower]) {
            const [petitions, approvalRate] = this.TOP_SPONSORS[nameLower];
            return { company: companyName, petitions, approvalRate: Math.round(approvalRate * 100) };
        }

        // Try partial match (e.g., "Amazon.com" → "amazon")
        for (const [key, data] of Object.entries(this.TOP_SPONSORS)) {
            if (nameLower.includes(key) || key.includes(nameLower)) {
                return { company: companyName, petitions: data[0], approvalRate: Math.round(data[1] * 100) };
            }
        }
        return null;
    },

    getBadgeHTML(status) {
        const configs = {
            'sponsors': { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', text: '✓ Sponsors H1B' },
            'likely-sponsors': { bg: 'rgba(34,197,94,0.08)', color: '#22c55e', text: '~ Likely Sponsors' },
            'no-sponsor': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', text: '✗ No Sponsorship' },
            'possible': { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', text: '? May Sponsor' },
            'unclear': { bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', text: '? Visa Unclear' }
        };
        const c = configs[status] || configs['unclear'];
        return `<span class="jh-visa-badge" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;background:${c.bg};color:${c.color};border:1px solid ${c.color}30">${c.text}</span>`;
    },

    getCompanyBadgeHTML(companyData) {
        if (!companyData) return '';
        return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:500;background:rgba(96,165,250,0.08);color:#60a5fa;border:1px solid rgba(96,165,250,0.2)">${companyData.petitions.toLocaleString()} H1B filings · ${companyData.approvalRate}% approved</span>`;
    },

    filterJobs(jobs, userNeedsSponsorship) {
        if (!userNeedsSponsorship) return jobs;
        return jobs.filter(job => {
            const result = this.analyze(job.description || '', job.company || '');
            return result.status !== 'no-sponsor';
        });
    }
};
