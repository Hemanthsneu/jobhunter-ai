/* ========================================
   JobHunter AI — Authentication
   Supabase Auth for cloud sync
   ======================================== */

const AuthManager = {
    currentUser: null,

    async signUp(email, password) {
        if (!SupabaseClient.isConfigured()) throw new Error('Supabase not configured');

        const data = await SupabaseClient.client.request('/auth/v1/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (data.access_token) {
            await this.saveSession(data);
            this.currentUser = data.user;
        }
        return data;
    },

    async signIn(email, password) {
        if (!SupabaseClient.isConfigured()) throw new Error('Supabase not configured');

        const data = await SupabaseClient.client.request('/auth/v1/token?grant_type=password', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (data.access_token) {
            await this.saveSession(data);
            this.currentUser = data.user;
        }
        return data;
    },

    async signOut() {
        if (SupabaseClient.isConfigured() && SupabaseClient.client.accessToken) {
            try {
                await SupabaseClient.client.request('/auth/v1/logout', { method: 'POST' });
            } catch (e) { /* suppress */ }
        }
        this.currentUser = null;
        SupabaseClient.client && (SupabaseClient.client.accessToken = null);
        await this.clearSession();
    },

    async getUser() {
        if (this.currentUser) return this.currentUser;

        const session = await this.getSession();
        if (!session?.access_token) return null;

        if (!SupabaseClient.isConfigured()) return null;
        SupabaseClient.client.accessToken = session.access_token;

        // Check if token is expired
        if (session.expires_at && Date.now() > session.expires_at * 1000) {
            // Try refresh
            try {
                const refreshed = await this.refreshToken(session.refresh_token);
                if (refreshed) return this.currentUser;
            } catch (e) {
                await this.clearSession();
                return null;
            }
        }

        try {
            const data = await SupabaseClient.client.request('/auth/v1/user', { method: 'GET' });
            this.currentUser = data;
            return data;
        } catch (e) {
            console.warn('Auth: could not verify session', e.message);
            return null;
        }
    },

    async refreshToken(refreshToken) {
        if (!refreshToken || !SupabaseClient.isConfigured()) return false;

        try {
            const data = await SupabaseClient.client.request('/auth/v1/token?grant_type=refresh_token', {
                method: 'POST',
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (data.access_token) {
                await this.saveSession(data);
                this.currentUser = data.user;
                return true;
            }
        } catch (e) {
            console.warn('Token refresh failed:', e.message);
        }
        return false;
    },

    async saveSession(data) {
        const session = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
            user: data.user
        };
        if (SupabaseClient.client) {
            SupabaseClient.client.accessToken = data.access_token;
        }
        return new Promise(resolve => {
            chrome.storage.local.set({ supabase_session: session }, resolve);
        });
    },

    getSession() {
        return new Promise(resolve => {
            chrome.storage.local.get({ supabase_session: null }, result => {
                resolve(result.supabase_session);
            });
        });
    },

    clearSession() {
        return new Promise(resolve => {
            chrome.storage.local.remove('supabase_session', resolve);
        });
    },

    isSignedIn() {
        return !!this.currentUser;
    }
};
