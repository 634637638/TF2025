<!--
  LoginView - H5登录页面
  功能：用户通过手机号和密码登录
-->
<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Logo和标题 -->
      <div class="login-header">
        <div class="logo">
          <i class="fas fa-mobile-alt"></i>
        </div>
        <h1 class="title">欢迎登录</h1>
        <p class="subtitle">{{ shopConfig.shop_name || 'H5商城' }}</p>
      </div>

      <!-- 登录表单 -->
      <el-form :model="form.values" :rules="loginRules" ref="loginFormRef" class="login-form">
        <el-form-item prop="phone">
          <el-input
            :model-value="form.values.phone"
            type="tel"
            maxlength="11"
            placeholder="请输入手机号"
            size="large"
            clearable
            @update:model-value="setPhoneFieldValue($event)"
            @blur="validate()"
          >
            <template #prefix>
              <i class="fas fa-phone"></i>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            :model-value="form.values.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            show-password
            clearable
            @update:model-value="setFieldValue('password', $event)"
            @blur="validate()"
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <i class="fas fa-lock"></i>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="handleLogin"
            class="w-full"
          >
            登录
          </el-button>
        </el-form-item>

        <!-- 底部链接 -->
        <div class="login-footer">
          <span class="footer-text">还没有账号？</span>
          <router-link to="/m/register" class="footer-link">立即注册</router-link>
        </div>

        <!-- 返回首页 -->
        <div class="back-home">
          <router-link to="/m">
            <i class="fas fa-arrow-left"></i> 返回首页
          </router-link>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { useForm, ValidationRules, useLoadingState } from '@/composables'
import { login, tokenManager, userManager } from '@/api/auth'
import { getPublicConfig } from '@/api/shop-public'
import { normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'
const router = useRouter()
const route = useRoute()

const loginFormRef = ref<FormInstance>()
const { loading } = useLoadingState()
const shopConfig = ref<any>({})
const setPhoneFieldValue = (value: string) => setFieldValue('phone', normalizePhoneDigits(value))

// 使用 useForm 管理表单
const { form, validate, setFieldValue } = useForm({
  initialValues: {
    phone: '',
    password: ''
  },
  validationRules: {
    phone: [
      ValidationRules.required('请输入手机号'),
      ValidationRules.phone('请输入正确的手机号')
    ],
    password: [
      ValidationRules.required('请输入密码'),
      ValidationRules.minLength(6, '密码至少6位')
    ]
  }
})

// 转换为 el-form 格式的 rules
const loginRules = computed(() => {
  const rules: Record<string, any[]> = {}
  if (form.errors.phone) {
    rules.phone = [{ required: true, message: form.errors.phone, trigger: 'blur' }]
  }
  if (form.errors.password) {
    rules.password = [{ required: true, message: form.errors.password, trigger: 'blur' }]
  }
  return rules
})

// 加载商城配置
const loadConfig = async () => {
  try {
    const response = await getPublicConfig()
    shopConfig.value = (response as any).data || response
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    await loginFormRef.value.validate()

    loading.value = true

    const response: any = await login({
      phone: normalizePhoneDigits(form.values.phone),
      password: form.values.password
    })

    // 保存token和用户信息
    tokenManager.setToken(response.token)
    userManager.setUser(response.user)

    ElMessage.success('登录成功')

    // 跳转到原来的页面或"我的"页面
    const redirect = (route.query.redirect as string) || '/m/my'
    router.push(redirect)
  } catch (error: any) {
    logger.error('登录失败:', error)
    const errorMessage = error?.response?.data?.message || error?.message || '登录失败'
    ElMessage.error(errorMessage)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-container {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

// 登录头部
.login-header {
  text-align: center;
  margin-bottom: 32px;

  .logo {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;

    i {
      font-size: 32px;
      color: #fff;
    }
  }

  .title {
    font-size: 24px;
    font-weight: 600;
    color: #333;
    margin: 0 0 8px;
  }

  .subtitle {
    font-size: 14px;
    color: #999;
    margin: 0;
  }
}

// 登录表单
.login-form {
  .el-form-item {
    margin-bottom: 20px;
  }

  :deep(.el-input__prefix) {
    i {
      color: #999;
    }
  }

  .el-button {
    margin-top: 8px;
  }
}

// 底部链接
.login-footer {
  text-align: center;
  margin-top: 16px;

  .footer-text {
    font-size: 14px;
    color: #666;
  }

  .footer-link {
    font-size: 14px;
    color: #667eea;
    text-decoration: none;
    font-weight: 500;

    &:active {
      opacity: 0.8;
    }
  }
}

// 返回首页
.back-home {
  text-align: center;
  margin-top: 24px;

  a {
    font-size: 13px;
    color: #999;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;

    &:active {
      opacity: 0.8;
    }

    i {
      font-size: 12px;
    }
  }
}
</style>
