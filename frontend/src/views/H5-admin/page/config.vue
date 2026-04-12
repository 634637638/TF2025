<!--
  ShopConfig - H5商城配置管理页面（员工端）
  功能：店铺基本信息、联系方式、支付方式配置
-->
<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="h5-admin-config"
    module-name="商城配置"
    permission-code="h5-config:view"
  />

  <div v-else class="shop-config-page">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton animated />
    </div>

    <!-- 配置表单 -->
    <div v-else class="config-content">
      <!-- 基本信息 -->
      <div class="config-section">
        <h3 class="section-title">基本信息</h3>
        <el-form label-width="120px" :disabled="!canEdit">
          <el-form-item label="店铺名称">
            <el-input v-model="configs.shop_name" placeholder="请输入店铺名称" />
          </el-form-item>
          <el-form-item label="店铺副标题">
            <el-input v-model="configs.shop_subtitle" placeholder="请输入店铺副标题" />
          </el-form-item>
          <el-form-item label="店铺Logo">
            <div class="image-upload-wrapper">
              <el-upload
                :action="uploadAction"
                :headers="uploadHeaders"
                :show-file-list="false"
                :on-success="(res) => handleUploadSuccess(res, 'shop_logo')"
                :before-upload="beforeUpload"
                :disabled="!canEdit"
                name="files"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                list-type="picture-card"
              >
                <img v-if="configs.shop_logo" :src="getImagePreviewUrl(configs.shop_logo)" class="uploaded-image" />
                <i v-else class="fas fa-plus"></i>
              </el-upload>
              <el-button
                v-if="configs.shop_logo && canEdit"
                plain
                type="danger"
                size="small"
                @click="handleDeleteImage('shop_logo')"
                class="delete-image-btn btn-sm"
              >
                <i class="fas fa-trash mr-1"></i>删除
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <!-- 联系方式 -->
      <div class="config-section">
        <h3 class="section-title">联系方式</h3>
        <el-form label-width="120px" :disabled="!canEdit">
          <el-form-item label="联系电话">
            <el-input v-model="configs.shop_phone" placeholder="请输入联系电话" />
          </el-form-item>
          <el-form-item label="微信号">
            <el-input v-model="configs.wechat_id" placeholder="请输入微信号" />
            <template #tip>
              <span class="tip-text">用户点击后将自动跳转到微信添加好友</span>
            </template>
          </el-form-item>
          <el-form-item label="店铺地址">
            <el-input v-model="configs.shop_address" type="textarea" :rows="2" placeholder="请输入店铺地址" />
          </el-form-item>
          <el-form-item label="地图位置">
            <div class="flex gap-2 items-start">
              <div class="flex-1">
                <el-input v-model="configs.map_latitude" placeholder="纬度 (如: 22.5431)" class="mb-2" />
                <el-input v-model="configs.map_longitude" placeholder="经度 (如: 114.0579)" />
              </div>
              <el-button plain type="primary" :disabled="!canEdit" @click="openMapPicker" class="btn-sm">选择位置</el-button>
            </div>
            <template #tip>
              <span class="tip-text">在地图上选择店铺位置，前台点击地图图标可查看</span>
            </template>
          </el-form-item>
          <el-form-item label="营业时间">
            <el-input v-model="configs.shop_hours" placeholder="如：09:00-21:00" />
          </el-form-item>
        </el-form>
      </div>

      <!-- 支付方式 -->
      <div class="config-section">
        <h3 class="section-title">支付方式</h3>
        <el-form label-width="120px" :disabled="!canEdit">
          <el-form-item label="微信收款码">
            <div class="image-upload-wrapper">
              <el-upload
                :action="uploadAction"
                :headers="uploadHeaders"
                :show-file-list="false"
                :on-success="(res) => handleUploadSuccess(res, 'wechat_qrcode')"
                :before-upload="beforeUpload"
                :disabled="!canEdit"
                name="files"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                list-type="picture-card"
              >
                <img v-if="configs.wechat_qrcode" :src="getImagePreviewUrl(configs.wechat_qrcode)" class="uploaded-image" />
                <i v-else class="fas fa-plus"></i>
              </el-upload>
              <el-button
                v-if="configs.wechat_qrcode && canEdit"
                plain
                type="danger"
                size="small"
                @click="handleDeleteImage('wechat_qrcode')"
                class="delete-image-btn btn-sm"
              >
                <i class="fas fa-trash mr-1"></i>删除
              </el-button>
            </div>
            <template #tip>
              <span class="tip-text">用户支付时将显示此二维码</span>
            </template>
          </el-form-item>
          <el-form-item label="支付宝收款码">
            <div class="image-upload-wrapper">
              <el-upload
                :action="uploadAction"
                :headers="uploadHeaders"
                :show-file-list="false"
                :on-success="(res) => handleUploadSuccess(res, 'alipay_qrcode')"
                :before-upload="beforeUpload"
                :disabled="!canEdit"
                name="files"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                list-type="picture-card"
              >
                <img v-if="configs.alipay_qrcode" :src="getImagePreviewUrl(configs.alipay_qrcode)" class="uploaded-image" />
                <i v-else class="fas fa-plus"></i>
              </el-upload>
              <el-button
                v-if="configs.alipay_qrcode && canEdit"
                plain
                type="danger"
                size="small"
                @click="handleDeleteImage('alipay_qrcode')"
                class="delete-image-btn btn-sm"
              >
                <i class="fas fa-trash mr-1"></i>删除
              </el-button>
            </div>
            <template #tip>
              <span class="tip-text">用户支付时将显示此二维码</span>
            </template>
          </el-form-item>
          <el-form-item label="银行转账信息">
            <el-input
              v-model="configs.bank_info"
              type="textarea"
              :rows="3"
              placeholder="请输入银行账号、开户行等信息"
            />
            <template #tip>
              <span class="tip-text">支持换行，将原样显示给用户</span>
            </template>
          </el-form-item>
        </el-form>
      </div>

      <!-- 功能开关 -->
      <div class="config-section">
        <h3 class="section-title">功能设置</h3>
        <el-form label-width="120px" :disabled="!canEdit">
          <el-form-item label="启用轮播图">
            <el-switch v-model="configs.banner_enabled" />
            <template #tip>
              <span class="tip-text">关闭后首页将不显示轮播图</span>
            </template>
          </el-form-item>
          <el-form-item label="启用购物车">
            <el-switch v-model="configs.cart_enabled" />
            <template #tip>
              <span class="tip-text">关闭后用户只能直接购买，无法使用购物车</span>
            </template>
          </el-form-item>
          <el-form-item label="启用直接购买">
            <el-switch v-model="configs.direct_buy_enabled" />
            <template #tip>
              <span class="tip-text">关闭后用户只能通过购物车下单</span>
            </template>
          </el-form-item>
        </el-form>
      </div>

      <!-- 保存按钮 -->
      <div class="actions">
        <el-button v-if="canEdit" :loading="saving" plain type="primary" size="default" @click="handleSave" class="btn-sm">
          <i class="fas fa-save mr-1"></i>保存
        </el-button>
      </div>
    </div>

    <!-- 地图选择对话框 -->
    <MobileDialog
      v-model="showMapDialog"
      title="选择地图位置"
      width="900px"
      :close-on-click-modal="false"
      dialog-class="shop-config-map-dialog"
      :show-default-footer="false"
    >
      <div class="map-picker-container">
        <div class="map-instructions">
          <h4>操作说明：</h4>
          <ul>
            <li>🖱️ 在地图上点击选择店铺位置</li>
            <li>📍 拖动红色标记可以微调位置</li>
            <li>🔍 滚轮可以缩放地图</li>
            <li>✅ 选择好后点击"确定"保存</li>
          </ul>
          <div class="current-location">
            <strong>当前选中位置：</strong>
            <span v-if="selectedLocation.lat">
              纬度: {{ selectedLocation.lat }}, 经度: {{ selectedLocation.lng }}
            </span>
            <span v-else>请点击地图选择位置</span>
          </div>
        </div>
        <div id="map-container" class="map-frame"></div>
      </div>
      <template #footer>
        <el-button @click="cancelMapLocation" class="btn-sm">取消</el-button>
        <el-button v-if="canEdit" plain type="primary" @click="confirmMapLocation" class="btn-sm">确定</el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, inject, onUnmounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Check } from '@element-plus/icons-vue'
