/**
 * Shared Zod schemas for Edge Function request validation.
 * Import from: https://deno.land/x/zod
 */

import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

export const referralCodeSchema = z
  .string()
  .min(1, 'Referral code is required')
  .max(50, 'Referral code too long')
  .transform((s) => s.trim().toUpperCase());

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(200, 'Group name must be 200 characters or less'),
  class_id: z.union([z.string().uuid(), z.number().int().positive(), z.null()]).optional(),
});

export const joinGroupSchema = z.object({
  join_code: z.string().min(1, 'Join code is required').max(20, 'Join code too long'),
});

export const priceIdSchema = z.object({
  priceId: z.string().min(1, 'priceId is required'),
});

export const canvasConnectSchema = z.object({
  icalUrl: z
    .string()
    .min(1, 'Canvas Calendar Link is required')
    .url('Invalid URL format')
    .refine((v) => v.includes('/feeds/calendars/'), {
      message: 'Invalid link. Be sure it comes from your Canvas Calendar Feed.',
    }),
});

export const canvasAutoSyncSchema = z.object({
  enabled: z.boolean(),
});

export const canvasSemesterArchiveSchema = z.object({
  classIds: z.array(z.string().uuid()).min(1, 'Select at least one class to archive.').max(100),
});

export const canvasSemesterRestoreSchema = z.object({
  classId: z.string().uuid('Invalid class id.'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const completeRegistrationSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(30, 'Username must be 30 characters or less')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric and underscores only'),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
export type CanvasConnectInput = z.infer<typeof canvasConnectSchema>;
export type CanvasAutoSyncInput = z.infer<typeof canvasAutoSyncSchema>;
export type CanvasSemesterArchiveInput = z.infer<typeof canvasSemesterArchiveSchema>;
export type CanvasSemesterRestoreInput = z.infer<typeof canvasSemesterRestoreSchema>;
