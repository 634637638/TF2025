#!/usr/bin/env node

const { spawn } = require('child_process');
const { getTargetPorts, stopPortProcesses } = require('./port-utils');

(async () => {
  const ports = getTargetPorts();
  await stopPortProcesses(ports);

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCommand, ['run', 'dev:raw'], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
