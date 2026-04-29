import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { createJsonValueCodec } from '../../storage/src';
import { NodeFileKeyValueStore } from './index';

test('node file key value store round trips json values', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'silofire-storage-node-'));
  const store = new NodeFileKeyValueStore<{ value: number }>(rootDirectory, createJsonValueCodec());

  try {
    await store.set('projects/demo04/state', { value: 42 });
    assert.deepEqual(await store.get('projects/demo04/state'), { value: 42 });
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('node file key value store treats truncated json as missing instead of crashing', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'silofire-storage-node-'));
  const store = new NodeFileKeyValueStore<{ value: number }>(rootDirectory, createJsonValueCodec());
  const filePath = join(rootDirectory, 'projects', 'demo04', 'state.json');

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '{\n  "value": ', 'utf8');
    assert.equal(await store.get('projects/demo04/state'), undefined);
  } finally {
    await rm(rootDirectory, { recursive: true, force: true });
  }
});