import { createServerRuntimeClockSource, formatPreviewClockCountdown, formatRuntimeClockTimestamp } from './runtimeClock';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { buildContentProjectRecord } from '../../../packages/content';
import { CONTENT_PROJECT_METADATA_BY_ID } from '../../../packages/content';
import { isContentProjectAvailable } from '../../../packages/content';
import type { ContentProjectRecord } from '../../../packages/content';
import type { ProjectedAction, ProjectedControl, ProjectedLogEntry, ProjectionResult } from '../../../packages/projection/src';
import type { PathDirection } from '../../../packages/schema/src';
import type { RuntimeSessionObject, RuntimeSessionState } from './contentRuntimeCore';
import { PROJECT_RUNTIME, appendRecentLog, createInitialProjectSessionState, getOfferedActions, getProjectedPage, getRuntimeClockSnapshot, resolveProjectAction, resolveProjectControl, resolveProjectEnter, setRuntimeClockSource, setRuntimeWeatherSource } from './contentRuntime';
import { findMatchingShortcut, isEditableTarget } from './keyboardShortcuts';
import { buildProjectedPageRenderKey, createStableProjectedPageResolver } from './pageSelection';
import { buildProjectRouteState, collectProjectNodeIds, replaceProjectNodeScopedEntries, selectProjectNodeScopedEntries, type ProjectRouteState } from './projectSession';
import { appendLogEntry, createRecentLogEntries, type AppRecentLogEntry } from './recentLog';
import { createServerRuntimeAmbientSource, type RuntimeAmbientNpcSnapshot } from './runtimeAmbient';
import { buildRuntimeWeatherLogEntry, createServerRuntimeWeatherSource, shouldAnnounceWeather, shouldAnnounceWeatherChange, type RuntimeWeatherProjectSnapshot, type RuntimeWeatherSnapshot } from './runtimeWeather';
import { resolveObservedPhaseChange } from './phaseEntry';
import {
  clearProjectSnapshot,
  createSaveGameSnapshot,
  formatProjectSnapshotSummary,
  hasProjectSnapshot,
  loadProjectSnapshot,
  saveProjectSnapshot,
  shouldClearProjectSnapshotOnReset,
  shouldSaveProjectSnapshot,
} from './saveState';
import { HomeScreen } from './components/HomeScreen';
import { ProjectScreen, type ProjectNodeLink } from './components/ProjectScreen';

const TITLE_SCREEN_NODE_ID = 'title_screen';
const TITLE_SCREEN_NEW_GAME_ACTION_ID = 'title_screen_new_game';
const TITLE_SCREEN_CONTINUE_ACTION_ID = 'title_screen_continue';
const SERVER_RUNTIME_CLOCK_SOURCE = createServerRuntimeClockSource();
const SERVER_RUNTIME_AMBIENT_SOURCE = createServerRuntimeAmbientSource();
const SERVER_RUNTIME_WEATHER_SOURCE = createServerRuntimeWeatherSource();

type AppRoute =
  | { kind: 'home' }
  | ProjectRouteState;

type ReplaceProjectRunStateInput = {
  route: {
    nodeId?: string;
    pathDirection?: PathDirection;
    pathBeatIndex?: number;
    runNonce?: number;
    runNonceIncrement?: number;
  };
  history: string[];
  areaVisitCounts: Record<string, number>;
  pathVisitCounts: Record<string, number>;
  recentLogByNodeId: Record<string, AppRecentLogEntry[]>;
  actionAttemptsByNodeId: Record<string, Record<string, number>>;
  sessionState: RuntimeSessionState;
  shouldIncrementVisit: boolean;
};

type PendingNodeEntry = {
  projectId: string;
  nodeId: string;
  logEntries: ProjectedLogEntry[];
};

type ResolvedNodeEntry = {
  nodeId?: string;
  pathDirection?: PathDirection;
  sessionState: RuntimeSessionState;
  logEntries: ProjectedLogEntry[];
};

type ObservedWeatherState = {
  projectId: string;
  nodeId: string;
  snapshot?: RuntimeWeatherSnapshot;
};

