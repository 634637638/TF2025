<!--
  Checkout - H5结算页面
  功能：填写收货信息、确认订单、提交
-->
<template>
  <div class="checkout-page">
    <div v-if="loading" class="loading-state">
      <el-skeleton animated />
    </div>

    <div v-else class="checkout-content">
      <!-- 商品信息 -->
      <div class="section">
        <h3 class="section-title">商品信息</h3>
        <div class="order-items">
          <div v-for="item in orderItems" :key="item.phoneId" class="order-item">
            <div class="item-image">
              <img :src="getImageUrl(item.image)" :alt="`${item.brand_name} ${item.model_name}`" />
            </div>
            <div class="item-info">
              <h4 class="item-title">{{ item.brand_name }} {{ item.model_name }}</h4>
              <p class="item-specs">{{ item.color_name }} | {{ item.memory_name }}</p>
              <div class="item-footer">
                <span class="item-price">¥{{ formatPrice(item.salePrice) }}</span>
                <span class="item-quantity">x{{ item.quantity }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 支付方式 - 横向排列 -->
      <div class="section payment-section">
        <h3 class="section-title">支付方式</h3>
        <div class="payment-tabs">
          <div
            class="payment-tab"
            :class="{ active: form.paymentMethod === 'pickup' }"
            @click="selectPaymentMethod('pickup')"
          >
            <i class="fas fa-store"></i>
            <span>到店自提</span>
          </div>
          <div
            class="payment-tab"
            :class="{ active: form.paymentMethod === 'wechat' }"
            @click="selectPaymentMethod('wechat')"
          >
            <i class="fab fa-weixin" style="color: #09bb07;"></i>
            <span>微信</span>
          </div>
          <div
            class="payment-tab"
            :class="{ active: form.paymentMethod === 'alipay' }"
            @click="selectPaymentMethod('alipay')"
          >
            <i class="fab fa-alipay" style="color: #1677ff;"></i>
            <span>支付宝</span>
          </div>
        </div>

        <!-- 到店自提 - 店铺选择 -->
        <div v-if="form.paymentMethod === 'pickup'" class="payment-content">
          <div class="store-selection">
            <h4 class="content-title">选择自提店铺</h4>
            <div class="store-list">
              <div
                v-for="store in availableStores"
                :key="store.id"
                class="store-item"
                :class="{ selected: selectedStore?.id === store.id }"
                @click="selectedStore = store"
              >
                <div class="store-info">
                  <h5 class="store-name">{{ store.name }}</h5>
                  <p v-if="store.address" class="store-address">{{ store.address }}</p>
                  <p v-if="store.phone" class="store-phone">
                    <i class="fas fa-phone"></i>
                    {{ store.phone }}
                  </p>
                </div>
                <i :class="selectedStore?.id === store.id ? 'fas fa-check-circle active' : 'far fa-circle'"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- 微信/支付宝 - 收货信息 -->
        <div v-if="form.paymentMethod === 'wechat' || form.paymentMethod === 'alipay'" class="payment-content">
          <div v-if="isLoggedIn" class="user-address-info">
            <h4 class="content-title">收货信息</h4>
            <div class="user-address-card" v-if="userDefaultAddress">
              <div class="address-info">
                <div class="address-name-phone">
                  <span class="address-name">{{ userDefaultAddress.name }}</span>
                  <span class="address-phone">{{ userDefaultAddress.phone }}</span>
                </div>
                <p class="address-detail">{{ userDefaultAddress.address }}</p>
              </div>
              <el-button size="small" type="primary" plain @click="showAddressModal = true">
                修改地址
              </el-button>
            </div>
            <div v-else class="no-address-hint">
              <p>您还没有设置收货地址</p>
              <el-button size="small" type="primary" @click="showAddressModal = true">
                添加地址
              </el-button>
            </div>
          </div>
          <div v-else class="guest-address-info">
            <h4 class="content-title">收货信息</h4>
            <el-form ref="deliveryFormRef" :model="deliveryForm" :rules="deliveryFormRules" label-position="top" size="small">
              <div class="delivery-form">
                <div class="form-row">
                  <el-form-item label="收货人" prop="name" class="form-item-half">
                    <el-input v-model="deliveryForm.name" placeholder="收货人姓名" />
                  </el-form-item>
                  <el-form-item label="联系电话" prop="phone" class="form-item-half">
                    <el-input v-model="deliveryForm.phone" placeholder="手机号码" maxlength="11" @input="deliveryForm.phone = normalizeCustomerPhone(deliveryForm.phone)" />
                  </el-form-item>
                </div>
                <el-form-item label="收货地址" prop="address">
                  <el-input v-model="deliveryForm.address" type="textarea" placeholder="详细地址" :rows="2" />
                </el-form-item>
              </div>
            </el-form>
          </div>
        </div>
      </div>

      <!-- 备注 -->
      <div class="section">
        <h3 class="section-title">备注信息</h3>
        <el-input
          v-model="form.remarks"
          type="textarea"
          placeholder="如有特殊要求，请在此备注"
          :rows="3"
          maxlength="200"
          show-word-limit
        />
      </div>

      <!-- 价格明细 -->
      <div class="section price-section">
        <div class="price-row">
          <span>商品总额</span>
          <span>¥{{ totalAmount }}</span>
        </div>
        <div class="price-row">
          <span>运费</span>
          <span>免运费</span>
        </div>
        <div class="price-row total">
          <span>应付金额</span>
          <span class="total-amount">¥{{ totalAmount }}</span>
        </div>
      </div>
    </div>

    <!-- 底部提交栏 -->
    <div class="bottom-bar">
      <div class="price-info">
        <span class="label">合计：</span>
        <span class="amount">¥{{ totalAmount }}</span>
      </div>
      <el-button type="primary" class="submit-btn" :loading="submitting" @click="handleSubmit">
        提交订单
      </el-button>
    </div>

    <!-- 地址管理弹窗 -->
    <MobileDialog
      v-model="showAddressModal"
      title="收货地址"
      width="90%"
      :style="{ '--dialog-max-width': '500px' }"
      dialog-class="checkout-address-dialog"
      :show-default-footer="false"
      @close="handleAddressModalClose"
    >
      <el-form ref="addressFormRef" :model="addressForm" :rules="addressFormRules" label-position="top" size="default">
        <div class="form-row">
          <el-form-item label="收货人" prop="name" class="form-item-half">
            <el-input v-model="addressForm.name" placeholder="请输入收货人姓名" />
          </el-form-item>
          <el-form-item label="联系电话" prop="phone" class="form-item-half">
            <el-input v-model="addressForm.phone" placeholder="请输入手机号码" maxlength="11" @input="addressForm.phone = normalizeCustomerPhone(addressForm.phone)" />
          </el-form-item>
        </div>
        <el-form-item label="收货地址" prop="address">
          <el-input v-model="addressForm.address" type="textarea" placeholder="请输入详细地址" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showAddressModal = false">取消</el-button>
        <el-button type="primary" @click="saveAddress" :loading="savingAddress">保存</el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { createOrder, getCart, getProductDetail, getStockDistribution } from '@/api/shop-public'
import { getPublicConfig } from '@/api/shop-public'
import { baseDataApi } from '@/api/base-data'
import { formatImageUrl } from '@/utils/format'
import { normalizePhoneDigits } from '@/utils/security'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { tokenManager, userManager, getUserProfile, type AuthUser } from '@/api/auth'
import { logger } from '@/utils/logger'
const router = useRouter()
const route = useRoute()

const currentUser = ref<AuthUser | null>(null)
const isLoggedIn = computed(() => tokenManager.isAuthenticated() && !!currentUser.value)
const normalizeCustomerPhone = (phone: unknown) => normalizePhoneDigits(phone)

// 表单数据
const formRef = ref<FormInstance>()
const deliveryFormRef = ref<FormInstance>()
const form = ref({
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  paymentMethod: 'pickup',
  remarks: ''
})

// 收货信息表单（未登录用户）
const deliveryForm = ref({
  name: '',
  phone: '',
  address: ''
})

// 收货信息验证规则
const deliveryFormRules = {
  name: [
    ValidationRules.required('请输入收货人姓名')
  ],
  phone: [
    ValidationRules.required('请输入联系电话'),
    ValidationRules.phone()
  ],
  address: [
    ValidationRules.required('请输入收货地址')
  ]
}

// 可用店铺列表（从库存分布API获取）
const availableStores = ref<any[]>([])

// 选中的店铺
const selectedStore = ref<any>(null)

// 加载店铺列表
const loadAvailableStores = async () => {
  if (orderItems.value.length === 0) return

  // 获取第一个商品的信息
  const firstItem = orderItems.value[0]

  try {
    // 首先获取商品详情以获取brand_id, model_id等
    const productResponse = await getProductDetail(firstItem.phoneId)
    const productDetail: any = productResponse.data || productResponse

    // 获取内存ID
    let memoryId = null
    if (productDetail.memory_id) {
      memoryId = productDetail.memory_id
    } else {
      // 如果没有memory_id，尝试从内存名称查找
      const memories = await baseDataApi.getPublicMemories()
      const memory = memories.find((m: any) => m.name === firstItem.memory_name)
      memoryId = memory?.id
    }

    if (!memoryId) {
      logger.warn('[loadAvailableStores] 无法获取内存ID，使用默认店铺列表')
      return
    }

    // 调用库存分布API
    const stockResponse = await getStockDistribution({
      brand_id: productDetail.brand_id,
      model_id: productDetail.model_id,
      color_id: productDetail.color_id,
      memory_id: memoryId,
      is_new: productDetail.is_new === 1 || productDetail.is_new === '1'
    })
    const stockData: any = stockResponse.data || stockResponse

    // 提取店铺信息
    availableStores.value = stockData.stores.map((store: any) => ({
      id: store.store_id,
      name: store.store_name,
      address: store.store_address || '',
      phone: store.store_phone || '',
      stock_count: store.stock_count
    }))

    // 自动选择商品所在店铺或库存最多的店铺
    if (firstItem.store_id || firstItem.store_name) {
      const itemStore = availableStores.value.find(
        s => s.id === firstItem.store_id || s.name === firstItem.store_name
      )
      if (itemStore) {
        selectedStore.value = itemStore
      } else if (availableStores.value.length > 0) {
        // 如果找不到商品所在店铺，选择库存最多的
        selectedStore.value = availableStores.value.reduce((max, store) =>
          store.stock_count > max.stock_count ? store : max
        )
      }
    } else if (availableStores.value.length > 0) {
      // 选择库存最多的店铺
      selectedStore.value = availableStores.value.reduce((max, store) =>
        store.stock_count > max.stock_count ? store : max
      )
    }
  } catch (error) {
    logger.error('[loadAvailableStores] 加载店铺列表失败:', error)
    ElMessage.warning('获取店铺信息失败，请稍后重试')
  }
}

// 用户默认地址
const userDefaultAddress = ref<any>(null)

// 显示地址弹窗
const showAddressModal = ref(false)

// 地址表单
const addressFormRef = ref<FormInstance>()
const addressForm = ref({
  name: '',
  phone: '',
  address: ''
})

// 保存地址中
const savingAddress = ref(false)

// 地址表单验证规则
const addressFormRules = {
  name: [ValidationRules.required('请输入收货人姓名')],
  phone: [
    ValidationRules.required('请输入联系电话'),
    ValidationRules.phone()
  ],
  address: [ValidationRules.required('请输入收货地址')]
}

// 表单验证规则
const formRules = {
  customerName: [
    ValidationRules.required('请输入联系人姓名')
  ],
  customerPhone: [
    ValidationRules.required('请输入联系电话'),
    ValidationRules.phone()
  ]
}

// 订单商品
const orderItems = ref<any[]>([])
const loading = ref(true)
const submitting = ref(false)
const shopConfig = ref<any>({})

const syncCustomerFields = (payload: {
  name?: string
  phone?: string
  address?: string
}, options: { overwriteName?: boolean; overwritePhone?: boolean; overwriteAddress?: boolean } = {}) => {
  const {
    overwriteName = false,
    overwritePhone = false,
    overwriteAddress = false
  } = options

  if ((overwriteName || !form.value.customerName) && payload.name) {
    form.value.customerName = payload.name
  }

  if ((overwritePhone || !form.value.customerPhone) && payload.phone) {
    form.value.customerPhone = normalizeCustomerPhone(payload.phone)
  }

  if ((overwriteAddress || !form.value.customerAddress) && payload.address !== undefined) {
    form.value.customerAddress = payload.address
  }
}

const syncUserContactInfo = () => {
  if (!currentUser.value) {
    return
  }

  syncCustomerFields({
    name: currentUser.value.name || '',
    phone: currentUser.value.phone || ''
  })
}

const syncDefaultAddressToOrder = (overwrite = true) => {
  if (!userDefaultAddress.value) {
    return
  }

  syncCustomerFields({
    name: userDefaultAddress.value.name || '',
    phone: userDefaultAddress.value.phone || '',
    address: userDefaultAddress.value.address || ''
  }, {
    overwriteName: overwrite,
    overwritePhone: overwrite,
    overwriteAddress: overwrite
  })
}

const syncGuestDeliveryToOrder = () => {
  syncCustomerFields({
    name: deliveryForm.value.name || '',
    phone: normalizeCustomerPhone(deliveryForm.value.phone || ''),
    address: deliveryForm.value.address || ''
  }, {
    overwriteName: true,
    overwritePhone: true,
    overwriteAddress: true
  })
}

const syncContactInfoForPaymentMethod = () => {
  if (form.value.paymentMethod === 'pickup') {
    syncUserContactInfo()
    if (!form.value.customerAddress) {
      form.value.customerAddress = ''
    }
    return
  }

  if (isLoggedIn.value) {
    syncUserContactInfo()
    syncDefaultAddressToOrder(true)
    return
  }

  syncGuestDeliveryToOrder()
}

// 选择支付方式
const selectPaymentMethod = async (method: string) => {
  form.value.paymentMethod = method

  // 如果切换到自提，且还没有选中店铺，自动选择库存最多的店铺
  if (method === 'pickup' && !selectedStore.value && availableStores.value.length > 0) {
    selectedStore.value = availableStores.value.reduce((max, store) =>
      store.stock_count > max.stock_count ? store : max
    )
  }

  if ((method === 'wechat' || method === 'alipay') && isLoggedIn.value && !userDefaultAddress.value?.address) {
    await loadUserDefaultAddress(true)
  }

  syncContactInfoForPaymentMethod()
}

// 格式化价格
const formatPrice = (price: any) => {
  if (!price && price !== 0) return '0.00'
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  return isNaN(numPrice) ? '0.00' : numPrice.toFixed(2)
}

// 获取图片 URL - 使用统一的图片URL处理函数
const getImageUrl = (imageUrl: string): string => {
  const defaultImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3ENo Image%3C/text%3E%3C/svg%3E'
  if (!imageUrl) return defaultImage
  return formatImageUrl(imageUrl)
}

// 商品总额
const totalAmount = computed(() => {
  if (!orderItems.value || orderItems.value.length === 0) return '0.00'

  const total = orderItems.value.reduce((sum, item) => {
    const price = typeof item.salePrice === 'string' ? parseFloat(item.salePrice) : (item.salePrice || 0)
    const validPrice = isNaN(price) ? 0 : price
    return sum + (validPrice * item.quantity)
  }, 0)
  return total.toFixed(2)
})

const resetCheckoutState = () => {
  loading.value = true
  submitting.value = false
  orderItems.value = []
  availableStores.value = []
  selectedStore.value = null
}

// 获取订单商品详情
const loadOrderItems = async (force = false) => {
  if (!force && orderItems.value.length > 0) {
    loading.value = false
    return
  }

  // 优先从 sessionStorage 获取（立即购买）
  const sessionItems = storage.get<any[]>(H5_STORAGE_KEYS.CHECKOUT_ITEMS, 'session')

  if (sessionItems) {
    try {
      let items = sessionItems

      // 如果是单个对象，转换为数组
      if (!Array.isArray(items)) {
        items = [items]
      }

      // 检查是否已有完整的商品信息
      const needsDetail = items.some((item: any) => !item.brand_name || !item.model_name)

      if (needsDetail) {
        // 需要获取商品详情
        orderItems.value = await Promise.all(items.map(async (item: any) => {
          try {
            const productResponse = await getProductDetail(item.phoneId)
            const productDetail: any = productResponse.data || productResponse
            return {
              phoneId: item.phoneId,
              quantity: item.quantity || 1,
              brand_name: productDetail.brand_name || '',
              model_name: productDetail.model_name || '',
              color_name: productDetail.color_name || '',
              memory_name: productDetail.memory_name || '',
              salePrice: productDetail.sale_price || productDetail.actual_sale_price || 0,
              image: productDetail.images?.[0]?.image_url || productDetail.main_image || '',
              // 保存店铺信息
              store_id: productDetail.store_id,
              store_name: productDetail.store_name,
              store_address: productDetail.store_address,
              store_phone: productDetail.store_phone
            }
          } catch (error) {
            logger.error('[Checkout] 获取商品详情失败:', error)
            return {
              phoneId: item.phoneId,
              quantity: item.quantity || 1,
              brand_name: '未知',
              model_name: '未知',
              color_name: '未知',
              memory_name: '未知',
              salePrice: 0,
              image: ''
            }
          }
        }))
      } else {
        // 已有完整信息，直接使用
        orderItems.value = items
      }

      // 清除临时数据
      storage.remove(H5_STORAGE_KEYS.CHECKOUT_ITEMS, 'session')
      loading.value = false
      return
    } catch (error) {
      logger.error('解析临时订单数据失败:', error)
    }
  }

  // 如果没有商品数据，返回首页
  ElMessage.warning('请先选择商品')
  router.push('/m')
  loading.value = false
}

const initializeCheckout = async (force = false) => {
  if (force) {
    resetCheckoutState()
  }

  currentUser.value = userManager.getUser()

  await loadOrderItems(force)

  if (loading.value) {
    return
  }

  await loadConfig()

  // 自动填充上次的信息
  const lastPhone = storage.get<string>(H5_STORAGE_KEYS.LAST_PHONE, 'local')
  if (lastPhone && !form.value.customerPhone) {
    form.value.customerPhone = normalizeCustomerPhone(lastPhone)
  }

  const lastName = storage.get<string>(H5_STORAGE_KEYS.LAST_NAME, 'local')
  if (lastName && !form.value.customerName) {
    form.value.customerName = lastName
  }

  syncUserContactInfo()

  // 加载可用店铺列表
  await loadAvailableStores()

  // 加载用户默认地址
  await loadUserDefaultAddress()

  syncContactInfoForPaymentMethod()
}

// 获取商城配置
const loadConfig = async () => {
  try {
    shopConfig.value = await getPublicConfig()
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 提交订单
const handleSubmit = async () => {
  try {
    deliveryForm.value.phone = normalizeCustomerPhone(deliveryForm.value.phone)
    addressForm.value.phone = normalizeCustomerPhone(addressForm.value.phone)
    form.value.customerPhone = normalizeCustomerPhone(form.value.customerPhone)

    if (orderItems.value.length === 0) {
      ElMessage.warning('请先选择商品')
      return
    }

    if (form.value.paymentMethod === 'pickup') {
      syncUserContactInfo()
      form.value.customerAddress = ''

      if (!selectedStore.value) {
        ElMessage.warning('请选择自提店铺')
        return
      }

      if (!form.value.customerName || !form.value.customerPhone) {
        ElMessage.warning('缺少联系人信息，请先登录或填写收货信息')
        return
      }
    } else if (isLoggedIn.value) {
      syncUserContactInfo()
      syncDefaultAddressToOrder(true)

      if (!form.value.customerName || !form.value.customerPhone || !form.value.customerAddress) {
        ElMessage.warning('请先完善收货信息')
        showAddressModal.value = true
        return
      }
    } else {
      if (!deliveryFormRef.value) {
        ElMessage.warning('请填写收货信息')
        return
      }

      await deliveryFormRef.value.validate()
      syncGuestDeliveryToOrder()
    }

    submitting.value = true

    const orderData = {
      customerName: form.value.customerName,
      customerPhone: normalizeCustomerPhone(form.value.customerPhone),
      customerAddress: form.value.customerAddress,
      items: orderItems.value.map(item => ({
        phoneId: item.phoneId,
        quantity: item.quantity
      })),
      paymentMethod: form.value.paymentMethod,
      remarks: form.value.remarks,
      cartId: storage.getH5CartId() || undefined
    }

    const response: any = await createOrder(orderData)
    const result = response.data || response

    // 清空购物车
    if (orderData.cartId) {
      storage.clearH5Cart()
    }

    // 使用 sessionStorage 存储订单信息
    storage.set(H5_STORAGE_KEYS.ORDER_SUCCESS, {
      orderNumber: result.orderNumber,
      totalAmount: result.totalAmount,
      timestamp: Date.now()
    }, 'session')

    // 跳转到订单成功页面（不带参数）
    router.push({
      path: '/m/order/success'
    })
  } catch (error: any) {
    logger.error('提交订单失败:', error)
    ElMessage.error(error.message || '提交订单失败')
  } finally {
    submitting.value = false
  }
}

// 保存用户信息到本地存储
watch(() => form.value.customerPhone, (value) => {
  if (value) {
    const normalizedValue = normalizeCustomerPhone(value)
    if (normalizedValue !== value) {
      form.value.customerPhone = normalizedValue
      return
    }
    storage.set(H5_STORAGE_KEYS.LAST_PHONE, normalizedValue, 'local')
  }
})

watch(() => form.value.customerName, (value) => {
  if (value) {
    storage.set(H5_STORAGE_KEYS.LAST_NAME, value, 'local')
  }
})

// 监听地址弹窗打开，填充现有地址
watch(showAddressModal, (isOpen) => {
  if (isOpen && userDefaultAddress.value) {
    addressForm.value = {
      name: userDefaultAddress.value.name,
      phone: userDefaultAddress.value.phone,
      address: userDefaultAddress.value.address
    }
  }
})

onMounted(async () => {
  await initializeCheckout()
})

const buildDefaultAddress = (payload: any) => {
  const name = payload?.name || currentUser.value?.name || ''
  const phone = payload?.phone || currentUser.value?.phone || ''
  const normalizedPhone = normalizeCustomerPhone(phone)
  const address = payload?.address || ''

  if (!name && !phone && !address) {
    return null
  }

  return { name, phone: normalizedPhone, address }
}

// 加载用户默认地址
const loadUserDefaultAddress = async (forceRemote = false) => {
  if (!isLoggedIn.value) {
    userDefaultAddress.value = null
    return
  }

  try {
    const savedAddress = !forceRemote
      ? storage.get<any>(H5_STORAGE_KEYS.DEFAULT_ADDRESS, 'local')
      : null

    const localAddress = buildDefaultAddress(savedAddress)
    if (localAddress?.address) {
      userDefaultAddress.value = localAddress
      syncDefaultAddressToOrder(true)
      return
    }

    const profile = await getUserProfile()
    const profileAddress = buildDefaultAddress(profile)

    if (profileAddress) {
      userDefaultAddress.value = profileAddress
      storage.set(H5_STORAGE_KEYS.DEFAULT_ADDRESS, profileAddress, 'local')
      syncDefaultAddressToOrder(true)
      return
    }

    userDefaultAddress.value = localAddress
    if (localAddress) {
      syncDefaultAddressToOrder(true)
    }
  } catch (error) {
    logger.error('获取用户地址失败:', error)

    const fallbackAddress = buildDefaultAddress(storage.get<any>(H5_STORAGE_KEYS.DEFAULT_ADDRESS, 'local'))
    userDefaultAddress.value = fallbackAddress
    if (fallbackAddress) {
      syncDefaultAddressToOrder(true)
    }
  }
}

// 保存地址
const saveAddress = async () => {
  if (!addressFormRef.value) return

  try {
    await addressFormRef.value.validate()
    savingAddress.value = true

    // 保存地址到本地存储（临时方案）
    const addressData = {
      name: addressForm.value.name,
      phone: normalizeCustomerPhone(addressForm.value.phone),
      address: addressForm.value.address
    }
    storage.set(H5_STORAGE_KEYS.DEFAULT_ADDRESS, addressData, 'local')
    userDefaultAddress.value = addressData
    syncDefaultAddressToOrder(true)

    ElMessage.success('地址保存成功')
    showAddressModal.value = false
  } catch (error) {
    logger.error('保存地址失败:', error)
  } finally {
    savingAddress.value = false
  }
}

// 地址弹窗关闭时的处理
const handleAddressModalClose = () => {
  // 如果有现有地址，重置表单为现有地址的值
  if (userDefaultAddress.value) {
    addressForm.value = {
      name: userDefaultAddress.value.name,
      phone: userDefaultAddress.value.phone,
      address: userDefaultAddress.value.address
    }
  } else {
    // 清空表单
    addressForm.value = {
      name: '',
      phone: '',
      address: ''
    }
  }
}

watch(deliveryForm, () => {
  if (!isLoggedIn.value && (form.value.paymentMethod === 'wechat' || form.value.paymentMethod === 'alipay')) {
    syncGuestDeliveryToOrder()
  }
}, { deep: true })

onActivated(async () => {
  if (route.path === '/m/checkout') {
    await initializeCheckout(true)
  }
})
</script>

<style scoped lang="scss">
.checkout-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 60px;
}

// 加载状态
.loading-state {
  padding: 20px;
}

// 内容区域
.checkout-content {
  padding: 8px;
}

// 区块
.section {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 8px;

  .section-title {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin: 0 0 16px;
  }
}

// 收货地址 - 小卡片风格
.address-section {
  padding: 12px 14px;

  .address-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;

    .section-title {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }

    .required-hint {
      font-size: 11px;
      color: #ff1744;
    }
  }

  .address-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .address-card {
    flex: 1;
    min-width: calc(50% - 4px);
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;

    &:hover {
      border-color: #667eea;
      background: #fff;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
    }

    &.full-width {
      flex: 100%;
      min-width: 100%;
    }

    .card-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      i {
        font-size: 14px;
        color: #fff;
      }
    }

    .card-input {
      flex: 1;
      min-width: 0;
    }

    .card-form-item {
      margin: 0;

      :deep(.el-form-item__content) {
        margin-left: 0;
        line-height: normal;
      }

      :deep(.el-form-item__error) {
        position: absolute;
        bottom: -18px;
        left: 0;
        font-size: 11px;
      }
    }

    .card-input-field {
      &:deep(.el-input__wrapper) {
        background: transparent;
        border: none;
        box-shadow: none;
        padding: 0;
        font-size: 13px;

        .el-input__inner {
          color: #333;

          &::placeholder {
            color: #999;
            font-size: 12px;
          }
        }
      }

      &:deep(.el-input__clear) {
        font-size: 14px;
        color: #999;
      }

      &:deep(.el-input__clear:hover) {
        color: #667eea;
      }
    }
  }
}

