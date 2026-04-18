import test from 'node:test';
import assert from 'node:assert/strict';

import {
  asExitReferences,
  asOptionalBoolean,
  asOptionalPresentationMode,
  asPathBlockingConfig,
  asPathDirectionality,
  asPathEndpoints,
  asPathTraversalConfig,
  asPoiReferences,
  asSignalMap,
  asStringArray,
  normalizePathFlows,
  normalizeProseSlots,
  parseNodeDocument,
} from './shared';
import type {
  ParseError,
  ParseWarning,
  ParsedFlowSection,
  ParsedFrontMatterValue,
  ParsedKeyedSection,
  ParsedSimpleSection,
} from './types';

test('parseNodeDocument parses front matter, title, sections, and body warnings', () => {
  const sample = `---
version: 1
templateSchema: area
templateSchemaVersion: 1
id: shared_parse_sample
displayName: Shared Parse Sample
region: old_harbor
tags:
  - harbor
  - demo
---

# Shared Parse Sample

Ignored loose line.

## enter
First line.
[fade: slow]
Second line.

## choice:inspect
Look closer.
`;

  const result = parseNodeDocument(sample, 'area', 'SharedParse.md');

  assert.equal(result.errors.length, 0);
  assert.ok(result.document);
  assert.equal(result.document?.sourcePath, 'SharedParse.md');
  assert.equal(result.document?.title, 'Shared Parse Sample');
  assert.equal(result.document?.sections.length, 2);
  assert.equal(result.document?.sections[0]?.kind, 'simple');
  assert.equal(result.document?.sections[1]?.kind, 'keyed');
  assert.ok(result.warnings.some((warning) => warning.message === 'Ignoring body content outside a section: Ignored loose line.'));

  const enterSection = result.document?.sections[0];
  if (!enterSection || enterSection.kind !== 'simple') {
    assert.fail('Expected first section to be a simple enter section.');
  }

  assert.equal(enterSection.blocks.length, 2);
  assert.deepEqual(enterSection.blocks[1]?.markers, [{ kind: 'fade', value: 'slow' }]);
  assert.equal(enterSection.blocks[1]?.text, 'Second line.');
});

test('parseNodeDocument attaches standalone markers written after a prose block to that same block', () => {
  const sample = `---
version: 1
templateSchema: area
templateSchemaVersion: 1
id: trailing_marker_sample
displayName: Trailing Marker Sample
region: old_harbor
---

# Trailing Marker Sample

## poi:wildraspberrybush
*Sigh*...
[fade: medium]
`;

  const result = parseNodeDocument(sample, 'area', 'TrailingMarker.md');
  const section = result.document?.sections[0];

  assert.equal(result.errors.length, 0);
  assert.equal(section?.kind, 'keyed');

  if (!section || section.kind !== 'keyed') {
    assert.fail('Expected a keyed berry section.');
  }

  assert.equal(section.blocks.length, 1);
  assert.equal(section.blocks[0]?.text, '*Sigh*...');
  assert.deepEqual(section.blocks[0]?.markers, [{ kind: 'fade', value: 'medium' }]);
});

test('parseNodeDocument splits consecutive marker runs between trailing and leading prose blocks', () => {
  const sample = `---
version: 1
templateSchema: area
templateSchemaVersion: 1
id: marker_split_sample
displayName: Marker Split Sample
region: old_harbor
---

# Marker Split Sample

## enter
[delay: long]
The tree creaks overhead.
[fade: out long]
[delay: long]
You pause, listening.
[fade: out long]
[delay: long]
Nothing answers back.
[fade: out long]
`;

  const result = parseNodeDocument(sample, 'area', 'MarkerSplit.md');
  const section = result.document?.sections[0];

  assert.equal(result.errors.length, 0);
  assert.equal(section?.kind, 'simple');

  if (!section || section.kind !== 'simple') {
    assert.fail('Expected a simple enter section.');
  }

  assert.equal(section.blocks.length, 3);
  assert.deepEqual(section.blocks[0]?.markers, [
    { kind: 'delay', value: 'long' },
    { kind: 'fade', value: 'out long' },
  ]);
  assert.deepEqual(section.blocks[1]?.markers, [
    { kind: 'delay', value: 'long' },
    { kind: 'fade', value: 'out long' },
  ]);
  assert.deepEqual(section.blocks[2]?.markers, [
    { kind: 'delay', value: 'long' },
    { kind: 'fade', value: 'out long' },
  ]);
});

