import { z } from 'zod/v3';

/** Aligned with server validation limits */
export const deckTitleSchema = z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less');

export const classNameSchema = z
    .string()
    .min(1, 'Class name is required')
    .max(200, 'Class name must be 200 characters or less');

export const folderNameSchema = z
    .string()
    .min(1, 'Folder name is required')
    .max(200, 'Folder name must be 200 characters or less');

export const tagNameSchema = z
    .string()
    .min(1, 'Tag name is required')
    .max(100, 'Tag name must be 100 characters or less');

export const assignmentTitleSchema = z
    .string()
    .min(1, 'Assignment title is required')
    .max(500, 'Assignment title must be 500 characters or less');

export const joinCodeSchema = z
    .string()
    .min(1, 'Join code is required')
    .max(20, 'Join code too long');

export const referralCodeSchema = z
    .string()
    .min(1, 'Referral code is required')
    .max(50, 'Referral code too long');

export const groupNameSchema = z
    .string()
    .min(1, 'Group name is required')
    .max(200, 'Group name must be 200 characters or less');

export const messageTitleSchema = z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be under 100 characters');

export const messageContentSchema = z
    .string()
    .min(1, 'Content is required')
    .max(1000, 'Content must be under 1000 characters');

export const feedbackContentSchema = z
    .string()
    .min(1, 'Feedback cannot be empty')
    .max(1000, 'Feedback must be under 1000 characters');

export const fileNameSchema = z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name too long');

export const usernameSchema = z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric and underscores only');

export const displayNameSchema = z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name too long');

export const bioSchema = z
    .string()
    .min(1, 'Bio cannot be completely empty')
    .max(500, 'Bio must be 500 characters or less');

export const themeNameSchema = z
    .string()
    .min(1, 'Theme name is required')
    .max(100, 'Theme name too long');

/** Canvas LMS calendar feed URL - must be from Canvas Calendar Feed */
export const canvasIcalUrlSchema = z
    .string()
    .min(1, 'Canvas Calendar Link is required')
    .url('Invalid URL format')
    .refine((v) => v.includes('/feeds/calendars/'), {
        message: 'Invalid link. Be sure it comes from your Canvas Calendar Feed.',
    });

export const classifyCanvasIcalUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return 'empty';

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        return 'non_canvas_url';
    }

    const normalized = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    const isCanvasLike = normalized.includes('canvas');
    const hasFeedPath = parsed.pathname.toLowerCase().includes('/feeds/calendars/');
    const hasIcsSuffix = /\.ics($|[?#])/i.test(trimmed);

    if (hasFeedPath && !hasIcsSuffix) return 'missing_ics_suffix';
    if (isCanvasLike && !hasFeedPath) return 'missing_feed_path';
    if (!isCanvasLike) return 'non_canvas_url';
    return 'valid';
};

export const getCanvasIcalValidationHint = (value) => {
    switch (classifyCanvasIcalUrl(value)) {
        case 'missing_feed_path':
            return 'This looks like a Canvas page URL, not the Calendar Feed link. Check Step 2 above.';
        case 'missing_ics_suffix':
            return 'Make sure you copied the full link — it should end in .ics';
        case 'non_canvas_url':
            return 'This doesn\'t look like a Canvas link. The URL should come from your Canvas Calendar page.';
        default:
            return null;
    }
};
