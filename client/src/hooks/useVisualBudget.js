import { useEffect, useSyncExternalStore } from 'react';
import { subscribeMediaQueryList } from '../utils/matchMediaSubscribe';

export const VISUAL_BUDGET_NORMAL = 'normal';
export const VISUAL_BUDGET_CONSTRAINED = 'constrained';

const MOBILE_MQ = '(max-width: 767px)';
const COARSE_MQ = '(pointer: coarse)';
const REDUCED_MOTION_MQ = '(prefers-reduced-motion: reduce)';
const LOW_FPS_THRESHOLD = 50;
const LOW_FPS_SAMPLE_COUNT = 4;

const subscribers = new Set();
let lowFpsSamples = 0;
let forcedByFps = false;

function emitChange() {
    subscribers.forEach((callback) => callback());
}

function getConnection() {
    if (typeof navigator === 'undefined') return null;
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function getDeviceBudgetSignal() {
    if (typeof window === 'undefined') return false;

    const mobile = window.matchMedia(MOBILE_MQ).matches;
    const coarse = window.matchMedia(COARSE_MQ).matches;
    const reducedMotion = window.matchMedia(REDUCED_MOTION_MQ).matches;
    const lowCoreCount = typeof navigator.hardwareConcurrency === 'number'
        && navigator.hardwareConcurrency <= 4;
    const lowMemory = typeof navigator.deviceMemory === 'number'
        && navigator.deviceMemory <= 4;
    const connection = getConnection();
    const dataSaver = Boolean(connection?.saveData);
    const slowConnection = typeof connection?.effectiveType === 'string'
        && /(^slow-2g$|^2g$)/.test(connection.effectiveType);

    return mobile || coarse || reducedMotion || lowCoreCount || lowMemory || dataSaver || slowConnection;
}

function handleFpsSample(event) {
    const fps = Number(event?.detail?.fps);
    if (!Number.isFinite(fps)) return;

    if (fps < LOW_FPS_THRESHOLD) {
        lowFpsSamples += 1;
    } else {
        lowFpsSamples = Math.max(0, lowFpsSamples - 1);
    }

    const nextForcedByFps = lowFpsSamples >= LOW_FPS_SAMPLE_COUNT;
    if (nextForcedByFps !== forcedByFps) {
        forcedByFps = nextForcedByFps;
        emitChange();
    }
}

function subscribeVisualBudget(callback) {
    subscribers.add(callback);

    const cleanups = [];

    if (typeof window !== 'undefined') {
        const mediaQueries = [
            window.matchMedia(MOBILE_MQ),
            window.matchMedia(COARSE_MQ),
            window.matchMedia(REDUCED_MOTION_MQ),
        ];

        cleanups.push(...mediaQueries.map((query) => subscribeMediaQueryList(query, callback)));
        window.addEventListener('riven:fps-sample', handleFpsSample);
        cleanups.push(() => window.removeEventListener('riven:fps-sample', handleFpsSample));

        const connection = getConnection();
        if (connection?.addEventListener) {
            connection.addEventListener('change', callback);
            cleanups.push(() => connection.removeEventListener('change', callback));
        }
    }

    return () => {
        subscribers.delete(callback);
        cleanups.forEach((cleanup) => cleanup());
    };
}

export function getVisualBudget() {
    return getDeviceBudgetSignal() || forcedByFps
        ? VISUAL_BUDGET_CONSTRAINED
        : VISUAL_BUDGET_NORMAL;
}

export function useVisualBudget() {
    return useSyncExternalStore(subscribeVisualBudget, getVisualBudget, () => VISUAL_BUDGET_NORMAL);
}

export function useIsVisualBudgetConstrained() {
    return useVisualBudget() === VISUAL_BUDGET_CONSTRAINED;
}

export function VisualBudgetRuntime() {
    const visualBudget = useVisualBudget();

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;

        document.documentElement.dataset.visualBudget = visualBudget;
        return () => {
            delete document.documentElement.dataset.visualBudget;
        };
    }, [visualBudget]);

    return null;
}
