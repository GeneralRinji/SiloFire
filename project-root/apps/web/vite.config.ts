import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { createRuntimeApiService, matchRuntimeApiRequest } from '../../packages/runtime-server/src';

const projectRoot = resolve(__dirname, '..', '..');

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

export default defineConfig({
  plugins: [createRuntimeClockApiPlugin(), react()],
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
});