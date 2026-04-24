/**
 * Status Renderer Module
 * Renders status messages and notifications in the UI
 */

const STATUS_ICONS = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

/**
 * Render a status message in a dedicated status area
 * @param {HTMLElement} statusElement - DOM element to render status in
 * @param {string} type - Status type: 'success', 'error', 'warning', 'info'
 * @param {string} message - Main status message
 * @param {Object} options - Additional options
 * @param {string} options.detail - Detail message
 * @param {Array<string>} options.items - List of items to display
 * @param {Array<string>} options.warnings - List of warnings to display separately
 */
export function renderStatus(statusElement, type, message, { detail = null, items = [], warnings = [] } = {}) {
    const icon = STATUS_ICONS[type] || STATUS_ICONS.info;
    let html = `<div class="status-bar status-${type}"><span class="status-icon">${icon}</span><div class="status-body"><p>${message}</p>`;

    if (detail) {
        html += `<p>${detail}</p>`;
    }

    if (items.length) {
        html += `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
    }

    html += `</div></div>`;

    if (warnings.length) {
        html += `<div class="status-bar status-warning" style="margin-top:0.375rem">`;
        html += `<span class="status-icon">${STATUS_ICONS.warning}</span>`;
        html += `<div class="status-body"><p>Warnings (${warnings.length}):</p>`;
        html += `<ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul></div></div>`;
    }

    statusElement.innerHTML = html;
}

/**
 * Show an inline error message with auto-hide
 * @param {HTMLElement} element - DOM element to show error in
 * @param {string} message - Error message text
 * @param {number} duration - Duration in milliseconds (0 for permanent)
 */
export function showInlineError(element, message, duration = 4000) {
    if (!element) return;

    element.textContent = message;
    element.classList.add('visible');

    if (duration > 0) {
        setTimeout(() => element.classList.remove('visible'), duration);
    }
}

/**
 * Show an inline success message
 * @param {HTMLElement} element - DOM element to show success in
 * @param {string} message - Success message HTML
 */
export function showInlineSuccess(element, message) {
    if (!element) return;
    element.innerHTML = message;
}

/**
 * Show a loading spinner in an element
 * @param {HTMLElement} element - DOM element to show spinner in
 * @param {string} message - Loading message
 */
export function showLoadingSpinner(element, message = 'Loading...') {
    if (!element) return;
    element.innerHTML = `
        <svg class="animate-spin inline mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
        </svg>${message}
    `;
}

/**
 * Clear status message
 * @param {HTMLElement} element - DOM element to clear
 */
export function clearStatus(element) {
    if (!element) return;
    element.innerHTML = '';
}

/**
 * Create a status message builder for chaining
 * @param {HTMLElement} element - Target DOM element
 * @returns {Object} Status builder with chainable methods
 */
export function createStatusBuilder(element) {
    return {
        success: (msg, opts) => renderStatus(element, 'success', msg, opts),
        error: (msg, opts) => renderStatus(element, 'error', msg, opts),
        warning: (msg, opts) => renderStatus(element, 'warning', msg, opts),
        info: (msg, opts) => renderStatus(element, 'info', msg, opts),
        clear: () => clearStatus(element),
        loading: (msg) => showLoadingSpinner(element, msg)
    };
}
