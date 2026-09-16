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
                :disabled="refreshing"
                @click="refreshData"
              >
                <InlineLoading
                  v-if="refreshing"
                  text="刷新中..."
                  size="small"
                  variant="inherit"
                />
                <template v-else>
                  <i class="fas fa-sync-alt" />
                  <span>刷新</span>
                </template>
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

        <!-- 操作工具栏 -->
        <div class="toolbar-section admin-panel">
          <div class="toolbar-left">
            <div class="btn-group">
              <el-button
                type="primary"
                plain
                @click="expandAll"
              >
                <i class="fas fa-expand-alt" />
                展开全部
              </el-button>
              <el-button
                type="primary"
                plain
                @click="collapseAll"
              >
                <i class="fas fa-compress-alt" />
                折叠全部
              </el-button>
            </div>
          </div>
          <div class="toolbar-right">
            <!-- PC和手机端菜单宽度设置 -->
            <div class="menu-widths-setting">
              <div class="setting-header">
                <div class="setting-title">
                  <i class="fas fa-sliders-h" />
                  <span>菜单宽度设置</span>
                </div>
                <el-button
                  type="success"
                  size="small"
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
                    <i class="fas fa-check" />
                    保存设置
                  </template>
                </el-button>
              </div>
              <div class="width-controls">
                <!-- PC端宽度设置 -->
                <div class="width-control pc-width">
                  <label class="inline-width-label">
                    <i class="fas fa-desktop" />
                    <span>PC端</span>
                  </label>
                  <div class="range-input">
                    <input
                      v-model.number="pcMenuWidth"
                      type="number"
                      min="100"
                      max="500"
                      class="form-range"
                      placeholder="请输入宽度"
                    >
                  </div>
                </div>

                <!-- 手机端宽度设置 -->
                <div class="width-control mobile-width">
                  <label class="inline-width-label">
                    <i class="fas fa-mobile-alt" />
                    <span>手机端</span>
                  </label>
                  <div class="range-input">
                    <input
                      v-model.number="mobileMenuWidth"
                      type="number"
                      min="100"
                      max="500"
                      class="form-range"
                      placeholder="请输入宽度"
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                    <button
                      v-if="row.children?.length"
                      class="expand-btn"
                      type="button"
                      :title="isMenuExpanded(row.id) ? '折叠子菜单' : '展开子菜单'"
                      @click.stop="toggleMenuExpansion(row.id)"
                    >
                      <i :class="isMenuExpanded(row.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'" />
                    </button>
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
              min-width="80"
              align="center"
            >
              <template #default="{ row }">
                <span class="sort-badge">{{ row.sort_order }}</span>
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
                          controls-position="right"
                          placeholder="越小越靠前"
                          class="w-full"
                        />
                      </el-form-item>
                    </el-col>
                    <el-col
                      :xs="24"
                      :sm="15"
                    >
                      <el-form-item label="绑定模块（名称 / Key）">
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
                      type="textarea"
                      placeholder="给自己或同事留一点上下文，例如这个菜单的用途。"
                      :rows="3"
                      maxlength="500"
                      show-word-limit
                    />
                  </el-form-item>
                </section>

                <aside class="editor-card editor-card--side">
                  <div class="editor-card-head">
                    <span class="editor-card-icon"><i class="fas fa-icons" /></span>
                    <div>
                      <h6>图标与模块</h6>
                      <p>选择本地/在线图标，并关联权限模块。</p>
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

                  <el-form-item label="关联模块">
                    <div class="module-selector-section">
                      <el-select
                        v-model="formData.module_id"
                        placeholder="请选择关联模块（可选）"
                        filterable
                        clearable
                        class="module-select-input"
                        popper-class="tf2025-form-popper module-select-dropdown"
                        :teleported="false"
                        :fit-input-width="true"
                        @change="handleModuleChange"
                      >
                        <el-option
                          :value="0"
                          label="不关联模块"
                        />
                        <el-option-group
                          v-for="group in groupedModuleOptions"
                          :key="group.key"
                          :label="group.label"
                        >
                          <el-option
                            v-for="module in group.modules"
                            :key="module.id"
                            :label="`${module.name} (${module.key})`"
                            :value="module.id"
                          >
                            <div
                              class="module-option"
                              :class="[`is-${module.relation}`]"
                            >
                              <div class="module-info">
                                <div class="module-title-row">
                                  <span class="module-name">{{ module.name }}</span>
                                  <span
                                    class="module-relation-badge"
                                    :class="`is-${module.relation}`"
                                  >
                                    {{ getModuleRelationLabel(module.relation) }}
                                  </span>
                                </div>
                                <span class="module-key">{{ module.key }}</span>
                              </div>
                            </div>
                          </el-option>
                        </el-option-group>
                      </el-select>
                      <small
                        v-if="formData.module_id"
                        class="text-muted"
                      >
                        <i class="fas fa-info-circle" />
                        已选择模块，系统会自动关联 module_key
                      </small>
                    </div>
                  </el-form-item>
                </aside>
              </div>
            </el-form>
          </div>

          <template #footer>
            <div class="modal-footer mobile-dialog-footer">
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
      </div>  <!-- END: .content -->
    </PermissionGate>
  </div>    <!-- END: .menu-management -->
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, defineAsyncComponent } from 'vue'
import { ElMessageBox } from 'element-plus'
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
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import IconRenderer from '@/components/IconRenderer.vue'
import { useEventBus } from '@/composables/core/useEventBus'
import { PageHeader, PermissionGate } from '@/components/base'
import { logger } from '@/utils/logger'

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
const menuTree = ref([])
const { loading } = useLoadingState()
const menuImportInputRef = ref<HTMLInputElement | null>(null)
const exportingMenus = ref(false)
const importingMenus = ref(false)
const showModal = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const currentEditId = ref(null)
const errorMessage = ref('')  // 重命名以避免与通知服务的 error 冲突

