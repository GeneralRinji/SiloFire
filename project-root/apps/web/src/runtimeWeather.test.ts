import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRuntimeWeatherLogEntry,
  buildRuntimeWeatherStreamUrl,
  createServerRuntimeWeatherSource,
  hasWeatherLogEntry,
  hasMeaningfulWeatherChange,
  isWeatherLogEntry,
  resolveAssignedRuntimeWeatherSnapshot,
  resolveRuntimeWeatherProjectSnapshot,
  shouldAnnounceWeather,
  shouldAnnounceWeatherChange,
  type RuntimeWeatherStream,
} from './runtimeWeather';

test('meaningful weather change detects step and intensity transitions', () => {
  assert.equal(hasMeaningfulWeatherChange(
    {
      patternId: 'block_weather',
      stepId: 'clear_soft',
      kind: 'clear',
      intensity: 'soft',
      statusText: ['clear'],
    },
    {
      patternId: 'block_weather',
      stepId: 'rain_light',
      kind: 'rain',
      intensity: 'light',
      statusText: ['rain'],
    },
  ), true);

  assert.equal(hasMeaningfulWeatherChange(
    {
      patternId: 'block_weather',
      stepId: 'clear_soft',
      kind: 'clear',
      intensity: 'soft',
      statusText: ['clear'],
    },
    {
      patternId: 'block_weather',
      stepId: 'clear_soft',
      kind: 'clear',
      intensity: 'soft',
      statusText: ['clear'],
    },
  ), false);
});

test('weather snapshot honors region assignment and node visibility override', () => {
  const projectSnapshot = resolveRuntimeWeatherProjectSnapshot({
    projectId: 'demo04',
    weatherSettings: {
      patterns: {
        block_weather: {
          steps: [
            { id: 'clear_soft', kind: 'clear', intensity: 'soft', durationMinutes: 1, statusText: ['The block sits under a clear sky.'] },
          ],
        },
      },
      assignments: {
        defaultPattern: 'block_weather',
        regions: {
          diorama_block: 'block_weather',
        },
      },
      visibility: {
        defaultRecentLog: false,
        regions: {
          diorama_block: true,
        },
        nodes: {
          building04_groundfloor: false,
        },
      },
    },
    nodeRegionsById: {
      sidewalk_north: 'diorama_block',
      building04_groundfloor: 'diorama_block',
    },
  }, 0);

  const outdoorSnapshot = resolveAssignedRuntimeWeatherSnapshot({
    projectId: 'demo04',
    weatherSettings: {
      patterns: {
        block_weather: {
          steps: [
            { id: 'clear_soft', kind: 'clear', intensity: 'soft', durationMinutes: 1, statusText: ['The block sits under a clear sky.'] },
          ],
        },
      },
      assignments: {
        defaultPattern: 'block_weather',
        regions: {
          diorama_block: 'block_weather',
        },
      },
      visibility: {
        defaultRecentLog: false,
        regions: {
          diorama_block: true,
        },
        nodes: {
          building04_groundfloor: false,
        },
      },
    },
    nodeRegionsById: {
      sidewalk_north: 'diorama_block',
      building04_groundfloor: 'diorama_block',
    },
  }, projectSnapshot, 'sidewalk_north');
  const indoorSnapshot = resolveAssignedRuntimeWeatherSnapshot({
    projectId: 'demo04',
    weatherSettings: {
      patterns: {
        block_weather: {
          steps: [
            { id: 'clear_soft', kind: 'clear', intensity: 'soft', durationMinutes: 1, statusText: ['The block sits under a clear sky.'] },
          ],
        },
      },
      assignments: {
        defaultPattern: 'block_weather',
        regions: {
          diorama_block: 'block_weather',
        },
      },
      visibility: {
        defaultRecentLog: false,
        regions: {
          diorama_block: true,
        },
        nodes: {
          building04_groundfloor: false,
        },
      },
    },
    nodeRegionsById: {
      sidewalk_north: 'diorama_block',
      building04_groundfloor: 'diorama_block',
    },
  }, projectSnapshot, 'building04_groundfloor');

  assert.equal(outdoorSnapshot?.patternId, 'block_weather');
  assert.equal(outdoorSnapshot?.visibleInRecentLog, true);
  assert.equal(indoorSnapshot?.visibleInRecentLog, false);
});

test('weather log entry only materializes when visibility and status text are present', () => {
  const visibleEntry = buildRuntimeWeatherLogEntry({
    patternId: 'block_weather',
    stepId: 'drizzle',
    kind: 'rain',
    intensity: 'light',
    statusText: ['A light rain traces the curb.'],
    visibleInRecentLog: true,
  });
  const hiddenEntry = buildRuntimeWeatherLogEntry({
    patternId: 'block_weather',
    stepId: 'drizzle',
    kind: 'rain',
    intensity: 'light',
    statusText: ['A light rain traces the curb.'],
    visibleInRecentLog: false,
  });

  assert.equal(visibleEntry?.text, 'A light rain traces the curb.');
  assert.equal(visibleEntry?.lane, 'recent');
  assert.equal(hiddenEntry, undefined);
});

test('weather log helpers detect authored weather entries', () => {
  const weatherEntry = buildRuntimeWeatherLogEntry({
    patternId: 'block_weather',
    stepId: 'rain_light',
    kind: 'rain',
    intensity: 'light',
    statusText: ['A light rain traces the curb.'],
    visibleInRecentLog: true,
  });
  const plainEntry = {
    id: 'ambient:walker_01:arrival:1',
    text: 'Walker arrives.',
  };

  assert.equal(isWeatherLogEntry(weatherEntry), true);
  assert.equal(isWeatherLogEntry(plainEntry), false);
  assert.equal(hasWeatherLogEntry([plainEntry, weatherEntry!]), true);
  assert.equal(hasWeatherLogEntry([plainEntry]), false);
});

