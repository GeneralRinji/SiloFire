import type { ProjectedAction, ProjectedControl, ProjectedLogEntry } from '../project-root/packages/projection/src/index.ts';
import type { RuntimeSessionState } from '../project-root/packages/runtime/src/index.ts';
import {
  createRuntimeApiService,
  matchRuntimeApiRequest,
  type PersistedRuntimeSessionSnapshot,
  type SiteAnnouncementRecord,
} from '../project-root/packages/runtime-server/src/index.ts';
import { DenoKvKeyValueStore, type DenoKvLike } from '../project-root/packages/storage-deno/src/index.ts';

const DEFAULT_PORT = 8080;
const DIST_DIR = new URL('../project-root/apps/web/dist/', import.meta.url);
const INDEX_FILE = new URL('./index.html', DIST_DIR);
const kv = await Deno.openKv();
const runtimeApi = createRuntimeApiService({
  async readText(path) {
    const fileUrl = new URL(`./${path}`, new URL('../', import.meta.url));

    try {
      return await Deno.readTextFile(fileUrl);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return undefined;
      }

      throw error;
    }
  },
  async readDirectory(path) {
    const directoryUrl = new URL(`./${path}`, new URL('../', import.meta.url));

    try {
      const entries: Array<{ name: string; isFile: boolean }> = [];

      for await (const entry of Deno.readDir(directoryUrl)) {
        entries.push({
          name: entry.name,
          isFile: entry.isFile,
        });
      }

      return entries;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return [];
      }

      throw error;
    }
  },
}, {
  adminPassword: Deno.env.get('SILOFIRE_ADMIN_PASSWORD') ?? undefined,
  contentRoot: 'project-root/packages/content',
  heartStore: new DenoKvKeyValueStore<number>(kv as unknown as DenoKvLike<number>, ['silofire', 'analytics', 'hearts']),
  snapshotStore: new DenoKvKeyValueStore<PersistedRuntimeSessionSnapshot>(kv as unknown as DenoKvLike<PersistedRuntimeSessionSnapshot>, ['silofire', 'runtime', 'snapshots']),
  siteAnnouncementStore: new DenoKvKeyValueStore<SiteAnnouncementRecord>(kv as unknown as DenoKvLike<SiteAnnouncementRecord>, ['silofire', 'site', 'announcements']),
});
const siteAnnouncementStream = createSiteAnnouncementStreamController(async () => await runtimeApi.getSiteAnnouncementSnapshot());

const port = resolvePort(Deno.env.get('PORT'));

console.log(`Serving Silofire static build from ${DIST_DIR.pathname} on http://localhost:${port}`);
console.log('Serving static build plus /api/runtime-* endpoints through Deno.');