test('parseNodeDocument parses numbered attempt prose headers for simple and keyed sections', () => {
  const sample = `---
version: 1
templateSchema: area
templateSchemaVersion: 1
id: attempt_sample
displayName: Attempt Sample
region: old_harbor
---

# Attempt Sample

## first_visit:2
Second arrival.

## poi:wildraspberrybush:3
Third berry check.
`;

  const result = parseNodeDocument(sample, 'area', 'AttemptSample.md');

  assert.equal(result.errors.length, 0);
  assert.equal(result.document?.sections.length, 2);
  assert.equal(result.document?.sections[0]?.kind, 'simple');
  assert.equal(result.document?.sections[0]?.kind === 'simple' ? result.document.sections[0].attempt : undefined, 2);
  assert.equal(result.document?.sections[1]?.kind, 'keyed');
  assert.equal(result.document?.sections[1]?.kind === 'keyed' ? result.document.sections[1].key : undefined, 'wildraspberrybush');
  assert.equal(result.document?.sections[1]?.kind === 'keyed' ? result.document.sections[1].attempt : undefined, 3);
});

test('parseNodeDocument parses prose heading mode and weight tokens', () => {
  const sample = `---
version: 1
templateSchema: area
templateSchemaVersion: 1
id: weighted_sample
displayName: Weighted Sample
region: old_harbor
---

# Weighted Sample

## poi:adjacenttothetree:1 @weighted @weight=1
Rare line.

## poi:adjacenttothetree:1 @weighted @weight=6
Common line.
`;

  const result = parseNodeDocument(sample, 'area', 'WeightedSample.md');
  const firstSection = result.document?.sections[0];
  const secondSection = result.document?.sections[1];

  assert.equal(result.errors.length, 0);
  assert.equal(firstSection?.kind, 'keyed');
  assert.equal(secondSection?.kind, 'keyed');

  if (!firstSection || firstSection.kind !== 'keyed' || !secondSection || secondSection.kind !== 'keyed') {
    assert.fail('Expected keyed sections for weighted prose headings.');
  }

  assert.equal(firstSection.mode, 'weighted');
  assert.equal(firstSection.weight, 1);
  assert.equal(secondSection.mode, 'weighted');
  assert.equal(secondSection.weight, 6);
});

test('normalizeProseSlots groups repeated keyed and unkeyed prose sections', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const sections: Array<ParsedSimpleSection | ParsedKeyedSection> = [
    {
      kind: 'simple',
      rawName: 'visit_random',
      trigger: 'visit_random',
      order: 1,
      blocks: [{ text: 'First random visit.' }],
    },
    {
      kind: 'simple',
      rawName: 'visit_random',
      trigger: 'visit_random',
      order: 2,
      blocks: [{ text: 'Second random visit.' }],
    },
    {
      kind: 'keyed',
      rawName: 'choice:walk',
      trigger: 'choice',
      key: 'walk',
      order: 3,
      blocks: [{ text: 'Take the long way.' }],
    },
    {
      kind: 'keyed',
      rawName: 'choice:walk',
      trigger: 'choice',
      key: 'walk',
      order: 4,
      blocks: [{ text: 'Keep it slow.' }],
    },
  ];

  const slots = normalizeProseSlots(sections, warnings, errors);

  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
  assert.equal(slots.length, 2);

  const visitRandomSlot = slots.find((slot) => slot.trigger === 'visit_random');
  const walkChoiceSlot = slots.find((slot) => slot.trigger === 'choice_result' && slot.key === 'walk');

  assert.equal(visitRandomSlot?.mode, 'random');
  assert.equal(visitRandomSlot?.variants.length, 2);
  assert.equal(walkChoiceSlot?.mode, 'random');
  assert.equal(walkChoiceSlot?.variants.length, 2);
});

test('normalizeProseSlots keeps numbered attempts in separate slots', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const sections: Array<ParsedSimpleSection | ParsedKeyedSection> = [
    {
      kind: 'keyed',
      rawName: 'poi:wildraspberrybush:1',
      trigger: 'poi',
      key: 'wildraspberrybush',
      attempt: 1,
      order: 1,
      blocks: [{ text: 'First try.' }],
    },
    {
      kind: 'keyed',
      rawName: 'poi:wildraspberrybush:2',
      trigger: 'poi',
      key: 'wildraspberrybush',
      attempt: 2,
      order: 2,
      blocks: [{ text: 'Second try.' }],
    },
  ];

  const slots = normalizeProseSlots(sections, warnings, errors);

  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
  assert.equal(slots.length, 2);
  assert.deepEqual(slots.map((slot) => slot.attempt), [1, 2]);
  assert.deepEqual(slots.map((slot) => slot.key), ['wildraspberrybush', 'wildraspberrybush']);
});

