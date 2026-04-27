import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateSchedulerTasks,
  resolveNextTaskRunAtMs,
  type SchedulerTaskDefinition,
} from '../../../packages/runtime-server/src';

test('scheduler core resolves exact-time tasks at the configured millisecond', () => {
  const task: SchedulerTaskDefinition = {
    id: 'exact-maintenance',
    enabled: true,
    trigger: {
      kind: 'exact_time',
      atMs: 5_000,
    },
    payload: null,
  };

  assert.equal(resolveNextTaskRunAtMs(task, undefined, 1_000), 5_000);
});

test('scheduler core resolves armed delays from server-owned armed state', () => {
  const task: SchedulerTaskDefinition = {
    id: 'armed-followup',
    enabled: true,
    trigger: {
      kind: 'armed_delay',
      delayMs: 2_000,
    },
    payload: null,
  };

  assert.equal(resolveNextTaskRunAtMs(task, { armedAtMs: 3_000 }, 4_000), 5_000);
  assert.equal(resolveNextTaskRunAtMs(task, undefined, 4_000), undefined);
});

test('scheduler core evaluates due tasks and next wake time across mixed trigger kinds', () => {
  const result = evaluateSchedulerTasks([
    {
      id: 'due-exact',
      enabled: true,
      trigger: {
        kind: 'exact_time',
        atMs: 5_000,
      },
      payload: { kind: 'announcement' },
    },
    {
      id: 'future-interval',
      enabled: true,
      trigger: {
        kind: 'interval',
        everyMs: 1_000,
        startAtMs: 6_000,
      },
      payload: { kind: 'heartbeat' },
    },
    {
      id: 'armed-future',
      enabled: true,
      trigger: {
        kind: 'armed_delay',
        delayMs: 750,
      },
      payload: { kind: 'cooldown' },
    },
  ], {
    'armed-future': {
      armedAtMs: 4_500,
    },
  }, 5_000);

  assert.deepEqual(result.dueTaskIds, ['due-exact']);
  assert.equal(result.nextWakeAtMs, 5_250);
  assert.deepEqual(result.taskResults.map((task) => [task.id, task.nextRunAtMs]), [
    ['due-exact', 5_000],
    ['future-interval', 6_000],
    ['armed-future', 5_250],
  ]);
});