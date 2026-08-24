<template>
  <div class="marketing-admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="marketing"
      module-name="营销管理"
      permission-code="marketing:view"
    >
      <div class="admin-page-content marketing-admin-content">
      <PageHeader
        icon="fas fa-bullhorn"
        title="营销管理"
      >
        <template #actions>
          <el-button @click="openPublicPage">
            <el-icon><Link /></el-icon>
            <span>打开公开页</span>
          </el-button>
          <el-button :loading="locationLoading" @click="refreshAutoContext">
            <el-icon><LocationFilled /></el-icon>
            <span>重新识别</span>
          </el-button>
        </template>
      </PageHeader>

      <div class="marketing-admin-grid">
        <el-card class="context-card" shadow="never">
          <div class="card-head">
            <div>
              <h2>当前应景</h2>
              <p>自动识别节日、节气、天气和时间段。</p>
            </div>
            <el-tag type="success" effect="dark" round>自动</el-tag>
          </div>

          <div class="context-grid">
            <div class="context-item" v-for="item in contextItems" :key="item.label">
              <span class="context-label">{{ item.label }}</span>
              <span class="context-value">{{ item.value }}</span>
            </div>
          </div>

          <div class="context-footer">
            <div class="context-status">
              <el-icon><LocationFilled /></el-icon>
              <span>{{ locationStatus }}</span>
            </div>
            <div class="context-summary">{{ marketingSummary }}</div>
          </div>

          <div class="preview-section">
            <div class="preview-head">
              <div>
                <h3>文案预览</h3>
              </div>
            </div>

            <div class="copy-grid preview-grid">
              <article v-for="item in previewCards" :key="item.type" class="copy-card preview-card">
                <div class="copy-card__head">
                  <div>
                    <div class="copy-title">{{ item.label }}</div>
                    <div v-if="item.suggestion" class="copy-tone">{{ item.suggestion.tone }}</div>
                  </div>
                  <el-button
                    size="small"
                    :loading="previewLoadingType === item.type"
                    @click="refreshPreview(item.type)"
                  >
                    <el-icon><RefreshRight /></el-icon>
                    <span>更换</span>
                  </el-button>
                </div>
                <div class="copy-text">
                  <span v-if="item.suggestion">{{ item.suggestion.text }}</span>
                  <span v-else class="preview-card__empty">暂无该类型词库</span>
                </div>
              </article>
            </div>
          </div>
        </el-card>
        <el-card class="management-card" shadow="never">
          <div class="card-head">
            <div>
              <h2>词库管理</h2>
            </div>
            <el-tag type="success" effect="plain">数据库</el-tag>
          </div>

          <el-form label-position="top" class="marketing-admin-form">
            <el-tabs v-model="lexiconTab" type="card" class="tf-page-tabs lexicon-tabs">
              <el-tab-pane
                v-for="item in copyTypeOptions"
                :key="item.value"
                :label="item.label"
                :name="item.value"
                class="tf-tab-panel"
              >
                <el-form-item :label="`${item.label}语录 - ${typeLexiconLineCount(item.value)} 条`">
                  <el-input
                    v-model="typeLexiconForm[item.value].linesText"
                    :disabled="!canWriteLexiconText(typeLexiconForm[item.value].linesText)"
                    type="textarea"
                    :rows="4"
                    resize="none"
                    placeholder="每行一条，点击当前类型即可维护对应语录"
                  />
                </el-form-item>
              </el-tab-pane>
            </el-tabs>
            <div class="section-title">模式通用词库</div>
            <p class="lexicon-hint">营业和销售只使用开始、结束语句；销售模式在深夜时自动使用深夜语句。</p>
            <el-tabs v-model="modeLexiconTab" type="card" class="tf-page-tabs lexicon-tabs">
              <el-tab-pane label="营业语句" name="opening" class="tf-tab-panel">
                <div class="context-lexicon-grid">
                  <el-form-item :label="`营业语句 - ${modeLexiconLineCount('opening', 'lines')} 条`">
                    <el-input v-model="modeLexiconForm.opening.linesText" :disabled="!canWriteLexiconText(modeLexiconForm.opening.linesText)" type="textarea" :rows="4" resize="none" />
                  </el-form-item>
                </div>
              </el-tab-pane>
              <el-tab-pane label="销售语句" name="sales" class="tf-tab-panel">
                <div class="context-lexicon-grid">
                  <el-form-item :label="`销售语句 - ${modeLexiconLineCount('sales', 'lines')} 条`">
                    <el-input v-model="modeLexiconForm.sales.linesText" :disabled="!canWriteLexiconText(modeLexiconForm.sales.linesText)" type="textarea" :rows="4" resize="none" />
                  </el-form-item>
                  <el-form-item :label="`销售话术 - ${modeLexiconLineCount('sales', 'salesTalks')} 条`">
                    <el-input v-model="modeLexiconForm.sales.salesTalksText" :disabled="!canWriteLexiconText(modeLexiconForm.sales.salesTalksText)" type="textarea" :rows="4" resize="none" placeholder="每行一条，补充成交、带走、安排等销售表达" />
                  </el-form-item>
                  <el-form-item :label="`深夜语句 - ${modeLexiconLineCount('sales', 'nightLines')} 条`">
                    <el-input v-model="modeLexiconForm.sales.nightLinesText" :disabled="!canWriteLexiconText(modeLexiconForm.sales.nightLinesText)" type="textarea" :rows="4" resize="none" />
                  </el-form-item>
                </div>
              </el-tab-pane>
            </el-tabs>
            <div class="section-title">自动应景词库</div>
            <el-tabs v-model="contextLexiconTab" type="card" class="tf-page-tabs lexicon-tabs context-lexicon-tabs">
              <el-tab-pane v-for="item in contextLexiconTabs" :key="item.value" :label="item.label" :name="item.value" class="tf-tab-panel">
                <div v-if="item.value === 'subsidy'" class="subsidy-toggle-row">
                  <div>
                    <strong>启用国补语录</strong>
                    <span>开启后，公开页会读取国补 TAB 中配置的语句。</span>
                  </div>
                  <el-switch v-model="subsidyEnabled" :disabled="!canEdit" active-text="开启" inactive-text="关闭" />
                </div>
                <div class="context-category-summary">
                  <span class="context-category-summary__label">系统可识别分类</span>
                  <span class="context-category-summary__value">{{ contextCategoryOptions(item.value).map(key => contextCategoryLabel(item.value, key)).join('、') }}</span>
                </div>
                <div class="lexicon-entry-list">
                  <div v-for="(entry, index) in contextLexiconEntries[item.value]" :key="`${item.value}-${index}`" class="lexicon-entry-row">
                    <el-select v-model="entry.key" :disabled="!canEdit && Boolean(entry.key)" class="lexicon-entry-key" filterable clearable :placeholder="contextEntryKeyPlaceholder(item.value)">
                      <el-option
                        v-for="key in contextCategoryOptions(item.value)"
                        :key="key"
                        :label="contextCategoryLabel(item.value, key)"
                        :value="key"
                      />
                    </el-select>
                    <el-input
                      v-model="entry.text"
                      :disabled="!canWriteLexiconText(entry.text)"
                      class="lexicon-entry-value"
                      type="textarea"
                      :rows="4"
                      resize="none"
                      placeholder="每行一条语录"
                    />
                    <el-button v-if="canDelete" type="danger" text @click="removeContextLexiconEntry(item.value, index)">删除</el-button>
                  </div>
                  <el-empty v-if="!contextLexiconEntries[item.value].length" :image-size="56" description="暂无语句" />
                  <el-button v-if="canCreate" type="primary" plain :disabled="!canAddContextLexiconEntry(item.value)" @click="addContextLexiconEntry(item.value)">
                    <el-icon><Plus /></el-icon>
                    <span>新增语句</span>
                  </el-button>
                </div>
              </el-tab-pane>
            </el-tabs>
            <div class="inline-actions">
              <el-button v-if="canWriteLexicon" type="primary" :loading="settingsSaving" @click="saveLexicon">
                保存词库
              </el-button>
            </div>
          </el-form>
        </el-card>

      </div>

      </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Link,
  LocationFilled,
  Plus,
  RefreshRight
} from '@element-plus/icons-vue'
import { PageHeader, PermissionGate } from '@/components/base'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { systemSettingsApi } from '@/api/system-settings'
import { TimeUtil } from '@/utils/time'
import {
  DEFAULT_MARKETING_LEXICON,
  DEFAULT_MARKETING_LOCATION,
  buildMarketingAutoContext,
  generateMarketingCopySuggestions,
  getWeatherTextByCode,
  MARKETING_COPY_TYPE_LABELS,
  MARKETING_COPY_TYPES,
  MARKETING_CONTEXT_CATEGORY_OPTIONS,
  MARKETING_WEATHER_TYPE_LABELS,
  type MarketingAutoContext,
  type MarketingCopySuggestion,
  type MarketingCopyType,
  type MarketingMode
} from '@/utils/marketing'

