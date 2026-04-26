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
import { getRuntimeAdminHeartProject, listRuntimeAdminHeartOverview, resetRuntimeAdminHeartProject } from './runtimeAdminApi';
import { setRuntimeHeart } from './runtimeHeartApi';
import { listRuntimeProjects } from './runtimeProjectApi';
import { AdminGateScreen, AdminOverviewScreen, AdminProjectScreen } from './components/AdminScreen';
import { HomeScreen } from './components/HomeScreen';
import { ProjectScreen, type ProjectNodeLink } from './components/ProjectScreen';
import type { RuntimeAdminProjectHeartDetails, RuntimeAdminProjectHeartSummary } from '../../../packages/runtime-server/src';

const SERVER_RUNTIME_CLOCK_SOURCE = createServerRuntimeClockSource();
const SERVER_RUNTIME_AMBIENT_SOURCE = createServerRuntimeAmbientSource();
const SERVER_RUNTIME_WEATHER_SOURCE = createServerRuntimeWeatherSource();
const ADMIN_PASSWORD_STORAGE_KEY = 'silofire.admin.password';
const IS_LOCAL_DEV = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const SHOW_PUBLIC_PROJECT_NODE_LIST = IS_LOCAL_DEV;
const SHOW_PUBLIC_PROJECT_STATE_PANES = IS_LOCAL_DEV;
const ADMIN_REFRESH_INTERVAL_MS = 5000;

type AppRoute =
  | { kind: 'home' }
  | { kind: 'admin_overview' }
  | { kind: 'admin_project'; projectId: string }
  | ProjectRouteState;

type AppHistoryState = {
  silofireRoute?: AppRoute;
};

