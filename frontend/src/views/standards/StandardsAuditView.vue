<template>
  <div class="standards-audit-view admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="standards"
      module-name="规范与审计"
      permission-code="standards:view"
    >
      <PageHeader
        icon="fas fa-clipboard-check"
        title="规范与审计"
        description="统一查看规范、公共实现、审计入口和页面接入范围"
      >
        <template #actions>
          <el-button
            type="info"
            plain
            @click="resetFilters"
          >
            <i class="fas fa-rotate-right" />
            重置筛选
          </el-button>
        </template>
      </PageHeader>

      <div class="standards-audit-content admin-page-content">
        <div class="stats-cards standards-stats">
          <div class="stat-card stat-card--primary">
            <div class="stat-icon"><i class="fas fa-layer-group" /></div>
            <div class="stat-content">
              <div class="stat-value">{{ standardsCatalog.length }}</div>
              <div class="stat-label">规范总数</div>
            </div>
          </div>
          <div class="stat-card stat-card--success">
            <div class="stat-icon"><i class="fas fa-check-circle" /></div>
            <div class="stat-content">
              <div class="stat-value">{{ configuredCount }}</div>
              <div class="stat-label">已配置审计</div>
            </div>
          </div>
          <div class="stat-card stat-card--info">
            <div class="stat-icon"><i class="fas fa-sitemap" /></div>
            <div class="stat-content">
              <div class="stat-value">{{ standardCategories.length }}</div>
              <div class="stat-label">规范分类</div>
            </div>
          </div>
          <div class="stat-card stat-card--warning">
            <div class="stat-icon"><i class="fas fa-file-alt" /></div>
            <div class="stat-content">
              <div class="stat-value">{{ sourceCount }}</div>
              <div class="stat-label">公共实现入口</div>
            </div>
          </div>
        </div>

        <div class="standards-toolbar admin-panel">
          <div class="standards-toolbar__search">
            <el-input
              v-model="keyword"
              clearable
              placeholder="搜索规范名称、文档或审计命令"
              @keyup.enter="applySearch"
            >
              <template #prefix><i class="fas fa-search" /></template>
            </el-input>
          </div>
          <div class="standards-toolbar__status">
            <el-tag type="success" effect="light">
              权威来源：standards-manifest.json
            </el-tag>
            <el-tag type="info" effect="plain">
              页面台账：page-audit-inventory.md
            </el-tag>
          </div>
        </div>

        <div class="standards-layout">
          <aside class="standards-categories admin-panel">
            <div class="standards-categories__title">规范分类</div>
            <el-button
              text
              class="standards-category"
              :class="{ 'is-active': activeCategory === '全部' }"
              @click="activeCategory = '全部'"
            >
              <span><i class="fas fa-border-all" />全部规范</span>
              <strong>{{ standardsCatalog.length }}</strong>
            </el-button>
            <el-button
              text
              v-for="category in standardCategories"
              :key="category"
              class="standards-category"
              :class="{ 'is-active': activeCategory === category }"
              @click="activeCategory = category"
            >
              <span><i :class="categoryIcon(category)" />{{ category }}</span>
              <strong>{{ categoryCounts[category] }}</strong>
            </el-button>
          </aside>

          <section class="standards-list admin-panel admin-table-panel">
            <div class="section-title">
              <i class="fas fa-list-check" />
              规范清单
              <span class="record-count">共 {{ filteredStandards.length }} 项</span>
            </div>

            <DataEmptyState
              v-if="filteredStandards.length === 0"
              state="filtered"
              title="没有匹配的规范"
              description="请调整分类或搜索关键字"
              size="compact"
            />

            <div
              v-else
              class="standards-grid"
            >
              <article
                v-for="standard in filteredStandards"
                :key="standard.id"
                class="standard-card"
              >
                <div class="standard-card__head">
                  <div class="standard-card__icon" :class="`standard-card__icon--${standard.previewKind}`">
                    <i :class="previewIcon(standard.previewKind)" />
                  </div>
                  <div class="standard-card__title-wrap">
                    <h2>{{ standard.title }}</h2>
                    <span>{{ standard.document }}</span>
                  </div>
                  <el-tag size="small" type="success">{{ standard.status }}</el-tag>
                </div>

                <p class="standard-card__summary">{{ standard.summary }}</p>

                <div class="standard-card__meta">
                  <span><i class="fas fa-tags" />{{ standard.category }}</span>
                  <span><i class="fas fa-shield-check" />{{ standard.checks.length }} 项审计</span>
                  <span><i class="fas fa-code" />{{ standard.publicSources.length }} 个入口</span>
                </div>

                <div class="standard-card__actions card-actions tf-actions--fit-row">
                  <el-button
                    type="info"
                    class="tf-button--view"
                    size="small"
                    @click="openDetail(standard)"
                  >
                    <i class="fas fa-eye" />查看规范
                  </el-button>
                  <el-button
                    type="default"
                    class="tf-button--neutral"
                    plain
                    size="small"
                    @click="copyDocumentPath(standard)"
                  >
                    <i class="fas fa-link" />复制路径
                  </el-button>
                </div>
              </article>
            </div>
          </section>
        </div>

        <div class="standards-note admin-panel">
          <i class="fas fa-circle-info" />
          <span>此页面以规范文档和 `standards-manifest.json` 为权威来源；审计命令需在项目环境执行，页面状态不替代静态审计结果。新增或删除规范、页面、Tab、弹窗和组件时，必须同步更新规范清单与页面台账。</span>
        </div>
      </div>
    </PermissionGate>

    <MobileDialog
      v-model="detailVisible"
      :title="selectedStandard?.title || '规范详情'"
      width="920px"
      max-width="calc(100vw - 32px)"
      dialog-class="standards-detail-dialog"
      :show-default-footer="false"
    >
      <template v-if="selectedStandard">
        <div class="standard-detail">
          <div class="standard-detail__head">
            <el-tag type="primary">{{ selectedStandard.category }}</el-tag>
            <code>{{ selectedStandard.document }}</code>
            <el-tag type="success">{{ selectedStandard.status }}</el-tag>
          </div>

          <div class="standard-detail__preview">
            <div class="standard-detail__label">效果预览</div>
            <div class="preview-stage">
              <div v-if="selectedStandard.previewKind === 'button'" class="preview-button-row">
                <el-button type="primary" class="tf-button--save" @click="previewButtonAction('主要操作')">主要操作</el-button>
                <el-button type="success" class="tf-button--complete" @click="previewButtonAction('完成')">完成</el-button>
                <el-button type="danger" class="tf-button--delete" @click="previewButtonAction('删除')">删除</el-button>
                <el-button
                  v-if="isMobile || isTablet"
                  native-type="button"
                  class="tf-button--menu"
                  aria-label="菜单按钮演示"
                  @click="previewButtonAction('菜单按钮')"
                >
                  <IconRenderer :svg="menuBarsIcon" aria-hidden="true" />
                </el-button>
                <el-tag v-if="previewButtonResult" type="success">{{ previewButtonResult }}</el-tag>
              </div>
              <div v-else-if="selectedStandard.previewKind === 'dialog'" class="preview-dialog-box">
                <strong>统一模态框标题</strong>
                <p>正文区域使用公共间距，底部操作区在手机端居中等分。</p>
                <div class="tf-dialog-actions preview-dialog-actions">
                  <el-button class="tf-button--neutral" @click="previewDialogAction('取消')">取消</el-button>
                  <el-button type="primary" class="tf-button--save" @click="previewDialogAction('确认')">确认</el-button>
                </div>
                <el-tag v-if="previewDialogResult" type="success">{{ previewDialogResult }}</el-tag>
              </div>
              <el-table
                v-else-if="selectedStandard.previewKind === 'table'"
                :data="previewRows"
                class="data-table admin-data-table standards-preview-table"
                border
                stripe
                table-layout="fixed"
                :fit="true"
              >
                <el-table-column
                  prop="field"
                  label="字段"
                  min-width="150"
                  class-name="complete-text-column"
                />
                <el-table-column
                  label="状态"
                  width="90"
                  align="center"
                >
                  <template #default="{ row }">
                    <el-tag size="small" type="success">{{ row.status }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  label="操作"
                  :width="previewActionColumnWidth"
                  class-name="actions-column"
                  align="center"
                >
                  <template #default>
                    <div class="table-actions">
                      <el-button
                        type="info"
                        class="table-action table-action--view"
                        size="small"
                        @click.stop="togglePreviewDetail"
                      >
                        <i :class="previewDetailVisible ? 'fas fa-chevron-up' : 'fas fa-eye'" />
                        {{ previewDetailVisible ? '收起' : '查看' }}
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="selectedStandard.previewKind === 'table' && previewDetailVisible" class="preview-table-detail">
                <div class="preview-table-detail__head">
                  <strong>设备详情（预览）</strong>
                  <el-tag type="success" size="small">在库</el-tag>
                </div>
                <div class="preview-table-detail__grid">
                  <span>型号：iPhone 15 Pro</span>
                  <span>颜色：原色钛金属</span>
                  <span>内存：256G</span>
                  <span>序列号：NEW-DEMO-001</span>
                </div>
              </div>
              <div v-else-if="selectedStandard.previewKind === 'search'" class="preview-search">
                <el-input
                  v-model="previewSearchKeyword"
                  placeholder="统一搜索入口"
                  clearable
                  @keyup.enter="runSearchPreview"
                />
                <el-button type="primary" class="tf-button--save" @click="runSearchPreview">搜索</el-button>
                <el-tag v-if="previewSearchResult" type="info">{{ previewSearchResult }}</el-tag>
              </div>
              <div v-else-if="selectedStandard.previewKind === 'form'" class="preview-form">
                <label>字段名称<el-input v-model="previewFormName" /></label>
                <label>选项<el-select v-model="previewFormOption"><el-option label="统一选项" value="统一选项" /><el-option label="备用选项" value="备用选项" /></el-select></label>
                <div class="preview-form__actions">
                  <el-button type="primary" class="tf-button--save" @click="submitFormPreview">提交演示</el-button>
                  <el-tag v-if="previewFormSubmitted" type="success">表单校验通过</el-tag>
                </div>
              </div>
              <div v-else-if="selectedStandard.previewKind === 'feedback'" class="preview-feedback">
                <div class="preview-feedback__states">
                  <el-tag type="success">成功提示</el-tag>
                  <el-tag type="warning">加载中</el-tag>
                  <el-tag type="info">空状态</el-tag>
                </div>
                <div
                  v-if="selectedStandard.document === 'global-loading-standard.md'"
                  class="preview-loading-demo"
                >
                  <InlineLoading
                    v-if="previewLoadingActive"
                    text="全局 Loading 演示中"
                    size="small"
                  />
                  <el-button
                    type="primary"
                    class="tf-button--save"
                    :disabled="previewLoadingActive"
                    @click="runPreviewLoading"
                  >
                    <i class="fas fa-play" />
                    {{ previewLoadingActive ? '演示中...' : '演示 Loading' }}
                  </el-button>
                  <span class="preview-loading-demo__hint">点击后显示全局遮罩，约 2 秒自动结束</span>
                </div>
                <template v-else-if="selectedStandard.document === 'empty-state-standard.md'">
                  <DataEmptyState
                    v-if="!previewEmptyLoaded"
                    state="empty"
                    size="compact"
                    title="暂无演示数据"
                    description="点击按钮后展示加载完成状态"
                    action-text="重新加载"
                    @action="loadEmptyPreview"
                  />
                  <div v-else class="preview-result preview-result--success">
                    <i class="fas fa-check-circle" />已加载演示数据
                    <el-button class="tf-button--neutral" size="small" @click="previewEmptyLoaded = false">恢复空状态</el-button>
                  </div>
                </template>
                <div v-else class="preview-feedback__actions">
                  <el-button type="success" class="tf-button--complete" @click="showFeedbackPreview('success')">成功提示</el-button>
                  <el-button type="warning" class="tf-button--warning" @click="showFeedbackPreview('warning')">警告提示</el-button>
                  <el-tag v-if="previewFeedbackResult" type="success">{{ previewFeedbackResult }}</el-tag>
                </div>
              </div>
              <div v-else-if="selectedStandard.previewKind === 'security'" class="preview-security">
                <i class="fas fa-shield-halved" /><span>用户 → 角色 → 权限 → 页面能力</span>
                <el-switch v-model="previewSecurityAllowed" active-text="已授权" inactive-text="未授权" />
                <el-button type="primary" class="tf-button--manage" @click="verifySecurityPreview">验证权限</el-button>
                <el-tag v-if="previewSecurityResult" :type="previewSecurityAllowed ? 'success' : 'danger'">{{ previewSecurityResult }}</el-tag>
              </div>
              <div v-else-if="selectedStandard.previewKind === 'runtime'" class="preview-runtime">
                <code>npm run {{ selectedStandard.checks[0] || 'check:standards' }}</code>
                <el-button type="primary" class="tf-button--save" @click="runRuntimePreview">运行演示审计</el-button>
                <el-tag :type="previewRuntimeResult ? 'success' : 'info'">{{ previewRuntimeResult || '审计入口已登记' }}</el-tag>
              </div>
              <div v-else class="preview-page">
                <PageHeader icon="fas fa-layer-group" title="统一页面结构" />
                <div class="tf-page-tabs tab-navigation">
                  <el-button type="primary" :class="{ 'is-active': previewPageTab === 'current' }" @click="previewPageTab = 'current'">当前页</el-button>
                  <el-button :class="{ 'is-active': previewPageTab === 'other' }" @click="previewPageTab = 'other'">其他页</el-button>
                </div>
                <el-tag type="info">当前展示：{{ previewPageTab === 'current' ? '当前页' : '其他页' }}</el-tag>
              </div>
            </div>
          </div>

          <div class="standard-detail__columns">
            <section>
              <div class="standard-detail__label">规范说明</div>
              <p>{{ selectedStandard.summary }}</p>
              <div class="standard-detail__label">关键要求</div>
              <ul class="standard-requirement-list">
                <li v-for="requirement in selectedStandard.requirements" :key="requirement">
                  {{ requirement }}
                </li>
              </ul>
              <div class="standard-detail__label">审计命令</div>
              <div class="standard-detail__chips"><code v-for="check in selectedStandard.checks" :key="check">npm run {{ check }}</code></div>
            </section>
            <section>
              <div class="standard-detail__label">公共实现入口</div>
              <ul class="standard-source-list"><li v-for="source in selectedStandard.publicSources" :key="source"><code>{{ source }}</code></li></ul>
            </section>
          </div>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { getAdaptiveActionColumnWidth } from '@/utils/table-layout'
import { useLoadingStore } from '@/stores/loading'
import { useMobile } from '@/composables/mobile'
import IconRenderer from '@/components/IconRenderer.vue'
import menuBarsIcon from '@/assets/icons/menu-bars.svg?raw'
import { PermissionGate, PageHeader } from '@/components/base'
import MobileDialog from '@/components/MobileDialog.vue'
import DataEmptyState from '@/components/DataEmptyState.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import {
  standardCategories,
  standardsCatalog,
  type StandardCatalogItem,
  type StandardCategory,
  type StandardPreviewKind
} from '@/services/standards-catalog'