export function App() {
  const projectedPageResolverRef = useRef(createStableProjectedPageResolver(getProjectedPage));
  const lastObservedPhaseRef = useRef<{ projectId: string; nodeId: string; phase?: string } | undefined>(undefined);
  const ambientNpcSnapshotsRef = useRef<Record<string, Record<string, RuntimeAmbientNpcSnapshot>>>({});
  const weatherSnapshotsRef = useRef<Record<string, RuntimeWeatherProjectSnapshot>>({});
  const lastObservedWeatherRef = useRef<ObservedWeatherState | undefined>(undefined);
  const shouldClearActiveNodeStateRef = useRef(false);
  const [route, setRoute] = useState<AppRoute>({ kind: 'home' });
  const [historyByProject, setHistoryByProject] = useState<Record<string, string[]>>({});
  const [areaVisitCountsByProject, setAreaVisitCountsByProject] = useState<Record<string, Record<string, number>>>({});
  const [pathVisitCountsByProject, setPathVisitCountsByProject] = useState<Record<string, Record<string, number>>>({});
  const [recentLogByNodeId, setRecentLogByNodeId] = useState<Record<string, AppRecentLogEntry[]>>({});
  const [actionAttemptsByNodeId, setActionAttemptsByNodeId] = useState<Record<string, Record<string, number>>>({});
  const [sessionStateByProjectId, setSessionStateByProjectId] = useState<Record<string, RuntimeSessionState>>({});
  const [pendingNodeEntry, setPendingNodeEntry] = useState<PendingNodeEntry | undefined>();
  const [clockRevision, setClockRevision] = useState(0);

  useEffect(() => {
    setRuntimeClockSource(SERVER_RUNTIME_CLOCK_SOURCE);
    setRuntimeWeatherSource(SERVER_RUNTIME_WEATHER_SOURCE);

    return () => {
      setRuntimeClockSource(undefined);
      setRuntimeWeatherSource(undefined);
      SERVER_RUNTIME_CLOCK_SOURCE.clear();
      SERVER_RUNTIME_AMBIENT_SOURCE.clear();
      SERVER_RUNTIME_WEATHER_SOURCE.clear();
    };
  }, []);

  function incrementNodeVisitCount(projectId: string, nodeId: string | undefined) {
    if (!nodeId) {
      return;
    }

    const projectRuntime = PROJECT_RUNTIME[projectId];
    const nodePage = projectRuntime?.pagesByNodeId[nodeId];

    if (nodePage?.kind !== 'page') {
      return;
    }

    if (nodePage.nodeKind === 'path') {
      setPathVisitCountsByProject((current) => ({
        ...current,
        [projectId]: {
          ...(current[projectId] ?? {}),
          [nodeId]: (current[projectId]?.[nodeId] ?? 0) + 1,
        },
      }));

      return;
    }

    if (nodePage.nodeKind !== 'area' && nodePage.nodeKind !== 'gate') {
        return;
    }

    setAreaVisitCountsByProject((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? {}),
        [nodeId]: (current[projectId]?.[nodeId] ?? 0) + 1,
      },
    }));
  }

  function pushProjectHistory(projectId: string, nodeId: string | undefined, nextNodeId: string | undefined) {
    if (!nodeId || !nextNodeId || nodeId === nextNodeId) {
      return;
    }

    setHistoryByProject((current) => ({
      ...current,
      [projectId]: [...(current[projectId] ?? []), nodeId],
    }));
  }

  function resolvePendingNodeEntry(
    projectId: string,
    nodeId: string | undefined,
    sessionState: RuntimeSessionState,
    pathDirection?: PathDirection,
    carriedLogEntries: ProjectedLogEntry[] = [],
  ): ResolvedNodeEntry {
    if (!nodeId) {
      return {
        nodeId,
        pathDirection,
        sessionState,
        logEntries: carriedLogEntries,
      };
    }

    const seenNodes = new Set<string>();
    let activeNodeId = nodeId;
    let activePathDirection = pathDirection;
    let activeSessionState = syncActivePlayerLocation(sessionState, activeNodeId);
    const logEntries = [...carriedLogEntries];

    while (activeNodeId) {
      const visitKey = `${activeNodeId}:${activePathDirection ?? ''}`;

      if (seenNodes.has(visitKey)) {
        break;
      }

      seenNodes.add(visitKey);

      const activePlayerId = getActivePlayerId(activeSessionState);
      const outcome = resolveProjectEnter(projectId, activeNodeId, {
        sessionState: activeSessionState,
        actorId: activePlayerId,
        viewerId: activePlayerId,
      });

      activeSessionState = syncActivePlayerLocation(outcome.sessionState ?? activeSessionState, activeNodeId);

      if (outcome.logEntry) {
        logEntries.push(outcome.logEntry);
      }

      if (!outcome.nextNodeId) {
        break;
      }

      activeNodeId = outcome.nextNodeId;
      activePathDirection = outcome.nextPathDirection;
      activeSessionState = syncActivePlayerLocation(activeSessionState, activeNodeId);
    }

    return {
      nodeId: activeNodeId,
      pathDirection: activePathDirection,
      sessionState: activeSessionState,
      logEntries,
    };
  }

  function goToProjectNode(
    projectId: string,
    nextNodeId: string | undefined,
    nextPathDirection?: PathDirection,
    pushHistory = true,
    nextPathBeatIndex?: number,
    nextSessionState?: RuntimeSessionState,
    carriedLogEntry?: ProjectedLogEntry,
  ) {
    const currentNodeId = activeProjectRoute?.projectId === projectId ? activeProjectRoute.nodeId : undefined;
    const currentRunNonce = activeProjectRoute?.projectId === projectId ? activeProjectRoute.runNonce : 0;
    const currentPathDirection = activeProjectRoute?.projectId === projectId ? activeProjectRoute.pathDirection : undefined;
    const isNewNodeVisit = currentNodeId !== nextNodeId || currentPathDirection !== nextPathDirection;
    const baseSessionState = syncActivePlayerLocation(
      nextSessionState ?? sessionStateByProjectId[projectId] ?? createInitialProjectSessionState(projectId),
      nextNodeId,
    );
    let resolvedSessionState = baseSessionState;
    let resolvedEntryOutcome: ResolvedNodeEntry | undefined;

    if (isNewNodeVisit) {
      resolvedEntryOutcome = resolvePendingNodeEntry(
        projectId,
        nextNodeId,
        baseSessionState,
        nextPathDirection,
        carriedLogEntry ? [carriedLogEntry] : [],
      );

      resolvedSessionState = resolvedEntryOutcome.sessionState;
      nextNodeId = resolvedEntryOutcome.nodeId;
      nextPathDirection = resolvedEntryOutcome.pathDirection;
    }

    if (pushHistory) {
      pushProjectHistory(projectId, currentNodeId, nextNodeId);
    }

    shouldClearActiveNodeStateRef.current = Boolean(isNewNodeVisit);

    const nextRoute = buildProjectRouteState(projectId, {
      nodeId: nextNodeId,
      pathDirection: nextPathDirection,
      pathBeatIndex: nextPathBeatIndex,
      runNonce: currentRunNonce,
    });

    flushSync(() => {
      setSessionStateByProjectId((current) => ({
        ...current,
        [projectId]: resolvedSessionState,
      }));
      setRoute(nextRoute);
    });

    if (isNewNodeVisit) {
      setPendingNodeEntry(nextNodeId && resolvedEntryOutcome && resolvedEntryOutcome.logEntries.length > 0
        ? { projectId, nodeId: nextNodeId, logEntries: resolvedEntryOutcome.logEntries }
        : undefined);
      incrementNodeVisitCount(projectId, nextNodeId);
    } else {
      setPendingNodeEntry(undefined);
    }
  }

  function appendNodeLog(nodeId: string, entry: ProjectedLogEntry | undefined) {
    if (!entry) {
      return;
    }

    setRecentLogByNodeId((current) => ({
      ...current,
      [nodeId]: appendLogEntry(current[nodeId], entry) ?? current[nodeId] ?? [],
    }));
  }

  const activeProjectRoute = route.kind === 'project' ? route : undefined;

  useEffect(() => {
    if (route.kind !== 'project') {
      return undefined;
    }

    const activeNodeId = route.nodeId;
    const activeNodeRegion = activeNodeId ? PROJECT_RUNTIME[route.projectId]?.nodeRegionsById?.[activeNodeId] : undefined;

    return SERVER_RUNTIME_CLOCK_SOURCE.subscribeProject(route.projectId, activeNodeId, activeNodeRegion, {
      onUpdate() {
        setClockRevision((current) => current + 1);
      },
      onError(error) {
        console.error(error);
      },
    });
  }, [route.kind, route.kind === 'project' ? route.projectId : undefined, route.kind === 'project' ? route.nodeId : undefined]);

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
        setClockRevision((current) => current + 1);
      },
      onError(error) {
        console.error(error);
      },
    });
  }, [route.kind, route.kind === 'project' ? route.projectId : undefined]);

  useEffect(() => {
    if (route.kind !== 'project') {
      return undefined;
    }

    return SERVER_RUNTIME_AMBIENT_SOURCE.subscribeProject(route.projectId, {
      onUpdate(snapshot) {
        const previousSnapshots = ambientNpcSnapshotsRef.current[route.projectId] ?? {};
        const nextSnapshots = Object.fromEntries(snapshot.npcs.map((npc) => [npc.id, npc]));

        ambientNpcSnapshotsRef.current = {
          ...ambientNpcSnapshotsRef.current,
          [route.projectId]: nextSnapshots,
        };

        if (route.nodeId) {
          snapshot.npcs.forEach((npc) => {
            const previousNpc = previousSnapshots[npc.id];

            if (previousNpc?.nodeId !== route.nodeId && npc.nodeId === route.nodeId) {
              appendNodeLog(route.nodeId!, createAmbientNpcLogEntry(npc, 'arrival', snapshot.nowMs));
            }

            if (previousNpc?.nodeId === route.nodeId && npc.nodeId !== route.nodeId) {
              appendNodeLog(route.nodeId!, createAmbientNpcLogEntry(previousNpc, 'departure', snapshot.nowMs));
            }
          });
        }

        setSessionStateByProjectId((current) => ({
          ...current,
          [route.projectId]: mergeAmbientNpcLocations(
            current[route.projectId] ?? createInitialProjectSessionState(route.projectId),
            snapshot.npcs,
          ),
        }));
      },
      onError(error) {
        console.error(error);
      },
    });
  }, [route.kind, route.kind === 'project' ? route.projectId : undefined, route.kind === 'project' ? route.nodeId : undefined]);

  useEffect(() => {
    if (!activeProjectRoute?.nodeId) {
      return;
    }

    if (!shouldClearActiveNodeStateRef.current) {
      return;
    }

    shouldClearActiveNodeStateRef.current = false;

    const activeNodeId = activeProjectRoute.nodeId;

    setRecentLogByNodeId((current) => {
      if (!current[activeNodeId]) {
        return current;
      }

      const next = { ...current };
      delete next[activeNodeId];
      return next;
    });

    setActionAttemptsByNodeId((current) => {
      if (!current[activeNodeId]) {
        return current;
      }

      const next = { ...current };
      delete next[activeNodeId];
      return next;
    });
  }, [activeProjectRoute?.projectId, activeProjectRoute?.nodeId]);

  useEffect(() => {
    if (
      !pendingNodeEntry
      || activeProjectRoute?.projectId !== pendingNodeEntry.projectId
      || activeProjectRoute.nodeId !== pendingNodeEntry.nodeId
    ) {
      return;
    }

    setRecentLogByNodeId((current) => ({
      ...current,
      [pendingNodeEntry.nodeId]: createRecentLogEntries(pendingNodeEntry.logEntries) ?? [],
    }));
    setPendingNodeEntry(undefined);
  }, [activeProjectRoute?.projectId, activeProjectRoute?.nodeId, pendingNodeEntry]);

  function getNextActionAttempt(nodeId: string, action: ProjectedAction): number {
    const actionKey = `${action.kind}:${action.id}`;
    const nextAttempt = (actionAttemptsByNodeId[nodeId]?.[actionKey] ?? 0) + 1;

    setActionAttemptsByNodeId((current) => ({
      ...current,
      [nodeId]: {
        ...(current[nodeId] ?? {}),
        [actionKey]: nextAttempt,
      },
    }));

    return nextAttempt;
  }

  function popProjectHistory(projectId: string): string | undefined {
    const history = historyByProject[projectId] ?? [];
    const nextNodeId = history[history.length - 1];

    if (!nextNodeId) {
      return undefined;
    }

    setHistoryByProject((current) => ({
      ...current,
      [projectId]: history.slice(0, -1),
    }));

    return nextNodeId;
  }

  function resetProjectRun(projectId: string, destinationNodeId?: string) {
    const projectRuntime = PROJECT_RUNTIME[projectId];
    const nodeIds = collectProjectNodeIds(projectRuntime?.nodes ?? []);
    const nextRunNonce = activeProjectRoute?.projectId === projectId ? activeProjectRoute.runNonce + 1 : 1;
    const nextNodeId = destinationNodeId ?? projectRuntime?.startNodeId;

    if (shouldClearProjectSnapshotOnReset(getTitleScreenSaveMode(projectId))) {
      clearProjectSnapshot(projectId);
    }

    setHistoryByProject((current) => {
      if (!current[projectId]) {
        return current;
      }

      const next = { ...current };
      delete next[projectId];
      return next;
    });

    setAreaVisitCountsByProject((current) => {
      if (!current[projectId]) {
        return current;
      }

      const next = { ...current };
      delete next[projectId];
      return next;
    });

    setPathVisitCountsByProject((current) => {
      if (!current[projectId]) {
        return current;
      }

      const next = { ...current };
      delete next[projectId];
      return next;
    });

    setRecentLogByNodeId((current) => {
      const nextEntries = omitProjectEntries(current, nodeIds);

      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });

    setActionAttemptsByNodeId((current) => {
      const nextEntries = omitProjectEntries(current, nodeIds);

      return nextEntries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(nextEntries);
    });

    setSessionStateByProjectId((current) => ({
      ...current,
      [projectId]: createInitialProjectSessionState(projectId),
    }));

    incrementNodeVisitCount(projectId, nextNodeId);

    shouldClearActiveNodeStateRef.current = false;

    setRoute(buildProjectRouteState(projectId, {
      nodeId: nextNodeId,
      runNonce: nextRunNonce,
    }));
  }

  const projectIds = new Set<string>([
    ...Object.keys(CONTENT_PROJECT_METADATA_BY_ID),
    ...Object.keys(PROJECT_RUNTIME),
  ]);

  const projects: ContentProjectRecord[] = Array.from(projectIds)
    .filter((projectId) => isContentProjectAvailable(projectId))
    .sort((left, right) => left.localeCompare(right))
    .map((projectId) => {
      const runtime = PROJECT_RUNTIME[projectId];
      const status = runtime && runtime.nodes.length > 0 ? ('playable-demo' as const) : ('placeholder' as const);

      return buildContentProjectRecord(projectId, status);
    });

  const projectId = route.kind === 'project' ? route.projectId : undefined;
  const currentNodeId = route.kind === 'project' ? route.nodeId : undefined;
  const currentPathDirection = route.kind === 'project' ? route.pathDirection : undefined;
  const currentPathBeatIndex = route.kind === 'project' ? route.pathBeatIndex : undefined;
  const currentRunNonce = route.kind === 'project' ? route.runNonce : undefined;
  const currentAreaVisitCount = projectId && currentNodeId
    ? areaVisitCountsByProject[projectId]?.[currentNodeId]
    : undefined;
  const currentPathVisitCount = projectId && currentNodeId
    ? pathVisitCountsByProject[projectId]?.[currentNodeId]
    : undefined;
  const project = projectId ? projects.find((item) => item.id === projectId) : undefined;
  const runtime = project ? (PROJECT_RUNTIME[project.id] ?? { nodes: [], pagesByNodeId: {} }) : { nodes: [], pagesByNodeId: {} };
  const nodes = runtime.nodes as ProjectNodeLink[];
  const activeClock = projectId ? getRuntimeClockSnapshot(projectId, currentNodeId) : undefined;
  const activeWeather = projectId
    ? SERVER_RUNTIME_WEATHER_SOURCE.getSnapshot(
        {
          projectId,
          weatherSettings: PROJECT_RUNTIME[projectId]?.weatherSettings,
          defaultWeather: PROJECT_RUNTIME[projectId]?.defaultWeather,
          nodeRegionsById: PROJECT_RUNTIME[projectId]?.nodeRegionsById,
        },
        currentNodeId,
        currentNodeId ? PROJECT_RUNTIME[projectId]?.nodeRegionsById?.[currentNodeId] : undefined,
      )
    : undefined;
  const activeAmbientNpcs = projectId
    ? Object.values(ambientNpcSnapshotsRef.current[projectId] ?? {}).sort((left, right) => {
        const leftName = left.displayName ?? left.id;
        const rightName = right.displayName ?? right.id;
        return leftName.localeCompare(rightName);
      })
    : [];
  const currentSessionState = projectId ? (sessionStateByProjectId[projectId] ?? createInitialProjectSessionState(projectId)) : undefined;
  const pageRevisionKey = JSON.stringify({
    phase: activeClock?.phase,
    weather: activeWeather ? {
      patternId: activeWeather.patternId,
      stepId: activeWeather.stepId,
      kind: activeWeather.kind,
      intensity: activeWeather.intensity,
    } : undefined,
    sessionState: currentSessionState,
  });
  const selectedPage = projectedPageResolverRef.current.resolvePage(
    projectId,
    currentNodeId,
    currentPathDirection,
    currentAreaVisitCount,
    currentPathVisitCount,
    currentPathBeatIndex,
    currentSessionState,
    currentNodeId ? recentLogByNodeId[currentNodeId] : undefined,
    pageRevisionKey,
  );
  const effectiveSelectedPage = appendSyntheticActions(projectId, selectedPage);
  const offeredActions = projectId && currentNodeId
    ? getOfferedActions(projectId, currentNodeId, {
        sessionState: currentSessionState,
        actorId: getActivePlayerId(currentSessionState),
        viewerId: getActivePlayerId(currentSessionState),
      })
    : [];
  const fullyEffectiveSelectedPage = appendOfferedActions(effectiveSelectedPage, offeredActions);
  const selectedPageRenderKey = buildProjectedPageRenderKey({
    projectId,
    nodeId: currentNodeId,
    pathDirection: currentPathDirection,
    areaVisitCount: currentAreaVisitCount,
    pathVisitCount: currentPathVisitCount,
    pathBeatIndex: currentPathBeatIndex,
    runNonce: currentRunNonce,
  });
  const selectedPageNavigationKey = buildProjectedPageRenderKey({
    projectId,
    nodeId: currentNodeId,
    pathDirection: currentPathDirection,
    areaVisitCount: currentAreaVisitCount,
    pathVisitCount: currentPathVisitCount,
    pathBeatIndex: currentPathBeatIndex,
    runNonce: currentRunNonce,
    revisionKey: pageRevisionKey,
  });

  useEffect(() => {
    if (!projectId || !currentNodeId) {
      lastObservedPhaseRef.current = undefined;
      return;
    }

    const nextObserved = {
      projectId,
      nodeId: currentNodeId,
      phase: activeClock?.phase,
    };
    const previousObserved = lastObservedPhaseRef.current;

    lastObservedPhaseRef.current = nextObserved;

    const sessionState = sessionStateByProjectId[projectId] ?? createInitialProjectSessionState(projectId);
    const activePlayerId = getActivePlayerId(sessionState);
    const outcome = resolveProjectEnter(projectId, currentNodeId, {
      sessionState,
      actorId: activePlayerId,
      viewerId: activePlayerId,
    });
    const latestRecentEntry = recentLogByNodeId[currentNodeId]?.[recentLogByNodeId[currentNodeId].length - 1];
    const phaseDecision = resolveObservedPhaseChange({
      previousObserved,
      nextObserved,
      outcome,
      latestRecentEntryText: latestRecentEntry?.text,
    });

    if (phaseDecision.kind === 'ignore') {
      return;
    }

    if (phaseDecision.kind === 'redirect') {
      goToProjectNode(
        projectId,
        phaseDecision.nextNodeId,
        phaseDecision.nextPathDirection,
        false,
        undefined,
        phaseDecision.sessionState,
        phaseDecision.logEntry,
      );
      return;
    }

    if (phaseDecision.shouldAppendLog) {
      appendNodeLog(currentNodeId, phaseDecision.logEntry);
    }

    if (phaseDecision.sessionState) {
      setSessionStateByProjectId((current) => ({
        ...current,
        [projectId]: phaseDecision.sessionState,
      }));
    }
  }, [projectId, currentNodeId, activeClock?.phase, recentLogByNodeId, sessionStateByProjectId]);

  useEffect(() => {
    if (!projectId || !currentNodeId) {
      lastObservedWeatherRef.current = undefined;
      return;
    }

    const previousObservedWeather = lastObservedWeatherRef.current;

    lastObservedWeatherRef.current = {
      projectId,
      nodeId: currentNodeId,
      snapshot: activeWeather,
    };

    if (shouldAnnounceWeatherChange({
      previousNodeId: previousObservedWeather?.projectId === projectId ? previousObservedWeather.nodeId : undefined,
      currentNodeId,
      previousSnapshot: previousObservedWeather?.projectId === projectId ? previousObservedWeather.snapshot : undefined,
      snapshot: activeWeather,
    })) {
      const weatherEntry = buildRuntimeWeatherLogEntry(activeWeather);

      if (!weatherEntry) {
        return;
      }

      appendNodeLog(currentNodeId, weatherEntry);
    }
  }, [projectId, currentNodeId, activeWeather?.patternId, activeWeather?.stepId, activeWeather?.kind, activeWeather?.intensity]);

  function handleAction(action: ProjectedAction) {
    if (!projectId || !currentNodeId) {
      return;
    }

    if (currentNodeId === TITLE_SCREEN_NODE_ID && action.id === TITLE_SCREEN_NEW_GAME_ACTION_ID) {
      startNewProjectRun(projectId, action.targetId);
      return;
    }

    if (currentNodeId === TITLE_SCREEN_NODE_ID && action.id === TITLE_SCREEN_CONTINUE_ACTION_ID) {
      continueProjectRun(projectId);
      return;
    }

    const attempt = getNextActionAttempt(currentNodeId, action);
    const activePlayerId = getActivePlayerId(sessionStateByProjectId[projectId]);
    const outcome = resolveProjectAction(projectId, currentNodeId, action, {
      attempt,
      sessionState: sessionStateByProjectId[projectId],
      actorId: activePlayerId,
      viewerId: activePlayerId,
    });

    if (outcome.resetNodeId) {
      resetProjectRun(projectId, outcome.resetNodeId);
      return;
    }

    if (outcome.nextNodeId) {
      const carriedLogEntry = action.kind === 'exit' && outcome.eventResult ? outcome.logEntry : undefined;
      goToProjectNode(projectId, outcome.nextNodeId, outcome.nextPathDirection, true, undefined, outcome.sessionState, carriedLogEntry);
      return;
    }

    appendNodeLog(currentNodeId, outcome.logEntry);

    if (outcome.sessionState) {
      setSessionStateByProjectId((current) => ({
        ...current,
        [projectId]: outcome.sessionState!,
      }));
    }
  }

  function handleControl(control: ProjectedControl) {
    if (!projectId || !currentNodeId) {
      return;
    }

    const outcome = resolveProjectControl(projectId, currentNodeId, currentPathDirection, control, {
      pathVisitCount: currentPathVisitCount,
      pathBeatIndex: currentPathBeatIndex,
    });

    appendNodeLog(currentNodeId, outcome.logEntry);

    if (outcome.nextNodeId === currentNodeId && outcome.nextPathBeatIndex !== undefined) {
      setRoute((current) => {
        if (current.kind !== 'project' || current.projectId !== projectId || current.nodeId !== currentNodeId) {
          return current;
        }

        return {
          ...current,
          pathDirection: outcome.nextPathDirection ?? current.pathDirection,
          pathBeatIndex: outcome.nextPathBeatIndex,
        };
      });
      return;
    }

    if (outcome.nextNodeId) {
      goToProjectNode(projectId, outcome.nextNodeId, outcome.nextPathDirection, true, outcome.nextPathBeatIndex);
    }
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
        handleAction(effectiveMatch.action);
      } else {
        handleControl(effectiveMatch.control);
      }

      event.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [route.kind, fullyEffectiveSelectedPage, projectId, currentNodeId, currentPathDirection, historyByProject, recentLogByNodeId]);

  useEffect(() => {
    if (route.kind !== 'project' || !projectId || !currentNodeId) {
      return;
    }

    const sessionState = sessionStateByProjectId[projectId];

    if (!shouldSaveProjectSnapshot({
      currentNodeId,
      sessionState,
      titleScreenSaveMode: getTitleScreenSaveMode(projectId),
    })) {
      return;
    }

    const snapshot = createSaveGameSnapshot({
      projectId,
      route: {
        nodeId: currentNodeId,
        pathDirection: currentPathDirection,
        pathBeatIndex: currentPathBeatIndex,
        runNonce: currentRunNonce ?? 0,
      },
      history: historyByProject[projectId] ?? [],
      areaVisitCounts: areaVisitCountsByProject[projectId] ?? {},
      pathVisitCounts: pathVisitCountsByProject[projectId] ?? {},
      recentLogByNodeId: selectProjectNodeScopedEntries(recentLogByNodeId, collectProjectNodeIds(runtime.nodes)),
      actionAttemptsByNodeId: selectProjectNodeScopedEntries(actionAttemptsByNodeId, collectProjectNodeIds(runtime.nodes)),
      sessionState,
    });

    saveProjectSnapshot(snapshot);
  }, [
    route.kind,
    projectId,
    currentNodeId,
    currentPathDirection,
    currentPathBeatIndex,
    currentRunNonce,
    historyByProject,
    areaVisitCountsByProject,
    pathVisitCountsByProject,
    recentLogByNodeId,
    actionAttemptsByNodeId,
    sessionStateByProjectId,
    runtime.nodes,
  ]);

  function startNewProjectRun(projectId: string, titleScreenTargetId: string | undefined) {
    const initialSessionState = syncActivePlayerLocation(createInitialProjectSessionState(projectId), TITLE_SCREEN_NODE_ID);
    const activePlayerId = getActivePlayerId(initialSessionState);
    const startOutcome = titleScreenTargetId
      ? resolveProjectAction(
          projectId,
          TITLE_SCREEN_NODE_ID,
          {
            id: 'title_screen_start',
            kind: 'exit',
            label: 'New Game',
            targetId: titleScreenTargetId,
          },
          {
            sessionState: initialSessionState,
            actorId: activePlayerId,
            viewerId: activePlayerId,
          },
        )
      : {};
    const destinationNodeId = startOutcome.nextNodeId ?? titleScreenTargetId ?? TITLE_SCREEN_NODE_ID;
    const entryOutcome = resolvePendingNodeEntry(
      projectId,
      destinationNodeId,
      syncActivePlayerLocation(initialSessionState, destinationNodeId),
      startOutcome.nextPathDirection,
    );
    const seededRecentLogByNodeId = seedInitialWeatherRecentLog(projectId, entryOutcome.nodeId, entryOutcome.nodeId && entryOutcome.logEntries.length > 0 ? {
      [entryOutcome.nodeId]: createRecentLogEntries(entryOutcome.logEntries) ?? [],
    } : {});

    replaceProjectRunState(projectId, {
      route: {
        nodeId: entryOutcome.nodeId,
        pathDirection: entryOutcome.pathDirection,
        pathBeatIndex: startOutcome.nextPathBeatIndex,
        runNonceIncrement: 1,
      },
      history: [],
      areaVisitCounts: {},
      pathVisitCounts: {},
      recentLogByNodeId: seededRecentLogByNodeId,
      actionAttemptsByNodeId: {},
      sessionState: entryOutcome.sessionState,
      shouldIncrementVisit: true,
    });
  }

  function continueProjectRun(projectId: string) {
    const snapshot = loadProjectSnapshot(projectId);

    if (!snapshot) {
      return;
    }

    const continuedEntryOutcome = resolvePendingNodeEntry(
      projectId,
      snapshot.route.nodeId,
      syncActivePlayerLocation(snapshot.sessionState, snapshot.route.nodeId),
      snapshot.route.pathDirection,
    );
    const seededRecentLogByNodeId = seedInitialWeatherRecentLog(
      projectId,
      continuedEntryOutcome.nodeId,
      continuedEntryOutcome.nodeId && continuedEntryOutcome.logEntries.length > 0
        ? {
            ...snapshot.recentLogByNodeId,
            [continuedEntryOutcome.nodeId]: createRecentLogEntries(continuedEntryOutcome.logEntries) ?? snapshot.recentLogByNodeId[continuedEntryOutcome.nodeId] ?? [],
          }
        : snapshot.recentLogByNodeId,
    );

    replaceProjectRunState(projectId, {
      route: {
        nodeId: continuedEntryOutcome.nodeId,
        pathDirection: continuedEntryOutcome.pathDirection,
        pathBeatIndex: snapshot.route.pathBeatIndex,
        runNonce: snapshot.route.runNonce,
      },
      history: snapshot.history,
      areaVisitCounts: snapshot.areaVisitCounts,
      pathVisitCounts: snapshot.pathVisitCounts,
      recentLogByNodeId: seededRecentLogByNodeId,
      actionAttemptsByNodeId: snapshot.actionAttemptsByNodeId,
      sessionState: continuedEntryOutcome.sessionState,
      shouldIncrementVisit: false,
    });
  }

  function replaceProjectRunState(projectId: string, input: ReplaceProjectRunStateInput) {
    const projectRuntime = PROJECT_RUNTIME[projectId];
    const projectNodeIds = collectProjectNodeIds(projectRuntime?.nodes ?? []);

    setHistoryByProject((current) => ({
      ...current,
      [projectId]: input.history,
    }));

    setAreaVisitCountsByProject((current) => ({
      ...current,
      [projectId]: input.areaVisitCounts,
    }));

    setPathVisitCountsByProject((current) => ({
      ...current,
      [projectId]: input.pathVisitCounts,
    }));

    setRecentLogByNodeId((current) => replaceProjectNodeScopedEntries(current, projectNodeIds, input.recentLogByNodeId));

    setActionAttemptsByNodeId((current) => replaceProjectNodeScopedEntries(current, projectNodeIds, input.actionAttemptsByNodeId));

    setSessionStateByProjectId((current) => ({
      ...current,
      [projectId]: syncActivePlayerLocation(input.sessionState, input.route.nodeId),
    }));

    if (input.shouldIncrementVisit) {
      incrementNodeVisitCount(projectId, input.route.nodeId);
    }

    shouldClearActiveNodeStateRef.current = false;

    setRoute(buildProjectRouteState(projectId, input.route, activeProjectRoute));
  }

  if (route.kind === 'home') {
    return (
      <HomeScreen
        projects={projects}
        onEnterProject={(nextProjectId) => {
          const nextRuntime = PROJECT_RUNTIME[nextProjectId];
          const initialSessionState = syncActivePlayerLocation(
            createInitialProjectSessionState(nextProjectId),
            nextRuntime?.startNodeId,
          );
          const entryNodeId = nextRuntime?.startNodeId;

          if (getTitleScreenSaveMode(nextProjectId) !== 'single' || nextRuntime?.startNodeId !== TITLE_SCREEN_NODE_ID) {
            const entryOutcome = resolvePendingNodeEntry(nextProjectId, entryNodeId, initialSessionState);
            const seededRecentLogByNodeId = seedInitialWeatherRecentLog(nextProjectId, entryOutcome.nodeId, entryOutcome.nodeId && entryOutcome.logEntries.length > 0 ? {
              [entryOutcome.nodeId]: createRecentLogEntries(entryOutcome.logEntries) ?? [],
            } : {});

            setSessionStateByProjectId((current) => ({
              ...current,
              [nextProjectId]: entryOutcome.sessionState,
            }));
            setRecentLogByNodeId((current) => ({
              ...current,
              ...seededRecentLogByNodeId,
            }));
            incrementNodeVisitCount(nextProjectId, entryOutcome.nodeId);
          }

          shouldClearActiveNodeStateRef.current = false;

          const entryOutcome = (getTitleScreenSaveMode(nextProjectId) !== 'single' || nextRuntime?.startNodeId !== TITLE_SCREEN_NODE_ID)
            ? resolvePendingNodeEntry(nextProjectId, entryNodeId, initialSessionState)
            : { nodeId: nextRuntime?.startNodeId, pathDirection: undefined, sessionState: initialSessionState, logEntries: [] };

          setRoute(buildProjectRouteState(nextProjectId, { nodeId: entryOutcome.nodeId, pathDirection: entryOutcome.pathDirection, runNonce: 0 }));
        }}
      />
    );
  }

  if (!project || !projectId) {
    return (
      <HomeScreen
        projects={projects}
        onEnterProject={(nextProjectId) => setRoute(buildProjectRouteState(nextProjectId, { runNonce: 0 }))}
      />
    );
  }

  return (
    <ProjectScreen
      project={project}
      nodes={nodes}
      activeClock={activeClock ? {
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
      selectedNodeId={currentNodeId}
      selectedPage={fullyEffectiveSelectedPage}
      selectedPageRenderKey={selectedPageRenderKey}
      selectedPageNavigationKey={selectedPageNavigationKey}
      onBackHome={() => setRoute({ kind: 'home' })}
      onResetRun={() => resetProjectRun(projectId)}
      onSelectNode={(nodeId) => goToProjectNode(projectId, nodeId)}
      onAction={handleAction}
      onControl={handleControl}
    />
  );
}

function appendSyntheticActions(
  projectId: string | undefined,
  page: ProjectionResult | undefined,
): ProjectionResult | undefined {
  if (!page || page.kind !== 'page') {
    return page;
  }

  const syntheticActions: ProjectedAction[] = [];
  let nextActions = [...(page.actions ?? [])];

  if (projectId && getTitleScreenSaveMode(projectId) === 'single' && page.nodeId === TITLE_SCREEN_NODE_ID) {
    const snapshot = loadProjectSnapshot(projectId);
    const titleScreenExitActions = nextActions.filter((action) => action.kind === 'exit');

    if (titleScreenExitActions.length === 1) {
      const [freshStartAction] = titleScreenExitActions;

      syntheticActions.push({
        id: TITLE_SCREEN_NEW_GAME_ACTION_ID,
        kind: 'exit',
        label: 'New Game',
        key: 'N',
        keyLabel: '[N]',
        targetId: freshStartAction.targetId,
      });

      if (snapshot) {
        syntheticActions.push({
          id: TITLE_SCREEN_CONTINUE_ACTION_ID,
          kind: 'exit',
          label: 'Continue',
          key: 'C',
          keyLabel: '[C]',
          meta: formatProjectSnapshotSummary({
            snapshot,
            nodeLabel: getProjectNodeLabel(projectId, snapshot.route.nodeId),
          }),
        });
      }

      nextActions = nextActions.filter((action) => action.kind !== 'exit');
    }
  }

  if (syntheticActions.length === 0) {
    return page;
  }

  return {
    ...page,
    actions: [...nextActions, ...syntheticActions],
  };
}

function asRuntimeRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RuntimeSessionObject)
    : undefined;
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

