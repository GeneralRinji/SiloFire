import { buildContentProjectRecord, isContentProjectAvailable, type ContentProjectRecord } from '../../content';
import { parseNpcSidecar, parseStateSidecar, parseTimeSettingsSidecar, parseWeatherSettingsSidecar } from '../../parser/src';
import { resolveProjectClockSnapshot, resolveRuntimeClockPhases, type PreviewRuntimeClockSnapshot } from '../../runtime/src/runtimeClock';
import { resolveAssignedProjectCalendar } from '../../runtime/src/runtimeClock';
import { resolveRuntimeAmbientSnapshot, type RuntimeAmbientNpcSnapshot, type RuntimeAmbientNpcStateSeed, type RuntimeAmbientSnapshot } from '../../../apps/web/src/runtimeAmbient';
import {
  buildRuntimeWeatherLogEntry,
  resolveAssignedRuntimeWeatherSnapshot,
  resolveRuntimeWeatherProjectSnapshot,
  shouldAnnounceWeatherChange,
  type RuntimeWeatherProjectSnapshot,
  type RuntimeWeatherSnapshot,
} from '../../../apps/web/src/runtimeWeather';
import {
  buildRuntimeTimeLogEntry,
  resolveAssignedRuntimeTimeSnapshot,
  shouldAnnounceTimeChange,
  type RuntimeTimeSnapshot,
} from '../../../apps/web/src/runtimeTime';
import type { ContentNpcDefinition } from '../../schema/src';
import type { RuntimeClockSnapshot, RuntimeClockSource } from '../../runtime/src';
import type { RuntimeSessionState } from '../../runtime/src';
import type { KeyValueStore } from '../../storage/src';
import {
  createRuntimeSessionServiceForContentFiles,
  normalizeSessionStateForPersistedContinue,
  type CreateRuntimeSessionOptions,
  type RuntimeSessionProjectMetadata,
  type RuntimeSessionService,
  type RuntimeSessionSnapshot,
  type RuntimeSessionView,
} from './runtimeSessionService';
import type { ProjectedAction, ProjectedControl } from '../../projection/src';

export * from './runtimeSessionService';

const DEFAULT_CONTENT_ROOT = 'packages/content';
const TITLE_SCREEN_NEW_GAME_ACTION_ID = 'title_screen_new_game';
const TITLE_SCREEN_CONTINUE_ACTION_ID = 'title_screen_continue';

export interface RuntimeDirectoryEntry {
  name: string;
  isFile: boolean;
}

export interface RuntimeContentStore {
  readText(path: string): Promise<string | undefined>;
  readDirectory(path: string): Promise<RuntimeDirectoryEntry[]>;
}

export type RuntimeApiRouteMatch =
  | { kind: 'project_list' }
  | { kind: 'clock_snapshot'; projectId: string; nodeId?: string; nodeRegion?: string }
  | { kind: 'clock_stream'; projectId: string; nodeId?: string; nodeRegion?: string }
  | { kind: 'weather_stream'; projectId: string }
  | { kind: 'ambient_stream'; projectId: string }
  | { kind: 'session_create'; projectId: string }
  | { kind: 'session_restore'; projectId: string }
  | { kind: 'session_snapshot'; sessionId: string }
  | { kind: 'session_action'; sessionId: string }
  | { kind: 'session_control'; sessionId: string }
  | { kind: 'session_reset'; sessionId: string };

export interface RuntimeApiService {
  listProjects(): Promise<ContentProjectRecord[]>;
  getClockSnapshot(projectId: string, nodeId?: string, nodeRegion?: string): Promise<PreviewRuntimeClockSnapshot | undefined>;
  getWeatherProjectSnapshot(projectId: string): Promise<RuntimeWeatherProjectSnapshot | undefined>;
  getAmbientSnapshot(projectId: string): Promise<RuntimeAmbientSnapshot>;
  createSession(projectId: string, options?: CreateRuntimeSessionOptions): Promise<RuntimeSessionView | undefined>;
  restoreSession(projectId: string, snapshot: Omit<RuntimeSessionSnapshot, 'sessionId'>): Promise<RuntimeSessionView | undefined>;
  getSession(sessionId: string): Promise<RuntimeSessionView | undefined>;
  applySessionAction(sessionId: string, action: ProjectedAction): Promise<RuntimeSessionView | undefined>;
  applySessionControl(sessionId: string, control: ProjectedControl): Promise<RuntimeSessionView | undefined>;
  resetSession(sessionId: string, destinationNodeId?: string): Promise<RuntimeSessionView | undefined>;
}

export interface PersistedRuntimeSessionSnapshot extends Omit<RuntimeSessionSnapshot, 'sessionId'> {
  savedAt: number;
}