const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('marketing')
const canWriteLexicon = computed(() => canCreate.value || canEdit.value || canDelete.value)
const canWriteLexiconText = (_value: unknown) => canCreate.value || canEdit.value

const lexiconTab = ref<MarketingCopyType>('cute')
const modeLexiconTab = ref<MarketingMode>('opening')
const typeLexiconForm = reactive(
  Object.fromEntries(
    MARKETING_COPY_TYPES.map((type) => {
      const value = DEFAULT_MARKETING_LEXICON.typeLexicon?.[type]
      return [type, {
        linesText: (value?.lines || []).join('\n')
      }]
    })
  ) as Record<MarketingCopyType, { linesText: string }>
)
interface ModeLexiconFormState {
  linesText: string
  nightLinesText: string
  salesTalksText?: string
}

const modeLexiconForm = reactive<Record<MarketingMode, ModeLexiconFormState>>({
  opening: { linesText: '', nightLinesText: '' },
  sales: { linesText: '', nightLinesText: '', salesTalksText: '' }
})
type ContextLexiconTab = 'holiday' | 'weather' | 'timeSegment' | 'solarTerms' | 'traditionalHolidays' | 'historicalDays' | 'color' | 'subsidy'

interface ContextLexiconEntry {
  key: string
  text: string
}

