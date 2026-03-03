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
  DeckCard,
  ScreenShake,
} from '../components';
import { cormorant, inter } from '../fonts';

// Theme presets from the actual Riven app
const THEMES = [
  {
    name: 'Riven',
    bg: '#162a31',
    surface: '#1e3840',
    text: '#e4ddd0',
    accent: '#deb96a',
  },
  {
    name: 'Arctic Frost',
    bg: '#f0f4f8',
    surface: '#ffffff',
    text: '#1a2332',
    accent: '#3b82f6',
  },
  {
    name: 'Modern Minimal',
    bg: '#fafafa',
    surface: '#ffffff',
    text: '#18181b',
    accent: '#a855f7',
  },
  {
    name: 'Tech Innovation',
    bg: '#0f172a',
    surface: '#1e293b',
    text: '#f1f5f9',
    accent: '#22d3ee',
  },
];

// 10s = 600 frames at 60fps
export const AestheticSetup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: Hook slam (0-60 / 0-1s) */}
      <Sequence durationInFrames={60}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ScreenShake startFrame={5} intensity={8}>
            <TextReveal
              lines={['customize everything.']}
              fontSize={60}
              font="serif"
              italic
              fontWeight={700}
            />
          </ScreenShake>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Theme morphing sequence (60-480 / 1-8s) */}
      <Sequence from={60} durationInFrames={420}>
        <AbsoluteFill>
          <ThemeMorphSequence frame={frame - 60} fps={fps} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: CTA (480-600 / 8-10s) */}
      <Sequence from={480} durationInFrames={120}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            gap: 30,
          }}
        >
          <TextReveal
            lines={['make it yours']}
            fontSize={52}
            italic
          />
          <Logo showWordmark delay={20} />
        </AbsoluteFill>
      </Sequence>

      <GrainOverlay />
    </AbsoluteFill>
  );
};

const ThemeMorphSequence: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const cycleDuration = 105; // ~1.75s per theme
  const currentThemeIdx = Math.min(
    THEMES.length - 1,
    Math.floor(frame / cycleDuration)
  );
  const nextThemeIdx = Math.min(THEMES.length - 1, currentThemeIdx + 1);
  const localFrame = frame % cycleDuration;

  const theme = THEMES[currentThemeIdx];
  const nextTheme = THEMES[nextThemeIdx];

  // Morph progress between themes
  const morphProgress =
    currentThemeIdx === nextThemeIdx
      ? 0
      : interpolate(localFrame, [cycleDuration - 30, cycleDuration], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  const lerpColor = (a: string, b: string, t: number) => {
    // Simple visual blend - just use opacity crossfade
    return t < 0.5 ? a : b;
  };

  const bg = lerpColor(theme.bg, nextTheme.bg, morphProgress);
  const surface = lerpColor(theme.surface, nextTheme.surface, morphProgress);
  const text = lerpColor(theme.text, nextTheme.text, morphProgress);
  const accent = lerpColor(theme.accent, nextTheme.accent, morphProgress);

  const skins: Array<'forest' | 'midnight' | 'galaxy' | 'cherry' | 'parchment' | 'electric'> = [
    'forest',
    'midnight',
    'galaxy',
    'cherry',
    'parchment',
    'electric',
  ];
  const currentSkinIdx = currentThemeIdx % skins.length;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 30,
        padding: 60,
      }}
    >
      {/* Theme name */}
      <div
        style={{
          fontFamily: cormorant,
          fontSize: 20,
          fontWeight: 600,
          color: accent,
          letterSpacing: 3,
          textTransform: 'uppercase',
          opacity: spring({
            frame: localFrame,
            fps,
            config: SPRINGS.snappy,
            from: 0,
            to: 1,
          }),
        }}
      >
        {theme.name}
      </div>

      {/* Mock UI card */}
      <div
        style={{
          width: 600,
          backgroundColor: surface,
          borderRadius: 20,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          transform: `scale(${spring({
            frame: localFrame,
            fps,
            config: SPRINGS.snappy,
            from: 0.95,
            to: 1,
          })})`,
        }}
      >
        <div
          style={{
            fontFamily: cormorant,
            fontSize: 32,
            fontWeight: 700,
            fontStyle: 'italic',
            color: text,
          }}
        >
          Organic Chemistry
        </div>
        <div
          style={{
            fontFamily: inter,
            fontSize: 14,
            color: text,
            opacity: 0.5,
          }}
        >
          47 cards | Dr. Martinez
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              padding: '8px 20px',
              backgroundColor: accent,
              borderRadius: 8,
              fontFamily: inter,
              fontSize: 13,
              fontWeight: 600,
              color: bg,
            }}
          >
            Study
          </div>
          <div
            style={{
              padding: '8px 20px',
              backgroundColor: 'transparent',
              borderRadius: 8,
              border: `1px solid ${text}33`,
              fontFamily: inter,
              fontSize: 13,
              color: text,
              opacity: 0.6,
            }}
          >
            Test
          </div>
        </div>
      </div>

      {/* Deck skin preview */}
      <DeckCard
        title="Study Deck"
        cardCount={32}
        skin={skins[currentSkinIdx]}
        tag="Preview"
        delay={15}
        width={300}
        height={180}
      />

      {/* Color palette dots */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[bg, surface, accent, text].map((c, i) => (
          <div
            key={i}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: c,
              border: '2px solid rgba(255,255,255,0.15)',
              opacity: spring({
                frame: localFrame - i * 5,
                fps,
                config: SPRINGS.snappy,
                from: 0,
                to: 1,
              }),
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
