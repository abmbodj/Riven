/**
 * Express-validator middleware for request validation.
 * Use validationResult to check and return 400 with first error message.
 */
const { validationResult } = require('express-validator');

/**
 * Middleware that runs validationResult and returns 400 with first error if invalid.
 * Place after validation chains.
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const first = errors.array({ onlyFirstError: true })[0];
        const message = first?.msg || 'Validation failed';
        return res.status(400).json({ error: message });
    }
    next();
}

module.exports = { handleValidationErrors };
