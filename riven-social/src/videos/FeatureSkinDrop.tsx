import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
} from 'remotion';
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { COLORS, SKINS, SkinName } from '../constants';
import { FONTS } from '../fonts';
import { GrainOverlay, Logo, DeckCard } from '../components';
import { SPRING, getTypedText, isTypingDone, Cursor, Highlight } from '../utils';

/*
 * FeatureSkinDrop – 480 frames (8s @ 60fps)
 * Hook → Skin Showcase → Payoff → Logo
 *
 * TransitionSeries math:
 *   scenes  = 120 + 240 + 100 + 80 = 540
 *   trans   = 20 × 3 = 60
 *   total   = 540 − 60 = 480 ✓
 */

const SCENE = { hook: 120, showcase: 240, payoff: 100, logo: 80 };
const T = 20;

const SKIN_ORDER: SkinName[] = [
  'midnight',
  'galaxy',
  'forest',
  'cherry',
  'electric',
  'parchment',
];
const SKIN_LABELS: Record<SkinName, string> = {
  midnight: 'Midnight',
  galaxy: 'Galaxy',
  forest: 'Forest',
  cherry: 'Cherry',
  electric: 'Electric',
  parchment: 'Parchment',
};

/* ─── Hook: "Your deck. Your style." ─── */
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Line 1: typewriter
  const L1 = 'Your deck.';
  const CPS = 28;
  const typed1 = getTypedText(L1, frame, fps, CPS);
  const done1 = isTypingDone(L1, frame, fps, CPS);

  // Line 2: slam in after line 1 finishes
  const line2Delay = Math.ceil((L1.length / CPS) * fps) + 10;
  const line2Spring = spring({
    frame,
    fps,
    delay: line2Delay,
    config: SPRING.bouncy,
  });
  const line2Scale = interpolate(line2Spring, [0, 1], [3, 1], {
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
      {/* Line 1 */}
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 72,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        {typed1}
        <Cursor show={!done1} />
      </div>

      {/* Line 2: slams in */}
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 72,
          fontWeight: 700,
          color: COLORS.accent,
          textAlign: 'center',
          transform: `scale(${line2Scale})`,
          opacity: line2Spring,
        }}
      >
        Your style.
      </div>
    </AbsoluteFill>
  );
};

/* ─── Showcase: 6 skins cycling ─── */
const ShowcaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const SKIN_DUR = 36; // frames per skin visible
  const TRANS_DUR = 4; // frames for flash transition

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
      }}
    >
      {SKIN_ORDER.map((skinName, i) => {
        const skinStart = i * SKIN_DUR;
        const skinEnd = skinStart + SKIN_DUR;

        // Visibility window
        if (frame < skinStart || frame >= skinEnd + TRANS_DUR) return null;

        // Entry spring (from frame relative to skinStart)
        const relFrame = frame - skinStart;
        const entrySpring = spring({
          frame: relFrame,
          fps,
          config: SPRING.snappy,
        });
        const scale = interpolate(entrySpring, [0, 1], [0.6, 1], {
          extrapolateRight: 'clamp',
        });

        // Exit flash
        const exitAlpha =
          relFrame >= SKIN_DUR - TRANS_DUR
            ? interpolate(
                relFrame,
                [SKIN_DUR - TRANS_DUR, SKIN_DUR],
                [1, 0],
                { extrapolateRight: 'clamp' },
              )
            : 1;

        const skin = SKINS[skinName];

        return (
          <AbsoluteFill
            key={skinName}
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              opacity: exitAlpha,
            }}
          >
            {/* Colored backdrop pulse */}
            <AbsoluteFill
              style={{
                background: `radial-gradient(circle at 50% 50%, ${skin.bg}33 0%, transparent 60%)`,
              }}
            />

            <div style={{ transform: `scale(${scale})` }}>
              <DeckCard
                title="Study Deck"
                cardCount={42}
                skin={skinName}
                animateIn={false}
              />
            </div>

            {/* Skin name label */}
            <div
              style={{
                position: 'absolute',
                bottom: 520,
                fontFamily: FONTS.sans,
                fontSize: 24,
                fontWeight: 700,
                color: skin.text,
                letterSpacing: 6,
                textTransform: 'uppercase',
                opacity: interpolate(relFrame, [0, 8, SKIN_DUR - 6, SKIN_DUR], [0, 1, 1, 0], {
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {SKIN_LABELS[skinName]}
            </div>
          </AbsoluteFill>
        );
      })}

      {/* Progress dots */}
      <div
        style={{
          position: 'absolute',
          bottom: 460,
          display: 'flex',
          gap: 12,
        }}
      >
        {SKIN_ORDER.map((_, i) => {
          const active = Math.floor(frame / 36) === i;
          return (
            <div
              key={i}
              style={{
                width: active ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: active ? COLORS.accent : `${COLORS.text}44`,
                transition: 'width 0.2s',
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Payoff: "6 premium skins." ─── */
const PayoffScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({ frame, fps, config: SPRING.snappy });
  const y = interpolate(entry, [0, 1], [30, 0], {
    extrapolateRight: 'clamp',
  });

  const line2 = spring({ frame, fps, delay: 18, config: SPRING.smooth });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${y}px)` }}>
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 60,
            fontWeight: 700,
            color: COLORS.text,
            opacity: entry,
          }}
        >
          <Highlight delay={10}>6 premium</Highlight> skins.
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 28,
            fontWeight: 500,
            color: `${COLORS.text}99`,
            marginTop: 20,
            opacity: line2,
          }}
        >
          More dropping soon 👀
        </div>
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
export const FeatureSkinDrop: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE.hook}>
          <HookScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-left' })}
          timing={springTiming({ config: SPRING.smooth, durationInFrames: T })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE.showcase}>
          <ShowcaseScene />
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
