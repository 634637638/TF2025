<!--
  LoginView - H5登录页面
  功能：用户通过手机号和密码登录
-->
<template>
  <H5AuthLayout
    title="欢迎登录"
    icon="fa-mobile-alt"
    :subtitle="shopConfig.shop_name || 'H5商城'"
    footer-text="还没有账号？"
    footer-label="立即注册"
    footer-to="/m/register"
  >
    <!-- 登录表单 -->
    <el-form
      ref="loginFormRef"
      :model="form.values"
      class="auth-form"
    >
      <el-form-item
        prop="phone"
        :error="form.errors.phone"
      >
        <el-input
          :model-value="form.values.phone"
          type="tel"
          placeholder="请输入手机号"
          size="large"
          clearable
          @update:model-value="setPhoneFieldValue($event)"
          @blur="validate()"
        >
          <template #prefix>
            <i class="fas fa-phone" />
          </template>
        </el-input>
      </el-form-item>

      <el-form-item
        prop="password"
        :error="form.errors.password"
      >
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
            <i class="fas fa-lock" />
          </template>
        </el-input>
      </el-form-item>

      <el-form-item>
        <el-button
          type="primary"
          native-type="button"
          :loading="loading"
          class="w-full"
          @click="handleLogin"
        >
          登录
        </el-button>
      </el-form-item>
    </el-form>
  </H5AuthLayout>
</template>

<script setup lang="ts">
import H5AuthLayout from '../components/H5AuthLayout.vue'
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { type FormInstance } from 'element-plus'
import { useForm, ValidationRules, useLoadingState } from '@/composables'
import { login, tokenManager, userManager } from '@/api/auth'
import { getPublicConfig, type ShopConfig } from '@/api/shop-public'
import { getRequestErrorMessage, extractResponseData } from '@/utils/api-response'
import { normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()

const router = useRouter()
const route = useRoute()

const loginFormRef = ref<FormInstance>()
const { loading } = useLoadingState()
const shopConfig = ref<Partial<ShopConfig>>({})
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



// 加载商城配置
const loadConfig = async () => {
  try {
    const response = await getPublicConfig()
    shopConfig.value = extractResponseData<Partial<ShopConfig>>(response)
  } catch (error) {
    logger.error('获取配置失败:', error)
  }
}

// 处理登录
const handleLogin = async () => {
  if (loading.value) return
  if (!loginFormRef.value) return

  loading.value = true
  try {
    if (!await validate()) return

    const response = await login({
      phone: normalizePhoneDigits(form.values.phone),
      password: form.values.password
    })

    // 保存token和用户信息
    tokenManager.setToken(response.token)
    userManager.setUser(response.user)

    globalNotifications.success('登录成功')

    // 跳转到原来的页面或"我的"页面
    const redirect = (route.query.redirect as string) || '/m/my'
    router.push(redirect)
  } catch (error: unknown) {
    logger.error('登录失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '登录失败'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>
