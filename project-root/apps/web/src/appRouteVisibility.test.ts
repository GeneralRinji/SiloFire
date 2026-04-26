import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectRouteState } from './projectSession';
import { buildVisibleBrowserPath, readAppRouteFromLocation } from './App';

test('project routes stay hidden in the visible browser path', () => {
  assert.equal(buildVisibleBrowserPath({ kind: 'home' }), '/');
  assert.equal(buildVisibleBrowserPath(buildProjectRouteState('demo04', { nodeId: 'building01_groundfloor', runNonce: 0 })), '/');
  assert.equal(buildVisibleBrowserPath({ kind: 'admin_overview' }), '/admin');
  assert.equal(buildVisibleBrowserPath({ kind: 'admin_project', projectId: 'demo04' }), '/admin/projects/demo04');
});

test('stored history route restores hidden project navigation', () => {
  const route = buildProjectRouteState('demo04', {
    nodeId: 'building01_groundfloor',
    runNonce: 3,
  });

  assert.deepEqual(readAppRouteFromLocation('/', { silofireRoute: route }), route);
  assert.deepEqual(readAppRouteFromLocation('/admin', { silofireRoute: route }), route);
});

test('pathname parsing still handles admin and direct project links', () => {
  assert.deepEqual(readAppRouteFromLocation('/admin', undefined), { kind: 'admin_overview' });
  assert.deepEqual(readAppRouteFromLocation('/admin/projects/demo04', undefined), {
    kind: 'admin_project',
    projectId: 'demo04',
  });
  assert.deepEqual(readAppRouteFromLocation('/projects/demo04/nodes/building01_groundfloor', undefined), buildProjectRouteState('demo04', {
    nodeId: 'building01_groundfloor',
    runNonce: 0,
  }));
});