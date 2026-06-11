const { body } = require('express-validator');

const canvasConnectSchema = [
    body('icalUrl')
        .trim()
        .notEmpty()
        .withMessage('Canvas Calendar Link is required')
        .isURL({ protocols: ['https'], require_protocol: true })
        .withMessage('Invalid URL format')
        .custom((v) => v.includes('/feeds/calendars/'))
        .withMessage('Invalid link. Be sure it comes from your Canvas Calendar Feed.'),
];

module.exports = {
    canvasConnectSchema,
};
