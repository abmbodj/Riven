# Theme and Dark Mode Fixes

> **Status:** Planned | **Priority:** High | **Alpha-Critical:** Yes | **Effort:** S (1-2 days)

## Summary

Dark mode text visibility issues exist across some themes. The theme system is powerful (6 CSS custom properties, dynamic `color-scheme` detection, custom theme editor) but lacks contrast validation — users can create themes where text is unreadable. This is a trust-breaking bug that must be fixed before alpha.

## Current State Audit

### How Theming Works

**`client/src/ThemeContext.jsx`:**
- `applyTheme(theme)` sets 6 CSS vars on `document.documentElement`:
  - `--bg-color`, `--surface-color`, `--text-color`
  - `--secondary-text-color`, `--border-color`, `--accent-color`
- Also sets `--font-display` and `--font-body`
- `resolveColorScheme()` calculates luminance of `--bg-color`:
  - Luminance > 0.58 -> `color-scheme: light`
  - Luminance <= 0.58 -> `color-scheme: dark`
- Updates `<meta name="theme-color">` for browser chrome

**`client/tailwind.config.js`:**
- `claude-bg`, `claude-surface`, `claude-text`, `claude-secondary`, `claude-border`, `claude-accent` map to CSS vars

**Default theme (`:root` in `client/src/index.css`):**
- bg: `#162a31` (dark teal) — luminance ~0.03
- text: `#e4ddd0` (warm parchment) — luminance ~0.73
- secondary: lighter parchment
- accent: `#deb96a` (gold)

**Foundation themes (5):** Riven (dark), Riven Light, Tech Innovation, Arctic Frost, Modern Minimal

### Known Issues

1. **Custom themes with low text-bg contrast** — theme editor allows any hex value with no validation
2. **Surface color too close to bg** — some themes have surface and bg nearly identical, making cards invisible
3. **Border invisible in light themes** — `border-claude-border` can be too faint
4. **Secondary text unreadable** — `--secondary-text-color` may be too muted against dark backgrounds
5. **Accent on bg contrast** — `text-claude-accent` buttons may be unreadable on certain bg colors

## Fixes

### Fix 1: Contrast Validation Utility

**New file:** `client/src/utils/colorContrast.js`

```js
/**
 * Convert hex to RGB
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate relative luminance (WCAG 2.1)
 */
export function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio like 4.5, 7.0, etc.
 */
export function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if two colors have minimum ΔL* difference
 */
export function lightnessDifference(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  return Math.abs(l1 - l2);
}
```

### Fix 2: Theme Editor Validation Warnings

**File:** `client/src/components/themes/ThemeEditorModal.jsx`

Add inline warnings (not blocking — preserve designer autonomy) when:

| Check | Threshold | Warning Message |
|---|---|---|
| Text vs bg contrast | < 4.5:1 | "Low contrast — text may be hard to read" |
| Secondary vs bg contrast | < 3:1 | "Secondary text may be invisible" |
| Surface vs bg lightness | < 0.05 ΔL | "Cards may blend into background" |
| Border vs bg contrast | < 1.3:1 | "Borders may be invisible" |
| Accent vs bg contrast | < 3:1 | "Accent color may not stand out" |

**Warning UI:**
- Small `AlertTriangle` icon (Lucide) + text below the color input
- Color: `text-yellow-400/80 text-[10px] font-mono`
- Only shown when threshold is violated
- Non-blocking: user can save the theme anyway

### Fix 3: Foundation Theme Audit

Audit all 5 foundation themes against WCAG AA:

| Theme | Text:BG | Secondary:BG | Surface:BG | Border:BG | Status |
|---|---|---|---|---|---|
| Riven (dark) | Audit | Audit | Audit | Audit | — |
| Riven Light | Audit | Audit | Audit | Audit | — |
| Tech Innovation | Audit | Audit | Audit | Audit | — |
| Arctic Frost | Audit | Audit | Audit | Audit | — |
| Modern Minimal | Audit | Audit | Audit | Audit | — |

Fix any foundation theme that fails contrast checks. These are Riven-controlled and should be perfect.

### Fix 4: Automatic Color Scheme Detection Fix

**File:** `client/src/ThemeContext.jsx`

Current `resolveColorScheme()` threshold is 0.58. Verify this works correctly:
- Light themes should get `color-scheme: light` (affects scrollbar, form controls)
- Dark themes should get `color-scheme: dark`
- Test edge cases: medium-gray backgrounds near the threshold

### Fix 5: Glass/Transparent Element Audit

Search codebase for `bg-white/10` and similar low-opacity backgrounds that become invisible in light mode:

```
Pattern to find:  bg-white/[0-2]0  (bg-white/10, bg-white/20)
Replace with:     conditional classes based on color-scheme
```

Light mode fix: `bg-white/80` (not `/10`)
Dark mode: `bg-white/10` is fine

Implementation: use `resolveColorScheme()` result to conditionally apply opacity.

## Files to Modify

| File | Change |
|------|--------|
| `client/src/utils/colorContrast.js` | **New** — contrast ratio utilities |
| `client/src/components/themes/ThemeEditorModal.jsx` | Add contrast validation warnings per color input |
| `client/src/ThemeContext.jsx` | Verify `resolveColorScheme()` threshold, add contrast helpers |
| `client/src/index.css` | Fix any foundation theme color values that fail contrast |
| Various components | Audit `bg-white/10` patterns for light mode visibility |

## Acceptance Criteria

- [ ] `colorContrast.js` utility correctly calculates WCAG 2.1 contrast ratios
- [ ] Theme editor shows warning when text:bg contrast < 4.5:1
- [ ] Theme editor shows warning when secondary:bg contrast < 3:1
- [ ] Theme editor shows warning when surface:bg lightness diff < 0.05
- [ ] All 5 foundation themes pass WCAG AA contrast (4.5:1 text, 3:1 secondary)
- [ ] Warnings are non-blocking (user can still save themes)
- [ ] `color-scheme` auto-detection works for both light and dark themes
- [ ] No `bg-white/10` elements invisible in light mode themes
- [ ] Glass card elements visible in both light and dark modes

## Phased Rollout

- **Alpha:** Foundation theme audit + contrast utility + editor warnings
- **v1.0:** Glass element audit, automatic contrast correction suggestions
