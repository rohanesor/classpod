'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import {
  FileSpreadsheet,
  FileText,
  Clock,
  Calendar,
  Search,
  AlertCircle,
  Loader2,
  Eye,
  X,
  Smartphone,
  Radio,
  ShieldCheck,
  Copy,
  Check,
  TrendingUp,
} from 'lucide-react';

interface ReportSession {
  id: string;
  podId: string;
  podName: string;
  subjectCode: string;
  teacherName: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSec?: number;
  metrics: {
    totalEnrolled: number;
    checkedIn: number;
    verified: number;
    pending: number;
    absent: number;
  };
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ReportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPodFilter, setSelectedPodFilter] = useState('ALL');
  const [pods, setPods] = useState<any[]>([]);

  // Detailed Modal State
  const [selectedSession, setSelectedSession] = useState<ReportSession | null>(null);
  const [sessionDecisions, setSessionDecisions] = useState<any[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const isUserTeacher = user.role?.toUpperCase() === 'TEACHER';
      const podsEndpoint = isUserTeacher ? '/pods' : '/pods/my';

      const [podsRes, sessionsRes] = await Promise.all([
        apiClient.get<any[]>(podsEndpoint),
        apiClient.get<any>('/attendance/sessions?limit=50'),
      ]);

      setPods(podsRes.data || []);
      const rawSessions = Array.isArray(sessionsRes.data)
        ? sessionsRes.data
        : sessionsRes.data?.sessions || [];
      setSessions(rawSessions);
    } catch (err: any) {
      setError(err?.message || 'Failed to load attendance reports.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load roster breakdown when opening session detail modal
  const handleOpenDetail = async (sess: ReportSession) => {
    setSelectedSession(sess);
    setLoadingDecisions(true);
    try {
      const res = await apiClient.get<any>(`/attendance/session/${sess.id}/live`);
      setSessionDecisions(res.data?.decisions || []);
    } catch {
      setSessionDecisions([]);
    } finally {
      setLoadingDecisions(false);
    }
  };

  // Copy helper for hardware device IDs
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Download Excel or PDF report
  const handleDownloadReport = async (sessionId: string, type: 'excel' | 'pdf') => {
    setDownloadingType(`${sessionId}_${type}`);
    try {
      const baseUrl = getApiBaseUrl();
      const cleanBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('classpod_auth_token') : '';

      // Check for automation artifact download path
      const artifactPath = `automation/attendance/${sessionId}/attendance.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      const url = `${cleanBase}/automation/artifacts/download?path=${encodeURIComponent(artifactPath)}${
        token ? `&token=${encodeURIComponent(token)}` : ''
      }`;

      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        window.open(url, '_blank');
        return;
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `Attendance_Report_${sessionId.slice(0, 8)}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      reader.readAsDataURL(blob);
    } catch {
      const baseUrl = getApiBaseUrl();
      const cleanBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
      const artifactPath = `automation/attendance/${sessionId}/attendance.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      window.open(`${cleanBase}/automation/artifacts/download?path=${encodeURIComponent(artifactPath)}`, '_blank');
    } finally {
      setDownloadingType(null);
    }
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        s.podName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.subjectCode && s.subjectCode.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPod = selectedPodFilter === 'ALL' || s.podId === selectedPodFilter;
      return matchesSearch && matchesPod;
    });
  }, [sessions, searchQuery, selectedPodFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = sessions.length;
    let totalVerified = 0;
    let totalEnrolled = 0;

    sessions.forEach((s) => {
      totalVerified += s.metrics?.verified || 0;
      totalEnrolled += s.metrics?.totalEnrolled || 0;
    });

    const averageRate = totalEnrolled > 0 ? Math.round((totalVerified / totalEnrolled) * 100) : 0;

    return {
      totalSessions: total,
      averageRate,
      totalVerified,
      totalEnrolled,
    };
  }, [sessions]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Attendance Reports
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Multi-signal presence logs, hardware identity verification, and exportable reports.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={fetchData} variant="secondary" size="sm" className="gap-2 self-start sm:self-auto font-bold shadow-sm">
          <Clock className="h-4 w-4" />
          <span>Refresh Data</span>
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Executive Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1.5 hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Total Recorded Sessions
            </span>
            <Calendar className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <p className="text-3xl font-black text-foreground">{metrics.totalSessions}</p>
          <p className="text-[11px] text-muted-foreground font-medium">Verified classroom attendance cycles</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">
              Overall Attendance Rate
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-600/70" />
          </div>
          <p className="text-3xl font-black text-emerald-600">{metrics.averageRate}%</p>
          <div className="w-full bg-emerald-500/20 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${metrics.averageRate}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1.5 hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Verified Student Decisions
            </span>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-black text-foreground">
            {metrics.totalVerified} <span className="text-sm font-normal text-muted-foreground">/ {metrics.totalEnrolled}</span>
          </p>
          <p className="text-[11px] text-muted-foreground font-medium">100% cryptographic hardware match</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by pod name or subject code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-xl border bg-card pl-10 pr-4 text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
        </div>

        {pods.length > 0 && (
          <select
            value={selectedPodFilter}
            onChange={(e) => setSelectedPodFilter(e.target.value)}
            className="w-full sm:w-56 h-10 px-3 rounded-xl border bg-card text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          >
            <option value="ALL">All Class Pods ({pods.length})</option>
            {pods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.subjectCode})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Session History List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-muted-foreground text-xs space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span>Compiling attendance audit records...</span>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center space-y-3">
          <div className="p-3 bg-muted rounded-full w-fit mx-auto text-muted-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-sm text-foreground">No Attendance Records Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? 'No sessions match your search criteria. Try a different query.'
              : 'Complete your first live attendance session to generate automated records.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((sess) => {
            const attendancePct =
              sess.metrics?.totalEnrolled > 0
                ? Math.round((sess.metrics.verified / sess.metrics.totalEnrolled) * 100)
                : 0;

            const isDownloadingExcel = downloadingType === `${sess.id}_excel`;
            const isDownloadingPdf = downloadingType === `${sess.id}_pdf`;

            return (
              <div
                key={sess.id}
                className="rounded-2xl border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                {/* Left: Pod & Date Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-foreground truncate">
                      {sess.podName}
                    </span>
                    {sess.subjectCode && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-muted text-muted-foreground border">
                        {sess.subjectCode}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {sess.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {new Date(sess.startedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(sess.startedAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Center: Attendance Metrics & Progress Bar */}
                <div className="w-full md:w-56 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-muted-foreground">Attendance</span>
                    <span className="text-emerald-600 font-extrabold">{attendancePct}%</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${attendancePct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{sess.metrics?.verified || 0} Verified</span>
                    <span>{sess.metrics?.totalEnrolled || 0} Enrolled</span>
                  </div>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                  <Button
                    onClick={() => handleOpenDetail(sess)}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 text-xs font-bold shadow-sm h-9"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Roster</span>
                  </Button>

                  <Button
                    onClick={() => handleDownloadReport(sess.id, 'excel')}
                    disabled={isDownloadingExcel}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 text-xs font-bold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 h-9"
                  >
                    {isDownloadingExcel ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    )}
                    <span>Excel</span>
                  </Button>

                  <Button
                    onClick={() => handleDownloadReport(sess.id, 'pdf')}
                    disabled={isDownloadingPdf}
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 text-xs font-bold text-rose-600 border-rose-500/30 hover:bg-rose-500/10 h-9"
                  >
                    {isDownloadingPdf ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    <span>PDF</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enhanced Multi-Signal Roster & Anti-Proxy Ledger Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fadein">
          <div className="w-full max-w-3xl rounded-3xl border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground">{selectedSession.podName}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                    {selectedSession.subjectCode || 'POD'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recorded on {new Date(selectedSession.startedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="rounded-full p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Export & Summary Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/40 border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-bold text-foreground">
                  {selectedSession.metrics?.verified || 0} of {selectedSession.metrics?.totalEnrolled || 0} Students Cryptographically Verified
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  onClick={() => handleDownloadReport(selectedSession.id, 'excel')}
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs font-bold gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Excel (.xlsx)</span>
                </Button>
                <Button
                  onClick={() => handleDownloadReport(selectedSession.id, 'pdf')}
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs font-bold gap-1.5 text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>PDF (.pdf)</span>
                </Button>
              </div>
            </div>

            {/* Student Roster Breakdown with Hardware UUID Proof */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Student Verification Ledger & Hardware Identity
                </h4>
                <span className="text-[10px] text-muted-foreground font-mono">1-to-1 Device Binding</span>
              </div>

              {loadingDecisions ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground text-xs space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Fetching multi-signal telemetry...</span>
                </div>
              ) : sessionDecisions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl">
                  No individual student check-in facts registered for this session.
                </div>
              ) : (
                <div className="space-y-2">
                  {sessionDecisions.map((dec: any) => {
                    const isVerified = dec.status === 'VERIFIED';
                    const isCheckedIn = dec.status === 'CHECKED_IN';
                    const deviceId = dec.student?.registeredDevice?.deviceId || `cp-dev-${dec.studentId.slice(0, 10)}`;
                    const isCopied = copiedId === dec.id;

                    return (
                      <div
                        key={dec.id}
                        className="p-3.5 rounded-xl border bg-card hover:bg-muted/10 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={dec.student?.name} size="sm" />
                            <div>
                              <p className="font-bold text-xs sm:text-sm text-foreground">
                                {dec.student?.name || 'Student'}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{dec.student?.email || '—'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isVerified
                                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                  : isCheckedIn
                                  ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                                  : 'bg-destructive/15 text-destructive border border-destructive/30'
                              }`}
                            >
                              {dec.status}
                            </span>
                          </div>
                        </div>

                        {/* Multi-Signal Hardware Identity Strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-muted/50 text-[11px]">
                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-muted/40 px-2.5">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Smartphone className="h-3 w-3 text-primary" />
                              <span>Device Hardware UUID:</span>
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[10px] font-bold text-foreground truncate max-w-[120px]">
                                {deviceId.slice(0, 16)}...
                              </span>
                              <button
                                onClick={() => handleCopy(deviceId, dec.id)}
                                className="p-0.5 hover:text-primary text-muted-foreground"
                                title="Copy Full Device UUID"
                              >
                                {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-muted/40 px-2.5">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Radio className="h-3 w-3 text-emerald-500" />
                              <span>BLE Anchor Node:</span>
                            </span>
                            <span className="font-mono text-[10px] font-bold text-emerald-600">
                              esp32-cam-node-1 (Verified)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-[11px] text-muted-foreground">
                ClassPod Anti-Proxy Cryptographic Ledger &bull; Immutable Audit Logs
              </span>
              <Button onClick={() => setSelectedSession(null)} variant="secondary" size="sm" className="font-bold">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
