import { Component, type ErrorInfo, type ReactNode } from "react";

// Catches render-time errors in its subtree and shows a recoverable fallback
// instead of unmounting the whole app. Wrap independent sections so one failing
// widget doesn't take down the page.

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the failure for debugging; in production this is where a logger
    // (Sentry, etc.) would receive the error.
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="card card-body w-full text-center border-dashed">
        <h3 className="font-disp text-xl text-ink">Something went wrong</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-sub">
          An unexpected error occurred while loading this section.
        </p>
        <div className="mt-4">
          <button
            type="button"
            className="btn btn-primary min-h-[44px]"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
