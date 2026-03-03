import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond';
import { loadFont as loadLora } from '@remotion/google-fonts/Lora';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';

export const { fontFamily: cormorant } = loadCormorant({
  weights: ['400', '600', '700'],
  subsets: ['latin'],
  styles: ['normal', 'italic'],
});

export const { fontFamily: lora } = loadLora({
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
  styles: ['normal', 'italic'],
});

export const { fontFamily: inter } = loadInter({
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

export const { fontFamily: jetbrains } = loadJetBrainsMono({
  weights: ['400', '500'],
  subsets: ['latin'],
});
