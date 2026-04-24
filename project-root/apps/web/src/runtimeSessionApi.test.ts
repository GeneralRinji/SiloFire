import assert from 'node:assert/strict';
import test from 'node:test';

import { applyRuntimeSessionControl, createRuntimeSession } from './runtimeSessionApi';

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