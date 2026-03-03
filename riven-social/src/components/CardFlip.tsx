import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS, SPRINGS } from '../constants';
import { lora } from '../fonts';

interface CardFlipProps {
  front: string;
  back: string;
  flipAtFrame: number;
  width?: number;
  height?: number;
  delay?: number;
}

export const CardFlip: React.FC<CardFlipProps> = ({
  front,
  back,
  flipAtFrame,
  width = 560,
  height = 360,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flipProgress = spring({
    frame: frame - flipAtFrame - delay,
    fps,
    config: SPRINGS.snappy,
    from: 0,
    to: 180,
  });

  const showBack = flipProgress > 90;
  const rotation = flipProgress;

  const entranceOpacity = spring({
    frame: frame - delay,
    fps,
    config: SPRINGS.smooth,
    from: 0,
    to: 1,
  });

  return (
    <div
      style={{
        width,
        height,
        perspective: 1200,
        opacity: entranceOpacity,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotation}deg)`,
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            border: `2px solid ${COLORS.accent}33`,
          }}
        >
          <span
            style={{
              fontFamily: lora,
              fontSize: 28,
              color: COLORS.text,
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            {front}
          </span>
        </div>

        {/* Back face */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: COLORS.accent,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
          }}
        >
          <span
            style={{
              fontFamily: lora,
              fontSize: 26,
              color: COLORS.bg,
              textAlign: 'center',
              lineHeight: 1.4,
              fontWeight: 600,
            }}
          >
            {back}
          </span>
        </div>
      </div>
    </div>
  );
};
