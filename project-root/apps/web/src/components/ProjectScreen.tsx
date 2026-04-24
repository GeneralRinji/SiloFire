import type { ContentProjectRecord } from '../../../../packages/content';
import type { ProjectedAction, ProjectedControl, ProjectionResult } from '../../../../packages/projection/src';
import type { RuntimeAmbientNpcSnapshot } from '../runtimeAmbient';
import { ProjectedPageView } from '../../../../packages/renderer-react/src/components/ProjectedPageView';

export interface ProjectNodeLink {
  id: string;
  label: string;
}

interface ProjectScreenProps {
  project: ContentProjectRecord;
  nodes: ProjectNodeLink[];
  activeClock?: {
    nodeId?: string;
    calendarId?: string;
    phase?: string;
    nowLabel?: string;
    nextPhaseLabel?: string;
    source?: string;
  };
  activeWeather?: {
    kind?: string;
    intensity?: string;
    patternId?: string;
    stepId?: string;
    regionId?: string;
    source?: string;
  };
  activeAmbientNpcs?: RuntimeAmbientNpcSnapshot[];
  sessionNpcStateById?: Record<string, {
    location?: string;
    behavior?: string;
  }>;
  sessionObjectStateById?: Record<string, Record<string, string | number | boolean>>;
  selectedNodeId?: string;
  selectedPage?: ProjectionResult;
  selectedPageRenderKey?: string;
  selectedPageNavigationKey?: string;
  onBackHome: () => void;
  onResetRun?: () => void;
  onSelectNode: (nodeId: string) => void;
  onAction?: (action: ProjectedAction) => void;
  onControl?: (control: ProjectedControl) => void;
}

