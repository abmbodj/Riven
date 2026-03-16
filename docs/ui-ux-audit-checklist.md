# UI/UX Audit Checklist

Comprehensive audit checklist for the Riven project, synthesized from the UI/UX Pro Max skill's 99 UX guidelines, 30 web interface rules, and stack-specific best practices for React + Tailwind CSS + Capacitor.

**How to use:** Work through each section top-to-bottom. Critical items should block release; High items should be resolved before launch; Medium and Low items are quality improvements to address iteratively.

**Severity legend:**
`CRITICAL` — Must fix before any release
`HIGH` — Must fix before launch
`MEDIUM` — Should fix; schedule for next sprint
`LOW` — Nice to have; address when convenient

---

## 1. Accessibility (CRITICAL)

### Color and Contrast

- [ ] **Color contrast ratio** — All normal text meets 4.5:1 minimum contrast against its background `CRITICAL` `All`
- [ ] **Large text contrast** — Headings and large text (18px+ bold, 24px+ regular) meet 3:1 minimum `HIGH` `All`
- [ ] **Color not sole indicator** — Information is never conveyed by color alone; icons or text supplement color cues (e.g., error states use icon + red, not just red) `HIGH` `All`
- [ ] **Light mode text contrast** — Body text uses `text-gray-900` or darker on light backgrounds; muted text uses `text-gray-600` minimum `HIGH` `Web`
- [ ] **Glass/transparent elements** — Semi-transparent cards and overlays remain readable in both light and dark mode `MEDIUM` `Web`
- [ ] **Border visibility** — Borders are visible in both light (`border-gray-200`) and dark (`border-gray-700`) modes `MEDIUM` `Web`

### Semantic HTML and ARIA

- [ ] **Semantic elements** — Using `<button>`, `<a>`, `<nav>`, `<main>`, `<article>`, `<section>` instead of generic `<div>` with roles `HIGH` `Web`
- [ ] **Icon button labels** — Every icon-only button has an `aria-label` (e.g., `<button aria-label="Close"><XIcon /></button>`) `CRITICAL` `Web`
- [ ] **Decorative icons hidden** — Decorative icons have `aria-hidden="true"` to prevent screen reader noise `MEDIUM` `Web`
- [ ] **Form control labels** — Every `<input>`, `<select>`, `<textarea>` has an associated `<label>` with `htmlFor`, or an `aria-label` `CRITICAL` `All`
- [ ] **Heading hierarchy** — Headings follow sequential order (h1 > h2 > h3); no skipped levels `MEDIUM` `Web`
- [ ] **ARIA live regions** — Dynamic content updates (toasts, status messages, errors) use `aria-live="polite"` or `role="alert"` `MEDIUM` `Web`
- [ ] **Screen reader text** — Context-only labels use Tailwind `sr-only` class for screen reader access `HIGH` `Web`

### Keyboard Navigation

- [ ] **Tab order** — Tab order matches the visual reading order of the page `HIGH` `Web`
- [ ] **Keyboard handlers** — Interactive `<div>` elements have both `onClick` and `onKeyDown` with `tabIndex={0}` `HIGH` `Web`
- [ ] **Skip link** — A "Skip to main content" link is the first focusable element on nav-heavy pages `MEDIUM` `Web`
- [ ] **Focus trap in modals** — Modals and dialogs trap focus within themselves; focus returns to trigger on close `HIGH` `Web`
- [ ] **No keyboard traps** — Users can always tab out of any component; no dead-end focus states `HIGH` `Web`

### Focus States

- [ ] **Visible focus rings** — All interactive elements show a visible focus indicator (e.g., `focus-visible:ring-2 focus-visible:ring-blue-500`) `CRITICAL` `Web`
- [ ] **No bare outline-none** — `outline-none` or `focus:outline-none` is never used without a replacement ring/border `CRITICAL` `Web`
- [ ] **focus-visible over focus** — Using `focus-visible:` instead of `focus:` so rings only appear for keyboard users, not mouse clicks `MEDIUM` `Web`

### Motion and Reduced Motion

- [ ] **prefers-reduced-motion** — All animations check `prefers-reduced-motion` and disable or simplify accordingly `HIGH` `All`
- [ ] **Tailwind motion-reduce** — Animated elements include `motion-reduce:animate-none` or `motion-reduce:transition-none` `HIGH` `Web`

### Images and Media

- [ ] **Alt text** — All meaningful images have descriptive `alt` text; decorative images use `alt=""` `HIGH` `All`
- [ ] **No zoom disable** — Viewport meta tag does not include `maximum-scale=1` or `user-scalable=no` `CRITICAL` `Web`

