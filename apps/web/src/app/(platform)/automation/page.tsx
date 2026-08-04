'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  FileSpreadsheet,
  FileText,
  MessageSquare,
  RefreshCw,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  X,
  Zap,
} from 'lucide-react';

interface AutomationArtifact {
  id: string;
  runId: string;
  type: 'EXCEL_REPORT' | 'PDF_REPORT' | 'AI_SUMMARY';
  filename: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number | null;
  createdAt: string;
}

interface AutomationRun {
  id: string;
  sessionId: string;
  podId: string;
  teacherId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  triggeredBy: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  summary: string | null;
  whatsappMessage: string | null;
  whatsappSentAt: string | null;
  createdAt: string;
  session?: {
    id: string;
    pod?: {
      name: string;
      subjectCode: string;
    };
  };
  pod?: {
    name: string;
    subjectCode: string;
  };
  artifacts: AutomationArtifact[];
}

export default function AutomationHistoryPage() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);
  const [previewType, setPreviewType] = useState<'summary' | 'whatsapp' | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>('/automation/history?limit=30');
      setRuns(res.data?.runs || []);
      setTotal(res.data?.total || 0);
    } catch (err: any) {
      window.console.error('Failed to fetch automation history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = window.setInterval(fetchHistory, 10000);
    return () => window.clearInterval(interval);
  }, []);

  const handleRetrigger = async (runId: string) => {
    setActionLoading(`retrigger_${runId}`);
    setMessage(null);
    try {
      await apiClient.post(`/automation/${runId}/retrigger`);
      setMessage({ type: 'success', text: 'Automation pipeline retriggered successfully.' });
      fetchHistory();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to retrigger automation.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendWhatsApp = async (runId: string) => {
    setActionLoading(`whatsapp_${runId}`);
    setMessage(null);
    try {
      await apiClient.post(`/automation/${runId}/resend`);
      setMessage({ type: 'success', text: 'WhatsApp report resent successfully.' });
      fetchHistory();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to resend WhatsApp message.' });
    } finally {
      setActionLoading(null);
    }
  };

  const getArtifactUrl = (artifact: AutomationArtifact) => {
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/automation/artifacts/${artifact.id}/download`;
  };

  const completedCount = runs.filter((r) => r.status === 'COMPLETED').length;
  const failedCount = runs.filter((r) => r.status === 'FAILED').length;
  const runningCount = runs.filter((r) => r.status === 'RUNNING' || r.status === 'PENDING').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Automation History</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automated Excel, PDF, Summary generation and WhatsApp dispatch upon attendance completion.
          </p>
        </div>
        <Button onClick={fetchHistory} variant="secondary" size="sm" className="gap-2 self-start md:self-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh History
        </Button>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Runs</span>
          <p className="text-2xl font-extrabold">{total}</p>
        </div>
        <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Completed</span>
          <p className="text-2xl font-extrabold text-emerald-600">{completedCount}</p>
        </div>
        <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/20 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Running / Pending</span>
          <p className="text-2xl font-extrabold text-amber-600">{runningCount}</p>
        </div>
        <div className="p-4 rounded-xl border bg-destructive/5 border-destructive/20 shadow-sm space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-destructive">Failed</span>
          <p className="text-2xl font-extrabold text-destructive">{failedCount}</p>
        </div>
      </div>

      {/* History Table */}
      <div className="border rounded-2xl bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/30 font-bold text-sm">Attendance Automation Executions</div>
        {loading && runs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading automation history...</p>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="font-bold text-base">No Automation Runs Found</h3>
            <p className="text-xs text-muted-foreground">
              Automation triggers automatically when a teacher completes an attendance session.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3.5">Pod & Subject</th>
                  <th className="p-3.5">Triggered By</th>
                  <th className="p-3.5">Generated Time</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Artifact Downloads</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map((run) => {
                  const podName = run.pod?.name || run.session?.pod?.name || 'Class Pod';
                  const subjectCode = run.pod?.subjectCode || run.session?.pod?.subjectCode || '—';

                  const excelArtifact = run.artifacts.find((a) => a.type === 'EXCEL_REPORT');
                  const pdfArtifact = run.artifacts.find((a) => a.type === 'PDF_REPORT');
                  const summaryArtifact = run.artifacts.find((a) => a.type === 'AI_SUMMARY');

                  return (
                    <tr key={run.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5">
                        <span className="font-bold text-foreground block text-sm">{podName}</span>
                        <span className="text-[10px] text-muted-foreground">{subjectCode}</span>
                      </td>
                      <td className="p-3.5 font-medium text-muted-foreground">{run.triggeredBy}</td>
                      <td className="p-3.5 text-muted-foreground">
                        {run.completedAt
                          ? new Date(run.completedAt).toLocaleString()
                          : new Date(run.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            run.status === 'COMPLETED'
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                              : run.status === 'RUNNING' || run.status === 'PENDING'
                              ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30 animate-pulse'
                              : 'bg-destructive/15 text-destructive border border-destructive/30'
                          }`}
                        >
                          {run.status === 'COMPLETED' && <CheckCircle2 className="h-3 w-3" />}
                          {run.status === 'FAILED' && <XCircle className="h-3 w-3" />}
                          {(run.status === 'RUNNING' || run.status === 'PENDING') && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          {run.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          {excelArtifact ? (
                            <a
                              href={getArtifactUrl(excelArtifact)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-bold transition-all"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              <span>Excel</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/40 text-[10px]">—</span>
                          )}

                          {pdfArtifact ? (
                            <a
                              href={getArtifactUrl(pdfArtifact)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-bold transition-all"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>PDF</span>
                            </a>
                          ) : (
                            <span className="text-muted-foreground/40 text-[10px]">—</span>
                          )}

                          {summaryArtifact && (
                            <button
                              onClick={() => {
                                setSelectedRun(run);
                                setPreviewType('summary');
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border bg-muted hover:bg-muted/80 text-foreground font-medium text-[10px] transition-all"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Summary</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {run.whatsappMessage && (
                            <button
                              onClick={() => {
                                setSelectedRun(run);
                                setPreviewType('whatsapp');
                              }}
                              className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all"
                              title="Preview WhatsApp Message"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {run.status === 'COMPLETED' && (
                            <Button
                              onClick={() => handleResendWhatsApp(run.id)}
                              disabled={actionLoading === `whatsapp_${run.id}`}
                              variant="secondary"
                              size="sm"
                              className="h-7 text-[10px] font-bold gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              {actionLoading === `whatsapp_${run.id}` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              <span>Resend WA</span>
                            </Button>
                          )}

                          <Button
                            onClick={() => handleRetrigger(run.id)}
                            disabled={actionLoading === `retrigger_${run.id}`}
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[10px] font-bold gap-1"
                          >
                            {actionLoading === `retrigger_${run.id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            <span>Retrigger</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary / WhatsApp Preview Modal */}
      {selectedRun && previewType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadein">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                {previewType === 'summary' ? (
                  <FileText className="h-5 w-5 text-primary" />
                ) : (
                  <MessageSquare className="h-5 w-5 text-emerald-500" />
                )}
                <h3 className="font-bold text-base">
                  {previewType === 'summary' ? 'AI Summary Preview' : 'WhatsApp Message Preview'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedRun(null);
                  setPreviewType(null);
                }}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
              {previewType === 'summary' ? selectedRun.summary : selectedRun.whatsappMessage}
            </div>

            {previewType === 'whatsapp' && (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-xs space-y-1">
                <span className="font-bold uppercase tracking-wider text-[10px]">Attached Artifact Files:</span>
                <ul className="list-disc list-inside text-[11px] space-y-0.5">
                  {selectedRun.artifacts.map((a) => (
                    <li key={a.id}>
                      {a.filename} ({a.mimeType})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => {
                  setSelectedRun(null);
                  setPreviewType(null);
                }}
                variant="secondary"
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