function omitProjectEntries<T>(
  current: Record<string, T>,
  projectNodeIds: Set<string>,
): Array<[string, T]> {
  return Object.entries(current).filter(([nodeId]) => !projectNodeIds.has(nodeId));
}

function getProjectNodeLabel(projectId: string, nodeId: string | undefined): string | undefined {
  if (!nodeId) {
    return undefined;
  }

  return PROJECT_RUNTIME[projectId]?.nodes.find((node) => node.id === nodeId)?.label;
}

function getActivePlayerId(sessionState: RuntimeSessionState | undefined): string | undefined {
  const playerValue = sessionState?.player;

  if (!playerValue || Array.isArray(playerValue) || typeof playerValue !== 'object') {
    return undefined;
  }

  const activeValue = playerValue.active;

  if (!activeValue || Array.isArray(activeValue) || typeof activeValue !== 'object') {
    return undefined;
  }

  return typeof activeValue.id === 'string' ? activeValue.id : undefined;
}

function syncActivePlayerLocation(
  sessionState: RuntimeSessionState,
  nodeId: string | undefined,
): RuntimeSessionState {
  if (!nodeId) {
    return sessionState;
  }

  const activePlayerId = getActivePlayerId(sessionState);
  const nextPlayers = (activePlayerId
    ? {
        ...(asRuntimeRecord(sessionState.players) ?? {}),
        [activePlayerId]: {
          ...(asRuntimeRecord(asRuntimeRecord(sessionState.players)?.[activePlayerId]) ?? {}),
          location: nodeId,
        },
      }
    : sessionState.players) as RuntimeSessionState['players'];

  return {
    ...sessionState,
    player: {
      ...(asRuntimeRecord(sessionState.player) ?? {}),
      location: nodeId,
      active: {
        ...(asRuntimeRecord(asRuntimeRecord(sessionState.player)?.active) ?? {}),
        ...(activePlayerId ? { id: activePlayerId } : {}),
        location: nodeId,
      },
    },
    players: nextPlayers,
  };
}

