import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { parseNpcSidecar, parseStateSidecar, parseTimeSettingsSidecar, parseWeatherSettingsSidecar } from '../../packages/parser/src';
import { resolveProjectClockSnapshot } from './src/runtimeClock';
import { resolveRuntimeAmbientSnapshot } from './src/runtimeAmbient';
import { resolveRuntimeWeatherProjectSnapshot } from './src/runtimeWeather';

const projectRoot = resolve(__dirname, '..', '..');

function extractDefaultClock(projectId: string) {
  const statePath = resolve(projectRoot, 'packages', 'content', projectId, 'state', 'world.yaml');

  if (!existsSync(statePath)) {
    return undefined;
  }

  const parsedState = parseStateSidecar(readFileSync(statePath, 'utf8'), statePath);
  const world = parsedState.value?.world;
  const time = world && typeof world === 'object' ? (world as Record<string, unknown>).time : undefined;
  const phase = time && typeof time === 'object' && typeof (time as Record<string, unknown>).phase === 'string'
    ? (time as Record<string, string>).phase
    : undefined;
  const cycleValue = time && typeof time === 'object'
    ? (time as Record<string, unknown>).cycle
    : undefined;
  const cycle = Array.isArray(cycleValue)
    ? cycleValue.filter((entry): entry is string => typeof entry === 'string')
    : undefined;

  if (!phase && !cycle) {
    return undefined;
  }

  return {
    phase,
    cycle,
    source: 'server-seed',
  };
}

