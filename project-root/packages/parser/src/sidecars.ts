import type {
  ContentNpcDefinition,
  ContentEventDefinition,
  EventAudienceBranch,
  EventEffectDefinition,
  EventOfferDefinition,
  NpcIdleDefinition,
  NpcIdleModeDefinition,
  NpcRouteDefinition,
  NpcRouteStepDefinition,
  NpcTextBranch,
  EventTriggerDefinition,
  PredicateReference,
  ProjectWeatherSettingsDefinition,
  ProjectTimeSettingsDefinition,
  TimeScheduleDefinition,
  TimeScheduleRepeatDefinition,
  TimeScheduleTargetDefinition,
  TimeScheduleTriggerDefinition,
  TimeScheduleWindowDefinition,
  TimeAssignmentsDefinition,
  TimeCalendarDefinition,
  TimePhaseDefinition,
  TimeVisibilityDefinition,
  WeatherAssignmentsDefinition,
  WeatherPatternDefinition,
  WeatherStepDefinition,
  WeatherVisibilityDefinition,
} from '../../schema/src';
import { parseNodeDocument } from './shared';
import type { NormalizeResult, ParsedFrontMatterObject, ParsedFrontMatterValue } from './types';

export function parseStateSidecar(source: string, sourcePath?: string): NormalizeResult<ParsedFrontMatterObject> {
  return parseObjectFrontMatter(source, sourcePath);
}

export function parseTimeSettingsSidecar(source: string, sourcePath?: string): NormalizeResult<ProjectTimeSettingsDefinition> {
  const parsed = parseObjectFrontMatter(source, sourcePath);
  const warnings = [...parsed.warnings];
  const errors = [...parsed.errors];

  if (!parsed.value || errors.length > 0) {
    return { warnings, errors };
  }

  const settingsObject = asObject(parsed.value.time) ?? parsed.value;

  return {
    value: errors.length > 0 ? undefined : {
      calendars: parseTimeCalendars(settingsObject.calendars, errors),
      assignments: parseTimeAssignments(settingsObject.assignments, errors),
      visibility: parseTimeVisibility(settingsObject.visibility, errors),
      schedules: parseTimeSchedules(settingsObject.schedules, errors),
    },
    warnings,
    errors,
  };
}

export function parseWeatherSettingsSidecar(source: string, sourcePath?: string): NormalizeResult<ProjectWeatherSettingsDefinition> {
  const parsed = parseObjectFrontMatter(source, sourcePath);
  const warnings = [...parsed.warnings];
  const errors = [...parsed.errors];

  if (!parsed.value || errors.length > 0) {
    return { warnings, errors };
  }

  const settingsObject = asObject(parsed.value.weather) ?? parsed.value;

  return {
    value: errors.length > 0 ? undefined : {
      patterns: parseWeatherPatterns(settingsObject.patterns, errors),
      assignments: parseWeatherAssignments(settingsObject.assignments, errors),
      visibility: parseWeatherVisibility(settingsObject.visibility, errors),
    },
    warnings,
    errors,
  };
}

export function parsePredicateSidecar(
  source: string,
  sourcePath?: string,
): NormalizeResult<Record<string, ParsedFrontMatterObject>> {
  const parsed = parseObjectFrontMatter(source, sourcePath);

  if (!parsed.value) {
    return parsed;
  }

  const predicateEntries = asObject(parsed.value.predicates);

  if (!predicateEntries) {
    return {
      value: {},
      warnings: parsed.warnings,
      errors: parsed.errors,
    };
  }

  const errors = [...parsed.errors];
  const value = Object.entries(predicateEntries).reduce<Record<string, ParsedFrontMatterObject>>((accumulator, [predicateId, rawDefinition]) => {
    const definition = asObject(rawDefinition);

    if (!definition) {
      errors.push({ message: `Expected object definition for predicate ${predicateId}.` });
      return accumulator;
    }

    accumulator[predicateId] = definition;
    return accumulator;
  }, {});

  return {
    value: errors.length > 0 ? undefined : value,
    warnings: parsed.warnings,
    errors,
  };
}

