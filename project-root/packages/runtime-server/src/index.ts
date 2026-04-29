import { buildContentProjectRecord, isContentProjectAvailable, type ContentProjectRecord } from '../../content';
import { parseNpcSidecar, parsePredicateSidecar, parseStateSidecar, parseTimeSettingsSidecar, parseWeatherSettingsSidecar } from '../../parser/src';
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
  buildAdminSiteAnnouncementSnapshot,
  buildSiteAnnouncementSnapshot,
  createSiteAnnouncementRecord,
  getSiteAnnouncementRecord,
  siteAnnouncementKey,
  validateSiteAnnouncementInput,
  type AdminSiteAnnouncementSnapshot,
  type SiteAnnouncementMutationResult,
  type SiteAnnouncementRecord,
  type SiteAnnouncementSnapshot,
} from './siteAnnouncements';
import {
  createRuntimeSessionServiceForContentFiles,
  normalizeSessionStateForPersistedContinue,
  normalizeSessionStateForPersistedWorldState,
  type CreateRuntimeSessionOptions,
  type RuntimeSessionProjectMetadata,
  type RuntimeSessionService,
  type RuntimeSessionSnapshot,
  type RuntimeSessionView,
} from './runtimeSessionService';
import type { ProjectedAction, ProjectedControl, ProjectedLogEntry } from '../../projection/src';
import { JUKEBOX_CATALOGS, type JukeboxCatalogSong } from '../../runtime/src/jukeboxCatalogs';

export * from './runtimeSessionService';
export * from './schedulerCore';
export * from './siteAnnouncements';

const DEFAULT_CONTENT_ROOT = 'packages/content';
const TITLE_SCREEN_NEW_GAME_ACTION_ID = 'title_screen_new_game';
const TITLE_SCREEN_CONTINUE_ACTION_ID = 'title_screen_continue';
const PROTOTYPEHUB_LOBBY_DOOR_AUTO_CLOSE_MS = 10_000;
const JUKEBOX_LOBBY_ATMOSPHERE_INTERVAL_MS = 45_000;

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
  | { kind: 'site_announcement_stream' }
  | { kind: 'site_announcement_snapshot' }
  | { kind: 'admin_site_announcement_snapshot' }
  | { kind: 'admin_site_announcement_item'; announcementId: string }
  | { kind: 'heart_update'; projectId: string; nodeId: string }
  | { kind: 'admin_heart_overview' }
  | { kind: 'admin_heart_project'; projectId: string }
  | { kind: 'admin_heart_reset'; projectId: string }
  | { kind: 'admin_jukebox_reset'; projectId: string }
  | { kind: 'clock_snapshot'; projectId: string; nodeId?: string; nodeRegion?: string }
  | { kind: 'clock_stream'; projectId: string; nodeId?: string; nodeRegion?: string }
  | { kind: 'weather_stream'; projectId: string }
  | { kind: 'ambient_stream'; projectId: string }
  | { kind: 'session_create'; projectId: string }
  | { kind: 'session_restore'; projectId: string }
  | { kind: 'session_stream'; sessionId: string }
  | { kind: 'session_snapshot'; sessionId: string }
  | { kind: 'session_action'; sessionId: string }
  | { kind: 'session_control'; sessionId: string }
  | { kind: 'session_reset'; sessionId: string };

