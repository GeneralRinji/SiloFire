import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Missing #root element.');
}

const root = createRoot(container);

function toErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

function renderStartupError(error: unknown) {
  root.render(
    <main className="terminal-shell">
      <section className="terminal-screen terminal-screen--home">
        <section className="terminal-block">
          <p className="terminal-path">silofire:/startup-error</p>
          <h1 className="terminal-title">Startup Error</h1>
          <p className="terminal-copy">The app failed before the main screen could render.</p>
        </section>

        <section className="terminal-block">
          <p className="terminal-label">Message</p>
          <pre className="terminal-error">{toErrorText(error)}</pre>
        </section>
      </section>
    </main>,
  );
}

window.addEventListener('error', (event) => {
  renderStartupError(event.error ?? new Error(event.message));
});

window.addEventListener('unhandledrejection', (event) => {
  renderStartupError(event.reason);
});

async function bootstrap() {
  try {
    const [{ App }, { AppErrorBoundary }] = await Promise.all([
      import('./App'),
      import('./AppErrorBoundary'),
    ]);

    root.render(
      <StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </StrictMode>,
    );
  } catch (error) {
    renderStartupError(error);
  }
}

void bootstrap();