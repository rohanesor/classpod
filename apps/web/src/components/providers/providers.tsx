'use client';

import { AuthProvider } from './auth-provider';
import { ThemeProvider } from './theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
