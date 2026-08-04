'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
          Manage your user profile details, theme settings, and account options.
        </p>
      </div>

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

      {/* Onboarding Preferences (If saved during signup) */}
      {((user as any)?.heardFrom || (user as any)?.onboardingReason) && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold border-b pb-2">Onboarding Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(user as any)?.heardFrom && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-xs text-muted-foreground block">How you found us</span>
                  <span className="text-sm font-semibold">{ (user as any).heardFrom }</span>
                </div>
              </div>
            )}
            {(user as any)?.onboardingReason && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                <Target className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-xs text-muted-foreground block">Primary Goal</span>
                  <span className="text-sm font-semibold">{ (user as any).onboardingReason }</span>
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
                className={`flex flex-col items-center justify-center p-4 border rounded-xl bg-muted/20 hover:bg-muted/40 transition-all ${
                  isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
                }`}
              >
                <t.icon className={`h-5 w-5 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-xs font-semibold">{t.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary mt-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Actions & Session Management */}
      <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold border-b pb-2">Account Actions</h3>
        <p className="text-xs text-muted-foreground">
          Sign out of your ClassPod session on this device.
        </p>

        {!showLogoutConfirm ? (
          <Button
            onClick={() => setShowLogoutConfirm(true)}
            variant="destructive"
            className="flex items-center gap-2 font-bold shadow-md"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="text-sm font-semibold">Are you sure you want to log out?</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 sm:flex-initial font-bold"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Logging out...
                  </>
                ) : (
                  'Yes, Log Out'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-destructive font-bold">
          <AlertTriangle className="h-4 w-4" />
          <span>Danger Zone</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Deleting your ClassPod account will permanently remove all your attendance data and pod memberships.
        </p>
        <div className="pt-1">
          <Button variant="ghost" size="sm" disabled className="text-xs text-muted-foreground border opacity-50 cursor-not-allowed">
            Delete Account (Contact Administrator)
          </Button>
        </div>
      </div>
    </div>
  );
}
