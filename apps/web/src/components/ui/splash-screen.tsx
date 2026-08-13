'use client';

import { useState, useEffect } from 'react';
import { ClassPodLogo } from './logo';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFade(true);
      const finishTimer = window.setTimeout(onFinish, 400);
      return () => window.clearTimeout(finishTimer);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-400 ${
        fade ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
        <ClassPodLogo size="xl" showText={false} />
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Class<span className="text-primary">Pod</span>
          </h1>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Fast • Verified • Professional
          </p>
        </div>
      </div>
    </div>
  );
}
