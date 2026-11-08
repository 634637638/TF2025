'use strict'

const log = require('../utils/log')
const DatabaseSyncManagementService = require('../services/database-sync-management.service')
const managementService = new DatabaseSyncManagementService()
const sendSyncError = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.message })

class DatabaseSyncController {
  async createConnection(req, res) {
    try {
      return res.json(await managementService.createConnection(req.body, req.user))
    } catch (error) {
      log.error('createConnection 失败:', error)
      return sendSyncError(res, error)
    }
  }

  async getConnections(req, res) {
    try {
      return res.json(await managementService.getConnections(req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async closeConnection(req, res) {
    try {
      return res.json(await managementService.closeConnection(req.params, req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async getTables(req, res) {
    try {
      return res.json(await managementService.getTables(req.params, req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async getTableStructure(req, res) {
    try {
      return res.json(await managementService.getTableStructure(req.params, req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async getTableData(req, res) {
    try {
      return res.json(await managementService.getTableData(req.params, req.query, req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async getLocalTables(req, res) {
    try {
      return res.json(await managementService.getLocalTables())
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async getLocalTableStructure(req, res) {
    try {
      return res.json(await managementService.getLocalTableStructure(req.params))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async saveMappingConfig(req, res) {
    try {
      return res.json(await managementService.saveMappingConfig(req.body, req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async getMappingConfigs(req, res) {
    try {
      return res.json(await managementService.getMappingConfigs(req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async getMappingConfig(req, res) {
    try {
      return res.json(await managementService.getMappingConfig(req.params, req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async deleteMappingConfig(req, res) {
    try {
      return res.json(await managementService.deleteMappingConfig(req.params, req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async suggestFieldMapping(req, res) {
    try {
      return res.json(await managementService.suggestFieldMapping(req.query, req.user))
    } catch (error) {
      log.error('suggestFieldMapping 失败:', error)
      return sendSyncError(res, error)
    }
  }

  async preCheckSync(req, res) {
    try {
      return res.json(await managementService.preCheckSync(req.body, req.user))
    } catch (error) {
      log.error('preCheckSync 失败:', error)
      return sendSyncError(res, error)
    }
  }

  async executeSync(req, res) {
    try {
      return res.json(await managementService.executeSync(req.body, req.user))
    } catch (error) {
      log.error('executeSync 失败:', error)
      return sendSyncError(res, error)
    }
  }

  async getSyncProgress(req, res) {
    try {
      return res.json(await managementService.getSyncProgress(req.params, req.user))
    } catch (error) {
      return sendSyncError(res, error)
    }
  }

  async smartSync(req, res) {
    try {
      return res.json(await managementService.smartSync(req.body, req.user))
    } catch (error) {
      log.error('smartSync 失败:', error)
      return sendSyncError(res, error)
    }
  }

  async localToCloudSync(req, res) {
    try {
      return res.json(await managementService.localToCloudSync(req.body, req.user))
    } catch (error) {
      log.error('localToCloudSync 失败:', error)
      return sendSyncError(res, error)
    }
  }

  async localToCloudPreCheck(req, res) {
    try {
      return res.json(await managementService.localToCloudPreCheck(req.body, req.user))
    } catch (error) {
      log.error('localToCloudPreCheck 失败:', error)
      return sendSyncError(res, error)
    }
  }

  async localToCloudExecute(req, res) {
    try {
      return res.json(await managementService.localToCloudExecute(req.body, req.user))
    } catch (error) {
      log.error('localToCloudExecute 失败:', error)
      return sendSyncError(res, error)
    }
  }
}

module.exports = new DatabaseSyncController()
