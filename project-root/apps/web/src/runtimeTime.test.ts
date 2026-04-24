import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRuntimeTimeLogEntry,
  hasMeaningfulTimeChange,
  isTimeLogEntry,
  resolveAssignedRuntimeTimeSnapshot,
  shouldAnnounceTime,
  shouldAnnounceTimeChange,
} from './runtimeTime';

test('assigned runtime time snapshot carries phase status text and folder visibility', () => {
  const snapshot = resolveAssignedRuntimeTimeSnapshot({
    projectId: 'demo04',
    timeSettings: {
      calendars: {
        block: {
          phases: [
            { id: 'day', durationMinutes: 1, statusText: ['Daylight flattens the block.'] },
          ],
        },
      },
      assignments: {
        defaultCalendar: 'block',
      },
      visibility: {
        defaultRecentLog: false,
        folders: {
          diorama: true,
        },
      },
    },
    nodeFoldersById: {
      sidewalk_east: ['diorama', 'diorama/block'],
    },
    nodeRegionsById: {
      sidewalk_east: 'diorama_block',
    },
  }, {
    calendarId: 'block',
    phase: 'day',
    nowMs: 0,
    source: 'server:clock',
  }, 'sidewalk_east');

  assert.equal(snapshot?.visibleInRecentLog, true);
  assert.equal(snapshot?.statusText[0], 'Daylight flattens the block.');
});

test('time log entry only materializes when visibility and status text are present', () => {
  const visibleEntry = buildRuntimeTimeLogEntry({
    calendarId: 'block',
    phase: 'dusk',
    statusText: ['The light starts going bronze across the block.'],
    visibleInRecentLog: true,
  });
  const hiddenEntry = buildRuntimeTimeLogEntry({
    calendarId: 'block',
    phase: 'dusk',
    statusText: ['The light starts going bronze across the block.'],
    visibleInRecentLog: false,
  });

  assert.equal(visibleEntry?.text, 'The light starts going bronze across the block.');
  assert.equal(visibleEntry?.lane, 'recent');
  assert.equal(hiddenEntry, undefined);
});

test('time log helpers detect authored time entries', () => {
  const timeEntry = buildRuntimeTimeLogEntry({
    calendarId: 'block',
    phase: 'night',
    statusText: ['The block turns reflective under the lamps.'],
    visibleInRecentLog: true,
  });
  const plainEntry = {
    id: 'ambient:walker_01:arrival:1',
    text: 'Walker arrives.',
  };

  assert.equal(isTimeLogEntry(timeEntry), true);
  assert.equal(isTimeLogEntry(plainEntry), false);
});

test('time announcement policy seeds on entry and suppresses duplicate restored time', () => {
  const snapshot = {
    calendarId: 'block',
    phase: 'day',
    statusText: ['Daylight flattens the block into a tidy row of surfaces and reflections.'],
    visibleInRecentLog: true,
  };
  const existingTimeEntry = buildRuntimeTimeLogEntry(snapshot);

  assert.equal(shouldAnnounceTime({
    reason: 'entry',
    snapshot,
    existingEntries: [],
  }), true);

  assert.equal(shouldAnnounceTime({
    reason: 'entry',
    snapshot,
    existingEntries: existingTimeEntry ? [existingTimeEntry] : [],
  }), false);
});

test('time announcement policy only announces changes when phase meaningfully changes', () => {
  const previousSnapshot = {
    calendarId: 'block',
    phase: 'day',
    statusText: ['Daylight flattens the block.'],
    visibleInRecentLog: true,
  };
  const nextSnapshot = {
    calendarId: 'block',
    phase: 'dusk',
    statusText: ['The light starts going bronze across the block.'],
    visibleInRecentLog: true,
  };

  assert.equal(hasMeaningfulTimeChange(previousSnapshot, nextSnapshot), true);
  assert.equal(shouldAnnounceTime({
    reason: 'change',
    snapshot: nextSnapshot,
    lastDisplayedSnapshot: previousSnapshot,
  }), true);
  assert.equal(shouldAnnounceTime({
    reason: 'change',
    snapshot: previousSnapshot,
    lastDisplayedSnapshot: previousSnapshot,
  }), false);
});

test('time change announcements fire on initial allowed entry and same-node phase change, but not on traversal back to a visible node', () => {
  const previousSnapshot = {
    calendarId: 'block',
    phase: 'day',
    statusText: ['Daylight flattens the block.'],
    visibleInRecentLog: true,
  };
  const nextSnapshot = {
    calendarId: 'block',
    phase: 'dusk',
    statusText: ['The light starts going bronze across the block.'],
    visibleInRecentLog: true,
  };

  assert.equal(shouldAnnounceTimeChange({
    currentNodeId: 'sidewalk_north',
    snapshot: nextSnapshot,
    existingEntries: [],
  }), true);

  assert.equal(shouldAnnounceTimeChange({
    previousNodeId: 'sidewalk_north',
    currentNodeId: 'sidewalk_north',
    previousSnapshot,
    snapshot: nextSnapshot,
  }), true);

  assert.equal(shouldAnnounceTimeChange({
    previousNodeId: 'sidewalk_north',
    currentNodeId: 'sidewalk_east',
    previousSnapshot,
    snapshot: nextSnapshot,
  }), false);

  assert.equal(shouldAnnounceTimeChange({
    previousNodeId: 'building04_groundfloor',
    currentNodeId: 'sidewalk_north',
    previousSnapshot: {
      ...nextSnapshot,
      visibleInRecentLog: false,
    },
    snapshot: nextSnapshot,
    existingEntries: [],
  }), false);

  const existingTimeEntry = buildRuntimeTimeLogEntry(nextSnapshot);

  assert.equal(shouldAnnounceTimeChange({
    previousNodeId: 'building04_groundfloor',
    currentNodeId: 'sidewalk_north',
    previousSnapshot: {
      ...nextSnapshot,
      visibleInRecentLog: false,
    },
    snapshot: nextSnapshot,
    existingEntries: existingTimeEntry ? [existingTimeEntry] : [],
  }), false);
});