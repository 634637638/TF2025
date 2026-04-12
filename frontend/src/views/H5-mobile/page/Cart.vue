<!--
  Cart - H5购物车页面
  功能：购物车商品列表、数量调整、删除、结算
-->
<template>
  <div class="cart-page">
    <div v-if="loading" class="loading-state">
      <el-skeleton animated />
    </div>

    <div v-else-if="cartData && cartData.items.length > 0" class="cart-content">
      <!-- 商品列表 -->
      <div class="cart-items">
        <div
          v-for="item in cartData.items"
          :key="item.id"
          class="cart-item"
          @swipe="handleSwipe(item.id)"
        >
          <div class="item-checkbox" @click="toggleSelect(item.cart_id)">
            <i :class="selectedItems.has(item.cart_id) ? 'fas fa-check-circle active' : 'far fa-circle'"></i>
          </div>
          <div class="item-image">
            <Image :src="item.image" :alt="item.brand_name + ' ' + item.model_name" mode="lazy" />
          </div>
          <div class="item-info">
            <h4 class="item-title">{{ item.brand_name }} {{ item.model_name }}</h4>
            <p class="item-specs">{{ item.color_name }} | {{ item.memory_name }}</p>
            <div class="item-footer">
              <span class="item-price">¥{{ formatPrice(item.sale_price) }}</span>
              <div class="item-actions">
                <div class="quantity-control">
                  <button @click="updateQuantity(item.cart_id, item.quantity - 1)" :disabled="item.quantity <= 1">-</button>
                  <span>{{ item.quantity }}</span>
                  <button @click="updateQuantity(item.cart_id, item.quantity + 1)">+</button>
                </div>
                <button class="delete-btn" @click="confirmDelete(item)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部结算栏 -->
      <div class="bottom-bar">
        <div class="select-all" @click="toggleSelectAll">
          <i :class="isAllSelected ? 'fas fa-check-circle active' : 'far fa-circle'"></i>
          <span>全选</span>
        </div>
        <div class="total-info">
          <span class="total-label">合计：</span>
          <span class="total-price">¥{{ selectedTotal }}</span>
        </div>
        <el-button type="primary" class="checkout-btn" :disabled="selectedItems.size === 0" @click="goCheckout">
          结算({{ selectedItems.size }})
        </el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-empty description="购物车是空的">
        <el-button type="primary" @click="goProducts">去逛逛</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getCart, updateCartItem, removeFromCart } from '@/api/shop-public'
import type { CartItem } from '@/api/shop-public'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import Image from '@/components/Image.vue'
import { logger } from '@/utils/logger'
const router = useRouter()

// 数据
const cartData = ref<any>(null)
const loading = ref(true)
const selectedItems = ref<Set<number>>(new Set())
const cartId = ref('')

// 是否全选
const isAllSelected = computed(() => {
  return cartData.value?.items.length > 0 && selectedItems.value.size === cartData.value?.items.length
})

// 选中商品总价
const selectedTotal = computed(() => {
  if (!cartData.value) return '0.00'

  let total = 0
  cartData.value.items.forEach((item: CartItem) => {
    // 使用 cart_id 来判断是否选中
    if (selectedItems.value.has(item.cart_id)) {
      total += item.sale_price * item.quantity
    }
  })

  return total.toFixed(2)
})

const formatPrice = (value: number | string | null | undefined) => {
  const numericValue = parseFloat(String(value ?? 0)) || 0
  return numericValue.toFixed(2)
}

// 获取购物车
const loadCart = async () => {
  cartId.value = storage.getH5CartId() || ''

  if (!cartId.value) {
    cartData.value = { items: [], total: 0, count: 0 }
    loading.value = false
    return
  }

  loading.value = true
  try {
    const data = await getCart(cartId.value)

    // 确保数据是响应式的
    cartData.value = {
      items: (data as any).items || [],
      total: (data as any).total || 0,
      count: (data as any).count || 0
    }

    // 过滤掉已删除的商品
    const validSelectedItems = new Set<number>()
    cartData.value.items.forEach((item: CartItem) => {
      // 使用 cart_id 而不是 id
      if (selectedItems.value.has(item.cart_id)) {
        validSelectedItems.add(item.cart_id)
      }
    })
    selectedItems.value = validSelectedItems

    // 更新本地存储的数量
    storage.setH5CartCount(cartData.value.count)
  } catch (error) {
    logger.error('获取购物车失败:', error)
    cartData.value = { items: [], total: 0, count: 0 }
  } finally {
    loading.value = false
  }
}

// 切换选中状态
const toggleSelect = (itemId: number) => {
  // itemId 实际上是 cart_id
  if (selectedItems.value.has(itemId)) {
    selectedItems.value.delete(itemId)
  } else {
    selectedItems.value.add(itemId)
  }
  // 触发响应式更新
  selectedItems.value = new Set(selectedItems.value)
}

// 全选/取消全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedItems.value.clear()
  } else {
    // 使用 cart_id 而不是 id
    selectedItems.value = new Set(cartData.value?.items.map((item: CartItem) => item.cart_id) || [])
  }
  selectedItems.value = new Set(selectedItems.value)
}

