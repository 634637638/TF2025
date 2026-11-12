<!--
  MyCenter - H5我的中心页面
  功能：显示用户信息、订单记录、客服等
-->
<template>
  <div class="my-center-page">
    <!-- 用户信息卡片 -->
    <div class="user-card">
      <div class="user-avatar">
        <img
          v-if="user && user.avatar"
          :src="formatImageUrl(user.avatar)"
          :alt="user.name"
        >
        <i
          v-else
          class="fas fa-user-circle"
        />
      </div>
      <div class="user-info">
        <div
          v-if="user"
          class="user-details-row"
        >
          <span class="user-name">{{ user.name }}</span>
          <span class="user-phone">{{ formatPhone(user.phone) }}</span>
          <span
            v-if="user.member_number"
            class="member-number"
          >会员号: {{ user.member_number }}</span>
        </div>
        <h2
          v-else
          class="user-title"
        >
          欢迎来到商城
        </h2>
        <p
          v-if="!user"
          class="user-desc"
        >
          登录后查看您的订单和账户信息
        </p>
      </div>
      <el-button
        v-if="user"
        link
        class="logout-btn"
        @click="handleLogout"
      >
        <i class="fas fa-sign-out-alt" />
      </el-button>
    </div>

    <!-- 功能网格 -->
    <div class="function-grid">
      <!-- 我的订单 -->
      <div
        class="grid-item"
        @click="navigateTo('/m/order-query')"
      >
        <div class="grid-icon bg-orange">
          <i class="fas fa-receipt" />
        </div>
        <span class="grid-label">我的订单</span>
      </div>

      <!-- 待支付 -->
      <div
        class="grid-item"
        @click="navigateTo('/m/order-query')"
      >
        <div class="grid-icon bg-blue">
          <i class="fas fa-clock" />
        </div>
        <span class="grid-label">待支付</span>
      </div>

      <!-- 已发货 -->
      <div
        class="grid-item"
        @click="navigateTo('/m/order-query')"
      >
        <div class="grid-icon bg-green">
          <i class="fas fa-shipping-fast" />
        </div>
        <span class="grid-label">已发货</span>
      </div>

      <!-- 已完成 -->
      <div
        class="grid-item"
        @click="navigateTo('/m/order-query')"
      >
        <div class="grid-icon bg-gray">
          <i class="fas fa-check-circle" />
        </div>
        <span class="grid-label">已完成</span>
      </div>

      <!-- 购买记录（登录后显示） -->
      <div
        v-if="user"
        class="grid-item"
        @click="showPurchaseRecords"
      >
        <div class="grid-icon bg-deep-orange">
          <i class="fas fa-history" />
        </div>
        <span class="grid-label">购买记录</span>
      </div>

      <!-- 个人资料（登录后显示） -->
      <div
        v-if="user"
        class="grid-item"
        @click="showProfileEdit"
      >
        <div class="grid-icon bg-purple">
          <i class="fas fa-user-edit" />
        </div>
        <span class="grid-label">个人资料</span>
      </div>

      <!-- 店铺信息 -->
      <div
        class="grid-item"
        @click="showShopInfo"
      >
        <div class="grid-icon bg-blue">
          <i class="fas fa-store" />
        </div>
        <span class="grid-label">店铺信息</span>
      </div>

      <!-- 返回首页 -->
      <div
        class="grid-item"
        @click="goHome"
      >
        <div class="grid-icon bg-blue-grey">
          <i class="fas fa-home" />
        </div>
        <span class="grid-label">返回首页</span>
      </div>
    </div>

    <!-- 登录/注册按钮区域（未登录时显示） -->
    <div
      v-if="!user"
      class="auth-buttons-row"
    >
      <el-button
        native-type="button"
        class="auth-btn login-btn tf-button--h5-action tf-button--h5-action-primary"
        @click="goToLogin"
      >
        <i class="fas fa-sign-in-alt" />
        <span>登录</span>
      </el-button>
      <el-button
        native-type="button"
        class="auth-btn register-btn tf-button--h5-action tf-button--h5-action-primary"
        @click="goToRegister"
      >
        <i class="fas fa-user-plus" />
        <span>注册</span>
      </el-button>
    </div>

    <!-- 悬浮客服按钮 -->
    <div
      class="floating-service"
      @click="showServiceDialog"
    >
      <div class="service-icon">
        <i class="fas fa-headset" />
      </div>
      <span class="service-text">客服</span>
    </div>

    <!-- 客服信息弹窗 -->
    <MobileDialog
      v-model="serviceVisible"
      title="联系客服"
      width="320px"
      :show-close="true"
      dialog-class="service-dialog-custom"
      :show-default-footer="false"
    >
      <div class="service-info">
        <!-- 一行显示两个选项 -->
        <div class="service-row">
          <div
            v-if="shopConfig.shop_phone"
            class="service-item phone-item"
            @click="callPhone"
          >
            <div class="service-icon phone-icon">
              <i class="fas fa-phone" />
            </div>
            <div class="service-content">
              <div class="service-label">
                拨打
              </div>
              <div class="service-value">
                {{ shopConfig.shop_phone }}
              </div>
            </div>
          </div>

          <div
            v-if="shopConfig.wechat_id"
            class="service-item wechat-item"
            @click="copyWechat"
          >
            <div class="service-icon wechat-icon">
              <i class="fab fa-weixin" />
            </div>
            <div class="service-content">
              <div class="service-label">
                加微信
              </div>
              <div class="service-value">
                {{ shopConfig.wechat_id }}
              </div>
            </div>
          </div>
        </div>

        <!-- 只有一个选项时居中显示 -->
        <div
          v-if="shopConfig.shop_phone && !shopConfig.wechat_id"
          class="service-single"
          @click="callPhone"
        >
          <div class="info-icon phone-icon">
            <i class="fas fa-phone" />
          </div>
          <div class="info-content">
            <div class="info-label">
              客服电话
            </div>
            <div class="info-value">
              {{ shopConfig.shop_phone }}
            </div>
          </div>
          <i class="fas fa-chevron-right info-arrow" />
        </div>

        <div
          v-if="!shopConfig.shop_phone && shopConfig.wechat_id"
          class="service-single"
          @click="copyWechat"
        >
          <div class="info-icon wechat-icon">
            <i class="fab fa-weixin" />
          </div>
          <div class="info-content">
            <div class="info-label">
              微信号
            </div>
            <div class="info-value">
              {{ shopConfig.wechat_id }}
            </div>
          </div>
          <i class="fas fa-chevron-right info-arrow" />
        </div>

        <div
          v-if="!shopConfig.shop_phone && !shopConfig.wechat_id"
          class="no-service"
        >
          <i class="fas fa-info-circle" />
          <p>暂无客服联系方式</p>
        </div>
      </div>
    </MobileDialog>

    <!-- 店铺信息弹窗 -->
    <MobileDialog
      v-model="shopVisible"
      title="店铺信息"
      width="320px"
      dialog-class="my-center-shop-dialog"
      :show-default-footer="false"
    >
      <div class="shop-info">
        <div
          v-if="shopConfig.shop_name"
          class="info-row"
        >
          <span class="label">店铺名称</span>
          <span class="value">{{ shopConfig.shop_name }}</span>
        </div>
        <div
          v-if="shopConfig.shop_address"
          class="info-row"
        >
          <span class="label">店铺地址</span>
          <span class="value">{{ shopConfig.shop_address }}</span>
        </div>
        <div
          v-if="shopConfig.shop_phone"
          class="info-row"
        >
          <span class="label">联系电话</span>
          <a
            :href="`tel:${shopConfig.shop_phone}`"
            class="value phone-value"
          >
            {{ shopConfig.shop_phone }}
          </a>
        </div>
        <div
          v-if="shopConfig.shop_hours"
          class="info-row"
        >
          <span class="label">营业时间</span>
          <span class="value">{{ shopConfig.shop_hours }}</span>
        </div>
      </div>
    </MobileDialog>

    <!-- 购买记录弹窗 -->
    <MobileDialog
      v-model="purchaseVisible"
      title="购买记录"
      width="90%"
      dialog-class="my-center-purchase-dialog"
      :show-default-footer="false"
    >
      <div class="purchase-records">
        <SectionLoading
          v-if="loadingPurchase"
          text="正在读取购买记录..."
        />

        <div
          v-else-if="purchaseRecords.length > 0"
          class="records-list"
        >
          <div
            v-for="record in purchaseRecords"
            :key="record.id"
            class="record-item"
          >
            <div class="record-header">
              <span class="invoice-number">{{ record.invoice_number || '-' }}</span>
              <span class="sale-date">{{ formatDate(record.sale_time) }}</span>
            </div>
            <div class="record-content">
              <div class="product-name">
                {{ record.product_name || '-' }}
              </div>
              <div class="record-details">
                <span
                  v-if="record.imei"
                  class="imei"
                >IMEI: {{ record.imei }}</span>
                <span class="store">{{ record.store_name || '-' }}</span>
              </div>
            </div>
            <div class="record-footer">
              <span class="price">{{ formatSalePrice(record.sale_price) }}</span>
              <span class="payment-method">{{ getPaymentText(record.payment_method) }}</span>
            </div>
          </div>
          <div
            v-if="hasMorePurchaseRecords"
            class="flex justify-center pt-2"
          >
            <el-button
              :loading="loadingPurchaseMore"
              @click="loadMorePurchaseRecords"
            >
              加载更多
            </el-button>
          </div>
        </div>
        <DataEmptyState
          v-else
          description="暂无购买记录"
        />
      </div>
    </MobileDialog>

    <!-- 个人资料编辑弹窗 -->
    <MobileDialog
      v-model="profileVisible"
      title="个人资料"
      width="90%"
      :style="{ '--dialog-max-width': '500px' }"
      dialog-class="my-center-profile-dialog"
      :show-default-footer="false"
    >
      <el-form
        ref="profileFormRef"
        :model="profileForm"
        :rules="profileFormRules"
        label-position="top"
        size="default"
      >
        <el-form-item
          label="姓名"
          prop="name"
        >
          <el-input
            v-model="profileForm.name"
            placeholder="请输入您的姓名"
            @input="handleProfileNameInput"
          />
        </el-form-item>
        <el-form-item
          label="联系电话"
          prop="phone"
        >
          <el-input
            v-model="profileForm.phone"
            placeholder="请输入手机号码"
            maxlength="11"
            disabled
          />
          <div class="form-tip">
            手机号不可修改，如需更换请联系客服
          </div>
        </el-form-item>
        <el-form-item
          label="身份证号"
          prop="idCard"
        >
          <el-input
            v-model="profileForm.idCard"
            placeholder="请输入身份证号（选填）"
            maxlength="18"
            @input="handleProfileIdCardInput"
          />
          <div class="form-tip">
            身份证号用于实名认证，选填
          </div>
        </el-form-item>
        <el-form-item
          label="Apple ID"
          prop="appleId"
        >
          <el-input
            v-model="profileForm.appleId"
            placeholder="请输入Apple ID（选填）"
            @input="handleProfileAppleIdInput"
          />
          <div class="form-tip">
            Apple ID支持手机号或邮箱，选填
          </div>
        </el-form-item>
        <el-form-item
          label="收货地址"
          prop="address"
        >
          <el-input
            v-model="profileForm.address"
            class="tf-textarea"
            type="textarea"
            placeholder="请输入详细收货地址"
            :rows="2"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button
            type="default"
            class="flex-1"
            @click="profileVisible = false"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            class="flex-1"
            :loading="savingProfile"
            @click="saveProfile"
          >
            保存
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { getPublicConfig, type ShopConfig } from '@/api/shop-public'
import { getRequestErrorMessage } from '@/utils/api-response'
import { userManager, getUserSales, logout as authLogout, updateProfile, getUserProfile, type AuthUser, type H5CustomerSale } from '@/api/auth'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { normalizeAppleId, normalizeIdCard, normalizePersonName } from '@/utils/security'
import { formatAmount, formatDate as formatGlobalDate, formatImageUrl } from '@/utils/format'
import { logger } from '@/utils/logger'
import SectionLoading from '@/components/SectionLoading.vue'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()

