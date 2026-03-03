import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';

type CramModeProps = {
  currentCard?: number;
  totalCards?: number;
  round?: number;
  question?: string;
  progressPercent?: number;
};

export const CramMode: React.FC<CramModeProps> = ({
  currentCard = 18,
  totalCards = 28,
  round = 2,
  question = 'What is the mitochondria?',
  progressPercent = 64,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Progress bar fill
  const barProgress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 60 },
  });
  const barWidth = interpolate(barProgress, [0, 1], [0, progressPercent]);

  // Card entrance
  const cardEntrance = spring({
    frame,
    fps,
    delay: 10,
    config: { damping: 14, stiffness: 120 },
  });
  const cardScale = interpolate(cardEntrance, [0, 1], [0.8, 1]);
  const cardOpacity = interpolate(cardEntrance, [0, 1], [0, 1]);

  // Swipe arrows pulse
  const pulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.4, 0.8]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '80px 40px 40px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 16,
            fontWeight: 600,
            color: COLORS.accent,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Round {round}
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 16,
            fontWeight: 500,
            color: COLORS.text,
            opacity: 0.6,
          }}
        >
          {currentCard}/{totalCards}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          height: 6,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 3,
          marginBottom: 60,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: '100%',
            backgroundColor: COLORS.accent,
            borderRadius: 3,
          }}
        />
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          height: 320,
          backgroundColor: COLORS.text,
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          transform: `scale(${cardScale})`,
          opacity: cardOpacity,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 28,
            fontWeight: 700,
            color: COLORS.background,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          {question}
        </div>
      </div>

      {/* Swipe hints */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: 420,
          marginTop: 40,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 28,
            color: '#e05555',
            opacity: pulse,
          }}
        >
          ← Skip
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 28,
            color: COLORS.secondary,
            opacity: pulse,
          }}
        >
          Got it →
        </div>
      </div>
    </div>
  );
};
