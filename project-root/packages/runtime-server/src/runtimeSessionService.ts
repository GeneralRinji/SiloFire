import {
  appendRecentLog,
  createContentRuntime,
  type ContentRuntimeOptions,
  type RuntimeClockSnapshot,
  type RuntimeInteractionOutcome,
  type RuntimeNodeLink,
  type RuntimeSessionObject,
  type RuntimeSessionState,
  type RuntimeWeatherSnapshot,
} from '../../runtime/src';
import type { ProjectedAction, ProjectedControl, ProjectedLogEntry, ProjectionResult } from '../../projection/src';
import type { PathDirection, ProjectTimeSettingsDefinition, ProjectWeatherSettingsDefinition, TitleScreenSaveMode } from '../../schema/src';

export interface RuntimeSessionRoute {
  nodeId?: string;
  pathDirection?: PathDirection;
  pathBeatIndex?: number;
  runNonce: number;
}

export interface RuntimeSessionSnapshot {
  sessionId: string;
  projectId: string;
  route: RuntimeSessionRoute;
  areaVisitCounts: Record<string, number>;
  pathVisitCounts: Record<string, number>;
  recentLogByNodeId: Record<string, ProjectedLogEntry[]>;
  actionAttemptsByNodeId: Record<string, Record<string, number>>;
  sessionState: RuntimeSessionState;
}

export interface RuntimeSessionView {
  snapshot: RuntimeSessionSnapshot;
  page?: ProjectionResult;
  offeredActions: ProjectedAction[];
  currentAreaVisitCount?: number;
  currentPathVisitCount?: number;
}

export interface RuntimeSessionProjectMetadata {
  projectId: string;
  startNodeId?: string;
  nodes: RuntimeNodeLink[];
  nodeFoldersById: Record<string, string[]>;
  nodeRegionsById: Record<string, string>;
  titleScreenSaveMode?: TitleScreenSaveMode;
  timeSettings?: ProjectTimeSettingsDefinition;
  weatherSettings?: ProjectWeatherSettingsDefinition;
  defaultClock?: RuntimeClockSnapshot;
  defaultWeather?: RuntimeWeatherSnapshot;
}

export interface CreateRuntimeSessionOptions {
  nodeId?: string;
  pathDirection?: PathDirection;
  pathBeatIndex?: number;
}

export interface RuntimeSessionService {
  createSession(projectId: string, options?: CreateRuntimeSessionOptions): RuntimeSessionView | undefined;
  restoreSession(projectId: string, snapshot: Omit<RuntimeSessionSnapshot, 'sessionId'>): RuntimeSessionView | undefined;
  getSession(sessionId: string): RuntimeSessionView | undefined;
  getProjectMetadata(projectId: string): RuntimeSessionProjectMetadata | undefined;
  replaceSession(
    sessionId: string,
    snapshot: Omit<RuntimeSessionSnapshot, 'sessionId'>,
    options?: { reevaluateCurrentNodeEntry?: boolean },
  ): RuntimeSessionView | undefined;
  applyAction(sessionId: string, action: ProjectedAction): RuntimeSessionView | undefined;
  applyControl(sessionId: string, control: ProjectedControl): RuntimeSessionView | undefined;
  resetSession(sessionId: string, destinationNodeId?: string): RuntimeSessionView | undefined;
}

interface MutableRuntimeSession extends RuntimeSessionSnapshot {}

interface ResolvedNodeEntry {
  nodeId?: string;
  pathDirection?: PathDirection;
  sessionState: RuntimeSessionState;
  logEntries: ProjectedLogEntry[];
}