const router = useRouter()
const { confirm } = useNotification()
const shopConfig = ref<Partial<ShopConfig>>({})
const serviceVisible = ref(false)
const shopVisible = ref(false)
const purchaseVisible = ref(false)
const profileVisible = ref(false)
const loadingPurchase = ref(false)
const loadingPurchaseMore = ref(false)
const savingProfile = ref(false)
const purchaseRecords = ref<H5CustomerSale[]>([])
const purchasePage = ref(1)
const purchasePageSize = 20
const purchaseTotal = ref(0)
const hasMorePurchaseRecords = computed(() => purchaseRecords.value.length < purchaseTotal.value)
const currentUser = ref<AuthUser | null>(userManager.getUser())

// 个人资料表单
const profileFormRef = ref<FormInstance>()
const profileForm = ref({
  name: '',
  phone: '',
  idCard: '',
  appleId: '',
  address: ''
})

// 个人资料表单验证规则
const profileFormRules = {
  name: [ValidationRules.required('请输入姓名')],
  phone: [
    ValidationRules.required('请输入联系电话'),
    ValidationRules.phone()
  ],
  idCard: [ValidationRules.idCard()],
  appleId: [ValidationRules.appleAccount()],
  address: [ValidationRules.required('请输入收货地址')]
}

// 当前用户
const user = computed<AuthUser | null>(() => currentUser.value)

