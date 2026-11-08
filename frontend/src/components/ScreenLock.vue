<template>
  <div
    v-if="isLocked"
    class="screen-lock-overlay"
  >
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
        <div
          v-else-if="settingsReady"
          class="default-background"
        >
          <div class="pattern-bg" />
        </div>
      </div>

      <!-- 锁定信息 -->
      <div class="lock-info">
        <div class="lock-icon">
          <i class="fas fa-lock" />
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
          <el-input
            ref="passwordInput"
            v-model="password"
            type="password"
            placeholder="请输入解锁密码"
            show-password
            autocomplete="current-password"
            autocapitalize="off"
            :spellcheck="false"
            class="password-input"
            @keyup.enter="handleUnlock"
          >
            <template #prefix>
              <i class="fas fa-key password-key-icon" />
            </template>
          </el-input>
        </div>

        <!-- 错误提示 -->
        <div
          v-if="errorMessage"
          class="error-message"
        >
          <i class="fas fa-exclamation-circle" />
          {{ errorMessage }}
        </div>

        <!-- 解锁按钮 -->
        <el-button
          native-type="button"
          class="unlock-button tf-button--success"
          aria-label="解锁"
          :loading="isUnlocking"
          :disabled="isUnlocking || !password"
          @click="handleUnlock"
        >
          <template v-if="isUnlocking">
            验证中...
          </template>
          <template v-else>
            <i class="fas fa-unlock" />
            解锁
          </template>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import Image from './Image.vue'
import { formatImageUrl } from '@/utils/format'
import { storage } from '@/services/storage'
import { normalizeScreenLockSettings } from '@/utils/screen-lock-settings'
import type { ScreenLockSettings } from '@/types/screen-lock'

const { success } = useNotification({ debounce: true })

// Props
interface Props {
  isLocked?: boolean
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
const isUnlocking = ref(false)
const errorMessage = ref('')
const passwordInput = ref<{ focus: () => void } | null>(null)

// 锁定设置
const cachedLockSettings = storage.getScreenLockSettings<unknown>()
const settingsReady = ref(Boolean(cachedLockSettings && typeof cachedLockSettings === 'object'))
const lockSettings = reactive<ScreenLockSettings>(
  normalizeScreenLockSettings(cachedLockSettings)
)

// 加载锁定设置
const loadLockSettings = async () => {
  try {
    const response = await unifiedApi.get('/screen-lock')
    if (response.success && response.data) {
      const settings = normalizeScreenLockSettings(response.data)
      Object.assign(lockSettings, settings)
      storage.setScreenLockSettings(settings)
      settingsReady.value = true
    }
  } catch (err) {
    // 加载锁定设置失败，忽略
  }
}

// 处理解锁
const handleUnlock = async () => {
  if (isUnlocking.value) return
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
      emit('update:isLocked', false)
    } else {
      // 优先使用error字段中的message，然后是message字段，最后是默认消息
      const errorMsg = response.message || '密码错误，请重试'
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
    void loadLockSettings()
    // 自动聚焦到密码输入框
    nextTick(() => {
      passwordInput.value?.focus()
    })
  } else {
    // 解锁状态
    password.value = ''
    errorMessage.value = ''
  }
}, { immediate: true })

// 键盘事件处理
const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault()
    emit('update:isLocked', true)
  }
}

onMounted(() => {
  // Ctrl+L 快速锁定（可选）
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
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
  z-index: var(--tf-z-lock) !important;
  background: rgba(0, 0, 0, 0.95) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  backdrop-filter: blur(10px) !important;
  overflow: hidden !important;
}

@supports (height: 100dvh) {
  .screen-lock-overlay {
    height: 100dvh !important;
  }
}

.screen-lock-content {
  width: 100%;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: var(--tf-space-8);
  padding-top: max(var(--tf-space-8), env(safe-area-inset-top));
  padding-right: max(var(--tf-space-8), env(safe-area-inset-right));
  padding-bottom: max(var(--tf-space-8), env(safe-area-inset-bottom));
  padding-left: max(var(--tf-space-8), env(safe-area-inset-left));
  text-align: center;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  isolation: isolate;
}

.lock-background {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;

  .lock-video,
  .lock-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-background {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
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

.lock-info,
.lock-form {
  width: 100%;
  max-width: 500px;
}

.lock-info {
  margin-bottom: 40px;

  .lock-icon {
    font-size: var(--tf-type-scale-64);
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 20px;
    text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .lock-title {
    font-size: var(--tf-type-scale-32);
    font-weight: 700;
    color: var(--color-bg-white);
    margin: 0 0 16px 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .lock-message {
    font-size: var(--tf-type-scale-16);
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
  }
}

.lock-form {
  width: calc(100% - (var(--tf-space-8) + var(--tf-space-8)));
  position: absolute;
  left: 50%;
  bottom: max(var(--tf-space-8), env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "error error"
    "input action";
  align-items: center;
  gap: var(--tf-space-3);

  .password-input-group {
    grid-area: input;
    min-width: 0;

    .password-key-icon {
      color: rgba(255, 255, 255, 0.6);
    }

    .password-input {
      width: 100%;

      .el-input__wrapper {
        padding: var(--tf-space-1) var(--tf-space-2);
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.2);
        box-shadow: none;
        transition: all 0.3s ease;
      }

      .el-input__inner {
        color: var(--color-bg-white);
        font-size: var(--tf-type-scale-16);

        &::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }
      }

    }
  }

  .error-message {
    grid-area: error;
    color: var(--tf-color-coral);
    font-size: var(--tf-type-scale-14);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    i {
      font-size: var(--tf-type-scale-16);
    }
  }

  .unlock-button {
    grid-area: action;
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
@media (max-width: 767px) {
  .screen-lock-content {
    padding: var(--tf-space-6) var(--tf-space-5);
    padding-top: max(var(--tf-space-6), env(safe-area-inset-top));
    padding-right: max(var(--tf-space-5), env(safe-area-inset-right));
    padding-bottom: max(var(--tf-space-6), env(safe-area-inset-bottom));
    padding-left: max(var(--tf-space-5), env(safe-area-inset-left));
  }

  .lock-info {
    .lock-title {
      font-size: var(--tf-type-scale-28);
    }
  }

  .lock-form {
    width: calc(100% - (var(--tf-space-5) + var(--tf-space-5)));
    bottom: max(var(--tf-space-6), env(safe-area-inset-bottom));
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "error error"
      "input action";

    .password-input-group {
      .password-input {
        font-size: var(--tf-type-scale-16);
      }
    }
  }
}
</style>
