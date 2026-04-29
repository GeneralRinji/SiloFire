import type {
  InterpretedAction,
  InterpretedControl,
  InterpretedGateNode,
  InterpretedLogEntry,
  InterpretedNode,
  InterpretedPathNode,
  InterpretedProseBlock,
  InterpretedAreaNode,
} from '../../interpreter/src';

export interface ProjectedMarker {
  kind: 'delay' | 'fade';
  value: string;
}

export interface ProjectedProseBlock {
  groupId?: string;
  kind: 'paragraph' | 'beat';
  text: string;
  markers?: ProjectedMarker[];
}

export type ProjectedTextLane = 'visible' | 'recent';

export interface ProjectedLogEntry {
  id: string;
  text: string;
  scope?: string;
  lane?: ProjectedTextLane;
  markers?: ProjectedMarker[];
  blocks?: ProjectedProseBlock[];
}

export interface ProjectedAction {
  id: string;
  kind: 'exit' | 'choice' | 'poi' | 'gate_action';
  label: string;
  key?: string;
  keyLabel?: string;
  meta?: string;
  targetId?: string;
}

export interface ProjectedControl {
  id: string;
  kind: 'continue' | 'skip' | 'back';
  label: string;
  key?: string;
  keyLabel?: string;
}

export interface ProjectedAreaNavigationLabels {
  pois?: string;
  choices?: string;
  exits?: string;
  controls?: string;
}

export interface ProjectedPage {
  kind: 'page';
  nodeId: string;
  nodeKind: 'area' | 'path' | 'gate';
  title?: string;
  tagline?: string;
  areaNavigationLabels?: ProjectedAreaNavigationLabels;
  gateNavigationLabels?: ProjectedAreaNavigationLabels;
  proseBlocks: ProjectedProseBlock[];
  recentLog?: ProjectedLogEntry[];
  actions: ProjectedAction[];
  controls: ProjectedControl[];
}

export interface ProjectedAutoAdvance {
  kind: 'auto_advance';
  nodeId: string;
  nodeKind: 'area' | 'path' | 'gate';
}

export type ProjectionResult = ProjectedPage | ProjectedAutoAdvance;

export function projectNode(input: InterpretedNode): ProjectionResult {
  if (shouldAutoAdvance(input)) {
    return {
      kind: 'auto_advance',
      nodeId: input.node.id,
      nodeKind: input.node.templateSchema,
    };
  }

  return {
    kind: 'page',
    nodeId: input.node.id,
    nodeKind: input.node.templateSchema,
    title: input.node.displayName,
    tagline: input.node.tagline,
    areaNavigationLabels: input.node.templateSchema === 'area' ? input.node.navigationLabels : undefined,
    gateNavigationLabels: input.node.templateSchema === 'gate' ? input.node.navigationLabels : undefined,
    proseBlocks: projectProseBlocks(input.proseBlocks),
    recentLog: projectRecentLog(input.recentLog),
    actions: projectActions(input.actions),
    controls: projectControls(input.controls),
  };
}

export function projectAreaNode(input: InterpretedAreaNode): ProjectionResult {
  return projectNode(input);
}

export function projectPathNode(input: InterpretedPathNode): ProjectionResult {
  return projectNode(input);
}

export function projectGateNode(input: InterpretedGateNode): ProjectionResult {
  return projectNode(input);
}

function shouldAutoAdvance(input: InterpretedNode): boolean {
  if (input.autoAdvance) {
    return true;
  }

  const hasVisibleProse = (input.proseBlocks?.length ?? 0) > 0;
  const hasVisibleActions = (input.actions?.length ?? 0) > 0;
  const hasVisibleControls = (input.controls?.length ?? 0) > 0;
  const hasVisibleLog = (input.recentLog?.length ?? 0) > 0;
  const presentationMode = input.node.presentationMode;
  const isPassthroughMode =
    presentationMode === 'passthrough' ||
    presentationMode === 'walkpassthrough' ||
    presentationMode === 'runpassthrough';

  if (isPassthroughMode && !hasVisibleProse && !hasVisibleActions && !hasVisibleControls && !hasVisibleLog) {
    return true;
  }

  return !hasVisibleProse && !hasVisibleActions && !hasVisibleControls && !hasVisibleLog;
}

function projectProseBlocks(blocks: InterpretedProseBlock[] | undefined): ProjectedProseBlock[] {
  if (!blocks || blocks.length === 0) {
    return [];
  }

  return blocks.map((block) => ({
    groupId: block.groupId,
    kind: block.kind,
    text: block.text,
    markers: block.markers?.map((marker) => ({
      kind: marker.kind,
      value: marker.value,
    })),
  }));
}

function projectRecentLog(entries: InterpretedLogEntry[] | undefined): ProjectedLogEntry[] | undefined {
  if (!entries || entries.length === 0) {
    return undefined;
  }

  return entries.map((entry) => ({
    id: entry.id,
    text: entry.text,
    scope: entry.scope,
    lane: 'recent',
  }));
}

function projectActions(actions: InterpretedAction[] | undefined): ProjectedAction[] {
  if (!actions || actions.length === 0) {
    return [];
  }

  return actions.map((action) => ({
    id: action.id,
    kind: action.kind,
    label: action.label,
    key: action.key,
    keyLabel: toKeyLabel(action.key),
    targetId: action.targetId,
  }));
}

function projectControls(controls: InterpretedControl[] | undefined): ProjectedControl[] {
  if (!controls || controls.length === 0) {
    return [];
  }

  return controls.map((control) => ({
    id: control.id,
    kind: control.kind,
    label: control.label,
    key: control.key,
    keyLabel: toKeyLabel(control.key),
  }));
}

function toKeyLabel(key: string | undefined): string | undefined {
  return key ? `[${key.toUpperCase()}]` : undefined;
}