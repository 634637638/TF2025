<template>
  <div class="marketing-page">
    <PublicPriceHeader title="营销文案">
      <template #search>
        <div class="hero-copy">
          <div class="hero-tags">
            <el-tag v-for="tag in heroTags" :key="tag" effect="dark" round class="hero-tag">
              {{ tag }}
            </el-tag>
          </div>
        </div>
      </template>

    </PublicPriceHeader>

    <div class="page-body">
      <el-card class="editor-card" shadow="never">
        <div class="card-head">
          <div>
            <h2>文案参数设置</h2>
          </div>
        </div>

        <el-tabs v-model="form.mode" class="mode-tabs tf-page-tabs" type="card">
          <el-tab-pane label="营业" name="opening" class="tf-tab-panel" />
          <el-tab-pane label="销售" name="sales" class="tf-tab-panel" />
        </el-tabs>

        <el-form :model="form" label-position="top" class="marketing-form">
          <div v-if="form.mode === 'sales'" class="form-grid">
            <div v-if="form.mode === 'sales'" class="marketing-toggle-row">
              <div class="marketing-condition-item">
                <div class="marketing-switch-title">机况</div>
                <el-radio-group v-model="form.condition" class="condition-buttons">
                  <el-radio-button label="new">全新</el-radio-button>
                  <el-radio-button label="used">二手</el-radio-button>
                </el-radio-group>
              </div>

              <div v-if="subsidyAvailable" class="marketing-switch-item">
                <div class="marketing-switch-title">国补</div>
                <el-switch
                  v-model="useSubsidy"
                  class="subsidy-switch"
                  @change="refreshVariants(true)"
                />
              </div>

              <div class="marketing-switch-item">
                <div class="marketing-switch-title">颜色</div>
                <el-switch
                  v-model="useColor"
                  @change="refreshVariants(true)"
                />
              </div>

              <div v-if="weatherAvailable" class="marketing-switch-item">
                <div class="marketing-switch-title">天气</div>
                <el-switch
                  v-model="useWeather"
                  @change="refreshVariants(true)"
                />
              </div>

              <div v-if="solarTermAvailable" class="marketing-switch-item">
                <div class="marketing-switch-title">节气</div>
                <el-switch
                  v-model="useSolarTerm"
                  @change="refreshVariants(true)"
                />
              </div>
            </div>

            <el-form-item label="品牌">
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

            <el-form-item label="型号">
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

            <el-form-item label="颜色">
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

            <el-form-item label="内存">
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

        <div class="form-actions">
          <el-button :loading="locationLoading" @click="refreshAutoContext">
            <span>定位</span>
          </el-button>
          <el-button type="primary" :loading="generating" @click="refreshVariants(true)">
            <span>换一批</span>
          </el-button>
          <el-button type="success" :disabled="!suggestions.length" @click="copyAllVariants">
            <span>复制全部</span>
          </el-button>
          <el-button @click="resetForm">清空</el-button>
        </div>
      </el-card>

      <el-card class="result-card" shadow="never">
        <div class="card-head">
          <div>
            <h2>文案结果</h2>
          </div>
        </div>

        <div v-if="suggestions.length" class="copy-grid">
          <article v-for="item in suggestions" :key="item.id" class="copy-card">
            <div class="copy-card__head">
              <div>
                <div class="copy-title">{{ item.title }}</div>
                <div class="copy-tone">{{ item.tone }}</div>
              </div>
              <el-button
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

            <div class="copy-text">{{ item.text }}</div>
          </article>
        </div>

        <div v-else class="empty-state">
          <el-empty :description="hasConfiguredTypeLexicon ? '正在生成文案' : '请先在后台词库中添加至少一条类型语录'" />
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CopyDocument,
  LocationFilled,
  RefreshRight
} from '@element-plus/icons-vue'
import { PublicPriceHeader } from '@/components/base'
import { getPublicBrands, getPublicColors, getPublicMarketingLexicon, getPublicMemories, getPublicModels, type Brand, type Color, type Memory, type Model } from '@/api/base-data'
import { TimeUtil } from '@/utils/time'
import {
  DEFAULT_MARKETING_LOCATION,
  DEFAULT_MARKETING_LEXICON,
  buildMarketingAutoContext,
  generateMarketingCopySuggestions,
  getConfiguredMarketingCopyTypes,
  getWeatherTextByCode,
  type MarketingAutoContext,
  type MarketingLexicon,
  type MarketingCondition,
  type MarketingCopySuggestion,
  type MarketingMode,
} from '@/utils/marketing'

interface MarketingFormState {
  mode: MarketingMode
  condition: MarketingCondition
  brandId: number | null
  modelId: number | null
  colorId: number | null
  memoryId: number | null
}

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
    locationName: DEFAULT_MARKETING_LOCATION.name,
    weatherText: '天气正常',
    date: TimeUtil.now().toDate()
  })
)