---

## 2. Touch and Interaction (CRITICAL)

### Touch Targets

- [ ] **Minimum touch target** — All tappable elements are at least 44x44px (`min-h-[44px] min-w-[44px]`) `HIGH` `Mobile`
- [ ] **Touch target spacing** — Adjacent touch targets have at least 8px gap between them (`gap-2` minimum) `MEDIUM` `Mobile`
- [ ] **Gesture conflicts** — Custom gestures do not conflict with system gestures (swipe-back, pull-to-refresh) `MEDIUM` `Mobile`
- [ ] **Tap delay** — `touch-action: manipulation` is set to eliminate the 300ms tap delay `MEDIUM` `Mobile`

### Click and Hover

- [ ] **Cursor pointer** — All clickable elements (buttons, cards, links) have `cursor-pointer` `HIGH` `Web`
- [ ] **Hover feedback** — Interactive elements provide visual feedback on hover (color, shadow, or border change) `MEDIUM` `Web`
- [ ] **Hover vs tap** — Primary interactions use `onClick`/tap, not `onMouseEnter`-only patterns `HIGH` `All`
- [ ] **Stable hover states** — Hover effects use color/opacity transitions, not `scale` transforms that shift layout `MEDIUM` `Web`
- [ ] **Smooth transitions** — State changes use `transition-colors duration-200` or similar (150-300ms range) `MEDIUM` `Web`

### Active and Disabled States

- [ ] **Active/pressed state** — Buttons show immediate feedback on press (e.g., `active:scale-95`) `MEDIUM` `All`
- [ ] **Disabled styling** — Disabled elements use `opacity-50 cursor-not-allowed` and are visually distinct from enabled `MEDIUM` `All`

### Loading and Submission

- [ ] **Loading buttons** — Buttons are disabled and show a spinner during async operations to prevent double-submit `HIGH` `All`
- [ ] **Submit feedback** — Forms show loading state, then success or error message after submission `HIGH` `All`

### Error and Success Feedback

- [ ] **Error messages near field** — Errors appear inline below the related input, not in a single block at the top `HIGH` `All`
- [ ] **Error announcements** — Error messages use `role="alert"` or `aria-live` so screen readers announce them `HIGH` `Web`
- [ ] **Success confirmation** — Successful actions show a brief confirmation (toast, checkmark, or message) `MEDIUM` `All`

### Destructive Actions

- [ ] **Confirmation dialogs** — Delete and other irreversible actions require explicit confirmation before executing `HIGH` `All`

---

## 3. Performance (HIGH)

### Images

- [ ] **Image optimization** — Images use modern formats (WebP/AVIF), `srcset` for responsive sizes, and appropriate compression `HIGH` `Web`
- [ ] **Lazy loading** — Below-fold images use `loading="lazy"` `HIGH` `Web`
- [ ] **Aspect ratio** — Image containers use `aspect-video` or `aspect-square` to prevent layout shift `MEDIUM` `Web`
- [ ] **Object fit** — Images use `object-cover` or `object-contain` to prevent distortion `MEDIUM` `Web`
- [ ] **SVG dimensions** — SVGs include explicit `width` and `height` attributes alongside CSS sizing to prevent layout shift before CSS loads `HIGH` `Web`

### Content Loading

- [ ] **Content jumping** — Async content has reserved space (fixed height, `aspect-ratio`, or skeleton) to prevent layout shift `HIGH` `Web`
- [ ] **Skeleton screens** — Loading states use skeleton placeholders or spinners for operations > 300ms `HIGH` `All`
- [ ] **Font loading** — Web fonts use `font-display: swap` with a similar-metric fallback font `MEDIUM` `Web`

### Code and Bundle

- [ ] **Code splitting** — Routes and heavy components use `React.lazy()` / dynamic imports `MEDIUM` `Web`
- [ ] **Bundle size monitoring** — Bundle analyzer is used to track and minimize JavaScript payload `MEDIUM` `Web`
- [ ] **Barrel import avoidance** — Imports use direct paths (e.g., `lucide-react/dist/esm/icons/check`) instead of barrel re-exports `HIGH` `Web`
- [ ] **Deferred third-party scripts** — Analytics, logging, and non-critical scripts load after hydration via dynamic import or `defer` `MEDIUM` `Web`
- [ ] **Tailwind content paths** — Tailwind `content` array correctly covers all template files to enable proper tree-shaking `HIGH` `Web`

