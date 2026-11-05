<template>
  <div class="marketing-page">
    <PublicPriceHeader title="营销文案">
      <template #search>
        <div
          v-if="canViewField('context.auto_context')"
          class="hero-copy"
        >
          <div class="hero-tags">
            <el-tag
              v-for="tag in heroTags"
              :key="tag"
              effect="dark"
              round
              class="hero-tag"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>
      </template>
    </PublicPriceHeader>

    <div class="page-body">
      <el-card
        class="editor-card"
        shadow="never"
      >
        <div class="card-head">
          <div>
            <h2>文案参数设置</h2>
          </div>
        </div>

        <el-tabs
          v-if="canViewField('filters.mode')"
          v-model="form.mode"
          class="mode-tabs tf-page-tabs"
          type="card"
        >
          <el-tab-pane
            label="营业"
            name="opening"
            class="tf-tab-panel"
          />
          <el-tab-pane
            label="销售"
            name="sales"
            class="tf-tab-panel"
          />
        </el-tabs>

        <el-form
          :model="form"
          label-position="top"
          class="marketing-form"
        >
          <div
            v-if="form.mode === 'sales' && (canViewField('filters.condition') || canViewField('context.subsidy') || canViewField('context.color') || canViewField('context.weather') || canViewField('context.solar_term') || canViewField('filters.brand') || canViewField('filters.model') || canViewField('filters.color') || canViewField('filters.memory'))"
            class="form-grid"
          >
            <div
              v-if="canViewField('filters.condition') || canViewField('context.subsidy') || canViewField('context.color') || canViewField('context.weather') || canViewField('context.solar_term')"
              class="marketing-toggle-row"
            >
              <div
                v-if="canViewField('filters.condition')"
                class="marketing-condition-item"
              >
                <div class="marketing-switch-title">
                  成色
                </div>
                <el-radio-group
                  v-model="form.condition"
                  class="condition-buttons"
                >
                  <el-radio-button label="new">
                    全新
                  </el-radio-button>
                  <el-radio-button label="used">
                    二手
                  </el-radio-button>
                </el-radio-group>
              </div>

              <div
                v-if="subsidyAvailable && canViewField('context.subsidy')"
                class="marketing-switch-item"
              >
                <div class="marketing-switch-title">
                  国补
                </div>
                <el-switch
                  v-model="useSubsidy"
                  class="subsidy-switch"
                  @change="refreshVariants(true)"
                />
              </div>

              <div
                v-if="canViewField('context.color')"
                class="marketing-switch-item"
              >
                <div class="marketing-switch-title">
                  颜色
                </div>
                <el-switch
                  v-model="useColor"
                  @change="refreshVariants(true)"
                />
              </div>

              <div
                v-if="weatherAvailable && canViewField('context.weather')"
                class="marketing-switch-item"
              >
                <div class="marketing-switch-title">
                  天气
                </div>
                <el-switch
                  v-model="useWeather"
                  @change="refreshVariants(true)"
                />
              </div>

              <div
                v-if="solarTermAvailable && canViewField('context.solar_term')"
                class="marketing-switch-item"
              >
                <div class="marketing-switch-title">
                  节气
                </div>
                <el-switch
                  v-model="useSolarTerm"
                  @change="refreshVariants(true)"
                />
              </div>
            </div>

            <el-form-item
              v-if="canViewField('filters.brand')"
              label="品牌"
            >
              <el-select
                v-model="form.brandId"
                class="full-width"
                filterable
                clearable
                placeholder="请选择品牌"
                :loading="loadingBrands"
                @change="handleBrandChange"
              >
                <el-option
                  v-for="brand in brandOptions"
                  :key="brand.id"
                  :label="brand.name"
                  :value="brand.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item
              v-if="canViewField('filters.model')"
              label="型号"
            >
              <el-select
                v-model="form.modelId"
                class="full-width"
                filterable
                clearable
                placeholder="请选择型号"
                :loading="loadingModels"
                :disabled="!form.brandId"
                @change="handleModelChange"
              >
                <el-option
                  v-for="model in modelOptions"
                  :key="model.id"
                  :label="model.name"
                  :value="model.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item
              v-if="canViewField('filters.color')"
              label="颜色"
            >
              <el-select
                v-model="form.colorId"
                class="full-width"
                filterable
                clearable
                placeholder="请选择颜色"
                :loading="loadingColors"
                @change="handleColorChange"
              >
                <el-option
                  v-for="color in colorOptions"
                  :key="color.id"
                  :label="color.name"
                  :value="color.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item
              v-if="canViewField('filters.memory')"
              label="内存"
            >
              <el-select
                v-model="form.memoryId"
                class="full-width"
                filterable
                clearable
                placeholder="请选择内存"
                :loading="loadingMemories"
                @change="handleMemoryChange"
              >
                <el-option
                  v-for="memory in memoryOptions"
                  :key="memory.id"
                  :label="memory.size"
                  :value="memory.id"
                />
              </el-select>
            </el-form-item>
          </div>
        </el-form>

        <div
          v-if="shouldShowActionColumn(canViewField('system_info.operations'), [])"
          class="form-actions"
        >
          <el-button
            :loading="locationLoading"
            @click="refreshAutoContext"
          >
            <span>定位</span>
          </el-button>
          <el-button
            type="primary"
            :loading="generating"
            @click="refreshVariants(true)"
          >
            <span>换一批</span>
          </el-button>
          <el-button
            type="success"
            :disabled="!suggestions.length"
            @click="copyAllVariants"
          >
            <span>复制全部</span>
          </el-button>
          <el-button @click="resetForm">
            清空
          </el-button>
        </div>
      </el-card>

      <el-card
        v-if="canViewField('context.preview')"
        class="result-card"
        shadow="never"
      >
        <div class="card-head">
          <div>
            <h2>文案结果</h2>
          </div>
        </div>

        <div
          v-if="suggestions.length"
          class="copy-grid"
        >
          <article
            v-for="item in suggestions"
            :key="item.id"
            class="copy-card"
          >
            <div class="copy-card__head">
              <div>
                <div class="copy-title">
                  {{ item.title }}
                </div>
                <div class="copy-tone">
                  {{ item.tone }}
                </div>
              </div>
              <el-button
                v-if="shouldShowActionColumn(canViewField('system_info.operations'), [])"
                circle
                size="small"
                plain
                class="copy-button"
                title="复制文案"
                aria-label="复制文案"
                @click="copySingleVariant(item)"
              >
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </div>

            <div class="copy-text">
              {{ item.text }}
            </div>
          </article>
        </div>

        <DataEmptyState
          v-else
          state="initial"
          :description="hasConfiguredTypeLexicon ? '正在生成文案' : '请先在后台词库中添加至少一条类型语录'"
        />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import {
  CopyDocument
} from '@element-plus/icons-vue'
import { PublicPriceHeader } from '@/components/base'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { getPublicBrands, getPublicColors, getPublicMarketingLexicon, getPublicMemories, getPublicModels, type Brand, type Color, type Memory, type Model } from '@/api/base-data'
import { TimeUtil } from '@/utils/time'
import { loadMarketingAutoContext } from '@/services/marketing-context'
import {
  DEFAULT_MARKETING_LEXICON,
  buildMarketingAutoContext,
  generateMarketingCopySuggestions,
  getConfiguredMarketingCopyTypes,
  type MarketingAutoContext,
  type MarketingLexicon,
  type MarketingCondition,
  type MarketingCopySuggestion,
  type MarketingMode
} from '@/utils/marketing'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


