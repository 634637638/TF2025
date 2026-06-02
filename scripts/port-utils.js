const { execFileSync } = require('child_process');

const DEFAULT_PORTS = [3000, 5176];
const SHUTDOWN_WAIT_MS = 900;

function getTargetPorts() {
  const rawPorts = process.env.PORTS;
  if (!rawPorts) {
    return DEFAULT_PORTS;
  }

  const ports = rawPorts
    .split(',')
    .map((port) => Number.parseInt(port.trim(), 10))
    .filter((port) => Number.isInteger(port) && port > 0 && port < 65536);

  return ports.length > 0 ? [...new Set(ports)] : DEFAULT_PORTS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

function getPortProcesses(port) {
  let output = '';

  try {
    output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch (error) {
    return [];
  }

  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      return {
        command: parts[0],
        pid: Number.parseInt(parts[1], 10),
        port,
        raw: line
      };
    })
    .filter((processInfo) => Number.isInteger(processInfo.pid));
}

function getPortsStatus(ports = getTargetPorts()) {
  return ports.map((port) => ({
    port,
    processes: getPortProcesses(port)
  }));
}

async function stopPortProcesses(ports = getTargetPorts()) {
  const status = getPortsStatus(ports);
  const processes = status.flatMap((item) => item.processes);
  const uniqueProcesses = [...new Map(processes.map((item) => [item.pid, item])).values()];

  for (const processInfo of uniqueProcesses) {
    try {
      process.kill(processInfo.pid, 'SIGTERM');
      console.log(`Stopped ${processInfo.command} (${processInfo.pid}) on port ${processInfo.port}`);
    } catch (error) {
      if (error.code !== 'ESRCH') {
        console.warn(`Failed to stop ${processInfo.pid}: ${error.message}`);
      }
    }
  }

  if (uniqueProcesses.length > 0) {
    await sleep(SHUTDOWN_WAIT_MS);
  }

  for (const processInfo of uniqueProcesses) {
    if (!isProcessAlive(processInfo.pid)) {
      continue;
    }

    try {
      process.kill(processInfo.pid, 'SIGKILL');
      console.log(`Force stopped ${processInfo.command} (${processInfo.pid})`);
    } catch (error) {
      if (error.code !== 'ESRCH') {
        console.warn(`Failed to force stop ${processInfo.pid}: ${error.message}`);
      }
    }
  }

  return {
    status,
    stoppedCount: uniqueProcesses.length
  };
}

function printPortsStatus(status = getPortsStatus()) {
  let occupiedCount = 0;

  for (const item of status) {
    if (item.processes.length === 0) {
      console.log(`Port ${item.port}: available`);
      continue;
    }

    occupiedCount += item.processes.length;
    for (const processInfo of item.processes) {
      console.log(`Port ${item.port}: occupied by ${processInfo.command} (${processInfo.pid})`);
    }
  }

  return occupiedCount;
}

module.exports = {
  getTargetPorts,
  getPortsStatus,
  printPortsStatus,
  stopPortProcesses
};
