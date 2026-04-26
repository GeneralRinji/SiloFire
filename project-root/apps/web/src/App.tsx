import { createServerRuntimeClockSource, formatPreviewClockCountdown, formatRuntimeClockTimestamp } from './runtimeClock';
import { useEffect, useRef, useState } from 'react';

import type { ContentProjectRecord } from '../../../packages/content';
import type { ProjectedAction, ProjectedControl, ProjectionResult } from '../../../packages/projection/src';
import { findMatchingShortcut, isEditableTarget } from './keyboardShortcuts';
import { buildProjectedPageRenderKey } from './pageSelection';
import { buildProjectRouteState, type ProjectRouteState } from './projectSession';
import { createServerRuntimeAmbientSource, type RuntimeAmbientNpcSnapshot } from './runtimeAmbient';
import { applyRuntimeSessionAction, applyRuntimeSessionControl, createRuntimeSession, getRuntimeSession, resetRuntimeSession, type RuntimeSessionView } from './runtimeSessionApi';
import { createServerRuntimeWeatherSource, type RuntimeWeatherProjectSnapshot } from './runtimeWeather';
import { listRuntimeProjects } from './runtimeProjectApi';
import { HomeScreen } from './components/HomeScreen';
import { ProjectScreen, type ProjectNodeLink } from './components/ProjectScreen';

const SERVER_RUNTIME_CLOCK_SOURCE = createServerRuntimeClockSource();
const SERVER_RUNTIME_AMBIENT_SOURCE = createServerRuntimeAmbientSource();
const SERVER_RUNTIME_WEATHER_SOURCE = createServerRuntimeWeatherSource();

type AppRoute =
  | { kind: 'home' }
  | ProjectRouteState;