export interface RuntimeApiService {
  listProjects(): Promise<ContentProjectRecord[]>;
  getSiteAnnouncementSnapshot(): Promise<SiteAnnouncementSnapshot>;
  getAdminSiteAnnouncementSnapshot(): Promise<AdminSiteAnnouncementSnapshot>;
  createSiteAnnouncement(input: unknown): Promise<SiteAnnouncementMutationResult>;
  updateSiteAnnouncement(announcementId: string, input: unknown): Promise<SiteAnnouncementMutationResult>;
  deleteSiteAnnouncement(announcementId: string): Promise<boolean>;
  isAdminPasswordValid(password: string | undefined): boolean;
  setHeart(projectId: string, nodeId: string, hearted: boolean): Promise<RuntimeHeartCount | undefined>;
  listHeartAdminOverview(): Promise<RuntimeAdminProjectHeartSummary[]>;
  getHeartAdminProject(projectId: string): Promise<RuntimeAdminProjectHeartDetails | undefined>;
  resetProjectHearts(projectId: string): Promise<boolean>;
  resetProjectJukeboxes(projectId: string): Promise<string[]>;
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

export interface PersistedContinueSessionState extends Omit<RuntimeSessionSnapshot, 'sessionId'> {
  savedAt: number;
}

export interface PersistedProjectWorldState {
  projectId: string;
  sessionState: RuntimeSessionState;
  savedAt: number;
}

export type PersistedRuntimeSessionSnapshot = PersistedContinueSessionState;

export interface RuntimeHeartCount {
  projectId: string;
  nodeId: string;
  count: number;
}

export interface RuntimeAdminProjectHeartSummary {
  projectId: string;
  title: string;
  totalHearts: number;
  nodeCount: number;
}

export interface RuntimeAdminProjectHeartNodeDetails {
  nodeId: string;
  label: string;
  heartCount: number;
}

export interface RuntimeAdminProjectHeartDetails {
  projectId: string;
  title: string;
  totalHearts: number;
  nodes: RuntimeAdminProjectHeartNodeDetails[];
  nodeList: Array<{
    nodeId: string;
    label: string;
  }>;
  activeClock?: PreviewRuntimeClockSnapshot;
  activeWeather?: RuntimeWeatherProjectSnapshot;
  activeAmbient?: RuntimeAmbientSnapshot;
  sessionNpcStateById?: Record<string, {
    location?: string;
    behavior?: string;
  }>;
  sessionObjectStateById?: Record<string, Record<string, string | number | boolean>>;
  objectFieldDetailsById?: Record<string, Record<string, {
    currentValue?: string | number | boolean;
    defaultValue?: string | number | boolean;
    possibleValues: Array<string | number | boolean>;
  }>>;
}

export function matchRuntimeApiRequest(url: string): RuntimeApiRouteMatch | undefined {
  if (/^\/api\/runtime-projects(?:\?.*)?$/.test(url)) {
    return {
      kind: 'project_list',
    };
  }

  if (/^\/api\/site-announcements\/stream(?:\?.*)?$/.test(url)) {
    return {
      kind: 'site_announcement_stream',
    };
  }

  if (/^\/api\/site-announcements(?:\?.*)?$/.test(url)) {
    return {
      kind: 'site_announcement_snapshot',
    };
  }

  const adminSiteAnnouncementItemMatch = /^\/api\/runtime-admin\/site-announcements\/([^/?#]+)(?:\?.*)?$/.exec(url);

  if (adminSiteAnnouncementItemMatch) {
    return {
      kind: 'admin_site_announcement_item',
      announcementId: decodeURIComponent(adminSiteAnnouncementItemMatch[1]),
    };
  }

  if (/^\/api\/runtime-admin\/site-announcements(?:\?.*)?$/.test(url)) {
    return {
      kind: 'admin_site_announcement_snapshot',
    };
  }

  const adminHeartResetMatch = /^\/api\/runtime-admin\/hearts\/([^/?#]+)\/reset(?:\?.*)?$/.exec(url);

  if (adminHeartResetMatch) {
    return {
      kind: 'admin_heart_reset',
      projectId: decodeURIComponent(adminHeartResetMatch[1]),
    };
  }

  const adminJukeboxResetMatch = /^\/api\/runtime-admin\/jukeboxes\/([^/?#]+)\/reset(?:\?.*)?$/.exec(url);

  if (adminJukeboxResetMatch) {
    return {
      kind: 'admin_jukebox_reset',
      projectId: decodeURIComponent(adminJukeboxResetMatch[1]),
    };
  }

  const adminHeartProjectMatch = /^\/api\/runtime-admin\/hearts\/([^/?#]+)(?:\?.*)?$/.exec(url);

  if (adminHeartProjectMatch) {
    return {
      kind: 'admin_heart_project',
      projectId: decodeURIComponent(adminHeartProjectMatch[1]),
    };
  }

  if (/^\/api\/runtime-admin\/hearts(?:\?.*)?$/.test(url)) {
    return {
      kind: 'admin_heart_overview',
    };
  }

  const heartIncrementMatch = /^\/api\/runtime-heart\/([^/?#]+)\/([^/?#]+)(?:\?.*)?$/.exec(url);

  if (heartIncrementMatch) {
    return {
      kind: 'heart_update',
      projectId: decodeURIComponent(heartIncrementMatch[1]),
      nodeId: decodeURIComponent(heartIncrementMatch[2]),
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

  const sessionStreamMatch = /^\/api\/runtime-session\/([^/?#]+)\/stream(?:\?.*)?$/.exec(url);

  if (sessionStreamMatch) {
    return {
      kind: 'session_stream',
      sessionId: decodeURIComponent(sessionStreamMatch[1]),
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
    continueStore?: KeyValueStore<PersistedContinueSessionState>;
    worldStateStore?: KeyValueStore<PersistedProjectWorldState>;
    heartStore?: KeyValueStore<number>;
    siteAnnouncementStore?: KeyValueStore<SiteAnnouncementRecord>;
    adminPassword?: string;
    clockSeedMs?: number;
  } = {},
): RuntimeApiService {
  const contentRoot = options.contentRoot ?? DEFAULT_CONTENT_ROOT;
  const now = options.now ?? (() => Date.now());
  const continueStore = options.continueStore ?? createMemoryValueStore<PersistedContinueSessionState>();
  const worldStateStore = options.worldStateStore ?? createMemoryValueStore<PersistedProjectWorldState>();
  const heartStore = options.heartStore ?? createMemoryValueStore<number>();
  const siteAnnouncementStore = options.siteAnnouncementStore ?? createMemoryValueStore<SiteAnnouncementRecord>();
  const adminPassword = options.adminPassword;
  const clockSeedMs = options.clockSeedMs ?? 0;
  const clockAnchorMsByProjectId = new Map<string, number>();
  const weatherAnchorMsByPatternKey = new Map<string, number>();
  const runtimeSessionServicesBySessionId = new Map<string, RuntimeSessionService>();
  const sessionProjectIdsBySessionId = new Map<string, string>();
  const pendingRuntimeOperationByProjectId = new Map<string, Promise<void>>();
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
    async getSiteAnnouncementSnapshot() {
      return buildSiteAnnouncementSnapshot(siteAnnouncementStore, now());
    },
    async getAdminSiteAnnouncementSnapshot() {
      return buildAdminSiteAnnouncementSnapshot(siteAnnouncementStore, now());
    },
    async createSiteAnnouncement(input) {
      const validated = validateSiteAnnouncementInput(input);

      if (!validated.ok) {
        return {
          kind: 'validation_error',
          errors: validated.errors,
        };
      }

      const id = createSiteAnnouncementId(now());
      const record = createSiteAnnouncementRecord(id, validated.value, now());
      await siteAnnouncementStore.set(siteAnnouncementKey(id), record);

      return {
        kind: 'ok',
        value: record,
      };
    },
    async updateSiteAnnouncement(announcementId, input) {
      const existing = await getSiteAnnouncementRecord(siteAnnouncementStore, announcementId);

      if (!existing) {
        return {
          kind: 'not_found',
        };
      }

      const validated = validateSiteAnnouncementInput(input);

      if (!validated.ok) {
        return {
          kind: 'validation_error',
          errors: validated.errors,
        };
      }

      const record = createSiteAnnouncementRecord(announcementId, validated.value, now(), existing.createdAtMs);
      await siteAnnouncementStore.set(siteAnnouncementKey(announcementId), record);

      return {
        kind: 'ok',
        value: record,
      };
    },
    async deleteSiteAnnouncement(announcementId) {
      const existing = await getSiteAnnouncementRecord(siteAnnouncementStore, announcementId);

      if (!existing) {
        return false;
      }

      await siteAnnouncementStore.delete(siteAnnouncementKey(announcementId));
      return true;
    },
    isAdminPasswordValid(password) {
      return typeof adminPassword === 'string' && adminPassword.length > 0 && password === adminPassword;
    },
    async setHeart(projectId, nodeId, hearted) {
      const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
      const projectMetadata = runtimeSessionService?.getProjectMetadata(projectId);
      const nodeExists = projectMetadata?.nodes.some((node) => node.id === nodeId) ?? false;

      if (!projectMetadata || !nodeExists) {
        return undefined;
      }

      const heartKey = projectNodeHeartKey(projectId, nodeId);
      const currentCount = await heartStore.get(heartKey) ?? 0;
      const nextCount = hearted
        ? currentCount + 1
        : Math.max(0, currentCount - 1);

      if (nextCount === 0) {
        await heartStore.delete(heartKey);
      } else {
        await heartStore.set(heartKey, nextCount);
      }

      return {
        projectId,
        nodeId,
        count: nextCount,
      };
    },
    async listHeartAdminOverview() {
      const entries = await store.readDirectory(contentRoot);
      const projectIds = entries
        .filter((entry) => !entry.isFile)
        .map((entry) => entry.name)
        .filter((projectId) => isContentProjectAvailable(projectId));

      const summaries = await Promise.all(projectIds.map(async (projectId) => {
        const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
        const projectMetadata = runtimeSessionService?.getProjectMetadata(projectId);

        if (!projectMetadata) {
          return undefined;
        }

        return {
          projectId,
          title: buildContentProjectRecord(projectId, 'playable-demo').title,
          totalHearts: await getProjectHeartTotal(projectId),
          nodeCount: projectMetadata.nodes.length,
        } satisfies RuntimeAdminProjectHeartSummary;
      }));

      return summaries
        .filter((summary): summary is RuntimeAdminProjectHeartSummary => Boolean(summary))
        .sort((left, right) => right.totalHearts - left.totalHearts || left.title.localeCompare(right.title));
    },
    async getHeartAdminProject(projectId) {
      const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
      const projectMetadata = runtimeSessionService?.getProjectMetadata(projectId);

      if (!runtimeSessionService || !projectMetadata) {
        return undefined;
      }

      const contentProjectRecord = buildContentProjectRecord(projectId, 'playable-demo');
      const persistedWorldState = await getPersistedProjectWorldState(worldStateStore, continueStore, projectId);
      const stateSeeds = await extractProjectStateSeeds(store, contentRoot, projectId);
      const liveSessionState = extractLiveProjectState(persistedWorldState?.sessionState);
      const currentObjectStateById = liveSessionState.sessionObjectStateById ?? stateSeeds.sessionObjectStateById;
      const objectFieldDetailsById = await extractProjectObjectFieldDetails(
        store,
        contentRoot,
        projectId,
        currentObjectStateById,
        stateSeeds.sessionObjectStateById,
      );
      const nodeHeartCounts = await listProjectHeartCounts(projectId);
      const heartCountByNodeId = new Map(nodeHeartCounts.map((entry) => [entry.nodeId, entry.count]));
      const activeClock = projectMetadata.startNodeId
        ? await buildAdminClockSnapshot(projectId, projectMetadata, projectMetadata.startNodeId)
        : undefined;
      const activeWeather = await getWeatherProjectSnapshotForSession(projectId);
      const activeAmbient = await collectAmbientSnapshot(projectId);

      return {
        projectId,
        title: contentProjectRecord.title,
        totalHearts: nodeHeartCounts.reduce((sum, entry) => sum + entry.count, 0),
        nodes: projectMetadata.nodes
          .map((node) => ({
            nodeId: node.id,
            label: node.label,
            heartCount: heartCountByNodeId.get(node.id) ?? 0,
          }))
          .sort((left, right) => right.heartCount - left.heartCount || left.label.localeCompare(right.label)),
        nodeList: projectMetadata.nodes.map((node) => ({
          nodeId: node.id,
          label: node.label,
        })),
        activeClock,
        activeWeather,
        activeAmbient,
        sessionNpcStateById: liveSessionState.sessionNpcStateById ?? stateSeeds.sessionNpcStateById,
        sessionObjectStateById: currentObjectStateById,
        objectFieldDetailsById,
      };
    },
    async resetProjectHearts(projectId) {
      let found = false;

      for await (const entry of heartStore.list(projectHeartPrefix(projectId))) {
        found = true;
        await heartStore.delete(entry.key);
      }

      return found;
    },
    async resetProjectJukeboxes(projectId) {
      const savedAt = now();
      const activeSessionIds: string[] = [];
      const persistedWorldState = await worldStateStore.get(projectWorldStateKey(projectId));
      const persistedContinueState = await getPersistedContinueState(continueStore, projectId);
      const resetWorldState = persistedWorldState
        ? resetJukeboxObjectState(persistedWorldState.sessionState)
        : undefined;
      const resetContinueSessionState = persistedContinueState
        ? resetJukeboxObjectState(persistedContinueState.sessionState)
        : undefined;
      const resetContinueRecentLog = persistedContinueState
        ? stripJukeboxQueueEntries(persistedContinueState.recentLogByNodeId)
        : undefined;

      if (persistedWorldState && resetWorldState?.changed) {
        await worldStateStore.set(projectWorldStateKey(projectId), {
          ...persistedWorldState,
          sessionState: normalizeSessionStateForPersistedWorldState(resetWorldState.sessionState),
          savedAt,
        });
      }

      if (persistedContinueState && (resetContinueSessionState?.changed || resetContinueRecentLog?.changed)) {
        await continueStore.set(projectContinueStateKey(projectId), {
          ...persistedContinueState,
          sessionState: normalizeSessionStateForPersistedContinue(
            resetContinueSessionState?.sessionState ?? persistedContinueState.sessionState,
          ),
          recentLogByNodeId: resetContinueRecentLog?.recentLogByNodeId ?? persistedContinueState.recentLogByNodeId,
          savedAt,
        });
        await continueStore.delete(legacyProjectSnapshotKey(projectId));
      }

      for (const [sessionId, sessionProjectId] of sessionProjectIdsBySessionId.entries()) {
        if (sessionProjectId !== projectId) {
          continue;
        }

        const runtimeSessionService = runtimeSessionServicesBySessionId.get(sessionId);
        const currentSessionView = runtimeSessionService?.getSession(sessionId);

        if (!runtimeSessionService || !currentSessionView) {
          continue;
        }

        const resetSnapshot = resetJukeboxSnapshot(currentSessionView.snapshot);

        if (!resetSnapshot.changed) {
          continue;
        }

        const { sessionId: ignoredSessionId, ...replacementSnapshot } = resetSnapshot.snapshot;
        void ignoredSessionId;

        if (runtimeSessionService.replaceSession(sessionId, replacementSnapshot)) {
          activeSessionIds.push(sessionId);
        }
      }

      return activeSessionIds;
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
      return runProjectOperation(projectId, async () => {
        const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
        const sessionView = runtimeSessionService?.createSession(projectId, sessionOptions);

        if (sessionView && runtimeSessionService) {
          rememberSession(projectId, sessionView.snapshot.sessionId, runtimeSessionService);
        }

        return decorateAndPersistSessionView(runtimeSessionService, sessionView);
      });
    },
    async restoreSession(projectId, snapshot) {
      return runProjectOperation(projectId, async () => {
        const runtimeSessionService = await createFreshRuntimeSessionService(projectId);
        const sessionView = runtimeSessionService?.restoreSession(projectId, snapshot);

        if (sessionView && runtimeSessionService) {
          rememberSession(projectId, sessionView.snapshot.sessionId, runtimeSessionService);
        }

        return decorateAndPersistSessionView(runtimeSessionService, sessionView);
      });
    },
    async getSession(sessionId) {
      const projectId = sessionProjectIdsBySessionId.get(sessionId);

      return runProjectOperation(projectId, async () => {
        const runtimeSessionService = await getRuntimeSessionServiceForSession(sessionId);
        return decorateAndPersistSessionView(runtimeSessionService, runtimeSessionService?.getSession(sessionId));
      });
    },
    async applySessionAction(sessionId, action) {
      const projectId = sessionProjectIdsBySessionId.get(sessionId);

      return runProjectOperation(projectId, async () => {
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
          const persistedSnapshot = projectId ? await getPersistedContinueState(continueStore, projectId) : undefined;
          const freshRuntimeSessionService = projectId ? await createFreshRuntimeSessionService(projectId) : undefined;
          const sessionView = projectId && persistedSnapshot && freshRuntimeSessionService
            ? freshRuntimeSessionService.restoreSession(projectId, persistedSnapshot)
            : undefined;

          if (sessionView && freshRuntimeSessionService && projectId) {
            rememberSession(projectId, sessionView.snapshot.sessionId, freshRuntimeSessionService, sessionId);
          }

          return decorateAndPersistSessionView(freshRuntimeSessionService, sessionView);
        }

        const sessionView = runtimeSessionService.applyAction(sessionId, action);

        if (sessionView && runtimeSessionService) {
          rememberSession(sessionView.snapshot.projectId, sessionView.snapshot.sessionId, runtimeSessionService, sessionId);
        }

        return decorateAndPersistSessionView(runtimeSessionService, sessionView);
      });
    },
    async applySessionControl(sessionId, control) {
      const projectId = sessionProjectIdsBySessionId.get(sessionId);

      return runProjectOperation(projectId, async () => {
        const runtimeSessionService = await getRuntimeSessionServiceForSession(sessionId);
        const sessionView = runtimeSessionService?.applyControl(sessionId, control);

        if (sessionView && runtimeSessionService) {
          rememberSession(sessionView.snapshot.projectId, sessionView.snapshot.sessionId, runtimeSessionService, sessionId);
        }

        return decorateAndPersistSessionView(runtimeSessionService, sessionView);
      });
    },
    async resetSession(sessionId, destinationNodeId) {
      const projectId = sessionProjectIdsBySessionId.get(sessionId);

      return runProjectOperation(projectId, async () => {
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
      });
    },
  };

  async function getRuntimeSessionServiceForSession(sessionId: string): Promise<RuntimeSessionService | undefined> {
    return runtimeSessionServicesBySessionId.get(sessionId);
  }

  async function runProjectOperation<TResult>(
    projectId: string | undefined,
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    if (!projectId) {
      return operation();
    }

    const previous = pendingRuntimeOperationByProjectId.get(projectId) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);

    pendingRuntimeOperationByProjectId.set(projectId, queued);
    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseCurrent();

      if (pendingRuntimeOperationByProjectId.get(projectId) === queued) {
        pendingRuntimeOperationByProjectId.delete(projectId);
      }
    }
  }

  async function getProjectHeartTotal(projectId: string): Promise<number> {
    let total = 0;

    for await (const entry of heartStore.list(projectHeartPrefix(projectId))) {
      total += entry.value;
    }

    return total;
  }

  async function listProjectHeartCounts(projectId: string): Promise<RuntimeHeartCount[]> {
    const counts: RuntimeHeartCount[] = [];

    for await (const entry of heartStore.list(projectHeartPrefix(projectId))) {
      const nodeId = entry.key.slice(projectHeartPrefix(projectId).length + 1);

      counts.push({
        projectId,
        nodeId,
        count: entry.value,
      });
    }

    return counts;
  }

  async function buildAdminClockSnapshot(
    projectId: string,
    projectMetadata: RuntimeSessionProjectMetadata,
    nodeId: string,
  ): Promise<PreviewRuntimeClockSnapshot | undefined> {
    if (!projectMetadata.timeSettings) {
      return undefined;
    }

    ensureClockAnchor(projectId, projectMetadata);
    const nodeRegion = projectMetadata.nodeRegionsById[nodeId];
    const snapshot = resolveProjectClockSnapshot({
      projectId,
      timeSettings: projectMetadata.timeSettings,
      defaultClock: projectMetadata.defaultClock,
      nodeFoldersById: projectMetadata.nodeFoldersById,
      nodeRegionsById: projectMetadata.nodeRegionsById,
    }, now(), clockAnchorMsByProjectId, nodeId, nodeRegion);

    if (!snapshot) {
      return undefined;
    }

    return {
      ...snapshot,
      source: resolveClockSourceLabel(projectMetadata.timeSettings, projectMetadata.defaultClock),
    };
  }

  async function createFreshRuntimeSessionService(projectId: string): Promise<RuntimeSessionService | undefined> {
    const contentFiles = await collectProjectContentFiles(store, contentRoot, projectId);

    if (Object.keys(contentFiles).length === 0) {
      return undefined;
    }

    let projectMetadata: RuntimeSessionProjectMetadata | undefined;
    const persistedWorldState = await getPersistedProjectWorldState(worldStateStore, continueStore, projectId);
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
      initialSessionStateByProjectId: persistedWorldState?.sessionState
        ? { [projectId]: persistedWorldState.sessionState }
        : undefined,
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
    const savedAtMs = now();
    const persistedContinueSessionState = buildPersistedContinueSessionState(sessionView.snapshot.sessionState);
    const persistedWorldState = buildPersistedProjectWorldState(sessionView.snapshot.projectId, sessionView.snapshot.sessionState, savedAtMs);

    await worldStateStore.set(projectWorldStateKey(sessionView.snapshot.projectId), persistedWorldState);

    if (options.clearExistingSnapshot && shouldClearProjectSnapshotOnReset(projectMetadata?.titleScreenSaveMode)) {
      await continueStore.delete(projectContinueStateKey(sessionView.snapshot.projectId));
      await continueStore.delete(legacyProjectSnapshotKey(sessionView.snapshot.projectId));
    }

    if (projectMetadata && shouldPersistSessionSnapshot(sessionView.snapshot.route.nodeId, projectMetadata.titleScreenSaveMode)) {
      await continueStore.set(projectContinueStateKey(sessionView.snapshot.projectId), {
        projectId: sessionView.snapshot.projectId,
        route: sessionView.snapshot.route,
        areaVisitCounts: sessionView.snapshot.areaVisitCounts,
        pathVisitCounts: sessionView.snapshot.pathVisitCounts,
        recentLogByNodeId: sessionView.snapshot.recentLogByNodeId,
        actionAttemptsByNodeId: sessionView.snapshot.actionAttemptsByNodeId,
        sessionState: persistedContinueSessionState,
        savedAt: savedAtMs,
      });
    }

    const persistedSnapshot = await getPersistedContinueState(continueStore, sessionView.snapshot.projectId);
    const page = sessionView.page && sessionView.page.kind === 'page'
      ? decorateRuntimeSessionPage(
          sessionView.page,
          sessionView.snapshot.sessionState,
          savedAtMs,
          projectMetadata,
          persistedSnapshot,
        )
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
    const doorWasOpen = isPrototypeHubLobbyDoorOpen(nextSessionState);

    const autoClosedDoorSessionState = reconcilePrototypeHubLobbyDoor(nextSessionState, now());

    if (autoClosedDoorSessionState !== nextSessionState) {
      nextSessionState = autoClosedDoorSessionState;
      changed = true;

      if (doorWasOpen && currentNodeId) {
        nextRecentLogByNodeId = appendRecentLogEntry(
          nextRecentLogByNodeId,
          currentNodeId,
          createPrototypeHubLobbyDoorClosedLogEntry(now()),
        );
      }
    }

    const jukeboxAtmosphereUpdate = appendPeriodicJukeboxAtmosphereLog(
      sessionView.page,
      nextSessionState,
      nextRecentLogByNodeId,
      now(),
    );

    if (jukeboxAtmosphereUpdate.changed) {
      nextSessionState = jukeboxAtmosphereUpdate.sessionState;
      nextRecentLogByNodeId = jukeboxAtmosphereUpdate.recentLogByNodeId;
      changed = true;
    }

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

function createMemoryValueStore<TValue>(): KeyValueStore<TValue> {
  const values = new Map<string, TValue>();

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

function projectHeartPrefix(projectId: string): string {
  return `analytics/hearts/${projectId}`;
}

function projectNodeHeartKey(projectId: string, nodeId: string): string {
  return `${projectHeartPrefix(projectId)}/${nodeId}`;
}

function projectContinueStateKey(projectId: string): string {
  return `projects/${projectId}/continue-state`;
}

function projectWorldStateKey(projectId: string): string {
  return `projects/${projectId}/world-state`;
}

function legacyProjectSnapshotKey(projectId: string): string {
  return `projects/${projectId}/snapshot`;
}

function legacyProjectSharedStateKey(projectId: string): string {
  return `projects/${projectId}/shared-state`;
}

async function getPersistedContinueState(
  continueStore: KeyValueStore<PersistedContinueSessionState>,
  projectId: string,
): Promise<PersistedContinueSessionState | undefined> {
  return (await continueStore.get(projectContinueStateKey(projectId)))
    ?? continueStore.get(legacyProjectSnapshotKey(projectId));
}

async function getPersistedProjectWorldState(
  worldStateStore: KeyValueStore<PersistedProjectWorldState>,
  continueStore: KeyValueStore<PersistedContinueSessionState>,
  projectId: string,
): Promise<PersistedProjectWorldState | undefined> {
  const persistedWorldState = await worldStateStore.get(projectWorldStateKey(projectId));

  if (persistedWorldState) {
    return persistedWorldState;
  }

  const persistedContinueState = await getPersistedContinueState(continueStore, projectId);

  return persistedContinueState
    ? {
        projectId,
        sessionState: persistedContinueState.sessionState,
        savedAt: persistedContinueState.savedAt,
      }
    : undefined;
}

function resetJukeboxSnapshot(
  snapshot: RuntimeSessionSnapshot,
): { snapshot: RuntimeSessionSnapshot; changed: boolean } {
  const resetSessionState = resetJukeboxObjectState(snapshot.sessionState);
  const resetRecentLog = stripJukeboxQueueEntries(snapshot.recentLogByNodeId);

  if (!resetSessionState.changed && !resetRecentLog.changed) {
    return {
      snapshot,
      changed: false,
    };
  }

  return {
    snapshot: {
      ...snapshot,
      sessionState: resetSessionState.sessionState,
      recentLogByNodeId: resetRecentLog.recentLogByNodeId,
    },
    changed: true,
  };
}

function reconcilePrototypeHubLobbyDoor(
  sessionState: RuntimeSessionState,
  nowMs: number,
): RuntimeSessionState {
  const objects = sessionState.objects;
  const doorState = objects && typeof objects === 'object' && !Array.isArray(objects)
    ? objects.prototypehub_lobby_door
    : undefined;

  if (!doorState || typeof doorState !== 'object' || Array.isArray(doorState)) {
    return sessionState;
  }

  const open = doorState.open;

  if (open !== true) {
    return sessionState;
  }

  const openedAtMs = typeof doorState.openedAtMs === 'number' && Number.isFinite(doorState.openedAtMs)
    ? doorState.openedAtMs
    : undefined;

  if (openedAtMs !== undefined && nowMs - openedAtMs < PROTOTYPEHUB_LOBBY_DOOR_AUTO_CLOSE_MS) {
    return sessionState;
  }

  return {
    ...sessionState,
    objects: {
      ...objects,
      prototypehub_lobby_door: {
        ...doorState,
        open: false,
        openedAtMs: 0,
      },
    },
  };
}

function isPrototypeHubLobbyDoorOpen(sessionState: RuntimeSessionState): boolean {
  const objects = sessionState.objects;
  const doorState = objects && typeof objects === 'object' && !Array.isArray(objects)
    ? objects.prototypehub_lobby_door
    : undefined;

  return Boolean(doorState && typeof doorState === 'object' && !Array.isArray(doorState) && doorState.open === true);
}

function createPrototypeHubLobbyDoorClosedLogEntry(
  nowMs: number,
): RuntimeSessionSnapshot['recentLogByNodeId'][string][number] {
  return {
    id: `prototypehub:door:closed:${nowMs}`,
    text: 'The door swings shut.',
    lane: 'recent',
  };
}

function appendPeriodicJukeboxAtmosphereLog(
  page: ProjectionResult | undefined,
  sessionState: RuntimeSessionState,
  recentLogByNodeId: RuntimeSessionSnapshot['recentLogByNodeId'],
  nowMs: number,
): {
  sessionState: RuntimeSessionState;
  recentLogByNodeId: RuntimeSessionSnapshot['recentLogByNodeId'];
  changed: boolean;
} {
  if (!page || page.kind !== 'page' || !page.nodeId) {
    return {
      sessionState,
      recentLogByNodeId,
      changed: false,
    };
  }

  let nextSessionState = sessionState;
  let nextRecentLogByNodeId = recentLogByNodeId;
  let changed = false;

  for (const action of page.actions) {
    if (action.kind !== 'poi') {
      continue;
    }

    const objectStates = asRuntimeRecord(nextSessionState.objects);
    const objectState = asRuntimeRecord(objectStates?.[action.id]);

    if (!isJukeboxObjectState(objectState)) {
      continue;
    }

    const currentTrackId = typeof objectState.currentTrack === 'string' && objectState.currentTrack !== 'none'
      ? objectState.currentTrack
      : undefined;
    const currentTrackStartedAtMs = typeof objectState.currentTrackStartedAtMs === 'number' && Number.isFinite(objectState.currentTrackStartedAtMs)
      ? objectState.currentTrackStartedAtMs
      : undefined;
    const currentTrackEndsAtMs = typeof objectState.currentTrackEndsAtMs === 'number' && Number.isFinite(objectState.currentTrackEndsAtMs)
      ? objectState.currentTrackEndsAtMs
      : undefined;
    const previousTrackId = typeof objectState.lobbyAtmosphereTrackId === 'string'
      ? objectState.lobbyAtmosphereTrackId
      : '';
    const previousTick = typeof objectState.lobbyAtmosphereTick === 'number' && Number.isFinite(objectState.lobbyAtmosphereTick)
      ? Math.max(0, Math.floor(objectState.lobbyAtmosphereTick))
      : 0;

    if (!currentTrackId || typeof currentTrackStartedAtMs !== 'number' || typeof currentTrackEndsAtMs !== 'number' || currentTrackEndsAtMs <= nowMs) {
      if (previousTrackId || previousTick > 0) {
        nextSessionState = setRuntimeObjectState(nextSessionState, action.id, {
          ...objectState,
          lobbyAtmosphereTrackId: '',
          lobbyAtmosphereTick: 0,
        });
        changed = true;
      }

      continue;
    }

    const song = findJukeboxCatalogSongById(currentTrackId);

    if (!song) {
      continue;
    }

    let nextObjectState = objectState;
    let baselineTick = previousTick;

    if (previousTrackId !== currentTrackId) {
      nextObjectState = {
        ...nextObjectState,
        lobbyAtmosphereTrackId: currentTrackId,
        lobbyAtmosphereTick: 0,
      };
      baselineTick = 0;
      nextSessionState = setRuntimeObjectState(nextSessionState, action.id, nextObjectState);
      changed = true;
    }

    const currentTick = Math.max(0, Math.floor((nowMs - currentTrackStartedAtMs) / JUKEBOX_LOBBY_ATMOSPHERE_INTERVAL_MS));

    if (currentTick <= 0 || currentTick <= baselineTick) {
      continue;
    }

    nextObjectState = {
      ...nextObjectState,
      lobbyAtmosphereTrackId: currentTrackId,
      lobbyAtmosphereTick: currentTick,
    };
    nextSessionState = setRuntimeObjectState(nextSessionState, action.id, nextObjectState);
    nextRecentLogByNodeId = appendRecentLogEntry(
      nextRecentLogByNodeId,
      page.nodeId,
      createJukeboxLobbyAtmosphereLogEntry(song, currentTick, nowMs),
    );
    changed = true;
  }

  return {
    sessionState: nextSessionState,
    recentLogByNodeId: nextRecentLogByNodeId,
    changed,
  };
}

function createJukeboxLobbyAtmosphereLogEntry(
  song: JukeboxCatalogSong,
  tick: number,
  nowMs: number,
): RuntimeSessionSnapshot['recentLogByNodeId'][string][number] {
  return {
    id: `jukebox:atmosphere:${song.id}:${tick}:${nowMs}`,
    text: selectJukeboxLobbyAtmosphereText(song, tick),
    lane: 'recent',
  };
}

function selectJukeboxLobbyAtmosphereText(song: JukeboxCatalogSong, tick: number): string {
  const marqueeTexts = song.marqueeTexts.filter((text) => text.length > 0);
  const flavorTexts = song.flavorTexts.filter((text) => text.length > 0);
  const interleavedTexts = Array.from({ length: Math.max(marqueeTexts.length, flavorTexts.length) }).flatMap((_, index) => [
    marqueeTexts[index],
    flavorTexts[index],
  ].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0));
  const texts = interleavedTexts.length > 0
    ? interleavedTexts
    : [...marqueeTexts, ...flavorTexts];

  if (texts.length === 0) {
    return `${song.title} keeps playing through the room.`;
  }

  return texts[(Math.max(1, tick) - 1) % texts.length] ?? texts[0];
}

function findJukeboxCatalogSongById(songId: string): JukeboxCatalogSong | undefined {
  for (const catalog of Object.values(JUKEBOX_CATALOGS)) {
    const song = catalog.find((entry) => entry.id === songId);

    if (song) {
      return song;
    }
  }

  return undefined;
}

function setRuntimeObjectState(
  sessionState: RuntimeSessionState,
  objectId: string,
  objectState: Record<string, unknown>,
): RuntimeSessionState {
  return {
    ...sessionState,
    objects: {
      ...(asRuntimeRecord(sessionState.objects) ?? {}),
      [objectId]: objectState,
    },
  };
}

function resetJukeboxObjectState(
  sessionState: RuntimeSessionState,
): { sessionState: RuntimeSessionState; changed: boolean } {
  const objects = sessionState.objects;

  if (!objects || typeof objects !== 'object' || Array.isArray(objects)) {
    return {
      sessionState,
      changed: false,
    };
  }

  let changed = false;
  const nextObjects: Record<string, unknown> = { ...objects };

  for (const [objectId, objectState] of Object.entries(objects)) {
    if (!isJukeboxObjectState(objectState)) {
      continue;
    }

    const nextObjectState = {
      ...objectState,
      fakeCredits: 0,
      currentTrack: 'none',
      currentTrackLabel: '',
      currentTrackMode: '',
      currentTrackStartedAtMs: 0,
      currentTrackEndsAtMs: 0,
      queueTrackIds: [],
      lobbyAtmosphereTrackId: '',
      lobbyAtmosphereTick: 0,
    } satisfies Record<string, unknown>;

    if (JSON.stringify(nextObjectState) === JSON.stringify(objectState)) {
      continue;
    }

    nextObjects[objectId] = nextObjectState;
    changed = true;
  }

  return changed
    ? {
        sessionState: {
          ...sessionState,
          objects: nextObjects,
        },
        changed: true,
      }
    : {
        sessionState,
        changed: false,
      };
}

function stripJukeboxQueueEntries(
  recentLogByNodeId: RuntimeSessionSnapshot['recentLogByNodeId'],
): { recentLogByNodeId: RuntimeSessionSnapshot['recentLogByNodeId']; changed: boolean } {
  let changed = false;
  const nextRecentLogByNodeId = Object.fromEntries(
    Object.entries(recentLogByNodeId).map(([nodeId, entries]) => {
      const nextEntries = entries.filter((entry) => !isJukeboxQueueLogEntry(entry));

      if (nextEntries.length !== entries.length) {
        changed = true;
      }

      return [nodeId, nextEntries];
    }),
  );

  return {
    recentLogByNodeId: nextRecentLogByNodeId,
    changed,
  };
}

function isJukeboxObjectState(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return 'currentTrack' in value
    || 'queueTrackIds' in value
    || 'fakeCredits' in value;
}

function isJukeboxQueueLogEntry(entry: ProjectedLogEntry): boolean {
  return Array.isArray(entry.blocks)
    && entry.blocks.some((block) => block.groupId === 'jukebox-queue');
}

function createSiteAnnouncementId(nowMs: number): string {
  return `site_${nowMs}_${Math.random().toString(36).slice(2, 8)}`;
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

function buildPersistedProjectWorldState(
  projectId: string,
  sessionState: RuntimeSessionState,
  savedAt: number,
): PersistedProjectWorldState {
  return {
    projectId,
    sessionState: normalizeSessionStateForPersistedWorldState(sessionState),
    savedAt,
  };
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
  persistedSnapshot: PersistedContinueSessionState | undefined,
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

function decorateRuntimeSessionPage(
  page: Extract<RuntimeSessionView['page'], { kind: 'page' }>,
  sessionState: RuntimeSessionState,
  nowMs: number,
  projectMetadata: RuntimeSessionProjectMetadata | undefined,
  persistedSnapshot: PersistedContinueSessionState | undefined,
): Extract<RuntimeSessionView['page'], { kind: 'page' }> {
  return decoratePrototypeHubLobbyAtmospherePage(
    decorateTitleScreenPage(page, projectMetadata, persistedSnapshot),
    sessionState,
    nowMs,
  );
}

function decoratePrototypeHubLobbyAtmospherePage(
  page: Extract<RuntimeSessionView['page'], { kind: 'page' }>,
  sessionState: RuntimeSessionState,
  nowMs: number,
): Extract<RuntimeSessionView['page'], { kind: 'page' }> {
  if (page.nodeId !== 'lobby_area') {
    return page;
  }

  const objectState = asRuntimeRecord(asRuntimeRecord(sessionState.objects)?.prototypehub_lobby_jukebox);

  if (!isJukeboxObjectState(objectState) || objectState.focused === true) {
    return stripPrototypeHubLobbyAtmosphereProse(page);
  }

  const currentTrackId = typeof objectState.currentTrack === 'string' && objectState.currentTrack !== 'none'
    ? objectState.currentTrack
    : undefined;
  const currentTrackEndsAtMs = typeof objectState.currentTrackEndsAtMs === 'number' && Number.isFinite(objectState.currentTrackEndsAtMs)
    ? objectState.currentTrackEndsAtMs
    : undefined;
  const currentTick = typeof objectState.lobbyAtmosphereTick === 'number' && Number.isFinite(objectState.lobbyAtmosphereTick)
    ? Math.max(0, Math.floor(objectState.lobbyAtmosphereTick))
    : 0;

  if (!currentTrackId || typeof currentTrackEndsAtMs !== 'number' || currentTrackEndsAtMs <= nowMs || currentTick <= 0) {
    return stripPrototypeHubLobbyAtmosphereProse(page);
  }

  const song = findJukeboxCatalogSongById(currentTrackId);

  if (!song) {
    return stripPrototypeHubLobbyAtmosphereProse(page);
  }

  const nextProseBlocks = [
    ...page.proseBlocks.filter((block) => block.groupId !== 'runtime-jukebox-atmosphere'),
    {
      groupId: 'runtime-jukebox-atmosphere',
      kind: 'paragraph' as const,
      text: selectJukeboxLobbyAtmosphereText(song, currentTick),
    },
  ];

  return {
    ...page,
    proseBlocks: nextProseBlocks,
  };
}

function stripPrototypeHubLobbyAtmosphereProse(
  page: Extract<RuntimeSessionView['page'], { kind: 'page' }>,
): Extract<RuntimeSessionView['page'], { kind: 'page' }> {
  if (!page.proseBlocks.some((block) => block.groupId === 'runtime-jukebox-atmosphere')) {
    return page;
  }

  return {
    ...page,
    proseBlocks: page.proseBlocks.filter((block) => block.groupId !== 'runtime-jukebox-atmosphere'),
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
  snapshot: PersistedContinueSessionState,
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
    npcs: nextNpcs as RuntimeSessionSnapshot['sessionState']['npcs'],
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

  const snapshot = args.snapshot;

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

    if (!matchesRuntimeSchedulePhase(args.projectMetadata, args.currentNodeId, snapshot, schedule.trigger.phaseId, schedule.trigger.phaseGroup)) {
      return [];
    }

    if (!shouldAnnounceRuntimeScheduleEntry(args.previousNodeId, args.currentNodeId, args.previousSnapshot, snapshot, schedule.trigger.phaseId, schedule.trigger.phaseGroup, args.projectMetadata)) {
      return [];
    }

    return [createRuntimeScheduleLogEntry(scheduleId, schedule.actor.text, snapshot.nowMs ?? 0)];
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

async function extractProjectStateSeeds(
  store: RuntimeContentStore,
  contentRoot: string,
  projectId: string,
): Promise<{
  sessionNpcStateById?: Record<string, { location?: string; behavior?: string }>;
  sessionObjectStateById?: Record<string, Record<string, string | number | boolean>>;
}> {
  const statePath = joinPath(contentRoot, projectId, 'state', 'world.yaml');
  const stateSource = await store.readText(statePath);

  if (!stateSource) {
    return {};
  }

  const parsedState = parseStateSidecar(stateSource, statePath);
  const npcsValue = parsedState.value?.npcs;
  const objectsValue = parsedState.value?.objects;

  const sessionNpcStateById = npcsValue && typeof npcsValue === 'object' && !Array.isArray(npcsValue)
    ? Object.fromEntries(
        Object.entries(npcsValue).map(([npcId, value]) => {
          const npcState = value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};

          return [npcId, {
            location: typeof npcState.location === 'string' ? npcState.location : undefined,
            behavior: typeof npcState.behavior === 'string' ? npcState.behavior : undefined,
          }];
        }),
      )
    : undefined;

  const sessionObjectStateById = objectsValue && typeof objectsValue === 'object' && !Array.isArray(objectsValue)
    ? Object.fromEntries(
        Object.entries(objectsValue)
          .map(([objectId, value]) => {
            const objectState = value && typeof value === 'object' && !Array.isArray(value)
              ? (value as Record<string, unknown>)
              : {};
            const visibleFields = Object.fromEntries(
              Object.entries(objectState).filter(([, fieldValue]) => (
                typeof fieldValue === 'string'
                || typeof fieldValue === 'number'
                || typeof fieldValue === 'boolean'
              )),
            );

            return [objectId, visibleFields];
          })
          .filter(([, objectState]) => Object.keys(objectState).length > 0),
      )
    : undefined;

  return {
    sessionNpcStateById,
    sessionObjectStateById,
  };
}

function extractLiveProjectState(
  sessionState: RuntimeSessionState | undefined,
): {
  sessionNpcStateById?: Record<string, { location?: string; behavior?: string }>;
  sessionObjectStateById?: Record<string, Record<string, string | number | boolean>>;
} {
  const sessionNpcStateById = sessionState?.npcs && typeof sessionState.npcs === 'object' && !Array.isArray(sessionState.npcs)
    ? Object.fromEntries(
        Object.entries(sessionState.npcs).map(([npcId, value]) => {
          const npcState = value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};

          return [npcId, {
            location: typeof npcState.location === 'string' ? npcState.location : undefined,
            behavior: typeof npcState.behavior === 'string' ? npcState.behavior : undefined,
          }];
        }),
      )
    : undefined;

  const sessionObjectStateById = sessionState?.objects && typeof sessionState.objects === 'object' && !Array.isArray(sessionState.objects)
    ? Object.fromEntries(
        Object.entries(sessionState.objects)
          .map(([objectId, value]) => {
            const objectState = value && typeof value === 'object' && !Array.isArray(value)
              ? (value as Record<string, unknown>)
              : {};
            const visibleFields = Object.fromEntries(
              Object.entries(objectState).filter(([, fieldValue]) => (
                typeof fieldValue === 'string'
                || typeof fieldValue === 'number'
                || typeof fieldValue === 'boolean'
              )),
            );

            return [objectId, visibleFields];
          })
          .filter(([, objectState]) => Object.keys(objectState).length > 0),
      )
    : undefined;

  return {
    sessionNpcStateById,
    sessionObjectStateById,
  };
}

async function extractProjectObjectFieldDetails(
  store: RuntimeContentStore,
  contentRoot: string,
  projectId: string,
  currentObjectStateById: Record<string, Record<string, string | number | boolean>> | undefined,
  defaultObjectStateById: Record<string, Record<string, string | number | boolean>> | undefined,
): Promise<Record<string, Record<string, {
  currentValue?: string | number | boolean;
  defaultValue?: string | number | boolean;
  possibleValues: Array<string | number | boolean>;
}>> | undefined> {
  const contentFiles = await collectProjectContentFiles(store, contentRoot, projectId);
  const possibleValuesByFieldKey = new Map<string, Array<string | number | boolean>>();

  for (const [objectId, fieldValues] of Object.entries(defaultObjectStateById ?? {})) {
    for (const [fieldName, fieldValue] of Object.entries(fieldValues)) {
      appendPossibleObjectFieldValue(possibleValuesByFieldKey, objectId, fieldName, fieldValue);
    }
  }

  for (const [objectId, fieldValues] of Object.entries(currentObjectStateById ?? {})) {
    for (const [fieldName, fieldValue] of Object.entries(fieldValues)) {
      appendPossibleObjectFieldValue(possibleValuesByFieldKey, objectId, fieldName, fieldValue);
    }
  }

  for (const [sourcePath, source] of Object.entries(contentFiles)) {
    if (!/\/predicates\/.*\.ya?ml$/i.test(sourcePath.replace(/\\/g, '/'))) {
      continue;
    }

    const parsedPredicates = parsePredicateSidecar(source, sourcePath);

    if (!parsedPredicates.value) {
      continue;
    }

    for (const definition of Object.values(parsedPredicates.value)) {
      collectObjectFieldValuesFromPredicate(definition, possibleValuesByFieldKey);
    }
  }

  const objectIds = Array.from(new Set([
    ...Object.keys(defaultObjectStateById ?? {}),
    ...Object.keys(currentObjectStateById ?? {}),
    ...Array.from(possibleValuesByFieldKey.keys()).map((fieldKey) => fieldKey.split('/', 1)[0] ?? ''),
  ])).filter((objectId) => objectId.length > 0).sort((left, right) => left.localeCompare(right));

  if (objectIds.length === 0) {
    return undefined;
  }

  return Object.fromEntries(objectIds.map((objectId) => {
    const fieldNames = Array.from(new Set([
      ...Object.keys(defaultObjectStateById?.[objectId] ?? {}),
      ...Object.keys(currentObjectStateById?.[objectId] ?? {}),
      ...Array.from(possibleValuesByFieldKey.keys())
        .filter((fieldKey) => fieldKey.startsWith(`${objectId}/`))
        .map((fieldKey) => fieldKey.slice(objectId.length + 1)),
    ])).sort((left, right) => left.localeCompare(right));

    return [objectId, Object.fromEntries(fieldNames.map((fieldName) => {
      const fieldKey = `${objectId}/${fieldName}`;
      const possibleValues = possibleValuesByFieldKey.get(fieldKey) ?? [];

      return [fieldName, {
        currentValue: currentObjectStateById?.[objectId]?.[fieldName],
        defaultValue: defaultObjectStateById?.[objectId]?.[fieldName],
        possibleValues,
      }];
    }))];
  }));
}

function collectObjectFieldValuesFromPredicate(
  value: unknown,
  possibleValuesByFieldKey: Map<string, Array<string | number | boolean>>,
): void {
  if (Array.isArray(value)) {
    if (
      value.length === 2
      && typeof value[0] === 'string'
      && value[0].startsWith('objects.')
      && isScalarObjectFieldValue(value[1])
    ) {
      const fieldPath = value[0].slice('objects.'.length);
      const fieldPathParts = fieldPath.split('.');
      const objectId = fieldPathParts.shift();
      const fieldName = fieldPathParts.join('.');

      if (objectId && fieldName) {
        appendPossibleObjectFieldValue(possibleValuesByFieldKey, objectId, fieldName, value[1]);
      }
    }

    for (const entry of value) {
      collectObjectFieldValuesFromPredicate(entry, possibleValuesByFieldKey);
    }

    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    collectObjectFieldValuesFromPredicate(nestedValue, possibleValuesByFieldKey);
  }
}

function appendPossibleObjectFieldValue(
  possibleValuesByFieldKey: Map<string, Array<string | number | boolean>>,
  objectId: string,
  fieldName: string,
  fieldValue: string | number | boolean,
): void {
  const fieldKey = `${objectId}/${fieldName}`;
  const existingValues = possibleValuesByFieldKey.get(fieldKey) ?? [];

  if (existingValues.includes(fieldValue)) {
    return;
  }

  possibleValuesByFieldKey.set(fieldKey, [...existingValues, fieldValue]);
}

function isScalarObjectFieldValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
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