/* ========================================
   JobHunter AI — Resume Templates
   Jake's Resume + FAANG templates in HTML/CSS
   ======================================== */

const ResumeTemplates = {

  // Generate HTML resume from tailored text
  generateHTML(resumeText, template = 'jakes') {
    resumeText = this.cleanResumeText(resumeText);
    const sections = this.parseResumeSections(resumeText);
    sections.contact = this.cleanContact(sections.contact);

    switch (template) {
      case 'jakes': return this.jakesTemplate(sections);
      case 'faang': return this.faangTemplate(sections);
      case 'minimal': return this.minimalTemplate(sections);
      default: return this.jakesTemplate(sections);
    }
  },

  cleanResumeText(text) {
    if (!text) return '';
    text = text.replace(/\u00e2\u0080\u0094/g, '\u2014');
    text = text.replace(/\u00e2\u0080\u0093/g, '\u2013');
    return text;
  },

  cleanContact(contact) {
    if (!contact) return '';
    const parts = contact.split(/\s*[|\u2022\u00b7]\s*/).map(p => p.trim()).filter(Boolean);
    const cleaned = parts.filter(part => {
      const lower = part.toLowerCase();
      if (lower.includes('your-profile') || lower.includes('your-username')) return false;
      if (lower.includes('your name') || lower.includes('[your')) return false;
      if (/linkedin\.com\/in\/you\b/.test(lower)) return false;
      if (/github\.com\/you\b/.test(lower)) return false;
      if (lower.includes('email@example') || lower.includes('your@email')) return false;
      if (lower.includes('(555)') || lower.includes('555-555')) return false;
      if (/^\[.*\]$/.test(part.trim())) return false;
      return true;
    });
    return cleaned.join(' | ');
  },

  // Parse resume text into structured sections
  parseResumeSections(text) {
    const sections = {
      name: '',
      contact: '',
      summary: '',
      education: [],
      experience: [],
      projects: [],
      skills: {},
      certifications: [],
      raw: text
    };

    if (!text) return sections;

    const lines = text.split('\n');
    let currentSection = '';
    let currentEntry = null;

    // First non-empty line is usually the name
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (!sections.name) {
        sections.name = line;
        continue;
      }

      // Check if it's a contact line (has email, phone, or URL)
      if (!sections.contact && (line.includes('@') || line.includes('|') || line.includes('linkedin') || line.includes('github'))) {
        sections.contact = line;
        continue;
      }

      // Detect section headers
      const sectionMatch = line.match(/^(?:#{1,3}\s*)?([A-Z][A-Z\s&]+)$/);
      if (sectionMatch || this.isSectionHeader(line)) {
        currentSection = this.normalizeSectionName(line);
        currentEntry = null;
        continue;
      }

      // Parse content based on current section
      switch (currentSection) {
        case 'education':
          if (!line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*')) {
            if (currentEntry && !currentEntry.details) {
              currentEntry.details = line;
            } else {
              currentEntry = { text: line, details: '' };
              sections.education.push(currentEntry);
            }
          } else {
            if (currentEntry) currentEntry.details += '\n' + line;
          }
          break;

        case 'experience':
          if (!line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*')) {
            currentEntry = { header: line, bullets: [] };
            sections.experience.push(currentEntry);
          } else if (currentEntry) {
            currentEntry.bullets.push(line.replace(/^[•\-*]\s*/, ''));
          }
          break;

        case 'projects':
          if (!line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*')) {
            currentEntry = { header: line, bullets: [] };
            sections.projects.push(currentEntry);
          } else if (currentEntry) {
            currentEntry.bullets.push(line.replace(/^[•\-*]\s*/, ''));
          }
          break;

        case 'skills':
          if (line.includes(':')) {
            const [cat, vals] = line.split(':').map(s => s.trim());
            sections.skills[cat] = vals;
          } else {
            sections.skills['General'] = (sections.skills['General'] || '') + ', ' + line;
          }
          break;

        case 'summary':
          sections.summary += (sections.summary ? ' ' : '') + line;
          break;

        case 'certifications':
          sections.certifications.push(line.replace(/^[•\-*]\s*/, ''));
          break;

        default:
          // Try to detect where we are
          if (line.startsWith('•') || line.startsWith('-')) {
            if (currentEntry) {
              currentEntry.bullets = currentEntry.bullets || [];
              currentEntry.bullets.push(line.replace(/^[•\-*]\s*/, ''));
            }
          }
          break;
      }
    }

    return sections;
  },

  isSectionHeader(line) {
    const headers = [
      'education', 'experience', 'work experience', 'professional experience',
      'skills', 'technical skills', 'projects', 'personal projects',
      'summary', 'professional summary', 'objective',
      'certifications', 'awards', 'publications',
      'languages', 'frameworks', 'developer tools', 'libraries'
    ];
    return headers.some(h => line.toLowerCase().trim().replace(/[─\-=_#]/g, '').trim() === h);
  },

  normalizeSectionName(line) {
    const clean = line.toLowerCase().trim().replace(/[─\-=_#*]/g, '').trim();
    if (clean.includes('education')) return 'education';
    if (clean.includes('experience') || clean.includes('work')) return 'experience';
    if (clean.includes('project')) return 'projects';
    if (clean.includes('skill') || clean.includes('technical') || clean.includes('languages') || clean.includes('framework') || clean.includes('tools') || clean.includes('libraries')) return 'skills';
    if (clean.includes('summary') || clean.includes('objective')) return 'summary';
    if (clean.includes('certif') || clean.includes('award')) return 'certifications';
    return clean;
  },

  // ====== JAKE'S RESUME TEMPLATE ======
  jakesTemplate(s) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'CMU Serif', 'Computer Modern', 'Latin Modern Roman', 'Times New Roman', Georgia, serif;
    font-size: 10pt;
    line-height: 1.3;
    color: #000;
    max-width: 7.5in;
    margin: 0.5in auto;
    padding: 0 0.25in;
  }
  .name {
    text-align: center;
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .contact {
    text-align: center;
    font-size: 9pt;
    color: #333;
    margin-bottom: 10px;
  }
  .contact a { color: #000; text-decoration: underline; }
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin: 10px 0 6px;
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
  }
  .entry-title { font-weight: 700; font-size: 10pt; }
  .entry-subtitle { font-style: italic; font-size: 10pt; }
  .entry-date { font-style: italic; font-size: 9pt; text-align: right; white-space: nowrap; }
  .entry-location { font-style: italic; font-size: 9pt; }
  ul {
    margin: 2px 0 6px 18px;
    padding: 0;
  }
  li {
    font-size: 10pt;
    margin-bottom: 1px;
    line-height: 1.35;
  }
  .skills-row {
    margin: 2px 0;
    font-size: 10pt;
  }
  .skills-category { font-weight: 700; }
  .project-tech { font-style: italic; font-weight: normal; }
</style>
</head>
<body>
  <div class="name">${s.name || 'Your Name'}</div>
  <div class="contact">${s.contact || ''}</div>
  
  ${s.education.length > 0 ? `
  <div class="section-title">Education</div>
  ${s.education.map(e => `
  <div class="entry-header">
    <div><span class="entry-title">${e.text || ''}</span></div>
    <div class="entry-date">${e.details || ''}</div>
  </div>
  `).join('')}` : ''}

  ${s.experience.length > 0 ? `
  <div class="section-title">Experience</div>
  ${s.experience.map(e => `
  <div class="entry-header">
    <div><span class="entry-title">${e.header || ''}</span></div>
  </div>
  <ul>${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
  `).join('')}` : ''}

  ${s.projects.length > 0 ? `
  <div class="section-title">Projects</div>
  ${s.projects.map(p => `
  <div class="entry-header">
    <div><span class="entry-title">${p.header || ''}</span></div>
  </div>
  <ul>${p.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
  `).join('')}` : ''}

  ${Object.keys(s.skills).length > 0 ? `
  <div class="section-title">Technical Skills</div>
  ${Object.entries(s.skills).map(([cat, vals]) => `
  <div class="skills-row"><span class="skills-category">${cat}:</span> ${vals}</div>
  `).join('')}` : ''}

  ${s.certifications.length > 0 ? `
  <div class="section-title">Certifications & Awards</div>
  <ul>${s.certifications.map(c => `<li>${c}</li>`).join('')}</ul>
  ` : ''}
</body>
</html>`;
  },

  // ====== FAANG MODERN TEMPLATE ======
  faangTemplate(s) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  body {
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    font-size: 9.5pt;
    line-height: 1.35;
    color: #1a1a1a;
    max-width: 7.5in;
    margin: 0.5in auto;
    padding: 0 0.25in;
  }
  .name {
    font-size: 22pt;
    font-weight: 700;
    color: #0a0a0a;
    margin-bottom: 3px;
    letter-spacing: -0.5px;
  }
  .contact {
    font-size: 9pt;
    color: #555;
    margin-bottom: 8px;
  }
  .contact a { color: #2563eb; text-decoration: none; }
  .summary {
    font-size: 9.5pt;
    color: #333;
    line-height: 1.45;
    margin-bottom: 10px;
    padding: 6px 0;
    border-bottom: 1px solid #e5e7eb;
  }
  .section-title {
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #2563eb;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 3px;
    margin: 10px 0 6px;
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
  }
  .entry-title { font-weight: 700; font-size: 10pt; }
  .entry-role { font-weight: 500; color: #2563eb; }
  .entry-date { font-size: 8.5pt; color: #666; white-space: nowrap; }
  ul {
    margin: 2px 0 6px 16px;
    padding: 0;
  }
  li {
    font-size: 9.5pt;
    margin-bottom: 1px;
    line-height: 1.4;
  }
  .skills-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    font-size: 9.5pt;
  }
  .skills-category { font-weight: 600; color: #333; }
  .skills-values { color: #555; }
</style>
</head>
<body>
  <div class="name">${s.name || 'Your Name'}</div>
  <div class="contact">${s.contact || ''}</div>
  ${s.summary ? `<div class="summary">${s.summary}</div>` : ''}

  ${Object.keys(s.skills).length > 0 ? `
  <div class="section-title">Skills</div>
  <div class="skills-grid">
  ${Object.entries(s.skills).map(([cat, vals]) => `
    <div class="skills-category">${cat}:</div>
    <div class="skills-values">${vals}</div>
  `).join('')}
  </div>` : ''}

  ${s.experience.length > 0 ? `
  <div class="section-title">Experience</div>
  ${s.experience.map(e => `
  <div class="entry-header">
    <div><span class="entry-title">${e.header || ''}</span></div>
  </div>
  <ul>${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
  `).join('')}` : ''}

  ${s.education.length > 0 ? `
  <div class="section-title">Education</div>
  ${s.education.map(e => `
  <div class="entry-header">
    <div><span class="entry-title">${e.text || ''}</span></div>
    <div class="entry-date">${e.details || ''}</div>
  </div>
  `).join('')}` : ''}

  ${s.projects.length > 0 ? `
  <div class="section-title">Projects</div>
  ${s.projects.map(p => `
  <div class="entry-header">
    <div><span class="entry-title">${p.header || ''}</span></div>
  </div>
  <ul>${p.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
  `).join('')}` : ''}

  ${s.certifications.length > 0 ? `
  <div class="section-title">Certifications</div>
  <ul>${s.certifications.map(c => `<li>${c}</li>`).join('')}</ul>
  ` : ''}
</body>
</html>`;
  },

  // ====== MINIMAL PRO TEMPLATE ======
  minimalTemplate(s) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 9.5pt;
    line-height: 1.4;
    color: #222;
    max-width: 7.5in;
    margin: 0.5in auto;
    padding: 0 0.25in;
  }
  .name {
    font-size: 24pt;
    font-weight: 300;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .contact {
    font-size: 8.5pt;
    color: #777;
    letter-spacing: 1px;
    margin-bottom: 14px;
  }
  .section-title {
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #999;
    margin: 14px 0 6px;
    padding-bottom: 4px;
    border-bottom: 0.5px solid #ddd;
  }
  .entry {
    margin-bottom: 8px;
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2px;
  }
  .entry-title { font-weight: 600; font-size: 10pt; }
  .entry-date { font-size: 8.5pt; color: #999; }
  ul {
    margin: 2px 0 0 14px;
    padding: 0;
  }
  li {
    font-size: 9pt;
    margin-bottom: 0;
    color: #444;
  }
  .skills-line {
    font-size: 9pt;
    margin: 2px 0;
  }
  .skills-label { font-weight: 600; }
</style>
</head>
<body>
  <div class="name">${s.name || 'Your Name'}</div>
  <div class="contact">${s.contact || ''}</div>

  ${s.experience.length > 0 ? `
  <div class="section-title">Experience</div>
  ${s.experience.map(e => `
  <div class="entry">
    <div class="entry-header">
      <span class="entry-title">${e.header || ''}</span>
    </div>
    <ul>${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
  </div>
  `).join('')}` : ''}

  ${Object.keys(s.skills).length > 0 ? `
  <div class="section-title">Skills</div>
  ${Object.entries(s.skills).map(([cat, vals]) => `
  <div class="skills-line"><span class="skills-label">${cat}:</span> ${vals}</div>
  `).join('')}` : ''}

  ${s.education.length > 0 ? `
  <div class="section-title">Education</div>
  ${s.education.map(e => `
  <div class="entry">
    <div class="entry-header">
      <span class="entry-title">${e.text || ''}</span>
      <span class="entry-date">${e.details || ''}</span>
    </div>
  </div>
  `).join('')}` : ''}

  ${s.projects.length > 0 ? `
  <div class="section-title">Projects</div>
  ${s.projects.map(p => `
  <div class="entry">
    <div class="entry-header">
      <span class="entry-title">${p.header || ''}</span>
    </div>
    <ul>${p.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
  </div>
  `).join('')}` : ''}
</body>
</html>`;
  }
};
