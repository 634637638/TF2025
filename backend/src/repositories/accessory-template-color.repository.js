'use strict'

const { hasTable } = require('../utils/schema-inspector')
const { table, inspect } = require('../utils/accessory-template-color-schema')

/** 颜色规格各自作为原采购模板，品牌库存商品继续继承该颜色的档案。 */
class AccessoryTemplateColorRepository {
  constructor({ tableExists = hasTable } = {}) { this.tableExists = tableExists }

  async ready(connection) { return this.tableExists(table, connection) }

  async assertReady(connection) {
    if (!(await inspect(connection)).exists) throw Object.assign(new Error('多颜色模板结构尚未就绪，请先完成模板颜色迁移'), {
      statusCode: 409, code: 'TEMPLATE_COLOR_NOT_READY'
    })
  }

  async families(ids, connection, { forUpdate = false, currentRead = false } = {}) {
    if (!ids.length || !await this.ready(connection)) return []
    const placeholders = ids.map(() => '?').join(',')
    const [rows] = await connection.query(`SELECT m.template_id, m.accessory_id, m.color_id${forUpdate ? '' : ', c.name AS color_name, a.barcode'}
      FROM ${table} m ${forUpdate ? '' : 'JOIN accessories a ON a.id = m.accessory_id LEFT JOIN colors c ON c.id = m.color_id'}
      WHERE m.template_id IN (${placeholders}) OR m.template_id IN
        (SELECT picked.template_id FROM ${table} picked WHERE picked.accessory_id IN (${placeholders}))
      ORDER BY m.template_id, m.accessory_id ${forUpdate ? 'FOR UPDATE' : currentRead ? 'LOCK IN SHARE MODE' : ''}`, [...ids, ...ids])
    return rows
  }

  async attach(records, connection, options = {}) {
    if (!connection || !records.length) return records
    const ids = [...new Set(records.map(row => Number(row.template_id || row.id)))]
    const families = await this.families(ids, connection, options)
    return records.map(row => {
      const rootId = Number(row.template_id || row.id)
      const group = families.find(item => Number(item.template_id) === rootId || Number(item.accessory_id) === rootId)
      if (!group) return row
      return { ...row, color_template_id: Number(group.template_id), color_variants: families.filter(item => Number(item.template_id) === Number(group.template_id))
        .map(item => ({ accessory_id: Number(item.accessory_id), color_id: Number(item.color_id), color_name: item.color_name, barcode: item.barcode })) }
    })
  }

  async link(templateId, accessoryId, colorId, connection) {
    await connection.query(`INSERT INTO ${table} (template_id, accessory_id, color_id) VALUES (?, ?, ?)`, [templateId, accessoryId, colorId])
  }

  async lockColors(ids, connection) {
    const [rows] = await connection.query(`SELECT id, status FROM colors WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id LOCK IN SHARE MODE`, ids)
    return rows
  }
}

module.exports = AccessoryTemplateColorRepository
