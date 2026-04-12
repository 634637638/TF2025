<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>{{ siteSettingsStore.displayName }}</h1>
        <p>{{ siteSettingsStore.settings.siteSubtitle || '安全，高效的管理平台' }}</p>
      </div>
      <form @submit.prevent="handleLogin" class="login-form">
            <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            class="form-control"
            placeholder="请输入用户名"
            :disabled="loading || isLocked"
            autocomplete="username"
          />
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-control"
            placeholder="请输入密码"
            :disabled="loading || isLocked"
            autocomplete="current-password"
          />
        </div>

        <!-- 登录尝试次数提示 -->
        <div v-if="isLocked" class="login-tips locked">
          <small>账户已被临时锁定，请在 {{ lockTime }} 后重试</small>
        </div>
        <div v-else-if="remainingAttempts < 5" class="login-tips warning">
          <small>剩余尝试次数: {{ remainingAttempts }}/5</small>
        </div>

        <button type="submit" class="login-button" :disabled="loading || isLocked">
          {{ loading ? '登录中...' : isLocked ? '账户已锁定' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS } from '@/constants/storage'

const router = useRouter()
const authStore = useAuthStore()
const siteSettingsStore = useSiteSettingsStore()
const { success, error: showError, warning, info } = useNotification()

const username = ref('')
const password = ref('')
const { loading } = useLoadingState()
const remainingAttempts = ref(5)
const isLocked = ref(false)
const lockTime = ref('')


// 页面加载时清理可能存在的无效认证数据和失联状态
const initializeAuth = () => {
  // 🔧 登录页面初始化时，强制清除后端失联状态
  // 这样可以确保用户能够重新登录，即使之前检测到过后端失联
  const backendDisconnectedStr = storage.get<string>(AUTH_STORAGE_KEYS.BACKEND_DISCONNECTED, 'local')
  if (backendDisconnectedStr === 'true') {
    storage.remove(AUTH_STORAGE_KEYS.BACKEND_DISCONNECTED, 'local')
    storage.remove(AUTH_STORAGE_KEYS.BACKEND_DISCONNECT_TIME, 'local')
    storage.remove(AUTH_STORAGE_KEYS.DISCONNECT_NOTIFIED, 'session')
  }

  // 检查是否存在不一致的认证数据
  const sessionToken = storage.getToken()
  const localAuth = storage.getAuth()

  // 改进的验证逻辑：验证token格式而不是简单删除
  const isValidToken = (token: string): boolean => {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  };

  if (sessionToken && !isValidToken(sessionToken)) {
    storage.remove(AUTH_STORAGE_KEYS.TOKEN, 'session')
  } else if (sessionToken && !localAuth) {
    // 不删除sessionToken，尝试重建localStorage
  }

  if (!sessionToken && localAuth) {
    try {
      const authData = localAuth as any
      if (authData.token && isValidToken(authData.token)) {
        storage.setToken(authData.token)
      } else {
        storage.remove(AUTH_STORAGE_KEYS.AUTH, 'local')
        storage.remove(AUTH_STORAGE_KEYS.AUTH_BACKUP, 'local')
      }
    } catch (e) {
      storage.remove(AUTH_STORAGE_KEYS.AUTH, 'local')
      storage.remove(AUTH_STORAGE_KEYS.AUTH_BACKUP, 'local')
    }
  }

  // 清理可能的dev-token残留（仅在开发环境）
  if (import.meta.env.DEV) {
    const devToken = storage.get<string>(AUTH_STORAGE_KEYS.DEV_TOKEN, 'local')
    if (devToken) {
      storage.remove(AUTH_STORAGE_KEYS.DEV_TOKEN, 'local')
    }
  }
};

// 在组件挂载时执行初始化
onMounted(() => {
  initializeAuth();
  if (!siteSettingsStore.lastUpdated && !siteSettingsStore.isLoading) {
    siteSettingsStore.loadSiteSettings().catch(err => {
      logger.warn('加载站点设置失败:', err)
    })
  }
});

const handleLogin = async () => {
  if (!username.value || !password.value) {
    showError('请输入完整的用户名和密码')
    return
  }

  loading.value = true
  try {
    // 调用登录方法
    const loginResult = await authStore.login({
      username: username.value,
      password: password.value
    })

    // 验证登录状态
    if (!authStore.isAuthenticated) {
      throw new Error('登录状态验证失败')
    }

    // 显示成功消息给用户
    success(`登录成功！欢迎回来，${authStore.user?.name || '用户'}！`)

    // 直接跳转，不等待
    router.push('/dashboard')

  } catch (error: any) {
    // 提取友好的错误消息
    let friendlyMessage = '登录失败，请稍后重试'

    // 清理可能存在的不完整认证数据
    const cleanupAuthData = () => {
      storage.clearAuth()
      document.cookie = 'tf2025_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    };

    // 处理登录尝试次数限制
    if (error?.response?.status === 429) {
      // 账户被锁定
      const lockData = error.response.data?.details
      isLocked.value = true
      const minutes = lockData?.lockDuration || 15
      lockTime.value = `${minutes} 分钟后`

      friendlyMessage = '登录尝试次数过多，账户已被临时锁定'
      warning(`${friendlyMessage}，请在 ${lockTime.value} 重试`)
      loading.value = false
      return
    }

    // 检查响应头中的剩余尝试次数
    const attemptsHeader = error?.response?.headers?.['x-login-attempts-remaining']
    if (attemptsHeader) {
      remainingAttempts.value = parseInt(attemptsHeader)

      if (remainingAttempts.value <= 1) {
        friendlyMessage = '用户名或密码错误（还有 1 次机会）'
      } else {
        friendlyMessage = `用户名或密码错误（还有 ${remainingAttempts.value} 次机会）`
      }
    } else if (error?.response?.data?.message) {
      // 使用后端返回的友好消息
      const backendMessage = error.response.data.message

      // 根据后端消息类型提供更简洁的提示
      if (backendMessage.includes('禁用') || backendMessage.includes('disabled')) {
        friendlyMessage = '账户角色（工号）已被禁用，请联系管理员'
      } else if (backendMessage.includes('密码') || backendMessage.includes('用户名') || backendMessage.includes('输入验证失败')) {
        friendlyMessage = '⚠️ 用户名或密码错误'
      } else {
        friendlyMessage = backendMessage
      }

      cleanupAuthData(); // 清理无效认证数据
    } else if (error?.message) {
      // 使用前端错误消息，但进行友好的转换
      const errorMsg = error.message

      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        friendlyMessage = '密码或账户错误'
        cleanupAuthData(); // 清理无效认证数据
      } else if (errorMsg.includes('Network Error')) {
        friendlyMessage = '后端服务器连接出错'
      } else if (errorMsg.includes('timeout')) {
        friendlyMessage = '请求超时，请稍后重试'
      } else if (errorMsg.includes('Token存储验证失败')) {
        friendlyMessage = '登录状态保存失败，请重新尝试登录'
        cleanupAuthData(); // 清理无效的存储数据
      } else if (errorMsg.includes('存储验证失败') || errorMsg.includes('存储数据损坏')) {
        friendlyMessage = '浏览器存储数据异常，请清理浏览器缓存后重试'
        cleanupAuthData(); // 清理损坏的存储数据
      } else {
        friendlyMessage = '登录失败，请稍后重试'
        // 对于未知错误，也清理认证数据以防状态不一致
        cleanupAuthData();
      }
    }

    // 使用统一通知服务显示错误
    // 直接显示具体问题，不再使用笼统的标题
    showError(friendlyMessage)

    logger.error('❌ 登录失败:', friendlyMessage)
    logger.error('❌ 详细错误:', error)

    // 错误恢复提示
    if (friendlyMessage.includes('存储') || friendlyMessage.includes('缓存')) {
      info('如果问题持续存在，请尝试清理浏览器缓存和本地存储数据')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  color: #333;
  margin-bottom: 10px;
  font-size: 2rem;
  font-weight: 600;
}

.login-header p {
  color: #666;
  margin: 0;
  font-size: 0.95rem;
}

.login-tips {
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 5px;
  border-left: 3px solid #667eea;
}

.login-tips.warning {
  background: rgba(255, 193, 7, 0.1);
  border-left-color: #ffc107;
}

.login-tips.locked {
  background: rgba(220, 53, 69, 0.1);
  border-left-color: #dc3545;
}

.login-tips small {
  color: #555;
  font-size: 12px;
  line-height: 1.4;
}

.login-tips.locked small {
  color: #dc3545;
  font-weight: 500;
}

.login-tips.warning small {
  color: #f57c00;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #333;
  font-weight: 500;
}

.form-control {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.login-button {
  width: 100%;
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
}

.login-button:hover:not(:disabled) {
  background: #5a6fd8;
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>