const contextLexiconTabs: Array<{ value: ContextLexiconTab; label: string }> = [
  { value: 'holiday', label: '节日语句' },
  { value: 'weather', label: '天气语句' },
  { value: 'timeSegment', label: '时段表达语句' },
  { value: 'solarTerms', label: '24 节气' },
  { value: 'traditionalHolidays', label: '传统节日' },
  { value: 'historicalDays', label: '历史纪念日' },
  { value: 'color', label: '颜色' },
  { value: 'subsidy', label: '国补' }
]

const contextLexiconTab = ref<ContextLexiconTab>('holiday')
const subsidyEnabled = ref(false)
const contextLexiconEntries = reactive<Record<ContextLexiconTab, ContextLexiconEntry[]>>({
  holiday: [],
  weather: [],
  timeSegment: [],
  solarTerms: [],
  traditionalHolidays: [],
  historicalDays: [],
  color: [],
  subsidy: []
})

const toContextLexiconEntries = (value: unknown): ContextLexiconEntry[] => {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item).trim())
      .filter(Boolean)
      .length
      ? [{ key: 'all', text: value.map(item => String(item).trim()).filter(Boolean).join('\n') }]
      : []
  }
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>)
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([key, values]) => ({
      key,
      text: (values as unknown[]).map(value => String(value).trim()).filter(Boolean).join('\n')
    }))
}

const contextEntriesToLexicon = (entries: ContextLexiconEntry[]) => {
  const grouped: Record<string, string[]> = {}
  entries.forEach((entry) => {
    const key = entry.key.trim()
    const texts = entry.text.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
    if (!key || !texts.length) return
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(...texts)
  })
  return grouped
}

const addContextLexiconEntry = (tab: ContextLexiconTab) => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }
  const usedKeys = new Set(contextLexiconEntries[tab].map(entry => entry.key.trim()).filter(Boolean))
  const nextKey = (MARKETING_CONTEXT_CATEGORY_OPTIONS[tab] || []).find(key => !usedKeys.has(key)) || ''
  contextLexiconEntries[tab].push({ key: nextKey, text: '' })
}

const canAddContextLexiconEntry = (tab: ContextLexiconTab) => (
  (MARKETING_CONTEXT_CATEGORY_OPTIONS[tab] || []).some(key => !contextLexiconEntries[tab].some(entry => entry.key.trim() === key))
)