interface MarketingFormState {
  mode: MarketingMode
  condition: MarketingCondition
  brandId: number | null
  modelId: number | null
  colorId: number | null
  memoryId: number | null
}

const MARKETING_FIELD_MODULE_KEY = 'marketing'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(
  MARKETING_FIELD_MODULE_KEY,
  fieldKey
)

const form = reactive<MarketingFormState>({
  mode: 'opening',
  condition: 'new',
  brandId: null,
  modelId: null,
  colorId: null,
  memoryId: null
})

const brandOptions = ref<Brand[]>([])
const modelOptions = ref<Model[]>([])
const colorOptions = ref<Color[]>([])
const memoryOptions = ref<Memory[]>([])
const loadingBrands = ref(false)
const loadingModels = ref(false)
const loadingColors = ref(false)
const loadingMemories = ref(false)
const locationLoading = ref(false)
const generating = ref(false)
const locationStatus = ref('正在自动获取定位...')
const generationNonce = ref(0)
const suggestions = ref<MarketingCopySuggestion[]>([])
const marketingLexicon = ref<MarketingLexicon>(DEFAULT_MARKETING_LEXICON)
const useSubsidy = ref(false)
const useColor = ref(false)
const useWeather = ref(false)
const useSolarTerm = ref(false)
const autoContext = ref<MarketingAutoContext>(
  buildMarketingAutoContext({
    date: TimeUtil.now().toDate()
  })
)

