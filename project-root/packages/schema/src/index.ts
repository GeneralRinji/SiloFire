export type ContentNodeKind = 'area' | 'path' | 'gate';

export type TraversalPresentationMode =
  | 'normal'
  | 'passthrough'
  | 'walkpassthrough'
  | 'runpassthrough'
  | 'billboard';

export type ProseTrigger =
  | 'enter'
  | 'billboard'
  | 'blocked'
  | 'first_visit'
  | 'repeat_visit'
  | 'visit_random'
  | 'last_visit'
  | 'choice_result'
  | 'exit_glue'
  | 'exit_glue_random'
  | 'poi_inspect';

export type ProseSelectionMode =
  | 'constant'
  | 'random'
  | 'weighted'
  | 'cycle'
  | 'silent';

export type ProseVariant =
  | {
      kind: 'text';
      text: string;
      blocks?: ProseTextBlock[];
      weight?: number;
    }
  | {
      kind: 'none';
      weight?: number;
    };

export interface ProseSlot {
  id: string;
  trigger: ProseTrigger;
  key?: string;
  attempt?: number;
  mode: ProseSelectionMode;
  variants: ProseVariant[];
}

export type PathDirection = 'forward' | 'backward';

export type PathFlowTrigger = 'first_visit' | 'repeat' | 'block';

export interface FlowBeatMarker {
  kind: 'delay' | 'fade';
  value: string;
}

export interface ProseTextBlock {
  text: string;
  markers?: FlowBeatMarker[];
}

export interface FlowBeat {
  kind: 'beat';
  text: string;
  markers?: FlowBeatMarker[];
}

export interface PathFlow {
  id: string;
  trigger: PathFlowTrigger;
  direction: PathDirection;
  beats: FlowBeat[];
}

export interface ContentReferenceBase {
  id: string;
  displayName: string;
  key?: string;
}

export interface PoiReference extends ContentReferenceBase {}

export interface ChoiceReference extends ContentReferenceBase {}

export interface ExitReference extends ContentReferenceBase {
  targetId: string;
}

export interface AreaNavigationLabels {
  pois?: string;
  choices?: string;
  exits?: string;
  controls?: string;
}

export interface ControlLabels {
  continue?: string;
  skip?: string;
  back?: string;
}

export type TitleScreenSaveMode = 'single' | 'multiple';

export interface TitleScreenConfig {
  saveMode?: TitleScreenSaveMode;
}

export type SignalValue = string | number | boolean;

export type SignalMap = Record<string, SignalValue>;

export interface BaseContentObject {
  version: number;
  templateSchema: ContentNodeKind;
  templateSchemaVersion: number;
  id: string;
  name?: string;
  displayName: string;
  tagline?: string;
  region: string;
  tags?: string[];
  signals?: SignalMap;
  presentationMode?: TraversalPresentationMode | 'full';
  passthrough?: boolean;
  walkpassthrough?: boolean;
  runpassthrough?: boolean;
  controlLabels?: ControlLabels;
  titleScreen?: TitleScreenConfig;
}

export type AreaBlockingState = 'open' | 'blocked';

export interface AreaBlockingConfig {
  state?: AreaBlockingState;
}

export interface AreaObject extends BaseContentObject {
  templateSchema: 'area';
  blocking?: AreaBlockingConfig;
  navigationLabels?: AreaNavigationLabels;
  pois?: PoiReference[];
  choices?: ChoiceReference[];
  exits?: ExitReference[];
  proseSlots?: ProseSlot[];
}

export type PathTraversalMode = 'paged' | 'compressed';

export type PathDirectionality = 'bidirectional' | 'forward_only' | 'backward_only';

export type PathBlockingState = 'open' | 'blocked';

export interface PathTraversalConfig {
  firstVisitMode?: PathTraversalMode;
  repeatVisitMode?: PathTraversalMode;
}

export interface PathEndpoint {
  from: string;
  to: string;
}

export interface PathEndpoints {
  forward?: PathEndpoint;
  backward?: PathEndpoint;
}

export interface PathBlockingConfig {
  forward?: PathBlockingState;
  backward?: PathBlockingState;
}

export type GatePresentationMode = 'passthrough' | 'walkpassthrough' | 'runpassthrough' | 'billboard';

export interface GatePresentationConfig {
  forward?: GatePresentationMode;
  backward?: GatePresentationMode;
}

export interface PathObject extends BaseContentObject {
  templateSchema: 'path';
  directionality: PathDirectionality;
  traversal?: PathTraversalConfig;
  blocking?: PathBlockingConfig;
  endpoints: PathEndpoints;
  proseSlots?: ProseSlot[];
  flows?: PathFlow[];
}

export interface GateObject extends BaseContentObject {
  templateSchema: 'gate';
  directionality?: PathDirectionality;
  presentation?: GatePresentationConfig;
  blocking?: PathBlockingConfig;
  navigationLabels?: AreaNavigationLabels;
  pois?: PoiReference[];
  choices?: ChoiceReference[];
  exits?: ExitReference[];
  endpoints?: PathEndpoints;
  proseSlots?: ProseSlot[];
}

export type ContentObject = AreaObject | PathObject | GateObject;

export * from './sidecars';