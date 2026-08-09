'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Users,
  Copy,
  Check,
  Calendar,
  Hash,
  Loader2,
  AlertCircle,
  UserCheck,
  UserX,
  Mail,
  Clock
} from 'lucide-react';
import type { Pod } from '../../page';

export interface Member {
  id: string;
  status: 'ACTIVE' | 'LEFT';
  joinedAt?: string;
  leftAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  student?: {
    name: string;
    email: string;
  };
  name?: string;
  email?: string;
}

interface PodDetails extends Pod {
  members?: Member[];
}

export function PodMembersClient() {
  const params = useParams();
  const podId = params?.id as string;

  const [pod, setPod] = useState<PodDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch Pod Details & Members
  const fetchPodDetails = useCallback(async () => {
    if (!podId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PodDetails>(`/pods/${podId}`);
      setPod(response.data);
    } catch (err: any) {
      window.console.error('Failed to fetch pod members:', err);
      setError(err?.message || 'Failed to load pod memberships. Please verify the pod ID.');
    } finally {
      setIsLoading(false);
    }
  }, [podId]);

  useEffect(() => {
    fetchPodDetails();
  }, [fetchPodDetails]);

  // Copy code handler
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  // Format Date utility
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Group members into Active vs Left
  const groupedMembers = useMemo(() => {
    const list = pod?.members || [];
    const active: Member[] = [];
    const left: Member[] = [];

    list.forEach((m) => {
      const status = m.status?.toUpperCase();
      if (status === 'ACTIVE' || status === 'JOINED') {
        active.push(m);
      } else {
        left.push(m);
      }
    });

    return { active, left };
  }, [pod]);

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back navigation */}
      <div>
        <Link href="/pods">
          <Button variant="secondary" className="flex items-center gap-2 text-xs">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Pods</span>
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading classroom details & roster...</p>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 border border-destructive/20 bg-destructive/5 text-destructive rounded-lg shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium">{error}</div>
          <Button variant="ghost" onClick={fetchPodDetails} className="ml-auto text-xs h-8 border border-destructive/20 hover:bg-destructive/10">
            Retry
          </Button>
        </div>
      ) : !pod ? (
        <div className="flex flex-col items-center justify-center text-center p-12 border border-dashed rounded-2xl bg-muted/5 min-h-[300px]">
          <h3 className="text-lg font-bold">Classroom not found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mt-1">
            This classroom pod does not exist or you do not have permission to view it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Pod Details Summary Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden">
              <div className="h-2 w-full bg-primary" />
              <div className="p-6 space-y-6">
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                    {pod.subjectCode}
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight mt-2">{pod.name}</h2>
                  <p className="text-muted-foreground text-sm mt-2">
                    {pod.description || 'No description provided.'}
                  </p>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      Semester
                    </span>
                    <span className="font-semibold">{pod.semester || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Hash className="h-4 w-4" />
                      Section
                    </span>
                    <span className="font-semibold">{pod.section || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Status
                    </span>
                    <span className={`font-semibold capitalize ${pod.status === 'ACTIVE' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {pod.status?.toLowerCase()}
                    </span>
                  </div>
                </div>

                {pod.status === 'ACTIVE' && (
                  <div className="border-t pt-4 space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Roster Invite Code
                    </span>
                    <div className="bg-muted/50 border rounded-lg p-3 flex items-center justify-between">
                      <span className="font-mono font-bold tracking-widest text-lg text-foreground">
                        {pod.joinCode}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyCode(pod.joinCode)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-background"
                        title="Copy Code"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-xl p-4 bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">Active Roster</span>
                <span className="text-3xl font-extrabold text-emerald-600">
                  {groupedMembers.active.length}
                </span>
              </div>
              <div className="border rounded-xl p-4 bg-card shadow-sm space-y-1">
                <span className="text-xs text-muted-foreground font-medium block">Withdrawn</span>
                <span className="text-3xl font-extrabold text-muted-foreground">
                  {groupedMembers.left.length}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Roster List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="border rounded-xl bg-card text-card-foreground shadow-sm p-6">
              <div className="flex items-center gap-2 border-b pb-4 mb-6">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold">Classroom Members</h3>
              </div>

              {(!pod.members || pod.members.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-3 bg-muted rounded-full mb-3">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h4 className="font-bold">No students registered</h4>
                  <p className="text-muted-foreground text-xs max-w-xs mt-1">
                    Share the class join code with students to start enrolling them in this pod.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Active Roster Group */}
                  {groupedMembers.active.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>Active Students ({groupedMembers.active.length})</span>
                      </h4>
                      <div className="border rounded-lg divide-y overflow-hidden bg-background/50">
                        {groupedMembers.active.map((member) => {
                          const name = member.student?.name || member.name || 'Unknown Student';
                          const email = member.student?.email || member.email || 'No Email';
                          const joinedDate = formatDate(member.joinedAt || member.createdAt);

                          return (
                            <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/10 to-blue-500/10 border flex items-center justify-center font-bold text-sm text-primary shrink-0">
                                  {getInitials(name)}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-sm flex items-center gap-2">
                                    <span>{name}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span>{email}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-start sm:self-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  <UserCheck className="h-3 w-3" />
                                  <span>Active</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Enrolled: {joinedDate}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Left Roster Group */}
                  {groupedMembers.left.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                        <span>Withdrawn / Left ({groupedMembers.left.length})</span>
                      </h4>
                      <div className="border rounded-lg divide-y overflow-hidden bg-muted/5">
                        {groupedMembers.left.map((member) => {
                          const name = member.student?.name || member.name || 'Unknown Student';
                          const email = member.student?.email || member.email || 'No Email';
                          const joinedDate = formatDate(member.joinedAt || member.createdAt);
                          const leftDate = formatDate(member.leftAt || member.updatedAt);

                          return (
                            <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 bg-muted/5 hover:bg-muted/10 opacity-75 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm text-muted-foreground shrink-0 border">
                                  {getInitials(name)}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-sm line-through text-muted-foreground">{name}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-muted-foreground/60" />
                                    <span>{email}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted-foreground/10 text-muted-foreground border">
                                  <UserX className="h-3 w-3" />
                                  <span>Left</span>
                                </span>
                                <div className="text-[9px] text-muted-foreground space-y-0.5 text-left sm:text-right">
                                  <div>Joined: {joinedDate}</div>
                                  <div>Withdrew: {leftDate}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
