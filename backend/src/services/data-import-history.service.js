'use strict'

const BaseService = require('../core/base/base.service')
const DataImportHistoryRepository = require('../repositories/data-import-history.repository')
const log = require('../utils/log')

class DataImportHistoryService extends BaseService {
  constructor({ repository = new DataImportHistoryRepository(), logger = log } = {}) {
    super()
    this.repository = repository
    this.logger = logger
  }

  async history(query, connection) {
    if (!connection) throw this.createError('数据库连接不可用', 500)

    const page = Math.max(parseInt(query.page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(query.page_size, 10) || 20, 1), 100)
    const status = query.status || null
    const strategy = query.strategy || null
    const userId = query.user_id || null
    const offset = (page - 1) * pageSize
    const { total, history } = await this.repository.list(connection, { status, strategy, userId, pageSize, offset })

    return {
      success: true,
      message: '获取导入历史成功',
      data: history,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
        has_next: page * pageSize < total,
        has_prev: page > 1
      }
    }
  }

  async removeHistory(params, connection) {
    if (!connection) throw this.createError('数据库连接不可用', 500)

    const { id } = params
    if (!id || isNaN(id)) {
      throw this.createError('无效的记录ID', 400)
    }

    const [records] = await this.repository.findById(connection, id)
    if (records.length === 0) {
      throw this.createError('记录不存在', 404)
    }

    await this.repository.remove(connection, id)
    this.logger.debug(`✅ 导入历史记录已删除: id=${id}`)
    return { success: true, message: '删除成功', data: { id } }
  }
}

module.exports = DataImportHistoryService
