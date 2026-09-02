<template>
  <div class="screen-lock-settings">
    <div class="settings-card">
      <div class="card-header">
        <h3>
          <i class="fas fa-lock" />
          系统设置
        </h3>
        <p class="card-description">
          配置屏幕锁定和在库查询功能的相关设置
        </p>
      </div>

      <div class="card-content">
        <!-- TAB 切换 -->
        <el-tabs
          v-model="activeTab"
          class="settings-tabs tf-page-tabs"
        >
          <!-- 屏幕保护设置 TAB -->
          <el-tab-pane
            label="屏幕保护"
            name="screen-lock"
            class="tf-tab-panel"
          >
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
                  <el-radio value="default">
                    默认背景
                  </el-radio>
                  <el-radio value="image">
                    图片背景
                  </el-radio>
                  <el-radio value="video">
                    视频背景
                  </el-radio>
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
                    <div
                      v-if="screenLockForm.imageUrl"
                      class="image-preview"
                    >
                      <Image
                        :src="screenLockForm.imageUrl"
                        alt="背景图片"
                        mode="eager"
                      />
                      <div class="image-overlay">
                        <i class="fas fa-camera" />
                        <span>更换图片</span>
                      </div>
                    </div>
                    <div
                      v-else
                      class="upload-placeholder"
                    >
                      <i class="fas fa-cloud-upload-alt" />
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
                    <div
                      v-if="screenLockForm.videoUrl"
                      class="video-preview"
                    >
                      <video
                        :src="formatImageUrl(screenLockForm.videoUrl)"
                        muted
                        loop
                      />
                      <div class="video-overlay">
                        <i class="fas fa-video" />
                        <span>更换视频</span>
                      </div>
                    </div>
                    <div
                      v-else
                      class="upload-placeholder"
                    >
                      <i class="fas fa-cloud-upload-alt" />
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
        </el-tabs>
      </div>

      <div class="card-footer">
        <div class="footer-actions">
          <el-button @click="resetForm">
            重置
          </el-button>
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!hasChanges"
            @click="saveSettings"
          >
            <span v-if="saving">保存中...</span>
            <template v-else>
              <i class="fas fa-save" />
              保存设置
            </template>
          </el-button>
        </div>
        <div
          v-if="lastSavedTime"
          class="last-saved"
        >
          <i class="fas fa-check-circle" />
          最后保存：{{ lastSavedTime }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, UploadProps } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'
import { formatImageUrl } from '@/utils/format'
import Image from './Image.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { storage } from '@/services/storage'
import { logger } from '@/utils/logger'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'

// 接口定义
interface ScreenLockSettings {
  backgroundType: 'default' | 'image' | 'video'
  imageUrl?: string
  videoUrl?: string
  title?: string
  message?: string
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

const _props = withDefaults(defineProps<Props>(), {
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

// 原始数据备份
const originalData = ref<ScreenLockSettings>({ ...screenLockForm })
const uploadedTempFiles = ref<string[]>([])

// 认证信息
const authStore = useAuthStore()

// 计算属性
const uploadUrl = computed(() => '/api/screen-lock/upload/screen-lock')
const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${authStore.token}`
}))

const hasChanges = computed(() => {
  return JSON.stringify(screenLockForm) !== JSON.stringify(originalData.value)
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
      originalData.value = { ...screenLockForm }
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
          originalData.value = { ...screenLockForm }
        }
      } catch (localError) {
        logger.error('从 localStorage 加载失败:', localError)
      }
    }
  }
}

const saveSettings = async () => {
  if (saving.value) return

  saving.value = true

  try {
    const data = { ...screenLockForm }

    // 先保存到 localStorage（作为本地缓存，解决后端404问题）
    storage.setScreenLockSettings(data)

    const response = await unifiedApi.post('/screen-lock', data)

    if (response.success) {
      originalData.value = { ...screenLockForm }
      uploadedTempFiles.value = []
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
      originalData.value = { ...screenLockForm }
      uploadedTempFiles.value = []
      lastSavedTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
      ElMessage.warning('设置已保存到本地（后端未连接）')
      emit('change', { ...screenLockForm })
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

    await cleanupTempFiles()
    Object.assign(screenLockForm, {
      backgroundType: originalData.value.backgroundType || 'default',
      imageUrl: originalData.value.imageUrl || '',
      videoUrl: originalData.value.videoUrl || '',
      title: originalData.value.title || '屏幕已锁定',
      message: originalData.value.message || '请输入密码解锁'
    })
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
    if (!uploadedTempFiles.value.includes(response.data.url)) {
      uploadedTempFiles.value.push(response.data.url)
    }
    screenLockForm.imageUrl = response.data.url
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error('图片上传失败')
  }
}

const handleVideoSuccess = (response: UploadResponse) => {
  if (response.success && response.data?.url) {
    if (!uploadedTempFiles.value.includes(response.data.url)) {
      uploadedTempFiles.value.push(response.data.url)
    }
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

const cleanupTempFiles = async () => {
  const targets = [...uploadedTempFiles.value]
  if (targets.length === 0) return

  const success = await deleteTempFiles(targets)
  if (success) {
    uploadedTempFiles.value = uploadedTempFiles.value.filter(url => !targets.includes(url))
  }
}

// 监听变化
watch([screenLockForm], () => {
  emit('update:modelValue', hasChanges.value)
}, { deep: true })

// 生命周期
onMounted(() => {
  loadSettings()
})

onUnmounted(() => {
  void cleanupTempFiles()
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
    border-bottom: 1px solid var(--color-border-light);
    background: linear-gradient(135deg, var(--tf-color-surface) 0%, var(--tf-color-border-gradient) 100%);

    h3 {
      margin: 0 0 8px 0;
      color: var(--tf-color-heading);
      font-size: 20px;
      display: flex;
      align-items: center;
      gap: 12px;

      i {
        color: var(--tf-color-indigo-brand);
      }
    }

    .card-description {
      margin: 0;
      color: var(--tf-color-gray-cool-500);
      font-size: 14px;
    }
  }

  .card-content {
    padding: 24px;
  }

  .form-help {
    margin-top: 8px;
    font-size: 12px;
    color: var(--color-info);
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
      border: 2px dashed var(--tf-color-gray-ant-400);
      border-radius: 8px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: all 0.3s;

      &:hover {
        border-color: var(--tf-color-indigo-brand);
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
    color: var(--tf-color-gray-element);
    background: var(--tf-color-neutral-25);

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
    color: var(--color-text-regular);
  }

  .card-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--color-border-light);
    background: var(--tf-color-surface-muted);
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
    color: var(--color-success);
    font-size: 14px;

    i {
      font-size: 16px;
    }
  }

  // 预览框样式
  .preview-box {
    border: 1px solid var(--tf-color-gray-material-300);
    border-radius: 8px;
    overflow: hidden;
    background: var(--tf-color-neutral-25);
    max-width: 300px;

    .preview-header {
      background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
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
        border-bottom: 1px solid var(--tf-color-gray-200);

        &:last-child {
          border-bottom: none;
        }

        &.highlight {
          background: linear-gradient(135deg, var(--tf-color-amber-pastel) 0%, var(--tf-color-amber-pastel-dark) 100%);
          margin: 0 -16px;
          padding: 12px 16px;
          border-radius: 4px;
          font-weight: 600;

          .value {
            color: var(--tf-color-orange-flat-dark);
          }
        }

        .label {
          color: var(--tf-color-gray-cool-500);
          font-size: 14px;
        }

        .value {
          color: var(--tf-color-heading);
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
