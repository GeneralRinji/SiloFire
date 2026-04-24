import type { ProjectedLogEntry, ProjectedProseBlock } from '../../../packages/projection/src';
import { resolveAssignedProjectCalendar, type PreviewRuntimeClockSnapshot } from '../../../packages/runtime/src/runtimeClock';
import type { ProjectTimeSettingsDefinition } from '../../../packages/schema/src';

export interface RuntimeTimeSnapshot extends PreviewRuntimeClockSnapshot {
  statusText: string[];
  visibleInRecentLog?: boolean;
  regionId?: string;
}

export interface RuntimeTimeProjectConfig {
  projectId: string;
  timeSettings?: ProjectTimeSettingsDefinition;
  nodeFoldersById?: Record<string, string[]>;
  nodeRegionsById?: Record<string, string>;
}

export type RuntimeTimeAnnouncementReason = 'entry' | 'change';

export function resolveAssignedRuntimeTimeSnapshot(
  project: RuntimeTimeProjectConfig,
  snapshot: PreviewRuntimeClockSnapshot | undefined,
  nodeId?: string,
  nodeRegion?: string,
): RuntimeTimeSnapshot | undefined {
  if (!snapshot) {
    return undefined;
  }

  const resolvedRegionId = nodeRegion ?? (nodeId ? project.nodeRegionsById?.[nodeId] : undefined);
  const resolvedCalendar = resolveAssignedProjectCalendar(project.timeSettings, {
    nodeId,
    nodeFolders: nodeId ? project.nodeFoldersById?.[nodeId] : undefined,
    nodeRegion: resolvedRegionId,
  });
  const phaseDefinition = snapshot.phase
    ? resolvedCalendar?.calendar.phases?.find((phase) => phase.id === snapshot.phase)
    : undefined;

  return {
    ...snapshot,
    statusText: phaseDefinition?.statusText ?? [],
    visibleInRecentLog: resolveTimeRecentLogVisibility(
      project.timeSettings,
      nodeId,
      nodeId ? project.nodeFoldersById?.[nodeId] : undefined,
      resolvedRegionId,
    ),
    regionId: resolvedRegionId,
  };
}

export function buildRuntimeTimeLogEntry(snapshot: RuntimeTimeSnapshot | undefined): ProjectedLogEntry | undefined {
  if (!snapshot || !snapshot.visibleInRecentLog || snapshot.statusText.length === 0) {
    return undefined;
  }

  const blocks: ProjectedProseBlock[] = snapshot.statusText.map((line) => ({
    groupId: 'time',
    kind: 'paragraph',
    text: line,
  }));

  return {
    id: `time-${Math.random().toString(36).slice(2, 10)}`,
    text: blocks[0]?.text ?? snapshot.phase ?? 'Time changes.',
    lane: 'recent',
    blocks,
  };
}

export function hasMeaningfulTimeChange(
  previousSnapshot: RuntimeTimeSnapshot | undefined,
  nextSnapshot: RuntimeTimeSnapshot | undefined,
): boolean {
  if (!previousSnapshot || !nextSnapshot) {
    return false;
  }

  return previousSnapshot.calendarId !== nextSnapshot.calendarId
    || previousSnapshot.phase !== nextSnapshot.phase;
}

export function isTimeLogEntry(entry: ProjectedLogEntry | undefined): boolean {
  if (!entry) {
    return false;
  }

  if (entry.id.startsWith('time-')) {
    return true;
  }

  return (entry.blocks ?? []).some((block) => block.groupId === 'time');
}

export function shouldAnnounceTime(args: {
  reason: RuntimeTimeAnnouncementReason;
  snapshot: RuntimeTimeSnapshot | undefined;
  existingEntries?: ProjectedLogEntry[];
  lastDisplayedSnapshot?: RuntimeTimeSnapshot;
}): boolean {
  const timeEntry = args.snapshot ? buildRuntimeTimeLogEntry(args.snapshot) : undefined;

  if (!timeEntry) {
    return false;
  }

  if (args.reason === 'entry') {
    const latestTimeEntry = [...(args.existingEntries ?? [])].reverse().find((entry) => isTimeLogEntry(entry));
    return latestTimeEntry?.text !== timeEntry.text;
  }

  return hasMeaningfulTimeChange(args.lastDisplayedSnapshot, args.snapshot);
}

export function shouldAnnounceTimeChange(args: {
  currentNodeId?: string;
  previousNodeId?: string;
  previousSnapshot?: RuntimeTimeSnapshot;
  snapshot?: RuntimeTimeSnapshot;
  existingEntries?: ProjectedLogEntry[];
}): boolean {
  if (!args.currentNodeId) {
    return false;
  }

  const nextTimeEntry = buildRuntimeTimeLogEntry(args.snapshot);

  if (!nextTimeEntry) {
    return false;
  }

  if (!args.previousNodeId) {
    return shouldAnnounceTime({
      reason: 'entry',
      snapshot: args.snapshot,
      existingEntries: args.existingEntries,
    });
  }

  if (args.currentNodeId !== args.previousNodeId) {
    return false;
  }

  return hasMeaningfulTimeChange(args.previousSnapshot, args.snapshot);
}

function resolveTimeRecentLogVisibility(
  timeSettings: ProjectTimeSettingsDefinition | undefined,
  nodeId?: string,
  nodeFolders?: string[],
  nodeRegion?: string,
): boolean {
  const visibility = timeSettings?.visibility;

  if (nodeId && visibility?.nodes?.[nodeId] !== undefined) {
    return visibility.nodes[nodeId];
  }

    const matchingFolder = nodeFolders?.length
      ? [...nodeFolders].reverse().find((folder) => visibility?.folders?.[folder] !== undefined)
      : undefined;

  if (matchingFolder && visibility?.folders) {
    return visibility.folders[matchingFolder];
  }

  if (nodeRegion && visibility?.regions?.[nodeRegion] !== undefined) {
    return visibility.regions[nodeRegion];
  }

  return visibility?.defaultRecentLog ?? false;
}