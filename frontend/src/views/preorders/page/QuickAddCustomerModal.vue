<template>
  <MobileDialog
    v-model="dialogVisible"
    title="快速新增客户"
    width="500px"
    :close-on-click-modal="false"
    dialog-class="preorder-dialog preorder-customer-dialog"
    :show-default-footer="false"
  >
    <el-form
      ref="formRef"
      :model="form.values"
      :rules="formRules"
      label-width="100px"
    >
      <el-form-item label="客户姓名" prop="name">
        <el-input
          :model-value="form.values.name"
          placeholder="请输入客户姓名"
          @update:model-value="setNameFieldValue($event)"
          @blur="validate()"
        />
      </el-form-item>
      <el-form-item label="联系电话" prop="phone">
        <el-input
          :model-value="form.values.phone"
          placeholder="请输入联系电话"
          @update:model-value="setPhoneFieldValue($event)"
          @blur="validate()"
        />
      </el-form-item>
      <el-form-item label="地址">
        <el-input
          :model-value="form.values.address"
          type="textarea"
          :rows="2"
          @update:model-value="setFieldValue('address', $event)"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button type="default" @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        确定
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { useForm, ValidationRules } from '@/composables'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import type { ModalProps, UpdateVisibleEmits } from '@/types'
interface Emits extends UpdateVisibleEmits {
  (e: 'success', customer: any): void
}

const props = defineProps<ModalProps>()
const emit = defineEmits<Emits>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const formRef = ref<FormInstance>()
const submitting = ref(false)
const setNameFieldValue = (value: string) => setFieldValue('name', normalizePersonName(value, 50))
const setPhoneFieldValue = (value: string) => setFieldValue('phone', normalizePhoneDigits(value))

// 使用 useForm 管理表单
const { form, validate, setFieldValue, reset } = useForm({
  initialValues: {
    name: '',
    phone: '',
    address: ''
  },
  validationRules: {
    name: [ValidationRules.required('请输入客户姓名')],
    phone: [
      ValidationRules.required('请输入联系电话'),
      ValidationRules.phone('请输入正确的手机号')
    ]
  }
})

// 转换为 el-form 格式的 rules
const formRules = computed(() => {
  const rules: Record<string, any[]> = {}
  if (form.errors.name) {
    rules.name = [{ required: true, message: form.errors.name, trigger: 'blur' }]
  }
  if (form.errors.phone) {
    rules.phone = [{ required: true, message: form.errors.phone, trigger: 'blur' }]
  }
  return rules
})

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  submitting.value = true
  try {
    const normalizedName = normalizePersonName(form.values.name, 50)
    const normalizedPhone = normalizePhoneDigits(form.values.phone)

    const response = await unifiedApi.post('/customers', {
      ...form.values,
      name: normalizedName,
      phone: normalizedPhone
    })
    ElMessage.success('客户创建成功')
    emit('success', extractResponseData(response))
    dialogVisible.value = false
    reset()
  } catch (err: any) {
    ElMessage.error(err.message || '创建客户失败')
  } finally {
    submitting.value = false
  }
}
</script>
