import type { PathDirection } from '../../../packages/schema/src';
import type { ProjectedLogEntry } from '../../../packages/projection/src';

import type { RuntimeInteractionOutcome, RuntimeSessionState } from './contentRuntimeCore';

export interface ObservedPhaseState {
  projectId: string;
  nodeId: string;
  phase?: string;
}

export type ObservedPhaseChangeDecision =
  | { kind: 'ignore' }
  | {
      kind: 'redirect';
      nextNodeId: string;
      nextPathDirection?: PathDirection;
      sessionState?: RuntimeSessionState;
      logEntry?: ProjectedLogEntry;
    }
  | {
      kind: 'append';
      logEntry?: ProjectedLogEntry;
      sessionState?: RuntimeSessionState;
      shouldAppendLog: boolean;
    };

export function resolveObservedPhaseChange(options: {
  previousObserved: ObservedPhaseState | undefined;
  nextObserved: ObservedPhaseState;
  outcome: RuntimeInteractionOutcome;
  latestRecentEntryText?: string;
}): ObservedPhaseChangeDecision {
  const { previousObserved, nextObserved, outcome, latestRecentEntryText } = options;

  if (
    !previousObserved
    || previousObserved.projectId !== nextObserved.projectId
    || previousObserved.nodeId !== nextObserved.nodeId
    || previousObserved.phase === nextObserved.phase
    || !nextObserved.phase
  ) {
    return { kind: 'ignore' };
  }

  if (outcome.nextNodeId) {
    return {
      kind: 'redirect',
      nextNodeId: outcome.nextNodeId,
      nextPathDirection: outcome.nextPathDirection,
      sessionState: outcome.sessionState,
      logEntry: outcome.logEntry,
    };
  }

  return {
    kind: 'append',
    logEntry: outcome.logEntry,
    sessionState: outcome.sessionState,
    shouldAppendLog: outcome.logEntry?.text !== latestRecentEntryText,
  };
}