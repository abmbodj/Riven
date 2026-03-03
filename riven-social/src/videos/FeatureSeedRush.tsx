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
import { wipe } from '@remotion/transitions/wipe';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';
import { GrainOverlay, Logo, SeedCounter } from '../components';
import { SPRING, Highlight } from '../utils';

/*
 * FeatureSeedRush – 480 frames (8s @ 60fps)
 * Hook → Demo (counter + floating seeds) → Payoff → Logo
 *
 * TransitionSeries math:
 *   scenes  = 108 + 240 + 96 + 96 = 540
 *   trans   = 20 × 3 = 60
 *   total   = 540 − 60 = 480 ✓
 */

const SCENE = { hook: 108, demo: 240, payoff: 96, logo: 96 };
const T = 20;

const SEED_EMOJIS = ['🌱', '🌿', '🍀', '🌲', '🌾', '💚'];

/* ─── Hook: "Study = Rewards 🌱" slam ─── */
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({ frame, fps, config: SPRING.bouncy });
  const slamScale = interpolate(slam, [0, 1], [3.5, 1], {
    extrapolateRight: 'clamp',
  });

  // Flash
  const flash = interpolate(frame, [0, 5, 18], [0.5, 0.2, 0], {
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
        style={{ backgroundColor: COLORS.secondary, opacity: flash }}
      />
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 82,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          transform: `scale(${slamScale})`,
          opacity: slam,
          lineHeight: 1.3,
        }}
      >
        Study = Rewards{' '}
        <span style={{ fontSize: 72 }}>🌱</span>
      </div>
    </AbsoluteFill>
  );
};

/* ─── Demo: accelerating counter + floating seeds ─── */
const DemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Accelerating count 0 → 247
  const countProgress = interpolate(frame, [0, 200], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad), // accelerates!
  });
  const seedCount = Math.floor(countProgress * 247);

  // Container entry
  const entry = spring({ frame, fps, config: SPRING.snappy });
  const entryY = interpolate(entry, [0, 1], [60, 0], {
    extrapolateRight: 'clamp',
  });

  // Glow intensity grows with count
  const glowRadius = interpolate(seedCount, [0, 247], [0, 300], {
    extrapolateRight: 'clamp',
  });
  const glowOpacity = interpolate(seedCount, [0, 247], [0, 0.15], {
    extrapolateRight: 'clamp',
  });

  // Streak bonus badge appears late
  const badgeEntry = spring({
    frame,
    fps,
    delay: 140,
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
      {/* Central glow */}
      <div
        style={{
          position: 'absolute',
          width: glowRadius * 2,
          height: glowRadius * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.secondary}40 0%, transparent 70%)`,
          opacity: glowOpacity,
        }}
      />

      {/* Floating seed particles */}
      {Array.from({ length: 14 }).map((_, i) => {
        const startFrame = 10 + i * 12;
        const elapsed = Math.max(0, frame - startFrame);
        const speed = 1.2 + (i % 3) * 0.5;
        const drift = Math.sin(i * 2.1) * 100;

        const y = interpolate(elapsed, [0, 90], [0, -400 * speed], {
          extrapolateRight: 'clamp',
        });
        const x = drift + Math.sin(elapsed * 0.06 + i) * 30;
        const alpha = interpolate(elapsed, [0, 10, 70, 90], [0, 0.7, 0.5, 0], {
          extrapolateRight: 'clamp',
        });
        const rotation = elapsed * (2 + i * 0.3);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              fontSize: 26,
              transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
              opacity: alpha,
            }}
          >
            {SEED_EMOJIS[i % SEED_EMOJIS.length]}
          </div>
        );
      })}

      {/* Counter */}
      <div
        style={{
          transform: `translateY(${entryY}px)`,
          opacity: entry,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
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
          🌱 SEEDS EARNED
        </div>
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 120,
            fontWeight: 700,
            color: COLORS.text,
            lineHeight: 1,
          }}
        >
          {seedCount}
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 22,
            color: `${COLORS.text}88`,
          }}
        >
          from one study session
        </div>
      </div>

      {/* Streak bonus badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 560,
          backgroundColor: `${COLORS.accent}22`,
          border: `1px solid ${COLORS.accent}44`,
          borderRadius: 12,
          padding: '8px 20px',
          fontFamily: FONTS.sans,
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.accent,
          transform: `scale(${badgeEntry})`,
          opacity: badgeEntry,
        }}
      >
        🔥 Streak Bonus: ×2 Seeds!
      </div>
    </AbsoluteFill>
  );
};

/* ─── Payoff: "Earn while you learn." ─── */
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
          fontSize: 66,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          transform: `scale(${scale})`,
          opacity: entry,
        }}
      >
        <Highlight delay={12}>Earn</Highlight> while you learn.
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
export const FeatureSeedRush: React.FC = () => {
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
          presentation={wipe({ direction: 'from-left' })}
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
