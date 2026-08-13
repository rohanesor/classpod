'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { apiClient } from '@/lib/api-client';
import {
  User,
  Moon,
  Sun,
  Laptop,
  Check,
  LogOut,
  AlertTriangle,
  Loader2,
  Phone,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '+916380221196');
  const [avatarUrl, setAvatarUrl] = useState<string>((user as any)?.avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // WhatsApp Testing State
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      if (user.phone) setPhone(user.phone);
      if ((user as any).avatarUrl) setAvatarUrl((user as any).avatarUrl);
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback(null);
    try {
      await apiClient.patch('/auth/profile', {
        name,
        phone,
        avatarUrl: avatarUrl || undefined,
      });
      setFeedback({ type: 'success', text: 'Profile details saved successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
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
          text: `WhatsApp test notification delivered to ${phone}! Check WhatsApp.`,
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
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="border-b pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          Manage your user profile, WhatsApp automation alerts, theme preferences, and security.
        </p>
      </div>

      {/* Alert Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-2xl border text-xs font-semibold animate-in fade-in duration-200 ${
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

      {/* 1. PROFILE SECTION */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-base sm:text-lg font-bold text-foreground">User Profile</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
            {user?.role}
          </span>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar Preview */}
            <div className="flex flex-col items-center gap-2">
              <UserAvatar name={name || user?.name} avatarUrl={avatarUrl} role={user?.role} size="2xl" />
              <span className="text-[10px] font-semibold text-muted-foreground">Profile Avatar</span>
            </div>

            {/* Profile Inputs */}
            <div className="flex-1 w-full space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-xl border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full h-10 px-3 rounded-xl border bg-muted/40 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Avatar URL / Preset selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Profile Picture URL (Optional)
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full h-10 px-3 rounded-xl border bg-background text-xs sm:text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={savingProfile} size="sm" className="font-bold shadow-md gap-1.5">
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>Save Profile</span>
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 2. WHATSAPP AUTOMATION & REPORTS SECTION */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <MessageSquare className="h-5 w-5 text-emerald-500" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">WhatsApp Attendance Alerts</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          When an attendance session concludes, ClassPod automatically generates Excel/PDF reports and delivers an instant executive summary to your WhatsApp.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="sm:col-span-2 space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <span>Target WhatsApp Number (International format)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+916380221196"
                className="flex-1 h-10 px-3 rounded-xl border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                variant="secondary"
                size="sm"
                className="font-bold h-10 px-4"
              >
                Save
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configured recipient: <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono">{phone}</code>
            </p>
          </div>

          <div className="flex flex-col justify-end">
            <Button
              onClick={handleTestWhatsApp}
              disabled={testingWhatsApp}
              variant="secondary"
              size="sm"
              className="h-10 w-full gap-2 border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 font-bold"
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

      {/* 3. APPEARANCE & THEME SETTINGS */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">App Appearance</h2>
        </div>
        <p className="text-xs text-muted-foreground">Select how ClassPod renders on your screen.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {(
            [
              { id: 'light', label: 'Light Mode', icon: Sun },
              { id: 'dark', label: 'Dark Mode', icon: Moon },
              { id: 'system', label: 'System Theme', icon: Laptop },
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
                    : 'border-muted hover:border-muted-foreground/30 hover:bg-muted/40'
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

      {/* 4. ACCOUNT MANAGEMENT & SIGN OUT */}
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-destructive">Account Management</h2>
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
              Are you sure you want to log out? You will need your credentials to access your workspace.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={handleLogout}
                disabled={isLoggingOut}
                variant="destructive"
                size="sm"
                className="gap-1.5 font-bold"
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
            className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2 font-bold"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        )}
      </div>
    </div>
  );
}
