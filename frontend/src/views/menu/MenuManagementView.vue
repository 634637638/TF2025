<template>
  <div class="menu-management admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="menu"
      module-name="菜单管理"
      permission-code="menus:view"
    >
      <!-- 主要内容 - 只有有权限时才显示 -->
      <div class="content admin-page-content">
        <PageHeader
          class="menu-page-header"
          icon="fas fa-bars"
          title="菜单管理"
        >
          <template #actions>
            <div class="menu-header-actions">
              <ImportExportActions
                :can-import="canImport"
                :can-export="canExport"
                :import-loading="importingMenus"
                :export-loading="exportingMenus"
                import-label="导入"
                export-label="导出"
                import-type="warning"
                export-type="success"
                import-plain
                export-plain
                @import="triggerMenuImport"
                @export="handleMenuExport"
              />
              <el-button
                v-if="canCreate"
                type="primary"
                @click="showAddModal(0)"
              >
                <i class="fas fa-plus" />
                <span>新增</span>
              </el-button>
              <el-button
                type="info"
                plain
                @click="openMenuWidthModal"
              >
                <i class="fas fa-ruler-horizontal" />
                <span>设置</span>
              </el-button>
              <el-button
                type="info"
                plain
                :loading="refreshing"
                :disabled="refreshing"
                @click="refreshData"
              >
                <i class="fas fa-sync-alt" />
                <span>{{ refreshing ? '刷新中...' : '刷新' }}</span>
              </el-button>
            </div>
          </template>
        </PageHeader>
        <input
          ref="menuImportInputRef"
          type="file"
          accept=".xlsx,.xls"
          style="display: none"
          @change="handleMenuImportChange"
        >

        <!-- 统计卡片 -->
        <div
          v-if="showStatsCards"
          class="stats-cards"
        >
          <div
            v-if="canViewMenuField('stats_total_menus')"
            class="stat-card stat-card--primary"
          >
            <div class="stat-icon">
              <i class="fas fa-sitemap" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ getMenuCount() }}
              </div>
              <div class="stat-label">
                菜单总数
              </div>
            </div>
          </div>
          <div
            v-if="canViewMenuField('stats_active_menus')"
            class="stat-card stat-card--success"
          >
            <div class="stat-icon">
              <i class="fas fa-check-circle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ getActiveMenuCount() }}
              </div>
              <div class="stat-label">
                启用菜单
              </div>
            </div>
          </div>
          <div
            v-if="canViewMenuField('stats_inactive_menus')"
            class="stat-card stat-card--danger"
          >
            <div class="stat-icon">
              <i class="fas fa-pause-circle" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ getInactiveMenuCount() }}
              </div>
              <div class="stat-label">
                禁用菜单
              </div>
            </div>
          </div>
          <div
            v-if="canViewMenuField('stats_root_menus')"
            class="stat-card stat-card--info"
          >
            <div class="stat-icon">
              <i class="fas fa-layer-group" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ getRootMenuCount() }}
              </div>
              <div class="stat-label">
                根菜单数
              </div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-model:expanded="menuSearchExpanded"
          :loading="loading"
          @search="searchMenus"
          @reset="resetSearch"
        >
          <template #primary>
            <el-input
              v-model="searchForm.name"
              placeholder="搜索菜单名称"
              clearable
              @keyup.enter="searchMenus"
              @click.stop
            >
              <template #prefix>
                <i class="fas fa-search" />
              </template>
            </el-input>
          </template>

          <div
            class="form-group filter-item"
            data-field="menuType"
          >
            <el-select
              v-model="searchForm.menu_type"
              placeholder="菜单类型"
              clearable
              @change="searchMenus"
            >
              <el-option
                label="菜单项"
                value="menu"
              />
              <el-option
                label="目录"
                value="directory"
              />
            </el-select>
          </div>

          <div
            class="form-group filter-item"
            data-field="status"
          >
            <el-select
              v-model="searchForm.status"
              placeholder="状态"
              clearable
              @change="searchMenus"
            >
              <el-option
                label="启用"
                value="1"
              />
              <el-option
                label="禁用"
                value="0"
              />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <!-- 菜单数据加载状态 -->
        <TableLoadingRow
          v-if="loading"
          mode="block"
          text="加载中..."
        />

        <!-- 错误信息 -->
        <div
          v-if="errorMessage"
          class="error-container"
        >
          <div class="error-content">
            <i class="fas fa-exclamation-triangle error-icon" />
            <p class="error-text">
              {{ errorMessage }}
            </p>
            <el-button
              type="danger"
              plain
              size="small"
              @click="errorMessage = ''"
            >
              <i class="fas fa-times" />
              关闭
            </el-button>
          </div>
        </div>

        <!-- 菜单列表 -->
        <div
          v-if="!loading && !errorMessage"
          class="menu-table-section admin-panel admin-table-panel"
        >
          <el-table
            :data="visibleMenuRows"
            row-key="id"
            class="data-table compact-fit-table menu-data-table"
            stripe
            border
            :fit="true"
            @row-click="handleMenuRowTap"
          >
            <template #empty>
              <DataEmptyState description="暂无菜单数据" />
            </template>
            <el-table-column
              label="菜单名称"
              :min-width="isMobile ? 180 : 220"
              class-name="menu-name-column complete-text-column"
            >
              <template #default="{ row }">
                <div
                  class="menu-info"
                  :style="{ paddingLeft: `${row.depth * 22}px` }"
                >
                  <div class="menu-text">
                    <el-button
                      v-if="row.hasChildren"
                      class="expand-btn"
                      native-type="button"
                      :title="isMenuExpanded(row.id) ? '折叠子菜单' : '展开子菜单'"
                      @click.stop="toggleMenuExpansion(row.id)"
                    >
                      <i :class="isMenuExpanded(row.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'" />
                    </el-button>
                    <span
                      v-else
                      class="expand-placeholder"
                    />
                    <span class="menu-title">{{ row.title || row.name }}</span>
                    <span
                      class="menu-type"
                      :class="`type-${row.menu_type || 'menu'}`"
                    >{{ getMenuTypeLabel(row.menu_type) }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              label="备注"
              :min-width="isMobile ? 180 : 220"
              class-name="menu-remarks-column wrapped-text-column"
            >
              <template #default="{ row }">
                <span class="menu-remarks-text">{{ row.remarks || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="路径"
              :min-width="isMobile ? 180 : 220"
              class-name="menu-path-column complete-text-column"
            >
              <template #default="{ row }">
                <code class="url-text">{{ row.path || row.url || '-' }}</code>
              </template>
            </el-table-column>
            <el-table-column
              label="图标"
              min-width="120"
            >
              <template #default="{ row }">
                <div class="icon-display">
                  <IconRenderer
                    :icon="row.icon"
                    :svg="row.icon_svg"
                    class-name="menu-icon"
                  /><span class="icon-text">{{ row.icon || '-' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              label="排序"
              :width="$getNumberColumnWidth((visibleMenuRows || []).map((row) => row.sort_order), 80)"
              align="center"
            >
              <template #default="{ row }">
                <span class="table-number-badge">{{ row.sort_order }}</span>
              </template>
            </el-table-column>
            <el-table-column
              label="状态"
              min-width="100"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  :type="row.status ? 'success' : 'info'"
                  size="small"
                >
                  {{ row.status ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="showMenuActionField"
              label="操作"
              :width="$getActionColumnWidth(['编辑', '子菜单', '删除'])"
              align="center"
              class-name="actions-column"
            >
              <template #default="{ row }">
                <div class="action-buttons table-actions">
                  <el-button
                    v-if="canEdit"
                    type="primary"
                    size="small"
                    @click.stop="showEditModal(row)"
                  >
                    <i class="fas fa-edit" /><span>编辑</span>
                  </el-button>
                  <el-button
                    v-if="canCreate"
                    type="success"
                    size="small"
                    @click.stop="showAddModal(row.id)"
                  >
                    <i class="fas fa-plus" /><span>子菜单</span>
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    type="danger"
                    size="small"
                    @click.stop="handleDelete(row)"
                  >
                    <i class="fas fa-trash" /><span>删除</span>
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <!-- 空状态 -->
          <DataEmptyState
            v-if="menuTree.length === 0 && !loading"
            :state="errorMessage ? 'permission' : 'empty'"
            :title="errorMessage ? '权限不足' : '暂无菜单数据'"
            :description="errorMessage || '系统中还没有菜单配置，点击上方按钮开始添加'"
          />
        </div>

        <!-- 菜单编辑模态框 -->
        <MobileDialog
          v-model="showModal"
          :title="isEdit ? '编辑菜单' : '新增菜单'"
          width="800px"
          :close-on-click-modal="false"
          :dialog-class="['menu-management-dialog', 'crud-dialog-lg']"
          :show-default-footer="false"
          destroy-on-close
          @close="handleDialogClose"
          @cancel="handleDialogClose"
        >
          <div class="modal-body menu-editor-body">
            <el-form
              :model="formData"
              label-position="top"
              class="menu-editor-form"
              @submit.prevent="handleSubmit"
            >
              <section class="menu-editor-hero">
                <div class="menu-editor-preview">
                  <div class="preview-icon">
                    <IconRenderer
                      :icon="formData.icon || 'fas fa-bars'"
                      :svg="formData.icon_svg"
                      fallback="fas fa-bars"
                    />
                  </div>
                  <div class="preview-copy">
                    <span class="preview-eyebrow">{{ isEdit ? '正在编辑' : '创建菜单' }}</span>
                    <strong>{{ formData.name || '未命名菜单' }}</strong>
                    <small>{{ formData.url || '设置一个访问路径' }}</small>
                  </div>
                </div>
                <div class="status-switch">
                  <span class="status-switch-label">启用菜单</span>
                  <el-switch
                    v-model="formData.is_active"
                    inline-prompt
                    active-text="启"
                    inactive-text="禁"
                  />
                </div>
              </section>

              <div class="menu-editor-grid">
                <section class="editor-card editor-card--main">
                  <div class="editor-card-head">
                    <span class="editor-card-icon"><i class="fas fa-compass" /></span>
                    <div>
                      <h6>基础信息</h6>
                      <p>定义菜单名称、路径和层级关系。</p>
                    </div>
                  </div>

                  <el-row
                    :gutter="16"
                    class="menu-form-row"
                  >
                    <el-col
                      :xs="24"
                      :sm="12"
                    >
                      <el-form-item
                        label="菜单名称"
                        required
                      >
                        <el-input
                          v-model="formData.name"
                          placeholder="例如：销售管理"
                          clearable
                          maxlength="50"
                          show-word-limit
                        >
                          <template #prefix>
                            <i class="fas fa-tag" />
                          </template>
                        </el-input>
                      </el-form-item>
                    </el-col>
                    <el-col
                      :xs="24"
                      :sm="12"
                    >
                      <el-form-item
                        label="菜单路径"
                        required
                      >
                        <el-input
                          v-model="formData.url"
                          placeholder="例如：/sales 或 #"
                          clearable
                        >
                          <template #prefix>
                            <i class="fas fa-link" />
                          </template>
                        </el-input>
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row
                    :gutter="16"
                    class="menu-form-row"
                  >
                    <el-col
                      :xs="24"
                      :sm="12"
                    >
                      <el-form-item label="父级菜单">
                        <el-select
                          v-model="formData.parent_id"
                          placeholder="请选择父级菜单"
                          class="w-full"
                          filterable
                        >
                          <el-option
                            :value="0"
                            label="根菜单"
                          />
                          <el-option
                            v-for="menu in parentMenuOptions"
                            :key="menu.id"
                            :label="menu.name"
                            :value="menu.id"
                          />
                        </el-select>
                      </el-form-item>
                    </el-col>
                    <el-col
                      :xs="24"
                      :sm="12"
                    >
                      <el-form-item label="打开方式">
                        <el-select
                          v-model="formData.target"
                          placeholder="请选择打开方式"
                          class="w-full"
                        >
                          <el-option
                            value="_self"
                            label="当前窗口"
                          />
                          <el-option
                            value="_blank"
                            label="新窗口"
                          />
                        </el-select>
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-row
                    :gutter="16"
                    class="menu-form-row menu-form-row--compact"
                  >
                    <el-col
                      :xs="24"
                      :sm="9"
                    >
                      <el-form-item label="排序">
                        <el-input-number
                          v-model="formData.sort_order"
                          :min="0"
                          :max="9999"
                          :controls="false"
                          placeholder="越小越靠前"
                          class="w-full"
                        />
                      </el-form-item>
                    </el-col>
                    <el-col
                      :xs="24"
                      :sm="15"
                    >
                      <el-form-item label="关联模块">
                        <el-select
                          v-model="formData.module_key"
                          placeholder="请选择或搜索模块"
                          filterable
                          clearable
                          class="w-full"
                        >
                          <el-option
                            v-for="module in modules"
                            :key="module.key"
                            :label="`${module.name} (${module.key})`"
                            :value="module.key"
                          />
                        </el-select>
                      </el-form-item>
                    </el-col>
                  </el-row>

                  <el-form-item label="备注">
                    <el-input
                      v-model="formData.remarks"
                      class="tf-textarea"
                      type="textarea"
                      placeholder="给自己或同事留一点上下文，例如这个菜单的用途。"
                      :rows="2"
                      maxlength="500"
                      show-word-limit
                    />
                  </el-form-item>
                </section>

                <aside class="editor-card editor-card--side">
                  <div class="editor-card-head">
                    <span class="editor-card-icon"><i class="fas fa-icons" /></span>
                    <div>
                      <h6>菜单图标</h6>
                      <p>选择本地或在线图标。</p>
                    </div>
                  </div>

                  <el-form-item
                    label="菜单图标"
                    class="full-width"
                  >
                    <IconPicker
                      v-if="showModal"
                      v-model="formData.icon"
                      :default-collapsed="false"
                      @select="handleIconSelect"
                    />
                  </el-form-item>
                </aside>
              </div>
            </el-form>
          </div>

          <template #footer>
            <div class="tf-dialog-actions modal-footer">
              <el-button
                type="info"
                native-type="button"
                @click="closeModal"
              >
                <i class="fas fa-times" />
                取消
              </el-button>
              <el-button
                type="primary"
                native-type="button"
                :disabled="submitting"
                @click="handleSubmit"
              >
                <InlineLoading
                  v-if="submitting"
                  text="保存中..."
                  size="small"
                  variant="inherit"
                />
                <template v-else>
                  <i class="fas fa-save" />
                  保存
                </template>
              </el-button>
            </div>
          </template>
        </MobileDialog>

        <!-- 菜单宽度设置模态框 -->
        <MobileDialog
          v-model="showMenuWidthModal"
          title="菜单宽度设置"
          width="520px"
          :close-on-click-modal="false"
          :show-default-footer="false"
          dialog-class="menu-width-dialog"
          destroy-on-close
          @close="closeMenuWidthModal"
          @cancel="closeMenuWidthModal"
        >
          <el-form
            label-position="top"
            class="tf-dialog-form menu-width-form"
          >
            <p class="menu-width-form__hint">
              分别设置桌面端和手机端侧边菜单的显示宽度，范围 100-500px。
            </p>
            <el-row :gutter="16">
              <el-col
                :xs="24"
                :sm="12"
              >
                <el-form-item label="PC端">
                  <el-input-number
                    v-model.number="pcMenuWidth"
                    :min="100"
                    :max="500"
                    :controls="false"
                    class="menu-width-form__input"
                  >
                    <template #suffix>
                      px
                    </template>
                  </el-input-number>
                </el-form-item>
              </el-col>
              <el-col
                :xs="24"
                :sm="12"
              >
                <el-form-item label="手机端">
                  <el-input-number
                    v-model.number="mobileMenuWidth"
                    :min="100"
                    :max="500"
                    :controls="false"
                    class="menu-width-form__input"
                  >
                    <template #suffix>
                      px
                    </template>
                  </el-input-number>
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <template #footer>
            <div class="tf-dialog-actions">
              <el-button
                type="info"
                native-type="button"
                :disabled="isWidthLoading"
                @click="closeMenuWidthModal"
              >
                <i class="fas fa-times" />
                取消
              </el-button>
              <el-button
                type="primary"
                native-type="button"
                :disabled="isWidthLoading"
                @click="applyBothMenuWidths"
              >
                <InlineLoading
                  v-if="isWidthLoading"
                  text="保存中..."
                  size="small"
                  variant="inherit"
                />
                <template v-else>
                  <i class="fas fa-save" />
                  保存
                </template>
              </el-button>
            </div>
          </template>
        </MobileDialog>
      </div>  <!-- END: .content -->
    </PermissionGate>
  </div>    <!-- END: .menu-management -->
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { ref, onMounted, computed, watch, defineAsyncComponent } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { useRefreshData } from '@/composables/useRefreshData'
import { useImportExport } from '@/composables/useImportExport'
import { useLoadingState } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useMenuStore } from '@/stores/menu'
import { useMenuWidth } from '@/composables/useMenuWidth'
import { useMobile } from '@/composables/mobile'
import { useMobileRowDoubleTap } from '@/composables/useMobileRowDoubleTap'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import IconRenderer from '@/components/IconRenderer.vue'
import { useEventBus } from '@/composables/core/useEventBus'
import { PageHeader, PermissionGate } from '@/components/base'
import { logger } from '@/utils/logger'
import {
  getRequestErrorMessage,
  getRequestErrorPayload,
  getRequestErrorStatus
} from '@/utils/api-response'
import { getRoutePermissions } from '@/constants/routePermissions'
import { MODULE_KEY_MAP } from '@/utils/permissionMapper'
import type { MenuItem } from '@/types/menu'
import type { QueryParams } from '@/types/shared'

const IconPicker = defineAsyncComponent(() => import('@/components/IconPicker.vue'))

// 权限检查
const { canView, canCreate, canEdit, canDelete, canExport, canImport, handleNoPermission } = usePagePermissions('menu')

const menuFieldMap: Record<string, string> = {
  stats_total_menus: 'stats.total_menus',
  stats_active_menus: 'stats.active_menus',
  stats_inactive_menus: 'stats.inactive_menus',
  stats_root_menus: 'stats.root_menus',
  actions: 'system_info.operations'
}

const getMenuFieldKey = (fieldName: string) => menuFieldMap[fieldName] || fieldName
const canViewMenuField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('menu_menumanagementview', getMenuFieldKey(fieldName))
}

const showStatsCards = computed(() => (
  canViewMenuField('stats_total_menus') ||
  canViewMenuField('stats_active_menus') ||
  canViewMenuField('stats_inactive_menus') ||
  canViewMenuField('stats_root_menus')
))
const showMenuActionField = computed(() => shouldShowActionColumn(
  canViewMenuField('actions'),
  [canEdit.value, canCreate.value, canDelete.value]
))

// 权限和通知
const menuStore = useMenuStore()
const { success, error, warning: _warning, info: _info, handleApiError, confirm: _confirm } = useNotification()
const { refreshing, refresh } = useRefreshData()
const { exportFile, importFile, buildDateFilename } = useImportExport()
const { isMobile } = useMobile()

// 事件总线
const { emit } = useEventBus()

// 响应式数据
const menuTree = ref<MenuItem[]>([])
const { loading } = useLoadingState()
const menuImportInputRef = ref<HTMLInputElement | null>(null)
const exportingMenus = ref(false)
const importingMenus = ref(false)
const showModal = ref(false)
const showMenuWidthModal = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const currentEditId = ref<string | number | null>(null)
const errorMessage = ref('')  // 重命名以避免与通知服务的 error 冲突

// 展开/折叠状态管理
const expandedMenus = ref<Set<string | number>>(new Set()) // 存储展开的菜单ID

// 表单数据
const formData = ref({
  name: '',
  url: '',
  icon: '',
  icon_svg: '',
  parent_id: 0,
  sort_order: 0,
  target: '_self',
  is_active: true,
  remarks: '',
  module_id: 0,
  module_key: ''
})

// 模块列表
interface MenuModule {
  id: number
  key: string
  name?: string
  module_key?: string
  [key: string]: unknown
}

interface VisibleMenuRow extends MenuItem {
  children?: MenuItem[]
  hasChildren: boolean
  depth: number
}

interface ParentMenuOption {
  id: string | number
  name: string
}

type MenuType = NonNullable<MenuItem['menu_type']>

const modules = ref<MenuModule[]>([])

// 搜索表单
const searchForm = ref({
  name: '',
  menu_type: '',
  status: ''
})

const buildMenuExportParams = () => {
  const params: QueryParams = {}

  if (searchForm.value.name) {
    params.keyword = searchForm.value.name
  }

  if (searchForm.value.menu_type) {
    params.menu_type = searchForm.value.menu_type
  }

  if (searchForm.value.status !== '') {
    params.status = searchForm.value.status
  }

  return params
}

const handleMenuExport = async () => {
  await exportFile({
    url: '/menus/export/excel',
    filename: buildDateFilename('菜单管理', 'xlsx'),
    params: buildMenuExportParams(),
    allowed: canExport,
    loading: exportingMenus,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '菜单数据导出成功',
    errorMessage: '菜单数据导出失败'
  })
}

const triggerMenuImport = () => {
  if (!canImport.value) {
    handleNoPermission('import')
    return
  }

  menuImportInputRef.value?.click()
}

const handleMenuImportChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    const result = await importFile({
      url: '/menus/import/excel',
      file,
      allowed: canImport,
      loading: importingMenus,
      onNoPermission: () => handleNoPermission('import'),
      successMessage: '菜单数据导入成功',
      errorMessage: '菜单数据导入失败'
    })

    if (result?.success) {
      await loadMenus(true, true, false)
    }
  } finally {
    input.value = ''
  }
}
const menuSearchExpanded = ref(false)
const activeMobileMenuId = ref<string | number | null>(null)
const { isDoubleTap } = useMobileRowDoubleTap()
let sharedPublicMenuPromise: Promise<MenuItem[]> | null = null

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : null
)

const extractMenuTreeData = (response: unknown): MenuItem[] => {
  const responseRecord = asRecord(response)
  if (responseRecord?.success !== true) return []

  const data = responseRecord.data
  if (Array.isArray(data)) {
    return data as MenuItem[]
  }

  const dataRecord = asRecord(data)
  if (Array.isArray(dataRecord?.records)) {
    return dataRecord.records as MenuItem[]
  }

  if (Array.isArray(dataRecord?.menuPermissions)) {
    return dataRecord.menuPermissions as MenuItem[]
  }

  return []
}

// PC和手机端菜单宽度状态
const pcMenuWidth = ref(200)
const mobileMenuWidth = ref(280)
const isWidthLoading = ref(false)

// 使用菜单宽度组合式函数
const {
  menuWidth: _globalMenuWidth,
  setMenuWidth,
  loadAllMenuWidths,
  setBothMenuWidths,
  isLoading: _menuWidthLoading
} = useMenuWidth()

// 父级菜单选项
const parentMenuOptions = computed(() => {
  const options: ParentMenuOption[] = []
  const excludeId = isEdit.value ? currentEditId.value : null

  const addMenuOptions = (menus: MenuItem[], prefix = ''): void => {
    menus.forEach((menu: MenuItem) => {
      // 排除当前编辑的菜单及其子菜单
      if (menu.id !== excludeId) {
        options.push({
          id: menu.id,
          name: prefix + (menu.title || menu.name || 'Unknown Menu')
        })

        if (menu.children) {
          addMenuOptions(menu.children, prefix + '├─ ')
        }
      }
    })
  }

  addMenuOptions(menuTree.value)
  return options
})

// 方法
const loadPublicMenuTree = async () => {
  if (sharedPublicMenuPromise) {
    return sharedPublicMenuPromise
  }

  sharedPublicMenuPromise = (async () => {
    const publicResponse = await unifiedApi.get('/permissions/user-menu')
    return extractMenuTreeData(publicResponse)
  })().finally(() => {
    sharedPublicMenuPromise = null
  })

  return sharedPublicMenuPromise
}

const loadMenus = async (_bustCache: boolean = false, silentError: boolean = false, showLoadingState: boolean = true) => {
  if (!canView.value) {
    menuTree.value = []
    return
  }

  if (showLoadingState) {
    loading.value = true
  }
  errorMessage.value = ''

  try {
    // 首先尝试使用需要认证的管理接口
    const response = await unifiedApi.get('/menus', {
      params: {
        is_tree: true
      }
    })

    if (response && response.success) {
      menuTree.value = extractMenuTreeData(response)
    } else {
      throw new Error(response?.message || '获取菜单列表失败')
    }
  } catch (err) {
    // 检查是否是权限错误
    if (getRequestErrorStatus(err) === 403) {
      errorMessage.value = '您没有菜单管理权限，请联系管理员分配权限'
      // unified-api 已经处理了权限错误提示，这里不再重复显示
    } else {
      // 如果认证接口失败，尝试使用公开的用户菜单接口
      try {
        menuTree.value = await loadPublicMenuTree()
      } catch (publicErr) {
        logger.error('所有接口都失败:', publicErr)
        errorMessage.value = '无法加载菜单数据，请检查网络连接或稍后重试'
        if (!silentError) {
          error(`加载失败: ${errorMessage.value}`)
        }
      }
    }
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const toggleMobileMenuActions = (menuId: string | number) => {
  activeMobileMenuId.value = activeMobileMenuId.value === menuId ? null : menuId
}

const handleMenuRowTap = (menu: MenuItem) => {
  if (!isMobile.value) return

  if (isDoubleTap(menu.id)) toggleMobileMenuActions(menu.id)
}

const searchMenus = async () => {
  if (!canView.value) {
    menuTree.value = []
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    // 首先尝试使用需要认证的接口
    const response = await unifiedApi.get('/menus', {
      params: {
        ...searchForm.value,
        is_tree: true
      }
    })

    if (response && response.success) {
      menuTree.value = extractMenuTreeData(response)
    } else {
      throw new Error(response?.message || '搜索菜单失败')
    }
  } catch (err) {
    logger.warn('搜索接口失败，使用公开接口:', getRequestErrorMessage(err))

    // 如果搜索接口失败，回退到公开接口并应用前端过滤
    try {
      let allMenus = await loadPublicMenuTree()
      if (allMenus) {

        // 前端过滤
        if (searchForm.value.name) {
          allMenus = filterMenusByName(allMenus, searchForm.value.name)
        }
        if (searchForm.value.menu_type) {
          allMenus = filterMenusByType(allMenus, searchForm.value.menu_type)
        }
        if (searchForm.value.status !== '') {
          allMenus = filterMenusByStatus(allMenus, parseInt(searchForm.value.status))
        }

        menuTree.value = allMenus
      } else {
        throw new Error('搜索菜单失败')
      }
    } catch (publicErr) {
      logger.error('搜索失败:', publicErr)
      errorMessage.value = '搜索失败，请稍后重试'
      error(`搜索失败: ${errorMessage.value}`)
    }
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchForm.value = {
    name: '',
    menu_type: '',
    status: ''
  }
  loadMenus()
}

const refreshData = async () => {
  if (!canView.value) {
    return
  }

  // 实现静默刷新，避免页面抖动
  try {
    unifiedApi.clearCache('/menus')
    await refresh(async () => {
      await loadMenus(true, false, false)
    })
    success('数据刷新成功', { duration: 2000 })
  } catch (err) {
    error('刷新失败：请稍后重试')
  }
}

// 加载模块列表
const loadModules = async () => {
  if (!canView.value) {
    modules.value = []
    return
  }

  try {
    const response = await unifiedApi.get('/modules')
    if (response && response.success) {
      const responseData = asRecord(response.data)
      const moduleList = Array.isArray(response.data)
        ? response.data
        : Array.isArray(responseData?.records)
          ? responseData.records
          : []

      modules.value = moduleList as MenuModule[]
    } else {
      modules.value = []
    }
  } catch (err) {
    logger.error('加载模块失败:', err)
    modules.value = []
  }
}

// 根据 URL 智能识别模块
const detectModuleFromUrl = (url: string) => {
  if (!url || modules.value.length === 0) return null
  // 路由查看权限已定义主页面模块，禁止用 includes 猜测同名子 Tab。
  const permissions = getRoutePermissions(url) || getRoutePermissions(url.toLowerCase())
  const shortKey = permissions?.[0]?.split(':')[0]
  const moduleKey = shortKey ? MODULE_KEY_MAP[shortKey] : undefined
  return moduleKey ? modules.value.find(module => module.key === moduleKey) || null : null
}

// 监听 URL 变化，自动识别模块
watch(() => formData.value.url, (newUrl) => {
  // 只在未手动选择模块时自动识别
  if (!formData.value.module_id && !formData.value.module_key && newUrl) {
    const detectedModule = detectModuleFromUrl(newUrl)
    if (detectedModule) {
      formData.value.module_id = detectedModule.id
      formData.value.module_key = detectedModule.key
    }
  }
})

// 监听 module_id 变化，自动填充 module_key
watch(() => formData.value.module_id, (newModuleId) => {
  if (newModuleId) {
    const module = modules.value.find(m => m.id === newModuleId)
    if (module) {
      // 只在 module_key 不匹配时才更新，避免不必要的触发
      if (formData.value.module_key !== module.key) {
        formData.value.module_key = module.key
      }
    }
  } else {
    // 清空 module_id 时，也清空 module_key
    if (formData.value.module_key) {
      formData.value.module_key = ''
    }
  }
})

// 监听 module_key 变化，自动查找 module_id
watch(() => formData.value.module_key, (newModuleKey) => {
  if (newModuleKey) {
    const module = modules.value.find(m => m.key === newModuleKey)
    if (module && formData.value.module_id !== module.id) {
      formData.value.module_id = module.id
    }
  } else if (formData.value.module_id) {
    formData.value.module_id = 0
  }
})

const handleIconSelect = (iconName: string, icon?: { svg?: string }) => {
  formData.value.icon = iconName || ''
  formData.value.icon_svg = icon?.svg || ''
}

// 切换菜单展开状态
const toggleMenuExpansion = (menuId: string | number) => {
  if (expandedMenus.value.has(menuId)) {
    expandedMenus.value.delete(menuId)
  } else {
    expandedMenus.value.add(menuId)
  }
}

// 检查菜单是否展开
const isMenuExpanded = (menuId: string | number) => {
  return expandedMenus.value.has(menuId)
}

// 递归显示子菜单
const _displayChildren = (children: MenuItem[] | undefined, parentId: string | number) => {
  if (!children || children.length === 0 || !isMenuExpanded(parentId)) {
    return []
  }
  return children
}

// 表格使用扁平可见行，由本页统一维护展开状态。
// 去掉行上的 children 字段，避免 Element Plus 再生成一枚未接入本页状态的树形箭头。
const visibleMenuRows = computed(() => {
  const rows: VisibleMenuRow[] = []
  const append = (menus: MenuItem[], depth = 0) => {
    menus.forEach(menu => {
      rows.push({
        ...menu,
        children: undefined,
        hasChildren: Array.isArray(menu.children) && menu.children.length > 0,
        depth
      })
      if (menu.children?.length && isMenuExpanded(menu.id)) {
        append(menu.children, depth + 1)
      }
    })
  }
  append(menuTree.value)
  return rows
})

// PC和手机端菜单宽度相关方法
const initializeMenuWidths = async () => {
  try {
    const widths = await loadAllMenuWidths()
    pcMenuWidth.value = widths.pc || 200
    mobileMenuWidth.value = widths.mobile || 280
  } catch (error) {
    logger.error('初始化菜单宽度失败:', error)
    // 使用默认值
    pcMenuWidth.value = 200
    mobileMenuWidth.value = 280
  }
}

const normalizeMenuWidth = (value: number, fallback: number) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(500, Math.max(100, Math.round(numericValue)))
}

const openMenuWidthModal = () => {
  showMenuWidthModal.value = true
}

const closeMenuWidthModal = () => {
  if (isWidthLoading.value) return
  showMenuWidthModal.value = false
}

const applyBothMenuWidths = async () => {
  try {
    isWidthLoading.value = true
    pcMenuWidth.value = normalizeMenuWidth(pcMenuWidth.value, 200)
    mobileMenuWidth.value = normalizeMenuWidth(mobileMenuWidth.value, 280)

    // 保存到 localStorage 并同步到数据库
    await setBothMenuWidths(pcMenuWidth.value, mobileMenuWidth.value)
    setMenuWidth(isMobile.value ? mobileMenuWidth.value : pcMenuWidth.value)

    success('菜单宽度设置成功', {
      title: `PC端: ${pcMenuWidth.value}px, 手机端: ${mobileMenuWidth.value}px`,
      duration: 3000
    })
    showMenuWidthModal.value = false
  } catch (err) {
    logger.error('应用菜单宽度失败:', err)
    error(`设置失败：${getRequestErrorMessage(err, '应用菜单宽度时发生错误')}`)
  } finally {
    isWidthLoading.value = false
  }
}

const showAddModal = (parentId = 0) => {
  if (!canCreate.value) {
    error('权限不足：您没有新增菜单的权限')
    return
  }

  isEdit.value = false
  currentEditId.value = null
  formData.value = {
    name: '',
    url: '',
    icon: '',
    icon_svg: '',
    parent_id: parentId,
    sort_order: 0,
    target: '_self',
    is_active: true,
    remarks: '',
    module_id: 0,
    module_key: ''
  }
  showModal.value = true
}

const normalizeMenuActiveState = (menu: MenuItem): boolean => {
  const activeValue = menu.status ?? menu.is_active

  if (activeValue === undefined || activeValue === null) {
    return true
  }

  if (typeof activeValue === 'boolean') {
    return activeValue
  }

  return Number(activeValue) === 1
}

const showEditModal = (menu: MenuItem): void => {
  if (!canEdit.value) {
    error('权限不足：您没有编辑菜单的权限')
    return
  }

  isEdit.value = true
  currentEditId.value = menu.id
  formData.value = {
    name: menu.title || menu.name || '',
    url: menu.path || menu.url || '',
    icon: menu.icon || '',
    icon_svg: menu.icon_svg || '',
    parent_id: Number(menu.parent_id) || 0,
    sort_order: menu.sort_order || 0,
    target: menu.target || '_self',
    is_active: normalizeMenuActiveState(menu),
    remarks: menu.remarks || '',
    module_id: menu.module_id || 0,
    module_key: menu.module_key || ''
  }
  showModal.value = true
}

const closeModal = () => {
  submitting.value = false
  showModal.value = false
}

const handleDialogClose = () => {
  closeModal()
}

// 表单验证函数
const validateForm = () => {
  const errors = []

  // 菜单名称验证
  if (!formData.value.name || formData.value.name.trim() === '') {
    errors.push('菜单名称不能为空')
  } else if (formData.value.name.trim().length < 2) {
    errors.push('菜单名称至少需要2个字符')
  } else if (formData.value.name.trim().length > 50) {
    errors.push('菜单名称不能超过50个字符')
  }

  // URL路径验证
  const url = formData.value.url ? formData.value.url.trim() : ''
  if (!url) {
    errors.push('URL路径不能为空')
  } else if (url === '#') {
    // 一级菜单使用 #，直接通过验证
  } else {
    // 二级菜单需要以 / 开头的有效路径
    const urlPattern = /^\/[a-zA-Z0-9\-_/]*$/
    if (!urlPattern.test(url)) {
      errors.push('URL路径格式不正确，应以/开头，只包含字母、数字、-、_和/（一级菜单请使用#）')
    }
  }

  // 排序顺序验证
  if (formData.value.sort_order < 0) {
    errors.push('排序顺序不能为负数')
  } else if (formData.value.sort_order > 9999) {
    errors.push('排序顺序不能超过9999')
  }

  // 图标验证（可选）
  if (formData.value.icon && formData.value.icon.trim().length > 255) {
    errors.push('图标名称不能超过255个字符')
  }

  // 备注验证（可选）
  if (formData.value.remarks && formData.value.remarks.trim().length > 500) {
    errors.push('备注不能超过500个字符')
  }

  // 目标验证
  if (!['_self', '_blank', '_parent', '_top'].includes(formData.value.target)) {
    errors.push('打开方式不正确')
  }

  return errors
}

const handleSubmit = async () => {
  if (submitting.value) return

  if (isEdit.value && !canEdit.value) {
    error('权限不足：您没有编辑菜单的权限')
    return
  }

  if (!isEdit.value && !canCreate.value) {
    error('权限不足：您没有新增菜单的权限')
    return
  }

  // 前端表单验证
  const validationErrors = validateForm()
  if (validationErrors.length > 0) {
    error(`表单验证失败: ${validationErrors.join('；')}`)
    return
  }

  submitting.value = true

  try {
    // 准备提交数据
    const submitData = {
      ...formData.value,
      name: formData.value.name.trim(),
      url: formData.value.url ? formData.value.url.trim() : '#',
      icon: formData.value.icon ? formData.value.icon.trim() : '',
      remarks: formData.value.remarks ? formData.value.remarks.trim() : '',
      sort_order: parseInt(String(formData.value.sort_order)) || 0,
      parent_id: parseInt(String(formData.value.parent_id)) || 0,
      target: formData.value.target || '_self',
      is_active: formData.value.is_active ? 1 : 0,
      // 正确处理模块关联字段：确保数字类型，0 或空值转为 null
      module_id: (formData.value.module_id && parseInt(String(formData.value.module_id)) > 0) ? parseInt(String(formData.value.module_id)) : null,
      module_key: formData.value.module_key || null
    }

    let response
    if (isEdit.value && currentEditId.value) {
      response = await unifiedApi.put(`/menus/${currentEditId.value}`, submitData)
    } else {
      response = await unifiedApi.post('/menus', submitData)
    }

    if (response && response.success) {
      closeModal()
      await new Promise(resolve => setTimeout(resolve, 100))
      await Promise.all([loadMenus(), loadModules()])
      success('保存成功', {
        title: isEdit.value ? `菜单"${formData.value.name}"更新成功` : `菜单"${formData.value.name}"创建成功`,
        duration: 3000
      })

      // 刷新侧边栏菜单
      await menuStore.refreshMenus()

      // 发送菜单更新事件，通知侧边栏刷新
      emit('menu:updated', { action: 'update', menuName: formData.value.name })
    } else {
      throw new Error(response?.message || '保存失败')
    }
  } catch (err) {
    logger.error('保存菜单失败:', err)

    // 处理验证错误（422状态码）
    let errorTitle = '保存菜单时发生错误'
    let errorDetails = ''

    const status = getRequestErrorStatus(err)
    const responseData = getRequestErrorPayload(err)

    if (status === 422 && responseData) {
      // 验证错误，显示具体的错误信息
      if (Array.isArray(responseData.errors)) {
        errorDetails = responseData.errors.filter((item): item is string => typeof item === 'string').join('；')
      } else if (typeof responseData.message === 'string') {
        errorDetails = responseData.message
      }
      errorTitle = '数据验证失败'
    } else if (status === 400 && responseData) {
      // 400错误
      if (typeof responseData.message === 'string') {
        errorDetails = responseData.message
      }
      errorTitle = '请求错误'
    } else if (responseData && typeof responseData.message === 'string') {
      // 其他错误
      errorDetails = responseData.message
    }
    if (!errorDetails) {
      errorDetails = getRequestErrorMessage(err, '')
    }

    error(`${errorTitle}: ${errorDetails || '未知错误'}`)
  } finally {
    submitting.value = false
  }
}

const executeDelete = async (menu: MenuItem): Promise<void> => {
  const menuName = menu.title || menu.name || '未知菜单'
  const hasChildren = menu.children && menu.children.length > 0

  try {
    await confirmAction(
      hasChildren
        ? `确定要删除菜单"${menuName}"吗？<br><br>⚠️ <strong>注意：此菜单包含子菜单，删除后将同时删除所有子菜单。</strong>`
        : `确定要删除菜单"${menuName}"吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: hasChildren ? 'error' : 'warning',
        customClass: 'message-box-unified',
        dangerouslyUseHTMLString: true
      }
    )
  } catch {
    return
  }

  try {
    const response = await unifiedApi.delete(`/menus/${menu.id}`)

    if (response && response.success) {
      // 延迟一下重新加载数据，让用户看到操作反馈
      setTimeout(async () => {
        await loadMenus()
        success('删除成功', {
          title: `菜单"${menuName}"已删除`,
          duration: 3000
        })

        // 刷新侧边栏菜单
        await menuStore.refreshMenus()

        // 发送菜单更新事件，通知侧边栏刷新
        emit('menu:updated')
      }, 300)
    } else {
      throw new Error(response?.message || '删除失败')
    }
  } catch (err) {
    logger.error('删除菜单失败:', err)
    handleApiError(err, `删除菜单"${menuName}"失败`)
  }
}

const handleDelete = (menu: MenuItem): void => {
  if (!canDelete.value) {
    error('权限不足：您没有删除菜单的权限')
    return
  }

  executeDelete(menu)
}

// 统计方法
const getMenuCount = (): number => {
  const countMenus = (menus: MenuItem[]): number => {
    let count = 0
    menus.forEach((menu: MenuItem) => {
      count++
      if (menu.children && menu.children.length > 0) {
        count += countMenus(menu.children)
      }
    })
    return count
  }
  return countMenus(menuTree.value)
}

const getActiveMenuCount = (): number => {
  const countActiveMenus = (menus: MenuItem[]): number => {
    let count = 0
    menus.forEach((menu: MenuItem) => {
      if (menu.is_active) count++
      if (menu.children && menu.children.length > 0) {
        count += countActiveMenus(menu.children)
      }
    })
    return count
  }
  return countActiveMenus(menuTree.value)
}

const getInactiveMenuCount = () => {
  return getMenuCount() - getActiveMenuCount()
}

const getRootMenuCount = () => {
  return menuTree.value.length
}

const getMenuTypeLabel = (type?: MenuType): string => {
  const types: Record<MenuType, string> = {
    'menu': '菜单',
    'directory': '目录',
    'button': '按钮'
  }
  return types[type || 'menu'] || '菜单'
}

// 前端过滤函数
const filterMenusByName = (menus: MenuItem[], name: string): MenuItem[] => {
  const filtered: MenuItem[] = []
  const lowerName = name.toLowerCase()

  const filterRecursive = (menuList: MenuItem[]): void => {
    menuList.forEach((menu: MenuItem) => {
      if ((menu.title && menu.title.toLowerCase().includes(lowerName)) ||
          (menu.name && menu.name.toLowerCase().includes(lowerName))) {
        filtered.push(menu)
      }

      if (menu.children && menu.children.length > 0) {
        filterRecursive(menu.children)
      }
    })
  }

  filterRecursive(menus)
  return filtered
}

const filterMenusByType = (menus: MenuItem[], type: string): MenuItem[] => {
  const filtered: MenuItem[] = []

  const filterRecursive = (menuList: MenuItem[]): void => {
    menuList.forEach((menu: MenuItem) => {
      if (menu.menu_type === type) {
        filtered.push(menu)
      }

      if (menu.children && menu.children.length > 0) {
        filterRecursive(menu.children)
      }
    })
  }

  filterRecursive(menus)
  return filtered
}

const filterMenusByStatus = (menus: MenuItem[], status: number): MenuItem[] => {
  const filtered: MenuItem[] = []

  const filterRecursive = (menuList: MenuItem[]): void => {
    menuList.forEach((menu: MenuItem) => {
      if (menu.status === status) {
        filtered.push(menu)
      }

      if (menu.children && menu.children.length > 0) {
        filterRecursive(menu.children)
      }
    })
  }

  filterRecursive(menus)
  return filtered
}

// 生命周期
onMounted(async () => {
  if (!canView.value) {
    return
  }

  await fieldPermissions.init()
  // 初始化加载菜单数据
  loadMenus()

  // 加载模块列表
  loadModules()

  // 加载PC和手机端菜单宽度
  initializeMenuWidths()
})
</script>

<style scoped src="./styles/menu-management/layout-and-form.css"></style>
<style scoped src="./styles/menu-management/table.css"></style>
<style scoped src="./styles/menu-management/menu-cells.css"></style>
<style scoped src="./styles/menu-management/editor.css"></style>
<style scoped src="./styles/menu-management/responsive.css"></style>
