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
            <el-button
              v-if="showOperations"
              @click="openPublicPage"
            >
              <el-icon><Link /></el-icon>
              <span>打开公开页</span>
            </el-button>
            <el-button
              v-if="showOperations"
              :loading="locationLoading"
              @click="refreshAutoContext"
            >
              <el-icon><LocationFilled /></el-icon>
              <span>重新识别</span>
            </el-button>
          </template>
        </PageHeader>

        <div class="marketing-admin-grid">
          <el-card
            v-if="canViewField('context.auto_context') || canViewField('context.preview')"
            class="context-card"
            shadow="never"
          >
            <div class="card-head">
              <div>
                <h2>当前应景</h2>
                <p>自动识别节日、节气、天气和时间段。</p>
              </div>
              <el-tag
                type="success"
                effect="dark"
                round
              >
                自动
              </el-tag>
            </div>

            <div
              v-if="canViewField('context.auto_context')"
              class="context-grid"
            >
              <div
                v-for="item in contextItems"
                :key="item.label"
                class="context-item"
              >
                <span class="context-label">{{ item.label }}</span>
                <span class="context-value">{{ item.value }}</span>
              </div>
            </div>

            <div class="context-footer">
              <div class="context-status">
                <el-icon><LocationFilled /></el-icon>
                <span>{{ locationStatus }}</span>
              </div>
              <div class="context-summary">
                {{ marketingSummary }}
              </div>
            </div>

            <div
              v-if="canViewField('context.preview')"
              class="preview-section"
            >
              <div class="preview-head">
                <div>
                  <h3>文案预览</h3>
                </div>
              </div>

              <div class="copy-grid preview-grid">
                <article
                  v-for="item in previewCards"
                  :key="item.type"
                  class="copy-card preview-card"
                >
                  <div class="copy-card__head">
                    <div>
                      <div class="copy-title">
                        {{ item.label }}
                      </div>
                      <div
                        v-if="item.suggestion"
                        class="copy-tone"
                      >
                        {{ item.suggestion.tone }}
                      </div>
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
                    <span
                      v-else
                      class="preview-card__empty"
                    >暂无该类型词库</span>
                  </div>
                </article>
              </div>
            </div>
          </el-card>
          <el-card
            v-if="canViewField('lexicon.type') || canViewField('lexicon.mode') || canViewField('lexicon.context')"
            class="management-card"
            shadow="never"
          >
            <div class="card-head">
              <div>
                <h2>词库管理</h2>
              </div>
              <el-tag
                type="success"
                effect="plain"
              >
                数据库
              </el-tag>
            </div>

            <el-form
              label-position="top"
              class="marketing-admin-form"
            >
              <el-tabs
                v-if="canViewField('lexicon.type')"
                v-model="lexiconTab"
                type="card"
                class="tf-page-tabs lexicon-tabs"
              >
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
                      class="tf-textarea"
                      type="textarea"
                      :rows="4"
                      placeholder="每行一条，点击当前类型即可维护对应语录"
                    />
                  </el-form-item>
                </el-tab-pane>
              </el-tabs>
              <div
                v-if="canViewField('lexicon.mode')"
                class="section-title"
              >
                模式通用词库
              </div>
              <p
                v-if="canViewField('lexicon.mode')"
                class="lexicon-hint"
              >
                营业和销售只使用开始、结束语句；销售模式在深夜时自动使用深夜语句。
              </p>
              <el-tabs
                v-if="canViewField('lexicon.mode')"
                v-model="modeLexiconTab"
                type="card"
                class="tf-page-tabs lexicon-tabs"
              >
                <el-tab-pane
                  label="营业语句"
                  name="opening"
                  class="tf-tab-panel"
                >
                  <div class="context-lexicon-grid">
                    <el-form-item :label="`营业语句 - ${modeLexiconLineCount('opening', 'lines')} 条`">
                      <el-input
                        v-model="modeLexiconForm.opening.linesText"
                        :disabled="!canWriteLexiconText(modeLexiconForm.opening.linesText)"
                        class="tf-textarea"
                        type="textarea"
                        :rows="4"
                      />
                    </el-form-item>
                  </div>
                </el-tab-pane>
                <el-tab-pane
                  label="销售语句"
                  name="sales"
                  class="tf-tab-panel"
                >
                  <div class="context-lexicon-grid">
                    <el-form-item :label="`销售语句 - ${modeLexiconLineCount('sales', 'lines')} 条`">
                      <el-input
                        v-model="modeLexiconForm.sales.linesText"
                        :disabled="!canWriteLexiconText(modeLexiconForm.sales.linesText)"
                        class="tf-textarea"
                        type="textarea"
                        :rows="4"
                      />
                    </el-form-item>
                    <el-form-item :label="`销售话术 - ${modeLexiconLineCount('sales', 'salesTalks')} 条`">
                      <el-input
                        v-model="modeLexiconForm.sales.salesTalksText"
                        :disabled="!canWriteLexiconText(modeLexiconForm.sales.salesTalksText)"
                        class="tf-textarea"
                        type="textarea"
                        :rows="4"
                        placeholder="每行一条，补充成交、带走、安排等销售表达"
                      />
                    </el-form-item>
                    <el-form-item :label="`深夜语句 - ${modeLexiconLineCount('sales', 'nightLines')} 条`">
                      <el-input
                        v-model="modeLexiconForm.sales.nightLinesText"
                        :disabled="!canWriteLexiconText(modeLexiconForm.sales.nightLinesText)"
                        class="tf-textarea"
                        type="textarea"
                        :rows="4"
                      />
                    </el-form-item>
                  </div>
                </el-tab-pane>
              </el-tabs>
              <div
                v-if="canViewField('lexicon.context')"
                class="section-title"
              >
                自动应景词库
              </div>
              <el-tabs
                v-if="canViewField('lexicon.context')"
                v-model="contextLexiconTab"
                type="card"
                class="tf-page-tabs lexicon-tabs context-lexicon-tabs"
              >
                <el-tab-pane
                  v-for="item in contextLexiconTabs"
                  :key="item.value"
                  :label="item.label"
                  :name="item.value"
                  class="tf-tab-panel"
                >
                  <div
                    v-if="item.value === 'subsidy'"
                    class="subsidy-toggle-row"
                  >
                    <div>
                      <strong>启用国补语录</strong>
                      <span>开启后，公开页会读取国补 TAB 中配置的语句。</span>
                    </div>
                    <el-switch
                      v-model="subsidyEnabled"
                      :disabled="!canEdit"
                      active-text="开启"
                      inactive-text="关闭"
                    />
                  </div>
                  <div class="context-category-summary">
                    <span class="context-category-summary__label">系统可识别分类</span>
                    <span class="context-category-summary__value">{{ contextCategoryOptions(item.value).map(key => contextCategoryLabel(item.value, key)).join('、') }}</span>
                  </div>
                  <div class="lexicon-entry-list">
                    <div
                      v-for="(entry, index) in contextLexiconEntries[item.value]"
                      :key="`${item.value}-${index}`"
                      class="lexicon-entry-row"
                    >
                      <el-select
                        v-model="entry.key"
                        :disabled="!canEdit && Boolean(entry.key)"
                        class="lexicon-entry-key"
                        filterable
                        clearable
                        :placeholder="contextEntryKeyPlaceholder(item.value)"
                      >
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
                        class="tf-textarea lexicon-entry-value"
                        type="textarea"
                        :rows="4"
                        placeholder="每行一条语录"
                      />
                      <el-button
                        v-if="canDelete"
                        type="danger"
                        text
                        @click="removeContextLexiconEntry(item.value, index)"
                      >
                        删除
                      </el-button>
                    </div>
                    <DataEmptyState
                      v-if="!contextLexiconEntries[item.value].length"
                      :image-size="56"
                      description="暂无语句"
                    />
                    <el-button
                      v-if="canCreate"
                      type="primary"
                      plain
                      :disabled="!canAddContextLexiconEntry(item.value)"
                      @click="addContextLexiconEntry(item.value)"
                    >
                      <el-icon><Plus /></el-icon>
                      <span>新增语句</span>
                    </el-button>
                  </div>
                </el-tab-pane>
              </el-tabs>
              <div class="inline-actions">
                <el-button
                  v-if="canWriteLexicon && (canViewField('lexicon.type') || canViewField('lexicon.mode') || canViewField('lexicon.context'))"
                  type="primary"
                  :loading="settingsSaving"
                  @click="saveLexicon"
                >
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

