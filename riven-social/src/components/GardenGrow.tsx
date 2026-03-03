import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';

type GardenGrowProps = {
  growthPercent: number;
  dayCount?: number;
};

export const GardenGrow: React.FC<GardenGrowProps> = ({
  growthPercent,
  dayCount,
}) => {
  const frame = useCurrentFrame();
  const g = growthPercent / 100;

  // Stem height
  const stemHeight = interpolate(g, [0, 0.3, 1], [0, 80, 280], {
    extrapolateRight: 'clamp',
  });

  // Leaves appear at different growth stages
  const leaf1 = interpolate(g, [0.2, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const leaf2 = interpolate(g, [0.35, 0.55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const leaf3 = interpolate(g, [0.5, 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const leaf4 = interpolate(g, [0.65, 0.85], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Flower bloom
  const bloom = interpolate(g, [0.75, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Gentle sway
  const sway = Math.sin(frame * 0.03) * 2 * g;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg
        width={200}
        height={340}
        viewBox="0 0 200 340"
        style={{ transform: `rotate(${sway}deg)`, transformOrigin: 'bottom center' }}
      >
        {/* Soil mound */}
        <ellipse cx={100} cy={330} rx={50} ry={10} fill="#3a2a1a" opacity={0.6} />

        {/* Stem */}
        <line
          x1={100}
          y1={330}
          x2={100}
          y2={330 - stemHeight}
          stroke={COLORS.secondary}
          strokeWidth={4}
          strokeLinecap="round"
        />

        {/* Leaf 1 — left */}
        <ellipse
          cx={80}
          cy={300}
          rx={22 * leaf1}
          ry={10 * leaf1}
          fill={COLORS.secondary}
          opacity={leaf1}
          transform={`rotate(-30, 80, 300)`}
        />

        {/* Leaf 2 — right */}
        <ellipse
          cx={120}
          cy={270}
          rx={22 * leaf2}
          ry={10 * leaf2}
          fill={COLORS.secondary}
          opacity={leaf2}
          transform={`rotate(30, 120, 270)`}
        />

        {/* Leaf 3 — left */}
        <ellipse
          cx={78}
          cy={230}
          rx={20 * leaf3}
          ry={9 * leaf3}
          fill={COLORS.secondaryLight}
          opacity={leaf3}
          transform={`rotate(-25, 78, 230)`}
        />

        {/* Leaf 4 — right */}
        <ellipse
          cx={122}
          cy={190}
          rx={18 * leaf4}
          ry={8 * leaf4}
          fill={COLORS.secondaryLight}
          opacity={leaf4}
          transform={`rotate(25, 122, 190)`}
        />

        {/* Flower / bloom */}
        {bloom > 0 && (
          <g opacity={bloom} transform={`translate(100, ${330 - stemHeight})`}>
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <ellipse
                key={angle}
                cx={0}
                cy={-14 * bloom}
                rx={8 * bloom}
                ry={14 * bloom}
                fill={COLORS.accent}
                transform={`rotate(${angle})`}
                opacity={0.85}
              />
            ))}
            <circle cx={0} cy={0} r={7 * bloom} fill={COLORS.text} />
          </g>
        )}

        {/* Seedling sprout at very beginning */}
        {g < 0.15 && (
          <g opacity={interpolate(g, [0, 0.1], [0, 1], { extrapolateRight: 'clamp' })}>
            <ellipse cx={100} cy={325} rx={6} ry={3} fill={COLORS.secondary} />
          </g>
        )}
      </svg>

      {dayCount !== undefined && (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.text,
            opacity: 0.7,
            letterSpacing: 1,
          }}
        >
          Day {dayCount}
        </div>
      )}
    </div>
  );
};
