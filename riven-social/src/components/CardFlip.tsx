import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';

type CardFlipProps = {
  front: string;
  back: string;
  flipAtFrame: number;
};

export const CardFlip: React.FC<CardFlipProps> = ({
  front,
  back,
  flipAtFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flipProgress = spring({
    frame: frame - flipAtFrame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const rotationY = interpolate(flipProgress, [0, 1], [0, 180]);
  const showBack = rotationY > 90;

  const cardStyle: React.CSSProperties = {
    width: 400,
    height: 260,
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    textAlign: 'center',
    backfaceVisibility: 'hidden',
    position: 'absolute',
  };

  return (
    <div
      style={{
        width: 400,
        height: 260,
        perspective: 1200,
        position: 'relative',
      }}
    >
      {/* Front */}
      <div
        style={{
          ...cardStyle,
          backgroundColor: COLORS.text,
          transform: `rotateY(${rotationY}deg)`,
          opacity: showBack ? 0 : 1,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.serif,
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.background,
          }}
        >
          {front}
        </div>
      </div>

      {/* Back */}
      <div
        style={{
          ...cardStyle,
          backgroundColor: COLORS.accent,
          transform: `rotateY(${rotationY - 180}deg)`,
          opacity: showBack ? 1 : 0,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 22,
            fontWeight: 600,
            color: COLORS.background,
          }}
        >
          {back}
        </div>
      </div>
    </div>
  );
};
