<template>
  <div class="screen-lock-settings">
    <div class="settings-card">
      <div class="card-header">
        <h3>
          <i class="fas fa-lock"></i>
          系统设置
        </h3>
        <p class="card-description">配置屏幕锁定和在库查询功能的相关设置</p>
      </div>

      <div class="card-content">
        <!-- TAB 切换 -->
        <el-tabs v-model="activeTab" class="settings-tabs">
          <!-- 屏幕保护设置 TAB -->
          <el-tab-pane label="屏幕保护" name="screen-lock">
            <el-form
              ref="screenLockFormRef"
              :model="screenLockForm"
              :rules="screenLockRules"
              label-width="120px"
              label-position="left"
            >
              <!-- 说明信息 -->
              <el-alert
                title="屏幕保护功能说明"
                type="info"
                show-icon
                :closable="false"
                style="margin-bottom: 20px;"
              >
                <p>• 点击顶部操作栏的"锁定"按钮即可锁定屏幕</p>
                <p>• 解锁时需要输入您当前的登录密码</p>
                <p>• 下方设置用于自定义锁屏背景和提示信息</p>
              </el-alert>

              <!-- 背景类型 -->
              <el-form-item label="背景类型">
                <el-radio-group v-model="screenLockForm.backgroundType">
                  <el-radio value="default">默认背景</el-radio>
                  <el-radio value="image">图片背景</el-radio>
                  <el-radio value="video">视频背景</el-radio>
                </el-radio-group>
              </el-form-item>

              <!-- 图片背景 -->
              <el-form-item
                v-if="screenLockForm.backgroundType === 'image'"
                label="背景图片"
              >
                <div class="image-upload-container">
                  <el-upload
                    class="image-uploader"
                    :action="uploadUrl"
                    :headers="uploadHeaders"
                    :show-file-list="false"
                    :before-upload="beforeImageUpload"
                    :on-success="handleImageSuccess"
                    :on-error="handleUploadError"
                    accept="image/*"
                    name="file"
                  >
                    <div v-if="screenLockForm.imageUrl" class="image-preview">
                      <Image :src="screenLockForm.imageUrl" alt="背景图片" mode="eager" />
                      <div class="image-overlay">
                        <i class="fas fa-camera"></i>
                        <span>更换图片</span>
                      </div>
                    </div>
                    <div v-else class="upload-placeholder">
                      <i class="fas fa-cloud-upload-alt"></i>
                      <span>点击上传图片</span>
                    </div>
                  </el-upload>

                  <el-input
                    v-model="screenLockForm.imageUrl"
                    placeholder="或输入图片URL"
                    clearable
                    class="url-input"
                  />
                </div>
                <div class="form-help">
                  支持 JPG、PNG 格式，建议尺寸 1920x1080，文件大小不超过 5MB
                </div>
              </el-form-item>

              <!-- 视频背景 -->
              <el-form-item
                v-if="screenLockForm.backgroundType === 'video'"
                label="背景视频"
              >
                <div class="video-upload-container">
                  <el-upload
                    class="video-uploader"
                    :action="uploadUrl"
                    :headers="uploadHeaders"
                    :show-file-list="false"
                    :before-upload="beforeVideoUpload"
                    :on-success="handleVideoSuccess"
                    :on-error="handleUploadError"
                    accept="video/*"
                    name="file"
                  >
                    <div v-if="screenLockForm.videoUrl" class="video-preview">
                      <video :src="formatImageUrl(screenLockForm.videoUrl)" muted loop></video>
                      <div class="video-overlay">
                        <i class="fas fa-video"></i>
                        <span>更换视频</span>
                      </div>
                    </div>
                    <div v-else class="upload-placeholder">
                      <i class="fas fa-cloud-upload-alt"></i>
                      <span>点击上传视频</span>
                    </div>
                  </el-upload>

                  <el-input
                    v-model="screenLockForm.videoUrl"
                    placeholder="或输入视频URL"
                    clearable
                    class="url-input"
                  />
                </div>
                <div class="form-help">
                  支持 MP4、WebM 格式，建议时长 10-30 秒，文件大小不超过 50MB
                </div>
              </el-form-item>

              <!-- 锁定信息 -->
              <el-form-item label="锁定标题">
                <el-input
                  v-model="screenLockForm.title"
                  placeholder="屏幕已锁定"
                  maxlength="30"
                  show-word-limit
                />
              </el-form-item>

              <el-form-item label="锁定提示">
                <el-input
                  v-model="screenLockForm.message"
                  type="textarea"
                  :rows="2"
                  placeholder="请输入密码解锁"
                  maxlength="100"
                  show-word-limit
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 在库查询设置 TAB -->
          <el-tab-pane label="在库查询" name="inventory-query">
            <el-form
              ref="inventoryQueryFormRef"
              :model="inventoryQueryForm"
              label-width="140px"
              label-position="left"
            >
              <!-- 说明信息 -->
              <el-alert
                title="在库查询功能说明"
                type="info"
                show-icon
                :closable="false"
                style="margin-bottom: 20px;"
              >
                <p>• 在价格查询页面输入密码后，双击型号可查看在库最久信息</p>
                <p>• 同行咨询时可以快速知道某个型号在哪个店铺在库最久</p>
                <p>• 可以设置独立密码，不设置则使用登录密码验证</p>
              </el-alert>

              <!-- 密码设置 -->
              <el-form-item label="查询验证密码">
                <el-input
                  v-model="inventoryQueryForm.password"
                  type="text"
                  placeholder="留空则使用登录密码验证"
                  clearable
                  style="width: 300px;"
                />
                <div class="form-help">
                  设置独立密码后，在价格查询页面输入此密码后双击型号可查看在库最久信息
                  <br>留空则使用当前用户的登录密码进行验证
                  <br><strong>注意：此密码将以明文存储，请使用简单易记的密码</strong>
                </div>
              </el-form-item>

                  <!-- 功能预览 -->
                  <el-form-item label="功能预览">
                    <div class="preview-box">
                      <div class="preview-header">
                        <i class="fas fa-search"></i>
                        <span>在库查询</span>
                      </div>
                      <div class="preview-content">
                        <div class="preview-row">
                          <span class="label">操作：</span>
                          <span class="value">输入密码 → 双击型号</span>
                        </div>
                        <div class="preview-row">
                          <span class="label">显示：</span>
                          <span class="value">店铺、IMEI、在库天数</span>
                        </div>
                        <div class="preview-row highlight">
                          <span class="label">优先：</span>
                          <span class="value">在库最久的商品</span>
                        </div>
                      </div>
                    </div>
                  </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </div>

      <div class="card-footer">
        <div class="footer-actions">
          <el-button @click="resetForm">重置</el-button>
          <el-button
            type="primary"
            @click="saveSettings"
            :loading="saving"
            :disabled="!hasChanges"
          >
            <i :class="saving ? 'fas fa-spinner fa-spin' : 'fas fa-save'"></i>
            {{ saving ? '保存中...' : '保存设置' }}
          </el-button>
        </div>
        <div v-if="lastSavedTime" class="last-saved">
          <i class="fas fa-check-circle"></i>
          最后保存：{{ lastSavedTime }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, UploadProps } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'
