'use client';

import { useState, useEffect, Fragment } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';
import {
  Activity,
  Database,
  Radio,
  Server,
  Terminal,
  Clock,
  Shield,
  Bell,
  Cpu,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  User,
  CheckCircle,
  Eye,
} from 'lucide-react';

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    api: { status: string };
    postgres: { status: string; message?: string };
    redis: { status: string; message?: string };
  };
}

interface Metrics {
  users: number;
  pods: number;
  sessions: number;
  decisions: number;
  notifications: number;
  gateways: number;
}

interface RequestLog {
  id: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string;
  createdAt: string;
  metadata: any;
}

interface EventLog {
  id: string;
  eventName: string;
  requestId: string | null;
  correlationId: string | null;
  payload: any;
  createdAt: string;
}

interface Gateway {
  id: string;
  classroom: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  firmwareVersion: string | null;
  lastHeartbeat: string | null;
}

interface ActiveSession {
  id: string;
  podName: string;
  teacherName: string;
  startedAt: string;
  expiresAt: string;
  timeRemaining: number;
  metrics: {
    totalEnrolled: number;
    checkedIn: number;
    verified: number;
    pending: number;
    absent: number;
  };
}

interface SystemNotification {
  id: string;
  user: {
    name: string;
    email: string;
  };
  type: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  createdAt: string;
  readAt: string | null;
}

