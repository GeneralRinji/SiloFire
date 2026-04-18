import type { PathObject } from '../../schema/src';
import type {
  NormalizeResult,
  ParseDocumentResult,
  ParsedFlowSection,
  ParsedKeyedSection,
  ParsedPathCandidate,
  ParsedPathDocument,
  ParsedSimpleSection,
} from './types';
import {
  asControlLabels,
  asOptionalBoolean,
  asOptionalPresentationMode,
  asOptionalString,
  asPathBlockingConfig,
  asPathDirectionality,
  asPathEndpoints,
  asPathTraversalConfig,
  asRequiredNumber,
  asRequiredString,
  asSignalMap,
  asStringArray,
  normalizePathFlows,
  normalizeProseSlots,
  parseNodeDocument,
} from './shared';

export function parsePathDocument(source: string, sourcePath?: string): ParseDocumentResult {
  const parsed = parseNodeDocument(source, 'path', sourcePath);

  if (!parsed.document) {
    return parsed;
  }

  const document: ParsedPathDocument = {
    ...parsed.document,
    templateSchema: 'path',
  };

  return {
    ...parsed,
    document,
  };
}

export function toParsedPathCandidate(document: ParsedPathDocument): ParsedPathCandidate {
  const flowSections: ParsedFlowSection[] = [];
  const slotSections: Array<ParsedSimpleSection | ParsedKeyedSection> = [];

  for (const section of document.sections) {
    if (section.kind === 'flow') {
      flowSections.push(section);
      continue;
    }

    slotSections.push(section);
  }

  return {
    frontMatter: document.frontMatter,
    title: document.title,
    flowSections,
    slotSections,
  };
}

export function normalizeParsedPathCandidate(candidate: ParsedPathCandidate): NormalizeResult<PathObject> {
  const warnings = [] as NormalizeResult<PathObject>['warnings'];
  const errors = [] as NormalizeResult<PathObject>['errors'];
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
  const directionality = asPathDirectionality(frontMatter.directionality, errors);

  const traversal = asPathTraversalConfig(frontMatter.traversal, errors);
  const blocking = asPathBlockingConfig(frontMatter.blocking, errors);
  const controlLabels = asControlLabels(frontMatter.controlLabels, warnings);
  const endpoints = asPathEndpoints(frontMatter.endpoints, errors);
  const proseSlots = normalizeProseSlots(candidate.slotSections, warnings, errors);
  const flows = normalizePathFlows(candidate.flowSections, warnings, errors);

  const value: PathObject | undefined =
    version !== undefined &&
    templateSchemaVersion !== undefined &&
    id !== undefined &&
    displayName !== undefined &&
    region !== undefined &&
    directionality !== undefined &&
    endpoints !== undefined
      ? {
          version,
          templateSchema: 'path',
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
          controlLabels,
          directionality,
          traversal,
          blocking,
          endpoints,
          proseSlots: proseSlots.length > 0 ? proseSlots : undefined,
          flows: flows.length > 0 ? flows : undefined,
        }
      : undefined;

  return {
    value,
    warnings,
    errors,
  };
}

export function parsePathToSchema(source: string, sourcePath?: string): NormalizeResult<PathObject> {
  const parsed = parsePathDocument(source, sourcePath);
  const parsedDocument = parsed.document;

  if (!parsedDocument || parsed.errors.length > 0) {
    return {
      value: undefined,
      warnings: parsed.warnings,
      errors: parsed.errors,
    };
  }

  const pathDocument: ParsedPathDocument = {
    ...parsedDocument,
    templateSchema: 'path',
  };

  const normalized = normalizeParsedPathCandidate(toParsedPathCandidate(pathDocument));

  return {
    value: normalized.value,
    warnings: [...parsed.warnings, ...normalized.warnings],
    errors: [...parsed.errors, ...normalized.errors],
  };
}