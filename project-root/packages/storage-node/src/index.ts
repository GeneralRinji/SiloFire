import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import { type KeyValueEntry, type KeyValueStore, type ValueCodec, isStorageKeyWithinPrefix, normalizeStorageKey } from '../../storage/src';

export class NodeFileKeyValueStore<TValue> implements KeyValueStore<TValue> {
  constructor(
    private readonly rootDirectory: string,
    private readonly codec: ValueCodec<TValue>,
  ) {}

  async get(key: string): Promise<TValue | undefined> {
    try {
      const raw = await readFile(this.resolvePath(key), 'utf8');
      return this.codec.deserialize(raw);
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  async set(key: string, value: TValue): Promise<void> {
    const filePath = this.resolvePath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, this.codec.serialize(value), 'utf8');
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(this.resolvePath(key), { force: true });
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const details = await stat(this.resolvePath(key));
      return details.isFile();
    } catch (error) {
      if (isMissingFileError(error)) {
        return false;
      }

      throw error;
    }
  }

  async *list(prefix?: string): AsyncIterable<KeyValueEntry<TValue>> {
    for await (const filePath of walkFiles(this.rootDirectory)) {
      if (!filePath.endsWith(this.codec.extension)) {
        continue;
      }

      const key = this.pathToKey(filePath);

      if (!isStorageKeyWithinPrefix(key, prefix)) {
        continue;
      }

      const raw = await readFile(filePath, 'utf8');

      yield {
        key,
        value: this.codec.deserialize(raw),
      };
    }
  }

  private resolvePath(key: string): string {
    const normalizedKey = normalizeStorageKey(key);
    const segments = normalizedKey.length > 0 ? normalizedKey.split('/') : ['root'];
    return join(this.rootDirectory, ...segments) + this.codec.extension;
  }

  private pathToKey(filePath: string): string {
    const relativePath = relative(this.rootDirectory, filePath).split(sep).join('/');
    return normalizeStorageKey(relativePath.slice(0, -this.codec.extension.length));
  }
}

async function* walkFiles(directory: string): AsyncIterable<string> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(entryPath);
      continue;
    }

    if (entry.isFile()) {
      yield entryPath;
    }
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}