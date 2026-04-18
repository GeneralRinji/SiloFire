import test from 'node:test';
import assert from 'node:assert/strict';

import { interpretAreaNode, interpretGateNode, interpretPathNode, toInterpretedExitAction } from './index';

test('toInterpretedExitAction maps exit references into interpreted actions', () => {
  const action = toInterpretedExitAction({
    id: 'harbor_edge',
    displayName: 'Back to Harbor Edge Road',
    key: 'H',
    targetId: 'harbor_edge_node',
  });

  assert.deepEqual(action, {
    id: 'harbor_edge',
    kind: 'exit',
    label: 'Back to Harbor Edge Road',
    key: 'H',
    targetId: 'harbor_edge_node',
  });
});

test('toInterpretedExitAction preserves missing optional keys', () => {
  const action = toInterpretedExitAction({
    id: 'net_shack',
    displayName: 'To Net Shack',
    targetId: 'net_shack_node',
  });

  assert.equal(action.key, undefined);
  assert.equal(action.targetId, 'net_shack_node');
  assert.equal(action.kind, 'exit');
});

test('interpretAreaNode surfaces selected prose and navigation actions', () => {
  const result = interpretAreaNode(
    {
      version: 1,
      templateSchema: 'area',
      templateSchemaVersion: 1,
      id: 'sunbleached_tree',
      displayName: 'Big O\' Sunbleached Tree',
      region: 'old_harbor',
      pois: [{ id: 'berries', displayName: 'Wild Raspberry Bush', key: 'W' }],
      choices: [{ id: 'walk', displayName: 'Walk', key: 'A' }],
      exits: [{ id: 'harbor_edge', displayName: 'Back to Harbor Edge Road', key: 'H', targetId: 'harbor_edge' }],
      proseSlots: [
        {
          id: 'enter',
          trigger: 'enter',
          mode: 'constant',
          variants: [{ kind: 'text', text: 'You hear children in the distance.' }],
        },
      ],
    },
    { proseSelections: [{ trigger: 'enter' }] },
  );

  assert.equal(result.proseBlocks?.[0]?.text, 'You hear children in the distance.');
  assert.equal(result.proseBlocks?.[0]?.groupId, 'enter');
  assert.equal(result.actions?.length, 3);
  assert.deepEqual(result.actions?.map((action) => action.kind), ['poi', 'choice', 'exit']);
});

test('interpretPathNode maps beats and default controls from the selected flow', () => {
  const result = interpretPathNode({
    version: 1,
    templateSchema: 'path',
    templateSchemaVersion: 1,
    id: 'harbor_edge_road',
    displayName: 'Old Harbor Edge Road',
    region: 'old_harbor',
    directionality: 'bidirectional',
    endpoints: {
      forward: { from: 'a', to: 'b' },
    },
    flows: [
      {
        id: 'flow:first_visit:forward',
        trigger: 'first_visit',
        direction: 'forward',
        beats: [{ kind: 'beat', text: 'The maintained road gives way without announcement.' }],
      },
    ],
  });

  assert.equal(result.proseBlocks?.[0]?.kind, 'beat');
  assert.equal(result.proseBlocks?.[0]?.text, 'The maintained road gives way without announcement.');
  assert.equal(result.proseBlocks?.[0]?.groupId, 'flow:first_visit:forward');
  assert.deepEqual(result.controls?.map((control) => control.kind), ['continue', 'skip', 'back']);
});

test('interpretGateNode prefers billboard prose and back control by default', () => {
  const result = interpretGateNode({
    version: 1,
    templateSchema: 'gate',
    templateSchemaVersion: 1,
    id: 'fish_shop_front',
    displayName: 'Fishmonger Shop Door',
    region: 'fishmonger_row',
    navigationLabels: {
      pois: 'Things To Try',
      choices: 'What You Decide',
      exits: 'Ways Out',
      controls: 'Threshold Controls',
    },
    controlLabels: {
      back: 'Step Away From The Door',
    },
    pois: [{ id: 'doorknock', displayName: 'Knock on the Door.', key: 'K' }],
    choices: [{ id: 'wait', displayName: 'Wait a Moment', key: 'W' }],
    exits: [{ id: 'turn_back', displayName: 'Turn Back', key: 'R', targetId: 'shack_run' }],
    proseSlots: [
      {
        id: 'enter',
        trigger: 'enter',
        mode: 'constant',
        variants: [{ kind: 'text', text: 'The shop front leans into the row.' }],
      },
      {
        id: 'billboard',
        trigger: 'billboard',
        mode: 'constant',
        variants: [{ kind: 'text', text: 'Closed.' }],
      },
    ],
  });

  assert.deepEqual(result.proseBlocks?.map((block) => block.text), ['Closed.', 'The shop front leans into the row.']);
  assert.deepEqual(result.actions?.map((action) => action.kind), ['poi', 'choice', 'exit']);
  assert.equal(result.controls?.[0]?.kind, 'back');
  assert.equal(result.controls?.[0]?.label, 'Step Away From The Door');
});