const heroTags = computed(() => [
  '自动应景',
  autoContext.value.timeSegment,
  autoContext.value.weatherText || '天气未获取',
  autoContext.value.holidayCue || '无节日',
  autoContext.value.solarTermCue || '无节气',
  autoContext.value.locationName || '定位未获取'
].filter(Boolean))

const hasConfiguredTypeLexicon = computed(() => (
  getConfiguredMarketingCopyTypes(marketingLexicon.value).length > 0
))

const subsidyAvailable = computed(() => {
  if (marketingLexicon.value.subsidyEnabled !== true) return false
  const subsidy = marketingLexicon.value.contextLexicon?.subsidy
  if (Array.isArray(subsidy)) return subsidy.length > 0
  return Boolean(subsidy && Object.values(subsidy).some(values => Array.isArray(values) && values.length > 0))
})

const hasContextPhrases = (values: unknown) => {
  if (Array.isArray(values)) return values.some(item => String(item || '').trim())
  if (!values || typeof values !== 'object') return false
  return Object.values(values as Record<string, unknown>).some(value => (
    Array.isArray(value) && value.some(item => String(item || '').trim())
  ))
}

const _colorAvailable = computed(() => hasContextPhrases(marketingLexicon.value.contextLexicon?.color))
const weatherAvailable = computed(() => hasContextPhrases(marketingLexicon.value.contextLexicon?.weather))
const solarTermAvailable = computed(() => (
  hasContextPhrases(marketingLexicon.value.contextLexicon?.solarTerm) ||
  hasContextPhrases(marketingLexicon.value.eventLexicon?.solarTerms)
))

const selectedBrand = computed(() => canViewField('filters.brand') ? brandOptions.value.find(item => item.id === form.brandId)?.name || '' : '')
const selectedModel = computed(() => canViewField('filters.model') ? modelOptions.value.find(item => item.id === form.modelId)?.name || '' : '')
const selectedColor = computed(() => canViewField('filters.color') ? colorOptions.value.find(item => item.id === form.colorId)?.name || '' : '')
const selectedMemory = computed(() => {
  if (!canViewField('filters.memory')) return ''
  const item = memoryOptions.value.find(memory => memory.id === form.memoryId) as Memory & { name?: string } | undefined
  return String(item?.size || item?.name || item?.id || '').trim()
})

const loadBrandOptions = async () => {
  loadingBrands.value = true
  try {
    brandOptions.value = await getPublicBrands(true)
  } finally {
    loadingBrands.value = false
  }
}

const loadModelOptions = async (brandId?: number | null) => {
  loadingModels.value = true
  try {
    modelOptions.value = await getPublicModels(brandId || undefined)
  } finally {
    loadingModels.value = false
  }
}

const loadColorOptions = async () => {
  loadingColors.value = true
  try {
    colorOptions.value = await getPublicColors()
  } finally {
    loadingColors.value = false
  }
}

const loadMemoryOptions = async () => {
  loadingMemories.value = true
  try {
    memoryOptions.value = await getPublicMemories()
  } finally {
    loadingMemories.value = false
  }
}

const refreshAutoContext = async () => {
  locationLoading.value = true
  locationStatus.value = '正在自动获取定位...'

  try {
    const result = await loadMarketingAutoContext()
    autoContext.value = result.context
    locationStatus.value = result.statusText
  } finally {
    locationLoading.value = false
  }
}

