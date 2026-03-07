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
IMPORTANT: keyMatches and missingKeywords MUST be short 1-4 word skill/technology tags only (e.g. "React", "AWS", "GraphQL"). NEVER write full sentences in those arrays.
JSON: {"matchScore":0-100,"matchLevel":"excellent"|"good"|"fair"|"poor","keyMatches":["React","AWS"],"missingKeywords":["GraphQL"],"strengthPoints":["string"],"weakPoints":["string"],"suggestions":["string"],"estimatedAtsScore":0-100,"salaryRange":null,"remotePolicy":"remote"|"hybrid"|"onsite"|"unknown","summary":"2 sentences"}`;

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
        const systemPrompt = `You are an elite resume writer who has helped 500+ engineers land FAANG offers. You produce resumes that read like a human wrote them — not AI-generated keyword-stuffed garbage.

VOICE MATCHING:
- Analyze the candidate's original writing style (formal vs casual, technical depth, sentence structure)
- Replicate that voice in the rewrite. The tailored resume must sound like the SAME PERSON wrote it.
- If original uses concise telegraphic bullets, keep that style. If original uses fuller sentences, match that.

COMPLETENESS — MANDATORY:
- You MUST include EVERY job/position from the original resume. Do NOT skip any company or role.
- You MUST include the EDUCATION section exactly as it appears in the original. Copy university name, degree, dates verbatim.
- You MUST include ALL projects from the original.
- You MUST include ALL skills categories from the original.
- If a section exists in the original resume, it MUST exist in your output.

TRUTHFULNESS:
- Every company name, job title, date range, and metric MUST come from the original resume.
- NEVER invent companies, titles, or numbers. NEVER add roles that don't exist in the original.
- You may reword bullet points to emphasize JD-relevant skills, but the underlying achievement must be real.
- Preserve all quantified metrics exactly (35%, 40%, $2M, 500K users, etc.)

TAILORING STRATEGY:
- Mirror exact keywords and phrases from the job description in your bullet points.
- Reorder bullets within each role: most JD-relevant achievement first.
- Rewrite bullet points using: [Strong Past-Tense Verb] + [Specific Action with JD keywords] + [Quantified Result]
- Reorder the TECHNICAL SKILLS section: skills mentioned in JD first, then remaining skills.
- Keep total length to 1 page (480-550 words).

FORMAT:
- PLAIN TEXT ONLY. No markdown (#, *, **, backticks, [](), ---).
- Section headers: ALL CAPS on their own line.
- Bullets: use • character.
- Contact info: use | separator. Only include contact items from the original resume.
- Output the resume content ONLY — no intro text, no "Here's your tailored resume", no commentary.`;

        const templateInstructions = this.getTemplateInstructions(template);

        const prompt = `Tailor this resume for the target job. ${templateInstructions}

ORIGINAL RESUME:
---
${resume.substring(0, 6000)}
---

TARGET JOB DESCRIPTION:
---
${jobDescription.substring(0, 4000)}
---

Candidate: ${userProfile.name || ''} | Target: ${userProfile.role || 'Software Engineer'}

Remember: include ALL jobs, ALL education, ALL projects, ALL skills from the original. Output ONLY the resume.`;

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
                return `FORMAT RULES (Jake's Resume style, plain text only):
- Section order: Name, Contact, EDUCATION, EXPERIENCE, PROJECTS, TECHNICAL SKILLS
- ALL section headers in CAPS
- Use • for bullets

SECTION FORMAT:
Name line (first line, no label)
Contact line: phone | email | linkedin | github (only items that exist in original resume)

EDUCATION
[EXTRACT exact university name from resume] — [EXTRACT exact degree] — [EXTRACT exact dates]

EXPERIENCE
[EXTRACT company name] — [EXTRACT location]
[EXTRACT job title] — [EXTRACT start date] — [EXTRACT end date or Present]
• [achievement]
(4-6 bullets per role, rewritten to target this specific job)

PROJECTS
[EXTRACT project name] | [EXTRACT tech stack] — [EXTRACT year]
• [description]

TECHNICAL SKILLS
Languages: [EXTRACT from resume]
Frameworks: [EXTRACT from resume]
Developer Tools: [EXTRACT from resume]
Libraries: [EXTRACT from resume]`;

            case 'faang':
                return `FORMAT RULES (FAANG Modern style, plain text only):
- Section order: Name, Contact, Summary, SKILLS, EXPERIENCE, EDUCATION

Name line (first line)
Contact: email | linkedin | github (only what exists)
Summary: [write 2 impactful sentences about candidate's actual experience from resume]

SKILLS
[EXTRACT and organize by category from resume]

EXPERIENCE
[EXTRACT company name]
[EXTRACT job title] — [EXTRACT dates]
• [impact bullet rewritten for this job]

EDUCATION
[EXTRACT university] — [EXTRACT degree] — [EXTRACT year]`;

            case 'minimal':
                return `FORMAT RULES (Minimal style, plain text only):
- Sparse, clean, concise

[EXTRACT full name from resume]
[EXTRACT phone] | [EXTRACT email]

EXPERIENCE
[EXTRACT company] · [EXTRACT title] · [EXTRACT dates]
• [concise bullet]

SKILLS
[EXTRACT category]: [EXTRACT values]

EDUCATION
[EXTRACT university] · [EXTRACT degree] · [EXTRACT year]`;

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