test('weather announcement policy seeds on entry and suppresses duplicate restored weather', () => {
  const snapshot = {
    patternId: 'block_weather',
    stepId: 'rain_light',
    kind: 'rain',
    intensity: 'light',
    statusText: ['A light rain traces the curb.'],
    visibleInRecentLog: true,
  };
  const existingWeatherEntry = buildRuntimeWeatherLogEntry(snapshot);

  assert.equal(shouldAnnounceWeather({
    reason: 'entry',
    snapshot,
    existingEntries: [],
  }), true);

  assert.equal(shouldAnnounceWeather({
    reason: 'entry',
    snapshot,
    existingEntries: existingWeatherEntry ? [existingWeatherEntry] : [],
  }), false);
});

test('weather announcement policy only announces changes when meaningfully different', () => {
  const previousSnapshot = {
    patternId: 'block_weather',
    stepId: 'clear_soft',
    kind: 'clear',
    intensity: 'soft',
    statusText: ['The block sits under a clear sky.'],
    visibleInRecentLog: true,
  };
  const nextSnapshot = {
    patternId: 'block_weather',
    stepId: 'rain_light',
    kind: 'rain',
    intensity: 'light',
    statusText: ['A light rain traces the curb.'],
    visibleInRecentLog: true,
  };

  assert.equal(shouldAnnounceWeather({
    reason: 'change',
    snapshot: nextSnapshot,
    lastDisplayedSnapshot: previousSnapshot,
  }), true);

  assert.equal(shouldAnnounceWeather({
    reason: 'change',
    snapshot: previousSnapshot,
    lastDisplayedSnapshot: previousSnapshot,
  }), false);
});

test('weather change announcements only fire on same-node updates or hidden-to-visible traversal', () => {
  const previousSnapshot = {
    patternId: 'block_weather',
    stepId: 'clear_soft',
    kind: 'clear',
    intensity: 'soft',
    statusText: ['The block sits under a clear sky.'],
    visibleInRecentLog: true,
  };
  const nextSnapshot = {
    patternId: 'block_weather',
    stepId: 'rain_light',
    kind: 'rain',
    intensity: 'light',
    statusText: ['A light rain traces the curb.'],
    visibleInRecentLog: true,
  };

  assert.equal(shouldAnnounceWeatherChange({
    currentNodeId: 'sidewalk_north',
    snapshot: nextSnapshot,
    existingEntries: [],
  }), true);

  assert.equal(shouldAnnounceWeatherChange({
    previousNodeId: 'sidewalk_north',
    currentNodeId: 'sidewalk_north',
    previousSnapshot,
    snapshot: nextSnapshot,
  }), true);

  assert.equal(shouldAnnounceWeatherChange({
    previousNodeId: 'sidewalk_north',
    currentNodeId: 'building01_groundfloor',
    previousSnapshot,
    snapshot: nextSnapshot,
  }), false);

  assert.equal(shouldAnnounceWeatherChange({
    previousNodeId: 'building04_groundfloor',
    currentNodeId: 'sidewalk_north',
    previousSnapshot: {
      ...nextSnapshot,
      visibleInRecentLog: false,
    },
    snapshot: nextSnapshot,
    existingEntries: [],
  }), true);

  const existingWeatherEntry = buildRuntimeWeatherLogEntry(nextSnapshot);

  assert.equal(shouldAnnounceWeatherChange({
    previousNodeId: 'building04_groundfloor',
    currentNodeId: 'sidewalk_north',
    previousSnapshot: {
      ...nextSnapshot,
      visibleInRecentLog: false,
    },
    snapshot: nextSnapshot,
    existingEntries: existingWeatherEntry ? [existingWeatherEntry] : [],
  }), false);
});

test('weather stream url targets the shared runtime endpoint', () => {
  assert.equal(buildRuntimeWeatherStreamUrl('demo04'), '/api/runtime-weather/demo04/stream');
});

test('server weather source falls back to default weather before the stream updates', () => {
  class FakeWeatherStream implements RuntimeWeatherStream {
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

  const streams: FakeWeatherStream[] = [];
  const weatherSource = createServerRuntimeWeatherSource((url) => {
    const stream = new FakeWeatherStream(url);
    streams.push(stream);
    return stream;
  });
  const snapshotBeforeStream = weatherSource.getSnapshot({
    projectId: 'demo04',
    defaultWeather: {
      kind: 'clear',
      intensity: 'soft',
      statusText: [],
      source: 'session',
    },
  });
  const unsubscribe = weatherSource.subscribeProject('demo04');

  streams[0].emit({
    nowMs: 10,
    patterns: [
      {
        patternId: 'block_weather',
        stepId: 'rain_light',
        kind: 'rain',
        intensity: 'light',
        statusText: ['A light rain traces the curb.'],
        nowMs: 10,
        source: 'server:weather-settings',
      },
    ],
  });

  const snapshotAfterStream = weatherSource.getSnapshot({
    projectId: 'demo04',
    weatherSettings: {
      patterns: {
        block_weather: {
          steps: [
            { id: 'rain_light', kind: 'rain' },
          ],
        },
      },
      assignments: {
        defaultPattern: 'block_weather',
      },
    },
  });

  assert.equal(snapshotBeforeStream?.kind, 'clear');
  assert.equal(snapshotAfterStream?.kind, 'rain');
  assert.equal(streams[0].url, buildRuntimeWeatherStreamUrl('demo04'));

  unsubscribe();
  assert.equal(streams[0].closed, true);
});