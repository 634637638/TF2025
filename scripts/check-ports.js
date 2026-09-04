#!/usr/bin/env node

const { getPortsStatus, printPortsStatus } = require('./port-utils')

const status = getPortsStatus()
const occupiedCount = printPortsStatus(status)

process.exit(occupiedCount > 0 ? 1 : 0)
