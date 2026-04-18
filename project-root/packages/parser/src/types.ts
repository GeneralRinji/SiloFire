import type { ProseSelectionMode } from '../../schema/src';

export type ParsedFrontMatterScalar = string | number | boolean | null;

export type ParsedFrontMatterValue =
  | ParsedFrontMatterScalar
  | ParsedFrontMatterObject
  | ParsedFrontMatterValue[];

export interface ParsedFrontMatterObject {
  [key: string]: ParsedFrontMatterValue;
}

export interface ParsedFrontMatter {
  [key: string]: ParsedFrontMatterValue;
}

export type ParsedMarker =
  | {
      kind: 'none';
    }
  | {
      kind: 'delay' | 'fade';
      value: string;
    };

export interface ParsedTextBlock {
  text: string;
  markers?: ParsedMarker[];
}

export interface ParsedBeat {
  kind: 'beat';
  text: string;
  markers?: ParsedMarker[];
}

export interface ParsedDocumentBase {
  sourcePath?: string;
  frontMatter: ParsedFrontMatter;
  title?: string;
  sections: ParsedSection[];
}

export interface ParsedSimpleSection {
  kind: 'simple';
  rawName: string;
  trigger: string;
  attempt?: number;
  mode?: ProseSelectionMode;
  weight?: number;
  order: number;
  blocks: ParsedTextBlock[];
}

export interface ParsedKeyedSection {
  kind: 'keyed';
  rawName: string;
  trigger: string;
  key: string;
  attempt?: number;
  mode?: ProseSelectionMode;
  weight?: number;
  order: number;
  blocks: ParsedTextBlock[];
}

export interface ParsedFlowSection {
  kind: 'flow';
  rawName: string;
  trigger: string;
  direction?: string;
  order: number;
  beats: ParsedBeat[];
}

export type ParsedSection =
  | ParsedSimpleSection
  | ParsedKeyedSection
  | ParsedFlowSection;

export interface ParsedNodeDocument extends ParsedDocumentBase {
  templateSchema?: string;
}

export interface ParsedAreaDocument extends ParsedNodeDocument {
  templateSchema: 'area';
}

export interface ParsedPathDocument extends ParsedNodeDocument {
  templateSchema: 'path';
}

export interface ParsedGateDocument extends ParsedNodeDocument {
  templateSchema: 'gate';
}

export interface ParseWarning {
  message: string;
  sectionOrder?: number;
}

export interface ParseError {
  message: string;
  sectionOrder?: number;
}

export interface ParseDocumentResult {
  document?: ParsedNodeDocument;
  warnings: ParseWarning[];
  errors: ParseError[];
}

export interface ParsedPathCandidate {
  frontMatter: ParsedFrontMatter;
  title?: string;
  flowSections: ParsedFlowSection[];
  slotSections: Array<ParsedSimpleSection | ParsedKeyedSection>;
}

export interface ParsedAreaCandidate {
  frontMatter: ParsedFrontMatter;
  title?: string;
  slotSections: Array<ParsedSimpleSection | ParsedKeyedSection>;
}

export interface ParsedGateCandidate {
  frontMatter: ParsedFrontMatter;
  title?: string;
  slotSections: Array<ParsedSimpleSection | ParsedKeyedSection>;
}

export interface NormalizeResult<T> {
  value?: T;
  warnings: ParseWarning[];
  errors: ParseError[];
}