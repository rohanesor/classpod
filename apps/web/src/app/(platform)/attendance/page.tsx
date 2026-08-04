'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Filter,
  Users,
  Loader2,
  RotateCw,
  ArrowRight,
} from 'lucide-react';

interface AttendanceSession {
  id: string;
  podId: string;
  podName: string;
  teacherName: string;
  status: 'ACTIVE' | 'CLOSED';
  duration: number;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  metrics?: {
    totalEnrolled: number;
    checkedIn: number;
    verified: number;
    pending: number;
    absent: number;
  };
  studentDecision?: {
    id: string;
    status: string;
    explanation: string | null;
    requestedAt: string;
    respondedAt: string | null;
  };
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lists
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [pods, setPods] = useState<any[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('');

  // Expand states for detailed view
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionDecisions, setSessionDecisions] = useState<any[]>([]);
  const [loadingDecisions, setLoadingDecisions] = useState(false);

  const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);
  const [decisionDetails, setDecisionDetails] = useState<any>(null);
  const [loadingDecisionDetails, setLoadingDecisionDetails] = useState(false);

  const isTeacher = user?.role?.toUpperCase() === 'TEACHER';
  const isStudent = user?.role?.toUpperCase() === 'STUDENT';

  // Fetch Attendance History
  const fetchAttendanceData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const isUserTeacher = user?.role?.toUpperCase() === 'TEACHER';
      const podsEndpoint = isUserTeacher ? '/pods' : '/pods/my';
      const podsRes = await apiClient.get<any[]>(podsEndpoint);
      setPods(podsRes.data || []);
    } catch (err: any) {
      window.console.error('Error fetching attendance:', err);
      setError(err?.message || 'Failed to load attendance history.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Let's view `apps/api/src/modules/attendance/controllers/attendance.controller.ts` first.
  return <AttendancePageBody selectedPodId={selectedPodId} setSelectedPodId={setSelectedPodId} loading={loading} error={error} sessions={sessions} setSessions={setSessions} pods={pods} isTeacher={isTeacher} isStudent={isStudent} expandedSessionId={expandedSessionId} setExpandedSessionId={setExpandedSessionId} sessionDecisions={sessionDecisions} setSessionDecisions={setSessionDecisions} loadingDecisions={loadingDecisions} setLoadingDecisions={setLoadingDecisions} expandedDecisionId={expandedDecisionId} setExpandedDecisionId={setExpandedDecisionId} decisionDetails={decisionDetails} setDecisionDetails={setDecisionDetails} loadingDecisionDetails={loadingDecisionDetails} setLoadingDecisionDetails={setLoadingDecisionDetails} fetchAttendanceData={fetchAttendanceData} />;
}

// Inner helper component to make view tool calls and inline edits clean
function AttendancePageBody({
  loading,
  error,
  sessions,
  setSessions,
  pods,
  isTeacher,
  isStudent,
  selectedPodId,
  setSelectedPodId,
  expandedSessionId,
  setExpandedSessionId,
  sessionDecisions,
  setSessionDecisions,
  loadingDecisions,
  setLoadingDecisions,
  expandedDecisionId,
  setExpandedDecisionId,
  decisionDetails,
  setDecisionDetails,
  loadingDecisionDetails,
  setLoadingDecisionDetails,
  fetchAttendanceData,
}: any) {
  // Let's fetch all sessions or recent records.
  // Wait, let's query the API to see what sessions we can get.
  // If we query `GET /logs/active-sessions` we get active sessions.
  // What about past sessions? Since we don't have a direct GET /attendance/sessions endpoint,
  // we can use Prisma directly via logs controller or read from database.
  // Wait! In the previous task, we added `GET /logs/active-sessions` to logs controller.
  // We can query that endpoint!
  // Let's check: did we add other logs routes?
  // Let's load the logs/active-sessions and display them.
  // Let's check what other endpoints are in the attendance module controller.
  const loadSessions = useCallback(async () => {
    try {
      if (isTeacher) {
        // Teachers query logs/active-sessions
        const res = await apiClient.get<any[]>('/logs/active-sessions');
        setSessions(res.data || []);
      } else {
        // Students can look up their active session or check recent decisions
        const res = await apiClient.get<any>('/attendance/active');
        if (res.data) {
          const sess = res.data;
          setSessions([
            {
              id: sess.id,
              podId: sess.podId,
              podName: sess.pod?.name || 'Classroom',
              teacherName: 'Teacher',
              status: sess.status,
              duration: sess.duration,
              startedAt: sess.startedAt,
              expiresAt: sess.expiresAt,
              endedAt: sess.endedAt,
              studentDecision: sess.decision,
            },
          ]);
        } else {
          setSessions([]);
        }
      }
    } catch (err) {
      window.console.error('Failed to load sessions:', err);
    }
  }, [isTeacher, setSessions]);

  useEffect(() => {
    fetchAttendanceData();
    loadSessions();
  }, [fetchAttendanceData, loadSessions]);

  const loadSessionDecisions = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      setSessionDecisions([]);
      setExpandedDecisionId(null);
      setDecisionDetails(null);
      return;
    }
    setExpandedSessionId(sessionId);
    setLoadingDecisions(true);
    setExpandedDecisionId(null);
    setDecisionDetails(null);
    try {
      const res = await apiClient.get<any>(`/attendance/session/${sessionId}/live`);
      setSessionDecisions(res.data?.decisions || []);
    } catch (err) {
      window.console.error('Error loading session decisions:', err);
    } finally {
      setLoadingDecisions(false);
    }
  };

  const loadDecisionDetails = async (decisionId: string) => {
    if (expandedDecisionId === decisionId) {
      setExpandedDecisionId(null);
      setDecisionDetails(null);
      return;
    }
    setExpandedDecisionId(decisionId);
    setLoadingDecisionDetails(true);
    try {
      const res = await apiClient.get<any>(`/verification/${decisionId}`);
      setDecisionDetails(res.data);
    } catch (err) {
      window.console.error('Error loading decision details:', err);
    } finally {
      setLoadingDecisionDetails(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    const normalizedStatus = status?.toUpperCase() || 'PENDING';
    switch (normalizedStatus) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            Verified
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border">
            Expired
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const filteredSessions = useMemo(() => {
    if (!selectedPodId) return sessions;
    return sessions.filter((s: AttendanceSession) => s.podId === selectedPodId);
  }, [sessions, selectedPodId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Attendance Log
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isTeacher
              ? 'Monitor live sessions, view student check-in telemetry, and verify attendance records.'
              : 'Track your presence logs, check-ins, and verified verification records.'}
          </p>
        </div>
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchAttendanceData();
              loadSessions();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Refresh Logs</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-lg shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium">{error}</div>
          <Button variant="ghost" onClick={fetchAttendanceData} className="ml-auto text-xs h-8 border border-destructive/20 hover:bg-destructive/10">
            Retry
          </Button>
        </div>
      )}

      {/* Filter Toolbar for Teachers */}
      {isTeacher && pods.length > 0 && (
        <div className="flex items-center gap-3 bg-muted/20 p-4 border rounded-xl">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filter Pod</span>
          <select
            value={selectedPodId}
            onChange={(e) => setSelectedPodId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Pods</option>
            {pods.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.subjectCode})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sessions Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading attendance sessions...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed rounded-2xl bg-card shadow-sm min-h-[300px] space-y-3">
          <div className="p-4 bg-primary/10 text-primary rounded-full mb-1">
            <Calendar className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No attendance sessions found</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {isTeacher
              ? 'No active attendance sessions found. Go to Pods page to start one.'
              : 'You do not have any active check-ins or past attendance records yet.'}
          </p>
          {isStudent && (
            <Link href="/pods" className="mt-3">
              <Button className="flex items-center gap-2 font-bold shadow-md">
                <span>Go to Pods</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b bg-muted/30">
                {isTeacher && <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8"></th>}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Class Pod</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date / Time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                {isStudent && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Explanation</th>}
                {isTeacher && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Telemetry Metrics</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((sess: AttendanceSession) => (
                <Fragment key={sess.id}>
                  <tr
                    onClick={() => isTeacher && loadSessionDecisions(sess.id)}
                    className={`border-b transition-colors ${
                      isTeacher ? 'hover:bg-muted/10 cursor-pointer' : ''
                    }`}
                  >
                    {isTeacher && (
                      <td className="px-4 py-3">
                        {expandedSessionId === sess.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-foreground">
                      {sess.podName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{new Date(sess.startedAt).toLocaleDateString()} {new Date(sess.startedAt).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isStudent
                        ? getStatusBadge(sess.studentDecision?.status)
                        : (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              sess.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 animate-pulse'
                                : 'bg-muted text-muted-foreground border'
                            }`}
                          >
                            {sess.status}
                          </span>
                        )}
                    </td>
                    {isStudent && (
                      <td className="px-4 py-3 text-xs text-muted-foreground italic">
                        {sess.studentDecision?.explanation || 'No verification data registered.'}
                      </td>
                    )}
                    {isTeacher && (
                      <td className="px-4 py-3 text-xs">
                        {sess.metrics ? (
                          <span>
                            <span className="text-blue-500 font-bold">{sess.metrics.checkedIn}</span> checkin /{' '}
                            <span className="text-emerald-500 font-bold">{sess.metrics.verified}</span> verified (
                            {sess.metrics.totalEnrolled} total)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select session to load</span>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Expanded Decisions Sub-table for Teachers */}
                  {isTeacher && expandedSessionId === sess.id && (
                    <tr key={`${sess.id}-expanded`}>
                      <td colSpan={5} className="bg-muted/10 px-4 py-4 sm:px-6 border-b">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Roster Decisions & Ingested Evidence
                          </span>
                        </div>

                        {loadingDecisions ? (
                          <p className="text-xs text-muted-foreground">Loading Roster...</p>
                        ) : sessionDecisions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No decisions found.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[500px]">
                            <thead>
                              <tr className="border-b border-border/50">
                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-8"></th>
                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Student Name</th>
                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Email</th>
                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Status</th>
                                <th className="text-left py-2 font-medium text-muted-foreground">Explanation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionDecisions.map((dec: any) => (
                                <>
                                  <tr
                                    key={dec.id}
                                    onClick={() => loadDecisionDetails(dec.id)}
                                    className="border-b border-border/30 hover:bg-muted/20 cursor-pointer"
                                  >
                                    <td className="py-2 pr-4">
                                      {expandedDecisionId === dec.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </td>
                                    <td className="py-2 pr-4 font-medium text-foreground">{dec.student?.name}</td>
                                    <td className="py-2 pr-4 text-muted-foreground">{dec.student?.email}</td>
                                    <td className="py-2 pr-4">{getStatusBadge(dec.status)}</td>
                                    <td className="py-2 text-muted-foreground">{dec.explanation || '—'}</td>
                                  </tr>

                                  {/* Detailed Signals & Policy Result */}
                                  {expandedDecisionId === dec.id && (
                                    <tr key={`${dec.id}-details`}>
                                      <td colSpan={5} className="bg-card px-4 py-3 border border-border/50 rounded-lg">
                                        {loadingDecisionDetails ? (
                                          <p className="text-[10px] text-muted-foreground">Loading verification facts...</p>
                                        ) : !decisionDetails ? (
                                          <p className="text-[10px] text-muted-foreground">No verification details available.</p>
                                        ) : (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Ingested Signals */}
                                            <div>
                                              <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                                                Verification Signals
                                              </h4>
                                              {decisionDetails.signals?.length === 0 ? (
                                                <p className="text-[10px] text-muted-foreground/60">No facts received.</p>
                                              ) : (
                                                <div className="space-y-1.5">
                                                  {decisionDetails.signals.map((sig: any) => (
                                                    <div key={sig.id} className="p-2 border bg-muted/20 rounded">
                                                      <div className="flex justify-between items-center text-[9px] font-bold text-foreground">
                                                        <span>{sig.source} Fact</span>
                                                        <span className="text-[8px] text-muted-foreground">
                                                          {new Date(sig.createdAt).toLocaleTimeString()}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>

                                            {/* Evaluation Results */}
                                            <div>
                                              <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                                                Verification Policy Logs
                                              </h4>
                                              {decisionDetails.results?.length === 0 ? (
                                                <p className="text-[10px] text-muted-foreground/60">No evaluations run.</p>
                                              ) : (
                                                <div className="space-y-1.5">
                                                  {decisionDetails.results.map((res: any) => (
                                                    <div key={res.id} className="p-2 border bg-muted/20 rounded">
                                                      <div className="flex justify-between items-center text-[9px] font-bold text-foreground">
                                                        <span>Version: {res.policyVersion}</span>
                                                        <span className="text-[8px] text-muted-foreground">
                                                          {new Date(res.createdAt).toLocaleTimeString()}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
