<template>
  <MobileDialog
    v-model="visible"
    title="销售价格加价配置"
    width="600px"
    :close-on-click-modal="false"
    dialog-class="price-markup-dialog"
    :show-default-footer="false"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <!-- 加价模式选择 -->
      <el-form-item label="加价模式" prop="mode">
        <el-radio-group v-model="form.mode">
          <el-radio value="fixed">固定金额</el-radio>
          <el-radio value="percentage">百分比</el-radio>
        </el-radio-group>
        <div class="form-tip">
          <i class="fas fa-info-circle"></i>
          <span>固定金额：按固定金额加价；百分比：按批发价百分比加价</span>
        </div>
      </el-form-item>

      <!-- 固定金额模式 -->
      <template v-if="form.mode === 'fixed'">
        <el-form-item label="低档加价" prop="lowFixed">
          <div class="price-input-group">
            <span class="price-label">6000元以下</span>
            <el-input-number
              v-model="form.lowFixed"
              :min="0"
              :max="1000"
              :step="50"
              controls-position="right"
              class="price-input"
            />
            <span class="price-unit">元</span>
          </div>
        </el-form-item>

        <el-form-item label="高档加价" prop="highFixed">
          <div class="price-input-group">
            <span class="price-label">6000元及以上</span>
            <el-input-number
              v-model="form.highFixed"
              :min="0"
              :max="1000"
              :step="50"
              controls-position="right"
              class="price-input"
            />
            <span class="price-unit">元</span>
          </div>
        </el-form-item>
      </template>

      <!-- 百分比模式 -->
      <template v-if="form.mode === 'percentage'">
        <el-form-item label="低档加价" prop="lowPercent">
          <div class="price-input-group">
            <span class="price-label">6000元以下</span>
            <el-input-number
              v-model="form.lowPercent"
              :min="0"
              :max="50"
              :step="1"
              :precision="1"
              controls-position="right"
              class="price-input"
            />
            <span class="price-unit">%</span>
          </div>
        </el-form-item>

        <el-form-item label="高档加价" prop="highPercent">
          <div class="price-input-group">
            <span class="price-label">6000元及以上</span>
            <el-input-number
              v-model="form.highPercent"
              :min="0"
              :max="30"
              :step="1"
              :precision="1"
              controls-position="right"
              class="price-input"
            />
            <span class="price-unit">%</span>
          </div>
        </el-form-item>
      </template>

      <!-- 价格区间设置 -->
      <el-form-item label="价格分界点" prop="threshold">
        <div class="price-input-group">
          <el-input-number
            v-model="form.threshold"
            :min="1000"
            :max="20000"
            :step="1000"
            controls-position="right"
            class="price-input"
          />
          <span class="price-unit">元</span>
        </div>
        <div class="form-tip">
          <i class="fas fa-info-circle"></i>
          <span>低于此价格使用低档加价，高于或等于使用高档加价</span>
        </div>
      </el-form-item>

      <!-- 启用状态 -->
      <el-form-item label="状态">
        <el-switch
          v-model="form.enabled"
          active-text="启用"
          inactive-text="禁用"
        />
        <div class="form-tip">
          <i class="fas fa-info-circle"></i>
          <span>禁用后销售价格将直接显示批发价</span>
        </div>
      </el-form-item>
    </el-form>

    <!-- 价格预览 -->
    <div class="price-preview">
      <h4>价格预览</h4>
      <div class="preview-grid">
        <div class="preview-item">
          <span class="preview-label">批发价 3000元</span>
          <span class="preview-value">售价: {{ calculatePreview(3000) }}元</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">批发价 5000元</span>
          <span class="preview-value">售价: {{ calculatePreview(5000) }}元</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">批发价 6000元</span>
          <span class="preview-value">售价: {{ calculatePreview(6000) }}元</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">批发价 8000元</span>
          <span class="preview-value">售价: {{ calculatePreview(8000) }}元</span>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button type="default" @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSave" :loading="saving">
        <i class="fas fa-save"></i>
        保存配置
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { getMarkupConfig, saveMarkupConfig } from '@/api/price-list'
import type { ModelValueProps, UpdateModelValueEmits } from '@/types/component'
import { logger } from '@/utils/logger'

interface PriceMarkupConfig {
  mode: 'fixed' | 'percentage'
  lowFixed: number
  highFixed: number
  lowPercent: number
  highPercent: number
  threshold: number
  enabled: boolean
}

interface Props extends ModelValueProps {
  config?: PriceMarkupConfig
}

