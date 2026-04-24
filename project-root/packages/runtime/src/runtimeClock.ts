import type { ProjectTimeSettingsDefinition, TimeCalendarDefinition, TimePhaseDefinition } from '../../schema/src';
import type { RuntimeClockSnapshot } from './index';

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
  nodeFoldersById?: Record<string, string[]>;
  nodeRegionsById?: Record<string, string>;
}

export interface ResolvedClockPhase {
  id: string;
  durationMs: number;
}

export interface ResolvedAssignedCalendar {
  calendarId: string;
  calendar: TimeCalendarDefinition;
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

  const assignmentContext = {
    nodeId,
    nodeFolders: nodeId ? project.nodeFoldersById?.[nodeId] : undefined,
    nodeRegion: nodeRegion ?? (nodeId ? project.nodeRegionsById?.[nodeId] : undefined),
  };
  const anchorMs = resolveProjectClockAnchorMs(project, nowMs, anchorMsByProjectId, assignmentContext);
  return resolvePreviewRuntimeClockSnapshot(project.timeSettings, nowMs, anchorMs, project.defaultClock?.cycle, assignmentContext);
}

export function resolvePreviewRuntimeClockSnapshot(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  nowMs: number,
  anchorMs = nowMs,
  fallbackCycle: string[] | undefined = undefined,
  assignmentContext?: { nodeId?: string; nodeFolders?: string[]; nodeRegion?: string },
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

export function resolveRuntimeClockPhases(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  fallbackCycle: string[] | undefined,
  assignmentContext?: { nodeId?: string; nodeFolders?: string[]; nodeRegion?: string },
): ResolvedClockPhase[] {
  const resolvedCalendar = resolveAssignedCalendar(timeSettings, assignmentContext);
  return resolvedCalendar ? resolveCalendarPhases(resolvedCalendar.calendar, fallbackCycle) : [];
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

function resolveAssignedCalendar(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  assignmentContext?: { nodeId?: string; nodeFolders?: string[]; nodeRegion?: string },
): ResolvedAssignedCalendar | undefined {
  const assignments = timeSettings?.assignments;
  const calendars = timeSettings?.calendars;

  if (!calendars) {
    return undefined;
  }

  const folderCalendarId = assignmentContext?.nodeFolders?.length
    ? [...assignmentContext.nodeFolders].reverse().find((folderPath) => assignments?.folders?.[folderPath])
    : undefined;
  const calendarId = assignmentContext?.nodeId && assignments?.nodes?.[assignmentContext.nodeId]
    ? assignments.nodes[assignmentContext.nodeId]
    : folderCalendarId
      ? assignments?.folders?.[folderCalendarId]
    : assignmentContext?.nodeRegion && assignments?.regions?.[assignmentContext.nodeRegion]
      ? assignments.regions[assignmentContext.nodeRegion]
      : assignments?.defaultCalendar ?? Object.keys(calendars)[0];
  const calendar = calendarId ? calendars[calendarId] : undefined;

  if (!calendarId || !calendar) {
    return undefined;
  }

  return { calendarId, calendar };
}

export function resolveAssignedProjectCalendar(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  assignmentContext?: { nodeId?: string; nodeFolders?: string[]; nodeRegion?: string },
): ResolvedAssignedCalendar | undefined {
  return resolveAssignedCalendar(timeSettings, assignmentContext);
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
  assignmentContext?: { nodeId?: string; nodeFolders?: string[]; nodeRegion?: string },
): number | undefined {
  const resolvedCalendar = resolveAssignedCalendar(timeSettings, assignmentContext);
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

function resolveProjectClockAnchorMs(
  project: RuntimeClockProjectConfig,
  nowMs: number,
  anchorMsByProjectId?: Map<string, number>,
  assignmentContext?: { nodeId?: string; nodeFolders?: string[]; nodeRegion?: string },
): number {
  const resolvedCalendar = resolveAssignedCalendar(project.timeSettings, assignmentContext);
  const epochMs = resolveCalendarEpochMs(project.timeSettings, project.projectId, assignmentContext);

  if (epochMs !== undefined) {
    return epochMs;
  }

  if (!anchorMsByProjectId) {
    return resolvePhaseAlignedAnchorMs(project, nowMs, assignmentContext);
  }

  const anchorCacheKey = getClockAnchorCacheKey(project.projectId, resolvedCalendar?.calendarId);
  const existingAnchor = anchorMsByProjectId.get(anchorCacheKey);

  if (existingAnchor !== undefined) {
    return existingAnchor;
  }

  const nextAnchor = resolvePhaseAlignedAnchorMs(project, nowMs, assignmentContext);
  anchorMsByProjectId.set(anchorCacheKey, nextAnchor);
  return nextAnchor;
}

function resolvePhaseAlignedAnchorMs(
  project: RuntimeClockProjectConfig,
  nowMs: number,
  assignmentContext?: { nodeId?: string; nodeFolders?: string[]; nodeRegion?: string },
): number {
  const phases = resolveRuntimeClockPhases(project.timeSettings, project.defaultClock?.cycle, assignmentContext);
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

function getClockAnchorCacheKey(projectId: string, calendarId: string | undefined): string {
  return `${projectId}::${calendarId ?? '*'}`;
}
