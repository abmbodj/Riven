const { body } = require('express-validator');

const registerSchema = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required')
        .isLength({ min: 2, max: 30 })
        .withMessage('Username must be 2-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username must be alphanumeric and underscores only'),
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
    body('captchaToken')
        .optional()
        .isString()
        .withMessage('Invalid CAPTCHA token'),
];

const loginSchema = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email or username is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

const forgotPasswordSchema = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email format')
        .normalizeEmail(),
];

const resetPasswordSchema = [
    body('token')
        .notEmpty()
        .withMessage('Token is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
];

const verifyEmailSchema = [
    body('token')
        .notEmpty()
        .withMessage('Token is required'),
];

const changePasswordSchema = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters'),
];

const twoFactorVerifySchema = [
    body('token')
        .notEmpty()
        .withMessage('Verification code is required')
        .custom((v) => {
            const s = String(v).trim();
            return s.length === 6 && /^\d+$/.test(s);
        })
        .withMessage('Code must be 6 digits'),
];

module.exports = {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    twoFactorVerifySchema,
};
