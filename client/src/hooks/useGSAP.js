import { useRef, useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';

// Use useLayoutEffect on client, useEffect during SSR
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * GSAP context hook — ties animations to a React component lifecycle.
 * All GSAP calls inside the callback are automatically cleaned up on unmount.
 *
 * @param {Function} callback - receives (ctx) => { ... } where you write gsap code
 * @param {Array} deps - dependency array (like useEffect)
 * @returns {{ container: React.RefObject, tl: React.MutableRefObject }}
 */
export function useGSAP(callback, deps = []) {
    const container = useRef(null);
    const ctx = useRef(null);

    useIsomorphicLayoutEffect(() => {
        // Respect prefers-reduced-motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        ctx.current = gsap.context(() => {
            callback(ctx.current);
        }, container.current);

        return () => {
            ctx.current?.revert();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { container };
}

/**
 * Simplified hook that runs a GSAP animation on mount.
 * Returns a ref to attach to the container element.
 */
export function useGSAPOnMount(callback) {
    return useGSAP(callback, []);
}
