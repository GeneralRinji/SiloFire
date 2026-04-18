import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error?: Error;
  componentStack?: string | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, componentStack: errorInfo.componentStack });
    console.error(error);
    console.error(errorInfo.componentStack);
  }

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="terminal-shell">
        <section className="terminal-screen terminal-screen--home">
          <section className="terminal-block">
            <p className="terminal-path">silofire:/error</p>
            <h1 className="terminal-title">Render Error</h1>
            <p className="terminal-copy">The app hit a runtime error while rendering this screen.</p>
          </section>

          <section className="terminal-block">
            <p className="terminal-label">Message</p>
            <pre className="terminal-error">{this.state.error.stack ?? this.state.error.message}</pre>
          </section>

          {this.state.componentStack ? (
            <section className="terminal-block">
              <p className="terminal-label">Component Stack</p>
              <pre className="terminal-error">{this.state.componentStack}</pre>
            </section>
          ) : null}
        </section>
      </main>
    );
  }
}