const heroTags = computed(() => [
  '自动应景',
  autoContext.value.timeSegment,
  autoContext.value.weatherText,
  autoContext.value.holidayCue || '无节日',
  autoContext.value.solarTermCue || '无节气',
  autoContext.value.locationName
])

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

const colorAvailable = computed(() => hasContextPhrases(marketingLexicon.value.contextLexicon?.color))
const weatherAvailable = computed(() => hasContextPhrases(marketingLexicon.value.contextLexicon?.weather))
const solarTermAvailable = computed(() => (
  hasContextPhrases(marketingLexicon.value.contextLexicon?.solarTerm) ||
  hasContextPhrases(marketingLexicon.value.eventLexicon?.solarTerms)
))

const selectedBrand = computed(() => brandOptions.value.find(item => item.id === form.brandId)?.name || '')
const selectedModel = computed(() => modelOptions.value.find(item => item.id === form.modelId)?.name || '')
const selectedColor = computed(() => colorOptions.value.find(item => item.id === form.colorId)?.name || '')
const selectedMemory = computed(() => {
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

const getBrowserLocation = (): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000
      }
    )
  })
}

const resolveLocationText = async (latitude: number, longitude: number) => {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=zh&count=1`
    )
    const data = await response.json()
    const result = data?.results?.[0]
    if (!result) return DEFAULT_MARKETING_LOCATION.name

    const parts = [result.country, result.admin1, result.admin2, result.name]
      .map((item: string) => String(item || '').trim())
      .filter(Boolean)

    return parts.length ? parts.join('') : DEFAULT_MARKETING_LOCATION.name
  } catch {
    return DEFAULT_MARKETING_LOCATION.name
  }
}

const resolveWeather = async (latitude: number, longitude: number) => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code&timezone=Asia%2FShanghai`
    )
    const data = await response.json()
    const current = data?.current || {}
    return {
      weatherText: getWeatherTextByCode(current.weather_code),
      weatherCode: current.weather_code ?? null,
      temperature: Number.isFinite(Number(current.temperature_2m)) ? Number(current.temperature_2m) : null,
      apparentTemperature: Number.isFinite(Number(current.apparent_temperature))
        ? Number(current.apparent_temperature)
        : null
    }
  } catch {
    return {
      weatherText: '天气正常',
      weatherCode: null,
      temperature: null,
      apparentTemperature: null
    }
  }
}

const refreshAutoContext = async () => {
  locationLoading.value = true
  locationStatus.value = '正在自动获取定位...'

  let latitude = DEFAULT_MARKETING_LOCATION.latitude
  let longitude = DEFAULT_MARKETING_LOCATION.longitude

  try {
    const browserLocation = await getBrowserLocation()
    latitude = browserLocation.latitude
    longitude = browserLocation.longitude
  } catch {
    locationStatus.value = `定位失败，已回退到${DEFAULT_MARKETING_LOCATION.name}`
  }

  const [locationName, weather] = await Promise.all([
    resolveLocationText(latitude, longitude),
    resolveWeather(latitude, longitude)
  ])

  autoContext.value = buildMarketingAutoContext({
    date: TimeUtil.now().toDate(),
    locationName,
    weatherText: weather.weatherText,
    weatherCode: weather.weatherCode,
    temperature: weather.temperature,
    apparentTemperature: weather.apparentTemperature
  })

  locationStatus.value = `已自动识别：${autoContext.value.locationName}`
  locationLoading.value = false
}

const refreshVariants = async (bumpNonce = false) => {
  generating.value = true
  if (bumpNonce) {
    generationNonce.value += 1
  }

  await nextTick()

  const localSuggestions = generateMarketingCopySuggestions({
    mode: form.mode,
    condition: form.condition,
    product: {
      brand: selectedBrand.value,
      model: selectedModel.value,
      color: selectedColor.value,
      memory: selectedMemory.value
    },
    context: autoContext.value,
    lexicon: {
      ...marketingLexicon.value,
      subsidyEnabled: form.mode === 'sales' && marketingLexicon.value.subsidyEnabled === true && useSubsidy.value,
      colorEnabled: form.mode === 'sales' && useColor.value,
      weatherEnabled: form.mode === 'sales' && useWeather.value,
      solarTermEnabled: form.mode === 'sales' && useSolarTerm.value
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
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败，请手动复制')
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
    ElMessage.warning('还没有可复制的内容')
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
      // 使用内置词库继续生成
    })
  ])
  await refreshAutoContext()
  await refreshVariants(false)
})
</script>

<style scoped lang="scss">
.marketing-page {
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.14), transparent 35%),
    linear-gradient(135deg, #0f172a 0%, #312e81 48%, #6d28d9 100%);
  overflow-x: hidden;
}

.page-body {
  width: min(1280px, calc(100% - 32px));
  margin: 0 auto;
  padding: 0 0 48px;
}

.top-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 16px;
  margin-top: 8px;
}