const ensureAllContextCategoryRows = () => {
  contextLexiconTabs.forEach(({ value: tab }) => {
    const existingKeys = new Set(contextLexiconEntries[tab].map(entry => entry.key.trim()).filter(Boolean))
    const categoryKeys = MARKETING_CONTEXT_CATEGORY_OPTIONS[tab] || []
    categoryKeys.forEach((key) => {
      if (!existingKeys.has(key)) {
        contextLexiconEntries[tab].push({ key, text: '' })
      }
    })
  })
}

const removeContextLexiconEntry = (tab: ContextLexiconTab, index: number) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }
  contextLexiconEntries[tab].splice(index, 1)
}

const contextEntryKeyPlaceholder = (tab: ContextLexiconTab) => ({
  holiday: '分类：traditional / historical / all',
  weather: '天气：晴天 / 小雨 / 暴雨 / 雷雨',
  timeSegment: '时段：开门 / 销售 / 下班前 / 深夜',
  solarTerms: '节气：处暑 / 立春 / 白露',
  traditionalHolidays: '节日：春节 / 端午节 / 中秋节',
  historicalDays: '纪念日：国庆节 / 建军节 / 九一八',
  color: '颜色：银色 / 黑色 / 白色 / 蓝色',
  subsidy: '国补：all'
}[tab])

const contextCategoryOptions = (tab: ContextLexiconTab) => Array.from(new Set([
  ...(MARKETING_CONTEXT_CATEGORY_OPTIONS[tab] || []),
  ...contextLexiconEntries[tab].map(entry => entry.key.trim()).filter(Boolean)
]))

const contextCategoryLabel = (tab: ContextLexiconTab, key: string) => {
  let label = key
  if (tab === 'weather') label = MARKETING_WEATHER_TYPE_LABELS[key as keyof typeof MARKETING_WEATHER_TYPE_LABELS] || key
  if (tab === 'holiday') {
    label = ({ traditional: '传统节日', historical: '历史纪念日', all: '全部节日' } as Record<string, string>)[key] || key
  }
  if (tab === 'subsidy' && key === 'all') label = '国补'
  const entry = contextLexiconEntries[tab].find(item => item.key.trim() === key)
  const count = entry ? parseLinesText(entry.text).length : 0
  return `${label} - ${count} 条`
}

const parseLinesText = (text: string) => text.split(/\r?\n/)
  .map(item => item.trim())
  .filter(Boolean)

const typeLexiconLineCount = (type: MarketingCopyType) => parseLinesText(typeLexiconForm[type].linesText).length

const modeLexiconLineCount = (mode: MarketingMode, field: 'lines' | 'nightLines' | 'salesTalks') => {
  const text = field === 'nightLines'
    ? modeLexiconForm[mode].nightLinesText
    : field === 'salesTalks'
      ? (modeLexiconForm[mode].salesTalksText || '')
    : modeLexiconForm[mode].linesText
  return parseLinesText(text).length
}

const buildPreviewLexicon = () => ({
  modeLexicon: Object.fromEntries(
    (['opening', 'sales'] as MarketingMode[]).map((mode) => {
      const value = modeLexiconForm[mode]
      return [mode, {
        lines: parseLinesText(value.linesText),
        nightLines: parseLinesText(value.nightLinesText),
        ...(mode === 'sales' ? { salesTalks: parseLinesText(value.salesTalksText || '') } : {})
      }]
    })
  ),
  typeLexicon: Object.fromEntries(
    MARKETING_COPY_TYPES.map((type) => [type, {
      lines: parseLinesText(typeLexiconForm[type].linesText)
    }])
  ),
  contextLexicon: {
    holiday: contextEntriesToLexicon(contextLexiconEntries.holiday),
    solarTerm: contextEntriesToLexicon(contextLexiconEntries.solarTerms),
    weather: contextEntriesToLexicon(contextLexiconEntries.weather),
    timeSegment: contextEntriesToLexicon(contextLexiconEntries.timeSegment),
    color: contextEntriesToLexicon(contextLexiconEntries.color),
    subsidy: contextEntriesToLexicon(contextLexiconEntries.subsidy)
  },
  eventLexicon: {
    solarTerms: contextEntriesToLexicon(contextLexiconEntries.solarTerms),
    traditionalHolidays: contextEntriesToLexicon(contextLexiconEntries.traditionalHolidays),
    historicalDays: contextEntriesToLexicon(contextLexiconEntries.historicalDays)
  },
  subsidyEnabled: subsidyEnabled.value
})

