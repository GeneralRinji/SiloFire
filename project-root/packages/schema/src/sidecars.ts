export interface PredicateReference {
  predicate: string;
}

export interface TimePhaseDefinition {
  id: string;
  label?: string;
  durationMinutes?: number;
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
  regions?: Record<string, string>;
  nodes?: Record<string, string>;
}

export interface ProjectTimeSettingsDefinition {
  calendars?: Record<string, TimeCalendarDefinition>;
  assignments?: TimeAssignmentsDefinition;
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
  when?: PredicateReference;
  actor: EventAudienceBranch;
  private?: EventAudienceBranch;
  witnesses?: EventAudienceBranch;
  offer?: EventOfferDefinition;
  effects?: EventEffectDefinition[];
  sourcePath?: string;
}