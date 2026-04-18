export interface KeyValueEntry<TValue> {
  key: string;
  value: TValue;
}

export interface KeyValueStore<TValue> {
  get(key: string): Promise<TValue | undefined>;
  set(key: string, value: TValue): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  list(prefix?: string): AsyncIterable<KeyValueEntry<TValue>>;
}

export interface ValueCodec<TValue> {
  extension: string;
  serialize(value: TValue): string;
  deserialize(raw: string): TValue;
}

export const textValueCodec: ValueCodec<string> = {
  extension: '.txt',
  serialize(value) {
    return value;
  },
  deserialize(raw) {
    return raw;
  },
};

export function createJsonValueCodec<TValue>(): ValueCodec<TValue> {
  return {
    extension: '.json',
    serialize(value) {
      return JSON.stringify(value, null, 2);
    },
    deserialize(raw) {
      return JSON.parse(raw) as TValue;
    },
  };
}

export function normalizeStorageKey(key: string): string {
  return key
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/');
}

export function isStorageKeyWithinPrefix(key: string, prefix: string | undefined): boolean {
  if (!prefix) {
    return true;
  }

  const normalizedKey = normalizeStorageKey(key);
  const normalizedPrefix = normalizeStorageKey(prefix);

  return normalizedPrefix.length === 0
    ? true
    : normalizedKey === normalizedPrefix || normalizedKey.startsWith(`${normalizedPrefix}/`);
}