### Lists and Rendering

- [ ] **Virtualized long lists** — Lists with 50+ items use `react-window` or `react-virtual` instead of rendering all DOM nodes `HIGH` `Web`
- [ ] **content-visibility** — Long off-screen sections use `content-visibility: auto` to defer rendering `MEDIUM` `Web`
- [ ] **Preconnect hints** — `<link rel="preconnect">` is set for known CDN and API domains `LOW` `Web`

### Async Patterns (React)

- [ ] **Parallel fetching** — Independent async operations use `Promise.all()` instead of sequential `await` `CRITICAL` `Web`
- [ ] **Deferred await** — `await` is moved into branches where actually needed, not at the top of functions blocking unused paths `HIGH` `Web`
- [ ] **Suspense boundaries** — Async components are wrapped in `<Suspense>` with fallback UI for streaming `HIGH` `Web`

---

## 4. Layout and Responsive (HIGH)

### Viewport and Mobile

- [ ] **Viewport meta** — `<meta name="viewport" content="width=device-width, initial-scale=1">` is present `CRITICAL` `Web`
- [ ] **No horizontal scroll** — Content fits within viewport width at all breakpoints; no horizontal scrollbar on mobile `HIGH` `Web`
- [ ] **Mobile-first CSS** — Styles start with mobile defaults and add `md:`, `lg:`, `xl:` breakpoints upward `MEDIUM` `Web`
- [ ] **Breakpoint testing** — UI tested at 320px, 375px, 414px, 768px, 1024px, 1280px, and 1440px `HIGH` `Web`
- [ ] **Viewport units** — Full-height layouts use `min-h-dvh` instead of `min-h-screen` / `100vh` to account for mobile browser chrome `MEDIUM` `Web`

### Container and Width

- [ ] **Container max-width** — Main content uses consistent `max-w-6xl` or `max-w-7xl` with `mx-auto` `MEDIUM` `Web`
- [ ] **Readable line length** — Body text is limited to 65-75 characters per line (`max-w-prose` or `max-w-3xl`) `MEDIUM` `Web`
- [ ] **Responsive padding** — Horizontal padding scales with breakpoints (`px-4 md:px-6 lg:px-8`) `MEDIUM` `Web`

### Z-Index and Stacking

- [ ] **Z-index scale** — Using Tailwind's predefined scale (`z-10`, `z-20`, `z-30`, `z-50`) instead of arbitrary values like `z-[9999]` `MEDIUM` `Web`
- [ ] **Fixed element z-index** — Fixed navbar uses `z-50`, dropdowns `z-40`, modals `z-50` with consistent hierarchy `HIGH` `Web`
- [ ] **Stacking context awareness** — No unexpected z-index failures from nested stacking contexts `MEDIUM` `Web`

### Fixed and Floating Elements

- [ ] **Navbar content offset** — Body has `padding-top` equal to fixed navbar height so content is not hidden behind it `HIGH` `Web`
- [ ] **Floating element spacing** — Floating navbars/elements have spacing from viewport edges (`top-4 left-4 right-4`) `MEDIUM` `Web`
- [ ] **No overlapping fixed elements** — Multiple fixed elements (nav, bottom bar, FAB) do not overlap or obscure each other `MEDIUM` `Web`

### Overflow

- [ ] **Overflow handling** — `overflow-hidden` is not blindly applied; content is tested to ensure nothing is clipped `MEDIUM` `Web`
- [ ] **Table responsiveness** — Wide tables use `overflow-x-auto` wrapper or convert to card layout on mobile `MEDIUM` `Web`
- [ ] **Image scaling** — Images use `max-w-full h-auto` to scale within their container `MEDIUM` `Web`

---

## 5. Typography and Color (MEDIUM)

### Typography

- [ ] **Body line height** — Body text uses `leading-relaxed` (1.625) or similar 1.5-1.75 range `MEDIUM` `All`
- [ ] **Font size minimum** — Body text is at least 16px (`text-base`) on mobile devices `HIGH` `Mobile`
- [ ] **Font size scale** — Using Tailwind's type scale (`text-sm`, `text-base`, `text-lg`, `text-xl`) consistently; no arbitrary `text-[17px]` `LOW` `Web`
- [ ] **Heading distinction** — Headings have clear size and weight difference from body text `MEDIUM` `All`
- [ ] **Text truncation** — Long text uses `truncate` or `line-clamp-*` with expand option instead of overflowing `MEDIUM` `Web`
- [ ] **Proper unicode** — Using real ellipsis (`...`), curly quotes, and em-dashes instead of ASCII approximations `LOW` `Web`
- [ ] **Non-breaking spaces** — Units and brand names use `&nbsp;` to prevent awkward line breaks (e.g., `10&nbsp;kg`) `LOW` `Web`
- [ ] **Prose plugin** — Rich text / markdown content uses `@tailwindcss/typography` (`prose` class) `MEDIUM` `Web`

