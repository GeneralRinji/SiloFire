import { parseAreaToSchema, parseEventSidecar, parseGateToSchema, parseNpcPredicateDefinitions, parseNpcSidecar, parsePathToSchema, parsePredicateSidecar, parseStateSidecar, parseTimeSettingsSidecar, parseWeatherSettingsSidecar } from '../../parser/src';
import { interpretAreaNode, interpretGateNode, interpretPathNode } from '../../interpreter/src';
import type { ParsedFrontMatterObject, ParsedFrontMatterValue } from '../../parser/src';
import type { AreaObject, ContentEventDefinition, ContentNpcDefinition, EventEffectDefinition, FixtureReference, FlowBeatMarker, GateObject, PathDirection, PathObject, ProjectTimeSettingsDefinition, ProjectWeatherSettingsDefinition, ProseSlot, ProseTextBlock, ProseTrigger, ProseVariant, TimeScheduleDefinition, TimeScheduleTriggerDefinition, TitleScreenConfig } from '../../schema/src';
import { projectAreaNode, projectGateNode, projectPathNode, type ProjectionResult } from '../../projection/src';
import type { ProjectedAction, ProjectedControl, ProjectedFixturePanel, ProjectedLogEntry, ProjectedProseBlock, ProjectedTextLane } from '../../projection/src';
import type { ContentObject } from '../../schema/src';
import { JUKEBOX_CATALOGS, type JukeboxCatalogSong } from './jukeboxCatalogs';
import { resolveAssignedProjectCalendar } from './runtimeClock';
import type { RuntimeWeatherSnapshot } from './runtimeWeatherTypes';

export type { RuntimeWeatherSnapshot } from './runtimeWeatherTypes';

export interface RuntimeNodeLink {
  id: string;
  label: string;
  region?: string;
}

export interface RuntimeProjectData {
  projectId: string;
  startNodeId?: string;
  nodes: RuntimeNodeLink[];
  nodeFoldersById: Record<string, string[]>;
  nodeRegionsById: Record<string, string>;
  pagesByNodeId: Record<string, ProjectionResult>;
  eventsByNodeId: Record<string, ContentEventDefinition[]>;
  titleScreen?: TitleScreenConfig;
  timeSettings?: ProjectTimeSettingsDefinition;
  weatherSettings?: ProjectWeatherSettingsDefinition;
  defaultClock?: RuntimeClockSnapshot;
  defaultWeather?: RuntimeWeatherSnapshot;
}

export type RuntimeSessionScalar = string | number | boolean | null;
export type RuntimeSessionValue = RuntimeSessionScalar | RuntimeSessionObject | RuntimeSessionValue[];

export interface RuntimeSessionObject {
  [key: string]: RuntimeSessionValue;
}

export interface RuntimeSessionState extends RuntimeSessionObject {}

export type RuntimeProjectionAudience =
  | { kind: 'shared' }
  | { kind: 'actor'; actorId: string }
  | { kind: 'viewer'; viewerId: string }
  | { kind: 'witnesses'; actorId: string }
  | { kind: 'viewers_matching_predicate'; predicateId: string };

export type RuntimeProjectionDelivery =
  | { kind: 'append' }
  | { kind: 'replace_scope'; scope: string }
  | { kind: 'replace_shared_for_viewer'; scope: string };

export interface RuntimeProjectionEmission {
  lane: ProjectedTextLane;
  audience: RuntimeProjectionAudience;
  delivery: RuntimeProjectionDelivery;
  text: string;
}

export interface RuntimeFixtureInteractionState {
  focused?: boolean;
  browseIndex?: number;
  fakeCredits?: number;
}

export type RuntimeFixtureInteractionStateById = Record<string, RuntimeFixtureInteractionState>;

export interface RuntimeClockSnapshot {
  phase?: string;
  cycle?: string[];
  nowMs?: number;
  source?: string;
  calendarId?: string;
  nextPhaseInMs?: number;
}

export interface RuntimeClockSource {
  getSnapshot(projectId: string, nodeId?: string): RuntimeClockSnapshot | undefined;
}

export interface RuntimeSystemContext {
  clock?: RuntimeClockSnapshot;
  weather?: RuntimeWeatherSnapshot;
}

export interface RuntimeWeatherSource {
  getSnapshot(project: RuntimeProjectData, nodeId?: string, nodeRegion?: string): RuntimeWeatherSnapshot | undefined;
}

export interface RuntimeResolvedEventAudience {
  text: string[];
}

export interface RuntimeResolvedEventResult {
  eventId: string;
  actorId?: string;
  viewerId?: string;
  actor: RuntimeResolvedEventAudience;
  private?: RuntimeResolvedEventAudience;
  witnesses?: RuntimeResolvedEventAudience;
}

export interface RuntimeInteractionOutcome {
  nextNodeId?: string;
  nextPathDirection?: PathDirection;
  nextPathBeatIndex?: number;
  resetNodeId?: string;
  logEntry?: ProjectedLogEntry;
  clearNodeRecentLog?: boolean;
  replaceNodeLogScope?: string;
  sessionState?: RuntimeSessionState;
  fixtureInteractionStateById?: RuntimeFixtureInteractionStateById;
  eventResult?: RuntimeResolvedEventResult;
  projectionEmissions?: RuntimeProjectionEmission[];
}

const JUKEBOX_AUTOPLAY_TRACK_ID = 'song_001';
const JUKEBOX_DEFAULT_TRACK_PRICE_DOLLARS = 1;
const JUKEBOX_DEFAULT_MAX_QUEUE_LENGTH = 20;

export interface ActionResolutionOptions {
  attempt?: number;
  sessionState?: RuntimeSessionState;
  fixtureInteractionStateById?: RuntimeFixtureInteractionStateById;
  actorId?: string;
  viewerId?: string;
  systemContext?: RuntimeSystemContext;
}

export interface OfferedActionResolutionOptions {
  sessionState?: RuntimeSessionState;
  fixtureInteractionStateById?: RuntimeFixtureInteractionStateById;
  actorId?: string;
  viewerId?: string;
  systemContext?: RuntimeSystemContext;
}

export interface ControlResolutionOptions {
  pathVisitCount?: number;
  pathBeatIndex?: number;
}

export interface ProjectPageOptions {
  areaVisitCount?: number;
  pathVisitCount?: number;
  pathBeatIndex?: number;
  sessionState?: RuntimeSessionState;
}

export interface ContentRuntimeOptions {
  validateProjects?: boolean;
  clockSource?: RuntimeClockSource;
  weatherSource?: RuntimeWeatherSource;
}

interface RuntimeNodeRecord {
  node: ContentObject;
  page: ProjectionResult;
  sourcePath: string;
}

interface RuntimeProjectRecord extends RuntimeProjectData {
  initialSessionState: RuntimeSessionState;
  predicateDefinitions: Record<string, ParsedFrontMatterObject>;
  npcRecordsById: Record<string, RuntimeNpcRecord>;
  nodeIdsByAlias: Record<string, string>;
  nodeRecordsById: Record<string, RuntimeNodeRecord>;
}

interface RuntimeNpcRecord {
  definition: ContentNpcDefinition;
  predicateDefinitions: Record<string, ParsedFrontMatterObject>;
}

const PREFERRED_START_NODE_ID = 'title_screen';

export function createContentRuntime(
  contentFiles: Record<string, string>,
  options: ContentRuntimeOptions = {},
) {
  const runtimeOptions = options;
  const projectRuntimeInternal = buildProjectRuntime(contentFiles, options);
  const runtime: Record<string, RuntimeProjectData> = Object.fromEntries(
    Object.entries(projectRuntimeInternal).map(([projectId, project]) => [
      projectId,
      {
        projectId,
        startNodeId: project.startNodeId,
        nodes: project.nodes,
        nodeFoldersById: project.nodeFoldersById,
        nodeRegionsById: project.nodeRegionsById,
        pagesByNodeId: project.pagesByNodeId,
        eventsByNodeId: project.eventsByNodeId,
        titleScreen: project.titleScreen,
        timeSettings: project.timeSettings,
        weatherSettings: project.weatherSettings,
        defaultClock: project.defaultClock,
        defaultWeather: project.defaultWeather,
      },
    ]),
  );

  function resolveProjectAction(
    projectId: string,
    nodeId: string,
    action: ProjectedAction,
    options: ActionResolutionOptions = {},
  ): RuntimeInteractionOutcome {
    const project = projectRuntimeInternal[projectId];
    const nodeRecord = project?.nodeRecordsById[nodeId];

    if (!project || !nodeRecord) {
      return {};
    }

    const currentSessionState = hydrateRuntimeSessionState(
      project,
      options.sessionState,
      nodeId,
      options.systemContext,
      runtimeOptions.clockSource,
      runtimeOptions.weatherSource,
    );
    const currentSystemContext = resolveRuntimeSystemContext(
      projectId,
      project,
      nodeId,
      currentSessionState,
      options.systemContext,
      runtimeOptions.clockSource,
      runtimeOptions.weatherSource,
    );
    const resolvedOptions: ActionResolutionOptions = {
      ...options,
      sessionState: currentSessionState,
      systemContext: currentSystemContext,
    };

    if (nodeRecord.node.templateSchema === 'area') {
      if (action.kind === 'poi') {
        const eventOutcome = resolveSidecarActionEvent(projectId, project, nodeId, action, resolvedOptions, runtimeOptions.clockSource);

        if (eventOutcome) {
          return eventOutcome;
        }

        const fixtureOutcome = resolveAreaFixturePoiAction(
          nodeRecord.node,
          action,
          currentSessionState,
          options.fixtureInteractionStateById,
          currentSystemContext,
        );

        if (fixtureOutcome) {
          return fixtureOutcome;
        }

        return createLogOutcome(resolveProseSlotEntry(nodeRecord.node, 'poi_inspect', action.id, options.attempt), 'recent');
      }

      if (action.kind === 'choice') {
        const fixtureOutcome = resolveAreaFixtureChoiceAction(
          nodeRecord.node,
          action,
          currentSessionState,
          options.fixtureInteractionStateById,
          currentSystemContext,
        );

        if (fixtureOutcome) {
          return fixtureOutcome;
        }

        const eventOutcome = resolveSidecarActionEvent(projectId, project, nodeId, action, resolvedOptions, runtimeOptions.clockSource);

        if (eventOutcome) {
          return eventOutcome;
        }

        return createLogOutcome(resolveProseSlotEntry(nodeRecord.node, 'choice_result', action.id, options.attempt), 'visible');
      }
    }

    if (nodeRecord.node.templateSchema === 'gate') {
      if (action.kind === 'poi') {
        const eventOutcome = resolveSidecarActionEvent(projectId, project, nodeId, action, options, runtimeOptions.clockSource);

        if (eventOutcome) {
          return eventOutcome;
        }

        return createLogOutcome(resolveProseSlotEntry(nodeRecord.node, 'poi_inspect', action.id, options.attempt), 'recent');
      }

      if (action.kind === 'choice') {
        const eventOutcome = resolveSidecarActionEvent(projectId, project, nodeId, action, options, runtimeOptions.clockSource);

        if (eventOutcome) {
          return eventOutcome;
        }

        return createLogOutcome(resolveProseSlotEntry(nodeRecord.node, 'choice_result', action.id, options.attempt), 'visible');
      }
    }

    const resolvedTarget = action.targetId
      ? resolveReachableNode(project, nodeId, action.targetId, 'forward')
      : undefined;

    if (action.kind === 'exit' && resolvedTarget) {
      const eventOutcome = resolveSidecarActionEvent(projectId, project, nodeId, action, options, runtimeOptions.clockSource);

      if (eventOutcome) {
        return {
          ...eventOutcome,
          nextNodeId: resolvedTarget.nodeId,
          nextPathDirection: resolvedTarget.pathDirection,
        };
      }

      return {
        nextNodeId: resolvedTarget.nodeId,
        nextPathDirection: resolvedTarget.pathDirection,
        logEntry: createLogEntry(`Taking exit: ${action.label}`, undefined, undefined, 'recent'),
      };
    }

    return {};
  }

  function resolveProjectControl(
    projectId: string,
    nodeId: string,
    pathDirection: PathDirection | undefined,
    control: ProjectedControl,
    options: ControlResolutionOptions = {},
  ): RuntimeInteractionOutcome {
    const project = projectRuntimeInternal[projectId];
    const nodeRecord = project?.nodeRecordsById[nodeId];

    if (!project || !nodeRecord) {
      return {};
    }

    if (nodeRecord.node.templateSchema === 'path') {
      const activeDirection = pathDirection ?? 'forward';
      const flowTrigger = selectPathFlowTrigger(nodeRecord.node, activeDirection, options.pathVisitCount);
      const traversalMode = selectPathTraversalMode(nodeRecord.node, flowTrigger);
      const activeFlow = nodeRecord.node.flows?.find(
        (flow) => flow.trigger === flowTrigger && flow.direction === activeDirection,
      );
      const totalBeatCount = activeFlow?.beats.length ?? 0;
      const currentBeatIndex = clampPathBeatIndex(options.pathBeatIndex, totalBeatCount);
      const nextTarget = resolveReachableNode(
        project,
        nodeId,
        nodeRecord.node.endpoints[activeDirection]?.to,
        activeDirection,
      );

      if (
        control.kind === 'continue' &&
        traversalMode === 'paged' &&
        totalBeatCount > 1 &&
        currentBeatIndex < totalBeatCount - 1
      ) {
        return {
          nextNodeId: nodeId,
          nextPathDirection: activeDirection,
          nextPathBeatIndex: currentBeatIndex + 1,
        };
      }

      if (control.kind === 'back') {
        const reverseTarget = resolveReachableNode(
          project,
          nodeId,
          nodeRecord.node.endpoints[activeDirection]?.from,
          activeDirection === 'forward' ? 'backward' : 'forward',
        );

        if (reverseTarget) {
          return {
            nextNodeId: reverseTarget.nodeId,
            nextPathDirection: reverseTarget.pathDirection,
            logEntry: createLogEntry('You turn back.', undefined, undefined, 'recent'),
          };
        }
      }

      if (flowTrigger === 'block') {
        return {};
      }

      if ((control.kind === 'continue' || control.kind === 'skip') && nextTarget) {
        return {
          nextNodeId: nextTarget.nodeId,
          nextPathDirection: nextTarget.pathDirection,
          logEntry: createLogEntry(control.kind === 'continue' ? 'You keep moving.' : 'You skip ahead.', undefined, undefined, 'recent'),
        };
      }
    }

    if (nodeRecord.node.templateSchema === 'gate' && control.kind === 'continue') {
      const activeDirection = selectGateDirection(nodeRecord.node, pathDirection);
      const nextTarget = activeDirection
        ? resolveReachableNode(
            project,
            nodeId,
            nodeRecord.node.endpoints?.[activeDirection]?.to,
            activeDirection,
          )
        : undefined;

      if (nextTarget) {
        return {
          nextNodeId: nextTarget.nodeId,
          nextPathDirection: nextTarget.pathDirection,
          logEntry: createLogEntry('You step through.', undefined, undefined, 'recent'),
        };
      }
    }

    if (nodeRecord.node.templateSchema === 'gate' && control.kind === 'back') {
      const activeDirection = selectGateDirection(nodeRecord.node, pathDirection);
      const currentSideNodeId = activeDirection
        ? resolveGateCurrentSideNodeId(project, nodeRecord.node, activeDirection)
        : undefined;

      if (currentSideNodeId) {
        return {
          nextNodeId: currentSideNodeId,
          logEntry: createLogEntry('You step back.', undefined, undefined, 'recent'),
        };
      }
    }

    return {};
  }

  function resolveProjectEnter(
    projectId: string,
    nodeId: string,
    options: ActionResolutionOptions = {},
  ): RuntimeInteractionOutcome {
    const project = projectRuntimeInternal[projectId];

    if (!project || !project.nodeRecordsById[nodeId]) {
      return {};
    }

    return resolveSidecarEnterEvent(projectId, project, nodeId, options, runtimeOptions.clockSource, runtimeOptions.weatherSource) ?? {};
  }

  function getProjectedPage(
    projectId: string,
    nodeId: string | undefined,
    pathDirection?: PathDirection,
    options: ProjectPageOptions = {},
  ): ProjectionResult | undefined {
    if (!nodeId) {
      return undefined;
    }

    const project = projectRuntimeInternal[projectId];
    const nodeRecord = project?.nodeRecordsById[nodeId];

    if (!project || !nodeRecord) {
      return undefined;
    }

    const currentSessionState = hydrateRuntimeSessionState(project, options.sessionState, nodeId, undefined, runtimeOptions.clockSource, runtimeOptions.weatherSource);
    const basePage = projectContentObject(nodeRecord.node, pathDirection, options);

    if (!basePage || basePage.kind !== 'page') {
      return basePage;
    }

    return appendNpcPresenceProse(project, basePage, nodeId, currentSessionState);
  }

  function getOfferedActions(
    projectId: string,
    nodeId: string | undefined,
    options: OfferedActionResolutionOptions = {},
  ): ProjectedAction[] {
    if (!nodeId) {
      return [];
    }

    const project = projectRuntimeInternal[projectId];

    if (!project || !project.nodeRecordsById[nodeId]) {
      return [];
    }

    return [
      ...resolveAreaFixtureOfferedActions(
        project.nodeRecordsById[nodeId]?.node,
        options.sessionState,
        options.fixtureInteractionStateById,
      ),
      ...resolveSidecarOfferedActions(projectId, project, nodeId, options, runtimeOptions.clockSource, runtimeOptions.weatherSource),
    ];
  }

  function hydrateProjectSessionState(
    projectId: string,
    nodeId: string | undefined,
    sessionState?: RuntimeSessionState,
    systemContext?: RuntimeSystemContext,
  ): RuntimeSessionState | undefined {
    const project = projectRuntimeInternal[projectId];

    if (!project) {
      return undefined;
    }

    return hydrateRuntimeSessionState(project, sessionState, nodeId, systemContext, runtimeOptions.clockSource, runtimeOptions.weatherSource);
  }

  return {
    runtime,
    createInitialProjectSessionState,
    hydrateProjectSessionState,
    resolveProjectAction,
    resolveProjectControl,
    resolveProjectEnter,
    getProjectedPage,
    getProjectedFixturePanels,
    getOfferedActions,
  };

  function createInitialProjectSessionState(projectId: string): RuntimeSessionState {
    const project = projectRuntimeInternal[projectId];

    if (!project) {
      return {};
    }

    return cloneRuntimeSessionState(project.initialSessionState);
  }

  function getProjectedFixturePanels(
    projectId: string,
    nodeId: string | undefined,
    options: OfferedActionResolutionOptions = {},
  ): ProjectedFixturePanel[] {
    if (!nodeId) {
      return [];
    }

    const project = projectRuntimeInternal[projectId];
    const record = project?.nodeRecordsById[nodeId];

    if (!project || !record || record.node.templateSchema !== 'area') {
      return [];
    }

    const currentSessionState = hydrateRuntimeSessionState(
      project,
      options.sessionState,
      nodeId,
      options.systemContext,
      runtimeOptions.clockSource,
      runtimeOptions.weatherSource,
    );

    return (record.node.fixtures ?? []).flatMap((fixture) => resolveFixtureProjectedPanels(fixture, currentSessionState, options.fixtureInteractionStateById));
  }
}

