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
    <div
      v-loading="loading"
      class="markup-layout"
    >
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

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="92px"
        class="markup-form"
      >
        <section class="config-card">
          <div class="section-heading">
            <div>
              <h4 class="form-section-title">
                销售加价规则
              </h4>
              <p class="section-subtitle">
                开启销售加价模式
              </p>
            </div>
            <el-switch
              v-model="form.enabled"
              active-text="启用"
              inactive-text="禁用"
            />
          </div>

          <div class="inline-grid inline-grid--top">
            <el-form-item
              label="加价模式"
              prop="mode"
              class="compact-form-item"
            >
              <el-radio-group
                v-model="form.mode"
                class="mode-group"
              >
                <el-radio value="fixed">
                  固定金额
                </el-radio>
                <el-radio value="percentage">
                  百分比
                </el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item
              label="价格分界点"
              prop="threshold"
              class="compact-form-item"
            >
              <div class="price-input-group">
                <el-input-number
                  v-model="form.threshold"
                  :min="1000"
                  :max="20000"
                  :step="1000"
                  :controls="false"
                  class="price-input"
                />
                <span class="price-unit">元</span>
              </div>
            </el-form-item>
          </div>

          <div class="tier-grid">
            <el-form-item
              v-if="form.mode === 'fixed'"
              label=""
              prop="lowFixed"
              class="tier-form-item"
            >
              <div class="tier-card">
                <span class="price-label">低于{{ form.threshold }}元</span>
                <div class="tier-input-wrap">
                  <el-input-number
                    v-model="form.lowFixed"
                    :min="0"
                    :max="1000"
                    :step="50"
                    :controls="false"
                    class="price-input"
                  />
                  <span class="price-unit">元</span>
                </div>
              </div>
            </el-form-item>

            <el-form-item
              v-if="form.mode === 'fixed'"
              label=""
              prop="highFixed"
              class="tier-form-item"
            >
              <div class="tier-card">
                <span class="price-label">高于{{ form.threshold }}元</span>
                <div class="tier-input-wrap">
                  <el-input-number
                    v-model="form.highFixed"
                    :min="0"
                    :max="1000"
                    :step="50"
                    :controls="false"
                    class="price-input"
                  />
                  <span class="price-unit">元</span>
                </div>
              </div>
            </el-form-item>

            <el-form-item
              v-if="form.mode === 'percentage'"
              label=""
              prop="lowPercent"
              class="tier-form-item"
            >
              <div class="tier-card">
                <span class="price-label">低于{{ form.threshold }}元</span>
                <div class="tier-input-wrap">
                  <el-input-number
                    v-model="form.lowPercent"
                    :min="0"
                    :max="50"
                    :step="1"
                    :precision="1"
                    :controls="false"
                    class="price-input"
                  />
                  <span class="price-unit">%</span>
                </div>
              </div>
            </el-form-item>

            <el-form-item
              v-if="form.mode === 'percentage'"
              label=""
              prop="highPercent"
              class="tier-form-item"
            >
              <div class="tier-card">
                <span class="price-label">高于{{ form.threshold }}元</span>
                <div class="tier-input-wrap">
                  <el-input-number
                    v-model="form.highPercent"
                    :min="0"
                    :max="30"
                    :step="1"
                    :precision="1"
                    :controls="false"
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
              <h4 class="form-section-title">
                批发加价规则
              </h4>
              <p class="section-subtitle">
                开启批发价格模式
              </p>
            </div>
            <el-switch
              v-model="form.wholesale.enabled"
              active-text="启用"
              inactive-text="禁用"
            />
          </div>

          <div class="inline-grid inline-grid--single">
            <el-form-item
              label="默认加价"
              class="compact-form-item"
            >
              <div class="price-input-group">
                <el-input-number
                  v-model="form.wholesale.adjustment"
                  :min="-1000"
                  :max="1000"
                  :step="50"
                  :controls="false"
                  class="price-input"
                />
                <span class="price-unit">元</span>
              </div>
            </el-form-item>
          </div>

          <div class="source-adjustment-section">
            <div class="source-adjustment-heading">
              <div>
                <span class="source-adjustment-title">采集来源加价</span>
                <p class="section-subtitle">
                  未单独设置的来源自动跟随默认加价
                </p>
              </div>
            </div>

            <div
              v-if="syncSources.length"
              class="source-adjustment-list"
            >
              <div
                v-for="source in syncSources"
                :key="source.id"
                class="source-adjustment-row"
              >
                <div class="source-adjustment-name">
                  <span class="source-adjustment-name-text">{{ getSourceLabel(source) }}</span>
                  <span class="source-adjustment-type">
                    {{ source.source_type === 'public' ? '公开未登录' : '登录账户' }}
                  </span>
                </div>
                <div class="price-input-group source-adjustment-input">
                  <el-input-number
                    :model-value="getSourceAdjustment(source.id)"
                    :min="-1000"
                    :max="1000"
                    :step="50"
                    :controls="false"
                    placeholder="跟随默认"
                    @update:model-value="(value) => setSourceAdjustment(source.id, value)"
                  />
                  <span class="price-unit">元</span>
                </div>
              </div>
            </div>
            <p
              v-else
              class="source-adjustment-empty"
            >
              暂无已配置的采集来源，请先在同步配置中添加账户。
            </p>
          </div>
        </section>
      </el-form>

      <section class="price-preview">
        <div class="section-heading">
          <div>
            <h4 class="form-section-title">
              价格预览
            </h4>
            <p class="section-subtitle">
              根据当前配置即时预估
            </p>
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
        <div
          v-if="syncSources.length"
          class="source-preview-list"
        >
          <div
            v-for="source in syncSources"
            :key="`preview-${source.id}`"
            class="source-preview-item"
          >
            <span>{{ getSourceLabel(source) }}批发价（采集价 5600 元）</span>
            <strong>{{ calculateSourceWholesalePreview(5600, source.id) }} 元</strong>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <el-button
        type="default"
        @click="visible = false"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="saving"
        @click="handleSave"
      >
        <i class="fas fa-save" />
        保存配置
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import {
  getAllSyncConfigs,
  getMarkupConfig,
  saveMarkupConfig,
  type PriceMarkupConfig
} from '@/api/price-list'
import type { ModelValueProps, UpdateModelValueEmits } from '@/types/component'
import { logger } from '@/utils/logger'

