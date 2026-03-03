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
  SeedCounter,
} from '../components';
import { inter, cormorant, lora } from '../fonts';

// 15s = 900 frames at 60fps
export const SyllabusDropped: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: Hook (0-180 frames / 0-3s) */}
      <Sequence durationInFrames={180}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <div style={{ transform: `scale(${1 + Math.max(0, frame - 60) * 0.0005})` }}>
            <TypewriterText
              text="professor just dropped a 12-page syllabus"
              fontSize={52}
              font="serif"
              fontWeight={700}
              charsPerSecond={25}
            />
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Phone mockup with AI extraction (180-600 frames / 3-10s) */}
      <Sequence from={180} durationInFrames={420}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <PhoneMockup delay={0} width={360} height={720}>
            <SyllabusScreen frame={frame - 180} fps={fps} />
          </PhoneMockup>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Payoff text (600-780 frames / 10-13s) */}
      <Sequence from={600} durationInFrames={180}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 60,
          }}
        >
          <TextReveal
            lines={['entire semester.', 'organized.', '10 seconds.']}
            fontSize={58}
            italic
            staggerFrames={15}
          />
          {/* Highlight underline on "10 seconds" */}
          <div
            style={{
              position: 'absolute',
              bottom: '32%',
              width: spring({
                frame: frame - 640,
                fps,
                config: SPRINGS.snappy,
                from: 0,
                to: 280,
              }),
              height: 4,
              backgroundColor: COLORS.accent,
              borderRadius: 2,
            }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: Logo CTA (780-900 frames / 13-15s) */}
      <Sequence from={780} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Logo showWordmark delay={10} />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

// AI Syllabus extraction screen inside phone
const SyllabusScreen: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  // Phase 1: Upload (0-60)
  // Phase 2: Shimmer loading (60-150)
  // Phase 3: Results cascade in (150-420)

  const assignments = [
    { title: 'Chapter 1 Reading', type: 'reading', due: 'Jan 22' },
    { title: 'Problem Set 1', type: 'homework', due: 'Jan 29' },
    { title: 'Lab Report 1', type: 'project', due: 'Feb 5' },
    { title: 'Midterm Review', type: 'exam', due: 'Feb 19' },
    { title: 'Group Presentation', type: 'project', due: 'Mar 3' },
    { title: 'Research Paper Draft', type: 'homework', due: 'Mar 15' },
    { title: 'Lab Report 2', type: 'project', due: 'Mar 22' },
    { title: 'Problem Set 5', type: 'homework', due: 'Apr 2' },
    { title: 'Final Exam', type: 'exam', due: 'Apr 28' },
  ];

  const uploadDone = frame > 60;
  const loadingDone = frame > 150;

  const counterValue = loadingDone
    ? Math.min(
        14,
        Math.floor(
          spring({
            frame: frame - 150,
            fps,
            config: SPRINGS.smooth,
            from: 0,
            to: 14,
          })
        )
      )
    : 0;

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
          fontSize: 20,
          fontWeight: 700,
          fontStyle: 'italic',
          color: COLORS.text,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        AI Syllabus Parser
      </div>

      {/* Upload zone */}
      {!loadingDone && (
        <div
          style={{
            border: `2px dashed ${COLORS.accent}66`,
            borderRadius: 12,
            padding: 20,
            textAlign: 'center',
            backgroundColor: `${COLORS.surface}88`,
          }}
        >
          <div
            style={{
              fontFamily: inter,
              fontSize: 14,
              color: uploadDone ? COLORS.green : COLORS.textMuted,
              fontWeight: 500,
            }}
          >
            {uploadDone ? 'syllabus.pdf uploaded' : 'Drop syllabus here'}
          </div>
          {uploadDone && !loadingDone && (
            <div
              style={{
                marginTop: 12,
                height: 3,
                backgroundColor: `${COLORS.text}15`,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${interpolate(frame - 60, [0, 90], [0, 100], {
                    extrapolateRight: 'clamp',
                  })}%`,
                  height: '100%',
                  backgroundColor: COLORS.accent,
                  borderRadius: 2,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Extracted class info */}
      {loadingDone && (
        <>
          <div
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 12,
              padding: 14,
              opacity: spring({
                frame: frame - 150,
                fps,
                config: SPRINGS.snappy,
                from: 0,
                to: 1,
              }),
            }}
          >
            <div
              style={{
                fontFamily: inter,
                fontSize: 11,
                color: COLORS.accent,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              Extracted
            </div>
            <div style={{ fontFamily: lora, fontSize: 16, color: COLORS.text, fontWeight: 600 }}>
              CS 201 - Data Structures
            </div>
            <div style={{ fontFamily: inter, fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
              Dr. Martinez | Room 204 | MWF 10:00-11:30
            </div>
          </div>

          {/* Assignment counter */}
          <div
            style={{
              fontFamily: inter,
              fontSize: 14,
              color: COLORS.accent,
              fontWeight: 600,
              textAlign: 'center',
              marginTop: 4,
              opacity: spring({
                frame: frame - 160,
                fps,
                config: SPRINGS.snappy,
                from: 0,
                to: 1,
              }),
            }}
          >
            {counterValue} assignments found
          </div>

          {/* Assignment list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {assignments.map((a, i) => {
              const itemEntrance = spring({
                frame: frame - 170 - i * 10,
                fps,
                config: SPRINGS.snappy,
                from: 0,
                to: 1,
              });
              return (
                <div
                  key={i}
                  style={{
                    backgroundColor: COLORS.surface,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: itemEntrance,
                    transform: `translateX(${(1 - itemEntrance) * 30}px)`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: inter,
                      fontSize: 12,
                      color: COLORS.text,
                      fontWeight: 500,
                    }}
                  >
                    {a.title}
                  </span>
                  <span
                    style={{
                      fontFamily: inter,
                      fontSize: 10,
                      color: COLORS.textMuted,
                    }}
                  >
                    {a.due}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
