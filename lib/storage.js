/* ========================================
   JobHunter AI — Storage Module
   IndexedDB + Chrome Storage wrapper
   ======================================== */

const StorageManager = {
  DB_NAME: 'JobHunterAI',
  DB_VERSION: 1,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Jobs store
        if (!db.objectStoreNames.contains('jobs')) {
          const jobStore = db.createObjectStore('jobs', { keyPath: 'id' });
          jobStore.createIndex('source', 'source', { unique: false });
          jobStore.createIndex('matchScore', 'matchScore', { unique: false });
          jobStore.createIndex('dateFound', 'dateFound', { unique: false });
          jobStore.createIndex('status', 'status', { unique: false });
        }

        // Applications tracker
        if (!db.objectStoreNames.contains('applications')) {
          const appStore = db.createObjectStore('applications', { keyPath: 'id' });
          appStore.createIndex('status', 'status', { unique: false });
          appStore.createIndex('dateApplied', 'dateApplied', { unique: false });
          appStore.createIndex('company', 'company', { unique: false });
        }

        // Resumes
        if (!db.objectStoreNames.contains('resumes')) {
          db.createObjectStore('resumes', { keyPath: 'id' });
        }

        // Search history
        if (!db.objectStoreNames.contains('searchHistory')) {
          const searchStore = db.createObjectStore('searchHistory', { keyPath: 'id', autoIncrement: true });
          searchStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Generic CRUD
  async put(storeName, data) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, key) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, key) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async ensureDB() {
    if (!this.db) await this.init();
  },

  // Job-specific helpers
  async saveJob(job) {
    if (!job.id) {
      job.id = this.generateId(job);
    }
    job.dateFound = job.dateFound || new Date().toISOString();
    return this.put('jobs', job);
  },

  async getJobs(filter = {}) {
    const allJobs = await this.getAll('jobs');
    let filtered = allJobs;

    if (filter.source && filter.source !== 'all') {
      filtered = filtered.filter(j => j.source === filter.source);
    }
    if (filter.minMatch) {
      filtered = filtered.filter(j => (j.matchScore || 0) >= filter.minMatch);
    }
    if (filter.status) {
      filtered = filtered.filter(j => j.status === filter.status);
    }

    // Sort by match score descending, then date
    filtered.sort((a, b) => {
      const scoreA = a.matchScore || 0;
      const scoreB = b.matchScore || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.dateFound) - new Date(a.dateFound);
    });

    return filtered;
  },

  // Application tracker helpers
  async saveApplication(app) {
    if (!app.id) {
      app.id = this.generateId(app);
    }
    app.lastUpdated = new Date().toISOString();
    return this.put('applications', app);
  },

  async getApplications(statusFilter = 'all') {
    const all = await this.getAll('applications');
    let filtered = statusFilter === 'all' ? all : all.filter(a => a.status === statusFilter);
    filtered.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    return filtered;
  },

  // Resume helpers
  async saveResume(resume) {
    resume.id = resume.id || 'primary';
    resume.updatedAt = new Date().toISOString();
    return this.put('resumes', resume);
  },

  async getResume(id = 'primary') {
    return this.get('resumes', id);
  },

  // Chrome Storage for settings (synced across devices)
  async getSettings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get({
          anthropicKey: '',
          serpApiKey: '',
          profileName: '',
          profileRole: '',
          profileYOE: '',
          profileSkills: '',
          profileLocations: '',
          profileSalary: '',
          profileEmail: '',
          profilePhone: '',
          profileLinkedin: '',
          profileGithub: '',
          needsSponsorship: false,
          notifInterval: 60,
          notifThreshold: 75,
          notifEnabled: true,
          selectedTemplate: 'jakes'
        }, resolve);
      } else {
        // Fallback for testing outside extension context
        const settings = JSON.parse(localStorage.getItem('jh_settings') || '{}');
        resolve({
          anthropicKey: '',
          serpApiKey: '',
          profileName: '',
          profileRole: '',
          profileYOE: '',
          profileSkills: '',
          profileLocations: '',
          profileSalary: '',
          profileEmail: '',
          profilePhone: '',
          profileLinkedin: '',
          profileGithub: '',
          needsSponsorship: false,
          notifInterval: 60,
          notifThreshold: 75,
          notifEnabled: true,
          selectedTemplate: 'jakes',
          ...settings
        });
      }
    });
  },

  async saveSettings(settings) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.set(settings, resolve);
      } else {
        const existing = JSON.parse(localStorage.getItem('jh_settings') || '{}');
        localStorage.setItem('jh_settings', JSON.stringify({ ...existing, ...settings }));
        resolve();
      }
    });
  },

  generateId(item) {
    const str = `${item.title || ''}|${item.company || ''}|${item.source || ''}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'job_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  },

  // Alias for Stats tab
  async getTrackerItems() {
    return this.getAll('applications');
  },

  // Data export — user downloads all their data as JSON
  async exportAllData() {
    const jobs = await this.getAll('jobs');
    const applications = await this.getAll('applications');
    const resumes = await this.getAll('resumes');
    const settings = await this.getSettings();

    const data = {
      version: '2.1',
      exportedAt: new Date().toISOString(),
      jobs,
      applications,
      resumes,
      settings
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobhunter-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return data;
  },

  // Data import — restore from exported JSON
  async importData(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.version) throw new Error('Invalid backup file');

    if (data.jobs) {
      for (const job of data.jobs) await this.put('jobs', job);
    }
    if (data.applications) {
      for (const app of data.applications) await this.put('applications', app);
    }
    if (data.resumes) {
      for (const resume of data.resumes) await this.put('resumes', resume);
    }
    if (data.settings) {
      await this.saveSettings(data.settings);
    }
    return { jobs: data.jobs?.length || 0, applications: data.applications?.length || 0 };
  },

  // Delete all data
  async deleteAllData() {
    await this.clear('jobs');
    await this.clear('applications');
    await this.clear('resumes');
    await this.clear('searchHistory');
    // Clear settings
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise(resolve => chrome.storage.sync.clear(resolve));
    } else {
      localStorage.removeItem('jh_settings');
    }
  }
};