interface Props extends ModelValueProps {
  config?: PriceMarkupConfig
}

interface Emits extends UpdateModelValueEmits {
  'save': [config: PriceMarkupConfig]
}

interface SyncSource {
  id: number
  config_name?: string
  source_type?: 'account' | 'public' | string
  login_username?: string
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
    adjustment: 0,
    sourceAdjustments: {}
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
        adjustment: defaultConfig.wholesale.adjustment,
        sourceAdjustments: {}
      }
    }
  }

  const wholesaleConfig = config.wholesale && typeof config.wholesale === 'object'
    ? config.wholesale
    : {}
  const sourceAdjustments = wholesaleConfig.sourceAdjustments
    && typeof wholesaleConfig.sourceAdjustments === 'object'
    ? Object.entries(wholesaleConfig.sourceAdjustments).reduce<Record<string, number>>(
      (result, [sourceId, adjustment]) => {
        const value = Number(adjustment)
        if (sourceId && Number.isFinite(value)) {
          result[String(sourceId)] = value
        }
        return result
      },
      {}
    )
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
      adjustment: Number(wholesaleConfig.adjustment ?? defaultConfig.wholesale.adjustment),
      sourceAdjustments
    }
  }
}

// 表单数据
const form = ref<PriceMarkupConfig>(normalizeConfig(defaultConfig))
const syncSources = ref<SyncSource[]>([])

// 从后端加载配置
const loadConfig = async () => {
  loading.value = true
  try {
    const [configResult, sourcesResult] = await Promise.allSettled([
      getMarkupConfig(),
      getAllSyncConfigs()
    ])
    if (configResult.status === 'fulfilled' && configResult.value.success && configResult.value.data) {
      form.value = normalizeConfig(configResult.value.data)
    } else {
      form.value = normalizeConfig(defaultConfig)
    }
    if (sourcesResult.status === 'fulfilled' && sourcesResult.value.success && Array.isArray(sourcesResult.value.data)) {
      syncSources.value = sourcesResult.value.data
        .map((source: SyncSource) => ({
          ...source,
          id: Number(source.id)
        }))
        .filter(source => Number.isInteger(source.id) && source.id > 0)
    } else {
      syncSources.value = []
      if (sourcesResult.status === 'rejected') {
        logger.warn('加载采集来源失败，批发加价仍可使用默认规则', sourcesResult.reason)
      }
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
}, { immediate: true })

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

const getSourceLabel = (source: SyncSource): string => {
  if (source.config_name) return source.config_name
  if (source.source_type === 'public') return '公开来源'
  return source.login_username ? `账户${source.login_username}` : `来源${source.id}`
}

const getSourceAdjustment = (sourceId: number): number | null => {
  const value = form.value.wholesale.sourceAdjustments[String(sourceId)]
  return Number.isFinite(value) ? value : null
}

const setSourceAdjustment = (sourceId: number, value: number | null | undefined) => {
  const sourceKey = String(sourceId)
  const nextAdjustments = { ...form.value.wholesale.sourceAdjustments }
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    delete nextAdjustments[sourceKey]
  } else {
    nextAdjustments[sourceKey] = Number(value)
  }
  form.value.wholesale.sourceAdjustments = nextAdjustments
}

