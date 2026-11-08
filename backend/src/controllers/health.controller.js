'use strict'

const { livenessHandler, readinessHandler } = require('../utils/health')

class HealthController {
  constructor({
    liveness = livenessHandler,
    readiness = readinessHandler
  } = {}) {
    this.livenessHandler = liveness
    this.readinessHandler = readiness
  }

  liveness(req, res) {
    return this.livenessHandler(req, res)
  }

  readiness(req, res) {
    return this.readinessHandler(req, res)
  }
}

module.exports = HealthController
