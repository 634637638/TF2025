'use strict'

const { resolveStoreScope } = require('../utils/store-scope')

const BaseService = require('../core/base/base.service')
const DashboardReadRepository = require('../repositories/dashboard-read.repository')
const { isConnected } = require('../config/database')

class DashboardReadService extends BaseService {
  constructor({ database, connected = isConnected, repository = new DashboardReadRepository({ database }) } = {}) {
    super()
    this.repository = repository
    this.connected = connected
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

    const scope = resolveStoreScope(actor)
    const [userCount] = await this.repository.countUsers()
    const [accessoryCount] = await this.repository.countAccessories()
    const [customerCount] = await this.repository.countCustomers()
    const [phoneStockCount] = await this.repository.countStockPhones(scope)
    const [todayRetailSalesAmount] = await this.repository.todayRetailAmount(scope)
    const [todayAccessorySalesAmount] = await this.repository.todayAccessoryAmount(scope)
    const [todayWholesaleSalesAmount] = await this.repository.todayWholesaleAmount(scope)
    const totalTodaySales = parseFloat(todayRetailSalesAmount[0].amount || 0)
        + parseFloat(todayAccessorySalesAmount[0].amount || 0)
        + parseFloat(todayWholesaleSalesAmount[0].amount || 0)

    const [todaySalesCount] = await this.repository.todayAccessoryCount(scope)
    const [recentSales] = await this.repository.recentAccessorySales(scope)

    return {
      stats: {
        users: userCount[0].count,
        accessories: accessoryCount[0].count,
        customers: customerCount[0].count,
        todaySales: todaySalesCount[0].count,
        todaySalesAmount: totalTodaySales,
        phones: { in_stock: phoneStockCount[0].count }
      },
      recentSales
    }
  }

  async getActivities(actor) {
    if (!this.connected()) return []

    const scope = resolveStoreScope(actor)
    const sourceLimit = 8
    const [
      [phoneSales],
      [accessorySales],
      [newCustomers],
      [phoneInventory],
      [repairEvents]
    ] = await Promise.all([
      this.repository.phoneSaleActivities(sourceLimit, scope),
      this.repository.accessorySaleActivities(sourceLimit, scope),
      this.repository.customerActivities(sourceLimit, scope),
      this.repository.inventoryActivities(sourceLimit, scope),
      this.repository.repairActivities(sourceLimit, scope)
    ])

    const buildDescription = activity => {
      const productName = [activity.brand_name, activity.model_name]
        .filter(value => value && String(value).trim())
        .join(' ')
        .trim()
      switch (activity.activity_type) {
      case 'sales':
        if (activity.accessory_name) return `完成配件销售：${activity.accessory_name}`
        return `完成手机销售：${productName || '手机'}`
      case 'customer':
        return `新增客户：${activity.customer_name || '新客户'}`
      case 'inventory':
        return `手机入库：${productName || '手机'}`
      case 'repair':
        return `${activity.event_label || '维修动态'}：${productName || '设备'}`
      default:
        return '发生一项业务活动'
      }
    }

    const activities = [phoneSales, accessorySales, newCustomers, phoneInventory, repairEvents]
      .flat()
      .filter(activity => activity.occurred_at)
      .map(activity => ({
        id: String(activity.id),
        type: activity.activity_type,
        icon: activity.icon,
        description: buildDescription(activity),
        occurred_at: activity.occurred_at
      }))
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      .slice(0, 8)

    return activities
  }
}

module.exports = DashboardReadService