function createRuntimeClockApiPlugin() {
  const anchorMsByProjectId = new Map<string, number>();
  const ambientAnchorMsByNpcId = new Map<string, number>();
  const weatherAnchorMsByPatternKey = new Map<string, number>();

  return {
    name: 'runtime-clock-api',
    configureServer(server: { middlewares: { use: (handler: (req: { method?: string; url?: string }, res: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const ambientStreamMatch = /^\/api\/runtime-ambient\/([^/?#]+)\/stream(?:\?.*)?$/.exec(url);
        const weatherStreamMatch = /^\/api\/runtime-weather\/([^/?#]+)\/stream(?:\?.*)?$/.exec(url);
        const streamMatch = /^\/api\/runtime-clock\/([^/?#]+)\/stream(?:\?.*)?$/.exec(url);
        const match = /^\/api\/runtime-clock\/([^/?#]+)/.exec(url);

        if (weatherStreamMatch) {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          const projectId = decodeURIComponent(weatherStreamMatch[1]);
          const settingsPath = resolve(projectRoot, 'packages', 'content', projectId, 'settings', 'weather.yaml');

          if (!existsSync(settingsPath)) {
            res.statusCode = 404;
            res.end('Weather settings not found');
            return;
          }

          const parsedWeatherSettings = parseWeatherSettingsSidecar(readFileSync(settingsPath, 'utf8'), settingsPath);

          if (!parsedWeatherSettings.value || parsedWeatherSettings.errors.length > 0) {
            res.statusCode = 500;
            res.end('Weather settings invalid');
            return;
          }

          const writeSnapshot = () => {
            if (typeof (res as { write?: (chunk: string) => void }).write !== 'function') {
              return;
            }

            const snapshot = resolveRuntimeWeatherProjectSnapshot({
              projectId,
              weatherSettings: parsedWeatherSettings.value,
            }, Date.now(), weatherAnchorMsByPatternKey);

            (res as { write: (chunk: string) => void }).write(`data: ${JSON.stringify(snapshot)}\n\n`);
          };

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');

          writeSnapshot();
          const intervalId = setInterval(writeSnapshot, 1000);
          (req as { on?: (event: string, listener: () => void) => void }).on?.('close', () => {
            clearInterval(intervalId);
          });
          return;
        }

        if (ambientStreamMatch) {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          const projectId = decodeURIComponent(ambientStreamMatch[1]);
          const npcDefinitionsById = collectNpcDefinitions(projectId);
          const npcStateSeedsById = extractNpcStateSeeds(projectId);
          const writeSnapshot = () => {
            if (typeof (res as { write?: (chunk: string) => void }).write !== 'function') {
              return;
            }

            const snapshot = resolveRuntimeAmbientSnapshot(npcDefinitionsById, Date.now(), ambientAnchorMsByNpcId, npcStateSeedsById);
            (res as { write: (chunk: string) => void }).write(`data: ${JSON.stringify(snapshot)}\n\n`);
          };

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');

          writeSnapshot();
          const intervalId = setInterval(writeSnapshot, 1000);
          (req as { on?: (event: string, listener: () => void) => void }).on?.('close', () => {
            clearInterval(intervalId);
          });
          return;
        }

        if (streamMatch) {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          const projectId = decodeURIComponent(streamMatch[1]);
          const requestUrl = new URL(url, 'http://localhost');
          const nodeId = requestUrl.searchParams.get('nodeId') ?? undefined;
          const nodeRegion = requestUrl.searchParams.get('nodeRegion') ?? undefined;
          const settingsPath = resolve(projectRoot, 'packages', 'content', projectId, 'settings', 'time.yaml');

          if (!existsSync(settingsPath)) {
            res.statusCode = 404;
            res.end('Clock settings not found');
            return;
          }

          const parsedTimeSettings = parseTimeSettingsSidecar(readFileSync(settingsPath, 'utf8'), settingsPath);

          if (!parsedTimeSettings.value || parsedTimeSettings.errors.length > 0) {
            res.statusCode = 500;
            res.end('Clock settings invalid');
            return;
          }

          const defaultClock = extractDefaultClock(projectId);
          const writeSnapshot = () => {
            const snapshot = resolveProjectClockSnapshot({
              projectId,
              timeSettings: parsedTimeSettings.value,
              defaultClock,
            }, Date.now(), anchorMsByProjectId, nodeId, nodeRegion);

            if (!snapshot || typeof (res as { write?: (chunk: string) => void }).write !== 'function') {
              return;
            }

            (res as { write: (chunk: string) => void }).write(`data: ${JSON.stringify({
              ...snapshot,
              source: resolveClockSourceLabel(parsedTimeSettings.value, defaultClock),
            })}\n\n`);
          };

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');

          writeSnapshot();
          const intervalId = setInterval(writeSnapshot, 1000);
          (req as { on?: (event: string, listener: () => void) => void }).on?.('close', () => {
            clearInterval(intervalId);
          });
          return;
        }

        if (!match) {
          next();
          return;
        }

        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        const projectId = decodeURIComponent(match[1]);
        const requestUrl = new URL(url, 'http://localhost');
        const nodeId = requestUrl.searchParams.get('nodeId') ?? undefined;
        const nodeRegion = requestUrl.searchParams.get('nodeRegion') ?? undefined;
        const settingsPath = resolve(projectRoot, 'packages', 'content', projectId, 'settings', 'time.yaml');

        if (!existsSync(settingsPath)) {
          res.statusCode = 404;
          res.end('Clock settings not found');
          return;
        }

        const parsedTimeSettings = parseTimeSettingsSidecar(readFileSync(settingsPath, 'utf8'), settingsPath);

        if (!parsedTimeSettings.value || parsedTimeSettings.errors.length > 0) {
          res.statusCode = 500;
          res.end('Clock settings invalid');
          return;
        }

        const defaultClock = extractDefaultClock(projectId);
        const snapshot = resolveProjectClockSnapshot({
          projectId,
          timeSettings: parsedTimeSettings.value,
          defaultClock,
        }, Date.now(), anchorMsByProjectId, nodeId, nodeRegion);

        if (!snapshot) {
          res.statusCode = 404;
          res.end('Clock not available');
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ...snapshot,
          source: resolveClockSourceLabel(parsedTimeSettings.value, defaultClock),
        }));
      });
    },
  };
}

function collectNpcDefinitions(projectId: string) {
  const npcDirectoryPath = resolve(projectRoot, 'packages', 'content', projectId, 'npcs');

  if (!existsSync(npcDirectoryPath)) {
    return {};
  }

  const entries = readdirSync(npcDirectoryPath, { withFileTypes: true });

  return Object.fromEntries(entries.flatMap((entry) => {
    if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) {
      return [];
    }

    const npcPath = resolve(npcDirectoryPath, entry.name);
    const parsedNpc = parseNpcSidecar(readFileSync(npcPath, 'utf8'), npcPath);

    if (!parsedNpc.value || parsedNpc.errors.length > 0) {
      return [];
    }

    return [[parsedNpc.value.id, parsedNpc.value] as const];
  }));
}

function extractNpcStateSeeds(projectId: string) {
  const statePath = resolve(projectRoot, 'packages', 'content', projectId, 'state', 'world.yaml');

  if (!existsSync(statePath)) {
    return {};
  }

  const parsedState = parseStateSidecar(readFileSync(statePath, 'utf8'), statePath);
  const npcsValue = parsedState.value?.npcs;

  if (!npcsValue || typeof npcsValue !== 'object' || Array.isArray(npcsValue)) {
    return {};
  }

  return Object.fromEntries(Object.entries(npcsValue).map(([npcId, value]) => {
    const state = value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

    return [npcId, {
      location: typeof state.location === 'string' ? state.location : undefined,
      routeIndex: typeof state.routeIndex === 'number' ? state.routeIndex : undefined,
      paused: typeof state.paused === 'boolean' ? state.paused : undefined,
    }];
  }));
}

function resolveClockSourceLabel(
  timeSettings: NonNullable<ReturnType<typeof parseTimeSettingsSidecar>['value']>,
  defaultClock: ReturnType<typeof extractDefaultClock>,
): string {
  const calendars = timeSettings.calendars ?? {};
  const defaultCalendarId = timeSettings.assignments?.defaultCalendar ?? Object.keys(calendars)[0];
  const defaultCalendar = defaultCalendarId ? calendars[defaultCalendarId] : undefined;

  if (defaultCalendar?.epoch) {
    return 'server:calendar-epoch';
  }

  if (defaultClock?.phase || defaultClock?.cycle?.length) {
    return 'server:state-world';
  }

  return 'server';
}

export default defineConfig({
  plugins: [createRuntimeClockApiPlugin(), react()],
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
});