import { getAllConfigs, batchUpdateConfigs } from '@/api/shop'
import { PermissionDenied } from '@/components/base/index'
import { useAuthStore } from '@/stores/auth'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { formatImageUrl } from '@/utils/format'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import { logger } from '@/utils/logger'
import type { HeaderAction } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const { canView, canEdit, handleNoPermission } = usePagePermissions('h5-admin-config')

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

const ensureEditPermission = () => {
  if (canEdit.value) {
    return true
  }
  handleNoPermission('edit')
  return false
}

// 刷新配置
const handleRefresh = async () => {
  await cleanupTempImages()
  await loadConfigs()
}

// 配置数据
const configs = ref<any>({
  shop_name: '',
  shop_logo: '',
  shop_subtitle: '',
  shop_phone: '',
  wechat_id: '',
  shop_address: '',
  shop_hours: '',
  map_latitude: '',
  map_longitude: '',
  wechat_qrcode: '',
  alipay_qrcode: '',
  bank_info: '',
  banner_enabled: true,
  cart_enabled: true,
  direct_buy_enabled: true
})
const loading = ref(true)
const saving = ref(false)
const showMapDialog = ref(false)
const IMAGE_FIELDS = ['shop_logo', 'wechat_qrcode', 'alipay_qrcode'] as const
type ImageField = typeof IMAGE_FIELDS[number]
const originalImageConfigs = ref<Record<ImageField, string>>({
  shop_logo: '',
  wechat_qrcode: '',
  alipay_qrcode: ''
})
const uploadedTempImages = ref<string[]>([])