const refreshVariants = async (bumpNonce = false) => {
  generating.value = true
  if (bumpNonce) {
    generationNonce.value += 1
  }

  await nextTick()

  const effectiveMode = canViewField('filters.mode') ? form.mode : 'opening'

  const localSuggestions = generateMarketingCopySuggestions({
    mode: effectiveMode,
    condition: canViewField('filters.condition') ? form.condition : 'new',
    product: {
      brand: selectedBrand.value,
      model: selectedModel.value,
      color: selectedColor.value,
      memory: selectedMemory.value
    },
    context: canViewField('context.auto_context')
      ? autoContext.value
      : {
        ...autoContext.value,
        locationName: '',
        weatherText: '',
        weatherCode: null,
        temperature: null,
        apparentTemperature: null,
        timeSegment: '',
        season: '',
        holidayCue: '',
        holidayName: '',
        solarTermCue: '',
        dayName: ''
      },
    lexicon: {
      ...marketingLexicon.value,
      subsidyEnabled: canViewField('context.subsidy') && effectiveMode === 'sales' && marketingLexicon.value.subsidyEnabled === true && useSubsidy.value,
      colorEnabled: canViewField('context.color') && effectiveMode === 'sales' && useColor.value,
      weatherEnabled: canViewField('context.weather') && effectiveMode === 'sales' && useWeather.value,
      solarTermEnabled: canViewField('context.solar_term') && effectiveMode === 'sales' && useSolarTerm.value
    },
    count: 12,
    nonce: generationNonce.value
  })

  suggestions.value = localSuggestions

  // 生成完全基于本地词库：每个类型和应景词库独立取词，
  // 不依赖外部模型接口，接口不可用也不会影响公开页。
  generating.value = false
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    globalNotifications.success('已复制到剪贴板')
  } catch {
    globalNotifications.warning('复制失败，请手动复制')
  }
}

const copySingleVariant = async (item: MarketingCopySuggestion) => {
  await copyText(`${item.title}\n${item.text}`)
}

const copyAllVariants = async () => {
  const text = suggestions.value
    .map(item => `${item.title}\n${item.text}`)
    .join('\n\n')

  if (!text.trim()) {
    globalNotifications.warning('还没有可复制的内容')
    return
  }

  await copyText(text)
}

const resetForm = () => {
  form.mode = 'opening'
  form.condition = 'new'
  useSubsidy.value = false
  useColor.value = false
  useWeather.value = false
  useSolarTerm.value = false
  form.brandId = null
  form.modelId = null
  form.colorId = null
  form.memoryId = null
  modelOptions.value = []
}

let refreshTimer: number | null = null
const scheduleRefresh = () => {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
  }

  refreshTimer = window.setTimeout(() => {
    void refreshVariants(false)
  }, 200)
}

watch(
  () => [
    form.mode,
    form.condition,
    useSubsidy.value,
    useColor.value,
    useWeather.value,
    useSolarTerm.value,
    form.brandId,
    form.modelId,
    form.colorId,
    form.memoryId,
    autoContext.value.locationName,
    autoContext.value.weatherText,
    autoContext.value.holidayCue,
    autoContext.value.solarTermCue,
    autoContext.value.timeSegment
  ],
  () => scheduleRefresh()
)

const handleBrandChange = async () => {
  form.modelId = null
  if (form.brandId) {
    await loadModelOptions(form.brandId)
  } else {
    modelOptions.value = []
  }
}

const handleModelChange = () => {
  // 预留给后续按型号联动颜色/内存的数据过滤
}

const handleColorChange = () => {
  // 预留给后续联动
}

const handleMemoryChange = () => {
  // 预留给后续联动
}

onMounted(async () => {
  await fieldPermissions.init()
  await Promise.all([
    loadBrandOptions(),
    loadColorOptions(),
    loadMemoryOptions(),
    getPublicMarketingLexicon().then((lexicon) => {
      const hasDatabaseLexicon = Boolean(
        lexicon.subsidyEnabled === true ||
        (lexicon.modeLexicon && Object.keys(lexicon.modeLexicon).length) ||
        (lexicon.typeLexicon && Object.keys(lexicon.typeLexicon).length) ||
        (lexicon.contextLexicon && Object.keys(lexicon.contextLexicon).length) ||
        (lexicon.eventLexicon && Object.keys(lexicon.eventLexicon).length)
      )
      if (hasDatabaseLexicon) {
        marketingLexicon.value = {
          ...DEFAULT_MARKETING_LEXICON,
          ...lexicon
        }
        // 国补词库由用户在公开页手动开启，后台启用状态不改变默认关闭状态。
        useSubsidy.value = false
        useColor.value = marketingLexicon.value.colorEnabled === true
        useWeather.value = marketingLexicon.value.weatherEnabled === true
        useSolarTerm.value = marketingLexicon.value.solarTermEnabled === true
      }
    }).catch(() => {
      // 词库读取失败时保持空结果，不注入本地业务文案。
    })
  ])
  if (canViewField('context.auto_context')) {
    await refreshAutoContext()
  }
  await refreshVariants(false)
})
</script>

<style scoped lang="scss" src="./styles/marketing-view/layout.scss"></style>
<style scoped lang="scss" src="./styles/marketing-view/copy-cards.scss"></style>
