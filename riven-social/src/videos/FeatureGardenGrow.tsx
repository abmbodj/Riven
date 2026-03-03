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
import { GrainOverlay, Logo, GardenGrow } from '../components';
import {
  SPRING,
  getTypedText,
  isTypingDone,
  typingEndFrame,
  Cursor,
  Highlight,
} from '../utils';

/*
 * FeatureGardenGrow – 480 frames (8s @ 60fps)
 * Hook → Reveal → Demo → Payoff → Logo
 *
 * TransitionSeries math:
 *   scenes  = 108 + 90 + 168 + 96 + 90 = 552
 *   trans   = 18 × 4 = 72
 *   total   = 552 − 72 = 480 ✓
 */

const SCENE = { hook: 108, reveal: 90, demo: 168, payoff: 96, logo: 90 };
const T = 18;

/* ─── Hook: "Every card you study…" (typewriter) ─── */
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TEXT = 'Every card you study...';
  const CPS = 22;

  const typed = getTypedText(TEXT, frame, fps, CPS);
  const done = isTypingDone(TEXT, frame, fps, CPS);

  // Soft green glow that fades in
  const glowOpacity = interpolate(frame, [0, 60], [0, 0.08], {
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
        style={{ backgroundColor: COLORS.secondary, opacity: glowOpacity }}
      />
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 68,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          lineHeight: 1.3,
          padding: '0 60px',
        }}
      >
        {typed}
        <Cursor show={!done} />
      </div>
    </AbsoluteFill>
  );
};

/* ─── Reveal: "…grows your garden 🌱" ─── */
const RevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({ frame, fps, config: SPRING.snappy });
  const y = interpolate(entry, [0, 1], [40, 0], {
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
          fontSize: 64,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          lineHeight: 1.3,
          transform: `translateY(${y}px)`,
          opacity: entry,
        }}
      >
        …<Highlight color={COLORS.secondary} delay={8}>grows</Highlight> your
        garden 🌱
      </div>
    </AbsoluteFill>
  );
};

/* ─── Demo: Garden growing 0→100 + sparkles ─── */
const DemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Growth from 0% to 100% over first ~140 frames
  const growthPercent = interpolate(frame, [0, 140], [0, 100], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Day counter
  const dayCount = Math.floor(
    interpolate(frame, [0, 140], [1, 30], { extrapolateRight: 'clamp' }),
  );

  // Garden entry spring
  const gardenEntry = spring({ frame, fps, config: SPRING.snappy });
  const gardenScale = interpolate(gardenEntry, [0, 1], [0.8, 1], {
    extrapolateRight: 'clamp',
  });

  // Completion burst when 100%
  const burstSpring =
    growthPercent >= 99
      ? spring({ frame, fps, delay: 142, config: SPRING.bouncy })
      : 0;
  const burstScale = interpolate(burstSpring, [0, 1], [1, 1.08], {
    extrapolateRight: 'clamp',
  });

  // Sparkle particles
  const sparkles = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const startFrame = 80 + i * 5;
    const progress = interpolate(frame, [startFrame, startFrame + 40], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const dist = interpolate(progress, [0, 1], [60, 200], {
      extrapolateRight: 'clamp',
    });
    const sparkleOpacity = interpolate(progress, [0, 0.3, 1], [0, 1, 0], {
      extrapolateRight: 'clamp',
    });
    return { angle, dist, opacity: sparkleOpacity };
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
      }}
    >
      {/* Background glow based on growth */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 60%, ${COLORS.secondary}${Math.floor(growthPercent * 0.15).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        }}
      />

      {/* Garden */}
      <div
        style={{
          transform: `scale(${gardenScale * burstScale})`,
          opacity: gardenEntry,
        }}
      >
        <GardenGrow growthPercent={growthPercent} dayCount={dayCount} />
      </div>

      {/* Sparkles */}
      {sparkles.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: COLORS.accent,
            transform: `translate(${Math.cos(s.angle) * s.dist}px, ${Math.sin(s.angle) * s.dist}px)`,
            opacity: s.opacity,
            boxShadow: `0 0 6px ${COLORS.accent}`,
          }}
        />
      ))}

      {/* Day badge */}
      <div
        style={{
          position: 'absolute',
          top: 320,
          fontFamily: FONTS.sans,
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.secondary,
          letterSpacing: 5,
          opacity: spring({ frame, fps, delay: 20, config: SPRING.smooth }),
        }}
      >
        🌿 DAY {dayCount}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Payoff: "Watch knowledge bloom." ─── */
const PayoffScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({ frame, fps, config: SPRING.bouncy });
  const scale = interpolate(entry, [0, 1], [2, 1], {
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
          fontSize: 62,
          fontWeight: 700,
          color: COLORS.accent,
          textAlign: 'center',
          lineHeight: 1.2,
          transform: `scale(${scale})`,
          opacity: entry,
        }}
      >
        Watch knowledge{'\n'}
        <Highlight delay={12}>bloom</Highlight>.
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
export const FeatureGardenGrow: React.FC = () => {
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
        <TransitionSeries.Sequence durationInFrames={SCENE.reveal}>
          <RevealScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-bottom' })}
          timing={springTiming({ config: SPRING.smooth, durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE.demo}>
          <DemoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: T })}
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
