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
import { GrainOverlay, Logo, CramMode, PhoneMockup } from '../components';
import {
  SPRING,
  getTypedText,
  isTypingDone,
  typingEndFrame,
  Cursor,
  Highlight,
} from '../utils';

/*
 * FeatureCramBlitz – 600 frames (10s @ 60fps)
 * Hook → Reveal → Demo → Payoff → Logo
 *
 * TransitionSeries math:
 *   scenes  = 150 + 108 + 216 + 108 + 114 = 696
 *   trans   = 24 × 4 = 96
 *   total   = 696 − 96 = 600 ✓
 */

const SCENE = { hook: 150, reveal: 108, demo: 216, payoff: 108, logo: 114 };
const T = 24;

/* ─── Hook: "Exam in 2 hours?" (typewriter) ─── */
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const HOOK = 'Exam in 2 hours?';
  const CPS = 35;

  const typed = getTypedText(HOOK, frame, fps, CPS);
  const done = isTypingDone(HOOK, frame, fps, CPS);

  // Urgent red pulse behind text
  const pulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0, 0.06], {
    extrapolateRight: 'clamp',
  });

  // Scale bump once typing finishes
  const punch = done
    ? spring({
        frame,
        fps,
        delay: typingEndFrame(HOOK, fps, CPS) + 4,
        config: SPRING.bouncy,
      })
    : 0;
  const scale = interpolate(punch, [0, 1], [1, 1.06], {
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
      <AbsoluteFill style={{ backgroundColor: '#e85d5d', opacity: pulse }} />
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 80,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          lineHeight: 1.2,
          transform: `scale(${scale})`,
          padding: '0 60px',
        }}
      >
        {typed}
        <Cursor show={!done} />
      </div>
    </AbsoluteFill>
  );
};

/* ─── Reveal: "Cram Mode." slam ─── */
const RevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({ frame, fps, config: SPRING.bouncy });
  const scale = interpolate(slam, [0, 1], [4, 1], {
    extrapolateRight: 'clamp',
  });

  // Accent flash on entry
  const flash = interpolate(frame, [0, 6, 18], [0.5, 0.2, 0], {
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
        style={{ backgroundColor: COLORS.accent, opacity: flash }}
      />
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 92,
          fontWeight: 700,
          color: COLORS.accent,
          textAlign: 'center',
          transform: `scale(${scale})`,
          opacity: slam,
        }}
      >
        Cram Mode.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Demo: Phone with CramMode + speed lines ─── */
const DemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone slide-up
  const phoneEntry = spring({ frame, fps, config: SPRING.snappy });
  const phoneY = interpolate(phoneEntry, [0, 1], [180, 0], {
    extrapolateRight: 'clamp',
  });

  // Animated progress & card count
  const progress = interpolate(frame, [0, 180], [0, 95], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const cardNum = Math.min(
    Math.floor(
      interpolate(frame, [0, 180], [1, 30], { extrapolateRight: 'clamp' }),
    ),
    30,
  );

  // Speed-line intensity grows with time
  const lineAlpha = interpolate(frame, [40, 120], [0, 0.25], {
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
      {/* Horizontal speed lines */}
      {Array.from({ length: 6 }).map((_, i) => {
        const y = 260 + i * 230;
        const w = interpolate(frame, [20, 140], [0, 300 + i * 80], {
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.quad),
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: y,
              left: '50%',
              transform: 'translateX(-50%)',
              width: w,
              height: 2,
              backgroundColor: COLORS.accent,
              opacity: lineAlpha * (0.2 + i * 0.1),
              borderRadius: 1,
            }}
          />
        );
      })}

      {/* Phone with cram UI */}
      <div
        style={{
          transform: `translateY(${phoneY}px)`,
          opacity: phoneEntry,
        }}
      >
        <PhoneMockup animateIn={false}>
          <CramMode
            currentCard={cardNum}
            totalCards={30}
            round={1}
            question="What is the capital of France?"
            progressPercent={progress}
          />
        </PhoneMockup>
      </div>

      {/* "⚡ CRAM MODE" badge */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          fontFamily: FONTS.sans,
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.accent,
          letterSpacing: 6,
          opacity: spring({ frame, fps, delay: 25, config: SPRING.smooth }),
        }}
      >
        ⚡ CRAM MODE
      </div>
    </AbsoluteFill>
  );
};

/* ─── Payoff: "Own your exam." + highlight ─── */
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
          fontSize: 68,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          transform: `scale(${scale})`,
          opacity: entry,
        }}
      >
        <Highlight delay={14}>Own</Highlight> your exam.
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
export const FeatureCramBlitz: React.FC = () => {
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
          presentation={wipe({ direction: 'from-left' })}
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
