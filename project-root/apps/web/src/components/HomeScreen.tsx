import type { ContentProjectRecord } from '../../../../packages/content';

import { HomeSplashArt } from './HomeSplashArt';

interface HomeScreenProps {
  projects: ContentProjectRecord[];
  onEnterProject: (projectId: string) => void;
}

export function HomeScreen({ projects, onEnterProject }: HomeScreenProps) {
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
            </div>

            {featuredProject ? (
              <div className="splash-home__cta-row">
                <button type="button" className="splash-home__cta" onClick={() => onEnterProject(featuredProject.id)}>
                  enter/{featuredProject.folderName}
                </button>
                <div className="splash-home__cta-copy">
                  <p className="terminal-badge">featured/{featuredProject.releaseStatus ?? featuredProject.status}</p>
                  <p className="terminal-copy">{featuredProject.title}</p>
                  <div className="splash-home__detail-stack">
                    {renderTagGroup('details', buildMetaTags(featuredProject), 'muted')}
                    {renderTagGroup('tone', buildClassificationTags(featuredProject), 'muted')}
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
                    {renderTagGroup('details', buildMetaTags(project), 'muted')}
                    {renderTagGroup('tone', buildClassificationTags(project), 'muted')}
                    {renderTagGroup('notes', project.contentWarnings, 'warning')}
                  </div>
                  {project.tools.length > 0 ? (
                    <div className="splash-home__tag-row">
                      {project.tools.map((tool) => <span key={`${project.id}-tool-${tool}`} className="splash-home__tag">{tool}</span>)}
                    </div>
                  ) : null}
                  {project.features.length > 0 ? (
                    renderTagGroup('features', project.features, 'muted')
                  ) : null}
                </div>

                <div className="terminal-list__actions splash-home__project-actions">
                  <div className="splash-home__status-card">
                    <p className="terminal-label">Status</p>
                    <p className="terminal-badge">{project.releaseStatus ?? project.status}</p>
                  </div>
                  <button type="button" className="terminal-link splash-home__project-link" onClick={() => onEnterProject(project.id)}>
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

function buildMetaTags(project: ContentProjectRecord): string[] {
  return [
    project.owner ? `owner/${project.owner}` : undefined,
    project.version ? `version/${project.version}` : undefined,
    project.publishedDate ? `published/${formatProjectDate(project.publishedDate)}` : undefined,
  ].filter((value): value is string => Boolean(value));
}

function buildClassificationTags(project: ContentProjectRecord): string[] {
  return [
    project.genre,
    project.rating,
  ].filter((value): value is string => Boolean(value));
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
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}