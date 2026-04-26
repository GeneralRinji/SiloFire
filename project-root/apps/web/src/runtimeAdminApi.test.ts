import test from 'node:test';
import assert from 'node:assert/strict';

import { getRuntimeAdminHeartProject, listRuntimeAdminHeartOverview } from './runtimeAdminApi';

test('runtime admin api sends the shared password header', async () => {
  let receivedHeader: string | null = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, init) => {
    receivedHeader = new Headers(init?.headers).get('x-silofire-admin-password');

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }) as typeof fetch;

  try {
    const result = await listRuntimeAdminHeartOverview('open-sesame');
    assert.equal(result.kind, 'ok');
    assert.equal(receivedHeader, 'open-sesame');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runtime admin api reports unauthorized password rejection from the server', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => new Response('Unauthorized', { status: 401 })) as typeof fetch;

  try {
    const result = await getRuntimeAdminHeartProject('demo04', 'wrong-password');
    assert.deepEqual(result, { kind: 'unauthorized' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});