// 加载配置
const loadConfig = async () => {
  try {
    const response = await getPublicConfig()
    shopConfig.value = response
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 导航
const navigateTo = (path: string) => {
  router.push(path)
}

// 前往登录
const goToLogin = () => {
  router.push({
    path: '/m/login',
    query: { redirect: '/m/my' }
  })
}

// 前往注册
const goToRegister = () => {
  router.push('/m/register')
}

// 登出
const handleLogout = async () => {
  if (!await confirm('确定要退出登录吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })) return

  try {
    await authLogout()
    userManager.clearAuth()
    currentUser.value = null

    globalNotifications.success('已退出登录')
  } catch (error) {
    logger.error('登出失败:', error)
    globalNotifications.error('登出失败')
  }
}

// 格式化手机号
const formatPhone = (phone: string) => {
  if (!phone) return ''
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1****$3')
}

const normalizeProfileForm = () => {
  profileForm.value.name = normalizePersonName(profileForm.value.name, 50)
  profileForm.value.idCard = normalizeIdCard(profileForm.value.idCard)
  profileForm.value.appleId = normalizeAppleId(profileForm.value.appleId)
}

const handleProfileNameInput = (value: string) => {
  profileForm.value.name = normalizePersonName(value, 50)
}

const handleProfileIdCardInput = (value: string) => {
  profileForm.value.idCard = normalizeIdCard(value)
}

const handleProfileAppleIdInput = (value: string) => {
  profileForm.value.appleId = normalizeAppleId(value)
}

// 格式化日期
const formatDate = (date: string | null) => {
  if (!date) return ''
  return formatGlobalDate(date)
}

const formatSalePrice = (price: number | null) => (
  price === null || price === undefined || !Number.isFinite(price) ? '-' : `¥${formatAmount(price)}`
)

// 获取支付方式文本
const getPaymentText = (method: string | null) => {
  if (!method) return '-'
  const texts: Record<string, string> = {
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    pos: 'POS机',
    pickup: '到店自提'
  }
  return texts[method] || method
}

// 显示客服弹窗
const showServiceDialog = () => {
  serviceVisible.value = true
}

// 拨打电话
const callPhone = () => {
  if (shopConfig.value.shop_phone) {
    window.location.href = `tel:${shopConfig.value.shop_phone}`
  }
}

// 复制微信号
const copyWechat = () => {
  if (shopConfig.value.wechat_id) {
    // 复制微信号到剪贴板
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shopConfig.value.wechat_id).then(() => {
        globalNotifications.success('微信号已复制，正在打开微信...')
        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          window.location.href = `weixin://dl/chat?${shopConfig.value.wechat_id}`
        }, 1000)
      }).catch(() => {
        globalNotifications.info(`请添加微信号: ${shopConfig.value.wechat_id}`)
      })
    } else {
      globalNotifications.info(`请添加微信号: ${shopConfig.value.wechat_id}`)
    }
  }
}