.context-card,
.editor-card,
.result-card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.94);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    font-size: 18px;
    color: #111827;
  }

  p {
    margin: 6px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
  }
}

.mode-tabs {
  margin: 0 0 16px;
}

.hero-copy {
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  backdrop-filter: blur(16px);
}

.hero-copy__title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

.hero-tags,
.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-tags {
  margin-top: 10px;
}

.hero-tag {
  border: 0;
}

.header-actions {
  justify-content: flex-end;
}

.context-card,
.editor-card,
.result-card {
  padding: 18px;
}

.context-card :deep(.el-card__body),
.editor-card :deep(.el-card__body),
.result-card :deep(.el-card__body) {
  padding: 0;
}

.context-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.context-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%);
  border: 1px solid rgba(99, 102, 241, 0.12);
}

.context-label {
  font-size: 12px;
  color: #64748b;
}

.context-value {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  word-break: break-word;
}

.context-footer {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4f46e5;
  font-size: 13px;
}

.context-summary {
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

.marketing-form {
  :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.marketing-switch-item {
  display: flex;
  min-height: 56px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 8px;
}

.marketing-toggle-row {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 14px 28px;
}

.marketing-condition-item {
  display: flex;
  min-width: 188px;
  flex: 0 1 220px;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.marketing-switch-title {
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.span-two {
  grid-column: span 2;
}

.full-width {
  width: 100%;
}

.condition-buttons {
  display: inline-flex;
  width: auto;
}

.condition-buttons :deep(.el-radio-button) {
  flex: 0 0 auto;
}

.condition-buttons :deep(.el-radio-button__inner) {
  min-width: 84px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.form-actions .el-button {
  flex: 0 1 auto;
}

.result-card {
  margin-top: 16px;
}

.copy-type-picker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 16px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.copy-type-picker__label {
  flex: 0 0 auto;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.copy-type-picker__select {
  width: min(280px, 100%);
}

.copy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.copy-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(99, 102, 241, 0.12);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.copy-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.copy-card__head :deep(.copy-button) {
  width: 36px !important;
  min-width: 36px !important;
  height: 36px !important;
  min-height: 36px !important;
  flex: 0 0 36px;
  padding: 0 !important;
  aspect-ratio: 1;
}

.copy-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.copy-tone {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}

.copy-text {
  white-space: pre-wrap;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.8;
  min-height: 108px;
}

.empty-state {
  padding: 24px 0 12px;
}

@media (max-width: 1100px) {
  .top-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .page-body {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding-inline: 6px;
    padding-bottom: 32px;
  }

  .context-card,
  .editor-card,
  .result-card {
    width: 100%;
    min-width: 0;
    padding: 10px;
    border-radius: 12px;
    box-sizing: border-box;
  }

  .hero-copy {
    padding: 10px 12px;
    border-radius: 14px;
  }

  .hero-copy__title {
    font-size: 14px;
    line-height: 1.45;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    flex: 1 1 100%;
    justify-content: center;
  }

  .context-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .marketing-toggle-row {
    width: 100%;
    gap: 12px 10px;
  }

  .marketing-switch-item {
    min-width: 62px;
    flex: 1 1 62px;
    align-items: center;
  }

  .marketing-condition-item {
    min-width: 100%;
    flex: 1 1 100%;
  }

  .marketing-switch-title {
    font-size: 13px;
  }

  .condition-buttons {
    width: 100%;
  }

  .condition-buttons :deep(.el-radio-button) {
    flex: 1 1 0;
  }

  .condition-buttons :deep(.el-radio-button__inner) {
    width: 100%;
  }

  .span-two {
    grid-column: span 1;
  }

  .card-head {
    align-items: center;
  }

  .card-head h2 {
    font-size: 16px;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .editor-card .card-head {
    flex-direction: row;
    gap: 8px;
  }

  .form-actions {
    gap: 4px;
  }

  .form-actions .el-button {
    min-width: 0;
    flex: 1 1 0;
    height: 32px !important;
    min-height: 32px !important;
    padding-inline: 2px !important;
    font-size: 12px !important;
  }

  .form-actions :deep(.el-button > span) {
    gap: 2px;
  }

  .form-actions :deep(.el-button .el-icon) {
    margin-right: 0;
    font-size: 14px;
  }

  .copy-type-picker {
    align-items: stretch;
    flex-direction: column;
    gap: 6px;
  }

  .copy-type-picker__select {
    width: 100%;
  }

  .copy-grid {
    width: 100%;
    min-width: 0;
    grid-template-columns: 1fr;
  }

  .copy-card {
    width: 100%;
    min-width: 0;
    padding: 14px;
    border-radius: 14px;
  }

  .copy-card__head {
    flex-direction: row;
    align-items: flex-start;
  }

  .copy-title {
    font-size: 15px;
  }

  .copy-tone {
    font-size: 11px;
  }

  .copy-text {
    min-height: auto;
    font-size: 13px;
    line-height: 1.7;
  }
}
</style>
