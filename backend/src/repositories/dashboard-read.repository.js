'use strict'

const { appendStoreScopeCondition } = require('../utils/store-scope')

const { getLatestActiveSaleIdSql } = require('../utils/sale-status')
const { getDatabase } = require('../config/database')

class DashboardReadRepository {
  constructor({ database = getDatabase } = {}) { this.database = database }

  countUsers() {
    return this.database().execute('SELECT COUNT(*) as count FROM users WHERE status = 1')
  }

  countAccessories() {
    return this.database().execute('SELECT COUNT(*) as count FROM accessories WHERE status = 1')
  }

  countCustomers() {
    return this.database().execute('SELECT COUNT(*) as count FROM customers WHERE status = 1')
  }

  countStockPhones(scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    return this.database().execute(`
        SELECT COUNT(*) as count
        FROM phones
        WHERE ${conditions.join(' AND ')} AND status = 'in_stock' AND supplier_id IS NOT NULL
      `, params)
  }

  todayRetailAmount(scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    return this.database().execute(`
        SELECT COALESCE(SUM(s.sale_price), 0) as amount
        FROM phones p JOIN sales s ON s.id = (${getLatestActiveSaleIdSql('p')})
        WHERE ${conditions.join(' AND ')} AND DATE(s.sale_time) = CURDATE() AND p.status = 'sold' AND s.sale_type = 'retail'
      `, params)
  }

  todayAccessoryAmount(scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    return this.database().execute(`
        SELECT COALESCE(SUM(total_price), 0) as amount
        FROM accessory_sales
        WHERE ${conditions.join(' AND ')} AND DATE(created_at) = CURDATE()
      `, params)
  }

  todayWholesaleAmount(scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    return this.database().execute(`
        SELECT COALESCE(SUM(sale_price), 0) as amount
        FROM sales
        WHERE ${conditions.join(' AND ')} AND DATE(sale_time) = CURDATE() AND sale_type = 'wholesale'
      `, params)
  }

  todayAccessoryCount(scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    return this.database().execute(`SELECT COUNT(*) as count FROM accessory_sales WHERE ${conditions.join(' AND ')} AND DATE(created_at) = CURDATE()`, params)
  }

  recentAccessorySales(scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 'asl.store_id', conditions, params)
    return this.database().execute(`
        SELECT asl.*, acc.name as accessory_name, c.name as customer_name, u.name as operator_name
        FROM accessory_sales asl
        LEFT JOIN accessories acc ON asl.accessory_id = acc.id
        LEFT JOIN customers c ON asl.customer_id = c.id
        LEFT JOIN users u ON asl.operator_id = u.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY asl.created_at DESC
        LIMIT 5
      `, params)
  }

  phoneSaleActivities(sourceLimit, scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    return this.database().execute(`
          SELECT
            CONCAT('phone-sale-', s.id) AS id,
            'sales' AS activity_type,
            'fas fa-shopping-cart' AS icon,
            b.name AS brand_name,
            m.name AS model_name,
            COALESCE(s.sale_time, s.created_at) AS occurred_at
          FROM sales s
          LEFT JOIN phones p ON p.id = s.phone_id
          LEFT JOIN brands b ON b.id = p.brand_id
          LEFT JOIN models m ON m.id = p.model_id
          WHERE ${conditions.join(' AND ')} AND COALESCE(s.sale_time, s.created_at) IS NOT NULL
          ORDER BY occurred_at DESC, s.id DESC
          LIMIT ${sourceLimit}
        `, params)
  }

  accessorySaleActivities(sourceLimit, scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 'asl.store_id', conditions, params)
    return this.database().execute(`
          SELECT
            CONCAT('accessory-sale-', asl.id) AS id,
            'sales' AS activity_type,
            'fas fa-shopping-bag' AS icon,
            a.name AS accessory_name,
            COALESCE(asl.sale_time, asl.created_at) AS occurred_at
          FROM accessory_sales asl
          LEFT JOIN accessories a ON a.id = asl.accessory_id
          WHERE ${conditions.join(' AND ')} AND COALESCE(asl.sale_time, asl.created_at) IS NOT NULL
          ORDER BY occurred_at DESC, asl.id DESC
          LIMIT ${sourceLimit}
        `, params)
  }

  customerActivities(sourceLimit) {
    return this.database().execute(`
          SELECT
            CONCAT('customer-', c.id) AS id,
            'customer' AS activity_type,
            'fas fa-user-plus' AS icon,
            c.name AS customer_name,
            c.created_at AS occurred_at
          FROM customers c
          WHERE c.created_at IS NOT NULL
          ORDER BY c.created_at DESC, c.id DESC
          LIMIT ${sourceLimit}
        `)
  }

  inventoryActivities(sourceLimit, scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 'p.store_id', conditions, params)
    return this.database().execute(`
          SELECT
            CONCAT('phone-inventory-', p.id) AS id,
            'inventory' AS activity_type,
            'fas fa-box' AS icon,
            b.name AS brand_name,
            m.name AS model_name,
            p.inventory_time AS occurred_at
          FROM phones p
          LEFT JOIN brands b ON b.id = p.brand_id
          LEFT JOIN models m ON m.id = p.model_id
          WHERE ${conditions.join(' AND ')} AND p.inventory_time IS NOT NULL
          ORDER BY p.inventory_time DESC, p.id DESC
          LIMIT ${sourceLimit}
        `, params)
  }

  repairActivities(sourceLimit, scope) {
    const conditions = ['1=1']
    const params = []
    // repairs 表没有 store_id，维修单的门店范围通过关联手机归属门店确定。
    appendStoreScopeCondition(scope, 'p.store_id', conditions, params)
    return this.database().execute(`
          SELECT
            CONCAT('repair-created-', r.id) AS id,
            'repair' AS activity_type,
            'fas fa-tools' AS icon,
            '创建维修单' AS event_label,
            b.name AS brand_name,
            r.phone_model AS model_name,
            r.created_at AS occurred_at
          FROM repairs r
          LEFT JOIN phones p ON p.id = r.phone_id
          LEFT JOIN brands b ON b.id = r.brand_id
          WHERE ${conditions.join(' AND ')} AND r.created_at IS NOT NULL

          UNION ALL

          SELECT
            CONCAT('repair-completed-', r.id) AS id,
            'repair' AS activity_type,
            'fas fa-check-circle' AS icon,
            '维修完成' AS event_label,
            b.name AS brand_name,
            r.phone_model AS model_name,
            r.completed_at AS occurred_at
          FROM repairs r
          LEFT JOIN phones p ON p.id = r.phone_id
          LEFT JOIN brands b ON b.id = r.brand_id
          WHERE ${conditions.join(' AND ')} AND r.completed_at IS NOT NULL

          ORDER BY occurred_at DESC, id DESC
          LIMIT ${sourceLimit}
        `, [...params, ...params])
  }
}

module.exports = DashboardReadRepository
