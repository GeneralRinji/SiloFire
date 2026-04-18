import test from 'node:test';
import assert from 'node:assert/strict';

import { PATH_OBJECT_SAMPLE, PATH_OBJECT_SAMPLE_SOURCE_PATH } from '../../content/demo/archive/pathDemo';
import { parsePathDocument, parsePathToSchema } from './index';

test('parsePathDocument preserves the expected path section structure', () => {
  const result = parsePathDocument(PATH_OBJECT_SAMPLE, PATH_OBJECT_SAMPLE_SOURCE_PATH);

  assert.equal(result.errors.length, 0);
  assert.ok(result.document);
  assert.equal(result.document?.templateSchema, 'path');
  assert.equal(result.document?.sections.length, 5);

  const flowSections = result.document?.sections.filter((section) => section.kind === 'flow') ?? [];

  assert.equal(flowSections.length, 5);
  assert.equal(flowSections[0]?.rawName, 'flow:first_visit:forward');
  assert.equal(flowSections[0]?.beats.length, 3);
  assert.equal(flowSections[4]?.rawName, 'flow:block:backward');
});

test('parsePathToSchema normalizes traversal, blocking, endpoints, and flows', () => {
  const result = parsePathToSchema(PATH_OBJECT_SAMPLE, PATH_OBJECT_SAMPLE_SOURCE_PATH);

  assert.equal(result.errors.length, 0);
  assert.ok(result.value);
  assert.equal(result.value?.id, 'old_harbor_edge_road_{guid}');
  assert.equal(result.value?.directionality, 'bidirectional');
  assert.equal(result.value?.traversal?.firstVisitMode, 'paged');
  assert.equal(result.value?.traversal?.repeatVisitMode, 'compressed');
  assert.equal(result.value?.blocking?.backward, 'blocked');
  assert.equal(result.value?.endpoints?.forward?.to, 'net_shack_{guid}');
  assert.equal(result.value?.flows?.length, 5);
  assert.equal(result.value?.flows?.[0]?.beats.length, 3);
  assert.equal(result.value?.flows?.[0]?.beats[0]?.text, 'The maintained road gives way without announcement.');
});

test('parsePathToSchema rejects unsupported flow directions', () => {
  const invalidDirectionSample = `---
version: 1
templateSchema: path
templateSchemaVersion: 1
id: bad_direction_path
displayName: Bad Direction Path
region: old_harbor
directionality: bidirectional
endpoints:
  forward:
    from: area_a
    to: area_b
---

# Bad Direction Path

## flow:first_visit:sideways

### beat
This should not normalize.
`;

  const result = parsePathToSchema(invalidDirectionSample, 'BadDirectionPath.md');

  assert.ok(result.value);
  assert.equal(result.value?.flows, undefined);
  assert.ok(
    result.errors.some((error) => error.message === 'Unsupported or missing path flow direction sideways.'),
  );
});

test('parsePathToSchema rejects [none] markers inside flow beats', () => {
  const invalidNoneBeatSample = `---
version: 1
templateSchema: path
templateSchemaVersion: 1
id: bad_none_path
displayName: Bad None Path
region: old_harbor
directionality: bidirectional
endpoints:
  forward:
    from: area_a
    to: area_b
---

# Bad None Path

## flow:first_visit:forward

### beat
[none]
`;

  const result = parsePathToSchema(invalidNoneBeatSample, 'BadNonePath.md');

  assert.equal(result.value, undefined);
  assert.ok(
    result.errors.some((error) => error.message === 'Flow beats cannot normalize [none] markers.'),
  );
});