const { canView } = usePagePermissions('standards')
const { success, warning } = useNotification()
const loadingStore = useLoadingStore()
const { isMobile, isTablet } = useMobile()
const keyword = ref('')
const appliedKeyword = ref('')
const activeCategory = ref<'全部' | StandardCategory>('全部')
const detailVisible = ref(false)
const selectedStandard = ref<StandardCatalogItem | null>(null)
const previewDetailVisible = ref(false)
const previewLoadingActive = ref(false)
const previewLoadingOperationId = 'standards-preview-loading'
let previewLoadingTimer: ReturnType<typeof setTimeout> | undefined
const previewButtonResult = ref('')
const previewDialogResult = ref('')
const previewSearchKeyword = ref('')
const previewSearchResult = ref('')
const previewFormName = ref('示例内容')
const previewFormOption = ref('统一选项')
const previewFormSubmitted = ref(false)
const previewEmptyLoaded = ref(false)
const previewFeedbackResult = ref('')
const previewSecurityAllowed = ref(true)
const previewSecurityResult = ref('')
const previewRuntimeResult = ref('')
const previewPageTab = ref<'current' | 'other'>('current')
const previewRows = [{ field: '完整展示文本', status: '正常' }]
const previewActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(previewRows, [
  { label: '查看', visible: true }
]))