export function parseNpcPredicateDefinitions(
  source: string,
  sourcePath?: string,
): NormalizeResult<Record<string, ParsedFrontMatterObject>> {
  return parsePredicateSidecar(source, sourcePath);
}

export function parseEventSidecar(source: string, sourcePath?: string): NormalizeResult<ContentEventDefinition[]> {
  const parsed = parseObjectFrontMatter(source, sourcePath);
  const warnings = [...parsed.warnings];
  const errors = [...parsed.errors];

  if (!parsed.value || errors.length > 0) {
    return { warnings, errors };
  }

  const eventsObject = asObject(parsed.value.events);

  if (!eventsObject) {
    errors.push({ message: 'Expected events object.' });
    return { warnings, errors };
  }

  const value = Object.entries(eventsObject).flatMap(([eventId, rawEvent]) => {
    const parsedEvent = parseEventDefinition(eventId, rawEvent, sourcePath, errors);
    return parsedEvent ? [parsedEvent] : [];
  });

  return {
    value: errors.length > 0 ? undefined : value,
    warnings,
    errors,
  };
}

function parseEventDefinition(
  eventId: string,
  value: ParsedFrontMatterValue,
  sourcePath: string | undefined,
  errors: NormalizeResult<ContentEventDefinition[]>['errors'],
): ContentEventDefinition | undefined {
  const eventObject = asObject(value);

  if (!eventObject) {
    errors.push({ message: `Expected object for event ${eventId}.` });
    return undefined;
  }

  const trigger = parseEventTrigger(eventObject.trigger, eventId, errors);
  const when = parsePredicateReference(eventObject.when, `event ${eventId} when`, errors);
  const actor = parseRequiredEventBranch(eventObject.actor, `event ${eventId} actor`, errors);

  if (!trigger) {
    return undefined;
  }

  if (!actor) {
    return undefined;
  }

  return {
    id: eventId,
    trigger,
    lane: parseEventLane(eventObject.lane, eventId, errors),
    when,
    actor,
    private: parseEventBranch(eventObject.private, `event ${eventId} private`, errors),
    witnesses: parseEventBranch(eventObject.witnesses, `event ${eventId} witnesses`, errors),
    offer: parseEventOffer(eventObject.offer, eventId, errors),
    effects: parseEffects(eventObject.effects, eventId, errors),
    sourcePath,
  };
}

function parseEventLane(
  value: ParsedFrontMatterValue | undefined,
  eventId: string,
  errors: NormalizeResult<ContentEventDefinition[]>['errors'],
): 'visible' | 'recent' | undefined {
  if (value === undefined) {
    return undefined;
  }

  const lane = asString(value);

  if (lane === 'visible' || lane === 'recent') {
    return lane;
  }

  errors.push({ message: `Expected lane to be visible or recent for event ${eventId}.` });
  return undefined;
}

function parseEventOffer(
  value: ParsedFrontMatterValue | undefined,
  eventId: string,
  errors: NormalizeResult<ContentEventDefinition[]>['errors'],
): EventOfferDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: `Expected offer object for event ${eventId}.` });
    return undefined;
  }

  const label = asString(objectValue.label);

  if (!label) {
    errors.push({ message: `Expected offer.label for event ${eventId}.` });
    return undefined;
  }

  return {
    label,
    key: asString(objectValue.key),
    meta: asString(objectValue.meta),
  };
}

function parseEventTrigger(
  value: ParsedFrontMatterValue | undefined,
  eventId: string,
  errors: NormalizeResult<ContentEventDefinition[]>['errors'],
): EventTriggerDefinition | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: `Expected trigger object for event ${eventId}.` });
    return undefined;
  }

  const kind = asString(objectValue.kind);
  const actor = asString(objectValue.actor);
  const nodeId = asString(objectValue.nodeId);

  if (!kind || !actor || !nodeId) {
    errors.push({ message: `Expected trigger.kind, trigger.actor, and trigger.nodeId for event ${eventId}.` });
    return undefined;
  }

  return {
    kind,
    actor,
    nodeId,
    poiId: asString(objectValue.poiId),
    choiceId: asString(objectValue.choiceId),
    exitId: asString(objectValue.exitId),
  };
}

