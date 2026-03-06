/* ========================================
   JobHunter AI — Analytics Dashboard
   Application stats and conversion metrics
   ======================================== */

const Analytics = {
    BENCHMARKS: {
        responseRate: 8.5,   // industry average
        offerRate: 2.1
    },

    async computeStats(applications) {
        const total = applications.length;
        const applied = applications.filter(a => a.status !== 'saved').length;
        const interviews = applications.filter(a =>
            ['interview', 'phone_screen', 'offer'].includes(a.status)
        ).length;
        const offers = applications.filter(a => a.status === 'offer').length;
        const rejected = applications.filter(a => a.status === 'rejected').length;
        const ghosted = applications.filter(a => a.status === 'ghosted').length;

        const responseRate = applied > 0 ? ((interviews / applied) * 100) : 0;
        const offerRate = applied > 0 ? ((offers / applied) * 100) : 0;

        return {
            total, applied, interviews, offers, rejected, ghosted,
            responseRate: responseRate.toFixed(1),
            offerRate: offerRate.toFixed(1),
            vsAvgResponse: (responseRate - this.BENCHMARKS.responseRate).toFixed(1),
            vsAvgOffer: (offerRate - this.BENCHMARKS.offerRate).toFixed(1),
            weeklyData: this.getWeeklyTrend(applications),
            topCompanies: this.getTopCompanies(applications),
            sourceMix: this.getSourceMix(applications)
        };
    },

    getWeeklyTrend(apps) {
        const weeks = [];
        const now = new Date();
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i * 7 + now.getDay()));
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);

            const count = apps.filter(a => {
                const d = new Date(a.appliedAt || a.savedAt || a.lastUpdated);
                return d >= weekStart && d < weekEnd;
            }).length;

            weeks.push({
                label: `W${4 - i}`,
                count,
                start: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
        }
        return weeks;
    },

    getTopCompanies(apps) {
        const counts = {};
        apps.forEach(a => {
            const company = a.company || 'Unknown';
            counts[company] = (counts[company] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([company, count]) => ({ company, count }));
    },

    getSourceMix(apps) {
        const counts = {};
        apps.forEach(a => {
            const source = a.source || 'unknown';
            counts[source] = (counts[source] || 0) + 1;
        });
        return counts;
    }
};
