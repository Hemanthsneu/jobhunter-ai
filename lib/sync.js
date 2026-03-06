/* ========================================
   JobHunter AI — Cloud Sync
   Bidirectional sync between IndexedDB and Supabase
   Local-first: works offline, syncs when connected
   ======================================== */

const CloudSync = {
    isSyncing: false,

    // ====== Write to Cloud ======
    async syncToCloud(table, data) {
        if (!SupabaseClient.isConfigured()) return;

        const user = await AuthManager.getUser();
        if (!user) return; // Not signed in — local-only mode

        try {
            // Add user_id to data
            const payload = { ...data, user_id: user.id };
            // Remove local-only fields
            delete payload.localOnly;

            await SupabaseClient.client.request(`/rest/v1/${table}`, {
                method: 'POST',
                headers: {
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn(`Sync to cloud failed for ${table}:`, e.message);
            // Don't throw — local-first, cloud-enhanced
        }
    },

    // ====== Upsert (insert or update) ======
    async upsertToCloud(table, data, conflictColumn = 'id') {
        if (!SupabaseClient.isConfigured()) return;

        const user = await AuthManager.getUser();
        if (!user) return;

        try {
            const payload = { ...data, user_id: user.id };
            delete payload.localOnly;

            await SupabaseClient.client.request(`/rest/v1/${table}`, {
                method: 'POST',
                headers: {
                    'Prefer': `resolution=merge-duplicates,return=minimal`
                },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.warn(`Upsert to cloud failed for ${table}:`, e.message);
        }
    },

    // ====== Pull from Cloud ======
    async pullFromCloud() {
        if (!SupabaseClient.isConfigured()) return { jobs: [], applications: [], resumes: [] };

        const user = await AuthManager.getUser();
        if (!user) return { jobs: [], applications: [], resumes: [] };

        if (this.isSyncing) return null;
        this.isSyncing = true;

        try {
            const [jobsResp, appsResp, resumesResp] = await Promise.all([
                SupabaseClient.client.request(
                    `/rest/v1/jobs?user_id=eq.${user.id}&order=saved_at.desc&limit=200`,
                    { method: 'GET' }
                ),
                SupabaseClient.client.request(
                    `/rest/v1/applications?user_id=eq.${user.id}&order=updated_at.desc`,
                    { method: 'GET' }
                ),
                SupabaseClient.client.request(
                    `/rest/v1/resumes?user_id=eq.${user.id}`,
                    { method: 'GET' }
                )
            ]);

            // Write to IndexedDB as local cache
            const jobs = Array.isArray(jobsResp) ? jobsResp : [];
            const applications = Array.isArray(appsResp) ? appsResp : [];
            const resumes = Array.isArray(resumesResp) ? resumesResp : [];

            // Merge with local data (cloud wins for conflicts)
            for (const job of jobs) {
                try { await StorageManager.saveJob(job); } catch (e) { /* skip duplicates */ }
            }
            for (const app of applications) {
                try { await StorageManager.saveApplication(app); } catch (e) { /* skip */ }
            }

            return { jobs, applications, resumes };
        } catch (e) {
            console.warn('Pull from cloud failed:', e.message);
            return { jobs: [], applications: [], resumes: [] };
        } finally {
            this.isSyncing = false;
        }
    },

    // ====== Sync a single job save ======
    async syncJob(jobData) {
        await this.upsertToCloud('jobs', {
            id: jobData.id,
            title: jobData.title,
            company: jobData.company,
            location: jobData.location,
            description: jobData.description,
            url: jobData.applyLink || jobData.url,
            source: jobData.source,
            match_score: jobData.matchScore,
            visa_status: jobData.visaStatus,
            salary_range: jobData.salary,
            remote_policy: jobData.remote,
            freshness_score: jobData.freshnessScore,
            is_ghost_job: jobData.isGhostJob,
            posted_date: jobData.postedDate,
            saved_at: jobData.savedAt || new Date().toISOString()
        });
    },

    // ====== Sync an application status change ======
    async syncApplication(appData) {
        await this.upsertToCloud('applications', {
            id: appData.id,
            job_id: appData.jobId,
            status: appData.status,
            applied_at: appData.appliedAt,
            interview_date: appData.interviewDate,
            offer_amount: appData.offerAmount,
            notes: appData.notes,
            tailored_resume: appData.tailoredResume,
            cover_letter: appData.coverLetter,
            updated_at: new Date().toISOString()
        });
    },

    // ====== Sync profile to cloud ======
    async syncProfile(profileData) {
        if (!SupabaseClient.isConfigured()) return;
        const user = await AuthManager.getUser();
        if (!user) return;

        try {
            await SupabaseClient.client.request(`/rest/v1/profiles?id=eq.${user.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    first_name: profileData.firstName,
                    last_name: profileData.lastName,
                    email: profileData.email,
                    phone: profileData.phone,
                    linkedin_url: profileData.linkedin,
                    github_url: profileData.github,
                    years_of_exp: parseInt(profileData.yoe) || null,
                    work_auth: profileData.workAuth,
                    needs_sponsorship: profileData.needsSponsorship,
                    salary_expectation: profileData.salary,
                    target_roles: profileData.targetRoles || []
                })
            });
        } catch (e) {
            console.warn('Profile sync failed:', e.message);
        }
    },

    // ====== Cache AI output ======
    async cacheAIOutput(jobId, outputType, content, model) {
        await this.syncToCloud('ai_cache', {
            job_id: jobId,
            output_type: outputType,
            content: typeof content === 'string' ? content : JSON.stringify(content),
            model_used: model,
            created_at: new Date().toISOString()
        });
    },

    // ====== Check cached AI output ======
    async getCachedAIOutput(jobId, outputType) {
        if (!SupabaseClient.isConfigured()) return null;
        const user = await AuthManager.getUser();
        if (!user) return null;

        try {
            const results = await SupabaseClient.client.request(
                `/rest/v1/ai_cache?job_id=eq.${jobId}&output_type=eq.${outputType}&user_id=eq.${user.id}&order=created_at.desc&limit=1`,
                { method: 'GET' }
            );
            return results?.[0]?.content || null;
        } catch (e) {
            return null;
        }
    },

    // ====== Full initial sync (on extension open) ======
    async initialSync() {
        if (!SupabaseClient.isConfigured()) return;
        const user = await AuthManager.getUser();
        if (!user) return;

        console.log('CloudSync: Running initial sync...');
        const cloudData = await this.pullFromCloud();
        console.log(`CloudSync: Synced ${cloudData.jobs.length} jobs, ${cloudData.applications.length} applications`);
    }
};
