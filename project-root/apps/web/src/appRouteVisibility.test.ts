import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectRouteState } from './projectSession';
import { buildVisibleBrowserPath, readAppRouteFromLocation, readInitialAppRouteFromLocation, shouldRenderJukeboxPlayback } from './App';

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

test('initial load ignores stored hidden project navigation and falls back to the visible path', () => {
  const projectRoute = buildProjectRouteState('demo04', {
    nodeId: 'building01_groundfloor',
    runNonce: 3,
  });

  assert.deepEqual(readInitialAppRouteFromLocation('/', { silofireRoute: projectRoute }), { kind: 'home' });
  assert.deepEqual(readInitialAppRouteFromLocation('/admin', { silofireRoute: projectRoute }), { kind: 'admin_overview' });
  assert.deepEqual(readInitialAppRouteFromLocation('/admin/projects/demo04', {
    silofireRoute: { kind: 'admin_project', projectId: 'demo04' },
  }), {
    kind: 'admin_project',
    projectId: 'demo04',
  });
});

test('jukebox playback only renders on the PrototypeHub lobby area page', () => {
  assert.equal(shouldRenderJukeboxPlayback('lobby_area', {
    kind: 'page',
    nodeId: 'lobby_area',
    nodeKind: 'area',
    title: 'Lobby',
    proseBlocks: [],
    recentLog: [],
    actions: [],
    controls: [],
  }), true);
  assert.equal(shouldRenderJukeboxPlayback('lobby_area', {
    kind: 'page',
    nodeId: 'lobby_area',
    nodeKind: 'path',
    title: 'Lobby Walk',
    proseBlocks: [],
    recentLog: [],
    actions: [],
    controls: [],
  }), false);
  assert.equal(shouldRenderJukeboxPlayback('title_screen', {
    kind: 'page',
    nodeId: 'title_screen',
    nodeKind: 'area',
    title: 'Title',
    proseBlocks: [],
    recentLog: [],
    actions: [],
    controls: [],
  }), false);
  assert.equal(shouldRenderJukeboxPlayback(undefined, undefined), false);
});