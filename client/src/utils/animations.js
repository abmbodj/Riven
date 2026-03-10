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

// ─── Animation Presets ───────────────────────────────────────────────────────

/**
 * Staggered reveal for a list of elements.
 * Elements fade in and slide up with organic easing.
 *
 * @param {string} selector - CSS selector within the container
 * @param {object} opts
 */
export function staggerReveal(selector, opts = {}) {
    const {
        y = 24,
        duration = DURATION.slow,
        stagger = STAGGER.normal,
        ease = EASE.reveal,
        delay = 0,
    } = opts;

    return gsap.from(selector, {
        y,
        opacity: 0,
        duration,
        stagger,
        ease,
        delay,
        clearProps: 'transform',
    });
}

/**
 * Fade-slide-up for a single element or group.
 */
export function fadeSlideUp(target, opts = {}) {
    const {
        y = 20,
        duration = DURATION.normal,
        ease = EASE.organic,
        delay = 0,
    } = opts;

    return gsap.from(target, {
        y,
        opacity: 0,
        duration,
        ease,
        delay,
        clearProps: 'transform',
    });
}

/**
 * Scale-in with slight rotation — gives a "landing" feel.
 */
export function scaleIn(target, opts = {}) {
    const {
        scale = 0.9,
        rotate = 2,
        duration = DURATION.slow,
        ease = EASE.spring,
        delay = 0,
    } = opts;

    return gsap.from(target, {
        scale,
        rotate,
        opacity: 0,
        duration,
        ease,
        delay,
        clearProps: 'transform',
    });
}

/**
 * ScrollTrigger-based reveal — fades in + slides up when element enters viewport.
 *
 * @param {string | Element} trigger - the element that triggers the animation
 * @param {string | Element} target - the element(s) to animate (defaults to trigger)
 * @param {object} opts
 */
export function scrollReveal(trigger, target, opts = {}) {
    const {
        y = 30,
        duration = DURATION.slow,
        ease = EASE.reveal,
        start = 'top 85%',
        stagger = 0,
    } = opts;

    return gsap.from(target || trigger, {
        y,
        opacity: 0,
        duration,
        ease,
        stagger,
        scrollTrigger: {
            trigger,
            start,
            toggleActions: 'play none none none',
        },
    });
}

/**
 * Create a page enter timeline.
 * Used by Layout.jsx to animate page content on route change.
 */
export function pageEnterTimeline(container) {
    const tl = gsap.timeline();
    tl.from(container, {
        opacity: 0,
        y: 12,
        duration: DURATION.normal,
        ease: EASE.organic,
        clearProps: 'all',
    });
    return tl;
}

/**
 * Animated counter — smoothly counts from 0 to a target number.
 * Great for stats, progress indicators.
 *
 * @param {Element} el - the DOM element to update
 * @param {number} end - the target number
 * @param {object} opts
 */
export function animateCounter(el, end, opts = {}) {
    const { duration = 1.5, ease = EASE.organic } = opts;
    const obj = { val: 0 };

    return gsap.to(obj, {
        val: end,
        duration,
        ease,
        onUpdate: () => {
            if (el) el.textContent = Math.round(obj.val);
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

/**
 * Card flip animation using GSAP 3D transforms.
 * Returns a timeline that can be played/reversed.
 */
export function createCardFlipTimeline(front, back) {
    const tl = gsap.timeline({ paused: true });

    tl.to(front, {
        rotateY: 180,
        duration: DURATION.slow,
        ease: EASE.snap,
    }, 0)
        .to(back, {
            rotateY: 0,
            duration: DURATION.slow,
            ease: EASE.snap,
        }, 0);

    return tl;
}
