import type {
  AreaBlockingConfig,
  AreaNavigationLabels,
  ChoiceReference,
  ControlLabels,
  ExitReference,
  FlowBeatMarker,
  GatePresentationConfig,
  GatePresentationMode,
  PathBlockingConfig,
  PathBlockingState,
  PathDirection,
  PathDirectionality,
  PathFlow,
  PathFlowTrigger,
  PathObject,
  PathTraversalConfig,
  PathTraversalMode,
  PoiReference,
  ProseSelectionMode,
  ProseSlot,
  ProseTextBlock,
  ProseTrigger,
  ProseVariant,
  TitleScreenConfig,
  TitleScreenSaveMode,
  TraversalPresentationMode,
} from '../../schema/src';
import type {
  ParseDocumentResult,
  ParseError,
  ParseWarning,
  ParsedBeat,
  ParsedFlowSection,
  ParsedFrontMatter,
  ParsedFrontMatterObject,
  ParsedFrontMatterScalar,
  ParsedFrontMatterValue,
  ParsedKeyedSection,
  ParsedMarker,
  ParsedNodeDocument,
  ParsedSection,
  ParsedSimpleSection,
  ParsedTextBlock,
} from './types';

export const FRONT_MATTER_DELIMITER = '---';

const PROSE_TRIGGER_SET: ReadonlySet<ProseTrigger> = new Set([
  'enter',
  'billboard',
  'blocked',
  'first_visit',
  'repeat_visit',
  'visit_random',
  'last_visit',
  'choice_result',
  'exit_glue',
  'exit_glue_random',
  'poi_inspect',
]);

const PATH_FLOW_TRIGGER_SET: ReadonlySet<PathFlowTrigger> = new Set([
  'first_visit',
  'repeat',
  'block',
]);

const PATH_DIRECTION_SET: ReadonlySet<PathDirection> = new Set(['forward', 'backward']);

const PATH_TRAVERSAL_MODE_SET: ReadonlySet<PathTraversalMode> = new Set([
  'paged',
  'compressed',
]);

const PATH_BLOCKING_STATE_SET: ReadonlySet<PathBlockingState> = new Set(['open', 'blocked']);
const GATE_PRESENTATION_MODE_SET: ReadonlySet<GatePresentationMode> = new Set([
  'passthrough',
  'walkpassthrough',
  'runpassthrough',
  'billboard',
]);

const PATH_DIRECTIONALITY_SET: ReadonlySet<PathDirectionality> = new Set([
  'bidirectional',
  'forward_only',
  'backward_only',
]);

const KEYED_SECTION_TRIGGER_SET = new Set(['choice', 'poi', 'enter', 'billboard', 'blocked', 'exit_glue', 'exit_glue_random']);
const PROSE_SELECTION_MODE_SET: ReadonlySet<ProseSelectionMode> = new Set([
  'constant',
  'random',
  'weighted',
  'cycle',
  'silent',
]);
const TITLE_SCREEN_SAVE_MODE_SET: ReadonlySet<TitleScreenSaveMode> = new Set(['single', 'multiple']);

export function parseNodeDocument(
  source: string,
  expectedTemplateSchema: 'area' | 'path' | 'gate',
  sourcePath?: string,
): ParseDocumentResult {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const lines = normalizeSourceLines(source);

  const frontMatterStart = lines.findIndex((line) => line.trim() === FRONT_MATTER_DELIMITER);

  if (frontMatterStart < 0) {
    return {
      warnings,
      errors: [{ message: 'Missing front matter delimiter.' }],
    };
  }

  const frontMatterEnd = findNextDelimiter(lines, frontMatterStart + 1);

  if (frontMatterEnd < 0) {
    return {
      warnings,
      errors: [{ message: 'Missing closing front matter delimiter.' }],
    };
  }

  const frontMatter = parseFrontMatterLines(
    lines.slice(frontMatterStart + 1, frontMatterEnd),
    warnings,
    errors,
  );
  const body = parseBodyLines(lines.slice(frontMatterEnd + 1), warnings, errors);
  const templateSchema = asOptionalString(frontMatter.templateSchema);

  if (templateSchema && templateSchema !== expectedTemplateSchema) {
    errors.push({
      message: `Expected templateSchema ${expectedTemplateSchema}, received ${templateSchema}.`,
    });
  }

  const document: ParsedNodeDocument = {
    sourcePath,
    frontMatter,
    title: body.title,
    sections: body.sections,
    templateSchema: expectedTemplateSchema,
  };

  return {
    document,
    warnings,
    errors,
  };
}

function normalizeSourceLines(source: string): string[] {
  return source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
}

function findNextDelimiter(lines: string[], startIndex: number): number {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index].trim() === FRONT_MATTER_DELIMITER) {
      return index;
    }
  }

  return -1;
}

