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
  TypewriterText,
  TextReveal,
  PhoneMockup,
} from '../components';
import { inter, cormorant, lora } from '../fonts';

// 12s = 720 frames at 60fps
export const GroupStudyFOMO: React.FC = () => {
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
          <TypewriterText
            text="studying alone is so 2024"
            fontSize={50}
            font="serif"
            fontWeight={700}
            charsPerSecond={25}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Phone with group cram (120-540 / 2-9s) */}
      <Sequence from={120} durationInFrames={420}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <PhoneMockup delay={0} width={360} height={720}>
            <GroupCramScreen frame={frame - 120} fps={fps} />
          </PhoneMockup>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Payoff (540-660 / 9-11s) */}
      <Sequence from={540} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <TextReveal
            lines={['cram with your friends.', 'actually pass.']}
            fontSize={48}
            italic
            staggerFrames={12}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo (660-720 / 11-12s) */}
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

// Group cram session screen
const GroupCramScreen: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const users = [
    { name: 'Alex', color: '#4f46e5', progress: 0 },
    { name: 'Sam', color: '#dc2626', progress: 0 },
    { name: 'Jordan', color: '#16a34a', progress: 0 },
    { name: 'You', color: COLORS.accent, progress: 0 },
  ];

  const messages = [
    { from: 0, text: 'lets gooo', time: 60 },
    { from: 2, text: 'got it!', time: 120 },
    { from: 1, text: 'nice streak!', time: 200 },
    { from: 3, text: '🔥🔥🔥', time: 280 },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.bg,
        padding: '50px 16px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: cormorant,
          fontSize: 18,
          fontWeight: 700,
          fontStyle: 'italic',
          color: COLORS.text,
          textAlign: 'center',
        }}
      >
        Group Cram - Bio 201
      </div>

      {/* User progress */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          backgroundColor: COLORS.surface,
          borderRadius: 14,
          padding: 14,
        }}
      >
        {users.map((u, i) => {
          const userProgress = interpolate(
            frame,
            [0, 400],
            [0, 60 + Math.random() * 30],
            { extrapolateRight: 'clamp' }
          );
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                opacity: spring({
                  frame: frame - i * 10,
                  fps,
                  config: SPRINGS.snappy,
                  from: 0,
                  to: 1,
                }),
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  backgroundColor: u.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: inter,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {u.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 5,
                    backgroundColor: `${COLORS.text}12`,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${spring({
                        frame,
                        fps,
                        config: { damping: 200 },
                        from: 0,
                        to: userProgress,
                      })}%`,
                      height: '100%',
                      backgroundColor: u.color,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
              <span
                style={{
                  fontFamily: inter,
                  fontSize: 11,
                  color: COLORS.textMuted,
                  width: 30,
                  textAlign: 'right',
                }}
              >
                {Math.round(
                  spring({
                    frame,
                    fps,
                    config: { damping: 200 },
                    from: 0,
                    to: userProgress,
                  })
                )}
                %
              </span>
            </div>
          );
        })}
      </div>

      {/* Current card */}
      <div
        style={{
          flex: 1,
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          border: `1px solid ${COLORS.accent}22`,
        }}
      >
        <span
          style={{
            fontFamily: lora,
            fontSize: 18,
            color: COLORS.text,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          What organelle is responsible for ATP production?
        </span>
      </div>

      {/* Chat messages */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 120,
          overflow: 'hidden',
        }}
      >
        {messages.map((msg, i) => {
          const msgEntrance = spring({
            frame: frame - msg.time,
            fps,
            config: SPRINGS.snappy,
            from: 0,
            to: 1,
          });
          if (frame < msg.time) return null;
          const u = users[msg.from];
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: msgEntrance,
                transform: `translateY(${(1 - msgEntrance) * 15}px)`,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: u.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: inter,
                  fontSize: 12,
                  color: COLORS.text,
                  backgroundColor: COLORS.surface,
                  padding: '4px 10px',
                  borderRadius: 8,
                }}
              >
                {msg.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
