'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { Capacitor } from '@capacitor/core';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Archive,
  Edit,
  Users,
  LogOut,
  BookOpen,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  Calendar,
  Hash,
  Search,
  X,
  PlusCircle,
  Info,
  Clock,
  Camera,
  Bluetooth,
  Sparkles,
  RefreshCw,
  RotateCcw,
  PlayCircle,
  Trash2,
  Timer,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  MapPin,
  Globe,
} from 'lucide-react';
import { getInstallationUuid } from '@/lib/device-id';
import { useAttendanceCameraFlow } from '@/hooks/use-attendance-camera-flow';
import type { FrameDetection } from '@classpod/shared';



export interface Pod {
  id: string;
  name: string;
  subjectCode: string;
  description: string;
  semester: string;
  section: string;
  joinCode: string;
  geoBoundary?: { lat: number; lng: number }[] | null;
  status: 'ACTIVE' | 'ARCHIVED';
  teacherId: string;
}

export default function PodsPage() {
  const { user } = useAuth();

  // Role Checks
  const isTeacher = user?.role?.toLowerCase() === 'teacher';
  const isStudent = user?.role?.toLowerCase() === 'student';

  // State Management
  const [pods, setPods] = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tab State for Teachers: 'ACTIVE' | 'ARCHIVED'
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  // Modal Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);

  // Action/Confirm States
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    actionText: string;
    variant: 'default' | 'destructive';
    onConfirm: () => void;
  } | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    subjectCode: '',
    description: '',
    semester: '',
    section: '',
  });
  const [joinCode, setJoinCode] = useState('');

  // Geo Spatial Environment States
  const [enableGeoBoundary, setEnableGeoBoundary] = useState(false);
  const [geoBoundary, setGeoBoundary] = useState<{ lat: string; lng: string }[]>(
    Array(8).fill({ lat: '', lng: '' })
  );
  const [geoError, setGeoError] = useState<string | null>(null);

  // Attendance student states
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isCheckinLoading, setIsCheckinLoading] = useState(false);

  // BLE proximity verification states
  const [bleStatus, setBleStatus] = useState<'idle' | 'scanning' | 'found' | 'error' | 'unsupported' | 'disabled'>('idle');
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState<boolean | null>(null);
  const [detectedGateway, setDetectedGateway] = useState<{
    id: string;
    name: string;
    challengeToken: string;
    rssi: number;
  } | null>(null);

  // Attendance teacher states
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [selectedAttendancePod, setSelectedAttendancePod] = useState<Pod | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<any | null>(null);
  const [duration, setDuration] = useState<number>(90);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Record<string, string>>({});
  const lastStatuses = useRef<Record<string, string>>({});

  // Fetch Pods
  const fetchPods = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const isTeacherRole = user?.role?.toUpperCase() === 'TEACHER';
      // Teachers get all pods or owned pods (GET /pods). Students get joined pods (GET /pods/my).
      const endpoint = isTeacherRole ? '/pods' : '/pods/my';
      const response = await apiClient.get<Pod[]>(endpoint);
      setPods(response.data || []);
    } catch (err: any) {
      window.console.error('Failed to fetch pods:', err);
      setError(err?.message || 'Failed to load pods. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchPods();
  }, [user, fetchPods]);

  // Copy join code handler
  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  // Poll active attendance session for Student
  useEffect(() => {
    if (!isStudent) {
      setActiveSession(null);
      return;
    }

    const checkActiveSession = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      try {
        const response = await apiClient.get<any>('/attendance/active');
        if (response.data) {
          setActiveSession(response.data);
        } else {
          setActiveSession(null);
        }
      } catch (err) {
        window.console.error('Error checking active attendance session:', err);
      }
    };

    checkActiveSession();
    const interval = window.setInterval(checkActiveSession, 10000);

    return () => window.clearInterval(interval);
  }, [isStudent]);

  // BLE Beacon Scanner Hook
  useEffect(() => {
    if (!isCheckinModalOpen || !activeSession) {
      setBleStatus('idle');
      setDetectedGateway(null);
      return;
    }

    let isScanning = true;
    let bleClient: any = null;

    const startScanning = async () => {
      setBleStatus('scanning');
      setDetectedGateway(null);

      // Browser Mock Fallback
      if (!Capacitor.isNativePlatform()) {
        window.console.log('[BLE] Running on browser. Simulating BLE scan...');
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        if (!isScanning) return;

        setDetectedGateway({
          id: 'esp32-cam-node-1',
          name: 'ClassPod ESP32 Gateway (Mock)',
          challengeToken: activeSession.challengeToken || 'MOCK_TOKEN',
          rssi: -55 - Math.floor(Math.random() * 20),
        });
        setIsBluetoothEnabled(true);
        setBleStatus('found');
        return;
      }

      // Native BLE Scan Implementation
      try {
        const bleModule = await import('@capacitor-community/bluetooth-le');
        bleClient = bleModule.BleClient;
        await bleClient.initialize();

        // Check if Bluetooth is enabled
        try {
          const isEnabled = await bleClient.isEnabled();
          setIsBluetoothEnabled(isEnabled);
          if (!isEnabled) {
            setBleStatus('disabled');
            return;
          }
        } catch {
          setIsBluetoothEnabled(true);
        }

        window.console.log('[BLE] Initialized. Requesting LE Scan for service UUID 434c4153-5350-4f44-0000-000000000000');
        
        await bleClient.requestLEScan(
          {
            services: ['434c4153-5350-4f44-0000-000000000000'],
          },
          async (result: any) => {
            if (!isScanning) return;
            window.console.log('[BLE] Scan result detected:', result);

            // INSTANT DETECTION: Any broadcast from ClassPod gateway or matching service
            const gatewayId = result.device?.deviceId || 'esp32-cam-node-1';
            const gatewayName = result.device?.name || 'ClassPod Gateway';
            const rssi = result.rssi || -60;

            setDetectedGateway({
              id: gatewayId,
              name: gatewayName,
              challengeToken: activeSession.challengeToken || 'CP123456',
              rssi: rssi,
            });
            setIsBluetoothEnabled(true);
            setBleStatus('found');

            // Attempt characteristic read in background for session token confirmation
            try {
              await bleClient.connect(gatewayId);
              const value = await bleClient.read(
                gatewayId,
                '434c4153-5350-4f44-0000-000000000000',
                '434c4153-5350-4f44-0000-000000000001'
              );
              const decoder = new window.TextDecoder('utf-8');
              const data = JSON.parse(decoder.decode(value));
              if (data && data.c) {
                setDetectedGateway((prev: any) => ({ ...prev, challengeToken: data.c }));
              }
              await bleClient.disconnect(gatewayId);
            } catch {
              // Advertising packet is sufficient proof of proximity
            }
          }
        );
      } catch (err: any) {
        window.console.error('[BLE] Scanning initialization failed:', err);
        setBleStatus('error');
      }
    };

    startScanning();

    return () => {
      isScanning = false;
      if (Capacitor.isNativePlatform() && bleClient) {
        bleClient.stopLEScan().catch((e: any) => window.console.error('[BLE] Stop scan error:', e));
      }
    };
  }, [isCheckinModalOpen, activeSession]);

  // Handle Enable Bluetooth 1-Tap
  const handleEnableBluetooth = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const bleModule = await import('@capacitor-community/bluetooth-le');
        await bleModule.BleClient.enable();
        setIsBluetoothEnabled(true);
        setBleStatus('scanning');
      }
    } catch (err) {
      window.console.error('Failed to enable bluetooth:', err);
    }
  };

  // Sync/decrement local countdown timer for Teacher / active session countdown
  useEffect(() => {
    if (attendanceSession && attendanceSession.status === 'ACTIVE') {
      let initialRemaining = attendanceSession.timeRemaining;
      if (initialRemaining === undefined && attendanceSession.expiresAt) {
        initialRemaining = Math.max(0, Math.floor((new Date(attendanceSession.expiresAt).getTime() - Date.now()) / 1000));
      }
      setLocalTimeRemaining(initialRemaining);
    } else {
      setLocalTimeRemaining(null);
    }
  }, [attendanceSession]);

  useEffect(() => {
    if (localTimeRemaining === null || localTimeRemaining <= 0) return;

    const timer = window.setTimeout(() => {
      setLocalTimeRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [localTimeRemaining]);

  // Poll live attendance stats for Teacher
  useEffect(() => {
    const pollLiveStats = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      if (!isAttendanceOpen || !attendanceSession?.id) return;
      try {
        const response = await apiClient.get<any>(`/attendance/session/${attendanceSession.id}/live`);
        if (response.data) {
          setAttendanceSession((prev: any) => ({
            ...prev,
            ...response.data,
            id: response.data?.id || prev?.id,
            podId: response.data?.podId || prev?.podId,
          }));
        }
      } catch (err) {
        window.console.error('Failed to poll live attendance stats:', err);
      }
    };

    const interval = window.setInterval(pollLiveStats, 3000);
    return () => window.clearInterval(interval);
  }, [isAttendanceOpen, attendanceSession?.id]);

  // Track status updates for real-time highlighting
  useEffect(() => {
    if (!attendanceSession || !attendanceSession.decisions) return;
    const updates: Record<string, string> = {};
    let hasUpdates = false;

    attendanceSession.decisions.forEach((d: any) => {
      const prev = lastStatuses.current[d.id];
      if (prev && prev !== d.status) {
        updates[d.id] = d.status === 'VERIFIED' ? 'bg-emerald-500/10 dark:bg-emerald-500/5' : 'bg-blue-500/10 dark:bg-blue-500/5';
        hasUpdates = true;

        // Remove highlight after 2.5 seconds
        window.setTimeout(() => {
          setRecentlyUpdated((curr) => {
            const copy = { ...curr };
            delete copy[d.id];
            return copy;
          });
        }, 2500);
      }
      lastStatuses.current[d.id] = d.status;
    });

    if (hasUpdates) {
      setRecentlyUpdated((curr) => ({ ...curr, ...updates }));
    }
  }, [attendanceSession?.decisions]);

  // Student check-in handler
  const handleCheckIn = async () => {
    if (!activeSession) return;
    setIsCheckinLoading(true);
    setAttendanceError(null);

    let finalGatewayId = detectedGateway?.id || 'esp32-cam-node-1';
    let finalChallengeToken = detectedGateway?.challengeToken || activeSession.challengeToken || 'CP123456';

    // If BLE is still scanning on mobile, run a fast fallback scan before submitting
    if (Capacitor.isNativePlatform() && bleStatus !== 'found') {
      try {
        const bleModule = await import('@capacitor-community/bluetooth-le');
        const bleClient = bleModule.BleClient;
        await bleClient.initialize();
        await bleClient.requestLEScan(
          { services: ['434c4153-5350-4f44-0000-000000000000'] },
          (result: any) => {
            if (result.device?.deviceId) {
              finalGatewayId = result.device.deviceId;
            }
          }
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await bleClient.stopLEScan();
      } catch {
        // Fallback to active session challenge
      }
    }

    try {
      await apiClient.post('/attendance/checkin', {
        sessionId: activeSession.id,
        gatewayId: finalGatewayId,
        challengeToken: finalChallengeToken,
        deviceId: getInstallationUuid(),
        isMobileApp: true,
      });
      // Set local state to CHECKED_IN to reflect immediate update
      setActiveSession((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          studentDecision: {
            ...prev.studentDecision,
            status: 'CHECKED_IN',
          },
          decision: {
            ...prev.decision,
            status: 'CHECKED_IN',
          },
        };
      });
    } catch (err: any) {
      setAttendanceError(err?.message || 'Failed to submit check-in. Please try again.');
    } finally {
      setIsCheckinLoading(false);
    }
  };

  // 5-Second Camera Detection Flow Hook
  const cameraFlow = useAttendanceCameraFlow({
    podId: selectedAttendancePod?.id || '',
    expectedStudentsCount: 32,
    durationSeconds: duration,
    onSessionStarted: async (newSession: any) => {
      try {
        const liveRes = await apiClient.get<any>(`/attendance/session/${newSession.id}/live`);
        setAttendanceSession({
          ...newSession,
          ...(liveRes.data || {}),
        });
      } catch {
        setAttendanceSession(newSession);
      }
    },
    onError: (err: any) => {
      setAttendanceError(err);
    },
  });

  // Teacher actions
  const openAttendanceModal = async (pod: Pod) => {
    setSelectedAttendancePod(pod);
    setIsAttendanceOpen(true);
    setDuration(90);
    setAttendanceSession(null);
    setLocalTimeRemaining(null);
    setAttendanceError(null);
    cameraFlow.resetAnalysis();

    // Check if there is already an active session running for this pod
    try {
      const activeRes = await apiClient.get<any>(`/attendance/pod/${pod.id}/active`);
      if (activeRes.data) {
        setAttendanceSession({
          ...activeRes.data,
          id: activeRes.data.id,
          podId: activeRes.data.podId || pod.id,
          status: 'ACTIVE',
        });
      }
    } catch (err) {
      window.console.warn('Failed to check active session:', err);
    }
  };

  const handleStartSession = async () => {
    if (!selectedAttendancePod || isStartingSession || cameraFlow.isProcessing) return;
    setAttendanceError(null);
    await cameraFlow.startCameraAnalysis();
  };

  const handleEndSession = async () => {
    if (!attendanceSession) return;
    setIsEndingSession(true);
    setAttendanceError(null);
    try {
      const closingSessionId = attendanceSession.id;
      await apiClient.post('/attendance/end', {
        sessionId: closingSessionId,
      });

      // Direct trigger to guarantee instant Excel/PDF and WhatsApp generation
      try {
        await apiClient.post(`/automation/trigger/${closingSessionId}`);
      } catch (autoErr) {
        window.console.warn('Direct automation trigger notice:', autoErr);
      }

      setAttendanceSession(null);
      setIsAttendanceOpen(false);
      setSelectedAttendancePod(null);
    } catch (err: any) {
      setAttendanceError(err?.message || 'Failed to end attendance session.');
    } finally {
      setIsEndingSession(false);
    }
  };

  const handleCancelSession = async () => {
    if (!attendanceSession) return;
    setIsEndingSession(true);
    setAttendanceError(null);
    try {
      await apiClient.post('/attendance/cancel', {
        sessionId: attendanceSession.id,
        reason: 'Teacher cancelled session',
      });
      setAttendanceSession(null);
      setIsAttendanceOpen(false);
      setSelectedAttendancePod(null);
    } catch (err: any) {
      setAttendanceError(err?.message || 'Failed to cancel attendance session.');
    } finally {
      setIsEndingSession(false);
    }
  };

  const handleExtendSession = async (extraSeconds: number) => {
    if (!attendanceSession) return;
    setAttendanceError(null);
    try {
      const response = await apiClient.post<any>('/attendance/extend', {
        sessionId: attendanceSession.id,
        extraSeconds,
      });
      if (response.data?.expiresAt) {
        setAttendanceSession((prev: any) => ({
          ...prev,
          expiresAt: response.data.expiresAt,
          duration: response.data.duration,
        }));
        const diff = Math.max(0, Math.ceil((new Date(response.data.expiresAt).getTime() - Date.now()) / 1000));
        setLocalTimeRemaining(diff);
      }
    } catch (err: any) {
      setAttendanceError(err?.message || 'Failed to extend session timer.');
    }
  };

  const handleForceRestartSession = async () => {
    if (!selectedAttendancePod) return;
    setIsStartingSession(true);
    setAttendanceError(null);
    try {
      const response = await apiClient.post<any>('/attendance/force-restart', {
        podId: selectedAttendancePod.id,
        duration,
      });
      const liveRes = await apiClient.get<any>(`/attendance/session/${response.data.id}/live`);
      setAttendanceSession({
        ...response.data,
        ...(liveRes.data || {}),
      });
    } catch (err: any) {
      setAttendanceError(err?.message || 'Failed to restart attendance session.');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleResumeActiveSession = async () => {
    if (!selectedAttendancePod) return;
    setAttendanceError(null);
    try {
      const activeRes = await apiClient.get<any>(`/attendance/pod/${selectedAttendancePod.id}/active`);
      if (activeRes.data) {
        setAttendanceSession({
          ...activeRes.data,
          id: activeRes.data.id,
          podId: activeRes.data.podId || selectedAttendancePod.id,
          status: 'ACTIVE',
        });
      }
    } catch (err: any) {
      setAttendanceError(err?.message || 'Failed to resume active session.');
    }
  };

  // Helper to calculate stats reactively
  const liveStats = useMemo(() => {
    if (!attendanceSession) {
      return { total: 0, checkedIn: 0, verified: 0, pending: 0, absent: 0 };
    }

    if (attendanceSession.stats) {
      return {
        total: attendanceSession.stats.totalEnrolled ?? 0,
        checkedIn: attendanceSession.stats.checkedIn ?? 0,
        verified: attendanceSession.stats.verified ?? 0,
        pending: attendanceSession.stats.pending ?? 0,
        absent: attendanceSession.stats.absent ?? 0,
      };
    }

    const decisions = attendanceSession.decisions || [];
    const total = decisions.length;
    let checkedIn = 0;
    let verified = 0;
    let pending = 0;
    let absent = 0;

    decisions.forEach((d: any) => {
      const status = d.status?.toUpperCase();
      if (status === 'CHECKED_IN') {
        checkedIn++;
      } else if (status === 'VERIFIED') {
        verified++;
      } else if (status === 'PENDING') {
        pending++;
      } else if (status === 'EXPIRED') {
        absent++;
      }
    });

    return { total, checkedIn, verified, pending, absent };
  }, [attendanceSession]);

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status?.toUpperCase();
    switch (normalizedStatus) {
      case 'PRESENT':
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>PRESENT</span>
          </span>
        );
      case 'NOT_PRESENT':
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 border border-rose-500/30">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>NOT PRESENT</span>
          </span>
        );
      case 'CHECKED_IN':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            Checked In
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse">
            Pending
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-muted-foreground/20">
            Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-muted-foreground/20">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  // Form Reset
  const resetForm = () => {
    setFormData({
      name: '',
      subjectCode: '',
      description: '',
      semester: '',
      section: '',
    });
    setJoinCode('');
    setActionError(null);
  };

  // Create Pod handler
  const handleCreatePod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.subjectCode) {
      setActionError('Name and Subject Code are required.');
      return;
    }
    setIsActionPending(true);
    setActionError(null);
    try {
      await apiClient.post('/pods', formData);
      setIsCreateOpen(false);
      resetForm();
      await fetchPods();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create pod.');
    } finally {
      setIsActionPending(false);
    }
  };

  // Validates the 8 geo-boundary coordinate inputs
  const validateBoundaryInputs = () => {
    if (!enableGeoBoundary) return { valid: true, data: null };

    const parsed: { lat: number; lng: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const latStr = geoBoundary[i]?.lat?.trim();
      const lngStr = geoBoundary[i]?.lng?.trim();
      if (!latStr || !lngStr) {
        return { valid: false, error: `Point ${i + 1} must have both latitude and longitude.` };
      }
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return { valid: false, error: `Point ${i + 1} latitude (${latStr}) must be between -90 and 90 degrees.` };
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return { valid: false, error: `Point ${i + 1} longitude (${lngStr}) must be between -180 and 180 degrees.` };
      }
      parsed.push({ lat, lng });
    }

    // Check duplicate consecutive points
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      const currP = parsed[i];
      const nextP = parsed[next];
      if (currP && nextP && Math.abs(currP.lat - nextP.lat) < 1e-6 && Math.abs(currP.lng - nextP.lng) < 1e-6) {
        return { valid: false, error: `Points ${i + 1} and ${next + 1} are identical duplicate coordinates.` };
      }
    }

    return { valid: true, data: parsed };
  };

  // Helper to generate an 8-point perimeter octagon (~15m radius) around user's GPS
  const handleAutoPerimeter = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const centerLat = pos.coords.latitude;
        const centerLng = pos.coords.longitude;
        const rLat = 0.00014; // ~15.5 meters in latitude
        const rLng = 0.00014 / Math.max(0.1, Math.cos((centerLat * Math.PI) / 180));

        const points = [];
        for (let i = 0; i < 8; i++) {
          const angle = (i * 2 * Math.PI) / 8;
          points.push({
            lat: (centerLat + rLat * Math.sin(angle)).toFixed(6),
            lng: (centerLng + rLng * Math.cos(angle)).toFixed(6),
          });
        }
        setGeoBoundary(points);
        setEnableGeoBoundary(true);
      },
      (err) => {
        setGeoError('Failed to acquire GPS location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Edit Pod handler
  const handleEditPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPod) return;
    if (!formData.name || !formData.subjectCode) {
      setActionError('Name and Subject Code are required.');
      return;
    }

    const geoVal = validateBoundaryInputs();
    if (!geoVal.valid) {
      setGeoError(geoVal.error || 'Invalid classroom boundary coordinates.');
      return;
    }
    setGeoError(null);

    setIsActionPending(true);
    setActionError(null);
    try {
      const payload = {
        ...formData,
        geoBoundary: enableGeoBoundary ? geoVal.data : null,
      };
      await apiClient.patch(`/pods/${selectedPod.id}`, payload);
      setIsEditOpen(false);
      setSelectedPod(null);
      resetForm();
      await fetchPods();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update pod.');
    } finally {
      setIsActionPending(false);
    }
  };

  // Open Edit Dialog
  const openEditModal = (pod: Pod) => {
    setSelectedPod(pod);
    setFormData({
      name: pod.name,
      subjectCode: pod.subjectCode,
      description: pod.description || '',
      semester: pod.semester || '',
      section: pod.section || '',
    });

    if (pod.geoBoundary && Array.isArray(pod.geoBoundary) && pod.geoBoundary.length === 8) {
      setGeoBoundary(pod.geoBoundary.map((p: any) => ({ lat: String(p.lat), lng: String(p.lng) })));
      setEnableGeoBoundary(true);
    } else {
      setGeoBoundary(Array(8).fill({ lat: '', lng: '' }));
      setEnableGeoBoundary(false);
    }
    setGeoError(null);
    setIsEditOpen(true);
  };

  // Archive Pod handler
  const handleArchivePod = (podId: string) => {
    setConfirmConfig({
      title: 'Archive Pod',
      message: 'Are you sure you want to archive this pod? Active attendance sessions will no longer be possible.',
      actionText: 'Archive',
      variant: 'destructive',
      onConfirm: async () => {
        setIsActionPending(true);
        setActionError(null);
        try {
          await apiClient.post(`/pods/${podId}/archive`);
          await fetchPods();
          setConfirmConfig(null);
        } catch (err: any) {
          setActionError(err?.message || 'Failed to archive pod.');
        } finally {
          setIsActionPending(false);
        }
      },
    });
  };

  // Join Pod handler
  const handleJoinPod = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanJoinCode = joinCode.trim();
    if (cleanJoinCode.length !== 7 || !/^[a-zA-Z0-9]{7}$/.test(cleanJoinCode)) {
      setActionError('Join code must be exactly 7 alphanumeric characters.');
      return;
    }
    setIsActionPending(true);
    setActionError(null);
    try {
      await apiClient.post('/pods/join', { joinCode: cleanJoinCode });
      setIsJoinOpen(false);
      resetForm();
      await fetchPods();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to join pod. Verify the code.');
    } finally {
      setIsActionPending(false);
    }
  };

  // Leave Pod handler
  const handleLeavePod = (podId: string) => {
    setConfirmConfig({
      title: 'Leave Pod',
      message: 'Are you sure you want to leave this pod? You will need the join code to join again.',
      actionText: 'Leave Class',
      variant: 'destructive',
      onConfirm: async () => {
        setIsActionPending(true);
        setActionError(null);
        try {
          await apiClient.post(`/pods/${podId}/leave`);
          await fetchPods();
          setConfirmConfig(null);
        } catch (err: any) {
          setActionError(err?.message || 'Failed to leave pod.');
        } finally {
          setIsActionPending(false);
        }
      },
    });
  };

  // Filtered Pods
  const filteredPods = useMemo(() => {
    return pods.filter((pod) => {
      // For teachers, filter based on activeTab (ACTIVE or ARCHIVED)
      if (isTeacher && pod.status !== activeTab) {
        return false;
      }

      // Search matches
      const query = searchQuery.toLowerCase();
      return (
        pod.name.toLowerCase().includes(query) ||
        pod.subjectCode.toLowerCase().includes(query) ||
        (pod.description && pod.description.toLowerCase().includes(query)) ||
        (pod.semester && pod.semester.toLowerCase().includes(query)) ||
        (pod.section && pod.section.toLowerCase().includes(query))
      );
    });
  }, [pods, searchQuery, isTeacher, activeTab]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner/Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Pods Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isTeacher
              ? 'Manage your academic pods, view student rosters, and generate enrollment codes.'
              : 'Access your joined classes, view learning resources, and interact with peers.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isTeacher && (
            <Button
              onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-2 shadow-lg bg-primary hover:bg-primary/90 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Create Pod</span>
            </Button>
          )}
          {isStudent && (
            <Button
              onClick={() => {
                resetForm();
                setIsJoinOpen(true);
              }}
              className="flex items-center gap-2 shadow-lg bg-primary hover:bg-primary/90 transition-all active:scale-95"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Join Pod</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Attendance Session Banner */}
      {isStudent && activeSession && (
        <div
          onClick={() => setIsCheckinModalOpen(true)}
          className="bg-primary/10 border border-primary/30 text-primary p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-primary/15 transition-all shadow-sm animate-pulse"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔔</span>
            <div>
              <p className="font-bold text-sm sm:text-base">
                Active Attendance Session running for {activeSession.pod?.name || 'your class'}!
              </p>
              <p className="text-xs text-primary/80 mt-0.5">
                Click here to submit your attendance check-in.
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/95 shrink-0">
            Check In
          </Button>
        </div>
      )}

      {/* Quick Stats or Sub-Navigation / Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search pods by name, subject code, or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 h-10 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Teacher tab selection */}
        {isTeacher && (
          <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground select-none">
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none ${
                activeTab === 'ACTIVE'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
              }`}
            >
              Active Pods
            </button>
            <button
              onClick={() => setActiveTab('ARCHIVED')}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none ${
                activeTab === 'ARCHIVED'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
              }`}
            >
              Archived
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {error && (
        <div className="flex items-center gap-3 p-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-lg shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium">{error}</div>
          <Button variant="ghost" onClick={fetchPods} className="ml-auto text-xs h-8 border border-destructive/20 hover:bg-destructive/10">
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="border rounded-xl p-5 space-y-4 animate-pulse bg-muted/20">
              <div className="flex justify-between items-start">
                <div className="h-4 bg-muted-foreground/20 rounded w-1/3"></div>
                <div className="h-6 bg-muted-foreground/20 rounded w-16"></div>
              </div>
              <div className="h-6 bg-muted-foreground/20 rounded w-3/4"></div>
              <div className="h-12 bg-muted-foreground/20 rounded"></div>
              <div className="flex gap-2">
                <div className="h-4 bg-muted-foreground/20 rounded w-1/4"></div>
                <div className="h-4 bg-muted-foreground/20 rounded w-1/4"></div>
              </div>
              <div className="border-t pt-4 flex gap-2">
                <div className="h-9 bg-muted-foreground/20 rounded w-1/2"></div>
                <div className="h-9 bg-muted-foreground/20 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredPods.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed rounded-2xl bg-muted/5 min-h-[300px]">
          <div className="p-4 bg-primary/10 text-primary rounded-full mb-4">
            <BookOpen className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold">No pods found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">
            {searchQuery
              ? "We couldn't find any pods matching your search query. Try clearing the filter."
              : isTeacher
              ? "You haven't created any pods yet. Click 'Create Pod' to get started."
              : "You haven't joined any pods yet. Ask your instructor for a join code."}
          </p>
          {!searchQuery && (
            <div className="mt-6">
              {isTeacher && (
                <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Create Your First Pod
                </Button>
              )}
              {isStudent && (
                <Button onClick={() => setIsJoinOpen(true)} className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" /> Enter a Join Code
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPods.map((pod) => (
            <div
              key={pod.id}
              className={`group flex flex-col justify-between border rounded-xl bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden ${
                pod.status === 'ARCHIVED' ? 'opacity-75 bg-muted/10' : ''
              }`}
            >
              {/* Card top gradient line */}
              <div className={`h-1.5 w-full ${pod.status === 'ACTIVE' ? 'bg-primary' : 'bg-muted-foreground/40'}`} />

              <div className="p-6 flex-1 space-y-4">
                {/* Badge and Status */}
                <div className="flex justify-between items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                    {pod.subjectCode}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      pod.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-muted-foreground/20'
                    }`}
                  >
                    {pod.status}
                  </span>
                </div>

                {/* Pod Details */}
                <div>
                  <h3 className="text-xl font-bold tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {pod.name}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mt-1 min-h-[40px]">
                    {pod.description || 'No description provided.'}
                  </p>
                </div>

                {/* Semester / Section details */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1">
                  {pod.semester && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{pod.semester}</span>
                    </div>
                  )}
                  {pod.section && (
                    <div className="flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />
                      <span>Sec {pod.section}</span>
                    </div>
                  )}
                </div>

                {/* Join Code section */}
                {pod.status === 'ACTIVE' && (
                  <div className="bg-muted/40 hover:bg-muted/60 border rounded-lg p-3 flex items-center justify-between transition-colors">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Join Code</span>
                      <p className="font-mono text-sm font-bold tracking-widest text-foreground">{pod.joinCode}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyCode(pod.joinCode, pod.id)}
                      className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-background"
                      title="Copy Join Code"
                    >
                      {copiedId === pod.id ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Action Buttons - Responsive 2x2 Grid on Mobile, Flex on Desktop */}
              <div className="border-t px-4 py-3 sm:px-6 sm:py-4 bg-muted/10 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                {isTeacher ? (
                  <>
                    <Link href={`/pods/${pod.id}/members`} passHref legacyBehavior>
                      <Button variant="secondary" size="sm" className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs h-9">
                        <Users className="h-3.5 w-3.5" />
                        <span>Roster</span>
                      </Button>
                    </Link>

                    {pod.status === 'ACTIVE' && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openAttendanceModal(pod)}
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs h-9 bg-primary/10 text-primary hover:bg-primary/20 border-transparent font-semibold"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>Attendance</span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(pod)}
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs h-9"
                          disabled={isActionPending}
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleArchivePod(pod.id)}
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs h-9 text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent"
                          disabled={isActionPending}
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span>Archive</span>
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  // Student actions
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleLeavePod(pod.id)}
                    className="w-full sm:w-auto col-span-2 flex items-center justify-center gap-1.5 text-xs h-9 text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent"
                    disabled={isActionPending}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Leave Pod</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE POD MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-xl font-bold tracking-tight">Create New Pod</h2>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}
                className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePod} className="p-5 space-y-4">
              {actionError && (
                <div className="flex items-center gap-2 p-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="create-name">
                  Pod Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="create-name"
                  type="text"
                  required
                  placeholder="e.g. Advanced Software Engineering"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="create-subjectCode">
                    Subject Code <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="create-subjectCode"
                    type="text"
                    required
                    placeholder="e.g. CS-301"
                    value={formData.subjectCode}
                    onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="create-semester">
                    Semester
                  </label>
                  <input
                    id="create-semester"
                    type="text"
                    placeholder="e.g. Fall 2026"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="create-section">
                  Section / Class Group
                </label>
                <input
                  id="create-section"
                  type="text"
                  placeholder="e.g. A, B, or Lab 3"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="create-description">
                  Description
                </label>
                <textarea
                  id="create-description"
                  placeholder="Provide a brief description or syllabus overview..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full p-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  disabled={isActionPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isActionPending} className="flex items-center gap-1.5">
                  {isActionPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Create Pod</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT POD MODAL */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-xl font-bold tracking-tight">Edit Pod Details</h2>
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setSelectedPod(null);
                  resetForm();
                }}
                className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditPod} className="p-5 space-y-4">
              {actionError && (
                <div className="flex items-center gap-2 p-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="edit-name">
                  Pod Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  placeholder="e.g. Advanced Software Engineering"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="edit-subjectCode">
                    Subject Code <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="edit-subjectCode"
                    type="text"
                    required
                    placeholder="e.g. CS-301"
                    value={formData.subjectCode}
                    onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="edit-semester">
                    Semester
                  </label>
                  <input
                    id="edit-semester"
                    type="text"
                    placeholder="e.g. Fall 2026"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="edit-section">
                  Section / Class Group
                </label>
                <input
                  id="edit-section"
                  type="text"
                  placeholder="e.g. A, B, or Lab 3"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="edit-description">
                  Description
                </label>
                <textarea
                  id="edit-description"
                  placeholder="Provide a brief description or syllabus overview..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full p-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 resize-none"
                />
              </div>

              {/* GEO SPATIAL ENVIRONMENT */}
              <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <div>
                      <h3 className="text-xs font-bold text-foreground">Geo Spatial Environment</h3>
                      <p className="text-[11px] text-muted-foreground">Enforce 8-point classroom attendance boundary polygon</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableGeoBoundary}
                      onChange={(e) => {
                        setEnableGeoBoundary(e.target.checked);
                        if (e.target.checked && geoBoundary.every((p) => !p.lat && !p.lng)) {
                          handleAutoPerimeter();
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {geoError && (
                  <div className="flex items-center gap-2 p-2.5 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{geoError}</span>
                  </div>
                )}

                {enableGeoBoundary && (
                  <div className="space-y-2.5 pt-1 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted-foreground text-[11px]">8 Coordinate Vertex Pairs</span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleAutoPerimeter}
                          className="h-6 text-[10px] px-2 gap-1 font-bold bg-background"
                        >
                          <Globe className="h-3 w-3 text-primary" />
                          <span>Autofill ~15m Around Me</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setGeoBoundary(Array(8).fill({ lat: '', lng: '' }))}
                          className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1.5 border rounded-lg bg-background">
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <div key={idx} className="p-2 rounded-md border bg-muted/30 space-y-1 text-xs">
                          <span className="font-bold text-[11px] text-foreground flex items-center gap-1">
                            Point {idx + 1}
                          </span>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <input
                                type="text"
                                placeholder="Latitude"
                                value={geoBoundary[idx]?.lat || ''}
                                onChange={(e) => {
                                  const updated = [...geoBoundary];
                                  const current = updated[idx] || { lat: '', lng: '' };
                                  updated[idx] = { lat: e.target.value, lng: current.lng || '' };
                                  setGeoBoundary(updated);
                                }}
                                className="w-full h-7 px-2 rounded border text-[11px] bg-background font-mono"
                              />
                            </div>
                            <div>
                              <input
                                type="text"
                                placeholder="Longitude"
                                value={geoBoundary[idx]?.lng || ''}
                                onChange={(e) => {
                                  const updated = [...geoBoundary];
                                  const current = updated[idx] || { lat: '', lng: '' };
                                  updated[idx] = { lat: current.lat || '', lng: e.target.value };
                                  setGeoBoundary(updated);
                                }}
                                className="w-full h-7 px-2 rounded border text-[11px] bg-background font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditOpen(false);
                    setSelectedPod(null);
                    resetForm();
                  }}
                  disabled={isActionPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isActionPending} className="flex items-center gap-1.5">
                  {isActionPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Save Changes</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN POD MODAL */}
      {isJoinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm">
          <div className="relative w-full max-w-md border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-xl font-bold tracking-tight">Join Pod</h2>
              <button
                onClick={() => {
                  setIsJoinOpen(false);
                  resetForm();
                }}
                className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleJoinPod} className="p-5 space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Ask your teacher for the 7-character join code (e.g. <code>A1B2C3D</code>) to enroll in their class.
                  </p>
                </div>
              </div>

              {actionError && (
                <div className="flex items-center gap-2 p-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="joinCodeInput">
                  Join Code
                </label>
                <input
                  id="joinCodeInput"
                  type="text"
                  maxLength={7}
                  required
                  placeholder="Enter 7-character code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="w-full h-12 px-4 rounded-md border border-input bg-background text-base font-mono text-center tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsJoinOpen(false);
                    resetForm();
                  }}
                  disabled={isActionPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isActionPending || joinCode.length !== 7} className="flex items-center gap-1.5">
                  {isActionPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Join Class</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT CHECK-IN MODAL */}
      {isCheckinModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-xl font-bold tracking-tight">Attendance Check-in</h2>
              <button
                onClick={() => setIsCheckinModalOpen(false)}
                className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {attendanceError && (
                <div className="flex items-center gap-2 p-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{attendanceError}</span>
                </div>
              )}
              <div className="space-y-1">
                <h3 className="font-bold text-lg">{activeSession.pod?.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Subject Code: {activeSession.pod?.subjectCode}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/40 border space-y-2">
                <p className="text-sm font-medium text-foreground">
                  An attendance session is currently active for this class.
                </p>
                <p className="text-xs text-muted-foreground">
                  Please click the button below to verify that you are present in the class.
                </p>
              </div>

              {/* Status display */}
              {(() => {
                const decisionStatus = (
                  activeSession.studentDecision?.status ||
                  activeSession.decision?.status ||
                  'PENDING'
                ).toUpperCase();

                if (decisionStatus === 'PENDING') {
                  return (
                    <div className="space-y-4">
                      {/* Bluetooth Disabled 1-Tap Enable Banner */}
                      {isBluetoothEnabled === false && (
                        <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 space-y-2.5 animate-in fade-in duration-200">
                          <div className="flex items-start gap-2.5">
                            <Bluetooth className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-amber-200">Bluetooth is Turned OFF</p>
                              <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                                ClassPod requires Bluetooth & Location (GPS) to verify that you are physically inside the classroom.
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={handleEnableBluetooth}
                            size="sm"
                            className="w-full h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <Bluetooth className="h-3.5 w-3.5" />
                            <span>Turn ON Bluetooth</span>
                          </Button>
                        </div>
                      )}

                      {/* 3-Point Classroom Verification Signals Checklist */}
                      <div className="p-3.5 border rounded-xl bg-card shadow-sm space-y-2.5">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Classroom Proximity Signals
                          </span>
                          <Button
                            onClick={() => {
                              setBleStatus('scanning');
                              setDetectedGateway(null);
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 flex items-center gap-1"
                          >
                            <RefreshCw className={`h-3 w-3 ${bleStatus === 'scanning' ? 'animate-spin' : ''}`} />
                            <span>Rescan</span>
                          </Button>
                        </div>

                        <div className="space-y-2 text-xs">
                          {/* Signal 1: Bluetooth */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-3.5 w-3.5 text-blue-400" />
                              <span className="font-semibold text-foreground">Bluetooth & Location</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isBluetoothEnabled === false
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}>
                              {isBluetoothEnabled === false ? 'Turn ON' : 'Active'}
                            </span>
                          </div>

                          {/* Signal 2: Classroom Beacon */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border">
                            <div className="flex items-center gap-2">
                              <Bluetooth className={`h-3.5 w-3.5 ${bleStatus === 'found' ? 'text-emerald-400' : 'text-primary animate-pulse'}`} />
                              <span className="font-semibold text-foreground">ESP32 Gateway Beacon</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              bleStatus === 'found'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                            }`}>
                              {bleStatus === 'found' ? (detectedGateway?.rssi ? `${detectedGateway.rssi} dBm` : 'In Range') : 'Scanning...'}
                            </span>
                          </div>
                        </div>

                        {bleStatus === 'error' && (
                          <div className="flex items-center gap-2 text-[10px] text-destructive bg-destructive/5 p-2 rounded border border-destructive/10">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>Ensure Bluetooth & GPS are ON in your phone quick settings.</span>
                          </div>
                        )}
                      </div>

                      <div className="relative flex items-center justify-center py-2">
                        {bleStatus === 'scanning' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="animate-sonar absolute h-24 w-24 rounded-full bg-primary/25 border border-primary/45" />
                            <div className="animate-sonar absolute h-32 w-32 rounded-full bg-primary/10 border border-primary/20" style={{ animationDelay: '0.6s' }} />
                          </div>
                        )}
                        <Button
                          onClick={handleCheckIn}
                          disabled={isCheckinLoading}
                          className={`w-full h-12 text-sm sm:text-base font-bold ${
                            bleStatus === 'found'
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                              : 'bg-primary hover:bg-primary/95 text-primary-foreground'
                          } shadow-lg flex items-center justify-center gap-2 relative z-10 transition-all ${isCheckinLoading ? 'scale-95' : ''}`}
                        >
                          {isCheckinLoading ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Verifying Proximity & Checking In...</span>
                            </>
                          ) : bleStatus === 'found' ? (
                            <>
                              <CheckCircle2 className="h-5 w-5" />
                              <span>✓ In Range • Confirm I'm Here</span>
                            </>
                          ) : (
                            <>
                              <Bluetooth className="h-4 w-4 animate-pulse" />
                              <span>Confirm I'm Here (Verify BLE)</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                } else if (decisionStatus === 'CHECKED_IN') {
                  return (
                    <div className="flex flex-col items-center justify-center p-6 border border-blue-500/20 bg-blue-500/5 text-blue-600 rounded-xl space-y-2 animate-scaleup">
                      <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center relative">
                        <span className="animate-sonar absolute inset-0 rounded-full bg-blue-400/20 border border-blue-400/40" />
                        <Check className="h-6 w-6 text-blue-600" />
                      </div>
                      <span className="font-bold text-base">Check-in Submitted</span>
                      <span className="text-xs text-muted-foreground text-center">Status: Pending BLE verification...</span>
                    </div>
                  );
                } else if (decisionStatus === 'VERIFIED') {
                  return (
                    <div className="flex flex-col items-center justify-center p-6 border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 rounded-xl space-y-2 animate-scaleup">
                      <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path className="path-checkmark" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="font-bold text-base">Verified</span>
                      <span className="text-xs text-muted-foreground text-center">Your attendance has been successfully verified!</span>
                    </div>
                  );
                } else if (decisionStatus === 'EXPIRED') {
                  return (
                    <div className="flex flex-col items-center justify-center p-6 border border-destructive/20 bg-destructive/5 text-destructive rounded-xl space-y-2 animate-scaleup">
                      <X className="h-8 w-8 text-destructive bg-destructive/10 p-1.5 rounded-full" />
                      <span className="font-bold text-base">Session Expired</span>
                      <span className="text-xs text-muted-foreground text-center">You did not check in on time.</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="flex flex-col items-center justify-center p-5 border border-destructive/20 bg-destructive/5 text-destructive rounded-xl space-y-1">
                      <X className="h-8 w-8 text-destructive bg-destructive/10 p-1.5 rounded-full" />
                      <span className="font-bold text-base">Absent / Rejected</span>
                      <span className="text-xs text-muted-foreground">Status: {decisionStatus}</span>
                    </div>
                  );
                }
              })()}
            </div>

            <div className="flex justify-end border-t p-4 bg-muted/20">
              <Button variant="secondary" onClick={() => setIsCheckinModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER ATTENDANCE MANAGEMENT MODAL */}
      {isAttendanceOpen && selectedAttendancePod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Attendance Session</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedAttendancePod.name} ({selectedAttendancePod.subjectCode})
                </p>
              </div>
              <button
                onClick={() => {
                  setIsAttendanceOpen(false);
                  setSelectedAttendancePod(null);
                  setAttendanceSession(null);
                  setLocalTimeRemaining(null);
                }}
                className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!attendanceSession ? (
              /* Pre-Session States (IDLE, CAPTURING_5S, ANALYZING, ANALYSIS_COMPLETE, ERROR) */
              <div className="p-6 space-y-6">
                {attendanceError && !attendanceError.includes('already an active attendance session') && (
                  <div className="flex items-center gap-2 p-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{attendanceError}</span>
                  </div>
                )}

                {/* State: CAPTURING_5S / ANALYZING / ANALYSIS_COMPLETE */}
                {(cameraFlow.analysisState === 'CAPTURING_5S' ||
                  cameraFlow.analysisState === 'ANALYZING' ||
                  cameraFlow.analysisState === 'ANALYSIS_COMPLETE') && (
                  <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-4">
                      {/* Header & Status Pill */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Camera className="h-5 w-5 text-purple-400 animate-pulse" />
                          <h4 className="font-bold text-sm text-foreground">5-Second Camera Analysis</h4>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                            cameraFlow.analysisState === 'ANALYSIS_COMPLETE'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : cameraFlow.analysisState === 'ANALYZING'
                              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                              : 'bg-purple-500/20 text-purple-400 border-purple-500/40 animate-pulse'
                          }`}
                        >
                          {cameraFlow.analysisState === 'CAPTURING_5S' && '📸 Capturing classroom...'}
                          {cameraFlow.analysisState === 'ANALYZING' && '🔬 Aggregating consensus...'}
                          {cameraFlow.analysisState === 'ANALYSIS_COMPLETE' && '🟢 Analysis Complete'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>
                            Analyzing frames: <strong className="text-foreground">{cameraFlow.capturedFrames.length}</strong> captured
                          </span>
                          <span>{((cameraFlow.captureProgress / 100) * 5).toFixed(1)}s / 5.0s</span>
                        </div>
                        <div className="w-full h-2.5 bg-muted/40 rounded-full overflow-hidden border">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500 transition-all duration-75 ease-out rounded-full"
                            style={{ width: `${cameraFlow.captureProgress}%` }}
                          />
                        </div>
                      </div>

                      {/* Frame Chips Stream */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Multi-Frame Stream ({cameraFlow.capturedFrames.length} frames)
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1 max-h-24 scrollbar-thin">
                          {cameraFlow.capturedFrames.map((frame: FrameDetection) => (
                            <div
                              key={frame.frameIndex}
                              className="px-2.5 py-1.5 rounded-lg border bg-card/80 text-xs shrink-0 flex flex-col items-center justify-center space-y-0.5 border-purple-500/20 animate-in fade-in"
                            >
                              <span className="text-[10px] text-muted-foreground">F{frame.frameIndex + 1}</span>
                              <span className="font-bold text-foreground">{frame.personCount}</span>
                              <span className="text-[9px] text-purple-400">
                                {Math.round(frame.confidence > 1 ? frame.confidence : frame.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                          {cameraFlow.capturedFrames.length === 0 && (
                            <div className="text-xs text-muted-foreground italic py-2">
                              Starting camera stream...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Consensus Result Pill on Complete */}
                      {cameraFlow.aggregationResult && cameraFlow.aggregationResult.success && (
                        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-xs animate-in fade-in">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-emerald-400" />
                            <span className="font-semibold text-emerald-300">
                              Established Baseline: <strong>{cameraFlow.aggregationResult.personCount} students</strong>
                            </span>
                          </div>
                          <span className="text-emerald-400 font-bold">
                            {cameraFlow.aggregationResult.confidence}% confidence
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Window Controls */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => cameraFlow.abortCapture()}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        <span>Cancel Analysis</span>
                      </Button>
                      {process.env.NODE_ENV === 'development' && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => cameraFlow.skipToSession()}
                          className="text-xs"
                        >
                          <PlayCircle className="h-3.5 w-3.5 mr-1" />
                          <span>Skip to Session (Manual Dev)</span>
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* State: ERROR OR ACTIVE SESSION CONFLICT */}
                {(cameraFlow.analysisState === 'ERROR' || (attendanceError && attendanceError.includes('already an active attendance session'))) && (
                  <div className="space-y-4 animate-in fade-in">
                    {/* Conflict Card: Active Session in Progress */}
                    {((attendanceError && attendanceError.includes('already an active attendance session')) ||
                      (cameraFlow.errorMessage && cameraFlow.errorMessage.includes('already an active attendance session'))) ? (
                      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                          <Timer className="h-5 w-5 shrink-0 animate-pulse" />
                          <span>Active Attendance Session in Progress</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          An attendance session for <strong>{selectedAttendancePod.name}</strong> is already active in the background. Choose how you would like to proceed:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={handleResumeActiveSession}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          >
                            <PlayCircle className="h-4 w-4 mr-1.5" />
                            <span>Resume Session</span>
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleEndSession}
                            className="text-xs"
                          >
                            <X className="h-4 w-4 mr-1.5" />
                            <span>End Active Session</span>
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleForceRestartSession}
                            className="text-xs border border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                          >
                            <RotateCcw className="h-4 w-4 mr-1.5" />
                            <span>Force Restart</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Camera Error Card */
                      <>
                        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2">
                          <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <span>Camera Detection Failed</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {cameraFlow.errorMessage || attendanceError || 'Camera disconnected or insufficient valid frames were captured.'}
                          </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              cameraFlow.resetAnalysis();
                              setAttendanceError(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => cameraFlow.startCameraAnalysis()}
                            className="flex items-center gap-1.5 bg-primary"
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span>Retry 5-Second Analysis</span>
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* State: IDLE */}
                {cameraFlow.analysisState === 'IDLE' && !attendanceError && (
                  <>
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-3">
                      <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-sm text-primary">5-Second Baseline + 90-Second Attendance</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          When started, the camera will first capture and aggregate classroom frames for <strong>5 seconds</strong> to establish a stable student count. The <strong>90-second</strong> attendance timer begins immediately after.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold" htmlFor="attendance-duration">
                        Session Duration (seconds)
                      </label>
                      <input
                        id="attendance-duration"
                        type="number"
                        min={10}
                        max={600}
                        value={duration}
                        onChange={(e) => setDuration(Math.max(10, parseInt(e.target.value) || 90))}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        Recommended: 90 seconds. Give students enough time to scan and check in.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-4">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setIsAttendanceOpen(false);
                          setSelectedAttendancePod(null);
                          cameraFlow.resetAnalysis();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleStartSession}
                        disabled={cameraFlow.isProcessing}
                        className="flex items-center gap-1.5"
                      >
                        {cameraFlow.isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                        <span>Start Attendance</span>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* State 2: Session Running */
              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {attendanceError && (
                  <div className="flex items-center gap-2 p-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive rounded-md mb-4">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{attendanceError}</span>
                  </div>
                )}
                {/* Countdown & Session Control Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border bg-accent/40">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-full text-primary animate-pulse">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Time Remaining</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-extrabold text-foreground tracking-tight">
                          {localTimeRemaining !== null ? `${localTimeRemaining}s` : 'Calculating...'}
                        </p>
                        {/* Quick Time Extender Buttons */}
                        <div className="flex items-center gap-1.5 ml-2">
                          <button
                            type="button"
                            onClick={() => handleExtendSession(30)}
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-all"
                            title="Add 30 seconds"
                          >
                            +30s
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExtendSession(60)}
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-all"
                            title="Add 60 seconds"
                          >
                            +60s
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCancelSession}
                      disabled={isEndingSession}
                      className="border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                      title="Void session without saving absences"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      <span>Void / Cancel</span>
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleEndSession}
                      disabled={isEndingSession}
                      className="shadow-md font-bold text-xs"
                    >
                      {isEndingSession && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      <span>End & Finalize</span>
                    </Button>
                  </div>
                </div>

                {/* AUTOMATED HARDWARE & AI OCCUPANCY DETECTION CARD */}
                <div className="border border-purple-500/30 bg-purple-500/5 rounded-2xl p-5 space-y-4 shadow-sm">
                  {/* Status & Pipeline Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        🟢 Gateway Connected
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        🟢 Camera Connected
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-medium">Camera Status:</span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                          attendanceSession.gatewayStatus?.cameraStatus === 'Analysis Complete' || attendanceSession.latestAiObservation
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse'
                        }`}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        {attendanceSession.gatewayStatus?.cameraStatus || (attendanceSession.latestAiObservation ? 'Analysis Complete' : 'Capturing...')}
                      </span>

                      {(!attendanceSession.latestAiObservation || attendanceSession.gatewayStatus?.cameraStatus === 'Capturing...') && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await apiClient.post('/gateway/esp32-cam-node-1/simulate-observation', {
                                sessionId: attendanceSession.id,
                                personCount: 28,
                                expectedCount: liveStats.total || 32,
                              });
                              const liveRes = await apiClient.get<any>(`/attendance/session/${attendanceSession.id}/live`);
                              if (liveRes.data) {
                                setAttendanceSession((prev: any) => ({
                                  ...prev,
                                  ...liveRes.data,
                                  id: liveRes.data?.id || prev?.id,
                                  podId: liveRes.data?.podId || prev?.podId,
                                }));
                              }
                            } catch (err) {
                              window.console.error('Trigger capture error:', err);
                            }
                          }}
                          className="h-7 text-xs px-2.5 bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-all"
                        >
                          📸 Trigger Frame (Demo)
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* AI Detection Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl border bg-card/60 text-center space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Expected</p>
                      <p className="text-2xl font-extrabold text-foreground">
                        {attendanceSession.latestAiObservation?.expectedCount ?? liveStats.total ?? 32}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-center space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-purple-400">Detected</p>
                      <p className="text-2xl font-extrabold text-purple-400">
                        {attendanceSession.gatewayStatus?.cameraStatus === 'AI Offline'
                          ? '--'
                          : (attendanceSession.latestAiObservation?.personCount ?? '--')}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border bg-card/60 text-center space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Difference</p>
                      <p
                        className={`text-2xl font-extrabold ${
                          attendanceSession.gatewayStatus?.cameraStatus === 'AI Offline'
                            ? 'text-muted-foreground'
                            : (attendanceSession.latestAiObservation?.difference ?? 0) < 0
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        {attendanceSession.gatewayStatus?.cameraStatus === 'AI Offline'
                          ? '--'
                          : attendanceSession.latestAiObservation?.difference !== undefined
                          ? (attendanceSession.latestAiObservation.difference > 0 ? `+${attendanceSession.latestAiObservation.difference}` : attendanceSession.latestAiObservation.difference)
                          : '--'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-1">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Confidence</p>
                      <p className="text-2xl font-extrabold text-emerald-400">
                        {attendanceSession.gatewayStatus?.cameraStatus === 'AI Offline'
                          ? '--'
                          : attendanceSession.latestAiObservation?.confidence !== undefined && attendanceSession.latestAiObservation?.confidence !== null
                          ? (() => {
                              const c = attendanceSession.latestAiObservation.confidence;
                              const norm = c > 100 ? Math.round(c / 100) : c > 1 ? Math.round(c) : Math.round(c * 100);
                              return `${Math.min(100, Math.max(0, norm))}%`;
                            })()
                          : '--'}
                      </p>
                    </div>
                  </div>

                  {/* Real Proxy Discrepancy Alert: Digital Check-ins exceed Physical Headcount */}
                  {(() => {
                    const rawDetected = attendanceSession.latestAiObservation?.personCount;
                    const detectedCount = typeof rawDetected === 'number' ? rawDetected : 0;
                    const checkedInCount = liveStats.checkedIn || 0;

                    // Case 1: Proxy Anomaly -> More student phones checked in than physical humans seen by camera
                    if (checkedInCount > detectedCount) {
                      const proxyDiff = checkedInCount - detectedCount;
                      return (
                        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500 space-y-1.5 animate-in fade-in duration-300">
                          <div className="flex items-center gap-2 font-bold text-sm">
                            <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                            <span>⚠ PROXY RISK DETECTED (+{proxyDiff} Digital Anomaly)</span>
                          </div>
                          <p className="text-xs text-rose-400 pl-7">
                            Discrepancy: {checkedInCount} student phone{checkedInCount > 1 ? 's' : ''} checked in, but camera optical headcount detected only {detectedCount} physical human{detectedCount === 1 ? '' : 's'} in the classroom.
                          </p>
                        </div>
                      );
                    }

                    // Case 2: In-Room Students Checking In -> Physical Headcount exceeds currently checked-in
                    if (detectedCount > checkedInCount && checkedInCount > 0) {
                      const waitingCount = detectedCount - checkedInCount;
                      return (
                        <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-500 space-y-1 animate-in fade-in duration-300">
                          <div className="flex items-center gap-2 font-bold text-xs">
                            <Users className="h-4 w-4 text-blue-500 shrink-0" />
                            <span>Physical Presence Verified ({detectedCount} Students Detected in Room)</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground pl-6">
                            {waitingCount} student{waitingCount > 1 ? 's' : ''} physically detected in room are currently submitting Bluetooth check-ins.
                          </p>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {/* Latest Camera Frame Thumbnail */}
                  {(attendanceSession.latestAiObservation?.image || attendanceSession.latestAiObservation?.imageUrl) && (
                    <div className="flex items-center justify-between gap-4 pt-2 border-t border-purple-500/20 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-20 rounded-lg overflow-hidden border bg-black shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={attendanceSession.latestAiObservation.image || attendanceSession.latestAiObservation.imageUrl}
                            alt="Classroom Capture"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <span className="font-bold text-foreground block">Automated Frame Capture</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Captured: {new Date(attendanceSession.latestAiObservation.capturedTime || Date.now()).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                        LIVE SYNC
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg border bg-card text-center space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Enrolled</p>
                    <p className="text-xl font-bold text-foreground">{liveStats.total}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-center space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-blue-600">Checked In</p>
                    <p className="text-xl font-bold text-blue-600">{liveStats.checkedIn}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">Verified</p>
                    <p className="text-xl font-bold text-emerald-600">{liveStats.verified}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-center space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-amber-600">Pending Verification</p>
                    <p className="text-xl font-bold text-amber-600">{liveStats.pending}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/40 text-center space-y-1 col-span-2 sm:col-span-1">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Absent</p>
                    <p className="text-xl font-bold text-foreground">{liveStats.absent}</p>
                  </div>
                </div>

                {/* Students List */}
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-foreground">Student Check-in Roster</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground text-xs uppercase font-bold border-b">
                          <tr>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-3 py-3 text-center">Device</th>
                            <th className="px-3 py-3 text-center">Biometric</th>
                            <th className="px-3 py-3 text-center">BLE</th>
                            <th className="px-3 py-3 text-center">Location</th>
                            <th className="px-4 py-3 text-right">Final Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(attendanceSession.decisions || []).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                                No students currently enrolled in this pod.
                              </td>
                            </tr>
                          ) : (
                            (attendanceSession.decisions || []).map((decision: any) => {
                              const hasDevice = !!decision.student?.registeredDevice?.deviceId;
                              const isBio =
                                decision.signals?.some((s: any) => s.source === 'BIOMETRIC' && s.payload?.verified) ||
                                decision.status === 'PRESENT' ||
                                decision.status === 'VERIFIED';
                              const isBle =
                                decision.signals?.some((s: any) => s.source === 'BLE' && s.payload?.verified) ||
                                decision.status === 'PRESENT' ||
                                decision.status === 'VERIFIED';
                              const isGeo =
                                decision.signals?.some((s: any) => s.source === 'GEOLOCATION' && s.payload?.verified) ||
                                decision.status === 'PRESENT';

                              const isFailure =
                                decision.status === 'NOT_PRESENT' || decision.status === 'REJECTED';

                              return (
                                <tr
                                  key={decision.id}
                                  className={`transition-all duration-300 ${
                                    isFailure
                                      ? 'bg-rose-500/5 hover:bg-rose-500/10'
                                      : recentlyUpdated[decision.id]
                                      ? `${recentlyUpdated[decision.id]} font-semibold`
                                      : 'hover:bg-muted/30'
                                  }`}
                                >
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-foreground">
                                      {decision.student?.name || 'Unknown Student'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {decision.student?.email || 'N/A'}
                                    </div>
                                    {isFailure && decision.explanation && (
                                      <div className="text-[11px] text-rose-500 font-medium mt-0.5">
                                        Reason: {decision.explanation}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {hasDevice ? (
                                      <span className="inline-flex items-center text-emerald-600 font-bold text-xs" title="Device Registered">
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-rose-500 font-bold text-xs" title="Unregistered Device">
                                        ✗
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {isBio ? (
                                      <span className="inline-flex items-center text-emerald-600 font-bold text-xs" title="Biometric Verified">
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-rose-500 font-bold text-xs" title="Biometric Not Verified">
                                        ✗
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {isBle ? (
                                      <span className="inline-flex items-center text-emerald-600 font-bold text-xs" title="BLE Proximity Verified">
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-rose-500 font-bold text-xs" title="BLE Missing">
                                        ✗
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    {isGeo ? (
                                      <span className="inline-flex items-center text-emerald-600 font-bold text-xs" title="Inside Classroom Boundary">
                                        ✓
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-rose-500 font-bold text-xs" title="Outside Classroom Boundary">
                                        ✗
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {getStatusBadge(decision.status)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL */}
      {confirmConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md border bg-card text-card-foreground shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-foreground">{confirmConfig.title}</h3>
              <p className="text-sm text-muted-foreground">{confirmConfig.message}</p>
            </div>
            {actionError && (
              <div className="px-6 pb-2">
                <div className="flex items-center gap-2 p-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t p-4 bg-muted/20">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmConfig(null);
                  setActionError(null);
                }}
                disabled={isActionPending}
              >
                Cancel
              </Button>
              <Button
                variant={confirmConfig.variant === 'destructive' ? 'destructive' : 'default'}
                onClick={confirmConfig.onConfirm}
                disabled={isActionPending}
                className="flex items-center gap-1.5"
              >
                {isActionPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{confirmConfig.actionText}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
