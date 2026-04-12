<template>
  <MobileDialog
    v-model="dialogVisible"
    title="预定单交付"
    width="500px"
    :close-on-click-modal="false"
    dialog-class="preorder-dialog preorder-deliver-dialog"
    :show-default-footer="false"
  >
    <div v-if="preorder">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="预定单号">
          {{ preorder.preorder_number }}
        </el-descriptions-item>
        <el-descriptions-item label="客户">
          {{ preorder.customer_name }}
        </el-descriptions-item>
        <el-descriptions-item label="商品信息" :span="2">
          {{ preorder.product_name }}
        </el-descriptions-item>
        <el-descriptions-item label="IMEI">
          {{ preorder.imei || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="定金">
          ¥{{ preorder.advance_payment?.toFixed(2) }}
        </el-descriptions-item>
        <el-descriptions-item label="约定价格">
          ¥{{ preorder.expected_price?.toFixed(2) || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="尾款">
          ¥{{ (preorder.remaining_amount || 0).toFixed(2) }}
        </el-descriptions-item>
      </el-descriptions>

      <el-form
        ref="formRef"
        :model="formData"
        label-width="100px"
        style="margin-top: 20px"
      >
        <el-form-item label="实际价格">
          <el-input-number
            v-model="formData.actual_price"
            :min="0"
            :precision="2"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="formData.notes"
            type="textarea"
            :rows="2"
            placeholder="请输入备注信息"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button type="default" @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        确认交付
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { preorderApi, Preorder } from '@/api/preorder'
import type { ModalProps, SuccessEmits, UpdateVisibleEmits } from '@/types'

interface Props extends ModalProps {
  preorder: Preorder | null
}

const props = defineProps<Props>()
const emit = defineEmits<UpdateVisibleEmits & SuccessEmits>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const submitting = ref(false)

const formData = reactive({
  actual_price: 0,
  notes: ''
})

watch(() => props.preorder, (preorder) => {
  if (preorder) {
    formData.actual_price = preorder.expected_price || preorder.actual_price || 0
    formData.notes = ''
  }
}, { immediate: true })

const handleSubmit = async () => {
  if (!props.preorder) return

  submitting.value = true
  try {
    await preorderApi.deliverPreorder(props.preorder.id, formData)
    ElMessage.success('预定单交付成功')
    emit('success')
    dialogVisible.value = false
  } catch (err: any) {
    ElMessage.error(err.message || '交付失败')
  } finally {
    submitting.value = false
  }
}
</script>
