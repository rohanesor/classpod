'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ClassPodLogo } from '@/components/ui/logo';
import { UserAvatar } from '@/components/ui/avatar';
import { OnboardingModal } from '@/components/ui/onboarding-modal';
import {
  LayoutDashboard,
  GraduationCap,
  FileSpreadsheet,
  Settings,
  Bell,
  LogOut,
  Inbox,
  Menu,
  X,
} from 'lucide-react';

const navigationItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/pods', label: 'Attendance', icon: GraduationCap },
  { href: '/reports', label: 'Reports', icon: FileSpreadsheet },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  priority: 'LOW' | 'DEFAULT' | 'HIGH';
  expiresAt: string | null;
  metadata: any;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [bellJiggling, setBellJiggling] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const dropdownRef = useRef<any>(null);
  const prevUnreadCountRef = useRef(0);

  // Check onboarding status on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const completed = window.localStorage.getItem('classpod_onboarding_completed');
      if (!completed) {
        setShowOnboarding(true);
      }
    }
  }, [user]);

  // Poll for notifications every 20 seconds
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const response = await apiClient.get<Notification[]>('/notifications');
      setNotifications(response.data || []);
    } catch {
      // Silent catch
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 20000);
    return () => window.clearInterval(interval);
  }, [user]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as any)) {
        setIsOpen(false);
      }
    };
    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current) {
      setBellJiggling(true);
      const timer = window.setTimeout(() => setBellJiggling(false), 600);
      return () => window.clearTimeout(timer);
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString(), status: 'READ' } : n)),
      );
    } catch {
      // Silent catch
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.readAt);
    if (unread.length === 0) return;

    try {
      await Promise.all(unread.map((n) => apiClient.patch(`/notifications/${n.id}/read`)));
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString(), status: 'READ' })),
      );
    } catch {
      // Silent catch
    }
  };

  const getFriendlyTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'Just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getPageTitle = () => {
    const segment = pathname.split('/')[1];
    switch (segment) {
      case 'dashboard':
        return 'Home';
      case 'attendance':
        return 'Attendance Workspace';
      case 'reports':
        return 'Attendance Reports & Logs';
      case 'settings':
        return 'Settings & Preferences';
      case 'pods':
        return 'Class Pods';
      default:
        return 'Home';
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:grid md:grid-cols-[240px_1fr] bg-background">
      {/* Onboarding Dialog for new users */}
      {showOnboarding && <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />}

      {/* Desktop Sidebar (visible on md+) */}
      <aside className="hidden md:flex border-r bg-card flex-col justify-between">
        <div>
          {/* Logo Header */}
          <div className="flex h-16 items-center px-6 border-b">
            <ClassPodLogo size="md" />
          </div>

          {/* Nav Items */}
          <nav className="grid gap-1.5 p-4">
            {navigationItems.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard' || pathname === '/'
                  : pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-bold'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile Card & Quick Sign out */}
        {user && (
          <div className="p-4 border-t bg-muted/20 space-y-3">
            <Link
              href="/settings"
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/60 transition-colors"
            >
              <UserAvatar
                name={user.name}
                avatarUrl={(user as any).avatarUrl}
                role={user.role}
                size="sm"
                showRoleBadge
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider font-semibold">
                  {user.role}
                </p>
              </div>
            </Link>

            <Button
              variant="ghost"
              onClick={logout}
              className="w-full flex items-center justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 px-3 text-xs font-semibold rounded-xl"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer (hamburger trigger) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-col bg-card border-r p-6 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <ClassPodLogo size="md" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="h-9 w-9 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="grid gap-1.5 flex-1">
              {navigationItems.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard' || pathname === '/'
                    : pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm font-bold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {user && (
              <div className="border-t pt-4 space-y-3">
                <Link
                  href="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-2 rounded-xl bg-muted/30"
                >
                  <UserAvatar
                    name={user.name}
                    avatarUrl={(user as any).avatarUrl}
                    role={user.role}
                    size="sm"
                    showRoleBadge
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">
                      {user.role}
                    </p>
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 px-3 text-xs font-semibold rounded-xl"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Right Area */}
      <div className="flex flex-col flex-1 min-h-screen">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b px-4 md:px-8 bg-card shadow-sm z-40">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden h-10 w-10 rounded-full"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-base font-bold text-foreground tracking-tight">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(!isOpen)}
                  className="relative h-10 w-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="View notifications"
                >
                  <Bell className={`h-5 w-5 ${bellJiggling ? 'animate-jiggle text-primary' : ''}`} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                      {unreadCount}
                    </span>
                  )}
                </Button>

                {/* Dropdown Menu */}
                {isOpen && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 rounded-2xl border bg-popover text-popover-foreground shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-[11px] font-bold text-primary hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-[320px] overflow-y-auto divide-y">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                          <Inbox className="h-8 w-8 mb-2 opacity-40" />
                          <p className="text-xs font-semibold">All caught up</p>
                          <p className="text-[10px] mt-0.5 text-muted-foreground/70">
                            No unread notifications at this time.
                          </p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => !n.readAt && handleMarkAsRead(n.id)}
                            className={`p-3.5 text-left transition-colors cursor-pointer relative ${
                              !n.readAt ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-xs font-bold text-foreground line-clamp-1">{n.title}</h4>
                              <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                                {getFriendlyTime(n.createdAt)}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                              {n.body}
                            </p>
                            {!n.readAt && (
                              <span className="absolute right-3 bottom-3 flex h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile link */}
            {user && (
              <Link href="/settings" className="hidden sm:flex items-center gap-2 pl-2 border-l">
                <UserAvatar
                  name={user.name}
                  avatarUrl={(user as any).avatarUrl}
                  role={user.role}
                  size="sm"
                  showRoleBadge
                />
              </Link>
            )}
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="p-4 md:p-8 flex-1 bg-background/50 overflow-y-auto pb-24 md:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 pb-[env(safe-area-inset-bottom)] border-t bg-card/95 backdrop-blur-md z-50 flex items-center justify-around px-2 shadow-lg">
        {navigationItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard' || pathname === '/'
              : pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full text-[10px] font-semibold transition-all ${
                isActive ? 'text-primary font-bold scale-105' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
