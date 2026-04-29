import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyRuntimeSessionControl,
  buildRuntimeSessionStreamUrl,
  createRuntimeSession,
  createServerRuntimeSessionSource,
  type RuntimeSessionStream,
} from './runtimeSessionApi';

test('runtime session api returns undefined when control transport fails', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    const result = await applyRuntimeSessionControl('session-1', {
      id: 'continue',
      kind: 'continue',
      label: 'Continue',
    });

    assert.equal(result, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime session api returns undefined when start transport fails', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    const result = await createRuntimeSession('demo02');

    assert.equal(result, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime session stream url targets the shared runtime endpoint', () => {
  assert.equal(buildRuntimeSessionStreamUrl('session_1'), '/api/runtime-session/session_1/stream');
});

test('server runtime session source subscribes to the session stream and closes cleanly', () => {
  class FakeSessionStream implements RuntimeSessionStream {
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

  const streams: FakeSessionStream[] = [];
  const sessionSource = createServerRuntimeSessionSource((url) => {
    const stream = new FakeSessionStream(url);
    streams.push(stream);
    return stream;
  });
  let receivedSessionId: string | undefined;

  const unsubscribe = sessionSource.subscribeSession('session_1', {
    onUpdate(sessionView) {
      receivedSessionId = sessionView.snapshot.sessionId;
    },
  });

  streams[0].emit({
    snapshot: {
      sessionId: 'session_1',
      projectId: 'PrototypeHub',
      route: { runNonce: 0 },
      areaVisitCounts: {},
      pathVisitCounts: {},
      recentLogByNodeId: {},
      actionAttemptsByNodeId: {},
      sessionState: {},
    },
    offeredActions: [],
  });

  assert.equal(streams[0].url, buildRuntimeSessionStreamUrl('session_1'));
  assert.equal(receivedSessionId, 'session_1');

  unsubscribe();
  assert.equal(streams[0].closed, true);
});