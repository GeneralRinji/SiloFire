import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRuntimeClockStreamUrl, createServerRuntimeClockSource, formatPreviewClockCountdown, resolvePreviewRuntimeClockSnapshot, resolveProjectClockSnapshot, type RuntimeClockStream } from './runtimeClock';

test('preview runtime clock rotates earth-like phases using authored minutes per phase', () => {
  const timeSettings = {
    calendars: {
      default_world: {
        preset: 'earth_like_4phase',
        minutesPerPhase: 1,
      },
    },
    assignments: {
      defaultCalendar: 'default_world',
    },
  };

  const atStart = resolvePreviewRuntimeClockSnapshot(timeSettings, 0, 0);
  const afterOneMinute = resolvePreviewRuntimeClockSnapshot(timeSettings, 60_000, 0);
  const afterTwoMinutes = resolvePreviewRuntimeClockSnapshot(timeSettings, 120_000, 0);

  assert.equal(atStart?.phase, 'day');
  assert.equal(afterOneMinute?.phase, 'evening');
  assert.equal(afterTwoMinutes?.phase, 'night');
  assert.deepEqual(atStart?.cycle, ['day', 'evening', 'night', 'morning']);
});

test('preview runtime clock can use authored fallback cycle ids from world state', () => {
  const timeSettings = {
    calendars: {
      default_world: {
        preset: 'earth_like_4phase',
        minutesPerPhase: 1,
      },
    },
    assignments: {
      defaultCalendar: 'default_world',
    },
  };

  const atStart = resolvePreviewRuntimeClockSnapshot(timeSettings, 0, 0, ['day', 'dusk', 'night', 'dawn']);
  const afterThreeMinutes = resolvePreviewRuntimeClockSnapshot(timeSettings, 180_000, 0, ['day', 'dusk', 'night', 'dawn']);

  assert.equal(atStart?.phase, 'day');
  assert.equal(afterThreeMinutes?.phase, 'dawn');
  assert.deepEqual(atStart?.cycle, ['day', 'dusk', 'night', 'dawn']);
});

test('preview runtime clock honors authored custom phase durations', () => {
  const timeSettings = {
    calendars: {
      moon_colony: {
        phases: [
          { id: 'silver_dawn', durationMinutes: 2 },
          { id: 'long_glow', durationMinutes: 3 },
        ],
      },
    },
    assignments: {
      defaultCalendar: 'moon_colony',
    },
  };

  const atStart = resolvePreviewRuntimeClockSnapshot(timeSettings, 0, 0);
  const beforeSwap = resolvePreviewRuntimeClockSnapshot(timeSettings, 119_000, 0);
  const afterSwap = resolvePreviewRuntimeClockSnapshot(timeSettings, 121_000, 0);

  assert.equal(atStart?.phase, 'silver_dawn');
  assert.equal(beforeSwap?.phase, 'silver_dawn');
  assert.equal(afterSwap?.phase, 'long_glow');
});

test('preview clock countdown formats compactly for sidebar display', () => {
  assert.equal(formatPreviewClockCountdown(59_001), '1m 00s');
  assert.equal(formatPreviewClockCountdown(8_500), '9s');
});

test('project clock snapshot honors region calendar assignments for a node', () => {
  const snapshot = resolveProjectClockSnapshot({
    projectId: 'demo04',
    timeSettings: {
      calendars: {
        block: {
          preset: 'earth_like_4phase',
          minutesPerPhase: 1,
        },
        archive: {
          phases: [
            { id: 'silver_dawn', durationMinutes: 1 },
            { id: 'long_glow', durationMinutes: 1 },
          ],
        },
      },
      assignments: {
        defaultCalendar: 'block',
        regions: {
          archive_region: 'archive',
        },
      },
    },
    defaultClock: {
      phase: 'silver_dawn',
      cycle: ['silver_dawn', 'long_glow'],
    },
    nodeRegionsById: {
      archive_room: 'archive_region',
    },
  }, 0, undefined, 'archive_room');

  assert.equal(snapshot?.calendarId, 'archive');
  assert.equal(snapshot?.phase, 'silver_dawn');
});

test('server clock source falls back to the last project snapshot when a node-specific snapshot is missing', () => {
  class FakeClockStream implements RuntimeClockStream {
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    closed = false;

    constructor(readonly url: string) {}

    emit(snapshot: unknown) {
      this.onmessage?.({ data: JSON.stringify(snapshot) });
    }

    close() {
      this.closed = true;
    }
  }

  const streams: FakeClockStream[] = [];
  const clockSource = createServerRuntimeClockSource((url) => {
    const stream = new FakeClockStream(url);
    streams.push(stream);
    return stream;
  });
  const unsubscribe = clockSource.subscribeProject('demo04', 'sidewalk_north', 'diorama_block');

  streams[0].emit({
    phase: 'dusk',
    calendarId: 'diorama_block',
    nowMs: 123,
    nextPhaseInMs: 45_000,
    source: 'server:state-world',
  });

  const snapshot = clockSource.getSnapshot('demo04', 'building01_groundfloor');

  assert.equal(streams[0].url, buildRuntimeClockStreamUrl('demo04', 'sidewalk_north', 'diorama_block'));
  assert.equal(snapshot?.phase, 'dusk');
  assert.equal(snapshot?.calendarId, 'diorama_block');
  assert.equal(snapshot?.source, 'server:state-world');

  unsubscribe();
  assert.equal(streams[0].closed, true);
});

test('server clock source prefers the freshest project snapshot over an older node-specific snapshot', () => {
  class FakeClockStream implements RuntimeClockStream {
    onmessage: ((event: { data: string }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    closed = false;

    constructor(readonly url: string) {}

    emit(snapshot: unknown) {
      this.onmessage?.({ data: JSON.stringify(snapshot) });
    }

    close() {
      this.closed = true;
    }
  }

  const streams: FakeClockStream[] = [];
  const clockSource = createServerRuntimeClockSource((url) => {
    const stream = new FakeClockStream(url);
    streams.push(stream);
    return stream;
  });

  const unsubscribeGroundfloor = clockSource.subscribeProject('demo04', 'building03_groundfloor', 'diorama_block');

  streams[0].emit({
    phase: 'night',
    calendarId: 'diorama_block',
    nowMs: 100,
    nextPhaseInMs: 45_000,
    source: 'server:state-world',
  });

  const unsubscribeGate = clockSource.subscribeProject('demo04', 'building03groundfloor_sidewalk_east', 'diorama_block');

  streams[1].emit({
    phase: 'day',
    calendarId: 'diorama_block',
    nowMs: 200,
    nextPhaseInMs: 45_000,
    source: 'server:state-world',
  });

  const snapshot = clockSource.getSnapshot('demo04', 'building03_groundfloor');

  assert.equal(snapshot?.phase, 'day');
  assert.equal(snapshot?.nowMs, 200);

  unsubscribeGate();
  unsubscribeGroundfloor();
  assert.equal(streams[0].closed, true);
  assert.equal(streams[1].closed, true);
});
