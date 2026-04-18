import test from 'node:test';
import assert from 'node:assert/strict';

import { GATE_OBJECT_SAMPLE, GATE_OBJECT_SAMPLE_SOURCE_PATH } from '../../content/demo/archive/gateDemo';
import { parseGateDocument, parseGateToSchema } from './index';

test('parseGateDocument preserves billboard prose sections', () => {
  const result = parseGateDocument(GATE_OBJECT_SAMPLE, GATE_OBJECT_SAMPLE_SOURCE_PATH);

  assert.equal(result.errors.length, 0);
  assert.ok(result.document);
  assert.equal(result.document?.templateSchema, 'gate');
  assert.equal(result.document?.sections.length, 2);
  assert.equal(result.document?.sections[1]?.kind, 'simple');
  assert.equal(result.document?.sections[1]?.rawName, 'billboard');
});

test('parseGateToSchema normalizes directional presentation and prose slots', () => {
  const result = parseGateToSchema(GATE_OBJECT_SAMPLE, GATE_OBJECT_SAMPLE_SOURCE_PATH);

  assert.equal(result.errors.length, 0);
  assert.ok(result.value);
  assert.equal(result.value?.id, 'fish_shop_front_{guid}');
  assert.equal(result.value?.presentation?.forward, 'billboard');
  assert.equal(result.value?.proseSlots?.length, 2);
  assert.equal(result.value?.endpoints, undefined);

  const billboardSlot = result.value?.proseSlots?.find((slot) => slot.trigger === 'billboard');

  assert.equal(billboardSlot?.mode, 'constant');
  assert.equal(billboardSlot?.variants[0]?.kind, 'text');
});

test('parseGateToSchema accepts optional gate endpoints', () => {
  const gateWithEndpoints = `---
version: 1
templateSchema: gate
templateSchemaVersion: 1
id: threshold_gate
displayName: Threshold Gate
region: test_region
presentation:
  forward: passthrough
  backward: passthrough
endpoints:
  forward:
    from: area_a
    to: area_b
---

# Threshold Gate
`;

  const result = parseGateToSchema(gateWithEndpoints, 'ThresholdGate.md');

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.endpoints?.forward?.from, 'area_a');
  assert.equal(result.value?.endpoints?.forward?.to, 'area_b');
});

test('parseGateToSchema accepts optional gate directionality', () => {
  const gateWithDirectionality = `---
version: 1
templateSchema: gate
templateSchemaVersion: 1
id: threshold_gate
displayName: Threshold Gate
region: test_region
directionality: forward_only
presentation:
  forward: passthrough
endpoints:
  forward:
    from: area_a
    to: area_b
---

# Threshold Gate
`;

  const result = parseGateToSchema(gateWithDirectionality, 'ThresholdGate.md');

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.directionality, 'forward_only');
});

test('parseGateToSchema normalizes optional gate blocking and blocked prose slots', () => {
  const gateWithBlocking = `---
version: 1
templateSchema: gate
templateSchemaVersion: 1
id: threshold_gate
displayName: Threshold Gate
region: test_region
blocking:
  forward: blocked
presentation:
  forward: passthrough
endpoints:
  forward:
    from: area_a
    to: area_b
---

# Threshold Gate

## blocked:forward
The threshold is jammed shut.
`;

  const result = parseGateToSchema(gateWithBlocking, 'ThresholdGate.md');

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.blocking?.forward, 'blocked');
  assert.equal(
    result.value?.proseSlots?.find((slot) => slot.trigger === 'blocked' && slot.key === 'forward')?.variants[0]?.kind,
    'text',
  );
});

test('parseGateToSchema preserves directional gate prose keys', () => {
  const directionalGate = `---
version: 1
templateSchema: gate
templateSchemaVersion: 1
id: threshold_gate
displayName: Threshold Gate
region: test_region
presentation:
  forward: passthrough
  backward: billboard
endpoints:
  forward:
    from: area_a
    to: area_b
  backward:
    from: area_b
    to: area_a
---

# Threshold Gate

## enter:backward
You have to climb back over the mess.

## billboard:backward
The back side looks worse from here.
`;

  const result = parseGateToSchema(directionalGate, 'ThresholdGate.md');

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.presentation?.forward, 'passthrough');
  assert.equal(result.value?.presentation?.backward, 'billboard');
  assert.equal(
    result.value?.proseSlots?.find((slot) => slot.trigger === 'enter' && slot.key === 'backward')?.variants[0]?.kind,
    'text',
  );
  assert.equal(
    result.value?.proseSlots?.find((slot) => slot.trigger === 'billboard' && slot.key === 'backward')?.variants[0]?.kind,
    'text',
  );
});

test('parseGateToSchema normalizes optional gate pois and exits', () => {
  const gateWithInteractions = `---
version: 1
templateSchema: gate
templateSchemaVersion: 1
id: threshold_gate
displayName: Threshold Gate
region: test_region
navigationLabels:
  pois: Things To Try
  choices: What You Decide
  exits: Ways Out
  controls: Threshold Controls
controlLabels:
  back: Step Away
pois:
  - id: doorknock
    displayName: Knock on the Door.
choices:
  - id: wait
    displayName: Wait a Moment
exits:
  - id: turn_back
    displayName: Turn Back
    targetId: entry_area
---

# Threshold Gate

## poi:doorknock
Nobody answers.
`;

  const result = parseGateToSchema(gateWithInteractions, 'ThresholdGate.md');

  assert.equal(result.errors.length, 0);
  assert.equal(result.value?.navigationLabels?.pois, 'Things To Try');
  assert.equal(result.value?.controlLabels?.back, 'Step Away');
  assert.equal(result.value?.pois?.[0]?.id, 'doorknock');
  assert.equal(result.value?.choices?.[0]?.id, 'wait');
  assert.equal(result.value?.exits?.[0]?.targetId, 'entry_area');
  assert.equal(result.value?.proseSlots?.find((slot) => slot.trigger === 'poi_inspect' && slot.key === 'doorknock')?.variants[0]?.kind, 'text');
});

test('parseGateDocument reports template schema mismatches', () => {
  const wrongSchemaSample = `---
version: 1
templateSchema: area
templateSchemaVersion: 1
id: wrong_gate
displayName: Wrong Gate
region: fishmonger_row
---

# Wrong Gate

## enter
Still a gate-shaped thing.
`;

  const result = parseGateDocument(wrongSchemaSample, 'WrongGate.md');

  assert.ok(result.document);
  assert.ok(
    result.errors.some((error) => error.message === 'Expected templateSchema gate, received area.'),
  );
});