export function App() {
  const ambientNpcSnapshotsRef = useRef<Record<string, Record<string, RuntimeAmbientNpcSnapshot>>>({});
  const weatherSnapshotsRef = useRef<Record<string, RuntimeWeatherProjectSnapshot>>({});
  const projectMutationVersionRef = useRef<Record<string, number>>({});
  const [route, setRouteState] = useState<AppRoute>(() => readInitialAppRoute());
  const [projects, setProjects] = useState<ContentProjectRecord[]>([]);
  const [runtimeSessionViewsByProjectId, setRuntimeSessionViewsByProjectId] = useState<Record<string, RuntimeSessionView>>({});
  const [clockRevision, setClockRevision] = useState(0);
  const [adminPassword, setAdminPassword] = useState<string | undefined>(() => readStoredAdminPassword());
  const [adminGateErrorText, setAdminGateErrorText] = useState<string | undefined>();
  const [adminOverview, setAdminOverview] = useState<RuntimeAdminProjectHeartSummary[]>([]);
  const [adminProjectDetailsById, setAdminProjectDetailsById] = useState<Record<string, RuntimeAdminProjectHeartDetails>>({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminRevision, setAdminRevision] = useState(0);

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
    if (typeof window === 'undefined') {
      return undefined;
    }

    const onPopState = () => {
      setRouteState(readInitialAppRoute());
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
    if (!isAdminRoute(route) || !adminPassword) {
      return;
    }

    let canceled = false;
    const hasCachedAdminData = route.kind === 'admin_project'
      ? Boolean(adminProjectDetailsById[route.projectId])
      : adminOverview.length > 0;

    setAdminLoading(!hasCachedAdminData);

    void listRuntimeAdminHeartOverview(adminPassword).then(async (overviewResult) => {
      if (canceled) {
        return;
      }

      if (overviewResult.kind === 'unauthorized') {
        clearStoredAdminPassword();
        setAdminPassword(undefined);
        setAdminGateErrorText('Password rejected by server.');
        setAdminLoading(false);
        return;
      }

      if (overviewResult.kind !== 'ok') {
        setAdminGateErrorText('Unable to load admin analytics.');
        setAdminLoading(false);
        return;
      }

      setAdminOverview(overviewResult.value);

      if (route.kind !== 'admin_project') {
        setAdminLoading(false);
        return;
      }

      const detailResult = await getRuntimeAdminHeartProject(route.projectId, adminPassword);

      if (canceled) {
        return;
      }

      if (detailResult.kind === 'unauthorized') {
        clearStoredAdminPassword();
        setAdminPassword(undefined);
        setAdminGateErrorText('Password rejected by server.');
        setAdminLoading(false);
        return;
      }

      if (detailResult.kind === 'ok') {
        setAdminProjectDetailsById((current) => ({
          ...current,
          [route.projectId]: detailResult.value,
        }));
      }

      setAdminLoading(false);
    }).catch((error) => {
      console.error(error);
      if (!canceled) {
        setAdminGateErrorText('Unable to load admin analytics.');
        setAdminLoading(false);
      }
    });

    return () => {
      canceled = true;
    };
  }, [
    route.kind,
    route.kind === 'admin_project' ? route.projectId : undefined,
    adminPassword,
    adminRevision,
    adminOverview.length,
    route.kind === 'admin_project' ? adminProjectDetailsById[route.projectId] : undefined,
  ]);

  useEffect(() => {
    if (!isAdminRoute(route) || !adminPassword) {
      return;
    }

    const interval = window.setInterval(() => {
      setAdminRevision((current) => current + 1);
    }, ADMIN_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [route.kind, route.kind === 'admin_project' ? route.projectId : undefined, adminPassword]);

  useEffect(() => {
    if (route.kind !== 'project') {
      return;
    }

    const existingSessionView = runtimeSessionViewsByProjectId[route.projectId];

    if (existingSessionView) {
      return;
    }

    void openProjectSession(route.projectId, route.nodeId);
  }, [route.kind, route.kind === 'project' ? route.projectId : undefined, route.kind === 'project' ? route.nodeId : undefined, runtimeSessionViewsByProjectId]);

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
    applyAppRoute(
      buildProjectRouteState(
        projectId,
        sessionView.snapshot.route,
        route.kind === 'project' && route.projectId === projectId ? route : undefined,
      ),
      'replace',
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

  function applyAppRoute(nextRoute: AppRoute, historyMode: 'push' | 'replace' = 'push') {
    setRouteState(nextRoute);
    syncBrowserRoute(nextRoute, historyMode);
  }

  async function authenticateAdmin(password: string) {
    const trimmedPassword = password.trim();

    if (trimmedPassword.length === 0) {
      setAdminGateErrorText('Enter the shared admin password.');
      return;
    }

    setAdminLoading(true);
    const overviewResult = await listRuntimeAdminHeartOverview(trimmedPassword);

    if (overviewResult.kind === 'ok') {
      setAdminPassword(trimmedPassword);
      writeStoredAdminPassword(trimmedPassword);
      setAdminGateErrorText(undefined);
      setAdminOverview(overviewResult.value);
      setAdminRevision((current) => current + 1);
      setAdminLoading(false);
      return;
    }

    setAdminLoading(false);
    setAdminGateErrorText(overviewResult.kind === 'unauthorized' ? 'Password rejected by server.' : 'Unable to reach admin analytics.');
  }

  function signOutAdmin() {
    clearStoredAdminPassword();
    setAdminPassword(undefined);
    setAdminGateErrorText(undefined);
    setAdminOverview([]);
    setAdminProjectDetailsById({});
    applyAppRoute({ kind: 'admin_overview' }, 'replace');
  }

  async function handleAdminHeartReset(projectId: string) {
    if (!adminPassword) {
      return;
    }

    const result = await resetRuntimeAdminHeartProject(projectId, adminPassword);

    if (result.kind === 'unauthorized') {
      signOutAdmin();
      setAdminGateErrorText('Password rejected by server.');
      return;
    }

    if (result.kind === 'ok') {
      setAdminRevision((current) => current + 1);
    }
  }

  async function handlePublicHeart(projectId: string, nodeId: string, nextActive: boolean): Promise<boolean> {
    return Boolean(await setRuntimeHeart(projectId, nodeId, nextActive));
  }

  if (isAdminRoute(route)) {
    if (!adminPassword) {
      return (
        <AdminGateScreen
          errorText={adminGateErrorText}
          onBackHome={() => applyAppRoute({ kind: 'home' })}
          onUnlock={(password) => {
            void authenticateAdmin(password);
          }}
        />
      );
    }

    if (route.kind === 'admin_project') {
      return (
        <AdminProjectScreen
          isLoading={adminLoading}
          project={adminProjectDetailsById[route.projectId]}
          onBackOverview={() => applyAppRoute({ kind: 'admin_overview' })}
          onOpenNode={(nodeId) => {
            void openProjectSession(route.projectId, nodeId);
          }}
          onResetHearts={() => {
            void handleAdminHeartReset(route.projectId);
          }}
          onSignOut={signOutAdmin}
        />
      );
    }

    return (
      <AdminOverviewScreen
        isLoading={adminLoading}
        projects={adminOverview}
        onBackHome={() => applyAppRoute({ kind: 'home' })}
        onOpenProject={(projectId) => applyAppRoute({ kind: 'admin_project', projectId })}
        onSignOut={signOutAdmin}
      />
    );
  }

  if (route.kind === 'home') {
    return (
      <HomeScreen
        onEnterAdmin={() => applyAppRoute({ kind: 'admin_overview' })}
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
        onEnterAdmin={() => applyAppRoute({ kind: 'admin_overview' })}
        projects={projects}
        onEnterProject={(nextProjectId) => void openProjectSession(nextProjectId)}
      />
    );
  }

  return (
    <ProjectScreen
      project={project}
      nodes={nodes}
      showNodeList={SHOW_PUBLIC_PROJECT_NODE_LIST}
      showStatePanes={SHOW_PUBLIC_PROJECT_STATE_PANES}
      selectedNodeId={currentNodeId}
      selectedPage={fullyEffectiveSelectedPage}
      selectedPageRenderKey={selectedPageRenderKey}
      selectedPageNavigationKey={selectedPageNavigationKey}
      activeClock={activeClock ? {
        nodeId: currentNodeId,
        calendarId: activeClock.calendarId,
        phase: activeClock.phase,
        nowLabel: formatRuntimeClockTimestamp(activeClock.nowMs),
        nextPhaseLabel: formatPreviewClockCountdown(activeClock.nextPhaseInMs),
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
      onBackHome={() => applyAppRoute({ kind: 'home' })}
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
      onHeartNode={(nodeId, nextActive) => handlePublicHeart(projectId, nodeId, nextActive)}
      onAction={(action) => {
        void handleAction(action);
      }}
      onControl={(control) => {
        void handleControl(control);
      }}
    />
  );
}

function isAdminRoute(route: AppRoute): route is Extract<AppRoute, { kind: 'admin_overview' | 'admin_project' }> {
  return route.kind === 'admin_overview' || route.kind === 'admin_project';
}

function readInitialAppRoute(): AppRoute {
  if (typeof window === 'undefined') {
    return { kind: 'home' };
  }

  return readAppRouteFromLocation(window.location.pathname, window.history.state);
}

export function readAppRouteFromLocation(pathname: string, historyState: unknown): AppRoute {
  const storedRoute = readStoredAppRoute(historyState);

  if (storedRoute) {
    return storedRoute;
  }

  return parseAppRoutePath(pathname);
}

function parseAppRoutePath(pathname: string): AppRoute {
  const projectNodeMatch = /^\/projects\/([^/]+)\/nodes\/([^/]+)\/?$/.exec(pathname);

  if (projectNodeMatch) {
    return buildProjectRouteState(decodeURIComponent(projectNodeMatch[1]), {
      nodeId: decodeURIComponent(projectNodeMatch[2]),
      runNonce: 0,
    });
  }

  const projectMatch = /^\/projects\/([^/]+)\/?$/.exec(pathname);

  if (projectMatch) {
    return buildProjectRouteState(decodeURIComponent(projectMatch[1]), {
      runNonce: 0,
    });
  }

  const adminProjectMatch = /^\/admin\/projects\/([^/]+)\/?$/.exec(pathname);

  if (adminProjectMatch) {
    return {
      kind: 'admin_project',
      projectId: decodeURIComponent(adminProjectMatch[1]),
    };
  }

  if (/^\/admin\/?$/.test(pathname)) {
    return { kind: 'admin_overview' };
  }

  return { kind: 'home' };
}

function syncBrowserRoute(route: AppRoute, historyMode: 'push' | 'replace'): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nextPath = buildVisibleBrowserPath(route);
  const nextState: AppHistoryState = {
    silofireRoute: route,
  };

  if (window.location.pathname === nextPath && areRoutesEquivalent(readStoredAppRoute(window.history.state), route)) {
    return;
  }

  if (historyMode === 'replace') {
    window.history.replaceState(nextState, '', nextPath);
    return;
  }

  window.history.pushState(nextState, '', nextPath);
}

export function buildVisibleBrowserPath(route: AppRoute): string {
  return route.kind === 'admin_project'
    ? `/admin/projects/${encodeURIComponent(route.projectId)}`
    : route.kind === 'admin_overview'
      ? '/admin'
      : '/';
}

function readStoredAppRoute(historyState: unknown): AppRoute | undefined {
  const route = (historyState as AppHistoryState | null | undefined)?.silofireRoute;

  if (!route || typeof route !== 'object') {
    return undefined;
  }

  if (route.kind === 'home' || route.kind === 'admin_overview') {
    return route;
  }

  if (route.kind === 'admin_project' && typeof route.projectId === 'string') {
    return route;
  }

  if (route.kind === 'project' && typeof route.projectId === 'string' && typeof route.runNonce === 'number') {
    return route;
  }

  return undefined;
}

function areRoutesEquivalent(left: AppRoute | undefined, right: AppRoute): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readStoredAdminPassword(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const value = window.sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY);
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeStoredAdminPassword(password: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, password);
  } catch {
    // Ignore storage failures for the temporary admin gate.
  }
}

function clearStoredAdminPassword(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
  } catch {
    // Ignore storage failures for the temporary admin gate.
  }
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
