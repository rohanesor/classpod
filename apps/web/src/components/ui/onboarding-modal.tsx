'use client';

import { useState } from 'react';
import { Button } from './button';
import { Zap, ShieldCheck, FileSpreadsheet, ArrowRight, Check } from 'lucide-react';

interface OnboardingModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen = true, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Fast Attendance',
      subtitle: 'Instant Automated Check-in',
      description:
        'Complete classroom attendance in seconds without slow manual roll calls or paper sheets.',
      icon: Zap,
      badgeColor: 'from-amber-500/20 to-orange-500/20 text-amber-600',
      iconColor: 'text-amber-500',
    },
    {
      title: 'Verified Presence',
      subtitle: 'Multi-Signal Sensor Intelligence',
      description:
        'ClassPod combines ESP32 BLE beacons and optical verification to guarantee authentic classroom presence.',
      icon: ShieldCheck,
      badgeColor: 'from-blue-500/20 to-indigo-500/20 text-primary',
      iconColor: 'text-primary',
    },
    {
      title: 'One Classroom. One Verified Session.',
      subtitle: 'Automated Reports & Instant Dispatch',
      description:
        'When a session ends, final attendance records and Excel/PDF reports are generated and delivered automatically.',
      icon: FileSpreadsheet,
      badgeColor: 'from-emerald-500/20 to-teal-500/20 text-emerald-600',
      iconColor: 'text-emerald-500',
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('classpod_onboarding_completed', 'true');
    }
    onClose();
  };

  if (!isOpen) return null;

  const current = steps[currentStep] || steps[0];
  if (!current) return null;
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fadein">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        {/* Header with Skip option */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-6 bg-primary' : 'w-2 bg-muted'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleComplete}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Feature Icon & Illustration */}
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <div
            className={`h-20 w-20 rounded-2xl bg-gradient-to-tr ${current.badgeColor} flex items-center justify-center border shadow-inner`}
          >
            <Icon className={`h-10 w-10 ${current.iconColor}`} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {current.subtitle}
            </span>
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">
              {current.title}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {current.description}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2">
          <Button
            onClick={handleNext}
            className="w-full h-11 font-bold shadow-lg flex items-center justify-center gap-2"
          >
            <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}</span>
            {currentStep === steps.length - 1 ? (
              <Check className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
