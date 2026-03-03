# Remotion Social Media Promo Videos — Agent Prompt
### For Antigravity Development Team

---

## Your Task

Build a Remotion project that produces social media promo videos for **Riven** — a student OS mobile app. The videos will be posted on TikTok, Instagram Reels, and YouTube Shorts. All videos are vertical 9:16 format at 1080x1920px.

---

## Brand Identity (Non-Negotiable)

Every frame of every video must reflect Riven's exact visual identity:

**Colors:**
- Background: Deep dark teal `#1a2535`
- Primary text: Cream/off-white `#f5f0e8`
- Accent: Warm amber/gold `#c8a96e`
- Secondary: Sage green `#4a7c6f`

**Typography:**
- Headings: Serif font (use Playfair Display or similar)
- Body/UI text: Clean sans-serif (Inter or similar)
- All caps tracking for labels (e.g. "YOUR DECKS", "LIBRARY")

**Texture:**
- Every video must have a grain/noise overlay at 8% opacity with `mixBlendMode: overlay`
- This is Riven's signature look — do not skip this

**Logo:**
- Botanical plant sprouting from a flashcard
- Cream and pale yellow
- Always appears in the final CTA frame

**Feel:**
- Premium, editorial, academic
- Not corporate — warm and personal
- Risograph print aesthetic

---

## Project Setup

```bash
npm create video@latest riven-social
cd riven-social
npm install @remotion/renderer
npm install @remotion/media-utils
```

**Folder structure to create:**
```
riven-social/
├── src/
│   ├── components/
│   │   ├── DeckCard.tsx
│   │   ├── CardFlip.tsx
│   │   ├── SeedCounter.tsx
│   │   ├── GardenGrow.tsx
│   │   ├── TextReveal.tsx
│   │   ├── GrainOverlay.tsx
│   │   ├── Logo.tsx
│   │   ├── PhoneMockup.tsx
│   │   └── CramMode.tsx
│   ├── videos/
│   │   ├── ExamPanic.tsx
│   │   ├── SeedReward.tsx
│   │   ├── GardenLoop.tsx
│   │   ├── DeckSkinReveal.tsx
│   │   ├── FeatureSpotlight.tsx
│   │   └── StudyWithMe.tsx
│   ├── Root.tsx
│   └── index.ts
├── public/
│   ├── grain.png
│   ├── logo.svg
│   └── fonts/
└── package.json
```

---

## Core Components to Build

Build these first. Every video assembles from these pieces.

### 1. GrainOverlay.tsx
Applied to every single video as the last child. Non-negotiable brand element.

```tsx
export const GrainOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.08 }) => (
  <AbsoluteFill style={{
    backgroundImage: `url(/grain.png)`,
    opacity,
    mixBlendMode: 'overlay',
    pointerEvents: 'none',
    zIndex: 999,
  }} />
)
```

### 2. DeckCard.tsx
The hero visual of the entire Riven brand. Renders a flashcard deck exactly as it appears in the app.

Props:
- `title: string` — deck name
- `cardCount: number` — number of cards
- `tag?: string` — optional tag like "VOCAB"
- `skin: 'forest' | 'midnight' | 'galaxy' | 'cherry' | 'parchment' | 'electric'`
- `animateIn?: boolean` — slides up with spring animation
- `delay?: number` — frame delay before animating

Skin definitions:
```
forest:    cream background, sage green clip
midnight:  dark charcoal #2a2f3d, navy clip, cream text
galaxy:    deep navy #0d1117, gold clip, white text, star particles
cherry:    blush #fdf0f3, pink clip
parchment: aged paper #e8dcc8, brown clip
electric:  near-white yellow tint, electric yellow clip
```

### 3. CardFlip.tsx
A single flashcard that flips from front to back using a 3D Y-axis rotation. Uses `react-native-reanimated` style spring physics.

Props:
- `front: string`
- `back: string`
- `flipAtFrame: number`

### 4. SeedCounter.tsx
Animated number counter showing seeds being earned. Number counts up with spring easing. Shows 🌱 emoji before the number.

Props:
- `from: number`
- `to: number`
- `label?: string` — e.g. "seeds earned"

### 5. TextReveal.tsx
Lines of text that appear one by one, each sliding up and fading in with a slight stagger.

Props:
- `lines: string[]`
- `staggerFrames?: number` — default 20
- `fontSize?: number`
- `align?: 'left' | 'center'`

### 6. GardenGrow.tsx
An animated botanical plant that grows from a seedling to full size. Use SVG path animation or a series of plant growth keyframes. The plant matches Riven's logo style — botanical, flat illustration, cream and gold tones.

Props:
- `growthPercent: number` — 0 to 100, animated via interpolate
- `dayCount?: number` — shows "Day X" beneath plant

### 7. Logo.tsx
Riven's botanical logo mark (plant + flashcard) with optional wordmark. Used in CTA frames.

Props:
- `showWordmark?: boolean`
- `animateIn?: boolean`
- `tagline?: string`

### 8. CramMode.tsx
Animated representation of Riven's cram mode UI. Shows:
- A card front large on screen
- Progress bar filling (e.g. 18/28)
- "Round 2" indicator
- Swipe hint arrows on left and right
- Energy/urgency feel — slightly faster animations

### 9. PhoneMockup.tsx
iPhone 15 Pro frame (space black) with content rendered inside the screen area. Used when showing the full app UI.

Props:
- `children: React.ReactNode` — rendered inside the screen
- `animateIn?: boolean`

---

## Videos to Build

### Video 1 — ExamPanic.tsx
**Duration:** 30 seconds (1800 frames at 60fps)
**Concept:** Relatable student panic → Riven solves it