export default function DeveloperConsolePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'audits' | 'events' | 'attendance' | 'gateways' | 'notifications'>('overview');

  // Loading states
  const [, setLoading] = useState(true);

  // States
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  
  // Log states
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [reqMeta, setReqMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [reqSearch, setReqSearch] = useState('');
  const [reqStatus, setReqStatus] = useState('');
  const [reqPage, setReqPage] = useState(1);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [eventSearch, setEventSearch] = useState('');

  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);

  // Detailed view states
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionDecisions, setSessionDecisions] = useState<any[]>([]);
  const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);
  const [decisionDetails, setDecisionDetails] = useState<any>(null);
  const [loadingDecisions, setLoadingDecisions] = useState(false);
  const [loadingDecisionDetails, setLoadingDecisionDetails] = useState(false);

  const [expandedGatewayId, setExpandedGatewayId] = useState<string | null>(null);
  const [gatewayObservations, setGatewayObservations] = useState<any[]>([]);
  const [loadingObservations, setLoadingObservations] = useState(false);

  // Fetch Overview Data
  const fetchOverview = async () => {
    try {
      // 1. Fetch Health via typed apiClient wrapper
      const healthRes = await apiClient.get<HealthStatus>('/health');
      if (healthRes.data) {
        setHealth(healthRes.data);
      } else {
        setHealth(null);
      }

      // 2. Fetch Metrics
      const metricsRes = await apiClient.get<Metrics>('/logs/metrics');
      setMetrics(metricsRes.data);

      // 3. Fetch Gateways
      const gwRes = await apiClient.get<Gateway[]>('/gateway/status');
      setGateways(gwRes.data || []);

      // 4. Fetch Active Sessions
      const sessRes = await apiClient.get<ActiveSession[]>('/logs/active-sessions');
      setActiveSessions(sessRes.data || []);
    } catch (err) {
      window.console.error('Error fetching overview console data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Request Logs
  const fetchRequestLogs = async () => {
    try {
      const query = `?page=${reqPage}&limit=20${reqSearch ? `&search=${encodeURIComponent(reqSearch)}` : ''}${reqStatus ? `&status=${reqStatus}` : ''}`;
      const res = await apiClient.get<any>(`/logs/requests${query}`);
      if (res.data) {
        setRequestLogs(res.data.items || []);
        setReqMeta(res.data.meta);
      }
    } catch (err) {
      window.console.error('Failed to fetch request logs:', err);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const query = auditSearch ? `?search=${encodeURIComponent(auditSearch)}` : '';
      const res = await apiClient.get<AuditLog[]>(`/logs/audits${query}`);
      setAuditLogs(res.data || []);
    } catch (err) {
      window.console.error('Failed to fetch audit logs:', err);
    }
  };

  // Fetch Event Logs
  const fetchEventLogs = async () => {
    try {
      const query = eventSearch ? `?search=${encodeURIComponent(eventSearch)}` : '';
      const res = await apiClient.get<EventLog[]>(`/logs/events${query}`);
      setEventLogs(res.data || []);
    } catch (err) {
      window.console.error('Failed to fetch event logs:', err);
    }
  };

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get<SystemNotification[]>('/logs/notifications');
      setSystemNotifications(res.data || []);
    } catch (err) {
      window.console.error('Failed to fetch notifications:', err);
    }
  };

  // Load Decisions for Active Session
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

  // Load Details (Evidence + Verdict) for a student decision
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

  // Load Gateway Observations
  const loadGatewayObservations = async (gatewayId: string) => {
    if (expandedGatewayId === gatewayId) {
      setExpandedGatewayId(null);
      setGatewayObservations([]);
      return;
    }
    setExpandedGatewayId(gatewayId);
    setLoadingObservations(true);
    try {
      const res = await apiClient.get<any[]>(`/gateway/${gatewayId}/observations?limit=20`);
      setGatewayObservations(res.data || []);
    } catch (err) {
      window.console.error('Error loading gateway observations:', err);
    } finally {
      setLoadingObservations(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'requests') fetchRequestLogs();
    if (activeTab === 'audits') fetchAuditLogs();
    if (activeTab === 'events') fetchEventLogs();
    if (activeTab === 'notifications') fetchNotifications();
    if (activeTab === 'gateways') fetchOverview(); // Gateways are loaded in fetchOverview
    if (activeTab === 'attendance') fetchOverview(); // Active sessions are loaded in fetchOverview
  }, [activeTab, reqPage, reqSearch, reqStatus, auditSearch, eventSearch]);

  // Polling for overview tab only
  useEffect(() => {
    if (activeTab !== 'overview') return;
    const interval = window.setInterval(fetchOverview, 5000);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Shield className="h-16 w-16 text-red-500/80 mb-4" />
        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          The Developer Console is restricted to Administrator and Developer roles.
        </p>
      </div>
    );
  }

  const formatTime = (timeRemaining: number) => {
    if (timeRemaining <= 0) return 'Expired';
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="h-8 w-8 text-primary" />
            Developer Console
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time telemetry, logs, audit trails, and hardware verification observations.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            if (activeTab === 'overview') fetchOverview();
            if (activeTab === 'requests') fetchRequestLogs();
            if (activeTab === 'audits') fetchAuditLogs();
            if (activeTab === 'events') fetchEventLogs();
            if (activeTab === 'notifications') fetchNotifications();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border bg-card hover:bg-muted text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto">
        {(
          [
            { id: 'overview', label: 'System Overview', icon: Server },
            { id: 'requests', label: 'Request Logs', icon: Activity },
            { id: 'audits', label: 'Audit Logs', icon: Shield },
            { id: 'events', label: 'Event Timeline', icon: Clock },
            { id: 'attendance', label: 'Attendance Monitor', icon: CheckCircle },
            { id: 'gateways', label: 'Gateway Monitor', icon: Radio },
            { id: 'notifications', label: 'Notifications', icon: Bell },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
              setLoading(true);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[2px] whitespace-nowrap ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Health Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  API Service
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                    health ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/15 text-red-500 border border-red-500/30'
                  }`}
                >
                  {health ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Port: 4000 | Status Check: {health ? 'OK' : 'Error connecting'}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-500" />
                  PostgreSQL
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                    health?.services.postgres.status === 'up'
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-500 border border-red-500/30'
                  }`}
                >
                  {health?.services.postgres.status === 'up' ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {health?.services.postgres.status === 'up' ? 'Read/Write Connection Active' : health?.services.postgres.message || 'Prisma client error'}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-indigo-500" />
                  Redis / BullMQ
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                    health?.services.redis.status === 'up'
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-500 border border-red-500/30'
                  }`}
                >
                  {health?.services.redis.status === 'up' ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {health?.services.redis.status === 'up' ? 'In-Memory Event Bus & Cache' : health?.services.redis.message || 'Connection refused'}
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {(
              [
                { label: 'Total Users', val: metrics?.users ?? 0 },
                { label: 'Pods', val: metrics?.pods ?? 0 },
                { label: 'Sessions', val: metrics?.sessions ?? 0 },
                { label: 'Decisions', val: metrics?.decisions ?? 0 },
                { label: 'Notifications', val: metrics?.notifications ?? 0 },
                { label: 'Gateways', val: metrics?.gateways ?? 0 },
              ] as const
            ).map((m, idx) => (
              <div key={idx} className="rounded-xl border bg-card p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-foreground">{m.val}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Core Hardware & Attendance Real-time Telemetry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Gateways */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 border-b pb-2">
                <Radio className="h-5 w-5 text-primary" />
                Gateway Heartbeats
              </h3>
              {gateways.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No gateways registered.</p>
              ) : (
                <div className="space-y-3">
                  {gateways.map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{g.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Classroom: {g.classroom} | Firmware: {g.firmwareVersion || 'N/A'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          g.status === 'ONLINE' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500'
                        }`}
                      >
                        {g.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Attendance */}
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 border-b pb-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                Active Sessions
              </h3>
              {activeSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No active attendance sessions.</p>
              ) : (
                <div className="space-y-3">
                  {activeSessions.map((s) => (
                    <div key={s.id} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{s.podName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Teacher: {s.teacherName}</p>
                        </div>
                        <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {formatTime(s.timeRemaining)}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 text-center text-[10px] gap-1 pt-1 border-t border-border/50">
                        <div>
                          <p className="font-bold text-foreground">{s.metrics.totalEnrolled}</p>
                          <p className="text-muted-foreground">Enrolled</p>
                        </div>
                        <div>
                          <p className="font-bold text-blue-500">{s.metrics.checkedIn}</p>
                          <p className="text-muted-foreground">Checked In</p>
                        </div>
                        <div>
                          <p className="font-bold text-emerald-500">{s.metrics.verified}</p>
                          <p className="text-muted-foreground">Verified</p>
                        </div>
                        <div>
                          <p className="font-bold text-yellow-500">{s.metrics.pending}</p>
                          <p className="text-muted-foreground">Pending</p>
                        </div>
                        <div>
                          <p className="font-bold text-red-500">{s.metrics.absent}</p>
                          <p className="text-muted-foreground">Absent</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Request Logs Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by URL, method, Request ID..."
                value={reqSearch}
                onChange={(e) => {
                  setReqSearch(e.target.value);
                  setReqPage(1);
                }}
                className="pl-9 pr-4 py-2 w-full rounded-md border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              value={reqStatus}
              onChange={(e) => {
                setReqStatus(e.target.value);
                setReqPage(1);
              }}
              className="px-3 py-2 rounded-md border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="200">200 OK</option>
              <option value="201">201 Created</option>
              <option value="400">400 Bad Request</option>
              <option value="401">401 Unauthorized</option>
              <option value="403">403 Forbidden</option>
              <option value="429">429 Rate Limited</option>
              <option value="500">500 Server Error</option>
            </select>
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Endpoint</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Duration</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Request ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {requestLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                      No request logs found.
                    </td>
                  </tr>
                ) : (
                  requestLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.method === 'POST'
                              ? 'bg-blue-500/15 text-blue-500'
                              : log.method === 'PATCH'
                                ? 'bg-amber-500/15 text-amber-500'
                                : 'bg-emerald-500/15 text-emerald-500'
                          }`}
                        >
                          {log.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground truncate max-w-[200px]" title={log.url}>
                        {log.url}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.statusCode >= 400 ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-500'
                          }`}
                        >
                          {log.statusCode || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{log.responseTime ? `${log.responseTime}ms` : '—'}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground select-all">
                        {log.requestId}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {reqMeta.total > reqMeta.limit && (
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>
                Showing {requestLogs.length} of {reqMeta.total} requests
              </span>
              <div className="flex gap-2">
                <button
                  disabled={reqPage === 1}
                  onClick={() => setReqPage(reqPage - 1)}
                  className="px-2.5 py-1 rounded border bg-card hover:bg-muted disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={reqPage * reqMeta.limit >= reqMeta.total}
                  onClick={() => setReqPage(reqPage + 1)}
                  className="px-2.5 py-1 rounded border bg-card hover:bg-muted disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audits' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by action, module, ID..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full rounded-md border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor User ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity Module</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Metadata Payload</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                      No audit logs found.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-semibold text-xs text-foreground">{log.action}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                        {log.actorUserId || 'System'}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground">{log.entityType}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground max-w-[250px] truncate" title={JSON.stringify(log.metadata)}>
                        {JSON.stringify(log.metadata)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Timeline Tab */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by event name..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full rounded-md border bg-card text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-3">
            {eventLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No event logs recorded.</p>
            ) : (
              eventLogs.map((log) => (
                <div key={log.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded border border-primary/20">
                      {log.eventName}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[10px] text-muted-foreground font-mono">
                    <span>Req ID: {log.requestId || 'system'}</span>
                    <span>Cor ID: {log.correlationId || 'system'}</span>
                  </div>
                  <pre className="p-3 bg-muted/40 rounded-lg text-[10px] text-foreground overflow-x-auto font-mono">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Gateway Monitor Tab */}
      {activeTab === 'gateways' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8"></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Gateway</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Classroom</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Firmware</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {gateways.map((gw) => (
                  <Fragment key={gw.id}>
                    <tr
                      onClick={() => loadGatewayObservations(gw.id)}
                      className="border-b hover:bg-muted/10 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        {expandedGatewayId === gw.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{gw.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{gw.classroom}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            gw.status === 'ONLINE'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              gw.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                            }`}
                          />
                          {gw.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{gw.firmwareVersion || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {gw.lastHeartbeat ? new Date(gw.lastHeartbeat).toLocaleTimeString() : 'Never'}
                      </td>
                    </tr>

                    {/* Observations Sub-table */}
                    {expandedGatewayId === gw.id && (
                      <tr key={`${gw.id}-obs`}>
                        <td colSpan={6} className="bg-muted/10 px-6 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4 text-primary" />
                              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                                Live Camera & Telemetry Stream
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              Showing latest {gatewayObservations.length} observation events
                            </span>
                          </div>

                          {loadingObservations ? (
                            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Loading telemetry...</span>
                            </div>
                          ) : gatewayObservations.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No observations recorded yet.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {gatewayObservations.map((obs) => (
                                <div key={obs.id} className="p-3.5 rounded-xl border bg-card/80 backdrop-blur shadow-sm space-y-2">
                                  <div className="flex justify-between items-center border-b pb-2">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20">
                                      <Radio className="h-3 w-3" />
                                      {obs.type}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {new Date(obs.createdAt).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    {obs.payload?.frame_bytes && (
                                      <div className="flex justify-between text-[11px]">
                                        <span className="text-muted-foreground">JPEG Frame Size:</span>
                                        <span className="font-mono font-bold text-emerald-400">
                                          {(obs.payload.frame_bytes / 1024).toFixed(1)} KB
                                        </span>
                                      </div>
                                    )}
                                    {obs.payload?.width && obs.payload?.height && (
                                      <div className="flex justify-between text-[11px]">
                                        <span className="text-muted-foreground">Resolution:</span>
                                        <span className="font-mono text-foreground">
                                          {obs.payload.width}x{obs.payload.height} ({obs.payload.format || 'JPEG'})
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <pre className="text-[9px] font-mono text-muted-foreground overflow-x-auto bg-muted/50 p-2 rounded-lg border max-h-24">
                                    {JSON.stringify(obs.payload, null, 2)}
                                  </pre>
                                </div>
                              ))}
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
        </div>
      )}

      {/* Attendance Monitor Tab */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8"></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pod</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Teacher</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Countdown</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Progress Metrics</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                      No active sessions.
                    </td>
                  </tr>
                ) : (
                  activeSessions.map((sess) => (
                    <Fragment key={sess.id}>
                      <tr
                        onClick={() => loadSessionDecisions(sess.id)}
                        className="border-b hover:bg-muted/10 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          {expandedSessionId === sess.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{sess.podName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sess.teacherName}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {formatTime(sess.timeRemaining)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="text-blue-400 font-bold">{sess.metrics.checkedIn}</span> checkin /{' '}
                          <span className="text-emerald-400 font-bold">{sess.metrics.verified}</span> verified (
                          {sess.metrics.totalEnrolled} total)
                        </td>
                      </tr>

                      {/* Expanded Decisions Sub-table */}
                      {expandedSessionId === sess.id && (
                        <tr key={`${sess.id}-dec`}>
                          <td colSpan={5} className="bg-muted/10 px-6 py-4">
                            <div className="flex items-center gap-2 mb-3">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Student Decisions & Evidence
                              </span>
                            </div>

                            {loadingDecisions ? (
                              <p className="text-xs text-muted-foreground">Loading decisions...</p>
                            ) : sessionDecisions.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No students enrolled.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-border/50">
                                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-8"></th>
                                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Student</th>
                                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Email</th>
                                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Status</th>
                                    <th className="text-left py-2 font-medium text-muted-foreground">Explanation</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessionDecisions.map((dec) => (
                                    <Fragment key={dec.id}>
                                      <tr
                                        onClick={() => loadDecisionDetails(dec.id)}
                                        className="border-b border-border/30 hover:bg-muted/20 cursor-pointer"
                                      >
                                        <td className="py-2 pr-4">
                                          {expandedDecisionId === dec.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </td>
                                        <td className="py-2 pr-4 font-medium text-foreground">{dec.student?.name}</td>
                                        <td className="py-2 pr-4 text-muted-foreground">{dec.student?.email}</td>
                                        <td className="py-2 pr-4">
                                          <span
                                            className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold ${
                                              dec.status === 'VERIFIED'
                                                ? 'bg-emerald-500/15 text-emerald-500'
                                                : dec.status === 'CHECKED_IN'
                                                  ? 'bg-blue-500/15 text-blue-500'
                                                  : 'bg-yellow-500/15 text-yellow-500'
                                            }`}
                                          >
                                            {dec.status}
                                          </span>
                                        </td>
                                        <td className="py-2 text-muted-foreground">{dec.explanation || '—'}</td>
                                      </tr>

                                      {/* Decision Details with verification signals and results */}
                                      {expandedDecisionId === dec.id && (
                                        <tr key={`${dec.id}-det`}>
                                          <td colSpan={5} className="bg-card px-4 py-3 border border-border/50 rounded-lg">
                                            {loadingDecisionDetails ? (
                                              <p className="text-[10px] text-muted-foreground">Loading verification telemetry...</p>
                                            ) : !decisionDetails ? (
                                              <p className="text-[10px] text-muted-foreground">No telemetry available.</p>
                                            ) : (
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Ingested signals */}
                                                <div>
                                                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                                                    Verification Signals
                                                  </h4>
                                                  {decisionDetails.signals?.length === 0 ? (
                                                    <p className="text-[10px] text-muted-foreground/60">No facts generated.</p>
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
                                                          <pre className="text-[8px] text-muted-foreground font-mono mt-1 overflow-x-auto">
                                                            {JSON.stringify(sig.payload)}
                                                          </pre>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Verification results */}
                                                <div>
                                                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                                                    Decision Evaluation Log
                                                  </h4>
                                                  {decisionDetails.results?.length === 0 ? (
                                                    <p className="text-[10px] text-muted-foreground/60">No runs evaluated.</p>
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
                                    </Fragment>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notification Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Recipient</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Read Time</th>
                </tr>
              </thead>
              <tbody>
                {systemNotifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">
                      No notifications found.
                    </td>
                  </tr>
                ) : (
                  systemNotifications.map((notif) => (
                    <tr key={notif.id} className="border-b hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 text-xs">
                        <p className="font-semibold text-foreground">{notif.user?.name}</p>
                        <p className="text-muted-foreground text-[10px]">{notif.user?.email}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{notif.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            notif.priority === 'HIGH'
                              ? 'bg-red-500/15 text-red-500'
                              : notif.priority === 'LOW'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-blue-500/15 text-blue-500'
                          }`}
                        >
                          {notif.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                            notif.status === 'READ'
                              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                              : 'bg-blue-500/15 text-blue-500 border-blue-500/30'
                          }`}
                        >
                          {notif.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(notif.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {notif.readAt ? new Date(notif.readAt).toLocaleTimeString() : 'Unread'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
