import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { dirname, join } from 'node:path';

const allowedCommands = new Set(['create', 'deploy']);
const requestedCommand = process.argv[2];
const forwardedArgs = process.argv.slice(3);
const requestedTask = requestedCommand === 'create' ? 'deploy:create' : 'deploy';

if (!allowedCommands.has(requestedCommand)) {
  console.error('Usage: node ./scripts/deno_deploy_bridge.mjs <create|deploy>');
  process.exit(1);
}

if (process.platform !== 'win32') {
  runCommand('deno', ['task', requestedTask, ...forwardedArgs]);
} else {
  const gitBashPath = resolveGitBashPath();

  if (!gitBashPath) {
    console.error('Git Bash was not found. Install Git for Windows or update the bridge script with your bash.exe path.');
    process.exit(1);
  }

  const workspacePath = toGitBashPath(process.cwd());
  const extraArgs = forwardedArgs.map((value) => `'${escapeForSingleQuotes(value)}'`).join(' ');
  const command = [
    'export PATH="$HOME/.deno/bin:$PATH:/mingw64/bin:/usr/bin:$PATH"',
    `cd '${escapeForSingleQuotes(workspacePath)}'`,
    `deno task ${requestedTask}${extraArgs ? ` ${extraArgs}` : ''}`,
  ].join('; ');

  runCommand(gitBashPath, ['-lc', command], {
    errorMessage: 'Git Bash based Deno deploy failed. Ensure Git for Windows is installed and Deno is available at ~/.deno/bin/deno.',
  });
}

function runCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
  });

  child.on('error', (error) => {
    if (options.errorMessage) {
      console.error(options.errorMessage);
    }

    console.error(error.message);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

function toGitBashPath(path) {
  const normalizedPath = path.replace(/\\/g, '/');
  const driveLetterMatch = /^([A-Za-z]):\/(.*)$/.exec(normalizedPath);

  if (!driveLetterMatch) {
    return normalizedPath;
  }

  const [, driveLetter, remainder] = driveLetterMatch;
  return `/${driveLetter.toLowerCase()}/${remainder}`;
}

function escapeForSingleQuotes(value) {
  return value.replace(/'/g, `'"'"'`);
}

function resolveGitBashPath() {
  const candidates = [
    process.env.GIT_BASH_PATH,
    'C:/Program Files/Git/bin/bash.exe',
    'C:/Program Files (x86)/Git/bin/bash.exe',
  ].filter(Boolean);

  const gitExeOnPath = process.env.ProgramFiles
    ? join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe')
    : undefined;

  if (gitExeOnPath && existsSync(gitExeOnPath)) {
    candidates.push(join(dirname(dirname(gitExeOnPath)), 'bin', 'bash.exe'));
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? undefined;
}