const configuredCount = computed(() => standardsCatalog.filter(item => item.checks.length > 0).length)
const sourceCount = computed(() => new Set(standardsCatalog.flatMap(item => item.publicSources)).size)
const categoryCounts = computed(() => Object.fromEntries(
  standardCategories.map(category => [category, standardsCatalog.filter(item => item.category === category).length])
) as Record<StandardCategory, number>)

const filteredStandards = computed(() => {
  const normalizedKeyword = appliedKeyword.value.trim().toLowerCase()
  return standardsCatalog.filter((item) => {
    const matchesCategory = activeCategory.value === '全部' || item.category === activeCategory.value
    if (!matchesCategory) return false
    if (!normalizedKeyword) return true
    return [item.title, item.document, item.category, ...item.checks, ...item.publicSources]
      .join(' ')
      .toLowerCase()
      .includes(normalizedKeyword)
  })
})

const applySearch = () => {
  appliedKeyword.value = keyword.value
}

const resetFilters = () => {
  keyword.value = ''
  appliedKeyword.value = ''
  activeCategory.value = '全部'
}

const openDetail = (standard: StandardCatalogItem) => {
  resetPreviewState()
  selectedStandard.value = standard
  detailVisible.value = true
}

const togglePreviewDetail = () => {
  previewDetailVisible.value = !previewDetailVisible.value
}

