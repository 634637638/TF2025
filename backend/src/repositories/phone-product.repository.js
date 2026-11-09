'use strict'

const { getDatabase } = require('../config/database')

class PhoneProductRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getConfiguration(phoneId) {
    const [phones] = await this.database().query(
      `SELECT p.is_new, p.brand_id, p.model_id, p.color_id, h5.*
       FROM phones p LEFT JOIN H5_product h5 ON h5.phone_id = p.id
       WHERE p.id = ?`,
      [phoneId]
    )
    return phones[0] || null
  }

  async getTemplatePreview(phone) {
    // 与商城价格入口一致：同品牌/型号/颜色的首个启用模板；内存由模板统一维护。
    const [templates] = await this.database().query(
      `SELECT id, template_name, description, is_published
       FROM H5_newtemplates
       WHERE brand_id = ? AND model_id = ? AND color_id = ? AND is_active = TRUE
       ORDER BY id ASC LIMIT 1`,
      [phone.brand_id, phone.model_id, phone.color_id]
    )
    if (!templates[0]) return null

    const [images] = await this.database().query(
      `SELECT id, image_url, image_type, is_primary, sort_order
       FROM h5_newimages WHERE template_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC`,
      [templates[0].id]
    )
    return { ...templates[0], images }
  }
}

module.exports = PhoneProductRepository
