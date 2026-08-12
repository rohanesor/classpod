'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  User,
  Mail,
  Shield,
  Moon,
  Sun,
  Laptop,
  Check,
  LogOut,
  HelpCircle,
  Target,
  AlertTriangle,
  Loader2,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // WhatsApp & Phone State
  const [phone, setPhone] = useState(user?.phone || '+916380221196');
  const [savingPhone, setSavingPhone] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.phone) {
      setPhone(user.phone);
    }
  }, [user?.phone]);

  const handleSavePhone = async () => {
    setSavingPhone(true);
    setFeedback(null);
    try {
      await apiClient.patch('/auth/profile', { phone });
      setFeedback({ type: 'success', text: 'WhatsApp phone number saved successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to update phone number.' });
    } finally {
      setSavingPhone(false);
    }
  };

  const handleTestWhatsApp = async () => {
    setTestingWhatsApp(true);
    setFeedback(null);
    try {
      const res: any = await apiClient.post('/automation/test-whatsapp', { phone });
      if (res?.data?.success || res?.success) {
        setFeedback({
          type: 'success',
          text: `WhatsApp test notification delivered to ${phone}! Check your phone.`,
        });
      } else {
        setFeedback({
          type: 'error',
          text: res?.data?.message || res?.message || 'Failed to send WhatsApp message.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to send WhatsApp test.' });
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      window.console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b pb-5">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your user profile details, WhatsApp automation alerts, and theme preferences.
        </p>
      </div>

      {/* Alert Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-xs font-semibold animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Profile Section */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
        <h3 className="text-lg font-bold border-b pb-2">User Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col items-center justify-center p-4 bg-muted/20 border rounded-xl">
            <div className="h-16 w-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl mb-3">
              {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'CP'}
            </div>
            <p className="font-bold text-sm text-foreground">{user?.name || 'Loading...'}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{user?.role}</p>
          </div>

          <div className="md:col-span-2 space-y-4 justify-center flex flex-col">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground block">Full Name</span>
                <span className="text-sm font-semibold">{user?.name || '—'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground block">Email Address</span>
                <span className="text-sm font-semibold">{user?.email || '—'}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="text-xs text-muted-foreground block">System Role</span>
                <span className="text-sm font-semibold capitalize">{user?.role?.toLowerCase() || '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Automation & Reports Section */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <MessageSquare className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-bold">WhatsApp Automation & Reports</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          When an attendance session completes, ClassPod automatically generates Excel/PDF reports and sends a real-time summary to your WhatsApp.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <span>WhatsApp Phone Number (with country code)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+916380221196"
                className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                onClick={handleSavePhone}
                disabled={savingPhone}
                variant="default"
                size="sm"
                className="gap-1.5"
              >
                {savingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>Save</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Example format: <code className="bg-muted px-1 rounded text-primary">+916380221196</code>
            </p>
          </div>

          <div className="flex flex-col justify-end">
            <Button
              onClick={handleTestWhatsApp}
              disabled={testingWhatsApp}
              variant="secondary"
              size="sm"
              className="gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 h-10 w-full"
            >
              {testingWhatsApp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>Send Test WhatsApp</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Onboarding Preferences */}
      {((user as any)?.heardFrom || (user as any)?.onboardingReason) && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold border-b pb-2">Onboarding Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(user as any)?.heardFrom && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-xs text-muted-foreground block">How you found us</span>
                  <span className="text-sm font-semibold">{(user as any).heardFrom}</span>
                </div>
              </div>
            )}
            {(user as any)?.onboardingReason && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <Target className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-xs text-muted-foreground block">Primary Goal</span>
                  <span className="text-sm font-semibold">{(user as any).onboardingReason}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Themes Settings */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold border-b pb-2">App Appearance</h3>
        <p className="text-xs text-muted-foreground">Select how ClassPod looks on your device.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {(
            [
              { id: 'light', label: 'Light Mode', icon: Sun },
              { id: 'dark', label: 'Dark Mode', icon: Moon },
              { id: 'system', label: 'System', icon: Laptop },
            ] as const
          ).map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'border-muted hover:border-muted-foreground/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <t.icon className="h-4 w-4" />
                  <span className="text-xs">{t.label}</span>
                </div>
                {isSelected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Actions / Logout Section */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-bold text-destructive">Account Management</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sign out of your active session on this device.
          </p>
        </div>

        {showLogoutConfirm ? (
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-destructive font-bold text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Confirm Sign Out</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to log out? You will need your credentials to log back in.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={handleLogout}
                disabled={isLoggingOut}
                variant="destructive"
                size="sm"
                className="gap-1.5"
              >
                {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                <span>Yes, Sign Out</span>
              </Button>
              <Button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                variant="secondary"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setShowLogoutConfirm(true)}
            variant="secondary"
            size="sm"
            className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        )}
      </div>
    </div>
  );
}
