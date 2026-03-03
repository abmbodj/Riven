// Riven Brand Colors
export const COLORS = {
  bg: '#162a31',
  bgDark: '#0f1f25',
  surface: '#1e3840',
  text: '#e4ddd0',
  textMuted: '#8fa6a8',
  accent: '#deb96a',
  green: '#7a9e72',
  secondary: '#8fa6a8',
  red: '#c75050',
  cardShadow: 'rgba(0, 0, 0, 0.4)',
  white: '#ffffff',
  black: '#000000',
} as const;

// Spring animation configs
export const SPRINGS = {
  smooth: { damping: 200 },
  snappy: { damping: 20, stiffness: 200 },
  bouncy: { damping: 8 },
  heavy: { damping: 15, stiffness: 80, mass: 2 },
  slam: { damping: 12, stiffness: 300 },
} as const;

// Deck skin definitions
export const SKINS = {
  forest: {
    bg: '#f5f0e0',
    clip: '#4a7c6f',
    text: '#2a3a30',
    name: 'Forest',
  },
  midnight: {
    bg: '#1a2535',
    clip: '#0f1a28',
    text: '#e4ddd0',
    name: 'Midnight',
  },
  galaxy: {
    bg: '#0d1117',
    clip: '#c8a96e',
    text: '#ffffff',
    name: 'Galaxy',
  },
  cherry: {
    bg: '#fff0f0',
    clip: '#d4728c',
    text: '#3a2030',
    name: 'Cherry Blossom',
  },
  parchment: {
    bg: '#f5ecd7',
    clip: '#8b7355',
    text: '#3a3020',
    name: 'Parchment',
  },
  electric: {
    bg: '#f8f8ff',
    clip: '#e8c840',
    text: '#2a2a3a',
    name: 'Electric',
  },
} as const;

export type SkinName = keyof typeof SKINS;

// Video dimensions (TikTok vertical)
export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 60,
} as const;

// 12 preset class colors from the app
export const CLASS_COLORS = [
  '#4f46e5', // Indigo
  '#dc2626', // Red
  '#16a34a', // Green
  '#ca8a04', // Yellow
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#db2777', // Pink
  '#4a7c6f', // Teal
  '#6366f1', // Blue
  '#84cc16', // Lime
  '#f97316', // Amber
] as const;
