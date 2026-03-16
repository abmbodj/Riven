const { body, param } = require('express-validator');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createGroupSchema = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Group name is required')
        .isLength({ max: 200 })
        .withMessage('Group name must be 200 characters or less'),
    body('class_id')
        .optional()
        .custom((v) => v === null || v === undefined || (typeof v === 'string' && uuidRegex.test(v)) || (typeof v === 'number' && Number.isInteger(v)))
        .withMessage('Invalid class_id'),
];

const joinGroupSchema = [
    body('join_code')
        .trim()
        .notEmpty()
        .withMessage('Join code is required')
        .isLength({ max: 20 })
        .withMessage('Join code too long'),
];

const updateGroupSchema = [
    param('id')
        .matches(uuidRegex)
        .withMessage('Invalid group ID'),
    body('name')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Group name must be 200 characters or less'),
    body('class_id')
        .optional()
        .custom((v) => v === null || v === undefined || (typeof v === 'string' && uuidRegex.test(v)))
        .withMessage('Invalid class_id'),
];

const groupIdParamSchema = [
    param('id')
        .matches(uuidRegex)
        .withMessage('Invalid group ID'),
];

const shareDeckSchema = [
    param('id')
        .matches(uuidRegex)
        .withMessage('Invalid group ID'),
    body('deck_id')
        .notEmpty()
        .withMessage('Deck ID is required')
        .custom((v) => {
            const n = parseInt(v, 10);
            return Number.isInteger(n) && n >= 1;
        })
        .withMessage('Deck ID must be a positive integer'),
];

const createFolderSchema = [
    param('id')
        .matches(uuidRegex)
        .withMessage('Invalid group ID'),
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Folder name is required')
        .isLength({ max: 200 })
        .withMessage('Folder name must be 200 characters or less'),
];

const createFileSchema = [
    param('id')
        .matches(uuidRegex)
        .withMessage('Invalid group ID'),
    body('name')
        .trim()
        .notEmpty()
        .withMessage('File name is required')
        .isLength({ max: 255 })
        .withMessage('File name too long'),
    body('file_url')
        .trim()
        .notEmpty()
        .withMessage('File URL is required')
        .isURL()
        .withMessage('Invalid file URL'),
    body('file_type')
        .trim()
        .notEmpty()
        .withMessage('File type is required')
        .isLength({ max: 100 })
        .withMessage('File type too long'),
];

const memberIdParamSchema = [
    param('id')
        .matches(uuidRegex)
        .withMessage('Invalid group ID'),
    param('userId')
        .isInt({ min: 1 })
        .withMessage('Invalid user ID'),
];

module.exports = {
    createGroupSchema,
    joinGroupSchema,
    updateGroupSchema,
    groupIdParamSchema,
    shareDeckSchema,
    createFolderSchema,
    createFileSchema,
    memberIdParamSchema,
};