// 展开/折叠状态管理
const expandedMenus = ref(new Set()) // 存储展开的菜单ID

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
const modules = ref<any[]>([])

const MODULE_GROUP_CONFIG = [
  {
    parentKey: 'system_systemview',
    label: '系统设置',
    childKeys: ['system_gitmanagement', 'data_optimization_dataoptimizationview'],
    prefix: 'system_'
  },
  {
    parentKey: 'permissions_permissionsview',
    label: '权限管理',
    childKeys: ['permissions_modulemanagementview'],
    prefix: 'permissions_'
  },
  {
    parentKey: 'salary_salaryview',
    label: '工资管理',
    childKeys: ['salary_mysalaryview', 'salary_salarytemplatesview', 'salary_salaryrecordsview'],
    prefix: 'salary_'
  },
  {
    parentKey: 'attendance_attendanceview',
    label: '考勤管理',
    childKeys: ['attendance_myattendanceview'],
    prefix: 'attendance_'
  },
  {
    parentKey: 'price_list_pricelistview',
    label: '价目表',
    childKeys: ['price_list_synclogview'],
    prefix: 'price_list_'
  },
  {
    parentKey: 'h5_admin_h5_adminview',
    label: 'H5商城管理',
    childKeys: [
      'h5_admin_templatesview',
      'h5_admin_configview',
      'h5_admin_homesectionsview',
      'h5_admin_bannersview',
      'h5_admin_ordersview'
    ],
    prefix: 'h5_admin_'
  }
] as const

const getModuleRelationLabel = (relation: 'parent' | 'child' | 'standalone') => {
  if (relation === 'parent') return '母模块'
  if (relation === 'child') return '子模块'
  return '独立模块'
}

const groupedModuleOptions = computed(() => {
  const moduleList: any[] = Array.isArray(modules.value)
    ? modules.value
    : Array.isArray((modules.value as any)?.records)
      ? (modules.value as any).records
      : []
  const moduleMap = new Map<string, any>(moduleList.map((module) => [module.key, module]))
  const consumed = new Set<string>()
  const groups: Array<{
    key: string
    label: string
    modules: Array<any & { relation: 'parent' | 'child' | 'standalone' }>
  }> = []

  MODULE_GROUP_CONFIG.forEach((config) => {
    const parent = moduleMap.get(config.parentKey)
    if (!parent) return

    consumed.add(parent.key)
    const childKeys = new Set(config.childKeys)
    const groupedModules: Array<any & { relation: 'parent' | 'child' | 'standalone' }> = [
      { ...parent, relation: 'parent' as const }
    ]

    config.childKeys.forEach((childKey) => {
      const child = moduleMap.get(childKey)
      if (!child) return
      consumed.add(child.key)
      groupedModules.push({ ...child, relation: 'child' as const })
    })

    moduleList.forEach((module: any) => {
      if (
        !consumed.has(module.key) &&
        module.key?.startsWith(config.prefix) &&
        module.key !== config.parentKey &&
        !childKeys.has(module.key)
      ) {
        consumed.add(module.key)
        groupedModules.push({ ...module, relation: 'child' as const })
      }
    })

    groups.push({
      key: config.parentKey,
      label: config.label,
      modules: groupedModules
    })
  })

  const standaloneModules = moduleList
    .filter((module: any) => !consumed.has(module.key))
    .map((module: any) => ({ ...module, relation: 'standalone' as const }))

  if (standaloneModules.length > 0) {
    groups.push({
      key: 'standalone',
      label: '独立模块',
      modules: standaloneModules
    })
  }

  return groups
})

// 搜索表单
const searchForm = ref({
  name: '',
  menu_type: '',
  status: ''
})

