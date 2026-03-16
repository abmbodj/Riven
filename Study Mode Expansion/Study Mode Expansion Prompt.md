# Study Mode Expansion Prompt

I want to **expand Riven's study navigation into a full Study Dashboard** with 4 modules (Flashcards, Mock Exam, Study Guides, Notes) so that **users have a centralized study hub that feels native to the app's botanical-specimen aesthetic and reuses all existing design patterns**.

First, read these files completely before responding:

<!-- Context Files -->

- `client/src/routes/config.jsx` — All route definitions (flat array, lazy-loaded pages, ProtectedRoute wrapper)
- `client/src/components/Layout.jsx` — App shell with mobile bottom nav (5 items: Today, Study, FAB, Plan, Groups) and desktop sidebar. "Study" currently links to `/decks`. Hides nav on `/study` and `/test` routes
- `client/src/pages/Decks.jsx` — Current "Study" landing page. Deck library with folder management, search/filter, botanical-specimen card style (`DeckCard` component with Framer Motion hover lift)
- `client/src/pages/DeckView.jsx` — Single deck management hub. Two-column on `xl:`. Study/Test launch buttons, inline card editing, swipe-to-delete, bulk import, stats modal, share/export/duplicate, class & tag assignment
- `client/src/pages/StudyMode.jsx` — Fullscreen flashcard study experience. GSAP 3D card flip, spaced repetition mode, hearts system, session persistence in localStorage, swipe gestures, keyboard shortcuts, desktop sidebar stats panel
- `client/src/pages/TestMode.jsx` — Fullscreen test mode. Multiple choice and typed answer sub-modes, hearts system, shuffled questions from deck cards
- `client/src/pages/ClassView.jsx` — Per-class workbench at `/class/:id`. Kanban assignments, class times, linked study decks, AI deck generation. **This page needs a new Notes section added**
- `client/tailwind.config.js` — Design tokens: `claude-bg`, `claude-surface`, `claude-text`, `claude-secondary`, `claude-border`, `claude-accent`, `botanical-forest`. Fonts: `font-display` (Instrument Serif), `font-body` (Lora), `font-mono` (JetBrains Mono)
- `client/src/index.css` — CSS variables (`--bg-color: #162a31`, `--accent-color: #deb96a`, etc.), utility classes (`.glass-panel`, `.claude-button-primary`, `.botanical-card`, `.deck-lift`, `.fullscreen-page`, `.tap-action`, `.touch-target`), body noise grain texture, gradient mesh background
- `client/src/ThemeContext.jsx` — Theme system loading user themes from API, applying CSS variables to `document.documentElement`
- `CLAUDE.md` — Project rules and constraints

<!-- Reference -->

Here is a reference to what I want to achieve — the current Study flow (Decks → DeckView → StudyMode/TestMode). Here's what makes this reference work:

- Always use glassmorphism panels (`.glass-panel` — semi-transparent surface with backdrop blur on md+)
- Always use GSAP for enter/exit animations and card interactions (import from `utils/animations` for `EASE`, `DURATION`, `STAGGER` constants)
- Always use Framer Motion (`motion/react`) for viewport-triggered card reveals and hover effects (`.deck-lift` style: `whileHover: { y: -8, scale: 1.01 }`)
- Always use `font-display` (Instrument Serif) for page headings and card titles
- Always use `font-body` (Lora) for body text and descriptions
- Always use `font-mono` (JetBrains Mono) for labels, badges, and metadata
- Always use the warm gold accent (`claude-accent` / `--accent-color`) for primary CTAs and highlights
- Always use bottom-sheet modals via `AnimatePresence` from `motion/react` for mobile interactions
- Always design mobile-first, then add `xl:` breakpoint for desktop two-column layouts
- Always use the botanical-specimen card aesthetic (paper texture feel, subtle rotation, specimen tape accents)
- Always use `.touch-target` (44x44px minimum) for interactive elements on mobile
- Always lazy-load new pages via `React.lazy()` in the route config
- Always wrap new authenticated routes in `<ProtectedRoute />`
- Never break the fullscreen mode behavior — `/study` and `/test` routes hide all navigation
- Never introduce new CSS variables or design tokens — use the existing theme system
- Never use a UI component library — Riven uses custom components with Tailwind + GSAP + Framer Motion

<!-- Success Brief -->

**SUCCESS BRIEF**
- **Type of output:** Feature implementation — new React pages, routes, API integrations, and navigation updates
- **Recipient's reaction:** The Study Dashboard feels like it was always part of Riven. Each module (Flashcards, Mock Exam, Study Guides, Notes) is discoverable, visually cohesive, and functional
- **Does NOT sound like:** A generic dashboard. No flat Material UI cards, no corporate SaaS vibes, no bright white backgrounds. It must feel like Riven — warm, botanical, textured, alive
- **Success means:** A user taps "Study" in the bottom nav and lands on a beautiful dashboard with 4 clear entry points. Each module works end-to-end. Notes appear in ClassView. The entire flow feels polished and intentional

<!-- Rules -->

My context file (`CLAUDE.md`) contains my standards, constraints, and audience. Read it fully before starting. If you're about to break one of my rules, stop and tell me.

Additional rules:
- Use the `ui-ux-pro-max` skill for all design decisions
- Use the `frontend-dev-guidelines` skill for implementation patterns
- Flashcards module = the existing `/decks` page (no rebuild needed, just link to it)
- Mock Exam = new feature: upload notes/study guides → AI generates a test
- Study Guides = new feature: generate guides from notes, guides can create mock exams and flashcard decks
- Notes = new vault/library of user notes, each linkable to a class, usable to generate flashcards/study guides/mock exams. The individual note editor should follow a Notion-like block editing experience — clean, minimal, distraction-free typing with support for headings, bullet lists, numbered lists, toggles, dividers, and inline formatting (bold, italic, code). Use a slash command menu (`/`) to insert block types. The editor should feel like writing on a blank page — no toolbar clutter, just type and format naturally. Style the editor to match Riven's theme (dark surface, warm text, gold accents for selections/highlights)
- ClassView must gain a Notes section showing notes linked to that class
- Future: audio recording → AI note transcription (do NOT build this now, but design the Notes data model to support it later with an `audio_url` or `source_type` field)

<!-- Conversation -->

DO NOT start executing yet. Instead, ask me clarifying questions so we can refine the approach together step by step. Consider asking about:

1. Should the Study Dashboard replace the current `/decks` route, or should it be a new route (e.g., `/study`) with the bottom nav updated to point there?
2. For Mock Exam AI generation — should this use the same Supabase edge function pattern as the existing AI deck generation in ClassView, or a different approach?
3. For the Notion-like note editor — should we use an existing block editor library (e.g., Tiptap, BlockNote) themed to match Riven, or build a custom lightweight block editor from scratch?
4. For Study Guides — what format should a generated study guide take? (Structured sections with headers, bullet points, key terms?)
5. Should all new data (notes, study guides, mock exams) live in new Supabase tables, and if so, do you have preferences on the schema?

<!-- Plan -->

Before writing anything, list the 3 rules from my context file that matter most for this task.

<!-- Alignment -->

Then give me your execution plan (5 steps maximum). Only begin work once we've aligned.