import {
  Link,
  LocationFilled,
  Plus,
  RefreshRight
} from '@element-plus/icons-vue'
import { PageHeader, PermissionGate } from '@/components/base'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { systemSettingsApi } from '@/api/system-settings'
import { TimeUtil } from '@/utils/time'
import { loadMarketingAutoContext } from '@/services/marketing-context'
import {
  DEFAULT_MARKETING_LEXICON,
  buildMarketingAutoContext,
  generateMarketingCopySuggestions,
  MARKETING_COPY_TYPE_LABELS,
  MARKETING_COPY_TYPES,
  MARKETING_CONTEXT_CATEGORY_OPTIONS,
  MARKETING_WEATHER_TYPE_LABELS,
  type MarketingAutoContext,
  type MarketingCopySuggestion,
  type MarketingCopyType,
  type MarketingLexicon,
  type MarketingMode
} from '@/utils/marketing'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('marketing')
const MARKETING_MODULE_KEY = 'marketing'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(MARKETING_MODULE_KEY, fieldKey)
const canWriteLexicon = computed(() => canCreate.value || canEdit.value || canDelete.value)
const showOperations = computed(() => shouldShowActionColumn(
  canViewField('system_info.operations'),
  [canCreate.value, canEdit.value, canDelete.value]
))
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

