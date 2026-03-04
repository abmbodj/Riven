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
import {
  GrainOverlay,
  Logo,
  TextReveal,
  ScreenShake,
} from '../components';
import { inter, cormorant } from '../fonts';

// 10s = 600 frames at 60fps
export const StreakChallenge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: Hook (0-120 / 0-2s) */}
      <Sequence durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <ScreenShake startFrame={5} intensity={8}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <TextReveal
                lines={['can you beat', 'my streak?']}
                fontSize={60}
                italic
                staggerFrames={10}
              />
              <div
                style={{
                  fontSize: 48,
                  opacity: spring({
                    frame: frame - 40,
                    fps,
                    config: SPRINGS.bouncy,
                    from: 0,
                    to: 1,
                  }),
                  transform: `scale(${spring({
                    frame: frame - 40,
                    fps,
                    config: SPRINGS.bouncy,
                    from: 0.5,
                    to: 1,
                  })})`,
                }}
              >
                🔥
              </div>
            </div>
          </ScreenShake>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Streak counter climbing (120-480 / 2-8s) */}
      <Sequence from={120} durationInFrames={360}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <StreakCounter frame={frame - 120} fps={fps} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: CTA (480-540 / 8-9s) */}
      <Sequence from={480} durationInFrames={60}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TextReveal
            lines={['download riven and try']}
            fontSize={36}
            font="sans"
            color={COLORS.textMuted}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo (540-600 / 9-10s) */}
      <Sequence from={540} durationInFrames={60}>
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

const StreakCounter: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const streakValue = Math.min(
    30,
    Math.floor(
      spring({
        frame,
        fps,
        config: { damping: 80, stiffness: 40 },
        from: 1,
        to: 30,
      })
    )
  );

  // Color shift from cool to warm
  const warmth = streakValue / 30;
  const glowColor = warmth > 0.7 ? '#ff6b35' : warmth > 0.4 ? '#deb96a' : '#8fa6a8';

  // Fire particles
  const fireParticles = Array.from({ length: 18 }).map((_, i) => {
    const speed = 0.5 + (i % 3) * 0.3;
    const angle = (frame * speed * 0.02 + i * 0.35) * Math.PI * 2;
    const radius = 120 + Math.sin(i * 1.2 + frame * 0.05) * 60;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius - frame * 0.3;
    const particleOpacity = interpolate(
      streakValue,
      [0, 5, 15, 30],
      [0, 0.2, 0.5, 0.8]
    );
    const size = 8 + (i % 4) * 4;

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `calc(50% + ${x}px)`,
          top: `calc(50% + ${y}px)`,
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor}, transparent)`,
          opacity: particleOpacity * (0.5 + Math.sin(frame * 0.1 + i) * 0.5),
        }}
      />
    );
  });

  // Milestone badges
  const milestones = [
    { value: 3, label: '3-day', showAt: 60 },
    { value: 7, label: '1 week', showAt: 120 },
    { value: 14, label: '2 weeks', showAt: 200 },
    { value: 30, label: '30 days!', showAt: 300 },
  ];

  // Screen shake on milestones
  const currentMilestone = [...milestones].reverse().find(
    (m: { value: number; label: string; showAt: number }) => frame >= m.showAt && frame < m.showAt + 15
  );
  const shakeX = currentMilestone
    ? Math.sin((frame - currentMilestone.showAt) * 2) *
      6 *
      (1 - (frame - currentMilestone.showAt) / 15)
    : 0;

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
        transform: `translateX(${shakeX}px)`,
      }}
    >
      {/* Glow background */}
      <div
        style={{
          position: 'absolute',
          width: 350,
          height: 350,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor}20 0%, transparent 70%)`,
          opacity: warmth,
        }}
      />

      {fireParticles}

      {/* Fire emoji */}
      <div
        style={{
          fontSize: 64 + warmth * 24,
          marginBottom: 16,
          transform: `scale(${1 + Math.sin(frame * 0.15) * 0.05 * warmth})`,
        }}
      >
        🔥
      </div>

      {/* Streak number */}
      <div
        style={{
          fontFamily: cormorant,
          fontSize: 120,
          fontWeight: 700,
          color: COLORS.accent,
          lineHeight: 1,
          textShadow: `0 0 40px ${glowColor}60`,
        }}
      >
        {streakValue}
      </div>

      <div
        style={{
          fontFamily: inter,
          fontSize: 18,
          color: COLORS.textMuted,
          fontWeight: 500,
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginTop: 8,
        }}
      >
        day streak
      </div>

      {/* Milestone badges */}
      {milestones.map((m) => {
        if (frame < m.showAt) return null;
        const badgeEntrance = spring({
          frame: frame - m.showAt,
          fps,
          config: SPRINGS.bouncy,
          from: 0,
          to: 1,
        });
        const badgeFade = interpolate(
          frame - m.showAt,
          [0, 40, 60],
          [1, 1, 0],
          { extrapolateRight: 'clamp' }
        );
        return (
          <div
            key={m.value}
            style={{
              position: 'absolute',
              top: 280,
              backgroundColor: `${COLORS.surface}ee`,
              borderRadius: 20,
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: badgeEntrance * badgeFade,
              transform: `scale(${badgeEntrance}) translateY(${(1 - badgeEntrance) * -20}px)`,
              border: `1px solid ${COLORS.accent}44`,
            }}
          >
            <span style={{ fontSize: 18 }}>🏆</span>
            <span
              style={{
                fontFamily: inter,
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.text,
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