function parsePredicateReference(
  value: ParsedFrontMatterValue | undefined,
  label: string,
  errors: NormalizeResult<ContentEventDefinition[]>['errors'],
): PredicateReference | undefined {
  if (value === undefined) {
    return undefined;
  }

  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: `Expected predicate object for ${label}.` });
    return undefined;
  }

  const predicate = asString(objectValue.predicate);

  if (!predicate) {
    errors.push({ message: `Expected predicate string for ${label}.` });
    return undefined;
  }

  return { predicate };
}

function parseRequiredEventBranch(
  value: ParsedFrontMatterValue | undefined,
  label: string,
  errors: NormalizeResult<ContentEventDefinition[]>['errors'],
): EventAudienceBranch | undefined {
  if (Array.isArray(value)) {
    const text = asStringArray(value);

    if (!text || text.length === 0) {
      errors.push({ message: `Expected text array for ${label}.` });
      return undefined;
    }

    return { text };
  }

  return parseEventBranch(value, label, errors);
}

function parseEventBranch(
  value: ParsedFrontMatterValue | undefined,
  label: string,
  errors: NormalizeResult<ContentEventDefinition[]>['errors'],
): EventAudienceBranch | undefined {
  if (value === undefined) {
    return undefined;
  }

  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: `Expected object for ${label}.` });
    return undefined;
  }

  const text = asStringArray(objectValue.text);

  if (!text || text.length === 0) {
    errors.push({ message: `Expected text array for ${label}.` });
    return undefined;
  }

  return {
    when: parsePredicateReference(objectValue.when, label, errors),
    text,
  };
}


  function parseOptionalAudienceBranch(
    value: ParsedFrontMatterValue | undefined,
    label: string,
    errors: Array<{ message: string }>,
  ): EventAudienceBranch | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (Array.isArray(value)) {
      const text = asStringArray(value);

      if (!text || text.length === 0) {
        errors.push({ message: `Expected text array for ${label}.` });
        return undefined;
      }

      return { text };
    }

    return parseEventBranch(value, label, errors);
  }
function parseEffects(
  value: ParsedFrontMatterValue | undefined,
  eventId: string,
  errors: NormalizeResult<ContentEventDefinition[]>['errors'],
): EventEffectDefinition[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    errors.push({ message: `Expected effects array for event ${eventId}.` });
    return undefined;
  }

  return value.flatMap((entry) => {
    const objectValue = asObject(entry);

    if (!objectValue) {
      errors.push({ message: `Expected object entries inside effects for event ${eventId}.` });
      return [];
    }

    const [[kind, rawArgs] = []] = Object.entries(objectValue);

    if (!kind) {
      errors.push({ message: `Expected effect kind for event ${eventId}.` });
      return [];
    }

    const args = normalizeEffectArgs(rawArgs);

    return [{
      kind,
      args: args.filter(isScalar),
    }];
  });
}

function parseTimeCalendars(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): Record<string, TimeCalendarDefinition> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const calendarsObject = asObject(value);

  if (!calendarsObject) {
    errors.push({ message: 'Expected calendars object for time settings.' });
    return undefined;
  }

  return Object.entries(calendarsObject).reduce<Record<string, TimeCalendarDefinition>>((accumulator, [calendarId, rawCalendar]) => {
    const calendarObject = asObject(rawCalendar);

    if (!calendarObject) {
      errors.push({ message: `Expected object definition for calendar ${calendarId}.` });
      return accumulator;
    }

    accumulator[calendarId] = {
      preset: asString(calendarObject.preset),
      epoch: asString(calendarObject.epoch),
      minutesPerCycle: asNumber(calendarObject.minutesPerCycle),
      minutesPerPhase: asNumber(calendarObject.minutesPerPhase),
      phases: parseTimePhases(calendarObject.phases, calendarId, errors),
    };
    return accumulator;
  }, {});
}