export function createRuntimeSessionServiceForContentFiles(
  contentFiles: Record<string, string>,
  options: ContentRuntimeOptions = {},
): RuntimeSessionService {
  const contentRuntime = createContentRuntime(contentFiles, options);
  const sessions = new Map<string, MutableRuntimeSession>();
  let nextSessionId = 1;

  const service: RuntimeSessionService = {
    createSession(projectId, sessionOptions = {}) {
      const runtimeProject = contentRuntime.runtime[projectId];

      if (!runtimeProject) {
        return undefined;
      }

      const sessionId = `session_${nextSessionId++}`;
      const session: MutableRuntimeSession = {
        sessionId,
        projectId,
        route: {
          nodeId: undefined,
          pathDirection: undefined,
          pathBeatIndex: undefined,
          runNonce: 0,
        },
        areaVisitCounts: {},
        pathVisitCounts: {},
        recentLogByNodeId: {},
        actionAttemptsByNodeId: {},
        sessionState: contentRuntime.createInitialProjectSessionState(projectId),
      };

      sessions.set(sessionId, session);
      transitionToNode(
        session,
        sessionOptions.nodeId ?? runtimeProject.startNodeId,
        sessionOptions.pathDirection,
        sessionOptions.pathBeatIndex,
        session.sessionState,
      );

      return buildSessionView(session);
    },
    restoreSession(projectId, snapshot) {
      const runtimeProject = contentRuntime.runtime[projectId];

      if (!runtimeProject) {
        return undefined;
      }

      const sessionId = `session_${nextSessionId++}`;
      const session: MutableRuntimeSession = {
        sessionId,
        projectId,
        route: {
          nodeId: snapshot.route.nodeId,
          pathDirection: snapshot.route.pathDirection,
          pathBeatIndex: snapshot.route.pathBeatIndex,
          runNonce: snapshot.route.runNonce,
        },
        areaVisitCounts: { ...snapshot.areaVisitCounts },
        pathVisitCounts: { ...snapshot.pathVisitCounts },
        recentLogByNodeId: Object.fromEntries(
          Object.entries(snapshot.recentLogByNodeId).map(([nodeId, entries]) => [nodeId, [...entries]]),
        ),
        actionAttemptsByNodeId: Object.fromEntries(
          Object.entries(snapshot.actionAttemptsByNodeId).map(([nodeId, attempts]) => [nodeId, { ...attempts }]),
        ),
        sessionState: syncActivePlayerLocation(snapshot.sessionState, snapshot.route.nodeId),
      };

      sessions.set(sessionId, session);
      return buildSessionView(session);
    },
    getSession(sessionId) {
      const session = sessions.get(sessionId);
      return session ? buildSessionView(session) : undefined;
    },
    getProjectMetadata(projectId) {
      const runtimeProject = contentRuntime.runtime[projectId];

      if (!runtimeProject) {
        return undefined;
      }

      return {
        projectId,
        startNodeId: runtimeProject.startNodeId,
        nodes: runtimeProject.nodes,
        nodeFoldersById: runtimeProject.nodeFoldersById,
        nodeRegionsById: runtimeProject.nodeRegionsById,
        titleScreenSaveMode: runtimeProject.titleScreen?.saveMode,
        timeSettings: runtimeProject.timeSettings,
        weatherSettings: runtimeProject.weatherSettings,
        defaultClock: runtimeProject.defaultClock,
        defaultWeather: runtimeProject.defaultWeather,
      };
    },
    replaceSession(sessionId, snapshot, options = {}) {
      const session = sessions.get(sessionId);

      if (!session) {
        return undefined;
      }

      session.projectId = snapshot.projectId;
      session.route = {
        nodeId: snapshot.route.nodeId,
        pathDirection: snapshot.route.pathDirection,
        pathBeatIndex: snapshot.route.pathBeatIndex,
        runNonce: snapshot.route.runNonce,
      };
      session.areaVisitCounts = { ...snapshot.areaVisitCounts };
      session.pathVisitCounts = { ...snapshot.pathVisitCounts };
      session.recentLogByNodeId = Object.fromEntries(
        Object.entries(snapshot.recentLogByNodeId).map(([nodeId, entries]) => [nodeId, [...entries]]),
      );
      session.actionAttemptsByNodeId = Object.fromEntries(
        Object.entries(snapshot.actionAttemptsByNodeId).map(([nodeId, attempts]) => [nodeId, { ...attempts }]),
      );
      session.sessionState = syncActivePlayerLocation(snapshot.sessionState, snapshot.route.nodeId);

      if (options.reevaluateCurrentNodeEntry) {
        reconcileCurrentNodeEntry(session);
      }

      return buildSessionView(session);
    },
    applyAction(sessionId, action) {
      const session = sessions.get(sessionId);

      if (!session) {
        return undefined;
      }

      return applyActionToSession(session, action);
    },
    applyControl(sessionId, control) {
      const session = sessions.get(sessionId);

      if (!session || !session.route.nodeId) {
        return undefined;
      }

      const nodeId = session.route.nodeId;
      const outcome = contentRuntime.resolveProjectControl(
        session.projectId,
        nodeId,
        session.route.pathDirection,
        control,
        {
          pathVisitCount: session.pathVisitCounts[nodeId],
          pathBeatIndex: session.route.pathBeatIndex,
        },
      );

      appendNodeLog(session, nodeId, outcome.logEntry);

      if (outcome.nextNodeId === nodeId && outcome.nextPathBeatIndex !== undefined) {
        session.route = {
          ...session.route,
          pathDirection: outcome.nextPathDirection ?? session.route.pathDirection,
          pathBeatIndex: outcome.nextPathBeatIndex,
        };

        return buildSessionView(session);
      }

      if (outcome.nextNodeId) {
        transitionToNode(
          session,
          outcome.nextNodeId,
          outcome.nextPathDirection,
          outcome.nextPathBeatIndex,
        );
      }

      return buildSessionView(session);
    },
    resetSession(sessionId, destinationNodeId) {
      const session = sessions.get(sessionId);
      const runtimeProject = session ? contentRuntime.runtime[session.projectId] : undefined;

      if (!session || !runtimeProject) {
        return undefined;
      }

      session.areaVisitCounts = {};
      session.pathVisitCounts = {};
      session.recentLogByNodeId = {};
      session.actionAttemptsByNodeId = {};
      session.sessionState = contentRuntime.createInitialProjectSessionState(session.projectId);
      session.route = {
        nodeId: undefined,
        pathDirection: undefined,
        pathBeatIndex: undefined,
        runNonce: session.route.runNonce + 1,
      };

      transitionToNode(
        session,
        destinationNodeId ?? runtimeProject.startNodeId,
        undefined,
        undefined,
        session.sessionState,
      );

      return buildSessionView(session);
    },
  };

  return service;

  function applyActionToSession(session: MutableRuntimeSession, action: ProjectedAction): RuntimeSessionView | undefined {
    if (!session.route.nodeId) {
      return undefined;
    }

    const nodeId = session.route.nodeId;
    session.sessionState = contentRuntime.hydrateProjectSessionState(session.projectId, nodeId, session.sessionState) ?? session.sessionState;
    const attempt = getNextActionAttempt(session, nodeId, action);
    const actorId = getActivePlayerId(session.sessionState);
    const outcome = contentRuntime.resolveProjectAction(session.projectId, nodeId, action, {
      attempt,
      sessionState: session.sessionState,
      actorId,
      viewerId: actorId,
    });

    if (outcome.resetNodeId) {
      return service.resetSession(session.sessionId, outcome.resetNodeId);
    }

    if (outcome.nextNodeId) {
      const carriedLogEntry = action.kind === 'exit' && outcome.eventResult ? outcome.logEntry : undefined;
      transitionToNode(
        session,
        outcome.nextNodeId,
        outcome.nextPathDirection,
        outcome.nextPathBeatIndex,
        outcome.sessionState,
        carriedLogEntry,
      );
      return buildSessionView(session);
    }

    appendNodeLog(session, nodeId, outcome.logEntry);

    if (outcome.sessionState) {
      session.sessionState = outcome.sessionState;
    }

    return buildSessionView(session);
  }

  function selectFreshStartAction(page: ProjectionResult | undefined): ProjectedAction | undefined {
    if (!page || page.kind !== 'page') {
      return undefined;
    }

    const exitActions = page.actions.filter(
      (action) => action.kind === 'exit' && typeof action.targetId === 'string',
    );

    return exitActions.length === 1 ? exitActions[0] : undefined;
  }

  function buildSessionView(session: MutableRuntimeSession): RuntimeSessionView {
    const { nodeId, pathDirection, pathBeatIndex } = session.route;
    session.sessionState = contentRuntime.hydrateProjectSessionState(session.projectId, nodeId, session.sessionState) ?? session.sessionState;
    const currentAreaVisitCount = nodeId ? session.areaVisitCounts[nodeId] : undefined;
    const currentPathVisitCount = nodeId ? session.pathVisitCounts[nodeId] : undefined;
    const page = appendRecentLog(
      contentRuntime.getProjectedPage(session.projectId, nodeId, pathDirection, {
        areaVisitCount: currentAreaVisitCount,
        pathVisitCount: currentPathVisitCount,
        pathBeatIndex,
        sessionState: session.sessionState,
      }),
      nodeId ? session.recentLogByNodeId[nodeId] : undefined,
    );
    const actorId = getActivePlayerId(session.sessionState);

    return {
      snapshot: cloneSessionSnapshot(session),
      page,
      offeredActions: contentRuntime.getOfferedActions(session.projectId, nodeId, {
        sessionState: session.sessionState,
        actorId,
        viewerId: actorId,
      }),
      currentAreaVisitCount,
      currentPathVisitCount,
    };
  }

  function reconcileCurrentNodeEntry(session: MutableRuntimeSession): void {
    if (!session.route.nodeId) {
      return;
    }

    const actorId = getActivePlayerId(session.sessionState);
    const outcome = contentRuntime.resolveProjectEnter(session.projectId, session.route.nodeId, {
      sessionState: session.sessionState,
      actorId,
      viewerId: actorId,
    });

    session.sessionState = syncActivePlayerLocation(
      outcome.sessionState ?? session.sessionState,
      session.route.nodeId,
    );

    if (!outcome.nextNodeId) {
      return;
    }

    transitionToNode(
      session,
      outcome.nextNodeId,
      outcome.nextPathDirection,
      undefined,
      session.sessionState,
      outcome.logEntry,
    );
  }

  function transitionToNode(
    session: MutableRuntimeSession,
    nextNodeId: string | undefined,
    nextPathDirection?: PathDirection,
    nextPathBeatIndex?: number,
    nextSessionState?: RuntimeSessionState,
    carriedLogEntry?: ProjectedLogEntry,
  ): void {
    const currentNodeId = session.route.nodeId;
    const currentPathDirection = session.route.pathDirection;
    const isNewNodeVisit = currentNodeId !== nextNodeId || currentPathDirection !== nextPathDirection;
    const baseSessionState = syncActivePlayerLocation(
      nextSessionState ?? session.sessionState,
      nextNodeId,
    );
    let resolvedSessionState = baseSessionState;
    let resolvedEntryOutcome: ResolvedNodeEntry | undefined;

    if (isNewNodeVisit) {
      resolvedEntryOutcome = resolvePendingNodeEntry(
        session.projectId,
        nextNodeId,
        baseSessionState,
        nextPathDirection,
        carriedLogEntry ? [carriedLogEntry] : [],
      );

      resolvedSessionState = resolvedEntryOutcome.sessionState;
      nextNodeId = resolvedEntryOutcome.nodeId;
      nextPathDirection = resolvedEntryOutcome.pathDirection;
    }

    session.sessionState = resolvedSessionState;
    session.route = {
      nodeId: nextNodeId,
      pathDirection: nextPathDirection,
      pathBeatIndex: nextPathDirection ? (nextPathBeatIndex ?? 0) : undefined,
      runNonce: session.route.runNonce,
    };

    if (isNewNodeVisit) {
      if (nextNodeId) {
        delete session.recentLogByNodeId[nextNodeId];
        delete session.actionAttemptsByNodeId[nextNodeId];
      }

      if (nextNodeId && resolvedEntryOutcome && resolvedEntryOutcome.logEntries.length > 0) {
        session.recentLogByNodeId[nextNodeId] = [
          ...(session.recentLogByNodeId[nextNodeId] ?? []),
          ...resolvedEntryOutcome.logEntries,
        ];
      }

      incrementNodeVisitCount(session, nextNodeId);
    }
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
      const outcome = contentRuntime.resolveProjectEnter(projectId, activeNodeId, {
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

  function incrementNodeVisitCount(session: MutableRuntimeSession, nodeId: string | undefined): void {
    if (!nodeId) {
      return;
    }

    const nodePage = contentRuntime.runtime[session.projectId]?.pagesByNodeId[nodeId];

    if (nodePage?.kind !== 'page') {
      return;
    }

    if (nodePage.nodeKind === 'path') {
      session.pathVisitCounts[nodeId] = (session.pathVisitCounts[nodeId] ?? 0) + 1;
      return;
    }

    if (nodePage.nodeKind !== 'area' && nodePage.nodeKind !== 'gate') {
      return;
    }

    session.areaVisitCounts[nodeId] = (session.areaVisitCounts[nodeId] ?? 0) + 1;
  }

  function getNextActionAttempt(
    session: MutableRuntimeSession,
    nodeId: string,
    action: ProjectedAction,
  ): number {
    const actionKey = `${action.kind}:${action.id}`;
    const nextAttempt = (session.actionAttemptsByNodeId[nodeId]?.[actionKey] ?? 0) + 1;

    session.actionAttemptsByNodeId[nodeId] = {
      ...(session.actionAttemptsByNodeId[nodeId] ?? {}),
      [actionKey]: nextAttempt,
    };

    return nextAttempt;
  }
}

function appendNodeLog(
  session: MutableRuntimeSession,
  nodeId: string,
  entry: ProjectedLogEntry | undefined,
): void {
  if (!entry) {
    return;
  }

  session.recentLogByNodeId[nodeId] = [...(session.recentLogByNodeId[nodeId] ?? []), entry];
}

function cloneSessionSnapshot(session: MutableRuntimeSession): RuntimeSessionSnapshot {
  return {
    sessionId: session.sessionId,
    projectId: session.projectId,
    route: { ...session.route },
    areaVisitCounts: { ...session.areaVisitCounts },
    pathVisitCounts: { ...session.pathVisitCounts },
    recentLogByNodeId: Object.fromEntries(
      Object.entries(session.recentLogByNodeId).map(([nodeId, entries]) => [nodeId, [...entries]]),
    ),
    actionAttemptsByNodeId: Object.fromEntries(
      Object.entries(session.actionAttemptsByNodeId).map(([nodeId, attempts]) => [nodeId, { ...attempts }]),
    ),
    sessionState: session.sessionState,
  };
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
  const normalizedSessionState = normalizeDemo04ResidentConversation(sessionState, nodeId);

  if (!nodeId) {
    return normalizedSessionState;
  }

  const activePlayerId = getActivePlayerId(normalizedSessionState);
  const nextPlayers = (activePlayerId
    ? {
        ...(asRuntimeRecord(normalizedSessionState.players) ?? {}),
        [activePlayerId]: {
          ...(asRuntimeRecord(asRuntimeRecord(normalizedSessionState.players)?.[activePlayerId]) ?? {}),
          location: nodeId,
        },
      }
    : normalizedSessionState.players) as RuntimeSessionState['players'];

  return {
    ...normalizedSessionState,
    player: {
      ...(asRuntimeRecord(normalizedSessionState.player) ?? {}),
      location: nodeId,
      active: {
        ...(asRuntimeRecord(asRuntimeRecord(normalizedSessionState.player)?.active) ?? {}),
        ...(activePlayerId ? { id: activePlayerId } : {}),
        location: nodeId,
      },
    },
    players: nextPlayers,
  };
}

function normalizeDemo04ResidentConversation(
  sessionState: RuntimeSessionState,
  nodeId: string | undefined,
): RuntimeSessionState {
  if (nodeId === 'building04_groundfloor') {
    return sessionState;
  }

  const storyState = asRuntimeRecord(sessionState.story);
  const residentStoryState = asRuntimeRecord(storyState?.resident_01);

  if (!residentStoryState || residentStoryState.dialog_topic === 'idle') {
    return sessionState;
  }

  return {
    ...sessionState,
    story: {
      ...storyState,
      resident_01: {
        ...residentStoryState,
        dialog_topic: 'idle',
      },
    },
  };
}

export function normalizeSessionStateForPersistedContinue(
  sessionState: RuntimeSessionState,
): RuntimeSessionState {
  const storyState = asRuntimeRecord(sessionState.story);
  const residentStoryState = asRuntimeRecord(storyState?.resident_01);

  if (!residentStoryState || residentStoryState.dialog_topic === 'idle') {
    return sessionState;
  }

  return {
    ...sessionState,
    story: {
      ...storyState,
      resident_01: {
        ...residentStoryState,
        dialog_topic: 'idle',
      },
    },
  };
}

function asRuntimeRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RuntimeSessionObject)
    : undefined;
}