const calculateSourceWholesalePreview = (wholesalePrice: number, sourceId: number): string => {
  if (!form.value.wholesale.enabled) return wholesalePrice.toString()
  const adjustment = getSourceAdjustment(sourceId)
  const amount = adjustment === null
    ? Number(form.value.wholesale.adjustment || 0)
    : adjustment
  return (wholesalePrice + amount).toFixed(0)
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
  if (saving.value) return
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
  background: var(--tf-color-surface-neutral-alt);
  border: 1px solid var(--tf-color-border-neutral);
  border-radius: 14px;
}

.overview-label {
  display: block;
  margin-bottom: 6px;
  color: var(--tf-color-gray-ui-alt);
  font-size: var(--tf-type-scale-12);
}

.overview-value {
  color: var(--tf-color-neutral-900);
  font-size: var(--tf-type-scale-17);
  font-weight: 700;
  letter-spacing: 0.01em;
}

.config-card,
.price-preview {
  padding: 20px;
  background: var(--color-bg-white);
  border: 1px solid var(--tf-color-border-neutral);
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
  color: var(--tf-color-neutral-900);
  font-size: var(--tf-type-scale-17);
  font-weight: 700;
}

.section-subtitle {
  margin: 3px 0 0;
  color: var(--tf-color-gray-ui-alt);
  font-size: var(--tf-type-scale-12);
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
  background: var(--tf-color-surface-neutral);
  border: 1px solid var(--tf-color-border-neutral-alt);
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
    color: var(--tf-color-neutral-700);
    font-size: var(--tf-type-scale-14);
    font-weight: 600;
  }

  .price-input {
    width: 160px;
  }

  .price-unit {
    color: var(--color-info);
    font-size: var(--tf-type-scale-14);
    min-width: 30px;
  }
}
</style>

<style scoped lang="scss">

.source-adjustment-section {
  margin-top: var(--tf-space-1);
  padding-top: var(--tf-space-4);
  border-top: 1px solid var(--tf-color-border-neutral-alt);
}

.source-adjustment-heading {
  margin-bottom: var(--tf-space-3);
}

.source-adjustment-title {
  color: var(--tf-color-neutral-800);
  font-size: var(--tf-type-scale-14);
  font-weight: 700;
}

.source-adjustment-list {
  display: grid;
  gap: var(--tf-space-2);
}

.source-adjustment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tf-space-4);
  min-height: 48px;
  padding: var(--tf-space-2) var(--tf-space-3);
  background: var(--tf-color-surface-neutral);
  border: 1px solid var(--tf-color-border-neutral-alt);
  border-radius: var(--tf-radius-card);
}

.source-adjustment-name {
  display: flex;
  align-items: baseline;
  gap: var(--tf-space-2);
  min-width: 0;
}

.source-adjustment-name-text {
  overflow: hidden;
  color: var(--tf-color-neutral-800);
  font-size: var(--tf-type-scale-14);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-adjustment-type {
  flex: 0 0 auto;
  color: var(--tf-color-gray-ui-alt);
  font-size: var(--tf-type-scale-12);
}

.source-adjustment-input {
  flex: 0 0 170px;
  justify-content: flex-end;
}

.source-adjustment-input :deep(.el-input-number) {
  width: 130px;
}

.source-adjustment-empty {
  margin: 0;
  color: var(--tf-color-gray-ui-alt);
  font-size: var(--tf-type-scale-13);
}

.form-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: var(--tf-color-gray-ui-alt);
  font-size: var(--tf-type-scale-12);
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
      background: var(--tf-color-surface-neutral);
      border-radius: 14px;
      border: 1px solid var(--tf-color-border-neutral-alt);

      .preview-label {
        color: var(--tf-color-slate-500);
        font-size: var(--tf-type-scale-13);
      }

      .preview-value {
        color: var(--color-success);
        font-weight: bold;
        font-size: var(--tf-type-scale-14);
      }

      .preview-value--wholesale {
        color: var(--color-primary);
      }
    }
  }
}

.source-preview-list {
  display: grid;
  gap: var(--tf-space-2);
  margin-top: var(--tf-space-3);
}

.source-preview-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tf-space-3);
  padding: var(--tf-space-2) var(--tf-space-3);
  color: var(--tf-color-gray-ui-alt);
  font-size: var(--tf-type-scale-12);
  background: var(--tf-color-surface-neutral);
  border-radius: var(--tf-radius-card);
}

.source-preview-item strong {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: var(--tf-type-scale-14);
}

@media (max-width: 767px) {
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

  .source-adjustment-row {
    align-items: stretch;
    flex-direction: column;
    gap: var(--tf-space-2);
  }

  .source-adjustment-input {
    flex-basis: auto;
    justify-content: flex-start;
    width: 100%;
  }

  .source-adjustment-input :deep(.el-input-number) {
    flex: 1;
    width: auto;
  }

  .source-preview-item {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--tf-space-1);
  }
}
</style>