export function createRuntimeForContentFiles(
  contentFiles: Record<string, string>,
  options: ContentRuntimeOptions = {},
): Record<string, RuntimeProjectData> {
  return createContentRuntime(contentFiles, options).runtime;
}

export function appendRecentLog(
  page: ProjectionResult | undefined,
  recentEntries: ProjectedLogEntry[] | undefined,
): ProjectionResult | undefined {
  if (!page || page.kind === 'auto_advance' || !recentEntries || recentEntries.length === 0) {
    return page;
  }

  const visibleEntries = recentEntries.filter((entry) => entry.lane === 'visible');
  const laneRecentEntries = recentEntries.filter((entry) => entry.lane !== 'visible');

  return {
    ...page,
    proseBlocks: [
      ...page.proseBlocks,
      ...visibleEntries.flatMap(toProseBlocksFromLogEntry),
    ],
    recentLog: laneRecentEntries.length > 0
      ? [...(page.recentLog ?? []), ...laneRecentEntries]
      : page.recentLog,
  };
}

function resolveProseSlotEntry(
  node: AreaObject | GateObject,
  trigger: ProseTrigger,
  key: string,
  attempt?: number,
): { text: string; markers?: FlowBeatMarker[]; blocks?: ProjectedProseBlock[] } | undefined {
  const slot = resolveProseSlot(node, trigger, key, attempt);
  const variant = slot ? selectSlotVariant(slot.variants, slot.mode, attempt) : undefined;

  if (!variant || variant.kind !== 'text') {
    return undefined;
  }

  return {
    text: variant.text,
    markers: collectVariantMarkers(variant),
    blocks: toProjectedLogBlocks(variant.blocks),
  };
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

function collectVariantMarkers(variant: Extract<ProseVariant, { kind: 'text' }>): FlowBeatMarker[] | undefined {
  const markers = variant.blocks?.flatMap((block) => block.markers ?? []) ?? [];
  return markers.length > 0 ? markers : undefined;
}

function resolveProseSlot(node: AreaObject | GateObject, trigger: ProseTrigger, key: string, attempt?: number) {
  const matchingSlots = (node.proseSlots ?? [])
    .filter((item) => item.trigger === trigger && item.key === key)
    .sort((left, right) => (left.attempt ?? 0) - (right.attempt ?? 0));

  if (matchingSlots.length === 0) {
    return undefined;
  }

  if (attempt === undefined) {
    return matchingSlots.find((slot) => slot.attempt === undefined) ?? matchingSlots[0];
  }

  const exactMatch = matchingSlots.find((slot) => slot.attempt === attempt);

  if (exactMatch) {
    return exactMatch;
  }

  const attemptedMatches = matchingSlots.filter((slot) => slot.attempt !== undefined && slot.attempt <= attempt);

  if (attemptedMatches.length > 0) {
    return attemptedMatches[attemptedMatches.length - 1];
  }

  return matchingSlots.find((slot) => slot.attempt === undefined) ?? matchingSlots[0];
}

function createLogOutcome(
  entry: { text: string; markers?: FlowBeatMarker[]; blocks?: ProjectedProseBlock[] } | undefined,
  lane: ProjectedTextLane,
): RuntimeInteractionOutcome {
  return entry ? { logEntry: createLogEntry(entry.text, entry.markers, entry.blocks, lane) } : {};
}

function createLogEntry(
  text: string,
  markers?: FlowBeatMarker[],
  blocks?: ProjectedProseBlock[],
  lane: ProjectedTextLane = 'recent',
): ProjectedLogEntry {
  return {
    id: `log-${Math.random().toString(36).slice(2, 10)}`,
    text,
    lane,
    markers,
    blocks,
  };
}

function toProseBlocksFromLogEntry(entry: ProjectedLogEntry): ProjectedProseBlock[] {
  if (entry.blocks && entry.blocks.length > 0) {
    return entry.blocks.map((block) => ({
      ...block,
      groupId: block.groupId ? `runtime-log:${entry.id}:${block.groupId}` : `runtime-log:${entry.id}`,
    }));
  }

  return [{
    groupId: `runtime-log:${entry.id}`,
    kind: 'paragraph',
    text: entry.text,
    markers: entry.markers,
  }];
}

function toProjectedLogBlocks(blocks: ProseTextBlock[] | undefined): ProjectedProseBlock[] | undefined {
  if (!blocks || blocks.length === 0) {
    return undefined;
  }

  return blocks.map((block) => ({
    kind: 'paragraph',
    text: block.text,
    markers: block.markers,
  }));
}

function buildProjectRuntime(
  contentFiles: Record<string, string>,
  options: ContentRuntimeOptions = {},
): Record<string, RuntimeProjectRecord> {
  const groupedSources = new Map<string, Array<{ sourcePath: string; source: string }>>();

  for (const [filePath, source] of Object.entries(contentFiles)) {
    const match = /packages\/content\/([^/]+)\/(.+\.(?:md|ya?ml))$/i.exec(filePath);

    if (!match) {
      continue;
    }

    const projectId = match[1];
    const sourcePath = match[2];
    const existing = groupedSources.get(projectId) ?? [];
    existing.push({ sourcePath, source });
    groupedSources.set(projectId, existing);
  }

  return Object.fromEntries(
    Array.from(groupedSources.entries())
      .map(([projectId, files]) => {
        const project = buildSingleProjectRuntime(projectId, files, options);
        return project ? [projectId, project] : undefined;
      })
      .filter((entry): entry is [string, RuntimeProjectRecord] => entry !== undefined),
  );
}

function buildSingleProjectRuntime(
  projectId: string,
  files: Array<{ sourcePath: string; source: string }>,
  options: ContentRuntimeOptions = {},
): RuntimeProjectRecord | undefined {
  const records: RuntimeNodeRecord[] = [];
  const eventsByNodeId: Record<string, ContentEventDefinition[]> = {};
  const npcRecordsById: Record<string, RuntimeNpcRecord> = {};
  let initialSessionState: RuntimeSessionState = {};
  let predicateDefinitions: Record<string, ParsedFrontMatterObject> = {};
  let timeSettings: ProjectTimeSettingsDefinition | undefined;
  let weatherSettings: ProjectWeatherSettingsDefinition | undefined;

  for (const file of files.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath))) {
    if (isStateSidecarFile(file.sourcePath)) {
      const parsedState = parseStateSidecar(file.source, file.sourcePath);

      if (!parsedState.value || parsedState.errors.length > 0) {
        if (parsedState.errors.length > 0) {
          console.warn(`Skipping ${file.sourcePath}: ${parsedState.errors.map((error) => error.message).join('; ')}`);
        }

        continue;
      }

      initialSessionState = mergeRuntimeSessionState(initialSessionState, toRuntimeSessionState(parsedState.value));
      continue;
    }

    if (isPredicateSidecarFile(file.sourcePath)) {
      const parsedPredicates = parsePredicateSidecar(file.source, file.sourcePath);

      if (!parsedPredicates.value || parsedPredicates.errors.length > 0) {
        if (parsedPredicates.errors.length > 0) {
          console.warn(`Skipping ${file.sourcePath}: ${parsedPredicates.errors.map((error) => error.message).join('; ')}`);
        }

        continue;
      }

      predicateDefinitions = {
        ...predicateDefinitions,
        ...parsedPredicates.value,
      };

      continue;
    }

    if (isEventSidecarFile(file.sourcePath)) {
      const parsedEvents = parseEventSidecar(file.source, file.sourcePath);

      if (!parsedEvents.value || parsedEvents.errors.length > 0) {
        if (parsedEvents.errors.length > 0) {
          console.warn(`Skipping ${file.sourcePath}: ${parsedEvents.errors.map((error) => error.message).join('; ')}`);
        }

        continue;
      }

      for (const event of parsedEvents.value) {
        const existingEvents = eventsByNodeId[event.trigger.nodeId] ?? [];
        eventsByNodeId[event.trigger.nodeId] = [...existingEvents, event];
      }

      continue;
    }

    if (isTimeSettingsSidecarFile(file.sourcePath)) {
      const parsedTimeSettings = parseTimeSettingsSidecar(file.source, file.sourcePath);

      if (!parsedTimeSettings.value || parsedTimeSettings.errors.length > 0) {
        if (parsedTimeSettings.errors.length > 0) {
          console.warn(`Skipping ${file.sourcePath}: ${parsedTimeSettings.errors.map((error) => error.message).join('; ')}`);
        }

        continue;
      }

      timeSettings = parsedTimeSettings.value;
      continue;
    }

    if (isWeatherSettingsSidecarFile(file.sourcePath)) {
      const parsedWeatherSettings = parseWeatherSettingsSidecar(file.source, file.sourcePath);

      if (!parsedWeatherSettings.value || parsedWeatherSettings.errors.length > 0) {
        if (parsedWeatherSettings.errors.length > 0) {
          console.warn(`Skipping ${file.sourcePath}: ${parsedWeatherSettings.errors.map((error) => error.message).join('; ')}`);
        }

        continue;
      }

      weatherSettings = parsedWeatherSettings.value;
      continue;
    }

    if (isNpcSidecarFile(file.sourcePath)) {
      const parsedNpc = parseNpcSidecar(file.source, file.sourcePath);
      const parsedNpcPredicates = parseNpcPredicateDefinitions(file.source, file.sourcePath);
      const errors = [...parsedNpc.errors, ...parsedNpcPredicates.errors];

      if (!parsedNpc.value || errors.length > 0) {
        if (errors.length > 0) {
          console.warn(`Skipping ${file.sourcePath}: ${errors.map((error) => error.message).join('; ')}`);
        }

        continue;
      }

      npcRecordsById[parsedNpc.value.id] = {
        definition: parsedNpc.value,
        predicateDefinitions: parsedNpcPredicates.value ?? {},
      };
      continue;
    }

    if (!isMarkdownContentFile(file.sourcePath)) {
      continue;
    }

    const node = parseContentObject(file.source, file.sourcePath);

    if (!node) {
      continue;
    }

    records.push({
      node,
      page: projectContentObject(node),
      sourcePath: file.sourcePath,
    });
  }

  records.sort((left, right) => compareNodeRecords(left, right));

  const nodes = records.map((record) => ({
    id: record.node.id,
    label: record.node.displayName ?? record.node.name ?? record.node.id,
    region: record.node.region,
  }));

  const nodeFoldersById = Object.fromEntries(records.map((record) => [record.node.id, getRecordFolderAncestors(record)]));
  const nodeRegionsById = Object.fromEntries(records.map((record) => [record.node.id, record.node.region]));
  const pagesByNodeId = Object.fromEntries(records.map((record) => [record.node.id, record.page]));
  const nodeRecordsById = Object.fromEntries(records.map((record) => [record.node.id, record]));
  const nodeIdsByAlias = Object.fromEntries(
    records.flatMap((record) => {
      const aliases = new Set(getRecordAliases(record));
      return Array.from(aliases).map((alias) => [alias, record.node.id]);
    }),
  );

  const validationErrors = options.validateProjects ? validateProjectRecords(records) : [];

  if (validationErrors.length > 0) {
    console.warn(`Skipping project ${projectId}: ${validationErrors.join('; ')}`);
    return undefined;
  }

  return {
    projectId,
    startNodeId: pickStartNodeId(records),
    nodes,
    nodeFoldersById,
    nodeRegionsById,
    pagesByNodeId,
    eventsByNodeId,
    titleScreen: getTitleScreenConfig(records),
    timeSettings,
    weatherSettings,
    defaultClock: getRuntimeClockSnapshotFromSessionState(initialSessionState),
    defaultWeather: getRuntimeWeatherSnapshotFromSessionState(initialSessionState),
    initialSessionState,
    predicateDefinitions,
    npcRecordsById,
    nodeIdsByAlias,
    nodeRecordsById,
  };
}

function getTitleScreenConfig(records: RuntimeNodeRecord[]): TitleScreenConfig | undefined {
  const titleScreenRecord = records.find(
    (record) => record.node.templateSchema === 'area' && record.node.id === PREFERRED_START_NODE_ID,
  );

  return titleScreenRecord?.node.templateSchema === 'area'
    ? titleScreenRecord.node.titleScreen
    : undefined;
}

function isMarkdownContentFile(sourcePath: string): boolean {
  return /\.md$/i.test(sourcePath);
}

function isEventSidecarFile(sourcePath: string): boolean {
  return /(^|\/)events\.ya?ml$/i.test(sourcePath);
}

function isPredicateSidecarFile(sourcePath: string): boolean {
  return /(^|\/)project\.ya?ml$/i.test(sourcePath) && /(^|\/)predicates\//i.test(sourcePath);
}

function isStateSidecarFile(sourcePath: string): boolean {
  return /(^|\/)world\.ya?ml$/i.test(sourcePath) && /(^|\/)state\//i.test(sourcePath);
}

function isTimeSettingsSidecarFile(sourcePath: string): boolean {
  return /(^|\/)time\.ya?ml$/i.test(sourcePath) && /(^|\/)settings\//i.test(sourcePath);
}

function isWeatherSettingsSidecarFile(sourcePath: string): boolean {
  return /(^|\/)weather\.ya?ml$/i.test(sourcePath) && /(^|\/)settings\//i.test(sourcePath);
}

function isNpcSidecarFile(sourcePath: string): boolean {
  return /(^|\/)npcs\/[^/]+\.ya?ml$/i.test(sourcePath);
}

function appendNpcPresenceProse(
  project: RuntimeProjectRecord,
  page: ProjectionResult & { kind: 'page' },
  nodeId: string,
  sessionState: RuntimeSessionState,
): ProjectionResult & { kind: 'page' } {
  const ambientBlocks = Object.values(project.npcRecordsById).flatMap((npcRecord) => {
    if (resolveNpcLocation(npcRecord.definition, sessionState) !== nodeId) {
      return [];
    }

    const lines = selectNpcIdleLines(project, npcRecord, sessionState);

    if (lines.length === 0) {
      return [];
    }

    return lines.map((line) => ({
      groupId: `npc:${npcRecord.definition.id}`,
      kind: 'paragraph' as const,
      text: line,
    }));
  });

  if (ambientBlocks.length === 0) {
    return page;
  }

  return {
    ...page,
    proseBlocks: [...page.proseBlocks, ...ambientBlocks],
  };
}

function resolveNpcLocation(
  npc: ContentNpcDefinition,
  sessionState: RuntimeSessionState,
): string | undefined {
  const sessionLocation = getRuntimeSessionValue(sessionState, `npcs.${npc.id}.location`);
  return typeof sessionLocation === 'string' ? sessionLocation : npc.location;
}

