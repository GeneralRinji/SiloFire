import type { PathDirection } from '../../../packages/schema/src';
import type { ProjectedLogEntry, ProjectionResult } from '../../../packages/projection/src';
import type { RuntimeSessionState } from './contentRuntimeCore';

import { appendRecentLog } from './contentRuntimeCore';

export interface StableProjectedPageResolver {
  resolvePage(
    projectId: string | undefined,
    nodeId: string | undefined,
    pathDirection: PathDirection | undefined,
    areaVisitCount: number | undefined,
    pathVisitCount: number | undefined,
    pathBeatIndex: number | undefined,
    sessionState: RuntimeSessionState | undefined,
    recentEntries: ProjectedLogEntry[] | undefined,
    revisionKey?: string,
  ): ProjectionResult | undefined;
}

export function buildProjectedPageRenderKey(options: {
  projectId: string | undefined;
  nodeId: string | undefined;
  pathDirection: PathDirection | undefined;
  areaVisitCount: number | undefined;
  pathVisitCount?: number | undefined;
  pathBeatIndex?: number | undefined;
  runNonce: number | undefined;
  revisionKey?: string | undefined;
}): string {
  return JSON.stringify({
    projectId: options.projectId,
    nodeId: options.nodeId,
    pathDirection: options.pathDirection,
    areaVisitCount: options.areaVisitCount,
    pathVisitCount: options.pathVisitCount,
    pathBeatIndex: options.pathBeatIndex,
    runNonce: options.runNonce ?? 0,
    revisionKey: options.revisionKey,
  });
}

export function createStableProjectedPageResolver(
  getProjectedPage: (
    projectId: string,
    nodeId: string | undefined,
    pathDirection?: PathDirection,
    options?: { areaVisitCount?: number; pathVisitCount?: number; pathBeatIndex?: number; sessionState?: RuntimeSessionState },
  ) => ProjectionResult | undefined,
): StableProjectedPageResolver {
  let cachedKey: string | undefined;
  let cachedBasePage: ProjectionResult | undefined;

  return {
    resolvePage(projectId, nodeId, pathDirection, areaVisitCount, pathVisitCount, pathBeatIndex, sessionState, recentEntries, revisionKey) {
      if (!projectId) {
        cachedKey = undefined;
        cachedBasePage = undefined;
        return undefined;
      }

      const nextKey = buildProjectedPageRenderKey({
        projectId,
        nodeId,
        pathDirection,
        areaVisitCount,
        pathVisitCount,
        pathBeatIndex,
        runNonce: undefined,
        revisionKey,
      });

      if (cachedKey !== nextKey) {
        cachedKey = nextKey;
        cachedBasePage = getProjectedPage(projectId, nodeId, pathDirection, { areaVisitCount, pathVisitCount, pathBeatIndex, sessionState });
      }

      return appendRecentLog(cachedBasePage, recentEntries);
    },
  };
}