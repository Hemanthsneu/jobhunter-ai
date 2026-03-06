/* ========================================
   JobHunter AI — Job Search Module
   SerpApi + LinkedIn URL tricks + ATS boards
   ======================================== */

const JobSearch = {

    // ====== SerpApi Google Jobs ======
    async searchGoogleJobs(apiKey, query, location = '', options = {}) {
        if (!apiKey) throw new Error('SerpApi key required');

        const params = new URLSearchParams({
            engine: 'google_jobs',
            q: query,
            api_key: apiKey,
            hl: 'en'
        });

        if (location) params.set('location', location);

        // Time filter
        if (options.hoursAgo) {
            // SerpApi chips parameter for time filter
            // date_posted:today, date_posted:3days, date_posted:week, date_posted:month
            if (options.hoursAgo <= 24) {
                params.set('chips', 'date_posted:today');
            } else if (options.hoursAgo <= 72) {
                params.set('chips', 'date_posted:3days');
            } else if (options.hoursAgo <= 168) {
                params.set('chips', 'date_posted:week');
            }
        }

        try {
            const response = await fetch(`https://serpapi.com/search.json?${params}`);
            if (!response.ok) throw new Error(`SerpApi error: ${response.statusText}`);

            const data = await response.json();
            return (data.jobs_results || []).map(job => this.normalizeGoogleJob(job));
        } catch (err) {
            console.error('SerpApi search failed:', err);
            return [];
        }
    },

    normalizeGoogleJob(job) {
        return {
            id: 'gj_' + this.hashString(job.title + job.company_name),
            title: job.title || '',
            company: job.company_name || '',
            location: job.location || '',
            description: job.description || '',
            highlights: job.job_highlights || [],
            postedAt: job.detected_extensions?.posted_at || '',
            schedule: job.detected_extensions?.schedule_type || '',
            salary: job.detected_extensions?.salary || '',
            source: 'google',
            applyLink: job.apply_options?.[0]?.link || job.share_link || '',
            via: job.via || '',
            dateFound: new Date().toISOString(),
            status: 'new'
        };
    },

    // ====== LinkedIn URL Magic ======
    // f_TPR=r3600 = past hour, r86400 = past 24h
    generateLinkedInURL(query, location = '', options = {}) {
        const base = 'https://www.linkedin.com/jobs/search/';
        const params = new URLSearchParams({
            keywords: query,
            location: location || '',
            sortBy: 'DD', // Date Descending (most recent first)
        });

        // Time filter using f_TPR (time posted range in seconds)
        const hoursAgo = options.hoursAgo || 24;
        const seconds = hoursAgo * 3600;
        params.set('f_TPR', `r${seconds}`);

        // Experience level
        if (options.experienceLevel) {
            // 1=Internship, 2=Entry, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive
            const levels = {
                'entry': '2',
                'associate': '3',
                'mid': '4',
                'mid-senior': '4',
                'senior': '4',
                'director': '5',
                'executive': '6'
            };
            params.set('f_E', levels[options.experienceLevel.toLowerCase()] || '4');
        }

        // Remote filter
        if (options.remote) {
            // f_WT: 1=On-site, 2=Remote, 3=Hybrid
            params.set('f_WT', '2');
        }

        return `${base}?${params.toString()}`;
    },

    // ====== ATS Board Google Dork Searches ======
    generateATSBoardSearches(query, options = {}) {
        const hoursAgo = options.hoursAgo || 24;
        const location = options.location || '';

        // Calculate date for tbs parameter (Google's time-based search)
        // tbs=qdr:h (past hour), qdr:d (past day), qdr:w (past week)
        let tbsParam = 'qdr:d'; // default past day
        if (hoursAgo <= 1) tbsParam = 'qdr:h';
        else if (hoursAgo <= 24) tbsParam = 'qdr:d';
        else if (hoursAgo <= 72) tbsParam = 'qdr:d3'; // past 3 days (approximation)
        else if (hoursAgo <= 168) tbsParam = 'qdr:w';

        const locationQuery = location ? ` "${location}"` : '';

        const searches = [
            {
                name: '🌿 Greenhouse Jobs',
                icon: '🌿',
                source: 'greenhouse',
                url: `https://www.google.com/search?q=site:boards.greenhouse.io "${query}"${locationQuery}&tbs=${tbsParam}`,
                directUrl: `https://www.google.com/search?q=site:boards.greenhouse.io+%22${encodeURIComponent(query)}%22${locationQuery ? '+%22' + encodeURIComponent(location) + '%22' : ''}&tbs=${tbsParam}`,
                description: 'Latest Greenhouse board postings'
            },
            {
                name: '🔮 Ashby Jobs',
                icon: '🔮',
                source: 'ashby',
                url: `https://www.google.com/search?q=site:jobs.ashby.io "${query}"${locationQuery}&tbs=${tbsParam}`,
                directUrl: `https://www.google.com/search?q=site:jobs.ashby.io+%22${encodeURIComponent(query)}%22${locationQuery ? '+%22' + encodeURIComponent(location) + '%22' : ''}&tbs=${tbsParam}`,
                description: 'Latest Ashby board postings'
            },
            {
                name: '🎯 Lever Jobs',
                icon: '🎯',
                source: 'lever',
                url: `https://www.google.com/search?q=site:jobs.lever.co "${query}"${locationQuery}&tbs=${tbsParam}`,
                directUrl: `https://www.google.com/search?q=site:jobs.lever.co+%22${encodeURIComponent(query)}%22${locationQuery ? '+%22' + encodeURIComponent(location) + '%22' : ''}&tbs=${tbsParam}`,
                description: 'Latest Lever board postings'
            },
            {
                name: '💼 Workday Jobs',
                icon: '💼',
                source: 'workday',
                url: `https://www.google.com/search?q=site:myworkdayjobs.com "${query}"${locationQuery}&tbs=${tbsParam}`,
                directUrl: `https://www.google.com/search?q=site:myworkdayjobs.com+%22${encodeURIComponent(query)}%22${locationQuery ? '+%22' + encodeURIComponent(location) + '%22' : ''}&tbs=${tbsParam}`,
                description: 'Latest Workday postings'
            },
            {
                name: '🏢 LinkedIn Jobs',
                icon: '🏢',
                source: 'linkedin',
                url: this.generateLinkedInURL(query, location, { hoursAgo: hoursAgo }),
                directUrl: this.generateLinkedInURL(query, location, { hoursAgo: hoursAgo }),
                description: `LinkedIn jobs posted in last ${hoursAgo}h`
            },
            {
                name: '📑 Indeed Jobs',
                icon: '📑',
                source: 'indeed',
                url: `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&fromage=${Math.ceil(hoursAgo / 24) || 1}&sort=date`,
                directUrl: `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&fromage=${Math.ceil(hoursAgo / 24) || 1}&sort=date`,
                description: `Indeed jobs posted recently`
            },
            {
                name: '⭐ SmartRecruiters',
                icon: '⭐',
                source: 'smartrecruiters',
                url: `https://www.google.com/search?q=site:jobs.smartrecruiters.com "${query}"${locationQuery}&tbs=${tbsParam}`,
                directUrl: `https://www.google.com/search?q=site:jobs.smartrecruiters.com+%22${encodeURIComponent(query)}%22${locationQuery ? '+%22' + encodeURIComponent(location) + '%22' : ''}&tbs=${tbsParam}`,
                description: 'Latest SmartRecruiters postings'
            },
            {
                name: '🔵 BambooHR Jobs',
                icon: '🔵',
                source: 'bamboohr',
                url: `https://www.google.com/search?q=site:*.bamboohr.com/careers "${query}"${locationQuery}&tbs=${tbsParam}`,
                directUrl: `https://www.google.com/search?q=site:*.bamboohr.com/careers+%22${encodeURIComponent(query)}%22${locationQuery ? '+%22' + encodeURIComponent(location) + '%22' : ''}&tbs=${tbsParam}`,
                description: 'Latest BambooHR postings'
            }
        ];

        return searches;
    },

    // ====== Smart Hunt — Multi-source combined ======
    async smartHunt(settings, onProgress) {
        const results = [];
        const query = settings.profileRole || 'Software Engineer';
        const location = settings.profileLocations || '';
        const hoursAgo = 24;

        // Step 1: Google Jobs via SerpApi (if key available)
        if (settings.serpApiKey) {
            onProgress?.({ step: 1, total: 3, text: 'Searching Google Jobs...' });
            try {
                const googleJobs = await this.searchGoogleJobs(
                    settings.serpApiKey, query, location, { hoursAgo }
                );
                results.push(...googleJobs);
            } catch (e) {
                console.warn('Google Jobs search failed:', e);
            }
        }

        // Step 2: Generate quick-access URLs for all ATS boards
        onProgress?.({ step: 2, total: 3, text: 'Generating ATS board searches...' });
        const atsSearches = this.generateATSBoardSearches(query, { hoursAgo, location });

        // Step 3: Generate LinkedIn deep link
        onProgress?.({ step: 3, total: 3, text: 'Preparing LinkedIn search...' });
        const linkedInUrl = this.generateLinkedInURL(query, location, {
            hoursAgo: 1, // Last hour for freshest results
            experienceLevel: 'senior'
        });

        return {
            jobs: results,
            atsSearches,
            linkedInUrl,
            searchedAt: new Date().toISOString()
        };
    },

    // ====== Utility ======
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    },

    // Deduplicate jobs by title+company similarity
    deduplicateJobs(jobs) {
        const seen = new Map();
        return jobs.filter(job => {
            const key = `${job.title?.toLowerCase().trim()}|${job.company?.toLowerCase().trim()}`;
            if (seen.has(key)) return false;
            seen.set(key, true);
            return true;
        });
    },

    // Calculate time ago string
    timeAgo(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
};