function selectNpcIdleLines(
  project: RuntimeProjectRecord,
  npcRecord: RuntimeNpcRecord,
  sessionState: RuntimeSessionState,
): string[] {
  const idle = npcRecord.definition.idle;

  if (!idle?.modes) {
    return [];
  }

  const orderedModes = Object.entries(idle.modes).sort(([leftId], [rightId]) => {
    if (leftId === idle.activeMode) {
      return -1;
    }

    if (rightId === idle.activeMode) {
      return 1;
    }

    return 0;
  });
  const eventContext: RuntimeEventContext = {
    viewerId: getActiveRuntimePlayerId(sessionState),
    selfPathPrefix: `npcs.${npcRecord.definition.id}`,
  };

  for (const [_modeId, mode] of orderedModes) {
    if (mode.when && !evaluatePredicateReference(mode.when, project, sessionState, eventContext, new Set<string>(), npcRecord.predicateDefinitions)) {
      continue;
    }

    if (mode.default?.shared?.length) {
      return mode.default.shared.map((line) => interpolateRuntimeTemplate(line, sessionState, eventContext));
    }
  }

  return [];
}

function hydrateRuntimeSessionState(
  project: RuntimeProjectRecord,
  sessionState: RuntimeSessionState | undefined,
  nodeId?: string,
  systemContext?: RuntimeSystemContext,
  clockSource?: RuntimeClockSource,
  weatherSource?: RuntimeWeatherSource,
): RuntimeSessionState {
  const mergedState = sessionState
    ? mergeRuntimeSessionState(project.initialSessionState, sessionState)
    : cloneRuntimeSessionState(project.initialSessionState);
  const previousSystemContext: RuntimeSystemContext = {
    clock: getRuntimeClockSnapshotFromSessionState(mergedState),
    weather: getRuntimeWeatherSnapshotFromSessionState(mergedState),
  };
  const runtimeSystemContext = resolveBaseRuntimeSystemContext(project.projectId, project, nodeId, mergedState, systemContext, clockSource, weatherSource);
  const synchronizedState = syncRuntimeSystemContext(mergedState, runtimeSystemContext);
  const scheduledState = applyRuntimeSchedules(project, synchronizedState, runtimeSystemContext, nodeId, previousSystemContext);
  return reconcileRuntimeFixtures(project, scheduledState, runtimeSystemContext);
}

function reconcileRuntimeFixtures(
  project: RuntimeProjectRecord,
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext,
): RuntimeSessionState {
  const nowMs = systemContext.clock?.nowMs;

  if (typeof nowMs !== 'number') {
    return sessionState;
  }

  let nextSessionState = sessionState;

  Object.values(project.nodeRecordsById).forEach((nodeRecord) => {
    if (nodeRecord.node.templateSchema !== 'area') {
      return;
    }

    (nodeRecord.node.fixtures ?? []).forEach((fixture) => {
      if (fixture.kind !== 'jukebox') {
        return;
      }

      nextSessionState = reconcileJukeboxPlayback(nextSessionState, fixture, nowMs);
    });
  });

  return nextSessionState;
}

function resolveSidecarActionEvent(
  projectId: string,
  project: RuntimeProjectRecord,
  nodeId: string,
  action: ProjectedAction,
  options: ActionResolutionOptions,
  clockSource: RuntimeClockSource | undefined,
  weatherSource?: RuntimeWeatherSource,
): RuntimeInteractionOutcome | undefined {
  const currentSessionState = hydrateRuntimeSessionState(project, options.sessionState, nodeId, options.systemContext, clockSource, weatherSource);
  const systemContext = resolveRuntimeSystemContext(projectId, project, nodeId, currentSessionState, options.systemContext, clockSource, weatherSource);

  const matchingEntry = (project.eventsByNodeId[nodeId] ?? []).find((event) => {
    if (!isMatchingSidecarActionTrigger(event, action)) {
      return false;
    }

    const eventContext = createRuntimeEventContext(event, currentSessionState, options, systemContext);
    return evaluatePredicateReference(event.when, project, currentSessionState, eventContext);
  });

  if (!matchingEntry) {
    return undefined;
  }

  const eventContext = createRuntimeEventContext(matchingEntry, currentSessionState, options, systemContext);
  const eventResult = createResolvedEventResult(matchingEntry, project, currentSessionState, eventContext);
  const projectionEmissions = createSidecarEventProjectionEmissions(matchingEntry, eventResult);
  const logEntry = createSidecarEventLogEntry(projectionEmissions, eventContext);
  const nextSessionState = applySidecarEventEffects(matchingEntry, currentSessionState, eventContext);
  const nextTarget = resolveSidecarEventTarget(project, nodeId, matchingEntry);
  const resetNodeId = resolveSidecarEventResetNodeId(matchingEntry);

  return {
    nextNodeId: nextTarget?.nodeId,
    nextPathDirection: nextTarget?.pathDirection,
    resetNodeId,
    logEntry,
    sessionState: nextSessionState,
    eventResult,
    projectionEmissions,
  };
}

function resolveSidecarOfferedActions(
  projectId: string,
  project: RuntimeProjectRecord,
  nodeId: string,
  options: OfferedActionResolutionOptions,
  clockSource: RuntimeClockSource | undefined,
  weatherSource?: RuntimeWeatherSource,
): ProjectedAction[] {
  const currentSessionState = hydrateRuntimeSessionState(project, options.sessionState, nodeId, options.systemContext, clockSource, weatherSource);
  const systemContext = resolveRuntimeSystemContext(projectId, project, nodeId, currentSessionState, options.systemContext, clockSource, weatherSource);

  return (project.eventsByNodeId[nodeId] ?? []).flatMap((event) => {
    if (!event.offer) {
      return [];
    }

    const actionId = getSidecarOfferedActionId(event);

    if (!actionId) {
      return [];
    }

    const eventContext = createRuntimeEventContext(event, currentSessionState, options, systemContext);

    if (!evaluatePredicateReference(event.when, project, currentSessionState, eventContext)) {
      return [];
    }

    return [{
      id: actionId,
      kind: event.trigger.kind as ProjectedAction['kind'],
      label: event.offer.label,
      key: event.offer.key,
      keyLabel: event.offer.key ? `[${event.offer.key}]` : undefined,
      meta: event.offer.meta,
    }];
  });
}

function resolveSidecarEnterEvent(
  projectId: string,
  project: RuntimeProjectRecord,
  nodeId: string,
  options: ActionResolutionOptions,
  clockSource: RuntimeClockSource | undefined,
  weatherSource?: RuntimeWeatherSource,
): RuntimeInteractionOutcome | undefined {
  const currentSessionState = hydrateRuntimeSessionState(project, options.sessionState, nodeId, options.systemContext, clockSource, weatherSource);
  const systemContext = resolveRuntimeSystemContext(projectId, project, nodeId, currentSessionState, options.systemContext, clockSource, weatherSource);

  const matchingEntry = (project.eventsByNodeId[nodeId] ?? []).find((event) => {
    if (event.trigger.kind !== 'enter') {
      return false;
    }

    const eventContext = createRuntimeEventContext(event, currentSessionState, options, systemContext);
    return evaluatePredicateReference(event.when, project, currentSessionState, eventContext);
  });

  if (!matchingEntry) {
    return undefined;
  }

  const eventContext = createRuntimeEventContext(matchingEntry, currentSessionState, options, systemContext);
  const eventResult = createResolvedEventResult(matchingEntry, project, currentSessionState, eventContext);
  const projectionEmissions = createSidecarEventProjectionEmissions(matchingEntry, eventResult);
  const logEntry = createSidecarEventLogEntry(projectionEmissions, eventContext);
  const nextSessionState = applySidecarEventEffects(matchingEntry, currentSessionState, eventContext);
  const nextTarget = resolveSidecarEventTarget(project, nodeId, matchingEntry);
  const resetNodeId = resolveSidecarEventResetNodeId(matchingEntry);

  return {
    nextNodeId: nextTarget?.nodeId,
    nextPathDirection: nextTarget?.pathDirection,
    resetNodeId,
    logEntry,
    sessionState: nextSessionState,
    eventResult,
    projectionEmissions,
  };
}

function isMatchingSidecarActionTrigger(event: ContentEventDefinition, action: ProjectedAction): boolean {
  if (action.kind === 'poi') {
    return event.trigger.kind === 'poi' && event.trigger.poiId === action.id;
  }

  if (action.kind === 'choice') {
    return event.trigger.kind === 'choice' && event.trigger.choiceId === action.id;
  }

  if (action.kind === 'exit') {
    return event.trigger.kind === 'exit' && event.trigger.exitId === action.id;
  }

  return false;
}

function getSidecarOfferedActionId(event: ContentEventDefinition): string | undefined {
  if (event.trigger.kind === 'poi') {
    return event.trigger.poiId;
  }

  if (event.trigger.kind === 'choice') {
    return event.trigger.choiceId;
  }

  if (event.trigger.kind === 'exit') {
    return event.trigger.exitId;
  }

  return undefined;
}

function createResolvedEventResult(
  event: ContentEventDefinition,
  project: RuntimeProjectRecord,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
): RuntimeResolvedEventResult {
  const result: RuntimeResolvedEventResult = {
    eventId: event.id,
    actorId: eventContext.actorId,
    viewerId: eventContext.viewerId,
    actor: {
      text: renderAudienceText(event.actor.text, sessionState, eventContext),
    },
  };

  if (event.private && evaluatePredicateReference(event.private.when, project, sessionState, eventContext)) {
    result.private = {
      text: renderAudienceText(event.private.text, sessionState, eventContext),
    };
  }

  if (event.witnesses && evaluatePredicateReference(event.witnesses.when, project, sessionState, eventContext)) {
    result.witnesses = {
      text: renderAudienceText(event.witnesses.text, sessionState, eventContext),
    };
  }

  return result;
}

function createSidecarEventProjectionEmissions(
  event: ContentEventDefinition,
  result: RuntimeResolvedEventResult,
): RuntimeProjectionEmission[] {
  const emissions: RuntimeProjectionEmission[] = [];
  const lane = event.lane ?? getDefaultSidecarEventLane(event);

  appendSidecarEventProjectionEmissions(
    emissions,
    lane,
    result.actor.text,
    result.actorId ? { kind: 'actor', actorId: result.actorId } : { kind: 'shared' },
  );

  if (result.private && result.actorId) {
    appendSidecarEventProjectionEmissions(emissions, lane, result.private.text, { kind: 'actor', actorId: result.actorId });
  }

  if (result.witnesses && result.actorId) {
    appendSidecarEventProjectionEmissions(emissions, lane, result.witnesses.text, { kind: 'witnesses', actorId: result.actorId });
  }

  return emissions;
}

function appendSidecarEventProjectionEmissions(
  emissions: RuntimeProjectionEmission[],
  lane: ProjectedTextLane,
  lines: string[],
  audience: RuntimeProjectionAudience,
): void {
  lines.forEach((text) => {
    emissions.push({
      lane,
      audience,
      delivery: { kind: 'append' },
      text,
    });
  });
}

function createSidecarEventLogEntry(
  emissions: RuntimeProjectionEmission[],
  eventContext: RuntimeEventContext,
): ProjectedLogEntry | undefined {
  const visibleEmissions = emissions.filter((emission) => matchesProjectionAudience(emission.audience, eventContext));

  if (visibleEmissions.length === 0) {
    return undefined;
  }

  const blocks: ProjectedProseBlock[] = [];

  visibleEmissions.forEach((emission, index) => {
    appendEventLogBlocks(blocks, getProjectionAudienceGroupId(emission.audience, index), [emission.text]);
  });

  const firstBlockText = blocks[0]?.text ?? 'event';

  return createLogEntry(firstBlockText, undefined, blocks, visibleEmissions[0]?.lane ?? 'recent');
}

function matchesProjectionAudience(
  audience: RuntimeProjectionAudience,
  eventContext: RuntimeEventContext,
): boolean {
  if (audience.kind === 'shared') {
    return true;
  }

  if (audience.kind === 'actor') {
    return Boolean(eventContext.viewerId && audience.actorId === eventContext.viewerId);
  }

  if (audience.kind === 'viewer') {
    return Boolean(eventContext.viewerId && audience.viewerId === eventContext.viewerId);
  }

  if (audience.kind === 'witnesses') {
    return Boolean(eventContext.viewerId && eventContext.viewerId !== audience.actorId);
  }

  return false;
}

function getProjectionAudienceGroupId(audience: RuntimeProjectionAudience, index: number): string {
  if (audience.kind === 'actor') {
    return index === 0 ? 'actor' : 'actor-detail';
  }

  if (audience.kind === 'witnesses') {
    return index === 0 ? 'witnesses' : 'witnesses-detail';
  }

  return audience.kind;
}

function getDefaultSidecarEventLane(event: ContentEventDefinition): ProjectedTextLane {
  if (event.trigger.kind === 'choice') {
    return 'visible';
  }

  return 'recent';
}

function appendEventLogBlocks(blocks: ProjectedProseBlock[], groupId: string, lines: string[]) {
  lines.forEach((line) => {
    blocks.push({
      groupId,
      kind: 'paragraph',
      text: line,
    });
  });
}

function applySidecarEventEffects(
  event: ContentEventDefinition,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
): RuntimeSessionState {
  let nextSessionState = cloneRuntimeSessionState(sessionState);

  for (const effect of event.effects ?? []) {
    if (effect.kind === 'arm_schedule' && effect.args.length >= 1) {
      const scheduleId = typeof effect.args[0] === 'string' ? effect.args[0] : undefined;

      if (scheduleId && typeof eventContext.systemContext?.clock?.nowMs === 'number') {
        nextSessionState = setRuntimeSessionValue(nextSessionState, `runtime.schedules.${scheduleId}.armedAtMs`, eventContext.systemContext.clock.nowMs);
      }

      continue;
    }

    if (effect.kind !== 'set' || effect.args.length < 2) {
      continue;
    }

    const targetPath = typeof effect.args[0] === 'string' ? effect.args[0] : undefined;

    if (!targetPath) {
      continue;
    }

    const resolvedValue = resolveEffectValue(effect.args[1], nextSessionState, eventContext);
    nextSessionState = setRuntimeSessionValue(nextSessionState, targetPath, resolvedValue);
  }

  return nextSessionState;
}

function resolveSidecarEventTarget(
  project: RuntimeProjectRecord,
  sourceNodeId: string,
  event: ContentEventDefinition,
): { nodeId: string; pathDirection?: PathDirection } | undefined {
  for (const effect of event.effects ?? []) {
    if (effect.kind !== 'navigate' || effect.args.length < 1) {
      continue;
    }

    const targetId = typeof effect.args[0] === 'string' ? effect.args[0] : undefined;
    const targetPathDirection = isPathDirection(effect.args[1]) ? effect.args[1] : undefined;

    if (!targetId) {
      continue;
    }

    if (targetPathDirection) {
      return {
        nodeId: targetId,
        pathDirection: targetPathDirection,
      };
    }

    return resolveReachableNode(project, sourceNodeId, targetId, 'forward')
      ?? { nodeId: targetId };
  }

  return undefined;
}

function isPathDirection(value: ParsedFrontMatterValue | undefined): value is PathDirection {
  return value === 'forward' || value === 'backward';
}

function resolveSidecarEventResetNodeId(event: ContentEventDefinition): string | undefined {
  for (const effect of event.effects ?? []) {
    if (effect.kind !== 'reset_run' || effect.args.length < 1) {
      continue;
    }

    return typeof effect.args[0] === 'string' ? effect.args[0] : undefined;
  }

  return undefined;
}

function resolveEffectValue(
  value: RuntimeSessionValue,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
): RuntimeSessionValue {
  if (typeof value !== 'string') {
    return value;
  }

  const resolvedValue = resolveScopedSessionValue(value, sessionState, eventContext);
  return resolvedValue === undefined ? value : resolvedValue;
}

function evaluatePredicateReference(
  reference: { predicate: string } | undefined,
  project: RuntimeProjectRecord,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
  visitingPredicates = new Set<string>(),
  localPredicateDefinitions?: Record<string, ParsedFrontMatterObject>,
): boolean {
  if (!reference) {
    return true;
  }

  return evaluateNamedPredicate(reference.predicate, project, sessionState, eventContext, visitingPredicates, localPredicateDefinitions);
}

function evaluateNamedPredicate(
  predicateName: string,
  project: RuntimeProjectRecord,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
  visitingPredicates = new Set<string>(),
  localPredicateDefinitions?: Record<string, ParsedFrontMatterObject>,
): boolean {
  if (visitingPredicates.has(predicateName)) {
    return false;
  }

  const localPredicateName = predicateName.startsWith('self.') ? predicateName.slice('self.'.length) : predicateName;
  const definition = localPredicateDefinitions?.[localPredicateName] ?? project.predicateDefinitions[predicateName];

  if (!definition) {
    return Boolean(resolveScopedSessionValue(predicateName, sessionState, eventContext));
  }

  visitingPredicates.add(predicateName);
  const result = evaluatePredicateDefinition(definition, project, sessionState, eventContext, visitingPredicates, localPredicateDefinitions);
  visitingPredicates.delete(predicateName);
  return result;
}

