import type { AreaObject } from '../../schema/src';
import type {
  NormalizeResult,
  ParseDocumentResult,
  ParsedAreaCandidate,
  ParsedAreaDocument,
  ParsedKeyedSection,
  ParsedSimpleSection,
} from './types';
import {
  asAreaBlockingConfig,
  asAreaNavigationLabels,
  asChoiceReferences,
  asControlLabels,
  asExitReferences,
  asOptionalBoolean,
  asOptionalPresentationMode,
  asOptionalString,
  asPoiReferences,
  asRequiredNumber,
  asRequiredString,
  asSignalMap,
  asStringArray,
  asTitleScreenConfig,
  normalizeProseSlots,
  parseNodeDocument,
} from './shared';

export function parseAreaDocument(source: string, sourcePath?: string): ParseDocumentResult {
  const parsed = parseNodeDocument(source, 'area', sourcePath);

  if (!parsed.document) {
    return parsed;
  }

  const document: ParsedAreaDocument = {
    ...parsed.document,
    templateSchema: 'area',
  };

  return {
    ...parsed,
    document,
  };
}

export function toParsedAreaCandidate(document: ParsedAreaDocument): ParsedAreaCandidate {
  const slotSections: Array<ParsedSimpleSection | ParsedKeyedSection> = [];

  for (const section of document.sections) {
    if (section.kind === 'flow') {
      continue;
    }

    slotSections.push(section);
  }

  return {
    frontMatter: document.frontMatter,
    title: document.title,
    slotSections,
  };
}

export function normalizeParsedAreaCandidate(candidate: ParsedAreaCandidate): NormalizeResult<AreaObject> {
  const warnings = [] as NormalizeResult<AreaObject>['warnings'];
  const errors = [] as NormalizeResult<AreaObject>['errors'];
  const frontMatter = candidate.frontMatter;

  const version = asRequiredNumber(frontMatter.version, 'version', errors);
  const templateSchemaVersion = asRequiredNumber(
    frontMatter.templateSchemaVersion,
    'templateSchemaVersion',
    errors,
  );
  const id = asRequiredString(frontMatter.id, 'id', errors);
  const displayName = asRequiredString(frontMatter.displayName, 'displayName', errors);
  const region = asRequiredString(frontMatter.region, 'region', errors);
  const proseSlots = normalizeProseSlots(candidate.slotSections, warnings, errors);
  const blocking = asAreaBlockingConfig(frontMatter.blocking, errors);
  const navigationLabels = asAreaNavigationLabels(frontMatter.navigationLabels, warnings);
  const controlLabels = asControlLabels(frontMatter.controlLabels, warnings);
  const titleScreen = asTitleScreenConfig(frontMatter.titleScreen, warnings);
  const pois = asPoiReferences(frontMatter.pois, warnings);
  const choices = asChoiceReferences(frontMatter.choices, warnings);
  const exits = asExitReferences(frontMatter.exits, warnings);

  const value: AreaObject | undefined =
    version !== undefined &&
    templateSchemaVersion !== undefined &&
    id !== undefined &&
    displayName !== undefined &&
    region !== undefined
      ? {
          version,
          templateSchema: 'area',
          templateSchemaVersion,
          id,
          name: asOptionalString(frontMatter.name),
          displayName,
          tagline: asOptionalString(frontMatter.tagline),
          region,
          tags: asStringArray(frontMatter.tags, 'tags', warnings),
          signals: asSignalMap(frontMatter.signals, warnings),
          presentationMode: asOptionalPresentationMode(frontMatter.presentationMode, warnings),
          passthrough: asOptionalBoolean(frontMatter.passthrough, 'passthrough', warnings),
          walkpassthrough: asOptionalBoolean(frontMatter.walkpassthrough, 'walkpassthrough', warnings),
          runpassthrough: asOptionalBoolean(frontMatter.runpassthrough, 'runpassthrough', warnings),
          blocking,
          controlLabels,
          titleScreen,
          navigationLabels,
          pois,
          choices,
          exits,
          proseSlots: proseSlots.length > 0 ? proseSlots : undefined,
        }
      : undefined;

  return {
    value,
    warnings,
    errors,
  };
}

export function parseAreaToSchema(source: string, sourcePath?: string): NormalizeResult<AreaObject> {
  const parsed = parseAreaDocument(source, sourcePath);
  const parsedDocument = parsed.document;

  if (!parsedDocument || parsed.errors.length > 0) {
    return {
      value: undefined,
      warnings: parsed.warnings,
      errors: parsed.errors,
    };
  }

  const areaDocument: ParsedAreaDocument = {
    ...parsedDocument,
    templateSchema: 'area',
  };

  const normalized = normalizeParsedAreaCandidate(toParsedAreaCandidate(areaDocument));

  return {
    value: normalized.value,
    warnings: [...parsed.warnings, ...normalized.warnings],
    errors: [...parsed.errors, ...normalized.errors],
  };
}