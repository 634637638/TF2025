'use strict'

const { isConnected } = require('../config/database')
const BrandSettingsRepository = require('../repositories/brand-settings.repository')

class BrandSettingsService {
  constructor({ repository = new BrandSettingsRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  isConnected() {
    return this.connected()
  }

  async getCurrent() {
    return this.repository.getCurrent()
  }

  async saveCurrent(settings) {
    return this.repository.saveCurrent(settings)
  }
}

module.exports = BrandSettingsService