function parseTimePhases(
  value: ParsedFrontMatterValue | undefined,
  calendarId: string,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): TimePhaseDefinition[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    errors.push({ message: `Expected phases array for calendar ${calendarId}.` });
    return undefined;
  }

  return value.flatMap((entry, index) => {
    const phaseObject = asObject(entry);

    if (!phaseObject) {
      errors.push({ message: `Expected object definition for calendar ${calendarId} phase ${index + 1}.` });
      return [];
    }

    const id = asString(phaseObject.id);

    if (!id) {
      errors.push({ message: `Expected phase id for calendar ${calendarId} phase ${index + 1}.` });
      return [];
    }

    return [{
      id,
      label: asString(phaseObject.label),
      durationMinutes: asNumber(phaseObject.durationMinutes),
      groups: asStringArray(phaseObject.groups),
      statusText: asStringArray(phaseObject.statusText),
    }];
  });
}

function parseTimeSchedules(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): Record<string, TimeScheduleDefinition> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const schedulesObject = asObject(value);

  if (!schedulesObject) {
    errors.push({ message: 'Expected schedules object for time settings.' });
    return undefined;
  }

  return Object.entries(schedulesObject).reduce<Record<string, TimeScheduleDefinition>>((accumulator, [scheduleId, rawSchedule]) => {
    const scheduleObject = asObject(rawSchedule);

    if (!scheduleObject) {
      errors.push({ message: `Expected object definition for schedule ${scheduleId}.` });
      return accumulator;
    }

    const trigger = parseTimeScheduleTrigger(scheduleObject.trigger, `schedule ${scheduleId}`, errors);

    if (!trigger) {
      return accumulator;
    }

    accumulator[scheduleId] = {
      description: asString(scheduleObject.description),
      trigger,
      when: parsePredicateReference(scheduleObject.when, `schedule ${scheduleId} when`, errors),
      repeat: parseTimeScheduleRepeat(scheduleObject.repeat, scheduleId, errors),
      activeWindow: parseTimeScheduleWindow(scheduleObject.activeWindow, scheduleId, errors),
      target: parseTimeScheduleTarget(scheduleObject.target, scheduleId, errors),
        actor: parseOptionalAudienceBranch(scheduleObject.actor, `schedule ${scheduleId} actor`, errors),
      lane: parseEventLane(scheduleObject.lane, scheduleId, errors),
      effects: parseEffects(scheduleObject.effects, scheduleId, errors),
    };
    return accumulator;
  }, {});
}

function parseTimeScheduleTrigger(
  value: ParsedFrontMatterValue | undefined,
  label: string,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): TimeScheduleTriggerDefinition | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: `Expected trigger object for ${label}.` });
    return undefined;
  }

  const kind = asString(objectValue.kind);

  if (kind !== 'phase' && kind !== 'condition' && kind !== 'elapsed' && kind !== 'clock') {
    errors.push({ message: `Expected trigger.kind to be phase, condition, elapsed, or clock for ${label}.` });
    return undefined;
  }

  return {
    kind,
    phaseId: asString(objectValue.phaseId),
    phaseGroup: asString(objectValue.phaseGroup),
    edge: parseTimeScheduleTriggerEdge(objectValue.edge, label, errors),
    predicate: parsePredicateReference(objectValue.predicate ?? objectValue.when, `${label} trigger`, errors),
    scheduleId: asString(objectValue.scheduleId),
    minutes: asNumber(objectValue.minutes),
  };
}

function parseTimeScheduleTriggerEdge(
  value: ParsedFrontMatterValue | undefined,
  label: string,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): 'enter' | 'exit' | undefined {
  if (value === undefined) {
    return undefined;
  }

  const edge = asString(value);

  if (edge === 'enter' || edge === 'exit') {
    return edge;
  }

  errors.push({ message: `Expected trigger.edge to be enter or exit for ${label}.` });
  return undefined;
}

function parseTimeScheduleRepeat(
  value: ParsedFrontMatterValue | undefined,
  scheduleId: string,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): TimeScheduleRepeatDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const repeatObject = asObject(value);

  if (!repeatObject) {
    errors.push({ message: `Expected repeat object for schedule ${scheduleId}.` });
    return undefined;
  }

  return {
    everyMinutes: asNumber(repeatObject.everyMinutes),
    count: asNumber(repeatObject.count),
  };
}