// 商品列表
.order-items {
  .order-item {
    display: flex;
    padding: 12px 0;
    border-bottom: 1px solid #f5f5f5;

    &:last-child {
      border-bottom: none;
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
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .item-title {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin: 0 0 4px;
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

        .item-quantity {
          font-size: 14px;
          color: #999;
        }
      }
    }
  }
}

// 支付方式区域
.payment-section {
  .payment-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .payment-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    background: #f8f9fa;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;

    i {
      font-size: 24px;
      margin-bottom: 6px;
    }

    span {
      font-size: 13px;
      color: #666;
    }

    &.active {
      background: #fff;
      border-color: #667eea;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);

      span {
        color: #667eea;
        font-weight: 500;
      }
    }
  }

  .payment-content {
    animation: fadeIn 0.3s ease;
  }

  .content-title {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    margin: 0 0 12px;
  }
}

// 店铺选择
.store-selection {
  .store-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .store-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: #f8f9fa;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      background: #fff;
      border-color: #e0e0e0;
    }

    &.selected {
      background: #f0f4ff;
      border-color: #667eea;

      i.fa-check-circle.active {
        color: #667eea;
      }
    }

    .store-info {
      flex: 1;

      .store-name {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin: 0 0 6px;
      }

      .store-address {
        font-size: 12px;
        color: #666;
        margin: 0 0 4px;
      }

      .store-phone {
        font-size: 12px;
        color: #999;
        margin: 0;

        i {
          font-size: 12px;
          margin-right: 4px;
        }
      }
    }

    i.fa-check-circle,
    i.fa-circle {
      font-size: 20px;
      color: #ddd;
    }
  }
}