// 更新数量
const updateQuantity = async (cartItemId: number, quantity: number) => {
  if (quantity < 1) return

  try {
    await updateCartItem(cartItemId, quantity)
    await loadCart()
  } catch (error) {
    logger.error('更新数量失败:', error)
    ElMessage.error('更新失败')
  }
}

// 确认删除
const confirmDelete = (item: CartItem) => {
  ElMessageBox.confirm(
    `确定要删除 ${item.brand_name} ${item.model_name} 吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await removeFromCart(item.cart_id)
      // 先从选中项中移除（使用 cart_id）
      selectedItems.value.delete(item.cart_id)
      selectedItems.value = new Set(selectedItems.value)
      // 重新加载购物车
      await loadCart()
      ElMessage.success('删除成功')
    } catch (error) {
      logger.error('删除失败:', error)
      ElMessage.error('删除失败')
      // 删除失败时重新加载，确保数据一致性
      await loadCart()
    }
  }).catch(() => {
    // 取消删除
  })
}

// 侧滑删除
const handleSwipe = (itemId: number) => {
  // 可以在这里实现侧滑删除逻辑
  confirmDelete(cartData.value.items.find((item: CartItem) => item.id === itemId))
}

// 去结算
const goCheckout = () => {
  if (selectedItems.value.size === 0) {
    ElMessage.warning('请选择要结算的商品')
    return
  }

  const selectedItemsList = cartData.value.items.filter((item: CartItem) => selectedItems.value.has(item.cart_id))

  // 构建结算商品数据
  const checkoutItems = selectedItemsList.map((item: CartItem) => ({
    phoneId: item.id,
    cartItemId: item.cart_id,
    quantity: item.quantity,
    brand_name: item.brand_name,
    model_name: item.model_name,
    color_name: item.color_name,
    memory_name: item.memory_name,
    salePrice: item.sale_price,
    image: item.image
  }))

  // 使用 sessionStorage 存储商品数据
  storage.set(H5_STORAGE_KEYS.CHECKOUT_ITEMS, checkoutItems, 'session')

  // 跳转到结算页面
  router.push({
    path: '/m/checkout'
  })
}

// 去逛逛
const goProducts = () => {
  router.push('/m/products')
}

onMounted(() => {
  loadCart()
})
</script>

<style scoped lang="scss">
.cart-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: calc(132px + env(safe-area-inset-bottom));
}

// 加载状态
.loading-state {
  padding: 20px;
}

// 商品列表
.cart-items {
  padding: 8px;

  .cart-item {
    display: flex;
    align-items: center;
    background: #fff;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    position: relative;
    overflow: hidden;

    .item-checkbox {
      margin-right: 8px;

      i {
        font-size: 20px;
        color: #ddd;

        &.active {
          color: #ff6b00;
        }
      }
    }

    .item-image {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f5f5;
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .item-info {
      flex: 1;
      margin-left: 12px;
      overflow: hidden;

      .item-title {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin: 0 0 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-specs {
        font-size: 12px;
        color: #999;
        margin: 0 0 8px;
      }

      .item-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .item-price {
          font-size: 16px;
          font-weight: 500;
          color: #ff1744;
        }

        .item-actions {
          display: flex;
          align-items: center;
          gap: 12px;

          .quantity-control {
            display: flex;
            align-items: center;
            border: 1px solid #eee;
            border-radius: 4px;

            button {
              width: 28px;
              height: 28px;
              border: none;
              background: #fff;
              font-size: 16px;
              color: #666;
              cursor: pointer;

              &:disabled {
                color: #ccc;
              }
            }

            span {
              width: 40px;
              text-align: center;
              font-size: 14px;
              color: #333;
            }
          }

          .delete-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: #fff;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ff1744;
            cursor: pointer;
            transition: all 0.3s;
            border: 1px solid #ffebee;

            &:active {
              background: #ffebee;
            }

            i {
              font-size: 14px;
            }
          }
        }
      }
    }

    .item-delete {
      position: absolute;
      right: -60px;
      top: 0;
      bottom: 0;
      width: 60px;
      background: #ff1744;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      cursor: pointer;
      transition: right 0.3s;

      i {
        pointer-events: none;
      }
    }

    // 侧滑效果（保留备用）
    @media (hover: none) {
      &:active .item-delete {
        right: 0;
      }
    }
  }
}

// 底部结算栏
.bottom-bar {
  position: fixed;
  bottom: calc(60px + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  padding-bottom: 12px;
  background: #fff;
  border-top: 1px solid #eee;
  box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.08);
  z-index: 120;

  .select-all {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: 16px;

    i {
      font-size: 18px;
      color: #ddd;

      &.active {
        color: #ff6b00;
      }
    }

    span {
      font-size: 14px;
      color: #333;
    }
  }

  .total-info {
    flex: 1;
    text-align: right;

    .total-label {
      font-size: 14px;
      color: #666;
    }

    .total-price {
      font-size: 18px;
      font-weight: 500;
      color: #ff1744;
    }
  }

  .checkout-btn {
    margin-left: 16px;
    height: 40px;
    padding: 0 24px;
    border-radius: 20px;
    flex-shrink: 0;
  }
}

// 空状态
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 44px);
}
</style>
