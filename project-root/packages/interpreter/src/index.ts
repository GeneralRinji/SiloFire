import type {
  AreaObject,
  ChoiceReference,
  ContentObject,
  ControlLabels,
  ExitReference,
  FlowBeatMarker,
  GateObject,
  PathDirection,
  PathFlowTrigger,
  PathObject,
  PoiReference,
  ProseSlot,
  ProseVariant,
  ProseTrigger,
} from '../../schema/src';

export type InterpretedNodeKind = ContentObject['templateSchema'];

export interface InterpretedMarker extends FlowBeatMarker {}

export interface InterpretedProseBlock {
  id: string;
  groupId?: string;
  kind: 'paragraph' | 'beat';
  text: string;
  markers?: InterpretedMarker[];
}

export interface InterpretedLogEntry {
  id: string;
  text: string;
}

export interface InterpretedAction {
  id: string;
  kind: 'exit' | 'choice' | 'poi' | 'gate_action';
  label: string;
  key?: string;
  targetId?: string;
}

export interface InterpretedControl {
  id: string;
  kind: 'continue' | 'skip' | 'back';
  label: string;
  key?: string;
}

export interface InterpretedNodeBase<TNode extends ContentObject> {
  node: TNode;
  proseBlocks?: InterpretedProseBlock[];
  recentLog?: InterpretedLogEntry[];
  actions?: InterpretedAction[];
  controls?: InterpretedControl[];
  autoAdvance?: boolean;
}

export type InterpretedAreaNode = InterpretedNodeBase<Extract<ContentObject, { templateSchema: 'area' }>>;

export type InterpretedPathNode = InterpretedNodeBase<Extract<ContentObject, { templateSchema: 'path' }>>;

export type InterpretedGateNode = InterpretedNodeBase<Extract<ContentObject, { templateSchema: 'gate' }>>;

export type InterpretedNode = InterpretedAreaNode | InterpretedPathNode | InterpretedGateNode;

export interface ProseSelection {
  trigger: ProseTrigger;
  key?: string;
  attempt?: number;
  occurrence?: number;
}

export interface InterpretAreaOptions {
  proseSelections?: ProseSelection[];
  includePois?: boolean;
  includeChoices?: boolean;
  includeExits?: boolean;
  recentLog?: InterpretedLogEntry[];
  autoAdvance?: boolean;
}

export interface InterpretPathOptions {
  flowTrigger?: PathFlowTrigger;
  direction?: PathDirection;
  controls?: InterpretedControl['kind'][];
  recentLog?: InterpretedLogEntry[];
  autoAdvance?: boolean;
}

export interface InterpretGateOptions {
  proseSelections?: ProseSelection[];
  direction?: PathDirection;
  blockedDirection?: PathDirection;
  includePois?: boolean;
  includeChoices?: boolean;
  includeExits?: boolean;
  controls?: InterpretedControl['kind'][];
  recentLog?: InterpretedLogEntry[];
  autoAdvance?: boolean;
}

export function toInterpretedExitAction(exit: ExitReference): InterpretedAction {
  return {
    id: exit.id,
    kind: 'exit',
    label: exit.displayName,
    key: exit.key,
    targetId: exit.targetId,
  };
}

export function interpretAreaNode(
  node: AreaObject,
  options: InterpretAreaOptions = {},
): InterpretedAreaNode {
  const proseSelections = options.proseSelections ?? [{ trigger: 'enter' }];
  const actions: InterpretedAction[] = [];

  if (options.includePois !== false) {
    actions.push(...(node.pois ?? []).map(toInterpretedPoiAction));
  }

  if (options.includeChoices !== false) {
    actions.push(...(node.choices ?? []).map(toInterpretedChoiceAction));
  }

  if (options.includeExits !== false) {
    actions.push(...(node.exits ?? []).map(toInterpretedExitAction));
  }

  return {
    node,
    proseBlocks: interpretProseSelections(node.proseSlots, proseSelections, 'paragraph'),
    recentLog: options.recentLog,
    actions: actions.length > 0 ? actions : undefined,
    autoAdvance: options.autoAdvance,
  };
}

