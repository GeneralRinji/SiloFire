import type { GateObject, GatePresentationConfig } from '../../schema/src';
import type {
  NormalizeResult,
  ParseDocumentResult,
  ParsedGateCandidate,
  ParsedGateDocument,
  ParsedFrontMatterValue,
  ParsedKeyedSection,
  ParsedSimpleSection,
} from './types';
import {
  asAreaNavigationLabels,
  asChoiceReferences,
  asControlLabels,
  asExitReferences,
  asGatePresentationConfig,
  asPathBlockingConfig,
  asOptionalPathDirectionality,
  asPathEndpoints,
  asPoiReferences,
  asOptionalBoolean,
  asOptionalPresentationMode,
  asOptionalString,
  asRequiredNumber,
  asRequiredString,
  asSignalMap,
  asStringArray,
  normalizeProseSlots,
  parseNodeDocument,
} from './shared';

export function parseGateDocument(source: string, sourcePath?: string): ParseDocumentResult {
  const parsed = parseNodeDocument(source, 'gate', sourcePath);

  if (!parsed.document) {
    return parsed;
  }

  const document: ParsedGateDocument = {
    ...parsed.document,
    templateSchema: 'gate',
  };

  return {
    ...parsed,
    document,
  };
}

export function toParsedGateCandidate(document: ParsedGateDocument): ParsedGateCandidate {
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

export function normalizeParsedGateCandidate(candidate: ParsedGateCandidate): NormalizeResult<GateObject> {
  const warnings = [] as NormalizeResult<GateObject>['warnings'];
  const errors = [] as NormalizeResult<GateObject>['errors'];
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
  const navigationLabels = asAreaNavigationLabels(frontMatter.navigationLabels, warnings);
  const controlLabels = asControlLabels(frontMatter.controlLabels, warnings);
  const directionality = asOptionalPathDirectionality(frontMatter.directionality, errors);
  const presentation =
    asGatePresentationConfig(frontMatter.presentation, warnings) ??
    inferLegacyGatePresentation(frontMatter.presentationMode, frontMatter.passthrough, frontMatter.walkpassthrough, frontMatter.runpassthrough, warnings);
  const blocking = asPathBlockingConfig(frontMatter.blocking, errors);
  const pois = asPoiReferences(frontMatter.pois, warnings);
  const choices = asChoiceReferences(frontMatter.choices, warnings);
  const exits = asExitReferences(frontMatter.exits, warnings);
  const endpoints = frontMatter.endpoints !== undefined ? asPathEndpoints(frontMatter.endpoints, errors) : undefined;
  const proseSlots = normalizeProseSlots(candidate.slotSections, warnings, errors);

  const value: GateObject | undefined =
    version !== undefined &&
    templateSchemaVersion !== undefined &&
    id !== undefined &&
    displayName !== undefined &&
    region !== undefined
      ? {
          version,
          templateSchema: 'gate',
          templateSchemaVersion,
          id,
          name: asOptionalString(frontMatter.name),
          displayName,
          tagline: asOptionalString(frontMatter.tagline),
          region,
          directionality,
          presentation,
          blocking,
          tags: asStringArray(frontMatter.tags, 'tags', warnings),
          signals: asSignalMap(frontMatter.signals, warnings),
          presentationMode: asOptionalPresentationMode(frontMatter.presentationMode, warnings),
          passthrough: asOptionalBoolean(frontMatter.passthrough, 'passthrough', warnings),
          walkpassthrough: asOptionalBoolean(frontMatter.walkpassthrough, 'walkpassthrough', warnings),
          runpassthrough: asOptionalBoolean(frontMatter.runpassthrough, 'runpassthrough', warnings),
          controlLabels,
          navigationLabels,
          pois,
          choices,
          exits,
          endpoints,
          proseSlots: proseSlots.length > 0 ? proseSlots : undefined,
        }
      : undefined;

  return {
    value,
    warnings,
    errors,
  };
}

export function parseGateToSchema(source: string, sourcePath?: string): NormalizeResult<GateObject> {
  const parsed = parseGateDocument(source, sourcePath);
  const parsedDocument = parsed.document;

  if (!parsedDocument || parsed.errors.length > 0) {
    return {
      value: undefined,
      warnings: parsed.warnings,
      errors: parsed.errors,
    };
  }

  const gateDocument: ParsedGateDocument = {
    ...parsedDocument,
    templateSchema: 'gate',
  };

  const normalized = normalizeParsedGateCandidate(toParsedGateCandidate(gateDocument));

  return {
    value: normalized.value,
    warnings: [...parsed.warnings, ...normalized.warnings],
    errors: [...parsed.errors, ...normalized.errors],
  };
}

function inferLegacyGatePresentation(
  presentationModeValue: ParsedFrontMatterValue | undefined,
  passthroughValue: ParsedFrontMatterValue | undefined,
  walkpassthroughValue: ParsedFrontMatterValue | undefined,
  runpassthroughValue: ParsedFrontMatterValue | undefined,
  warnings: NormalizeResult<GateObject>['warnings'],
): GatePresentationConfig | undefined {
  if (runpassthroughValue === true) {
    return { forward: 'runpassthrough', backward: 'runpassthrough' };
  }

  if (walkpassthroughValue === true) {
    return { forward: 'walkpassthrough', backward: 'walkpassthrough' };
  }

  if (passthroughValue === true) {
    return { forward: 'passthrough', backward: 'passthrough' };
  }

  const presentationMode = asOptionalPresentationMode(presentationModeValue, warnings);

  if (
    presentationMode === 'passthrough' ||
    presentationMode === 'walkpassthrough' ||
    presentationMode === 'runpassthrough' ||
    presentationMode === 'billboard'
  ) {
    return { forward: presentationMode, backward: presentationMode };
  }

  return undefined;
}