function evaluatePredicateDefinition(
  definition: ParsedFrontMatterObject,
  project: RuntimeProjectRecord,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
  visitingPredicates: Set<string>,
  localPredicateDefinitions?: Record<string, ParsedFrontMatterObject>,
): boolean {
  if (typeof definition.predicate === 'string') {
    return evaluateNamedPredicate(definition.predicate, project, sessionState, eventContext, visitingPredicates, localPredicateDefinitions);
  }

  const equalsArgs = normalizePredicateArgs(definition.equals);

  if (equalsArgs && equalsArgs.length >= 2) {
    const [leftOperand, rightOperand] = equalsArgs;
    return resolvePredicateOperand(leftOperand, sessionState, eventContext) === resolvePredicateOperand(rightOperand, sessionState, eventContext);
  }

  const sameLocationArgs = normalizePredicateArgs(definition.same_location);

  if (sameLocationArgs && sameLocationArgs.length >= 2) {
    const [leftOperand, rightOperand] = sameLocationArgs;
    return resolvePredicateOperand(leftOperand, sessionState, eventContext) === resolvePredicateOperand(rightOperand, sessionState, eventContext);
  }

  const presentArgs = normalizePredicateArgs(definition.present);

  if (presentArgs && presentArgs.length >= 1) {
    return Boolean(resolvePredicateOperand(presentArgs[0], sessionState, eventContext));
  }

  if (Array.isArray(definition.all)) {
    return definition.all.every((entry) => {
      const nestedDefinition = isParsedObject(entry) ? entry : undefined;
      return nestedDefinition ? evaluatePredicateDefinition(nestedDefinition, project, sessionState, eventContext, visitingPredicates, localPredicateDefinitions) : false;
    });
  }

  if (Array.isArray(definition.any)) {
    return definition.any.some((entry) => {
      const nestedDefinition = isParsedObject(entry) ? entry : undefined;
      return nestedDefinition ? evaluatePredicateDefinition(nestedDefinition, project, sessionState, eventContext, visitingPredicates, localPredicateDefinitions) : false;
    });
  }

  return false;
}

function resolvePredicateOperand(
  value: ParsedFrontMatterValue,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
): RuntimeSessionValue {
  if (typeof value !== 'string') {
    return toRuntimeSessionValue(value);
  }

  const resolvedValue = resolveScopedSessionValue(value, sessionState, eventContext);
  return resolvedValue === undefined ? value : resolvedValue;
}

interface RuntimeEventContext {
  actorId?: string;
  viewerId?: string;
  systemContext?: RuntimeSystemContext;
  selfPathPrefix?: string;
}

function createRuntimeEventContext(
  event: ContentEventDefinition,
  sessionState: RuntimeSessionState,
  options: ActionResolutionOptions,
  systemContext?: RuntimeSystemContext,
): RuntimeEventContext {
  const actorId = resolveRuntimeActorId(event.trigger.actor, sessionState, options);
  return {
    actorId,
    viewerId: options.viewerId ?? actorId,
    systemContext,
  };
}

function resolveRuntimeActorId(
  actorReference: string,
  sessionState: RuntimeSessionState,
  options: ActionResolutionOptions,
): string | undefined {
  if (options.actorId) {
    return options.actorId;
  }

  if (actorReference === 'player') {
    const activePlayerId = getRuntimeSessionValue(sessionState, 'player.active.id');
    return typeof activePlayerId === 'string' ? activePlayerId : undefined;
  }

  if (actorReference === 'viewer') {
    return options.viewerId;
  }

  const resolvedValue = resolveScopedSessionValue(actorReference, sessionState, {
    actorId: options.actorId,
    viewerId: options.viewerId,
  });

  if (typeof resolvedValue === 'string') {
    return resolvedValue;
  }

  return actorReference.includes('.') ? undefined : actorReference;
}

function renderAudienceText(
  lines: string[],
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
): string[] {
  return lines.map((line) => interpolateRuntimeTemplate(line, sessionState, eventContext));
}

function interpolateRuntimeTemplate(
  line: string,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
): string {
  return line.replace(/\{([^{}|]+?)(?:\|([^{}]*))?\}/g, (_match, rawPath, rawFallback) => {
    const tokenPath = String(rawPath).trim();
    const fallback = rawFallback === undefined ? undefined : String(rawFallback).trim();
    const resolvedValue = resolveScopedSessionValue(tokenPath, sessionState, eventContext);

    if (typeof resolvedValue === 'string' || typeof resolvedValue === 'number' || typeof resolvedValue === 'boolean') {
      return String(resolvedValue);
    }

    return fallback ?? '';
  });
}

function resolveScopedSessionValue(
  path: string,
  sessionState: RuntimeSessionState,
  eventContext: RuntimeEventContext,
): RuntimeSessionValue | undefined {
  const clockValue = resolveClockContextValue(path, eventContext.systemContext?.clock);

  if (clockValue !== undefined) {
    return clockValue;
  }

  const weatherValue = resolveWeatherContextValue(path, eventContext.systemContext?.weather);

  if (weatherValue !== undefined) {
    return weatherValue;
  }

  if (path === 'actor.id') {
    return eventContext.actorId;
  }

  if (path === 'viewer.id') {
    return eventContext.viewerId;
  }

  if (path.startsWith('actor.') && eventContext.actorId) {
    return getRuntimeSessionValue(sessionState, `players.${eventContext.actorId}.${path.slice('actor.'.length)}`);
  }

  if (path.startsWith('viewer.') && eventContext.viewerId) {
    return getRuntimeSessionValue(sessionState, `players.${eventContext.viewerId}.${path.slice('viewer.'.length)}`);
  }

  if (path.startsWith('self.') && eventContext.selfPathPrefix) {
    return getRuntimeSessionValue(sessionState, `${eventContext.selfPathPrefix}.${path.slice('self.'.length)}`);
  }

  if (path.startsWith('players.active.')) {
    return getRuntimeSessionValue(sessionState, `player.active.${path.slice('players.active.'.length)}`);
  }

  return getRuntimeSessionValue(sessionState, path);
}

function getActiveRuntimePlayerId(sessionState: RuntimeSessionState): string | undefined {
  const activePlayerId = getRuntimeSessionValue(sessionState, 'player.active.id');
  return typeof activePlayerId === 'string' ? activePlayerId : undefined;
}

function resolveRuntimeSystemContext(
  projectId: string,
  project: RuntimeProjectRecord,
  nodeId: string | undefined,
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext | undefined,
  clockSource: RuntimeClockSource | undefined,
  weatherSource: RuntimeWeatherSource | undefined,
): RuntimeSystemContext {
  return resolveBaseRuntimeSystemContext(projectId, project, nodeId, sessionState, systemContext, clockSource, weatherSource);
}

function resolveBaseRuntimeSystemContext(
  projectId: string,
  project: RuntimeProjectRecord,
  nodeId: string | undefined,
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext | undefined,
  clockSource: RuntimeClockSource | undefined,
  weatherSource: RuntimeWeatherSource | undefined,
): RuntimeSystemContext {
  const clock = systemContext?.clock
    ?? clockSource?.getSnapshot(projectId, nodeId)
    ?? getRuntimeClockSnapshotFromSessionState(sessionState);
  const nodeRegion = nodeId ? project.nodeRegionsById[nodeId] : undefined;
  const weather = systemContext?.weather
    ?? weatherSource?.getSnapshot(project, nodeId, nodeRegion)
    ?? getRuntimeWeatherSnapshotFromSessionState(sessionState);

  return {
    ...(systemContext ?? {}),
    ...(clock ? { clock } : {}),
    ...(weather ? { weather } : {}),
  };
}

function applyRuntimeSchedules(
  project: RuntimeProjectRecord,
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext,
  nodeId?: string,
  previousSystemContext?: RuntimeSystemContext,
): RuntimeSessionState {
  const schedules = project.timeSettings?.schedules;

  if (!schedules) {
    return sessionState;
  }

  let nextState = cloneRuntimeSessionState(sessionState);

  for (const [scheduleId, schedule] of Object.entries(schedules)) {
    if (!isScheduleActive(project, schedule, sessionState, systemContext, nodeId, previousSystemContext)) {
      continue;
    }

    nextState = applyScheduleEffects(nextState, schedule.effects, systemContext, scheduleId);
  }

  return nextState;
}

function isScheduleActive(
  project: RuntimeProjectRecord,
  schedule: TimeScheduleDefinition,
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext,
  nodeId?: string,
  previousSystemContext?: RuntimeSystemContext,
): boolean {
  const evaluationNodeIds = resolveScheduleEvaluationNodeIds(project, schedule, nodeId);

  return evaluationNodeIds.some((evaluationNodeId) => {
    if (schedule.when && !evaluatePredicateReference(schedule.when, project, sessionState, { systemContext })) {
      return false;
    }

    if (!matchesScheduleWindow(project, schedule, sessionState, systemContext, evaluationNodeId, previousSystemContext)) {
      return false;
    }

    if (schedule.trigger.kind === 'elapsed') {
      return hasElapsedScheduleReached(schedule, sessionState, systemContext);
    }

    return matchesScheduleTrigger(project, schedule.trigger, sessionState, systemContext, evaluationNodeId, previousSystemContext);
  });
}

function resolveScheduleEvaluationNodeIds(
  project: RuntimeProjectRecord,
  schedule: TimeScheduleDefinition,
  currentNodeId?: string,
): Array<string | undefined> {
  const target = schedule.target;

  if (!target) {
    return [currentNodeId];
  }

  if (target.nodes?.length) {
    return Array.from(new Set(target.nodes));
  }

  if (target.folders?.length) {
    return Object.entries(project.nodeFoldersById)
      .filter(([, folders]) => target.folders?.some((folder) => folders.includes(folder)))
      .map(([candidateNodeId]) => candidateNodeId);
  }

  if (target.regions?.length) {
    return Object.entries(project.nodeRegionsById)
      .filter(([, regionId]) => target.regions?.includes(regionId))
      .map(([candidateNodeId]) => candidateNodeId);
  }

  return [currentNodeId];
}

function matchesScheduleTarget(
  project: RuntimeProjectRecord,
  schedule: TimeScheduleDefinition,
  nodeId?: string,
): boolean {
  const target = schedule.target;

  if (!target) {
    return true;
  }

  if (target.nodes?.length) {
    return nodeId ? target.nodes.includes(nodeId) : false;
  }

  if (target.folders?.length) {
    if (!nodeId) {
      return false;
    }

    const folders = project.nodeFoldersById[nodeId] ?? [];
    return target.folders.some((folder) => folders.includes(folder));
  }

  if (target.regions?.length) {
    const regionId = nodeId ? project.nodeRegionsById[nodeId] : undefined;
    return typeof regionId === 'string' ? target.regions.includes(regionId) : false;
  }

  return true;
}

function matchesScheduleWindow(
  project: RuntimeProjectRecord,
  schedule: TimeScheduleDefinition,
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext,
  nodeId?: string,
  previousSystemContext?: RuntimeSystemContext,
): boolean {
  if (!schedule.activeWindow) {
    return true;
  }

  if (schedule.activeWindow.start && !matchesScheduleTrigger(project, schedule.activeWindow.start, sessionState, systemContext, nodeId, previousSystemContext)) {
    return false;
  }

  if (schedule.activeWindow.stop && matchesScheduleTrigger(project, schedule.activeWindow.stop, sessionState, systemContext, nodeId, previousSystemContext)) {
    return false;
  }

  return true;
}

function matchesScheduleTrigger(
  project: RuntimeProjectRecord,
  trigger: TimeScheduleTriggerDefinition,
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext,
  nodeId?: string,
  previousSystemContext?: RuntimeSystemContext,
): boolean {
  if (trigger.kind === 'condition') {
    return evaluatePredicateReference(trigger.predicate, project, sessionState, { systemContext });
  }

  if (trigger.kind === 'phase') {
    const activePhaseId = systemContext.clock?.phase;
    const previousPhaseId = previousSystemContext?.clock?.phase;

    if (trigger.phaseId) {
      if (trigger.edge === 'enter') {
        return didEnterScheduledPhase(project, nodeId, trigger.phaseId, previousSystemContext?.clock, systemContext.clock);
      }

      if (trigger.edge === 'exit') {
        return previousPhaseId === trigger.phaseId && activePhaseId !== previousPhaseId;
      }

      return activePhaseId === trigger.phaseId;
    }

    if (trigger.phaseGroup && activePhaseId) {
      const currentMatchesGroup = matchesSchedulePhaseGroup(project, nodeId, activePhaseId, trigger.phaseGroup);

      if (trigger.edge === 'enter') {
        return didEnterScheduledPhaseGroup(project, nodeId, trigger.phaseGroup, previousSystemContext?.clock, systemContext.clock);
      }

      if (trigger.edge === 'exit') {
        return matchesSchedulePhaseGroup(project, nodeId, previousPhaseId, trigger.phaseGroup) && !currentMatchesGroup;
      }

      return currentMatchesGroup;
    }

    return false;
  }

  if (trigger.kind === 'clock') {
    return typeof systemContext.clock?.nowMs === 'number' && typeof trigger.minutes === 'number'
      ? systemContext.clock.nowMs >= trigger.minutes * 60_000
      : false;
  }

  return false;
}

function matchesSchedulePhaseGroup(
  project: RuntimeProjectRecord,
  nodeId: string | undefined,
  phaseId: string | undefined,
  phaseGroup: string,
): boolean {
  if (!phaseId) {
    return false;
  }

  const phaseDefinition = resolveAssignedProjectCalendar(project.timeSettings, {
    nodeId,
    nodeFolders: nodeId ? project.nodeFoldersById[nodeId] : undefined,
    nodeRegion: nodeId ? project.nodeRegionsById[nodeId] : undefined,
  })?.calendar.phases?.find((phase) => phase.id === phaseId);

  return phaseDefinition?.groups?.includes(phaseGroup) ?? false;
}

function didEnterScheduledPhase(
  project: RuntimeProjectRecord,
  nodeId: string | undefined,
  phaseId: string,
  previousClock: RuntimeClockSnapshot | undefined,
  currentClock: RuntimeClockSnapshot | undefined,
): boolean {
  if (currentClock?.phase !== phaseId) {
    return false;
  }

  if (previousClock?.phase !== phaseId) {
    return true;
  }

  const currentOccurrence = getScheduledPhaseOccurrenceIndex(project, nodeId, phaseId, currentClock.nowMs);
  const previousOccurrence = getScheduledPhaseOccurrenceIndex(project, nodeId, phaseId, previousClock.nowMs);

  return currentOccurrence !== undefined && previousOccurrence !== undefined && currentOccurrence > previousOccurrence;
}

function didEnterScheduledPhaseGroup(
  project: RuntimeProjectRecord,
  nodeId: string | undefined,
  phaseGroup: string,
  previousClock: RuntimeClockSnapshot | undefined,
  currentClock: RuntimeClockSnapshot | undefined,
): boolean {
  const currentPhaseId = currentClock?.phase;

  if (!matchesSchedulePhaseGroup(project, nodeId, currentPhaseId, phaseGroup)) {
    return false;
  }

  if (!matchesSchedulePhaseGroup(project, nodeId, previousClock?.phase, phaseGroup)) {
    return true;
  }

  const currentOccurrence = getScheduledPhaseOccurrenceIndex(project, nodeId, currentPhaseId, currentClock?.nowMs);
  const previousOccurrence = getScheduledPhaseOccurrenceIndex(project, nodeId, previousClock?.phase, previousClock?.nowMs);

  return currentOccurrence !== undefined && previousOccurrence !== undefined && currentOccurrence > previousOccurrence;
}

function getScheduledPhaseOccurrenceIndex(
  project: RuntimeProjectRecord,
  nodeId: string | undefined,
  phaseId: string | undefined,
  nowMs: number | undefined,
): number | undefined {
  if (!phaseId || typeof nowMs !== 'number') {
    return undefined;
  }

  const assignedCalendar = resolveAssignedProjectCalendar(project.timeSettings, {
    nodeId,
    nodeFolders: nodeId ? project.nodeFoldersById[nodeId] : undefined,
    nodeRegion: nodeId ? project.nodeRegionsById[nodeId] : undefined,
  });
  const phases = assignedCalendar?.calendar.phases;

  if (!phases?.length) {
    return undefined;
  }

  const cycleDurationMs = phases.reduce((total, phase) => total + (phase.durationMinutes ?? 0) * 60_000, 0);

  if (cycleDurationMs <= 0) {
    return undefined;
  }

  let phaseStartOffsetMs = 0;

  for (const phase of phases) {
    if (phase.id === phaseId) {
      return Math.floor((nowMs - phaseStartOffsetMs) / cycleDurationMs);
    }

    phaseStartOffsetMs += (phase.durationMinutes ?? 0) * 60_000;
  }

  return undefined;
}