const stopPreviewLoading = () => {
  if (previewLoadingTimer) {
    clearTimeout(previewLoadingTimer)
    previewLoadingTimer = undefined
  }
  if (loadingStore.isOperationLoading(previewLoadingOperationId)) {
    loadingStore.stopLoading(previewLoadingOperationId)
  }
  previewLoadingActive.value = false
}

const runPreviewLoading = () => {
  stopPreviewLoading()
  previewLoadingActive.value = true
  loadingStore.startLoading('规范预览：正在加载...', previewLoadingOperationId)
  previewLoadingTimer = setTimeout(() => {
    loadingStore.stopLoading(previewLoadingOperationId)
    previewLoadingTimer = undefined
    previewLoadingActive.value = false
  }, 2200)
}

const resetPreviewState = () => {
  stopPreviewLoading()
  previewDetailVisible.value = false
  previewButtonResult.value = ''
  previewDialogResult.value = ''
  previewSearchKeyword.value = ''
  previewSearchResult.value = ''
  previewFormName.value = '示例内容'
  previewFormOption.value = '统一选项'
  previewFormSubmitted.value = false
  previewEmptyLoaded.value = false
  previewFeedbackResult.value = ''
  previewSecurityAllowed.value = true
  previewSecurityResult.value = ''
  previewRuntimeResult.value = ''
  previewPageTab.value = 'current'
}

