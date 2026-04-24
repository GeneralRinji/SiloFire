import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { createRuntimeApiService, matchRuntimeApiRequest } from '../../packages/runtime-server/src';
import { NodeFileKeyValueStore } from '../../packages/storage-node/src';
import { createJsonValueCodec } from '../../packages/storage/src';

const projectRoot = resolve(__dirname, '..', '..');
const appNodeModules = resolve(__dirname, 'node_modules');
const runtimeSnapshotRoot = resolve(projectRoot, '.silofire', 'runtime-snapshots');

function createRuntimeClockApiPlugin() {
  const runtimeApi = createRuntimeApiService({
    async readText(path) {
      const absolutePath = resolve(projectRoot, path);
      return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : undefined;
    },
    async readDirectory(path) {
      const absolutePath = resolve(projectRoot, path);

      if (!existsSync(absolutePath)) {
        return [];
      }

      return readdirSync(absolutePath, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        isFile: entry.isFile(),
      }));
    },
  }, {
    snapshotStore: new NodeFileKeyValueStore(runtimeSnapshotRoot, createJsonValueCodec()),
  });

  return {
    name: 'runtime-clock-api',
    configureServer(server: { middlewares: { use: (handler: (req: { method?: string; url?: string }, res: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const match = matchRuntimeApiRequest(url);

        if (!match) {
          next();
          return;
        }

        if (match.kind === 'session_create') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          void readJsonBody(req).then((body) => runtimeApi.createSession(match.projectId, {
            nodeId: getOptionalStringValue(body, 'nodeId'),
            pathDirection: getOptionalPathDirectionValue(body, 'pathDirection'),
            pathBeatIndex: getOptionalNumberValue(body, 'pathBeatIndex'),
          })).then((sessionView) => {
            if (!sessionView) {
              res.statusCode = 404;
              res.end('Session could not be created');
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(sessionView));
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime session API failed');
          });
          return;
        }

        if (match.kind === 'project_list') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          void runtimeApi.listProjects().then((projects) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(projects));
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime session API failed');
          });
          return;
        }

        if (match.kind === 'session_restore') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          void readJsonBody(req).then((body) => runtimeApi.restoreSession(match.projectId, {
            projectId: getRequiredStringValue(body, 'projectId'),
            route: getRequiredRouteValue(body),
            areaVisitCounts: getOptionalRecordValue(body, 'areaVisitCounts'),
            pathVisitCounts: getOptionalRecordValue(body, 'pathVisitCounts'),
            recentLogByNodeId: getOptionalRecordValue(body, 'recentLogByNodeId'),
            actionAttemptsByNodeId: getOptionalRecordValue(body, 'actionAttemptsByNodeId'),
            sessionState: getOptionalRecordValue(body, 'sessionState'),
          })).then((sessionView) => {
            if (!sessionView) {
              res.statusCode = 404;
              res.end('Session could not be restored');
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(sessionView));
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime session API failed');
          });
          return;
        }

        if (match.kind === 'session_snapshot') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          void runtimeApi.getSession(match.sessionId).then((sessionView) => {
            if (!sessionView) {
              res.statusCode = 404;
              res.end('Session not found');
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(sessionView));
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime session API failed');
          });
          return;
        }

        if (match.kind === 'session_action') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          void readJsonBody(req).then((body) => runtimeApi.applySessionAction(match.sessionId, {
            id: getRequiredStringValue(body, 'id'),
            kind: getRequiredActionKindValue(body, 'kind'),
            label: getRequiredStringValue(body, 'label'),
            key: getOptionalStringValue(body, 'key'),
            keyLabel: getOptionalStringValue(body, 'keyLabel'),
            meta: getOptionalStringValue(body, 'meta'),
            targetId: getOptionalStringValue(body, 'targetId'),
          })).then((sessionView) => {
            if (!sessionView) {
              res.statusCode = 404;
              res.end('Session not found');
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(sessionView));
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime session API failed');
          });
          return;
        }

        if (match.kind === 'session_control') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          void readJsonBody(req).then((body) => runtimeApi.applySessionControl(match.sessionId, {
            id: getRequiredStringValue(body, 'id'),
            kind: getRequiredControlKindValue(body, 'kind'),
            label: getRequiredStringValue(body, 'label'),
            key: getOptionalStringValue(body, 'key'),
            keyLabel: getOptionalStringValue(body, 'keyLabel'),
          })).then((sessionView) => {
            if (!sessionView) {
              res.statusCode = 404;
              res.end('Session not found');
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(sessionView));
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime session API failed');
          });
          return;
        }

        if (match.kind === 'session_reset') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          void readJsonBody(req).then((body) => runtimeApi.resetSession(match.sessionId, getOptionalStringValue(body, 'destinationNodeId'))).then((sessionView) => {
            if (!sessionView) {
              res.statusCode = 404;
              res.end('Session not found');
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(sessionView));
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime session API failed');
          });
          return;
        }

        if (match.kind === 'ambient_stream') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          const writeSnapshot = async () => {
            if (typeof (res as { write?: (chunk: string) => void }).write !== 'function') {
              return;
            }

            const snapshot = await runtimeApi.getAmbientSnapshot(match.projectId);
            (res as { write: (chunk: string) => void }).write(`data: ${JSON.stringify(snapshot)}\n\n`);
          };

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('Connection', 'keep-alive');

          void writeSnapshot();
          const intervalId = setInterval(() => {
            void writeSnapshot();
          }, 1000);
          (req as { on?: (event: string, listener: () => void) => void }).on?.('close', () => {
            clearInterval(intervalId);
          });
          return;
        }

        if (match.kind === 'weather_stream') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          void runtimeApi.getWeatherProjectSnapshot(match.projectId).then((initialSnapshot) => {
            if (!initialSnapshot) {
              res.statusCode = 404;
              res.end('Weather settings not found');
              return;
            }

            const writeSnapshot = async () => {
              if (typeof (res as { write?: (chunk: string) => void }).write !== 'function') {
                return;
              }

              const snapshot = await runtimeApi.getWeatherProjectSnapshot(match.projectId);

              if (!snapshot) {
                return;
              }

              (res as { write: (chunk: string) => void }).write(`data: ${JSON.stringify(snapshot)}\n\n`);
            };

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');

            (res as { write: (chunk: string) => void }).write(`data: ${JSON.stringify(initialSnapshot)}\n\n`);
            const intervalId = setInterval(() => {
              void writeSnapshot();
            }, 1000);
            (req as { on?: (event: string, listener: () => void) => void }).on?.('close', () => {
              clearInterval(intervalId);
            });
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime API failed');
          });
          return;
        }

        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        if (match.kind === 'clock_stream') {
          void runtimeApi.getClockSnapshot(match.projectId, match.nodeId, match.nodeRegion).then((initialSnapshot) => {
            if (!initialSnapshot) {
              res.statusCode = 404;
              res.end('Clock not available');
              return;
            }

            const writeSnapshot = async () => {
              if (typeof (res as { write?: (chunk: string) => void }).write !== 'function') {
                return;
              }

              const snapshot = await runtimeApi.getClockSnapshot(match.projectId, match.nodeId, match.nodeRegion);

              if (!snapshot) {
                return;
              }

              (res as { write: (chunk: string) => void }).write(`data: ${JSON.stringify(snapshot)}\n\n`);
            };

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');

            (res as { write: (chunk: string) => void }).write(`data: ${JSON.stringify(initialSnapshot)}\n\n`);
            const intervalId = setInterval(() => {
              void writeSnapshot();
            }, 1000);
            (req as { on?: (event: string, listener: () => void) => void }).on?.('close', () => {
              clearInterval(intervalId);
            });
          }).catch((error) => {
            console.error(error);
            res.statusCode = 500;
            res.end('Runtime API failed');
          });
          return;
        }

        void runtimeApi.getClockSnapshot(match.projectId, match.nodeId, match.nodeRegion).then((snapshot) => {
          if (!snapshot) {
            res.statusCode = 404;
            res.end('Clock not available');
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(snapshot));
        }).catch((error) => {
          console.error(error);
          res.statusCode = 500;
          res.end('Runtime API failed');
        });
      });
    },
  };
}

