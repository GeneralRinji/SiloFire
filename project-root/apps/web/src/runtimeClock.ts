import type { RuntimeClockSnapshot, RuntimeClockSource, RuntimeProjectData } from './contentRuntimeCore';
import {
  formatPreviewClockCountdown,
  formatRuntimeClockTimestamp,
  resolveProjectClockSnapshot,
  resolvePreviewRuntimeClockSnapshot,
  resolveRuntimeClockPhases,
  type PreviewRuntimeClockSnapshot,
} from '../../../packages/runtime/src/runtimeClock';

export {
  formatPreviewClockCountdown,
  formatRuntimeClockTimestamp,
  resolveProjectClockSnapshot,
  resolvePreviewRuntimeClockSnapshot,
  resolveRuntimeClockPhases,
  type PreviewRuntimeClockSnapshot,
} from '../../../packages/runtime/src/runtimeClock';

export interface RuntimeClockStream {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface ServerRuntimeClockSource extends RuntimeClockSource {
  subscribeProject(
    projectId: string,
    nodeId: string | undefined,
    nodeRegion: string | undefined,
    callbacks?: {
      onUpdate?: (snapshot: PreviewRuntimeClockSnapshot) => void;
      onError?: (error: unknown) => void;
    },
  ): () => void;
  clear(): void;
}

export function createPreviewRuntimeClockSource(
  runtimeProjects: Record<string, RuntimeProjectData>,
): RuntimeClockSource {
  const anchorMsByProjectId = new Map<string, number>();

  return {
    getSnapshot(projectId, nodeId) {
      const nowMs = Date.now();
      const project = runtimeProjects[projectId];

      if (!project?.timeSettings) {
        return undefined;
      }

      return resolveProjectClockSnapshot({
        projectId,
        timeSettings: project.timeSettings,
        defaultClock: project.defaultClock,
        nodeFoldersById: project.nodeFoldersById,
        nodeRegionsById: project.nodeRegionsById,
      }, nowMs, anchorMsByProjectId, nodeId);
    },
  };
}

export function createServerRuntimeClockSource(
  streamFactory: (url: string) => RuntimeClockStream = (url) => new EventSource(url),
): ServerRuntimeClockSource {
  const snapshotsByProjectId = new Map<string, PreviewRuntimeClockSnapshot>();

  return {
    getSnapshot(projectId, nodeId) {
      const nodeSnapshot = snapshotsByProjectId.get(getClockSnapshotCacheKey(projectId, nodeId));
      const projectSnapshot = snapshotsByProjectId.get(getClockSnapshotCacheKey(projectId));

      return selectFreshestClockSnapshot(nodeSnapshot, projectSnapshot);
    },
    subscribeProject(projectId, nodeId, nodeRegion, callbacks) {
      const stream = streamFactory(buildRuntimeClockStreamUrl(projectId, nodeId, nodeRegion));

      stream.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          return;
        }

        const snapshot = JSON.parse(event.data) as PreviewRuntimeClockSnapshot;
        cacheClockSnapshot(snapshotsByProjectId, projectId, snapshot, nodeId);
        callbacks?.onUpdate?.(snapshot);
      };

      stream.onerror = (error) => {
        callbacks?.onError?.(error);
      };

      return () => {
        stream.onmessage = null;
        stream.onerror = null;
        stream.close();
      };
    },
    clear() {
      snapshotsByProjectId.clear();
    },
  };
}

export function buildRuntimeClockStreamUrl(
  projectId: string,
  nodeId?: string,
  nodeRegion?: string,
): string {
  const searchParams = new URLSearchParams();

  if (nodeId) {
    searchParams.set('nodeId', nodeId);
  }

  if (nodeRegion) {
    searchParams.set('nodeRegion', nodeRegion);
  }

  return `/api/runtime-clock/${encodeURIComponent(projectId)}/stream${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`;
}

function cacheClockSnapshot(
  snapshotsByProjectId: Map<string, PreviewRuntimeClockSnapshot>,
  projectId: string,
  snapshot: PreviewRuntimeClockSnapshot,
  nodeId?: string,
): void {
  snapshotsByProjectId.set(getClockSnapshotCacheKey(projectId), snapshot);

  if (nodeId) {
    snapshotsByProjectId.set(getClockSnapshotCacheKey(projectId, nodeId), snapshot);
  }
}

function getClockSnapshotCacheKey(projectId: string, nodeId?: string): string {
  return `${projectId}::${nodeId ?? '*'}`;
}

function selectFreshestClockSnapshot(
  primary: PreviewRuntimeClockSnapshot | undefined,
  fallback: PreviewRuntimeClockSnapshot | undefined,
): PreviewRuntimeClockSnapshot | undefined {
  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  const primaryNowMs = Number.isFinite(primary.nowMs) ? (primary.nowMs as number) : Number.NEGATIVE_INFINITY;
  const fallbackNowMs = Number.isFinite(fallback.nowMs) ? (fallback.nowMs as number) : Number.NEGATIVE_INFINITY;

  return fallbackNowMs > primaryNowMs ? fallback : primary;
}