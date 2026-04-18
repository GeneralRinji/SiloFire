import type { ReactNode } from 'react';

interface PageShellProps {
  eyebrow: string;
  title?: string;
  tagline?: string;
  children: ReactNode;
}

export function PageShell({ eyebrow, title, tagline, children }: PageShellProps) {
  return (
    <main className="page-shell">
      <header className="hero-header">
        <p className="hero-header__eyebrow">{eyebrow}</p>
        {title ? <h1 className="hero-header__title">{title}</h1> : null}
        {tagline ? <p className="hero-header__tagline">{tagline}</p> : null}
      </header>
      <div className="page-shell__body">{children}</div>
    </main>
  );
}