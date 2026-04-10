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
