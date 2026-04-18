import type { ContentNpcDefinition } from '../../../packages/schema/src';

export interface RuntimeAmbientNpcStateSeed {
  location?: string;
  routeIndex?: number;
  paused?: boolean;
}

export interface RuntimeAmbientNpcSnapshot {
  id: string;
  displayName?: string;
  nodeId?: string;
  previousNodeId?: string;
  nextNodeId?: string;
  behavior: 'linger' | 'move';
  arrivalText: string[];
  departureText: string[];
}

export interface RuntimeAmbientSnapshot {
  nowMs: number;
  npcs: RuntimeAmbientNpcSnapshot[];
}

export interface RuntimeAmbientStream {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface ServerRuntimeAmbientSource {
  subscribeProject(
    projectId: string,
    callbacks?: {
      onUpdate?: (snapshot: RuntimeAmbientSnapshot) => void;
      onError?: (error: unknown) => void;
    },
  ): () => void;
  clear(): void;
}

const DEFAULT_ROUTE_DWELL_SECONDS = 45;
const DEFAULT_ROUTE_MOVE_SECONDS = 15;

export function createServerRuntimeAmbientSource(
  streamFactory: (url: string) => RuntimeAmbientStream = (url) => new EventSource(url),
): ServerRuntimeAmbientSource {
  return {
    subscribeProject(projectId, callbacks) {
      const stream = streamFactory(buildRuntimeAmbientStreamUrl(projectId));

      stream.onmessage = (event) => {
        const snapshot = JSON.parse(event.data) as RuntimeAmbientSnapshot;
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
      // No cached state yet.
    },
  };
}

export function buildRuntimeAmbientStreamUrl(projectId: string): string {
  return `/api/runtime-ambient/${encodeURIComponent(projectId)}/stream`;
}

export function resolveRuntimeAmbientSnapshot(
  npcDefinitionsById: Record<string, ContentNpcDefinition>,
  nowMs: number,
  anchorMsByNpcId?: Map<string, number>,
  stateSeedsByNpcId?: Record<string, RuntimeAmbientNpcStateSeed>,
): RuntimeAmbientSnapshot {
  return {
    nowMs,
    npcs: Object.values(npcDefinitionsById)
      .map((npc) => resolveRuntimeAmbientNpcSnapshot(npc, nowMs, anchorMsByNpcId, stateSeedsByNpcId?.[npc.id]))
      .filter((npc): npc is RuntimeAmbientNpcSnapshot => Boolean(npc)),
  };
}

export function resolveRuntimeAmbientNpcSnapshot(
  npc: ContentNpcDefinition,
  nowMs: number,
  anchorMsByNpcId?: Map<string, number>,
  stateSeed?: RuntimeAmbientNpcStateSeed,
): RuntimeAmbientNpcSnapshot | undefined {
  const route = npc.route;

  if (!route || !route.steps || route.steps.length === 0) {
    return undefined;
  }

  if (stateSeed?.paused) {
    const pausedNodeId = stateSeed.location ?? route.steps[stateSeed.routeIndex ?? 0]?.nodeId;

    return {
      id: npc.id,
      displayName: npc.displayName,
      nodeId: pausedNodeId,
      previousNodeId: pausedNodeId,
      nextNodeId: pausedNodeId,
      behavior: 'linger',
      arrivalText: npc.arrivalText?.shared ?? [],
      departureText: npc.departureText?.shared ?? [],
    };
  }

  const dwellMs = normalizeSeconds(route.dwellSeconds, DEFAULT_ROUTE_DWELL_SECONDS) * 1000;
  const moveMs = normalizeSeconds(route.moveSeconds, DEFAULT_ROUTE_MOVE_SECONDS) * 1000;
  const anchorMs = resolveNpcAnchorMs(npc.id, nowMs, anchorMsByNpcId);
  const startIndex = resolveNpcStartIndex(route.steps, stateSeed);
  const segmentDurationMs = dwellMs + moveMs;
  const totalDurationMs = segmentDurationMs * route.steps.length;

  if (totalDurationMs <= 0) {
    return undefined;
  }

  const elapsedMs = Math.max(0, nowMs - anchorMs);
  const cycleOffsetMs = elapsedMs % totalDurationMs;
  const segmentIndex = Math.floor(cycleOffsetMs / segmentDurationMs);
  const segmentOffsetMs = cycleOffsetMs % segmentDurationMs;
  const activeStepIndex = (startIndex + segmentIndex) % route.steps.length;
  const activeStep = route.steps[activeStepIndex];
  const nextStep = route.steps[(activeStepIndex + 1) % route.steps.length];
  const isLingering = segmentOffsetMs < dwellMs;

  return {
    id: npc.id,
    displayName: npc.displayName,
    nodeId: isLingering ? activeStep?.nodeId : undefined,
    previousNodeId: activeStep?.nodeId,
    nextNodeId: isLingering ? activeStep?.nodeId : nextStep?.nodeId,
    behavior: isLingering ? 'linger' : 'move',
    arrivalText: npc.arrivalText?.shared ?? [],
    departureText: npc.departureText?.shared ?? [],
  };
}

function resolveNpcAnchorMs(
  npcId: string,
  nowMs: number,
  anchorMsByNpcId: Map<string, number> | undefined,
): number {
  if (!anchorMsByNpcId) {
    return 0;
  }

  const existingAnchor = anchorMsByNpcId.get(npcId);

  if (existingAnchor !== undefined) {
    return existingAnchor;
  }

  const nextAnchor = nowMs;
  anchorMsByNpcId.set(npcId, nextAnchor);
  return nextAnchor;
}

function resolveNpcStartIndex(
  steps: Array<{ nodeId: string }>,
  stateSeed?: RuntimeAmbientNpcStateSeed,
): number {
  if (Number.isInteger(stateSeed?.routeIndex) && (stateSeed?.routeIndex ?? 0) >= 0 && (stateSeed?.routeIndex ?? 0) < steps.length) {
    return stateSeed!.routeIndex as number;
  }

  if (stateSeed?.location) {
    const index = steps.findIndex((step) => step.nodeId === stateSeed.location);

    if (index >= 0) {
      return index;
    }
  }

  return 0;
}

function normalizeSeconds(value: number | undefined, fallbackSeconds: number): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : fallbackSeconds;
}