const locationLoading = ref(false)
const settingsSaving = ref(false)
const locationStatus = ref('正在自动获取定位...')
const autoContext = ref<MarketingAutoContext>(
  buildMarketingAutoContext({
    locationName: DEFAULT_MARKETING_LOCATION.name,
    weatherText: '天气正常',
    date: TimeUtil.now().toDate()
  })
)
const copyTypeOptions = MARKETING_COPY_TYPES.map((value) => ({
  value,
  label: MARKETING_COPY_TYPE_LABELS[value] || value
}))

const previewLoading = ref(false)
const previewLoadingType = ref<MarketingCopyType | null>(null)
const previewNonce = ref(0)
const previewSuggestions = reactive<Partial<Record<MarketingCopyType, MarketingCopySuggestion>>>({})

const contextItems = computed(() => [
  { label: '定位', value: autoContext.value.locationName },
  { label: '天气', value: autoContext.value.weatherText },
  { label: '时段', value: autoContext.value.timeSegment },
  { label: '节气', value: autoContext.value.solarTermCue || '暂无' },
  { label: '节日', value: autoContext.value.holidayCue || '暂无' },
  { label: '星期', value: autoContext.value.dayName }
])

const marketingSummary = computed(() => [
  autoContext.value.locationName,
  autoContext.value.timeSegment,
  autoContext.value.weatherText,
  autoContext.value.holidayCue || '',
  autoContext.value.solarTermCue || ''
].filter(Boolean).join(' · '))

const previewCards = computed(() => MARKETING_COPY_TYPES.map((type) => ({
  type,
  label: MARKETING_COPY_TYPE_LABELS[type] || type,
  suggestion: previewSuggestions[type] || null
})))

const unwrapSettingValue = (response: any) => {
  const payload = response?.data ?? response
  return payload?.value ?? null
}

const loadManagementSettings = async () => {
  try {
    const [lexiconResult] = await Promise.allSettled([
      systemSettingsApi.getMarketingLexicon()
    ])
    const lexiconResponse = lexiconResult.status === 'fulfilled' ? lexiconResult.value : null
    const lexicon = unwrapSettingValue(lexiconResponse)
    if (lexicon && typeof lexicon === 'object') {
      if (lexicon.modeLexicon && typeof lexicon.modeLexicon === 'object') {
        (['opening', 'sales'] as MarketingMode[]).forEach((mode) => {
          const value = lexicon.modeLexicon[mode]
          if (!value) return
          modeLexiconForm[mode].linesText = Array.isArray(value.lines) ? value.lines.join('\n') : modeLexiconForm[mode].linesText
          modeLexiconForm[mode].nightLinesText = Array.isArray(value.nightLines) ? value.nightLines.join('\n') : modeLexiconForm[mode].nightLinesText
          if (mode === 'sales') {
            modeLexiconForm[mode].salesTalksText = Array.isArray(value.salesTalks) ? value.salesTalks.join('\n') : modeLexiconForm[mode].salesTalksText
          }
        })
      }
      if (lexicon.typeLexicon && typeof lexicon.typeLexicon === 'object') {
        MARKETING_COPY_TYPES.forEach((type) => {
          const value = lexicon.typeLexicon[type]
          if (!value) return
          typeLexiconForm[type].linesText = Array.isArray(value.lines) ? value.lines.join('\n') : typeLexiconForm[type].linesText
        })
      }
      if (lexicon.contextLexicon && typeof lexicon.contextLexicon === 'object') {
        contextLexiconEntries.holiday = toContextLexiconEntries(lexicon.contextLexicon.holiday)
        contextLexiconEntries.weather = toContextLexiconEntries(lexicon.contextLexicon.weather)
        contextLexiconEntries.solarTerms = toContextLexiconEntries(lexicon.contextLexicon.solarTerm)
        if (lexicon.contextLexicon.timeSegment && typeof lexicon.contextLexicon.timeSegment === 'object') {
          contextLexiconEntries.timeSegment = toContextLexiconEntries(lexicon.contextLexicon.timeSegment)
        }
        contextLexiconEntries.subsidy = toContextLexiconEntries(lexicon.contextLexicon.subsidy)
        contextLexiconEntries.color = toContextLexiconEntries(lexicon.contextLexicon.color)
      }
      subsidyEnabled.value = lexicon.subsidyEnabled === true
      if (lexicon.eventLexicon && typeof lexicon.eventLexicon === 'object') {
        contextLexiconEntries.solarTerms = toContextLexiconEntries(lexicon.eventLexicon.solarTerms)
        contextLexiconEntries.traditionalHolidays = toContextLexiconEntries(lexicon.eventLexicon.traditionalHolidays)
        contextLexiconEntries.historicalDays = toContextLexiconEntries(lexicon.eventLexicon.historicalDays)
      }
    }

  } catch {
    // 没有系统配置权限时，保留默认配置继续预览
  }
  ensureAllContextCategoryRows()
}

