import type { ProjectedLogEntry } from '../../../packages/projection/src';

const MAX_RECENT_LOG_ENTRIES = 8;
export const RECENT_LOG_DUPLICATE_WINDOW_MS = 2000;

export type AppRecentLogEntry = ProjectedLogEntry & {
  createdAt: number;
};

export function appendLogEntry(
  existingEntries: AppRecentLogEntry[] | undefined,
  nextEntry: ProjectedLogEntry | undefined,
  now = Date.now(),
): AppRecentLogEntry[] | undefined {
  if (!nextEntry) {
    return existingEntries;
  }

  const entries = existingEntries ?? [];
  const lastEntry = entries[entries.length - 1];

  if (lastEntry?.text === nextEntry.text && now - lastEntry.createdAt < RECENT_LOG_DUPLICATE_WINDOW_MS) {
    return entries;
  }

  const appendedEntries = [...entries, { ...nextEntry, createdAt: now }];

  if (appendedEntries.length <= MAX_RECENT_LOG_ENTRIES) {
    return appendedEntries;
  }

  return appendedEntries.slice(-MAX_RECENT_LOG_ENTRIES);
}

export function createRecentLogEntries(
  entries: ProjectedLogEntry[] | undefined,
  now = Date.now(),
): AppRecentLogEntry[] | undefined {
  let nextEntries: AppRecentLogEntry[] | undefined;

  entries?.forEach((entry, index) => {
    nextEntries = appendLogEntry(nextEntries, entry, now + index);
  });

  return nextEntries;
}