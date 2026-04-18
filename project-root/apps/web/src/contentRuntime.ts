import { appendRecentLog, createContentRuntime, type RuntimeClockSource, type RuntimeWeatherSource } from './contentRuntimeCore';

const DISCOVERED_CONTENT_FILES = import.meta.glob(
  [
    '../../../packages/content/*/*.md',
    '../../../packages/content/*/**/*.md',
    '../../../packages/content/*/*.yaml',
    '../../../packages/content/*/**/*.yaml',
    '../../../packages/content/*/*.yml',
    '../../../packages/content/*/**/*.yml',
  ],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

let activeRuntimeClockSource: RuntimeClockSource | undefined;
let activeRuntimeWeatherSource: RuntimeWeatherSource | undefined;

const runtime = createContentRuntime(DISCOVERED_CONTENT_FILES, {
  validateProjects: true,
  clockSource: {
    getSnapshot(projectId, nodeId) {
      return activeRuntimeClockSource?.getSnapshot(projectId, nodeId);
    },
  },
  weatherSource: {
    getSnapshot(project, nodeId, nodeRegion) {
      return activeRuntimeWeatherSource?.getSnapshot(project, nodeId, nodeRegion);
    },
  },
});

export const PROJECT_RUNTIME = runtime.runtime;
export const createInitialProjectSessionState = runtime.createInitialProjectSessionState;
export const resolveProjectAction = runtime.resolveProjectAction;
export const resolveProjectControl = runtime.resolveProjectControl;
export const resolveProjectEnter = runtime.resolveProjectEnter;
export const getProjectedPage = runtime.getProjectedPage;
export const getOfferedActions = runtime.getOfferedActions;
export { appendRecentLog };
export type { RuntimeClockSource, RuntimeWeatherSource } from './contentRuntimeCore';

export function getRuntimeClockSnapshot(projectId: string, nodeId?: string) {
  return activeRuntimeClockSource?.getSnapshot(projectId, nodeId) ?? PROJECT_RUNTIME[projectId]?.defaultClock;
}

export function setRuntimeClockSource(clockSource: RuntimeClockSource | undefined): void {
  activeRuntimeClockSource = clockSource;
}

export function setRuntimeWeatherSource(weatherSource: RuntimeWeatherSource | undefined): void {
  activeRuntimeWeatherSource = weatherSource;
}
