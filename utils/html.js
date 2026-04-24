/**
 * HTML Generation Utilities
 * Provides component-based HTML generation for common UI patterns
 */

/**
 * Creates a basic HTML element with attributes and content
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Object of attribute key-value pairs
 * @param {string|HTMLElement} content - Inner content (string or element)
 * @returns {HTMLElement}
 */
export function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value);
        }
    });

    if (content) {
        if (typeof content === 'string') {
            element.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            element.appendChild(content);
        }
    }

    return element;
}

/**
 * Creates an HTML table with header and body rows
 * @param {string[]} headers - Array of header strings
 * @param {string[][]} rows - Array of row arrays (each containing cell strings)
 * @param {Object} options - Table options (className, etc.)
 * @returns {HTMLElement}
 */
export function createTable(headers, rows, options = {}) {
    const table = createElement('table', {
        className: `odds-table ${options.className || ''}`.trim()
    });

    // Create thead
    const thead = createElement('thead');
    const headerRow = createElement('tr');
    headers.forEach(header => {
        const th = createElement('th', {}, header);
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create tbody
    const tbody = createElement('tbody');
    rows.forEach(rowData => {
        const row = createElement('tr');
        rowData.forEach(cellData => {
            const td = createElement('td', {}, cellData);
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    return table;
}

/**
 * Creates a table row with cells
 * @param {string[]} cells - Array of cell content
 * @param {Object} options - Row options
 * @returns {HTMLElement}
 */
export function createTableRow(cells, options = {}) {
    const row = createElement('tr', options);
    cells.forEach(cellContent => {
        const td = createElement('td', {}, cellContent);
        row.appendChild(td);
    });
    return row;
}

/**
 * Creates a section with title and content
 * @param {string} title - Section title
 * @param {HTMLElement|string} content - Section content
 * @param {Object} options - Section options
 * @returns {HTMLElement}
 */
export function createSection(title, content, options = {}) {
    const section = createElement('div', {
        className: options.className || 'mb-6'
    });

    const titleEl = createElement('h3', {
        className: 'text-base font-semibold text-gray-700 mb-2'
    }, title);
    section.appendChild(titleEl);

    if (content) {
        if (typeof content === 'string') {
            const contentDiv = createElement('div', {}, content);
            section.appendChild(contentDiv);
        } else {
            section.appendChild(content);
        }
    }

    return section;
}

/**
 * Creates a table wrapper with overflow handling
 * @param {HTMLElement} table - The table element
 * @param {Object} options - Wrapper options
 * @returns {HTMLElement}
 */
export function createTableWrapper(table, options = {}) {
    const wrapper = createElement('div', {
        className: options.className || 'overflow-x-auto'
    });
    wrapper.appendChild(table);
    return wrapper;
}

/**
 * Creates a status message element
 * @param {string} type - Status type (success, error, warning, info)
 * @param {string} message - Status message
 * @param {Object} options - Additional options
 * @returns {HTMLElement}
 */
export function createStatusElement(type, message, options = {}) {
    const classMap = {
        success: 'text-green-500',
        error: 'text-red-500',
        warning: 'text-amber-500',
        info: 'text-blue-500'
    };

    const className = `${classMap[type] || 'text-gray-500'} ${options.className || ''}`.trim();
    return createElement('span', { className }, message);
}

/**
 * Formats a number to a fixed decimal places
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
export function formatNumber(value, decimals = 3) {
    if (isNaN(value)) return '—';
    return value.toFixed(decimals);
}

/**
 * Creates a team lambda view table (specific to lambda view component)
 * @param {Array} teamStats - Array of team statistics
 * @returns {HTMLElement}
 */
export function createTeamLambdaTable(teamStats) {
    const headers = ['Group', 'Team', 'Matches', 'xPts Sum', 'Lambda For Sum', 'Lambda Against Sum', 'Net Lambda Sum'];
    const rows = teamStats.map(({ group, team, matches, xPts, lambdaFor, lambdaAgainst }) => [
        group,
        `<span class="font-medium">${team}</span>`,
        matches.toString(),
        formatNumber(xPts),
        formatNumber(lambdaFor),
        formatNumber(lambdaAgainst),
        formatNumber(lambdaFor - lambdaAgainst)
    ]);

    const table = createTable(headers, rows, { className: 'text-xs sm:text-sm' });
    return createTableWrapper(table);
}

/**
 * Creates a match lambda view table (specific to lambda view component)
 * @param {Array} matches - Array of match data
 * @returns {HTMLElement}
 */
export function createMatchLambdaTable(matches) {
    const headers = ['Group', 'Line', 'Team 1', 'Team 2', 'Team 1 xPts', 'Team 2 xPts', 'Lambda 1', 'Lambda 2', 'Total', 'Supremacy', 'ρ'];
    const rows = matches.map(match => [
        match.group,
        match.lineNum.toString(),
        `<span class="font-medium">${match.team1}</span>`,
        `<span class="font-medium">${match.team2}</span>`,
        formatNumber((3 * match.p1) + match.px),
        formatNumber((3 * match.p2) + match.px),
        formatNumber(match.lambda1),
        formatNumber(match.lambda2),
        formatNumber(match.lambda1 + match.lambda2),
        formatNumber(match.lambda1 - match.lambda2),
        match.matchRho != null ? formatNumber(match.matchRho) : '—'
    ]);

    const table = createTable(headers, rows, { className: 'text-xs sm:text-sm' });
    return createTableWrapper(table);
}