function syncRuntimeSystemContext(
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext,
): RuntimeSessionState {
  let nextState = cloneRuntimeSessionState(sessionState);

  if (systemContext.clock?.phase !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.time.phase', systemContext.clock.phase);
  }

  if (systemContext.clock?.cycle !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.time.cycle', systemContext.clock.cycle);
  }

  if (systemContext.clock?.nowMs !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.time.nowMs', systemContext.clock.nowMs);
  }

  if (systemContext.clock?.source !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.time.source', systemContext.clock.source);
  }

  if (systemContext.weather?.kind !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.weather.kind', systemContext.weather.kind);
  }

  if (systemContext.weather?.intensity !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.weather.intensity', systemContext.weather.intensity);
  }

  if (systemContext.weather?.patternId !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.weather.patternId', systemContext.weather.patternId);
  }

  if (systemContext.weather?.stepId !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.weather.stepId', systemContext.weather.stepId);
  }

  if (systemContext.weather?.regionId !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.weather.region', systemContext.weather.regionId);
  }

  if (systemContext.weather?.source !== undefined) {
    nextState = setRuntimeSessionValue(nextState, 'world.weather.source', systemContext.weather.source);
  }

  return nextState;
}

function hasElapsedScheduleReached(
  schedule: TimeScheduleDefinition,
  sessionState: RuntimeSessionState,
  systemContext: RuntimeSystemContext,
): boolean {
  const armedScheduleId = schedule.trigger.scheduleId;
  const armedAtMs = armedScheduleId ? getRuntimeSessionValue(sessionState, `runtime.schedules.${armedScheduleId}.armedAtMs`) : undefined;
  const nowMs = systemContext.clock?.nowMs;

  if (typeof armedAtMs !== 'number' || typeof nowMs !== 'number' || typeof schedule.trigger.minutes !== 'number') {
    return false;
  }

  return nowMs - armedAtMs >= schedule.trigger.minutes * 60_000;
}

function applyScheduleEffects(
  sessionState: RuntimeSessionState,
  effects: EventEffectDefinition[] | undefined,
  systemContext: RuntimeSystemContext,
  scheduleId: string,
): RuntimeSessionState {
  let nextState = cloneRuntimeSessionState(sessionState);

  for (const effect of effects ?? []) {
    if (effect.kind !== 'set' || effect.args.length < 2) {
      continue;
    }

    const targetPath = typeof effect.args[0] === 'string' ? effect.args[0] : undefined;

    if (!targetPath) {
      continue;
    }

    nextState = setRuntimeSessionValue(nextState, targetPath, toRuntimeSessionValue(effect.args[1]));
  }

  if (typeof systemContext.clock?.nowMs === 'number') {
    nextState = setRuntimeSessionValue(nextState, `runtime.schedules.${scheduleId}.appliedAtMs`, systemContext.clock.nowMs);
  }

  return nextState;
}

function resolveClockContextValue(path: string, clock: RuntimeClockSnapshot | undefined): RuntimeSessionValue | undefined {
  if (!clock) {
    return undefined;
  }

  if (path === 'world.time.phase') {
    return clock.phase;
  }

  if (path === 'world.time.cycle') {
    return clock.cycle;
  }

  if (path === 'world.time.nowMs') {
    return clock.nowMs;
  }

  if (path === 'world.time.source') {
    return clock.source;
  }

  return undefined;
}

function resolveWeatherContextValue(path: string, weather: RuntimeWeatherSnapshot | undefined): RuntimeSessionValue | undefined {
  if (!weather) {
    return undefined;
  }

  if (path === 'world.weather.kind') {
    return weather.kind;
  }

  if (path === 'world.weather.intensity') {
    return weather.intensity;
  }

  if (path === 'world.weather.patternId') {
    return weather.patternId;
  }

  if (path === 'world.weather.stepId') {
    return weather.stepId;
  }

  if (path === 'world.weather.region') {
    return weather.regionId;
  }

  if (path === 'world.weather.source') {
    return weather.source;
  }

  return undefined;
}

export function getRuntimeClockSnapshotFromSessionState(sessionState: RuntimeSessionState): RuntimeClockSnapshot | undefined {
  const phase = getRuntimeSessionValue(sessionState, 'world.time.phase');
  const cycleValue = getRuntimeSessionValue(sessionState, 'world.time.cycle');
  const nowMs = getRuntimeSessionValue(sessionState, 'world.time.nowMs');
  const source = getRuntimeSessionValue(sessionState, 'world.time.source');
  const cycle = Array.isArray(cycleValue) ? cycleValue.filter((entry): entry is string => typeof entry === 'string') : undefined;

  if (typeof phase !== 'string' && !cycle && typeof nowMs !== 'number') {
    return undefined;
  }

  return {
    phase: typeof phase === 'string' ? phase : undefined,
    cycle,
    nowMs: typeof nowMs === 'number' ? nowMs : undefined,
    source: typeof source === 'string' ? source : 'session',
  };
}

export function getRuntimeWeatherSnapshotFromSessionState(sessionState: RuntimeSessionState): RuntimeWeatherSnapshot | undefined {
  const kind = getRuntimeSessionValue(sessionState, 'world.weather.kind');
  const intensity = getRuntimeSessionValue(sessionState, 'world.weather.intensity');
  const patternId = getRuntimeSessionValue(sessionState, 'world.weather.patternId');
  const stepId = getRuntimeSessionValue(sessionState, 'world.weather.stepId');
  const regionId = getRuntimeSessionValue(sessionState, 'world.weather.region');

  if (typeof kind !== 'string' && typeof patternId !== 'string') {
    return undefined;
  }

  return {
    kind: typeof kind === 'string' ? kind : undefined,
    intensity: typeof intensity === 'string' ? intensity : undefined,
    patternId: typeof patternId === 'string' ? patternId : undefined,
    stepId: typeof stepId === 'string' ? stepId : undefined,
    regionId: typeof regionId === 'string' ? regionId : undefined,
    statusText: [],
    source: 'session',
  };
}

function normalizePredicateArgs(value: ParsedFrontMatterValue | undefined): ParsedFrontMatterValue[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
    return undefined;
  }

  return trimmedValue
    .slice(1, -1)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => parseInlinePredicateToken(part));
}

function parseInlinePredicateToken(token: string): ParsedFrontMatterValue {
  if (token === 'true') {
    return true;
  }

  if (token === 'false') {
    return false;
  }

  if (token === 'null') {
    return null;
  }

  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }

  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    return token.slice(1, -1);
  }

  return token;
}

function setRuntimeSessionValue(
  sessionState: RuntimeSessionState,
  path: string,
  value: RuntimeSessionValue,
): RuntimeSessionState {
  const segments = path.split('.').filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return sessionState;
  }

  const nextState = cloneRuntimeSessionState(sessionState);
  let cursor: RuntimeSessionObject = nextState;

  for (const segment of segments.slice(0, -1)) {
    const currentValue = cursor[segment];

    if (!isRuntimeSessionObject(currentValue)) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as RuntimeSessionObject;
  }

  cursor[segments[segments.length - 1]] = cloneRuntimeSessionValue(value);
  return nextState;
}

function getRuntimeSessionValue(sessionState: RuntimeSessionState, path: string): RuntimeSessionValue | undefined {
  const segments = path.split('.').filter((segment) => segment.length > 0);
  let cursor: RuntimeSessionValue | undefined = sessionState;

  for (const segment of segments) {
    if (!isRuntimeSessionObject(cursor)) {
      return undefined;
    }

    cursor = cursor[segment];
  }

  return cursor;
}

function mergeRuntimeSessionState(
  baseState: RuntimeSessionState,
  patchState: RuntimeSessionState,
): RuntimeSessionState {
  const nextState = cloneRuntimeSessionState(baseState);

  for (const [key, value] of Object.entries(patchState)) {
    const existingValue = nextState[key];

    if (isRuntimeSessionObject(existingValue) && isRuntimeSessionObject(value)) {
      nextState[key] = mergeRuntimeSessionState(existingValue, value);
      continue;
    }

    nextState[key] = cloneRuntimeSessionValue(value);
  }

  return nextState;
}

function cloneRuntimeSessionState(state: RuntimeSessionState): RuntimeSessionState {
  return Object.fromEntries(
    Object.entries(state).map(([key, value]) => [key, cloneRuntimeSessionValue(value)]),
  );
}

function cloneRuntimeSessionValue(value: RuntimeSessionValue): RuntimeSessionValue {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneRuntimeSessionValue(entry));
  }

  if (isRuntimeSessionObject(value)) {
    return cloneRuntimeSessionState(value);
  }

  return value;
}

function toRuntimeSessionState(value: ParsedFrontMatterObject): RuntimeSessionState {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, toRuntimeSessionValue(entry)]),
  );
}

function toRuntimeSessionValue(value: ParsedFrontMatterValue): RuntimeSessionValue {
  if (Array.isArray(value)) {
    return value.map((entry) => toRuntimeSessionValue(entry));
  }

  if (isParsedObject(value)) {
    return toRuntimeSessionState(value);
  }

  return value;
}

function isRuntimeSessionObject(value: RuntimeSessionValue | undefined): value is RuntimeSessionObject {
  return !!value && !Array.isArray(value) && typeof value === 'object';
}

function isParsedObject(value: ParsedFrontMatterValue | undefined): value is ParsedFrontMatterObject {
  return !!value && !Array.isArray(value) && typeof value === 'object';
}

function parseContentObject(source: string, sourcePath: string): ContentObject | undefined {
  const templateSchema = detectTemplateSchema(source);

  if (!templateSchema) {
    console.warn(`Skipping ${sourcePath}: missing templateSchema.`);
    return undefined;
  }

  const result =
    templateSchema === 'area'
      ? parseAreaToSchema(source, sourcePath)
      : templateSchema === 'path'
        ? parsePathToSchema(source, sourcePath)
        : parseGateToSchema(source, sourcePath);

  if (!result.value || result.errors.length > 0) {
    console.warn(`Skipping ${sourcePath}: ${result.errors.map((error) => error.message).join('; ')}`);
    return undefined;
  }

  return result.value;
}

function detectTemplateSchema(source: string): ContentObject['templateSchema'] | undefined {
  const match = /^templateSchema:\s*(area|path|gate)\s*$/im.exec(source);
  return match?.[1] as ContentObject['templateSchema'] | undefined;
}

function projectContentObject(
  node: ContentObject,
  pathDirection?: PathDirection,
  options: ProjectPageOptions = {},
): ProjectionResult {
  if (node.templateSchema === 'area') {
    return projectAreaNode(
      interpretAreaNode(node, {
        proseSelections: selectAreaProse(node, options.areaVisitCount),
      }),
    );
  }

  if (node.templateSchema === 'path') {
    const direction = selectPathDirection(node, pathDirection);
    const flowTrigger = selectPathFlowTrigger(node, direction, options.pathVisitCount);
    const traversalMode = selectPathTraversalMode(node, flowTrigger);
    const activeFlow = node.flows?.find((flow) => flow.trigger === flowTrigger && flow.direction === direction);
    const totalBeatCount = activeFlow?.beats.length ?? 0;
    const activeBeatIndex = clampPathBeatIndex(options.pathBeatIndex, totalBeatCount);
    const interpretedPathNode = interpretPathNode(node, {
      flowTrigger,
      direction,
      controls: selectPathControls(node, flowTrigger, totalBeatCount, traversalMode, activeBeatIndex),
    });

    if (traversalMode === 'paged' && interpretedPathNode.proseBlocks && interpretedPathNode.proseBlocks.length > 0) {
      interpretedPathNode.proseBlocks = interpretedPathNode.proseBlocks.slice(activeBeatIndex, activeBeatIndex + 1);
    }

    return projectPathNode(
      interpretedPathNode,
    );
  }

  const gateDirection = selectGateDirection(node, pathDirection);
  const blockedDirection = selectGateBlockedDirection(node, gateDirection);

  return projectGateNode(interpretGateNode(node, {
    proseSelections: selectGateProse(node, options.areaVisitCount, blockedDirection, gateDirection),
    direction: gateDirection,
    blockedDirection,
  }));
}

function selectAreaProse(
  node: AreaObject,
  areaVisitCount = 1,
): Array<{ trigger: ProseTrigger; key?: string; occurrence?: number }> {
  const selections: Array<{ trigger: ProseTrigger; key?: string; occurrence?: number }> = [];
  const hasTrigger = (trigger: ProseTrigger) => node.proseSlots?.some((slot) => slot.trigger === trigger);
  const blocked = isAreaBlocked(node);

  if (areaVisitCount <= 1) {
    if (hasTrigger('first_visit')) {
      selections.push({ trigger: 'first_visit', occurrence: 1 });
    }

    if (blocked && hasTrigger('blocked')) {
      selections.push({ trigger: 'blocked', occurrence: areaVisitCount });
    }

    if (hasTrigger('enter')) {
      selections.push({ trigger: 'enter', occurrence: areaVisitCount });
    }

    return selections;
  }

  if (hasTrigger('repeat_visit')) {
    selections.push({ trigger: 'repeat_visit', occurrence: Math.max(areaVisitCount - 1, 1) });

    if (blocked && hasTrigger('blocked')) {
      selections.push({ trigger: 'blocked', occurrence: areaVisitCount });
    }

    if (hasTrigger('enter')) {
      selections.push({ trigger: 'enter', occurrence: areaVisitCount });
    }

    return selections;
  }

  if (hasTrigger('visit_random')) {
    selections.push({ trigger: 'visit_random', occurrence: Math.max(areaVisitCount - 1, 1) });
  }

  if (blocked && hasTrigger('blocked')) {
    selections.push({ trigger: 'blocked', occurrence: areaVisitCount });
  }

  if (hasTrigger('enter')) {
    selections.push({ trigger: 'enter', occurrence: areaVisitCount });
  }

  return selections;
}

function selectGateProse(
  node: GateObject,
  gateVisitCount = 1,
  blockedDirection?: PathDirection,
  gateDirection?: PathDirection,
): Array<{ trigger: ProseTrigger; key?: string; occurrence?: number }> {
  const selections: Array<{ trigger: ProseTrigger; key?: string; occurrence?: number }> = [];
  const hasTrigger = (trigger: ProseTrigger, key?: string) =>
    node.proseSlots?.some((slot) => slot.trigger === trigger && (key === undefined || slot.key === key));

  if (gateVisitCount <= 1) {
    if (hasTrigger('first_visit')) {
      selections.push({ trigger: 'first_visit', occurrence: 1 });
    }

    if (blockedDirection) {
      if (hasTrigger('blocked', blockedDirection)) {
        selections.push({ trigger: 'blocked', key: blockedDirection, occurrence: gateVisitCount });
      } else if (hasTrigger('blocked')) {
        selections.push({ trigger: 'blocked', occurrence: gateVisitCount });
      }
    } else if (gateDirection && hasTrigger('billboard', gateDirection)) {
      selections.push({ trigger: 'billboard', key: gateDirection, occurrence: gateVisitCount });
    } else if (hasTrigger('billboard')) {
      selections.push({ trigger: 'billboard', occurrence: gateVisitCount });
    }

    if (gateDirection && hasTrigger('enter', gateDirection)) {
      selections.push({ trigger: 'enter', key: gateDirection, occurrence: gateVisitCount });
    } else if (hasTrigger('enter')) {
      selections.push({ trigger: 'enter', occurrence: gateVisitCount });
    }

    return selections;
  }

  if (hasTrigger('repeat_visit')) {
    selections.push({ trigger: 'repeat_visit', occurrence: Math.max(gateVisitCount - 1, 1) });

    if (blockedDirection) {
      if (hasTrigger('blocked', blockedDirection)) {
        selections.push({ trigger: 'blocked', key: blockedDirection, occurrence: gateVisitCount });
      } else if (hasTrigger('blocked')) {
        selections.push({ trigger: 'blocked', occurrence: gateVisitCount });
      }
    } else if (gateDirection && hasTrigger('billboard', gateDirection)) {
      selections.push({ trigger: 'billboard', key: gateDirection, occurrence: gateVisitCount });
    } else if (hasTrigger('billboard')) {
      selections.push({ trigger: 'billboard', occurrence: gateVisitCount });
    }

    if (gateDirection && hasTrigger('enter', gateDirection)) {
      selections.push({ trigger: 'enter', key: gateDirection, occurrence: gateVisitCount });
    } else if (hasTrigger('enter')) {
      selections.push({ trigger: 'enter', occurrence: gateVisitCount });
    }

    return selections;
  }

  if (hasTrigger('visit_random')) {
    selections.push({ trigger: 'visit_random', occurrence: Math.max(gateVisitCount - 1, 1) });
  }

  if (blockedDirection) {
    if (hasTrigger('blocked', blockedDirection)) {
      selections.push({ trigger: 'blocked', key: blockedDirection, occurrence: gateVisitCount });
    } else if (hasTrigger('blocked')) {
      selections.push({ trigger: 'blocked', occurrence: gateVisitCount });
    }
  } else if (gateDirection && hasTrigger('billboard', gateDirection)) {
    selections.push({ trigger: 'billboard', key: gateDirection, occurrence: gateVisitCount });
  } else if (hasTrigger('billboard')) {
    selections.push({ trigger: 'billboard', occurrence: gateVisitCount });
  }

  if (gateDirection && hasTrigger('enter', gateDirection)) {
    selections.push({ trigger: 'enter', key: gateDirection, occurrence: gateVisitCount });
  } else if (hasTrigger('enter')) {
    selections.push({ trigger: 'enter', occurrence: gateVisitCount });
  }

  return selections;
}

