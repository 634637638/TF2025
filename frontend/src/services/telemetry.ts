export interface PageVisitData {
  path: string
  title?: string
  from: string
  timestamp: number
  userAgent: string
}

export type TelemetryValue = string | number | boolean

export interface TelemetryAdapter {
  trackPageVisit?: (data: PageVisitData) => void
  trackEvent?: (name: string, properties: Record<string, TelemetryValue>) => void
}

const SENSITIVE_PROPERTY = /token|password|secret|phone|mobile|imei|serial|email|address|customer|apple|identity|name/i
const EVENT_NAME = /^[a-z][a-z0-9_.-]{0,63}$/

function getAdapter(): TelemetryAdapter | undefined {
  if (typeof window === 'undefined') return undefined
  return window.__TF2025__?.analytics
}

function reportAdapterError(error: unknown): void {
  if (import.meta.env.DEV) console.warn('Telemetry adapter failed:', error)
}

export function trackPageVisit(data: PageVisitData): void {
  try {
    getAdapter()?.trackPageVisit?.(data)
  } catch (error) {
    reportAdapterError(error)
  }
}

export function trackEvent(name: string, properties: Record<string, TelemetryValue> = {}): boolean {
  if (!EVENT_NAME.test(name)) return false

  const safeProperties = Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => !SENSITIVE_PROPERTY.test(key))
      .filter(([, value]) => typeof value !== 'string' || value.length <= 80)
  )

  try {
    getAdapter()?.trackEvent?.(name, safeProperties)
    return true
  } catch (error) {
    reportAdapterError(error)
    return false
  }
}
