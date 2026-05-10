<template>
  <MobileDialog
    v-model="visible"
    title="价格加价配置"
    width="680px"
    :close-on-click-modal="false"
    dialog-class="price-markup-dialog"
    :show-default-footer="false"
    @close="handleClose"
  >
    <div class="markup-layout">
      <section class="overview-panel">
        <div class="overview-item">
          <span class="overview-label">销售模式</span>
          <strong class="overview-value">{{ getSaleModeLabel() }}</strong>
        </div>
        <div class="overview-item">
          <span class="overview-label">价格分界点</span>
          <strong class="overview-value">{{ form.threshold }} 元</strong>
        </div>
        <div class="overview-item">
          <span class="overview-label">批发显示</span>
          <strong class="overview-value">{{ form.wholesale.enabled ? '已启用' : '未启用' }}</strong>
        </div>
      </section>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px" class="markup-form">
        <section class="config-card">
          <div class="section-heading">
            <div>
              <h4 class="form-section-title">销售价规则</h4>
              <p class="section-subtitle">采集价转销售价</p>
            </div>
            <el-switch
              v-model="form.enabled"
              active-text="启用"
              inactive-text="禁用"
            />
          </div>

          <div class="inline-grid inline-grid--top">
            <el-form-item label="加价模式" prop="mode" class="compact-form-item">
              <el-radio-group v-model="form.mode" class="mode-group">
                <el-radio value="fixed">固定金额</el-radio>
                <el-radio value="percentage">百分比</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="价格分界点" prop="threshold" class="compact-form-item">
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
            </el-form-item>
          </div>

          <div class="tier-grid">
            <el-form-item v-if="form.mode === 'fixed'" label="" prop="lowFixed" class="tier-form-item">
              <div class="tier-card">
                <span class="price-label">低于{{ form.threshold }}元</span>
                <div class="tier-input-wrap">
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
              </div>
            </el-form-item>

            <el-form-item v-if="form.mode === 'fixed'" label="" prop="highFixed" class="tier-form-item">
              <div class="tier-card">
                <span class="price-label">高于{{ form.threshold }}元</span>
                <div class="tier-input-wrap">
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
              </div>
            </el-form-item>

            <el-form-item v-if="form.mode === 'percentage'" label="" prop="lowPercent" class="tier-form-item">
              <div class="tier-card">
                <span class="price-label">低于{{ form.threshold }}元</span>
                <div class="tier-input-wrap">
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
              </div>
            </el-form-item>

            <el-form-item v-if="form.mode === 'percentage'" label="" prop="highPercent" class="tier-form-item">
              <div class="tier-card">
                <span class="price-label">高于{{ form.threshold }}元</span>
                <div class="tier-input-wrap">
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
              </div>
            </el-form-item>
          </div>
        </section>

        <section class="config-card">
          <div class="section-heading">
            <div>
              <h4 class="form-section-title">批发显示价</h4>
              <p class="section-subtitle">公开报价页批发显示</p>
            </div>
            <el-switch
              v-model="form.wholesale.enabled"
              active-text="启用"
              inactive-text="禁用"
            />
          </div>

          <div class="inline-grid inline-grid--single">
            <el-form-item label="调整金额" class="compact-form-item">
              <div class="price-input-group">
                <el-input-number
                  v-model="form.wholesale.adjustment"
                  :min="-1000"
                  :max="1000"
                  :step="50"
                  controls-position="right"
                  class="price-input"
                />
                <span class="price-unit">元</span>
              </div>
            </el-form-item>
          </div>
        </section>
      </el-form>

      <section class="price-preview">
        <div class="section-heading">
          <div>
            <h4 class="form-section-title">价格预览</h4>
            <p class="section-subtitle">根据当前配置即时预估</p>
          </div>
        </div>
        <div class="preview-grid">
          <div class="preview-item">
            <span class="preview-label">采集价 {{ getLowTierPreviewPrice() }}元</span>
            <span class="preview-value">销售价: {{ calculatePreview(getLowTierPreviewPrice()) }}元</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">采集价 {{ getHighTierPreviewPrice() }}元</span>
            <span class="preview-value">销售价: {{ calculatePreview(getHighTierPreviewPrice()) }}元</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">采集价 5600元</span>
            <span class="preview-value preview-value--wholesale">批发价: {{ calculateWholesalePreview(5600) }}元</span>
          </div>
          <div class="preview-item">
            <span class="preview-label">采集价 8000元</span>
            <span class="preview-value preview-value--wholesale">批发价: {{ calculateWholesalePreview(8000) }}元</span>
          </div>
        </div>
      </section>
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
import { getMarkupConfig, saveMarkupConfig, type PriceMarkupConfig } from '@/api/price-list'
import type { ModelValueProps, UpdateModelValueEmits } from '@/types/component'
import { logger } from '@/utils/logger'

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
  enabled: true,
  wholesale: {
    enabled: false,
    adjustment: 0
  }
}

