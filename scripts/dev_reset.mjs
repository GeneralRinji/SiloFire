import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEV_PORTS = [5173, 5174];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const releasedProcesses = resetNodeListeners(DEV_PORTS);

  if (releasedProcesses.length > 0) {
    const summary = releasedProcesses.map((entry) => `${entry.name}(${entry.pid})@${entry.port}`).join(', ');
    console.log(`Released dev listeners: ${summary}`);
  }

  runDevServer();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function resetNodeListeners(ports) {
  const listeners = listListeningProcesses(ports);
  const blocked = listeners.filter((listener) => !isNodeLikeProcess(listener.name));

  if (blocked.length > 0) {
    const summary = blocked.map((entry) => `${entry.name}(${entry.pid})@${entry.port}`).join(', ');
    throw new Error(`Port reset refused to kill non-node listeners: ${summary}`);
  }

  const released = [];

  for (const listener of listeners) {
    if (listener.pid === process.pid) {
      continue;
    }

    terminateProcess(listener.pid);
    released.push(listener);
  }

  return released;
}

function listListeningProcesses(ports) {
  return process.platform === 'win32'
    ? listListeningProcessesOnWindows(ports)
    : listListeningProcessesOnPosix(ports);
}

function listListeningProcessesOnWindows(ports) {
  const requestedPorts = new Set(ports.map((port) => String(port)));
  const output = execFileSync('netstat', ['-ano', '-p', 'tcp'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const listenersByPidAndPort = new Map();

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('TCP')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);

    if (parts.length < 5 || parts[3] !== 'LISTENING') {
      continue;
    }

    const localAddress = parts[1];
    const pid = Number(parts[4]);
    const separatorIndex = localAddress.lastIndexOf(':');
    const port = separatorIndex >= 0 ? localAddress.slice(separatorIndex + 1) : '';

    if (!requestedPorts.has(port) || !Number.isInteger(pid)) {
      continue;
    }

    const key = `${pid}:${port}`;

    if (listenersByPidAndPort.has(key)) {
      continue;
    }

    listenersByPidAndPort.set(key, {
      pid,
      port: Number(port),
      name: getWindowsProcessName(pid),
    });
  }

  return [...listenersByPidAndPort.values()];
}

function listListeningProcessesOnPosix(ports) {
  const listenersByPidAndPort = new Map();

  for (const port of ports) {
    let output = '';

    try {
      output = execFileSync('lsof', ['-nP', '-iTCP:' + String(port), '-sTCP:LISTEN', '-t'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;

      if (status === 1) {
        continue;
      }

      throw error;
    }

    for (const pidText of output.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
      const pid = Number(pidText);

      if (!Number.isInteger(pid)) {
        continue;
      }

      const key = `${pid}:${port}`;

      if (listenersByPidAndPort.has(key)) {
        continue;
      }

      listenersByPidAndPort.set(key, {
        pid,
        port,
        name: getPosixProcessName(pid),
      });
    }
  }

  return [...listenersByPidAndPort.values()];
}

function getWindowsProcessName(pid) {
  try {
    const output = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();

    if (!output || output.startsWith('INFO:')) {
      return 'unknown';
    }

    const firstField = output.split(',')[0] ?? '';
    return firstField.replace(/^"|"$/g, '');
  } catch {
    return 'unknown';
  }
}

function getPosixProcessName(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'comm='], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function isNodeLikeProcess(name) {
  return /^(node|node\.exe|npm|npm\.cmd)$/i.test(name);
}

function terminateProcess(pid) {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
    return;
  }

  process.kill(pid, 'SIGTERM');
}

function runDevServer() {
  if (process.platform === 'win32') {
    execFileSync(process.env.ComSpec ?? 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      'npm --prefix .\\project-root\\apps\\web run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    ], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    return;
  }

  execFileSync('npm', [
    '--prefix',
    './project-root/apps/web',
    'run',
    'dev',
    '--',
    '--host',
    '127.0.0.1',
    '--port',
    '5173',
    '--strictPort',
  ], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}