/* ========================================
   JobHunter AI — PDF Text Extractor
   Pure JS PDF parser for resume text extraction
   No external dependencies needed
   ======================================== */

const PDFExtractor = {

    /**
     * Extract text from a PDF file/blob/arrayBuffer
     * Uses a lightweight approach: decompress streams and extract text operators
     */
    async extractText(fileOrBuffer) {
        let arrayBuffer;

        if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
            arrayBuffer = await fileOrBuffer.arrayBuffer();
        } else if (fileOrBuffer instanceof ArrayBuffer) {
            arrayBuffer = fileOrBuffer;
        } else {
            throw new Error('Expected File, Blob, or ArrayBuffer');
        }

        const bytes = new Uint8Array(arrayBuffer);
        const raw = this.bytesToString(bytes);

        // Strategy 1: Try to extract text from decompressed streams
        let text = await this.extractFromStreams(bytes, raw);

        // Strategy 2: Extract text from non-compressed content
        if (!text || text.trim().length < 50) {
            const simpleText = this.extractSimpleText(raw);
            if (simpleText.length > text.length) text = simpleText;
        }

        // Strategy 3: Extract from TJ/Tj operators in raw data
        if (!text || text.trim().length < 50) {
            const tjText = this.extractTJOperators(raw);
            if (tjText.length > text.length) text = tjText;
        }

        // Clean up the extracted text
        text = this.cleanText(text);

        return text;
    },

    /**
     * Extract text from FlateDecode compressed streams
     */
    async extractFromStreams(bytes, raw) {
        const texts = [];

        // Find all stream...endstream blocks
        const streamRegex = /stream\r?\n/g;
        let match;

        while ((match = streamRegex.exec(raw)) !== null) {
            const streamStart = match.index + match[0].length;
            const endStream = raw.indexOf('endstream', streamStart);
            if (endStream === -1) continue;

            const streamBytes = bytes.slice(streamStart, endStream);

            // Check if this stream is FlateDecode compressed
            // Look backwards for the dictionary
            const dictStart = raw.lastIndexOf('<<', match.index);
            const dictEnd = raw.indexOf('>>', dictStart) + 2;
            const dict = raw.substring(dictStart, dictEnd);

            let decompressed = null;

            if (dict.includes('FlateDecode')) {
                try {
                    decompressed = this.inflate(streamBytes);
                } catch (e) {
                    // Skip streams we can't decompress
                    continue;
                }
            } else if (!dict.includes('/Image') && !dict.includes('/XObject')) {
                // Non-compressed, non-image stream
                decompressed = this.bytesToString(streamBytes);
            }

            if (decompressed) {
                // Extract text operators from the decompressed content
                const text = this.extractTextOperators(decompressed);
                if (text.trim()) texts.push(text);
            }
        }

        return texts.join('\n');
    },

    /**
     * Extract text from PDF text operators (Tj, TJ, ', ")
     */
    extractTextOperators(content) {
        const lines = [];
        let currentLine = '';

        // Match BT...ET blocks (Begin Text...End Text)
        const btBlocks = content.match(/BT[\s\S]*?ET/g) || [];

        for (const block of btBlocks) {
            // Extract Tj operator: (text) Tj
            const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || [];
            for (const tj of tjMatches) {
                const textMatch = tj.match(/\(([^)]*)\)/);
                if (textMatch) {
                    currentLine += this.decodePDFString(textMatch[1]);
                }
            }

            // Extract TJ operator: [(text)(text)] TJ
            const tjArrayMatches = block.match(/\[([^\]]*)\]\s*TJ/gi) || [];
            for (const tja of tjArrayMatches) {
                const arrayContent = tja.match(/\[([^\]]*)\]/);
                if (arrayContent) {
                    const textParts = arrayContent[1].match(/\(([^)]*)\)/g) || [];
                    for (const part of textParts) {
                        const text = part.match(/\(([^)]*)\)/);
                        if (text) {
                            currentLine += this.decodePDFString(text[1]);
                        }
                    }
                    // Check for large negative kerning (indicates space)
                    const numbers = arrayContent[1].match(/-\d{3,}/g) || [];
                    if (numbers.length > 0) {
                        // Large negative number often means word space
                    }
                }
            }

            // Check for Td/TD (text positioning - often indicates new line)
            if (block.match(/\d+[\s.]+\d+\s+(?:Td|TD|T\*)/)) {
                if (currentLine.trim()) {
                    lines.push(currentLine.trim());
                    currentLine = '';
                }
            }

            // ' and " operators also show text
            const quoteMatches = block.match(/\(([^)]*)\)\s*['"]/g) || [];
            for (const qm of quoteMatches) {
                const text = qm.match(/\(([^)]*)\)/);
                if (text) currentLine += this.decodePDFString(text[1]);
            }
        }

        if (currentLine.trim()) lines.push(currentLine.trim());

        // Also try extracting text outside BT/ET for simple PDFs
        if (lines.length === 0) {
            const allTj = content.match(/\(([^)]+)\)\s*Tj/g) || [];
            for (const tj of allTj) {
                const text = tj.match(/\(([^)]*)\)/);
                if (text) lines.push(this.decodePDFString(text[1]));
            }
        }

        return lines.join('\n');
    },

    /**
     * Simple text extraction for non-compressed PDFs
     */
    extractSimpleText(raw) {
        const texts = [];
        const pattern = /\(([^\\)]{2,})\)\s*Tj/g;
        let match;
        while ((match = pattern.exec(raw)) !== null) {
            texts.push(this.decodePDFString(match[1]));
        }
        return texts.join(' ');
    },

    /**
     * Extract TJ array operators
     */
    extractTJOperators(raw) {
        const texts = [];
        const pattern = /\[([^\]]*)\]\s*TJ/gi;
        let match;
        while ((match = pattern.exec(raw)) !== null) {
            const parts = match[1].match(/\(([^)]*)\)/g) || [];
            const line = parts.map(p => {
                const t = p.match(/\(([^)]*)\)/);
                return t ? this.decodePDFString(t[1]) : '';
            }).join('');
            if (line.trim()) texts.push(line.trim());
        }
        return texts.join('\n');
    },

    /**
     * Decode PDF escaped strings
     */
    decodePDFString(str) {
        return str
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\')
            .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    },

    /**
     * Inflate (decompress) FlateDecode data using DecompressionStream
     */
    async inflate(bytes) {
        // Try using the native DecompressionStream API
        try {
            // Skip zlib header if present (first 2 bytes)
            let data = bytes;
            if (bytes.length > 2 && (bytes[0] === 0x78)) {
                // Has zlib header, use raw deflate by stripping the 2-byte header
                // Actually DecompressionStream('deflate') handles zlib format
            }

            const ds = new DecompressionStream('deflate');
            const writer = ds.writable.getWriter();
            const reader = ds.readable.getReader();

            // Write data
            writer.write(data);
            writer.close();

            // Read decompressed data
            const chunks = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }

            // Combine chunks
            const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
            const result = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                result.set(chunk, offset);
                offset += chunk.length;
            }

            return this.bytesToString(result);
        } catch (e) {
            // Fallback: try raw deflate
            try {
                const ds = new DecompressionStream('raw');
                const writer = ds.writable.getWriter();
                const reader = ds.readable.getReader();
                writer.write(bytes.slice(2)); // Skip zlib header
                writer.close();

                const chunks = [];
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }

                const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
                const result = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                    result.set(chunk, offset);
                    offset += chunk.length;
                }

                return this.bytesToString(result);
            } catch (e2) {
                throw new Error('Decompression failed');
            }
        }
    },

    /**
     * Convert byte array to string
     */
    bytesToString(bytes) {
        let result = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            result += String.fromCharCode.apply(null, chunk);
        }
        return result;
    },

    /**
     * Clean extracted text
     */
    cleanText(text) {
        return text
            // Fix common encoding issues
            .replace(/â€™/g, "'")
            .replace(/â€"/g, "—")
            .replace(/â€œ/g, '"')
            .replace(/â€\x9D/g, '"')
            .replace(/â€¢/g, '•')
            .replace(/â€"/g, '–')
            .replace(/Ã©/g, 'é')
            .replace(/Â·/g, '·')
            // Remove null chars
            .replace(/\0/g, '')
            // Normalize whitespace
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
};
