'use strict'

const { resolveStoreScope } = require('../utils/store-scope')

const BaseService = require('../core/base/base.service')
const DashboardReadRepository = require('../repositories/dashboard-read.repository')
const { isConnected } = require('../config/database')
const { addDaysToDateKey, formatBeijingDate, getMonthDateRange, normalizeDateTime } = require('../utils/time')
const { hasUnifiedPermission } = require('../middleware/unified-auth')
const FieldAccessService = require('./field-access.service')
const SalaryRecordService = require('./salary-record.service')
const AttendanceService = require('./attendance.service')
const log = require('../utils/log')

const activitySources = [
  ['phoneSaleActivities', 'sales:view', 'sales_salesview', { brand_name: 'sale.brand', model_name: 'sale.model', operator_name: 'sale.operator_id' }, ['sale.sale_time']],
  ['accessorySaleActivities', 'accessories:view', 'accessories_accessoriesview', { accessory_name: 'basic_info.name', operator_name: 'operator_info.operator_name', quantity: 'stock_info.total_quantity' }, ['time_info.created_at']],
  ['inventoryActivities', 'inventory:view', 'inventory_inventoryview', { brand_name: 'basic.brand', model_name: 'basic.model', color_name: 'basic.color', memory_size: 'basic.memory' }, ['time_info.inventory_time']],
  ['repairActivities', 'repairs:view', 'repairs_repairsview', { brand_name: 'device_info.brand_name', model_name: 'device_info.phone_model', event_label: 'status_info.status' }, ['time_info.created_at']],
  ['subsidyActivities', 'subsidy:view', 'subsidy_subsidyview', {
    customer_name: 'customer_info.customer_name',
    model_name: 'device_info.model',
    color_name: 'device_info.color',
    memory_size: 'device_info.memory'
  }, ['time_info.apply_time', 'time_info.sale_time']],
  ['preorderActivities', 'preorders:view', 'preorders_preordersview', {
    customer_name: 'customer_info.customer_name',
    model_name: 'product_info.model_name',
    color_name: 'product_info.color_name',
    memory_size: 'product_info.memory_size'
  }, ['time_info.created_at']]
]

class DashboardReadService extends BaseService {
  constructor({ database, connected = isConnected, repository = new DashboardReadRepository({ database }),
    permissionCheck = hasUnifiedPermission, getFields = (userId, moduleKey) => new FieldAccessService({ moduleKey }).getPermissions(userId),
    salary = SalaryRecordService, attendance = AttendanceService, now = formatBeijingDate } = {}) {
    super()
    Object.assign(this, { repository, connected, permissionCheck, getFields, salary, attendance, now })
  }

  async getDashboardData(actor) {
    if (!this.connected()) {
      return {
        user: {
          id: actor.id,
          username: actor.username,
          name: actor.name,
          phone: '',
          email: '',
          role: actor.role,
          last_login: new Date().toISOString()
        }
      }
    }

    const { hiddenFields = [] } = await this.getFields(actor.id, 'dashboard_dashboardview')
    const scope = resolveStoreScope(actor)
    const today = this.now()
    const dayStart = `${today} 00:00:00`
    const nextDay = `${addDaysToDateKey(today, 1)} 00:00:00`
    const { period_start: monthStart } = getMonthDateRange(today)
    const { period_start: previousMonthStart } = getMonthDateRange(addDaysToDateKey(monthStart, -1))
    const showSales = !hiddenFields.includes('stats.today_sales')
    const [users, accessories, customers, stock, phoneSales, goodsSales, recentSales] = await Promise.all([
      this.repository.countUsers(),
      this.repository.countAccessories(),
      hiddenFields.includes('stats.total_customers') ? null : this.repository.countCustomers(`${previousMonthStart} 00:00:00`, `${monthStart} 00:00:00`, nextDay),
      hiddenFields.includes('stats.total_products') ? null : this.repository.countStockPhones(scope),
      showSales ? this.repository.todayPhoneSales(scope, dayStart, nextDay) : null,
      showSales ? this.repository.todayAccessorySales(scope, dayStart, nextDay) : null,
      showSales ? this.repository.recentAccessorySales(scope) : null
    ])

    const stats = { users: users[0][0].count, accessories: accessories[0][0].count }
    if (customers) {
      const [[row]] = customers
      stats.customers = Number(row.count)
      stats.customerGrowth = {
        current_month: Number(row.current_month_count),
        previous_month: Number(row.previous_month_count)
      }
    }
    if (stock) {
      const [[row]] = stock
      stats.phones = { in_stock: Number(row.count), new_count: Number(row.new_count), used_count: Number(row.used_count) }
    }
    if (phoneSales && goodsSales) {
      const [[phones]] = phoneSales
      const [[goods]] = goodsSales
      stats.todaySales = goods.count
      stats.todaySalesAmount = Number(phones.amount) + Number(goods.amount)
      stats.todayPhoneSales = {
        new_amount: Number(phones.new_amount),
        used_amount: Number(phones.used_amount),
        new_count: Number(phones.new_count),
        used_count: Number(phones.used_count)
      }
    }
    return { stats, recentSales: recentSales?.[0] ?? [] }
  }

