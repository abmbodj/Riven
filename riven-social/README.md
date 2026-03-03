# Riven Social — Promo Videos

Remotion project for Riven social media promo videos (TikTok, Instagram Reels, YouTube Shorts).

## Quick Start

```bash
cd riven-social
npm install

# Generate the grain texture (requires canvas package)
npm install canvas
node generate-grain.js

# Open Remotion Studio to preview
npm start
```

## Videos

| ID | Duration | Description |
|----|----------|-------------|
| `ExamPanic` | 30s | Relatable student panic → Riven saves the day |
| `SeedReward` | 15s | Satisfying seed earning loop |
| `GardenLoop` | 15s | Plant growing Day 1→30, pure visual loop |
| `DeckSkinReveal` | 20s | Deck skin collection showcase |
| `FeatureSpotlight` | 20s | Reusable feature spotlight template |
| `StudyWithMe` | 60s | Ambient "study with me" lofi aesthetic |

### Fast-Paced Feature Videos (High Dopamine)

| ID | Duration | Description |
|----|----------|-------------|
| `FeatureCramBlitz` | 10s | Cram mode urgency — "Exam in 2 hours?" screen shake SLAM |
| `FeatureGardenGrow` | 8s | Rapid garden growth with sparkle particle burst |
| `FeatureSkinDrop` | 8s | Rapid-fire 6 deck skin showcase with flash transitions |
| `FeatureSpacedRep` | 10s | Spaced repetition visual with interval timeline |
| `FeatureSeedRush` | 8s | Seed counter number-go-up dopamine with floating emojis |
| `FeatureStreakFire` | 8s | Streak counter 1→30 with escalating fire effects |

## Rendering

```bash
# Render a specific video
npx remotion render src/index.ts ExamPanic out/exam-panic.mp4 --codec=h264 --crf=18

# Render all videos
npm run render:all

# Quick preview (half res, lower quality)
npm run preview:exam-panic
```

## Render Commands

```bash
npx remotion render src/index.ts ExamPanic         out/exam-panic.mp4         --codec=h264 --crf=18
npx remotion render src/index.ts SeedReward        out/seed-reward.mp4        --codec=h264 --crf=18
npx remotion render src/index.ts GardenLoop        out/garden-loop.mp4        --codec=h264 --crf=18
npx remotion render src/index.ts DeckSkinReveal    out/skin-reveal.mp4        --codec=h264 --crf=18
npx remotion render src/index.ts StudyWithMe       out/study-with-me.mp4      --codec=h264 --crf=18

# Fast-paced feature videos
npx remotion render src/index.ts FeatureCramBlitz  out/feature-cram-blitz.mp4  --codec=h264 --crf=18
npx remotion render src/index.ts FeatureGardenGrow out/feature-garden-grow.mp4 --codec=h264 --crf=18
npx remotion render src/index.ts FeatureSkinDrop   out/feature-skin-drop.mp4   --codec=h264 --crf=18
npx remotion render src/index.ts FeatureSpacedRep  out/feature-spaced-rep.mp4  --codec=h264 --crf=18
npx remotion render src/index.ts FeatureSeedRush   out/feature-seed-rush.mp4   --codec=h264 --crf=18
npx remotion render src/index.ts FeatureStreakFire  out/feature-streak-fire.mp4 --codec=h264 --crf=18
```

## Creating New Feature Spotlight Episodes

The `FeatureSpotlight` video is a reusable template. To create a new episode:

1. Open `src/Root.tsx`
2. Add a new `<Composition>` with custom `defaultProps`:

```tsx
<Composition
  id="FeatureSpotlight-Gardens"
  component={FeatureSpotlight}
  durationInFrames={1200}
  fps={60}
  width={1080}
  height={1920}
  defaultProps={{
    featureName: 'Digital Garden',
    hookText: ['Study every day.', 'Watch your garden grow.'],
    payoffText: 'Your knowledge, growing daily',
  }}
/>
```

## Brand Rules

- **Background**: Always `#1a2535` (dark teal)
- **Text**: `#f5f0e8` (cream), headings in Playfair Display serif
- **Accent**: `#c8a96e` (warm gold)
- **Grain overlay** on every video at 8% opacity
- **Spring animations only** — no linear easing
- **60fps** — smooth animations
- **Logo** always in the final 3 seconds