function parseFrontMatterLines(
  lines: string[],
  warnings: ParseWarning[],
  errors: ParseError[],
): ParsedFrontMatter {
  const meaningfulLines = lines
    .map((line, index) => ({
      line,
      lineNumber: index + 1,
    }))
    .filter(({ line }) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#');
    });

  const [value] = parseObjectValue(meaningfulLines, 0, 0, warnings, errors);
  return value;
}

function parseObjectValue(
  lines: Array<{ line: string; lineNumber: number }>,
  startIndex: number,
  indent: number,
  warnings: ParseWarning[],
  errors: ParseError[],
): [ParsedFrontMatterObject, number] {
  const result: ParsedFrontMatterObject = {};
  let index = startIndex;

  while (index < lines.length) {
    const current = lines[index];
    const currentIndent = countIndent(current.line);

    if (currentIndent < indent) {
      break;
    }

    if (currentIndent > indent) {
      errors.push({ message: `Unexpected indentation in front matter on line ${current.lineNumber}.` });
      index += 1;
      continue;
    }

    const trimmed = current.line.trim();

    if (trimmed.startsWith('- ')) {
      errors.push({ message: `Unexpected list item at object level on line ${current.lineNumber}.` });
      index += 1;
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');

    if (separatorIndex < 0) {
      errors.push({ message: `Expected key:value pair on line ${current.lineNumber}.` });
      index += 1;
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (rawValue.length > 0) {
      result[key] = parseScalarValue(rawValue);
      index += 1;
      continue;
    }

    const nextIndex = findNextMeaningfulIndex(lines, index + 1);

    if (nextIndex < 0) {
      result[key] = {};
      index += 1;
      continue;
    }

    const nextLine = lines[nextIndex];
    const nextIndent = countIndent(nextLine.line);

    if (nextIndent <= currentIndent) {
      result[key] = {};
      index += 1;
      continue;
    }

    if (nextLine.line.trim().startsWith('- ')) {
      const [arrayValue, nextArrayIndex] = parseArrayValue(
        lines,
        nextIndex,
        nextIndent,
        warnings,
        errors,
      );
      result[key] = arrayValue;
      index = nextArrayIndex;
      continue;
    }

    const [objectValue, nextObjectIndex] = parseObjectValue(
      lines,
      nextIndex,
      nextIndent,
      warnings,
      errors,
    );
    result[key] = objectValue;
    index = nextObjectIndex;
  }

  return [result, index];
}

function parseArrayValue(
  lines: Array<{ line: string; lineNumber: number }>,
  startIndex: number,
  indent: number,
  warnings: ParseWarning[],
  errors: ParseError[],
): [ParsedFrontMatterValue[], number] {
  const result: ParsedFrontMatterValue[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const current = lines[index];
    const currentIndent = countIndent(current.line);

    if (currentIndent < indent) {
      break;
    }

    if (currentIndent > indent) {
      errors.push({ message: `Unexpected indentation in array on line ${current.lineNumber}.` });
      index += 1;
      continue;
    }

    const trimmed = current.line.trim();

    if (!trimmed.startsWith('- ')) {
      break;
    }

    const rawItem = trimmed.slice(2).trim();

    if (rawItem.length === 0) {
      const nextIndex = findNextMeaningfulIndex(lines, index + 1);

      if (nextIndex < 0 || countIndent(lines[nextIndex].line) <= currentIndent) {
        result.push(null);
        index += 1;
        continue;
      }

      const nextIndent = countIndent(lines[nextIndex].line);

      if (lines[nextIndex].line.trim().startsWith('- ')) {
        const [nestedArray, nextArrayIndex] = parseArrayValue(
          lines,
          nextIndex,
          nextIndent,
          warnings,
          errors,
        );
        result.push(nestedArray);
        index = nextArrayIndex;
        continue;
      }

      const [nestedObject, nextObjectIndex] = parseObjectValue(
        lines,
        nextIndex,
        nextIndent,
        warnings,
        errors,
      );
      result.push(nestedObject);
      index = nextObjectIndex;
      continue;
    }

    if (rawItem.includes(':')) {
      const pseudoLines: Array<{ line: string; lineNumber: number }> = [
        {
          line: `${' '.repeat(indent + 2)}${rawItem}`,
          lineNumber: current.lineNumber,
        },
      ];

      let scanIndex = index + 1;

      while (scanIndex < lines.length) {
        const scanLine = lines[scanIndex];
        const scanIndent = countIndent(scanLine.line);

        if (scanIndent <= currentIndent) {
          break;
        }

        pseudoLines.push(scanLine);
        scanIndex += 1;
      }

      const [objectValue] = parseObjectValue(pseudoLines, 0, indent + 2, warnings, errors);
      result.push(objectValue);
      index = scanIndex;
      continue;
    }

    result.push(parseScalarValue(rawItem));
    index += 1;
  }

  return [result, index];
}

function parseBodyLines(
  lines: string[],
  warnings: ParseWarning[],
  errors: ParseError[],
): { title?: string; sections: ParsedSection[] } {
  const sections: ParsedSection[] = [];
  let title: string | undefined;
  let index = 0;
  let order = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (trimmed.length === 0 || trimmed === FRONT_MATTER_DELIMITER) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      if (!title) {
        title = trimmed.slice(2).trim();
      }
      index += 1;
      continue;
    }

    if (!trimmed.startsWith('## ')) {
      warnings.push({ message: `Ignoring body content outside a section: ${trimmed}` });
      index += 1;
      continue;
    }

    const rawName = trimmed.slice(3).trim();
    const sectionStart = index + 1;
    index += 1;

    while (index < lines.length) {
      const current = lines[index].trim();
      if (current.startsWith('## ')) {
        break;
      }
      index += 1;
    }

    order += 1;
    const sectionLines = lines.slice(sectionStart, index);
    sections.push(parseSection(rawName, sectionLines, order, warnings, errors));
  }

  return { title, sections };
}

