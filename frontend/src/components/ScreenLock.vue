<template>
  <div v-if="isLocked" class="screen-lock-overlay">
    <div class="screen-lock-content">
      <!-- 背景媒体 -->
      <div class="lock-background">
        <!-- 视频背景 -->
        <video
          v-if="lockSettings.backgroundType === 'video' && lockSettings.videoUrl"
          :src="formatImageUrl(lockSettings.videoUrl)"
          autoplay
          loop
          muted
          playsinline
          class="lock-video"
        />
        <!-- 图片背景 -->
        <Image
          v-else-if="lockSettings.backgroundType === 'image' && lockSettings.imageUrl"
          :src="lockSettings.imageUrl"
          alt="锁定背景"
          mode="eager"
          class="lock-image"
        />
        <!-- 默认背景 -->
        <div v-else class="default-background">
          <div class="pattern-bg"></div>
        </div>
      </div>

      <!-- 锁定信息 -->
      <div class="lock-info">
        <div class="lock-icon">
          <i class="fas fa-lock"></i>
        </div>
        <h1 class="lock-title">
          {{ lockSettings.title || '屏幕已锁定' }}
        </h1>
        <p class="lock-message">
          {{ lockSettings.message || '请输入密码解锁' }}
        </p>
      </div>

      <!-- 密码输入区域 -->
      <div class="lock-form">
        <div class="password-input-group">
          <i class="fas fa-key input-icon"></i>
          <input
            ref="passwordInput"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            :placeholder="lockSettings.placeholder || '请输入解锁密码'"
            class="password-input"
            @keyup.enter="handleUnlock"
          />
          <button
            type="button"
            class="toggle-password"
            @click="showPassword = !showPassword"
          >
            <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
          </button>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ errorMessage }}
        </div>

        <!-- 解锁按钮 -->
        <button
          type="button"
          class="unlock-button"
          @click="handleUnlock"
          :disabled="isUnlocking || !password"
        >
          <i v-if="isUnlocking" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-unlock"></i>
          {{ isUnlocking ? '验证中...' : '解锁' }}
        </button>
      </div>

      <!-- 底部信息 -->
      <div class="lock-footer">
        <p class="lock-time" v-if="lockTime">
          锁定时间：{{ formatTime(lockTime) }}
        </p>
        <p class="lock-tips">
          <i class="fas fa-info-circle"></i>
          如忘记密码，请联系有权限的角色维护人员
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import Image from './Image.vue'
import { formatImageUrl } from '@/utils/format'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import dayjs from 'dayjs'

const { success, error } = useNotification({ debounce: true })

// Props
interface Props {
  isLocked: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLocked: false
})

interface Emits {
  'update:isLocked': [value: boolean]
}

const emit = defineEmits<Emits>()

// 响应式数据
const password = ref('')
const showPassword = ref(false)
const isUnlocking = ref(false)
const errorMessage = ref('')
const passwordInput = ref<HTMLInputElement>()
const lockTime = ref<Date | null>(null)

// 锁定设置
const lockSettings = reactive({
  backgroundType: 'default',
  title: '',
  message: '',
  placeholder: '',
  imageUrl: '',
  videoUrl: '',
  password: ''
})

// 格式化时间
const formatTime = (date: Date) => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 加载锁定设置
const loadLockSettings = async () => {
  try {
    const response = await unifiedApi.get('/screen-lock')
    if (response.success && response.data) {
      Object.assign(lockSettings, response.data)
    }
  } catch (err) {
    // 加载锁定设置失败，忽略
  }
}

// 处理解锁
const handleUnlock = async () => {
  if (!password.value.trim()) {
    errorMessage.value = '请输入密码'
    return
  }

  isUnlocking.value = true
  errorMessage.value = ''

  try {
    // 验证密码
    const response = await unifiedApi.post('/screen-lock/verify', {
      password: password.value
    })

    
    if (response.success) {
      success('解锁成功')
      password.value = ''
      errorMessage.value = ''
      showPassword.value = false
      emit('update:isLocked', false)
    } else {
      // 优先使用error字段中的message，然后是message字段，最后是默认消息
      const errorMsg = response.error?.message || response.message || '密码错误，请重试'
      errorMessage.value = errorMsg
      // 清空密码并重新聚焦
      password.value = ''
      await nextTick()
      passwordInput.value?.focus()
    }
  } catch (err) {
    errorMessage.value = '解锁失败，请稍后重试'
    password.value = ''
  } finally {
    isUnlocking.value = false
  }
}

// 监听锁定状态变化
watch(() => props.isLocked, (newVal) => {
  if (newVal) {
    // 进入锁定状态
    lockTime.value = dayjs()
    loadLockSettings()
    // 自动聚焦到密码输入框
    nextTick(() => {
      passwordInput.value?.focus()
    })
  } else {
    // 解锁状态
    lockTime.value = null
    password.value = ''
    errorMessage.value = ''
    showPassword.value = false
  }
})

// 键盘事件处理
onMounted(() => {
  // Ctrl+L 快速锁定（可选）
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      emit('update:isLocked', true)
    }
  })
})
</script>

<style lang="scss">
/* 全局样式，不受 scoped 限制 */
.screen-lock-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  z-index: 999999 !important; /* 提高z-index确保在最上层 */
  background: rgba(0, 0, 0, 0.95) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  backdrop-filter: blur(10px) !important;
  overflow: hidden !important;
}

.screen-lock-content {
  width: 100%;
  max-width: 500px;
  padding: 40px;
  text-align: center;
  position: relative;
}

.lock-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: 20px;

  .lock-video,
  .lock-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-background {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    position: relative;

    .pattern-bg {
      width: 100%;
      height: 100%;
      background-image:
        radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 50% 80%, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
      animation: float 20s ease-in-out infinite;
    }
  }
}

.lock-info {
  margin-bottom: 40px;

  .lock-icon {
    font-size: 64px;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 20px;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .lock-title {
    font-size: 32px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 16px 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .lock-message {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
  }
}

.lock-form {
  .password-input-group {
    position: relative;
    margin-bottom: 20px;

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(255, 255, 255, 0.6);
      z-index: 1;
    }

    .password-input {
      width: 100%;
      padding: 16px 50px 16px 50px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: #ffffff;
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;

      &::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }

      &:focus {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.4);
      }
    }

    .toggle-password {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      padding: 4px;
      font-size: 16px;
      transition: color 0.3s ease;

      &:hover {
        color: rgba(255, 255, 255, 0.9);
      }
    }
  }

  .error-message {
    color: #ff6b6b;
    font-size: 14px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    i {
      font-size: 16px;
    }
  }

  .unlock-button {
    width: 100%;
    padding: 16px 32px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #059669, #047857);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
}

.lock-footer {
  margin-top: 40px;

  .lock-time {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 12px 0;
  }

  .lock-tips {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;

    i {
      font-size: 12px;
    }
  }
}

// 动画
@keyframes float {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
  }
  33% {
    transform: translate(-20px, -20px) rotate(120deg);
  }
  66% {
    transform: translate(20px, -10px) rotate(240deg);
  }
}

// 响应式
@media (max-width: 768px) {
  .screen-lock-content {
    padding: 30px 20px;
  }

  .lock-info {
    .lock-title {
      font-size: 28px;
    }
  }

  .lock-form {
    .password-input-group {
      .password-input {
        font-size: 16px;
      }
    }
  }
}
</style>
