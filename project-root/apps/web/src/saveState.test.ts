import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearProjectSnapshot,
  createSaveGameSnapshot,
  formatProjectSnapshotSummary,
  hasProjectSnapshot,
  loadProjectSnapshot,
  saveProjectSnapshot,
  shouldClearProjectSnapshotOnReset,
  shouldSaveProjectSnapshot,
} from './saveState';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test('save state round-trips a project snapshot', () => {
  const storage = new MemoryStorage();
  const snapshot = createSaveGameSnapshot({
    projectId: 'demo04',
    route: {
      nodeId: 'building01_groundfloor',
      runNonce: 2,
    },
    history: ['title_screen'],
    areaVisitCounts: { building01_groundfloor: 1 },
    pathVisitCounts: {},
    recentLogByNodeId: {
      building01_groundfloor: [
        {
          id: 'log-1',
          text: 'You pick up the vase.',
          createdAt: 123,
        },
      ],
    },
    actionAttemptsByNodeId: {
      building01_groundfloor: {
        'poi:vase_01': 1,
      },
    },
    sessionState: {
      player: {
        active: { id: 'player_01' },
      },
    },
  });

  saveProjectSnapshot(snapshot, storage);

  const loadedSnapshot = loadProjectSnapshot('demo04', storage);

  assert.equal(loadedSnapshot?.projectId, 'demo04');
  assert.equal(loadedSnapshot?.route.nodeId, 'building01_groundfloor');
  assert.equal(loadedSnapshot?.recentLogByNodeId.building01_groundfloor?.[0]?.text, 'You pick up the vase.');
  assert.equal(loadedSnapshot?.sessionState.player?.active?.id, 'player_01');
});

test('save state can report and clear project snapshots', () => {
  const storage = new MemoryStorage();
  const snapshot = createSaveGameSnapshot({
    projectId: 'demo04',
    route: {
      nodeId: 'title_screen',
      runNonce: 0,
    },
    history: [],
    areaVisitCounts: {},
    pathVisitCounts: {},
    recentLogByNodeId: {},
    actionAttemptsByNodeId: {},
    sessionState: {},
  });

  assert.equal(hasProjectSnapshot('demo04', storage), false);

  saveProjectSnapshot(snapshot, storage);

  assert.equal(hasProjectSnapshot('demo04', storage), true);

  clearProjectSnapshot('demo04', storage);

  assert.equal(hasProjectSnapshot('demo04', storage), false);
});

test('save state policy skips overwriting a single-save snapshot at the title screen', () => {
  assert.equal(
    shouldSaveProjectSnapshot({
      currentNodeId: 'title_screen',
      titleScreenSaveMode: 'single',
      sessionState: {},
    }),
    false,
  );

  assert.equal(
    shouldSaveProjectSnapshot({
      currentNodeId: 'title_screen',
      titleScreenSaveMode: 'multiple',
      sessionState: {},
    }),
    true,
  );

  assert.equal(
    shouldSaveProjectSnapshot({
      currentNodeId: 'building01_groundfloor',
      titleScreenSaveMode: 'single',
      sessionState: {},
    }),
    true,
  );
});

test('reset policy clears only single-save snapshots', () => {
  assert.equal(shouldClearProjectSnapshotOnReset('single'), true);
  assert.equal(shouldClearProjectSnapshotOnReset('multiple'), false);
  assert.equal(shouldClearProjectSnapshotOnReset(undefined), false);
});

test('snapshot summary includes last location and relative time', () => {
  const snapshot = createSaveGameSnapshot({
    projectId: 'demo04',
    route: {
      nodeId: 'building01_groundfloor',
      runNonce: 2,
    },
    history: ['title_screen'],
    areaVisitCounts: { building01_groundfloor: 1 },
    pathVisitCounts: {},
    recentLogByNodeId: {},
    actionAttemptsByNodeId: {},
    sessionState: {},
  });

  snapshot.savedAt = 1_000;

  assert.equal(
    formatProjectSnapshotSummary({
      snapshot,
      nodeLabel: 'Building 01 Groundfloor',
      now: 121_000,
    }),
    'Last: Building 01 Groundfloor | 2m ago',
  );
});