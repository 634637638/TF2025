/**
 * 工资模板数据访问层
 * 处理所有工资模板相关的数据库操作
 */
const BaseRepository = require('./base.repository')
const log = require('../utils/log')

const TEMPLATE_FIELDS = [
  'id',
  'name',
  'description',
  'base_salary',
  'commission_type',
  'commission_fixed',
  'commission_new_fixed',
  'commission_used_fixed',
  'commission_percentage',
  'is_active',
  'is_default',
  'overtime_hourly_rate',
  'rest_days',
  'auto_raise_rule',
  'created_at',
  'updated_at'
].map(field => `st.${field}`).join(',\n          ')

class SalaryTemplateRepository extends BaseRepository {
  constructor() {
    super('salary_templates')
  }

  /**
   * 获取工资模板列表（带分页和过滤）
   */
  async getTemplatesWithPagination(filters = {}, options = {}) {
    try {
      const { is_active, is_default } = filters
      const { page = 1, page_size } = options

      // 确保参数是数字类型
      const pageNum = parseInt(page) || 1
      const limitNum = Math.min(100, Math.max(1, parseInt(page_size, 10) || 20))
      const offsetNum = (pageNum - 1) * limitNum

      // 构建 WHERE 子句
      const whereConditions = []
      const whereParams = []

      if (is_active !== undefined && is_active !== null) {
        whereConditions.push('st.is_active = ?')
        whereParams.push(is_active ? 1 : 0)
      }

      if (is_default !== undefined && is_default !== null) {
        whereConditions.push('st.is_default = ?')
        whereParams.push(is_default ? 1 : 0)
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      // 查询数据 - LIMIT 和 OFFSET 直接内联（安全整数值）
      const dataQuery = `
        SELECT
          ${TEMPLATE_FIELDS},
          (SELECT COUNT(*) FROM users WHERE salary_template_id = st.id) as employee_count
        FROM ${this.tableName} st
        ${whereClause}
        ORDER BY st.id DESC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `

      const db = this.getConnection()
      const [records] = await db.execute(dataQuery, whereParams)

      // 查询总数（使用相同的别名）
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} st ${whereClause}`
      const [countResult] = await db.execute(countQuery, whereParams)
      const total = countResult[0].total

      return {
        records,
        pagination: {
          page: pageNum,
          page_size: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum),
          has_next: pageNum * limitNum < total,
          has_prev: pageNum > 1
        }
      }
    } catch (error) {
      log.error('获取工资模板列表失败:', error)
      throw error
    }
  }

  /**
   * 根据ID获取工资模板详情
   */
  async getTemplateById(id) {
    try {
      const query = `SELECT ${TEMPLATE_FIELDS} FROM ${this.tableName} st WHERE st.id = ?`
      const records = await this.executeQuery(query, [id])
      return records[0] || null
    } catch (error) {
      log.error('获取工资模板详情失败:', error)
      throw error
    }
  }

  /**
   * 获取默认模板
   */
  async getDefaultTemplate() {
    try {
      // 返回第一个模板作为默认模板
      const query = `SELECT ${TEMPLATE_FIELDS} FROM ${this.tableName} st ORDER BY st.id LIMIT 1`
      const records = await this.executeQuery(query)
      return records[0] || null
    } catch (error) {
      log.error('获取默认工资模板失败:', error)
      throw error
    }
  }

  /**
   * 创建工资模板
   */
  async createTemplate(data) {
    try {
      return await this.create(data)
    } catch (error) {
      log.error('创建工资模板失败:', error)
      throw error
    }
  }

  /**
   * 更新工资模板
   */
  async updateTemplate(id, data) {
    try {
      return await this.update(id, data)
    } catch (error) {
      log.error('更新工资模板失败:', error)
      throw error
    }
  }

  /**
   * 删除工资模板
   */
  async deleteTemplate(id) {
    try {
      // 检查是否有员工使用此模板
      const checkQuery = `
        SELECT COUNT(*) as count FROM users WHERE salary_template_id = ?
      `
      const [checkResult] = await this.executeQuery(checkQuery, [id])

      if (checkResult.count > 0) {
        throw new Error(`无法删除：有 ${checkResult.count} 个员工正在使用此模板`)
      }

      return await this.delete(id)
    } catch (error) {
      log.error('删除工资模板失败:', error)
      throw error
    }
  }

  /**
   * 设为默认模板
   */
  async setAsDefault(id) {
    const pool = this.getConnection()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      const [templates] = await connection.execute(
        `SELECT id FROM ${this.tableName} WHERE id = ? FOR UPDATE`,
        [id]
      )
      if (templates.length === 0) {
        throw new Error('工资模板不存在')
      }

      await connection.execute(`UPDATE ${this.tableName} SET is_default = 0`)
      await connection.execute(
        `UPDATE ${this.tableName} SET is_default = 1 WHERE id = ?`,
        [id]
      )
      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      log.error('设置默认模板失败:', error)
      throw error
    } finally {
      connection.release()
    }
  }

  /**
   * 获取所有激活的模板（用于下拉选择）
   */
  async getActiveTemplates() {
    try {
      const query = `
        SELECT id, name, base_salary
        FROM ${this.tableName}
        WHERE is_active = 1
        ORDER BY name ASC
      `
      return await this.executeQuery(query)
    } catch (error) {
      log.error('获取激活模板列表失败:', error)
      throw error
    }
  }
}

module.exports = SalaryTemplateRepository