### Color and Theming

- [ ] **Semantic color tokens** — Colors use semantic names (`bg-primary`, `text-success`) defined in Tailwind config, not raw values like `bg-blue-500` everywhere `MEDIUM` `Web`
- [ ] **Theme color variables** — Using `bg-primary` directly, not `bg-[var(--color-primary)]` wrapper `MEDIUM` `Web`
- [ ] **Dark mode support** — Components include `dark:` variants for background, text, and border colors `MEDIUM` `Web`
- [ ] **Opacity utilities** — Using `bg-black/50` instead of separate `bg-black opacity-50` `LOW` `Web`
- [ ] **Both modes tested** — UI is visually verified in both light and dark mode before delivery `HIGH` `Web`

---

## 6. Forms (MEDIUM)

### Labels and Inputs

- [ ] **Visible labels** — Every input has a visible label above or beside it; placeholder is not the only label `HIGH` `All`
- [ ] **Input types** — Semantic types are used: `type="email"`, `type="tel"`, `type="url"`, `type="number"` `MEDIUM` `All`
- [ ] **Autocomplete attribute** — Inputs include appropriate `autocomplete` values (`email`, `current-password`, `name`, etc.) `HIGH` `Web`
- [ ] **Required indicators** — Required fields are marked with asterisk or "(required)" text `MEDIUM` `All`
- [ ] **Input affordance** — Inputs have distinct styling (border, background) that looks interactive, not like plain text `MEDIUM` `All`
- [ ] **Consistent input sizing** — All inputs use consistent height (`h-10 px-3`) and styling `MEDIUM` `Web`
- [ ] **Placeholder styling** — Placeholder text uses `placeholder:text-gray-400`, not dark colors `LOW` `Web`

### Validation and Errors

- [ ] **Inline validation** — Fields validate on blur, not only on submit `MEDIUM` `All`
- [ ] **Error placement** — Error messages appear directly below the related field `MEDIUM` `All`
- [ ] **Focus on first error** — On submit failure, focus moves to the first field with an error `MEDIUM` `Web`

### Interaction

- [ ] **Password visibility toggle** — Password fields include a show/hide toggle `MEDIUM` `All`
- [ ] **Paste not blocked** — `onPaste` is never prevented on password, code, or any input fields `HIGH` `Web`
- [ ] **Spellcheck disabled** — Email, code, and technical inputs have `spellCheck="false"` `LOW` `Web`
- [ ] **Mobile keyboard** — Inputs use `inputMode="numeric"`, `inputMode="email"`, etc. for appropriate mobile keyboards `MEDIUM` `Mobile`
- [ ] **Controlled components** — Form inputs use `value` + `onChange` (controlled) pattern `MEDIUM` `Web`
- [ ] **Form onSubmit** — Forms use `<form onSubmit={handleSubmit}>` with `preventDefault`, not button `onClick` alone `MEDIUM` `Web`
- [ ] **Debounced search** — Search and filter inputs use `useDeferredValue` or debounce to avoid filtering on every keystroke `MEDIUM` `Web`

---

## 7. Animation and Feedback (MEDIUM)

### Animation Quality

- [ ] **Duration range** — Micro-interactions use 150-300ms; nothing exceeds 500ms for UI transitions `MEDIUM` `All`
- [ ] **Transform-only animations** — Animations use `transform` and `opacity`, not `width`, `height`, `top`, or `left` `MEDIUM` `Web`
- [ ] **Easing functions** — Using `ease-out` for entering elements, `ease-in` for exiting; not `linear` for UI `LOW` `All`
- [ ] **No excessive motion** — Maximum 1-2 animated elements per view; no pages with 5+ bouncing/spinning elements `HIGH` `All`
- [ ] **Continuous animation limited** — `animate-spin` and `animate-bounce` are only used on loading indicators, not decorative elements `MEDIUM` `Web`
- [ ] **No transition-all** — Using `transition-colors`, `transition-shadow`, or `transition-opacity` instead of `transition-all` `MEDIUM` `Web`
- [ ] **SVG animation wrapper** — SVGs are wrapped in a `<div>` for animation; the wrapper is animated, not the SVG directly `LOW` `Web`

