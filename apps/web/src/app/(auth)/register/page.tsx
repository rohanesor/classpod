'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { ClassPodLogo } from '@/components/ui/logo';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  GraduationCap,
  Users,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function RegisterPage() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'TEACHER' | 'STUDENT'>('STUDENT');

  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isSuccess) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router, isSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
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

    setIsRegistering(true);
    try {
      await register({
        name,
        email,
        password,
        role,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const isPending = isLoading || isRegistering;

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-12 bg-background">
      {/* Left Column: Sign-up / Success Screen */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:col-span-5 lg:px-16 xl:col-span-4 bg-background">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="space-y-3">
            <ClassPodLogo size="lg" />
            <div className="pt-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {isSuccess ? 'Account Created!' : 'Create an Account'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {isSuccess
                  ? 'Your ClassPod account has been registered successfully.'
                  : 'Join ClassPod to start monitoring and verifying classroom attendance.'}
              </p>
            </div>
          </div>

          {/* Success Screen */}
          {isSuccess ? (
            <div className="rounded-2xl border bg-card text-card-foreground p-6 sm:p-8 shadow-sm space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground">Welcome, {name}!</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your workspace is initialized as a{' '}
                  <strong className="text-foreground capitalize">{role.toLowerCase()}</strong>.
                </p>
              </div>

              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full h-11 font-bold shadow-lg gap-2"
              >
                <span>Continue to Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            /* Registration Form */
            <div className="rounded-2xl border bg-card text-card-foreground p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in duration-200">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="font-medium leading-tight">{error}</span>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="name"
                    className="text-xs font-bold text-muted-foreground uppercase tracking-wider block"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      id="name"
                      type="text"
                      placeholder="Jane Doe"
                      required
                      disabled={isPending}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 transition-all"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-bold text-muted-foreground uppercase tracking-wider block"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      disabled={isPending}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-xs font-bold text-muted-foreground uppercase tracking-wider block"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      required
                      disabled={isPending}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex h-11 w-full rounded-xl border border-input bg-background pl-9 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Role Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Account Role
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRole('STUDENT')}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        role === 'STUDENT'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'border-input bg-background text-muted-foreground hover:border-muted-foreground/40'
                      }`}
                    >
                      <Users className="h-4 w-4 shrink-0" />
                      <div className="text-xs">
                        <span className="block font-bold">Student</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Check in to class</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('TEACHER')}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        role === 'TEACHER'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                          : 'border-input bg-background text-muted-foreground hover:border-muted-foreground/40'
                      }`}
                    >
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      <div className="text-xs">
                        <span className="block font-bold">Teacher</span>
                        <span className="text-[10px] text-muted-foreground font-normal">Track attendance</span>
                      </div>
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-bold shadow-lg mt-2"
                  disabled={isPending}
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Account...</span>
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </Button>

                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground">
                    Already have an account?{' '}
                    <button
                      type="button"
                      disabled={isPending}
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
        </div>
      </div>

      {/* Right Column: Hero Branding */}
      <div className="hidden lg:relative lg:flex lg:col-span-7 xl:col-span-8 bg-muted flex-col justify-between p-12 overflow-hidden border-l">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('/assets/Gemini_Generated_Image_bpyfcnbpyfcnbpyf(1).png')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-background/30" />

        <div className="relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-primary/10 border border-primary/20 text-primary uppercase tracking-widest backdrop-blur-md flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Enterprise EdTech Attendance</span>
            </span>
          </div>

          <div className="max-w-2xl space-y-4">
            <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight drop-shadow-sm">
              One Classroom. One Verified Session.
            </h2>
            <p className="text-base text-zinc-300 leading-relaxed max-w-xl">
              ClassPod combines Bluetooth LE beacons and optical verification sensors to deliver tamper-proof attendance recording and automated reports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
