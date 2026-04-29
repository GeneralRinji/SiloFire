import test from 'node:test';
import assert from 'node:assert/strict';

import { AREA_OBJECT_SAMPLE, AREA_OBJECT_SAMPLE_SOURCE_PATH } from '../../content/demo/archive/areaDemo';
import { parseAreaDocument, parseAreaToSchema } from './index';

test('parseAreaDocument preserves repeated and keyed sections', () => {
  const result = parseAreaDocument(AREA_OBJECT_SAMPLE, AREA_OBJECT_SAMPLE_SOURCE_PATH);

  assert.equal(result.errors.length, 0);
  assert.ok(result.document);
  assert.equal(result.document?.templateSchema, 'area');
  assert.equal(result.document?.sections.length, 17);

  const repeatVisitSections = result.document?.sections.filter(
    (section) => section.kind === 'simple' && section.trigger === 'repeat_visit',
  ) ?? [];
  const walkChoiceSections = result.document?.sections.filter(
    (section) => section.kind === 'keyed' && section.trigger === 'choice' && section.key === 'walk',
  ) ?? [];

  assert.equal(repeatVisitSections.length, 3);
  assert.equal(walkChoiceSections.length, 2);
});

test('parseAreaToSchema groups repeated prose and normalizes references', () => {
  const result = parseAreaToSchema(AREA_OBJECT_SAMPLE, AREA_OBJECT_SAMPLE_SOURCE_PATH);

  assert.equal(result.errors.length, 0);
  assert.ok(result.value);
  assert.equal(result.value?.id, 'sunbleached_tree_{guid}');
  assert.equal(result.value?.navigationLabels?.exits, 'Ways Out');
  assert.equal(result.value?.pois?.length, 3);
  assert.equal(result.value?.choices?.length, 2);
  assert.equal(result.value?.exits?.length, 2);

  const repeatVisitSlot = result.value?.proseSlots?.find((slot) => slot.trigger === 'repeat_visit');
  const walkChoiceSlot = result.value?.proseSlots?.find(
    (slot) => slot.trigger === 'choice_result' && slot.key === 'walk',
  );
  const walkGlueRandomSlot = result.value?.proseSlots?.find(
    (slot) => slot.trigger === 'exit_glue_random' && slot.key === 'walk',
  );

  assert.equal(repeatVisitSlot?.mode, 'random');
  assert.equal(repeatVisitSlot?.variants.length, 3);
  assert.equal(walkChoiceSlot?.variants.length, 2);
  assert.equal(walkGlueRandomSlot?.variants.length, 3);
});

test('parseAreaToSchema preserves optional area navigation labels', () => {
  const result = parseAreaToSchema(`---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: labeled_area
displayName: Labeled Area
region: old_harbor

navigationLabels:
  exits: Ways Out
  choices: What You Do
---

# Labeled Area

## enter
Hello.
`);

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.navigationLabels?.exits, 'Ways Out');
  assert.equal(result.value?.navigationLabels?.choices, 'What You Do');
  assert.equal(result.value?.navigationLabels?.pois, undefined);
});

test('parseAreaToSchema preserves optional area blocking state', () => {
  const result = parseAreaToSchema(`---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: blocked_area
displayName: Blocked Area
region: old_harbor

blocking:
  state: blocked
---

# Blocked Area

## blocked
No way through.
`);

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.blocking?.state, 'blocked');
});

test('parseAreaToSchema preserves optional title screen save mode', () => {
  const result = parseAreaToSchema(`---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: title_screen
displayName: Title Screen
region: system

titleScreen:
  saveMode: single
---

# Title Screen

## enter
Hello.
`);

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.titleScreen?.saveMode, 'single');
});

test('parseAreaToSchema preserves typed fixtures for area nodes', () => {
  const result = parseAreaToSchema(`---
version: 1
templateSchema: area
templateSchemaVersion: 1

id: fixture_area
displayName: Fixture Area
region: system

fixtures:
  - id: lobby_jukebox
    kind: jukebox
    displayName: Lobby Jukebox
    key: J
    stateId: lobby_jukebox
    maxQueueLength: 20
    defaultTrackId: house_mix
    defaultTrackLabel: House Mix
---

# Fixture Area

## enter
Hello.
`);

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.fixtures?.length, 1);
  assert.equal(result.value?.fixtures?.[0]?.kind, 'jukebox');
  assert.equal(result.value?.fixtures?.[0]?.stateId, 'lobby_jukebox');
  assert.equal(result.value?.fixtures?.[0]?.maxQueueLength, 20);
  assert.equal(result.value?.fixtures?.[0]?.defaultTrackLabel, 'House Mix');
});

test('parseAreaDocument reports malformed front matter delimiters', () => {
  const malformedFrontMatterSample = `---
version: 1
templateSchema: area
templateSchemaVersion: 1
id: broken_area
displayName: Broken Area
region: old_harbor

# Broken Area

## enter
This never reaches a valid document body split.
`;

  const result = parseAreaDocument(malformedFrontMatterSample, 'BrokenArea.md');

  assert.equal(result.document, undefined);
  assert.ok(
    result.errors.some((error) => error.message === 'Missing closing front matter delimiter.'),
  );
});