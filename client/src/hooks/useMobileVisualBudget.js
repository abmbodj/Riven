import { getVisualBudget, useVisualBudget, VISUAL_BUDGET_CONSTRAINED } from './useVisualBudget';

/**
 * Compatibility wrapper for older call sites.
 * True when the app should use its lighter visual budget: phones/tablets,
 * reduced-motion/data-saver contexts, or low-end desktop hardware.
 */
export function useMobileVisualBudget() {
    return useVisualBudget() === VISUAL_BUDGET_CONSTRAINED;
}

/** For non-React modules (e.g. one-off checks). */
export function getMobileVisualBudget() {
    return getVisualBudget() === VISUAL_BUDGET_CONSTRAINED;
}
