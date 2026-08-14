'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { Capacitor } from '@capacitor/core';
import { getInstallationUuid } from '@/lib/device-id';
import { LocationService } from '@/lib/location.service';
import {
  Users,
  GraduationCap,
  Calendar,
  Clock,
  ArrowRight,
  Loader2,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Fingerprint,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';
import { useBiometrics } from '@/hooks/use-biometrics';

export default function HomePage() {
  const { user } = useAuth();
  const biometrics = useBiometrics();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core States
  const [pods, setPods] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [isCheckinLoading, setIsCheckinLoading] = useState(false);
  const [checkinStep, setCheckinStep] = useState<string | null>(null);
  const [checkinSuccess, setCheckinSuccess] = useState<string | null>(null);

  const isTeacher = user?.role?.toUpperCase() === 'TEACHER';
  const isStudent = user?.role?.toUpperCase() === 'STUDENT';

  const fetchData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      const isUserTeacher = user.role?.toUpperCase() === 'TEACHER';
      const podsEndpoint = isUserTeacher ? '/pods' : '/pods/my';

      const promises: Promise<any>[] = [
        apiClient.get<any[]>(podsEndpoint),
        apiClient.get<any>('/attendance/active'),
      ];

      const [podsResult, activeResult] = await Promise.allSettled(promises);

      if (podsResult && podsResult.status === 'fulfilled' && (podsResult.value as any)?.data) {
        setPods((podsResult.value as any).data);
      }

      if (activeResult && activeResult.status === 'fulfilled' && (activeResult.value as any)?.data) {
        setActiveSession((activeResult.value as any).data);
      } else {
        setActiveSession(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-register device installation UUID for students
  useEffect(() => {
    if (isStudent && user) {
      const deviceId = getInstallationUuid();
      apiClient
        .post('/auth/device/register', {
          deviceId,
          platform: Capacitor.getPlatform(),
        })
        .catch(() => {
          // Silent catch
        });
    }
  }, [isStudent, user]);

  // Multi-Factor Attendance Verification for Student
  const handleCheckIn = async () => {
    if (!activeSession) return;

    setIsCheckinLoading(true);
    setError(null);
    setCheckinSuccess(null);
    setCheckinStep('Initiating verification...');

    try {
      const sessionId = activeSession.session?.id || activeSession.id;
      const deviceId = getInstallationUuid();

      let gatewayId = 'esp32-cam-node-1';
      let challengeToken =
        activeSession.session?.challengeToken || activeSession.challengeToken || 'CP123456';

      // 1. Trigger Native OS Biometric Authentication
      setCheckinStep('Scan Fingerprint / Face ID on sensor...');
      const bioResult = await biometrics.authenticate('Touch sensor to verify attendance');
      if (!bioResult.success) {
        throw new Error(bioResult.error || 'OS biometric authentication failed. Please verify with fingerprint or Face ID.');
      }

      // 2. Acquire High-Accuracy GPS Location
      setCheckinStep('Acquiring classroom GPS location...');
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const location = await LocationService.getCurrentLocation(8000);
        latitude = location.latitude;
        longitude = location.longitude;
      } catch (locErr: any) {
        throw new Error(locErr?.message || 'Location acquisition failed. Location permission is required.');
      }

      // 3. Scan for Native BLE Gateway (if mobile platform)
      if (Capacitor.isNativePlatform()) {
        setCheckinStep('Verifying Bluetooth classroom beacon...');
        try {
          const bleModule = await import('@capacitor-community/bluetooth-le');
          const BleClient = bleModule.BleClient;
          await BleClient.initialize();

          let bleFound = false;
          let scannedGatewayId = '';

          await BleClient.requestLEScan(
            {
              services: ['434c4153-5350-4f44-0000-000000000000'],
              allowDuplicates: false,
            },
            (result) => {
              if (result.device) {
                bleFound = true;
                scannedGatewayId = result.device.deviceId || 'esp32-cam-node-1';
              }
            }
          );

          await new Promise((resolve) => setTimeout(resolve, 2500));
          await BleClient.stopLEScan();

          if (!bleFound) {
            throw new Error('No ClassPod BLE Gateway detected nearby. You must be physically inside the classroom in range of the ESP32 to check in.');
          }

          gatewayId = scannedGatewayId || gatewayId;
        } catch (bleErr: any) {
          if (bleErr?.message?.includes('No ClassPod BLE Gateway')) {
            throw bleErr;
          }
          throw new Error('Bluetooth proximity check failed: ' + (bleErr?.message || 'Please ensure Bluetooth is enabled.'));
        }
      }

      // 4. Submit Multi-Factor Verification to Backend
      setCheckinStep('Validating multi-factor security...');
      await apiClient.post('/attendance/checkin', {
        sessionId,
        gatewayId,
        challengeToken,
        deviceId,
        isMobileApp: Capacitor.isNativePlatform(),
        biometricVerified: true,
        latitude,
        longitude,
      });

      setCheckinSuccess('🟢 Attendance Verified: PRESENT');
      fetchData();
    } catch (err: any) {
      const msg = err?.message || 'Verification failed. Please try again.';
      setError(msg);
    } finally {
      setIsCheckinLoading(false);
      setCheckinStep(null);
    }
  };

  // Metrics computation
  const totalStudents = useMemo(() => {
    if (!pods || pods.length === 0) return 0;
    if (isTeacher) {
      return pods.reduce((acc, p) => acc + (p._count?.enrollments || p.enrollments?.length || 0), 0);
    }
    return pods.length;
  }, [pods, isTeacher]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const todayDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  if (loading && pods.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Top Greeting & Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user?.name}
            avatarUrl={(user as any)?.avatarUrl}
            role={user?.role}
            size="lg"
            showRoleBadge
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {greeting}, {user?.name?.split(' ')[0] || 'User'}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{todayDate}</span>
              <span>•</span>
              <span className="capitalize font-semibold text-foreground">
                {user?.role?.toLowerCase()} Workspace
              </span>
            </p>
          </div>
        </div>

        {/* Quick Action Button in Header */}
        <div className="flex items-center gap-2">
          {isTeacher ? (
            <Link href="/pods">
              <Button className="h-10 px-4 font-bold shadow-md gap-2">
                <PlayCircle className="h-4 w-4" />
                <span>Start Attendance</span>
              </Button>
            </Link>
          ) : (
            <Link href="/pods">
              <Button variant="secondary" className="h-10 px-4 font-bold gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span>My Attendance</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Alert Notifications */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="opacity-70 hover:opacity-100 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {checkinSuccess && (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{checkinSuccess}</span>
          </div>
          <button
            onClick={() => setCheckinSuccess(null)}
            className="opacity-70 hover:opacity-100 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* PRIMARY OPERATIONAL ACTION CARD */}
      {activeSession ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[11px] font-black uppercase tracking-wider text-primary">
                  Live Attendance Session Active
                </span>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {activeSession.pod?.name || activeSession.session?.pod?.name || 'Class Session'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Subject Code:{' '}
                <strong className="text-foreground">
                  {activeSession.pod?.subjectCode || activeSession.session?.pod?.subjectCode || '—'}
                </strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isStudent && (
                <Button
                  onClick={handleCheckIn}
                  disabled={isCheckinLoading || activeSession.decision?.status === 'PRESENT' || activeSession.decision?.status === 'VERIFIED'}
                  className={`h-11 px-6 font-bold shadow-lg gap-2 text-sm ${
                    activeSession.decision?.status === 'PRESENT' || activeSession.decision?.status === 'VERIFIED'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : ''
                  }`}
                >
                  {isCheckinLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{checkinStep || 'Verifying Presence...'}</span>
                    </>
                  ) : activeSession.decision?.status === 'PRESENT' || activeSession.decision?.status === 'VERIFIED' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-white" />
                      <span>Attendance Verified</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="h-4 w-4" />
                      <span>Verify Attendance</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Standby Primary Action Banner */
        <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">
              {isTeacher ? 'Ready to Start Attendance?' : 'Awaiting Next Session'}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              {isTeacher
                ? 'Launch an automated verification session for any of your registered class pods with Bluetooth beacon detection.'
                : 'When your instructor begins attendance, the active session will appear here automatically for instant check-in.'}
            </p>
          </div>

          <Link href="/attendance">
            <Button className="h-10 px-5 font-bold shadow-sm gap-2 shrink-0">
              <PlayCircle className="h-4 w-4" />
              <span>{isTeacher ? 'Start Session' : 'View Attendance'}</span>
            </Button>
          </Link>
        </div>
      )}

      {/* KEY OPERATIONAL STATISTICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Enrolled / Teaching Pods */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {isTeacher ? 'Active Pods' : 'Enrolled Classes'}
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{pods.length}</p>
          <p className="text-[11px] text-muted-foreground">
            {isTeacher ? 'Classes under instruction' : 'Active class enrollments'}
          </p>
        </div>

        {/* Metric 2: Total Students / Peered */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {isTeacher ? 'Total Students' : 'Classmates'}
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{totalStudents}</p>
          <p className="text-[11px] text-muted-foreground">
            {isTeacher ? 'Roster records across all pods' : 'Enrolled peers in your classes'}
          </p>
        </div>

        {/* Metric 3: Active Sessions */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Sessions</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{activeSession ? '1 Active' : '0 Live'}</p>
          <p className="text-[11px] text-muted-foreground">
            {activeSession ? 'Real-time telemetry recording' : 'No sessions currently in progress'}
          </p>
        </div>

        {/* Metric 4: Reports Link */}
        <Link
          href="/reports"
          className="rounded-2xl border bg-card p-5 shadow-sm space-y-2 hover:border-primary/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">
              Reports & Logs
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-primary font-bold text-sm">
            <span>View All Records</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-[11px] text-muted-foreground">Export Excel, PDF & telemetry audits</p>
        </Link>
      </div>

      {/* CLASS PODS PREVIEW SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            {isTeacher ? 'Your Teaching Pods' : 'Your Enrolled Pods'}
          </h2>
          <Link
            href="/attendance"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>Manage in Attendance</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {pods.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border bg-card text-muted-foreground space-y-3">
            <GraduationCap className="h-10 w-10 mx-auto opacity-40 text-primary" />
            <h3 className="font-bold text-sm text-foreground">No Class Pods Found</h3>
            <p className="text-xs max-w-sm mx-auto">
              {isTeacher
                ? 'Create your first classroom pod in the Attendance workspace to start verifying student presence.'
                : 'Join a pod using the 6-digit code provided by your instructor.'}
            </p>
            <Link href="/attendance">
              <Button size="sm" className="font-bold shadow-md mt-2">
                <Plus className="h-4 w-4 mr-1.5" />
                <span>{isTeacher ? 'Create Pod' : 'Join Pod'}</span>
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pods.slice(0, 6).map((pod) => (
              <div
                key={pod.id}
                className="rounded-2xl border bg-card p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-primary/30 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground uppercase tracking-wider">
                      {pod.subjectCode || 'POD'}
                    </span>
                    {isTeacher && pod.joinCode && (
                      <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        Code: {pod.joinCode}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-foreground line-clamp-1">{pod.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {pod.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{pod._count?.enrollments || pod.enrollments?.length || 0} Students</span>
                  </span>
                  <Link href="/attendance">
                    <span className="font-bold text-primary hover:underline">Open Pod →</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
