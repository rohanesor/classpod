'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  FileSpreadsheet,
  FileText,
  Clock,
  Calendar,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  X,
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
      setSessions(sessionsRes.data?.sessions || []);
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Attendance Reports
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Historical attendance records, telemetry audits, and Excel/PDF report exports.
          </p>
        </div>

        <Button onClick={fetchData} variant="secondary" size="sm" className="gap-2 self-start sm:self-auto font-bold">
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

      {/* Analytical Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Total Completed Sessions
          </span>
          <p className="text-3xl font-black text-foreground">{metrics.totalSessions}</p>
          <p className="text-[11px] text-muted-foreground">Verified classroom attendance events</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm space-y-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">
            Overall Attendance Rate
          </span>
          <p className="text-3xl font-black text-emerald-600">{metrics.averageRate}%</p>
          <p className="text-[11px] text-muted-foreground">Across all recorded sessions</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Verified Students
          </span>
          <p className="text-3xl font-black text-foreground">
            {metrics.totalVerified} <span className="text-sm font-normal text-muted-foreground">/ {metrics.totalEnrolled}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">Total verified attendance decisions</p>
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
            className="h-10 px-3 rounded-xl border bg-card text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm w-full sm:w-auto"
          >
            <option value="ALL">All Class Pods</option>
            {pods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.subjectCode || 'No Code'})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Session History Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground">Historical Session Logs</h3>
          <span className="text-xs text-muted-foreground font-semibold">
            {filteredSessions.length} record{filteredSessions.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16 space-x-2 text-muted-foreground text-xs">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading historical attendance reports...</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-16 text-center text-xs text-muted-foreground space-y-2">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="font-semibold">No attendance sessions recorded yet.</p>
            <p className="text-[11px] text-muted-foreground/70">
              When an attendance session completes, the verified breakdown and report files will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-4">Class Pod</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Attendance Stats</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Export Reports</th>
                  <th className="p-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSessions.map((sess) => {
                  const verifiedCount = sess.metrics?.verified || 0;
                  const totalCount = sess.metrics?.totalEnrolled || 0;
                  const percent = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

                  return (
                    <tr key={sess.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <span className="font-bold text-foreground block text-sm">{sess.podName}</span>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {sess.subjectCode || 'General'}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span>{new Date(sess.startedAt).toLocaleDateString()}</span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {new Date(sess.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{percent}%</span>
                            <span className="text-[10px] text-muted-foreground">
                              ({verifiedCount}/{totalCount} present)
                            </span>
                          </div>
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sess.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 animate-pulse'
                              : 'bg-muted text-muted-foreground border'
                          }`}
                        >
                          {sess.status === 'ACTIVE' && <CheckCircle2 className="h-3 w-3" />}
                          {sess.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDownloadReport(sess.id, 'excel')}
                            disabled={downloadingType === `${sess.id}_excel`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-bold transition-all text-[11px]"
                            title="Download Excel Report (.xlsx)"
                          >
                            {downloadingType === `${sess.id}_excel` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                            )}
                            <span>Excel</span>
                          </button>

                          <button
                            onClick={() => handleDownloadReport(sess.id, 'pdf')}
                            disabled={downloadingType === `${sess.id}_pdf`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-bold transition-all text-[11px]"
                            title="Download PDF Report (.pdf)"
                          >
                            {downloadingType === `${sess.id}_pdf` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          onClick={() => handleOpenDetail(sess)}
                          variant="secondary"
                          size="sm"
                          className="h-8 font-bold text-[11px] gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Roster</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session Roster Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadein">
          <div className="w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">{selectedSession.podName}</h3>
                <p className="text-xs text-muted-foreground">
                  Session recorded on {new Date(selectedSession.startedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="rounded-full p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Export Bar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border">
              <span className="text-xs font-semibold text-muted-foreground">Export Session Artifacts:</span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleDownloadReport(selectedSession.id, 'excel')}
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs font-bold gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Download Excel</span>
                </Button>
                <Button
                  onClick={() => handleDownloadReport(selectedSession.id, 'pdf')}
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs font-bold gap-1.5 text-rose-600 border-rose-500/30 hover:bg-rose-500/10"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </Button>
              </div>
            </div>

            {/* Student Roster Breakdown */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Student Verification Decisions
              </h4>

              {loadingDecisions ? (
                <div className="flex items-center justify-center p-12 text-muted-foreground text-xs space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading decision records...</span>
                </div>
              ) : sessionDecisions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No individual student check-in facts registered for this session.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden divide-y text-xs">
                  {sessionDecisions.map((dec: any) => {
                    const isVerified = dec.status === 'VERIFIED';
                    const isCheckedIn = dec.status === 'CHECKED_IN';

                    return (
                      <div key={dec.id} className="p-3 flex items-center justify-between hover:bg-muted/20">
                        <div className="space-y-0.5">
                          <p className="font-bold text-foreground">{dec.student?.name || 'Student'}</p>
                          <p className="text-[11px] text-muted-foreground">{dec.student?.email || '—'}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t">
              <Button onClick={() => setSelectedSession(null)} variant="secondary" size="sm">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