function mergeAmbientNpcLocations(
  sessionState: RuntimeSessionState,
  npcs: RuntimeAmbientNpcSnapshot[],
): RuntimeSessionState {
  const nextNpcs = {
    ...(asRuntimeRecord(sessionState.npcs) ?? {}),
    ...Object.fromEntries(npcs.map((npc) => [npc.id, {
      ...(asRuntimeRecord(asRuntimeRecord(sessionState.npcs)?.[npc.id]) ?? {}),
      location: npc.nodeId,
      behavior: npc.behavior,
    }])),
  } as RuntimeSessionObject;

  return {
    ...sessionState,
    npcs: nextNpcs,
  };
}

function createAmbientNpcLogEntry(
  npc: RuntimeAmbientNpcSnapshot,
  kind: 'arrival' | 'departure',
  nowMs: number,
): ProjectedLogEntry {
  const text = pickAmbientNpcText(kind === 'arrival' ? npc.arrivalText : npc.departureText, nowMs)
    ?? (kind === 'arrival'
      ? `${npc.displayName ?? npc.id} arrives.`
      : `${npc.displayName ?? npc.id} moves on.`);

  return {
    id: `ambient:${npc.id}:${kind}:${nowMs}`,
    text,
  };
}

function pickAmbientNpcText(lines: string[], nowMs: number): string | undefined {
  if (lines.length === 0) {
    return undefined;
  }

  return lines[Math.abs(Math.floor(nowMs / 1000)) % lines.length];
}

