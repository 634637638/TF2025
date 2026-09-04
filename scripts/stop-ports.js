#!/usr/bin/env node

const { getTargetPorts, stopPortProcesses } = require('./port-utils');

(async () => {
  const ports = getTargetPorts()
  const result = await stopPortProcesses(ports)

  if (result.stoppedCount === 0) {
    console.log(`No listening processes found on ports: ${ports.join(', ')}`)
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