export function App() {
  const ambientNpcSnapshotsRef = useRef<Record<string, Record<string, RuntimeAmbientNpcSnapshot>>>({});
  const weatherSnapshotsRef = useRef<Record<string, RuntimeWeatherProjectSnapshot>>({});
  const projectMutationVersionRef = useRef<Record<string, number>>({});
  const [route, setRoute] = useState<AppRoute>({ kind: 'home' });
  const [projects, setProjects] = useState<ContentProjectRecord[]>([]);
  const [runtimeSessionViewsByProjectId, setRuntimeSessionViewsByProjectId] = useState<Record<string, RuntimeSessionView>>({});
  const [clockRevision, setClockRevision] = useState(0);

  function beginProjectMutation(projectId: string): number {
    const nextVersion = (projectMutationVersionRef.current[projectId] ?? 0) + 1;
    projectMutationVersionRef.current = {
      ...projectMutationVersionRef.current,
      [projectId]: nextVersion,
    };

    return nextVersion;
  }

  function isLatestProjectMutation(projectId: string, mutationVersion: number): boolean {
    return projectMutationVersionRef.current[projectId] === mutationVersion;
  }

  const projectId = route.kind === 'project' ? route.projectId : undefined;
  const activeRuntimeSessionView = projectId ? runtimeSessionViewsByProjectId[projectId] : undefined;
  const activeRuntimeSessionSnapshot = activeRuntimeSessionView?.snapshot;

  useEffect(() => {
    void listRuntimeProjects().then((nextProjects) => {
      setProjects(nextProjects);
    }).catch((error) => {
      console.error(error);
    });

    return () => {
      SERVER_RUNTIME_CLOCK_SOURCE.clear();
      SERVER_RUNTIME_AMBIENT_SOURCE.clear();
      SERVER_RUNTIME_WEATHER_SOURCE.clear();
    };
  }, []);

  useEffect(() => {
    if (route.kind !== 'project') {
      return undefined;
    }

    const activeNodeId = route.nodeId;
    const activeNodeRegion = activeNodeId ? activeRuntimeSessionView?.project?.nodeRegionsById?.[activeNodeId] : undefined;

    return SERVER_RUNTIME_CLOCK_SOURCE.subscribeProject(route.projectId, activeNodeId, activeNodeRegion, {
      onUpdate() {
        setClockRevision((current) => current + 1);
      },
      onError(error) {
        console.error(error);
      },
    });
  }, [route.kind, route.kind === 'project' ? route.projectId : undefined, route.kind === 'project' ? route.nodeId : undefined, activeRuntimeSessionView?.project]);

  useEffect(() => {
    if (route.kind !== 'project') {
      return undefined;
    }

    return SERVER_RUNTIME_WEATHER_SOURCE.subscribeProject(route.projectId, {
      onUpdate(snapshot) {
        weatherSnapshotsRef.current = {
          ...weatherSnapshotsRef.current,
          [route.projectId]: snapshot,
        };
        if (activeRuntimeSessionSnapshot?.projectId === route.projectId) {
          void refreshProjectSession(route.projectId, activeRuntimeSessionSnapshot.sessionId);
        }
        setClockRevision((current) => current + 1);
      },
      onError(error) {
        console.error(error);
      },
    });
  }, [route.kind, route.kind === 'project' ? route.projectId : undefined, activeRuntimeSessionSnapshot?.projectId, activeRuntimeSessionSnapshot?.sessionId]);

  useEffect(() => {
    if (route.kind !== 'project') {
      return undefined;
    }

    return SERVER_RUNTIME_AMBIENT_SOURCE.subscribeProject(route.projectId, {
      onUpdate(snapshot) {
        const nextSnapshots = Object.fromEntries(snapshot.npcs.map((npc) => [npc.id, npc]));

        ambientNpcSnapshotsRef.current = {
          ...ambientNpcSnapshotsRef.current,
          [route.projectId]: nextSnapshots,
        };

        if (activeRuntimeSessionSnapshot?.projectId === route.projectId) {
          void refreshProjectSession(route.projectId, activeRuntimeSessionSnapshot.sessionId);
        }

        setClockRevision((current) => current + 1);
      },
      onError(error) {
        console.error(error);
      },
    });
  }, [route.kind, route.kind === 'project' ? route.projectId : undefined, activeRuntimeSessionSnapshot?.projectId, activeRuntimeSessionSnapshot?.sessionId]);

  const currentNodeId = activeRuntimeSessionSnapshot?.route.nodeId ?? (route.kind === 'project' ? route.nodeId : undefined);
  const currentPathDirection = activeRuntimeSessionSnapshot?.route.pathDirection ?? (route.kind === 'project' ? route.pathDirection : undefined);
  const currentPathBeatIndex = activeRuntimeSessionSnapshot?.route.pathBeatIndex ?? (route.kind === 'project' ? route.pathBeatIndex : undefined);
  const currentRunNonce = activeRuntimeSessionSnapshot?.route.runNonce ?? (route.kind === 'project' ? route.runNonce : undefined);
  const currentAreaVisitCount = activeRuntimeSessionView?.currentAreaVisitCount;
  const currentPathVisitCount = activeRuntimeSessionView?.currentPathVisitCount;
  const project = projectId ? projects.find((item) => item.id === projectId) : undefined;
  const nodes = (activeRuntimeSessionView?.project?.nodes ?? []) as ProjectNodeLink[];
  const activeClock = projectId ? SERVER_RUNTIME_CLOCK_SOURCE.getSnapshot(projectId, currentNodeId) : undefined;
  const activeWeather = projectId && activeRuntimeSessionView?.project
    ? SERVER_RUNTIME_WEATHER_SOURCE.getSnapshot(
        {
          projectId,
          weatherSettings: activeRuntimeSessionView.project.weatherSettings,
          defaultWeather: activeRuntimeSessionView.project.defaultWeather,
          nodeRegionsById: activeRuntimeSessionView.project.nodeRegionsById,
        },
        currentNodeId,
        currentNodeId ? activeRuntimeSessionView.project.nodeRegionsById?.[currentNodeId] : undefined,
      )
    : undefined;
  const activeAmbientNpcs = projectId
    ? (Object.values(ambientNpcSnapshotsRef.current[projectId] ?? {}) as RuntimeAmbientNpcSnapshot[]).sort((left, right) => {
        const leftName = left.displayName ?? left.id;
        const rightName = right.displayName ?? right.id;
        return leftName.localeCompare(rightName);
      })
    : [];
  const currentSessionState = activeRuntimeSessionSnapshot?.sessionState;
  const sessionNpcStateById = currentSessionState?.npcs && typeof currentSessionState.npcs === 'object' && !Array.isArray(currentSessionState.npcs)
    ? Object.fromEntries(
        Object.entries(currentSessionState.npcs).map(([npcId, value]) => {
          const npcState = value && typeof value === 'object' && !Array.isArray(value)
            ? (value as { location?: unknown; behavior?: unknown })
            : undefined;

          return [npcId, {
            location: typeof npcState?.location === 'string' ? npcState.location : undefined,
            behavior: typeof npcState?.behavior === 'string' ? npcState.behavior : undefined,
          }];
        }),
      )
    : undefined;
  const sessionObjectStateById = currentSessionState?.objects && typeof currentSessionState.objects === 'object' && !Array.isArray(currentSessionState.objects)
    ? Object.fromEntries(
        Object.entries(currentSessionState.objects)
          .map(([objectId, value]) => {
            const objectState = value && typeof value === 'object' && !Array.isArray(value)
              ? (value as Record<string, unknown>)
              : undefined;
            const visibleFields = objectState
              ? Object.fromEntries(
                  Object.entries(objectState).filter(([, fieldValue]) => (
                    typeof fieldValue === 'string'
                    || typeof fieldValue === 'number'
                    || typeof fieldValue === 'boolean'
                  )),
                )
              : {};

            return [objectId, visibleFields];
          })
          .filter(([, objectState]) => Object.keys(objectState).length > 0),
      )
    : undefined;
  const selectedPage = activeRuntimeSessionView?.page;
  const offeredActions = activeRuntimeSessionView?.offeredActions ?? [];
  const fullyEffectiveSelectedPage = appendOfferedActions(selectedPage, offeredActions);
  const selectedPageRenderKey = buildProjectedPageRenderKey({
    projectId,
    nodeId: currentNodeId,
    pathDirection: currentPathDirection,
    areaVisitCount: currentAreaVisitCount,
    pathVisitCount: currentPathVisitCount,
    pathBeatIndex: currentPathBeatIndex,
    runNonce: currentRunNonce,
  });
  const selectedPageNavigationKey = selectedPageRenderKey;

  async function handleAction(action: ProjectedAction) {
    if (!projectId || !currentNodeId) {
      return;
    }

    if (activeRuntimeSessionSnapshot) {
      const mutationVersion = beginProjectMutation(projectId);
      const sessionView = await applyRuntimeSessionAction(activeRuntimeSessionSnapshot.sessionId, action);

      if (sessionView && isLatestProjectMutation(projectId, mutationVersion)) {
        applyRuntimeSessionView(projectId, sessionView);
      }

      return;
    }

    console.error(`Missing runtime session while handling action ${action.id} for project ${projectId}.`);
  }

  async function handleControl(control: ProjectedControl) {
    if (!projectId || !currentNodeId) {
      return;
    }

    if (activeRuntimeSessionSnapshot) {
      const mutationVersion = beginProjectMutation(projectId);
      const sessionView = await applyRuntimeSessionControl(activeRuntimeSessionSnapshot.sessionId, control);

      if (sessionView && isLatestProjectMutation(projectId, mutationVersion)) {
        applyRuntimeSessionView(projectId, sessionView);
      }

      return;
    }

    console.error(`Missing runtime session while handling control ${control.id} for project ${projectId}.`);
  }

  useEffect(() => {
    if (route.kind !== 'project') {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) {
        return;
      }

      const match = findMatchingShortcut(selectedPage, event.key);
      const effectiveMatch = findMatchingShortcut(fullyEffectiveSelectedPage, event.key);

      if (!effectiveMatch) {
        return;
      }

      if (effectiveMatch.kind === 'action') {
        void handleAction(effectiveMatch.action);
      } else {
        void handleControl(effectiveMatch.control);
      }

      event.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [route.kind, fullyEffectiveSelectedPage, projectId, currentNodeId, currentPathDirection]);

  function applyRuntimeSessionView(projectId: string, sessionView: RuntimeSessionView) {
    setRuntimeSessionViewsByProjectId((current) => ({
      ...current,
      [projectId]: sessionView,
    }));
    setRoute(
      buildProjectRouteState(
        projectId,
        sessionView.snapshot.route,
        route.kind === 'project' && route.projectId === projectId ? route : undefined,
      ),
    );
  }

  async function refreshProjectSession(projectId: string, sessionId: string) {
    const mutationVersion = beginProjectMutation(projectId);
    const sessionView = await getRuntimeSession(sessionId);

    if (sessionView && isLatestProjectMutation(projectId, mutationVersion)) {
      applyRuntimeSessionView(projectId, sessionView);
    }
  }

  async function openProjectSession(nextProjectId: string, nodeId?: string) {
    const mutationVersion = beginProjectMutation(nextProjectId);
    const sessionView = await createRuntimeSession(nextProjectId, { nodeId });

    if (!sessionView || !isLatestProjectMutation(nextProjectId, mutationVersion)) {
      console.error(`Unable to open runtime session for project ${nextProjectId}.`);
      return;
    }

    applyRuntimeSessionView(nextProjectId, sessionView);
  }

  if (route.kind === 'home') {
    return (
      <HomeScreen
        projects={projects}
        onEnterProject={(nextProjectId) => {
          void openProjectSession(nextProjectId);
        }}
      />
    );
  }

  if (!project || !projectId) {
    return (
      <HomeScreen
        projects={projects}
        onEnterProject={(nextProjectId) => void openProjectSession(nextProjectId)}
      />
    );
  }

  return (
    <ProjectScreen
      project={project}
      nodes={nodes}
      activeClock={activeClock ? {
        nodeId: currentNodeId,
        calendarId: getOptionalStringValue(activeClock, 'calendarId'),
        phase: activeClock.phase,
        nowLabel: formatRuntimeClockTimestamp(activeClock.nowMs),
        nextPhaseLabel: formatPreviewClockCountdown(getOptionalNumberValue(activeClock, 'nextPhaseInMs')),
        source: activeClock.source,
      } : undefined}
      activeWeather={activeWeather ? {
        kind: activeWeather.kind,
        intensity: activeWeather.intensity,
        patternId: activeWeather.patternId,
        stepId: activeWeather.stepId,
        regionId: activeWeather.regionId,
        source: activeWeather.source,
      } : undefined}
      activeAmbientNpcs={activeAmbientNpcs}
      sessionNpcStateById={sessionNpcStateById}
      sessionObjectStateById={sessionObjectStateById}
      selectedNodeId={currentNodeId}
      selectedPage={fullyEffectiveSelectedPage}
      selectedPageRenderKey={selectedPageRenderKey}
      selectedPageNavigationKey={selectedPageNavigationKey}
      onBackHome={() => setRoute({ kind: 'home' })}
      onResetRun={() => {
        if (!projectId || !activeRuntimeSessionSnapshot) {
          return;
        }

        const mutationVersion = beginProjectMutation(projectId);

        void resetRuntimeSession(activeRuntimeSessionSnapshot.sessionId).then((sessionView) => {
          if (sessionView && isLatestProjectMutation(projectId, mutationVersion)) {
            applyRuntimeSessionView(projectId, sessionView);
            return;
          }

          if (isLatestProjectMutation(projectId, mutationVersion)) {
            console.error(`Unable to reset runtime session for project ${projectId}.`);
          }
        });
      }}
      onSelectNode={(nodeId) => {
        void openProjectSession(projectId, nodeId);
      }}
      onAction={(action) => {
        void handleAction(action);
      }}
      onControl={(control) => {
        void handleControl(control);
      }}
    />
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

function appendOfferedActions(
  page: ProjectionResult | undefined,
  offeredActions: ProjectedAction[],
): ProjectionResult | undefined {
  if (!page || page.kind !== 'page' || offeredActions.length === 0) {
    return page;
  }

  const existingActionIds = new Set(page.actions.map((action) => action.id));
  const nextOfferedActions = offeredActions.filter((action) => !existingActionIds.has(action.id));

  if (nextOfferedActions.length === 0) {
    return page;
  }

  return {
    ...page,
    actions: [...page.actions, ...nextOfferedActions],
  };
}