### User Feedback

- [ ] **Loading indicators** — Operations > 300ms show a spinner, skeleton, or progress bar `HIGH` `All`
- [ ] **Empty states** — Empty lists/views show a helpful message and suggested action, not blank space `MEDIUM` `All`
- [ ] **Error recovery** — Error messages include a clear next step (retry button, help link, or instructions) `MEDIUM` `All`
- [ ] **Progress indicators** — Multi-step processes show step count (e.g., "Step 2 of 4") `MEDIUM` `All`
- [ ] **Toast auto-dismiss** — Toast notifications auto-dismiss after 3-5 seconds `MEDIUM` `All`

### Navigation Feedback

- [ ] **Smooth scroll** — Anchor links use `scroll-behavior: smooth` `MEDIUM` `Web`
- [ ] **Active nav state** — Current page/section is visually highlighted in navigation `MEDIUM` `All`
- [ ] **Back button works** — Browser/app back button works predictably; navigation history is preserved `HIGH` `All`

---

## 8. State, Content, and Anti-Patterns (LOW)

### URL and State

- [ ] **URL reflects state** — Filters, tabs, pagination, and view state are synced to URL query params for shareability `HIGH` `Web`
- [ ] **Deep linking** — Stateful views support deep-linking; shared URLs restore the correct state `MEDIUM` `Web`

### Content Handling

- [ ] **Text truncation** — Long content uses `line-clamp-*` with an expand option; no overflow or broken layout `MEDIUM` `All`
- [ ] **Date formatting** — Dates use `Intl.DateTimeFormat` or relative time ("2 hours ago"), not hardcoded formats `LOW` `All`
- [ ] **Number formatting** — Large numbers use thousand separators or abbreviations (`1.2K`, `1,234`) `LOW` `All`
- [ ] **Realistic placeholders** — Development uses realistic sample data, not "Lorem ipsum" `LOW` `All`

### Anti-Patterns to Avoid

- [ ] **No emoji icons** — UI uses SVG icons (Lucide, Heroicons) instead of emoji characters as functional icons `MEDIUM` `All`
- [ ] **Consistent icon set** — All icons come from the same library (Lucide React) with consistent sizing (`size-6`) `MEDIUM` `Web`
- [ ] **Correct brand logos** — Third-party logos are sourced from Simple Icons or official assets, not guessed `LOW` `Web`
- [ ] **No @apply bloat** — Tailwind `@apply` is used sparingly; utilities are applied directly in JSX `LOW` `Web`
- [ ] **No hardcoded dates** — Date/number formatting uses `Intl` APIs, not manual string formatting `LOW` `Web`

### Sustainability

- [ ] **No autoplay video** — Videos use click-to-play or pause when off-screen; no autoplay high-res loops `MEDIUM` `Web`
- [ ] **Asset weight** — 3D models and heavy assets are compressed (Draco, etc.) and lazy-loaded `LOW` `Web`

### AI Interaction (if applicable)

- [ ] **AI disclaimer** — AI-generated content is clearly labeled as such `HIGH` `All`
- [ ] **Streaming responses** — AI text streams token-by-token instead of showing a spinner for 10+ seconds `MEDIUM` `All`
- [ ] **Feedback loop** — AI outputs include thumbs up/down or regenerate options `LOW` `All`

---

## 9. React-Specific (Stack)

### State Management

- [ ] **No unnecessary state** — Derived values are computed during render, not stored in separate `useState` `HIGH`
- [ ] **useReducer for complex state** — Related state values that update together use `useReducer` instead of 5+ `useState` calls `MEDIUM`
- [ ] **Lazy state initialization** — Expensive initial state uses function form: `useState(() => compute())` `MEDIUM`
- [ ] **Functional setState** — State updates that depend on previous state use functional form: `setState(prev => ...)` `MEDIUM`
- [ ] **Context split by concern** — Separate contexts for theme, auth, and user data; no single giant `AppContext` `MEDIUM`
- [ ] **Memoized context values** — Context provider values are wrapped in `useMemo` to prevent unnecessary re-renders `HIGH`

### Effects and Refs

- [ ] **Effect cleanup** — All `useEffect` subscriptions, timers, and listeners return a cleanup function `HIGH`
- [ ] **Correct dependencies** — Effect dependency arrays include all referenced values; no stale closures `HIGH`
- [ ] **No unnecessary effects** — Data transformations happen during render, not in `useEffect` setting derived state `HIGH`
- [ ] **Refs for non-reactive values** — Interval IDs, DOM refs, and non-render values use `useRef`, not `useState` `MEDIUM`