const previewButtonAction = (label: string) => {
  previewButtonResult.value = `已触发“${label}”按钮`
}

const previewDialogAction = (label: string) => {
  previewDialogResult.value = `已演示“${label}”操作`
  if (label === '确认') success('规范页已演示确认操作')
}

const runSearchPreview = () => {
  const keyword = previewSearchKeyword.value.trim()
  previewSearchResult.value = keyword ? `已返回“${keyword}”的演示结果` : '请输入关键词后搜索'
}

const submitFormPreview = () => {
  if (!previewFormName.value.trim()) {
    previewFormSubmitted.value = false
    warning('请先填写字段名称')
    return
  }
  previewFormSubmitted.value = true
}

const loadEmptyPreview = () => {
  previewEmptyLoaded.value = true
}

const showFeedbackPreview = (type: 'success' | 'warning') => {
  previewFeedbackResult.value = type === 'success' ? '成功通知已触发' : '警告通知已触发'
  if (type === 'success') success('规范页成功通知演示')
  else warning('规范页警告通知演示')
}

const verifySecurityPreview = () => {
  previewSecurityResult.value = previewSecurityAllowed.value ? '权限链路验证通过' : '当前账号无访问权限'
}

const runRuntimePreview = () => {
  previewRuntimeResult.value = '演示审计已执行'
}

