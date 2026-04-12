<!--
  MyCenter - H5我的中心页面
  功能：显示用户信息、订单记录、客服等
-->
<template>
  <div class="my-center-page">
    <!-- 用户信息卡片 -->
    <div class="user-card">
      <div class="user-avatar">
        <img v-if="user && user.avatar" :src="user.avatar" :alt="user.name" />
        <i v-else class="fas fa-user-circle"></i>
      </div>
      <div class="user-info">
        <div v-if="user" class="user-details-row">
          <span class="user-name">{{ user.name }}</span>
          <span class="user-phone">{{ formatPhone(user.phone) }}</span>
          <span v-if="user.member_number" class="member-number">会员号: {{ user.member_number }}</span>
        </div>
        <h2 v-else class="user-title">欢迎来到商城</h2>
        <p v-if="!user" class="user-desc">登录后查看您的订单和账户信息</p>
      </div>
      <el-button v-if="user" link @click="handleLogout" class="logout-btn">
        <i class="fas fa-sign-out-alt"></i>
      </el-button>
    </div>

    <!-- 功能网格 -->
    <div class="function-grid">
      <!-- 我的订单 -->
      <div class="grid-item" @click="navigateTo('/m/order-query')">
        <div class="grid-icon bg-orange">
          <i class="fas fa-receipt"></i>
        </div>
        <span class="grid-label">我的订单</span>
      </div>

      <!-- 待支付 -->
      <div class="grid-item" @click="navigateTo('/m/order-query')">
        <div class="grid-icon bg-blue">
          <i class="fas fa-clock"></i>
        </div>
        <span class="grid-label">待支付</span>
      </div>

      <!-- 已发货 -->
      <div class="grid-item" @click="navigateTo('/m/order-query')">
        <div class="grid-icon bg-green">
          <i class="fas fa-shipping-fast"></i>
        </div>
        <span class="grid-label">已发货</span>
      </div>

      <!-- 已完成 -->
      <div class="grid-item" @click="navigateTo('/m/order-query')">
        <div class="grid-icon bg-gray">
          <i class="fas fa-check-circle"></i>
        </div>
        <span class="grid-label">已完成</span>
      </div>

      <!-- 购买记录（登录后显示） -->
      <div v-if="user" class="grid-item" @click="showPurchaseRecords">
        <div class="grid-icon bg-deep-orange">
          <i class="fas fa-history"></i>
        </div>
        <span class="grid-label">购买记录</span>
      </div>

      <!-- 个人资料（登录后显示） -->
      <div v-if="user" class="grid-item" @click="showProfileEdit">
        <div class="grid-icon bg-purple">
          <i class="fas fa-user-edit"></i>
        </div>
        <span class="grid-label">个人资料</span>
      </div>

      <!-- 店铺信息 -->
      <div class="grid-item" @click="showShopInfo">
        <div class="grid-icon bg-blue">
          <i class="fas fa-store"></i>
        </div>
        <span class="grid-label">店铺信息</span>
      </div>

      <!-- 返回首页 -->
      <div class="grid-item" @click="goHome">
        <div class="grid-icon bg-blue-grey">
          <i class="fas fa-home"></i>
        </div>
        <span class="grid-label">返回首页</span>
      </div>
    </div>

    <!-- 登录/注册按钮区域（未登录时显示） -->
    <div v-if="!user" class="auth-buttons-row">
      <div class="auth-btn login-btn" @click="goToLogin">
        <i class="fas fa-sign-in-alt"></i>
        <span>登录</span>
      </div>
      <div class="auth-btn register-btn" @click="goToRegister">
        <i class="fas fa-user-plus"></i>
        <span>注册</span>
      </div>
    </div>

    <!-- 悬浮客服按钮 -->
    <div class="floating-service" @click="showServiceDialog">
      <div class="service-icon">
        <i class="fas fa-headset"></i>
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
          <div v-if="shopConfig.shop_phone" class="service-item phone-item" @click="callPhone">
            <div class="service-icon phone-icon">
              <i class="fas fa-phone"></i>
            </div>
            <div class="service-content">
              <div class="service-label">拨打</div>
              <div class="service-value">{{ shopConfig.shop_phone }}</div>
            </div>
          </div>

          <div v-if="shopConfig.wechat_id" class="service-item wechat-item" @click="copyWechat">
            <div class="service-icon wechat-icon">
              <i class="fab fa-weixin"></i>
            </div>
            <div class="service-content">
              <div class="service-label">加微信</div>
              <div class="service-value">{{ shopConfig.wechat_id }}</div>
            </div>
          </div>
        </div>

        <!-- 只有一个选项时居中显示 -->
        <div v-if="shopConfig.shop_phone && !shopConfig.wechat_id" class="service-single" @click="callPhone">
          <div class="info-icon phone-icon">
            <i class="fas fa-phone"></i>
          </div>
          <div class="info-content">
            <div class="info-label">客服电话</div>
            <div class="info-value">{{ shopConfig.shop_phone }}</div>
          </div>
          <i class="fas fa-chevron-right info-arrow"></i>
        </div>

        <div v-if="!shopConfig.shop_phone && shopConfig.wechat_id" class="service-single" @click="copyWechat">
          <div class="info-icon wechat-icon">
            <i class="fab fa-weixin"></i>
          </div>
          <div class="info-content">
            <div class="info-label">微信号</div>
            <div class="info-value">{{ shopConfig.wechat_id }}</div>
          </div>
          <i class="fas fa-chevron-right info-arrow"></i>
        </div>

        <div v-if="!shopConfig.shop_phone && !shopConfig.wechat_id" class="no-service">
          <i class="fas fa-info-circle"></i>
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
        <div v-if="shopConfig.shop_name" class="info-row">
          <span class="label">店铺名称</span>
          <span class="value">{{ shopConfig.shop_name }}</span>
        </div>
        <div v-if="shopConfig.shop_address" class="info-row">
          <span class="label">店铺地址</span>
          <span class="value">{{ shopConfig.shop_address }}</span>
        </div>
        <div v-if="shopConfig.shop_phone" class="info-row">
          <span class="label">联系电话</span>
          <a :href="`tel:${shopConfig.shop_phone}`" class="value phone-value">
            {{ shopConfig.shop_phone }}
          </a>
        </div>
        <div v-if="shopConfig.shop_hours" class="info-row">
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
      <div v-loading="loadingPurchase" class="purchase-records">
        <div v-if="purchaseRecords.length > 0" class="records-list">
          <div v-for="record in purchaseRecords" :key="record.id" class="record-item">
            <div class="record-header">
              <span class="invoice-number">{{ record.invoice_number || '无发票号' }}</span>
              <span class="sale-date">{{ formatDate(record.sale_date) }}</span>
            </div>
            <div class="record-content">
              <div class="product-name">{{ record.product_name || '未知商品' }}</div>
              <div class="record-details">
                <span v-if="record.imei" class="imei">IMEI: {{ record.imei }}</span>
                <span class="store">{{ record.store_name || '未知店铺' }}</span>
              </div>
            </div>
            <div class="record-footer">
              <span class="price">¥{{ parseFloat(record.sale_price).toFixed(2) }}</span>
              <span class="payment-method">{{ getPaymentText(record.payment_method) }}</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无购买记录" />
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
      <el-form ref="profileFormRef" :model="profileForm" :rules="profileFormRules" label-position="top" size="default">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="profileForm.name" placeholder="请输入您的姓名" @input="handleProfileNameInput" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="profileForm.phone" placeholder="请输入手机号码" maxlength="11" disabled />
          <div class="form-tip">手机号不可修改，如需更换请联系客服</div>
        </el-form-item>
        <el-form-item label="身份证号" prop="idCard">
          <el-input v-model="profileForm.idCard" placeholder="请输入身份证号（选填）" maxlength="18" @input="handleProfileIdCardInput" />
          <div class="form-tip">身份证号用于实名认证，选填</div>
        </el-form-item>
        <el-form-item label="Apple ID" prop="appleId">
          <el-input v-model="profileForm.appleId" placeholder="请输入Apple ID（选填）" @input="handleProfileAppleIdInput" />
          <div class="form-tip">Apple ID支持手机号或邮箱，选填</div>
        </el-form-item>
        <el-form-item label="收货地址" prop="address">
          <el-input v-model="profileForm.address" type="textarea" placeholder="请输入详细收货地址" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="flex gap-2">
          <el-button type="default" class="flex-1" @click="profileVisible = false">取消</el-button>
          <el-button type="primary" class="flex-1" @click="saveProfile" :loading="savingProfile">保存</el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { getPublicConfig } from '@/api/shop-public'
