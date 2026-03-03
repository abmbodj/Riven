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
import { TextReveal } from '../components/TextReveal';
import { CramMode } from '../components/CramMode';
import { SeedCounter } from '../components/SeedCounter';
import { GardenGrow } from '../components/GardenGrow';
import { Logo } from '../components/Logo';

/**
 * ExamPanic — 30s (1800 frames @ 60fps)
 * Relatable student panic → Riven solves it
 *
 * 0:00–0:05 (0-300)    Panic text reveals
 * 0:05–0:15 (300-900)  Cram mode activates
 * 0:15–0:22 (900-1320) Session complete + seeds
 * 0:22–0:27 (1320-1620) Garden plant pulses
 * 0:27–0:30 (1620-1800) Logo CTA
 */
export const ExamPanic: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Scene 1: Panic text (0-300) ---
  // --- Scene 2: Cram Mode (300-900) ---
  const cramProgress = interpolate(frame, [300, 880], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cramCard = Math.min(
    28,
    Math.floor(interpolate(frame, [300, 880], [1, 28], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }))
  );
  const cramRound = cramCard > 14 ? 2 : 1;
  const cramQuestion = [
    'Mitochondria is the _____ of the cell',
    'The powerhouse converts glucose to ___',
    'ATP stands for adenosine _____',
    'Cellular respiration occurs in the ___',
    'Photosynthesis produces ___ and ___',
  ][Math.floor(frame / 60) % 5];

  // --- Scene 3: Session complete (900-1320) ---
  const completeScale = spring({
    frame: frame - 900,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // --- Scene 4: Garden (1320-1620) ---
  const gardenGrowth = interpolate(frame, [1320, 1580], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gardenPulse = interpolate(
    Math.sin((frame - 1320) * 0.08),
    [-1, 1],
    [0.95, 1.05]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Scene 1: Panic text */}
      <Sequence from={0} durationInFrames={300} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 80,
          }}
        >
          <TextReveal
            lines={['exam in 3 hours 😭', '28 cards', "haven't studied once"]}
            staggerFrames={40}
            fontSize={64}
            align="center"
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Cram mode */}
      <Sequence from={300} durationInFrames={600} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          {/* Dramatic cram activation text */}
          <div
            style={{
              position: 'absolute',
              top: 160,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: FONTS.serif,
              fontSize: 42,
              color: COLORS.accent,
              letterSpacing: '0.15em',
              textTransform: 'uppercase' as const,
              opacity: interpolate(frame - 300, [0, 30], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            ⚡ CRAM MODE
          </div>
          <CramMode
            currentCard={cramCard}
            totalCards={28}
            round={cramRound}
            question={cramQuestion}
            progressPercent={cramProgress}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Session complete + seeds */}
      <Sequence from={900} durationInFrames={420} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              transform: `scale(${completeScale})`,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: FONTS.serif,
                fontSize: 72,
                color: COLORS.accent,
                marginBottom: 30,
              }}
            >
              Session Complete ✨
            </div>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 48,
                color: COLORS.text,
                marginBottom: 60,
              }}
            >
              26/28 correct
            </div>
            <SeedCounter from={0} to={30} label="seeds earned" />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Garden grows + pulses */}
      <Sequence from={1320} durationInFrames={300} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div style={{ transform: `scale(${gardenPulse})` }}>
            <GardenGrow growthPercent={gardenGrowth} dayCount={7} />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 5: Logo CTA */}
      <Sequence from={1620} durationInFrames={180} premountFor={30}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Logo showWordmark animateIn tagline="Download Riven" />
          <div
            style={{
              position: 'absolute',
              bottom: 200,
              fontFamily: FONTS.sans,
              fontSize: 28,
              color: COLORS.text,
              opacity: spring({
                frame: frame - 1660,
                fps,
                config: { damping: 200 },
              }),
              letterSpacing: '0.1em',
            }}
          >
            App Store · Google Play
          </div>
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