function parseTimeScheduleWindow(
  value: ParsedFrontMatterValue | undefined,
  scheduleId: string,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): TimeScheduleWindowDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const windowObject = asObject(value);

  if (!windowObject) {
    errors.push({ message: `Expected activeWindow object for schedule ${scheduleId}.` });
    return undefined;
  }

  return {
      start: windowObject.start === undefined
        ? undefined
        : parseTimeScheduleTrigger(windowObject.start, `schedule ${scheduleId} activeWindow.start`, errors),
      stop: windowObject.stop === undefined
        ? undefined
        : parseTimeScheduleTrigger(windowObject.stop, `schedule ${scheduleId} activeWindow.stop`, errors),
  };
}

function parseTimeScheduleTarget(
  value: ParsedFrontMatterValue | undefined,
  scheduleId: string,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): TimeScheduleTargetDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const targetObject = asObject(value);

  if (!targetObject) {
    errors.push({ message: `Expected target object for schedule ${scheduleId}.` });
    return undefined;
  }

  return {
    nodes: asStringArray(targetObject.nodes),
    folders: asStringArray(targetObject.folders),
    regions: asStringArray(targetObject.regions),
    tags: asStringArray(targetObject.tags),
  };
}

function parseTimeAssignments(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): TimeAssignmentsDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const assignmentsObject = asObject(value);

  if (!assignmentsObject) {
    errors.push({ message: 'Expected assignments object for time settings.' });
    return undefined;
  }

  return {
    defaultCalendar: asString(assignmentsObject.defaultCalendar),
    folders: asStringRecord(assignmentsObject.folders, 'assignments.folders', errors),
    regions: asStringRecord(assignmentsObject.regions, 'assignments.regions', errors),
    nodes: asStringRecord(assignmentsObject.nodes, 'assignments.nodes', errors),
  };
}

function parseTimeVisibility(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): TimeVisibilityDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const visibilityObject = asObject(value);

  if (!visibilityObject) {
    errors.push({ message: 'Expected visibility object for time settings.' });
    return undefined;
  }

  return {
    defaultRecentLog: asBoolean(visibilityObject.defaultRecentLog),
    folders: asBooleanRecord(visibilityObject.folders, 'time.visibility.folders', errors),
    regions: asBooleanRecord(visibilityObject.regions, 'time.visibility.regions', errors),
    nodes: asBooleanRecord(visibilityObject.nodes, 'time.visibility.nodes', errors),
  };
}

function parseWeatherPatterns(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ProjectWeatherSettingsDefinition>['errors'],
): Record<string, WeatherPatternDefinition> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const patternsObject = asObject(value);

  if (!patternsObject) {
    errors.push({ message: 'Expected patterns object for weather settings.' });
    return undefined;
  }

  return Object.entries(patternsObject).reduce<Record<string, WeatherPatternDefinition>>((accumulator, [patternId, rawPattern]) => {
    const patternObject = asObject(rawPattern);

    if (!patternObject) {
      errors.push({ message: `Expected object definition for weather pattern ${patternId}.` });
      return accumulator;
    }

    accumulator[patternId] = {
      epoch: asString(patternObject.epoch),
      minutesPerStep: asNumber(patternObject.minutesPerStep),
      steps: parseWeatherSteps(patternObject.steps, patternId, errors),
    };
    return accumulator;
  }, {});
}

function parseWeatherSteps(
  value: ParsedFrontMatterValue | undefined,
  patternId: string,
  errors: NormalizeResult<ProjectWeatherSettingsDefinition>['errors'],
): WeatherStepDefinition[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    errors.push({ message: `Expected steps array for weather pattern ${patternId}.` });
    return undefined;
  }

  return value.flatMap((entry, index) => {
    const stepObject = asObject(entry);

    if (!stepObject) {
      errors.push({ message: `Expected object definition for weather pattern ${patternId} step ${index + 1}.` });
      return [];
    }

    const kind = asString(stepObject.kind);

    if (!kind) {
      errors.push({ message: `Expected kind for weather pattern ${patternId} step ${index + 1}.` });
      return [];
    }

    return [{
      id: asString(stepObject.id),
      kind,
      intensity: asString(stepObject.intensity),
      durationMinutes: asNumber(stepObject.durationMinutes),
      statusText: asStringArray(stepObject.statusText),
    }];
  });
}