import { tokenManager, userManager, getUserSales, logout as authLogout, updateProfile, getUserProfile, type AuthUser } from '@/api/auth'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'
import { normalizeAppleId, normalizeIdCard, normalizePersonName } from '@/utils/security'
import { logger } from '@/utils/logger'
const router = useRouter()
const shopConfig = ref<any>({})
const serviceVisible = ref(false)
const shopVisible = ref(false)
const purchaseVisible = ref(false)
const profileVisible = ref(false)
const loadingPurchase = ref(false)
const savingProfile = ref(false)
const purchaseRecords = ref<any[]>([])

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
const user = computed<AuthUser | null>(() => userManager.getUser())

// 加载配置
const loadConfig = async () => {
  try {
    const response = await getPublicConfig()
    shopConfig.value = (response as any).data || response
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
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await authLogout()
    userManager.clearAuth()

    ElMessage.success('已退出登录')

    // 刷新页面以更新UI状态
    setTimeout(() => {
      window.location.reload()
    }, 500)
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('登出失败:', error)
      ElMessage.error('登出失败')
    }
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
const formatDate = (date: string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN')
}

// 获取支付方式文本
const getPaymentText = (method: string) => {
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
        ElMessage.success('微信号已复制，正在打开微信...')
        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          window.location.href = `weixin://dl/chat?${shopConfig.value.wechat_id}`
        }, 1000)
      }).catch(() => {
        ElMessage.info(`请添加微信号: ${shopConfig.value.wechat_id}`)
      })
    } else {
      ElMessage.info(`请添加微信号: ${shopConfig.value.wechat_id}`)
    }
  }
}

