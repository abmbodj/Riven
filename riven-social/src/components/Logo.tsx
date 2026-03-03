import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, SPRINGS } from '../constants';
import { cormorant } from '../fonts';

interface LogoProps {
  showWordmark?: boolean;
  tagline?: string;
  delay?: number;
  scale?: number;
}

export const Logo: React.FC<LogoProps> = ({
  showWordmark = true,
  tagline,
  delay = 0,
  scale: baseScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: frame - delay,
    fps,
    config: SPRINGS.bouncy,
    from: 0,
    to: 1,
  });

  const scaleAnim = entrance * baseScale;
  const opacity = Math.min(entrance * 2, 1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        transform: `scale(${scaleAnim})`,
        opacity,
      }}
    >
      {/* Plant + Card Logo */}
      <svg width={80} height={90} viewBox="0 0 80 90">
        {/* Card base */}
        <rect
          x={15}
          y={30}
          width={50}
          height={55}
          rx={6}
          fill={COLORS.accent}
          opacity={0.9}
        />
        <rect
          x={20}
          y={35}
          width={40}
          height={45}
          rx={4}
          fill={COLORS.bg}
        />
        {/* Plant stem */}
        <line
          x1={40}
          y1={35}
          x2={40}
          y2={10}
          stroke={COLORS.green}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Leaves */}
        <ellipse
          cx={32}
          cy={18}
          rx={10}
          ry={5}
          fill={COLORS.green}
          transform="rotate(-30 32 18)"
        />
        <ellipse
          cx={48}
          cy={22}
          rx={10}
          ry={5}
          fill={COLORS.green}
          transform="rotate(25 48 22)"
          opacity={0.8}
        />
        <ellipse
          cx={35}
          cy={28}
          rx={8}
          ry={4}
          fill={COLORS.green}
          transform="rotate(-15 35 28)"
          opacity={0.6}
        />
      </svg>

      {showWordmark && (
        <span
          style={{
            fontFamily: cormorant,
            fontSize: 56,
            fontWeight: 700,
            fontStyle: 'italic',
            color: COLORS.text,
            letterSpacing: 6,
            textTransform: 'uppercase',
          }}
        >
          Riven
        </span>
      )}

      {tagline && (
        <span
          style={{
            fontFamily: cormorant,
            fontSize: 24,
            color: COLORS.textMuted,
            fontStyle: 'italic',
            marginTop: -8,
          }}
        >
          {tagline}
        </span>
      )}
    </div>
  );
};
