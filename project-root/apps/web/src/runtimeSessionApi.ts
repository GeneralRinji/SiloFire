import type { ProjectedAction, ProjectedControl, ProjectedLogEntry, ProjectionResult } from '../../../packages/projection/src';
import type { RuntimeClockSnapshot, RuntimeNodeLink, RuntimeWeatherSnapshot } from '../../../packages/runtime/src';
import type { PathDirection } from '../../../packages/schema/src';
import type { ProjectTimeSettingsDefinition, ProjectWeatherSettingsDefinition, TitleScreenSaveMode } from '../../../packages/schema/src';
import type { RuntimeSessionState } from './contentRuntimeCore';

export interface RuntimeSessionRoute {
  nodeId?: string;
  pathDirection?: PathDirection;
  pathBeatIndex?: number;
  runNonce: number;
}

export interface RuntimeSessionSnapshot {
  sessionId: string;
  projectId: string;
  route: RuntimeSessionRoute;
  areaVisitCounts: Record<string, number>;
  pathVisitCounts: Record<string, number>;
  recentLogByNodeId: Record<string, ProjectedLogEntry[]>;
  actionAttemptsByNodeId: Record<string, Record<string, number>>;
  sessionState: RuntimeSessionState;
}

export interface RuntimeSessionView {
  snapshot: RuntimeSessionSnapshot;
  page?: ProjectionResult;
  offeredActions: ProjectedAction[];
  currentAreaVisitCount?: number;
  currentPathVisitCount?: number;
  project?: RuntimeSessionProjectMetadata;
}

export interface RuntimeSessionProjectMetadata {
  projectId: string;
  startNodeId?: string;
  nodes: RuntimeNodeLink[];
  nodeRegionsById: Record<string, string>;
  titleScreenSaveMode?: TitleScreenSaveMode;
  timeSettings?: ProjectTimeSettingsDefinition;
  weatherSettings?: ProjectWeatherSettingsDefinition;
  defaultClock?: RuntimeClockSnapshot;
  defaultWeather?: RuntimeWeatherSnapshot;
}

export interface RuntimeSessionRestoreSnapshot {
  projectId: string;
  route: RuntimeSessionRoute;
  areaVisitCounts: Record<string, number>;
  pathVisitCounts: Record<string, number>;
  recentLogByNodeId: Record<string, ProjectedLogEntry[]>;
  actionAttemptsByNodeId: Record<string, Record<string, number>>;
  sessionState: RuntimeSessionState;
}

export interface RuntimeSessionStream {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export interface ServerRuntimeSessionSource {
  subscribeSession(
    sessionId: string,
    callbacks?: {
      onUpdate?: (sessionView: RuntimeSessionView) => void;
      onError?: (error: unknown) => void;
    },
  ): () => void;
}

export async function createRuntimeSession(projectId: string, options: {
  nodeId?: string;
  pathDirection?: PathDirection;
  pathBeatIndex?: number;
} = {}): Promise<RuntimeSessionView | undefined> {
  return postJson<RuntimeSessionView>(`/api/runtime-session/${encodeURIComponent(projectId)}/start`, options);
}

export async function restoreRuntimeSession(projectId: string, snapshot: RuntimeSessionRestoreSnapshot): Promise<RuntimeSessionView | undefined> {
  return postJson<RuntimeSessionView>(`/api/runtime-session/${encodeURIComponent(projectId)}/restore`, snapshot);
}

export async function getRuntimeSession(sessionId: string): Promise<RuntimeSessionView | undefined> {
  return fetchJson<RuntimeSessionView>(`/api/runtime-session/${encodeURIComponent(sessionId)}`);
}

export async function applyRuntimeSessionAction(sessionId: string, action: ProjectedAction): Promise<RuntimeSessionView | undefined> {
  return postJson<RuntimeSessionView>(`/api/runtime-session/${encodeURIComponent(sessionId)}/action`, action);
}

export async function applyRuntimeSessionControl(sessionId: string, control: ProjectedControl): Promise<RuntimeSessionView | undefined> {
  return postJson<RuntimeSessionView>(`/api/runtime-session/${encodeURIComponent(sessionId)}/control`, control);
}

export async function resetRuntimeSession(sessionId: string, destinationNodeId?: string): Promise<RuntimeSessionView | undefined> {
  return postJson<RuntimeSessionView>(`/api/runtime-session/${encodeURIComponent(sessionId)}/reset`, { destinationNodeId });
}

export function createServerRuntimeSessionSource(
  streamFactory: (url: string) => RuntimeSessionStream = (url) => new EventSource(url),
): ServerRuntimeSessionSource {
  return {
    subscribeSession(sessionId, callbacks) {
      const stream = streamFactory(buildRuntimeSessionStreamUrl(sessionId));

      stream.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          return;
        }

        const sessionView = JSON.parse(event.data) as RuntimeSessionView;
        callbacks?.onUpdate?.(sessionView);
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
  };
}

export function buildRuntimeSessionStreamUrl(sessionId: string): string {
  return `/api/runtime-session/${encodeURIComponent(sessionId)}/stream`;
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    console.error(`Runtime session request failed for ${url}.`, error);
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T | undefined> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(`Runtime session request failed for ${url}.`, error);
    return undefined;
  }

  if (!response.ok) {
    return undefined;
  }

  return response.json() as Promise<T>;
}