import type { ReactNode } from 'react';
import { Component } from 'react';

type Props = {
  fallback?: ReactNode;
  children: ReactNode;
};

type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', err);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <div className="p-6 text-sm text-slate-700">Something went wrong.</div>;
    }
    return this.props.children;
  }
}