function getTitleScreenSaveMode(projectId: string): 'single' | 'multiple' | undefined {
  return PROJECT_RUNTIME[projectId]?.titleScreen?.saveMode;
}

function seedInitialWeatherRecentLog(
  projectId: string,
  nodeId: string | undefined,
  recentLogByNodeId: Record<string, AppRecentLogEntry[]>,
): Record<string, AppRecentLogEntry[]> {
  if (!nodeId) {
    return recentLogByNodeId;
  }

  const existingEntries = recentLogByNodeId[nodeId];

  const weatherSnapshot = getCurrentWeatherSnapshot(projectId, nodeId);
  if (!shouldAnnounceWeather({
    reason: 'entry',
    snapshot: weatherSnapshot,
    existingEntries,
  })) {
    return recentLogByNodeId;
  }

  const weatherEntry = buildRuntimeWeatherLogEntry(weatherSnapshot ?? undefined);

  if (!weatherEntry) {
    return recentLogByNodeId;
  }

  return {
    ...recentLogByNodeId,
    [nodeId]: appendLogEntry(existingEntries, weatherEntry, weatherSnapshot?.nowMs ?? Date.now()) ?? existingEntries ?? [],
  };
}

function getCurrentWeatherSnapshot(
  projectId: string,
  nodeId: string | undefined,
): RuntimeWeatherSnapshot | undefined {
  return SERVER_RUNTIME_WEATHER_SOURCE.getSnapshot({
    projectId,
    weatherSettings: PROJECT_RUNTIME[projectId]?.weatherSettings,
    defaultWeather: PROJECT_RUNTIME[projectId]?.defaultWeather,
    nodeRegionsById: PROJECT_RUNTIME[projectId]?.nodeRegionsById,
  }, nodeId, nodeId ? PROJECT_RUNTIME[projectId]?.nodeRegionsById?.[nodeId] : undefined);
}