import { useEffect, useState } from 'react';
import type { ContentProjectRecord } from '../../../../packages/content';
import type { ProjectedAction, ProjectedControl, ProjectionResult } from '../../../../packages/projection/src';
import { ProjectedPageView } from '../../../../packages/renderer-react/src/components/ProjectedPageView';
import { PublicHeartPane } from './PublicHeartPane';
import { ProjectStatePanes } from './ProjectStatePanes';

const HEART_UI_STORAGE_KEY = 'silofire.publicHearts';

export interface ProjectNodeLink {
  id: string;
  label: string;
}

interface ProjectScreenProps {
  project: ContentProjectRecord;
  nodes: ProjectNodeLink[];
  showNodeList?: boolean;
  showStatePanes?: boolean;
  selectedNodeId?: string;
  selectedPage?: ProjectionResult;
  selectedPageRenderKey?: string;
  selectedPageNavigationKey?: string;
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
  activeAmbientNpcs?: Array<{
    id: string;
    displayName?: string;
    nodeId?: string;
    previousNodeId?: string;
    nextNodeId?: string;
    behavior?: string;
  }>;
  sessionNpcStateById?: Record<string, {
    location?: string;
    behavior?: string;
  }>;
  sessionObjectStateById?: Record<string, Record<string, string | number | boolean>>;
  onBackHome: () => void;
  onResetRun?: () => void;
  onHeartNode?: (nodeId: string, nextActive: boolean) => Promise<boolean>;
  onSelectNode: (nodeId: string) => void;
  onAction?: (action: ProjectedAction) => void;
  onControl?: (control: ProjectedControl) => void;
}

export function ProjectScreen({
  project,
  nodes,
  showNodeList = true,
  showStatePanes = false,
  selectedNodeId,
  selectedPage,
  selectedPageRenderKey,
  selectedPageNavigationKey,
  activeClock,
  activeWeather,
  activeAmbientNpcs,
  sessionNpcStateById,
  sessionObjectStateById,
  onBackHome,
  onResetRun,
  onHeartNode,
  onSelectNode,
  onAction,
  onControl,
}: ProjectScreenProps) {
  const [isHeartSaving, setIsHeartSaving] = useState(false);
  const [activeHeartNodeIds, setActiveHeartNodeIds] = useState<Record<string, boolean>>(() => readStoredHeartNodeIds());

  const activeHeartKey = selectedNodeId ? `${project.id}:${selectedNodeId}` : undefined;
  const isHeartActive = activeHeartKey ? Boolean(activeHeartNodeIds[activeHeartKey]) : false;

  useEffect(() => {
    setIsHeartSaving(false);
  }, [project.id, selectedNodeId]);

  useEffect(() => {
    writeStoredHeartNodeIds(activeHeartNodeIds);
  }, [activeHeartNodeIds]);

  async function handleHeart() {
    if (!selectedNodeId || !onHeartNode || !activeHeartKey || isHeartSaving) {
      return;
    }

    const nextActive = !Boolean(activeHeartNodeIds[activeHeartKey]);

    setIsHeartSaving(true);
    const didSave = await onHeartNode(selectedNodeId, nextActive);
    setIsHeartSaving(false);

    if (!didSave) {
      return;
    }

    setActiveHeartNodeIds((current) => ({
      ...current,
      [activeHeartKey]: nextActive,
    }));
  }

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

        {showNodeList ? (
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
        ) : null}

        {showStatePanes ? (
          <div className="terminal-sidebar__debug-panes">
            <ProjectStatePanes
              activeClock={activeClock}
              activeWeather={activeWeather}
              activeAmbientNpcs={activeAmbientNpcs}
              sessionNpcStateById={sessionNpcStateById}
              sessionObjectStateById={sessionObjectStateById}
              selectedNodeId={selectedNodeId}
            />
          </div>
        ) : null}
      </aside>

      <section className="terminal-stage">
        {selectedPage ? (
          <ProjectedPageView
            key={selectedPageRenderKey}
            page={selectedPage}
            navigationKey={selectedPageNavigationKey}
            footerPane={selectedNodeId && onHeartNode ? <PublicHeartPane active={isHeartActive} isSaving={isHeartSaving} onHeart={() => void handleHeart()} /> : undefined}
            onAction={onAction}
            onControl={onControl}
          />
        ) : (
          <section className="terminal-screen terminal-screen--empty">
            <div className="terminal-block">
              <p className="terminal-path">silofire:/{project.folderName}/index</p>
              <p className="terminal-copy">
                {showNodeList && nodes.length > 0 ? 'Select a node from the left.' : 'This project folder exists, but nothing has been authored for the web shell yet.'}
              </p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function readStoredHeartNodeIds(): Record<string, boolean> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.sessionStorage.getItem(HEART_UI_STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsedValue).filter(([, value]) => typeof value === 'boolean'),
    ) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeStoredHeartNodeIds(activeHeartNodeIds: Record<string, boolean>): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(HEART_UI_STORAGE_KEY, JSON.stringify(activeHeartNodeIds));
  } catch {
    // Ignore storage failures for this client-only analytics toggle memory.
  }
}