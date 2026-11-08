/**
 * 事件总线 Composable
 * 提供全局事件通信功能
 */

import { logger } from '@/utils/logger'

/**
 * 事件监听器
 */
interface EventBusListener<T = unknown> {
  callback: (data: T) => void
  once?: boolean
}

/**
 * 事件总线实现
 */
class EventBus {
  private events = new Map<string, EventBusListener<unknown>[]>()

  /**
   * 订阅事件
   * @param event 事件名
   * @param callback 回调函数
   * @param once 是否只执行一次
   */
  on<T = unknown>(event: string, callback: (data: T) => void, once = false): () => void {
    const listeners = this.events.get(event) || []
    const listener: EventBusListener<unknown> = {
      callback: (data: unknown) => callback(data as T),
      once
    }
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
  once<T = unknown>(event: string, callback: (data: T) => void): () => void {
    return this.on(event, callback, true)
  }

  /**
   * 取消订阅
   * @param event 事件名
   * @param callback 回调函数
   */
  off<T = unknown>(event: string, callback?: (data: T) => void): void {
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
  emit<T = unknown>(event: string, data?: T): void {
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
    return Boolean(listeners?.length)
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
