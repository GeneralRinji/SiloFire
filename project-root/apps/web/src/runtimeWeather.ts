import type { ProjectedLogEntry, ProjectedProseBlock } from '../../../packages/projection/src';
import type { ProjectWeatherSettingsDefinition, WeatherPatternDefinition, WeatherStepDefinition } from '../../../packages/schema/src';
import type { RuntimeWeatherSnapshot } from '../../../packages/runtime/src/runtimeWeatherTypes';

export type { RuntimeWeatherSnapshot } from '../../../packages/runtime/src/runtimeWeatherTypes';

const DEFAULT_WEATHER_STEP_DURATION_MINUTES = 5;

export interface RuntimeWeatherPatternSnapshot {
  patternId: string;
  stepId?: string;
  kind: string;
  intensity?: string;
  statusText: string[];
  nowMs: number;
  source: string;
}

export interface RuntimeWeatherProjectSnapshot {
  nowMs: number;
  patterns: RuntimeWeatherPatternSnapshot[];
}

export type RuntimeWeatherAnnouncementReason = 'entry' | 'change';

export interface RuntimeWeatherProjectConfig {
  projectId: string;
  weatherSettings?: ProjectWeatherSettingsDefinition;
  defaultWeather?: RuntimeWeatherSnapshot;
  nodeRegionsById?: Record<string, string>;
}

export interface RuntimeWeatherStream {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface ServerRuntimeWeatherSource {
  getSnapshot(
    project: RuntimeWeatherProjectConfig,
    nodeId?: string,
    nodeRegion?: string,
  ): RuntimeWeatherSnapshot | undefined;
  subscribeProject(
    projectId: string,
    callbacks?: {
      onUpdate?: (snapshot: RuntimeWeatherProjectSnapshot) => void;
      onError?: (error: unknown) => void;
    },
  ): () => void;
  clear(): void;
}

export function createServerRuntimeWeatherSource(
  streamFactory: (url: string) => RuntimeWeatherStream = (url) => new EventSource(url),
): ServerRuntimeWeatherSource {
  const snapshotsByProjectId = new Map<string, RuntimeWeatherProjectSnapshot>();

  return {
    getSnapshot(project, nodeId, nodeRegion) {
      const projectSnapshot = snapshotsByProjectId.get(project.projectId);

      if (!projectSnapshot) {
        return project.defaultWeather
          ? {
              ...project.defaultWeather,
              regionId: nodeRegion ?? (nodeId ? project.nodeRegionsById?.[nodeId] : undefined),
              visibleInRecentLog: resolveWeatherRecentLogVisibility(project.weatherSettings, nodeId, nodeRegion ?? (nodeId ? project.nodeRegionsById?.[nodeId] : undefined)),
            }
          : undefined;
      }

      return resolveAssignedRuntimeWeatherSnapshot(project, projectSnapshot, nodeId, nodeRegion);
    },
    subscribeProject(projectId, callbacks) {
      const stream = streamFactory(buildRuntimeWeatherStreamUrl(projectId));

      stream.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          return;
        }

        const snapshot = JSON.parse(event.data) as RuntimeWeatherProjectSnapshot;
        snapshotsByProjectId.set(projectId, snapshot);
        callbacks?.onUpdate?.(snapshot);
      };

      stream.onerror = (error) => {
        callbacks?.onError?.(error);
      };

      return () => {
        stream.onmessage = null;
        stream.onerror = null;
        stream.close();
      };
    },
    clear() {
      snapshotsByProjectId.clear();
    },
  };
}

export function buildRuntimeWeatherStreamUrl(projectId: string): string {
  return `/api/runtime-weather/${encodeURIComponent(projectId)}/stream`;
}

export function resolveRuntimeWeatherProjectSnapshot(
  project: RuntimeWeatherProjectConfig,
  nowMs: number,
  anchorMsByPatternKey?: Map<string, number>,
): RuntimeWeatherProjectSnapshot {
  const patterns = Object.entries(project.weatherSettings?.patterns ?? {})
    .map(([patternId, pattern]) => resolveRuntimeWeatherPatternSnapshot(project.projectId, patternId, pattern, nowMs, anchorMsByPatternKey))
    .filter((entry): entry is RuntimeWeatherPatternSnapshot => Boolean(entry));

  return {
    nowMs,
    patterns,
  };
}

