/* ========================================
   JobHunter AI — Supabase Client
   Cloud sync, auth, and storage
   ======================================== */

const SupabaseClient = {
    client: null,
    SUPABASE_URL: '', // Set in settings
    SUPABASE_ANON_KEY: '', // Set in settings

    async init() {
        const settings = await this.getSupabaseSettings();
        this.SUPABASE_URL = settings.supabaseUrl || '';
        this.SUPABASE_ANON_KEY = settings.supabaseAnonKey || '';

        if (!this.SUPABASE_URL || !this.SUPABASE_ANON_KEY) {
            console.log('Supabase: Not configured. Running in local-only mode.');
            return false;
        }

        this.client = this.createClient();
        return true;
    },

    createClient() {
        // Lightweight Supabase client without the SDK dependency
        // Uses raw REST API calls to avoid bundling issues in Chrome extensions
        const url = this.SUPABASE_URL;
        const key = this.SUPABASE_ANON_KEY;

        return {
            url,
            key,
            accessToken: null,

            headers() {
                const h = {
                    'Content-Type': 'application/json',
                    'apikey': key,
                    'Authorization': `Bearer ${this.accessToken || key}`
                };
                return h;
            },

            async request(endpoint, options = {}) {
                const resp = await fetch(`${url}${endpoint}`, {
                    ...options,
                    headers: { ...this.headers(), ...(options.headers || {}) }
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.message || err.msg || `Supabase error: ${resp.status}`);
                }
                return resp.json();
            }
        };
    },

    getSupabaseSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                supabaseUrl: '',
                supabaseAnonKey: ''
            }, resolve);
        });
    },

    isConfigured() {
        return !!(this.SUPABASE_URL && this.SUPABASE_ANON_KEY && this.client);
    }
};
