import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-status-blocked/10 rounded-full flex items-center justify-center mb-6">
            <span className="text-status-blocked text-2xl font-bold">!</span>
          </div>
          <h1 className="text-2xl font-bold text-ink-900 mb-2">Something went wrong</h1>
          <p className="text-ink-600 max-w-md mb-6">
            The application crashed while rendering this page. This is usually caused by a missing configuration or connection error.
          </p>
          <pre className="bg-surface-elevated border border-surface-border p-4 rounded-lg text-status-blocked text-xs text-left max-w-xl overflow-auto mb-6">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
