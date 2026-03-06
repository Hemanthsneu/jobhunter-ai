/* ========================================
   JobHunter AI — PDF Text Extractor
   Uses Mozilla pdf.js for reliable parsing
   ======================================== */

const PDFExtractor = {

    _initialized: false,

    /**
     * Initialize pdf.js worker
     */
    init() {
        if (this._initialized) return;
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
            this._initialized = true;
        }
    },

    /**
     * Extract text from a PDF File, Blob, or ArrayBuffer
     * Uses pdf.js for reliable parsing of all PDF formats
     */
    async extractText(fileOrBuffer) {
        this.init();

        let arrayBuffer;
        if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
            arrayBuffer = await fileOrBuffer.arrayBuffer();
        } else if (fileOrBuffer instanceof ArrayBuffer) {
            arrayBuffer = fileOrBuffer;
        } else {
            throw new Error('Expected File, Blob, or ArrayBuffer');
        }

        // Use pdf.js if available (preferred)
        if (typeof pdfjsLib !== 'undefined') {
            return await this._extractWithPdfJs(arrayBuffer);
        }

        // Fallback: basic text extraction
        return this._extractBasic(arrayBuffer);
    },

    /**
     * Extract text using Mozilla pdf.js — handles all PDF formats reliably
     */
    async _extractWithPdfJs(arrayBuffer) {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        const textParts = [];

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Build text preserving layout
            let lastY = null;
            let lineText = '';

            for (const item of textContent.items) {
                if (item.str === undefined) continue;

                const y = Math.round(item.transform[5]);

                if (lastY !== null && Math.abs(y - lastY) > 2) {
                    // New line
                    if (lineText.trim()) textParts.push(lineText.trim());
                    lineText = item.str;
                } else {
                    // Same line — add space if there's a gap
                    if (lineText && item.str && !lineText.endsWith(' ') && !item.str.startsWith(' ')) {
                        // Check if there's a significant horizontal gap
                        lineText += ' ' + item.str;
                    } else {
                        lineText += item.str;
                    }
                }
                lastY = y;
            }
            if (lineText.trim()) textParts.push(lineText.trim());
        }

        let text = textParts.join('\n');
        return this._cleanText(text);
    },

    /**
     * Basic fallback extraction (tries to find text in raw PDF data)
     */
    _extractBasic(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        let raw = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            raw += String.fromCharCode.apply(null, chunk);
        }

        const texts = [];
        // Extract Tj operators
        const tjPattern = /\(([^\\)]{2,})\)\s*Tj/g;
        let match;
        while ((match = tjPattern.exec(raw)) !== null) {
            texts.push(match[1]);
        }

        // Extract TJ array operators
        const tjArrayPattern = /\[([^\]]*)\]\s*TJ/gi;
        while ((match = tjArrayPattern.exec(raw)) !== null) {
            const parts = match[1].match(/\(([^)]*)\)/g) || [];
            const line = parts.map(p => {
                const t = p.match(/\(([^)]*)\)/);
                return t ? t[1] : '';
            }).join('');
            if (line.trim()) texts.push(line.trim());
        }

        return this._cleanText(texts.join('\n'));
    },

    /**
     * Clean extracted text
     */
    _cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\u00e2\u0080\u0099/g, "'")
            .replace(/\u00e2\u0080\u0094/g, "—")
            .replace(/\u00e2\u0080\u0093/g, "–")
            .replace(/\u00e2\u0080\u009c/g, '"')
            .replace(/\u00e2\u0080\u009d/g, '"')
            .replace(/\u00e2\u0080\u00a2/g, '•')
            .replace(/\u00c3\u00a9/g, 'é')
            .replace(/\u00c2\u00b7/g, '·')
            .replace(/â€™/g, "'")
            .replace(/â€"/g, "—")
            .replace(/â€œ/g, '"')
            .replace(/â€\x9D/g, '"')
            .replace(/â€¢/g, '•')
            .replace(/â€"/g, '–')
            .replace(/\0/g, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
};