// 联系客服（旧方法，保留用于兼容）
const contactService = () => {
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

  try {
    const response: any = await getUserSales()
    purchaseRecords.value = response || []
  } catch (error: any) {
    logger.error('获取购买记录失败:', error)
    ElMessage.error(error.message || '获取购买记录失败')
  } finally {
    loadingPurchase.value = false
  }
}

// 显示个人资料编辑
const showProfileEdit = async () => {
  if (user.value) {
    try {
      // 从后端API获取完整用户资料
      const profile: any = await getUserProfile()

      profileForm.value = {
        name: normalizePersonName(profile.name || user.value.name || '', 50),
        phone: profile.phone || user.value.phone || '',
        idCard: normalizeIdCard(profile.id_card || ''),
        appleId: normalizeAppleId(profile.apple_id || ''),
        address: profile.address || ''
      }
    } catch (error: any) {
      logger.error('获取用户资料失败:', error)
      // 如果API调用失败，尝试从本地存储读取
      const savedAddress = storage.get<any>(H5_STORAGE_KEYS.DEFAULT_ADDRESS, 'local')
      const addressData = savedAddress || {}

      profileForm.value = {
        name: normalizePersonName(user.value.name || '', 50),
        phone: user.value.phone || '',
        idCard: normalizeIdCard(addressData.idCard || ''),
        appleId: normalizeAppleId(addressData.appleId || ''),
        address: addressData.address || ''
      }
    }
  }
  profileVisible.value = true
}

