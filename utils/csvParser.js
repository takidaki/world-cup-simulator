/**
 * CSV Parsing and Generation Utilities
 */

/**
 * Parses a single line of delimited data, handling quotes.
 * @param {string} line 
 * @param {string} delimiter 
 * @returns {string[]}
 */
export function parseDelimitedLine(line, delimiter) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    fields.push(current.trim());
    return fields;
}

/**
 * Detects the delimiter and splits the line.
 * @param {string} line 
 * @returns {string[]|null}
 */
export function getDelimitedParts(line) {
    if (line.includes('\t')) return parseDelimitedLine(line, '\t');
    if (line.includes(';')) return parseDelimitedLine(line, ';');
    if (line.includes(',')) return parseDelimitedLine(line, ',');
    return null;
}

/**
 * Normalizes line breaks from pasted content.
 * @param {string} raw 
 * @returns {string}
 */
export function normalizePastedLineBreaks(raw) {
    return raw.replace(/\\r\\n|\\n|\\r/g, '\n');
}

/**
 * Normalizes escaped newlines in strings.
 * @param {string} raw 
 * @returns {string}
 */
export function normalizeEscapedNewlines(raw) {
    return String(raw || '')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\n');
}

/**
 * Checks if parts look like a CSV odds header.
 * @param {string[]} parts 
 * @returns {boolean}
 */
export function isLikelyOddsHeader(parts) {
    const normalized = parts.map(p => String(p).trim().toUpperCase());
    return normalized.length >= 8
        && normalized[0] === 'GROUP'
        && normalized.includes('TEAM_A')
        && normalized.includes('TEAM_B')
        && normalized.includes('ODD1')
        && normalized.includes('ODDX')
        && normalized.includes('ODD2');
}

/**
 * Escapes a value for CSV.
 * @param {any} value 
 * @returns {string}
 */
export function csvEscape(value) {
    const stringValue = value === undefined || value === null ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
}

/**
 * Builds a semicolon-delimited CSV row.
 * @param {any[]} cells 
 * @returns {string}
 */
export function buildCsvRow(cells) {
    return cells.map(csvEscape).join(';') + '\n';
}

/**
 * Gets current date and time for CSV exports.
 * @returns {{date: string, time: string}}
 */
export function getCsvExportDateTime() {
    const now = new Date();
    const date = `${now.getUTCDate()}.${now.getUTCMonth() + 1}.${now.getUTCFullYear()}`;
    const time = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    return { date, time };
}