// 上传配置
const uploadAction = computed(() => `${import.meta.env.VITE_API_BASE_URL || '/api'}/shop/upload/image`)
const uploadHeaders = computed(() => ({
  'Authorization': `Bearer ${authStore.token}`
}))

const getImagePreviewUrl = (url: string) => formatImageUrl(url)

const isTempImage = (url: string) => uploadedTempImages.value.includes(url)

const trackTempImage = (url: string) => {
  if (!url || uploadedTempImages.value.includes(url)) {
    return
  }
  uploadedTempImages.value.push(url)
}

const untrackTempImage = (url: string) => {
  uploadedTempImages.value = uploadedTempImages.value.filter(item => item !== url)
}

const cleanupTempImages = async (files: string[] = uploadedTempImages.value) => {
  const targets = files.filter(Boolean)
  if (targets.length === 0) {
    return true
  }

  const success = await deleteTempFiles(targets)
  if (success) {
    targets.forEach((file) => untrackTempImage(file))
  }
  return success
}

const deleteSavedImage = async (imageUrl: string) => {
  if (!imageUrl) {
    return
  }

  await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/shop/delete-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authStore.token}`
    },
    body: JSON.stringify({ image_url: imageUrl })
  })
}

const syncOriginalImageConfigs = () => {
  originalImageConfigs.value = {
    shop_logo: configs.value.shop_logo || '',
    wechat_qrcode: configs.value.wechat_qrcode || '',
    alipay_qrcode: configs.value.alipay_qrcode || ''
  }
}

// 上传成功回调
const handleUploadSuccess = async (response: any, field: string) => {
  if (!ensureEditPermission()) {
    return
  }

  // el-upload 使用 raw axios，响应格式与 unified-api 不同
  // 成功时直接返回文件信息，或通过 response.data 包装
  const fileUrl = response.data?.files?.[0]?.url || response.data?.url || response.url

  if (fileUrl) {
    const imageField = field as ImageField
    const previousImageUrl = configs.value[imageField]

    if (previousImageUrl && previousImageUrl !== fileUrl && isTempImage(previousImageUrl)) {
      await cleanupTempImages([previousImageUrl])
    }

    configs.value[imageField] = fileUrl

    if (fileUrl !== originalImageConfigs.value[imageField]) {
      trackTempImage(fileUrl)
    }

    ElMessage.success('上传成功，请点击保存生效')
  } else {
    ElMessage.error('上传失败：响应格式错误')
  }
}

// 上传前验证
const beforeUpload = (file: File) => {
  if (!ensureEditPermission()) {
    return false
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  const isImage = allowedTypes.includes(file.type)
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    logger.error('[beforeUpload] 不支持的文件类型:', file.type)
    ElMessage.error(`只支持上传图片文件（jpeg, png, gif, webp），当前文件类型: ${file.type}`)
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }

  return true
}

// 删除图片
const handleDeleteImage = async (field: string) => {
  if (!ensureEditPermission()) {
    return
  }

  const imageField = field as ImageField
  const currentImageUrl = configs.value[imageField]
  if (!currentImageUrl) return

  try {
    if (isTempImage(currentImageUrl)) {
      await cleanupTempImages([currentImageUrl])
      ElMessage.success('临时图片已删除')
    } else {
      ElMessage.success('已移除图片，请点击保存生效')
    }

    configs.value[imageField] = ''
  } catch (error) {
    logger.error('删除图片失败:', error)
    configs.value[imageField] = ''
    ElMessage.warning('图片预览已移除，请保存后确认')
  }
}

// 加载配置
const loadConfigs = async () => {
  if (!canView.value) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    const response = await getAllConfigs()
    // unifiedApi 返回 ApiResponse 格式，需要取 data
    const data = response.data || response

    // 将嵌套的配置转换为平铺的键值对
    configs.value = {}
    const booleanFields = ['banner_enabled', 'cart_enabled', 'direct_buy_enabled']
    Object.keys(data).forEach(category => {
      const categoryData = data[category]
      // 确保是数组才进行 forEach
      if (Array.isArray(categoryData)) {
        categoryData.forEach((item: any) => {
          // 布尔类型字段转换为布尔值
          if (booleanFields.includes(item.key)) {
            configs.value[item.key] = Boolean(item.value)
          } else {
            configs.value[item.key] = item.value
          }
        })
      }
    })
    syncOriginalImageConfigs()
    uploadedTempImages.value = []
  } catch (error) {
    logger.error('获取配置失败:', error)
    ElMessage.error('获取配置失败')
  } finally {
    loading.value = false
  }
}

// 保存配置
const handleSave = async () => {
  if (!ensureEditPermission()) {
    return
  }

  saving.value = true
  try {
    const deletedSavedImages = IMAGE_FIELDS
      .map((field) => ({
        oldUrl: originalImageConfigs.value[field],
        newUrl: configs.value[field] || ''
      }))
      .filter(({ oldUrl, newUrl }) => Boolean(oldUrl) && oldUrl !== newUrl)

    // 转换为更新格式
    const configArray = Object.entries(configs.value).map(([key, value]) => ({
      key,
      value: String(value)
    }))

    await batchUpdateConfigs(configArray)

    for (const { oldUrl } of deletedSavedImages) {
      try {
        await deleteSavedImage(oldUrl)
      } catch (error) {
        logger.warn('删除旧图片失败:', oldUrl, error)
      }
    }

    syncOriginalImageConfigs()
    uploadedTempImages.value = []
    ElMessage.success('配置保存成功')
  } catch (error: any) {
    logger.error('保存配置失败:', error)
    ElMessage.error(error.message || '保存配置失败')
  } finally {
    saving.value = false
  }
}

// 地图选择相关
const selectedLocation = ref({ lat: '', lng: '' })
let map: any = null
let marker: any = null

const loadTencentMapScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).TMap) {
      resolve()
      return
    }
    // 腾讯地图 API Key
    const script = document.createElement('script')
    script.src = 'https://map.qq.com/api/gljs?v=1.exp&key=BUTBZ-J4UC6-ZUNSH-MJCJJ-L2ZY6-CZBFG'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('地图加载失败'))
    document.head.appendChild(script)
  })
}

const openMapPicker = async () => {
  if (!ensureEditPermission()) {
    return
  }

  showMapDialog.value = true

  // 如果已有坐标，设置当前选中位置
  if (configs.value.map_latitude && configs.value.map_longitude) {
    selectedLocation.value = {
      lat: configs.value.map_latitude,
      lng: configs.value.map_longitude
    }
  } else {
    // 默认位置（深圳市福田区华强北）
    selectedLocation.value = { lat: '22.5431', lng: '114.0579' }
  }

  // 先加载地图脚本，然后等待对话框渲染完成后初始化地图
  try {
    await loadTencentMapScript()
    await nextTick()
    setTimeout(() => {
      initMap()
    }, 300) // 额外延迟确保 DOM 完全渲染
  } catch (error) {
    logger.error('地图脚本加载失败:', error)
    ElMessage.error('地图加载失败，请检查网络连接')
  }
}

const initMap = () => {
  const container = document.getElementById('map-container')
  if (!container) return

  // 检查 TMap 是否已加载
  if (!(window as any).TMap) {
    container.innerHTML = '<div class="map-loading-container">地图加载中...</div>'
    loadTencentMapScript().then(() => {
      initMap()
    }).catch(() => {
      container.innerHTML = '<div class="map-error-container"><i class="fas fa-exclamation-circle"></i><div>地图加载失败</div><div class="map-error-tip">请检查网络或稍后重试</div></div>'
    })
    return
  }

  const lat = parseFloat(selectedLocation.value.lat)
  const lng = parseFloat(selectedLocation.value.lng)

  try {
    // 创建地图实例
    map = new (window as any).TMap.Map(container, {
      center: new (window as any).TMap.LatLng(lat, lng),
      zoom: 15,
      viewMode: '2D'
    })

    // 创建标记
    marker = new (window as any).TMap.MultiMarker({
      map: map,
      styles: {
        'marker': new (window as any).TMap.MarkerStyle({
          width: 25,
          height: 35,
          anchor: { x: 12, y: 35 }
        })
      },
      geometries: [{
        id: 'marker',
        styleId: 'marker',
        position: new (window as any).TMap.LatLng(lat, lng),
        properties: { title: '店铺位置' }
      }]
    })

    // 监听地图点击事件
    map.on('click', (evt: any) => {
      const latLng = evt.latLng
      selectedLocation.value = {
        lat: latLng.lat.toFixed(6),
        lng: latLng.lng.toFixed(6)
      }

      // 更新标记位置
      marker.setGeometries([{
        id: 'marker',
        styleId: 'marker',
        position: new (window as any).TMap.LatLng(latLng.lat, latLng.lng),
        properties: { title: '店铺位置' }
      }])
    })
  } catch (error) {
    logger.error('地图初始化失败:', error)
    container.innerHTML = '<div class="map-error-container"><i class="fas fa-exclamation-circle"></i><div>地图初始化失败</div><div class="map-error-tip">请检查API Key配置</div></div>'
  }
}

const handleMapLocationSelect = (location: any) => {
  selectedLocation.value = location
}

const confirmMapLocation = () => {
  if (!ensureEditPermission()) {
    return
  }

  configs.value.map_latitude = selectedLocation.value.lat
  configs.value.map_longitude = selectedLocation.value.lng
  showMapDialog.value = false
  ElMessage.success('地图位置已设置')
}

const cancelMapLocation = () => {
  showMapDialog.value = false
}

onMounted(() => {
  if (canView.value) {
    loadConfigs()
  }
  // 注册头部操作按钮
  if (registerHeaderActions) {
    registerHeaderActions([
      ...(canEdit.value ? [{
        label: '保存',
        type: 'primary' as const,
        icon: Check,
        loading: () => saving.value,
        handler: handleSave
      }] : []),
      {
        label: '刷新',
        type: 'default',
        icon: Refresh,
        disabled: () => loading.value,
        handler: handleRefresh
      }
    ])
  }
})

// 路由守卫：页面离开时清理临时文件
onBeforeRouteLeave(async () => {
  await cleanupTempImages()
  return true
})

onUnmounted(() => {
  void cleanupTempImages()
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped lang="scss">
.shop-config-page {
  padding: 24px;
}

// 加载状态
.loading-state {
  padding: 40px;
}

// 配置内容
.config-content {
  max-width: 800px;
  margin: 0 auto;
}

// 配置区块
.config-section {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

  .section-title {
    font-size: 18px;
    font-weight: 500;
    color: #333;
    margin: 0 0 20px;
    padding-left: 12px;
    border-left: 3px solid #ff6b00;
  }

  :deep(.el-form-item__tip) {
    .tip-text {
      font-size: 12px;
      color: #999;
    }
  }

  // 上传图片样式
  .image-upload-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;

    :deep(.el-upload) {
      width: 100px;
      height: 100px;
      line-height: 100px;

      .uploaded-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      i {
        font-size: 28px;
        color: #8c939d;
      }
    }

    .delete-image-btn {
      flex-shrink: 0;
    }
  }

  :deep(.el-upload) {
    width: 100px;
    height: 100px;
    line-height: 100px;

    .uploaded-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    i {
      font-size: 28px;
      color: #8c939d;
    }
  }
}

// 操作按钮
.actions {
  display: flex;
  justify-content: center;
  padding: 32px 0;

  .el-button {
    width: 200px;
  }
}

// 地图选择器样式
.map-picker-container {
  .map-instructions {
    margin-bottom: 16px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 8px;

    h4 {
      margin: 0 0 12px;
      font-size: 14px;
      color: #333;
    }

    ul {
      margin: 0 0 12px;
      padding-left: 20px;

      li {
        margin-bottom: 4px;
        font-size: 13px;
        color: #666;
      }
    }

    .current-location {
      padding: 8px 12px;
      background: #fff;
      border-radius: 4px;
      font-size: 13px;
      color: #333;

      strong {
        color: #ff6b00;
      }
    }
  }

  .map-frame {
    height: 400px;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .shop-config-page {
    padding: 16px;
  }

  .config-content {
    max-width: 100%;
  }

  .config-section {
    padding: 16px;
    margin-bottom: 12px;

    .section-title {
      font-size: 16px;
      margin-bottom: 16px;
    }

    // 移动端表单调整
    :deep(.el-form) {
      .el-form-item {
        margin-bottom: 16px;

        .el-form-item__label {
          width: 100% !important;
          text-align: left;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .el-form-item__content {
          margin-left: 0 !important;
        }
      }
    }
  }

  .actions {
    padding: 24px 0;

    .el-button {
      width: 100%;
      max-width: 300px;
    }
  }
}
</style>