const copyDocumentPath = async (standard: StandardCatalogItem) => {
  const path = `docs/frontend/${standard.document}`
  try {
    await navigator.clipboard.writeText(path)
    success('规范路径已复制')
  } catch {
    warning(`请手动查看：${path}`)
  }
}

onBeforeUnmount(stopPreviewLoading)

const categoryIcon = (category: StandardCategory) => {
  const icons: Record<StandardCategory, string> = {
    '页面与布局': 'fas fa-table-columns',
    '视觉与组件': 'fas fa-palette',
    '数据与表格': 'fas fa-table-list',
    '搜索与表单': 'fas fa-magnifying-glass',
    '反馈与交互': 'fas fa-bolt',
    '权限与安全': 'fas fa-shield-halved',
    '运行时与性能': 'fas fa-gauge-high'
  }
  return icons[category]
}

const previewIcon = (kind: StandardPreviewKind) => {
  const icons: Record<StandardPreviewKind, string> = {
    page: 'fas fa-layout',
    button: 'fas fa-hand-pointer',
    dialog: 'fas fa-window-maximize',
    table: 'fas fa-table-list',
    search: 'fas fa-magnifying-glass',
    form: 'fas fa-list-check',
    feedback: 'fas fa-bell',
    security: 'fas fa-shield-halved',
    runtime: 'fas fa-terminal'
  }
  return icons[kind]
}
</script>