test('normalizeProseSlots preserves weighted prose variants and weighted mode', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const sections: Array<ParsedSimpleSection | ParsedKeyedSection> = [
    {
      kind: 'keyed',
      rawName: 'poi:adjacenttothetree:1 @weighted @weight=6',
      trigger: 'poi',
      key: 'adjacenttothetree',
      attempt: 1,
      mode: 'weighted',
      weight: 6,
      order: 1,
      blocks: [{ text: 'Common line.' }],
    },
    {
      kind: 'keyed',
      rawName: 'poi:adjacenttothetree:1 @weighted @weight=1',
      trigger: 'poi',
      key: 'adjacenttothetree',
      attempt: 1,
      mode: 'weighted',
      weight: 1,
      order: 2,
      blocks: [{ text: 'Rare line.' }],
    },
  ];

  const slots = normalizeProseSlots(sections, warnings, errors);

  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
  assert.equal(slots.length, 1);
  assert.equal(slots[0]?.mode, 'weighted');
  assert.deepEqual(
    slots[0]?.variants.map((variant) => variant.weight),
    [6, 1],
  );
});

test('normalizeProseSlots rejects prose variants that mix [none] and text', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const sections: ParsedSimpleSection[] = [
    {
      kind: 'simple',
      rawName: 'enter',
      trigger: 'enter',
      order: 1,
      blocks: [
        {
          text: 'This should fail.',
          markers: [{ kind: 'none' }],
        },
      ],
    },
  ];

  const slots = normalizeProseSlots(sections, warnings, errors);

  assert.equal(slots.length, 0);
  assert.ok(errors.some((error) => error.message === 'Cannot normalize a prose variant as both [none] and text.'));
});

test('normalizeProseSlots preserves delay and fade markers inside prose text blocks', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const sections: ParsedSimpleSection[] = [
    {
      kind: 'simple',
      rawName: 'enter',
      trigger: 'enter',
      order: 1,
      blocks: [
        { text: 'First line.' },
        { text: 'Second line.', markers: [{ kind: 'delay', value: 'medium' }] },
        { text: 'Third line.', markers: [{ kind: 'fade', value: 'slow' }] },
      ],
    },
  ];

  const slots = normalizeProseSlots(sections, warnings, errors);

  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
  assert.equal(slots.length, 1);
  const variant = slots[0]?.variants[0];

  assert.equal(variant?.kind, 'text');

  if (!variant || variant.kind !== 'text') {
    assert.fail('Expected a text prose variant.');
  }

  assert.equal(variant.text, 'First line.\n\nSecond line.\n\nThird line.');
  assert.deepEqual(variant.blocks, [
    { text: 'First line.', markers: undefined },
    { text: 'Second line.', markers: [{ kind: 'delay', value: 'medium' }] },
    { text: 'Third line.', markers: [{ kind: 'fade', value: 'slow' }] },
  ]);
});

test('normalizePathFlows converts valid sections and keeps beat markers', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const sections: ParsedFlowSection[] = [
    {
      kind: 'flow',
      rawName: 'flow:first_visit:forward',
      trigger: 'first_visit',
      direction: 'forward',
      order: 1,
      beats: [
        {
          kind: 'beat',
          text: 'Forward motion.',
          markers: [{ kind: 'delay', value: 'slow' }],
        },
      ],
    },
  ];

  const flows = normalizePathFlows(sections, warnings, errors);

  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
  assert.equal(flows.length, 1);
  assert.equal(flows[0]?.trigger, 'first_visit');
  assert.equal(flows[0]?.direction, 'forward');
  assert.deepEqual(flows[0]?.beats[0]?.markers, [{ kind: 'delay', value: 'slow' }]);
});

test('normalizePathFlows reports unsupported triggers and ignores [none] beat markers', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const sections: ParsedFlowSection[] = [
    {
      kind: 'flow',
      rawName: 'flow:unknown:forward',
      trigger: 'unknown',
      direction: 'forward',
      order: 1,
      beats: [{ kind: 'beat', text: 'Should fail.' }],
    },
    {
      kind: 'flow',
      rawName: 'flow:repeat:backward',
      trigger: 'repeat',
      direction: 'backward',
      order: 2,
      beats: [
        {
          kind: 'beat',
          text: 'Return trip.',
          markers: [{ kind: 'none' }, { kind: 'fade', value: 'fast' }],
        },
      ],
    },
  ];

  const flows = normalizePathFlows(sections, warnings, errors);

  assert.equal(flows.length, 1);
  assert.ok(errors.some((error) => error.message === 'Unsupported path flow trigger unknown.'));
  assert.ok(warnings.some((warning) => warning.message === 'Ignoring [none] marker inside flow beat normalization.'));
  assert.deepEqual(flows[0]?.beats[0]?.markers, [{ kind: 'fade', value: 'fast' }]);
});

