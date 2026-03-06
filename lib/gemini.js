/* ========================================
   JobHunter AI — Gemini AI Engine
   Resume tailoring, ATS scoring, job matching
   ======================================== */

const GeminiAI = {
    API_BASE: 'https://generativelanguage.googleapis.com/v1beta/models',
    MODEL_FAST: 'gemini-2.5-flash',
    MODEL_PRO: 'gemini-2.5-pro',

    MAX_RETRIES: 3,
    RETRY_BASE_DELAY: 2000,

    async call(apiKey, prompt, systemInstruction = '', { model = 'fast', maxTokens = 4096 } = {}) {
        const modelName = model === 'pro' ? this.MODEL_PRO : this.MODEL_FAST;
        const url = `${this.API_BASE}/${modelName}:generateContent?key=${apiKey}`;

        const body = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: maxTokens,
                topP: 0.95
            }
        };

        if (systemInstruction) {
            body.systemInstruction = {
                parts: [{ text: systemInstruction }]
            };
        }

        let lastError = null;
        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                const delay = this.RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                console.log(`Gemini API: retrying in ${delay}ms (attempt ${attempt + 1}/${this.MAX_RETRIES + 1})`);
                await new Promise(r => setTimeout(r, delay));
            }

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (response.status === 429) {
                    // Rate limited — retry with backoff
                    const err = await response.json().catch(() => ({}));
                    lastError = new Error(`Rate limited. ${err.error?.message || 'Please wait and try again.'}`);
                    continue;
                }

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(`Gemini API error: ${err.error?.message || response.statusText}`);
                }

                const data = await response.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } catch (e) {
                if (e.message.includes('Rate limited') || e.message.includes('quota')) {
                    lastError = e;
                    continue;
                }
                throw e;
            }
        }

        throw lastError || new Error('Gemini API: max retries exceeded');
    },

    // ------ Core AI Functions ------

    async analyzeJobMatch(apiKey, resume, jobDescription, userProfile = {}) {
        const systemInstruction = `You are an expert career advisor and ATS specialist. You analyze job descriptions against resumes to provide accurate match scores and actionable advice. Always respond in valid JSON format.`;

        const prompt = `Analyze how well this resume matches the job description. Consider:
1. Skills match (technical & soft skills)
2. Experience level alignment
3. Industry relevance
4. Keyword overlap (ATS perspective)
5. Cultural/company fit indicators

USER PROFILE:
- Target Role: ${userProfile.role || 'Not specified'}
- Years of Experience: ${userProfile.yoe || 'Not specified'}
- Key Skills: ${userProfile.skills || 'Not specified'}

RESUME:
---
${resume}
---

JOB DESCRIPTION:
---
${jobDescription}
---

Respond in this exact JSON format:
{
  "matchScore": <0-100 integer>,
  "matchLevel": "excellent|good|fair|poor",
  "keyMatches": ["list of matching skills/keywords found in both"],
  "missingKeywords": ["critical keywords from JD missing in resume"],
  "strengthPoints": ["what makes this candidate strong for this role"],
  "weakPoints": ["gaps or concerns"],
  "suggestions": ["specific actionable improvements"],
  "estimatedAtsScore": <0-100 integer>,
  "summary": "2-3 sentence overall assessment"
}`;

        const result = await this.call(apiKey, prompt, systemInstruction);
        return this.parseJSON(result);
    },

    async tailorResume(apiKey, resume, jobDescription, template = 'jakes', userProfile = {}) {
        const systemInstruction = `You are an elite resume writer and career strategist who has helped thousands of candidates land roles at top-tier companies (FAANG, Series A-D startups, Fortune 500). You have deep expertise in:
- ATS (Applicant Tracking System) optimization
- Recruiter psychology and what makes them spend >6 seconds on a resume
- Converting generic experience into compelling, metrics-driven narratives
- Keyword integration that reads naturally, not stuffed

You NEVER fabricate experience. You rephrase, reorder, and reframe existing experience to maximize relevance. You are meticulous about matching exact terminology from job descriptions.`;

        const templateInstructions = this.getTemplateInstructions(template);

        const prompt = `TASK: Rewrite this resume to be laser-targeted for the specific job description below.

OBJECTIVE: Achieve 95%+ ATS pass rate while being compelling to a human recruiter.

STRICT RULES:
1. TRUTHFULNESS: Only rephrase and reframe — NEVER invent experiences, companies, degrees, or metrics
2. KEYWORD MATCHING: Use exact phrasing from the JD. If JD says "React.js", write "React.js" not "React". If JD says "CI/CD pipelines", use that exact phrase
3. BULLET FORMULA: Every bullet MUST follow: [Strong Action Verb] + [What You Did] + [Quantified Result/Impact]
   - BAD: "Worked on improving the system"
   - GOOD: "Architected microservices migration serving 2M+ daily requests, reducing p99 latency by 40%"
4. PRIORITIZE: Lead with the most relevant experience for THIS specific role
5. TRIM: Remove or minimize irrelevant experience to keep it to ONE page
6. SKILLS SECTION: List skills in order of relevance to the JD, using JD's exact terminology
7. METRICS: Add or preserve quantified metrics (users, revenue, performance, team size, time saved)
8. ATS FORMATTING: No tables, columns, headers/footers, images. Use standard section headings

TEMPLATE FORMAT:
${templateInstructions}

CANDIDATE INFO:
- Name: ${userProfile.name || '[YOUR NAME]'}
- Target Role: ${userProfile.role || 'Software Engineer'}
- Years of Exp: ${userProfile.yoe || '5'}

ORIGINAL RESUME:
---
${resume}
---

TARGET JOB DESCRIPTION:
---
${jobDescription}
---

Generate the COMPLETE tailored resume in plain text, following the template format. Do not include any commentary, explanations, or markdown — only the resume content.`;

        return await this.call(apiKey, prompt, systemInstruction, { model: 'pro', maxTokens: 8192 });
    },

    async calculateATSScore(apiKey, resume, jobDescription) {
        const systemInstruction = `You are an ATS (Applicant Tracking System) simulator. You analyze resumes exactly how automated systems do: keyword matching, formatting compliance, section detection, and relevance scoring. Respond in JSON only.`;

        const prompt = `Score this resume against the job description as an ATS system would.

RESUME:
---
${resume}
---

JOB DESCRIPTION:
---
${jobDescription}
---

Respond in this exact JSON format:
{
  "overallScore": <0-100>,
  "breakdown": {
    "keywordMatch": {"score": <0-100>, "found": ["matched keywords"], "missing": ["missing critical keywords"]},
    "formatting": {"score": <0-100>, "issues": ["any formatting issues"]},
    "experienceMatch": {"score": <0-100>, "notes": "assessment"},
    "educationMatch": {"score": <0-100>, "notes": "assessment"},
    "skillsMatch": {"score": <0-100>, "matched": ["matched skills"], "missing": ["missing skills"]},
    "quantifiedAchievements": {"score": <0-100>, "count": <number of quantified bullets>, "notes": "assessment"}
  },
  "topImprovements": [
    {"priority": 1, "action": "specific action to take", "impact": "expected score increase"},
    {"priority": 2, "action": "...", "impact": "..."},
    {"priority": 3, "action": "...", "impact": "..."}
  ],
  "passesInitialScreen": true/false,
  "summary": "brief assessment"
}`;

        const result = await this.call(apiKey, prompt, systemInstruction);
        return this.parseJSON(result);
    },

    async extractJobDetails(apiKey, jobDescription) {
        const systemInstruction = `You extract structured data from job descriptions. Respond in JSON only.`;

        const prompt = `Extract all key details from this job posting:

${jobDescription}

Respond in JSON:
{
  "title": "job title",
  "company": "company name",
  "location": "location",
  "type": "full-time/part-time/contract",
  "remote": "remote/hybrid/onsite",
  "experience": "required years",
  "salary": "salary range if mentioned",
  "requiredSkills": ["list"],
  "preferredSkills": ["list"],
  "responsibilities": ["key responsibilities"],
  "qualifications": ["key qualifications"],
  "benefits": ["key benefits"],
  "keywords": ["all important keywords for ATS"]
}`;

        const result = await this.call(apiKey, prompt, systemInstruction);
        return this.parseJSON(result);
    },

    async generateCoverLetter(apiKey, resume, jobDescription, companyInfo = '') {
        const systemInstruction = `You write compelling, personalized cover letters that get interviews. You match the company's tone and culture while highlighting the candidate's most relevant experience.`;

        const prompt = `Write a compelling cover letter for this job application.

RESUME:
---
${resume}
---

JOB DESCRIPTION:
---
${jobDescription}
---

${companyInfo ? `COMPANY INFO:\n${companyInfo}\n` : ''}

Requirements:
1. Keep it under 300 words
2. Open with a hook that shows genuine interest
3. Middle paragraph: highlight 2-3 most relevant achievements with metrics
4. Show knowledge of the company
5. End with a confident call to action
6. Professional but not robotic tone
7. No generic phrases like "I'm excited about the opportunity"

Write the cover letter now:`;

        return await this.call(apiKey, prompt, systemInstruction, { model: 'pro', maxTokens: 4096 });
    },

    // ------ Template Instructions ------

    getTemplateInstructions(template) {
        const templates = {
            jakes: `JAKE'S RESUME FORMAT (Classic LaTeX-style, single column):
---
[FULL NAME]
[Phone] | [Email] | [LinkedIn URL] | [GitHub URL]

EDUCATION
  [University Name] — [Location]
  [Degree], [Major]; GPA: [X.XX]                    [Dates]

EXPERIENCE
  [Company Name] — [Location]
  [Job Title]                                        [Dates]
  • [Action verb] + [what you did] + [result with metrics]
  • [Action verb] + [what you did] + [result with metrics]
  • [Action verb] + [what you did] + [result with metrics]

PROJECTS
  [Project Name] | [Technologies used]               [Dates]
  • [What it does + impact]
  • [Technical detail + result]

TECHNICAL SKILLS
  Languages: [list]
  Frameworks: [list]
  Developer Tools: [list]
  Libraries: [list]
---
Rules: Single page, no colors, no graphics, clean sections with horizontal rules, dates right-aligned, company name bold.`,

            faang: `FAANG MODERN FORMAT (Impact-focused, ATS-optimized):
---
[FULL NAME]
[Email] | [Phone] | [LinkedIn] | [GitHub] | [Portfolio]

SUMMARY
[2-3 sentences with years of experience, core expertise, and key achievement with metric]

SKILLS
Technical: [prioritized list matching JD]
Tools & Platforms: [list]
Methodologies: [list]

PROFESSIONAL EXPERIENCE

[COMPANY NAME] | [Job Title] | [Location] | [Dates]
• [Achievement]: [Action] + [Context] + [Result with metric]
• Led/Built/Designed [X] resulting in [Y% improvement / $Z saved]
• Collaborated with [team size] engineers to [deliver what] [impact]

EDUCATION
[Degree] in [Major] | [University] | [Year]

CERTIFICATIONS & AWARDS
• [Relevant cert or award]
---
Rules: Summary at top, skills before experience, every bullet has a metric, focus on impact not tasks.`,

            minimal: `MINIMAL PRO FORMAT (Clean, modern, scannable):
---
[FULL NAME]
[Contact line: email • phone • linkedin • github]

[SECTION] ─────────────────────────
Each section separated by thin rule

EXPERIENCE
[Title] @ [Company]    [Dates]
- Bullet with impact
- Bullet with metric

SKILLS
[Category]: items | items | items

EDUCATION
[Degree], [School], [Year]
---
Rules: Maximum white space, minimal formatting, ultra-scannable, one page strict.`
        };

        return templates[template] || templates.jakes;
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
            // Try to find JSON object in text
            const objMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (objMatch) {
                let cleaned = objMatch[0];
                // Fix common LLM JSON issues:
                // 1. Trailing commas before } or ]
                cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
                // 2. Single quotes instead of double quotes
                cleaned = cleaned.replace(/'/g, '"');
                // 3. Unquoted keys
                cleaned = cleaned.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

                try {
                    return JSON.parse(cleaned);
                } catch (e2) {
                    console.error('Failed to parse Gemini response as JSON:', e2, '\nInput:', cleaned.substring(0, 500));
                    return { error: 'Failed to parse response', raw: text };
                }
            }
            return { error: 'No JSON found in response', raw: text };
        }
    }
};
