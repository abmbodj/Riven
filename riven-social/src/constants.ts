// Riven brand constants
export const COLORS = {
  background: '#1a2535',
  backgroundDark: '#111a27',
  text: '#f5f0e8',
  accent: '#c8a96e',
  secondary: '#4a7c6f',
  secondaryLight: '#5a9c8a',
  cardShadow: 'rgba(0, 0, 0, 0.4)',
} as const;

export const SKINS = {
  forest: {
    bg: '#f5f0e8',
    clip: '#4a7c6f',
    text: '#1a2535',
    label: 'Forest',
  },
  midnight: {
    bg: '#2a2f3d',
    clip: '#1a1f2d',
    text: '#f5f0e8',
    label: 'Midnight',
  },
  galaxy: {
    bg: '#0d1117',
    clip: '#c8a96e',
    text: '#ffffff',
    label: 'Galaxy',
  },
  cherry: {
    bg: '#fdf0f3',
    clip: '#d4758c',
    text: '#1a2535',
    label: 'Cherry Blossom',
  },
  parchment: {
    bg: '#e8dcc8',
    clip: '#8b6f47',
    text: '#1a2535',
    label: 'Parchment',
  },
  electric: {
    bg: '#fefef4',
    clip: '#e6d500',
    text: '#1a2535',
    label: 'Electric',
  },
} as const;

export type SkinName = keyof typeof SKINS;
