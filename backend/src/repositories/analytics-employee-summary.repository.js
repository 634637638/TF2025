'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsEmployeeSummaryRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getSalaryTotals(monthCount, storeId) {
    const [rows] = await this.database().execute(`
      SELECT
        DATE_FORMAT(sr.period_start, '%Y-%m') as month,
        COALESCE(SUM(sr.net_salary), 0) as total
      FROM salary_records sr
      INNER JOIN users u ON u.id = sr.employee_id
      WHERE sr.status != 'cancelled'
        AND sr.period_start >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL ? MONTH)
        ${storeId !== null ? 'AND u.store_id = ?' : ''}
      GROUP BY DATE_FORMAT(sr.period_start, '%Y-%m')
      ORDER BY month ASC
    `, [monthCount, ...(storeId !== null ? [storeId] : [])])
    return rows
  }

  async getAttendanceCounts(storeId) {
    const [rows] = await this.database().execute(`
      SELECT
        ar.record_type,
        ar.status,
        COUNT(*) as count
      FROM attendance_records ar
      INNER JOIN users u ON u.id = ar.employee_id
      WHERE DATE(ar.created_at) >= DATE_FORMAT(NOW(), '%Y-%m-01')
        AND ar.status != 'cancelled'
        ${storeId !== null ? 'AND u.store_id = ?' : ''}
      GROUP BY ar.record_type, ar.status
    `, storeId !== null ? [storeId] : [])
    return rows
  }

  async getAttendanceSummary({ startDate, endDate, storeId }) {
    const dateConditions = []
    const dateParams = []
    if (startDate) {
      dateConditions.push('ar.record_date >= ?')
      dateParams.push(startDate)
    } else {
      dateConditions.push('ar.record_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)')
    }
    if (endDate) {
      dateConditions.push('ar.record_date <= ?')
      dateParams.push(endDate)
    }
    const storeCondition = storeId !== null ? 'AND u.store_id = ?' : ''
    const storeParams = storeId !== null ? [storeId] : []
    const attendanceWhere = `${dateConditions.join(' AND ')} ${storeCondition}`
    const filters = [...dateParams, ...storeParams]
    const database = this.database()

    const summaryQuery = `
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT ar.employee_id) as employee_count,
        SUM(CASE WHEN ar.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN ar.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN ar.record_type IN ('late', 'early_leave', 'absent') THEN 1 ELSE 0 END) as abnormal_count,
        SUM(CASE WHEN ar.record_type IN ('leave', 'monthly_leave') THEN 1 ELSE 0 END) as leave_count,
        SUM(CASE WHEN ar.record_type = 'overtime' THEN 1 ELSE 0 END) as overtime_count
      FROM attendance_records ar
      LEFT JOIN users u ON ar.employee_id = u.id
      WHERE ar.status != 'cancelled'
        AND ${attendanceWhere}
    `
    const recordsQuery = `
      SELECT
        DATE_FORMAT(ar.record_date, '%Y-%m-%d') as record_date,
        u.name as employee_name,
        s.name as store_name,
        ar.record_type,
        ar.leave_type,
        ar.leave_days,
        ar.overtime_hours,
        ar.status,
        DATE_FORMAT(ar.approved_at, '%Y-%m-%d %H:%i') as approved_at,
        ar.approval_note
      FROM attendance_records ar
      LEFT JOIN users u ON ar.employee_id = u.id
      LEFT JOIN stores s ON u.store_id = s.id
      WHERE ar.status != 'cancelled'
        AND ${attendanceWhere}
      ORDER BY ar.record_date DESC, ar.created_at DESC
      LIMIT 30
    `
    const alertsQuery = `
      SELECT
        DATE_FORMAT(ar.record_date, '%Y-%m-%d') as record_date,
        u.name as employee_name,
        s.name as store_name,
        ar.record_type,
        ar.status
      FROM attendance_records ar
      LEFT JOIN users u ON ar.employee_id = u.id
      LEFT JOIN stores s ON u.store_id = s.id
      WHERE ar.record_type IN ('late', 'early_leave', 'absent')
        AND ar.status != 'cancelled'
        AND ${attendanceWhere}
      ORDER BY ar.record_date DESC, ar.created_at DESC
      LIMIT 20
    `
    const [summaryRows, recordRows, alertRows] = await Promise.all([
      database.execute(summaryQuery, filters),
      database.execute(recordsQuery, filters),
      database.execute(alertsQuery, filters)
    ])

    return {
      summaryRow: summaryRows[0]?.[0] || {},
      records: recordRows[0] || [],
      alerts: alertRows[0] || []
    }
  }

  async getEmployeePerformance({ metric, pageSize, storeId }) {
    const orderByOptions = {
      newSales: 'new_sales DESC',
      usedSales: 'used_sales DESC',
      wholesale: 'wholesale_count DESC',
      allocation: 'allocation_count DESC'
    }
    const orderBy = Object.hasOwn(orderByOptions, metric) ? orderByOptions[metric] : 'total_sales DESC'
    const [rows] = await this.database().query(`
      SELECT
        u.id,
        u.name,
        u.store_id,
        s.name as store_name,
        COALESCE(SUM(CASE WHEN p.is_new = 1 AND p.status = 'sold' AND MONTH(p.sale_time) = MONTH(CURDATE()) AND YEAR(p.sale_time) = YEAR(CURDATE()) THEN 1 ELSE 0 END), 0) as new_sales,
        COALESCE(SUM(CASE WHEN p.is_new = 0 AND p.status = 'sold' AND MONTH(p.sale_time) = MONTH(CURDATE()) AND YEAR(p.sale_time) = YEAR(CURDATE()) THEN 1 ELSE 0 END), 0) as used_sales,
        COALESCE(SUM(CASE WHEN p.status = 'peer_transfer' AND MONTH(p.wholesale_date) = MONTH(CURDATE()) AND YEAR(p.wholesale_date) = YEAR(CURDATE()) THEN 1 ELSE 0 END), 0) as wholesale_count,
        COALESCE(SUM(CASE WHEN p.status = 'supplier_proxy' AND MONTH(p.wholesale_date) = MONTH(CURDATE()) AND YEAR(p.wholesale_date) = YEAR(CURDATE()) THEN 1 ELSE 0 END), 0) as allocation_count,
        COALESCE(SUM(CASE WHEN p.status = 'sold' AND MONTH(p.sale_time) = MONTH(CURDATE()) AND YEAR(p.sale_time) = YEAR(CURDATE()) THEN p.sale_price ELSE 0 END), 0) as total_sales
      FROM users u
      LEFT JOIN stores s ON u.store_id = s.id
      LEFT JOIN phones p ON p.sale_operator_id = u.id AND MONTH(p.sale_time) = MONTH(CURDATE()) AND YEAR(p.sale_time) = YEAR(CURDATE())
      WHERE (u.status = 1 OR u.status = 'active')
        ${storeId !== null ? 'AND u.store_id = ?' : ''}
      GROUP BY u.id, u.name, u.store_id, s.name
      ORDER BY ${orderBy}
      LIMIT ?
    `, [...(storeId !== null ? [storeId] : []), pageSize])
    return rows
  }

  async getAttendanceRates(employeeIds) {
    if (!employeeIds.length) return []
    const placeholders = employeeIds.map(() => '?').join(', ')
    const [rows] = await this.database().execute(`
      SELECT
        u.id as employee_id,
        COUNT(CASE WHEN ar.status = 'approved' THEN 1 END) as approved,
        COUNT(*) as total
      FROM users u
      LEFT JOIN attendance_records ar ON ar.employee_id = u.id
        AND DATE(ar.created_at) >= DATE_FORMAT(NOW(), '%Y-%m-01')
        AND ar.status != 'cancelled'
      WHERE u.id IN (${placeholders})
      GROUP BY u.id
    `, employeeIds)
    return rows
  }

  async getEmployeeOverview({ startDate, endDate, storeId }) {
    const storeFilter = storeId !== null ? 'AND store_id = ?' : ''
    const storeParams = storeId !== null ? [storeId] : []
    const phoneFilter = storeId !== null ? 'AND store_id = ?' : ''
    const rangeParams = [startDate, endDate, ...storeParams]
    const database = this.database()
    const [totalEmployees, activeEmployees, stores, newPhoneSales, usedPhoneSales, totalSalesAmount, payrollEmployees] = await Promise.all([
      database.execute(`SELECT COUNT(*) as count FROM users WHERE 1=1 ${storeFilter}`, storeParams),
      database.execute(`SELECT COUNT(*) as count FROM users WHERE status = 1 ${storeFilter}`, storeParams),
      database.execute(`SELECT COUNT(DISTINCT store_id) as count FROM users WHERE store_id IS NOT NULL ${storeFilter}`, storeParams),
      database.execute(`
        SELECT COUNT(*) as count FROM phones
        WHERE status = 'sold' AND is_new = 1 AND DATE(sale_time) >= ? AND DATE(sale_time) <= ? ${phoneFilter}
      `, rangeParams),
      database.execute(`
        SELECT COUNT(*) as count FROM phones
        WHERE status = 'sold' AND is_new = 0 AND DATE(sale_time) >= ? AND DATE(sale_time) <= ? ${phoneFilter}
      `, rangeParams),
      database.execute(`
        SELECT COALESCE(SUM(sale_price), 0) as total FROM phones
        WHERE status = 'sold' AND DATE(sale_time) >= ? AND DATE(sale_time) <= ? ${phoneFilter}
      `, rangeParams),
      database.execute(`
        SELECT id FROM users
        WHERE status = 1 AND salary_template_id IS NOT NULL ${storeFilter}
      `, storeParams)
    ])
    const attendanceQuery = `
      SELECT
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(*) as total
      FROM attendance_records ar
      INNER JOIN users u ON u.id = ar.employee_id
      WHERE DATE(ar.created_at) >= ? AND DATE(ar.created_at) <= ?
        AND ar.status != 'cancelled'
        ${storeId !== null ? 'AND u.store_id = ?' : ''}
    `
    const [attendanceRows] = await database.execute(attendanceQuery, rangeParams)

    return {
      totalEmployees: totalEmployees[0][0],
      activeEmployees: activeEmployees[0][0],
      stores: stores[0][0],
      newPhoneSales: newPhoneSales[0][0],
      usedPhoneSales: usedPhoneSales[0][0],
      totalSalesAmount: totalSalesAmount[0][0],
      payrollEmployeeIds: payrollEmployees[0].map(row => row.id),
      attendance: attendanceRows[0]
    }
  }
}

module.exports = AnalyticsEmployeeSummaryRepository