const unwrapSettingValue = <T>(response: unknown): T | null => {
  if (!response || typeof response !== 'object') return null
  const responseRecord = response as Record<string, unknown>
  const payload = responseRecord.data && typeof responseRecord.data === 'object'
    ? responseRecord.data as Record<string, unknown>
    : responseRecord
  return 'value' in payload ? payload.value as T : null
}

const loadManagementSettings = async () => {
  try {
    const [lexiconResult] = await Promise.allSettled([
      systemSettingsApi.getMarketingLexicon()
    ])
    const lexiconResponse = lexiconResult.status === 'fulfilled' ? lexiconResult.value : null
    const lexicon = unwrapSettingValue<MarketingLexicon>(lexiconResponse)
    if (lexicon && typeof lexicon === 'object') {
      if (lexicon.modeLexicon && typeof lexicon.modeLexicon === 'object') {
        const modeLexicon = lexicon.modeLexicon
        const marketingModes: MarketingMode[] = ['opening', 'sales']
        marketingModes.forEach((mode) => {
          const value = modeLexicon[mode]
          if (!value) return
          modeLexiconForm[mode].linesText = Array.isArray(value.lines) ? value.lines.join('\n') : modeLexiconForm[mode].linesText
          modeLexiconForm[mode].nightLinesText = Array.isArray(value.nightLines) ? value.nightLines.join('\n') : modeLexiconForm[mode].nightLinesText
          if (mode === 'sales') {
            modeLexiconForm[mode].salesTalksText = Array.isArray(value.salesTalks) ? value.salesTalks.join('\n') : modeLexiconForm[mode].salesTalksText
          }
        })
      }
      if (lexicon.typeLexicon && typeof lexicon.typeLexicon === 'object') {
        const typeLexicon = lexicon.typeLexicon
        MARKETING_COPY_TYPES.forEach((type) => {
          const value = typeLexicon[type]
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
      updatedAt: TimeUtil.toISOString()
    })
    globalNotifications.success('词库已保存到数据库')
    await refreshAllPreviews()
  } finally {
    settingsSaving.value = false
  }
}

const openPublicPage = () => {
  window.open('/Marketing_Copy', '_blank', 'noopener,noreferrer')
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
    await refreshAllPreviews()
  }
}

onMounted(async () => {
  await fieldPermissions.init()
  if (!canView.value) return
  await loadManagementSettings()
  await refreshAutoContext()
})
</script>

<style scoped lang="scss" src="./styles/marketing-management-view/management.scss"></style>
<style scoped lang="scss" src="./styles/marketing-management-view/preview.scss"></style>