function parseSection(
  rawName: string,
  lines: string[],
  order: number,
  warnings: ParseWarning[],
  errors: ParseError[],
): ParsedSection {
  if (rawName.startsWith('flow:')) {
    return parseFlowSection(rawName, lines, order, warnings, errors);
  }

  const parsedHeader = parseProseSectionHeader(rawName);

  if (parsedHeader.kind === 'keyed') {
    return {
      kind: 'keyed',
      rawName,
      trigger: parsedHeader.trigger,
      key: parsedHeader.key,
      attempt: parsedHeader.attempt,
      mode: parsedHeader.mode,
      weight: parsedHeader.weight,
      order,
      blocks: parseTextBlocks(lines),
    };
  }

  return {
    kind: 'simple',
    rawName,
    trigger: parsedHeader.trigger,
    attempt: parsedHeader.attempt,
    mode: parsedHeader.mode,
    weight: parsedHeader.weight,
    order,
    blocks: parseTextBlocks(lines),
  };
}

function parseProseSectionHeader(rawName: string):
  | { kind: 'simple'; trigger: string; attempt?: number; mode?: ProseSelectionMode; weight?: number }
  | { kind: 'keyed'; trigger: string; key: string; attempt?: number; mode?: ProseSelectionMode; weight?: number } {
  const tokens = rawName.trim().split(/\s+/).filter((part) => part.length > 0);
  const optionStartIndex = tokens.findIndex((token) => token.startsWith('@'));
  const nameTokens = optionStartIndex >= 0 ? tokens.slice(0, optionStartIndex) : tokens;
  const optionTokens = optionStartIndex >= 0 ? tokens.slice(optionStartIndex) : [];
  const name = nameTokens.join(' ').trim();
  const parts = name.split(':').map((part) => part.trim()).filter((part) => part.length > 0);
  const options = parseProseHeaderOptions(optionTokens);

  if (parts.length === 0) {
    return { kind: 'simple', trigger: name.length > 0 ? name : rawName.trim(), mode: options.mode, weight: options.weight };
  }

  const trigger = parts[0];
  const lastPart = parts[parts.length - 1];
  const parsedAttempt = Number(lastPart);
  const hasAttemptSuffix = Number.isInteger(parsedAttempt) && parsedAttempt > 0;

  if (KEYED_SECTION_TRIGGER_SET.has(trigger) && parts.length >= 2) {
    const keyParts = hasAttemptSuffix ? parts.slice(1, -1) : parts.slice(1);
    return {
      kind: 'keyed',
      trigger,
      key: keyParts.join(':').trim(),
      attempt: hasAttemptSuffix ? parsedAttempt : undefined,
      mode: options.mode,
      weight: options.weight,
    };
  }

  return {
    kind: 'simple',
    trigger,
    attempt: hasAttemptSuffix && parts.length === 2 ? parsedAttempt : undefined,
    mode: options.mode,
    weight: options.weight,
  };
}

function parseProseHeaderOptions(tokens: string[]): { mode?: ProseSelectionMode; weight?: number } {
  let mode: ProseSelectionMode | undefined;
  let weight: number | undefined;

  for (const token of tokens) {
    const normalized = token.trim().toLowerCase();

    if (!normalized.startsWith('@')) {
      continue;
    }

    const modeToken = normalized.slice(1);

    if (PROSE_SELECTION_MODE_SET.has(modeToken as ProseSelectionMode)) {
      mode = modeToken as ProseSelectionMode;
      continue;
    }

    if (modeToken.startsWith('weight=')) {
      const parsedWeight = Number(modeToken.slice('weight='.length));

      if (Number.isFinite(parsedWeight) && parsedWeight > 0) {
        weight = parsedWeight;
      }
    }
  }

  return { mode, weight };
}

