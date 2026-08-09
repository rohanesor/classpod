'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Radio,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  Eye,
  Activity,
  Camera,
  RefreshCw,
  CheckCircle,
  Loader2,
  Maximize2,
  X,
  Image as ImageIcon,
  PlayCircle,
  Sliders,
} from 'lucide-react';

interface Gateway {
  id: string;
  classroom: string;
  name: string;
  status: 'ONLINE' | 'OFFLINE';
  firmwareVersion: string | null;
  lastHeartbeat: string | null;
  createdAt: string;
}

interface GatewaySessionInfo {
  activeSessionId: string | null;
  podId: string | null;
  podName: string | null;
  startedAt: string | null;
  observationCount: number;
  status: 'ACTIVE' | 'IDLE';
}

interface Observation {
  id: string;
  gatewayId: string;
  sessionId: string | null;
  type: 'BLE_DETECTED' | 'PERSON_COUNT' | 'HEARTBEAT';
  payload: any;
  createdAt: string;
}

interface LatestImageResponse {
  observationId: string | null;
  gatewayId: string;
  timestamp: string | null;
  image: string | null;
  width?: number;
  height?: number;
  bytes?: number;
}

type CaptureStage = 'IDLE' | 'CAPTURING' | 'UPLOADING' | 'PROCESSING' | 'SUCCESS';

