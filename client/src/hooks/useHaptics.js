// Native-like haptic feedback for PWA
// Uses Vibration API where available

export function useHaptics() {
    const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

    const light = () => {
        if (canVibrate) {
            navigator.vibrate(10);
        }
    };

    const medium = () => {
        if (canVibrate) {
            navigator.vibrate(20);
        }
    };

    const heavy = () => {
        if (canVibrate) {
            navigator.vibrate(30);
        }
    };

    const success = () => {
        if (canVibrate) {
            navigator.vibrate([10, 50, 10]);
        }
    };

    const error = () => {
        if (canVibrate) {
            navigator.vibrate([30, 50, 30, 50, 30]);
        }
    };

    const selection = () => {
        if (canVibrate) {
            navigator.vibrate(5);
        }
    };

    return {
        light,
        medium,
        heavy,
        success,
        error,
        selection,
        canVibrate
    };
}

export default useHaptics;
