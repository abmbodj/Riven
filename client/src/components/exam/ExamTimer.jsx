import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

const fmt = (s) => {
  const safe = Math.max(0, s);
  const m = Math.floor(safe / 60).toString().padStart(2, '0');
  const sec = (safe % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

// Counts down from totalSeconds and fires onExpire exactly once at zero.
// Colors shift amber under 2 min and red under 30 s.
export default function ExamTimer({ totalSeconds, running = true, onExpire }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpireRef.current?.();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const color = remaining <= 30 ? 'text-red-400' : remaining <= 120 ? 'text-yellow-400' : 'text-claude-secondary';

  return (
    <span className={`flex items-center gap-1.5 font-mono text-sm tabular-nums ${color}`}>
      <Clock className="w-3.5 h-3.5" />
      {fmt(remaining)}
    </span>
  );
}