interface Emits extends UpdateModelValueEmits {
  'save': [config: PriceMarkupConfig]
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const formRef = ref<FormInstance>()
const saving = ref(false)
const loading = ref(false)

// 默认配置
const defaultConfig: PriceMarkupConfig = {
  mode: 'fixed',
  lowFixed: 250,
  highFixed: 200,
  lowPercent: 8.0,
  highPercent: 3.0,
  threshold: 6000,
  enabled: true
}

// 表单数据
const form = ref<PriceMarkupConfig>({ ...defaultConfig })

const normalizeConfig = (raw: any): PriceMarkupConfig => {
  const config = raw?.value && typeof raw.value === 'object' ? raw.value : raw
  if (!config || typeof config !== 'object') {
    return { ...defaultConfig }
  }

  return {
    mode: config.mode === 'percentage' ? 'percentage' : 'fixed',
    lowFixed: Number(config.lowFixed ?? defaultConfig.lowFixed),
    highFixed: Number(config.highFixed ?? defaultConfig.highFixed),
    lowPercent: Number(config.lowPercent ?? defaultConfig.lowPercent),
    highPercent: Number(config.highPercent ?? defaultConfig.highPercent),
    threshold: Number(config.threshold ?? defaultConfig.threshold),
    enabled: typeof config.enabled === 'boolean' ? config.enabled : defaultConfig.enabled
  }
}

// 从后端加载配置
const loadConfig = async () => {
  loading.value = true
  try {
    const response = await getMarkupConfig()
    if (response.success && response.data) {
      form.value = normalizeConfig(response.data)
    } else {
      form.value = { ...defaultConfig }
    }
  } catch (error) {
    logger.error('加载加价配置失败:', error)
    form.value = { ...defaultConfig }
  } finally {
    loading.value = false
  }
}

// 监听对话框打开，加载配置
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    loadConfig()
  }
})

// 监听传入的配置
watch(() => props.config, (newConfig) => {
  if (newConfig) {
    form.value = normalizeConfig(newConfig)
  }
}, { immediate: true })

// 表单验证规则
const rules = {
  lowFixed: [
    ValidationRules.required('请输入低档加价金额')
  ],
  highFixed: [
    ValidationRules.required('请输入高档加价金额')
  ],
  lowPercent: [
    ValidationRules.required('请输入低档加价百分比')
  ],
  highPercent: [
    ValidationRules.required('请输入高档加价百分比')
  ],
  threshold: [
    ValidationRules.required('请输入价格分界点')
  ]
}

/**
 * 计算预览价格
 */
const calculatePreview = (wholesalePrice: number): string => {
  if (!form.value.enabled) {
    return wholesalePrice.toString()
  }

  if (form.value.mode === 'fixed') {
    const markup = wholesalePrice < form.value.threshold ? form.value.lowFixed : form.value.highFixed
    return (wholesalePrice + markup).toString()
  } else {
    const markupPercent = wholesalePrice < form.value.threshold ? form.value.lowPercent : form.value.highPercent
    const markup = wholesalePrice * (markupPercent / 100)
    return (wholesalePrice + markup).toFixed(0)
  }
}

/**
 * 保存配置
 */
const handleSave = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    saving.value = true

    // 保存到后端服务器
    const response = await saveMarkupConfig(form.value)

    if (response.success) {
      // 触发保存事件
      emit('save', form.value)
      ElMessage.success('加价配置保存成功')
      visible.value = false
    } else {
      ElMessage.error(response.message || '保存失败')
    }
  } catch (error: any) {
    logger.error('保存配置失败:', error)
    if (error.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    } else if (error.message) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('保存配置失败')
    }
  } finally {
    saving.value = false
  }
}

/**
 * 关闭对话框
 */
const handleClose = () => {
  // 重置为原始配置
  if (props.config) {
    form.value = normalizeConfig(props.config)
  } else {
    form.value = { ...defaultConfig }
  }
}
</script>

<style scoped lang="scss">
.price-input-group {
  display: flex;
  align-items: center;
  gap: 12px;

  .price-label {
    flex: 1;
    color: #606266;
    font-size: 14px;
  }

  .price-input {
    width: 150px;
  }

  .price-unit {
    color: #909399;
    font-size: 14px;
    min-width: 30px;
  }
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;

  i {
    color: #409EFF;
  }
}

.price-preview {
  margin-top: 24px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;

  h4 {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: #303133;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    .preview-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: white;
      border-radius: 6px;
      border: 1px solid #dcdfe6;

      .preview-label {
        color: #606266;
        font-size: 13px;
      }

      .preview-value {
        color: #67c23a;
        font-weight: bold;
        font-size: 14px;
      }
    }
  }
}
</style>
