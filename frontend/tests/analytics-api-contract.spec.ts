import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ts from 'typescript'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { get } }))

import { analyticsService } from '@/api/analytics'

const routeSource = readFileSync(resolve(import.meta.dirname, '../../backend/src/routes/analytics.js'), 'utf8')
const routeAst = ts.createSourceFile('analytics.js', routeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
const backendRoutes = new Set<string>()
function collectRoutes(node: ts.Node): void {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.expression.getText(routeAst) === 'router'
    && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
    backendRoutes.add(`${node.expression.name.text.toUpperCase()} /analytics${node.arguments[0].text}`)
  }
  ts.forEachChild(node, collectRoutes)
}
collectRoutes(routeAst)

const contracts = [
  ['getSalesAnalytics', '/sales', () => analyticsService.getSalesAnalytics()],
  ['getSalesTrends', '/sales/trends', () => analyticsService.getSalesTrends({ period: 'monthly' })],
  ['getSalesForecast', '/sales-forecast', () => analyticsService.getSalesForecast()],
  ['getInventoryAnalytics', '/inventory', () => analyticsService.getInventoryAnalytics()],
  ['getLowStockItems', '/inventory/low-stock', () => analyticsService.getLowStockItems()],
  ['getInventoryTurnover', '/inventory/turnover', () => analyticsService.getInventoryTurnover()],
  ['getInventoryValue', '/inventory/value', () => analyticsService.getInventoryValue()],
  ['getInventorySupplierStats', '/inventory/supplier-stats', () => analyticsService.getInventorySupplierStats()],
  ['getRecentSoldInventory', '/inventory/recent-sold', () => analyticsService.getRecentSoldInventory()],
  ['getCustomerAnalytics', '/customers', () => analyticsService.getCustomerAnalytics()],
  ['getCustomerSegments', '/customers/segments', () => analyticsService.getCustomerSegments()],
  ['getCustomerRetention', '/customers/retention', () => analyticsService.getCustomerRetention()],
  ['getCustomerGrowth', '/customers/growth', () => analyticsService.getCustomerGrowth({ period: '30d' })],
  ['getHighValueCustomers', '/customers/high-value', () => analyticsService.getHighValueCustomers()],
  ['getCustomerDetail', '/customers/:id/detail', () => analyticsService.getCustomerDetail(17)],
  ['getCustomerActivity', '/customers/activity', () => analyticsService.getCustomerActivity()],
  ['getRealTimeData', '/realtime', () => analyticsService.getRealTimeData()],
  ['getEmployeeAnalytics', '/employees/detail', () => analyticsService.getEmployeeAnalytics()],
  ['getEmployeePerformance', '/employees/performance', () => analyticsService.getEmployeePerformance()],
  ['getEmployeeRoles', '/employees/roles', () => analyticsService.getEmployeeRoles()],
  ['getEmployeeSalaryTrend', '/employees/salary-trend', () => analyticsService.getEmployeeSalaryTrend()],
  ['getEmployeeAttendance', '/employees/attendance', () => analyticsService.getEmployeeAttendance()],
  ['getAttendanceSummary', '/attendance/summary', () => analyticsService.getAttendanceSummary()]
] as const

describe('analytics API 与真实后端路径契约', () => {
  beforeEach(() => get.mockResolvedValue({ success: true, data: {} }))

  it('所有公开 HTTP 方法均有路径契约覆盖', () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(analyticsService))
      .filter(name => name !== 'constructor')
    expect(methods.sort()).toEqual(contracts.map(([method]) => method).sort())
  })

  it.each(contracts)('%s 请求路径存在于挂载的后端路由', async (_method, suffix, invoke) => {
    const index = readFileSync(resolve(import.meta.dirname, '../../backend/src/routes/index.js'), 'utf8')
    expect(index).toMatch(/router\.use\('\/analytics', analyticsRoutes\)/)
    expect(backendRoutes.has(`GET /analytics${suffix}`)).toBe(true)
    await invoke()
    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][0]).toBe(`/analytics${suffix.replace(':id', '17')}`)
  })

  it('销售预测使用真实路径并保留周期、门店、分页和响应', async () => {
    const params = { period: 'quarter', store_id: '7', page_size: 10 } as const
    const response = { success: true, data: { combinations: [], period: 'quarter', forecastDays: 90 } }
    get.mockResolvedValue(response)
    expect(await analyticsService.getSalesForecast(params)).toBe(response)
    expect(get).toHaveBeenCalledWith('/analytics/sales-forecast', { params })
  })
})
