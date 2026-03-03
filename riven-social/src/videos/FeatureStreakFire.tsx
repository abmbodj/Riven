import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';
import { GrainOverlay, Logo } from '../components';
import {
  SPRING,
  getTypedText,
  isTypingDone,
  typingEndFrame,
  Cursor,
  Highlight,
} from '../utils';

/*
 * FeatureStreakFire – 480 frames (8s @ 60fps)
 * Hook → Demo (streak counter + fire) → Payoff → Logo
 *
 * TransitionSeries math:
 *   scenes  = 120 + 228 + 96 + 96 = 540
 *   trans   = 20 × 3 = 60
 *   total   = 540 − 60 = 480 ✓
 */

const SCENE = { hook: 120, demo: 228, payoff: 96, logo: 96 };
const T = 20;

const FIRE_PARTICLES = 18;
const BADGES = [
  { streak: 3, emoji: '🔥', label: '3-day streak!' },
  { streak: 7, emoji: '💪', label: 'One week!' },
  { streak: 14, emoji: '⚡', label: 'Two weeks!' },
  { streak: 30, emoji: '👑', label: 'UNSTOPPABLE' },
];

/* ─── Hook: "Don't break the chain. 🔥" typewriter ─── */
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TEXT = "Don't break the chain.";
  const CPS = 26;

  const typed = getTypedText(TEXT, frame, fps, CPS);
  const done = isTypingDone(TEXT, frame, fps, CPS);

  // Fire emoji slam after typing
  const doneDelay = typingEndFrame(TEXT, fps, CPS) + 6;
  const fireSlam = spring({
    frame,
    fps,
    delay: doneDelay,
    config: SPRING.bouncy,
  });
  const fireScale = interpolate(fireSlam, [0, 1], [5, 1], {
    extrapolateRight: 'clamp',
  });

  // Warm glow  bg
  const warmth = interpolate(frame, [0, 80], [0, 0.06], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
      }}
    >
      <AbsoluteFill
        style={{ backgroundColor: '#ff6b35', opacity: warmth }}
      />
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 68,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          padding: '0 50px',
          lineHeight: 1.3,
        }}
      >
        {typed}
        <Cursor show={!done} />
      </div>

      {/* Fire emoji slam */}
      {done && (
        <div
          style={{
            position: 'absolute',
            bottom: 620,
            fontSize: 80,
            transform: `scale(${fireScale})`,
            opacity: fireSlam,
          }}
        >
          🔥
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ─── Demo: streak counter 1→30 with fire particles ─── */
const DemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Counter 1→30 with easing
  const countProgress = interpolate(frame, [10, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const streakNum = Math.max(1, Math.round(countProgress * 30));

  // Number entry
  const numEntry = spring({ frame, fps, config: SPRING.snappy });
  const numScale = interpolate(numEntry, [0, 1], [0.5, 1], {
    extrapolateRight: 'clamp',
  });

  // Fire glow intensity based on streak
  const fireIntensity = interpolate(streakNum, [1, 30], [0.02, 0.18], {
    extrapolateRight: 'clamp',
  });

  // Number color shifts from cool to warm as streak grows
  const r = Math.round(interpolate(streakNum, [1, 15, 30], [200, 255, 255], { extrapolateRight: 'clamp' }));
  const g = Math.round(interpolate(streakNum, [1, 15, 30], [165, 120, 60], { extrapolateRight: 'clamp' }));
  const b = Math.round(interpolate(streakNum, [1, 15, 30], [80, 40, 20], { extrapolateRight: 'clamp' }));
  const numColor = `rgb(${r},${g},${b})`;

  // Badge reveals
  const activeBadge = BADGES.reduce<typeof BADGES[0] | null>((acc, badge) => {
    return streakNum >= badge.streak ? badge : acc;
  }, null);

  const badgeEntry = spring({
    frame,
    fps,
    delay: 160,
    config: SPRING.bouncy,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
      }}
    >
      {/* Fire glow */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, #ff6b3550 0%, #ff6b3520 40%, transparent 70%)`,
          opacity: fireIntensity,
        }}
      />

      {/* Fire particles */}
      {Array.from({ length: FIRE_PARTICLES }).map((_, i) => {
        const speed = 0.8 + (i % 4) * 0.4;
        const angle = (i / FIRE_PARTICLES) * Math.PI * 2 + Math.sin(frame * 0.02) * 0.3;
        const dist = 80 + Math.sin(frame * 0.08 + i * 1.3) * 30;
        const elapsed = Math.max(0, frame - 5 - i * 4);
        const rise = elapsed * speed * 1.5;

        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist - rise;
        const alpha = interpolate(rise, [0, 30, 200], [0, 0.6, 0], {
          extrapolateRight: 'clamp',
        });
        const size = interpolate(rise, [0, 100, 200], [8, 14, 4], {
          extrapolateRight: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: i % 3 === 0 ? '#ff6b35' : i % 3 === 1 ? '#ffaa33' : '#ff4444',
              transform: `translate(${x}px, ${y}px)`,
              opacity: alpha * fireIntensity * 4,
              filter: 'blur(1px)',
            }}
          />
        );
      })}

      {/* Streak number */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          transform: `scale(${numScale})`,
          opacity: numEntry,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.accent,
            letterSpacing: 5,
          }}
        >
          🔥 STREAK
        </div>
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 140,
            fontWeight: 700,
            color: numColor,
            lineHeight: 1,
            textShadow: `0 0 40px ${numColor}44`,
          }}
        >
          {streakNum}
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 24,
            color: `${COLORS.text}88`,
          }}
        >
          days in a row
        </div>
      </div>

      {/* Active badge */}
      {activeBadge && (
        <div
          style={{
            position: 'absolute',
            bottom: 540,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            backgroundColor: `${COLORS.accent}22`,
            border: `1px solid ${COLORS.accent}44`,
            borderRadius: 14,
            padding: '10px 24px',
            transform: `scale(${badgeEntry})`,
            opacity: badgeEntry,
          }}
        >
          <span style={{ fontSize: 28 }}>{activeBadge.emoji}</span>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 20,
              fontWeight: 700,
              color: COLORS.accent,
            }}
          >
            {activeBadge.label}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ─── Payoff: "Consistency wins." ─── */
const PayoffScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({ frame, fps, config: SPRING.bouncy });
  const scale = interpolate(entry, [0, 1], [2.5, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 70,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          transform: `scale(${scale})`,
          opacity: entry,
        }}
      >
        <Highlight delay={12}>Consistency</Highlight> wins.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Logo ─── */
const LogoScene: React.FC = () => (
  <AbsoluteFill
    style={{
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: COLORS.background,
    }}
  >
    <Logo showWordmark animateIn tagline="Download Riven" />
  </AbsoluteFill>
);

/* ─── Composition ─── */
export const FeatureStreakFire: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE.hook}>
          <HookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE.demo}>
          <DemoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-bottom' })}
          timing={springTiming({ config: SPRING.smooth, durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE.payoff}>
          <PayoffScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE.logo}>
          <LogoScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