const previewProduct = {
  brand: '',
  model: '',
  color: '',
  memory: ''
}

const generatePreviewSuggestion = (
  type: MarketingCopyType,
  lexicon: ReturnType<typeof buildPreviewLexicon>,
  nonce: number
) => {
  for (const mode of ['sales', 'opening'] as MarketingMode[]) {
    const suggestion = generateMarketingCopySuggestions({
      mode,
      copyType: type,
      condition: 'new',
      product: previewProduct,
      context: autoContext.value,
      lexicon,
      count: 1,
      nonce
    })[0]
    if (suggestion) return suggestion
  }
  return undefined
}

const refreshPreview = async (type: MarketingCopyType) => {
  previewLoadingType.value = type
  previewNonce.value += 1
  await Promise.resolve()

  const suggestion = generatePreviewSuggestion(type, buildPreviewLexicon(), previewNonce.value)

  if (suggestion) {
    previewSuggestions[type] = suggestion
  } else {
    delete previewSuggestions[type]
  }
  previewLoadingType.value = null
}

const refreshAllPreviews = async () => {
  previewLoading.value = true
  previewNonce.value += 1
  await Promise.resolve()

  const lexicon = buildPreviewLexicon()
  MARKETING_COPY_TYPES.forEach((type, index) => {
    const suggestion = generatePreviewSuggestion(type, lexicon, previewNonce.value + index)

    if (suggestion) {
      previewSuggestions[type] = suggestion
    } else {
      delete previewSuggestions[type]
    }
  })
  previewLoading.value = false
}

const saveLexicon = async () => {
  if (!canWriteLexicon.value) {
    handleNoPermission('edit')
    return
  }
  settingsSaving.value = true
  try {
    const typeLexicon = Object.fromEntries(
      MARKETING_COPY_TYPES.map((type) => [
        type,
        {
          lines: typeLexiconForm[type].linesText.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
        }
      ])
    )
    const modeLexicon = Object.fromEntries(
      (['opening', 'sales'] as MarketingMode[]).map((mode) => {
        const value = modeLexiconForm[mode]
        return [mode, {
          lines: value.linesText.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
          nightLines: value.nightLinesText.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
          ...(mode === 'sales' ? { salesTalks: (value.salesTalksText || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean) } : {})
        }]
      })
    )
    await systemSettingsApi.saveMarketingLexicon({
      modeLexicon,
      typeLexicon,
      subsidyEnabled: subsidyEnabled.value,
      contextLexicon: {
        holiday: contextEntriesToLexicon(contextLexiconEntries.holiday),
        solarTerm: contextEntriesToLexicon(contextLexiconEntries.solarTerms),
        weather: contextEntriesToLexicon(contextLexiconEntries.weather),
        timeSegment: contextEntriesToLexicon(contextLexiconEntries.timeSegment),
        color: contextEntriesToLexicon(contextLexiconEntries.color),
        subsidy: contextEntriesToLexicon(contextLexiconEntries.subsidy)
      },
      eventLexicon: {
        solarTerms: contextEntriesToLexicon(contextLexiconEntries.solarTerms),
        traditionalHolidays: contextEntriesToLexicon(contextLexiconEntries.traditionalHolidays),
        historicalDays: contextEntriesToLexicon(contextLexiconEntries.historicalDays)
      },
      updatedAt: new Date().toISOString()
    })
    ElMessage.success('词库已保存到数据库')
    await refreshAllPreviews()
  } finally {
    settingsSaving.value = false
  }
}