function readJsonBody(req: { on?: (event: string, listener: (chunk?: string | Buffer) => void) => void }): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on?.('data', (chunk) => {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
        return;
      }

      if (chunk) {
        chunks.push(chunk);
      }
    });
    req.on?.('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on?.('error', reject);
  });
}

function getOptionalStringValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function getRequiredStringValue(record: Record<string, unknown>, key: string): string {
  const value = getOptionalStringValue(record, key);

  if (!value) {
    throw new Error(`Missing required string field: ${key}`);
  }

  return value;
}

function getOptionalNumberValue(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function getOptionalPathDirectionValue(record: Record<string, unknown>, key: string): 'forward' | 'backward' | undefined {
  const value = getOptionalStringValue(record, key);
  return value === 'forward' || value === 'backward' ? value : undefined;
}

function getRequiredActionKindValue(record: Record<string, unknown>, key: string): 'exit' | 'choice' | 'poi' | 'gate_action' {
  const value = getRequiredStringValue(record, key);

  if (value !== 'exit' && value !== 'choice' && value !== 'poi' && value !== 'gate_action') {
    throw new Error(`Invalid action kind: ${value}`);
  }

  return value;
}

function getRequiredControlKindValue(record: Record<string, unknown>, key: string): 'continue' | 'skip' | 'back' {
  const value = getRequiredStringValue(record, key);

  if (value !== 'continue' && value !== 'skip' && value !== 'back') {
    throw new Error(`Invalid control kind: ${value}`);
  }

  return value;
}

function getOptionalRecordValue(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getRequiredRouteValue(record: Record<string, unknown>): {
  nodeId?: string;
  pathDirection?: 'forward' | 'backward';
  pathBeatIndex?: number;
  runNonce: number;
} {
  const route = getOptionalRecordValue(record, 'route');

  return {
    nodeId: getOptionalStringValue(route, 'nodeId'),
    pathDirection: getOptionalPathDirectionValue(route, 'pathDirection'),
    pathBeatIndex: getOptionalNumberValue(route, 'pathBeatIndex'),
    runNonce: getOptionalNumberValue(route, 'runNonce') ?? 0,
  };
}

export default defineConfig({
  plugins: [createRuntimeClockApiPlugin(), react()],
  resolve: {
    alias: {
      react: resolve(appNodeModules, 'react'),
      'react/jsx-runtime': resolve(appNodeModules, 'react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolve(appNodeModules, 'react/jsx-dev-runtime.js'),
      'react-dom': resolve(appNodeModules, 'react-dom'),
      'react-dom/client': resolve(appNodeModules, 'react-dom/client.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
});