/**
 * 全局权限事件总线
 * 用于在权限变更时通知所有组件刷新权限状态
 */

import { ref } from 'vue'

// 权限变更事件
interface PermissionChangeEvent {
  type: 'permission_change' | 'force_refresh' | 'role_change'
  timestamp: number
  source?: string // 来源：'permission_page', 'api', 'system'
  data?: any
}

// 权限事件监听器
type PermissionEventListener = (event: PermissionChangeEvent) => void

// 全局权限事件总线
class PermissionEventBus {
  private listeners = new Set<PermissionEventListener>()
  private lastEvent: PermissionChangeEvent | null = null

  /**
   * 添加事件监听器
   */
  addListener(callback: PermissionEventListener): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * 移除事件监听器
   */
  removeListener(callback: PermissionEventListener): void {
    this.listeners.delete(callback)
  }

  /**
   * 清除所有监听器
   */
  clearListeners(): void {
    this.listeners.clear()
  }

  /**
   * 触发权限变更事件
   */
  emit(event: Omit<PermissionChangeEvent, 'timestamp'>): void {
    const permissionEvent: PermissionChangeEvent = {
      ...event,
      timestamp: Date.now()
    }

    this.lastEvent = permissionEvent

    // 通知所有监听器
    this.listeners.forEach(callback => {
      try {
        callback(permissionEvent)
      } catch (error) {
        // 权限事件监听器执行失败，忽略
      }
    })
  }

  /**
   * 触发权限强制刷新
   */
  emitForceRefresh(source?: string): void {
    this.emit({
      type: 'force_refresh',
      source: source || 'unknown'
    })
  }

  /**
   * 触发权限变更事件
   */
  emitPermissionChange(source?: string, data?: any): void {
    this.emit({
      type: 'permission_change',
      source: source || 'unknown',
      data
    })
  }

  /**
   * 触发角色变更事件
   */
  emitRoleChange(source?: string): void {
    this.emit({
      type: 'role_change',
      source: source || 'unknown'
    })
  }

  /**
   * 获取最后的事件
   */
  getLastEvent(): PermissionChangeEvent | null {
    return this.lastEvent
  }

  /**
   * 检查是否有最近的权限变更
   */
  hasRecentChange(withinMs: number = 5000): boolean {
    return this.lastEvent &&
           (Date.now() - this.lastEvent.timestamp) < withinMs
  }
}

// 创建全局实例
const permissionEventBus = new PermissionEventBus()

export default permissionEventBus
export { PermissionEventBus }
export type { PermissionChangeEvent, PermissionEventListener }