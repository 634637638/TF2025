/**
 * 购物车管理 Composable
 * 功能：购物车ID管理、添加商品、获取购物车
 */
import { ref, computed } from 'vue'
import { addToCart, getCart as fetchCart, type CartData } from '@/api/shop-public'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'

// 获取或生成购物车ID
export function getCartId(): string {
  let cartId = storage.getH5CartId()
  if (!cartId) {
    cartId = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    storage.setH5CartId(cartId)
  }
  return cartId
}

// 购物车状态
const cartCount = ref(0)
const cartTotal = ref(0)

export function useCart() {
  // 添加商品到购物车
  const addCartItem = async (phoneId: number, quantity: number = 1) => {
    try {
      const cartId = getCartId()
      await addToCart(cartId, phoneId, quantity)

      // 更新购物车数量
      await refreshCart()

      return { success: true }
    } catch (error: any) {
      logger.error('添加到购物车失败:', error)
      return { success: false, message: error.message || '添加失败' }
    }
  }

  // 刷新购物车数据
  const refreshCart = async () => {
    try {
      const cartId = getCartId()
      const data = await fetchCart(cartId) as CartData
      cartCount.value = data.count || 0
      cartTotal.value = data.total || 0
    } catch (error) {
      logger.error('获取购物车失败:', error)
    }
  }

  // 清空购物车
  const clearCartData = () => {
    cartCount.value = 0
    cartTotal.value = 0
  }

  return {
    cartCount: computed(() => cartCount.value),
    cartTotal: computed(() => cartTotal.value),
    getCartId,
    addCartItem,
    refreshCart,
    clearCartData
  }
}
