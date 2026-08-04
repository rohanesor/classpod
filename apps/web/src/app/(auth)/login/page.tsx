'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Activity } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoggingIn(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isPending = isLoading || isLoggingIn;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-12 bg-background">
      {/* Left Column: Sign-in Form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:col-span-5 lg:px-20 xl:col-span-4 bg-background">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="flex flex-col gap-3 text-left">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Activity className="h-6 w-6" />
              </div>
              <span className="text-xl font-black tracking-tight text-foreground">ClassPod</span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Sign in</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Enter your credentials below to access your account workspace.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card text-card-foreground p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="font-medium leading-tight">{error}</div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  disabled={isPending}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  disabled={isPending}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <Button type="submit" className="w-full mt-2 font-semibold shadow-lg" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <div className="text-center mt-2">
                <p className="text-xs text-muted-foreground">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => router.push('/register')}
                    className="font-bold text-primary hover:underline focus:outline-none"
                  >
                    Sign Up
                  </button>
                </p>
              </div>
            </form>
          </div>
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
