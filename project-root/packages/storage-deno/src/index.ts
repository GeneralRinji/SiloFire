import { type KeyValueEntry, type KeyValueStore, isStorageKeyWithinPrefix, normalizeStorageKey } from '../../storage/src';

export interface DenoKvGetResult<TValue> {
  value: TValue | null;
}

export interface DenoKvListResult<TValue> {
  key: readonly unknown[];
  value: TValue;
}

export interface DenoKvLike<TValue> {
  get(key: readonly unknown[]): Promise<DenoKvGetResult<TValue>>;
  set(key: readonly unknown[], value: TValue): Promise<unknown>;
  delete(key: readonly unknown[]): Promise<unknown>;
  list(selector: { prefix: readonly unknown[] }): AsyncIterable<DenoKvListResult<TValue>>;
}

export class DenoKvKeyValueStore<TValue> implements KeyValueStore<TValue> {
  constructor(
    private readonly kv: DenoKvLike<TValue>,
    private readonly namespacePrefix: readonly string[] = ['silofire'],
  ) {}

  async get(key: string): Promise<TValue | undefined> {
    const result = await this.kv.get(this.keyToParts(key));
    return result.value ?? undefined;
  }

  async set(key: string, value: TValue): Promise<void> {
    await this.kv.set(this.keyToParts(key), value);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(this.keyToParts(key));
  }

  async has(key: string): Promise<boolean> {
    const result = await this.kv.get(this.keyToParts(key));
    return result.value !== null;
  }

  async *list(prefix?: string): AsyncIterable<KeyValueEntry<TValue>> {
    const prefixParts = this.keyToParts(prefix ?? '');

    for await (const entry of this.kv.list({ prefix: prefixParts })) {
      const key = this.partsToKey(entry.key);

      if (!key || !isStorageKeyWithinPrefix(key, prefix)) {
        continue;
      }

      yield {
        key,
        value: entry.value,
      };
    }
  }

  private keyToParts(key: string): readonly string[] {
    const normalizedKey = normalizeStorageKey(key);
    const keyParts = normalizedKey.length > 0 ? normalizedKey.split('/') : [];
    return [...this.namespacePrefix, ...keyParts];
  }

  private partsToKey(parts: readonly unknown[]): string | undefined {
    const remainingParts = parts.slice(this.namespacePrefix.length);

    if (remainingParts.some((part) => typeof part !== 'string')) {
      return undefined;
    }

    return normalizeStorageKey(remainingParts.join('/'));
  }
}