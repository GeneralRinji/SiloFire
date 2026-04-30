import {
  appendRecentLog,
  createContentRuntime,
  getRuntimeClockSnapshotFromSessionState,
  type ContentRuntimeOptions,
  type RuntimeClockSnapshot,
  type RuntimeFixtureInteractionStateById,
  type RuntimeInteractionOutcome,
  type RuntimeNodeLink,
  type RuntimeProjectionEmission,
  type RuntimeSessionObject,
  type RuntimeSessionState,
  type RuntimeWeatherSnapshot,
} from '../../runtime/src';
import type { ProjectedAction, ProjectedControl, ProjectedFixturePanel, ProjectedLogEntry, ProjectionResult } from '../../projection/src';
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
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById;
  sessionState: RuntimeSessionState;
}

export interface RuntimeSessionView {
  snapshot: RuntimeSessionSnapshot;
  page?: ProjectionResult;
  offeredActions: ProjectedAction[];
  currentAreaVisitCount?: number;
  currentPathVisitCount?: number;
  project?: RuntimeSessionProjectMetadata;
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

export interface RuntimeSessionServiceOptions extends ContentRuntimeOptions {
  initialSessionStateByProjectId?: Record<string, RuntimeSessionState>;
  sessionIdFactory?: () => string;
}

export interface RuntimeSessionProjectionEmissionBatch {
  nodeId: string;
  emissions: RuntimeProjectionEmission[];
}

export interface RuntimeSessionActionResult {
  sessionView?: RuntimeSessionView;
  projectionEmissionBatches: RuntimeSessionProjectionEmissionBatch[];
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
  applyActionDetailed(sessionId: string, action: ProjectedAction): RuntimeSessionActionResult | undefined;
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
  projectionEmissionBatches: RuntimeSessionProjectionEmissionBatch[];
}

export function createRuntimeSessionServiceForContentFiles(
  contentFiles: Record<string, string>,
  options: RuntimeSessionServiceOptions = {},
): RuntimeSessionService {
  const { initialSessionStateByProjectId, sessionIdFactory, ...runtimeOptions } = options;
  const contentRuntime = createContentRuntime(contentFiles, runtimeOptions);
  const sessions = new Map<string, MutableRuntimeSession>();
  let nextSessionId = 1;

  function createSessionId(): string {
    return sessionIdFactory?.() ?? `session_${nextSessionId++}`;
  }

  function createSeededInitialProjectSessionState(projectId: string): RuntimeSessionState {
    const persistedState = initialSessionStateByProjectId?.[projectId];

    return contentRuntime.hydrateProjectSessionState(projectId, undefined, persistedState)
      ?? contentRuntime.createInitialProjectSessionState(projectId);
  }

  const service: RuntimeSessionService = {
    createSession(projectId, sessionOptions = {}) {
      const runtimeProject = contentRuntime.runtime[projectId];

      if (!runtimeProject) {
        return undefined;
      }

      const sessionId = createSessionId();
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
        fixtureInteractionStateById: {},
        sessionState: createSeededInitialProjectSessionState(projectId),
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

      const sessionId = createSessionId();
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
        fixtureInteractionStateById: Object.fromEntries(
          Object.entries(snapshot.fixtureInteractionStateById ?? {}).map(([fixtureId, state]) => [fixtureId, { ...state }]),
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
      session.fixtureInteractionStateById = Object.fromEntries(
        Object.entries(snapshot.fixtureInteractionStateById ?? {}).map(([fixtureId, state]) => [fixtureId, { ...state }]),
      );
      session.sessionState = syncActivePlayerLocation(snapshot.sessionState, snapshot.route.nodeId);

      if (options.reevaluateCurrentNodeEntry) {
        reconcileCurrentNodeEntry(session);
      }

      return buildSessionView(session);
    },
    applyAction(sessionId, action) {
      return service.applyActionDetailed(sessionId, action)?.sessionView;
    },
    applyActionDetailed(sessionId, action) {
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
      session.fixtureInteractionStateById = {};
      session.sessionState = createSeededInitialProjectSessionState(session.projectId);
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

  function applyActionToSession(session: MutableRuntimeSession, action: ProjectedAction): RuntimeSessionActionResult | undefined {
    if (!session.route.nodeId) {
      return undefined;
    }

    const nodeId = session.route.nodeId;
    const projectionEmissionBatches: RuntimeSessionProjectionEmissionBatch[] = [];
    session.sessionState = contentRuntime.hydrateProjectSessionState(session.projectId, nodeId, session.sessionState) ?? session.sessionState;
    const attempt = getNextActionAttempt(session, nodeId, action);
    const actorId = getActivePlayerId(session.sessionState);
    const outcome = contentRuntime.resolveProjectAction(session.projectId, nodeId, action, {
      attempt,
      sessionState: session.sessionState,
      fixtureInteractionStateById: session.fixtureInteractionStateById,
      actorId,
      viewerId: actorId,
    });

    if (outcome.projectionEmissions && outcome.projectionEmissions.length > 0) {
      projectionEmissionBatches.push({
        nodeId,
        emissions: outcome.projectionEmissions,
      });
    }

    if (outcome.resetNodeId) {
      return {
        sessionView: service.resetSession(session.sessionId, outcome.resetNodeId),
        projectionEmissionBatches,
      };
    }

    if (outcome.nextNodeId) {
      const carriedLogEntry = action.kind === 'exit' && outcome.eventResult ? outcome.logEntry : undefined;
      const resolvedEntryOutcome = transitionToNode(
        session,
        outcome.nextNodeId,
        outcome.nextPathDirection,
        outcome.nextPathBeatIndex,
        outcome.sessionState,
        carriedLogEntry,
      );

      if (resolvedEntryOutcome) {
        projectionEmissionBatches.push(...resolvedEntryOutcome.projectionEmissionBatches);
      }

      return {
        sessionView: buildSessionView(session),
        projectionEmissionBatches,
      };
    }

    appendNodeLog(session, nodeId, outcome.logEntry, outcome.replaceNodeLogScope, outcome.clearNodeRecentLog);

    if (outcome.sessionState) {
      session.sessionState = outcome.sessionState;
    }

    if (outcome.fixtureInteractionStateById) {
      session.fixtureInteractionStateById = outcome.fixtureInteractionStateById;
    }

    return {
      sessionView: buildSessionView(session),
      projectionEmissionBatches,
    };
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
    const previousSessionState = session.sessionState;
    session.sessionState = contentRuntime.hydrateProjectSessionState(session.projectId, nodeId, session.sessionState) ?? session.sessionState;
    const currentAreaVisitCount = nodeId ? session.areaVisitCounts[nodeId] : undefined;
    const currentPathVisitCount = nodeId ? session.pathVisitCounts[nodeId] : undefined;
    const basePage = contentRuntime.getProjectedPage(session.projectId, nodeId, pathDirection, {
      areaVisitCount: currentAreaVisitCount,
      pathVisitCount: currentPathVisitCount,
      pathBeatIndex,
      sessionState: session.sessionState,
    });
    appendAutomaticJukeboxQueueAdvanceLog(session, basePage, previousSessionState);
    const pageWithRecentLog = appendRecentLog(
      basePage,
      nodeId ? session.recentLogByNodeId[nodeId] : undefined,
    );
    const actorId = getActivePlayerId(session.sessionState);
    const fixturePanels = contentRuntime.getProjectedFixturePanels(session.projectId, nodeId, {
      sessionState: session.sessionState,
      fixtureInteractionStateById: session.fixtureInteractionStateById,
      actorId,
      viewerId: actorId,
    });
    const page = appendFixturePanels(pageWithRecentLog, fixturePanels);

    return {
      snapshot: cloneSessionSnapshot(session),
      page,
      offeredActions: contentRuntime.getOfferedActions(session.projectId, nodeId, {
        sessionState: session.sessionState,
        fixtureInteractionStateById: session.fixtureInteractionStateById,
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
  ): ResolvedNodeEntry | undefined {
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

    return resolvedEntryOutcome;
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
        projectionEmissionBatches: [],
      };
    }

    const seenNodes = new Set<string>();
    let activeNodeId = nodeId;
    let activePathDirection = pathDirection;
    let activeSessionState = syncActivePlayerLocation(sessionState, activeNodeId);
    const logEntries = [...carriedLogEntries];
    const projectionEmissionBatches: RuntimeSessionProjectionEmissionBatch[] = [];

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

      if (activeNodeId && outcome.projectionEmissions && outcome.projectionEmissions.length > 0) {
        projectionEmissionBatches.push({
          nodeId: activeNodeId,
          emissions: outcome.projectionEmissions,
        });
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
      projectionEmissionBatches,
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
  replaceScope?: string,
  clearNodeRecentLog?: boolean,
): void {
  if (!entry) {
    return;
  }

  const existingEntries = clearNodeRecentLog ? [] : (session.recentLogByNodeId[nodeId] ?? []);
  const nextEntries = replaceScope
    ? existingEntries.filter((existingEntry) => existingEntry.scope !== replaceScope)
    : existingEntries;

  session.recentLogByNodeId[nodeId] = [...nextEntries, entry];
}

function appendFixturePanels(
  page: ProjectionResult | undefined,
  fixturePanels: ProjectedFixturePanel[],
): ProjectionResult | undefined {
  if (!page || page.kind !== 'page' || fixturePanels.length === 0) {
    return page;
  }

  return {
    ...page,
    fixturePanels,
  };
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
    fixtureInteractionStateById: Object.fromEntries(
      Object.entries(session.fixtureInteractionStateById).map(([fixtureId, state]) => [fixtureId, { ...state }]),
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
  const normalizedState = normalizeSessionStateForPersistedWorldState(sessionState);
  const storyState = asRuntimeRecord(normalizedState.story);
  const residentStoryState = asRuntimeRecord(storyState?.resident_01);

  if (!residentStoryState || residentStoryState.dialog_topic === 'idle') {
    return normalizedState;
  }

  return {
    ...normalizedState,
    story: {
      ...storyState,
      resident_01: {
        ...residentStoryState,
        dialog_topic: 'idle',
      },
    },
  };
}

export function normalizeSessionStateForPersistedWorldState(
  sessionState: RuntimeSessionState,
): RuntimeSessionState {
  const objectsState = asRuntimeRecord(sessionState.objects);

  if (!objectsState) {
    return sessionState;
  }

  let changed = false;
  const nextObjectsState = Object.fromEntries(
    Object.entries(objectsState).map(([objectId, objectState]) => {
      const runtimeObjectState = asRuntimeRecord(objectState);

      if (!runtimeObjectState) {
        return [objectId, objectState];
      }

      const hasPrivateFixtureFields = Object.prototype.hasOwnProperty.call(runtimeObjectState, 'focused')
        || Object.prototype.hasOwnProperty.call(runtimeObjectState, 'browseIndex')
        || Object.prototype.hasOwnProperty.call(runtimeObjectState, 'fakeCredits');

      if (!hasPrivateFixtureFields) {
        return [objectId, objectState];
      }

      const {
        focused: _focused,
        browseIndex: _browseIndex,
        fakeCredits: _fakeCredits,
        ...nextObjectState
      } = runtimeObjectState;
      changed = true;
      return [objectId, nextObjectState];
    }),
  );

  return changed
    ? {
        ...sessionState,
        objects: nextObjectsState,
      }
    : sessionState;
}

function appendAutomaticJukeboxQueueAdvanceLog(
  session: MutableRuntimeSession,
  page: ProjectionResult | undefined,
  previousSessionState: RuntimeSessionState,
): void {
  if (!page || page.kind !== 'page' || !page.nodeId) {
    return;
  }

  const currentNowMs = getSessionClockNowMs(session.sessionState);

  if (typeof currentNowMs !== 'number') {
    return;
  }

  for (const action of page.actions) {
    if (action.kind !== 'poi') {
      continue;
    }

    const previousJukeboxState = getRuntimeObjectState(previousSessionState, action.id);
    const nextJukeboxState = getRuntimeObjectState(session.sessionState, action.id);
    const previousTrackId = getRuntimeStringField(previousJukeboxState, 'currentTrack');
    const nextTrackId = getRuntimeStringField(nextJukeboxState, 'currentTrack');
    const previousTrackEndsAtMs = getRuntimeNumberField(previousJukeboxState, 'currentTrackEndsAtMs');

    if (!previousTrackId) {
      continue;
    }

    if (typeof previousTrackEndsAtMs !== 'number' || previousTrackEndsAtMs > currentNowMs) {
      continue;
    }

    if (!nextTrackId) {
      appendNodeLog(session, page.nodeId, createAutomaticJukeboxQueueFinishedLogEntry(action.label));
      return;
    }

    if (previousTrackId === nextTrackId) {
      continue;
    }

    appendNodeLog(session, page.nodeId, createAutomaticJukeboxQueueAdvanceLogEntry(action.label, getRuntimeStringField(nextJukeboxState, 'currentTrackLabel')));
    return;
  }
}

function createAutomaticJukeboxQueueAdvanceLogEntry(
  fixtureLabel: string,
  trackLabel: string | undefined,
): ProjectedLogEntry {
  return {
    text: `${fixtureLabel.trim().toLowerCase()} clicks over to ${formatPersistedJukeboxTrackLabel(trackLabel)}.`,
    lane: 'recent',
  };
}

function createAutomaticJukeboxQueueFinishedLogEntry(
  fixtureLabel: string,
): ProjectedLogEntry {
  return {
    text: `${fixtureLabel.trim().toLowerCase()} finishes the last queued song and falls quiet.`,
    lane: 'recent',
  };
}

function formatPersistedJukeboxTrackLabel(trackLabel: string | undefined): string {
  if (!trackLabel) {
    return 'the next record';
  }

  const separator = ' by ';
  const separatorIndex = trackLabel.indexOf(separator);

  if (separatorIndex === -1) {
    return `**${trackLabel}**`;
  }

  const title = trackLabel.slice(0, separatorIndex).trim();
  const artist = trackLabel.slice(separatorIndex + separator.length).trim();

  return artist.length > 0
    ? `**${title}** by ${artist}`
    : `**${title}**`;
}

function formatRuntimeDurationText(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getSessionClockNowMs(sessionState: RuntimeSessionState): number | undefined {
  const nowMs = getRuntimeClockSnapshotFromSessionState(sessionState)?.nowMs;

  return typeof nowMs === 'number' && Number.isFinite(nowMs)
    ? nowMs
    : undefined;
}

function getRuntimeObjectState(
  sessionState: RuntimeSessionState,
  objectId: string,
): Record<string, unknown> | undefined {
  const objectsState = asRuntimeRecord(sessionState.objects);
  return asRuntimeRecord(objectsState?.[objectId]);
}

function getRuntimeStringField(
  record: Record<string, unknown> | undefined,
  fieldName: string,
): string | undefined {
  const value = record?.[fieldName];

  return typeof value === 'string' && value.length > 0 && value !== 'none'
    ? value
    : undefined;
}

function getRuntimeNumberField(
  record: Record<string, unknown> | undefined,
  fieldName: string,
): number | undefined {
  const value = record?.[fieldName];

  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getRuntimeStringArrayField(
  record: Record<string, unknown> | undefined,
  fieldName: string,
): string[] {
  const value = record?.[fieldName];

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
}

function asRuntimeRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RuntimeSessionObject)
    : undefined;
}