import { formatImageUrl } from '@/utils/format'
import Image from './Image.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { storage } from '@/services/storage'
import { SECURITY_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'

// 接口定义
interface ScreenLockSettings {
  backgroundType: 'default' | 'image' | 'video'
  imageUrl?: string
  videoUrl?: string
  title?: string
  message?: string
  inventoryQueryPassword?: string | null
}

interface UploadResponse {
  success: boolean
  data?: {
    url?: string
  }
}

interface ApiLikeError {
  message?: string
  response?: {
    status?: number
  }
}

const isApiLikeError = (value: unknown): value is ApiLikeError => {
  return Boolean(value && typeof value === 'object')
}

// Props
interface Props {
  modelValue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false
})

interface Emits {
  'update:modelValue': [value: boolean]
  'change': [settings: ScreenLockSettings]
}

const emit = defineEmits<Emits>()

// 响应式数据
const screenLockFormRef = ref<FormInstance>()
const saving = ref(false)
const lastSavedTime = ref('')
const activeTab = ref('screen-lock')

// 屏幕保护表单数据
const screenLockForm = reactive({
  backgroundType: 'default' as 'default' | 'image' | 'video',
  imageUrl: '',
  videoUrl: '',
  title: '屏幕已锁定',
  message: '请输入密码解锁'
})

// 在库查询表单数据
const inventoryQueryForm = reactive({
  password: '' as string
})

// 原始数据备份
const originalData = ref<ScreenLockSettings>({ ...screenLockForm, inventoryQueryPassword: null })

// 认证信息
const authStore = useAuthStore()