  async getActivities(actor) {
    if (!this.connected()) return []
    const { hiddenFields = [] } = await this.getFields(actor.id, 'dashboard_dashboardview')
    if (hiddenFields.includes('activities.recent')) return []

    const scope = resolveStoreScope(actor)
    const sourceLimit = 10
    const today = this.now()
    const dayStart = `${today} 00:00:00`
    const nextDay = `${addDaysToDateKey(today, 1)} 00:00:00`
    const sources = await Promise.all(activitySources.map(async ([method, permission, moduleKey, fieldMap, timeFields]) => {
      if (!await this.permissionCheck(actor, permission)) return []
      const { hiddenFields: hidden = [] } = await this.getFields(actor.id, moduleKey)
      if (timeFields.some(field => hidden.includes(field))) return []
      const [rows] = await this.repository[method](sourceLimit, scope, dayStart, nextDay)
      return rows.map(row => {
        const visible = { ...row }
        for (const [key, field] of Object.entries(fieldMap)) {
          if (hidden.includes(field)) delete visible[key]
        }
        return visible
      })
    }))

    const buildDescription = activity => {
      const productName = [activity.brand_name, activity.model_name]
        .filter(value => value && String(value).trim())
        .join(' ')
        .trim()
      switch (activity.activity_type) {
      case 'sales':
        if (activity.id.startsWith('accessory-sale-')) {
          const quantity = activity.quantity ?? ''
          const count = quantity === '' ? '' : `${quantity}件`
          return `${activity.operator_name || '员工'}销售${count}${activity.accessory_name || '商品'}`
        }
        return `${activity.operator_name || '员工'}销售一台${productName || '手机'}`
      case 'inventory':
        return `到货：${productName || '手机'}`
      case 'repair':
        return `${activity.event_label || '维修动态'}：${productName || '设备'}`
      case 'subsidy':
        if (activity.event_label === '国补申报') {
          return `${activity.customer_name || '客户'}国补${productName || '手机'} ${[activity.color_name, activity.memory_size].filter(Boolean).join(' ')} 一台`.replace(/\s+/g, ' ').trim()
        }
        return `${activity.customer_name || '客户'}关联国补：${productName || '手机'} ${[activity.color_name, activity.memory_size].filter(Boolean).join(' ')} 一台`.replace(/\s+/g, ' ').trim()
      case 'preorder':
        return `${activity.customer_name || '客户'}预定了一台${productName || '手机'} ${[activity.color_name, activity.memory_size].filter(Boolean).join(' ')}`.replace(/\s+/g, ' ').trim()
      default:
        return '发生一项业务活动'
      }
    }

    const counts = new Map()
    return sources
      .flat()
      .map(activity => ({
        id: String(activity.id),
        type: activity.activity_type,
        icon: activity.icon,
        description: buildDescription(activity),
        detail: activity.activity_type === 'inventory'
          ? [activity.color_name, activity.memory_size].filter(Boolean).join(' · ')
          : '',
        occurred_at: normalizeDateTime(activity.occurred_at, false)
      }))
      .filter(activity => activity.occurred_at)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id))
      .filter(({ type }) => {
        const count = (counts.get(type) || 0) + 1
        counts.set(type, count)
        return count <= sourceLimit
      })
  }

  async getMyMonthlyStats(actor) {
    if (!this.connected()) return {}
    const { hiddenFields = [] } = await this.getFields(actor.id, 'dashboard_dashboardview')
    const { period_start: start, period_end: end } = getMonthDateRange(this.now())
    const [sales, attendance] = await Promise.all([
      hiddenFields.includes('stats.monthly_sales') ? null : this.getMonthlySales(actor.id, start, end, hiddenFields),
      hiddenFields.includes('stats.monthly_attendance') ? null : this.getMonthlyAttendance(actor.id, start, end, hiddenFields)
    ])
    return { sales, attendance }
  }

  async getMonthlyAttendance(employeeId, start, end, hiddenFields) {
    if (hiddenFields.includes('stats.monthly_attendance_amounts')) {
      return this.attendance.getMonthlyActivity(employeeId, start, end)
    }
    const { activity, amounts } = await this.attendance.getMonthlyActivityWithAmounts(employeeId, start, end)
    return { ...activity, leave_deduction: amounts.leave_deduction, overtime_pay: amounts.overtime_pay }
  }

  async getMonthlySales(employeeId, start, end, hiddenFields) {
    const [[row]] = await this.repository.monthlySales(employeeId, start, addDaysToDateKey(this.now(), 1))
    let commission = null
    if (!hiddenFields.includes('stats.monthly_commission')) {
      try {
        const salary = await this.salary.calculateSalary(employeeId, start, end)
        commission = salary.commission_amount
      } catch (error) {
        if (error.message !== '员工没有关联工资模板') log.error('获取本月销售提成失败:', error)
      }
    }
    return {
      phone_count: Number(row.phone_count),
      new_count: Number(row.new_count),
      used_count: Number(row.used_count),
      allocation_count: Number(row.allocation_count),
      transfer_count: Number(row.transfer_count),
      goods_quantity: Number(row.goods_quantity),
      commission
    }
  }
}

module.exports = DashboardReadService
