# JobHunter AI

> **AI-powered Chrome extension** that automates your job search with resume tailoring, ATS scoring, and smart notifications — across LinkedIn, Indeed, Greenhouse, Lever, and Ashby.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

| Feature | Description |
|---------|-------------|
| **AI Resume Tailoring** | Uses Gemini AI to rewrite your resume for each job description, targeting 95%+ ATS scores |
| **ATS Scoring** | Real-time ATS compatibility analysis with keyword matching and improvement suggestions |
| **Smart Hunt** | Automated multi-platform search across Google Jobs, Greenhouse, Ashby, and Lever |
| **Application Tracker** | Built-in Kanban-style pipeline: Saved → Applied → Interview → Offer |
| **LinkedIn Integration** | Injected "Analyze" buttons directly on LinkedIn job listings |
| **Cover Letter Generator** | AI-generated cover letters tailored to each role |
| **Smart Notifications** | Alerts when high-match jobs are found during scheduled background searches |

---

## Getting Started

### 1. Install the Extension

```bash
git clone https://github.com/Hemanthsneu/jobhunter-ai.git
```

1. Open Chrome → navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select the cloned `jobhunter-ai` folder

### 2. Get Your API Keys

JobHunter AI requires **your own API keys** (Bring Your Own Key model — your keys never leave your browser).

#### Gemini API Key (Required for AI features)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **"Create API Key"**
3. Copy the key (starts with `AIza...`)
4. Paste it in the extension **Settings → API Keys → Gemini API Key**

> **Free tier:** Gemini API offers generous free usage limits — more than enough for job searching.

#### SerpApi Key (Optional — for Google Jobs search)

1. Go to [serpapi.com](https://serpapi.com) and create a free account
2. Copy your API key from the dashboard
3. Paste it in the extension **Settings → API Keys → SerpApi Key**

> **Free tier:** 100 searches/month. Without this key, the extension will open Google Jobs in a new tab instead of fetching results directly.

### 3. Set Up Your Profile

1. Go to **Settings → Job Profile**
2. Enter your target role, years of experience, key skills, and preferred locations
3. Click **Save All Settings**

### 4. Upload Your Resume

1. Go to the **Resume** tab
2. Drag & drop a `.txt` or `.pdf` resume file
3. The extension will extract and store the text locally for AI analysis

---

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                   Your Browser                       │
│                                                      │
│  ┌─────────────┐   ┌────────────┐   ┌─────────────┐│
│  │ Popup UI    │   │ Side Panel │   │Content Script││
│  │ (Dashboard) │   │ (Analysis) │   │(Job Boards)  ││
│  └──────┬──────┘   └─────┬──────┘   └──────┬──────┘│
│         │                │                  │        │
│         └────────┬───────┴──────────────────┘        │
│                  │                                    │
│         ┌───────┴────────┐                           │
│         │ Background.js  │   (Service Worker)        │
│         │ • Scheduled    │                           │
│         │   searches     │                           │
│         │ • Notifications│                           │
│         └───────┬────────┘                           │
│                 │                                     │
└─────────────────┼───────────────────────────────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
   Gemini       SerpApi     IndexedDB
   (AI)       (Search)    (Local Storage)
```

**All data stays local.** API keys are stored in Chrome's `chrome.storage.sync`. Job data and resumes are stored in IndexedDB within your browser. Nothing is sent to any server other than the API providers you configure.

---

## Supported Platforms

- **LinkedIn** — Injected Analyze/Save buttons on job listings
- **Indeed** — Content script integration
- **Greenhouse** (`boards.greenhouse.io`) — ATS board crawler
- **Ashby** (`jobs.ashby.io`) — ATS board crawler
- **Lever** (`jobs.lever.co`) — ATS board crawler
- **Google Jobs** — Via SerpApi integration

---

## Security & Privacy

- **No hardcoded API keys** — all keys are provided by the user
- **Keys are stored locally** in `chrome.storage.sync` (encrypted by Chrome)
- **No external backend** — the extension communicates only with Gemini API and SerpApi
- **Resume data stays in your browser** — stored in IndexedDB, never uploaded

---

## Permissions Explained

| Permission | Why It's Needed |
|------------|-----------------|
| `storage` | Saving your settings, API keys, resume, and job data locally |
| `sidePanel` | Displaying the analysis panel alongside job listings |
| `activeTab` + `tabs` | Extracting job details from the current page |
| `notifications` + `alarms` | Sending alerts when high-match jobs are found during background searches |
| `contextMenus` | "Analyze with JobHunter AI" right-click option on selected text |

---

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test by loading the unpacked extension in Chrome
5. Submit a pull request

### Development Tips

- The extension uses vanilla JS (no build step required)
- Load the extension via `chrome://extensions` → "Load unpacked"
- Use Chrome DevTools → "Inspect views: service worker" to debug `background.js`
- Content scripts can be debugged via the regular page DevTools console

---

## License

This project is open-source under the [MIT License](LICENSE).