export function resolveAssignedRuntimeWeatherSnapshot(
  project: RuntimeWeatherProjectConfig,
  projectSnapshot: RuntimeWeatherProjectSnapshot,
  nodeId?: string,
  nodeRegion?: string,
): RuntimeWeatherSnapshot | undefined {
  const resolvedRegionId = nodeRegion ?? (nodeId ? project.nodeRegionsById?.[nodeId] : undefined);
  const assignedPatternId = resolveAssignedWeatherPatternId(project.weatherSettings, nodeId, resolvedRegionId);
  const patternSnapshot = assignedPatternId
    ? projectSnapshot.patterns.find((entry) => entry.patternId === assignedPatternId)
    : undefined;

  if (!patternSnapshot) {
    return project.defaultWeather
      ? {
          ...project.defaultWeather,
          regionId: resolvedRegionId,
          visibleInRecentLog: resolveWeatherRecentLogVisibility(project.weatherSettings, nodeId, resolvedRegionId),
        }
      : undefined;
  }

  return {
    patternId: patternSnapshot.patternId,
    stepId: patternSnapshot.stepId,
    kind: patternSnapshot.kind,
    intensity: patternSnapshot.intensity,
    statusText: patternSnapshot.statusText,
    regionId: resolvedRegionId,
    visibleInRecentLog: resolveWeatherRecentLogVisibility(project.weatherSettings, nodeId, resolvedRegionId),
    nowMs: patternSnapshot.nowMs,
    source: patternSnapshot.source,
  };
}

export function buildRuntimeWeatherLogEntry(snapshot: RuntimeWeatherSnapshot | undefined): ProjectedLogEntry | undefined {
  if (!snapshot) {
    return undefined;
  }

  if (!snapshot.visibleInRecentLog || snapshot.statusText.length === 0) {
    return undefined;
  }

  const blocks: ProjectedProseBlock[] = snapshot.statusText.map((line) => ({
    groupId: 'weather',
    kind: 'paragraph',
    text: line,
  }));

  return {
    id: `weather-${Math.random().toString(36).slice(2, 10)}`,
    text: blocks[0]?.text ?? snapshot.kind ?? 'Weather changes.',
    lane: 'recent',
    blocks,
  };
}

export function hasMeaningfulWeatherChange(
  previousSnapshot: RuntimeWeatherSnapshot | undefined,
  nextSnapshot: RuntimeWeatherSnapshot | undefined,
): boolean {
  if (!previousSnapshot || !nextSnapshot) {
    return false;
  }

  return previousSnapshot.patternId !== nextSnapshot.patternId
    || previousSnapshot.stepId !== nextSnapshot.stepId
    || previousSnapshot.kind !== nextSnapshot.kind
    || previousSnapshot.intensity !== nextSnapshot.intensity;
}

export function isWeatherLogEntry(entry: ProjectedLogEntry | undefined): boolean {
  if (!entry) {
    return false;
  }

  if (entry.id.startsWith('weather-')) {
    return true;
  }

  return (entry.blocks ?? []).some((block) => block.groupId === 'weather');
}

export function hasWeatherLogEntry(entries: ProjectedLogEntry[] | undefined): boolean {
  return (entries ?? []).some((entry) => isWeatherLogEntry(entry));
}

export function shouldAnnounceWeather(args: {
  reason: RuntimeWeatherAnnouncementReason;
  snapshot: RuntimeWeatherSnapshot | undefined;
  existingEntries?: ProjectedLogEntry[];
  lastDisplayedSnapshot?: RuntimeWeatherSnapshot;
}): boolean {
  const weatherEntry = args.snapshot ? buildRuntimeWeatherLogEntry(args.snapshot) : undefined;

  if (!weatherEntry) {
    return false;
  }

  if (args.reason === 'entry') {
    const latestWeatherEntry = [...(args.existingEntries ?? [])].reverse().find((entry) => isWeatherLogEntry(entry));
    return latestWeatherEntry?.text !== weatherEntry.text;
  }

  return hasMeaningfulWeatherChange(args.lastDisplayedSnapshot, args.snapshot);
}

export function shouldAnnounceWeatherChange(args: {
  currentNodeId?: string;
  previousNodeId?: string;
  previousSnapshot?: RuntimeWeatherSnapshot;
  snapshot?: RuntimeWeatherSnapshot;
  existingEntries?: ProjectedLogEntry[];
}): boolean {
  if (!args.currentNodeId) {
    return false;
  }

  const nextWeatherEntry = buildRuntimeWeatherLogEntry(args.snapshot);

  if (!nextWeatherEntry) {
    return false;
  }

  if (!args.previousNodeId) {
    return shouldAnnounceWeather({
      reason: 'entry',
      snapshot: args.snapshot,
      existingEntries: args.existingEntries,
    });
  }

  if (args.currentNodeId !== args.previousNodeId) {
    if (buildRuntimeWeatherLogEntry(args.previousSnapshot)) {
      return false;
    }

    return shouldAnnounceWeather({
      reason: 'entry',
      snapshot: args.snapshot,
      existingEntries: args.existingEntries,
    });
  }

  return hasMeaningfulWeatherChange(args.previousSnapshot, args.snapshot);
}

