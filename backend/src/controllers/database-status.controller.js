const DatabaseStatusService = require('../services/database-status.service')

class DatabaseStatusController {
  constructor(service = new DatabaseStatusService()) {
    this.service = service
  }

  async getStatus(_req, res) {
    try {
      const data = await this.service.getStatus()
      return res.json({ success: true, data })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: '数据库连接失败',
        error: error.message
      })
    }
  }
}

module.exports = DatabaseStatusController