function selectPathFlowTrigger(
  node: PathObject,
  direction: PathDirection,
  pathVisitCount = 1,
): 'first_visit' | 'repeat' | 'block' {
  const hasFlow = (trigger: 'first_visit' | 'repeat' | 'block') =>
    node.flows?.some((flow) => flow.trigger === trigger && flow.direction === direction);

  if (isPathBlocked(node, direction)) {
    return 'block';
  }

  if (pathVisitCount > 1 && hasFlow('repeat')) {
    return 'repeat';
  }

  if (hasFlow('first_visit')) {
    return 'first_visit';
  }

  if (hasFlow('repeat')) {
    return 'repeat';
  }

  return 'block';
}

function selectPathTraversalMode(node: PathObject, flowTrigger: 'first_visit' | 'repeat' | 'block'): 'paged' | 'compressed' {
  if (flowTrigger === 'block') {
    return 'paged';
  }

  if (flowTrigger === 'repeat') {
    return node.traversal?.repeatVisitMode ?? 'compressed';
  }

  if (flowTrigger === 'first_visit') {
    return node.traversal?.firstVisitMode ?? 'paged';
  }

  return 'compressed';
}

function selectPathDirection(node: PathObject, requestedDirection?: PathDirection): 'forward' | 'backward' {
  if (requestedDirection && isPathDirectionSupported(node, requestedDirection)) {
    return requestedDirection;
  }

  if (isPathDirectionSupported(node, 'forward')) {
    return 'forward';
  }

  return 'backward';
}

function selectGateDirection(gate: GateObject, requestedDirection?: PathDirection): PathDirection | undefined {
  if (requestedDirection && isGateDirectionSupported(gate, requestedDirection)) {
    return requestedDirection;
  }

  if (isGateDirectionSupported(gate, 'forward')) {
    return 'forward';
  }

  if (isGateDirectionSupported(gate, 'backward')) {
    return 'backward';
  }

  return undefined;
}

function selectPathControls(
  node: PathObject,
  flowTrigger: 'first_visit' | 'repeat' | 'block',
  totalBeatCount: number,
  traversalMode: 'paged' | 'compressed',
  currentBeatIndex: number,
): Array<'continue' | 'skip' | 'back'> {
  if (flowTrigger === 'block') {
    const controls: Array<'continue' | 'skip' | 'back'> = [];

    if (totalBeatCount > 1 && currentBeatIndex < totalBeatCount - 1) {
      controls.push('continue');
    }

    if (node.directionality === 'bidirectional') {
      controls.push('back');
    }

    return controls;
  }

  const controls: Array<'continue' | 'skip' | 'back'> = ['continue'];

  if (traversalMode === 'paged' && totalBeatCount > 1) {
    controls.push('skip');
  }

  if (node.directionality === 'bidirectional') {
    controls.push('back');
  }

  return controls;
}

function clampPathBeatIndex(pathBeatIndex: number | undefined, totalBeatCount: number): number {
  if (totalBeatCount <= 0) {
    return 0;
  }

  if (pathBeatIndex === undefined || pathBeatIndex < 0) {
    return 0;
  }

  return Math.min(pathBeatIndex, totalBeatCount - 1);
}

function compareNodeRecords(left: RuntimeNodeRecord, right: RuntimeNodeRecord): number {
  return rankNodeKind(left.node.templateSchema) - rankNodeKind(right.node.templateSchema) || left.sourcePath.localeCompare(right.sourcePath);
}

function rankNodeKind(kind: ContentObject['templateSchema']): number {
  if (kind === 'area') {
    return 0;
  }

  if (kind === 'path') {
    return 1;
  }

  return 2;
}

function pickStartNodeId(records: RuntimeNodeRecord[]): string | undefined {
  const areaRecords = records.filter((record) => record.node.templateSchema === 'area');

  if (areaRecords.length === 0) {
    return records[0]?.node.id;
  }

  const preferredStartRecord = areaRecords.find((record) => record.node.id === PREFERRED_START_NODE_ID);

  if (preferredStartRecord) {
    return preferredStartRecord.node.id;
  }

  const referencedNodeIds = new Set<string>();

  for (const record of records) {
    if (record.node.templateSchema === 'area') {
      for (const exit of record.node.exits ?? []) {
        const resolvedNodeId = resolveRecordNodeId(records, exit.targetId);

        if (resolvedNodeId) {
          referencedNodeIds.add(resolvedNodeId);
        }
      }
    }

    if (record.node.templateSchema === 'path' || record.node.templateSchema === 'gate') {
      const forwardTargetId = record.node.endpoints?.forward?.to;
      const resolvedForwardTargetId = resolveRecordNodeId(records, forwardTargetId);

      if (resolvedForwardTargetId) {
        referencedNodeIds.add(resolvedForwardTargetId);
      }
    }
  }

  return areaRecords.find((record) => !referencedNodeIds.has(record.node.id))?.node.id ?? areaRecords[0]?.node.id;
}

function resolveRecordNodeId(records: RuntimeNodeRecord[], referenceId: string | undefined): string | undefined {
  if (!referenceId) {
    return undefined;
  }

  const aliases = new Set([referenceId, canonicalizeNodeId(referenceId)]);

  for (const record of records) {
    const recordAliases = getRecordAliases(record);

    if (recordAliases.some((alias) => aliases.has(alias))) {
      return record.node.id;
    }
  }

  return undefined;
}

function validateProjectRecords(records: RuntimeNodeRecord[]): string[] {
  const errors: string[] = [];
  const titleScreenRecord = records.find(
    (record) => record.node.templateSchema === 'area' && record.node.id === PREFERRED_START_NODE_ID,
  );

  if (!titleScreenRecord) {
    errors.push('missing title_screen area');
  } else if (!hasResolvableOutgoingConnection(records, titleScreenRecord.node.id)) {
    errors.push('title_screen is not connected to any resolvable target');
  }

  const endingRecords = records.filter((record) => isEndingAreaRecord(record));

  if (endingRecords.length === 0) {
    errors.push('missing ending area');
  } else if (!endingRecords.some((record) => hasResolvableIncomingConnection(records, record.node.id))) {
    errors.push('no ending area is connected from another node');
  }

  return errors;
}

function isEndingAreaRecord(record: RuntimeNodeRecord): boolean {
  return record.node.templateSchema === 'area'
    && (record.node.id.startsWith('game_over_') || record.node.tags?.includes('ending') === true);
}

function hasResolvableOutgoingConnection(records: RuntimeNodeRecord[], nodeId: string): boolean {
  const record = records.find((candidate) => candidate.node.id === nodeId);

  if (!record) {
    return false;
  }

  if (record.node.templateSchema === 'area') {
    return (record.node.exits ?? []).some((exit) => resolveRecordNodeId(records, exit.targetId) !== undefined);
  }

  if (record.node.templateSchema === 'path') {
    const node = record.node;

    return ['forward', 'backward'].some((direction) => {
      const targetId = node.endpoints?.[direction as PathDirection]?.to;
      return resolveRecordNodeId(records, targetId) !== undefined;
    });
  }

  if (record.node.templateSchema === 'gate') {
    const node = record.node;

    return ['forward', 'backward'].some((direction) => {
      const targetId = node.endpoints?.[direction as PathDirection]?.to;
      return resolveRecordNodeId(records, targetId) !== undefined;
    });
  }

  return false;
}

function hasResolvableIncomingConnection(records: RuntimeNodeRecord[], targetNodeId: string): boolean {
  return records.some((record) => {
    if (record.node.templateSchema === 'area') {
      return (record.node.exits ?? []).some((exit) => resolveRecordNodeId(records, exit.targetId) === targetNodeId);
    }

    if (record.node.templateSchema === 'path') {
      const node = record.node;

      return ['forward', 'backward'].some((direction) => {
        const endpoint = node.endpoints?.[direction as PathDirection];
        return resolveRecordNodeId(records, endpoint?.to) === targetNodeId;
      });
    }

    if (record.node.templateSchema === 'gate') {
      const node = record.node;

      return ['forward', 'backward'].some((direction) => {
        const endpoint = node.endpoints?.[direction as PathDirection];
        return resolveRecordNodeId(records, endpoint?.to) === targetNodeId;
      });
    }

    return false;
  });
}

function resolveReachableNode(
  project: RuntimeProjectRecord,
  sourceNodeId: string,
  targetId: string | undefined,
  direction: 'forward' | 'backward',
): { nodeId: string; pathDirection?: PathDirection } | undefined {
  if (!targetId) {
    return undefined;
  }

  const seen = new Set<string>();
  let currentId = resolveNodeId(project, targetId);
  let activeDirection: PathDirection | undefined;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);

    const current = project.nodeRecordsById[currentId];

    if (!current) {
      return undefined;
    }

    if (current.node.templateSchema === 'path') {
      activeDirection = resolvePathDirection(project, sourceNodeId, current.node, direction);

      if (!isPathDirectionSupported(current.node, activeDirection)) {
        return undefined;
      }

      return { nodeId: currentId, pathDirection: activeDirection };
    }

    if (current.node.templateSchema === 'gate') {
      const gateDirection = resolveGateDirection(project, sourceNodeId, current.node, direction);

      if (!isGateDirectionSupported(current.node, gateDirection)) {
        return undefined;
      }

      if (isGateBlocked(current.node, gateDirection)) {
        return { nodeId: currentId, pathDirection: gateDirection };
      }

      if (!isGatePassthrough(current.node, gateDirection)) {
        return {
          nodeId: currentId,
          pathDirection: gateNeedsDirectionalContext(current.node) ? gateDirection : undefined,
        };
      }

      const passthroughDestinationId = resolvePassthroughGateDestination(project, sourceNodeId, current.node, gateDirection);

      if (passthroughDestinationId) {
        sourceNodeId = current.node.id;
        currentId = passthroughDestinationId;
        continue;
      }

      sourceNodeId = current.node.id;
      currentId = resolveNodeId(project, current.node.endpoints?.[gateDirection]?.to);
      continue;
    }

    return { nodeId: currentId, pathDirection: activeDirection };
  }

  return currentId ? { nodeId: currentId, pathDirection: activeDirection } : undefined;
}

function resolveNodeId(project: RuntimeProjectRecord, referenceId: string | undefined): string | undefined {
  if (!referenceId) {
    return undefined;
  }

  return project.nodeIdsByAlias[referenceId] ?? project.nodeIdsByAlias[canonicalizeNodeId(referenceId)];
}

function resolvePassthroughGateDestination(
  project: RuntimeProjectRecord,
  sourceNodeId: string,
  gate: GateObject,
  direction: 'forward' | 'backward',
): string | undefined {
  const sourceRecord = project.nodeRecordsById[sourceNodeId];
  const sourceKind = sourceRecord?.node.templateSchema;

  if (sourceKind === 'path') {
    const inwardTargetId = resolveNodeId(project, gate.endpoints?.backward?.to);

    if (inwardTargetId && inwardTargetId !== sourceNodeId) {
      return inwardTargetId;
    }

    const inferredInwardTargetId = resolveGateAttachedAreaId(project, gate.id, sourceNodeId);

    if (inferredInwardTargetId) {
      return inferredInwardTargetId;
    }
  } else {
    const outwardTargetId = resolveNodeId(project, gate.endpoints?.forward?.to);

    if (outwardTargetId && outwardTargetId !== sourceNodeId) {
      return outwardTargetId;
    }

    const inferredOutwardTargetId = resolveConnectedPathId(project, gate.id, direction);

    if (inferredOutwardTargetId) {
      return inferredOutwardTargetId;
    }
  }

  const gateEndpoint = gate.endpoints?.[direction];

  if (gateEndpoint) {
    const fromId = resolveNodeId(project, gateEndpoint.from);
    const toId = resolveNodeId(project, gateEndpoint.to);

    if (fromId === sourceNodeId && toId) {
      return toId;
    }

    if (toId === sourceNodeId && fromId) {
      return fromId;
    }
  }

  for (const record of Object.values(project.nodeRecordsById)) {
    if (record.node.templateSchema !== 'path') {
      continue;
    }

    const endpoint = record.node.endpoints[direction];

    if (!endpoint) {
      continue;
    }

    const fromId = resolveNodeId(project, endpoint.from);
    const toId = resolveNodeId(project, endpoint.to);

    if (fromId === gate.id && sourceNodeId !== record.node.id) {
      return record.node.id;
    }

    if (toId === gate.id && sourceNodeId === record.node.id && fromId) {
      return fromId;
    }
  }

  return undefined;
}

function resolveGateAttachedAreaId(
  project: RuntimeProjectRecord,
  gateId: string,
  sourceNodeId: string,
): string | undefined {
  for (const record of Object.values(project.nodeRecordsById)) {
    if (record.node.templateSchema !== 'area') {
      continue;
    }

    const exits = record.node.exits ?? [];
    const pointsToGate = exits.some((exit) => resolveNodeId(project, exit.targetId) === gateId);

    if (pointsToGate && record.node.id !== sourceNodeId) {
      return record.node.id;
    }
  }

  return undefined;
}

function resolveConnectedPathId(
  project: RuntimeProjectRecord,
  gateId: string,
  direction: 'forward' | 'backward',
): string | undefined {
  for (const record of Object.values(project.nodeRecordsById)) {
    if (record.node.templateSchema !== 'path') {
      continue;
    }

    const endpoint = record.node.endpoints[direction];

    if (!endpoint) {
      continue;
    }

    const fromId = resolveNodeId(project, endpoint.from);
    const toId = resolveNodeId(project, endpoint.to);

    if (fromId === gateId || toId === gateId) {
      return record.node.id;
    }
  }

  return undefined;
}

function resolvePathDirection(
  project: RuntimeProjectRecord,
  sourceNodeId: string,
  path: PathObject,
  fallbackDirection: PathDirection,
): PathDirection {
  const sourceId = resolveNodeId(project, sourceNodeId);
  const forwardFrom = resolveNodeId(project, path.endpoints.forward?.from);
  const forwardTo = resolveNodeId(project, path.endpoints.forward?.to);
  const backwardFrom = resolveNodeId(project, path.endpoints.backward?.from);
  const backwardTo = resolveNodeId(project, path.endpoints.backward?.to);

  if (sourceId && sourceId === forwardFrom) {
    return 'forward';
  }

  if (sourceId && sourceId === forwardTo) {
    return 'backward';
  }

  if (sourceId && sourceId === backwardFrom) {
    return 'backward';
  }

  if (sourceId && sourceId === backwardTo) {
    return 'forward';
  }

  return fallbackDirection;
}

function resolveGateDirection(
  project: RuntimeProjectRecord,
  sourceNodeId: string,
  gate: GateObject,
  fallbackDirection: PathDirection,
): PathDirection {
  const sourceId = resolveNodeId(project, sourceNodeId);
  const forwardFrom = resolveNodeId(project, gate.endpoints?.forward?.from);
  const forwardTo = resolveNodeId(project, gate.endpoints?.forward?.to);
  const backwardFrom = resolveNodeId(project, gate.endpoints?.backward?.from);
  const backwardTo = resolveNodeId(project, gate.endpoints?.backward?.to);

  if (sourceId && sourceId === forwardFrom) {
    return 'forward';
  }

  if (sourceId && sourceId === forwardTo) {
    return 'backward';
  }

  if (sourceId && sourceId === backwardFrom) {
    return 'backward';
  }

  if (sourceId && sourceId === backwardTo) {
    return 'forward';
  }

  return fallbackDirection;
}

function resolveGateCurrentSideNodeId(
  project: RuntimeProjectRecord,
  gate: GateObject,
  direction: PathDirection,
): string | undefined {
  if (direction === 'forward') {
    return resolveNodeId(project, gate.endpoints?.forward?.from)
      ?? resolveNodeId(project, gate.endpoints?.backward?.to)
      ?? resolveGateAttachedAreaId(project, gate.id, gate.id)
      ?? resolveConnectedPathId(project, gate.id, 'backward')
      ?? resolveConnectedPathId(project, gate.id, 'forward')
      ?? resolveNodeId(project, gate.exits?.[0]?.targetId);
  }

  return resolveNodeId(project, gate.endpoints?.forward?.to)
    ?? resolveNodeId(project, gate.endpoints?.backward?.from)
    ?? resolveConnectedPathId(project, gate.id, 'forward')
    ?? resolveConnectedPathId(project, gate.id, 'backward')
    ?? resolveGateAttachedAreaId(project, gate.id, gate.id)
    ?? resolveNodeId(project, gate.exits?.[0]?.targetId);
}

function isPathDirectionSupported(path: PathObject, direction: PathDirection): boolean {
  if (path.directionality === 'bidirectional') {
    return true;
  }

  if (path.directionality === 'forward_only') {
    return direction === 'forward';
  }

  return direction === 'backward';
}

function isPathBlocked(path: PathObject, direction: PathDirection): boolean {
  return path.blocking?.[direction] === 'blocked';
}

