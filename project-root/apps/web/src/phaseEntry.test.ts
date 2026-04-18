import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveObservedPhaseChange } from './phaseEntry';

test('observed phase change redirects when authored enter logic returns a destination node', () => {
  const decision = resolveObservedPhaseChange({
    previousObserved: {
      projectId: 'demo04',
      nodeId: 'building03_upstairs',
      phase: 'dusk',
    },
    nextObserved: {
      projectId: 'demo04',
      nodeId: 'building03_upstairs',
      phase: 'night',
    },
    outcome: {
      nextNodeId: 'building03groundfloor_sidewalk_east',
      nextPathDirection: 'backward',
      sessionState: {
        player: {
          active: { id: 'player_01' },
        },
      },
      logEntry: {
        id: 'boink',
        text: 'boink',
        createdAt: 1,
      },
    },
  });

  assert.deepEqual(decision, {
    kind: 'redirect',
    nextNodeId: 'building03groundfloor_sidewalk_east',
    nextPathDirection: 'backward',
    sessionState: {
      player: {
        active: { id: 'player_01' },
      },
    },
    logEntry: {
      id: 'boink',
      text: 'boink',
      createdAt: 1,
    },
  });
});

test('observed phase change appends log only when the phase changed on the same node without redirect', () => {
  const decision = resolveObservedPhaseChange({
    previousObserved: {
      projectId: 'demo04',
      nodeId: 'sidewalk_east',
      phase: 'dusk',
    },
    nextObserved: {
      projectId: 'demo04',
      nodeId: 'sidewalk_east',
      phase: 'night',
    },
    outcome: {
      logEntry: {
        id: 'door-lock',
        text: 'The door is shut and locked for the night.',
        createdAt: 2,
      },
      sessionState: {
        player: {
          active: { id: 'player_01' },
        },
      },
    },
    latestRecentEntryText: 'Older entry',
  });

  assert.deepEqual(decision, {
    kind: 'append',
    logEntry: {
      id: 'door-lock',
      text: 'The door is shut and locked for the night.',
      createdAt: 2,
    },
    sessionState: {
      player: {
        active: { id: 'player_01' },
      },
    },
    shouldAppendLog: true,
  });
});