import React from 'react';
import { useCurrentFrame } from 'remotion';

interface ScreenShakeProps {
  children: React.ReactNode;
  startFrame: number;
  duration?: number;
  intensity?: number;
}

export const ScreenShake: React.FC<ScreenShakeProps> = ({
  children,
  startFrame,
  duration = 12,
  intensity = 8,
}) => {
  const frame = useCurrentFrame();
  const shakeFrame = frame - startFrame;

  let x = 0;
  let y = 0;

  if (shakeFrame >= 0 && shakeFrame < duration) {
    const decay = 1 - shakeFrame / duration;
    x = Math.sin(shakeFrame * 1.5) * intensity * decay;
    y = Math.cos(shakeFrame * 2) * intensity * decay * 0.5;
  }

  return (
    <div style={{ transform: `translate(${x}px, ${y}px)` }}>{children}</div>
  );
};
