import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';
import { GrainOverlay } from '../components/GrainOverlay';
import { CardFlip } from '../components/CardFlip';
import { GardenGrow } from '../components/GardenGrow';

/**
 * StudyWithMe — 60s (3600 frames @ 60fps)
 * Ambient "study with me" video. Lofi aesthetic. No urgency.
 *
 * Full 60 seconds of:
 * - Cards flipping slowly one by one
 * - Seed counter incrementing
 * - Progress bar filling gradually
 * - Garden plant slowly growing
 * - Timer running in corner
 * - Subtle watermark: "studying with riven"
 */

const STUDY_CARDS = [
  { front: 'Mitosis', back: 'Cell division producing two identical daughter cells' },
  { front: 'Osmosis', back: 'Movement of water across a semipermeable membrane' },
  { front: 'Entropy', back: 'Measure of disorder in a thermodynamic system' },
  { front: 'Catalyst', back: 'Substance that increases reaction rate without being consumed' },
  { front: 'Allele', back: 'One of two or more versions of a gene' },
  { front: 'Isotope', back: 'Atoms with same protons but different neutrons' },
  { front: 'Nucleus', back: 'Membrane-bound organelle containing genetic material' },
  { front: 'Kinesis', back: 'Non-directional movement in response to a stimulus' },
  { front: 'Synapse', back: 'Junction between two nerve cells' },
  { front: 'Genome', back: 'Complete set of genetic material in an organism' },
];

export const StudyWithMe: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slow progress over 60s
  const progress = interpolate(frame, [0, 3500], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Seed count
  const seedCount = Math.floor(
    interpolate(frame, [200, 3500], [0, 30], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  // Timer (MM:SS format)
  const totalSeconds = Math.floor(frame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Current card index (flip every ~6s = 360 frames)
  const cardCycleDuration = 360;
  const currentCardIndex = Math.floor(frame / cardCycleDuration) % STUDY_CARDS.length;
  const cardLocalFrame = frame % cardCycleDuration;
  const flipAt = 180; // Flip halfway through each card's time

  // Garden growth — very slow
  const gardenGrowth = interpolate(frame, [0, 3500], [5, 90], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Card entrance animation per cycle
  const cardEntrance = spring({
    frame: cardLocalFrame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // Breathing ambient glow
  const glowOpacity = interpolate(
    Math.sin(frame * 0.008),
    [-1, 1],
    [0.02, 0.08]
  );

  // Watermark opacity
  const watermarkOpacity = interpolate(frame, [0, 120], [0, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const card = STUDY_CARDS[currentCardIndex];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '20%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.secondary}40 0%, transparent 70%)`,
          opacity: glowOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Timer — top right */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          right: 80,
          fontFamily: FONTS.sans,
          fontSize: 32,
          color: COLORS.text,
          opacity: 0.4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {timerText}
      </div>

      {/* Seed count — top left */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 80,
          fontFamily: FONTS.sans,
          fontSize: 32,
          color: COLORS.text,
          opacity: 0.5,
        }}
      >
        🌱 {seedCount}
      </div>

      {/* Card area — center */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 800,
          opacity: cardEntrance,
          transform: `translateY(${(1 - cardEntrance) * 30}px)`,
        }}
      >
        <CardFlip
          front={card.front}
          back={card.back}
          flipAtFrame={flipAt}
        />
      </div>

      {/* Progress bar — below card */}
      <div
        style={{
          position: 'absolute',
          bottom: 500,
          left: 120,
          right: 120,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 22,
            color: COLORS.text,
            opacity: 0.5,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          {Math.round(progress)}% complete
        </div>
        <div
          style={{
            width: '100%',
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: COLORS.accent,
            }}
          />
        </div>
      </div>

      {/* Mini garden — bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: 160,
          right: 100,
          transform: 'scale(0.5)',
          transformOrigin: 'bottom right',
          opacity: 0.7,
        }}
      >
        <GardenGrow growthPercent={gardenGrowth} />
      </div>

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONTS.sans,
          fontSize: 22,
          color: COLORS.text,
          opacity: watermarkOpacity,
          letterSpacing: '0.2em',
        }}
      >
        studying with riven
      </div>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