function isAreaBlocked(area: AreaObject): boolean {
  return area.blocking?.state === 'blocked';
}

function selectGateBlockedDirection(gate: GateObject, requestedDirection?: PathDirection): PathDirection | undefined {
  if (!requestedDirection) {
    return undefined;
  }

  return isGateBlocked(gate, requestedDirection) ? requestedDirection : undefined;
}

function isGateBlocked(gate: GateObject, direction: PathDirection): boolean {
  return gate.blocking?.[direction] === 'blocked';
}

function isGateDirectionSupported(gate: GateObject, direction: PathDirection): boolean {
  if (!gate.directionality || gate.directionality === 'bidirectional') {
    return true;
  }

  if (gate.directionality === 'forward_only') {
    return direction === 'forward';
  }

  return direction === 'backward';
}

function gateNeedsDirectionalContext(gate: GateObject): boolean {
  const presentationForward = gate.presentation?.forward;
  const presentationBackward = gate.presentation?.backward;

  if (presentationForward && presentationBackward && presentationForward !== presentationBackward) {
    return true;
  }

  return !!gate.proseSlots?.some(
    (slot) =>
      (slot.trigger === 'enter' || slot.trigger === 'billboard') &&
      (slot.key === 'forward' || slot.key === 'backward'),
  );
}

function selectGatePresentationMode(gate: GateObject, direction?: PathDirection) {
  if (direction) {
    const directionalMode = gate.presentation?.[direction];

    if (directionalMode) {
      return directionalMode;
    }
  }

  if (
    gate.presentationMode === 'passthrough' ||
    gate.presentationMode === 'walkpassthrough' ||
    gate.presentationMode === 'runpassthrough' ||
    gate.presentationMode === 'billboard'
  ) {
    return gate.presentationMode;
  }

  if (gate.runpassthrough === true) {
    return 'runpassthrough';
  }

  if (gate.walkpassthrough === true) {
    return 'walkpassthrough';
  }

  if (gate.passthrough === true) {
    return 'passthrough';
  }

  return undefined;
}

function canonicalizeNodeId(value: string): string {
  return value.replace(/_\{guid\}$/i, '');
}

function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, '');
}

function getRecordAliases(record: RuntimeNodeRecord): string[] {
  const sourcePathWithoutExtension = stripMarkdownExtension(record.sourcePath);

  return Array.from(new Set([
    record.node.id,
    canonicalizeNodeId(record.node.id),
    sourcePathWithoutExtension,
    canonicalizeNodeId(sourcePathWithoutExtension),
  ]));
}

function getRecordFolderAncestors(record: RuntimeNodeRecord): string[] {
  const sourcePathWithoutExtension = stripMarkdownExtension(record.sourcePath);
  const lastSeparatorIndex = sourcePathWithoutExtension.lastIndexOf('/');

  if (lastSeparatorIndex < 0) {
    return [];
  }

  const folderPath = sourcePathWithoutExtension.slice(0, lastSeparatorIndex);
  const segments = folderPath.split('/').filter(Boolean);

  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}

function isGatePassthrough(node: GateObject, direction?: PathDirection): boolean {
  const presentationMode = selectGatePresentationMode(node, direction);

  return (
    presentationMode === 'passthrough' ||
    presentationMode === 'walkpassthrough' ||
    presentationMode === 'runpassthrough'
  );
}

function resolveAreaFixtureOfferedActions(
  node: ContentObject | undefined,
  sessionState: RuntimeSessionState | undefined,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): ProjectedAction[] {
  if (!node || node.templateSchema !== 'area' || !sessionState) {
    return [];
  }

  return (node.fixtures ?? []).flatMap((fixture) => resolveFixtureOfferedActions(fixture, sessionState, fixtureInteractionStateById));
}

function resolveFixtureOfferedActions(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): ProjectedAction[] {
  if (fixture.kind !== 'jukebox' || !isFixtureFocused(fixture, fixtureInteractionStateById)) {
    return [];
  }

  const fakeCredits = getJukeboxFakeCreditCount(fixture, sessionState, fixtureInteractionStateById);
  const selectedSong = getJukeboxPreviewSong(fixture, sessionState, fixtureInteractionStateById);
  const selectedSongPriceDollars = getJukeboxSongPriceDollars(selectedSong);
  const actions: ProjectedAction[] = [];

  actions.push({
    id: createFixtureActionId(fixture.id, 'swipe_left'),
    kind: 'choice',
    label: '<< Swipe Left',
    key: 'A',
    keyLabel: '[A]',
  });

  actions.push({
    id: createFixtureActionId(fixture.id, 'swipe_right'),
    kind: 'choice',
    label: 'Swipe Right >>',
    key: 'D',
    keyLabel: '[D]',
  });

  actions.push({
    id: createFixtureActionId(fixture.id, 'queue_song'),
    kind: 'choice',
    label: `Queue Selected Song (${formatJukeboxPriceText(selectedSongPriceDollars)})`,
    key: 'Q',
    keyLabel: '[Q]',
  });

  actions.push({
    id: createFixtureActionId(fixture.id, 'view_queue'),
    kind: 'choice',
    label: 'View Current Queue',
    key: 'V',
    keyLabel: '[V]',
  });

  actions.push({
    id: createFixtureActionId(fixture.id, 'add_fake_money'),
    kind: 'choice',
    label: fakeCredits > 0
      ? `Put In Fake Money (+${formatJukeboxPriceText(JUKEBOX_DEFAULT_TRACK_PRICE_DOLLARS)} | ${formatJukeboxPriceText(fakeCredits)} Ready)`
      : `Put In Fake Money (+${formatJukeboxPriceText(JUKEBOX_DEFAULT_TRACK_PRICE_DOLLARS)})`,
    key: 'F',
    keyLabel: '[F]',
  });

  actions.push({
    id: createFixtureActionId(fixture.id, 'step_away'),
    kind: 'choice',
    label: 'Step Away From Jukebox',
    key: 'W',
    keyLabel: '[W]',
  });

  return actions;
}

function resolveFixtureProjectedPanels(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): ProjectedFixturePanel[] {
  if (fixture.kind !== 'jukebox' || !isFixtureFocused(fixture, fixtureInteractionStateById)) {
    return [];
  }

  return [createJukeboxFixturePanel(fixture, sessionState, fixtureInteractionStateById)];
}

function resolveAreaFixturePoiAction(
  node: AreaObject,
  action: ProjectedAction,
  sessionState: RuntimeSessionState | undefined,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
  systemContext?: RuntimeSystemContext,
): RuntimeInteractionOutcome | undefined {
  const fixture = node.fixtures?.find((entry) => entry.id === action.id);

  if (!fixture || fixture.kind !== 'jukebox') {
    return undefined;
  }

  const currentState = sessionState ?? {};
  const currentTrackText = getJukeboxCurrentTrackText(fixture, currentState) ?? getJukeboxCurrentTrackLabel(fixture, currentState);
  const nextFixtureInteractionStateById = setJukeboxBrowseIndex(
    setFixtureFocused(fixtureInteractionStateById, fixture, true),
    fixture,
    getJukeboxBrowseIndex(fixture, currentState, fixtureInteractionStateById),
  );

  if (!currentTrackText) {
    const autoplaySong = getJukeboxAutoplaySong(fixture);

    if (autoplaySong) {
      const startedPlaybackState = setJukeboxTrack(
        currentState,
        fixture,
        autoplaySong,
        resolveRuntimeSystemNowMs(systemContext),
        'autoplay',
      );

      return {
        logEntry: createLogEntry(
          `The ${fixture.displayName.toLowerCase()} catches the motion near its controls and wakes itself with ${formatJukeboxSongText(autoplaySong)}.`,
          undefined,
          undefined,
          'recent',
        ),
        sessionState: startedPlaybackState,
        fixtureInteractionStateById: nextFixtureInteractionStateById,
      };
    }
  }

  const text = currentTrackText
    ? `${fixture.displayName} is already spinning ${currentTrackText}.`
    : `${fixture.displayName} waits in patient silence, all chrome, glow, and promise.`;

  return {
    logEntry: createLogEntry(text, undefined, undefined, 'recent'),
    fixtureInteractionStateById: nextFixtureInteractionStateById,
  };
}

function resolveAreaFixtureChoiceAction(
  node: AreaObject,
  action: ProjectedAction,
  sessionState: RuntimeSessionState | undefined,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
  systemContext?: RuntimeSystemContext,
): RuntimeInteractionOutcome | undefined {
  const parsedAction = parseFixtureActionId(action.id);

  if (!parsedAction) {
    return undefined;
  }

  const fixture = node.fixtures?.find((entry) => entry.id === parsedAction.fixtureId);

  if (!fixture || fixture.kind !== 'jukebox') {
    return undefined;
  }

  const currentState = sessionState ?? {};
  const currentFixtureInteractionStateById = fixtureInteractionStateById ?? {};

  if (parsedAction.command === 'swipe_left' || parsedAction.command === 'swipe_right') {
    const songCount = getJukeboxCatalogSongs(fixture).length;

    if (songCount === 0) {
      return undefined;
    }

    const currentIndex = getJukeboxBrowseIndex(fixture, currentState, currentFixtureInteractionStateById);
    const direction = parsedAction.command === 'swipe_left' ? -1 : 1;
    const nextIndex = ((currentIndex + direction) % songCount + songCount) % songCount;
    const nextFixtureInteractionStateById = setJukeboxBrowseIndex(
      setFixtureFocused(currentFixtureInteractionStateById, fixture, true),
      fixture,
      nextIndex,
    );

    return {
      fixtureInteractionStateById: nextFixtureInteractionStateById,
    };
  }

  if (parsedAction.command === 'view_queue') {
    const nextFixtureInteractionStateById = setFixtureFocused(currentFixtureInteractionStateById, fixture, true);

    return {
      fixtureInteractionStateById: nextFixtureInteractionStateById,
    };
  }

  if (parsedAction.command === 'add_fake_money') {
    if (isJukeboxQueueFull(
      fixture,
      currentState,
      getJukeboxCurrentTrackId(fixture, currentState),
      getJukeboxTrackMode(fixture, currentState),
    )) {
      return {
        logEntry: createLogEntry(
          `The ${fixture.displayName.toLowerCase()} queue is full at ${getJukeboxMaxQueueLength(fixture)} songs, so it refuses more fake money until something plays.`,
          undefined,
          undefined,
          'recent',
        ),
        fixtureInteractionStateById: setFixtureFocused(currentFixtureInteractionStateById, fixture, true),
      };
    }

    const nextCreditCount = getJukeboxFakeCreditCount(fixture, currentState, currentFixtureInteractionStateById) + 1;
    const nextFixtureInteractionStateById = setJukeboxFakeCreditCount(
      setFixtureFocused(currentFixtureInteractionStateById, fixture, true),
      fixture,
      nextCreditCount,
    );

    return {
      fixtureInteractionStateById: nextFixtureInteractionStateById,
    };
  }

  if (parsedAction.command === 'queue_song') {
    const previewSong = getJukeboxPreviewSong(fixture, currentState, currentFixtureInteractionStateById);
    const focusedFixtureInteractionStateById = setFixtureFocused(currentFixtureInteractionStateById, fixture, true);

    if (!previewSong) {
      return {
        logEntry: createLogEntry(`The ${fixture.displayName.toLowerCase()} has nothing selected to queue yet.`, undefined, undefined, 'recent'),
        fixtureInteractionStateById: focusedFixtureInteractionStateById,
      };
    }

    const fakeCredits = getJukeboxFakeCreditCount(fixture, currentState, currentFixtureInteractionStateById);
    const songPriceDollars = getJukeboxSongPriceDollars(previewSong);

    if (fakeCredits < songPriceDollars) {
      return {
        logEntry: createLogEntry(`The ${fixture.displayName.toLowerCase()} wants ${formatJukeboxPriceText(songPriceDollars)} in fake money before it will queue ${formatJukeboxSongText(previewSong)}.`, undefined, undefined, 'recent'),
        fixtureInteractionStateById: focusedFixtureInteractionStateById,
      };
    }

    const currentTrack = getJukeboxCurrentTrackId(fixture, currentState);
    const currentTrackMode = getJukeboxTrackMode(fixture, currentState);

    if (isJukeboxQueueFull(fixture, currentState, currentTrack, currentTrackMode)) {
      return {
        logEntry: createLogEntry(
          `The ${fixture.displayName.toLowerCase()} queue is full at ${getJukeboxMaxQueueLength(fixture)} songs. Wait for something to play before adding another selection.`,
          undefined,
          undefined,
          'recent',
        ),
        fixtureInteractionStateById: focusedFixtureInteractionStateById,
      };
    }

    const nextFixtureInteractionStateById = setJukeboxFakeCreditCount(
      focusedFixtureInteractionStateById,
      fixture,
      fakeCredits - songPriceDollars,
    );
    let nextState = currentState;
    const nowMs = resolveRuntimeSystemNowMs(systemContext);

    if (currentTrack && currentTrackMode !== 'autoplay') {
      const nextQueueTrackIds = [...getJukeboxQueuedTrackIds(fixture, currentState), previewSong.id];
      nextState = setJukeboxQueuedTrackIds(nextState, fixture, nextQueueTrackIds);

      return {
        logEntry: createLogEntry(`The ${fixture.displayName.toLowerCase()} accepts ${formatJukeboxPriceText(songPriceDollars)} and adds ${formatJukeboxSongText(previewSong)} to the queue.`, undefined, undefined, 'recent'),
        sessionState: nextState,
        fixtureInteractionStateById: nextFixtureInteractionStateById,
      };
    }

    nextState = setJukeboxTrack(nextState, fixture, previewSong, nowMs, 'paid');

    return {
      logEntry: createLogEntry(
        currentTrackMode === 'autoplay'
          ? `The ${fixture.displayName.toLowerCase()} drops its motion-sensing fallback and switches to ${formatJukeboxSongText(previewSong)}.`
          : `The ${fixture.displayName.toLowerCase()} accepts ${formatJukeboxPriceText(songPriceDollars)} and starts ${formatJukeboxSongText(previewSong)}.`,
        undefined,
        undefined,
        'recent',
      ),
      sessionState: nextState,
      fixtureInteractionStateById: nextFixtureInteractionStateById,
    };
  }

  return {
    fixtureInteractionStateById: setFixtureFocused(currentFixtureInteractionStateById, fixture, false),
  };
}

function createFixtureActionId(
  fixtureId: string,
  command: 'step_away' | 'swipe_left' | 'swipe_right' | 'view_queue' | 'add_fake_money' | 'queue_song',
): string {
  return `fixture:${fixtureId}:${command}`;
}

function parseFixtureActionId(
  actionId: string,
): { fixtureId: string; command: 'step_away' | 'swipe_left' | 'swipe_right' | 'view_queue' | 'add_fake_money' | 'queue_song' } | undefined {
  const match = /^fixture:(.+):(step_away|swipe_left|swipe_right|view_queue|add_fake_money|queue_song)$/.exec(actionId);

  if (!match) {
    return undefined;
  }

  return {
    fixtureId: match[1],
    command: match[2] as 'step_away' | 'swipe_left' | 'swipe_right' | 'view_queue' | 'add_fake_money' | 'queue_song',
  };
}

function getFixtureStateId(fixture: FixtureReference): string {
  return fixture.stateId ?? fixture.id;
}

function getFixtureInteractionState(
  fixture: FixtureReference,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): RuntimeFixtureInteractionState {
  return fixtureInteractionStateById?.[getFixtureStateId(fixture)] ?? {};
}

function setFixtureInteractionState(
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
  fixture: FixtureReference,
  state: RuntimeFixtureInteractionState,
): RuntimeFixtureInteractionStateById {
  return {
    ...(fixtureInteractionStateById ?? {}),
    [getFixtureStateId(fixture)]: state,
  };
}

function isFixtureFocused(
  fixture: FixtureReference,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): boolean {
  return getFixtureInteractionState(fixture, fixtureInteractionStateById).focused === true;
}

function getJukeboxCurrentTrackId(fixture: FixtureReference, sessionState: RuntimeSessionState): string | undefined {
  const value = getRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.currentTrack`);

  return typeof value === 'string' && value.length > 0 && value !== 'none'
    ? value
    : undefined;
}

function getJukeboxCurrentTrackLabel(fixture: FixtureReference, sessionState: RuntimeSessionState): string | undefined {
  const value = getRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.currentTrackLabel`);

  return typeof value === 'string' && value.length > 0
    ? value
    : undefined;
}

function setFixtureFocused(
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
  fixture: FixtureReference,
  focused: boolean,
): RuntimeFixtureInteractionStateById {
  return setFixtureInteractionState(fixtureInteractionStateById, fixture, {
    ...getFixtureInteractionState(fixture, fixtureInteractionStateById),
    focused,
  });
}