// 计算属性
const uploadUrl = computed(() => '/api/screen-lock/upload/screen-lock')
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${authStore.token}`
}))

const hasChanges = computed(() => {
  const currentData = {
    ...screenLockForm,
    inventoryQueryPassword: inventoryQueryForm.password || null
  }
  return JSON.stringify(currentData) !== JSON.stringify(originalData.value)
})

// 表单验证规则
const screenLockRules = {
  title: [
    { max: 30, message: '标题长度不能超过 30 个字符', trigger: 'blur' }
  ],
  message: [
    { max: 100, message: '提示信息长度不能超过 100 个字符', trigger: 'blur' }
  ]
}

// 方法
const loadSettings = async () => {
  try {
    const response = await unifiedApi.get('/screen-lock')
    if (response.success && response.data) {
      Object.assign(screenLockForm, {
        backgroundType: response.data.backgroundType || 'default',
        imageUrl: response.data.imageUrl || '',
        videoUrl: response.data.videoUrl || '',
        title: response.data.title || '屏幕已锁定',
        message: response.data.message || '请输入密码解锁'
      })
      inventoryQueryForm.password = response.data.inventoryQueryPassword || ''
      originalData.value = {
        ...screenLockForm,
        inventoryQueryPassword: response.data.inventoryQueryPassword || null
      }
    }
  } catch (error: unknown) {
    logger.error('加载屏幕锁定设置失败:', error)

    // 后端失败时，尝试从 localStorage 加载
    if ((isApiLikeError(error) && error.response?.status === 404) || (isApiLikeError(error) && error.message?.includes('404'))) {
      try {
        const localSettings = storage.getScreenLockSettings<ScreenLockSettings>()
        if (localSettings) {
          Object.assign(screenLockForm, {
            backgroundType: localSettings.backgroundType || 'default',
            imageUrl: localSettings.imageUrl || '',
            videoUrl: localSettings.videoUrl || '',
            title: localSettings.title || '屏幕已锁定',
            message: localSettings.message || '请输入密码解锁'
          })
          inventoryQueryForm.password = localSettings.inventoryQueryPassword || ''
          originalData.value = {
            ...screenLockForm,
            inventoryQueryPassword: localSettings.inventoryQueryPassword || null
          }
        }
      } catch (localError) {
        logger.error('从 localStorage 加载失败:', localError)
      }
    }
  }
}

const saveSettings = async () => {
  saving.value = true

  try {
    const data = {
      ...screenLockForm,
      inventoryQueryPassword: inventoryQueryForm.password || null
    }

    // 先保存到 localStorage（作为本地缓存，解决后端404问题）
    storage.setScreenLockSettings(data)

    const response = await unifiedApi.post('/screen-lock', data)

    if (response.success) {
      originalData.value = {
        ...screenLockForm,
        inventoryQueryPassword: inventoryQueryForm.password || null
      }
      lastSavedTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
      ElMessage.success('设置保存成功')
      emit('change', data)
    } else {
      throw new Error(response.message || '保存失败')
    }
  } catch (error: unknown) {
    logger.error('保存屏幕锁定设置失败:', error)

    // 如果后端失败（404），但 localStorage 已保存，也视为成功
    if ((isApiLikeError(error) && error.message?.includes('404')) || (isApiLikeError(error) && error.response?.status === 404)) {
      originalData.value = {
        ...screenLockForm,
        inventoryQueryPassword: inventoryQueryForm.password || null
      }
      lastSavedTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
      ElMessage.warning('设置已保存到本地（后端未连接）')
      emit('change', {
        ...screenLockForm,
        inventoryQueryPassword: inventoryQueryForm.password || null
      })
    } else {
      ElMessage.error(`保存失败：${(isApiLikeError(error) && error.message) || '未知错误'}`)
    }
  } finally {
    saving.value = false
  }
}

const resetForm = async () => {
  try {
    await ElMessageBox.confirm('确定要重置所有设置吗？', '确认重置', {
      type: 'warning'
    })

    Object.assign(screenLockForm, {
      backgroundType: originalData.value.backgroundType || 'default',
      imageUrl: originalData.value.imageUrl || '',
      videoUrl: originalData.value.videoUrl || '',
      title: originalData.value.title || '屏幕已锁定',
      message: originalData.value.message || '请输入密码解锁'
    })
    inventoryQueryForm.password = originalData.value.inventoryQueryPassword || ''
    screenLockFormRef.value?.clearValidate()
    ElMessage.success('已重置为上次保存的设置')
  } catch {
    // 用户取消
  }
}

// 文件上传相关方法
const beforeImageUpload: UploadProps['beforeUpload'] = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('只能上传图片文件！')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB！')
    return false
  }
  return true
}

const beforeVideoUpload: UploadProps['beforeUpload'] = (file) => {
  const isVideo = file.type.startsWith('video/')
  const isLt50M = file.size / 1024 / 1024 < 50

  if (!isVideo) {
    ElMessage.error('只能上传视频文件！')
    return false
  }
  if (!isLt50M) {
    ElMessage.error('视频大小不能超过 50MB！')
    return false
  }
  return true
}

const handleImageSuccess = (response: UploadResponse) => {
  if (response.success && response.data?.url) {
    screenLockForm.imageUrl = response.data.url
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error('图片上传失败')
  }
}

const handleVideoSuccess = (response: UploadResponse) => {
  if (response.success && response.data?.url) {
    screenLockForm.videoUrl = response.data.url
    ElMessage.success('视频上传成功')
  } else {
    ElMessage.error('视频上传失败')
  }
}

const handleUploadError = (error: unknown) => {
  logger.error('文件上传失败:', error)
  ElMessage.error('文件上传失败')
}

// 监听变化
watch([screenLockForm, inventoryQueryForm], () => {
  emit('update:modelValue', hasChanges.value)
}, { deep: true })

// 生命周期
onMounted(() => {
  loadSettings()
})
</script>

<style lang="scss" scoped>
.screen-lock-settings {
  .settings-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .card-header {
    padding: 24px;
    border-bottom: 1px solid #ebeef5;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);

    h3 {
      margin: 0 0 8px 0;
      color: #2c3e50;
      font-size: 20px;
      display: flex;
      align-items: center;
      gap: 12px;

      i {
        color: #667eea;
      }
    }

    .card-description {
      margin: 0;
      color: #7f8c8d;
      font-size: 14px;
    }
  }

  .card-content {
    padding: 24px;
  }

  .settings-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 24px;
    }

    :deep(.el-tabs__item) {
      font-size: 15px;
      padding: 0 24px;
    }

    :deep(.el-tabs__active-bar) {
      background-color: #667eea;
    }

    :deep(.el-tabs__item.is-active) {
      color: #667eea;
    }
  }

  .form-help {
    margin-top: 8px;
    font-size: 12px;
    color: #909399;
    line-height: 1.6;
  }

  .image-upload-container,
  .video-upload-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .image-uploader,
  .video-uploader {
    :deep(.el-upload) {
      border: 2px dashed #d9d9d9;
      border-radius: 8px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 0.3s;

      &:hover {
        border-color: #667eea;
      }
    }
  }

  .image-preview,
  .video-preview {
    width: 200px;
    height: 120px;
    position: relative;
    overflow: hidden;
    border-radius: 8px;

    img,
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .image-overlay,
  .video-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    opacity: 0;
    transition: opacity 0.3s;

    i {
      font-size: 24px;
      margin-bottom: 8px;
    }

    span {
      font-size: 14px;
    }
  }

  .image-preview:hover .image-overlay,
  .video-preview:hover .video-overlay {
    opacity: 1;
  }

  .upload-placeholder {
    width: 200px;
    height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #8c939d;
    background: #fafafa;

    i {
      font-size: 32px;
      margin-bottom: 8px;
    }

    span {
      font-size: 14px;
    }
  }

  .unit {
    margin-left: 8px;
    color: #606266;
  }

  .card-footer {
    padding: 16px 24px;
    border-top: 1px solid #ebeef5;
    background: #f8f9fa;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer-actions {
    display: flex;
    gap: 12px;
  }

  .last-saved {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #67c23a;
    font-size: 14px;

    i {
      font-size: 16px;
    }
  }

  // 预览框样式
  .preview-box {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    background: #fafafa;
    max-width: 300px;

    .preview-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;

      i {
        font-size: 16px;
      }
    }

    .preview-content {
      padding: 16px;
      background: white;

      .preview-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;

        &:last-child {
          border-bottom: none;
        }

        &.highlight {
          background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
          margin: 0 -16px;
          padding: 12px 16px;
          border-radius: 4px;
          font-weight: 600;

          .value {
            color: #d35400;
          }
        }

        .label {
          color: #7f8c8d;
          font-size: 14px;
        }

        .value {
          color: #2c3e50;
          font-size: 14px;
          font-weight: 500;
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .screen-lock-settings {
    .card-header,
    .card-content,
    .card-footer {
      padding: 16px;
    }

    .image-preview,
    .video-preview,
    .upload-placeholder {
      width: 100%;
      height: 180px;
    }

    .card-footer {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;

      .footer-actions {
        justify-content: center;
      }

      .last-saved {
        text-align: center;
        justify-content: center;
      }
    }
  }
}
</style>
