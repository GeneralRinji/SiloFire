import test from 'node:test';
import assert from 'node:assert/strict';

import type { InterpretedAreaNode, InterpretedGateNode, InterpretedPathNode } from '../../interpreter/src';
import { projectAreaNode, projectGateNode, projectNode, projectPathNode } from './index';

function assertProjectedPage(result: ReturnType<typeof projectNode>) {
  assert.equal(result.kind, 'page');

  if (result.kind !== 'page') {
    throw new Error('Expected a projected page.');
  }

  return result;
}

test('projectAreaNode builds a page with prose, actions, and key labels', () => {
  const input: InterpretedAreaNode = {
    node: {
      version: 1,
      templateSchema: 'area',
      templateSchemaVersion: 1,
      id: 'sunbleached_tree',
      displayName: 'Big O\' Sunbleached Tree',
      tagline: 'Leaning over the path',
      region: 'old_harbor',
    },
    proseBlocks: [
      {
        id: 'enter',
        groupId: 'enter',
        kind: 'paragraph',
        text: 'You hear children in the distance.',
        markers: [{ kind: 'fade', value: 'slow' }],
      },
    ],
    actions: [
      {
        id: 'harbor_edge',
        kind: 'exit',
        label: 'Back to Harbor Edge Road',
        key: 'H',
        targetId: 'harbor_edge',
      },
    ],
  };

  const result = assertProjectedPage(projectAreaNode(input));

  assert.equal(result.nodeKind, 'area');
  assert.equal(result.title, 'Big O\' Sunbleached Tree');
  assert.equal(result.tagline, 'Leaning over the path');
  assert.equal(result.proseBlocks.length, 1);
  assert.equal(result.proseBlocks[0]?.groupId, 'enter');
  assert.deepEqual(result.proseBlocks[0]?.markers, [{ kind: 'fade', value: 'slow' }]);
  assert.equal(result.actions[0]?.keyLabel, '[H]');
});

test('projectPathNode preserves beats and traversal controls', () => {
  const input: InterpretedPathNode = {
    node: {
      version: 1,
      templateSchema: 'path',
      templateSchemaVersion: 1,
      id: 'harbor_edge_path',
      displayName: 'Harbor Edge Road',
      region: 'old_harbor',
      directionality: 'bidirectional',
      endpoints: {
        forward: { from: 'a', to: 'b' },
      },
    },
    proseBlocks: [
      {
        id: 'beat-1',
        kind: 'beat',
        text: 'The sea sits closer here.',
      },
    ],
    controls: [
      {
        id: 'continue',
        kind: 'continue',
        label: 'Continue',
        key: 'A',
      },
      {
        id: 'back',
        kind: 'back',
        label: 'Back',
        key: 'B',
      },
    ],
  };

  const result = assertProjectedPage(projectPathNode(input));

  assert.equal(result.nodeKind, 'path');
  assert.equal(result.proseBlocks[0]?.kind, 'beat');
  assert.equal(result.controls.length, 2);
  assert.equal(result.controls[0]?.keyLabel, '[A]');
  assert.equal(result.controls[1]?.keyLabel, '[B]');
});

test('projectGateNode auto-advances explicit passthrough results', () => {
  const input: InterpretedGateNode = {
    node: {
      version: 1,
      templateSchema: 'gate',
      templateSchemaVersion: 1,
      id: 'shop_door',
      displayName: 'Fishmonger Shop Door',
      region: 'fishmonger_row',
      presentationMode: 'passthrough',
    },
    autoAdvance: true,
  };

  const result = projectGateNode(input);

  assert.deepEqual(result, {
    kind: 'auto_advance',
    nodeId: 'shop_door',
    nodeKind: 'gate',
  });
});

test('projectNode auto-advances empty passthrough pages', () => {
  const input: InterpretedGateNode = {
    node: {
      version: 1,
      templateSchema: 'gate',
      templateSchemaVersion: 1,
      id: 'side_door',
      displayName: 'Side Door',
      region: 'fishmonger_row',
      presentationMode: 'walkpassthrough',
    },
  };

  const result = projectNode(input);

  assert.equal(result.kind, 'auto_advance');
});

test('projectNode keeps a visible page when there is meaningful interaction', () => {
  const input: InterpretedGateNode = {
    node: {
      version: 1,
      templateSchema: 'gate',
      templateSchemaVersion: 1,
      id: 'closed_shop',
      displayName: 'Closed Shop',
      region: 'fishmonger_row',
      presentationMode: 'billboard',
    },
    proseBlocks: [
      {
        id: 'billboard',
        kind: 'paragraph',
        text: 'Closed.',
      },
    ],
    controls: [
      {
        id: 'back',
        kind: 'back',
        label: 'Back',
      },
    ],
  };

  const result = projectNode(input);

  assert.equal(result.kind, 'page');
});