export default function GatewayPage() {
  const { user } = useAuth();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [sessionInfos, setSessionInfos] = useState<Record<string, GatewaySessionInfo>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDevControls, setShowDevControls] = useState<Record<string, boolean>>({});
  const [observations, setObservations] = useState<Observation[]>([]);
  const [latestImages, setLatestImages] = useState<Record<string, LatestImageResponse>>({});
  const [captureStages, setCaptureStages] = useState<Record<string, CaptureStage>>({});
  const [loadingObs, setLoadingObs] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const fetchGateways = async () => {
    try {
      const res = await apiClient.get<Gateway[]>('/gateway/status');
      const gws = res.data || [];
      setGateways(gws);

      // Fetch latest images & session info for all gateways
      for (const gw of gws) {
        fetchGatewayDetails(gw.id);
      }
    } catch (err) {
      window.console.error('Failed to fetch gateway status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGatewayDetails = async (gatewayId: string) => {
    try {
      const [imgRes, sessRes] = await Promise.allSettled([
        apiClient.get<LatestImageResponse>(`/gateway/${gatewayId}/latest-image`),
        apiClient.get<GatewaySessionInfo>(`/gateway/${gatewayId}/session-info`),
      ]);

      if (imgRes.status === 'fulfilled' && imgRes.value.data) {
        setLatestImages((prev) => ({ ...prev, [gatewayId]: imgRes.value.data }));
      }

      if (sessRes.status === 'fulfilled' && sessRes.value.data) {
        setSessionInfos((prev) => ({ ...prev, [gatewayId]: sessRes.value.data }));
      }
    } catch {
      // Ignore individually
    }
  };

  useEffect(() => {
    fetchGateways();
    const interval = window.setInterval(fetchGateways, 6000);
    return () => window.clearInterval(interval);
  }, [user]);

  const toggleExpand = async (gatewayId: string) => {
    if (expandedId === gatewayId) {
      setExpandedId(null);
      setObservations([]);
      return;
    }

    setExpandedId(gatewayId);
    setLoadingObs(true);
    try {
      const [obsRes, imgRes] = await Promise.all([
        apiClient.get<Observation[]>(`/gateway/${gatewayId}/observations?limit=20`),
        apiClient.get<LatestImageResponse>(`/gateway/${gatewayId}/latest-image`),
      ]);
      setObservations(obsRes.data || []);
      if (imgRes.data) {
        setLatestImages((prev) => ({ ...prev, [gatewayId]: imgRes.data }));
      }
    } catch (err) {
      window.console.error('Failed to fetch observations:', err);
      setObservations([]);
    } finally {
      setLoadingObs(false);
    }
  };

  const handleCaptureTest = async (gatewayId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setCaptureStages((prev) => ({ ...prev, [gatewayId]: 'CAPTURING' }));

    try {
      await apiClient.post(`/gateway/${gatewayId}/request-capture`);

      let attempts = 0;
      const initialImg = latestImages[gatewayId]?.image;

      const pollInterval = window.setInterval(async () => {
        attempts++;

        if (attempts === 2) {
          setCaptureStages((prev) => ({ ...prev, [gatewayId]: 'UPLOADING' }));
        } else if (attempts === 5) {
          setCaptureStages((prev) => ({ ...prev, [gatewayId]: 'PROCESSING' }));
        }

        try {
          const imgRes = await apiClient.get<LatestImageResponse>(`/gateway/${gatewayId}/latest-image`);
          if (imgRes.data?.image && imgRes.data.image !== initialImg) {
            setLatestImages((prev) => ({ ...prev, [gatewayId]: imgRes.data }));
            setCaptureStages((prev) => ({ ...prev, [gatewayId]: 'SUCCESS' }));
            window.clearInterval(pollInterval);

            window.setTimeout(() => {
              setCaptureStages((prev) => ({ ...prev, [gatewayId]: 'IDLE' }));
            }, 3000);
            return;
          }
        } catch {
          // Keep polling
        }

        if (attempts >= 10) {
          window.clearInterval(pollInterval);
          try {
            const imgRes = await apiClient.get<LatestImageResponse>(`/gateway/${gatewayId}/latest-image`);
            if (imgRes.data?.image) {
              setLatestImages((prev) => ({ ...prev, [gatewayId]: imgRes.data }));
              setCaptureStages((prev) => ({ ...prev, [gatewayId]: 'SUCCESS' }));
            }
          } finally {
            window.setTimeout(() => {
              setCaptureStages((prev) => ({ ...prev, [gatewayId]: 'IDLE' }));
            }, 3000);
          }
        }
      }, 2000);
    } catch (err) {
      window.console.error('Failed to request capture:', err);
      setCaptureStages((prev) => ({ ...prev, [gatewayId]: 'IDLE' }));
    }
  };

  const getFriendlyTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 0) return 'Just now';
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'BLE_DETECTED':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'PERSON_COUNT':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'HEARTBEAT':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (user?.role === 'STUDENT') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Radio className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Gateway monitoring is restricted to teachers and admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Hardware Gateways</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated classroom hardware runtime — ESP32-CAM camera nodes & BLE presence.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchGateways}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>Auto-poll 6s</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xl font-extrabold text-foreground">{gateways.length}</p>
            <p className="text-xs text-muted-foreground font-medium">Total Registered</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Wifi className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xl font-extrabold text-emerald-500">
              {gateways.filter((g) => g.status === 'ONLINE').length}
            </p>
            <p className="text-xs text-muted-foreground font-medium">Online Hardware</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
            <WifiOff className="h-6 w-6" />
          </div>
          <div>
            <p className="text-3xl font-extrabold text-red-500">
              {gateways.filter((g) => g.status === 'OFFLINE').length}
            </p>
            <p className="text-xs text-muted-foreground font-medium">Offline Hardware</p>
          </div>
        </div>
      </div>

      {/* Gateway Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="lg:col-span-2 flex items-center justify-center h-48 border rounded-xl bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Connecting to gateway nodes...</span>
          </div>
        ) : gateways.length === 0 ? (
          <div className="lg:col-span-2 flex flex-col items-center justify-center h-48 border rounded-xl bg-card text-muted-foreground">
            <Radio className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-base font-bold text-foreground">No Gateways Registered</p>
            <p className="text-xs text-muted-foreground mt-1">
              Power on your ESP32-CAM node to register it automatically.
            </p>
          </div>
        ) : (
          gateways.map((gw) => {
            const latestImgData = latestImages[gw.id];
            const sessionInfo = sessionInfos[gw.id];
            const stage = captureStages[gw.id] || 'IDLE';
            const isDevMode = showDevControls[gw.id] || false;

            return (
              <div
                key={gw.id}
                className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-md"
              >
                <div className="p-6 space-y-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-foreground">{gw.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
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
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Location: {gw.classroom}</p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDevControls((prev) => ({ ...prev, [gw.id]: !isDevMode }))}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      <span>{isDevMode ? 'Hide Dev Mode' : 'Dev Mode'}</span>
                    </Button>
                  </div>

                  {/* ACTIVE SESSION RUNTIME BANNER */}
                  {sessionInfo?.status === 'ACTIVE' ? (
                    <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                          <PlayCircle className="h-4 w-4 animate-pulse text-emerald-400" />
                          Active Attendance Runtime
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                          AUTO-CAPTURE ACTIVE
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-muted-foreground font-medium block">Current Session</span>
                          <span className="font-bold text-foreground">{sessionInfo.podName || 'Active Pod'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium block">Observations Ingested</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {sessionInfo.observationCount} observations
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-border/50 bg-muted/20 rounded-xl p-3 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-muted-foreground opacity-50" />
                        <span>No Active Session — Gateway Idle</span>
                      </div>
                      <span className="text-[10px] font-mono">Standby</span>
                    </div>
                  )}

                  {/* Developer Controls (Manual Capture Test) */}
                  {isDevMode && (
                    <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                          <Sliders className="h-3.5 w-3.5" />
                          Developer Controls
                        </span>
                        <span className="text-[10px] text-muted-foreground">Manual Hardware Override</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await apiClient.post(`/gateway/${gw.id}/toggle-status`, {
                                status: gw.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE',
                              });
                              fetchGateways();
                            } catch (err) {
                              window.console.error('Toggle status error:', err);
                            }
                          }}
                          className="h-9 text-xs font-semibold"
                        >
                          {gw.status === 'ONLINE' ? '🔴 Mark Offline' : '🟢 Mark Online'}
                        </Button>

                        <Button
                          size="sm"
                          onClick={(e) => handleCaptureTest(gw.id, e)}
                          disabled={stage !== 'IDLE'}
                          className={`h-9 text-xs font-bold transition-all ${
                            stage === 'SUCCESS'
                              ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                              : stage === 'CAPTURING'
                                ? 'bg-yellow-600 hover:bg-yellow-600 text-white'
                                : stage === 'UPLOADING' || stage === 'PROCESSING'
                                  ? 'bg-blue-600 hover:bg-blue-600 text-white'
                                  : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md'
                          }`}
                        >
                          {stage === 'CAPTURING' ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              <span>Capturing...</span>
                            </>
                          ) : stage === 'UPLOADING' ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              <span>Uploading...</span>
                            </>
                          ) : stage === 'PROCESSING' ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              <span>Processing...</span>
                            </>
                          ) : stage === 'SUCCESS' ? (
                            <>
                              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                              <span>Image Updated</span>
                            </>
                          ) : (
                            <>
                              <Camera className="h-3.5 w-3.5 mr-1.5" />
                              <span>Manual Capture Test</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Gateway Metadata Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t">
                    <div>
                      <span className="text-muted-foreground font-medium block">Firmware</span>
                      <span className="font-mono text-foreground font-bold">{gw.firmwareVersion || 'v1.0.0'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground font-medium block">Last Heartbeat</span>
                      <span className="font-mono text-foreground">{getFriendlyTime(gw.lastHeartbeat)}</span>
                    </div>
                  </div>

                  {/* Latest Image Section */}
                  <div className="border rounded-xl p-3 bg-muted/20 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-primary" />
                        Latest Camera Capture
                      </span>
                      {latestImgData?.timestamp && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {getFriendlyTime(latestImgData.timestamp)}
                        </span>
                      )}
                    </div>

                    {latestImgData?.image ? (
                      <div className="relative group rounded-lg overflow-hidden border bg-black aspect-video flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={latestImgData.image}
                          alt="ESP32-CAM Capture"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 rounded-full shadow-lg"
                            onClick={() => setModalImage(latestImgData.image)}
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[9px] font-mono text-white flex items-center gap-2">
                          <span>{latestImgData.width || 320}x{latestImgData.height || 240}</span>
                          {latestImgData.bytes && <span>{(latestImgData.bytes / 1024).toFixed(1)} KB</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="h-28 rounded-lg border border-dashed flex flex-col items-center justify-center text-muted-foreground text-xs space-y-1">
                        <Camera className="h-5 w-5 opacity-40" />
                        <span>No image captured yet</span>
                        <span className="text-[10px] text-muted-foreground/60">
                          Automated capture runs during active attendance sessions
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Expand Row */}
                <div className="border-t bg-muted/10 px-6 py-3 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">ID: {gw.id}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(gw.id)}
                    className="h-7 text-xs flex items-center gap-1 text-primary hover:text-primary/80"
                  >
                    <span>{expandedId === gw.id ? 'Hide Telemetry' : 'View Telemetry Log'}</span>
                    {expandedId === gw.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                {/* Expanded Telemetry Sub-table */}
                {expandedId === gw.id && (
                  <div className="border-t bg-muted/20 p-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Raw Telemetry Events
                      </span>
                    </div>

                    {loadingObs ? (
                      <p className="text-xs text-muted-foreground">Loading observations...</p>
                    ) : observations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No telemetry recorded.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {observations.map((obs) => (
                          <div key={obs.id} className="p-3 rounded-lg border bg-card text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold border ${getTypeBadgeColor(obs.type)}`}
                              >
                                {obs.type}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {getFriendlyTime(obs.createdAt)}
                              </span>
                            </div>
                            <pre className="text-[9px] font-mono text-muted-foreground overflow-x-auto bg-muted/50 p-2 rounded max-h-20">
                              {JSON.stringify(obs.payload, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Fullscreen Image Preview Modal */}
      {modalImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-card rounded-2xl overflow-hidden border shadow-2xl space-y-4 p-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                Full Resolution ESP32-CAM Image
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalImage(null)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[70vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={modalImage} alt="Full Resolution Capture" className="max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
