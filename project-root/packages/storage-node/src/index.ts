import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';

import { type KeyValueEntry, type KeyValueStore, type ValueCodec, isStorageKeyWithinPrefix, normalizeStorageKey } from '../../storage/src';

const TRANSIENT_RENAME_RETRY_DELAYS_MS = [10, 25, 50, 100, 200, 400, 800, 1600];

export class NodeFileKeyValueStore<TValue> implements KeyValueStore<TValue> {
  private readonly operationChains = new Map<string, Promise<void>>();

  constructor(
    private readonly rootDirectory: string,
    private readonly codec: ValueCodec<TValue>,
  ) {}

  async get(key: string): Promise<TValue | undefined> {
    return this.runExclusive(key, async () => {
      const filePath = this.resolvePath(key);

      try {
        const raw = await readFile(filePath, 'utf8');

        try {
          return this.codec.deserialize(raw);
        } catch (error) {
          if (isInvalidSerializedValueError(error)) {
            return undefined;
          }

          throw error;
        }
      } catch (error) {
        if (isMissingFileError(error)) {
          return undefined;
        }

        throw error;
      }
    });
  }

  async set(key: string, value: TValue): Promise<void> {
    await this.runExclusive(key, async () => {
      const filePath = this.resolvePath(key);
      const tempFilePath = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`;
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(tempFilePath, this.codec.serialize(value), 'utf8');

      try {
        await replaceFileWithRetry(tempFilePath, filePath);
      } finally {
        try {
          await rm(tempFilePath, { force: true });
        } catch (error) {
          if (!isMissingFileError(error)) {
            throw error;
          }
        }
      }
    });
  }

  async delete(key: string): Promise<void> {
    await this.runExclusive(key, async () => {
      try {
        await rm(this.resolvePath(key), { force: true });
      } catch (error) {
        if (!isMissingFileError(error)) {
          throw error;
        }
      }
    });
  }

  async has(key: string): Promise<boolean> {
    return this.runExclusive(key, async () => {
      try {
        const details = await stat(this.resolvePath(key));
        return details.isFile();
      } catch (error) {
        if (isMissingFileError(error)) {
          return false;
        }

        throw error;
      }
    });
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

  private async runExclusive<TResult>(key: string, operation: () => Promise<TResult>): Promise<TResult> {
    const normalizedKey = normalizeStorageKey(key);
    const previous = this.operationChains.get(normalizedKey) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const queued = previous.catch(() => undefined).then(() => current);

    this.operationChains.set(normalizedKey, queued);
    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseCurrent();

      if (this.operationChains.get(normalizedKey) === queued) {
        this.operationChains.delete(normalizedKey);
      }
    }
  }
}

async function replaceFileWithRetry(sourcePath: string, destinationPath: string): Promise<void> {
  let lastError: unknown;

  for (const delayMs of [0, ...TRANSIENT_RENAME_RETRY_DELAYS_MS]) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    try {
      await rename(sourcePath, destinationPath);
      return;
    } catch (error) {
      lastError = error;

      if (!isRetryableRenameError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function isRetryableRenameError(error: unknown): error is NodeJS.ErrnoException {
  return !!error
    && typeof error === 'object'
    && 'code' in error
    && ['EPERM', 'EBUSY', 'EACCES'].includes(String((error as NodeJS.ErrnoException).code));
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
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

function isInvalidSerializedValueError(error: unknown): error is SyntaxError {
  return error instanceof SyntaxError;
}