test('interpretGateNode uses direction-keyed visible prose and synthesized continue when a visible face has endpoints', () => {
  const result = interpretGateNode(
    {
      version: 1,
      templateSchema: 'gate',
      templateSchemaVersion: 1,
      id: 'junk_threshold',
      displayName: 'Junk Threshold',
      region: 'old_harbor',
      presentation: {
        forward: 'passthrough',
        backward: 'billboard',
      },
      endpoints: {
        forward: { from: 'shack_run2', to: 'junk_choke' },
        backward: { from: 'junk_choke', to: 'shack_run2' },
      },
      proseSlots: [
        {
          id: 'billboard.backward',
          trigger: 'billboard',
          key: 'backward',
          mode: 'constant',
          variants: [{ kind: 'text', text: 'The backside is all bent carts and splintered boards.' }],
        },
        {
          id: 'enter.backward',
          trigger: 'enter',
          key: 'backward',
          mode: 'constant',
          variants: [{ kind: 'text', text: 'You have to step over the junk to get back out.' }],
        },
      ],
    },
    { direction: 'backward' },
  );

  assert.deepEqual(result.proseBlocks?.map((block) => block.text), [
    'The backside is all bent carts and splintered boards.',
    'You have to step over the junk to get back out.',
  ]);
  assert.deepEqual(result.controls?.map((control) => control.kind), ['continue', 'back']);
});

test('interpretGateNode omits default back control for one-way gates', () => {
  const result = interpretGateNode({
    version: 1,
    templateSchema: 'gate',
    templateSchemaVersion: 1,
    id: 'magic_threshold',
    displayName: 'Magic Threshold',
    region: 'test_region',
    directionality: 'forward_only',
    proseSlots: [
      {
        id: 'billboard',
        trigger: 'billboard',
        mode: 'constant',
        variants: [{ kind: 'text', text: 'The air shimmers.' }],
      },
    ],
  });

  assert.equal(result.controls, undefined);
});

test('interpretGateNode prefers blocked prose, hides exits, and restores back control when a gate is blocked', () => {
  const result = interpretGateNode(
    {
      version: 1,
      templateSchema: 'gate',
      templateSchemaVersion: 1,
      id: 'blocked_threshold',
      displayName: 'Blocked Threshold',
      region: 'test_region',
      directionality: 'forward_only',
      blocking: {
        forward: 'blocked',
      },
      exits: [{ id: 'pass_through', displayName: 'Step Through', key: 'S', targetId: 'end_area' }],
      proseSlots: [
        {
          id: 'blocked.forward',
          trigger: 'blocked',
          key: 'forward',
          mode: 'constant',
          variants: [{ kind: 'text', text: 'A barricade blocks the threshold.' }],
        },
        {
          id: 'billboard',
          trigger: 'billboard',
          mode: 'constant',
          variants: [{ kind: 'text', text: 'This should not be used while blocked.' }],
        },
      ],
    },
    { blockedDirection: 'forward' },
  );

  assert.deepEqual(result.proseBlocks?.map((block) => block.text), ['A barricade blocks the threshold.']);
  assert.equal(result.actions, undefined);
  assert.deepEqual(result.controls?.map((control) => control.kind), ['back']);
});

