'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Activity,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Terminal,
  Users,
  Bell,
  LogOut,
  Inbox,
  User,
  Radio,
  Menu,
  X,
  Zap,
} from 'lucide-react';

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pods', label: 'Pods', icon: Users },
  { href: '/attendance', label: 'Attendance', icon: GraduationCap },
  { href: '/automation', label: 'Automation', icon: Zap },
  { href: '/developer-console', label: 'Developer Console', icon: Terminal },
  { href: '/gateway', label: 'Gateway', icon: Radio },
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
  const dropdownRef = useRef<any>(null);
  const prevUnreadCountRef = useRef(0);

  // Poll for notifications every 15 seconds
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const response = await apiClient.get<Notification[]>('/notifications');
      setNotifications(response.data || []);
    } catch (err) {
      window.console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 15000);
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
    } catch (err) {
      window.console.error('Failed to mark notification as read:', err);
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
    } catch (err) {
      window.console.error('Failed to mark all notifications as read:', err);
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

  const visibleNavItems = navigationItems.filter((item) => {
    const role = user?.role?.toUpperCase();
    if (role === 'STUDENT') {
      if (item.href === '/developer-console' || item.href === '/gateway') {
        return false;
      }
    }
    if (item.href === '/developer-console' && role !== 'TEACHER' && role !== 'ADMIN') {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col md:grid md:grid-cols-[240px_1fr] bg-background">
      {/* Desktop Sidebar (visible on md+) */}
      <aside className="hidden md:flex border-r bg-muted/40 flex-col justify-between">
        <div>
          <div className="flex h-14 items-center gap-2 border-b px-6 font-semibold">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight">ClassPod</span>
          </div>
          <nav className="grid gap-1 p-4">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout in Sidebar Footer */}
        {user && (
          <div className="p-4 border-t bg-muted/20 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">{user.role}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={logout}
              className="w-full flex items-center justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-10 px-3 text-xs font-semibold"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer (revealed via hamburger) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer content */}
          <div className="relative flex w-full max-w-xs flex-col bg-background border-r p-6 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div className="flex items-center gap-2 font-bold">
                <Activity className="h-5 w-5 text-primary" />
                <span>ClassPod</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="h-10 w-10 rounded-full flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="grid gap-1 flex-1">
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
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
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">{user.role}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-10 px-3 text-xs font-semibold"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Right Area */}
      <div className="flex flex-col flex-1 min-h-screen">
        {/* Top Header Navigation bar */}
        <header className="flex h-14 items-center justify-between border-b px-4 md:px-8 bg-card shadow-sm z-40">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden h-10 w-10 rounded-full flex items-center justify-center"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-sm font-medium text-muted-foreground">Workspace</span>
              <span className="hidden sm:inline text-sm text-muted-foreground">/</span>
              <span className="text-sm font-bold text-foreground capitalize">
                {pathname.split('/')[1] || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell Dropdown */}
            {user && (
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(!isOpen)}
                  className="relative h-10 w-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                >
                  <Bell className={`h-5 w-5 ${bellJiggling ? 'animate-jiggle text-primary' : ''}`} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground animate-bounce">
                      {unreadCount}
                    </span>
                  )}
                </Button>

                {/* Dropdown Menu - Responsive Width */}
                {isOpen && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 rounded-xl border bg-popover text-popover-foreground shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
                      <span className="text-sm font-bold">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-[300px] overflow-y-auto divide-y">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                          <Inbox className="h-8 w-8 mb-2 opacity-55" />
                          <p className="text-xs font-medium">All caught up!</p>
                          <p className="text-[10px] mt-0.5">No notifications found.</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => !n.readAt && handleMarkAsRead(n.id)}
                            className={`p-4 text-left transition-colors cursor-pointer relative ${
                              !n.readAt ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
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
                              <span className="absolute right-3 bottom-3 flex h-2.5 w-2.5 rounded-full bg-primary" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content Wrapper with Safe Bottom Padding for Mobile Nav */}
        <main className="p-4 md:p-8 flex-1 bg-background/50 overflow-y-auto pb-24 md:pb-8">{children}</main>
      </div>

      {/* Bottom Nav Menu for mobile view (fixed to bottom with safe-area insets) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 pb-[env(safe-area-inset-bottom)] border-t bg-card/95 backdrop-blur-md z-50 flex items-center justify-around px-2 shadow-lg">
        {visibleNavItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full text-[10px] font-medium transition-all ${
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
