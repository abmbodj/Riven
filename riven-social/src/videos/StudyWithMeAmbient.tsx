import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS, SPRINGS } from '../constants';
import {
  GrainOverlay,
  CardFlip,
  GardenGrow,
  ProgressBar,
} from '../components';
import { inter, cormorant, lora } from '../fonts';

const CARDS = [
  { front: 'What is the mitochondria?', back: 'The powerhouse of the cell' },
  { front: 'Define osmosis', back: 'Movement of water across a semipermeable membrane' },
  { front: 'What is Newton\'s 2nd law?', back: 'F = ma (Force equals mass times acceleration)' },
  { front: 'Define photosynthesis', back: '6CO2 + 6H2O → C6H12O6 + 6O2' },
  { front: 'What is the Krebs cycle?', back: 'Series of reactions producing ATP from acetyl-CoA' },
  { front: 'Define entropy', back: 'Measure of disorder in a system' },
  { front: 'What is meiosis?', back: 'Cell division producing 4 haploid cells' },
  { front: 'Define pH', back: 'Negative log of hydrogen ion concentration' },
  { front: 'What is Avogadro\'s number?', back: '6.022 × 10²³ particles per mole' },
  { front: 'Define equilibrium', back: 'State where forward and reverse rates are equal' },
];

// 60s = 3600 frames at 60fps
export const StudyWithMeAmbient: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalFrames = 3600;
  const cardCycleLength = 300; // 5s per card
  const currentCardIndex = Math.floor(frame / cardCycleLength) % CARDS.length;
  const cardLocalFrame = frame % cardCycleLength;
  const card = CARDS[currentCardIndex];

  // Timer
  const totalSeconds = Math.floor(frame / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Progress
  const overallProgress = (frame / totalFrames) * 100;

  // Seeds earned (1 per card completed)
  const seedCount = Math.floor(frame / cardCycleLength);

  // Garden growth
  const gardenGrowth = interpolate(frame, [0, totalFrames], [5, 90], {
    extrapolateRight: 'clamp',
  });

  // Ambient glow breathing
  const breathe = Math.sin(frame / 120) * 0.3 + 0.7;

  // Watermark fade in
  const watermarkOpacity = interpolate(frame, [120, 180], [0, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.accent}08 0%, transparent 70%)`,
          opacity: breathe,
        }}
      />

      {/* Timer - top right */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 60,
          fontFamily: inter,
          fontSize: 28,
          fontWeight: 500,
          color: COLORS.textMuted,
          opacity: 0.7,
          letterSpacing: 2,
        }}
      >
        {timerText}
      </div>

      {/* Seed count - top left */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: inter,
          fontSize: 24,
          fontWeight: 600,
          color: COLORS.accent,
          opacity: 0.8,
        }}
      >
        🌱 {seedCount}
      </div>

      {/* Center card area */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <CardFlip
          front={card.front}
          back={card.back}
          flipAtFrame={150}
          width={620}
          height={380}
          delay={0}
          key={currentCardIndex}
        />
      </div>

      {/* Progress bar below card */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <div
          style={{
            width: 620,
            height: 4,
            backgroundColor: `${COLORS.text}10`,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${overallProgress}%`,
              height: '100%',
              backgroundColor: COLORS.accent,
              borderRadius: 2,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <span
            style={{
              fontFamily: inter,
              fontSize: 12,
              color: COLORS.textMuted,
              opacity: 0.5,
            }}
          >
            {currentCardIndex + 1}/{CARDS.length}
          </span>
          <span
            style={{
              fontFamily: inter,
              fontSize: 12,
              color: COLORS.textMuted,
              opacity: 0.5,
            }}
          >
            {Math.round(overallProgress)}%
          </span>
        </div>
      </div>

      {/* Mini garden - bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          right: 40,
          transform: 'scale(0.5)',
          transformOrigin: 'bottom right',
          opacity: 0.8,
        }}
      >
        <GardenGrow growthPercent={gardenGrowth} size={250} />
      </div>

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: cormorant,
          fontSize: 18,
          fontStyle: 'italic',
          color: COLORS.textMuted,
          opacity: watermarkOpacity,
          letterSpacing: 4,
        }}
      >
        studying with riven
      </div>

      <GrainOverlay />
    </AbsoluteFill>
  );
};
