/**
 * 内存规格数据访问层
 * 复用 BaseRepository 的执行封装，供路由层下沉数据库连接与执行时使用。
 */
const BaseRepository = require('./base.repository')

class MemoryRepository extends BaseRepository {
  constructor() {
    super('memories')
  }
}

module.exports = MemoryRepository
