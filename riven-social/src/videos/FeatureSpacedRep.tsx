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
 * FeatureSpacedRep – 600 frames (10s @ 60fps)
 * Hook → Counter → Demo (Timeline) → Payoff → Logo
 *
 * TransitionSeries math:
 *   scenes  = 150 + 100 + 220 + 120 + 90 = 680
 *   trans   = 20 × 4 = 80
 *   total   = 680 − 80 = 600 ✓
 */

const SCENE = { hook: 150, counter: 100, demo: 220, payoff: 120, logo: 90 };
const T = 20;

const INTERVALS = [
  { day: 1, label: 'Day 1' },
  { day: 3, label: 'Day 3' },
  { day: 7, label: 'Day 7' },
  { day: 14, label: 'Day 14' },
  { day: 30, label: 'Day 30' },
];

/* ─── Hook: "Your brain forgets." + shake ─── */
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const TEXT = 'Your brain forgets.';
  const CPS = 24;

  const typed = getTypedText(TEXT, frame, fps, CPS);
  const done = isTypingDone(TEXT, frame, fps, CPS);

  // Screen shake when done
  const doneFrame = typingEndFrame(TEXT, fps, CPS);
  const shakeX =
    frame > doneFrame
      ? interpolate(
          Math.sin(frame * 1.2) * Math.max(0, 1 - (frame - doneFrame) / 30),
          [-1, 1],
          [-6, 6],
          { extrapolateRight: 'clamp' },
        )
      : 0;

  // Red tint when done
  const redPulse =
    frame > doneFrame
      ? interpolate(frame, [doneFrame, doneFrame + 30], [0.12, 0], {
          extrapolateRight: 'clamp',
        })
      : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        transform: `translateX(${shakeX}px)`,
      }}
    >
      <AbsoluteFill style={{ backgroundColor: '#e85d5d', opacity: redPulse }} />
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 74,
          fontWeight: 700,
          color: '#e85d5d',
          textAlign: 'center',
          padding: '0 60px',
        }}
      >
        {typed}
        <Cursor show={!done} />
      </div>
    </AbsoluteFill>
  );
};

/* ─── Counter: "Riven doesn't." slam ─── */
const CounterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({ frame, fps, config: SPRING.bouncy });
  const slamScale = interpolate(slam, [0, 1], [4, 1], {
    extrapolateRight: 'clamp',
  });

  // Green flash
  const flash = interpolate(frame, [0, 6, 20], [0.4, 0.15, 0], {
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
          fontSize: 86,
          fontWeight: 700,
          color: COLORS.secondary,
          textAlign: 'center',
          transform: `scale(${slamScale})`,
          opacity: slam,
        }}
      >
        Riven doesn't.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Demo: Spaced repetition timeline ─── */
const DemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Overall entry
  const containerEntry = spring({ frame, fps, config: SPRING.smooth });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
      }}
    >
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 460,
          fontFamily: FONTS.sans,
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.accent,
          letterSpacing: 6,
          opacity: containerEntry,
        }}
      >
        📚 SPACED REPETITION
      </div>

      {/* Timeline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 60,
          alignItems: 'center',
          opacity: containerEntry,
        }}
      >
        {INTERVALS.map((interval, i) => {
          // Stagger each interval's entry
          const intervalDelay = 15 + i * 22;
          const intervalSpring = spring({
            frame,
            fps,
            delay: intervalDelay,
            config: SPRING.snappy,
          });

          const x = interpolate(intervalSpring, [0, 1], [80, 0], {
            extrapolateRight: 'clamp',
          });

          // Connecting line grows
          const lineProgress =
            i > 0
              ? spring({
                  frame,
                  fps,
                  delay: intervalDelay - 10,
                  config: SPRING.smooth,
                  durationInFrames: 18,
                })
              : 0;

          // Card icon pulse
          const cardPulse = spring({
            frame,
            fps,
            delay: intervalDelay + 12,
            config: SPRING.bouncy,
          });
          const cardScale = interpolate(cardPulse, [0, 1], [0, 1], {
            extrapolateRight: 'clamp',
          });

          return (
            <div key={i} style={{ position: 'relative' }}>
              {/* Connecting line above */}
              {i > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: -50,
                    left: '50%',
                    width: 2,
                    height: 40,
                    backgroundColor: `${COLORS.accent}66`,
                    transformOrigin: 'top',
                    transform: `translateX(-50%) scaleY(${lineProgress})`,
                  }}
                />
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  transform: `translateX(${x}px)`,
                  opacity: intervalSpring,
                }}
              >
                {/* Card icon */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: COLORS.accent,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transform: `scale(${cardScale})`,
                    boxShadow: `0 4px 16px ${COLORS.accent}44`,
                  }}
                >
                  <span style={{ fontSize: 20 }}>📋</span>
                </div>

                {/* Label */}
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 32,
                    fontWeight: 700,
                    color: COLORS.text,
                  }}
                >
                  {interval.label}
                </div>

                {/* Retention badge */}
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 18,
                    fontWeight: 600,
                    color: COLORS.secondary,
                    backgroundColor: `${COLORS.secondary}22`,
                    padding: '4px 12px',
                    borderRadius: 8,
                    opacity: intervalSpring,
                  }}
                >
                  {Math.round(95 - i * 2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Payoff: "Never forget again." ─── */
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
        <Highlight color={COLORS.secondary} delay={12}>
          Never forget
        </Highlight>{' '}
        again.
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
export const FeatureSpacedRep: React.FC = () => {
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
        <TransitionSeries.Sequence durationInFrames={SCENE.counter}>
          <CounterScene />
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
