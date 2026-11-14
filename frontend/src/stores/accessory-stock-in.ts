import { defineStore } from 'pinia'
import { ref } from 'vue'
import { storage } from '@/services/storage'
import { createCheckoutKey } from '@/utils/sales-checkout'
import { isAccessoryStockInInput } from '@/utils/accessory-stock-in'
import type { AccessoryStockInInput } from '@/types/accessory'

/** 每个认证入库员保留一笔结果未确认的采购；关闭、刷新不生成第二笔。 */
export const useAccessoryStockInStore = defineStore('accessory-stock-in', () => {
  const pending = ref<Record<number, AccessoryStockInInput | undefined>>({})
  const submitting = ref(false)
  const key = (actorId: number) => `tf2025_accessory_stock_in_pending_${actorId}`

  const load = (actorId: number) => {
    if (!Number.isSafeInteger(actorId) || actorId <= 0) throw new Error('请重新登录后办理入库')
    const saved = storage.get<unknown>(key(actorId), 'session')
    if (saved === null) {
      // 内存有未确认请求但持久化凭据消失时，仍保留原请求，不能另起新单。
      return pending.value[actorId] || null
    }
    if (!isAccessoryStockInInput(saved)) throw new Error('上次入库凭据无法读取，请先核对原采购记录，暂不能新建入库')
    pending.value[actorId] = saved
    return saved
  }

  const prepare = (actorId: number, input: Omit<AccessoryStockInInput, 'request_key'>) => {
    const previous = load(actorId)
    if (previous) return previous
    const request = { ...input, request_key: createCheckoutKey() }
    storage.set(key(actorId), request, 'session')
    const saved = storage.get<unknown>(key(actorId), 'session')
    if (!isAccessoryStockInInput(saved) || JSON.stringify(saved) !== JSON.stringify(request)) throw new Error('无法保存入库防重凭据，请检查浏览器存储后重试')
    pending.value[actorId] = saved
    return saved
  }

  const complete = (actorId: number, requestKey: string) => {
    const current = load(actorId)
    if (current?.request_key !== requestKey) throw new Error('入库凭据已变化，请先核对原采购记录')
    storage.remove(key(actorId), 'session')
    if (storage.get<unknown>(key(actorId), 'session') !== null) throw new Error('入库结果已返回，但浏览器未能清理凭据，请重试核对原单')
    delete pending.value[actorId]
  }

  return { pending, submitting, load, prepare, complete }
})
