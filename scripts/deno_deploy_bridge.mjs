import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const allowedCommands = new Set(['create', 'deploy']);
const requestedCommand = process.argv[2];
const forwardedArgs = process.argv.slice(3);
const workspaceRoot = path.resolve(process.cwd());
const wantsHelp = forwardedArgs.includes('--help') || forwardedArgs.includes('-h');

if (!allowedCommands.has(requestedCommand)) {
  console.error('Usage: node ./scripts/deno_deploy_bridge.mjs <create|deploy>');
  process.exit(1);
}

void main();

async function main() {
  const exitCode = requestedCommand === 'deploy'
    ? await runDeploy()
    : await runCreate();

  process.exit(exitCode);
}

async function runDeploy() {
  if (wantsHelp) {
    return runCommand(getDenoCommand(), ['deploy', ...forwardedArgs], {
      env: createChildEnv(),
      errorMessage: 'Deno deploy failed.',
    });
  }

  const npmRunner = getNpmRunner(['run', 'build']);
  const buildExitCode = await runCommand(npmRunner.command, npmRunner.args, {
    env: createChildEnv(),
    errorMessage: 'Build failed before Deno deploy.',
  });

  if (buildExitCode !== 0) {
    return buildExitCode;
  }

  const deployConfig = readDeployConfig();
  const org = deployConfig.org;
  const app = deployConfig.app;

  if (!org || !app) {
    console.error('Missing deploy.org or deploy.app in deno.json');
    return 1;
  }

  return runCommand(getDenoCommand(), [
    'deploy',
    '.',
    '--config', './deno.json',
    '--org', org,
    '--app', app,
    '--prod',
    ...forwardedArgs,
  ], {
    env: createChildEnv(),
    errorMessage: 'Deno deploy failed.',
  });
}

async function runCreate() {
  if (wantsHelp) {
    return runCommand(getDenoCommand(), ['deploy', 'create', ...forwardedArgs], {
      env: createChildEnv(),
      errorMessage: 'Deno app creation failed.',
    });
  }

  const deployConfig = readDeployConfig();
  const org = deployConfig.org;
  const app = deployConfig.app;

  if (!org || !app) {
    console.error('Missing deploy.org or deploy.app in deno.json');
    return 1;
  }

  return runCommand(getDenoCommand(), [
    'deploy',
    'create',
    '.',
    '--org', org,
    '--app', app,
    '--source', 'local',
    '--region', 'global',
    ...forwardedArgs,
  ], {
    env: createChildEnv(),
    errorMessage: 'Deno app creation failed.',
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    let child;

    try {
      child = spawn(command, args, {
        stdio: 'inherit',
        shell: false,
        cwd: workspaceRoot,
        env: options.env ?? process.env,
      });
    } catch (error) {
      if (options.errorMessage) {
        console.error(options.errorMessage);
      }

      console.error(error instanceof Error ? error.message : String(error));
      resolve(1);
      return;
    }

    child.on('error', (error) => {
      if (options.errorMessage) {
        console.error(options.errorMessage);
      }

      console.error(error.message);
      resolve(1);
    });

    child.on('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

function createChildEnv() {
  const env = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof key !== 'string' || key.length === 0 || key.includes('=') || key.includes('\0')) {
      continue;
    }

    if (typeof value !== 'string' || value.includes('\0')) {
      continue;
    }

    env[key] = value;
  }

  if (process.platform === 'win32') {
    delete env.PWD;
    delete env.OLDPWD;
    delete env.MSYSTEM;
    delete env.MSYSTEM_PREFIX;
    delete env.MSYS2_PATH_TYPE;
    delete env.MINGW_CHOST;
    delete env.MINGW_PREFIX;
    delete env.CHERE_INVOKING;
  }

  return env;
}

function readDeployConfig() {
  const denoConfig = JSON.parse(readFileSync(path.resolve(workspaceRoot, 'deno.json'), 'utf8'));
  const deploy = denoConfig?.deploy;

  return {
    org: typeof deploy?.org === 'string' && deploy.org.length > 0 ? deploy.org : undefined,
    app: typeof deploy?.app === 'string' && deploy.app.length > 0 ? deploy.app : undefined,
  };
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function getDenoCommand() {
  return process.platform === 'win32' ? 'deno.exe' : 'deno';
}

function getNpmRunner(args) {
  if (process.platform !== 'win32') {
    return {
      command: getNpmCommand(),
      args,
    };
  }

  const npmCliPath = resolveNpmCliPath();

  if (!npmCliPath) {
    throw new Error('Unable to locate npm-cli.js for a shell-free Windows build invocation.');
  }

  return {
    command: process.execPath,
    args: [npmCliPath, ...args],
  };
}

function resolveNpmCliPath() {
  const candidatePaths = [
    process.env.npm_execpath,
    path.resolve(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter((value) => typeof value === 'string' && value.length > 0);

  return candidatePaths.find((candidatePath) => existsSync(candidatePath));
}