// 保存个人资料
const saveProfile = async () => {
  if (!profileFormRef.value) return

  try {
    normalizeProfileForm()
    await profileFormRef.value.validate()
    savingProfile.value = true

    // 调用后端 API 更新用户资料
    const response: any = await updateProfile({
      name: profileForm.value.name,
      idCard: profileForm.value.idCard,
      appleId: profileForm.value.appleId,
      address: profileForm.value.address
    })

    // 更新本地用户信息
    if (response) {
      userManager.setUser(response)
    }

    // 同时保存到本地存储作为备份
    storage.set(H5_STORAGE_KEYS.DEFAULT_ADDRESS, {
      name: profileForm.value.name,
      phone: profileForm.value.phone,
      idCard: profileForm.value.idCard,
      appleId: profileForm.value.appleId,
      address: profileForm.value.address
    }, 'local')

    ElMessage.success('个人资料保存成功')
    profileVisible.value = false

    // 刷新页面以更新用户信息
    setTimeout(() => {
      window.location.reload()
    }, 500)
  } catch (error: any) {
    logger.error('保存个人资料失败:', error)
    ElMessage.error(error.message || '保存个人资料失败')
  } finally {
    savingProfile.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.my-center-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

// 未登录状态
.not-logged-in {
  .auth-buttons {
    padding: 0 16px;
  }
}

// 用户卡片
.user-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;

  .user-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    i {
      font-size: 36px;
      opacity: 0.9;
    }
  }

  .user-info {
    flex: 1;

    .user-title {
      font-size: 22px;
      font-weight: 600;
      margin: 0 0 4px;
    }

    .user-desc {
      font-size: 14px;
      opacity: 0.9;
      margin: 0;
    }

    .user-details-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 13px;
      opacity: 0.95;

      .user-name {
        font-weight: 600;
        font-size: 16px;
      }

      .user-phone {
        font-size: 13px;
        opacity: 0.9;
      }

      .member-number {
        font-size: 11px;
        color: #fff;
        background: rgba(255, 255, 255, 0.25);
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
      }
    }
  }

  .logout-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    color: #fff;

    i {
      font-size: 18px;
    }
  }
}

// 区块
.section {
  background: #fff;
  margin: 12px;
  padding: 16px;
  border-radius: 12px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    cursor: pointer;

    .section-title {
      font-size: 16px;
      font-weight: 500;
      color: #333;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        color: #ff6b00;
      }
    }

    .section-more {
      font-size: 13px;
      color: #999;
      display: flex;
      align-items: center;
      gap: 4px;

      i {
        font-size: 12px;
      }
    }
  }

  .section-title {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin: 0 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      color: #ff6b00;
    }
  }
}

// 登录/注册按钮行
.auth-buttons-row {
  display: flex;
  gap: 12px;
  padding: 0 12px 12px;
  margin-top: 12px;

  .auth-btn {
    flex: 1;
    height: 56px;
    border-radius: 12px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: #fff;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

    i {
      font-size: 20px;
    }

    span {
      font-size: 16px;
      font-weight: 500;
    }

    &:active {
      transform: scale(0.98);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &.login-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    &.register-btn {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
  }
}

// 功能网格
.function-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px;
  background: #fff;
  margin: 12px;
  border-radius: 12px;

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 8px;
    cursor: pointer;
    transition: all 0.3s;
    border-radius: 8px;

    &:active {
      background: #f8f8f8;
      transform: scale(0.98);
    }

    .grid-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      i {
        font-size: 24px;
      }
    }

    .grid-label {
      font-size: 13px;
      color: #333;
      text-align: center;
    }
  }
}

// 订单类型
.order-types {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;

  .order-type {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 8px;
    background: #f8f9fa;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;

    &:active {
      background: #e8e8e8;
      transform: scale(0.98);
    }

    i {
      font-size: 24px;
      color: #666;
    }

    span {
      font-size: 12px;
      color: #666;
    }
  }
}

// 功能列表
.function-list {
  .function-item {
    display: flex;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background 0.3s;

    &:last-child {
      border-bottom: none;
    }

    &:active {
      background: #f8f8f8;
    }

    .item-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      margin-right: 12px;
    }

    .item-name {
      flex: 1;
      font-size: 15px;
      color: #333;
    }

    .item-arrow {
      color: #ddd;
      font-size: 14px;
    }
  }
}

