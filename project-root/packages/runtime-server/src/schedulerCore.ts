export type SchedulerTaskTrigger =
  | { kind: 'exact_time'; atMs: number }
  | { kind: 'interval'; everyMs: number; startAtMs?: number; endAtMs?: number }
  | { kind: 'armed_delay'; delayMs: number };

export interface SchedulerTaskDefinition<TPayload = unknown> {
  id: string;
  enabled: boolean;
  trigger: SchedulerTaskTrigger;
  payload: TPayload;
}

export interface SchedulerTaskState {
  armedAtMs?: number;
  lastFiredAtMs?: number;
}

export interface SchedulerEvaluationResult<TPayload = unknown> {
  dueTaskIds: string[];
  nextWakeAtMs?: number;
  taskResults: Array<{
    id: string;
    due: boolean;
    nextRunAtMs?: number;
    payload: TPayload;
  }>;
}

export function evaluateSchedulerTasks<TPayload>(
  tasks: SchedulerTaskDefinition<TPayload>[],
  stateByTaskId: Record<string, SchedulerTaskState> | undefined,
  nowMs: number,
): SchedulerEvaluationResult<TPayload> {
  const taskResults = tasks.map((task) => {
    const state = stateByTaskId?.[task.id];
    const nextRunAtMs = resolveNextTaskRunAtMs(task, state, nowMs);
    return {
      id: task.id,
      due: typeof nextRunAtMs === 'number' && nextRunAtMs <= nowMs,
      nextRunAtMs,
      payload: task.payload,
    };
  });

  return {
    dueTaskIds: taskResults.filter((task) => task.due).map((task) => task.id),
    nextWakeAtMs: taskResults
      .map((task) => task.nextRunAtMs)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > nowMs)
      .sort((left, right) => left - right)[0],
    taskResults,
  };
}

export function resolveNextTaskRunAtMs(
  task: SchedulerTaskDefinition,
  state: SchedulerTaskState | undefined,
  nowMs: number,
): number | undefined {
  if (!task.enabled) {
    return undefined;
  }

  switch (task.trigger.kind) {
    case 'exact_time':
      return task.trigger.atMs;

    case 'armed_delay':
      return typeof state?.armedAtMs === 'number' ? state.armedAtMs + task.trigger.delayMs : undefined;

    case 'interval':
      return resolveNextIntervalRunAtMs(task.trigger, state, nowMs);

    default:
      return undefined;
  }
}

function resolveNextIntervalRunAtMs(
  trigger: Extract<SchedulerTaskTrigger, { kind: 'interval' }>,
  state: SchedulerTaskState | undefined,
  nowMs: number,
): number | undefined {
  if (!Number.isFinite(trigger.everyMs) || trigger.everyMs <= 0) {
    return undefined;
  }

  const anchorAtMs = trigger.startAtMs ?? state?.lastFiredAtMs ?? nowMs;

  if (typeof trigger.endAtMs === 'number' && anchorAtMs > trigger.endAtMs) {
    return undefined;
  }

  if (anchorAtMs >= nowMs) {
    return anchorAtMs;
  }

  const elapsedMs = nowMs - anchorAtMs;
  const intervalsElapsed = Math.ceil(elapsedMs / trigger.everyMs);
  const nextRunAtMs = anchorAtMs + intervalsElapsed * trigger.everyMs;

  if (typeof trigger.endAtMs === 'number' && nextRunAtMs > trigger.endAtMs) {
    return undefined;
  }

  return nextRunAtMs;
}