### Rendering

- [ ] **Stable list keys** — List items use stable unique IDs as `key`, not array index `HIGH`
- [ ] **Memoized expensive computations** — `useMemo` is used for expensive filtering, sorting, or calculations `MEDIUM`
- [ ] **Memoized callbacks** — Functions passed to memoized children use `useCallback` `MEDIUM`
- [ ] **No inline objects in JSX** — Style objects and config objects are defined outside the component or memoized `MEDIUM`
- [ ] **Conditional render safety** — Using ternary `count > 0 ? <Badge /> : null` instead of `count && <Badge />` (which renders `0`) `LOW`
- [ ] **startTransition for non-urgent updates** — Frequent non-critical state updates (scroll position, search) use `startTransition` `MEDIUM`

### Components and Props

- [ ] **TypeScript prop interfaces** — All components have typed props via `interface Props` `HIGH`
- [ ] **Small focused components** — Each component has a single responsibility; no 500-line mega-components `MEDIUM`
- [ ] **Props destructured** — Props are destructured in the function signature for clarity `LOW`
- [ ] **No prop drilling** — Deeply nested data uses Context or composition instead of passing through 5+ levels `MEDIUM`

### Error Handling

- [ ] **Error boundaries** — `<ErrorBoundary>` wraps major sections to prevent full-app crashes `HIGH`
- [ ] **Async error handling** — All `async` operations use `try/catch`; no unhandled promise rejections `HIGH`

### Hooks

- [ ] **Rules of hooks** — Hooks are only called at the top level of components/hooks, never inside conditions or loops `HIGH`
- [ ] **Custom hook naming** — Custom hooks start with `use` prefix (`useFetch`, `useAuth`) `HIGH`
- [ ] **Reusable logic extracted** — Shared stateful logic lives in custom hooks, not duplicated across components `MEDIUM`

---

## 10. Tailwind CSS-Specific (Stack)

### Utilities and Patterns

- [ ] **Consistent spacing scale** — Using Tailwind spacing tokens (`p-4`, `m-6`, `gap-8`) instead of arbitrary `p-[15px]` `LOW`
- [ ] **Grid gaps over margins** — Grid/flex layouts use `gap-*` instead of margins on individual children `MEDIUM`
- [ ] **space-y for vertical lists** — Vertical stacks use `space-y-4` instead of `mb-4` on each child `LOW`
- [ ] **size-\* for squares** — Equal width/height elements use `size-6` instead of `h-6 w-6` `LOW`
- [ ] **shrink-0 shorthand** — Using `shrink-0` instead of `flex-shrink-0` `LOW`
- [ ] **group/peer for state** — Parent/sibling state styling uses `group-hover:` and `peer-checked:` instead of JavaScript `LOW`

### Dark Mode and Theming

- [ ] **dark: prefix coverage** — All visible elements (bg, text, border, ring) have `dark:` variants `MEDIUM`
- [ ] **Light mode glass cards** — Glass/transparent cards use `bg-white/80` or higher opacity in light mode, not `bg-white/10` `MEDIUM`

### Forms (Tailwind)

- [ ] **Focus ring pattern** — Inputs use `focus:ring-2 focus:ring-offset-2 focus:ring-blue-500` `HIGH`
- [ ] **Disabled pattern** — Disabled inputs use `disabled:opacity-50 disabled:cursor-not-allowed` `MEDIUM`

### Performance (Tailwind)

- [ ] **No @apply overuse** — `@apply` is used sparingly; direct utility classes are preferred in JSX `LOW`
- [ ] **Container queries** — Component-level responsiveness uses `@container` and `@lg:` instead of viewport media queries where appropriate `MEDIUM`

---

## Pre-Release Final Check

Run through these final items before any release:

- [ ] All CRITICAL items above are resolved
- [ ] All HIGH items above are resolved
- [ ] Light mode tested end-to-end
- [ ] Dark mode tested end-to-end
- [ ] Mobile (375px) tested end-to-end
- [ ] Tablet (768px) tested end-to-end
- [ ] Desktop (1440px) tested end-to-end
- [ ] Keyboard-only navigation tested (tab through entire flow)
- [ ] Screen reader tested on key flows (VoiceOver on macOS/iOS)
- [ ] Lighthouse accessibility score >= 90
- [ ] No console errors or warnings in production build
