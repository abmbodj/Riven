const { body } = require('express-validator');

const applyReferralSchema = [
    body('code')
        .trim()
        .notEmpty()
        .withMessage('Referral code is required')
        .isLength({ max: 50 })
        .withMessage('Referral code too long'),
];

module.exports = {
    applyReferralSchema,
};