Deno.serve({ port }, async (request) => {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);
  const runtimeApiMatch = matchRuntimeApiRequest(url.pathname + url.search);

  if (runtimeApiMatch) {
    if (runtimeApiMatch.kind === 'site_announcement_stream') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      return siteAnnouncementStream.connect(request);
    }

    if (runtimeApiMatch.kind === 'site_announcement_snapshot') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        return Response.json(await runtimeApi.getSiteAnnouncementSnapshot());
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'heart_update') {
      if (request.method !== 'POST' && request.method !== 'DELETE') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const heartCount = await runtimeApi.setHeart(runtimeApiMatch.projectId, runtimeApiMatch.nodeId, request.method === 'POST');

        return heartCount
          ? Response.json(heartCount)
          : new Response('Node not found', { status: 404 });
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (
      runtimeApiMatch.kind === 'admin_heart_overview'
      || runtimeApiMatch.kind === 'admin_heart_project'
      || runtimeApiMatch.kind === 'admin_heart_reset'
      || runtimeApiMatch.kind === 'admin_site_announcement_snapshot'
      || runtimeApiMatch.kind === 'admin_site_announcement_item'
    ) {
      if (!runtimeApi.isAdminPasswordValid(request.headers.get('x-silofire-admin-password') ?? undefined)) {
        return new Response('Unauthorized', { status: 401 });
      }

      if (runtimeApiMatch.kind === 'admin_site_announcement_snapshot') {
        if (request.method === 'GET') {
          try {
            return Response.json(await runtimeApi.getAdminSiteAnnouncementSnapshot());
          } catch (error) {
            console.error(error);
            return new Response('Runtime API failed', { status: 500 });
          }
        }

        if (request.method === 'POST') {
          try {
            const result = await runtimeApi.createSiteAnnouncement(await readJsonBody(request));

            if (result.kind === 'validation_error') {
              return Response.json({ errors: result.errors }, { status: 400 });
            }

            void siteAnnouncementStream.broadcastCurrentSnapshot();
            return Response.json(result.value);
          } catch (error) {
            console.error(error);
            return new Response('Runtime API failed', { status: 500 });
          }
        }

        return new Response('Method Not Allowed', { status: 405 });
      }

      if (runtimeApiMatch.kind === 'admin_site_announcement_item') {
        if (request.method === 'PUT') {
          try {
            const result = await runtimeApi.updateSiteAnnouncement(runtimeApiMatch.announcementId, await readJsonBody(request));

            if (result.kind === 'not_found') {
              return new Response('Announcement not found', { status: 404 });
            }

            if (result.kind === 'validation_error') {
              return Response.json({ errors: result.errors }, { status: 400 });
            }

            void siteAnnouncementStream.broadcastCurrentSnapshot();
            return Response.json(result.value);
          } catch (error) {
            console.error(error);
            return new Response('Runtime API failed', { status: 500 });
          }
        }

        if (request.method === 'DELETE') {
          try {
            const deleted = await runtimeApi.deleteSiteAnnouncement(runtimeApiMatch.announcementId);
            if (deleted) {
              void siteAnnouncementStream.broadcastCurrentSnapshot();
            }
            return deleted
              ? Response.json({ ok: true })
              : new Response('Announcement not found', { status: 404 });
          } catch (error) {
            console.error(error);
            return new Response('Runtime API failed', { status: 500 });
          }
        }

        return new Response('Method Not Allowed', { status: 405 });
      }

      if (runtimeApiMatch.kind === 'admin_heart_overview') {
        if (request.method !== 'GET') {
          return new Response('Method Not Allowed', { status: 405 });
        }

        try {
          return Response.json(await runtimeApi.listHeartAdminOverview());
        } catch (error) {
          console.error(error);
          return new Response('Runtime API failed', { status: 500 });
        }
      }

      if (runtimeApiMatch.kind === 'admin_heart_project') {
        if (request.method !== 'GET') {
          return new Response('Method Not Allowed', { status: 405 });
        }

        try {
          const details = await runtimeApi.getHeartAdminProject(runtimeApiMatch.projectId);
          return details
            ? Response.json(details)
            : new Response('Project not found', { status: 404 });
        } catch (error) {
          console.error(error);
          return new Response('Runtime API failed', { status: 500 });
        }
      }

      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        await runtimeApi.resetProjectHearts(runtimeApiMatch.projectId);
        return Response.json({ ok: true });
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'project_list') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        return Response.json(await runtimeApi.listProjects());
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'session_create') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const body = await readJsonBody(request);
        const sessionView = await runtimeApi.createSession(runtimeApiMatch.projectId, {
          nodeId: getOptionalStringValue(body, 'nodeId'),
          pathDirection: getOptionalPathDirectionValue(body, 'pathDirection'),
          pathBeatIndex: getOptionalNumberValue(body, 'pathBeatIndex'),
        });

        return sessionView
          ? Response.json(sessionView)
          : new Response('Session could not be created', { status: 404 });
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'session_restore') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const body = await readJsonBody(request);
        const sessionView = await runtimeApi.restoreSession(runtimeApiMatch.projectId, {
          projectId: getRequiredStringValue(body, 'projectId'),
          route: getRequiredRouteValue(body),
          areaVisitCounts: getOptionalNumberRecordValue(body, 'areaVisitCounts'),
          pathVisitCounts: getOptionalNumberRecordValue(body, 'pathVisitCounts'),
          recentLogByNodeId: getOptionalProjectedLogRecordValue(body, 'recentLogByNodeId'),
          actionAttemptsByNodeId: getOptionalNestedNumberRecordValue(body, 'actionAttemptsByNodeId'),
          sessionState: getOptionalRuntimeSessionStateValue(body, 'sessionState'),
        });

        return sessionView
          ? Response.json(sessionView)
          : new Response('Session could not be restored', { status: 404 });
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'session_snapshot') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const sessionView = await runtimeApi.getSession(runtimeApiMatch.sessionId);
        return sessionView
          ? Response.json(sessionView)
          : new Response('Session not found', { status: 404 });
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'session_action') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const body = await readJsonBody(request);
        const sessionView = await runtimeApi.applySessionAction(runtimeApiMatch.sessionId, {
          id: getRequiredStringValue(body, 'id'),
          kind: getRequiredActionKindValue(body, 'kind'),
          label: getRequiredStringValue(body, 'label'),
          key: getOptionalStringValue(body, 'key'),
          keyLabel: getOptionalStringValue(body, 'keyLabel'),
          meta: getOptionalStringValue(body, 'meta'),
          targetId: getOptionalStringValue(body, 'targetId'),
        });

        return sessionView
          ? Response.json(sessionView)
          : new Response('Session not found', { status: 404 });
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'session_control') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const body = await readJsonBody(request);
        const sessionView = await runtimeApi.applySessionControl(runtimeApiMatch.sessionId, {
          id: getRequiredStringValue(body, 'id'),
          kind: getRequiredControlKindValue(body, 'kind'),
          label: getRequiredStringValue(body, 'label'),
          key: getOptionalStringValue(body, 'key'),
          keyLabel: getOptionalStringValue(body, 'keyLabel'),
        });

        return sessionView
          ? Response.json(sessionView)
          : new Response('Session not found', { status: 404 });
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'session_reset') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      try {
        const body = await readJsonBody(request);
        const sessionView = await runtimeApi.resetSession(
          runtimeApiMatch.sessionId,
          getOptionalStringValue(body, 'destinationNodeId'),
        );

        return sessionView
          ? Response.json(sessionView)
          : new Response('Session not found', { status: 404 });
      } catch (error) {
        console.error(error);
        return new Response('Runtime API failed', { status: 500 });
      }
    }

    if (runtimeApiMatch.kind === 'clock_snapshot') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      const snapshot = await runtimeApi.getClockSnapshot(runtimeApiMatch.projectId, runtimeApiMatch.nodeId, runtimeApiMatch.nodeRegion);
      return snapshot
        ? Response.json(snapshot)
        : new Response('Clock not available', { status: 404 });
    }

    if (runtimeApiMatch.kind === 'clock_stream') {
      const initialSnapshot = await runtimeApi.getClockSnapshot(runtimeApiMatch.projectId, runtimeApiMatch.nodeId, runtimeApiMatch.nodeRegion);
      if (!initialSnapshot) {
        return new Response('Clock not available', { status: 404 });
      }

      return new Response(createSseStream(request, initialSnapshot, async () => await runtimeApi.getClockSnapshot(runtimeApiMatch.projectId, runtimeApiMatch.nodeId, runtimeApiMatch.nodeRegion)), {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        },
      });
    }

    if (runtimeApiMatch.kind === 'weather_stream') {
      const initialSnapshot = await runtimeApi.getWeatherProjectSnapshot(runtimeApiMatch.projectId);
      if (!initialSnapshot) {
        return new Response('Weather settings not found', { status: 404 });
      }

      return new Response(createSseStream(request, initialSnapshot, async () => await runtimeApi.getWeatherProjectSnapshot(runtimeApiMatch.projectId)), {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        },
      });
    }

    return new Response(createSseStream(request, await runtimeApi.getAmbientSnapshot(runtimeApiMatch.projectId), async () => await runtimeApi.getAmbientSnapshot(runtimeApiMatch.projectId)), {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  }

  const candidate = pathname === '/' ? INDEX_FILE : new URL(`.${pathname}`, DIST_DIR);
  const file = await readFileIfExists(candidate);

  if (file) {
    return new Response(toArrayBuffer(file.bytes), {
      headers: {
        'content-type': file.contentType,
      },
    });
  }

  const spaFallback = await readFileIfExists(INDEX_FILE);

  if (!spaFallback) {
    return new Response('Missing dist/index.html. Run `npm run build` first.', { status: 500 });
  }

  return new Response(toArrayBuffer(spaFallback.bytes), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
});

