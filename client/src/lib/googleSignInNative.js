import { Capacitor } from '@capacitor/core';

let googleSignInModulePromise;
let initPromise;

async function getGoogleSignIn() {
    if (!googleSignInModulePromise) {
        googleSignInModulePromise = import('@capawesome/capacitor-google-sign-in');
    }
    const mod = await googleSignInModulePromise;
    return mod.GoogleSignIn;
}

/**
 * Runs the Capacitor Google Sign-In flow and returns a Google ID token for Supabase signInWithIdToken.
 * Only for native shells; web should use the Supabase OAuth redirect flow.
 */
export async function signInWithNativeGoogle() {
    if (!Capacitor.isNativePlatform()) {
        throw new Error('Native Google Sign-In is only available in the Capacitor app.');
    }

    const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim();
    if (!clientId) {
        throw new Error(
            'Missing VITE_GOOGLE_WEB_CLIENT_ID. Set it to your Google OAuth Web client ID (same as Supabase Auth → Google → Client ID).'
        );
    }

    const GoogleSignIn = await getGoogleSignIn();
    if (!initPromise) {
        initPromise = GoogleSignIn.initialize({ clientId });
    }
    await initPromise;

    const result = await GoogleSignIn.signIn();
    if (!result.idToken) {
        throw new Error('Google Sign-In did not return an ID token.');
    }
    return result.idToken;
}
