import { parseNpcSidecar, parseStateSidecar, parseTimeSettingsSidecar, parseWeatherSettingsSidecar } from '../../parser/src';
import { resolveRuntimeAmbientSnapshot, type RuntimeAmbientNpcStateSeed, type RuntimeAmbientSnapshot } from '../../../apps/web/src/runtimeAmbient';
import { resolveProjectClockSnapshot, type PreviewRuntimeClockSnapshot } from '../../../apps/web/src/runtimeClock';
import { resolveRuntimeWeatherProjectSnapshot, type RuntimeWeatherProjectSnapshot } from '../../../apps/web/src/runtimeWeather';
import type { ContentNpcDefinition } from '../../schema/src';
import type { RuntimeClockSnapshot } from '../../runtime/src';

const DEFAULT_CONTENT_ROOT = 'packages/content';

export interface RuntimeDirectoryEntry {
  name: string;
  isFile: boolean;
}

export interface RuntimeContentStore {
  readText(path: string): Promise<string | undefined>;
  readDirectory(path: string): Promise<RuntimeDirectoryEntry[]>;
}

export type RuntimeApiRouteMatch =
  | { kind: 'clock_snapshot'; projectId: string; nodeId?: string; nodeRegion?: string }
  | { kind: 'clock_stream'; projectId: string; nodeId?: string; nodeRegion?: string }
  | { kind: 'weather_stream'; projectId: string }
  | { kind: 'ambient_stream'; projectId: string };

export interface RuntimeApiService {
  getClockSnapshot(projectId: string, nodeId?: string, nodeRegion?: string): Promise<PreviewRuntimeClockSnapshot | undefined>;
  getWeatherProjectSnapshot(projectId: string): Promise<RuntimeWeatherProjectSnapshot | undefined>;
  getAmbientSnapshot(projectId: string): Promise<RuntimeAmbientSnapshot>;
}

export function matchRuntimeApiRequest(url: string): RuntimeApiRouteMatch | undefined {
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
  } = {},
): RuntimeApiService {
  const contentRoot = options.contentRoot ?? DEFAULT_CONTENT_ROOT;
  const now = options.now ?? (() => Date.now());
  const clockAnchorMsByProjectId = new Map<string, number>();
  const ambientAnchorMsByNpcId = new Map<string, number>();
  const weatherAnchorMsByPatternKey = new Map<string, number>();

  return {
    async getClockSnapshot(projectId, nodeId, nodeRegion) {
      const settingsSource = await store.readText(joinPath(contentRoot, projectId, 'settings', 'time.yaml'));

      if (!settingsSource) {
        return undefined;
      }

      const settingsPath = joinPath(contentRoot, projectId, 'settings', 'time.yaml');
      const parsedTimeSettings = parseTimeSettingsSidecar(settingsSource, settingsPath);

      if (!parsedTimeSettings.value || parsedTimeSettings.errors.length > 0) {
        return undefined;
      }

      const defaultClock = await extractDefaultClock(store, contentRoot, projectId);
      const snapshot = resolveProjectClockSnapshot({
        projectId,
        timeSettings: parsedTimeSettings.value,
        defaultClock,
      }, now(), clockAnchorMsByProjectId, nodeId, nodeRegion);

      if (!snapshot) {
        return undefined;
      }

      return {
        ...snapshot,
        source: resolveClockSourceLabel(parsedTimeSettings.value, defaultClock),
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
      return resolveRuntimeAmbientSnapshot(npcDefinitionsById, now(), ambientAnchorMsByNpcId, npcStateSeedsById);
    },
  };
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
  const entries = await store.readDirectory(joinPath(contentRoot, projectId, 'npcs'));
  const definitions = await Promise.all(entries.flatMap((entry) => entry.isFile && /\.ya?ml$/i.test(entry.name)
    ? [readNpcDefinition(store, joinPath(contentRoot, projectId, 'npcs', entry.name))]
    : []));

  return Object.fromEntries(definitions.filter((entry): entry is [string, ContentNpcDefinition] => Boolean(entry)));
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