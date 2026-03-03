import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { COLORS, SPRINGS } from '../constants';
import { GrainOverlay, Logo, GardenGrow, TextReveal } from '../components';
import { cormorant, inter } from '../fonts';

// 12s = 720 frames at 60fps
export const GardenTransformation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: Split screen hook (0-120 frames / 0-2s) */}
      <Sequence durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div
              style={{
                fontFamily: inter,
                fontSize: 18,
                fontWeight: 600,
                color: COLORS.textMuted,
                letterSpacing: 3,
                textTransform: 'uppercase',
                opacity: spring({
                  frame,
                  fps,
                  config: SPRINGS.snappy,
                  from: 0,
                  to: 1,
                }),
              }}
            >
              Day 1
            </div>
            <GardenGrow growthPercent={0} size={280} />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Time-lapse growth (120-540 frames / 2-9s) */}
      <Sequence from={120} durationInFrames={420}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TimeLapseGarden frame={frame - 120} fps={fps} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Payoff text (540-660 frames / 9-11s) */}
      <Sequence from={540} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <TextReveal
            lines={['your garden grows', 'when you study']}
            fontSize={52}
            italic
            staggerFrames={12}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo (660-720 frames / 11-12s) */}
      <Sequence from={660} durationInFrames={60}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Logo showWordmark delay={5} />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

const TimeLapseGarden: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const growth = interpolate(frame, [0, 380], [0, 100], {
    extrapolateRight: 'clamp',
  });

  const dayCount = Math.min(30, Math.floor(interpolate(frame, [0, 380], [1, 30], {
    extrapolateRight: 'clamp',
  })));

  // Streak milestones
  const milestones = [
    { day: 3, label: '3-day streak', emoji: '🌱' },
    { day: 7, label: '1 week!', emoji: '🌿' },
    { day: 14, label: '2 weeks!', emoji: '🌳' },
    { day: 30, label: '30 days!', emoji: '🌺' },
  ];

  // Floating particles
  const particles = Array.from({ length: 8 }).map((_, i) => {
    const angle = (frame / 60 + i * 0.8) * Math.PI * 2;
    const radius = 180 + Math.sin(i * 1.5) * 40;
    const x = Math.cos(angle * 0.3 + i) * radius;
    const y = Math.sin(angle * 0.4 + i * 0.7) * radius;
    const opacity = interpolate(growth, [i * 10, i * 10 + 20, 100], [0, 0.6, 0.3], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `calc(50% + ${x}px)`,
          top: `calc(50% + ${y}px)`,
          fontSize: 16,
          opacity,
        }}
      >
        {['🌱', '🍃', '✨', '🌿'][i % 4]}
      </div>
    );
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.green}15 0%, transparent 70%)`,
          opacity: growth / 100,
        }}
      />

      {particles}

      <GardenGrow growthPercent={growth} dayCount={dayCount} size={350} />

      {/* Streak counter */}
      <div
        style={{
          position: 'absolute',
          top: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: spring({
            frame: frame - 20,
            fps,
            config: SPRINGS.snappy,
            from: 0,
            to: 1,
          }),
        }}
      >
        <span style={{ fontSize: 24 }}>🔥</span>
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: COLORS.accent,
          }}
        >
          {dayCount}
        </span>
      </div>

      {/* Milestone badges */}
      {milestones.map((m) => {
        const showAt = (m.day / 30) * 380;
        const badgeEntrance = spring({
          frame: frame - showAt,
          fps,
          config: SPRINGS.bouncy,
          from: 0,
          to: 1,
        });
        if (frame < showAt) return null;
        return (
          <div
            key={m.day}
            style={{
              position: 'absolute',
              bottom: 300 - m.day * 3,
              backgroundColor: `${COLORS.surface}ee`,
              borderRadius: 20,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: Math.min(badgeEntrance, interpolate(frame - showAt, [0, 60, 80], [1, 1, 0], {
                extrapolateRight: 'clamp',
              })),
              transform: `scale(${badgeEntrance})`,
            }}
          >
            <span style={{ fontSize: 18 }}>{m.emoji}</span>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: COLORS.text,
                fontWeight: 600,
              }}
            >
              {m.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
