import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { COLORS } from '../constants';
import { FONTS } from '../fonts';
import { GrainOverlay } from '../components/GrainOverlay';
import { GardenGrow } from '../components/GardenGrow';

/**
 * GardenLoop — 15s (900 frames @ 60fps)
 * Pure visual plant growth Day 1 → Day 30
 * Satisfying aesthetic loop, no text needed
 *
 * 0:00–0:15 (0-900) Continuous plant growth with day counter
 */
export const GardenLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Growth from 0-100% over the full duration, eased
  const growthRaw = interpolate(frame, [0, 850], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Apply a gentle ease-in-out curve
  const growth = interpolate(
    Math.sin((growthRaw / 100) * Math.PI * 0.5),
    [0, 1],
    [0, 100]
  );

  // Day counter: 1 → 30
  const dayCount = Math.max(
    1,
    Math.round(
      interpolate(frame, [0, 850], [1, 30], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    )
  );

  // Gentle ambient sway for the whole scene
  const sway = interpolate(
    Math.sin(frame * 0.015),
    [-1, 1],
    [-1.5, 1.5]
  );

  // Subtle scale breathing
  const breathe = interpolate(
    Math.sin(frame * 0.02),
    [-1, 1],
    [0.98, 1.02]
  );

  // Title fade in at start
  const titleOpacity = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  // Fade out at the very end for seamless loop
  const fadeOut = interpolate(frame, [840, 900], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Subtle title at top */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONTS.serif,
          fontSize: 36,
          color: COLORS.text,
          opacity: titleOpacity * 0.6 * fadeOut,
          letterSpacing: '0.15em',
        }}
      >
        your garden is growing
      </div>

      {/* Main garden area */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: fadeOut,
        }}
      >
        <div
          style={{
            transform: `rotate(${sway}deg) scale(${breathe})`,
            transformOrigin: 'center bottom',
          }}
        >
          <GardenGrow growthPercent={growth} dayCount={dayCount} />
        </div>
      </AbsoluteFill>

      {/* Ambient particles — floating seeds/leaves */}
      {Array.from({ length: 8 }, (_, i) => {
        const particleFrame = (frame + i * 112) % 900;
        const px = 200 + Math.sin(i * 2.3) * 340;
        const py = interpolate(particleFrame, [0, 900], [1920, -100]);
        const rot = interpolate(particleFrame, [0, 900], [0, 360 + i * 45]);
        const particleOpacity = interpolate(
          particleFrame,
          [0, 100, 800, 900],
          [0, 0.4, 0.4, 0]
        );

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              fontSize: 20,
              opacity: particleOpacity * fadeOut,
              transform: `rotate(${rot}deg)`,
              pointerEvents: 'none',
            }}
          >
            {i % 3 === 0 ? '🌱' : i % 3 === 1 ? '🍃' : '✨'}
          </div>
        );
      })}

      <GrainOverlay />
    </AbsoluteFill>
  );
};
