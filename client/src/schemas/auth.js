import { z } from 'zod';

/** Aligned with server/schemas/auth.js */
export const registerSchema = z.object({
    username: z
        .string()
        .min(1, 'Username is required')
        .min(2, 'Username must be at least 2 characters')
        .max(30, 'Username must be 30 characters or less')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric and underscores only'),
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email format'),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
    email: z.string().min(1, 'Email or username is required'),
    password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
        .string()
        .min(1, 'New password is required')
        .min(8, 'New password must be at least 8 characters'),
});

export const twoFactorVerifySchema = z.object({
    token: z
        .string()
        .min(1, 'Verification code is required')
        .length(6, 'Code must be 6 digits')
        .regex(/^\d+$/, 'Code must be numeric'),
});