function normalizeConfig(raw: any): PriceMarkupConfig {
  const config = raw?.value && typeof raw.value === 'object' ? raw.value : raw
  if (!config || typeof config !== 'object') {
    return {
      mode: defaultConfig.mode,
      lowFixed: defaultConfig.lowFixed,
      highFixed: defaultConfig.highFixed,
      lowPercent: defaultConfig.lowPercent,
      highPercent: defaultConfig.highPercent,
      threshold: defaultConfig.threshold,
      enabled: defaultConfig.enabled,
      wholesale: {
        enabled: defaultConfig.wholesale.enabled,
        adjustment: defaultConfig.wholesale.adjustment
      }
    }
  }

  const wholesaleConfig = config.wholesale && typeof config.wholesale === 'object'
    ? config.wholesale
    : {}

  return {
    mode: config.mode === 'percentage' ? 'percentage' : 'fixed',
    lowFixed: Number(config.lowFixed ?? defaultConfig.lowFixed),
    highFixed: Number(config.highFixed ?? defaultConfig.highFixed),
    lowPercent: Number(config.lowPercent ?? defaultConfig.lowPercent),
    highPercent: Number(config.highPercent ?? defaultConfig.highPercent),
    threshold: Number(config.threshold ?? defaultConfig.threshold),
    enabled: typeof config.enabled === 'boolean' ? config.enabled : defaultConfig.enabled,
    wholesale: {
      enabled: typeof wholesaleConfig.enabled === 'boolean'
        ? wholesaleConfig.enabled
        : defaultConfig.wholesale.enabled,
      adjustment: Number(wholesaleConfig.adjustment ?? defaultConfig.wholesale.adjustment)
    }
  }
}

// 表单数据
const form = ref<PriceMarkupConfig>(normalizeConfig(defaultConfig))

// 从后端加载配置
const loadConfig = async () => {
  loading.value = true
  try {
    const response = await getMarkupConfig()
    if (response.success && response.data) {
      form.value = normalizeConfig(response.data)
    } else {
      form.value = normalizeConfig(defaultConfig)
    }
  } catch (error) {
    logger.error('加载加价配置失败:', error)
    form.value = normalizeConfig(defaultConfig)
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

const calculateWholesalePreview = (wholesalePrice: number): string => {
  if (!form.value.wholesale.enabled) {
    return wholesalePrice.toString()
  }

  return (wholesalePrice + Number(form.value.wholesale.adjustment || 0)).toFixed(0)
}

const getLowTierPreviewPrice = (): number => {
  const threshold = Number(form.value.threshold || 6000)
  return Math.max(1, threshold - 1000)
}

const getHighTierPreviewPrice = (): number => {
  const threshold = Number(form.value.threshold || 6000)
  return threshold + 1000
}

const getSaleModeLabel = (): string => {
  return form.value.mode === 'percentage' ? '百分比' : '固定金额'
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
      emit('save', normalizeConfig(form.value))
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
    form.value = normalizeConfig(defaultConfig)
  }
}
</script>

<style scoped lang="scss">
.markup-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.markup-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.overview-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.overview-item {
  padding: 14px 16px;
  background: #f6f7f9;
  border: 1px solid #e7e9ee;
  border-radius: 14px;
}

.overview-label {
  display: block;
  margin-bottom: 6px;
  color: #8a94a6;
  font-size: 12px;
}

.overview-value {
  color: #111827;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.config-card,
.price-preview {
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e7e9ee;
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.form-section-title {
  margin: 0;
  color: #111827;
  font-size: 17px;
  font-weight: 700;
}

.section-subtitle {
  margin: 3px 0 0;
  color: #8a94a6;
  font-size: 12px;
  line-height: 1.5;
}

.inline-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 20px;
  align-items: start;
}

.inline-grid--top {
  margin-bottom: 18px;
}

.inline-grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tier-form-item,
.compact-form-item {
  margin-bottom: 0;
}

.tier-form-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.mode-group {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.tier-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
  padding: 16px;
  background: #fafbfc;
  border: 1px solid #eceef2;
  border-radius: 14px;
}

.tier-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.price-input-group {
  display: flex;
  align-items: center;
  gap: 12px;

  .price-label {
    color: #374151;
    font-size: 14px;
    font-weight: 600;
  }

  .price-input {
    width: 160px;
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
  color: #8a94a6;
  font-size: 12px;
  line-height: 1.5;
}

.price-preview {
  .preview-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;

    .preview-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      justify-content: space-between;
      padding: 12px 14px;
      background: #fafbfc;
      border-radius: 14px;
      border: 1px solid #eceef2;

      .preview-label {
        color: #607089;
        font-size: 13px;
      }

      .preview-value {
        color: #67c23a;
        font-weight: bold;
        font-size: 14px;
      }

      .preview-value--wholesale {
        color: #409eff;
      }
    }
  }
}

@media (max-width: 768px) {
  .overview-panel {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .config-card,
  .price-preview {
    padding: 14px;
    border-radius: 12px;
  }

  .inline-grid,
  .tier-grid,
  .price-preview .preview-grid {
    grid-template-columns: 1fr;
  }

  .price-input-group,
  .tier-input-wrap {
    width: 100%;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .price-input-group {
    gap: 10px;
  }

  .price-input-group .price-input,
  .tier-input-wrap .price-input {
    flex: 1;
    width: auto;
  }
}
</style>
