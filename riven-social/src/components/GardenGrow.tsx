import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '../constants';

interface GardenGrowProps {
  growthPercent: number;
  dayCount?: number;
  size?: number;
}

export const GardenGrow: React.FC<GardenGrowProps> = ({
  growthPercent,
  dayCount,
  size = 300,
}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 30) * 2;

  const stemHeight = interpolate(growthPercent, [0, 30], [0, 120], {
    extrapolateRight: 'clamp',
  });

  const leaf1 = interpolate(growthPercent, [15, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const leaf2 = interpolate(growthPercent, [25, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const leaf3 = interpolate(growthPercent, [35, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const leaf4 = interpolate(growthPercent, [45, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const flowerBloom = interpolate(growthPercent, [70, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const seedlingScale = interpolate(growthPercent, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        style={{ transform: `rotate(${sway}deg)` }}
      >
        {/* Ground */}
        <ellipse
          cx={150}
          cy={280}
          rx={60}
          ry={10}
          fill={COLORS.green}
          opacity={0.3}
        />

        {/* Seedling */}
        {growthPercent < 20 && (
          <g transform={`scale(${seedlingScale})`} style={{ transformOrigin: '150px 280px' }}>
            <circle cx={150} cy={270} r={8} fill={COLORS.green} />
            <line
              x1={150} y1={270} x2={145} y2={258}
              stroke={COLORS.green} strokeWidth={2}
            />
            <line
              x1={150} y1={270} x2={155} y2={260}
              stroke={COLORS.green} strokeWidth={2}
            />
          </g>
        )}

        {/* Stem */}
        {growthPercent >= 15 && (
          <line
            x1={150}
            y1={280}
            x2={150}
            y2={280 - stemHeight}
            stroke={COLORS.green}
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}

        {/* Leaf 1 - left */}
        {leaf1 > 0 && (
          <ellipse
            cx={130}
            cy={240}
            rx={25 * leaf1}
            ry={10 * leaf1}
            fill={COLORS.green}
            transform={`rotate(-30 130 240)`}
            opacity={leaf1}
          />
        )}

        {/* Leaf 2 - right */}
        {leaf2 > 0 && (
          <ellipse
            cx={170}
            cy={220}
            rx={25 * leaf2}
            ry={10 * leaf2}
            fill={COLORS.green}
            transform={`rotate(25 170 220)`}
            opacity={leaf2 * 0.9}
          />
        )}

        {/* Leaf 3 - left upper */}
        {leaf3 > 0 && (
          <ellipse
            cx={135}
            cy={195}
            rx={20 * leaf3}
            ry={8 * leaf3}
            fill={COLORS.green}
            transform={`rotate(-20 135 195)`}
            opacity={leaf3 * 0.8}
          />
        )}

        {/* Leaf 4 - right upper */}
        {leaf4 > 0 && (
          <ellipse
            cx={165}
            cy={178}
            rx={20 * leaf4}
            ry={8 * leaf4}
            fill={COLORS.green}
            transform={`rotate(15 165 178)`}
            opacity={leaf4 * 0.7}
          />
        )}

        {/* Flower */}
        {flowerBloom > 0 && (
          <g opacity={flowerBloom}>
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <ellipse
                key={angle}
                cx={150}
                cy={280 - stemHeight - 15}
                rx={8 * flowerBloom}
                ry={16 * flowerBloom}
                fill={COLORS.accent}
                transform={`rotate(${angle} 150 ${280 - stemHeight - 15})`}
                opacity={0.85}
              />
            ))}
            <circle
              cx={150}
              cy={280 - stemHeight - 15}
              r={8 * flowerBloom}
              fill="#f5e6c8"
            />
          </g>
        )}
      </svg>

      {/* Day counter */}
      {dayCount !== undefined && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            color: COLORS.textMuted,
            backgroundColor: `${COLORS.bg}cc`,
            padding: '4px 10px',
            borderRadius: 8,
          }}
        >
          Day {dayCount}
        </div>
      )}
    </div>
  );
};