test('shared coercion helpers normalize valid front matter values', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];

  const traversal = asPathTraversalConfig(
    {
      firstVisitMode: 'paged',
      repeatVisitMode: 'compressed',
    },
    errors,
  );
  const blocking = asPathBlockingConfig(
    {
      forward: 'open',
      backward: 'blocked',
    },
    errors,
  );
  const endpoints = asPathEndpoints(
    {
      forward: { from: 'area_a', to: 'area_b' },
      backward: { from: 'area_b', to: 'area_a' },
    },
    errors,
  );
  const signals = asSignalMap(
    {
      decay: 'medium',
      visited: true,
      count: 2,
    },
    warnings,
  );
  const pois = asPoiReferences(
    [{ id: 'tree', displayName: 'Tree', key: 'T' }],
    warnings,
  );
  const exits = asExitReferences(
    [{ id: 'harbor', displayName: 'Harbor', key: 'H', targetId: 'harbor_edge' }],
    warnings,
  );

  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
  assert.equal(traversal?.firstVisitMode, 'paged');
  assert.equal(blocking?.backward, 'blocked');
  assert.equal(endpoints?.forward?.to, 'area_b');
  assert.deepEqual(signals, { decay: 'medium', visited: true, count: 2 });
  assert.equal(pois?.[0]?.id, 'tree');
  assert.equal(exits?.[0]?.targetId, 'harbor_edge');
  assert.equal(asOptionalPresentationMode('billboard', warnings), 'billboard');
  assert.equal(asOptionalBoolean(true, 'passthrough', warnings), true);
  assert.equal(asPathDirectionality('forward_only', errors), 'forward_only');
  assert.deepEqual(asStringArray(['harbor', 'quiet'], 'tags', warnings), ['harbor', 'quiet']);
});

test('reference arrays preserve numeric shortcut keys as strings', () => {
  const warnings: ParseWarning[] = [];

  const exits = asExitReferences(
    [{ id: 'harbor', displayName: 'Harbor', key: 1, targetId: 'harbor_edge' }],
    warnings,
  );

  assert.equal(warnings.length, 0);
  assert.equal(exits?.[0]?.key, '1');
});

test('shared coercion helpers report invalid values without throwing', () => {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];

  const badTraversal = asPathTraversalConfig({ firstVisitMode: 'instant' }, errors);
  const badBlocking = asPathBlockingConfig({ forward: 'sealed' }, errors);
  const badEndpoints = asPathEndpoints({ forward: { from: 'area_a' } }, errors);
  const badSignals = asSignalMap({ nested: { value: true } as ParsedFrontMatterValue }, warnings);
  const badPois = asPoiReferences([{ displayName: 'Missing Id' }], warnings);
  const badPresentation = asOptionalPresentationMode('glitch', warnings);
  const badBoolean = asOptionalBoolean('true', 'passthrough', warnings);
  const badDirectionality = asPathDirectionality('sideways', errors);
  const mixedTags = asStringArray(['harbor', 12], 'tags', warnings);

  assert.equal(badTraversal, undefined);
  assert.equal(badBlocking, undefined);
  assert.equal(badEndpoints, undefined);
  assert.equal(badSignals, undefined);
  assert.equal(badPois, undefined);
  assert.equal(badPresentation, undefined);
  assert.equal(badBoolean, undefined);
  assert.equal(badDirectionality, undefined);
  assert.deepEqual(mixedTags, ['harbor']);

  assert.ok(errors.some((error) => error.message === 'Unsupported traversal mode instant for traversal.firstVisitMode.'));
  assert.ok(errors.some((error) => error.message === 'Unsupported blocking state sealed for blocking.forward.'));
  assert.ok(errors.some((error) => error.message === 'Expected string for endpoints.forward.to.'));
  assert.ok(errors.some((error) => error.message === 'Unsupported directionality sideways.'));
  assert.ok(warnings.some((warning) => warning.message === 'Skipping non-scalar signal value for nested.'));
  assert.ok(warnings.some((warning) => warning.message === 'Skipping reference entry missing id or displayName.'));
  assert.ok(warnings.some((warning) => warning.message === 'Skipping unsupported presentationMode value glitch.'));
  assert.ok(warnings.some((warning) => warning.message === 'Expected boolean for passthrough.'));
  assert.ok(warnings.some((warning) => warning.message === 'Skipping non-string values in tags.'));
});