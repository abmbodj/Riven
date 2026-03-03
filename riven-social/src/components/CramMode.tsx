import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, SPRINGS } from '../constants';
import { cormorant, inter, lora } from '../fonts';

interface CramModeProps {
  currentCard: number;
  totalCards: number;
  round?: number;
  question: string;
  progressPercent: number;
}

export const CramMode: React.FC<CramModeProps> = ({
  currentCard,
  totalCards,
  round = 1,
  question,
  progressPercent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardEntrance = spring({
    frame,
    fps,
    config: SPRINGS.snappy,
    from: 0,
    to: 1,
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        padding: '60px 24px 24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: inter,
            fontSize: 14,
            color: COLORS.textMuted,
            fontWeight: 500,
          }}
        >
          Round {round}
        </span>
        <span
          style={{
            fontFamily: inter,
            fontSize: 14,
            color: COLORS.textMuted,
          }}
        >
          {currentCard}/{totalCards}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          height: 4,
          backgroundColor: `${COLORS.text}15`,
          borderRadius: 2,
          marginBottom: 40,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            backgroundColor: COLORS.accent,
            borderRadius: 2,
            transition: 'width 0.3s',
          }}
        />
      </div>

      {/* Card */}
      <div
        style={{
          flex: 1,
          backgroundColor: COLORS.surface,
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          border: `1px solid ${COLORS.accent}22`,
          transform: `scale(${cardEntrance}) translateY(${(1 - cardEntrance) * 20}px)`,
          opacity: cardEntrance,
        }}
      >
        <span
          style={{
            fontFamily: lora,
            fontSize: 24,
            color: COLORS.text,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          {question}
        </span>
      </div>

      {/* Swipe hints */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 24,
          padding: '0 20px',
        }}
      >
        <span
          style={{
            fontFamily: inter,
            fontSize: 14,
            color: COLORS.red,
            opacity: 0.6 + Math.sin(frame / 20) * 0.3,
          }}
        >
          Skip
        </span>
        <span
          style={{
            fontFamily: inter,
            fontSize: 14,
            color: COLORS.green,
            opacity: 0.6 + Math.sin(frame / 20) * 0.3,
          }}
        >
          Got it
        </span>
      </div>
    </div>
  );
};