const openPublicPage = () => {
  window.open('/Marketing_Copy', '_blank', 'noopener,noreferrer')
}

const getBrowserLocation = (): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }),
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
    locationName: locationName || DEFAULT_MARKETING_LOCATION.name,
    weatherText: weather.weatherText,
    weatherCode: weather.weatherCode,
    temperature: weather.temperature,
    apparentTemperature: weather.apparentTemperature
  })

  locationStatus.value = `已自动识别：${autoContext.value.locationName}`
  locationLoading.value = false
  await refreshAllPreviews()
}

onMounted(async () => {
  if (!canView.value) return
  await loadManagementSettings()
  await refreshAutoContext()
})
</script>

<style scoped lang="scss">
.marketing-admin-page {
  width: 100%;
}

.marketing-admin-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr);
  gap: 16px;
  margin-bottom: 16px;
}

.context-card,
.management-card {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.28);
}

.context-card {
  align-self: start;
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

.marketing-admin-form {
  :deep(.el-form-item) {
    margin-bottom: 0;
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.span-two {
  grid-column: span 2;
}

.full-width {
  width: 100%;
}

.inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.mode-tabs {
  width: 100%;
  margin-top: 2px;
}

.section-title {
  margin: 16px 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
}

.lexicon-hint {
  margin: -4px 0 12px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.lexicon-tabs {
  margin-top: 4px;
}

.lexicon-entry-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.context-category-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.subsidy-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #eff6ff;
}

.subsidy-toggle-row > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.subsidy-toggle-row strong {
  color: #1e3a8a;
  font-size: 14px;
}

.subsidy-toggle-row span {
  color: #475569;
  font-size: 12px;
}

.context-category-summary__label {
  flex: none;
  color: #334155;
  font-weight: 700;
}

.context-category-summary__value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.lexicon-entry-row {
  display: grid;
  grid-template-columns: minmax(150px, 0.35fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.lexicon-entry-key,
.lexicon-entry-value {
  min-width: 0;
}

.context-lexicon-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.event-lexicon-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
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
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.context-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 0 1 auto;
  color: #4f46e5;
  font-size: 12px;
  white-space: nowrap;
}

.context-summary {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  color: #475569;
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-section {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;

  h3 {
    margin: 0;
    color: #0f172a;
    font-size: 15px;
  }
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.preview-card {
  min-width: 0;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid rgba(99, 102, 241, 0.12);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.preview-card :deep(.copy-card__head) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.preview-card :deep(.copy-card__head > div) {
  min-width: 0;
}

.preview-card :deep(.copy-title) {
  color: #0f172a;
  font-size: 16px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-card :deep(.copy-card__head .el-button) {
  flex: 0 0 auto;
  white-space: nowrap;
}

.preview-card :deep(.copy-tone) {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.preview-card :deep(.copy-text) {
  min-height: 108px;
  color: #475569;
  font-size: 14px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.preview-card__empty {
  color: #94a3b8;
}

@media (max-width: 1100px) {
  .marketing-admin-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .marketing-admin-content {
    padding: 16px 12px 20px;
  }

  .marketing-admin-grid {
    gap: 12px;
    margin-bottom: 12px;
  }

  .form-grid,
  .context-grid,
  .context-lexicon-grid,
  .event-lexicon-grid,
  .preview-grid {
    grid-template-columns: 1fr;
  }

  .span-two {
    grid-column: span 1;
  }

  .lexicon-entry-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .card-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .subsidy-toggle-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .card-head h2 {
    font-size: 16px;
  }

  .card-head p {
    font-size: 12px;
    line-height: 1.5;
  }

  .mode-tabs {
    margin-bottom: 12px;
  }

  .header-actions {
    width: 100%;
    gap: 8px;
  }

  .header-actions .el-button {
    flex: 1 1 calc(50% - 4px);
    justify-content: center;
  }

  .context-label {
    font-size: 11px;
  }

  .context-value {
    font-size: 13px;
    line-height: 1.65;
  }

  .context-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .context-summary {
    white-space: normal;
  }

  .preview-card {
    padding: 14px;
    border-radius: 14px;
  }

  .preview-card :deep(.copy-title) {
    font-size: 15px;
  }

  .preview-card :deep(.copy-text) {
    min-height: auto;
    font-size: 13px;
    line-height: 1.7;
  }
}
</style>