// 客服信息（新样式）
.service-info {
  // 一行显示两个选项
  .service-row {
    display: flex;
    gap: 12px;

    .service-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;

      &:active {
        background: #e9ecef;
        transform: scale(0.98);
      }

      .service-icon {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;

        &.phone-icon {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        &.wechat-icon {
          background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
        }

        i {
          font-size: 20px;
        }
      }

      .service-content {
        text-align: center;

        .service-label {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .service-value {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100px;
        }
      }
    }
  }

  // 单个选项居中显示
  .service-single {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;

    &:active {
      background: #e9ecef;
      transform: scale(0.98);
    }

    .info-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;

      &.phone-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.wechat-icon {
        background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
      }

      i {
        font-size: 20px;
      }
    }

    .info-content {
      flex: 1;
      min-width: 0;

      .info-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
      }

      .info-value {
        font-size: 15px;
        font-weight: 500;
        color: #333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .info-arrow {
      color: #ddd;
      font-size: 14px;
      flex-shrink: 0;
    }
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.3s;

    &:last-child {
      margin-bottom: 0;
    }

    &:active {
      background: #e9ecef;
      transform: scale(0.98);
    }

    .info-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;

      &.phone-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.wechat-icon {
        background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
      }

      i {
        font-size: 20px;
      }
    }

    .info-content {
      flex: 1;
      min-width: 0;

      .info-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 4px;
      }

      .info-value {
        font-size: 15px;
        font-weight: 500;
        color: #333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .info-arrow {
      color: #ddd;
      font-size: 14px;
      flex-shrink: 0;
    }
  }

  .no-service {
    text-align: center;
    padding: 32px 16px;
    color: #999;

    i {
      font-size: 40px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    p {
      font-size: 14px;
      margin: 0;
    }
  }
}

// 悬浮客服按钮
.floating-service {
  position: fixed;
  bottom: 100px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  z-index: 1000;
  animation: pulse 2s infinite;

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  .service-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00c853 0%, #00e676 100%);
    box-shadow: 0 4px 16px rgba(0, 200, 83, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;

    i {
      font-size: 24px;
    }
  }

  .service-text {
    font-size: 12px;
    color: #00c853;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 8px;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

// 客服信息（旧样式，保留用于兼容）
.service-info {
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    i {
      color: #409eff;
      margin-right: 8px;
    }

    span {
      font-size: 14px;
      color: #333;
      display: flex;
      align-items: center;
      font-weight: 500;
    }

    .phone-link {
      color: #409eff;
      text-decoration: none;
      font-size: 16px;
    }

    .address-text,
    .hours-text {
      font-size: 14px;
      color: #666;
      line-height: 1.6;
      margin: 0;
    }
  }
}

// 店铺信息
.shop-info {
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }

    .label {
      font-size: 14px;
      color: #666;
    }

    .value {
      font-size: 14px;
      color: #333;
      text-align: right;

      &.phone-value {
        color: #409eff;
      }
    }
  }
}

// 购买记录
.purchase-records {
  max-height: 70vh;
  overflow-y: auto;

  .records-list {
    .record-item {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;

      .record-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .invoice-number {
          font-size: 13px;
          font-weight: 500;
          color: #333;
        }

        .sale-date {
          font-size: 12px;
          color: #999;
        }
      }

      .record-content {
        margin-bottom: 8px;

        .product-name {
          font-size: 15px;
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
        }

        .record-details {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #666;

          .imei {
            color: #999;
          }
        }
      }

      .record-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 8px;
        border-top: 1px solid #e9ecef;

        .price {
          font-size: 18px;
          font-weight: 500;
          color: #ff1744;
        }

        .payment-method {
          font-size: 12px;
          color: #666;
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 4px;
        }
      }
    }
  }
}

// 个人资料表单样式
.form-tip {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>

<style lang="scss">
// 客服弹窗全局样式
.service-dialog-custom {
  .el-dialog__body {
    padding: 16px 20px;
  }
}
</style>