function parseFlowSection(
  rawName: string,
  lines: string[],
  order: number,
  warnings: ParseWarning[],
  errors: ParseError[],
): ParsedFlowSection {
  const parts = rawName.split(':').map((part) => part.trim());
  const trigger = parts[1] ?? '';
  const direction = parts[2] ?? undefined;
  const beats: ParsedBeat[] = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();

    if (trimmed.length === 0 || trimmed === FRONT_MATTER_DELIMITER) {
      index += 1;
      continue;
    }

    if (!trimmed.startsWith('### ')) {
      warnings.push({ message: `Ignoring non-beat content in flow section ${rawName}.`, sectionOrder: order });
      index += 1;
      continue;
    }

    const subheading = trimmed.slice(4).trim();
    const beatStart = index + 1;
    index += 1;

    while (index < lines.length) {
      const current = lines[index].trim();
      if (current.startsWith('### ')) {
        break;
      }
      index += 1;
    }

    if (subheading !== 'beat') {
      warnings.push({ message: `Unsupported flow subheading ${subheading}.`, sectionOrder: order });
      continue;
    }

    const block = collapseBlocksToBeat(parseTextBlocks(lines.slice(beatStart, index)), order, warnings, errors);

    if (block) {
      beats.push(block);
    }
  }

  return {
    kind: 'flow',
    rawName,
    trigger,
    direction,
    order,
    beats,
  };
}

function parseTextBlocks(lines: string[]): ParsedTextBlock[] {
  const blocks: ParsedTextBlock[] = [];
  let currentLines: string[] = [];
  let pendingMarkers: ParsedMarker[] = [];
  let canAttachMarkersToPreviousBlock = false;

  const flushBlock = () => {
    if (currentLines.length === 0 && pendingMarkers.length === 0) {
      return;
    }

    blocks.push({
      text: currentLines.join('\n').trim(),
      markers: pendingMarkers.length > 0 ? [...pendingMarkers] : undefined,
    });

    currentLines = [];
    pendingMarkers = [];
  };

  const appendMarkerToLastBlock = (marker: ParsedMarker) => {
    const lastBlock = blocks[blocks.length - 1];

    if (!lastBlock) {
      pendingMarkers.push(marker);
      return;
    }

    lastBlock.markers = [...(lastBlock.markers ?? []), marker];
  };

  const appendMarkersToCurrentBlock = (markers: ParsedMarker[]) => {
    pendingMarkers.push(...markers);
    flushBlock();
    canAttachMarkersToPreviousBlock = true;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (trimmed === FRONT_MATTER_DELIMITER) {
      continue;
    }

    const marker = parseStandaloneMarker(trimmed);

    if (marker) {
      if (currentLines.length > 0) {
        const markerRun = collectConsecutiveMarkers(lines, index);
        const hasFutureText = hasTextBeforeBreak(lines, markerRun.nextIndex);

        if (!hasFutureText) {
          appendMarkersToCurrentBlock(markerRun.markers);
          index = markerRun.nextIndex - 1;
          continue;
        }

        if (markerRun.markers.length === 1) {
          flushBlock();
          pendingMarkers.push(markerRun.markers[0]);
          canAttachMarkersToPreviousBlock = false;
          index = markerRun.nextIndex - 1;
          continue;
        }

        appendMarkersToCurrentBlock([markerRun.markers[0]]);
        pendingMarkers.push(...markerRun.markers.slice(1));
        canAttachMarkersToPreviousBlock = false;
        index = markerRun.nextIndex - 1;
        continue;
      }

      if (canAttachMarkersToPreviousBlock) {
        appendMarkerToLastBlock(marker);
        continue;
      }

      pendingMarkers.push(marker);
      continue;
    }

    if (trimmed.length === 0) {
      flushBlock();
      canAttachMarkersToPreviousBlock = false;
      continue;
    }

    currentLines.push(trimmed);
    canAttachMarkersToPreviousBlock = false;
  }

  flushBlock();

  return blocks;
}

function collectConsecutiveMarkers(lines: string[], startIndex: number): { markers: ParsedMarker[]; nextIndex: number } {
  const markers: ParsedMarker[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const marker = parseStandaloneMarker(lines[index].trim());

    if (!marker) {
      break;
    }

    markers.push(marker);
    index += 1;
  }

  return { markers, nextIndex: index };
}

function hasTextBeforeBreak(lines: string[], startIndex: number): boolean {
  for (let index = startIndex; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (trimmed.length === 0 || trimmed === FRONT_MATTER_DELIMITER) {
      return false;
    }

    if (parseStandaloneMarker(trimmed)) {
      continue;
    }

    return true;
  }

  return false;
}

function parseStandaloneMarker(line: string): ParsedMarker | undefined {
  if (line === '[none]') {
    return { kind: 'none' };
  }

  const markerMatch = /^\[(delay|fade)\s*:\s*([^\]]+)\]$/i.exec(line);

  if (!markerMatch) {
    return undefined;
  }

  return {
    kind: markerMatch[1].toLowerCase() as 'delay' | 'fade',
    value: markerMatch[2].trim(),
  };
}

