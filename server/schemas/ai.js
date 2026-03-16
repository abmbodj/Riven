const { body } = require('express-validator');

const generateDeckSchema = [
    body('notes')
        .optional()
        .custom((v) => v === undefined || v === null || typeof v === 'string')
        .withMessage('Notes must be a string'),
    body('file')
        .optional()
        .custom((v) => v === undefined || v === null || (typeof v === 'object' && v.data && v.mimeType))
        .withMessage('File must have data and mimeType'),
    body()
        .custom((_, { req }) => {
            const notes = req.body?.notes;
            const file = req.body?.file;
            const hasNotes = notes && typeof notes === 'string' && notes.trim() !== '';
            const hasFile = file && file.data && file.mimeType;
            return hasNotes || hasFile;
        })
        .withMessage('Notes or file is required'),
    body('deckName')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Deck name must be 200 characters or less'),
];

const generateClassSchema = [
    body('notes')
        .optional()
        .custom((v) => v === undefined || v === null || typeof v === 'string')
        .withMessage('Notes must be a string'),
    body('file')
        .optional()
        .custom((v) => v === undefined || v === null || (typeof v === 'object' && v.data && v.mimeType))
        .withMessage('File must have data and mimeType'),
    body()
        .custom((_, { req }) => {
            const notes = req.body?.notes;
            const file = req.body?.file;
            const hasNotes = notes && typeof notes === 'string' && notes.trim() !== '';
            const hasFile = file && file.data && file.mimeType;
            return hasNotes || hasFile;
        })
        .withMessage('Notes or file is required'),
    body('className')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Class name must be 200 characters or less'),
];

module.exports = {
    generateDeckSchema,
    generateClassSchema,
};
