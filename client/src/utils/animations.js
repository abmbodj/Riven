import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins once
gsap.registerPlugin(ScrollTrigger);

// ─── Refined Organic Easing Curves ───────────────────────────────────────────
// Matches the botanical/organic feel of Riven's design language
export const EASE = {
    // Smooth organic movement — like a leaf settling
    organic: 'power2.out',
    // Spring-like overshoot — for elements "landing"
    spring: 'back.out(1.4)',
    // Gentle reveal — for content fading in
    reveal: 'power3.out',
    // Fluid — for transitions that feel natural
    fluid: 'power4.out',
    // Snappy — for interactive feedback (taps, clicks)
    snap: 'power3.inOut',
    // Elastic — for playful elements
    elastic: 'elastic.out(1, 0.5)',
};

// ─── Duration Constants ──────────────────────────────────────────────────────
export const DURATION = {
    fast: 0.2,
    normal: 0.4,
    slow: 0.6,
    reveal: 0.8,
    dramatic: 1.2,
};

// ─── Stagger Presets ─────────────────────────────────────────────────────────
export const STAGGER = {
    tight: 0.04,
    normal: 0.08,
    relaxed: 0.12,
    dramatic: 0.18,
};

/**
 * Animated counter — smoothly counts from 0 to a target number.
 * Great for stats, progress indicators.
 *
 * @param {Element} el - the DOM element to update
 * @param {number} end - the target number
 * @param {object} opts
 */
export function animateCounter(el, end, opts = {}) {
    const {
        duration = 1.5,
        ease = EASE.organic,
        formatter = (value) => Math.round(value),
    } = opts;
    const obj = { val: 0 };

    return gsap.to(obj, {
        val: end,
        duration,
        ease,
        onUpdate: () => {
            if (el) el.textContent = String(formatter(obj.val));
        },
    });
}

/**
 * "Botanical" breathing animation — gentle scale pulse like a living thing.
 * Use for decorative elements, garden visuals.
 */
export function breathe(target, opts = {}) {
    const { scale = 1.03, duration = 4 } = opts;

    return gsap.to(target, {
        scale,
        duration,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
    });
}