function parseWeatherAssignments(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ProjectWeatherSettingsDefinition>['errors'],
): WeatherAssignmentsDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const assignmentsObject = asObject(value);

  if (!assignmentsObject) {
    errors.push({ message: 'Expected assignments object for weather settings.' });
    return undefined;
  }

  return {
    defaultPattern: asString(assignmentsObject.defaultPattern),
    regions: asStringRecord(assignmentsObject.regions, 'weather.assignments.regions', errors),
    nodes: asStringRecord(assignmentsObject.nodes, 'weather.assignments.nodes', errors),
  };
}

function parseWeatherVisibility(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ProjectWeatherSettingsDefinition>['errors'],
): WeatherVisibilityDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const visibilityObject = asObject(value);

  if (!visibilityObject) {
    errors.push({ message: 'Expected visibility object for weather settings.' });
    return undefined;
  }

  return {
    defaultRecentLog: asBoolean(visibilityObject.defaultRecentLog),
    regions: asBooleanRecord(visibilityObject.regions, 'weather.visibility.regions', errors),
    nodes: asBooleanRecord(visibilityObject.nodes, 'weather.visibility.nodes', errors),
  };
}

function asStringRecord(
  value: ParsedFrontMatterValue | undefined,
  label: string,
  errors: NormalizeResult<ProjectTimeSettingsDefinition>['errors'],
): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: `Expected object for ${label}.` });
    return undefined;
  }

  return Object.entries(objectValue).reduce<Record<string, string>>((accumulator, [key, rawValue]) => {
    const stringValue = asString(rawValue);

    if (!stringValue) {
      errors.push({ message: `Expected string value for ${label}.${key}.` });
      return accumulator;
    }

    accumulator[key] = stringValue;
    return accumulator;
  }, {});
}

function normalizeEffectArgs(value: ParsedFrontMatterValue): ParsedFrontMatterValue[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [value];
  }

  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith('[') || !trimmedValue.endsWith(']')) {
    return [value];
  }

  return trimmedValue
    .slice(1, -1)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => parseInlineScalarToken(part));
}

function parseInlineScalarToken(token: string): ParsedFrontMatterValue {
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

function isScalar(value: ParsedFrontMatterValue): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function asObject(value: ParsedFrontMatterValue | undefined): ParsedFrontMatterObject | undefined {
  return value && !Array.isArray(value) && typeof value === 'object' ? value as ParsedFrontMatterObject : undefined;
}

function asString(value: ParsedFrontMatterValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: ParsedFrontMatterValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function asBoolean(value: ParsedFrontMatterValue | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: ParsedFrontMatterValue | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.every((item) => typeof item === 'string') ? value as string[] : undefined;
}

function asBooleanRecord(
  value: ParsedFrontMatterValue | undefined,
  label: string,
  errors: Array<{ message: string }>,
): Record<string, boolean> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: `Expected object for ${label}.` });
    return undefined;
  }

  return Object.entries(objectValue).reduce<Record<string, boolean>>((accumulator, [key, rawValue]) => {
    const booleanValue = asBoolean(rawValue);

    if (booleanValue === undefined) {
      errors.push({ message: `Expected boolean value for ${label}.${key}.` });
      return accumulator;
    }

    accumulator[key] = booleanValue;
    return accumulator;
  }, {});
}

function parseObjectFrontMatter(source: string, sourcePath?: string): NormalizeResult<ParsedFrontMatterObject> {
  const parsed = parseNodeDocument(`---\n${source.trim()}\n---`, 'area', sourcePath);
  const warnings = [...parsed.warnings];
  const errors = [...parsed.errors];

  if (!parsed.document || errors.length > 0) {
    return { warnings, errors };
  }

  return {
    value: parsed.document.frontMatter,
    warnings,
    errors,
  };
}

