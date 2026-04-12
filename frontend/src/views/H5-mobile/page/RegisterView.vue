<!--
  RegisterView - H5注册页面
  功能：新用户注册账号
-->
<template>
  <div class="register-page">
    <div class="register-container">
      <!-- Logo和标题 -->
      <div class="register-header">
        <div class="logo">
          <i class="fas fa-user-plus"></i>
        </div>
        <h1 class="title">用户注册</h1>
        <p class="subtitle">加入{{ shopConfig.shop_name || 'H5商城' }}</p>
      </div>

      <!-- 注册表单 -->
      <el-form :model="form.values" :rules="registerRules" ref="registerFormRef" class="register-form">
        <el-form-item prop="name">
          <el-input
            :model-value="form.values.name"
            placeholder="请输入您的姓名"
            size="large"
            clearable
            @update:model-value="setFieldValue('name', $event)"
            @blur="validate()"
          >
            <template #prefix>
              <i class="fas fa-user"></i>
            </template>
          </el-input>
        </el-form-item>

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
            placeholder="请设置密码（至少6位）"
            size="large"
            show-password
            clearable
            @update:model-value="setFieldValue('password', $event)"
            @blur="validate()"
          >
            <template #prefix>
              <i class="fas fa-lock"></i>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="confirmPassword">
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
              <i class="fas fa-lock"></i>
            </template>
          </el-input>
        </el-form-item>

        <!-- 用户协议 -->
        <el-form-item prop="agreed">
          <el-checkbox
            :model-value="form.values.agreed"
            label="我已阅读并同意用户协议和隐私政策"
            @update:model-value="setFieldValue('agreed', $event)"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="handleRegister"
            class="w-full"
          >
            立即注册
          </el-button>
        </el-form-item>

        <!-- 底部链接 -->
        <div class="register-footer">
          <span class="footer-text">已有账号？</span>
          <router-link to="/m/login" class="footer-link">立即登录</router-link>
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
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { useForm, ValidationRules, useLoadingState } from '@/composables'
import { register, tokenManager, userManager } from '@/api/auth'
import { getPublicConfig } from '@/api/shop-public'
import { normalizePhoneDigits } from '@/utils/security'
import { logger } from '@/utils/logger'
const router = useRouter()

const registerFormRef = ref<FormInstance>()
const { loading } = useLoadingState()
const shopConfig = ref<any>({})
const setPhoneFieldValue = (value: string) => setFieldValue('phone', normalizePhoneDigits(value))

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
      ValidationRules.minLength(2, '姓名至少2个字符')
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

// 转换为 el-form 格式的 rules
const registerRules = computed(() => {
  const rules: Record<string, any[]> = {}
  if (form.errors.name) {
    rules.name = [{ required: true, message: form.errors.name, trigger: 'blur' }]
  }
  if (form.errors.phone) {
    rules.phone = [{ required: true, message: form.errors.phone, trigger: 'blur' }]
  }
  if (form.errors.password) {
    rules.password = [{ required: true, message: form.errors.password, trigger: 'blur' }]
  }
  if (form.errors.confirmPassword) {
    rules.confirmPassword = [{ required: true, message: form.errors.confirmPassword, trigger: 'blur' }]
  }
  if (form.errors.agreed) {
    rules.agreed = [{ required: true, message: form.errors.agreed, trigger: 'change' }]
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

// 处理注册
const handleRegister = async () => {
  if (!registerFormRef.value) return

  try {
    await registerFormRef.value.validate()

    loading.value = true

    const response: any = await register({
      name: form.values.name,
      phone: normalizePhoneDigits(form.values.phone),
      password: form.values.password
    })

    // 保存token和用户信息
    tokenManager.setToken(response.token)
    userManager.setUser(response.user)

    ElMessage.success('注册成功')

    // 跳转到"我的"页面
    router.push('/m/my')
  } catch (error: any) {
    logger.error('注册失败:', error)
    const errorMessage = error?.response?.data?.message || error?.message || '注册失败'
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
.register-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.register-container {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  padding: 40px 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

// 注册头部
.register-header {
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
      font-size: 28px;
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

// 注册表单
.register-form {
  .el-form-item {
    margin-bottom: 18px;

    &:last-of-type {
      margin-bottom: 20px;
    }
  }

  :deep(.el-input__prefix) {
    i {
      color: #999;
    }
  }

  .el-checkbox {
    :deep(.el-checkbox__label) {
      font-size: 13px;
      color: #666;
    }
  }

  .el-button {
    margin-top: 8px;
  }
}

// 底部链接
.register-footer {
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