export function matchRuntimeApiRequest(url: string): RuntimeApiRouteMatch | undefined {
  if (/^\/api\/runtime-projects(?:\?.*)?$/.test(url)) {
    return {
      kind: 'project_list',
    };
  }

  const sessionRestoreMatch = /^\/api\/runtime-session\/([^/?#]+)\/restore(?:\?.*)?$/.exec(url);

  if (sessionRestoreMatch) {
    return {
      kind: 'session_restore',
      projectId: decodeURIComponent(sessionRestoreMatch[1]),
    };
  }

  const sessionCreateMatch = /^\/api\/runtime-session\/([^/?#]+)\/start(?:\?.*)?$/.exec(url);

  if (sessionCreateMatch) {
    return {
      kind: 'session_create',
      projectId: decodeURIComponent(sessionCreateMatch[1]),
    };
  }

  const sessionActionMatch = /^\/api\/runtime-session\/([^/?#]+)\/action(?:\?.*)?$/.exec(url);

  if (sessionActionMatch) {
    return {
      kind: 'session_action',
      sessionId: decodeURIComponent(sessionActionMatch[1]),
    };
  }

  const sessionControlMatch = /^\/api\/runtime-session\/([^/?#]+)\/control(?:\?.*)?$/.exec(url);

  if (sessionControlMatch) {
    return {
      kind: 'session_control',
      sessionId: decodeURIComponent(sessionControlMatch[1]),
    };
  }

  const sessionResetMatch = /^\/api\/runtime-session\/([^/?#]+)\/reset(?:\?.*)?$/.exec(url);

  if (sessionResetMatch) {
    return {
      kind: 'session_reset',
      sessionId: decodeURIComponent(sessionResetMatch[1]),
    };
  }

  const sessionSnapshotMatch = /^\/api\/runtime-session\/([^/?#]+)(?:\?.*)?$/.exec(url);

  if (sessionSnapshotMatch) {
    return {
      kind: 'session_snapshot',
      sessionId: decodeURIComponent(sessionSnapshotMatch[1]),
    };
  }

  const ambientStreamMatch = /^\/api\/runtime-ambient\/([^/?#]+)\/stream(?:\?.*)?$/.exec(url);

  if (ambientStreamMatch) {
    return {
      kind: 'ambient_stream',
      projectId: decodeURIComponent(ambientStreamMatch[1]),
    };
  }

  const weatherStreamMatch = /^\/api\/runtime-weather\/([^/?#]+)\/stream(?:\?.*)?$/.exec(url);

  if (weatherStreamMatch) {
    return {
      kind: 'weather_stream',
      projectId: decodeURIComponent(weatherStreamMatch[1]),
    };
  }

  const clockStreamMatch = /^\/api\/runtime-clock\/([^/?#]+)\/stream(?:\?.*)?$/.exec(url);

  if (clockStreamMatch) {
    const requestUrl = new URL(url, 'http://localhost');
    return {
      kind: 'clock_stream',
      projectId: decodeURIComponent(clockStreamMatch[1]),
      nodeId: requestUrl.searchParams.get('nodeId') ?? undefined,
      nodeRegion: requestUrl.searchParams.get('nodeRegion') ?? undefined,
    };
  }

  const clockSnapshotMatch = /^\/api\/runtime-clock\/([^/?#]+)(?:\?.*)?$/.exec(url);

  if (clockSnapshotMatch) {
    const requestUrl = new URL(url, 'http://localhost');
    return {
      kind: 'clock_snapshot',
      projectId: decodeURIComponent(clockSnapshotMatch[1]),
      nodeId: requestUrl.searchParams.get('nodeId') ?? undefined,
      nodeRegion: requestUrl.searchParams.get('nodeRegion') ?? undefined,
    };
  }

  return undefined;
}

export function createRuntimeApiService(
  store: RuntimeContentStore,
  options: {
    contentRoot?: string;
    now?: () => number;
    snapshotStore?: KeyValueStore<PersistedRuntimeSessionSnapshot>;
    clockSeedMs?: number;
  } = {},
): RuntimeApiService {
  const contentRoot = options.contentRoot ?? DEFAULT_CONTENT_ROOT;
  const now = options.now ?? (() => Date.now());
  const snapshotStore = options.snapshotStore ?? createMemorySnapshotStore();
  const clockSeedMs = options.clockSeedMs ?? 0;
  const clockAnchorMsByProjectId = new Map<string, number>();
  const weatherAnchorMsByPatternKey = new Map<string, number>();
  const runtimeSessionServicesBySessionId = new Map<string, RuntimeSessionService>();
  const sessionProjectIdsBySessionId = new Map<string, string>();
  const lastObservedTimeBySessionId = new Map<string, { nodeId?: string; snapshot?: RuntimeTimeSnapshot }>();
  const lastObservedWeatherBySessionId = new Map<string, { nodeId?: string; snapshot?: RuntimeWeatherSnapshot }>();
  const lastObservedAmbientBySessionId = new Map<string, Record<string, RuntimeAmbientNpcSnapshot>>();

  return {
    async listProjects() {
      const entries = await store.readDirectory(contentRoot);
      const projectIds = entries
        .filter((entry) => !entry.isFile)
        .map((entry) => entry.name)
        .filter((projectId) => isContentProjectAvailable(projectId));
      const projects = await Promise.all(projectIds.map(async (projectId) => {
        const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
        const projectMetadata = runtimeSessionService?.getProjectMetadata(projectId);

        if (!projectMetadata) {
          return undefined;
        }

        return buildContentProjectRecord(projectId, 'playable-demo');
      }));

      return projects.filter((project): project is ContentProjectRecord => Boolean(project));
    },
    async getClockSnapshot(projectId, nodeId, nodeRegion) {
      const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
      const projectMetadata = runtimeSessionService?.getProjectMetadata(projectId);

      if (!projectMetadata?.timeSettings) {
        return undefined;
      }

      ensureClockAnchor(projectId, projectMetadata);
      const snapshot = resolveProjectClockSnapshot({
        projectId,
        timeSettings: projectMetadata.timeSettings,
        defaultClock: projectMetadata.defaultClock,
        nodeFoldersById: projectMetadata.nodeFoldersById,
        nodeRegionsById: projectMetadata.nodeRegionsById,
      }, now(), clockAnchorMsByProjectId, nodeId, nodeRegion ?? (nodeId ? projectMetadata.nodeRegionsById[nodeId] : undefined));

      if (!snapshot) {
        return undefined;
      }

      return {
        ...snapshot,
        source: resolveClockSourceLabel(projectMetadata.timeSettings, projectMetadata.defaultClock),
      };
    },
    async getWeatherProjectSnapshot(projectId) {
      const settingsPath = joinPath(contentRoot, projectId, 'settings', 'weather.yaml');
      const settingsSource = await store.readText(settingsPath);

      if (!settingsSource) {
        return undefined;
      }

      const parsedWeatherSettings = parseWeatherSettingsSidecar(settingsSource, settingsPath);

      if (!parsedWeatherSettings.value || parsedWeatherSettings.errors.length > 0) {
        return undefined;
      }

      return resolveRuntimeWeatherProjectSnapshot({
        projectId,
        weatherSettings: parsedWeatherSettings.value,
      }, now(), weatherAnchorMsByPatternKey);
    },
    async getAmbientSnapshot(projectId) {
      const npcDefinitionsById = await collectNpcDefinitions(store, contentRoot, projectId);
      const npcStateSeedsById = await extractNpcStateSeeds(store, contentRoot, projectId);
      return resolveRuntimeAmbientSnapshot(npcDefinitionsById, now(), undefined, npcStateSeedsById);
    },
    async createSession(projectId, sessionOptions) {
      const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
      const sessionView = runtimeSessionService?.createSession(projectId, sessionOptions);

      if (sessionView) {
        rememberSession(projectId, sessionView.snapshot.sessionId, runtimeSessionService);
      }

      return decorateAndPersistSessionView(runtimeSessionService, sessionView);
    },
    async restoreSession(projectId, snapshot) {
      const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
      const sessionView = runtimeSessionService?.restoreSession(projectId, snapshot);

      if (sessionView) {
        rememberSession(projectId, sessionView.snapshot.sessionId, runtimeSessionService);
      }

      return decorateAndPersistSessionView(runtimeSessionService, sessionView);
    },
    async getSession(sessionId) {
      const runtimeSessionService = await getRuntimeSessionServiceForSession(sessionId);
      return decorateAndPersistSessionView(runtimeSessionService, runtimeSessionService?.getSession(sessionId));
    },
    async applySessionAction(sessionId, action) {
      const runtimeSessionService = await getRuntimeSessionServiceForSession(sessionId);

      if (!runtimeSessionService) {
        return undefined;
      }

      if (action.id === TITLE_SCREEN_NEW_GAME_ACTION_ID) {
        const currentSessionView = runtimeSessionService.getSession(sessionId);
        const newGameAction = selectFreshStartAction(currentSessionView?.page);
        const sessionView = newGameAction ? runtimeSessionService.applyAction(sessionId, newGameAction) : undefined;

        if (sessionView) {
          rememberSession(sessionView.snapshot.projectId, sessionView.snapshot.sessionId, runtimeSessionService, sessionId);
        }

        return decorateAndPersistSessionView(runtimeSessionService, sessionView);
      }

      if (action.id === TITLE_SCREEN_CONTINUE_ACTION_ID) {
        const projectId = sessionProjectIdsBySessionId.get(sessionId);
        const persistedSnapshot = projectId ? await snapshotStore.get(projectSnapshotKey(projectId)) : undefined;
        const freshRuntimeSessionService = projectId ? await createFreshRuntimeSessionService(projectId) : undefined;
        const sessionView = projectId && persistedSnapshot && freshRuntimeSessionService
          ? freshRuntimeSessionService.restoreSession(projectId, persistedSnapshot)
          : undefined;

        if (sessionView && freshRuntimeSessionService) {
          rememberSession(projectId, sessionView.snapshot.sessionId, freshRuntimeSessionService, sessionId);
        }

        return decorateAndPersistSessionView(freshRuntimeSessionService, sessionView);
      }

      const sessionView = runtimeSessionService.applyAction(sessionId, action);

      if (sessionView && runtimeSessionService) {
        rememberSession(sessionView.snapshot.projectId, sessionView.snapshot.sessionId, runtimeSessionService, sessionId);
      }

      return decorateAndPersistSessionView(runtimeSessionService, sessionView);
    },
    async applySessionControl(sessionId, control) {
      const runtimeSessionService = await getRuntimeSessionServiceForSession(sessionId);
      const sessionView = runtimeSessionService?.applyControl(sessionId, control);

      if (sessionView && runtimeSessionService) {
        rememberSession(sessionView.snapshot.projectId, sessionView.snapshot.sessionId, runtimeSessionService, sessionId);
      }

      return decorateAndPersistSessionView(runtimeSessionService, sessionView);
    },
    async resetSession(sessionId, destinationNodeId) {
      const projectId = sessionProjectIdsBySessionId.get(sessionId);
      const runtimeSessionService = await getRuntimeSessionServiceForSession(sessionId);

      if (!projectId || !runtimeSessionService) {
        return undefined;
      }

      const currentSessionView = runtimeSessionService.getSession(sessionId);

      if (!currentSessionView) {
        clearSession(sessionId);
        return undefined;
      }

      const freshRuntimeSessionService = await createFreshRuntimeSessionService(projectId);
      const restoredSessionView = freshRuntimeSessionService?.restoreSession(projectId, {
        projectId: currentSessionView.snapshot.projectId,
        route: currentSessionView.snapshot.route,
        areaVisitCounts: currentSessionView.snapshot.areaVisitCounts,
        pathVisitCounts: currentSessionView.snapshot.pathVisitCounts,
        recentLogByNodeId: currentSessionView.snapshot.recentLogByNodeId,
        actionAttemptsByNodeId: currentSessionView.snapshot.actionAttemptsByNodeId,
        sessionState: currentSessionView.snapshot.sessionState,
      });

      if (!restoredSessionView || !freshRuntimeSessionService) {
        return undefined;
      }

      const resetView = freshRuntimeSessionService.resetSession(restoredSessionView.snapshot.sessionId, destinationNodeId);

      if (!resetView) {
        return undefined;
      }

      rememberSession(projectId, resetView.snapshot.sessionId, freshRuntimeSessionService, sessionId);
      return decorateAndPersistSessionView(freshRuntimeSessionService, resetView, { clearExistingSnapshot: true });
    },
  };

  async function getRuntimeSessionServiceForSession(sessionId: string): Promise<RuntimeSessionService | undefined> {
    return runtimeSessionServicesBySessionId.get(sessionId);
  }

  async function createFreshRuntimeSessionService(projectId: string): Promise<RuntimeSessionService | undefined> {
    const contentFiles = await collectProjectContentFiles(store, contentRoot, projectId);

    if (Object.keys(contentFiles).length === 0) {
      return undefined;
    }

    let projectMetadata: RuntimeSessionProjectMetadata | undefined;
    const runtimeClockSource: RuntimeClockSource = {
      getSnapshot(requestedProjectId, nodeId) {
        if (requestedProjectId !== projectId || !projectMetadata?.timeSettings) {
          return undefined;
        }

        ensureClockAnchor(projectId, projectMetadata);
        return resolveProjectClockSnapshot({
          projectId,
          timeSettings: projectMetadata.timeSettings,
          defaultClock: projectMetadata.defaultClock,
          nodeFoldersById: projectMetadata.nodeFoldersById,
          nodeRegionsById: projectMetadata.nodeRegionsById,
        }, now(), clockAnchorMsByProjectId, nodeId, nodeId ? projectMetadata.nodeRegionsById[nodeId] : undefined);
      },
    };
    const runtimeSessionService = createRuntimeSessionServiceForContentFiles(contentFiles, {
      clockSource: runtimeClockSource,
    });
    projectMetadata = runtimeSessionService.getProjectMetadata(projectId);
    return runtimeSessionService;
  }

  function rememberSession(
    projectId: string,
    nextSessionId: string,
    runtimeSessionService: RuntimeSessionService,
    previousSessionId?: string,
  ): void {
    if (previousSessionId && previousSessionId !== nextSessionId) {
      clearSession(previousSessionId);
    }

    sessionProjectIdsBySessionId.set(nextSessionId, projectId);
    runtimeSessionServicesBySessionId.set(nextSessionId, runtimeSessionService);
  }

  function clearSession(sessionId: string): void {
    sessionProjectIdsBySessionId.delete(sessionId);
    runtimeSessionServicesBySessionId.delete(sessionId);
    lastObservedTimeBySessionId.delete(sessionId);
    lastObservedWeatherBySessionId.delete(sessionId);
    lastObservedAmbientBySessionId.delete(sessionId);
  }

  async function decorateAndPersistSessionView(
    runtimeSessionService: RuntimeSessionService | undefined,
    sessionView: RuntimeSessionView | undefined,
    options: { clearExistingSnapshot?: boolean } = {},
  ): Promise<RuntimeSessionView | undefined> {
    if (!runtimeSessionService || !sessionView) {
      return sessionView;
    }

    sessionView = await refreshLiveSessionView(runtimeSessionService, sessionView);

    if (!sessionView) {
      return undefined;
    }

    const projectMetadata = runtimeSessionService.getProjectMetadata(sessionView.snapshot.projectId);

    if (options.clearExistingSnapshot && shouldClearProjectSnapshotOnReset(projectMetadata?.titleScreenSaveMode)) {
      await snapshotStore.delete(projectSnapshotKey(sessionView.snapshot.projectId));
    }

    if (projectMetadata && shouldPersistSessionSnapshot(sessionView.snapshot.route.nodeId, projectMetadata.titleScreenSaveMode)) {
      const persistedSessionState = buildPersistedContinueSessionState(sessionView.snapshot.sessionState);

      await snapshotStore.set(projectSnapshotKey(sessionView.snapshot.projectId), {
        projectId: sessionView.snapshot.projectId,
        route: sessionView.snapshot.route,
        areaVisitCounts: sessionView.snapshot.areaVisitCounts,
        pathVisitCounts: sessionView.snapshot.pathVisitCounts,
        recentLogByNodeId: sessionView.snapshot.recentLogByNodeId,
        actionAttemptsByNodeId: sessionView.snapshot.actionAttemptsByNodeId,
        sessionState: persistedSessionState,
        savedAt: now(),
      });
    }

    const persistedSnapshot = await snapshotStore.get(projectSnapshotKey(sessionView.snapshot.projectId));
    const page = sessionView.page && sessionView.page.kind === 'page'
      ? decorateTitleScreenPage(sessionView.page, projectMetadata, persistedSnapshot)
      : sessionView.page;

    return {
      ...sessionView,
      page,
      project: projectMetadata,
    };
  }

  async function refreshLiveSessionView(
    runtimeSessionService: RuntimeSessionService,
    sessionView: RuntimeSessionView,
  ): Promise<RuntimeSessionView | undefined> {
    const projectMetadata = runtimeSessionService.getProjectMetadata(sessionView.snapshot.projectId);
    const currentNodeId = sessionView.snapshot.route.nodeId;

    if (!projectMetadata) {
      return sessionView;
    }

    let nextSessionState = sessionView.snapshot.sessionState;
    let nextRecentLogByNodeId = sessionView.snapshot.recentLogByNodeId;
    let changed = false;

    const ambientSnapshot = await collectAmbientSnapshot(sessionView.snapshot.projectId);
    const previousAmbientByNpcId = lastObservedAmbientBySessionId.get(sessionView.snapshot.sessionId) ?? {};
    const previousObservedTime = lastObservedTimeBySessionId.get(sessionView.snapshot.sessionId);
    const nextAmbientByNpcId = Object.fromEntries(ambientSnapshot.npcs.map((npc) => [npc.id, npc]));
    const mergedAmbientSessionState = mergeAmbientNpcLocations(nextSessionState, ambientSnapshot.npcs);

    if (JSON.stringify(mergedAmbientSessionState) !== JSON.stringify(nextSessionState)) {
      nextSessionState = mergedAmbientSessionState;
      changed = true;
    }

    if (currentNodeId) {
      const playerEnteredNode = previousObservedTime?.nodeId !== currentNodeId;

      for (const npc of ambientSnapshot.npcs) {
        const previousNpc = previousAmbientByNpcId[npc.id];

        if (playerEnteredNode && isAmbientNpcVisibleFromNode(npc, currentNodeId)) {
          nextRecentLogByNodeId = appendRecentLogEntry(nextRecentLogByNodeId, currentNodeId, createAmbientNpcNodeEntryLogEntry(npc, ambientSnapshot.nowMs));
          changed = true;
          continue;
        }

        if (previousNpc?.nodeId !== currentNodeId && npc.nodeId === currentNodeId) {
          nextRecentLogByNodeId = appendRecentLogEntry(nextRecentLogByNodeId, currentNodeId, createAmbientNpcLogEntry(npc, 'arrival', ambientSnapshot.nowMs));
          changed = true;
        }

        if (previousNpc?.nodeId === currentNodeId && npc.nodeId !== currentNodeId) {
          nextRecentLogByNodeId = appendRecentLogEntry(nextRecentLogByNodeId, currentNodeId, createAmbientNpcLogEntry(previousNpc, 'departure', ambientSnapshot.nowMs));
          changed = true;
        }
      }
    }

    lastObservedAmbientBySessionId.set(sessionView.snapshot.sessionId, nextAmbientByNpcId);

    if (currentNodeId && !isTitleScreenNode(projectMetadata, currentNodeId)) {
      const currentNodeRegion = projectMetadata.nodeRegionsById[currentNodeId];
      ensureClockAnchor(sessionView.snapshot.projectId, projectMetadata);
      const currentClock = resolveProjectClockSnapshot({
        projectId: sessionView.snapshot.projectId,
        timeSettings: projectMetadata.timeSettings,
        defaultClock: projectMetadata.defaultClock,
        nodeFoldersById: projectMetadata.nodeFoldersById,
        nodeRegionsById: projectMetadata.nodeRegionsById,
      }, now(), clockAnchorMsByProjectId, currentNodeId, currentNodeRegion);
      const currentTime = resolveAssignedRuntimeTimeSnapshot(projectMetadata, currentClock, currentNodeId, currentNodeRegion);
      const existingEntries = nextRecentLogByNodeId[currentNodeId];

      if (shouldAnnounceTimeChange({
        currentNodeId,
        previousNodeId: previousObservedTime?.nodeId,
        previousSnapshot: previousObservedTime?.snapshot,
        snapshot: currentTime,
        existingEntries,
      })) {
        const timeEntry = buildRuntimeTimeLogEntry(currentTime);

        if (timeEntry) {
          nextRecentLogByNodeId = appendRecentLogEntry(nextRecentLogByNodeId, currentNodeId, timeEntry);
          changed = true;
        }
      }

      for (const scheduleEntry of buildRuntimeScheduleLogEntries({
        projectMetadata,
        currentNodeId,
        previousNodeId: previousObservedTime?.nodeId,
        previousSnapshot: previousObservedTime?.snapshot,
        snapshot: currentTime,
      })) {
        nextRecentLogByNodeId = appendRecentLogEntry(nextRecentLogByNodeId, currentNodeId, scheduleEntry);
        changed = true;
      }

      lastObservedTimeBySessionId.set(sessionView.snapshot.sessionId, {
        nodeId: currentNodeId,
        snapshot: currentTime,
      });

      const weatherProjectSnapshot = await getWeatherProjectSnapshotForSession(sessionView.snapshot.projectId);
      const currentWeather = weatherProjectSnapshot
        ? resolveAssignedRuntimeWeatherSnapshot(projectMetadata, weatherProjectSnapshot, currentNodeId, currentNodeRegion)
        : projectMetadata.defaultWeather
          ? {
              ...projectMetadata.defaultWeather,
              regionId: currentNodeRegion,
            }
          : undefined;
      const previousObservedWeather = lastObservedWeatherBySessionId.get(sessionView.snapshot.sessionId);
      const existingWeatherEntries = nextRecentLogByNodeId[currentNodeId];

      if (shouldAnnounceWeatherChange({
        currentNodeId,
        previousNodeId: previousObservedWeather?.nodeId,
        previousSnapshot: previousObservedWeather?.snapshot,
        snapshot: currentWeather,
        existingEntries: existingWeatherEntries,
      })) {
        const weatherEntry = buildRuntimeWeatherLogEntry(currentWeather);

        if (weatherEntry) {
          nextRecentLogByNodeId = appendRecentLogEntry(nextRecentLogByNodeId, currentNodeId, weatherEntry);
          changed = true;
        }
      }

      lastObservedWeatherBySessionId.set(sessionView.snapshot.sessionId, {
        nodeId: currentNodeId,
        snapshot: currentWeather,
      });
    } else {
      lastObservedTimeBySessionId.delete(sessionView.snapshot.sessionId);
      lastObservedWeatherBySessionId.delete(sessionView.snapshot.sessionId);
    }

    if (!changed) {
      return sessionView;
    }

    return runtimeSessionService.replaceSession(sessionView.snapshot.sessionId, {
      projectId: sessionView.snapshot.projectId,
      route: sessionView.snapshot.route,
      areaVisitCounts: sessionView.snapshot.areaVisitCounts,
      pathVisitCounts: sessionView.snapshot.pathVisitCounts,
      recentLogByNodeId: nextRecentLogByNodeId,
      actionAttemptsByNodeId: sessionView.snapshot.actionAttemptsByNodeId,
      sessionState: nextSessionState,
    }, {
      reevaluateCurrentNodeEntry: true,
    });
  }

  async function getWeatherProjectSnapshotForSession(projectId: string): Promise<RuntimeWeatherProjectSnapshot | undefined> {
    const settingsPath = joinPath(contentRoot, projectId, 'settings', 'weather.yaml');
    const settingsSource = await store.readText(settingsPath);

    if (!settingsSource) {
      return undefined;
    }

    const parsedWeatherSettings = parseWeatherSettingsSidecar(settingsSource, settingsPath);

    if (!parsedWeatherSettings.value || parsedWeatherSettings.errors.length > 0) {
      return undefined;
    }

    return resolveRuntimeWeatherProjectSnapshot({
      projectId,
      weatherSettings: parsedWeatherSettings.value,
    }, now(), weatherAnchorMsByPatternKey);
  }

  async function collectAmbientSnapshot(projectId: string): Promise<RuntimeAmbientSnapshot> {
    const npcDefinitionsById = await collectNpcDefinitions(store, contentRoot, projectId);
    const npcStateSeedsById = await extractNpcStateSeeds(store, contentRoot, projectId);
    return resolveRuntimeAmbientSnapshot(npcDefinitionsById, now(), undefined, npcStateSeedsById);
  }

  function ensureClockAnchor(
    projectId: string,
    projectClock: {
      projectId: string;
      timeSettings?: RuntimeSessionProjectMetadata['timeSettings'];
      defaultClock?: RuntimeSessionProjectMetadata['defaultClock'];
    },
  ): void {
    const calendarIds = Object.keys(projectClock.timeSettings?.calendars ?? {});

    if (calendarIds.length === 0) {
      const fallbackKey = `${projectId}::*`;

      if (!clockAnchorMsByProjectId.has(fallbackKey)) {
        clockAnchorMsByProjectId.set(fallbackKey, resolveSeededClockAnchorMs(projectClock, clockSeedMs));
      }

      return;
    }

    calendarIds.forEach((calendarId) => {
      const cacheKey = `${projectId}::${calendarId}`;

      if (clockAnchorMsByProjectId.has(cacheKey)) {
        return;
      }

      clockAnchorMsByProjectId.set(cacheKey, resolveSeededClockAnchorMs({
        ...projectClock,
        timeSettings: projectClock.timeSettings
          ? {
            ...projectClock.timeSettings,
            assignments: {
              ...projectClock.timeSettings.assignments,
              defaultCalendar: calendarId,
            },
          }
          : projectClock.timeSettings,
      }, clockSeedMs));
    });
  }
}

function createMemorySnapshotStore(): KeyValueStore<PersistedRuntimeSessionSnapshot> {
  const values = new Map<string, PersistedRuntimeSessionSnapshot>();

  return {
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
    async has(key) {
      return values.has(key);
    },
    async *list(prefix) {
      for (const [key, value] of values.entries()) {
        if (!prefix || key === prefix || key.startsWith(`${prefix}/`)) {
          yield { key, value };
        }
      }
    },
  };
}

function projectSnapshotKey(projectId: string): string {
  return `projects/${projectId}/snapshot`;
}

function shouldPersistSessionSnapshot(
  currentNodeId: string | undefined,
  titleScreenSaveMode: RuntimeSessionProjectMetadata['titleScreenSaveMode'],
): boolean {
  return !(currentNodeId === 'title_screen' && titleScreenSaveMode === 'single');
}

function shouldClearProjectSnapshotOnReset(
  titleScreenSaveMode: RuntimeSessionProjectMetadata['titleScreenSaveMode'],
): boolean {
  return titleScreenSaveMode === 'single';
}

function buildPersistedContinueSessionState(
  sessionState: RuntimeSessionState,
): RuntimeSessionState {
  return normalizeSessionStateForPersistedContinue(sessionState);
}

function isTitleScreenNode(
  projectMetadata: RuntimeSessionProjectMetadata,
  nodeId: string,
): boolean {
  return Boolean(projectMetadata.titleScreenSaveMode) && projectMetadata.startNodeId === nodeId;
}

function decorateTitleScreenPage(
  page: Extract<RuntimeSessionView['page'], { kind: 'page' }>,
  projectMetadata: RuntimeSessionProjectMetadata | undefined,
  persistedSnapshot: PersistedRuntimeSessionSnapshot | undefined,
): Extract<RuntimeSessionView['page'], { kind: 'page' }> {
  if (!projectMetadata || page.nodeId !== projectMetadata.startNodeId || !projectMetadata.titleScreenSaveMode) {
    return page;
  }

  const newGameAction = selectFreshStartAction(page);

  if (!newGameAction) {
    return page;
  }

  const nonExitActions = page.actions.filter((action) => action.kind !== 'exit');

  const actions: ProjectedAction[] = [
    ...nonExitActions,
    {
      ...newGameAction,
      id: TITLE_SCREEN_NEW_GAME_ACTION_ID,
      label: 'New Game',
      key: 'N',
      keyLabel: '[N]',
      meta: undefined,
    },
  ];

  if (persistedSnapshot) {
    actions.push({
      ...newGameAction,
      id: TITLE_SCREEN_CONTINUE_ACTION_ID,
      label: 'Continue',
      key: 'C',
      keyLabel: '[C]',
      meta: formatPersistedSnapshotSummary(persistedSnapshot, projectMetadata),
    });
  }

  return {
    ...page,
    actions,
  };
}

function selectFreshStartAction(page: RuntimeSessionView['page']): ProjectedAction | undefined {
  if (!page || page.kind !== 'page') {
    return undefined;
  }

  const exitActions = page.actions.filter((action) => action.kind === 'exit' && typeof action.targetId === 'string');
  return exitActions.length === 1 ? exitActions[0] : undefined;
}

function formatPersistedSnapshotSummary(
  snapshot: PersistedRuntimeSessionSnapshot,
  projectMetadata: RuntimeSessionProjectMetadata,
): string {
  const nodeLabel = projectMetadata.nodes.find((node) => node.id === snapshot.route.nodeId)?.label ?? snapshot.route.nodeId ?? 'Unknown';
  return `Last: ${nodeLabel} | ${formatRelativeAge(Date.now() - snapshot.savedAt)}`;
}

function formatRelativeAge(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000));

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function resolveSeededClockAnchorMs(
  projectClock: {
    projectId: string;
    timeSettings?: RuntimeSessionProjectMetadata['timeSettings'];
    defaultClock?: RuntimeSessionProjectMetadata['defaultClock'];
  },
  clockSeedMs: number,
): number {
  const phases = resolveRuntimeClockPhases(projectClock.timeSettings, projectClock.defaultClock?.cycle);
  const phaseId = projectClock.defaultClock?.phase;

  if (!phaseId || phases.length === 0) {
    return clockSeedMs;
  }

  let elapsedMs = 0;

  for (const phase of phases) {
    if (phase.id === phaseId) {
      return clockSeedMs - elapsedMs;
    }

    elapsedMs += phase.durationMs;
  }

  return clockSeedMs;
}

function appendRecentLogEntry(
  recentLogByNodeId: RuntimeSessionSnapshot['recentLogByNodeId'],
  nodeId: string,
  entry: RuntimeSessionSnapshot['recentLogByNodeId'][string][number],
): RuntimeSessionSnapshot['recentLogByNodeId'] {
  return {
    ...recentLogByNodeId,
    [nodeId]: [...(recentLogByNodeId[nodeId] ?? []), entry],
  };
}

function asRuntimeRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function mergeAmbientNpcLocations(
  sessionState: RuntimeSessionSnapshot['sessionState'],
  npcs: RuntimeAmbientNpcSnapshot[],
): RuntimeSessionSnapshot['sessionState'] {
  const nextNpcs = {
    ...(asRuntimeRecord(sessionState.npcs) ?? {}),
    ...Object.fromEntries(npcs.map((npc) => [npc.id, {
      ...(asRuntimeRecord(asRuntimeRecord(sessionState.npcs)?.[npc.id]) ?? {}),
      location: npc.nodeId,
      behavior: npc.behavior,
    }])),
  };

  return {
    ...sessionState,
    npcs: nextNpcs,
  };
}

function createAmbientNpcLogEntry(
  npc: RuntimeAmbientNpcSnapshot,
  kind: 'arrival' | 'departure',
  nowMs: number,
): RuntimeSessionSnapshot['recentLogByNodeId'][string][number] {
  const text = pickAmbientNpcText(kind === 'arrival' ? npc.arrivalText : npc.departureText, nowMs)
    ?? (kind === 'arrival'
      ? `${npc.displayName ?? npc.id} arrives.`
      : `${npc.displayName ?? npc.id} moves on.`);

  return {
    id: `ambient:${npc.id}:${kind}:${nowMs}`,
    text,
    lane: 'recent',
  };
}

function createAmbientNpcNodeEntryLogEntry(
  npc: RuntimeAmbientNpcSnapshot,
  nowMs: number,
): RuntimeSessionSnapshot['recentLogByNodeId'][string][number] {
  const text = npc.behavior === 'move'
    ? pickAmbientNpcText(npc.transitText, nowMs) ?? `${npc.displayName ?? npc.id} is moving along the block nearby.`
    : pickAmbientNpcText(npc.presenceText, nowMs) ?? `${npc.displayName ?? npc.id} is already here.`;

  return {
    id: `ambient:${npc.id}:presence:${nowMs}`,
    text,
    lane: 'recent',
  };
}

function isAmbientNpcVisibleFromNode(
  npc: RuntimeAmbientNpcSnapshot,
  nodeId: string,
): boolean {
  if (npc.nodeId === nodeId) {
    return true;
  }

  if (npc.behavior !== 'move') {
    return false;
  }

  return npc.previousNodeId === nodeId || npc.nextNodeId === nodeId;
}

function pickAmbientNpcText(lines: string[], nowMs: number): string | undefined {
  if (lines.length === 0) {
    return undefined;
  }

  return lines[Math.abs(Math.floor(nowMs / 1000)) % lines.length];
}

function buildRuntimeScheduleLogEntries(args: {
  projectMetadata: RuntimeSessionProjectMetadata;
  currentNodeId: string;
  previousNodeId?: string;
  previousSnapshot?: RuntimeTimeSnapshot;
  snapshot?: RuntimeTimeSnapshot;
}): RuntimeSessionSnapshot['recentLogByNodeId'][string] {
  const schedules = args.projectMetadata.timeSettings?.schedules;

  if (!schedules || !args.snapshot?.phase) {
    return [];
  }

  return Object.entries(schedules).flatMap(([scheduleId, schedule]) => {
    if (!schedule.actor?.text?.length || schedule.lane !== 'recent' || schedule.trigger.kind !== 'phase') {
      return [];
    }

    if (schedule.trigger.edge && schedule.trigger.edge !== 'enter') {
      return [];
    }

    if (!matchesRuntimeScheduleTarget(args.projectMetadata, schedule.target, args.currentNodeId)) {
      return [];
    }

    if (!matchesRuntimeSchedulePhase(args.projectMetadata, args.currentNodeId, args.snapshot, schedule.trigger.phaseId, schedule.trigger.phaseGroup)) {
      return [];
    }

    if (!shouldAnnounceRuntimeScheduleEntry(args.previousNodeId, args.currentNodeId, args.previousSnapshot, args.snapshot, schedule.trigger.phaseId, schedule.trigger.phaseGroup, args.projectMetadata)) {
      return [];
    }

    return [createRuntimeScheduleLogEntry(scheduleId, schedule.actor.text, args.snapshot.nowMs ?? 0)];
  });
}

function shouldAnnounceRuntimeScheduleEntry(
  previousNodeId: string | undefined,
  currentNodeId: string,
  previousSnapshot: RuntimeTimeSnapshot | undefined,
  snapshot: RuntimeTimeSnapshot,
  phaseId: string | undefined,
  phaseGroup: string | undefined,
  projectMetadata: RuntimeSessionProjectMetadata,
): boolean {
  if (!previousNodeId) {
    return true;
  }

  if (previousNodeId !== currentNodeId) {
    return false;
  }

  return !matchesRuntimeSchedulePhase(projectMetadata, currentNodeId, previousSnapshot, phaseId, phaseGroup);
}

function matchesRuntimeScheduleTarget(
  projectMetadata: RuntimeSessionProjectMetadata,
  target: { nodes?: string[]; folders?: string[]; regions?: string[]; tags?: string[] } | undefined,
  nodeId: string,
): boolean {
  if (!target) {
    return true;
  }

  if (target.nodes?.length) {
    return target.nodes.includes(nodeId);
  }

  if (target.folders?.length) {
    const folders = projectMetadata.nodeFoldersById[nodeId] ?? [];
    return target.folders.some((folder) => folders.includes(folder));
  }

  if (target.regions?.length) {
    const regionId = projectMetadata.nodeRegionsById[nodeId];
    return typeof regionId === 'string' ? target.regions.includes(regionId) : false;
  }

  return true;
}

function matchesRuntimeSchedulePhase(
  projectMetadata: RuntimeSessionProjectMetadata,
  nodeId: string,
  snapshot: RuntimeTimeSnapshot | undefined,
  phaseId: string | undefined,
  phaseGroup: string | undefined,
): boolean {
  if (!snapshot?.phase) {
    return false;
  }

  if (phaseId && snapshot.phase === phaseId) {
    return true;
  }

  if (!phaseGroup) {
    return false;
  }

  const assignedCalendar = resolveAssignedProjectCalendar(projectMetadata.timeSettings, {
    nodeId,
    nodeFolders: projectMetadata.nodeFoldersById[nodeId],
    nodeRegion: projectMetadata.nodeRegionsById[nodeId],
  });
  const phaseDefinition = assignedCalendar?.calendar.phases?.find((phase) => phase.id === snapshot.phase);
  return Boolean(phaseDefinition?.groups?.includes(phaseGroup));
}

function createRuntimeScheduleLogEntry(
  scheduleId: string,
  actorLines: string[],
  nowMs: number,
): RuntimeSessionSnapshot['recentLogByNodeId'][string][number] {
  return {
    id: `schedule:${scheduleId}:${nowMs}`,
    text: actorLines[0] ?? scheduleId,
    lane: 'recent',
    blocks: actorLines.map((line) => ({
      groupId: 'actor',
      kind: 'paragraph' as const,
      text: line,
    })),
  };
}

async function collectProjectContentFiles(
  store: RuntimeContentStore,
  contentRoot: string,
  projectId: string,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  await visit(joinPath(contentRoot, projectId));
  return files;

  async function visit(path: string): Promise<void> {
    const entries = await store.readDirectory(path);

    await Promise.all(entries.map(async (entry) => {
      const entryPath = joinPath(path, entry.name);

      if (entry.isFile) {
        if (!/\.(md|ya?ml)$/i.test(entry.name)) {
          return;
        }

        const source = await store.readText(entryPath);

        if (source !== undefined) {
          files[entryPath] = source;
        }

        return;
      }

      await visit(entryPath);
    }));
  }
}

async function extractDefaultClock(
  store: RuntimeContentStore,
  contentRoot: string,
  projectId: string,
): Promise<RuntimeClockSnapshot | undefined> {
  const statePath = joinPath(contentRoot, projectId, 'state', 'world.yaml');
  const stateSource = await store.readText(statePath);

  if (!stateSource) {
    return undefined;
  }

  const parsedState = parseStateSidecar(stateSource, statePath);
  const world = parsedState.value?.world;
  const time = world && typeof world === 'object' ? (world as Record<string, unknown>).time : undefined;
  const phase = time && typeof time === 'object' && typeof (time as Record<string, unknown>).phase === 'string'
    ? (time as Record<string, string>).phase
    : undefined;
  const cycleValue = time && typeof time === 'object'
    ? (time as Record<string, unknown>).cycle
    : undefined;
  const cycle = Array.isArray(cycleValue)
    ? cycleValue.filter((entry): entry is string => typeof entry === 'string')
    : undefined;

  if (!phase && !cycle) {
    return undefined;
  }

  return {
    phase,
    cycle,
    source: 'server-seed',
  };
}

async function collectNpcDefinitions(
  store: RuntimeContentStore,
  contentRoot: string,
  projectId: string,
): Promise<Record<string, ContentNpcDefinition>> {
  const npcPaths: string[] = [];
  await visit(joinPath(contentRoot, projectId));
  const definitions = await Promise.all(npcPaths.map((npcPath) => readNpcDefinition(store, npcPath)));

  return Object.fromEntries(definitions.filter((entry): entry is [string, ContentNpcDefinition] => Boolean(entry)));

  async function visit(path: string): Promise<void> {
    const entries = await store.readDirectory(path);

    await Promise.all(entries.map(async (entry) => {
      const entryPath = joinPath(path, entry.name);

      if (entry.isFile) {
        if (/(^|\/)npcs\/[^/]+\.ya?ml$/i.test(entryPath)) {
          npcPaths.push(entryPath);
        }

        return;
      }

      await visit(entryPath);
    }));
  }
}

async function readNpcDefinition(
  store: RuntimeContentStore,
  npcPath: string,
): Promise<[string, ContentNpcDefinition] | undefined> {
  const source = await store.readText(npcPath);

  if (!source) {
    return undefined;
  }

  const parsedNpc = parseNpcSidecar(source, npcPath);

  if (!parsedNpc.value || parsedNpc.errors.length > 0) {
    return undefined;
  }

  return [parsedNpc.value.id, parsedNpc.value];
}

async function extractNpcStateSeeds(
  store: RuntimeContentStore,
  contentRoot: string,
  projectId: string,
): Promise<Record<string, RuntimeAmbientNpcStateSeed>> {
  const statePath = joinPath(contentRoot, projectId, 'state', 'world.yaml');
  const stateSource = await store.readText(statePath);

  if (!stateSource) {
    return {};
  }

  const parsedState = parseStateSidecar(stateSource, statePath);
  const npcsValue = parsedState.value?.npcs;

  if (!npcsValue || typeof npcsValue !== 'object' || Array.isArray(npcsValue)) {
    return {};
  }

  return Object.fromEntries(Object.entries(npcsValue).map(([npcId, value]) => {
    const state = value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

    return [npcId, {
      location: typeof state.location === 'string' ? state.location : undefined,
      routeIndex: typeof state.routeIndex === 'number' ? state.routeIndex : undefined,
      paused: typeof state.paused === 'boolean' ? state.paused : undefined,
    }];
  }));
}

function resolveClockSourceLabel(
  timeSettings: NonNullable<ReturnType<typeof parseTimeSettingsSidecar>['value']>,
  defaultClock: RuntimeClockSnapshot | undefined,
): string {
  const calendars = timeSettings.calendars ?? {};
  const defaultCalendarId = timeSettings.assignments?.defaultCalendar ?? Object.keys(calendars)[0];
  const defaultCalendar = defaultCalendarId ? calendars[defaultCalendarId] : undefined;

  if (defaultCalendar?.epoch) {
    return 'server:calendar-epoch';
  }

  if (defaultClock?.phase || defaultClock?.cycle?.length) {
    return 'server:state-world';
  }

  return 'server';
}

function joinPath(...parts: string[]): string {
  return parts.map((part) => part.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')).filter((part) => part.length > 0).join('/');
}