```
0:00–0:05   Text reveals line by line:
              "exam in 3 hours 😭"
              "28 cards"
              "haven't studied once"

0:05–0:15   Cram mode activates dramatically
              Cards flying through at speed
              Progress bar filling up

0:15–0:22   Session complete
              "26/28 correct"
              Seeds counting up: +30 🌱

0:22–0:27   Garden plant pulses/glows

0:27–0:30   Logo fades in
              "Download Riven"
              App Store + Google Play badges
```

---

### Video 2 — SeedReward.tsx
**Duration:** 15 seconds (900 frames)
**Concept:** Satisfying seed earning loop — pure aesthetic, no dialogue needed

```
0:00–0:05   Deck card sitting on screen
              "LQ 12 Vocab · 28 cards"
              Galaxy skin

0:05–0:10   Mastery bar fills to 100%
              "DECK MASTERED" appears in gold

0:10–0:13   Seeds rain down from top of screen
              Counter climbs: 0 → 50
              "🌱 50 seeds earned"

0:13–0:15   Logo pulse
```

---

### Video 3 — GardenLoop.tsx
**Duration:** 15 seconds (900 frames)
**Concept:** Satisfying aesthetic loop — plant growing from seed to full bloom. No text needed. Pure visual.

```
0:00–0:15   Plant animates from tiny seedling
              to full lush botanical plant
              Day counter underneath: Day 1 → Day 30
              Grain texture throughout
              Loop seamlessly back to start
```

---

### Video 4 — DeckSkinReveal.tsx
**Duration:** 20 seconds (1200 frames)
**Concept:** Deck skin collection reveal — shows multiple skins cycling on the same deck

```
0:00–0:03   Default deck card (Forest skin) sits on screen

0:03–0:08   Skin changes with a satisfying reveal wipe:
              Forest → Parchment → Midnight → Cherry Blossom

0:08–0:14   Galaxy skin revealed dramatically
              Gold particles burst outward
              "RARE" badge appears

0:14–0:18   "Earn skins by mastering decks 🌱"
              Seed counter ticks up

0:18–0:20   Logo + CTA
```

---

### Video 5 — FeatureSpotlight.tsx
**Duration:** 20 seconds (1200 frames)
**Concept:** Reusable template — spotlight any single feature. Swap props to create new episodes.

Props:
- `featureName: string`
- `hookText: string[]`
- `demoComponent: React.ReactNode`
- `payoffText: string`

Build this as a flexible template so new feature videos just require changing the props and demo component, not rebuilding the whole video.

---

### Video 6 — StudyWithMe.tsx
**Duration:** 60 seconds (3600 frames)
**Concept:** Ambient "study with me" video. Riven UI slowly cycling through a study session. Lofi aesthetic. No urgency.

```
Full 60 seconds of:
- Cards flipping slowly one by one
- Seed counter incrementing
- Progress bar filling gradually
- Garden plant slowly growing
- Clock/timer running in corner

Calm, meditative pacing
Grain texture heavy
No text except subtle "studying with riven" watermark
```

---

## Compositions in Root.tsx

Register all videos with correct specs:

```tsx
export const RemotionRoot = () => (
  <>
    <Composition id="ExamPanic"       component={ExamPanic}       durationInFrames={1800} fps={60} width={1080} height={1920} />
    <Composition id="SeedReward"      component={SeedReward}      durationInFrames={900}  fps={60} width={1080} height={1920} />
    <Composition id="GardenLoop"      component={GardenLoop}      durationInFrames={900}  fps={60} width={1080} height={1920} />
    <Composition id="DeckSkinReveal"  component={DeckSkinReveal}  durationInFrames={1200} fps={60} width={1080} height={1920} />
    <Composition id="FeatureSpotlight" component={FeatureSpotlight} durationInFrames={1200} fps={60} width={1080} height={1920} />
    <Composition id="StudyWithMe"     component={StudyWithMe}     durationInFrames={3600} fps={60} width={1080} height={1920} />
  </>
)
```

---

## Export Commands

```bash
# Export all videos
npx remotion render src/index.tsx ExamPanic      out/exam-panic.mp4      --codec=h264 --crf=18
npx remotion render src/index.tsx SeedReward     out/seed-reward.mp4     --codec=h264 --crf=18
npx remotion render src/index.tsx GardenLoop     out/garden-loop.mp4     --codec=h264 --crf=18
npx remotion render src/index.tsx DeckSkinReveal out/skin-reveal.mp4     --codec=h264 --crf=18
npx remotion render src/index.tsx StudyWithMe    out/study-with-me.mp4   --codec=h264 --crf=18

# Quick preview render (low quality, fast)
npx remotion render src/index.tsx ExamPanic out/preview.mp4 --codec=h264 --crf=28 --scale=0.5
```

---

## Critical Rules

1. **GrainOverlay on every video** — no exceptions. It's what makes it look like Riven.
2. **Never use white backgrounds** — always dark teal `#1a2535` or darker.
3. **Serif for all hero text** — Playfair Display or equivalent.
4. **Spring animations only** — no linear easing anywhere. Everything bounces slightly.
5. **60fps** — Riven's animations are smooth. Do not render at 30fps.
6. **No stock footage** — everything is generated programmatically in Remotion.
7. **Grain texture last** — GrainOverlay is always the last child in AbsoluteFill.
8. **Logo always ends the video** — last 3 seconds of every video is always the logo and a CTA.

---

## Deliverables

- [ ] All 9 core components built and working in isolation
- [ ] All 6 videos rendering correctly
- [ ] All exports clean MP4 files at 1080x1920
- [ ] FeatureSpotlight template documented so new episodes require only prop changes
- [ ] README with export commands for each video

---

*This project is for Riven by Antigravity. All visual decisions should reflect the brand identity described above. When in doubt — darker, grainier, more botanical.*