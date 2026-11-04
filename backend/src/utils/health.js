'use strict'

const { checkDatabaseHealth } = require('../config/database')

const livenessHandler = (_req, res) => res.status(200).json({
  success: true,
  status: 'live',
  timestamp: new Date().toISOString(),
  uptime: process.uptime()
})

const readinessHandler = async (_req, res) => {
  const databaseReady = await checkDatabaseHealth()
  return res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    status: databaseReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
}

module.exports = { livenessHandler, readinessHandler }
