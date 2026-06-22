/**
 * GSAP motion controller for the garden scene.
 *
 * Drives the shared class-based loops (reveal / sway / drift / breath / twinkle /
 * ripple) and pointer parallax across far/mid/near depth layers. Ported from the
 * legacy Garden component. Honours prefers-reduced-motion (via useGSAP, which
 * bails entirely) and the constrained visual budget (halves animated targets and
 * skips the costly breath/twinkle/ripple loops).
 *
 * The base attribute values are the "beautiful still frame", so when GSAP never
 * runs (reduced motion) the scene simply renders static and correct.
 */

import { useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '../../../hooks/useGSAP';

export function useGardenMotion({ constrained = false, enableParallax = true, size = 'md' }, deps = []) {
    const { container } = useGSAP(({ selector }) => {
        const q = selector;

        const revealTargets = q('.garden-reveal');
        if (revealTargets.length) {
            gsap.fromTo(
                revealTargets,
                { opacity: 0, y: 8, scale: 0.985 },
                {
                    opacity: (_, el) => Number(el.dataset.revealOpacity ?? el.getAttribute('opacity') ?? 1),
                    y: 0,
                    scale: 1,
                    duration: 1.35,
                    ease: 'power2.out',
                    stagger: 0.05,
                },
            );
        }

        const swayEls = q('.garden-sway');
        const swayTargets = constrained ? swayEls.filter((_, i) => i % 2 === 0) : swayEls;
        swayTargets.forEach((el) => {
            gsap.to(el, {
                rotate: Number(el.dataset.rotate ?? 0.5),
                duration: Number(el.dataset.duration ?? 12),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                transformOrigin: el.dataset.origin ?? 'center bottom',
            });
        });

        const driftEls = q('.garden-drift');
        const driftTargets = constrained ? driftEls.filter((_, i) => i % 2 === 0) : driftEls;
        driftTargets.forEach((el, i) => {
            gsap.to(el, {
                x: Number(el.dataset.x ?? 0),
                y: Number(el.dataset.y ?? -4),
                duration: Number(el.dataset.duration ?? 12) + ((i % 4) * 0.55),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                delay: i * 0.12,
            });
        });

        if (constrained) return;

        q('.garden-breath').forEach((el, i) => {
            const baseOpacity = Number(el.dataset.opacity ?? el.getAttribute('opacity') ?? 1);
            gsap.to(el, {
                scale: 1.02 + ((i % 3) * 0.012),
                opacity: Math.min(1, baseOpacity + (baseOpacity < 0.3 ? 0.06 : 0.03)),
                duration: 4.8 + ((i % 4) * 0.55),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                transformOrigin: el.dataset.origin ?? 'center center',
            });
        });

        q('.garden-twinkle').forEach((el, i) => {
            gsap.to(el, {
                opacity: 0.3 + ((i % 5) * 0.08),
                scale: 0.88 + ((i % 4) * 0.06),
                duration: 3.4 + ((i % 6) * 0.45),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                delay: i * 0.1,
                transformOrigin: el.dataset.origin ?? 'center center',
            });
        });

        q('.garden-ripple').forEach((el, i) => {
            const baseOpacity = Number(el.dataset.opacity ?? el.getAttribute('opacity') ?? 0.24);
            gsap.to(el, {
                scaleX: 1.035 + ((i % 2) * 0.02),
                scaleY: 0.972,
                opacity: baseOpacity + 0.08,
                duration: 5.8 + (i * 0.7),
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1,
                transformOrigin: 'center center',
            });
        });
    }, deps);

    useEffect(() => {
        const node = container.current;
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const pointerQuery = window.matchMedia('(pointer: fine)');

        if (!node || !enableParallax || motionQuery.matches || !pointerQuery.matches || size === 'sm') {
            return undefined;
        }

        const far = Array.from(node.querySelectorAll('[data-parallax="far"]'));
        const mid = Array.from(node.querySelectorAll('[data-parallax="mid"]'));
        const near = Array.from(node.querySelectorAll('[data-parallax="near"]'));
        if (!far.length && !mid.length && !near.length) return undefined;

        const farX = gsap.quickTo(far, 'x', { duration: 1.8, ease: 'power3.out' });
        const farY = gsap.quickTo(far, 'y', { duration: 1.8, ease: 'power3.out' });
        const midX = gsap.quickTo(mid, 'x', { duration: 1.45, ease: 'power3.out' });
        const midY = gsap.quickTo(mid, 'y', { duration: 1.45, ease: 'power3.out' });
        const nearX = gsap.quickTo(near, 'x', { duration: 1.1, ease: 'power3.out' });
        const nearY = gsap.quickTo(near, 'y', { duration: 1.1, ease: 'power3.out' });

        const reset = () => { farX(0); farY(0); midX(0); midY(0); nearX(0); nearY(0); };

        let latestX = 0;
        let latestY = 0;
        let rafPending = false;
        const onMove = (event) => {
            latestX = event.clientX;
            latestY = event.clientY;
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                const rect = node.getBoundingClientRect();
                const xp = ((latestX - rect.left) / rect.width) - 0.5;
                const yp = ((latestY - rect.top) / rect.height) - 0.5;
                farX(xp * 4); farY(yp * 3.5);
                midX(xp * 7); midY(yp * 5.5);
                nearX(xp * 10); nearY(yp * 7);
                rafPending = false;
            });
        };

        node.addEventListener('pointermove', onMove, { passive: true });
        node.addEventListener('pointerleave', reset);
        return () => {
            reset();
            node.removeEventListener('pointermove', onMove);
            node.removeEventListener('pointerleave', reset);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [container, enableParallax, size, ...deps]);

    return { container };
}
