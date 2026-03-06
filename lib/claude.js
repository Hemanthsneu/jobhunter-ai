/* ========================================
   JobHunter AI — Claude AI Engine
   Resume tailoring, ATS scoring, job matching,
   interview prep, follow-up emails
   ======================================== */

const ClaudeAI = {
    API_BASE: 'https://api.anthropic.com/v1/messages',
    MODEL_SONNET: 'claude-sonnet-4-20250514',   // writing tasks
    MODEL_HAIKU: 'claude-haiku-4-5-20251001',     // fast/cheap tasks

    MAX_RETRIES: 3,
    RETRY_BASE_DELAY: 2000,

    async call(apiKey, prompt, systemPrompt = '', { model = 'haiku', maxTokens = 4096 } = {}) {
        const modelName = model === 'sonnet' ? this.MODEL_SONNET : this.MODEL_HAIKU;

        const body = {
            model: modelName,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
        };
        if (systemPrompt) {
            body.system = systemPrompt;
        }

        let lastError = null;
        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = this.RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                console.log(`Claude API: retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES + 1})`);
                await new Promise(r => setTimeout(r, delay));
            }

            try {
                const response = await fetch(this.API_BASE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify(body)
                });

                if (response.status === 429) {
                    const err = await response.json().catch(() => ({}));
                    lastError = new Error(`Rate limited. ${err.error?.message || 'Please wait and try again.'}`);
                    continue;
                }

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(`Claude API error: ${err.error?.message || response.statusText}`);
                }

                const data = await response.json();
                return data.content?.[0]?.text || '';
            } catch (e) {
                if (e.message.includes('Rate limited') || e.message.includes('rate')) {
                    lastError = e;
                    continue;
                }
                throw e;
            }
        }

        throw lastError || new Error('Claude API: max retries exceeded');
    },

    // ------ Core AI Functions ------

    async analyzeJobMatch(apiKey, resume, jobDescription, userProfile = {}) {
        const systemPrompt = `Job match analyzer. Respond ONLY with valid JSON, no markdown.
JSON: {"matchScore":0-100,"matchLevel":"excellent"|"good"|"fair"|"poor","keyMatches":[],"missingKeywords":[],"strengthPoints":[max 3],"weakPoints":[max 3],"suggestions":[],"estimatedAtsScore":0-100,"salaryRange":null,"remotePolicy":"remote"|"hybrid"|"onsite"|"unknown","summary":"2 sentences"}`;

        // Truncate inputs to save tokens (keep full resume for accuracy)
        const trimmedResume = resume.substring(0, 5000);
        const trimmedJD = jobDescription.substring(0, 3000);

        const prompt = `Match this candidate to the job.

Profile: ${userProfile.role || 'SWE'} | ${userProfile.yoe || '?'} YOE | Skills: ${userProfile.skills || 'N/A'}

RESUME:\n${trimmedResume}\n\nJOB:\n${trimmedJD}\n\nRespond JSON only.`;

        const result = await this.call(apiKey, prompt, systemPrompt, { model: 'haiku', maxTokens: 2048 });
        return this.parseJSON(result);
    },

    async tailorResume(apiKey, resume, jobDescription, template = 'jakes', userProfile = {}) {
        const systemPrompt = `You are an elite resume writer and career strategist who has helped 500+ engineers land jobs at top companies. You rewrite resumes to be ATS-optimized AND compelling to human reviewers.
CRITICAL FORMAT RULES:
1. Output PLAIN TEXT ONLY. No markdown whatsoever — no #, no *, no **, no backticks, no [](), no --- dividers.
2. Section headers should be ALL CAPS on their own line (e.g., EXPERIENCE, EDUCATION, SKILLS)
3. Use bullet character • for bullet points
4. Use | as separator for contact info
5. NEVER fabricate experience, titles, companies, or metrics
6. Mirror exact keywords from the job description
7. Every bullet: [Strong Past-Tense Verb] + [Specific Action] + [Quantified Result]
8. Prioritize the 3 most relevant experiences at the top
9. Maximum 1 page, 480-520 words
10. Order skills by relevance to job description
11. Preserve all real numbers/metrics, enhance vague ones
12. Remove anything not relevant to this specific role
13. CONTACT INFO: Only include contact details from the original resume. If LinkedIn, GitHub, phone, or email are NOT in the original, do NOT add placeholders.
14. Do NOT output any commentary, explanation, or intro text — ONLY the resume content.`;

        const templateInstructions = this.getTemplateInstructions(template);

        // Keep full resume for quality tailoring
        const trimmedResume = resume.substring(0, 5000);

        const prompt = `Rewrite this resume for the job below. ${templateInstructions}

Name: ${userProfile.name || '[NAME]'} | Role: ${userProfile.role || 'SWE'} | YOE: ${userProfile.yoe || '5'}

RESUME:\n${trimmedResume}\n\nJOB:\n${jobDescription.substring(0, 3000)}\n\nOutput ONLY the resume.`;

        return await this.call(apiKey, prompt, systemPrompt, { model: 'sonnet', maxTokens: 4096 });
    },

    async calculateATSScore(apiKey, resume, jobDescription) {
        const systemPrompt = `ATS simulator. Score resumes like automated systems do. Respond ONLY with valid JSON.`;

        const trimmedResume = resume.substring(0, 5000);
        const trimmedJD = jobDescription.substring(0, 3000);

        const prompt = `Score this resume against the job as an ATS.

RESUME:\n${trimmedResume}\n\nJOB:\n${trimmedJD}\n\nJSON only:\n{"overallScore":0-100,"keywordScore":0-100,"formattingScore":0-100,"experienceScore":0-100,"educationScore":0-100,"skillsMatchScore":0-100,"matchedKeywords":[],"missingKeywords":[],"improvements":[{"action":"","impact":"","priority":1}],"verdict":"Pass"|"Borderline"|"Fail"}`;

        const result = await this.call(apiKey, prompt, systemPrompt, { model: 'haiku', maxTokens: 2048 });
        return this.parseJSON(result);
    },

    async extractJobDetails(apiKey, jobDescription) {
        const systemPrompt = `Extract structured job details. Respond ONLY with valid JSON. No markdown.`;

        const prompt = `Extract key details from this job posting.

JOB POSTING:
---
${jobDescription}
---

Return ONLY this JSON:
{
  "title": "...",
  "company": "...",
  "location": "...",
  "salary": "...",
  "type": "full-time|part-time|contract",
  "remote": "remote|hybrid|onsite|unknown",
  "experience": "...",
  "keySkills": ["...", "..."],
  "responsibilities": ["...", "..."],
  "qualifications": ["...", "..."],
  "benefits": ["...", "..."]
}`;

        const result = await this.call(apiKey, prompt, systemPrompt);
        return this.parseJSON(result);
    },

    async generateCoverLetter(apiKey, resume, jobDescription, companyInfo = '') {
        const systemPrompt = `You write compelling, authentic cover letters. Each letter sounds personal—never templated. You mirror the company's tone and values. Keep it under 250 words. No generic phrases like "I am writing to express my interest." Start with something specific about the company or role.`;

        const prompt = `Write a cover letter for this role.

RESUME:
---
${resume}
---

JOB DESCRIPTION:
---
${jobDescription}
---

${companyInfo ? `COMPANY INFO:\n${companyInfo}` : ''}

Write the cover letter now. Plain text only, no markdown.`;

        return await this.call(apiKey, prompt, systemPrompt, { model: 'sonnet', maxTokens: 4096 });
    },

    async generateInterviewPrep(apiKey, jobDescription, resume, jobTitle = '') {
        const systemPrompt = `You are a senior engineering interviewer at FAANG with 10+ years of technical hiring experience. Generate realistic, specific interview questions for this exact role. Respond ONLY with valid JSON array. No markdown, no code blocks.`;

        const prompt = `Job Title: ${jobTitle}
Job Description:
---
${jobDescription}
---
Candidate Resume Summary: ${resume.substring(0, 1500)}

Generate 15 interview questions as a JSON array:
[{
  "category": "Behavioral" | "Technical" | "System Design" | "Culture Fit",
  "difficulty": "Easy" | "Medium" | "Hard",
  "question": "...",
  "whyTheyAsk": "...",
  "answerFramework": "...",
  "redFlags": "..."
}]

Output ONLY the JSON array.`;

        const result = await this.call(apiKey, prompt, systemPrompt, { model: 'sonnet', maxTokens: 8192 });
        return this.parseJSON(result);
    },

    async generateFollowUp(apiKey, applicationData, stage) {
        const prompts = {
            'applied': `Write a brief, professional follow-up email for a job I applied to 1 week ago.
Company: ${applicationData.company}
Role: ${applicationData.title}
My key qualifications: ${applicationData.resumeSummary || 'experienced software engineer'}
Keep it under 80 words. Confident, not desperate. Reference something specific about the role.`,

            'interview': `Write a thank-you email to send within 2 hours of completing an interview.
Company: ${applicationData.company}
Role: ${applicationData.title}
Interviewer: ${applicationData.interviewerName || 'the interviewer'}
Topics discussed: ${applicationData.interviewNotes || 'technical background and team fit'}
Be warm, specific, and reaffirm fit. Under 100 words.`,

            'offer': `Write a salary negotiation response to a job offer.
Company: ${applicationData.company}
Role: ${applicationData.title}
Offered: ${applicationData.offeredSalary || 'not specified'}
My target: ${applicationData.targetSalary || 'market rate'}
Be professional, express genuine enthusiasm, make counter-offer confidently. Under 120 words.`
        };

        const prompt = prompts[stage];
        if (!prompt) throw new Error(`Unknown stage: ${stage}`);

        return await this.call(apiKey, prompt, 'Write professional, concise emails. Plain text only. No subject line prefix.', { model: 'sonnet' });
    },

    // ------ Template Instructions ------

    getTemplateInstructions(template) {
        switch (template) {
            case 'jakes':
                return `Use Jake's Resume format:
NAME (centered, bold, large)
Contact info on one line separated by | (phone | email | linkedin | github — only include what exists)

EDUCATION (section header, caps, underlined)
University Name — Degree — Date range (right-aligned)

EXPERIENCE (section header)
Company Name — Location
Job Title — Date range
• Bullet point achievements (4-6 per role)

PROJECTS (section header)
Project Name | Technologies used — Date
• Bullet point descriptions (2-3 per project)

TECHNICAL SKILLS (section header)
Languages: ...
Frameworks: ...
Developer Tools: ...
Libraries: ...`;

            case 'faang':
                return `Use FAANG Modern format:
NAME (large, left-aligned)
Contact line (email | linkedin | github)

Professional Summary: 2-line summary highlighting years of experience and key impact

SKILLS (at top, grid format)
Category: skills, listed, here

EXPERIENCE
Company Name
Role Title — Date range
• Impact-driven bullets

EDUCATION
University — Degree — Date`;

            case 'minimal':
                return `Use Minimal format:
NAME (large, uppercase, letter-spaced)
Contact (small, separated by bullets)

EXPERIENCE
Company · Title · Date range
• Clean, concise bullets

SKILLS
Category: values

EDUCATION
University · Degree · Date`;

            default:
                return this.getTemplateInstructions('jakes');
        }
    },

    // ------ Utility ------

    parseJSON(text) {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        let jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

        // Try direct parse first
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            // Try to find JSON object or array in text
            const objMatch = jsonStr.match(/[\[{][\s\S]*[\]}]/);
            if (objMatch) {
                let cleaned = objMatch[0];
                // Fix common LLM JSON issues:
                cleaned = cleaned.replace(/,\s*([}\]])/g, '$1'); // trailing commas
                cleaned = cleaned.replace(/'/g, '"'); // single quotes
                cleaned = cleaned.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":'); // unquoted keys

                try {
                    return JSON.parse(cleaned);
                } catch (e2) {
                    console.error('Failed to parse Claude response as JSON:', e2, '\nInput:', cleaned.substring(0, 500));
                    return { error: 'Failed to parse response', raw: text };
                }
            }
            return { error: 'No JSON found in response', raw: text };
        }
    }
};
