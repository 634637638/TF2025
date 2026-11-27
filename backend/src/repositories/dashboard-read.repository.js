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

  countCustomers(previousMonthStart, monthStart, nextDay) {
    return this.database().execute(`
      SELECT COUNT(*) AS count,
        COUNT(CASE WHEN created_at >= ? AND created_at < ? THEN 1 END) AS previous_month_count,
        COUNT(CASE WHEN created_at >= ? AND created_at < ? THEN 1 END) AS current_month_count
      FROM customers WHERE status = 1
    `, [previousMonthStart, monthStart, monthStart, nextDay])
  }

  countStockPhones(scope) {
    const conditions = ['1=1']
    const params = []
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    return this.database().execute(`
        SELECT COUNT(*) AS count,
          COUNT(CASE WHEN is_new = 1 THEN 1 END) AS new_count,
          COUNT(CASE WHEN is_new = 0 THEN 1 END) AS used_count
        FROM phones
        WHERE ${conditions.join(' AND ')} AND status = 'in_stock' AND supplier_id IS NOT NULL
      `, params)
  }

  todayPhoneSales(scope, start, end) {
    const conditions = ['s.sale_time >= ?', 's.sale_time < ?']
    const params = [start, end]
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    return this.database().execute(`
        SELECT COALESCE(SUM(s.sale_price), 0) AS amount,
          COALESCE(SUM(CASE WHEN p.is_new = 1 THEN s.sale_price END), 0) AS new_amount,
          COALESCE(SUM(CASE WHEN p.is_new = 0 THEN s.sale_price END), 0) AS used_amount,
          COUNT(CASE WHEN p.is_new = 1 THEN 1 END) AS new_count,
          COUNT(CASE WHEN p.is_new = 0 THEN 1 END) AS used_count
        FROM sales s LEFT JOIN phones p ON p.id = s.phone_id
        WHERE ${conditions.join(' AND ')} AND (
          s.sale_type = 'wholesale' OR (
            s.sale_type = 'retail' AND p.status = 'sold'
            AND s.id = (${getLatestActiveSaleIdSql('p', 'latest_sale')})
          )
        )
      `, params)
  }

  todayAccessorySales(scope, start, end) {
    const conditions = ['created_at >= ?', 'created_at < ?']
    const params = [start, end]
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    return this.database().execute(`
        SELECT COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS amount
        FROM accessory_sales WHERE ${conditions.join(' AND ')}
      `, params)
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

  monthlySales(employeeId, start, end) {
    return this.database().execute(`
      SELECT
        COUNT(CASE WHEN p.status = 'sold' THEN 1 END) AS phone_count,
        COUNT(CASE WHEN p.status = 'sold' AND p.is_new = 1 THEN 1 END) AS new_count,
        COUNT(CASE WHEN p.status = 'sold' AND p.is_new = 0 THEN 1 END) AS used_count,
        COUNT(CASE WHEN p.status = 'supplier_proxy' THEN 1 END) AS allocation_count,
        COUNT(CASE WHEN p.status = 'peer_transfer' THEN 1 END) AS transfer_count,
        (SELECT COALESCE(SUM(quantity), 0) FROM accessory_sales
          WHERE operator_id = ? AND COALESCE(sale_type, 'sale') = 'sale'
            AND COALESCE(sale_time, created_at) >= ? AND COALESCE(sale_time, created_at) < ?) AS goods_quantity
      FROM phones p
      JOIN sales s ON s.id = (${getLatestActiveSaleIdSql()})
      WHERE p.sale_operator_id = ? AND s.sale_time >= ? AND s.sale_time < ?
        AND (
          (p.status = 'sold' AND s.sale_type = 'retail')
          OR (p.status = 'supplier_proxy' AND s.sale_type = 'supplier_proxy')
          OR (p.status = 'peer_transfer' AND s.sale_type = 'wholesale')
        )
    `, [employeeId, start, end, employeeId, start, end])
  }

  phoneSaleActivities(sourceLimit, scope, start, end) {
    const conditions = ["s.sale_type = 'retail'", "p.status = 'sold'", 'COALESCE(s.sale_time, s.created_at) >= ?', 'COALESCE(s.sale_time, s.created_at) < ?']
    const params = [start, end]
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    return this.database().execute(`
          SELECT
            CONCAT('phone-sale-', s.id) AS id,
            'sales' AS activity_type,
            'fas fa-shopping-cart' AS icon,
            b.name AS brand_name,
            m.name AS model_name,
            COALESCE(NULLIF(u.name, ''), u.username) AS operator_name,
            COALESCE(s.sale_time, s.created_at) AS occurred_at
          FROM phones p
          JOIN sales s ON s.id = (${getLatestActiveSaleIdSql()})
          LEFT JOIN users u ON u.id = COALESCE(p.sale_operator_id, s.operator_id)
          LEFT JOIN brands b ON b.id = p.brand_id
          LEFT JOIN models m ON m.id = p.model_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY occurred_at DESC, s.id DESC
          LIMIT ?
        `, [...params, sourceLimit])
  }

  accessorySaleActivities(sourceLimit, scope, start, end) {
    const conditions = ["COALESCE(asl.sale_type, 'sale') = 'sale'", 'COALESCE(asl.sale_time, asl.created_at) >= ?', 'COALESCE(asl.sale_time, asl.created_at) < ?']
    const params = [start, end]
    appendStoreScopeCondition(scope, 'asl.store_id', conditions, params)
    return this.database().execute(`
          SELECT
            CONCAT('accessory-sale-', asl.id) AS id,
            'sales' AS activity_type,
            'fas fa-shopping-bag' AS icon,
            a.name AS accessory_name,
            asl.quantity,
            COALESCE(NULLIF(asl.operator_name, ''), NULLIF(u.name, ''), u.username) AS operator_name,
            COALESCE(asl.sale_time, asl.created_at) AS occurred_at
          FROM accessory_sales asl
          LEFT JOIN accessories a ON a.id = asl.accessory_id
          LEFT JOIN users u ON u.id = asl.operator_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY occurred_at DESC, asl.id DESC
          LIMIT ?
        `, [...params, sourceLimit])
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
            c.name AS color_name,
            mem.size AS memory_size,
            p.inventory_time AS occurred_at
          FROM phones p
          LEFT JOIN brands b ON b.id = p.brand_id
          LEFT JOIN models m ON m.id = p.model_id
          LEFT JOIN colors c ON c.id = p.color_id
          LEFT JOIN memories mem ON mem.id = p.memory_id
          WHERE ${conditions.join(' AND ')} AND p.inventory_time IS NOT NULL
          ORDER BY p.inventory_time DESC, p.id DESC
          LIMIT ?
        `, [...params, sourceLimit])
  }

  subsidyActivities(sourceLimit, scope) {
    const occurredAt = 'COALESCE(ns.apply_time, ns.sale_time)'
    const conditions = [`${occurredAt} IS NOT NULL`]
    const params = []
    appendStoreScopeCondition(scope, 'ns.store_id', conditions, params)
    return this.database().execute(`
      SELECT CONCAT('subsidy-', ns.id) AS id, 'subsidy' AS activity_type,
        'fas fa-file-invoice' AS icon,
        CASE WHEN ns.apply_time IS NOT NULL THEN '国补申报' ELSE '国补关联销售' END AS event_label,
        ns.customer_name, ns.phone_model AS model_name,
        ns.phone_color AS color_name, ns.phone_memory AS memory_size,
        ${occurredAt} AS occurred_at
      FROM national_subsidies ns WHERE ${conditions.join(' AND ')}
      ORDER BY occurred_at DESC, ns.id DESC LIMIT ?
    `, [...params, sourceLimit])
  }

  preorderActivities(sourceLimit, scope) {
    const conditions = ['pr.created_at IS NOT NULL']
    const params = []
    appendStoreScopeCondition(scope, 'pr.store_id', conditions, params)
    return this.database().execute(`
      SELECT CONCAT('preorder-', pr.id) AS id, 'preorder' AS activity_type,
        'fas fa-calendar-check' AS icon, '新增预定' AS event_label,
        c.name AS customer_name, m.name AS model_name,
        co.name AS color_name, mem.size AS memory_size,
        pr.created_at AS occurred_at
      FROM preorders pr
      LEFT JOIN customers c ON c.id = pr.customer_id
      LEFT JOIN models m ON m.id = pr.model_id
      LEFT JOIN colors co ON co.id = pr.color_id
      LEFT JOIN memories mem ON mem.id = pr.memory_id
      WHERE ${conditions.join(' AND ')} ORDER BY pr.created_at DESC, pr.id DESC LIMIT ?
    `, [...params, sourceLimit])
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
          LIMIT ?
        `, [...params, ...params, sourceLimit])
  }
}

module.exports = DashboardReadRepository
