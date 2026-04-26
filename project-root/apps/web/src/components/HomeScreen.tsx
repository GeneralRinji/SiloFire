import type { ContentProjectRecord } from '../../../../packages/content';

import { HomeSplashArt } from './HomeSplashArt';

interface HomeScreenProps {
  projects: ContentProjectRecord[];
  onEnterAdmin?: () => void;
  onEnterProject: (projectId: string) => void;
}

export function HomeScreen({ projects, onEnterAdmin, onEnterProject }: HomeScreenProps) {
  const featuredProject = projects[0];

  return (
    <main className="terminal-shell">
      <section className="terminal-screen terminal-screen--home splash-home">
        <div className="splash-home__hero">
          <div className="splash-home__artframe">
            <HomeSplashArt />
          </div>

          <header className="terminal-block splash-home__panel splash-home__panel--hero">
            <p className="terminal-path">silofire.net:/</p>
            <div className="splash-home__masthead">
              <p className="splash-home__kicker">Stateful text worlds</p>
              <h1 className="terminal-title splash-home__title">Silofire.net</h1>
              <p className="terminal-copy splash-home__lede">
                A terminal-lit archive for authored routes, thresholds, and explorable prose systems.
              </p>
            </div>

            <div className="splash-home__signal">
              <p className="terminal-label">Current Focus</p>
              <p className="terminal-copy">
                Narrative runtime experiments built with markdown-like content, explicit traversal semantics, and live shared state.
              </p>
              {onEnterAdmin ? (
                <div className="terminal-block__actions splash-home__admin-actions">
                  <button type="button" className="terminal-link terminal-link--muted" onClick={onEnterAdmin}>
                    admin/analytics
                  </button>
                </div>
              ) : null}
            </div>

            {featuredProject ? (
              <div className="splash-home__cta-row">
                <button type="button" className="splash-home__cta" onClick={() => onEnterProject(featuredProject.id)}>
                  enter/{featuredProject.folderName}
                </button>
                <div className="splash-home__cta-copy">
                  <div className="splash-home__badge-row">
                    <p className="terminal-badge">featured/{featuredProject.releaseStatus ?? featuredProject.status}</p>
                    {renderFreshnessBadge(featuredProject)}
                  </div>
                  <p className="terminal-copy">{featuredProject.title}</p>
                  <div className="splash-home__detail-stack">
                    {renderTagGroup('genre', buildClassificationTags(featuredProject), 'muted')}
                    {renderTagGroup('notes', featuredProject.contentWarnings, 'warning')}
                    {renderTagGroup('features', featuredProject.features, 'muted')}
                  </div>
                </div>
              </div>
            ) : null}
          </header>
        </div>

        <section className="terminal-block splash-home__panel splash-home__panel--projects">
          <div className="splash-home__sectionhead">
            <p className="terminal-label">Projects</p>
            <p className="terminal-copy">Choose a live content world and enter it directly.</p>
          </div>

          <ul className="terminal-list splash-home__project-list">
            {projects.map((project) => (
              <li key={project.id} className="terminal-list__item terminal-list__item--project splash-home__project-item">
                <div>
                  <p className="terminal-list__title">{project.title}</p>
                  <p className="terminal-copy">{project.description}</p>
                  <div className="splash-home__detail-stack splash-home__detail-stack--project">
                    {renderTagGroup('genre', buildClassificationTags(project), 'muted')}
                    {renderTagGroup('notes', project.contentWarnings, 'warning')}
                    {renderTagGroup('features', project.features, 'muted')}
                  </div>
                </div>

                <div className="terminal-list__actions splash-home__project-actions">
                  <div className="splash-home__status-card">
                    <p className="terminal-label">Status</p>
                    <p className="terminal-badge">{project.releaseStatus ?? project.status}</p>
                    {renderFreshnessBadge(project)}
                  </div>
                  <button
                    type="button"
                    className="splash-home__cta splash-home__cta--project"
                    onClick={() => onEnterProject(project.id)}
                  >
                    enter/{project.folderName}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}

function buildClassificationTags(project: ContentProjectRecord): string[] {
  return [
    project.genre,
    project.rating,
  ].filter((value): value is string => Boolean(value));
}

function renderFreshnessBadge(project: ContentProjectRecord) {
  const freshnessLabel = buildFreshnessLabel(project.publishedDate);

  if (!freshnessLabel) {
    return null;
  }

  return <p className="terminal-badge terminal-badge--freshness">{freshnessLabel}</p>;
}

function renderTagGroup(
  label: string,
  values: string[],
  tone: 'muted' | 'warning' = 'muted',
) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="splash-home__detail-group">
      <span className="splash-home__tag splash-home__tag--label">{label}</span>
      <div className="splash-home__tag-row splash-home__tag-row--compact">
        {values.map((value) => (
          <span key={`${label}-${value}`} className={`splash-home__tag${tone === 'warning' ? ' splash-home__tag--warning' : ' splash-home__tag--muted'}`}>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatProjectDate(value: string): string {
  const parsed = parseProjectDate(value);

  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildFreshnessLabel(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parseProjectDate(value);

  if (!parsed) {
    return `published/${value}`;
  }

  const daysSincePublish = Math.max(0, getLocalDayOrdinal(new Date()) - getLocalDayOrdinal(parsed));
  const formattedDate = formatProjectDate(value);

  if (daysSincePublish <= 14) {
    return `new/${formattedDate}`;
  }

  return `published/${formattedDate}`;
}

function parseProjectDate(value: string): Date | undefined {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    const [, yearText, monthText, dayText] = dateOnlyMatch;
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const day = Number(dayText);
    const date = new Date(year, monthIndex, day);

    if (
      date.getFullYear() === year
      && date.getMonth() === monthIndex
      && date.getDate() === day
    ) {
      return date;
    }

    return undefined;
  }

  const parsedMs = Date.parse(value);
  return Number.isNaN(parsedMs) ? undefined : new Date(parsedMs);
}

function getLocalDayOrdinal(value: Date): number {
  return Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / (1000 * 60 * 60 * 24));
}