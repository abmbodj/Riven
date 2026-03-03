import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';
import { GrainOverlay } from '../components/GrainOverlay';
import { DeckCard } from '../components/DeckCard';
import { SeedCounter } from '../components/SeedCounter';
import { Logo } from '../components/Logo';

/**
 * SeedReward — 15s (900 frames @ 60fps)
 * Satisfying seed earning loop — pure aesthetic
 *
 * 0:00–0:05 (0-300)    Deck card on screen (galaxy skin)
 * 0:05–0:10 (300-600)  Mastery bar fills → DECK MASTERED
 * 0:10–0:13 (600-780)  Seeds rain + counter
 * 0:13–0:15 (780-900)  Logo pulse
 */

const SeedParticle: React.FC<{
  delay: number;
  x: number;
  speed: number;
  fps: number;
  frame: number;
}> = ({ delay, x, speed, fps, frame }) => {
  const localFrame = frame - delay;
  if (localFrame < 0) return null;

  const y = interpolate(localFrame, [0, speed], [-100, 2100], {
    extrapolateRight: 'clamp',
  });
  const rotation = interpolate(localFrame, [0, speed], [0, 360]);
  const opacity = interpolate(localFrame, [speed - 30, speed], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontSize: 36,
        opacity,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      🌱
    </div>
  );
};

export const SeedReward: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mastery bar progress
  const masteryProgress = interpolate(frame, [300, 560], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const masteredOpacity = spring({
    frame: frame - 560,
    fps,
    config: { damping: 200 },
  });

  const masteredScale = spring({
    frame: frame - 560,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  // Generate seed particles
  const seeds = Array.from({ length: 20 }, (_, i) => ({
    delay: 600 + i * 6,
    x: 100 + Math.sin(i * 1.7) * 400 + 440,
    speed: 90 + (i % 4) * 15,
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Scene 1: Deck card */}
      <Sequence from={0} durationInFrames={600} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <DeckCard
            title="LQ 12 Vocab"
            cardCount={28}
            tag="VOCAB"
            skin="galaxy"
            animateIn
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Mastery bar + DECK MASTERED */}
      <Sequence from={300} durationInFrames={300} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <DeckCard
            title="LQ 12 Vocab"
            cardCount={28}
            tag="VOCAB"
            skin="galaxy"
          />
          {/* Mastery progress bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 620,
              width: 600,
              height: 16,
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${masteryProgress}%`,
                height: '100%',
                borderRadius: 8,
                backgroundColor: COLORS.accent,
                transition: 'none',
              }}
            />
          </div>
          {/* DECK MASTERED text */}
          <div
            style={{
              position: 'absolute',
              bottom: 520,
              fontFamily: FONTS.serif,
              fontSize: 52,
              color: COLORS.accent,
              letterSpacing: '0.15em',
              textTransform: 'uppercase' as const,
              opacity: masteredOpacity,
              transform: `scale(${masteredScale})`,
            }}
          >
            ✨ DECK MASTERED ✨
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Seed rain + counter */}
      <Sequence from={600} durationInFrames={180} premountFor={30}>
        <AbsoluteFill>
          {seeds.map((s, i) => (
            <SeedParticle
              key={i}
              delay={s.delay}
              x={s.x}
              speed={s.speed}
              fps={fps}
              frame={frame}
            />
          ))}
          <AbsoluteFill
            style={{
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <SeedCounter from={0} to={50} label="seeds earned" />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo pulse */}
      <Sequence from={780} durationInFrames={120} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Logo showWordmark animateIn />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
