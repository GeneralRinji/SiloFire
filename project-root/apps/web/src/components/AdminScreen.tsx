import { useState } from 'react';
import type { RuntimeAdminProjectHeartDetails, RuntimeAdminProjectHeartSummary } from '../../../../packages/runtime-server/src';
import { ProjectStatePanes } from './ProjectStatePanes';

interface AdminGateScreenProps {
  errorText?: string;
  onBackHome: () => void;
  onUnlock: (password: string) => void;
}

export function AdminGateScreen({ errorText, onBackHome, onUnlock }: AdminGateScreenProps) {
  const [password, setPassword] = useState('');

  return (
    <main className="terminal-shell">
      <section className="terminal-screen terminal-screen--admin">
        <div className="terminal-block admin-screen__hero">
          <p className="terminal-path">silofire:/admin</p>
          <h1 className="terminal-title">Website Admin</h1>
          <p className="terminal-copy">Heart analytics and runtime inspection live here, separate from public project play.</p>
          <div className="admin-screen__actions">
            <button type="button" className="terminal-link terminal-link--muted" onClick={onBackHome}>return/home</button>
          </div>
        </div>

        <div className="terminal-block admin-screen__gate">
          <p className="terminal-label">Password Gate</p>
          <label className="admin-screen__field">
            <span className="terminal-copy">shared-password</span>
            <input
              type="password"
              className="admin-screen__input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && password.trim().length > 0) {
                  onUnlock(password.trim());
                }
              }}
            />
          </label>
          {errorText ? <p className="terminal-copy admin-screen__error">{errorText}</p> : null}
          <button type="button" className="splash-home__cta" onClick={() => onUnlock(password.trim())} disabled={password.trim().length === 0}>
            unlock/admin
          </button>
        </div>
      </section>
    </main>
  );
}

interface AdminOverviewScreenProps {
  isLoading?: boolean;
  projects: RuntimeAdminProjectHeartSummary[];
  onBackHome: () => void;
  onOpenProject: (projectId: string) => void;
  onSignOut: () => void;
}

