import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectRouteState, collectProjectNodeIds, omitProjectNodeScopedEntries, replaceProjectNodeScopedEntries, selectProjectNodeScopedEntries } from './projectSession';

test('project session route builder normalizes path beat state and run nonce increments', () => {
  const activeRoute = {
    kind: 'project' as const,
    projectId: 'demo04',
    nodeId: 'sidewalk_north',
    runNonce: 4,
  };

  assert.deepEqual(
    buildProjectRouteState('demo04', {
      nodeId: 'block_path',
      pathDirection: 'forward',
      runNonceIncrement: 1,
    }, activeRoute),
    {
      kind: 'project',
      projectId: 'demo04',
      nodeId: 'block_path',
      pathDirection: 'forward',
      pathBeatIndex: 0,
      runNonce: 5,
    },
  );

  assert.deepEqual(
    buildProjectRouteState('demo04', {
      nodeId: 'building01_groundfloor',
      runNonce: 9,
    }, activeRoute),
    {
      kind: 'project',
      projectId: 'demo04',
      nodeId: 'building01_groundfloor',
      pathDirection: undefined,
      pathBeatIndex: undefined,
      runNonce: 9,
    },
  );
});

test('project session helpers replace and select only project-scoped node maps', () => {
  const projectNodeIds = collectProjectNodeIds([
    { id: 'a' },
    { id: 'b' },
  ]);
  const current = {
    a: { count: 1 },
    b: { count: 2 },
    outside: { count: 3 },
  };

  assert.deepEqual(selectProjectNodeScopedEntries(current, projectNodeIds), {
    a: { count: 1 },
    b: { count: 2 },
  });

  assert.deepEqual(omitProjectNodeScopedEntries(current, projectNodeIds), {
    outside: { count: 3 },
  });

  assert.deepEqual(replaceProjectNodeScopedEntries(current, projectNodeIds, {
    a: { count: 11 },
  }), {
    outside: { count: 3 },
    a: { count: 11 },
  });
});