export function ProjectScreen({
  project,
  nodes,
  activeClock,
  activeWeather,
  activeAmbientNpcs,
  sessionNpcStateById,
  sessionObjectStateById,
  selectedNodeId,
  selectedPage,
  selectedPageRenderKey,
  selectedPageNavigationKey,
  onBackHome,
  onResetRun,
  onSelectNode,
  onAction,
  onControl,
}: ProjectScreenProps) {
  const ambientNpcsHere = activeAmbientNpcs?.filter((npc) => selectedNodeId !== undefined && npc.nodeId === selectedNodeId) ?? [];
  const ambientNpcById: Record<string, RuntimeAmbientNpcSnapshot> = Object.fromEntries((activeAmbientNpcs ?? []).map((npc) => [npc.id, npc]));
  const objectDebugIds = Object.keys(sessionObjectStateById ?? {}).sort((left, right) => left.localeCompare(right));
  const ambientDebugNpcIds = Array.from(new Set([
    ...Object.keys(ambientNpcById),
    ...Object.keys(sessionNpcStateById ?? {}),
  ])).sort((left, right) => {
    const leftName = ambientNpcById[left]?.displayName ?? left;
    const rightName = ambientNpcById[right]?.displayName ?? right;
    return leftName.localeCompare(rightName);
  });

  return (
    <main className="terminal-shell terminal-shell--project">
      <aside className="terminal-sidebar">
        <section className="terminal-block">
          <p className="terminal-path">silofire:/{project.folderName}</p>
          <h1 className="terminal-title">{project.title}</h1>
          <p className="terminal-copy">{project.description}</p>
          <div className="terminal-block__actions">
            <button type="button" className="terminal-link terminal-link--muted" onClick={onBackHome}>
              return/home
            </button>
            {onResetRun ? (
              <button type="button" className="terminal-link terminal-link--muted" onClick={onResetRun}>
                reset/run
              </button>
            ) : null}
          </div>
        </section>

        <section className="terminal-block">
          <p className="terminal-label">Nodes</p>

          {nodes.length === 0 ? <p className="terminal-copy">No pages wired yet.</p> : null}

          {nodes.length > 0 ? (
            <ul className="terminal-list">
              {nodes.map((node) => (
                <li key={node.id} className="terminal-list__item">
                  <button
                    type="button"
                    className={selectedNodeId === node.id ? 'terminal-link terminal-link--active' : 'terminal-link'}
                    onClick={() => onSelectNode(node.id)}
                  >
                    open/{node.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        {activeClock?.phase ? (
          <section className="terminal-block">
            <p className="terminal-label">Time</p>
            <p className="terminal-copy terminal-copy--strong">phase/{activeClock.phase}</p>
            {activeClock.nodeId ? <p className="terminal-copy">selected-node/{activeClock.nodeId}</p> : null}
            {activeClock.calendarId ? <p className="terminal-copy">calendar/{activeClock.calendarId}</p> : null}
            {activeClock.nowLabel ? <p className="terminal-copy">server-now/{activeClock.nowLabel}</p> : null}
            {activeClock.nextPhaseLabel ? <p className="terminal-copy">next-phase/{activeClock.nextPhaseLabel}</p> : null}
            {activeClock.source ? <p className="terminal-copy">server-source/{activeClock.source}</p> : null}
          </section>
        ) : null}

        {activeWeather?.kind || activeWeather?.patternId ? (
          <section className="terminal-block">
            <p className="terminal-label">Weather</p>
            <p className="terminal-copy terminal-copy--strong">kind/{activeWeather.kind ?? 'unknown'}</p>
            {activeWeather.intensity ? <p className="terminal-copy">intensity/{activeWeather.intensity}</p> : null}
            {activeWeather.regionId ? <p className="terminal-copy">assigned-region/{activeWeather.regionId}</p> : null}
            {activeWeather.patternId ? <p className="terminal-copy">pattern-id/{activeWeather.patternId}</p> : null}
            {activeWeather.stepId ? <p className="terminal-copy">step-id/{activeWeather.stepId}</p> : null}
            {activeWeather.source ? <p className="terminal-copy">server-source/{activeWeather.source}</p> : null}
          </section>
        ) : null}

        {ambientDebugNpcIds.length > 0 ? (
          <section className="terminal-block">
            <p className="terminal-label">Ambient</p>
            {selectedNodeId ? (
              <>
                <p className="terminal-copy terminal-copy--strong">here/{ambientNpcsHere.length > 0 ? ambientNpcsHere.map((npc) => npc.displayName ?? npc.id).join(', ') : 'none'}</p>
                <p className="terminal-copy">selected-node/{selectedNodeId}</p>
              </>
            ) : null}
            <ul className="terminal-list terminal-list--presence">
              {ambientDebugNpcIds.map((npcId) => {
                const npc = ambientNpcById[npcId];
                const sessionNpcState = sessionNpcStateById?.[npcId];
                const isHere = selectedNodeId !== undefined && npc?.nodeId === selectedNodeId;
                const locationLabel = npc?.nodeId
                  ? `live-node/${npc.nodeId}`
                  : npc
                    ? `live-route/${npc.previousNodeId ?? 'unknown'} -> ${npc.nextNodeId ?? 'unknown'}`
                    : 'live-snapshot/pending';

                return (
                  <li key={npcId} className="terminal-list__item terminal-list__item--presence">
                    <p className="terminal-copy terminal-copy--strong">
                      {npc?.displayName ?? npcId}
                      {isHere ? ' [here]' : ''}
                    </p>
                    <p className="terminal-copy">
                      {locationLabel}
                    </p>
                    <p className="terminal-copy">
                      server-session-location/{sessionNpcState?.location ?? 'none'}
                    </p>
                    <p className="terminal-copy">
                      {npc?.behavior
                        ? `live-movement-state/${npc.behavior}`
                        : `server-session-behavior/${sessionNpcState?.behavior ?? 'none'}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {objectDebugIds.length > 0 ? (
          <section className="terminal-block">
            <p className="terminal-label">Objects</p>
            <ul className="terminal-list terminal-list--presence">
              {objectDebugIds.map((objectId) => {
                const objectState = sessionObjectStateById?.[objectId] ?? {};
                const fieldEntries = Object.entries(objectState);

                return (
                  <li key={objectId} className="terminal-list__item terminal-list__item--presence">
                    <p className="terminal-copy terminal-copy--strong">{objectId}</p>
                    {fieldEntries.map(([fieldName, fieldValue]) => (
                      <p key={fieldName} className="terminal-copy">
                        {fieldName}/{String(fieldValue)}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </aside>

      <section className="terminal-stage">
        {selectedPage ? (
          <ProjectedPageView
            key={selectedPageRenderKey}
            page={selectedPage}
            navigationKey={selectedPageNavigationKey}
            onAction={onAction}
            onControl={onControl}
          />
        ) : (
          <section className="terminal-screen terminal-screen--empty">
            <div className="terminal-block">
              <p className="terminal-path">silofire:/{project.folderName}/index</p>
              <p className="terminal-copy">
                {nodes.length > 0 ? 'Select a node from the left.' : 'This project folder exists, but nothing has been authored for the web shell yet.'}
              </p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}