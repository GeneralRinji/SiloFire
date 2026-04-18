import { createRuntimeApiService, matchRuntimeApiRequest } from '../project-root/packages/runtime-server/src/index.ts';

const DEFAULT_PORT = 8080;
const DIST_DIR = new URL('../project-root/apps/web/dist/', import.meta.url);
const INDEX_FILE = new URL('./index.html', DIST_DIR);
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
  contentRoot: 'project-root/packages/content',
});

const port = resolvePort(Deno.env.get('PORT'));

console.log(`Serving Silofire static build from ${DIST_DIR.pathname} on http://localhost:${port}`);
console.log('Serving static build plus /api/runtime-* endpoints through Deno.');

Deno.serve({ port }, async (request) => {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);
  const runtimeApiMatch = matchRuntimeApiRequest(url.pathname + url.search);

  if (runtimeApiMatch) {
    if (runtimeApiMatch.kind === 'clock_snapshot') {
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
    return new Response(file.bytes, {
      headers: {
        'content-type': file.contentType,
      },
    });
  }

  const spaFallback = await readFileIfExists(INDEX_FILE);

  if (!spaFallback) {
    return new Response('Missing dist/index.html. Run `npm run build` first.', { status: 500 });
  }

  return new Response(spaFallback.bytes, {
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