function resolveRuntimeWeatherPatternSnapshot(
  projectId: string,
  patternId: string,
  pattern: WeatherPatternDefinition,
  nowMs: number,
  anchorMsByPatternKey?: Map<string, number>,
): RuntimeWeatherPatternSnapshot | undefined {
  const steps = pattern.steps ?? [];

  if (steps.length === 0) {
    return undefined;
  }

  const anchorMs = resolveWeatherPatternAnchorMs(projectId, patternId, pattern, nowMs, anchorMsByPatternKey);
  const totalDurationMs = steps.reduce((sum, step) => sum + normalizeWeatherStepDurationMs(step, pattern), 0);

  if (totalDurationMs <= 0) {
    return undefined;
  }

  let offsetMs = Math.max(0, nowMs - anchorMs) % totalDurationMs;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const durationMs = normalizeWeatherStepDurationMs(step, pattern);

    if (offsetMs < durationMs) {
      return {
        patternId,
        stepId: step.id ?? `${patternId}:${index + 1}`,
        kind: step.kind,
        intensity: step.intensity,
        statusText: step.statusText ?? [],
        nowMs,
        source: 'server:weather-settings',
      };
    }

    offsetMs -= durationMs;
  }

  const fallbackStep = steps[0];

  return {
    patternId,
    stepId: fallbackStep.id ?? `${patternId}:1`,
    kind: fallbackStep.kind,
    intensity: fallbackStep.intensity,
    statusText: fallbackStep.statusText ?? [],
    nowMs,
    source: 'server:weather-settings',
  };
}

function resolveAssignedWeatherPatternId(
  weatherSettings: ProjectWeatherSettingsDefinition | undefined,
  nodeId?: string,
  nodeRegion?: string,
): string | undefined {
  const assignments = weatherSettings?.assignments;

  if (nodeId && assignments?.nodes?.[nodeId]) {
    return assignments.nodes[nodeId];
  }

  if (nodeRegion && assignments?.regions?.[nodeRegion]) {
    return assignments.regions[nodeRegion];
  }

  return assignments?.defaultPattern ?? Object.keys(weatherSettings?.patterns ?? {})[0];
}

function resolveWeatherRecentLogVisibility(
  weatherSettings: ProjectWeatherSettingsDefinition | undefined,
  nodeId?: string,
  nodeRegion?: string,
): boolean {
  const visibility = weatherSettings?.visibility;

  if (nodeId && visibility?.nodes?.[nodeId] !== undefined) {
    return visibility.nodes[nodeId];
  }

  if (nodeRegion && visibility?.regions?.[nodeRegion] !== undefined) {
    return visibility.regions[nodeRegion];
  }

  return visibility?.defaultRecentLog ?? false;
}

function resolveWeatherPatternAnchorMs(
  projectId: string,
  patternId: string,
  pattern: WeatherPatternDefinition,
  nowMs: number,
  anchorMsByPatternKey?: Map<string, number>,
): number {
  const authoredEpochMs = pattern.epoch ? Date.parse(pattern.epoch) : Number.NaN;

  if (Number.isFinite(authoredEpochMs)) {
    return authoredEpochMs;
  }

  if (!anchorMsByPatternKey) {
    return 0;
  }

  const key = `${projectId}:${patternId}`;
  const existingAnchor = anchorMsByPatternKey.get(key);

  if (existingAnchor !== undefined) {
    return existingAnchor;
  }

  anchorMsByPatternKey.set(key, nowMs);
  return nowMs;
}

function normalizeWeatherStepDurationMs(step: WeatherStepDefinition, pattern: WeatherPatternDefinition): number {
  const minutes = Number.isFinite(step.durationMinutes)
    ? (step.durationMinutes as number)
    : Number.isFinite(pattern.minutesPerStep)
      ? (pattern.minutesPerStep as number)
      : DEFAULT_WEATHER_STEP_DURATION_MINUTES;

  return Math.max(1, minutes) * 60_000;
}