function setJukeboxTrack(
  sessionState: RuntimeSessionState,
  fixture: FixtureReference,
  song: JukeboxCatalogSong,
  startedAtMs: number,
  trackMode: 'autoplay' | 'paid',
): RuntimeSessionState {
  let nextState = sessionState;
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrack`, song.id);
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrackLabel`, createJukeboxSongLabel(song));
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrackMode`, trackMode);
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrackStartedAtMs`, startedAtMs);
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrackEndsAtMs`, startedAtMs + song.approxDurationSeconds * 1000);
  return nextState;
}

function clearJukeboxTrack(
  sessionState: RuntimeSessionState,
  fixture: FixtureReference,
): RuntimeSessionState {
  let nextState = sessionState;
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrack`, 'none');
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrackLabel`, '');
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrackMode`, '');
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrackStartedAtMs`, 0);
  nextState = setRuntimeSessionValue(nextState, `objects.${getFixtureStateId(fixture)}.currentTrackEndsAtMs`, 0);
  return nextState;
}

function createJukeboxSongLabel(song: JukeboxCatalogSong): string {
  return `${song.title} by ${song.artist}`;
}

function getJukeboxSongPriceDollars(song: JukeboxCatalogSong | undefined): number {
  return song ? JUKEBOX_DEFAULT_TRACK_PRICE_DOLLARS : JUKEBOX_DEFAULT_TRACK_PRICE_DOLLARS;
}

function formatJukeboxPriceText(priceDollars: number): string {
  return `$${priceDollars.toFixed(2)}`;
}

function formatJukeboxDurationText(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function resolveRuntimeSystemNowMs(systemContext: RuntimeSystemContext | undefined): number {
  return typeof systemContext?.clock?.nowMs === 'number'
    ? systemContext.clock.nowMs
    : Date.now();
}

function formatJukeboxSongText(song: JukeboxCatalogSong): string {
  return `**${song.title}** by ${song.artist}`;
}

function getJukeboxCatalogSongById(
  fixture: FixtureReference,
  songId: string,
): JukeboxCatalogSong | undefined {
  return getJukeboxCatalogSongs(fixture).find((song) => song.id === songId);
}

function getJukeboxCurrentTrackText(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
): string | undefined {
  const currentTrack = getJukeboxCurrentTrackId(fixture, sessionState);

  if (currentTrack) {
    const song = getJukeboxCatalogSongById(fixture, currentTrack);

    if (song) {
      return formatJukeboxSongText(song);
    }
  }

  const currentTrackLabel = getJukeboxCurrentTrackLabel(fixture, sessionState);
  return currentTrackLabel ? `**${currentTrackLabel}**` : undefined;
}

function getJukeboxTrackMode(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
): 'autoplay' | 'paid' | undefined {
  const value = getRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.currentTrackMode`);
  return value === 'autoplay' || value === 'paid' ? value : undefined;
}

function getJukeboxTrackStartedAtMs(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
): number | undefined {
  const value = getRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.currentTrackStartedAtMs`);
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function getJukeboxTrackEndsAtMs(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
): number | undefined {
  const value = getRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.currentTrackEndsAtMs`);
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function getJukeboxAutoplaySong(fixture: FixtureReference): JukeboxCatalogSong | undefined {
  return getJukeboxCatalogSongById(fixture, JUKEBOX_AUTOPLAY_TRACK_ID)
    ?? getJukeboxCatalogSongs(fixture)[0];
}

function reconcileJukeboxPlayback(
  sessionState: RuntimeSessionState,
  fixture: FixtureReference,
  nowMs: number,
): RuntimeSessionState {
  let nextSessionState = sessionState;
  let currentTrackId = getJukeboxCurrentTrackId(fixture, nextSessionState);
  let currentTrackEndsAtMs = getJukeboxTrackEndsAtMs(fixture, nextSessionState);
  let guard = 0;

  while (currentTrackId && typeof currentTrackEndsAtMs === 'number' && currentTrackEndsAtMs <= nowMs && guard < 32) {
    const queuedTrackIds = getJukeboxQueuedTrackIds(fixture, nextSessionState);
    const nextQueuedTrackId = queuedTrackIds[0];

    if (!nextQueuedTrackId) {
      nextSessionState = clearJukeboxTrack(nextSessionState, fixture);
      break;
    }

    const nextSong = getJukeboxCatalogSongById(fixture, nextQueuedTrackId);
    nextSessionState = setJukeboxQueuedTrackIds(nextSessionState, fixture, queuedTrackIds.slice(1));

    if (!nextSong) {
      nextSessionState = clearJukeboxTrack(nextSessionState, fixture);
      currentTrackId = undefined;
      currentTrackEndsAtMs = undefined;
      guard += 1;
      continue;
    }

    nextSessionState = setJukeboxTrack(nextSessionState, fixture, nextSong, currentTrackEndsAtMs, 'paid');
    currentTrackId = nextSong.id;
    currentTrackEndsAtMs = getJukeboxTrackEndsAtMs(fixture, nextSessionState);
    guard += 1;
  }

  return nextSessionState;
}

function getJukeboxCatalogSongs(fixture: FixtureReference): JukeboxCatalogSong[] {
  return fixture.catalogId ? (JUKEBOX_CATALOGS[fixture.catalogId] ?? []) : [];
}

function getJukeboxMaxQueueLength(fixture: FixtureReference): number {
  return typeof fixture.maxQueueLength === 'number' && Number.isFinite(fixture.maxQueueLength) && fixture.maxQueueLength > 0
    ? Math.floor(fixture.maxQueueLength)
    : JUKEBOX_DEFAULT_MAX_QUEUE_LENGTH;
}

function isJukeboxQueueFull(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  currentTrackId: string | undefined,
  currentTrackMode: 'autoplay' | 'paid' | undefined,
): boolean {
  if (!currentTrackId || currentTrackMode === 'autoplay') {
    return false;
  }

  return getJukeboxQueuedTrackIds(fixture, sessionState).length >= getJukeboxMaxQueueLength(fixture);
}

function getJukeboxBrowseIndex(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): number {
  const songCount = getJukeboxCatalogSongs(fixture).length;
  const privateBrowseIndex = getFixtureInteractionState(fixture, fixtureInteractionStateById).browseIndex;
  const value = typeof privateBrowseIndex === 'number'
    ? privateBrowseIndex
    : getRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.browseIndex`);
  const normalizedValue = typeof value === 'number' ? Math.floor(value) : 0;

  if (songCount <= 0) {
    return 0;
  }

  return ((normalizedValue % songCount) + songCount) % songCount;
}

function setJukeboxBrowseIndex(
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
  fixture: FixtureReference,
  browseIndex: number,
): RuntimeFixtureInteractionStateById {
  return setFixtureInteractionState(fixtureInteractionStateById, fixture, {
    ...getFixtureInteractionState(fixture, fixtureInteractionStateById),
    browseIndex,
  });
}

function getJukeboxQueuedTrackIds(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
): string[] {
  const value = getRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.queueTrackIds`);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function setJukeboxQueuedTrackIds(
  sessionState: RuntimeSessionState,
  fixture: FixtureReference,
  queueTrackIds: string[],
): RuntimeSessionState {
  return setRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.queueTrackIds`, queueTrackIds);
}

function getJukeboxFakeCreditCount(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): number {
  const privateFakeCredits = getFixtureInteractionState(fixture, fixtureInteractionStateById).fakeCredits;
  const value = typeof privateFakeCredits === 'number'
    ? privateFakeCredits
    : getRuntimeSessionValue(sessionState, `objects.${getFixtureStateId(fixture)}.fakeCredits`);

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function setJukeboxFakeCreditCount(
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
  fixture: FixtureReference,
  fakeCredits: number,
): RuntimeFixtureInteractionStateById {
  return setFixtureInteractionState(fixtureInteractionStateById, fixture, {
    ...getFixtureInteractionState(fixture, fixtureInteractionStateById),
    fakeCredits: Math.max(0, Math.floor(fakeCredits)),
  });
}

function getJukeboxPreviewSong(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): JukeboxCatalogSong | undefined {
  const songs = getJukeboxCatalogSongs(fixture);

  if (songs.length === 0) {
    return undefined;
  }

  return songs[getJukeboxBrowseIndex(fixture, sessionState, fixtureInteractionStateById)];
}

function createFixturePanelParagraph(text: string): ProjectedProseBlock {
  return {
    kind: 'paragraph',
    text,
  };
}

function createJukeboxFixturePanel(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): ProjectedFixturePanel {
  const previewSong = getJukeboxPreviewSong(fixture, sessionState, fixtureInteractionStateById);
  const browseIndex = getJukeboxBrowseIndex(fixture, sessionState, fixtureInteractionStateById);
  const marqueeText = previewSong?.marqueeTexts[browseIndex % previewSong.marqueeTexts.length] ?? previewSong?.marqueeTexts[0];
  const flavorText = previewSong?.flavorTexts[browseIndex % previewSong.flavorTexts.length] ?? previewSong?.flavorTexts[0];
  const currentTrackText = getJukeboxCurrentTrackText(fixture, sessionState);
  const currentTrackId = getJukeboxCurrentTrackId(fixture, sessionState);
  const currentTrackSong = currentTrackId ? getJukeboxCatalogSongById(fixture, currentTrackId) : undefined;
  const currentTrackMode = getJukeboxTrackMode(fixture, sessionState);
  const currentTrackEndsAtMs = getJukeboxTrackEndsAtMs(fixture, sessionState);
  const currentTrackNowMs = getRuntimeClockSnapshotFromSessionState(sessionState)?.nowMs ?? Date.now();
  const currentTrackTimeLeftSeconds = typeof currentTrackEndsAtMs === 'number'
    ? Math.max(0, Math.ceil((currentTrackEndsAtMs - currentTrackNowMs) / 1000))
    : undefined;
  const queuedSongs = getJukeboxQueuedTrackIds(fixture, sessionState)
    .map((songId) => getJukeboxCatalogSongById(fixture, songId))
    .filter((song): song is JukeboxCatalogSong => Boolean(song));
  const fakeCredits = getJukeboxFakeCreditCount(fixture, sessionState, fixtureInteractionStateById);

  return {
    id: fixture.id,
    title: fixture.displayName,
    subtitle: 'Private fixture shell',
    sections: [
      {
        id: 'selected',
        title: 'Selected',
        blocks: previewSong
          ? [
              createFixturePanelParagraph(`Selected: ${formatJukeboxSongText(previewSong)}. Price: ${formatJukeboxPriceText(getJukeboxSongPriceDollars(previewSong))}. Duration: ${formatJukeboxDurationText(previewSong.approxDurationSeconds)}.`),
              createFixturePanelParagraph(`${previewSong.approxDurationText}. Vibe: ${previewSong.vibe}.`),
              ...(marqueeText ? [createFixturePanelParagraph(marqueeText)] : []),
              ...(flavorText ? [createFixturePanelParagraph(flavorText)] : []),
            ]
          : [createFixturePanelParagraph(`Selected: ${fixture.displayName} has no highlighted song yet.`)],
      },
      {
        id: 'now-playing',
        title: 'Now Playing',
        blocks: [createFixturePanelParagraph(
          currentTrackText && currentTrackSong
            ? `Now Playing: ${currentTrackText}. ${currentTrackMode === 'autoplay' ? 'Mode: motion-sensing autoplay.' : 'Mode: paid selection.'}${typeof currentTrackTimeLeftSeconds === 'number' ? ` Time left: ${formatJukeboxDurationText(currentTrackTimeLeftSeconds)}.` : ''}`
            : 'Now Playing: nothing yet.',
        )],
      },
      {
        id: 'queue',
        title: 'Queue',
        blocks: queuedSongs.length > 0
          ? queuedSongs.map((song, index) => createFixturePanelParagraph(`${index + 1}. ${formatJukeboxSongText(song)}. ${formatJukeboxPriceText(getJukeboxSongPriceDollars(song))}. ${formatJukeboxDurationText(song.approxDurationSeconds)}.`))
          : [createFixturePanelParagraph('Queue: empty right now.')],
      },
      {
        id: 'credits',
        title: 'Credits',
        blocks: [createFixturePanelParagraph(`Fake credits ready: ${formatJukeboxPriceText(fakeCredits)}.`)],
      },
    ],
  };
}

function getJukeboxPreviewLogScope(fixture: FixtureReference): string {
  return `fixture-preview:${fixture.id}`;
}

function createJukeboxPreviewLogEntry(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): ProjectedLogEntry {
  const song = getJukeboxPreviewSong(fixture, sessionState, fixtureInteractionStateById);

  if (!song) {
    return createLogEntry(`${fixture.displayName} has nothing queued in the catalog yet.`, undefined, undefined, 'recent');
  }

  const browseIndex = getJukeboxBrowseIndex(fixture, sessionState, fixtureInteractionStateById);
  const marqueeText = song.marqueeTexts[browseIndex % song.marqueeTexts.length] ?? song.marqueeTexts[0];
  const flavorText = song.flavorTexts[browseIndex % song.flavorTexts.length] ?? song.flavorTexts[0];

  return {
    ...createLogEntry(`${formatJukeboxSongText(song)}.`, undefined, [
      {
        groupId: 'jukebox-preview',
        kind: 'paragraph',
        text: `${formatJukeboxSongText(song)}.`,
      },
      {
        groupId: 'jukebox-preview',
        kind: 'paragraph',
        text: `${song.approxDurationText}. Price: ${formatJukeboxPriceText(getJukeboxSongPriceDollars(song))}. Vibe: ${song.vibe}.`,
      },
      {
        groupId: 'jukebox-preview',
        kind: 'paragraph',
        text: marqueeText,
      },
      {
        groupId: 'jukebox-preview',
        kind: 'paragraph',
        text: flavorText,
      },
    ], 'recent'),
    scope: getJukeboxPreviewLogScope(fixture),
  };
}

function createJukeboxQueueLogEntry(
  fixture: FixtureReference,
  sessionState: RuntimeSessionState,
  fixtureInteractionStateById: RuntimeFixtureInteractionStateById | undefined,
): ProjectedLogEntry {
  const previewSong = getJukeboxPreviewSong(fixture, sessionState, fixtureInteractionStateById);
  const currentTrackText = getJukeboxCurrentTrackText(fixture, sessionState);
  const currentTrackId = getJukeboxCurrentTrackId(fixture, sessionState);
  const currentTrackSong = currentTrackId ? getJukeboxCatalogSongById(fixture, currentTrackId) : undefined;
  const currentTrackMode = getJukeboxTrackMode(fixture, sessionState);
  const currentTrackEndsAtMs = getJukeboxTrackEndsAtMs(fixture, sessionState);
  const currentTrackNowMs = getRuntimeClockSnapshotFromSessionState(sessionState)?.nowMs ?? Date.now();
  const currentTrackTimeLeftSeconds = typeof currentTrackEndsAtMs === 'number'
    ? Math.max(0, Math.ceil((currentTrackEndsAtMs - currentTrackNowMs) / 1000))
    : undefined;
  const queuedSongs = getJukeboxQueuedTrackIds(fixture, sessionState)
    .map((songId) => getJukeboxCatalogSongById(fixture, songId))
    .filter((song): song is JukeboxCatalogSong => Boolean(song));
  const fakeCredits = getJukeboxFakeCreditCount(fixture, sessionState, fixtureInteractionStateById);
  const blocks: ProjectedProseBlock[] = [];

  blocks.push({
    groupId: 'jukebox-queue',
    kind: 'paragraph',
    text: previewSong
      ? `Selected: ${formatJukeboxSongText(previewSong)}. Price: ${formatJukeboxPriceText(getJukeboxSongPriceDollars(previewSong))}. Duration: ${formatJukeboxDurationText(previewSong.approxDurationSeconds)}.`
      : `Selected: ${fixture.displayName} has no highlighted song yet.`,
  });

  blocks.push({
    groupId: 'jukebox-queue',
    kind: 'paragraph',
    text: currentTrackText && currentTrackSong
      ? `Now Playing: ${currentTrackText}. ${currentTrackMode === 'autoplay' ? 'Mode: motion-sensing autoplay.' : 'Mode: paid selection.'}${typeof currentTrackTimeLeftSeconds === 'number' ? ` Time left: ${formatJukeboxDurationText(currentTrackTimeLeftSeconds)}.` : ''}`
      : 'Now Playing: nothing yet.',
  });

  if (queuedSongs.length === 0) {
    blocks.push({
      groupId: 'jukebox-queue',
      kind: 'paragraph',
      text: 'Queue: empty right now.',
    });
  } else {
    blocks.push({
      groupId: 'jukebox-queue',
      kind: 'paragraph',
      text: 'Queue:',
    });

    queuedSongs.forEach((song, index) => {
      blocks.push({
        groupId: 'jukebox-queue',
        kind: 'paragraph',
        text: `${index + 1}. ${formatJukeboxSongText(song)}. ${formatJukeboxPriceText(getJukeboxSongPriceDollars(song))}. ${formatJukeboxDurationText(song.approxDurationSeconds)}.`,
      });
    });
  }

  blocks.push({
    groupId: 'jukebox-queue',
    kind: 'paragraph',
    text: `Fake credits ready: ${formatJukeboxPriceText(fakeCredits)}.`,
  });

  return createLogEntry(blocks[0]?.text ?? `${fixture.displayName} queue.`, undefined, blocks, 'recent');
}