function collapseBlocksToBeat(
  blocks: ParsedTextBlock[],
  order: number,
  warnings: ParseWarning[],
  errors: ParseError[],
): ParsedBeat | undefined {
  if (blocks.length === 0) {
    warnings.push({ message: 'Empty beat block encountered.', sectionOrder: order });
    return undefined;
  }

  const markers: ParsedMarker[] = [];
  const textParts: string[] = [];

  for (const block of blocks) {
    if (block.markers) {
      for (const marker of block.markers) {
        if (marker.kind === 'none') {
          errors.push({ message: 'Flow beats cannot normalize [none] markers.', sectionOrder: order });
          continue;
        }

        markers.push(marker);
      }
    }

    if (block.text.length > 0) {
      textParts.push(block.text);
    }
  }

  return {
    kind: 'beat',
    text: textParts.join('\n\n').trim(),
    markers: markers.length > 0 ? markers : undefined,
  };
}

export function normalizePathFlows(
  sections: ParsedFlowSection[],
  warnings: ParseWarning[],
  errors: ParseError[],
): PathFlow[] {
  const flows: PathFlow[] = [];

  for (const section of sections) {
    if (!PATH_FLOW_TRIGGER_SET.has(section.trigger as PathFlowTrigger)) {
      errors.push({
        message: `Unsupported path flow trigger ${section.trigger}.`,
        sectionOrder: section.order,
      });
      continue;
    }

    if (!section.direction || !PATH_DIRECTION_SET.has(section.direction as PathDirection)) {
      errors.push({
        message: `Unsupported or missing path flow direction ${section.direction ?? 'undefined'}.`,
        sectionOrder: section.order,
      });
      continue;
    }

    flows.push({
      id: section.rawName,
      trigger: section.trigger as PathFlowTrigger,
      direction: section.direction as PathDirection,
      beats: section.beats.map((beat) => ({
        kind: 'beat',
        text: beat.text,
        markers: normalizeFlowBeatMarkers(beat.markers, warnings),
      })),
    });
  }

  return flows;
}

