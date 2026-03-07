/* ========================================
   JobHunter AI — LaTeX Resume Templates
   Generates .tex files using user's exact Overleaf template
   ======================================== */

const LaTeXTemplates = {

    // Store the user's template preamble + commands
    templates: {
        'hemanth': {
            name: "Hemanth's Template (Jake's Resume)",
            preamble: `%-------------------------
% Resume in LaTeX (expanded + compile-safe)
% Template: Jake Gutierrez (MIT) — https://github.com/sb2nov/resume
%------------------------

\\documentclass[letterpaper,10pt]{article}

\\usepackage{lmodern}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{fontawesome5}
\\usepackage{multicol}
\\setlength{\\multicolsep}{-3.0pt}
\\setlength{\\columnsep}{-1pt}
\\input{glyphtounicode}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\setlength{\\footskip}{10pt}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.75in}
\\addtolength{\\evensidemargin}{-0.75in}
\\addtolength{\\textwidth}{1.5in}
\\addtolength{\\topmargin}{-.8in}
\\addtolength{\\textheight}{1.6in}

\\urlstyle{same}

\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

\\pdfgentounicode=1

\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{1.0\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & \\textbf{\\small #2} \\\\
      \\textit{\\small #3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
  \\item
  \\begin{tabular*}{1.001\\textwidth}{l@{\\extracolsep{\\fill}}r}
    \\small #1 & \\textbf{\\small #2}\\\\
  \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.0in, label={}]\\setlength\\itemsep{4pt}}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=0.15in]\\setlength\\itemsep{2pt}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}`,

            // Contact section — will be preserved as-is from original
            heading: `\\begin{center}
    {\\Huge \\scshape Hemanth Saragadam} \\\\ \\vspace{2pt}
    \\small
    \\raisebox{-0.1\\height}\\faPhone\\ +1 5103944615 \\  
    \\href{mailto:hemanthdev31@gmail.com}{\\raisebox{-0.2\\height}\\faEnvelope\\ \\underline{hemanthdev31@gmail.com}} \\ 
     \\href{https://www.linkedin.com/in/hemanths31/}{\\raisebox{-0.2\\height}\\faLinkedin\\ \\underline{linkedin.com/in/hemanths31/}}
    \\vspace{-10pt}
\\end{center}`,

            education: `\\section{Education}
\\resumeSubHeadingListStart
  \\resumeSubheading
    {Northeastern University}{Sep. 2022 -- May 2024}
    {Master of Science in Computer Science}{Boston, Massachusetts}
\\resumeSubHeadingListEnd`,

            certifications: `\\section{Certifications}
\\resumeSubHeadingListStart
\\resumeItem{\\textbf{AWS Certified Solutions Architect Associate} \\hfill 2025}
\\resumeItem{\\textbf{HashiCorp Certified Terraform Associate} \\hfill 2024}
\\resumeSubHeadingListEnd`
        }
    },

    // Escape special LaTeX characters in text
    escapeLatex(text) {
        if (!text) return '';
        return text
            .replace(/\\/g, '\\textbackslash{}')
            .replace(/&/g, '\\&')
            .replace(/%/g, '\\%')
            .replace(/\$/g, '\\$')
            .replace(/#/g, '\\#')
            .replace(/_/g, '\\_')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}')
            .replace(/~/g, '\\textasciitilde{}')
            .replace(/\^/g, '\\textasciicircum{}');
    },

    // Generate a complete .tex file from Claude's tailored LaTeX output
    generateTeX(tailoredLatexBody, templateKey = 'hemanth') {
        const tmpl = this.templates[templateKey];
        if (!tmpl) return tailoredLatexBody; // If unknown template, return raw

        return `${tmpl.preamble}

\\begin{document}

%----------HEADING----------
${tmpl.heading}


%-----------TAILORED CONTENT-----------
${tailoredLatexBody}


%-----------EDUCATION-----------
${tmpl.education}


%-----------CERTIFICATIONS-----------
${tmpl.certifications}


\\end{document}
`;
    },

    // Get Claude system prompt for LaTeX output
    getLatexTailoringPrompt() {
        return `You are a resume tailoring expert. You output ONLY LaTeX code using Jake's Resume template commands.

AVAILABLE COMMANDS (use ONLY these):
- \\section{Section Name}
- \\resumeSubHeadingListStart ... \\resumeSubHeadingListEnd
- \\resumeSubheading{Company/Org}{Date Range}{Title/Role}{Location}
- \\resumeProjectHeading{Project Name with \\textbf{bold} and tech}{Date}
- \\resumeItemListStart ... \\resumeItemListEnd
- \\resumeItem{Bullet point text}
- \\textbf{bold text}
- For skills section: \\begin{itemize}[leftmargin=0.15in, label={}] with \\textbf{Category:} values \\\\

CRITICAL RULES:
1. Output ONLY the body sections: Summary, Technical Skills, Experience, Projects and Hackathons
2. DO NOT output \\documentclass, \\usepackage, \\begin{document}, \\end{document}, heading/contact info, education, or certifications — these are injected separately
3. Every company, job title, date, location, and metric MUST come from the original resume — NEVER invent
4. Escape special LaTeX characters: use \\% for percent, \\& for ampersand, \\# for hash
5. Use commas in numbers like: 12{,}000 (LaTeX comma formatting)
6. Keep all bullet points from original but reword them to match the job description keywords
7. Reorder bullets within each role by relevance to the target job
8. The output should compile cleanly in Overleaf with the Jake's Resume template

TAILORING STRATEGY:
- Mirror exact keywords from the job description naturally into bullet points
- Reorder experience bullets so the most relevant ones come first
- Adjust the summary to match the target role
- Keep ALL jobs, ALL projects — never drop any
- Preserve ALL quantified metrics exactly as they appear in the original`;
    },

    // Download .tex file
    downloadTeX(texContent, filename = 'tailored_resume.tex') {
        const blob = new Blob([texContent], { type: 'application/x-tex;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
};