export function AdminOverviewScreen({ isLoading, projects, onBackHome, onOpenProject, onSignOut }: AdminOverviewScreenProps) {
  return (
    <main className="terminal-shell">
      <section className="terminal-screen terminal-screen--admin">
        <div className="terminal-block admin-screen__hero">
          <p className="terminal-path">silofire:/admin/hearts</p>
          <h1 className="terminal-title">Heart Analytics</h1>
          <p className="terminal-copy">Projects ranked by total hearts across all tracked nodes.</p>
          <div className="admin-screen__actions">
            <button type="button" className="terminal-link terminal-link--muted" onClick={onBackHome}>return/home</button>
            <button type="button" className="terminal-link terminal-link--muted" onClick={onSignOut}>sign/out</button>
          </div>
        </div>

        <div className="terminal-block admin-screen__list">
          <p className="terminal-label">Projects Ranked</p>
          {isLoading ? <p className="terminal-copy">Loading analytics…</p> : null}
          <ul className="terminal-list admin-screen__project-list">
            {projects.map((project, index) => (
              <li key={project.projectId} className="terminal-list__item terminal-list__item--project admin-screen__project-item">
                <div>
                  <p className="terminal-list__title">{index + 1}. {project.title}</p>
                  <p className="terminal-copy">project/{project.projectId}</p>
                </div>
                <div className="admin-screen__project-metrics">
                  <p className="terminal-copy terminal-copy--strong">hearts/{project.totalHearts}</p>
                  <p className="terminal-copy">nodes/{project.nodeCount}</p>
                  <button type="button" className="terminal-link" onClick={() => onOpenProject(project.projectId)}>
                    inspect/project
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

interface AdminProjectScreenProps {
  isLoading?: boolean;
  project?: RuntimeAdminProjectHeartDetails;
  onBackOverview: () => void;
  onResetHearts: () => void;
  onSignOut: () => void;
}

export function AdminProjectScreen({ isLoading, project, onBackOverview, onResetHearts, onSignOut }: AdminProjectScreenProps) {
  return (
    <main className="terminal-shell terminal-shell--project terminal-shell--admin-layout">
      <aside className="terminal-sidebar">
        <section className="terminal-block">
          <p className="terminal-path">silofire:/admin/hearts/{project?.projectId ?? 'project'}</p>
          <h1 className="terminal-title">{project?.title ?? 'Project Analytics'}</h1>
          <p className="terminal-copy">Website-level analytics and state inspection. No gameplay page links are exposed here.</p>
          <div className="terminal-block__actions">
            <button type="button" className="terminal-link terminal-link--muted" onClick={onBackOverview}>back/overview</button>
            <button type="button" className="terminal-link terminal-link--muted" onClick={onSignOut}>sign/out</button>
            <button type="button" className="terminal-link terminal-link--muted" onClick={onResetHearts}>reset/hearts</button>
          </div>
          {project ? <p className="terminal-copy terminal-copy--strong">total-hearts/{project.totalHearts}</p> : null}
        </section>

        {project ? (
          <section className="terminal-block">
            <p className="terminal-label">Node Heart Counts</p>
            <ul className="terminal-list terminal-list--presence admin-screen__metric-list">
              {project.nodes.map((node) => (
                <li key={node.nodeId} className="terminal-list__item terminal-list__item--presence">
                  <p className="terminal-copy terminal-copy--strong">{node.label}</p>
                  <p className="terminal-copy">node/{node.nodeId}</p>
                  <p className="terminal-copy">hearts/{node.heartCount}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>

      <section className="terminal-stage admin-screen__stage">
        <section className="terminal-screen terminal-screen--admin-stage">
          <div className="terminal-block admin-screen__detail-block">
            <p className="terminal-label">Current Node List</p>
            {isLoading ? <p className="terminal-copy">Loading project analytics…</p> : null}
            {project ? (
              <ul className="terminal-list admin-screen__node-list">
                {project.nodeList.map((node) => (
                  <li key={node.nodeId} className="terminal-list__item admin-screen__node-item">
                    <p className="terminal-copy terminal-copy--strong">{node.label}</p>
                    <p className="terminal-copy">node/{node.nodeId}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {project ? (
            <div className="admin-screen__state-grid">
              <ProjectStatePanes
                activeClock={project.activeClock ? {
                  nodeId: project.activeClock.nodeId,
                  calendarId: getOptionalStringValue(project.activeClock, 'calendarId'),
                  phase: project.activeClock.phase,
                  nowLabel: typeof project.activeClock.nowMs === 'number' ? new Date(project.activeClock.nowMs).toLocaleString() : undefined,
                  nextPhaseLabel: typeof getOptionalNumberValue(project.activeClock, 'nextPhaseInMs') === 'number'
                    ? `${Math.round((getOptionalNumberValue(project.activeClock, 'nextPhaseInMs') ?? 0) / 1000)}s`
                    : undefined,
                  source: project.activeClock.source,
                } : undefined}
                activeWeather={project.activeWeather ? {
                  kind: project.activeWeather.kind,
                  intensity: project.activeWeather.intensity,
                  patternId: project.activeWeather.patternId,
                  stepId: project.activeWeather.stepId,
                  regionId: project.activeWeather.regionId,
                  source: project.activeWeather.source,
                } : undefined}
                activeAmbientNpcs={project.activeAmbient?.npcs}
                sessionNpcStateById={project.sessionNpcStateById}
                sessionObjectStateById={project.sessionObjectStateById}
                selectedNodeId={project.activeClock?.nodeId}
              />
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function getOptionalStringValue(record: object, key: string): string | undefined {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function getOptionalNumberValue(record: object, key: string): number | undefined {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : undefined;
}