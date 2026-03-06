/* ========================================
   JobHunter AI — Quota System
   Freemium usage limits and Pro upgrade
   ======================================== */

const QuotaManager = {
    FREE_LIMITS: {
        aiAnalyses: 10,
        resumeTailorings: 3,
        coverLetters: 2,
        interviewPreps: 1,
        followUpEmails: 5
    },

    async checkQuota(feature) {
        const isPro = await this.isProUser();
        if (isPro) return { allowed: true, remaining: Infinity };

        const usage = await this.getMonthlyUsage();
        const limit = this.FREE_LIMITS[feature];
        if (limit === undefined) return { allowed: true };

        const current = usage[feature] || 0;

        if (current >= limit) {
            return {
                allowed: false,
                remaining: 0,
                reason: `You've used all ${limit} free ${feature.replace(/([A-Z])/g, ' $1').toLowerCase()} this month.`,
                cta: 'Upgrade to Pro for unlimited access'
            };
        }

        return { allowed: true, remaining: limit - current };
    },

    async consumeQuota(feature) {
        const check = await this.checkQuota(feature);
        if (!check.allowed) return check;

        const usage = await this.getMonthlyUsage();
        usage[feature] = (usage[feature] || 0) + 1;
        await this.saveMonthlyUsage(usage);

        return { allowed: true, remaining: (this.FREE_LIMITS[feature] || 0) - usage[feature] };
    },

    async getMonthlyUsage() {
        return new Promise(resolve => {
            const monthKey = this.getMonthKey();
            chrome.storage.local.get({ [`usage_${monthKey}`]: {} }, result => {
                resolve(result[`usage_${monthKey}`]);
            });
        });
    },

    async saveMonthlyUsage(usage) {
        const monthKey = this.getMonthKey();
        return new Promise(resolve => {
            chrome.storage.local.set({ [`usage_${monthKey}`]: usage }, resolve);
        });
    },

    getMonthKey() {
        const d = new Date();
        return `${d.getFullYear()}_${d.getMonth() + 1}`;
    },

    async isProUser() {
        return new Promise(resolve => {
            chrome.storage.sync.get({ proStatus: null }, result => {
                if (!result.proStatus) { resolve(false); return; }
                if (!result.proStatus.isPro) { resolve(false); return; }
                if (result.proStatus.validUntil && new Date(result.proStatus.validUntil) < new Date()) {
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    },

    async getUsageSummary() {
        const usage = await this.getMonthlyUsage();
        const isPro = await this.isProUser();
        const summary = {};

        for (const [feature, limit] of Object.entries(this.FREE_LIMITS)) {
            const used = usage[feature] || 0;
            summary[feature] = {
                used,
                limit: isPro ? '∞' : limit,
                remaining: isPro ? '∞' : Math.max(0, limit - used),
                percentage: isPro ? 0 : Math.round((used / limit) * 100)
            };
        }
        return summary;
    }
};