const buildMenuExportParams = () => {
  const params: Record<string, any> = {}

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
const activeMobileMenuId = ref<number | null>(null)
const lastTappedMenuId = ref<number | null>(null)
const lastMenuTapTimestamp = ref(0)
let sharedPublicMenuPromise: Promise<any[]> | null = null

const extractMenuTreeData = (response: any) => {
  if (!response?.success) {
    return []
  }

  const data = response.data
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.records)) {
    return data.records
  }

  if (Array.isArray(data?.menuPermissions)) {
    return data.menuPermissions
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
  const options = []
  const excludeId = isEdit.value ? currentEditId.value : null

  const addMenuOptions = (menus, prefix = '') => {
    menus.forEach(menu => {
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
    if (err.response?.status === 403) {
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

const toggleMobileMenuActions = (menuId: number) => {
  activeMobileMenuId.value = activeMobileMenuId.value === menuId ? null : menuId
}

const handleMenuRowTap = (menu: any) => {
  if (!isMobile.value) return

  const now = Date.now()
  if (lastTappedMenuId.value === menu.id && now - lastMenuTapTimestamp.value <= 320) {
    toggleMobileMenuActions(menu.id)
    lastTappedMenuId.value = null
    lastMenuTapTimestamp.value = 0
    return
  }

  lastTappedMenuId.value = menu.id
  lastMenuTapTimestamp.value = now
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
    logger.warn('搜索接口失败，使用公开接口:', err.message)

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
      const moduleList = Array.isArray(response.data)
        ? response.data
        : Array.isArray((response.data as any)?.records)
          ? (response.data as any).records
          : []

      modules.value = moduleList
    } else {
      modules.value = []
    }
  } catch (err) {
    logger.error('加载模块失败:', err)
    modules.value = []
  }
}

// 处理模块选择变化
const handleModuleChange = (module_id) => {
  if (module_id) {
    const module = modules.value.find(m => m.id === module_id)
    if (module) {
      formData.value.module_key = module.key
    }
  } else {
    formData.value.module_key = ''
  }
}

// 根据 URL 智能识别模块
const detectModuleFromUrl = (url) => {
  if (!url || modules.value.length === 0) return null

  const path = url.toLowerCase().replace(/^\//, '')

  // 精确匹配
  let module = modules.value.find(m => m.key.toLowerCase() === path)
  if (module) return module

  // 模糊匹配
  module = modules.value.find(m => path.includes(m.key.toLowerCase()))
  if (module) return module

  // 路径映射
  const pathModuleMapping = {
    'payment': 'supplier-payments',
    'payments': 'supplier-payments',
    'supplier': 'suppliers',
    'sales': 'sales',
    'inventory': 'inventory',
    'customer': 'customers',
    'repair': 'repairs',
    'attendance': 'attendance',
    'salary': 'salary',
    'subsidy': 'subsidy',
    'git': 'git',
    'settings': 'settings',
    'system': 'system',
    'report': 'reports',
    'dashboard': 'dashboard'
  }

  const firstPart = path.split('/')[0]
  const mappedKey = pathModuleMapping[firstPart]
  if (mappedKey) {
    module = modules.value.find(m => m.key === mappedKey || m.key.toLowerCase().includes(mappedKey))
    if (module) return module
  }

  return null
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

const handleIconSelect = (iconName, icon) => {
  formData.value.icon = iconName || ''
  formData.value.icon_svg = icon?.svg || ''
}

// 切换菜单展开状态
const toggleMenuExpansion = (menuId) => {
  if (expandedMenus.value.has(menuId)) {
    expandedMenus.value.delete(menuId)
  } else {
    expandedMenus.value.add(menuId)
  }
}

// 检查菜单是否展开
const isMenuExpanded = (menuId) => {
  return expandedMenus.value.has(menuId)
}

// 递归显示子菜单
const _displayChildren = (children, parentId) => {
  if (!children || children.length === 0 || !isMenuExpanded(parentId)) {
    return []
  }
  return children
}

// Element Plus 表格使用扁平可见行，保留原有的展开状态并避免页面自绘原生 table。
const visibleMenuRows = computed(() => {
  const rows: any[] = []
  const append = (menus: any[], depth = 0) => {
    menus.forEach(menu => {
      rows.push({ ...menu, depth })
      if (menu.children?.length && isMenuExpanded(menu.id)) {
        append(menu.children, depth + 1)
      }
    })
  }
  append(menuTree.value)
  return rows
})

// 展开所有菜单
const expandAll = () => {
  const allMenuIds = []

  // 递归收集所有有子菜单的菜单ID
  const collectMenuIds = (menus) => {
    menus.forEach(menu => {
      if (menu.children && menu.children.length > 0) {
        allMenuIds.push(menu.id)
        collectMenuIds(menu.children)
      }
    })
  }

  collectMenuIds(menuTree.value)
  expandedMenus.value = new Set(allMenuIds)
  success('已展开所有菜单', { duration: 2000 })
}

// 折叠所有菜单
const collapseAll = () => {
  expandedMenus.value.clear()
  success('已折叠所有菜单', { duration: 2000 })
}

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
  } catch (err) {
    logger.error('应用菜单宽度失败:', err)
    error('设置失败', err.message || '应用菜单宽度时发生错误')
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

const normalizeMenuActiveState = (menu) => {
  const activeValue = menu.status ?? menu.is_active

  if (activeValue === undefined || activeValue === null) {
    return true
  }

  if (typeof activeValue === 'boolean') {
    return activeValue
  }

  return Number(activeValue) === 1
}

const showEditModal = (menu) => {
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
    parent_id: menu.parent_id || 0,
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

    if (err.response) {
      const status = err.response.status
      // 优先使用responseData，如果不存在则使用原始response.data
      const responseData = err.responseData || err.response.data

      if (status === 422 && responseData) {
        // 验证错误，显示具体的错误信息
        if (responseData.errors && Array.isArray(responseData.errors)) {
          errorDetails = responseData.errors.join('；')
        } else if (responseData.message) {
          errorDetails = responseData.message
        }
        errorTitle = '数据验证失败'
      } else if (status === 400 && responseData) {
        // 400错误
        if (responseData.message) {
          errorDetails = responseData.message
        }
        errorTitle = '请求错误'
      } else if (responseData && responseData.message) {
        // 其他错误
        errorDetails = responseData.message
      }
    } else if (err.message) {
      errorDetails = err.message
    }

    error(`${errorTitle}: ${errorDetails || '未知错误'}`)
  } finally {
    submitting.value = false
  }
}

const executeDelete = async (menu) => {
  const menuName = menu.title || menu.name || '未知菜单'
  const hasChildren = menu.children && menu.children.length > 0

  try {
    await ElMessageBox.confirm(
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

const handleDelete = (menu) => {
  if (!canDelete.value) {
    error('权限不足：您没有删除菜单的权限')
    return
  }

  executeDelete(menu)
}

// 统计方法
const getMenuCount = () => {
  const countMenus = (menus) => {
    let count = 0
    menus.forEach(menu => {
      count++
      if (menu.children && menu.children.length > 0) {
        count += countMenus(menu.children)
      }
    })
    return count
  }
  return countMenus(menuTree.value)
}

const getActiveMenuCount = () => {
  const countActiveMenus = (menus) => {
    let count = 0
    menus.forEach(menu => {
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

const getMenuTypeLabel = (type) => {
  const types = {
    'menu': '菜单',
    'directory': '目录',
    'button': '按钮'
  }
  return types[type] || '菜单'
}

// 前端过滤函数
const filterMenusByName = (menus, name) => {
  const filtered = []
  const lowerName = name.toLowerCase()

  const filterRecursive = (menuList) => {
    menuList.forEach(menu => {
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

const filterMenusByType = (menus, type) => {
  const filtered = []

  const filterRecursive = (menuList) => {
    menuList.forEach(menu => {
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

const filterMenusByStatus = (menus, status) => {
  const filtered = []

  const filterRecursive = (menuList) => {
    menuList.forEach(menu => {
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

<style scoped>
/* ===== 模块信息显示样式 ===== */
.module-info {
  background: var(--tf-color-surface-muted);
  border: 1px solid var(--tf-color-border-subtle);
  border-radius: 8px;
  padding: 12px 16px;
}

.module-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--tf-color-border-muted);
}

.module-field:last-child {
  border-bottom: none;
}

.field-label {
  font-weight: 600;
  color: var(--tf-color-gray-bootstrap-700);
  margin-right: 12px;
}

.field-value {
  color: var(--tf-color-gray-bootstrap-900);
  font-family: 'Courier New', monospace;
  background: var(--color-bg-white);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--tf-color-gray-bootstrap-300);
}

.text-muted {
  display: block;
  margin-top: 8px;
  color: var(--tf-color-muted) !important;
  font-size: 13px;
}

/* ===== 模块选择器样式 ===== */
.module-selector-section {
  width: 100%;
}

.module-select-input {
  width: 100%;
}

.module-option {
  display: flex;
  align-items: flex-start;
  padding: 9px 0;
  gap: 8px;
  width: 100%;
  min-width: 0;
  overflow: visible;
}

.module-option.is-child {
  padding-left: 12px;
}

.module-option.is-standalone {
  padding-left: 0;
}

.module-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.module-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.module-name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.45;
  white-space: normal;
  overflow: visible;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.module-relation-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
}

.module-relation-badge.is-parent {
  background: var(--tf-color-violet-100);
  color: var(--tf-color-violet-700);
  border-color: var(--tf-color-purple-300);
}

.module-relation-badge.is-child {
  background: var(--tf-color-cyan-50);
  color: var(--tf-color-teal-700);
  border-color: var(--tf-color-cyan-200);
}

.module-relation-badge.is-standalone {
  background: var(--tf-color-blue-tailwind-50);
  color: var(--tf-color-blue-700);
  border-color: var(--tf-color-blue-tailwind-200);
}

.module-key {
  font-size: 12px;
  color: var(--color-info);
  font-family: 'Courier New', monospace;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* 模块选择器的选项内容较长，保留专用宽度和换行 */
.module-selector-section {
  :deep(.el-select-dropdown) {
    max-width: 700px !important;
  }

  :deep(.el-select__popper) {
    max-width: 700px !important;
  }
}

/* ===== 页面布局样式 ===== */
.menu-management {
  padding: 20px;
  min-height: 100vh;
  background: var(--tf-color-surface-muted);
}

.menu-header-actions {
  display: flex;
  gap: 12px;
  width: 100%;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
}

/* 表单组 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.full-width {
  width: 100%;
  flex: 1 1 100%;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--tf-color-gray-bootstrap-700);
  margin-bottom: 8px;
}

.required {
  color: var(--danger-color);
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: var(--tf-color-muted);
  font-size: 14px;
  z-index: 2;
}

.form-control {
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 2px solid var(--tf-color-border-muted);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: white;
}

.form-control:focus {
  outline: none;
  border-color: var(--tf-color-indigo-brand);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* ===== 工具栏样式 ===== */
.toolbar-section {
  background: white;
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--tf-color-border-muted);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}

.toolbar-left {
  display: flex;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  gap: 20px;
  align-items: center;
}

.menu-widths-setting {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--tf-color-border-form);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--color-bg-white) 0%, var(--tf-color-surface-blue) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.setting-header {
  min-width: 168px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.setting-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--tf-color-neutral-800);
}

.setting-title i {
  color: var(--tf-color-blue-600);
}

.width-controls {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
}

.width-control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 198px;
}

.width-control.pc-width {
  border-left: none;
  padding-left: 0;
}

.width-control.mobile-width {
  border-left: none;
  padding-left: 0;
}

.inline-width-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 56px;
  font-size: 12px;
  font-weight: 600;
  color: var(--tf-color-slate-700);
  white-space: nowrap;
}

.inline-width-label i {
  color: var(--tf-color-blue-600);
}

.range-input {
  display: block;
}

.form-range {
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--tf-color-border-blue);
  border-radius: 10px;
  background: var(--color-bg-white);
  font-size: 13px;
  font-weight: 600;
  color: var(--tf-color-neutral-800);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.setting-header :deep(.el-button) {
  min-height: 34px;
  height: 34px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
}

.form-range:focus {
  border-color: var(--tf-color-indigo-brand);
  box-shadow: 0 0 0 3px rgba(89, 126, 247, 0.12);
}

.btn-group {
  display: flex;
  gap: 8px;
}

/* ===== 加载和错误状态样式 ===== */
.loading-container,
.error-container {
  background: white;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--tf-color-border-muted);
  margin-bottom: 24px;
}

.loading-content,
.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.loading-icon {
  font-size: 32px;
  color: var(--tf-color-indigo-brand);
}

.loading-text,
.error-text {
  font-size: 16px;
  color: var(--tf-color-muted);
  margin: 0;
}

.error-icon {
  font-size: 32px;
  color: var(--danger-color);
}

/* ===== 表格样式 ===== */
.menu-table-section {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--tf-color-border-muted);
}

.menu-table {
  width: 100%;
  border-collapse: separate; /* 修复点击区域问题 */
  border-spacing: 0;
  margin: 0;
  table-layout: auto;
}

.menu-table .column-name {
  width: auto;
}

.menu-table .column-url {
  width: auto;
}

.menu-table .column-icon {
  width: auto;
}

.menu-table .column-sort {
  width: 72px;
}

.menu-table .column-status {
  width: 92px;
}

.menu-table .column-actions {
  width: 240px;
}

.menu-table thead {
  background: linear-gradient(135deg, var(--tf-color-surface-muted), var(--tf-color-border-muted));
}

.menu-table th {
  padding: 12px 10px; /* 使用与全局样式一致的padding */
  text-align: left;
  font-weight: 600;
  color: var(--tf-color-heading);
  font-size: 14px;
  border-bottom: 2px solid var(--tf-color-border-subtle);
  white-space: nowrap;
  min-height: 48px; /* 确保一致的点击区域 */
  height: auto;
  position: relative;
  box-sizing: border-box;
  line-height: 1.4;
  vertical-align: middle;
}

.menu-table .column-icon,
.menu-table .column-sort,
.menu-table .column-status,
.menu-table .column-actions {
  text-align: center;
}

.menu-table td {
  padding: 12px 10px; /* 使用与全局样式一致的padding */
  border-bottom: 1px solid var(--tf-color-border-muted);
  vertical-align: middle;
  min-height: 48px; /* 确保一致的点击区域 */
  height: auto;
  position: relative;
  box-sizing: border-box;
  line-height: 1.4;
}

.menu-row:hover {
  background: rgba(102, 126, 234, 0.05);
}

.parent-row {
  background: var(--tf-color-surface-indigo-pale);
}

.child-row {
  background: var(--tf-color-surface-indigo-soft);
}

.menu-name-cell {
  width: auto;
  min-width: 180px;
}

.menu-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.menu-remarks-text {
  display: block;
  color: var(--tf-color-muted);
  line-height: 1.5;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* 展开/折叠按钮样式 */
.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--tf-button-tool-color);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  padding: 0;
}

.expand-btn:hover {
  background-color: var(--tf-button-primary-hover-bg);
  color: var(--tf-button-primary-soft-hover-color);
}

.expand-btn i {
  font-size: 12px;
  transition: transform 0.2s ease;
}

.expand-placeholder {
  display: inline-block;
  width: 24px;
  height: 24px;
}

.menu-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-title {
  font-weight: 600;
  color: var(--tf-color-heading);
  font-size: 16px;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-block;
  position: relative;
}

.menu-title::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, var(--tf-color-pink-gradient) 0%, var(--tf-color-coral-gradient) 100%);
  opacity: 0.1;
  border-radius: 6px;
  z-index: -1;
}

.menu-type {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.type-menu {
  background: var(--tf-color-blue-100);
  color: var(--tf-color-blue-material-700);
}

.type-directory {
  background: var(--tf-color-orange-material-50);
  color: var(--tf-color-orange-material-700);
}

.type-button {
  background: var(--tf-button-neutral-bg);
  color: var(--tf-button-primary-soft-color);
}

.menu-remarks {
  font-size: 12px;
  color: var(--tf-color-muted);
  font-style: italic;
}

.child-prefix {
  color: var(--tf-color-muted);
  font-weight: 500;
}

.menu-url-cell {
  width: auto;
  min-width: 130px;
}

.url-text {
  background: var(--tf-color-surface-muted);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--tf-color-gray-bootstrap-700);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.menu-icon-cell {
  width: auto;
  min-width: 120px;
  text-align: center;
}

.icon-display {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
}

.menu-icon {
  font-size: 16px;
  color: var(--tf-color-indigo-brand);
  width: 24px;
  text-align: center;
}

.icon-text {
  font-size: 12px;
  color: var(--tf-color-muted);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-sort-cell {
  width: 72px;
  text-align: center;
}

.sort-badge {
  background: linear-gradient(135deg, var(--tf-color-blue-100), var(--tf-color-blue-material-100));
  color: var(--tf-color-blue-material-700);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.menu-status-cell {
  width: 92px;
  text-align: center;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-active {
  background: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border: 1px solid var(--tf-status-success-border);
}

.status-inactive {
  background: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border: 1px solid var(--tf-status-danger-border);
}

.menu-actions-cell {
  width: 240px;
  text-align: center;
}

.action-buttons {
  display: inline-flex;
  justify-content: center;
  flex-wrap: nowrap;
  max-width: 100%;
}

/* ===== 空状态样式 ===== */
.empty-state {
  padding: 80px 40px;
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-icon {
  font-size: 64px;
  color: var(--tf-color-slate-300);
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--tf-color-heading);
  margin: 0;
}

.empty-description {
  font-size: 16px;
  color: var(--tf-color-muted);
  margin: 0;
  max-width: 400px;
}

/* ==================== 现代化菜单编辑弹窗 ==================== */
.menu-editor-body {
  padding: 0;
  color: var(--tf-color-slate-sidebar);
}

.menu-editor-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.menu-editor-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border-radius: 20px;
  background:
    radial-gradient(circle at 12% 20%, rgba(45, 212, 191, 0.28), transparent 30%),
    linear-gradient(135deg, var(--tf-color-slate-ink) 0%, var(--tf-color-cyan-legacy-text) 52%, var(--tf-color-menu-gradient-teal) 100%);
  color: var(--color-bg-white);
  box-shadow: 0 18px 42px rgba(16, 42, 67, 0.2);
}

.menu-editor-preview {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 14px;
}

.preview-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--tf-color-slate-ink);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 26px rgba(0, 0, 0, 0.18);
}

.preview-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
}

.preview-copy strong {
  font-size: 20px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-copy small,
.preview-eyebrow {
  color: rgba(255, 255, 255, 0.74);
}

.preview-eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-switch {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
  font-size: 13px;
  font-weight: 700;
}

.status-switch-label {
  color: rgba(255, 255, 255, 0.9);
}

.status-switch :deep(.el-switch__core) {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.22);
}

.status-switch :deep(.el-switch.is-checked .el-switch__core) {
  border-color: var(--tf-color-teal-300);
  background: var(--tf-color-teal-300);
}

.menu-editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.85fr);
  gap: 18px;
  align-items: start;
}

.editor-card {
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(210, 219, 229, 0.9);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
}

.editor-card--side {
  position: sticky;
  top: 12px;
}

.editor-card-head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
}

.editor-card-icon {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: var(--tf-color-teal-700);
  background: linear-gradient(135deg, var(--tf-color-emerald-100), var(--tf-color-sky-100));
}

.editor-card-head h6 {
  margin: 0;
  font-size: 16px;
  color: var(--tf-color-slate-custom);
}

.editor-card-head p {
  margin: 3px 0 0;
  color: var(--tf-color-gray-ui-550);
  font-size: 12px;
}

/* 模态框底部 */
.modal-footer {
  padding: 14px 0 0;
  border-top: 1px solid var(--tf-color-border-muted);
  background: transparent;
}

/* Element Plus 统一表单控件 */
.menu-form-row {
  margin-bottom: 2px;
}

.menu-editor-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.menu-editor-form :deep(.el-form-item__label) {
  min-height: 22px;
  margin-bottom: 7px;
  color: var(--tf-color-slate-700);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

.menu-editor-form :deep(.el-input__wrapper),
.menu-editor-form :deep(.el-select__wrapper),
.menu-editor-form :deep(.el-textarea__inner) {
  border-radius: 12px;
  background: var(--tf-color-slate-50);
  box-shadow: 0 0 0 1px var(--tf-color-border-blue-light) inset;
  transition: box-shadow 0.2s ease, background 0.2s ease;
}

.menu-editor-form :deep(.el-input__wrapper:hover),
.menu-editor-form :deep(.el-select__wrapper:hover),
.menu-editor-form :deep(.el-textarea__inner:hover) {
  box-shadow: 0 0 0 1px var(--color-text-placeholder) inset;
}

.menu-editor-form :deep(.el-input__wrapper.is-focus),
.menu-editor-form :deep(.el-select__wrapper.is-focused),
.menu-editor-form :deep(.el-textarea__inner:focus) {
  background: var(--color-bg-white);
  box-shadow: 0 0 0 1px var(--tf-color-teal-700) inset, 0 0 0 3px rgba(15, 118, 110, 0.12);
}

.menu-editor-form :deep(.el-input__prefix) {
  color: var(--tf-color-gray-ui-550);
}

.menu-editor-form :deep(.el-input-number .el-input__wrapper) {
  width: 100%;
}

/* 模块选择器 */
.module-selector-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.module-select-input {
  width: 100%;
}

.module-select-dropdown {
  max-width: 400px;
}

.module-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 9px 0;
  width: 100%;
  min-width: 0;
}

.module-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.module-name {
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.45;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.module-key {
  font-size: 12px;
  color: var(--color-info);
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* 图标预览 */
.icon-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(135deg, var(--tf-color-surface-muted) 0%, var(--tf-color-surface-ant) 100%);
  border-radius: 8px;
  margin-top: 12px;
  border: 1px solid var(--tf-color-border-muted);
}

.preview-icon {
  font-size: 24px;
  color: var(--tf-color-indigo-brand);
}

.preview-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: var(--color-info);
  background: var(--color-bg-white);
  padding: 4px 8px;
  border-radius: 4px;
}

/* 辅助文本 */
.text-muted {
  font-size: 12px;
  color: var(--color-info);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}

.text-muted i {
  font-size: 13px;
}

/* ===== 响应式设计 ===== */
@media (max-width: 767px) {
  .menu-editor-body,
  .modal-footer {
    padding: 0;
  }

  .menu-editor-hero {
    align-items: flex-start;
    flex-direction: column;
    border-radius: 16px;
  }

  .menu-editor-grid {
    grid-template-columns: 1fr;
  }

  .editor-card {
    padding: 14px;
    border-radius: 16px;
  }

  .editor-card--side {
    position: static;
  }

  .modal-footer.mobile-dialog-footer {
    display: flex !important;
    flex-direction: row !important;
    justify-content: flex-end !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    gap: 12px !important;
  }

  .menu-management {
    padding: 12px;
  }

  .menu-page-header {
    margin-bottom: 16px;
  }

  .menu-header-actions {
    width: 100%;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .menu-header-actions > * {
    flex: 0 0 auto;
    min-width: 0;
  }

  .toolbar-section {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .menu-widths-setting {
    width: 100%;
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
    padding: 12px 10px;
  }

  .setting-header {
    min-width: 0;
    width: 100%;
  }

  .setting-title {
    font-size: 13px;
  }

  .width-controls {
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 8px;
    width: 100%;
  }

  .width-control {
    width: calc(50% - 4px);
    min-width: 0;
    gap: 4px;
  }

  .setting-header :deep(.el-button) {
    min-height: 32px;
    height: 32px;
    padding: 6px 10px;
    font-size: 11px;
  }

  /* 增强触摸交互 */
  .range-input {
    width: 100%;
  }

  .form-range {
    min-height: 34px;
    padding: 7px 8px;
    font-size: 12px;
  }

  .inline-width-label {
    min-width: 44px;
    font-size: 11px;
  }

  :deep(.menu-data-table .el-table__body td),
  :deep(.menu-data-table .el-table__header th) {
    font-size: 12px;
  }

  :deep(.menu-data-table .menu-name-column .cell),
  :deep(.menu-data-table .menu-remarks-column .cell),
  :deep(.menu-data-table .menu-path-column .cell) {
    text-align: left;
  }

  :deep(.menu-data-table .menu-name-column .cell) {
    min-width: 0;
  }

  :deep(.menu-data-table .menu-remarks-column .cell) {
    min-width: 0;
    white-space: normal;
  }

  :deep(.menu-data-table .menu-path-column .cell) {
    min-width: 0;
  }

  .menu-text {
    gap: 4px;
    min-width: 0;
  }

  .menu-title {
    display: block;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
    font-weight: 700;
  }

  .menu-remarks-text {
    display: -webkit-box;
    overflow: hidden;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    text-overflow: ellipsis;
    white-space: normal;
  }

  .url-text {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 11px;
  }

  .icon-display {
    justify-content: center;
    gap: 0;
  }

  .icon-text {
    display: none;
  }

  .menu-icon {
    font-size: 15px;
  }

  .child-row .child-prefix {
    margin-right: 2px;
  }

}

@media (max-width: 480px) {
  .menu-widths-setting {
    padding: 16px;
    margin: 16px 0;
  }

  .width-control {
    padding: 16px;
  }

  .stats-card {
    padding: 16px;
  }

  .stats-number {
    font-size: 24px;
  }

  .stats-label {
    font-size: 13px;
  }

  .menu-editor-body {
    padding: 0;
  }

  /* 表格在移动端的优化 */
  .menu-table {
    font-size: 14px;
  }

  /* 确保触摸滚动顺畅 */
  * {
    -webkit-tap-highlight-color: transparent;
  }

  .form-actions {
    flex-direction: column;
    width: 100%;
  }

  /* 响应式优化：改善触摸体验 */
  .tree-node-content {
    padding: 12px 8px;
    min-height: 48px;
    touch-action: manipulation;
  }

  .tree-node-content:hover {
    background-color: rgba(24, 144, 255, 0.1);
  }

  /* 改善移动端滚动体验 */
  .tree-container {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  /* 移动端按钮组优化 */
  .btn-group {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    width: auto;
  }

  .btn-group :deep(.el-button) {
    flex: 0 0 auto;
    min-height: 44px;
    width: auto;
    margin: 0;
  }

  /* 移动端表格优化 */
  .menu-table th,
  .menu-table td {
    padding: 8px;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-table .column-sort,
  .menu-table .column-status,
  .menu-table .column-actions,
  .menu-table .menu-sort-cell,
  .menu-table .menu-status-cell,
  .menu-table .menu-actions-cell {
    display: none;
  }


  /* 移动端操作按钮 */
  .action-buttons {
    display: flex;
    flex-direction: column;
    min-width: 120px;
  }

  .menu-header-actions {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
    justify-content: flex-end;
  }

  .menu-header-actions :deep(.el-button) {
    justify-content: center;
    width: auto;
  }
}

</style>

<!-- 全局样式：模块选择器下拉框（popper-class 需要全局样式） -->
<style>
.module-select-dropdown {
  min-width: min(360px, 100%) !important;
  max-width: min(520px, calc(100vw - 48px)) !important;
}

.module-select-dropdown .el-select-dropdown__list {
  padding: 8px 0 !important;
}

.module-select-dropdown .el-select-group__wrap:not(:last-of-type) {
  margin-bottom: 6px;
}

.module-select-dropdown .el-select-group__title {
  padding: 8px 16px 6px !important;
  color: var(--tf-color-violet-700) !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  line-height: 1.4 !important;
}

.module-select-dropdown .el-select-dropdown__item {
  min-width: 0 !important;
  padding: 12px 16px !important;
  line-height: normal !important;
  display: flex !important;
  align-items: center !important;
  overflow: hidden !important;
}

.module-select-dropdown .el-select-dropdown__item.hover {
  background-color: var(--tf-color-surface) !important;
}

.module-select-dropdown .el-select-dropdown__item.selected {
  background-color: var(--tf-color-primary-surface-element) !important;
  color: var(--color-primary) !important;
}
</style>