function normalizeFlowBeatMarkers(
  markers: ParsedMarker[] | undefined,
  warnings: ParseWarning[],
): FlowBeatMarker[] | undefined {
  if (!markers || markers.length === 0) {
    return undefined;
  }

  const normalized: FlowBeatMarker[] = [];

  for (const marker of markers) {
    if (marker.kind === 'none') {
      warnings.push({ message: 'Ignoring [none] marker inside flow beat normalization.' });
      continue;
    }

    normalized.push({
      kind: marker.kind,
      value: marker.value,
    });
  }

  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeProseSlots(
  sections: Array<ParsedSimpleSection | ParsedKeyedSection>,
  warnings: ParseWarning[],
  errors: ParseError[],
): ProseSlot[] {
  const grouped = new Map<string, Array<ParsedSimpleSection | ParsedKeyedSection>>();

  for (const section of sections) {
    const trigger = mapSectionTriggerToProseTrigger(section.trigger);

    if (!trigger) {
      warnings.push({ message: `Skipping unsupported prose trigger ${section.trigger}.`, sectionOrder: section.order });
      continue;
    }

    const key = section.kind === 'keyed' ? section.key : undefined;
    const groupKey = `${trigger}::${key ?? ''}::${section.attempt ?? ''}`;
    const existing = grouped.get(groupKey) ?? [];
    existing.push(section);
    grouped.set(groupKey, existing);
  }

  const slots: ProseSlot[] = [];

  for (const [groupKey, groupedSections] of grouped.entries()) {
    const [trigger, key, attemptValue] = groupKey.split('::');
    const variants: ProseVariant[] = [];
    const explicitModes = new Set<ProseSelectionMode>();

    for (const section of groupedSections) {
      if (section.mode) {
        explicitModes.add(section.mode);
      }

      const variant = sectionBlocksToProseVariant(section.blocks, section.order, warnings, errors, section.weight);
      if (variant) {
        variants.push(variant);
      }
    }

    if (variants.length === 0) {
      continue;
    }

    const mode = resolveProseSelectionMode(groupedSections, variants, warnings);
    const attempt = attemptValue ? Number(attemptValue) : undefined;

    slots.push({
      id: buildProseSlotId(trigger, key || undefined, attempt),
      trigger: trigger as ProseTrigger,
      key: key || undefined,
      attempt,
      mode,
      variants,
    });
  }

  return slots;
}

function resolveProseSelectionMode(
  sections: Array<ParsedSimpleSection | ParsedKeyedSection>,
  variants: ProseVariant[],
  warnings: ParseWarning[],
): ProseSelectionMode {
  const explicitModes = Array.from(
    new Set(sections.flatMap((section) => (section.mode ? [section.mode] : []))),
  );

  if (explicitModes.length > 1) {
    warnings.push({ message: `Conflicting prose selection modes ${explicitModes.join(', ')} found for one slot; using ${explicitModes[0]}.` });
  }

  if (explicitModes.length > 0) {
    return explicitModes[0];
  }

  if (variants.some((variant) => variant.weight !== undefined)) {
    return 'weighted';
  }

  return variants.length === 1 ? 'constant' : 'random';
}

function buildProseSlotId(trigger: string, key?: string, attempt?: number): string {
  const baseId = key ? `${trigger}.${key}` : trigger;
  return attempt ? `${baseId}.attempt.${attempt}` : baseId;
}

function sectionBlocksToProseVariant(
  blocks: ParsedTextBlock[],
  order: number,
  warnings: ParseWarning[],
  errors: ParseError[],
  weight?: number,
): ProseVariant | undefined {
  let hasNone = false;
  const textParts: string[] = [];
  const proseBlocks: ProseTextBlock[] = [];

  for (const block of blocks) {
    const normalizedMarkers: FlowBeatMarker[] = [];

    if (block.markers) {
      for (const marker of block.markers) {
        if (marker.kind === 'none') {
          hasNone = true;
          continue;
        }

        normalizedMarkers.push({
          kind: marker.kind,
          value: marker.value,
        });
      }
    }

    if (block.text.length > 0) {
      textParts.push(block.text);
      proseBlocks.push({
        text: block.text,
        markers: normalizedMarkers.length > 0 ? normalizedMarkers : undefined,
      });
    }
  }

  const text = textParts.join('\n\n').trim();

  if (hasNone && text.length > 0) {
    errors.push({ message: 'Cannot normalize a prose variant as both [none] and text.', sectionOrder: order });
    return undefined;
  }

  if (hasNone) {
    return { kind: 'none', weight };
  }

  if (text.length === 0) {
    warnings.push({ message: 'Skipping empty prose section.', sectionOrder: order });
    return undefined;
  }

  return {
    kind: 'text',
    text,
    weight,
    blocks: proseBlocks.length > 0 ? proseBlocks : undefined,
  };
}

function mapSectionTriggerToProseTrigger(trigger: string): ProseTrigger | undefined {
  if (trigger === 'choice') {
    return 'choice_result';
  }

  if (trigger === 'poi') {
    return 'poi_inspect';
  }

  if (trigger === 'exit_glue') {
    return 'exit_glue';
  }

  if (trigger === 'exit_glue_random') {
    return 'exit_glue_random';
  }

  if (PROSE_TRIGGER_SET.has(trigger as ProseTrigger)) {
    return trigger as ProseTrigger;
  }

  return undefined;
}

export function asPathTraversalConfig(
  value: ParsedFrontMatterValue | undefined,
  errors: ParseError[],
): PathTraversalConfig | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const firstVisitMode = asOptionalTraversalMode(objectValue.firstVisitMode, 'traversal.firstVisitMode', errors);
  const repeatVisitMode = asOptionalTraversalMode(objectValue.repeatVisitMode, 'traversal.repeatVisitMode', errors);

  if (!firstVisitMode && !repeatVisitMode) {
    return undefined;
  }

  return {
    firstVisitMode,
    repeatVisitMode,
  };
}

export function asAreaBlockingConfig(
  value: ParsedFrontMatterValue | undefined,
  errors: ParseError[],
): AreaBlockingConfig | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const state = asOptionalBlockingState(objectValue.state, 'blocking.state', errors);

  if (!state) {
    return undefined;
  }

  return {
    state,
  };
}

export function asGatePresentationConfig(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): GatePresentationConfig | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const forward = asOptionalGatePresentationMode(objectValue.forward, 'presentation.forward', warnings);
  const backward = asOptionalGatePresentationMode(objectValue.backward, 'presentation.backward', warnings);

  if (!forward && !backward) {
    return undefined;
  }

  return {
    forward,
    backward,
  };
}

export function asPathBlockingConfig(
  value: ParsedFrontMatterValue | undefined,
  errors: ParseError[],
): PathBlockingConfig | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const forward = asOptionalBlockingState(objectValue.forward, 'blocking.forward', errors);
  const backward = asOptionalBlockingState(objectValue.backward, 'blocking.backward', errors);

  if (!forward && !backward) {
    return undefined;
  }

  return {
    forward,
    backward,
  };
}

export function asPathEndpoints(
  value: ParsedFrontMatterValue | undefined,
  errors: ParseError[],
): PathObject['endpoints'] | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    errors.push({ message: 'Expected endpoints object.' });
    return undefined;
  }

  const forward = asPathEndpoint(objectValue.forward, 'endpoints.forward', errors);
  const backward = asPathEndpoint(objectValue.backward, 'endpoints.backward', errors);

  if (!forward && !backward) {
    errors.push({ message: 'Expected at least one path endpoint.' });
    return undefined;
  }

  return {
    forward,
    backward,
  };
}