export function interpretPathNode(
  node: PathObject,
  options: InterpretPathOptions = {},
): InterpretedPathNode {
  const flowTrigger = options.flowTrigger ?? 'first_visit';
  const direction = options.direction ?? 'forward';
  const flow = node.flows?.find((item) => item.trigger === flowTrigger && item.direction === direction);
  const controlKinds = options.controls ?? ['continue', 'skip', 'back'];

  return {
    node,
    proseBlocks: flow?.beats.map((beat, index) => ({
      id: `${flow.id}.beat.${index + 1}`,
      groupId: flow.id,
      kind: 'beat',
      text: beat.text,
      markers: beat.markers,
    })),
    recentLog: options.recentLog,
    controls: controlKinds.length > 0 ? controlKinds.map((kind) => toInterpretedControl(kind, node.controlLabels)) : undefined,
    autoAdvance: options.autoAdvance,
  };
}

export function interpretGateNode(
  node: GateObject,
  options: InterpretGateOptions = {},
): InterpretedGateNode {
  const proseSelections =
    options.proseSelections ?? defaultGateSelections(node.proseSlots, options.direction, options.blockedDirection);
  const controlKinds = options.controls ?? defaultGateControls(node, options.direction, options.blockedDirection !== undefined);
  const actions: InterpretedAction[] = [];

  if (options.includePois !== false) {
    actions.push(...(node.pois ?? []).map(toInterpretedPoiAction));
  }

  if (options.includeChoices !== false) {
    actions.push(...(node.choices ?? []).map(toInterpretedChoiceAction));
  }

  if (options.includeExits !== false && options.blockedDirection === undefined) {
    actions.push(...(node.exits ?? []).map(toInterpretedExitAction));
  }

  return {
    node,
    proseBlocks: interpretProseSelections(node.proseSlots, proseSelections, 'paragraph'),
    recentLog: options.recentLog,
    actions: actions.length > 0 ? actions : undefined,
    controls: controlKinds.length > 0 ? controlKinds.map((kind) => toInterpretedControl(kind, node.controlLabels)) : undefined,
    autoAdvance: options.autoAdvance,
  };
}

function defaultGateControls(
  node: GateObject,
  direction?: PathDirection,
  isBlocked = false,
): InterpretedControl['kind'][] {
  if (isBlocked) {
    return ['back'];
  }

  const hasSynthesizedContinue =
    !!direction &&
    !!node.endpoints?.[direction] &&
    (!node.exits || node.exits.length === 0);

  const controls: InterpretedControl['kind'][] = [];

  if (hasSynthesizedContinue) {
    controls.push('continue');
  }

  if (node.directionality && node.directionality !== 'bidirectional') {
    return controls;
  }

  controls.push('back');
  return controls;
}

function defaultGateSelections(
  slots: ProseSlot[] | undefined,
  direction?: PathDirection,
  blockedDirection?: PathDirection,
): ProseSelection[] {
  if (!slots || slots.length === 0) {
    return [];
  }

  if (blockedDirection) {
    if (slots.some((slot) => slot.trigger === 'blocked' && slot.key === blockedDirection)) {
      return [{ trigger: 'blocked', key: blockedDirection }];
    }

    if (slots.some((slot) => slot.trigger === 'blocked' && slot.key === undefined)) {
      return [{ trigger: 'blocked' }];
    }
  }

  const selections: ProseSelection[] = [];

  if (direction && slots.some((slot) => slot.trigger === 'billboard' && slot.key === direction)) {
    selections.push({ trigger: 'billboard', key: direction });
  } else if (slots.some((slot) => slot.trigger === 'billboard' && slot.key === undefined)) {
    selections.push({ trigger: 'billboard' });
  }

  if (direction && slots.some((slot) => slot.trigger === 'enter' && slot.key === direction)) {
    selections.push({ trigger: 'enter', key: direction });
  } else if (slots.some((slot) => slot.trigger === 'enter' && slot.key === undefined)) {
    selections.push({ trigger: 'enter' });
  }

  return selections;
}

function interpretProseSelections(
  slots: ProseSlot[] | undefined,
  selections: ProseSelection[],
  kind: InterpretedProseBlock['kind'],
): InterpretedProseBlock[] | undefined {
  if (!slots || slots.length === 0 || selections.length === 0) {
    return undefined;
  }

  const blocks = selections.flatMap((selection) => {
    const slot = resolveSelectionSlot(slots, selection);

    if (!slot) {
      return [];
    }

    const proseBlocks = resolveSlotBlocks(slot, kind, selection.key, selection.occurrence ?? selection.attempt);

    if (!proseBlocks || proseBlocks.length === 0) {
      return [];
    }

    return proseBlocks;
  });

  return blocks.length > 0 ? blocks : undefined;
}