export function parseNpcSidecar(source: string, sourcePath?: string): NormalizeResult<ContentNpcDefinition> {
  const parsed = parseObjectFrontMatter(source, sourcePath);
  const warnings = [...parsed.warnings];
  const errors = [...parsed.errors];

  if (!parsed.value || errors.length > 0) {
    return { warnings, errors };
  }

  const id = asString(parsed.value.id);

  if (!id) {
    errors.push({ message: 'Expected npc id.' });
  }

  return {
    value: errors.length > 0 ? undefined : {
      id: id!,
      displayName: asString(parsed.value.displayName),
      role: asString(parsed.value.role),
      location: asString(parsed.value.location),
      behaviorMode: asString(parsed.value.behaviorMode),
      route: parseNpcRoute(parsed.value.route, errors),
      idle: parseNpcIdle(parsed.value.idle, errors),
      arrivalText: parseNpcTextBranch(parsed.value.arrivalText, 'arrivalText', errors),
      presenceText: parseNpcTextBranch(parsed.value.presenceText, 'presenceText', errors),
      transitText: parseNpcTextBranch(parsed.value.transitText, 'transitText', errors),
      departureText: parseNpcTextBranch(parsed.value.departureText, 'departureText', errors),
      sourcePath,
    },
    warnings,
    errors,
  };
}

function parseNpcRoute(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ContentNpcDefinition>['errors'],
): NpcRouteDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: 'Expected route object for npc.' });
    return undefined;
  }

  const rawSteps = objectValue.steps;

  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    errors.push({ message: 'Expected route.steps array for npc.' });
    return undefined;
  }

  const steps = rawSteps.flatMap((entry) => {
    const stepObject = asObject(entry);
    const nodeId = stepObject ? asString(stepObject.nodeId) : undefined;

    if (!nodeId) {
      errors.push({ message: 'Expected nodeId for npc route step.' });
      return [];
    }

    return [{ nodeId } satisfies NpcRouteStepDefinition];
  });

  if (steps.length === 0) {
    return undefined;
  }

  return {
    mode: asString(objectValue.mode),
    dwellSeconds: asNumber(objectValue.dwellSeconds),
    moveSeconds: asNumber(objectValue.moveSeconds),
    steps,
  };
}

function parseNpcTextBranch(
  value: ParsedFrontMatterValue | undefined,
  label: string,
  errors: NormalizeResult<ContentNpcDefinition>['errors'],
): NpcTextBranch | undefined {
  if (value === undefined) {
    return undefined;
  }

  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: `Expected object for npc ${label}.` });
    return undefined;
  }

  const shared = asStringArray(objectValue.shared);

  if (!shared || shared.length === 0) {
    errors.push({ message: `Expected shared text array for npc ${label}.` });
    return undefined;
  }

  return { shared };
}

function parseNpcIdle(
  value: ParsedFrontMatterValue | undefined,
  errors: NormalizeResult<ContentNpcDefinition>['errors'],
): NpcIdleDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: 'Expected idle object for npc.' });
    return undefined;
  }

  const modesObject = asObject(objectValue.modes);

  if (!modesObject) {
    return {
      activeMode: asString(objectValue.activeMode),
    };
  }

  const modes = Object.entries(modesObject).reduce<Record<string, NpcIdleModeDefinition>>((accumulator, [modeId, rawMode]) => {
    const modeObject = asObject(rawMode);

    if (!modeObject) {
      errors.push({ message: `Expected object definition for npc idle mode ${modeId}.` });
      return accumulator;
    }

    accumulator[modeId] = {
      when: parsePredicateReference(modeObject.when, `npc idle mode ${modeId}`, errors),
      default: parseNpcTextBranch(modeObject.default, `idle mode ${modeId} default`, errors),
    };
    return accumulator;
  }, {});

  return {
    activeMode: asString(objectValue.activeMode),
    modes,
  };
}