// 联系客服（旧方法，保留用于兼容）
const _contactService = () => {
  showServiceDialog()
}

// 显示店铺信息
const showShopInfo = () => {
  shopVisible.value = true
}

// 返回首页
const goHome = () => {
  router.push('/m')
}

// 显示购买记录
const showPurchaseRecords = async () => {
  purchaseVisible.value = true
  loadingPurchase.value = true
  purchasePage.value = 1

  try {
    const result = await getUserSales({ page: purchasePage.value, page_size: purchasePageSize })
    purchaseRecords.value = result.data
    purchaseTotal.value = result.total
  } catch (error: unknown) {
    logger.error('获取购买记录失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '获取购买记录失败'))
  } finally {
    loadingPurchase.value = false
  }
}

const loadMorePurchaseRecords = async () => {
  if (loadingPurchaseMore.value || !hasMorePurchaseRecords.value) return

  loadingPurchaseMore.value = true
  purchasePage.value += 1
  try {
    const result = await getUserSales({ page: purchasePage.value, page_size: purchasePageSize })
    purchaseRecords.value.push(...result.data)
    purchaseTotal.value = result.total
  } catch (error: unknown) {
    purchasePage.value -= 1
    logger.error('加载更多购买记录失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '加载失败'))
  } finally {
    loadingPurchaseMore.value = false
  }
}

// 显示个人资料编辑
const showProfileEdit = async () => {
  if (user.value) {
    try {
      // 从后端API获取完整用户资料
      const profileData = await getUserProfile()
      const profile = profileData && typeof profileData === 'object' ? profileData as Record<string, unknown> : {}
      const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback

      profileForm.value = {
        name: normalizePersonName(stringValue(profile.name, user.value.name || ''), 50),
        phone: stringValue(profile.phone, user.value.phone || ''),
        idCard: normalizeIdCard(stringValue(profile.id_card)),
        appleId: normalizeAppleId(stringValue(profile.apple_id)),
        address: stringValue(profile.address)
      }
    } catch (error: unknown) {
      logger.error('获取用户资料失败:', error)
      // 如果API调用失败，尝试从本地存储读取
      const savedAddress = storage.get<Record<string, unknown>>(H5_STORAGE_KEYS.DEFAULT_ADDRESS, 'session')
      const addressData = savedAddress || {}
      const stringValue = (value: unknown) => typeof value === 'string' ? value : ''

      profileForm.value = {
        name: normalizePersonName(user.value.name || '', 50),
        phone: user.value.phone || '',
        idCard: normalizeIdCard(stringValue(addressData.idCard)),
        appleId: normalizeAppleId(stringValue(addressData.appleId)),
        address: stringValue(addressData.address)
      }
    }
  }
  profileVisible.value = true
}

// 保存个人资料
const saveProfile = async () => {
  if (savingProfile.value) return

  if (!profileFormRef.value) return

  try {
    normalizeProfileForm()
    await profileFormRef.value.validate()
    savingProfile.value = true

    // 调用后端 API 更新用户资料
    const response = await updateProfile({
      name: profileForm.value.name,
      idCard: profileForm.value.idCard,
      appleId: profileForm.value.appleId,
      address: profileForm.value.address
    })

    // 更新本地用户信息
    if (response) {
      userManager.setUser(response)
      currentUser.value = response
    }

    // 同时保存到本地存储作为备份
    storage.set(H5_STORAGE_KEYS.DEFAULT_ADDRESS, {
      name: profileForm.value.name,
      phone: profileForm.value.phone,
      idCard: profileForm.value.idCard,
      appleId: profileForm.value.appleId,
      address: profileForm.value.address
    }, 'session')

    globalNotifications.success('个人资料保存成功')
    profileVisible.value = false
  } catch (error: unknown) {
    logger.error('保存个人资料失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '保存个人资料失败'))
  } finally {
    savingProfile.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss" src="./styles/my-center/account.scss"></style>
<style scoped lang="scss" src="./styles/my-center/functions.scss"></style>
<style scoped lang="scss" src="./styles/my-center/service.scss"></style>
<style scoped lang="scss" src="./styles/my-center/records.scss"></style>
