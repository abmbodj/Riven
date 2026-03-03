import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const { fontFamily: playfairFamily } = loadPlayfair('normal', {
  weights: ['400', '700'],
  subsets: ['latin'],
});

const { fontFamily: interFamily } = loadInter('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

export const FONTS = {
  serif: playfairFamily,
  sans: interFamily,
} as const;