async function readFileIfExists(fileUrl: URL): Promise<{ bytes: Uint8Array; contentType: string } | undefined> {
  try {
    const details = await Deno.stat(fileUrl);

    if (!details.isFile) {
      return undefined;
    }

    return {
      bytes: await Deno.readFile(fileUrl),
      contentType: contentTypeForPath(fileUrl.pathname),
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }

    throw error;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

function resolvePort(rawPort: string | undefined): number {
  const parsed = Number(rawPort);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

function contentTypeForPath(pathname: string): string {
  if (pathname.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }

  if (pathname.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }

  if (pathname.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }

  if (pathname.endsWith('.json')) {
    return 'application/json; charset=utf-8';
  }

  if (pathname.endsWith('.svg')) {
    return 'image/svg+xml';
  }

  if (pathname.endsWith('.png')) {
    return 'image/png';
  }

  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (pathname.endsWith('.webp')) {
    return 'image/webp';
  }

  if (pathname.endsWith('.ico')) {
    return 'image/x-icon';
  }

  return 'application/octet-stream';
}

function createSseStream(
  request: Request,
  initialPayload: unknown,
  readPayload: () => Promise<unknown>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const writePayload = async () => {
        if (closed) {
          return;
        }

        const payload = await readPayload();

        if (payload === undefined) {
          return;
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`));
      const intervalId = setInterval(() => {
        void writePayload();
      }, 1000);

      request.signal.addEventListener('abort', () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(intervalId);
        controller.close();
      });
    },
    cancel() {
      // Request abort handles cleanup.
    },
  });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) {
    return {};
  }

  const parsed = await request.json();
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function getOptionalStringValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function getRequiredStringValue(record: Record<string, unknown>, key: string): string {
  const value = getOptionalStringValue(record, key);

  if (value === undefined) {
    throw new Error(`Missing required string field: ${key}`);
  }

  return value;
}

function getOptionalNumberValue(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getOptionalNumberRecordValue(record: Record<string, unknown>, key: string): Record<string, number> {
  const value = record[key];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => typeof entryValue === 'number' && Number.isFinite(entryValue)),
  );
}

function getOptionalRecordValue(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getOptionalNestedNumberRecordValue(record: Record<string, unknown>, key: string): Record<string, Record<string, number>> {
  const value = record[key];

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => {
      if (!entryValue || typeof entryValue !== 'object' || Array.isArray(entryValue)) {
        return [entryKey, {}];
      }

      return [
        entryKey,
        Object.fromEntries(
          Object.entries(entryValue).filter(([, nestedValue]) => typeof nestedValue === 'number' && Number.isFinite(nestedValue)),
        ),
      ];
    }),
  ) as Record<string, Record<string, number>>;
}

function getOptionalProjectedLogRecordValue(record: Record<string, unknown>, key: string): Record<string, ProjectedLogEntry[]> {
  return getOptionalRecordValue(record, key) as Record<string, ProjectedLogEntry[]>;
}

function getOptionalRuntimeSessionStateValue(record: Record<string, unknown>, key: string): RuntimeSessionState {
  return getOptionalRecordValue(record, key) as RuntimeSessionState;
}

function getOptionalPathDirectionValue(record: Record<string, unknown>, key: string): 'forward' | 'backward' | undefined {
  const value = record[key];
  return value === 'forward' || value === 'backward' ? value : undefined;
}

function getRequiredRouteValue(record: Record<string, unknown>): {
  nodeId?: string;
  pathDirection?: 'forward' | 'backward';
  pathBeatIndex?: number;
  runNonce: number;
} {
  const routeRecord = getOptionalRecordValue(record, 'route');
  const runNonce = getOptionalNumberValue(routeRecord, 'runNonce');

  if (runNonce === undefined) {
    throw new Error('Missing required route.runNonce');
  }

  return {
    nodeId: getOptionalStringValue(routeRecord, 'nodeId'),
    pathDirection: getOptionalPathDirectionValue(routeRecord, 'pathDirection'),
    pathBeatIndex: getOptionalNumberValue(routeRecord, 'pathBeatIndex'),
    runNonce,
  };
}

function getRequiredActionKindValue(record: Record<string, unknown>, key: string): ProjectedAction['kind'] {
  const value = record[key];

  if (value === 'exit' || value === 'choice' || value === 'poi' || value === 'gate_action') {
    return value;
  }

  throw new Error(`Missing required action kind: ${key}`);
}

function getRequiredControlKindValue(record: Record<string, unknown>, key: string): ProjectedControl['kind'] {
  const value = record[key];

  if (value === 'back' || value === 'continue' || value === 'skip') {
    return value;
  }

  throw new Error(`Missing required control kind: ${key}`);
}

function createSiteAnnouncementStreamController(
  readSnapshot: () => Promise<SiteAnnouncementRecord extends never ? never : Awaited<ReturnType<typeof runtimeApi.getSiteAnnouncementSnapshot>>>,
) {
  const encoder = new TextEncoder();
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  let nextBroadcastTimeout: number | undefined;

  function clearScheduledBroadcast(): void {
    if (nextBroadcastTimeout !== undefined) {
      clearTimeout(nextBroadcastTimeout);
      nextBroadcastTimeout = undefined;
    }
  }

  function scheduleNextBroadcast(snapshot: { currentTimeMs?: number; nextChangeAtMs?: number }): void {
    clearScheduledBroadcast();

    if (clients.size === 0 || !Number.isFinite(snapshot.nextChangeAtMs) || !Number.isFinite(snapshot.currentTimeMs)) {
      return;
    }

    const delayMs = Math.max(0, (snapshot.nextChangeAtMs as number) - (snapshot.currentTimeMs as number)) + 50;
    nextBroadcastTimeout = setTimeout(() => {
      void broadcastCurrentSnapshot();
    }, delayMs);
  }

  async function broadcastCurrentSnapshot(): Promise<void> {
    const snapshot = await readSnapshot();
    const payload = encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`);

    for (const client of [...clients]) {
      try {
        client.enqueue(payload);
      } catch {
        clients.delete(client);
      }
    }

    scheduleNextBroadcast(snapshot);
  }

  return {
    connect(request: Request): Response {
      return new Response(new ReadableStream<Uint8Array>({
        async start(controller) {
          clients.add(controller);

          try {
            const snapshot = await readSnapshot();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
            scheduleNextBroadcast(snapshot);
          } catch (error) {
            clients.delete(controller);
            controller.error(error);
            return;
          }

          request.signal.addEventListener('abort', () => {
            clients.delete(controller);
            if (clients.size === 0) {
              clearScheduledBroadcast();
            }

            try {
              controller.close();
            } catch {
              // Ignore close after stream shutdown.
            }
          });
        },
      }), {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        },
      });
    },
    async broadcastCurrentSnapshot() {
      await broadcastCurrentSnapshot();
    },
  };
}