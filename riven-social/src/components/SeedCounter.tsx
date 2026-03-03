import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';

type SeedCounterProps = {
  from: number;
  to: number;
  label?: string;
};

export const SeedCounter: React.FC<SeedCounterProps> = ({
  from,
  to,
  label = 'seeds earned',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 60 },
  });

  const count = Math.round(interpolate(progress, [0, 1], [from, to]));

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  const scaleValue = interpolate(scale, [0, 1], [0.6, 1]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        transform: `scale(${scaleValue})`,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.serif,
          fontSize: 72,
          fontWeight: 700,
          color: COLORS.accent,
          lineHeight: 1,
        }}
      >
        🌱 {count}
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 18,
          fontWeight: 500,
          color: COLORS.text,
          opacity: 0.7,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
};
