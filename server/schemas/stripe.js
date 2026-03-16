const { body } = require('express-validator');

const createCheckoutSchema = [
    body('priceId')
        .trim()
        .notEmpty()
        .withMessage('Price ID is required')
        .isLength({ max: 100 })
        .withMessage('Invalid price ID'),
];

module.exports = {
    createCheckoutSchema,
};
