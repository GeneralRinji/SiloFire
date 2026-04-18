import type { PathDirection } from '../../../packages/schema/src';

export interface ProjectNodeLinkLike {
  id: string;
}

export interface ProjectRouteState {
  kind: 'project';
  projectId: string;
  nodeId?: string;
  pathDirection?: PathDirection;
  pathBeatIndex?: number;
  runNonce: number;
}

export interface ProjectRouteUpdate {
  nodeId?: string;
  pathDirection?: PathDirection;
  pathBeatIndex?: number;
  runNonce?: number;
  runNonceIncrement?: number;
}

export function buildProjectRouteState(
  projectId: string,
  route: ProjectRouteUpdate,
  activeRoute?: ProjectRouteState,
): ProjectRouteState {
  const nextRunNonce = route.runNonce
    ?? ((activeRoute?.projectId === projectId ? activeRoute.runNonce : 0) + (route.runNonceIncrement ?? 0));

  return {
    kind: 'project',
    projectId,
    nodeId: route.nodeId,
    pathDirection: route.pathDirection,
    pathBeatIndex: route.pathDirection ? (route.pathBeatIndex ?? 0) : undefined,
    runNonce: nextRunNonce,
  };
}

export function collectProjectNodeIds(projectNodes: ProjectNodeLinkLike[]): Set<string> {
  return new Set(projectNodes.map((node) => node.id));
}

export function selectProjectNodeScopedEntries<T>(
  current: Record<string, T>,
  projectNodeIds: Set<string>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(current).filter(([nodeId]) => projectNodeIds.has(nodeId)),
  );
}

export function omitProjectNodeScopedEntries<T>(
  current: Record<string, T>,
  projectNodeIds: Set<string>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(current).filter(([nodeId]) => !projectNodeIds.has(nodeId)),
  );
}

export function replaceProjectNodeScopedEntries<T>(
  current: Record<string, T>,
  projectNodeIds: Set<string>,
  nextProjectEntries: Record<string, T>,
): Record<string, T> {
  return {
    ...omitProjectNodeScopedEntries(current, projectNodeIds),
    ...nextProjectEntries,
  };
}