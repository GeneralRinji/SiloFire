import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRuntimeAmbientStreamUrl, resolveRuntimeAmbientNpcSnapshot, resolveRuntimeAmbientSnapshot } from './runtimeAmbient';

test('ambient npc route lingers then moves then reaches the next node', () => {
  const npc = {
    id: 'walker_01',
    displayName: 'Block Walker',
    route: {
      mode: 'loop',
      dwellSeconds: 10,
      moveSeconds: 5,
      steps: [
        { nodeId: 'sidewalk_north' },
        { nodeId: 'sidewalk_east' },
      ],
    },
    arrivalText: {
      shared: ['A walker comes around the block and briefly shares the sidewalk with you.'],
    },
    departureText: {
      shared: ['The walker keeps going, leaving the block to itself again.'],
    },
  };

  const atStart = resolveRuntimeAmbientNpcSnapshot(npc, 0, undefined, { routeIndex: 0 });
  const whileMoving = resolveRuntimeAmbientNpcSnapshot(npc, 10_001, undefined, { routeIndex: 0 });
  const atNextStop = resolveRuntimeAmbientNpcSnapshot(npc, 15_000, undefined, { routeIndex: 0 });

  assert.equal(atStart?.nodeId, 'sidewalk_north');
  assert.equal(atStart?.previousNodeId, 'sidewalk_north');
  assert.equal(atStart?.nextNodeId, 'sidewalk_north');
  assert.equal(atStart?.behavior, 'linger');
  assert.equal(whileMoving?.nodeId, undefined);
  assert.equal(whileMoving?.previousNodeId, 'sidewalk_north');
  assert.equal(whileMoving?.nextNodeId, 'sidewalk_east');
  assert.equal(whileMoving?.behavior, 'move');
  assert.equal(atNextStop?.nodeId, 'sidewalk_east');
  assert.equal(atNextStop?.previousNodeId, 'sidewalk_east');
  assert.equal(atNextStop?.nextNodeId, 'sidewalk_east');
  assert.equal(atNextStop?.behavior, 'linger');
});

test('ambient snapshot uses seeded npc route index and exposes all route npcs', () => {
  const snapshot = resolveRuntimeAmbientSnapshot({
    walker_01: {
      id: 'walker_01',
      displayName: 'Block Walker',
      route: {
        mode: 'loop',
        dwellSeconds: 10,
        moveSeconds: 5,
        steps: [
          { nodeId: 'sidewalk_north' },
          { nodeId: 'sidewalk_east' },
          { nodeId: 'sidewalk_south' },
        ],
      },
      arrivalText: { shared: ['arrive'] },
      departureText: { shared: ['depart'] },
    },
  }, 0, undefined, {
    walker_01: {
      routeIndex: 1,
      location: 'sidewalk_east',
    },
  });

  assert.equal(snapshot.npcs.length, 1);
  assert.equal(snapshot.npcs[0]?.nodeId, 'sidewalk_east');
  assert.equal(snapshot.npcs[0]?.previousNodeId, 'sidewalk_east');
  assert.equal(snapshot.npcs[0]?.nextNodeId, 'sidewalk_east');
  assert.equal(snapshot.npcs[0]?.displayName, 'Block Walker');
});

test('ambient stream url targets the shared runtime endpoint', () => {
  assert.equal(buildRuntimeAmbientStreamUrl('demo04'), '/api/runtime-ambient/demo04/stream');
});
