<!--
  RegisterView - H5注册页面
  功能：新用户注册账号
-->
<template>
  <H5AuthLayout
    title="用户注册"
    icon="fa-user-plus"
    :subtitle="`加入${shopConfig.shop_name || 'H5商城'}`"
    footer-text="已有账号？"
    footer-label="立即登录"
    footer-to="/m/login"
  >
    <!-- 注册表单 -->
    <el-form
      ref="registerFormRef"
      :model="form.values"
      class="auth-form"
    >
      <el-form-item
        prop="name"
        :error="form.errors.name"
      >
        <el-input
          :model-value="form.values.name"
          placeholder="请输入您的姓名"
          size="large"
          clearable
          @update:model-value="setFieldValue('name', $event)"
          @blur="validate()"
        >
          <template #prefix>
            <i class="fas fa-user" />
          </template>
        </el-input>
      </el-form-item>

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
          placeholder="请设置密码（至少6位）"
          size="large"
          show-password
          clearable
          @update:model-value="setFieldValue('password', $event)"
          @blur="validate()"
        >
          <template #prefix>
            <i class="fas fa-lock" />
          </template>
        </el-input>
      </el-form-item>

      <el-form-item
        prop="confirmPassword"
        :error="form.errors.confirmPassword"
      >
        <el-input
          :model-value="form.values.confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          size="large"
          show-password
          clearable
          @update:model-value="setFieldValue('confirmPassword', $event)"
          @blur="validate()"
          @keyup.enter="handleRegister"
        >
          <template #prefix>
            <i class="fas fa-lock" />
          </template>
        </el-input>
      </el-form-item>

      <!-- 用户协议 -->
      <el-form-item
        prop="agreed"
        :error="form.errors.agreed"
      >
        <el-checkbox
          :model-value="form.values.agreed"
          label="我已阅读并同意用户协议和隐私政策"
          @update:model-value="setAgreedField($event)"
        />
      </el-form-item>

      <el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          class="w-full"
          @click="handleRegister"
        >
          立即注册
        </el-button>
      </el-form-item>
    </el-form>
  </H5AuthLayout>
</template>

<script setup lang="ts">
import H5AuthLayout from '../components/H5AuthLayout.vue'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { type FormInstance } from 'element-plus'
import { useForm, ValidationRules, useLoadingState } from '@/composables'
import { register, tokenManager, userManager } from '@/api/auth'
import { getPublicConfig, type ShopConfig } from '@/api/shop-public'
import { getRequestErrorMessage, extractResponseData } from '@/utils/api-response'
import { normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()

const router = useRouter()

const registerFormRef = ref<FormInstance>()
const { loading } = useLoadingState()
const shopConfig = ref<Partial<ShopConfig>>({})
const setPhoneFieldValue = (value: string) => setFieldValue('phone', normalizePhoneDigits(value))
const setAgreedField = (value: string | boolean | number) => setFieldValue('agreed', value === true)

// 使用 useForm 管理表单
const { form, validate, setFieldValue } = useForm({
  initialValues: {
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreed: false
  },
  validationRules: {
    name: [
      ValidationRules.required('请输入您的姓名'),
      ValidationRules.minLength(2, '姓名至少2个字符'),
      ValidationRules.personName(50)
    ],
    phone: [
      ValidationRules.required('请输入手机号'),
      ValidationRules.phone('请输入正确的手机号')
    ],
    password: [
      ValidationRules.required('请设置密码'),
      ValidationRules.minLength(6, '密码至少6位')
    ],
    confirmPassword: [
      ValidationRules.required('请再次输入密码'),
      ValidationRules.confirmPassword('password', '两次输入的密码不一致')
    ],
    agreed: [
      ValidationRules.enum([true], '请阅读并同意用户协议和隐私政策')
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

// 处理注册
const handleRegister = async () => {
  if (loading.value) return
  if (!registerFormRef.value) return

  loading.value = true
  try {
    if (!await validate()) return

    const response = await register({
      name: form.values.name,
      phone: normalizePhoneDigits(form.values.phone),
      password: form.values.password
    })

    // 保存token和用户信息
    tokenManager.setToken(response.token)
    userManager.setUser(response.user)

    globalNotifications.success('注册成功')

    // 跳转到"我的"页面
    router.push('/m/my')
  } catch (error: unknown) {
    logger.error('注册失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '注册失败'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>
