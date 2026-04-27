import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createServerRuntimeSiteAnnouncementSource,
  getRuntimeSiteAnnouncementSnapshot,
} from './runtimeSiteAnnouncementsApi';

test('runtime site announcements api returns undefined on transport failure', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    const result = await getRuntimeSiteAnnouncementSnapshot();
    assert.equal(result, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime site announcements api loads the current server snapshot', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => new Response(JSON.stringify({
    calendarScope: 'site',
    currentTimeMs: 123,
    activeAnnouncements: [],
    upcomingAnnouncements: [],
    expiredAnnouncements: [],
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  try {
    const result = await getRuntimeSiteAnnouncementSnapshot();
    assert.equal(result?.calendarScope, 'site');
    assert.equal(result?.currentTimeMs, 123);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime site announcements source forwards server-sent snapshots', async () => {
  let capturedUpdate: { currentTimeMs?: number } | undefined;

  const stream = {
    onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    close() {},
  };

  const source = createServerRuntimeSiteAnnouncementSource(() => stream);
  const unsubscribe = source.subscribe({
    onUpdate(snapshot) {
      capturedUpdate = snapshot;
    },
  });

  stream.onmessage?.({
    data: JSON.stringify({
      calendarScope: 'site',
      currentTimeMs: 777,
      activeAnnouncements: [],
      upcomingAnnouncements: [],
      expiredAnnouncements: [],
    }),
  } as MessageEvent<unknown>);

  unsubscribe();

  assert.equal(capturedUpdate?.currentTimeMs, 777);
});