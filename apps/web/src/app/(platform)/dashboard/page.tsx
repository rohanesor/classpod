'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { getInstallationUuid } from '@/lib/device-id';
import {
  Users,
  Radio,
  Clock,
  BookOpen,
  Calendar,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle,
  Inbox,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface MetricCard {
  title: string;
  value: string | number;
  description: string;
  icon: any;
  iconColor: string;
  bgColor: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States
  const [pods, setPods] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [isCheckinLoading, setIsCheckinLoading] = useState(false);

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

      if (isUserTeacher) {
        promises.push(apiClient.get<any[]>('/gateway/status'));
      }

      const results = await Promise.all(promises);
      const podsRes = results[0];
      const activeSessionRes = results[1];
      const gwRes = isUserTeacher ? results[2] : null;

      setPods(podsRes.data || []);
      setActiveSession(activeSessionRes.data || null);

      if (isUserTeacher && gwRes) {
        setGateways(gwRes.data || []);
      }
    } catch (err: any) {
      window.console.error('Error fetching dashboard metrics:', err);
      setError(err?.message || 'Failed to load dashboard. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    // Auto-refresh stats every 15 seconds
    const interval = window.setInterval(fetchData, 15000);
    return () => window.clearInterval(interval);
  }, [user, fetchData]);

  // Auto-register device installation UUID for students on dashboard load
  useEffect(() => {
    if (isStudent && user) {
      const deviceId = getInstallationUuid();
      apiClient.post('/auth/device/register', {
        deviceId,
        platform: Capacitor.getPlatform(),
      }).catch(() => {
        // Silent catch if already registered or offline
      });
    }
  }, [isStudent, user]);

  // Check-in handler for Student
  const handleCheckIn = async () => {
    if (!activeSession) return;

    // Enforce Mobile App Requirement
    if (!Capacitor.isNativePlatform()) {
      window.alert('ClassPod attendance requires the mobile app because BLE proximity verification is required.');
      return;
    }

    setIsCheckinLoading(true);
    try {
      const sessionId = activeSession.session?.id || activeSession.id;
      const deviceId = getInstallationUuid();

      let gatewayId = 'esp32-cam-node-1';
      let challengeToken = activeSession.session?.challengeToken || activeSession.challengeToken || 'CP123456';

      // Scan for native BLE gateway challenge payload if on mobile
      try {
        const bleModule = await import('@capacitor-community/bluetooth-le');
        const BleClient = bleModule.BleClient;
        await BleClient.initialize();
        
        await BleClient.requestLEScan(
          { services: ['434c4153-5350-4f44-0000-000000000000'] },
          (result) => {
            if (result.device && result.device.deviceId) {
              gatewayId = result.device.deviceId;
            }
          }
        );

        // Allow 3 seconds to scan
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await BleClient.stopLEScan();
      } catch {
        // Fallback to active session challenge token if BLE scan completes
      }

      await apiClient.post('/attendance/checkin', {
        sessionId,
        gatewayId,
        challengeToken,
        deviceId,
        isMobileApp: true,
      });

      // Immediately set state locally
      setActiveSession((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          decision: {
            ...prev.decision,
            status: 'CHECKED_IN',
          },
        };
      });
    } catch (err: any) {
      window.alert(err?.message || 'Check-in failed. Please move closer to the ClassPod gateway.');
    } finally {
      setIsCheckinLoading(false);
    }
  };

  const dashboardMetrics = useMemo<MetricCard[]>(() => {
    if (isTeacher) {
      const activeGws = gateways.filter((g) => g.status === 'ONLINE').length;
      return [
        {
          title: 'Academic Pods',
          value: pods.length,
          description: `${pods.filter((p) => p.status === 'ACTIVE').length} Active | ${pods.filter((p) => p.status === 'ARCHIVED').length} Archived`,
          icon: BookOpen,
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
        },
        {
          title: 'Classroom Gateways',
          value: `${activeGws}/${gateways.length}`,
          description: `${activeGws} Online scanner nodes`,
          icon: Radio,
          iconColor: 'text-indigo-500',
          bgColor: 'bg-indigo-500/10',
        },
        {
          title: 'Active Session',
          value: activeSession ? '1 Run' : 'None',
          description: activeSession ? `Pod: ${activeSession.pod?.name}` : 'No sessions active right now',
          icon: Clock,
          iconColor: activeSession ? 'text-emerald-500' : 'text-muted-foreground',
          bgColor: activeSession ? 'bg-emerald-500/10' : 'bg-muted/10',
        },
      ];
    } else {
      const verifiedStatus = activeSession?.decision?.status;
      let checkinDisplay = '—';
      let checkinDesc = 'Join a pod to track stats';

      if (pods.length > 0) {
        if (verifiedStatus === 'CHECKED_IN' || verifiedStatus === 'VERIFIED') {
          checkinDisplay = '100%';
          checkinDesc = 'Current session checked in';
        } else if (verifiedStatus === 'PENDING') {
          checkinDisplay = 'Pending';
          checkinDesc = 'Session check-in awaiting confirmation';
        } else {
          checkinDisplay = 'Active';
          checkinDesc = 'Enrolled in active class pods';
        }
      }

      return [
        {
          title: 'Joined Classes',
          value: pods.length,
          description: 'Total active pod memberships',
          icon: BookOpen,
          iconColor: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
        },
        {
          title: 'Live Attendance',
          value: activeSession ? '1 Open' : 'Closed',
          description: activeSession ? `Status: ${activeSession.decision?.status || 'PENDING'}` : 'No active sessions',
          icon: Activity,
          iconColor: activeSession ? 'text-primary' : 'text-muted-foreground',
          bgColor: activeSession ? 'bg-primary/10' : 'bg-muted/10',
        },
        {
          title: 'Verified Check-ins',
          value: checkinDisplay,
          description: checkinDesc,
          icon: TrendingUp,
          iconColor: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
        },
      ];
    }
  }, [isTeacher, pods, gateways, activeSession]);

  if (loading && pods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Syncing workspace dashboard telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {error && (
        <div className="flex items-center gap-3 p-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-lg shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium">{error}</div>
          <Button variant="ghost" onClick={fetchData} className="ml-auto text-xs h-8 border border-destructive/20 hover:bg-destructive/10">
            Retry
          </Button>
        </div>
      )}
      {/* Welcome Banner */}
      <div
        className="rounded-2xl border p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/Gemini_Generated_Image_bpyfcnbpyfcnbpyf(3).png')" }}
      >
        {/* Sleek Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-card via-card/95 to-card/65 z-0" />

        <div className="space-y-2 relative z-10">
          <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Welcome back, {user?.name || 'User'}!
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            {isTeacher
              ? 'Here is an overview of your active classes, hardware gateways, and live attendance metrics.'
              : 'View your enrolled pods and complete any active attendance check-ins.'}
          </p>
        </div>

        {/* Quick action for teacher */}
        {isTeacher && (
          <Link href="/pods">
            <Button className="shrink-0 flex items-center gap-2 shadow-lg hover:translate-x-1 transition-all duration-200 relative z-10">
              <span>Manage Pods</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* Live check-in banner for Student */}
      {isStudent && activeSession && (
        <div className="rounded-2xl border bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/30 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0 relative">
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-primary">Live Attendance Session</p>
              <h3 className="text-lg font-bold text-foreground mt-0.5">{activeSession.pod?.name || 'Classroom'}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Status:{' '}
                <span className="font-semibold text-foreground">
                  {activeSession.decision?.status || 'PENDING'}
                </span>
              </p>
            </div>
          </div>
          {activeSession.decision?.status === 'PENDING' ? (
            <Button
              onClick={handleCheckIn}
              disabled={isCheckinLoading}
              className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-lg"
            >
              {isCheckinLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Checking in...
                </>
              ) : (
                "Confirm I'm Here"
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-3 py-1.5 rounded-lg text-xs font-semibold self-stretch sm:self-center justify-center">
              <CheckCircle className="h-4 w-4" />
              <span>Checked In</span>
            </div>
          )}
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboardMetrics.map((card, idx) => (
          <div key={idx} className="rounded-xl border bg-card p-6 shadow-sm space-y-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{card.title}</span>
              <div className={`p-2.5 rounded-lg ${card.bgColor} ${card.iconColor}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Roster & Telemetry Rows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classes List (Takes 2 cols) */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Academic Classes
            </h3>
            <Link href="/pods" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
              <span>View All</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {pods.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 px-4 bg-muted/10 rounded-xl border border-dashed">
              <Inbox className="h-10 w-10 text-muted-foreground opacity-55 mb-2" />
              <p className="text-sm font-semibold">No pods enrolled</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                {isTeacher
                  ? "Get started by creating your first pod class."
                  : "Join a classroom by entering an instructor code."}
              </p>
              {isStudent && (
                <Link href="/pods" className="mt-4">
                  <Button size="sm" className="flex items-center gap-1.5 font-bold shadow-md">
                    <BookOpen className="h-4 w-4" />
                    <span>Join Your First Class</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {pods.slice(0, 3).map((pod) => (
                <div key={pod.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div>
                    <h4 className="font-semibold text-sm sm:text-base text-foreground">{pod.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Subject Code: {pod.subjectCode} | Section: {pod.section || '—'}
                    </p>
                  </div>
                  <Link href={`/pods/${pod.id}/members`}>
                    <Button variant="ghost" size="sm" className="h-8 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground">
                      <span>Roster</span>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Gateways or Info Box (Takes 1 col) */}
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-foreground border-b pb-3 flex items-center gap-2">
            <Radio className="h-5 w-5 text-indigo-500" />
            {isTeacher ? 'Hardware Gateway Nodes' : 'Student Tips'}
          </h3>

          {isTeacher ? (
            gateways.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6">No gateway nodes configured.</p>
            ) : (
              <div className="space-y-3">
                {gateways.slice(0, 4).map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div>
                      <p className="text-xs font-semibold text-foreground truncate max-w-[120px]">{g.name}</p>
                      <p className="text-[10px] text-muted-foreground">{g.classroom}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-bold ${
                        g.status === 'ONLINE' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                      }`}
                    >
                      {g.status === 'ONLINE' && (
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-sonar absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                      )}
                      <span>{g.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="flex gap-2.5">
                <AlertCircle className="h-5 w-5 text-primary shrink-0" />
                <p>
                  Confirm you check in within the session duration. Expired sessions cannot be checked in to.
                </p>
              </div>
              <div className="flex gap-2.5">
                <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0" />
                <p>
                  To verify your attendance automatically, make sure your mobile device Bluetooth is switched on.
                </p>
              </div>
              <div className="flex gap-2.5">
                <AlertCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <p>
                  Check the Bell notification icon at top right for real-time alerts when a teacher starts class.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