<style scoped>
.standards-audit-content { display: flex; flex-direction: column; gap: var(--admin-panel-gap); }
.standards-stats { margin: 0; }
.standards-toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--tf-space-4); padding: var(--admin-panel-padding); }
.standards-toolbar__search { flex: 1 1 360px; max-width: 560px; }
.standards-toolbar__status { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--tf-space-2); }
.standards-layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: var(--admin-panel-gap); align-items: start; }
.standards-categories { padding: var(--tf-space-3); }
.standards-categories__title { margin-bottom: var(--tf-space-2); color: var(--admin-section-title-color); font-size: var(--tf-font-label); font-weight: 700; }
.standards-category { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 38px; padding: 0 var(--tf-space-2); border: 1px solid transparent; border-radius: var(--tf-radius-control); background: transparent; color: var(--tf-color-slate-500); cursor: pointer; font-size: var(--tf-font-body); text-align: left; }
.standards-category span { display: inline-flex; align-items: center; gap: var(--tf-space-2); }
.standards-category i { width: 16px; text-align: center; }
.standards-category strong { color: inherit; font-size: var(--tf-font-caption); }
.standards-category:hover, .standards-category.is-active { border-color: var(--tf-button-primary-soft-border); background: var(--tf-button-primary-soft-bg); color: var(--tf-button-primary-soft-color); }
.standards-list { min-width: 0; padding: var(--admin-table-panel-padding-y) var(--admin-table-panel-padding-x); }
.standards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--tf-space-3); }
.standard-card { display: flex; min-width: 0; flex-direction: column; gap: var(--tf-space-3); padding: var(--tf-space-4); border: 1px solid var(--admin-table-panel-border); border-radius: var(--tf-radius-card); background: var(--color-bg-white); }
.standard-card:hover { border-color: var(--tf-button-primary-soft-border); box-shadow: var(--admin-interactive-hover-shadow); }
.standard-card__head { display: flex; align-items: flex-start; gap: var(--tf-space-2); }
.standard-card__icon { display: inline-flex; flex: 0 0 36px; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: var(--tf-radius-card); background: var(--tf-button-primary-soft-bg); color: var(--tf-button-primary-soft-color); }
.standard-card__icon--dialog { background: var(--tf-button-warning-soft-bg); color: var(--tf-button-warning-soft-color); }
.standard-card__icon--table { background: var(--tf-button-view-soft-bg); color: var(--tf-button-view-soft-color); }
.standard-card__icon--security { background: var(--tf-button-danger-soft-bg); color: var(--tf-button-danger-soft-color); }
.standard-card__title-wrap { min-width: 0; flex: 1; }
.standard-card h2 { margin: 0 0 var(--tf-space-1); color: var(--admin-section-title-color); font-size: var(--tf-font-body-lg); line-height: 1.35; }
.standard-card__title-wrap span { display: block; overflow: hidden; color: var(--tf-color-slate-500); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--tf-font-caption); text-overflow: ellipsis; white-space: nowrap; }
.standard-card__summary { min-height: 40px; margin: 0; color: var(--tf-color-slate-500); font-size: var(--tf-font-body); line-height: 1.55; }
.standard-card__meta { display: flex; flex-wrap: wrap; gap: var(--tf-space-2) var(--tf-space-3); color: var(--tf-color-slate-500); font-size: var(--tf-font-caption); }
.standard-card__meta span { display: inline-flex; align-items: center; gap: var(--tf-space-1); }
.standard-card__actions { margin-top: auto; }
.standards-note { display: flex; align-items: flex-start; gap: var(--tf-space-2); padding: var(--tf-space-3); color: var(--tf-color-slate-500); font-size: var(--tf-font-caption); line-height: 1.6; }
.standards-note i { flex: 0 0 auto; margin-top: var(--tf-space-1); color: var(--tf-button-primary-soft-color); }
.standard-detail { display: flex; flex-direction: column; gap: var(--tf-space-5); }
.standard-detail__head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--tf-space-2); }
.standard-detail__head code, .standard-detail__chips code { padding: var(--tf-space-1) var(--tf-space-2); border-radius: var(--tf-radius-compact); background: var(--tf-color-slate-100); color: var(--tf-color-slate-600); font-size: var(--tf-font-caption); }
.standard-detail__label { margin-bottom: var(--tf-space-2); color: var(--admin-section-title-color); font-size: var(--tf-font-body); font-weight: 700; }
.preview-stage { min-height: 108px; padding: var(--tf-space-4); border: 1px solid var(--admin-table-panel-border); border-radius: var(--tf-radius-card); background: var(--tf-color-slate-50); }
.preview-button-row, .preview-search, .preview-feedback, .preview-security, .preview-runtime { display: flex; align-items: center; flex-wrap: wrap; gap: var(--tf-space-2); }
.preview-feedback { flex-direction: column; align-items: stretch; }
.preview-feedback__states, .preview-loading-demo, .preview-feedback__actions, .preview-form__actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--tf-space-2); }
.preview-loading-demo { padding-top: var(--tf-space-2); border-top: 1px solid var(--tf-color-slate-200); }
.preview-loading-demo__hint { color: var(--tf-color-slate-500); font-size: var(--tf-font-caption); }
.preview-form__actions { grid-column: 1 / -1; }
.preview-result { display: flex; align-items: center; flex-wrap: wrap; gap: var(--tf-space-2); min-height: 128px; justify-content: center; color: var(--tf-button-success-soft-color); font-size: var(--tf-font-body); font-weight: 600; }
.preview-result--success i { font-size: var(--tf-type-scale-20); }
.preview-security { flex-wrap: wrap; }
.preview-dialog-box { max-width: 520px; padding: var(--tf-space-3); border: 1px solid var(--tf-color-slate-200); border-radius: var(--tf-radius-card); background: var(--color-bg-white); box-shadow: var(--admin-interactive-hover-shadow); }
.preview-dialog-box p { margin: var(--tf-space-2) 0 var(--tf-space-3); color: var(--tf-color-slate-500); font-size: var(--tf-font-body); }
.preview-dialog-actions { margin-top: var(--tf-space-1); }
.preview-table-detail { padding: var(--tf-space-3); border-top: 1px solid var(--tf-color-slate-200); background: var(--tf-button-view-soft-bg); color: var(--tf-color-slate-600); }
.preview-table-detail__head { display: flex; align-items: center; justify-content: space-between; gap: var(--tf-space-2); margin-bottom: var(--tf-space-2); color: var(--tf-button-view-soft-color); }
.preview-table-detail__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tf-space-2); font-size: var(--tf-font-caption); }
.preview-search .el-input { max-width: 320px; }
.preview-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tf-space-3); }
.preview-form label { display: flex; flex-direction: column; gap: var(--tf-space-1); color: var(--tf-color-slate-600); font-size: var(--tf-font-label); }
.preview-security { padding: var(--tf-space-4); border: 1px dashed var(--tf-button-danger-soft-border); border-radius: var(--tf-radius-control); background: var(--tf-button-danger-soft-bg); color: var(--tf-button-danger-soft-color); }
.preview-security i { font-size: var(--tf-type-scale-22); }
.preview-runtime { justify-content: space-between; }
.preview-runtime code { padding: var(--tf-space-2) var(--tf-space-3); border-radius: var(--tf-radius-control); background: var(--tf-color-slate-900); color: var(--tf-color-slate-100); font-size: var(--tf-font-caption); }
.preview-page { display: flex; flex-direction: column; gap: var(--tf-space-2); }
.preview-page :deep(.page-header) { min-height: auto; padding: var(--tf-space-2) var(--tf-space-3); }
.standard-detail__columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--tf-space-5); }
.standard-detail__columns p { margin: 0; color: var(--tf-color-slate-500); font-size: var(--tf-font-body); line-height: 1.6; }
.standard-requirement-list { display: flex; flex-direction: column; gap: var(--tf-space-2); margin: 0 0 var(--tf-space-4); padding-left: var(--tf-space-5); color: var(--tf-color-slate-600); font-size: var(--tf-font-body); line-height: 1.55; }
.standard-detail__chips { display: flex; flex-wrap: wrap; gap: var(--tf-space-1); }
.standard-source-list { display: flex; max-height: 190px; flex-direction: column; gap: var(--tf-space-1); margin: 0; padding-left: var(--tf-space-4); overflow: auto; }
.standard-source-list code { color: var(--tf-color-slate-600); font-size: var(--tf-font-caption); word-break: break-all; }

@media (max-width: 767px) {
  .standards-toolbar { align-items: stretch; flex-direction: column; }
  .standards-toolbar__search { max-width: none; }
  .standards-toolbar__status { justify-content: flex-start; }
  .standards-layout { grid-template-columns: 1fr; }
  .standards-categories { display: flex; gap: var(--tf-space-2); overflow-x: auto; padding: var(--tf-space-2); }
  .standards-categories__title { display: none; }
  .standards-category { flex: 0 0 auto; width: auto; min-height: 34px; padding-inline: var(--tf-space-3); white-space: nowrap; }
  .standards-category strong { margin-left: var(--tf-space-2); }
  .standards-grid { grid-template-columns: 1fr; }
  .standard-detail__columns, .preview-form { grid-template-columns: 1fr; }
  .preview-table-detail__grid { grid-template-columns: 1fr; }
}
</style>
