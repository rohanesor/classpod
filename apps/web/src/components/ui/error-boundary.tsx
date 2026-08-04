'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console or error reporting service
    window.console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] w-full flex flex-col items-center justify-center p-6 text-center bg-zinc-950 text-zinc-100 rounded-xl border border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-4 border border-red-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-sm text-zinc-400 max-w-md mb-6">
            An unhandled error occurred while rendering this interface.
          </p>
          {this.state.error?.message && (
            <div className="mb-6 p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-red-300 max-w-lg overflow-auto">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