function resolveSelectionSlot(
  slots: ProseSlot[],
  selection: ProseSelection,
): ProseSlot | undefined {
  const matchingSlots = slots
    .filter((slot) => slot.trigger === selection.trigger && slot.key === selection.key)
    .sort((left, right) => (left.attempt ?? 0) - (right.attempt ?? 0));

  if (matchingSlots.length === 0) {
    return undefined;
  }

  if (selection.attempt === undefined) {
    return matchingSlots.find((slot) => slot.attempt === undefined) ?? matchingSlots[0];
  }

  const exactMatch = matchingSlots.find((slot) => slot.attempt === selection.attempt);

  if (exactMatch) {
    return exactMatch;
  }

  const selectionAttempt = selection.attempt;
  const attemptedMatches = matchingSlots.filter((slot) => slot.attempt !== undefined && slot.attempt <= selectionAttempt);

  if (attemptedMatches.length > 0) {
    return attemptedMatches[attemptedMatches.length - 1];
  }

  return matchingSlots.find((slot) => slot.attempt === undefined) ?? matchingSlots[0];
}

function resolveSlotBlocks(
  slot: ProseSlot,
  kind: InterpretedProseBlock['kind'],
  selectionKey?: string,
  selectionCount?: number,
): InterpretedProseBlock[] | undefined {
  if (slot.mode === 'silent') {
    return undefined;
  }

  const textVariant = selectSlotVariant(slot.variants, slot.mode, selectionCount);

  if (!textVariant || textVariant.kind !== 'text') {
    return undefined;
  }

  const sourceBlocks = textVariant.blocks && textVariant.blocks.length > 0
    ? textVariant.blocks
    : [{ text: textVariant.text, markers: undefined }];

  return sourceBlocks
    .filter((block) => block.text.length > 0)
    .map((block, index) => ({
      id: `${selectionKey ? `${slot.id}.${selectionKey}` : slot.id}.block.${index + 1}`,
      groupId: slot.id,
      kind,
      text: block.text,
      markers: block.markers,
    }));
}

function selectSlotVariant(
  variants: ProseVariant[],
  mode: ProseSlot['mode'],
  selectionCount?: number,
): ProseVariant | undefined {
  if (variants.length === 0) {
    return undefined;
  }

  if (mode === 'random') {
    const index = Math.floor(Math.random() * variants.length);
    return variants[index];
  }

  if (mode === 'weighted') {
    return selectWeightedVariant(variants);
  }

  if (mode === 'cycle') {
    return selectCycleVariant(variants, selectionCount);
  }

  return variants[0];
}

function selectCycleVariant(variants: ProseVariant[], selectionCount?: number): ProseVariant {
  const normalizedCount = selectionCount && selectionCount > 0 ? selectionCount : 1;
  const index = (normalizedCount - 1) % variants.length;
  return variants[index];
}

function selectWeightedVariant(variants: ProseVariant[]): ProseVariant {
  const weightedVariants = variants.map((variant) => ({
    variant,
    weight: Number.isFinite(variant.weight) && (variant.weight ?? 0) > 0 ? (variant.weight as number) : 1,
  }));
  const totalWeight = weightedVariants.reduce((sum, entry) => sum + entry.weight, 0);

  if (totalWeight <= 0) {
    return variants[0];
  }

  let threshold = Math.random() * totalWeight;

  for (const entry of weightedVariants) {
    threshold -= entry.weight;

    if (threshold < 0) {
      return entry.variant;
    }
  }

  return weightedVariants[weightedVariants.length - 1].variant;
}

function toInterpretedPoiAction(poi: PoiReference): InterpretedAction {
  return {
    id: poi.id,
    kind: 'poi',
    label: poi.displayName,
    key: poi.key,
  };
}

function toInterpretedChoiceAction(choice: ChoiceReference): InterpretedAction {
  return {
    id: choice.id,
    kind: 'choice',
    label: choice.displayName,
    key: choice.key,
  };
}

function toInterpretedControl(kind: InterpretedControl['kind'], labels?: ControlLabels): InterpretedControl {
  if (kind === 'continue') {
    return { id: 'continue', kind: 'continue', label: labels?.continue ?? 'Continue', key: 'A' };
  }

  if (kind === 'skip') {
    return { id: 'skip', kind: 'skip', label: labels?.skip ?? 'Skip', key: 'S' };
  }

  return { id: 'back', kind: 'back', label: labels?.back ?? 'Back', key: 'B' };
}