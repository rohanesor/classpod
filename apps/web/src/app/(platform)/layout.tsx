'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { AppShell } from '@/components/app-shell';
import { Loader2 } from 'lucide-react';

import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}
