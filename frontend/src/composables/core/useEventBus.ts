/**
 * 事件总线 Composable
 * 提供全局事件通信功能
 */

import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { logger } from '@/utils/logger'

/**
 * 事件监听器
 */
export interface EventListener<T = any> {
  callback: (data: T) => void
  once?: boolean
}

/**
 * 事件总线实现
 */
class EventBus {
  private events = new Map<string, EventListener[]>()

  /**
   * 订阅事件
   * @param event 事件名
   * @param callback 回调函数
   * @param once 是否只执行一次
   */
  on<T = any>(event: string, callback: (data: T) => void, once = false): () => void {
    const listeners = this.events.get(event) || []
    const listener: EventListener<T> = { callback, once }
    listeners.push(listener)
    this.events.set(event, listeners)

    // 返回取消订阅函数
    return () => {
      const currentListeners = this.events.get(event) || []
      const index = currentListeners.indexOf(listener)
      if (index > -1) {
        currentListeners.splice(index, 1)
        if (currentListeners.length === 0) {
          this.events.delete(event)
        }
      }
    }
  }

  /**
   * 订阅事件（一次性）
   * @param event 事件名
   * @param callback 回调函数
   */
  once<T = any>(event: string, callback: (data: T) => void): () => void {
    return this.on(event, callback, true)
  }

  /**
   * 取消订阅
   * @param event 事件名
   * @param callback 回调函数
   */
  off<T = any>(event: string, callback?: (data: T) => void): void {
    const listeners = this.events.get(event)
    if (!listeners) return

    if (callback) {
      // 移除特定监听器
      const index = listeners.findIndex(l => l.callback === callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    } else {
      // 移除所有监听器
      listeners.length = 0
    }

    if (listeners.length === 0) {
      this.events.delete(event)
    }
  }

  /**
   * 发布事件
   * @param event 事件名
   * @param data 事件数据
   */
  emit<T = any>(event: string, data?: T): void {
    const listeners = this.events.get(event)
    if (!listeners) return

    // 复制一份避免在执行过程中被修改
    const currentListeners = [...listeners]

    for (const listener of currentListeners) {
      try {
        listener.callback(data!)
      } catch (error) {
        logger.error(`Event bus error in ${event}:`, error)
      }

      // 一次性监听器执行后移除
      if (listener.once) {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }

    // 如果没有监听器了，删除事件
    if (listeners.length === 0) {
      this.events.delete(event)
    }
  }

  /**
   * 清除所有事件
   */
  clear(): void {
    this.events.clear()
  }

  /**
   * 获取事件监听器数量
   * @param event 事件名
   */
  listenerCount(event?: string): number {
    if (event) {
      return this.events.get(event)?.length || 0
    }
    return Array.from(this.events.values()).reduce((total, listeners) => total + listeners.length, 0)
  }

  /**
   * 获取所有事件名
   */
  eventNames(): string[] {
    return Array.from(this.events.keys())
  }

  /**
   * 检查是否有指定事件的监听器
   * @param event 事件名
   */
  hasListeners(event: string): boolean {
    const listeners = this.events.get(event)
    return listeners && listeners.length > 0
  }
}

// 全局事件总线实例
const globalEventBus = new EventBus()

/**
 * 使用事件总线
 * @param eventBus 可选的事件总线实例
 */
export function useEventBus(eventBus?: EventBus) {
  const bus = eventBus || globalEventBus

  // 组件卸载时清理事件
  onUnmounted(() => {
    // 这里可以添加清理逻辑，但由于我们使用全局实例，
    // 通常不需要在组件卸载时清理
  })

  return {
    on: bus.on.bind(bus),
    once: bus.once.bind(bus),
    off: bus.off.bind(bus),
    emit: bus.emit.bind(bus),
    clear: bus.clear.bind(bus),
    listenerCount: bus.listenerCount.bind(bus),
    eventNames: bus.eventNames.bind(bus),
    hasListeners: bus.hasListeners.bind(bus)
  }
}

/**
 * 创建局部事件总线
 */
export function createEventBus(): EventBus {
  return new EventBus()
}

/**
 * 等待事件
 * @param event 事件名
 * @param eventBus 可选的事件总线实例
 * @param timeout 超时时间（毫秒）
 */
export function waitForEvent<T = any>(
  event: string,
  eventBus?: EventBus,
  timeout = 5000
): Promise<T> {
  const bus = eventBus || globalEventBus

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout

    const unsubscribe = bus.once<T>(event, (data: T) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      resolve(data)
    })

    // 设置超时
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        unsubscribe()
        reject(new Error(`Event "${event}" timeout after ${timeout}ms`))
      }, timeout)
    }
  })
}

/**
 * 等待多个事件
 * @param events 事件名数组
 * @param eventBus 可选的事件总线实例
 */
export function waitForEvents<T = Record<string, any>>(
  events: string[],
  eventBus?: EventBus
): Promise<T> {
  const bus = eventBus || globalEventBus
  const results: Partial<T> = {}
  const completedEvents = new Set<string>()

  return new Promise((resolve, reject) => {
    const unsubscribers = events.map(event => {
      return bus.on(event, (data: any) => {
        results[event as keyof T] = data
        completedEvents.add(event)

        // 检查是否所有事件都已完成
        if (completedEvents.size === events.length) {
          unsubscribers.forEach(unsub => unsub())
          resolve(results as T)
        }
      })
    })
  })
}

// 导出全局事件总线
export { globalEventBus }