test('interpretAreaNode resolves numbered attempt prose with fallback to the latest authored attempt', () => {
  const result = interpretAreaNode(
    {
      version: 1,
      templateSchema: 'area',
      templateSchemaVersion: 1,
      id: 'sunbleached_tree',
      displayName: 'Big O\' Sunbleached Tree',
      region: 'old_harbor',
      proseSlots: [
        {
          id: 'poi_inspect.wildraspberrybush.attempt.1',
          trigger: 'poi_inspect',
          key: 'wildraspberrybush',
          attempt: 1,
          mode: 'constant',
          variants: [{ kind: 'text', text: 'First try.' }],
        },
        {
          id: 'poi_inspect.wildraspberrybush.attempt.2',
          trigger: 'poi_inspect',
          key: 'wildraspberrybush',
          attempt: 2,
          mode: 'constant',
          variants: [{ kind: 'text', text: 'Second try.' }],
        },
      ],
    },
    { proseSelections: [{ trigger: 'poi_inspect', key: 'wildraspberrybush', attempt: 4 }], includePois: false, includeChoices: false, includeExits: false },
  );

  assert.equal(result.proseBlocks?.[0]?.text, 'Second try.');
});

test('interpretAreaNode supports weighted prose variants', () => {
  const originalRandom = Math.random;
  const randomValues = [0.2, 0.95];
  let randomIndex = 0;

  Math.random = () => {
    const value = randomValues[randomIndex] ?? 0;
    randomIndex += 1;
    return value;
  };

  try {
    const node = {
      version: 1,
      templateSchema: 'area' as const,
      templateSchemaVersion: 1,
      id: 'sunbleached_tree',
      displayName: 'Big O\' Sunbleached Tree',
      region: 'old_harbor',
      proseSlots: [
        {
          id: 'poi_inspect.adjacenttothetree.attempt.1',
          trigger: 'poi_inspect' as const,
          key: 'adjacenttothetree',
          attempt: 1,
          mode: 'weighted' as const,
          variants: [
            { kind: 'text' as const, text: 'Common line.', weight: 6 },
            { kind: 'text' as const, text: 'Rare line.', weight: 1 },
          ],
        },
      ],
    };

    const common = interpretAreaNode(node, {
      proseSelections: [{ trigger: 'poi_inspect', key: 'adjacenttothetree', attempt: 1 }],
      includePois: false,
      includeChoices: false,
      includeExits: false,
    });
    const rare = interpretAreaNode(node, {
      proseSelections: [{ trigger: 'poi_inspect', key: 'adjacenttothetree', attempt: 1 }],
      includePois: false,
      includeChoices: false,
      includeExits: false,
    });

    assert.equal(common.proseBlocks?.[0]?.text, 'Common line.');
    assert.equal(rare.proseBlocks?.[0]?.text, 'Rare line.');
  } finally {
    Math.random = originalRandom;
  }
});

test('interpretAreaNode cycles prose variants by occurrence count', () => {
  const node = {
    version: 1,
    templateSchema: 'area' as const,
    templateSchemaVersion: 1,
    id: 'sunbleached_tree',
    displayName: 'Big O\' Sunbleached Tree',
    region: 'old_harbor',
    proseSlots: [
      {
        id: 'enter',
        trigger: 'enter' as const,
        mode: 'cycle' as const,
        variants: [
          { kind: 'text' as const, text: 'prose1' },
          { kind: 'text' as const, text: 'prose2' },
          { kind: 'text' as const, text: 'prose3' },
        ],
      },
    ],
  };

  const first = interpretAreaNode(node, { proseSelections: [{ trigger: 'enter', occurrence: 1 }], includePois: false, includeChoices: false, includeExits: false });
  const second = interpretAreaNode(node, { proseSelections: [{ trigger: 'enter', occurrence: 2 }], includePois: false, includeChoices: false, includeExits: false });
  const third = interpretAreaNode(node, { proseSelections: [{ trigger: 'enter', occurrence: 3 }], includePois: false, includeChoices: false, includeExits: false });
  const fourth = interpretAreaNode(node, { proseSelections: [{ trigger: 'enter', occurrence: 4 }], includePois: false, includeChoices: false, includeExits: false });

  assert.equal(first.proseBlocks?.[0]?.text, 'prose1');
  assert.equal(second.proseBlocks?.[0]?.text, 'prose2');
  assert.equal(third.proseBlocks?.[0]?.text, 'prose3');
  assert.equal(fourth.proseBlocks?.[0]?.text, 'prose1');
});