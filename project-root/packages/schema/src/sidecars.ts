export interface PredicateReference {
  predicate: string;
}

export interface TimePhaseDefinition {
  id: string;
  label?: string;
  durationMinutes?: number;
  groups?: string[];
  statusText?: string[];
}

export type TimeScheduleTriggerKind = 'phase' | 'condition' | 'elapsed' | 'clock';

export interface TimeScheduleTriggerDefinition {
  kind: TimeScheduleTriggerKind;
  phaseId?: string;
  phaseGroup?: string;
  edge?: 'enter' | 'exit';
  predicate?: PredicateReference;
  scheduleId?: string;
  minutes?: number;
}

export interface TimeScheduleRepeatDefinition {
  everyMinutes?: number;
  count?: number;
}

export interface TimeScheduleWindowDefinition {
  start?: TimeScheduleTriggerDefinition;
  stop?: TimeScheduleTriggerDefinition;
}

export interface TimeScheduleTargetDefinition {
  nodes?: string[];
  folders?: string[];
  regions?: string[];
  tags?: string[];
}

export interface TimeScheduleDefinition {
  description?: string;
  trigger: TimeScheduleTriggerDefinition;
  when?: PredicateReference;
  repeat?: TimeScheduleRepeatDefinition;
  activeWindow?: TimeScheduleWindowDefinition;
  target?: TimeScheduleTargetDefinition;
  actor?: EventAudienceBranch;
  lane?: 'visible' | 'recent';
  effects?: EventEffectDefinition[];
}

export interface TimeCalendarDefinition {
  preset?: string;
  epoch?: string;
  minutesPerCycle?: number;
  minutesPerPhase?: number;
  phases?: TimePhaseDefinition[];
}

export interface TimeAssignmentsDefinition {
  defaultCalendar?: string;
  folders?: Record<string, string>;
  regions?: Record<string, string>;
  nodes?: Record<string, string>;
}

export interface TimeVisibilityDefinition {
  defaultRecentLog?: boolean;
  folders?: Record<string, boolean>;
  regions?: Record<string, boolean>;
  nodes?: Record<string, boolean>;
}

export interface ProjectTimeSettingsDefinition {
  calendars?: Record<string, TimeCalendarDefinition>;
  assignments?: TimeAssignmentsDefinition;
  visibility?: TimeVisibilityDefinition;
  schedules?: Record<string, TimeScheduleDefinition>;
}

export interface WeatherStepDefinition {
  id?: string;
  kind: string;
  intensity?: string;
  durationMinutes?: number;
  statusText?: string[];
}

export interface WeatherPatternDefinition {
  epoch?: string;
  minutesPerStep?: number;
  steps?: WeatherStepDefinition[];
}

export interface WeatherAssignmentsDefinition {
  defaultPattern?: string;
  regions?: Record<string, string>;
  nodes?: Record<string, string>;
}

export interface WeatherVisibilityDefinition {
  defaultRecentLog?: boolean;
  regions?: Record<string, boolean>;
  nodes?: Record<string, boolean>;
}

export interface ProjectWeatherSettingsDefinition {
  patterns?: Record<string, WeatherPatternDefinition>;
  assignments?: WeatherAssignmentsDefinition;
  visibility?: WeatherVisibilityDefinition;
}

export interface EventTriggerDefinition {
  kind: string;
  actor: string;
  nodeId: string;
  poiId?: string;
  choiceId?: string;
  exitId?: string;
}

export interface EventAudienceBranch {
  when?: PredicateReference;
  text: string[];
}

export interface EventOfferDefinition {
  label: string;
  key?: string;
  meta?: string;
}

export interface NpcTextBranch {
  shared: string[];
}

export interface NpcIdleModeDefinition {
  when?: PredicateReference;
  default?: NpcTextBranch;
}

export interface NpcIdleDefinition {
  activeMode?: string;
  modes?: Record<string, NpcIdleModeDefinition>;
}

export interface NpcRouteStepDefinition {
  nodeId: string;
}

export interface NpcRouteDefinition {
  mode?: string;
  dwellSeconds?: number;
  moveSeconds?: number;
  steps: NpcRouteStepDefinition[];
}

export interface ContentNpcDefinition {
  id: string;
  displayName?: string;
  role?: string;
  location?: string;
  behaviorMode?: string;
  route?: NpcRouteDefinition;
  idle?: NpcIdleDefinition;
  arrivalText?: NpcTextBranch;
  presenceText?: NpcTextBranch;
  transitText?: NpcTextBranch;
  departureText?: NpcTextBranch;
  sourcePath?: string;
}

export interface EventEffectDefinition {
  kind: string;
  args: Array<string | number | boolean | null>;
}

export interface ContentEventDefinition {
  id: string;
  trigger: EventTriggerDefinition;
  lane?: 'visible' | 'recent';
  when?: PredicateReference;
  actor: EventAudienceBranch;
  private?: EventAudienceBranch;
  witnesses?: EventAudienceBranch;
  offer?: EventOfferDefinition;
  effects?: EventEffectDefinition[];
  sourcePath?: string;
}