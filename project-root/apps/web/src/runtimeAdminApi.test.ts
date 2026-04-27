import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRuntimeAdminSiteAnnouncement,
  getRuntimeAdminHeartProject,
  listRuntimeAdminHeartOverview,
  listRuntimeAdminSiteAnnouncements,
} from './runtimeAdminApi';

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

    const siteResult = await listRuntimeAdminSiteAnnouncements('open-sesame');
    assert.equal(siteResult.kind, 'ok');
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

test('runtime admin api reports validation errors from the site announcement endpoints', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => new Response(JSON.stringify({
    errors: ['Title is required.'],
  }), { status: 400 })) as typeof fetch;

  try {
    const result = await createRuntimeAdminSiteAnnouncement('open-sesame', {
      title: '',
      body: 'Invalid',
      mode: 'dismissible',
      priority: 1,
      enabled: true,
    });
    assert.deepEqual(result, {
      kind: 'validation_error',
      errors: ['Title is required.'],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});