import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS, SPRINGS } from '../constants';
import { cormorant, inter } from '../fonts';

interface SeedCounterProps {
  from: number;
  to: number;
  label?: string;
  delay?: number;
  fontSize?: number;
}

export const SeedCounter: React.FC<SeedCounterProps> = ({
  from,
  to,
  label,
  delay = 0,
  fontSize = 72,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRINGS.smooth,
    from: 0,
    to: 1,
  });

  const value = Math.round(interpolate(progress, [0, 1], [from, to]));

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: SPRINGS.snappy,
    from: 0,
    to: 1,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        opacity: entrance,
        transform: `scale(${0.8 + entrance * 0.2})`,
      }}
    >
      <div
        style={{
          fontFamily: cormorant,
          fontSize,
          fontWeight: 700,
          color: COLORS.accent,
          lineHeight: 1,
        }}
      >
        <span style={{ marginRight: 8 }}>🌱</span>
        {value}
      </div>
      {label && (
        <div
          style={{
            fontFamily: inter,
            fontSize: 18,
            color: COLORS.textMuted,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
