/* ========================================
   JobHunter AI — Local ATS Scorer
   Fast offline scoring without API calls
   ======================================== */

const ATSScorer = {
    // Common ATS keywords by category
    ACTION_VERBS: [
        'achieved', 'built', 'created', 'delivered', 'designed', 'developed',
        'engineered', 'established', 'implemented', 'improved', 'increased',
        'launched', 'led', 'managed', 'optimized', 'orchestrated', 'reduced',
        'refactored', 'scaled', 'spearheaded', 'streamlined', 'transformed'
    ],

    SECTIONS: ['experience', 'education', 'skills', 'projects', 'summary', 'objective', 'certifications'],

    // Quick score without API
    quickScore(resumeText, jobDescription) {
        if (!resumeText || !jobDescription) return null;

        const resume = resumeText.toLowerCase();
        const jd = jobDescription.toLowerCase();

        const scores = {
            keywordMatch: this.scoreKeywords(resume, jd),
            formatting: this.scoreFormatting(resumeText),
            actionVerbs: this.scoreActionVerbs(resume),
            quantification: this.scoreQuantification(resumeText),
            sections: this.scoreSections(resume),
            length: this.scoreLength(resumeText)
        };

        // Weighted average
        const weights = {
            keywordMatch: 0.35,
            formatting: 0.10,
            actionVerbs: 0.15,
            quantification: 0.15,
            sections: 0.15,
            length: 0.10
        };

        let totalScore = 0;
        for (const [key, weight] of Object.entries(weights)) {
            totalScore += Math.min(100, scores[key].score) * weight;
        }

        return {
            overallScore: Math.min(100, Math.round(totalScore)),
            breakdown: scores,
            passesScreen: totalScore >= 75
        };
    },

    scoreKeywords(resume, jd) {
        // Extract meaningful words from JD (2+ chars, not common words)
        const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
            'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will',
            'with', 'this', 'that', 'from', 'they', 'were', 'been', 'said',
            'each', 'which', 'their', 'about', 'would', 'make', 'like', 'into',
            'them', 'then', 'than', 'could', 'other', 'more', 'also', 'back',
            'what', 'when', 'some', 'very', 'work', 'able', 'must', 'should',
            'well', 'just', 'such', 'only', 'over', 'team', 'role', 'join'
        ]);

        const jdWords = jd.match(/\b[a-z+#.]{3,}\b/g) || [];
        const keywords = [...new Set(jdWords.filter(w => !stopWords.has(w)))];

        // Count how many JD keywords appear in resume
        const found = keywords.filter(kw => resume.includes(kw));
        const missing = keywords.filter(kw => !resume.includes(kw));

        // Also check for multi-word phrases (technologies, frameworks)
        const phrases = this.extractTechPhrases(jd);
        const foundPhrases = phrases.filter(p => resume.includes(p.toLowerCase()));
        const missingPhrases = phrases.filter(p => !resume.includes(p.toLowerCase()));

        const keywordRatio = keywords.length > 0 ? found.length / keywords.length : 0;
        const phraseBonus = phrases.length > 0 ? (foundPhrases.length / phrases.length) * 15 : 0;

        return {
            score: Math.min(100, Math.round(keywordRatio * 85 + phraseBonus)),
            found: found.slice(0, 20),
            missing: missing.slice(0, 15),
            foundPhrases,
            missingPhrases: missingPhrases.slice(0, 10),
            total: keywords.length
        };
    },

    extractTechPhrases(text) {
        const techPatterns = [
            /\b(?:react\.?js|node\.?js|next\.?js|vue\.?js|angular\.?js|express\.?js)\b/gi,
            /\b(?:type\s?script|java\s?script|python|golang|rust|swift|kotlin)\b/gi,
            /\b(?:aws|gcp|azure|docker|kubernetes|terraform|ci\/cd)\b/gi,
            /\b(?:postgresql|mongodb|redis|elasticsearch|dynamodb|mysql)\b/gi,
            /\b(?:rest\s?api|graphql|grpc|microservices|event.?driven)\b/gi,
            /\b(?:machine learning|deep learning|data science|computer vision|nlp)\b/gi,
            /\b(?:system design|distributed systems|cloud computing|devops)\b/gi,
            /\b(?:agile|scrum|kanban|jira|confluence)\b/gi,
            /\b(?:unit test|integration test|e2e|tdd|bdd)\b/gi
        ];

        const phrases = new Set();
        for (const pattern of techPatterns) {
            const matches = text.match(pattern) || [];
            matches.forEach(m => phrases.add(m.trim()));
        }
        return [...phrases];
    },

    scoreFormatting(text) {
        let score = 100;
        const issues = [];

        // Check for common formatting problems
        if (text.includes('\t')) {
            score -= 10;
            issues.push('Contains tabs (some ATS systems struggle with tabs)');
        }

        // Check for consistent bullet points
        const bulletTypes = new Set();
        if (text.includes('•')) bulletTypes.add('•');
        if (text.includes('▪')) bulletTypes.add('▪');
        if (text.includes('-')) bulletTypes.add('-');
        if (text.includes('*')) bulletTypes.add('*');
        if (bulletTypes.size > 2) {
            score -= 10;
            issues.push('Inconsistent bullet point styles');
        }

        // Check line length (ATS prefer standard line lengths)
        const lines = text.split('\n').filter(l => l.trim());
        const longLines = lines.filter(l => l.length > 150);
        if (longLines.length > 3) {
            score -= 5;
            issues.push('Some lines are very long (>150 chars)');
        }

        // Check for special characters that might confuse ATS
        if (/[""''—–]/.test(text)) {
            score -= 5;
            issues.push('Contains smart quotes/em dashes (use plain text equivalents)');
        }

        return { score: Math.max(0, score), issues };
    },

    scoreActionVerbs(resume) {
        const found = this.ACTION_VERBS.filter(v => resume.includes(v));
        const lines = resume.split('\n').filter(l => l.trim().startsWith('•') || l.trim().startsWith('-') || l.trim().startsWith('*'));

        const startsWithAction = lines.filter(line => {
            const words = line.replace(/^[•\-*]\s*/, '').trim().split(/\s+/);
            return words.length > 0 && this.ACTION_VERBS.some(v => words[0].includes(v));
        });

        const ratio = lines.length > 0 ? startsWithAction.length / lines.length : 0;

        return {
            score: Math.round(Math.min(100, ratio * 80 + found.length * 3)),
            found,
            bulletCount: lines.length,
            actionBullets: startsWithAction.length
        };
    },

    scoreQuantification(text) {
        // Look for numbers, percentages, dollar amounts
        const metrics = text.match(/\d+[%xX]|\$[\d,]+|[\d,]+ (?:users?|customers?|requests?|transactions?|developers?|engineers?|members?)/gi) || [];
        const percentages = text.match(/\d+\s*%/g) || [];
        const dollars = text.match(/\$[\d,.]+[KkMmBb]?/g) || [];
        const numbers = text.match(/\b\d{2,}\b/g) || [];

        const total = new Set([...metrics, ...percentages, ...dollars]).size;
        const score = Math.min(100, total * 12); // ~8 metrics = 96

        return {
            score,
            metricsFound: total,
            examples: [...new Set([...metrics, ...percentages, ...dollars])].slice(0, 8),
            note: total < 5 ? 'Add more quantified achievements (aim for 8+ metrics)' : 'Good use of metrics!'
        };
    },

    scoreSections(resume) {
        const found = this.SECTIONS.filter(section => {
            const patterns = [
                new RegExp(`\\b${section}\\b`, 'i'),
                new RegExp(`\\b${section.toUpperCase()}\\b`),
            ];
            return patterns.some(p => p.test(resume));
        });

        const essential = ['experience', 'education', 'skills'];
        const missingEssential = essential.filter(s => !found.includes(s));

        return {
            score: Math.min(100, Math.round((found.length / this.SECTIONS.length) * 100)),
            found,
            missing: this.SECTIONS.filter(s => !found.includes(s)),
            missingEssential
        };
    },

    scoreLength(text) {
        const wordCount = text.split(/\s+/).length;
        const lineCount = text.split('\n').filter(l => l.trim()).length;

        // Ideal: 400-800 words, 40-80 lines (1 page)
        let score = 100;
        if (wordCount < 200) score -= 30;
        else if (wordCount < 350) score -= 15;
        else if (wordCount > 1000) score -= 20;
        else if (wordCount > 800) score -= 10;

        return {
            score: Math.max(0, score),
            wordCount,
            lineCount,
            note: wordCount < 350 ? 'Resume may be too short' : wordCount > 800 ? 'Consider trimming to 1 page' : 'Good length'
        };
    }
};
