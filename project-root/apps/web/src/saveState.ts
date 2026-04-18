import type { PathDirection, TitleScreenSaveMode } from '../../../packages/schema/src';
import type { RuntimeSessionState } from './contentRuntimeCore';
import type { AppRecentLogEntry } from './recentLog';

const SAVE_STATE_VERSION = 1;
const SAVE_STATE_STORAGE_KEY_PREFIX = 'silofire:save:';
const TITLE_SCREEN_NODE_ID = 'title_screen';

export interface SaveGameSnapshot {
  version: number;
  projectId: string;
  route: {
    nodeId?: string;
    pathDirection?: PathDirection;
    pathBeatIndex?: number;
    runNonce: number;
  };
  history: string[];
  areaVisitCounts: Record<string, number>;
  pathVisitCounts: Record<string, number>;
  recentLogByNodeId: Record<string, AppRecentLogEntry[]>;
  actionAttemptsByNodeId: Record<string, Record<string, number>>;
  sessionState: RuntimeSessionState;
  savedAt: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function saveProjectSnapshot(snapshot: SaveGameSnapshot, storage = getBrowserStorage()): void {
  if (!storage) {
    return;
  }

  storage.setItem(getSaveStateStorageKey(snapshot.projectId), JSON.stringify(snapshot));
}

export function loadProjectSnapshot(projectId: string, storage = getBrowserStorage()): SaveGameSnapshot | undefined {
  if (!storage) {
    return undefined;
  }

  const rawValue = storage.getItem(getSaveStateStorageKey(projectId));

  if (!rawValue) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as SaveGameSnapshot;

    if (parsedValue.version !== SAVE_STATE_VERSION || parsedValue.projectId !== projectId) {
      return undefined;
    }

    return parsedValue;
  } catch {
    return undefined;
  }
}

export function hasProjectSnapshot(projectId: string, storage = getBrowserStorage()): boolean {
  return loadProjectSnapshot(projectId, storage) !== undefined;
}

export function clearProjectSnapshot(projectId: string, storage = getBrowserStorage()): void {
  if (!storage) {
    return;
  }

  storage.removeItem(getSaveStateStorageKey(projectId));
}

export function createSaveGameSnapshot(input: Omit<SaveGameSnapshot, 'version' | 'savedAt'>): SaveGameSnapshot {
  return {
    ...input,
    version: SAVE_STATE_VERSION,
    savedAt: Date.now(),
  };
}

export function shouldSaveProjectSnapshot(input: {
  currentNodeId?: string;
  sessionState?: RuntimeSessionState;
  titleScreenSaveMode?: TitleScreenSaveMode;
}): boolean {
  if (!input.sessionState || !input.currentNodeId) {
    return false;
  }

  if (input.currentNodeId === TITLE_SCREEN_NODE_ID && input.titleScreenSaveMode === 'single') {
    return false;
  }

  return true;
}

export function shouldClearProjectSnapshotOnReset(titleScreenSaveMode?: TitleScreenSaveMode): boolean {
  return titleScreenSaveMode === 'single';
}

export function formatProjectSnapshotSummary(input: {
  snapshot?: SaveGameSnapshot;
  nodeLabel?: string;
  now?: number;
}): string | undefined {
  const snapshot = input.snapshot;

  if (!snapshot) {
    return undefined;
  }

  const summaryParts: string[] = [];
  const locationLabel = input.nodeLabel ?? snapshot.route.nodeId;
  const relativeSavedAt = formatRelativeTimestamp(snapshot.savedAt, input.now ?? Date.now());

  if (locationLabel) {
    summaryParts.push(`Last: ${locationLabel}`);
  }

  if (relativeSavedAt) {
    summaryParts.push(relativeSavedAt);
  }

  return summaryParts.length > 0 ? summaryParts.join(' | ') : undefined;
}

function getSaveStateStorageKey(projectId: string): string {
  return `${SAVE_STATE_STORAGE_KEY_PREFIX}${projectId}`;
}

function getBrowserStorage(): StorageLike | undefined {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return undefined;
  }

  return globalThis.localStorage;
}

function formatRelativeTimestamp(savedAt: number, now: number): string | undefined {
  if (!Number.isFinite(savedAt) || !Number.isFinite(now)) {
    return undefined;
  }

  const deltaMs = Math.max(0, now - savedAt);

  if (deltaMs < 60_000) {
    return 'just now';
  }

  const minutes = Math.floor(deltaMs / 60_000);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}