const { body, param } = require('express-validator');

const updateUserRoleSchema = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Invalid user ID'),
    body('role')
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['user', 'admin', 'friends'])
        .withMessage('Role must be user, admin, or friends'),
];

const createMessageSchema = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ max: 100 })
        .withMessage('Title must be under 100 characters'),
    body('content')
        .trim()
        .notEmpty()
        .withMessage('Content is required')
        .isLength({ max: 1000 })
        .withMessage('Content must be under 1000 characters'),
];

module.exports = {
    updateUserRoleSchema,
    createMessageSchema,
};
