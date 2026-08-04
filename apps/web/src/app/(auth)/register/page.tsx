'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Activity, Check, ArrowRight, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Wizard state: 1 = Account Info, 2 = Survey Questions, 3 = Success Redirect
  const [step, setStep] = useState(1);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('STUDENT');

  // Onboarding questions
  const [heardFrom, setHeardFrom] = useState('');
  const [onboardingReason, setOnboardingReason] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && step < 3) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router, step]);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setStep(2);
  };

  const handleBackStep = () => {
    setError(null);
    setStep(1);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsRegistering(true);

    try {
      await register({
        name,
        email,
        password,
        role,
        heardFrom: heardFrom || undefined,
        onboardingReason: onboardingReason || undefined,
      });
      // Go to step 3 (Success)
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.');
      setIsRegistering(false);
    }
  };

  useEffect(() => {
    if (step === 3) {
      const timer = window.setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [step, router]);

  const isPending = isLoading || isRegistering;

  if (isLoading && step < 3) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Options for survey
  const heardFromOptions = [
    { label: 'Google Search', value: 'Google Search' },
    { label: 'Friend or Colleague', value: 'Word of Mouth' },
    { label: 'Social Media', value: 'Social Media' },
    { label: 'School or University', value: 'School/University' },
    { label: 'Other', value: 'Other' },
  ];

  const reasonOptions = {
    TEACHER: [
      { label: 'Automate class attendance logs', value: 'Automate attendance' },
      { label: 'Monitor local BLE gateway hubs', value: 'Monitor gateways' },
      { label: 'Analyze classroom reports', value: 'Analyze reports' },
      { label: 'General exploration', value: 'Exploration' },
    ],
    STUDENT: [
      { label: 'Automated attendance check-ins', value: 'Automated checkin' },
      { label: 'Review personal attendance logs', value: 'Review logs' },
      { label: 'Connect to classroom beacons', value: 'Connect beacons' },
      { label: 'General exploration', value: 'Exploration' },
    ],
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-12 bg-background overflow-x-hidden">
      {/* Left Column: Sign-up / Onboarding Steps */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:col-span-5 lg:px-20 xl:col-span-4 bg-background">
        <div className="mx-auto w-full max-w-sm space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-3 text-left">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Activity className="h-6 w-6" />
              </div>
              <span className="text-xl font-black tracking-tight text-foreground">ClassPod</span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                {step === 1 ? 'Create account' : step === 2 ? 'Tell us about you' : 'All set!'}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {step === 1
                  ? 'Join ClassPod to start monitoring and verifying attendance.'
                  : step === 2
                    ? 'Answer these quick questions to customize your onboarding.'
                    : 'Your account is ready. Welcome workspace...'}
              </p>
            </div>
          </div>

          {/* Step 1: Account creation form */}
          {step === 1 && (
            <div className="rounded-2xl border bg-card text-card-foreground p-6 shadow-sm">
              <form onSubmit={handleNextStep} className="flex flex-col gap-4">
                {error && (
                  <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="font-medium leading-tight">{error}</div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="name" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Choose Your Role
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setRole('STUDENT')}
                      className={`flex flex-col p-3 rounded-lg border-2 text-left transition-all ${
                        role === 'STUDENT'
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className="text-sm font-bold text-foreground">Student</span>
                      <span className="text-xs text-muted-foreground mt-1 leading-tight">Check-in and view history</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('TEACHER')}
                      className={`flex flex-col p-3 rounded-lg border-2 text-left transition-all ${
                        role === 'TEACHER'
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className="text-sm font-bold text-foreground">Teacher</span>
                      <span className="text-xs text-muted-foreground mt-1 leading-tight">Track pods and scan signals</span>
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full mt-2 font-semibold shadow-lg h-11">
                  Next Step <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div className="text-center mt-2">
                  <p className="text-xs text-muted-foreground">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => router.push('/login')}
                      className="font-bold text-primary hover:underline focus:outline-none"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: Onboarding Survey details */}
          {step === 2 && (
            <div className="rounded-2xl border bg-card text-card-foreground p-6 shadow-sm space-y-4">
              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="font-medium leading-tight">{error}</div>
                </div>
              )}

              {/* Question 1 */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  How did you hear about us?
                </span>
                <div className="flex flex-col gap-2">
                  {heardFromOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setHeardFrom(opt.value)}
                      className={`flex items-center justify-between px-3.5 py-2.5 text-xs min-h-[44px] rounded-lg border transition-all ${
                        heardFrom === opt.value
                          ? 'border-primary bg-primary/5 text-foreground font-semibold'
                          : 'border-border bg-transparent text-muted-foreground hover:bg-muted/10'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {heardFrom === opt.value && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question 2 */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  What is your primary goal with ClassPod?
                </span>
                <div className="flex flex-col gap-2">
                  {reasonOptions[role].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOnboardingReason(opt.value)}
                      className={`flex items-center justify-between px-3.5 py-2.5 text-xs min-h-[44px] rounded-lg border transition-all text-left ${
                        onboardingReason === opt.value
                          ? 'border-primary bg-primary/5 text-foreground font-semibold'
                          : 'border-border bg-transparent text-muted-foreground hover:bg-muted/10'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {onboardingReason === opt.value && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step Navigation buttons */}
              <div className="flex items-center gap-3 mt-4 pt-2">
                <Button
                  variant="secondary"
                  onClick={handleBackStep}
                  className="flex-1 font-semibold"
                  disabled={isPending}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 font-semibold shadow-lg"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>Finish Setup</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Success checkmark animation */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center">
              {/* Scaling success checkmark drawn path */}
              <div className="relative flex items-center justify-center h-20 w-20 rounded-full border-4 border-green-500 bg-green-500/10 animate-bounce">
                <Check className="h-10 w-10 text-green-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">Welcome to ClassPod!</h3>
                <p className="text-sm text-muted-foreground">
                  Awesome to have you on board, <strong className="text-foreground">{name}</strong>. Redirecting you to your workspace...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Hero Image (visible on lg+) */}
      <div className="hidden lg:relative lg:flex lg:col-span-7 xl:col-span-8 bg-muted flex-col justify-between p-12 overflow-hidden border-l">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-10000 hover:scale-105"
          style={{
            backgroundImage: `url('/assets/Gemini_Generated_Image_bpyfcnbpyfcnbpyf(1).png')`,
          }}
        />
        {/* Dark Blue Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-background/30" />

        {/* Content over background */}
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest backdrop-blur-md">
              Intelligent Classroom Platform
            </span>
          </div>

          <div className="max-w-2xl space-y-4">
            <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
              Automated Classroom Attendance Powered by Local Telemetry
            </h2>
            <p className="text-base text-zinc-300 leading-relaxed max-w-xl">
              ClassPod connects students, instructors, and classroom hardware gateway sensors dynamically. Verification is updated in real time via local BLE beacons and mobile check-ins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
