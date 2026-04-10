import { Capacitor } from '@capacitor/core';
import { AppleSignIn, SignInScope } from '@capawesome/capacitor-apple-sign-in';

const NONCE_LENGTH = 32;
const NONCE_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const normalizeNamePart = (value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed || null;
};

const createRawNonce = () => {
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('Apple Sign-In requires secure random values for nonce generation.');
    }

    const bytes = new Uint8Array(NONCE_LENGTH);
    globalThis.crypto.getRandomValues(bytes);

    let nonce = '';
    for (const byte of bytes) {
        nonce += NONCE_CHARSET[byte % NONCE_CHARSET.length];
    }
    return nonce;
};

const buildLegacyAppleUser = (givenName, familyName) => {
    if (!givenName && !familyName) {
        return null;
    }

    return {
        name: {
            ...(givenName ? { firstName: givenName } : {}),
            ...(familyName ? { lastName: familyName } : {}),
        },
    };
};

function normalizeNativeAppleUser(result) {
    const givenName = normalizeNamePart(result?.givenName);
    const familyName = normalizeNamePart(result?.familyName);
    const fullName = [givenName, familyName].filter(Boolean).join(' ') || null;

    return {
        id: typeof result?.user === 'string' && result.user.trim() ? result.user.trim() : null,
        email: typeof result?.email === 'string' && result.email.trim() ? result.email.trim() : null,
        givenName,
        familyName,
        fullName,
        ...buildLegacyAppleUser(givenName, familyName),
    };
}

/**
 * Runs the native Apple sign-in flow on iOS and returns the ID token plus the raw nonce
 * we must send back to Supabase for replay protection validation.
 */
export async function signInWithNativeApple() {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
        throw new Error('Native Apple Sign-In is only available in the Capacitor iOS app.');
    }

    const rawNonce = createRawNonce();
    const result = await AppleSignIn.signIn({
        scopes: [SignInScope.Email, SignInScope.FullName],
        nonce: rawNonce,
    });

    if (!result.idToken) {
        throw new Error('Apple Sign-In did not return an ID token.');
    }

    return {
        identityToken: result.idToken,
        rawNonce,
        user: normalizeNativeAppleUser(result),
    };
}