// 用户地址信息（已登录）
.user-address-info {
  .user-address-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 8px;

    .address-info {
      flex: 1;

      .address-name-phone {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;

        .address-name {
          font-size: 15px;
          font-weight: 500;
          color: #333;
          margin: 0;
        }

        .address-phone {
          font-size: 13px;
          color: #666;
          margin: 0;
        }
      }

      .address-detail {
        font-size: 13px;
        color: #666;
        margin: 0;
        line-height: 1.5;
      }
    }
  }

  .no-address-hint {
    text-align: center;
    padding: 24px 16px;
    background: #f8f9fa;
    border-radius: 8px;

    p {
      font-size: 14px;
      color: #999;
      margin: 0 0 12px;
    }
  }
}

// 访客地址信息（未登录）
.guest-address-info {
  .delivery-form {
    .form-row {
      display: flex;
      gap: 12px;

      .form-item-half {
        flex: 1;
        margin-bottom: 16px;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .el-form-item {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 支付方式（旧版，保留）
.payment-methods {
  .payment-item {
    display: flex;
    align-items: center;
    padding: 12px;
    border: 1px solid #eee;
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;

    &:last-child {
      margin-bottom: 0;
    }

    &.active {
      border-color: #ff6b00;
      background: #fff8f0;

      i.fa-check-circle.active {
        color: #ff6b00;
      }
    }

    > i:first-child {
      font-size: 24px;
      margin-right: 12px;
    }

    .payment-info {
      flex: 1;
      display: flex;
      flex-direction: column;

      .payment-name {
        font-size: 14px;
        color: #333;
      }

      .payment-desc {
        font-size: 12px;
        color: #999;
      }
    }

    i.fa-check-circle,
    i.fa-circle {
      font-size: 18px;
      color: #ddd;
    }
  }
}

// 价格明细
.price-section {
  .price-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    color: #666;

    &.total {
      padding-top: 12px;
      border-top: 1px solid #eee;
      font-size: 16px;
      color: #333;
      font-weight: 500;

      .total-amount {
        color: #ff1744;
        font-size: 20px;
      }
    }
  }
}

// 底部提交栏
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #eee;
  z-index: 100;

  .price-info {
    .label {
      font-size: 14px;
      color: #666;
    }

    .amount {
      font-size: 20px;
      font-weight: 500;
      color: #ff1744;
    }
  }

  .submit-btn {
    height: 44px;
    padding: 0 32px;
    border-radius: 22px;
    font-size: 16px;
  }
}
</style>
