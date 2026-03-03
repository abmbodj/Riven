import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, SPRINGS } from '../constants';

interface ProgressBarProps {
  percent: number;
  width?: number;
  height?: number;
  color?: string;
  bgColor?: string;
  delay?: number;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  width = 400,
  height = 8,
  color = COLORS.accent,
  bgColor = `${COLORS.text}15`,
  delay = 0,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fillProgress = spring({
    frame: frame - delay,
    fps,
    config: { ...SPRINGS.smooth, damping: 100 },
    from: 0,
    to: percent,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            color: COLORS.textMuted,
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          width,
          height,
          backgroundColor: bgColor,
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${fillProgress}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: height / 2,
          }}
        />
      </div>
    </div>
  );
};
