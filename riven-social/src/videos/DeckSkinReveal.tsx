import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS, SKINS, type SkinName } from '../constants';
import { FONTS } from '../fonts';
import { GrainOverlay } from '../components/GrainOverlay';
import { DeckCard } from '../components/DeckCard';
import { SeedCounter } from '../components/SeedCounter';
import { Logo } from '../components/Logo';

/**
 * DeckSkinReveal — 20s (1200 frames @ 60fps)
 * Deck skin collection reveal
 *
 * 0:00–0:03 (0-180)     Forest skin default
 * 0:03–0:08 (180-480)   Forest → Parchment → Midnight → Cherry
 * 0:08–0:14 (480-840)   Galaxy dramatic reveal
 * 0:14–0:18 (840-1080)  Earn text + seed counter
 * 0:18–0:20 (1080-1200) Logo CTA
 */

const SKIN_SEQUENCE: { skin: SkinName; startFrame: number; duration: number }[] = [
  { skin: 'forest', startFrame: 0, duration: 180 },
  { skin: 'parchment', startFrame: 180, duration: 100 },
  { skin: 'midnight', startFrame: 280, duration: 100 },
  { skin: 'cherry', startFrame: 380, duration: 100 },
  { skin: 'galaxy', startFrame: 480, duration: 360 },
];

// Gold particle for galaxy reveal
const GoldParticle: React.FC<{
  index: number;
  frame: number;
  fps: number;
}> = ({ index, frame, fps }) => {
  const angle = (index / 24) * Math.PI * 2;
  const delay = 490 + index * 3;
  const localFrame = frame - delay;
  if (localFrame < 0) return null;

  const dist = spring({
    frame: localFrame,
    fps,
    config: { damping: 15, stiffness: 80 },
  }) * 400;

  const opacity = interpolate(localFrame, [0, 30, 120, 160], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const x = 540 + Math.cos(angle) * dist;
  const y = 960 + Math.sin(angle) * dist;
  const size = 6 + (index % 4) * 4;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: COLORS.accent,
        opacity,
        boxShadow: `0 0 ${size * 2}px ${COLORS.accent}`,
      }}
    />
  );
};

export const DeckSkinReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Determine the currently visible skin
  const currentSkinEntry =
    [...SKIN_SEQUENCE].reverse().find((s) => frame >= s.startFrame) ??
    SKIN_SEQUENCE[0];

  // Wipe reveal transition (vertical wipe)
  const getWipeProgress = (startFrame: number) =>
    spring({
      frame: frame - startFrame,
      fps,
      config: { damping: 20, stiffness: 120 },
    });

  // RARE badge for galaxy
  const rareBadgeScale = spring({
    frame: frame - 540,
    fps,
    config: { damping: 8, stiffness: 150 },
  });

  const rareBadgeOpacity = interpolate(frame, [540, 560], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Skin carousel header */}
      <Sequence from={0} durationInFrames={840} premountFor={30}>
        <div
          style={{
            position: 'absolute',
            top: 180,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONTS.sans,
            fontSize: 28,
            color: COLORS.text,
            letterSpacing: '0.2em',
            textTransform: 'uppercase' as const,
            opacity: 0.7,
          }}
        >
          DECK SKINS
        </div>

        {/* Skin label */}
        <div
          style={{
            position: 'absolute',
            top: 240,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONTS.serif,
            fontSize: 44,
            color: COLORS.accent,
          }}
        >
          {SKINS[currentSkinEntry.skin].label}
        </div>

        {/* Current deck card with wipe transition */}
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              clipPath:
                frame >= currentSkinEntry.startFrame &&
                currentSkinEntry.startFrame > 0
                  ? `inset(0 0 ${
                      (1 - getWipeProgress(currentSkinEntry.startFrame)) * 100
                    }% 0)`
                  : undefined,
            }}
          >
            <DeckCard
              title="Organic Chemistry"
              cardCount={42}
              tag="SCIENCE"
              skin={currentSkinEntry.skin}
              animateIn={currentSkinEntry.startFrame === 0}
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Gold particles burst for galaxy */}
      <Sequence from={480} durationInFrames={360} premountFor={30}>
        {Array.from({ length: 24 }, (_, i) => (
          <GoldParticle key={i} index={i} frame={frame} fps={fps} />
        ))}
        {/* RARE badge */}
        <div
          style={{
            position: 'absolute',
            top: 1380,
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: rareBadgeOpacity,
            transform: `scale(${rareBadgeScale})`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 32,
              color: COLORS.background,
              backgroundColor: COLORS.accent,
              padding: '10px 40px',
              borderRadius: 8,
              letterSpacing: '0.3em',
              fontWeight: 700,
            }}
          >
            ✦ RARE ✦
          </span>
        </div>
      </Sequence>

      {/* Earn text + seed counter */}
      <Sequence from={840} durationInFrames={240} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 52,
                color: COLORS.text,
                marginBottom: 40,
                opacity: spring({
                  frame: frame - 840,
                  fps,
                  config: { damping: 200 },
                }),
              }}
            >
              Earn skins by mastering decks 🌱
            </div>
            <SeedCounter from={0} to={100} label="seeds to unlock" />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Logo CTA */}
      <Sequence from={1080} durationInFrames={120} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Logo showWordmark animateIn tagline="Collect them all" />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
