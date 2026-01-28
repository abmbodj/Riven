/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - User input string
 * @returns {string} - Sanitized string
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Validate that input is not empty after trimming
 * @param {string} input - User input string
 * @returns {boolean}
 */
export function isValidInput(input) {
    return typeof input === 'string' && input.trim().length > 0;
}

/**
 * Truncate string to max length
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
export function truncate(str, maxLength = 500) {
    if (typeof str !== 'string') return '';
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
}

/**
 * Validate deck title (1-100 chars)
 * @param {string} title
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDeckTitle(title) {
    if (!title || !title.trim()) {
        return { valid: false, error: 'Title is required' };
    }
    if (title.trim().length > 100) {
        return { valid: false, error: 'Title must be 100 characters or less' };
    }
    return { valid: true };
}

/**
 * Validate card content (1-2000 chars)
 * @param {string} content
 * @param {string} field - 'front' or 'back'
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCardContent(content, field = 'Content') {
    if (!content || !content.trim()) {
        return { valid: false, error: `${field} is required` };
    }
    if (content.trim().length > 2000) {
        return { valid: false, error: `${field} must be 2000 characters or less` };
    }
    return { valid: true };
}
