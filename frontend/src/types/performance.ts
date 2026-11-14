import type schema from '../../../backend/src/contracts/performance-report.schema.json'

/** 数值字段由同一服务端机器契约派生，不含账号、路由、URL 或用户输入。 */
export type PerformanceReport = Record<keyof typeof schema.properties, number>
export type PerformanceMetrics = PerformanceReport
export type UsePerformanceReturn = ReturnType<typeof import('@/utils/performanceMonitor').usePerformance>
