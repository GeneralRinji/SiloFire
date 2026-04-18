import type { ProjectTimeSettingsDefinition, TimeCalendarDefinition, TimePhaseDefinition } from '../../../packages/schema/src';
import type { RuntimeClockSnapshot, RuntimeClockSource, RuntimeProjectData } from './contentRuntimeCore';

const EARTH_LIKE_4PHASE_IDS = ['day', 'evening', 'night', 'morning'];
const DEFAULT_PHASE_DURATION_MINUTES = 60;

export interface PreviewRuntimeClockSnapshot extends RuntimeClockSnapshot {
  calendarId?: string;
  nextPhaseInMs?: number;
}

export interface RuntimeClockProjectConfig {
  projectId: string;
  timeSettings?: ProjectTimeSettingsDefinition;
  defaultClock?: RuntimeClockSnapshot;
  nodeRegionsById?: Record<string, string>;
}

export interface ResolvedClockPhase {
  id: string;
  durationMs: number;
}

export interface RuntimeClockStream {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface ServerRuntimeClockSource extends RuntimeClockSource {
  subscribeProject(
    projectId: string,
    nodeId: string | undefined,
    nodeRegion: string | undefined,
    callbacks?: {
      onUpdate?: (snapshot: PreviewRuntimeClockSnapshot) => void;
      onError?: (error: unknown) => void;
    },
  ): () => void;
  clear(): void;
}

export function createPreviewRuntimeClockSource(
  runtimeProjects: Record<string, RuntimeProjectData>,
): RuntimeClockSource {
  const anchorMsByProjectId = new Map<string, number>();

  return {
    getSnapshot(projectId, nodeId) {
      const nowMs = Date.now();
      const project = runtimeProjects[projectId];

      if (!project?.timeSettings) {
        return undefined;
      }

      return resolveProjectClockSnapshot({
        projectId,
        timeSettings: project.timeSettings,
        defaultClock: project.defaultClock,
        nodeRegionsById: project.nodeRegionsById,
      }, nowMs, anchorMsByProjectId, nodeId);
    },
  };
}

export function createServerRuntimeClockSource(
  streamFactory: (url: string) => RuntimeClockStream = (url) => new EventSource(url),
): ServerRuntimeClockSource {
  const snapshotsByProjectId = new Map<string, PreviewRuntimeClockSnapshot>();

  return {
    getSnapshot(projectId, nodeId) {
      const nodeSnapshot = snapshotsByProjectId.get(getClockSnapshotCacheKey(projectId, nodeId));
      const projectSnapshot = snapshotsByProjectId.get(getClockSnapshotCacheKey(projectId));

      return selectFreshestClockSnapshot(nodeSnapshot, projectSnapshot);
    },
    subscribeProject(projectId, nodeId, nodeRegion, callbacks) {
      const stream = streamFactory(buildRuntimeClockStreamUrl(projectId, nodeId, nodeRegion));

      stream.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          return;
        }

        const snapshot = JSON.parse(event.data) as PreviewRuntimeClockSnapshot;
        cacheClockSnapshot(snapshotsByProjectId, projectId, snapshot, nodeId);
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

export function buildRuntimeClockStreamUrl(
  projectId: string,
  nodeId?: string,
  nodeRegion?: string,
): string {
  const searchParams = new URLSearchParams();

  if (nodeId) {
    searchParams.set('nodeId', nodeId);
  }

  if (nodeRegion) {
    searchParams.set('nodeRegion', nodeRegion);
  }

  return `/api/runtime-clock/${encodeURIComponent(projectId)}/stream${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`;
}

export function resolveProjectClockSnapshot(
  project: RuntimeClockProjectConfig,
  nowMs: number,
  anchorMsByProjectId?: Map<string, number>,
  nodeId?: string,
  nodeRegion?: string,
): PreviewRuntimeClockSnapshot | undefined {
  if (!project.timeSettings) {
    return undefined;
  }

  const anchorMs = resolveProjectClockAnchorMs(project, nowMs, anchorMsByProjectId);
  return resolvePreviewRuntimeClockSnapshot(project.timeSettings, nowMs, anchorMs, project.defaultClock?.cycle, {
    nodeId,
    nodeRegion: nodeRegion ?? (nodeId ? project.nodeRegionsById?.[nodeId] : undefined),
  });
}

export function resolvePreviewRuntimeClockSnapshot(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  nowMs: number,
  anchorMs = nowMs,
  fallbackCycle: string[] | undefined = undefined,
  assignmentContext?: { nodeId?: string; nodeRegion?: string },
): PreviewRuntimeClockSnapshot | undefined {
  const resolvedCalendar = resolveAssignedCalendar(timeSettings, assignmentContext);

  if (!resolvedCalendar) {
    return undefined;
  }

  const phases = resolveCalendarPhases(resolvedCalendar.calendar, fallbackCycle);

  if (phases.length === 0) {
    return undefined;
  }

  const totalDurationMs = phases.reduce((sum, phase) => sum + phase.durationMs, 0);

  if (totalDurationMs <= 0) {
    return undefined;
  }

  const elapsedMs = Math.max(0, nowMs - anchorMs);
  let offsetMs = elapsedMs % totalDurationMs;

  for (const phase of phases) {
    if (offsetMs < phase.durationMs) {
      return {
        calendarId: resolvedCalendar.calendarId,
        phase: phase.id,
        cycle: phases.map((entry) => entry.id),
        nowMs,
        nextPhaseInMs: phase.durationMs - offsetMs,
        source: 'preview-local',
      };
    }

    offsetMs -= phase.durationMs;
  }

  const [fallbackPhase] = phases;

  return {
    calendarId: resolvedCalendar.calendarId,
    phase: fallbackPhase.id,
    cycle: phases.map((entry) => entry.id),
    nowMs,
    nextPhaseInMs: fallbackPhase.durationMs,
    source: 'preview-local',
  };
}

function resolveAssignedCalendar(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  assignmentContext?: { nodeId?: string; nodeRegion?: string },
): {
  calendarId: string;
  calendar: TimeCalendarDefinition;
} | undefined {
  const assignments = timeSettings?.assignments;
  const calendars = timeSettings?.calendars;

  if (!calendars) {
    return undefined;
  }

  const calendarId = assignmentContext?.nodeId && assignments?.nodes?.[assignmentContext.nodeId]
    ? assignments.nodes[assignmentContext.nodeId]
    : assignmentContext?.nodeRegion && assignments?.regions?.[assignmentContext.nodeRegion]
      ? assignments.regions[assignmentContext.nodeRegion]
      : assignments?.defaultCalendar ?? Object.keys(calendars)[0];
  const calendar = calendarId ? calendars[calendarId] : undefined;

  if (!calendarId || !calendar) {
    return undefined;
  }

  return { calendarId, calendar };
}

export function resolveRuntimeClockPhases(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  fallbackCycle: string[] | undefined,
): ResolvedClockPhase[] {
  const resolvedCalendar = resolveAssignedCalendar(timeSettings);
  return resolvedCalendar ? resolveCalendarPhases(resolvedCalendar.calendar, fallbackCycle) : [];
}

function resolveCalendarPhases(calendar: TimeCalendarDefinition, fallbackCycle: string[] | undefined): ResolvedClockPhase[] {
  const authoredPhases = calendar.phases?.length ? calendar.phases : undefined;
  const phaseTemplates = authoredPhases ?? buildPresetPhases(calendar.preset, fallbackCycle);

  if (!phaseTemplates || phaseTemplates.length === 0) {
    return [];
  }

  const fallbackDurationMinutes = normalizeDurationMinutes(calendar.minutesPerPhase);

  return phaseTemplates.map((phase) => ({
    id: phase.id,
    durationMs: normalizeDurationMinutes(phase.durationMinutes ?? fallbackDurationMinutes) * 60_000,
  }));
}

function buildPresetPhases(preset: string | undefined, fallbackCycle: string[] | undefined): TimePhaseDefinition[] | undefined {
  if (preset === 'earth_like_4phase') {
    const phaseIds = fallbackCycle?.length ? fallbackCycle : EARTH_LIKE_4PHASE_IDS;
    return phaseIds.map((id) => ({ id }));
  }

  return undefined;
}

function normalizeDurationMinutes(value: number | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : DEFAULT_PHASE_DURATION_MINUTES;
}

function resolveCalendarEpochMs(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  projectId: string,
): number | undefined {
  const resolvedCalendar = resolveAssignedCalendar(timeSettings);
  const epoch = resolvedCalendar?.calendar.epoch;

  if (!epoch) {
    return undefined;
  }

  const parsedEpoch = Date.parse(epoch);

  if (Number.isNaN(parsedEpoch)) {
    console.warn(`Ignoring invalid time epoch for ${projectId}: ${epoch}`);
    return undefined;
  }

  return parsedEpoch;
}

export function formatPreviewClockCountdown(nextPhaseInMs: number | undefined): string | undefined {
  if (!Number.isFinite(nextPhaseInMs) || (nextPhaseInMs ?? 0) <= 0) {
    return undefined;
  }

  const totalSeconds = Math.ceil((nextPhaseInMs as number) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function formatRuntimeClockTimestamp(nowMs: number | undefined): string | undefined {
  if (!Number.isFinite(nowMs)) {
    return undefined;
  }

  return new Date(nowMs as number).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function resolveProjectClockAnchorMs(
  project: RuntimeClockProjectConfig,
  nowMs: number,
  anchorMsByProjectId?: Map<string, number>,
): number {
  const epochMs = resolveCalendarEpochMs(project.timeSettings, project.projectId);

  if (epochMs !== undefined) {
    return epochMs;
  }

  if (!anchorMsByProjectId) {
    return resolvePhaseAlignedAnchorMs(project, nowMs);
  }

  const existingAnchor = anchorMsByProjectId.get(project.projectId);

  if (existingAnchor !== undefined) {
    return existingAnchor;
  }

  const nextAnchor = resolvePhaseAlignedAnchorMs(project, nowMs);
  anchorMsByProjectId.set(project.projectId, nextAnchor);
  return nextAnchor;
}

function resolvePhaseAlignedAnchorMs(project: RuntimeClockProjectConfig, nowMs: number): number {
  const phases = resolveRuntimeClockPhases(project.timeSettings, project.defaultClock?.cycle);
  const phaseId = project.defaultClock?.phase;

  if (!phaseId || phases.length === 0) {
    return nowMs;
  }

  let elapsedMs = 0;

  for (const phase of phases) {
    if (phase.id === phaseId) {
      return nowMs - elapsedMs;
    }

    elapsedMs += phase.durationMs;
  }

  return nowMs;
}

function cacheClockSnapshot(
  snapshotsByProjectId: Map<string, PreviewRuntimeClockSnapshot>,
  projectId: string,
  snapshot: PreviewRuntimeClockSnapshot,
  nodeId?: string,
): void {
  snapshotsByProjectId.set(getClockSnapshotCacheKey(projectId), snapshot);

  if (nodeId) {
    snapshotsByProjectId.set(getClockSnapshotCacheKey(projectId, nodeId), snapshot);
  }
}

function getClockSnapshotCacheKey(projectId: string, nodeId?: string): string {
  return `${projectId}::${nodeId ?? '*'}`;
}

function selectFreshestClockSnapshot(
  primary: PreviewRuntimeClockSnapshot | undefined,
  fallback: PreviewRuntimeClockSnapshot | undefined,
): PreviewRuntimeClockSnapshot | undefined {
  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  const primaryNowMs = Number.isFinite(primary.nowMs) ? (primary.nowMs as number) : Number.NEGATIVE_INFINITY;
  const fallbackNowMs = Number.isFinite(fallback.nowMs) ? (fallback.nowMs as number) : Number.NEGATIVE_INFINITY;

  return fallbackNowMs > primaryNowMs ? fallback : primary;
}