function asPathEndpoint(
  value: ParsedFrontMatterValue | undefined,
  fieldName: string,
  errors: ParseError[],
): PathObject['endpoints']['forward'] {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const from = asRequiredString(objectValue.from, `${fieldName}.from`, errors);
  const to = asRequiredString(objectValue.to, `${fieldName}.to`, errors);

  if (!from || !to) {
    return undefined;
  }

  return { from, to };
}

export function asSignalMap(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): Record<string, string | number | boolean> | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const normalized: Record<string, string | number | boolean> = {};

  for (const [key, entry] of Object.entries(objectValue)) {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      normalized[key] = entry;
      continue;
    }

    warnings.push({ message: `Skipping non-scalar signal value for ${key}.` });
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function asAreaNavigationLabels(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): AreaNavigationLabels | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const normalized: AreaNavigationLabels = {};

  for (const key of ['pois', 'choices', 'exits', 'controls'] as const) {
    const label = asOptionalString(objectValue[key]);

    if (label) {
      normalized[key] = label;
      continue;
    }

    if (objectValue[key] !== undefined) {
      warnings.push({ message: `Skipping non-string navigationLabels.${key}.` });
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function asControlLabels(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): ControlLabels | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const normalized: ControlLabels = {};

  for (const key of ['continue', 'skip', 'back'] as const) {
    const label = asOptionalString(objectValue[key]);

    if (label) {
      normalized[key] = label;
      continue;
    }

    if (objectValue[key] !== undefined) {
      warnings.push({ message: `Skipping non-string controlLabels.${key}.` });
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function asTitleScreenConfig(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): TitleScreenConfig | undefined {
  const objectValue = asObject(value);

  if (!objectValue) {
    return undefined;
  }

  const saveMode = asOptionalString(objectValue.saveMode);

  if (saveMode && !TITLE_SCREEN_SAVE_MODE_SET.has(saveMode as TitleScreenSaveMode)) {
    warnings.push({ message: `Skipping unsupported titleScreen.saveMode ${saveMode}.` });
    return undefined;
  }

  return saveMode ? { saveMode: saveMode as TitleScreenSaveMode } : undefined;
}

export function asPoiReferences(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): PoiReference[] | undefined {
  return asReferenceArray(value, false, warnings) as PoiReference[] | undefined;
}

export function asChoiceReferences(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): ChoiceReference[] | undefined {
  return asReferenceArray(value, false, warnings) as ChoiceReference[] | undefined;
}

export function asExitReferences(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): ExitReference[] | undefined {
  return asReferenceArray(value, true, warnings) as ExitReference[] | undefined;
}

function asReferenceArray(
  value: ParsedFrontMatterValue | undefined,
  requireTargetId: boolean,
  warnings: ParseWarning[],
): Array<PoiReference | ChoiceReference | ExitReference> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized: Array<PoiReference | ChoiceReference | ExitReference> = [];

  for (const entry of value) {
    const objectValue = asObject(entry);

    if (!objectValue) {
      warnings.push({ message: 'Skipping non-object reference entry.' });
      continue;
    }

    const id = asOptionalString(objectValue.id);
    const displayName = asOptionalString(objectValue.displayName);
    const key = asOptionalShortcutKey(objectValue.key);
    const targetId = asOptionalString(objectValue.targetId);

    if (!id || !displayName) {
      warnings.push({ message: 'Skipping reference entry missing id or displayName.' });
      continue;
    }

    if (requireTargetId) {
      if (!targetId) {
        warnings.push({ message: `Skipping exit reference ${id} missing targetId.` });
        continue;
      }

      normalized.push({ id, displayName, key, targetId });
      continue;
    }

    normalized.push({ id, displayName, key });
  }

  return normalized.length > 0 ? normalized : undefined;
}

export function asOptionalPresentationMode(
  value: ParsedFrontMatterValue | undefined,
  warnings: ParseWarning[],
): TraversalPresentationMode | 'full' | undefined {
  const stringValue = asOptionalString(value);

  if (!stringValue) {
    return undefined;
  }

  if (
    stringValue === 'normal' ||
    stringValue === 'passthrough' ||
    stringValue === 'walkpassthrough' ||
    stringValue === 'runpassthrough' ||
    stringValue === 'billboard' ||
    stringValue === 'full'
  ) {
    return stringValue;
  }

  warnings.push({ message: `Skipping unsupported presentationMode value ${stringValue}.` });
  return undefined;
}

function asOptionalGatePresentationMode(
  value: ParsedFrontMatterValue | undefined,
  fieldName: string,
  warnings: ParseWarning[],
): GatePresentationMode | undefined {
  const stringValue = asOptionalString(value);

  if (!stringValue) {
    return undefined;
  }

  if (GATE_PRESENTATION_MODE_SET.has(stringValue as GatePresentationMode)) {
    return stringValue as GatePresentationMode;
  }

  warnings.push({ message: `Skipping unsupported ${fieldName} value ${stringValue}.` });
  return undefined;
}

export function asOptionalBoolean(
  value: ParsedFrontMatterValue | undefined,
  fieldName: string,
  warnings: ParseWarning[],
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  warnings.push({ message: `Expected boolean for ${fieldName}.` });
  return undefined;
}

function asOptionalTraversalMode(
  value: ParsedFrontMatterValue | undefined,
  fieldName: string,
  errors: ParseError[],
): PathTraversalMode | undefined {
  const stringValue = asOptionalString(value);

  if (!stringValue) {
    return undefined;
  }

  if (PATH_TRAVERSAL_MODE_SET.has(stringValue as PathTraversalMode)) {
    return stringValue as PathTraversalMode;
  }

  errors.push({ message: `Unsupported traversal mode ${stringValue} for ${fieldName}.` });
  return undefined;
}

function asOptionalBlockingState(
  value: ParsedFrontMatterValue | undefined,
  fieldName: string,
  errors: ParseError[],
): PathBlockingState | undefined {
  const stringValue = asOptionalString(value);

  if (!stringValue) {
    return undefined;
  }

  if (PATH_BLOCKING_STATE_SET.has(stringValue as PathBlockingState)) {
    return stringValue as PathBlockingState;
  }

  errors.push({ message: `Unsupported blocking state ${stringValue} for ${fieldName}.` });
  return undefined;
}

export function asPathDirectionality(
  value: ParsedFrontMatterValue | undefined,
  errors: ParseError[],
): PathDirectionality | undefined {
  const stringValue = asOptionalString(value);

  if (!stringValue) {
    errors.push({ message: 'Expected directionality.' });
    return undefined;
  }

  if (PATH_DIRECTIONALITY_SET.has(stringValue as PathDirectionality)) {
    return stringValue as PathDirectionality;
  }

  errors.push({ message: `Unsupported directionality ${stringValue}.` });
  return undefined;
}

export function asOptionalPathDirectionality(
  value: ParsedFrontMatterValue | undefined,
  errors: ParseError[],
): PathDirectionality | undefined {
  const stringValue = asOptionalString(value);

  if (!stringValue) {
    return undefined;
  }

  if (PATH_DIRECTIONALITY_SET.has(stringValue as PathDirectionality)) {
    return stringValue as PathDirectionality;
  }

  errors.push({ message: `Unsupported directionality ${stringValue}.` });
  return undefined;
}

export function asRequiredString(
  value: ParsedFrontMatterValue | undefined,
  fieldName: string,
  errors: ParseError[],
): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  errors.push({ message: `Expected string for ${fieldName}.` });
  return undefined;
}

export function asRequiredNumber(
  value: ParsedFrontMatterValue | undefined,
  fieldName: string,
  errors: ParseError[],
): number | undefined {
  if (typeof value === 'number') {
    return value;
  }

  errors.push({ message: `Expected number for ${fieldName}.` });
  return undefined;
}

export function asOptionalString(value: ParsedFrontMatterValue | undefined): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalShortcutKey(value: ParsedFrontMatterValue | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

export function asStringArray(
  value: ParsedFrontMatterValue | undefined,
  fieldName: string,
  warnings: ParseWarning[],
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter((entry): entry is string => typeof entry === 'string');

  if (strings.length !== value.length) {
    warnings.push({ message: `Skipping non-string values in ${fieldName}.` });
  }

  return strings.length > 0 ? strings : undefined;
}

function asObject(value: ParsedFrontMatterValue | undefined): ParsedFrontMatterObject | undefined {
  return value && !Array.isArray(value) && typeof value === 'object' ? value : undefined;
}

function parseScalarValue(rawValue: string): ParsedFrontMatterScalar {
  const cleaned = stripWrappingQuotes(stripInlineComment(rawValue));

  if (cleaned === 'true') {
    return true;
  }

  if (cleaned === 'false') {
    return false;
  }

  if (cleaned === 'null') {
    return null;
  }

  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return Number(cleaned);
  }

  return cleaned;
}

function stripInlineComment(value: string): string {
  return value.replace(/\s+\/\/.*$/, '').trim();
}

function stripWrappingQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function countIndent(line: string): number {
  const match = /^(\s*)/.exec(line);
  return match ? match[1].length : 0;
}

function findNextMeaningfulIndex(
  lines: Array<{ line: string; lineNumber: number }>,
  startIndex: number,
): number {
  for (let index = startIndex; index < lines.length; index += 1) {
    const trimmed = lines[index].line.trim();

    if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
      return index;
    }
  }

  return -1;
}