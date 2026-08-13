'use client';

import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textClassName?: string;
}

export function ClassPodLogo({
  className = '',
  size = 'md',
  showText = true,
  textClassName = '',
}: LogoProps) {
  const sizeMap = {
    sm: { icon: 'h-6 w-6', text: 'text-base font-bold' },
    md: { icon: 'h-8 w-8', text: 'text-lg font-extrabold' },
    lg: { icon: 'h-10 w-10', text: 'text-xl font-black' },
    xl: { icon: 'h-14 w-14', text: 'text-2xl font-black' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Brand Icon Badge */}
      <div
        className={`relative flex items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-blue-500 text-white shadow-md shadow-primary/20 ${currentSize.icon}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[60%] w-[60%]"
        >
          {/* Signal waves / Smart Classroom beacon symbol */}
          <path d="M4 11a8 8 0 0 1 16 0" />
          <path d="M7 14a4 4 0 0 1 10 0" />
          <circle cx="12" cy="18" r="1.5" fill="currentColor" />
        </svg>
      </div>

      {showText && (
        <span
          className={`tracking-tight text-foreground bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text ${currentSize.text} ${textClassName}`}
        >
          Class<span className="text-primary">Pod</span>
        </span>
      )}
    </div>
  );
}
