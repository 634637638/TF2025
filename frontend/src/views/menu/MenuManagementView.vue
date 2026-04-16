<template>
  <div class="menu-management admin-page">
    <!-- ❌ 无权限时显示提示 -->
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      module-key="menu"
      module-name="菜单管理"
      permission-code="menus:view"
    />

    <!-- 主要内容 - 只有有权限时才显示 -->
    <div v-else class="content admin-page-content">
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
          <el-button type="primary" @click="showAddModal(0)" v-if="canCreate">
            <i class="fas fa-plus"></i>
            <span>新增</span>
          </el-button>
          <el-button type="info" plain @click="refreshData" :disabled="loading">
            <i :class="loading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
            <span>刷新</span>
          </el-button>
          <el-button type="warning" plain @click="initMenus" v-if="canCreate && menuTree.length === 0">
            <i class="fas fa-database"></i>
            <span>初始化数据</span>
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
      />

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewMenuField('stats_total_menus')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-sitemap"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getMenuCount() }}</div>
          <div class="stat-label">菜单总数</div>
        </div>
      </div>
      <div v-if="canViewMenuField('stats_active_menus')" class="stat-card">
        <div class="stat-icon active">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getActiveMenuCount() }}</div>
          <div class="stat-label">启用菜单</div>
        </div>
      </div>
      <div v-if="canViewMenuField('stats_inactive_menus')" class="stat-card">
        <div class="stat-icon inactive">
          <i class="fas fa-pause-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getInactiveMenuCount() }}</div>
          <div class="stat-label">禁用菜单</div>
        </div>
      </div>
      <div v-if="canViewMenuField('stats_root_menus')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-layer-group"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ getRootMenuCount() }}</div>
          <div class="stat-label">根菜单数</div>
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
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div class="form-group filter-item" data-field="menuType">
          <el-select
            v-model="searchForm.menu_type"
            placeholder="菜单类型"
            clearable
            @change="searchMenus"
          >
            <el-option label="菜单项" value="menu" />
            <el-option label="目录" value="directory" />
          </el-select>
      </div>

      <div class="form-group filter-item" data-field="status">
          <el-select
            v-model="searchForm.status"
            placeholder="状态"
            clearable
            @change="searchMenus"
          >
            <el-option label="启用" value="1" />
            <el-option label="禁用" value="0" />
          </el-select>
      </div>
    </UnifiedSearchPanel>

    <!-- 操作工具栏 -->
    <div class="toolbar-section admin-panel">
      <div class="toolbar-left">
        <div class="btn-group">
          <el-button type="primary" plain @click="expandAll">
            <i class="fas fa-expand-alt"></i>
            展开全部
          </el-button>
          <el-button type="primary" plain @click="collapseAll">
            <i class="fas fa-compress-alt"></i>
            折叠全部
          </el-button>
        </div>
      </div>
      <div class="toolbar-right">
        <!-- PC和手机端菜单宽度设置 -->
        <div class="menu-widths-setting">
          <div class="setting-header">
            <div class="setting-title">
              <i class="fas fa-sliders-h"></i>
              <span>菜单宽度设置</span>
            </div>
            <el-button type="success" size="small" @click="applyBothMenuWidths" :disabled="isWidthLoading">
              <i :class="isWidthLoading ? 'fas fa-spinner fa-spin' : 'fas fa-check'"></i>
              {{ isWidthLoading ? '保存中...' : '保存设置' }}
            </el-button>
          </div>
          <div class="width-controls">
            <!-- PC端宽度设置 -->
            <div class="width-control pc-width">
              <label class="inline-width-label">
                <i class="fas fa-desktop"></i>
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
                />
              </div>
            </div>

            <!-- 手机端宽度设置 -->
            <div class="width-control mobile-width">
              <label class="inline-width-label">
                <i class="fas fa-mobile-alt"></i>
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
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- 菜单数据加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-content">
        <i class="fas fa-spinner fa-spin loading-icon"></i>
        <p class="loading-text">正在加载菜单数据...</p>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="errorMessage" class="error-container">
      <div class="error-content">
        <i class="fas fa-exclamation-triangle error-icon"></i>
        <p class="error-text">{{ errorMessage }}</p>
        <el-button type="danger" plain size="small" @click="errorMessage = ''">
          <i class="fas fa-times"></i>
          关闭
        </el-button>
      </div>
    </div>

    <!-- 菜单列表 -->
    <div v-if="!loading && !errorMessage" class="menu-table-section admin-panel admin-table-panel">
      <div class="table-responsive">
        <table class="menu-table">
          <thead>
            <tr>
              <th class="column-name">菜单名称</th>
              <th class="column-url">路径</th>
              <th class="column-icon">图标</th>
              <th class="column-sort">排序</th>
              <th class="column-status">状态</th>
              <th class="column-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="menu in menuTree" :key="menu.id">
              <tr
                class="menu-row"
                :class="{ 'parent-row': menu.children && menu.children.length > 0 }"
                @click="handleMenuRowTap(menu)"
              >
                <td class="menu-name-cell">
                  <div class="menu-info">
                    <div class="menu-text">
                      <!-- 展开/折叠按钮 -->
                      <button
                        v-if="menu.children && menu.children.length > 0"
                        class="expand-btn"
                        @click.stop="toggleMenuExpansion(menu.id)"
                        :title="isMenuExpanded(menu.id) ? '折叠子菜单' : '展开子菜单'"
                      >
                        <i :class="isMenuExpanded(menu.id) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
                      </button>
                      <span v-else class="expand-placeholder"></span>

                      <span class="menu-title">{{ menu.title || menu.name }}</span>
                      <span class="menu-type" :class="`type-${menu.menu_type || 'menu'}`">
                        {{ getMenuTypeLabel(menu.menu_type) }}
                      </span>
                    </div>
                    <div class="menu-remarks" v-if="menu.remarks">{{ menu.remarks }}</div>
                  </div>
                </td>
                <td class="menu-url-cell">
                  <code class="url-text">{{ menu.path || menu.url }}</code>
                </td>
                <td class="menu-icon-cell">
                  <div class="icon-display">
                    <span
                      v-if="isIconifyIconClass(menu.icon)"
                      class="iconify menu-icon"
                      :data-icon="getIconifyName(menu.icon)"
                    ></span>
                    <i v-else :class="menu.icon || 'fas fa-circle'" class="menu-icon"></i>
                    <span class="icon-text">{{ menu.icon }}</span>
                  </div>
                </td>
                <td class="menu-sort-cell">
                  <span class="sort-badge">{{ menu.sort_order }}</span>
                </td>
                <td class="menu-status-cell">
                  <span class="status-badge" :class="menu.status ? 'status-active' : 'status-inactive'">
                    <i :class="menu.status ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
                    {{ menu.status ? '启用' : '禁用' }}
                  </span>
                </td>
                <td class="menu-actions-cell">
                  <div class="action-buttons">
                    <el-button
                      type="primary"
                      size="small"
                      @click.stop="showEditModal(menu)"
                      title="编辑"
                      v-if="canEdit"
                    >
                      <i class="fas fa-edit"></i>
                    </el-button>
                    <el-button
                      type="success"
                      size="small"
                      @click.stop="showAddModal(menu.id)"
                      title="添加子菜单"
                      v-if="canCreate"
                    >
                      <i class="fas fa-plus"></i>
                    </el-button>
                    <el-button
                      type="danger"
                      size="small"
                      @click.stop="handleDelete(menu)"
                      title="删除"
                      v-if="canDelete"
                    >
                      <i class="fas fa-trash"></i>
                    </el-button>
                  </div>
                </td>
              </tr>
              <tr v-if="isMobile && activeMobileMenuId === menu.id" class="mobile-action-row">
                <td colspan="6">
                  <div class="mobile-row-actions">
                    <el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      class="mobile-action-btn mobile-action-btn-edit"
                      @click.stop="showEditModal(menu)"
                    >
                      <i class="fas fa-edit"></i>
                      <span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canCreate"
                      type="success"
                      size="small"
                      class="mobile-action-btn mobile-action-btn-status"
                      @click.stop="showAddModal(menu.id)"
                    >
                      <i class="fas fa-plus"></i>
                      <span>子菜单</span>
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      size="small"
                      class="mobile-action-btn mobile-action-btn-delete"
                      @click.stop="handleDelete(menu)"
                    >
                      <i class="fas fa-trash"></i>
                      <span>删除</span>
                    </el-button>
                  </div>
                </td>
              </tr>
              <!-- 递归显示子菜单 -->
              <template v-for="child in displayChildren(menu.children, menu.id)" :key="child.id">
                <tr class="menu-row child-row" @click="handleMenuRowTap(child)">
                  <td class="menu-name-cell">
                    <div class="menu-info">
                      <div class="menu-text">
                        <span class="child-prefix">├─</span>
                        <span class="menu-title">{{ child.title || child.name }}</span>
                        <span class="menu-type" :class="`type-${child.menu_type || 'menu'}`">
                          {{ getMenuTypeLabel(child.menu_type) }}
                        </span>
                      </div>
                      <div class="menu-remarks" v-if="child.remarks">{{ child.remarks }}</div>
                    </div>
                  </td>
                  <td class="menu-url-cell">
                    <code class="url-text">{{ child.path || child.url }}</code>
                  </td>
                  <td class="menu-icon-cell">
                    <div class="icon-display">
                      <span
                        v-if="isIconifyIconClass(child.icon)"
                        class="iconify menu-icon"
                        :data-icon="getIconifyName(child.icon)"
                      ></span>
                      <i v-else :class="child.icon || 'fas fa-circle'" class="menu-icon"></i>
                      <span class="icon-text">{{ child.icon }}</span>
                    </div>
                  </td>
                  <td class="menu-sort-cell">
                    <span class="sort-badge">{{ child.sort_order }}</span>
                  </td>
                  <td class="menu-status-cell">
                    <span class="status-badge" :class="child.status ? 'status-active' : 'status-inactive'">
                      <i :class="child.status ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
                      {{ child.status ? '启用' : '禁用' }}
                    </span>
                  </td>
                  <td class="menu-actions-cell">
                    <div class="action-buttons">
                      <el-button
                        type="primary"
                        size="small"
                        @click.stop="showEditModal(child)"
                        title="编辑"
                        v-if="canEdit"
                      >
                        <i class="fas fa-edit"></i>
                      </el-button>
                      <el-button
                        type="success"
                        size="small"
                        @click.stop="showAddModal(child.id)"
                        title="添加子菜单"
                        v-if="canCreate"
                      >
                        <i class="fas fa-plus"></i>
                      </el-button>
                      <el-button
                        type="danger"
                        size="small"
                        @click.stop="handleDelete(child)"
                        title="删除"
                        v-if="canDelete"
                      >
                        <i class="fas fa-trash"></i>
                      </el-button>
                    </div>
                  </td>
                </tr>
                <tr v-if="isMobile && activeMobileMenuId === child.id" class="mobile-action-row">
                  <td colspan="6">
                    <div class="mobile-row-actions">
                      <el-button
                        v-if="canEdit"
                        type="primary"
                        size="small"
                        class="mobile-action-btn mobile-action-btn-edit"
                        @click.stop="showEditModal(child)"
                      >
                        <i class="fas fa-edit"></i>
                        <span>编辑</span>
                      </el-button>
                      <el-button
                        v-if="canCreate"
                        type="success"
                        size="small"
                        class="mobile-action-btn mobile-action-btn-status"
                        @click.stop="showAddModal(child.id)"
                      >
                        <i class="fas fa-plus"></i>
                        <span>子菜单</span>
                      </el-button>
                      <el-button
                        v-if="canDelete"
                        type="danger"
                        size="small"
                        class="mobile-action-btn mobile-action-btn-delete"
                        @click.stop="handleDelete(child)"
                      >
                        <i class="fas fa-trash"></i>
                        <span>删除</span>
                      </el-button>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <!-- 空状态 -->
      <div v-if="menuTree.length === 0 && !loading" class="empty-state">
        <div class="empty-content">
          <template v-if="errorMessage">
            <i class="fas fa-shield-alt empty-icon" style="color: #dc3545;"></i>
            <h3 class="empty-title">权限不足</h3>
            <p class="empty-description">{{ errorMessage }}</p>
          </template>
          <template v-else>
            <i class="fas fa-sitemap empty-icon"></i>
            <h3 class="empty-title">暂无菜单数据</h3>
            <p class="empty-description">系统中还没有菜单配置，点击上方按钮开始添加</p>
            <el-button v-if="canCreate" type="primary" @click="initMenus">
              <i class="fas fa-database"></i>
              初始化菜单数据
            </el-button>
          </template>
        </div>
      </div>
    </div>

    <!-- 菜单编辑模态框 -->
    <MobileDialog
      v-model="showModal"
      :title="isEdit ? '编辑菜单' : '新增菜单'"
      width="800px"
      :close-on-click-modal="false"
      :dialog-class="['menu-management-dialog', 'crud-dialog-lg']"
      :show-default-footer="false"
    >
      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-section">
            <h6 class="section-title">基本信息</h6>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">菜单名称 <span class="required">*</span></label>
                <div class="input-group">
                  <i class="fas fa-tag input-icon"></i>
                  <input
                    v-model="formData.name"
                    type="text"
                    class="form-control"
                    placeholder="请输入菜单名称"
                    required
                  >
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">菜单路径 <span class="required">*</span></label>
                <div class="input-group">
                  <i class="fas fa-link input-icon"></i>
                  <input
                    v-model="formData.url"
                    type="text"
                    class="form-control"
                    placeholder="请输入菜单路径"
                    required
                  >
                </div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h6 class="section-title">显示设置</h6>
            <div class="form-group full-width">
              <label class="form-label">图标</label>
              <IconPicker v-model="formData.icon" :default-collapsed="true" @select="handleIconSelect" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">排序</label>
                <div class="input-group">
                  <i class="fas fa-sort input-icon"></i>
                  <input
                    v-model.number="formData.sort_order"
                    type="number"
                    class="form-control"
                    placeholder="排序值"
                    min="0"
                  >
                </div>
              </div>
              <div class="form-group">
              </div>
            </div>
          </div>

          <div class="form-section">
            <h6 class="section-title">配置选项</h6>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">父级菜单</label>
                <div class="input-group">
                  <i class="fas fa-sitemap input-icon"></i>
                  <select v-model="formData.parent_id" class="form-control">
                    <option value="0">根菜单</option>
                    <option v-for="menu in parentMenuOptions" :key="menu.id" :value="menu.id">
                      {{ menu.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">打开方式</label>
                <div class="input-group">
                  <i class="fas fa-external-link-alt input-icon"></i>
                  <select v-model="formData.target" class="form-control">
                    <option value="_self">当前窗口</option>
                    <option value="_blank">新窗口</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <h6 class="section-title">其他设置</h6>
            <div class="form-group">
              <label class="form-label">备注</label>
              <div class="input-group">
                <i class="fas fa-comment input-icon"></i>
                <textarea
                  v-model="formData.remarks"
                  class="form-control"
                  placeholder="请输入备注信息"
                  rows="3"
                ></textarea>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">
                <i class="fas fa-cube"></i>
                关联模块
              </label>
              <div class="module-selector-section">
                <el-select
                  v-model="formData.module_id"
                  placeholder="请选择关联模块（可选）"
                  filterable
                  clearable
                  class="module-select-input"
                  popper-class="module-select-dropdown"
                  :teleported="true"
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
                        <i :class="module.icon || 'fas fa-cube'" class="module-icon"></i>
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
                        <span class="module-id">ID: {{ module.id }}</span>
                      </div>
                    </el-option>
                  </el-option-group>
                </el-select>
                <small class="text-muted">
                  <i class="fas fa-info-circle"></i>
                  <span v-if="formData.module_id">
                    已选择模块，系统会自动关联 module_key
                  </span>
                  <span v-else>
                    未选择模块，系统会根据 URL 路径自动识别关联模块
                  </span>
                </small>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">
                <i class="fas fa-key"></i>
                模块 Key (Module Key)
              </label>
              <input
                v-model="formData.module_key"
                type="text"
                class="form-control"
                placeholder="自动填充或手动输入，例如: supplier-payments"
              />
              <small class="text-muted">
                <i class="fas fa-lightbulb"></i>
                模块的唯一标识，用于权限控制。可选择模块自动填充，或手动输入
              </small>
            </div>
            <div class="form-group">
              <div class="form-check">
                <input
                  id="is_active"
                  v-model="formData.is_active"
                  type="checkbox"
                  class="form-check-input"
                >
                <label for="is_active" class="form-check-label">
                  启用菜单
                </label>
              </div>
            </div>
          </div>
        </form>
      </div>

      <template #footer>
        <div class="modal-footer mobile-dialog-footer">
          <el-button type="info" @click="closeModal">
            <i class="fas fa-times"></i>
            取消
          </el-button>
          <el-button type="primary" @click="handleSubmit" :disabled="submitting">
            <i :class="submitting ? 'fas fa-spinner fa-spin' : 'fas fa-save'"></i>
            {{ submitting ? '保存中...' : '保存' }}
          </el-button>
        </div>
      </template>
    </MobileDialog>
    </div>  <!-- END: .content -->
  </div>    <!-- END: .menu-management -->
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { useRouter } from 'vue-router'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { useLoadingState } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { useMenuStore } from '@/stores/menu'
import { useMenuWidth } from '@/composables/useMenuWidth'
import { useMobile } from '@/composables/mobile'
import IconPicker from '@/components/IconPicker.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { useEventBus } from '@/composables/core/useEventBus'
import { PageHeader, PermissionDenied } from '@/components/base'
import { extractIconifyName, isIconifyIcon } from '@/utils/iconify'

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

// 权限和通知
const router = useRouter()
const authStore = useAuthStore()
const { success, error, warning, info, handleApiError, confirm } = useNotification()
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

const isIconifyIconClass = (icon?: string | null) => isIconifyIcon(String(icon || '').trim())
const getIconifyName = (icon?: string | null) => extractIconifyName(String(icon || '').trim()) || ''

// PC和手机端菜单宽度状态
const pcMenuWidth = ref(200)
const mobileMenuWidth = ref(280)
const isWidthLoading = ref(false)

// 使用菜单宽度组合式函数
const {
  menuWidth: globalMenuWidth,
  setMenuWidth,
  loadAllMenuWidths,
  setBothMenuWidths,
  isLoading: menuWidthLoading
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
const loadMenus = async (bustCache: boolean = false, silentError: boolean = false, showLoadingState: boolean = true) => {
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
      // 如果返回的是树形结构，直接使用
      // 如果返回的是分页数据，取 records
      menuTree.value = response.data || (response.data as any)?.records || []
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
        const publicResponse = await unifiedApi.get('/permissions/user-menu')

        if (publicResponse && publicResponse.success) {
          menuTree.value = publicResponse.data || []
        } else {
          throw new Error(publicResponse?.message || '获取菜单列表失败')
        }
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
      menuTree.value = response.data || []
    } else {
      throw new Error(response?.message || '搜索菜单失败')
    }
  } catch (err) {
    logger.warn('搜索接口失败，使用公开接口:', err.message)

    // 如果搜索接口失败，回退到公开接口并应用前端过滤
    try {
      const publicResponse = await unifiedApi.get('/permissions/user-menu')

      if (publicResponse && publicResponse.success) {
        let allMenus = publicResponse.data || []

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
        throw new Error(publicResponse?.message || '搜索菜单失败')
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
    await loadMenus(true, false, false)  // 不显示加载状态
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
  if (newModuleKey && !formData.value.module_id) {
    const module = modules.value.find(m => m.key === newModuleKey)
    if (module) {
      formData.value.module_id = module.id
    }
  }
  // 注意：如果 module_id 已经有值，不覆盖，因为那是用户主动选择的
})

const handleIconSelect = (iconName) => {
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
const displayChildren = (children, parentId) => {
  if (!children || children.length === 0 || !isMenuExpanded(parentId)) {
    return []
  }
  return children
}

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

    success(`菜单宽度设置成功`, {
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
    parent_id: menu.parent_id || 0,
    sort_order: menu.sort_order || 0,
    target: menu.target || '_self',
    is_active: menu.status !== undefined ? menu.status : true,
    remarks: menu.remarks || '',
    module_id: menu.module_id || 0,
    module_key: menu.module_key || ''
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
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
  if (formData.value.icon && formData.value.icon.trim().length > 100) {
    errors.push('图标名称不能超过100个字符')
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
      await new Promise(resolve => setTimeout(resolve, 100))
      await loadMenus()
      closeModal()
      success('保存成功', {
        title: isEdit.value ? `菜单"${formData.value.name}"更新成功` : `菜单"${formData.value.name}"创建成功`,
        duration: 3000
      })

      // 刷新侧边栏菜单
      const menuStore = useMenuStore()
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
        customClass: 'message-box-purple',
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
        const menuStore = useMenuStore()
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

const initMenus = async () => {
  if (!canCreate.value) {
    error('权限不足：您没有初始化菜单的权限')
    return
  }

  try {
    const response = await unifiedApi.post('/init-menus')

    if (response && response.success) {
      await loadMenus()
      success('初始化成功', {
        title: '菜单数据初始化成功',
        duration: 3000
      })

      // 刷新侧边栏菜单
      const menuStore = useMenuStore()
      await menuStore.refreshMenus()

      // 发送菜单更新事件，通知侧边栏刷新
      emit('menu:updated')
    } else {
      throw new Error(response?.message || '初始化失败')
    }
  } catch (err) {
    logger.error('初始化菜单数据失败:', err)
    errorMessage.value = err.message || '初始化菜单数据失败'
    error('初始化失败', err.message || '初始化菜单数据时发生错误')
  }
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
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 12px 16px;
}

.module-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.module-field:last-child {
  border-bottom: none;
}

.field-label {
  font-weight: 600;
  color: #495057;
  margin-right: 12px;
}

.field-value {
  color: #212529;
  font-family: 'Courier New', monospace;
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ced4da;
}

.text-muted {
  display: block;
  margin-top: 8px;
  color: #6c757d !important;
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
  align-items: center;
  padding: 8px 0;
  gap: 12px;
  width: 100%;
  overflow: hidden;
}

.module-option.is-child {
  padding-left: 18px;
}

.module-option.is-standalone {
  padding-left: 6px;
}

.module-icon {
  font-size: 18px;
  color: #409EFF;
  width: 24px;
  text-align: center;
  flex-shrink: 0;
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
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.module-name {
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  background: #ede9fe;
  color: #6d28d9;
  border-color: #d8b4fe;
}

.module-relation-badge.is-child {
  background: #ecfeff;
  color: #0f766e;
  border-color: #a5f3fc;
}

.module-relation-badge.is-standalone {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.module-key {
  font-size: 12px;
  color: #909399;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.module-id {
  font-size: 12px;
  color: #C0C4CC;
  padding: 2px 6px;
  background: #F5F7FA;
  border-radius: 4px;
  flex-shrink: 0;
}

/* 确保 el-select 下拉框不会被遮挡 */
.module-selector-section {
  :deep(.el-select-dropdown) {
    max-width: 700px !important;
  }

  :deep(.el-select-dropdown__item) {
    padding: 8px 12px;
    height: auto;
  }

  :deep(.el-select__popper) {
    max-width: 700px !important;
  }
}

/* ===== 页面布局样式 ===== */
.menu-management {
  padding: 20px;
  min-height: 100vh;
  background: #f8f9fa;
}

.menu-header-actions {
  display: flex;
  gap: 12px;
}

/* ===== 统计卡片样式 ===== */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  border: 1px solid #e9ecef;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  color: #1976d2;
}

.stat-icon.active {
  background: linear-gradient(135deg, #e8f5e8, #c8e6c8);
  color: #388e3c;
}

.stat-icon.inactive {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  color: #f57c00;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
  font-weight: 500;
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
  color: #495057;
  margin-bottom: 8px;
}

.required {
  color: #dc3545;
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: #6c757d;
  font-size: 14px;
  z-index: 2;
}

.form-control {
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: white;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
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
  border: 1px solid #e9ecef;
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
  border: 1px solid #e8eef7;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
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
  color: #1f2937;
}

.setting-title i {
  color: #2563eb;
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
  color: #334155;
  white-space: nowrap;
}

.inline-width-label i {
  color: #2563eb;
}

.range-input {
  display: block;
}

.form-range {
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid #dbe3f0;
  border-radius: 10px;
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
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
  border-color: #597ef7;
  box-shadow: 0 0 0 3px rgba(89, 126, 247, 0.12);
}

/* ===== 按钮样式 ===== */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.btn-outline-secondary {
  background: transparent;
  color: #6c757d;
  border: 2px solid #6c757d;
}

.btn-outline-secondary:hover:not(:disabled) {
  background: #6c757d;
  color: white;
}

.btn-outline-primary {
  background: transparent;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-outline-primary:hover:not(:disabled) {
  background: #667eea;
  color: white;
}

.btn-outline-success {
  background: transparent;
  color: #28a745;
  border: 2px solid #28a745;
}

.btn-outline-success:hover:not(:disabled) {
  background: #28a745;
  color: white;
}

.btn-outline-danger {
  background: transparent;
  color: #dc3545;
  border: 2px solid #dc3545;
}

.btn-outline-danger:hover:not(:disabled) {
  background: #dc3545;
  color: white;
}

.btn-outline-warning {
  background: transparent;
  color: #ffc107;
  border: 2px solid #ffc107;
}

.btn-outline-warning:hover:not(:disabled) {
  background: #ffc107;
  color: #212529;
}

.btn-success {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.btn-success:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(40, 167, 69, 0.3);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
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
  border: 1px solid #e9ecef;
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
  color: #667eea;
}

.loading-text,
.error-text {
  font-size: 16px;
  color: #6c757d;
  margin: 0;
}

.error-icon {
  font-size: 32px;
  color: #dc3545;
}

/* ===== 表格样式 ===== */
.menu-table-section {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e9ecef;
}

.table-responsive {
  overflow-x: auto;
}

.menu-table {
  width: 100%;
  border-collapse: separate; /* 修复点击区域问题 */
  border-spacing: 0;
  margin: 0;
}

.menu-table thead {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
}

.menu-table th {
  padding: 12px 16px; /* 使用与全局样式一致的padding */
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
  min-height: 48px; /* 确保一致的点击区域 */
  height: auto;
  position: relative;
  box-sizing: border-box;
  line-height: 1.4;
  vertical-align: middle;
}

.menu-table td {
  padding: 12px 16px; /* 使用与全局样式一致的padding */
  border-bottom: 1px solid #e9ecef;
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
  background: #f8f9ff;
}

.child-row {
  background: #fafbff;
}

.menu-name-cell {
  min-width: 220px;
}

.menu-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  color: #6b7280;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  padding: 0;
}

.expand-btn:hover {
  background-color: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
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
  color: #2c3e50;
  font-size: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
  background: #e3f2fd;
  color: #1976d2;
}

.type-directory {
  background: #fff3e0;
  color: #f57c00;
}

.type-button {
  background: #f3e5f5;
  color: #7b1fa2;
}

.menu-remarks {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
}

.child-prefix {
  color: #6c757d;
  font-weight: 500;
}

.menu-url-cell {
  min-width: 150px;
}

.url-text {
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #495057;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.menu-icon-cell {
  min-width: 120px;
}

.icon-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-icon {
  font-size: 16px;
  color: #667eea;
  width: 24px;
  text-align: center;
}

.icon-text {
  font-size: 12px;
  color: #6c757d;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.menu-sort-cell {
  min-width: 80px;
}

.sort-badge {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.menu-status-cell {
  min-width: 100px;
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
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
}

.menu-actions-cell {
  min-width: 120px;
}

.action-buttons {
  display: flex;
  gap: 6px;
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
  color: #cbd5e0;
}

.empty-title {
  font-size: 20px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.empty-description {
  font-size: 16px;
  color: #6c757d;
  margin: 0;
  max-width: 400px;
}

/* ==================== 编辑弹窗内容样式 ==================== */
.modal-body {
  padding: 4px 0 0;
  background: transparent;
  color: #303133;
}

/* 模态框底部 */
.modal-footer {
  padding: 12px 0 0;
  border-top: 1px solid #e9ecef;
  background: transparent;
}

/* ==================== 表单区域样式优化 ==================== */

/* 表单区块 */
.form-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f2f5;
}

.form-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.form-section .section-title {
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-section .section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, #667eea 0%, transparent 100%);
  opacity: 0.3;
}

/* 表单行 */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-row .form-group {
  margin-bottom: 0;
}

/* 表单组 */
.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

/* 表单标签 */
.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.form-label i {
  color: #909399;
  margin-right: 4px;
}

/* 必填标记 */
.required {
  color: #f56c6c;
  margin-left: 2px;
}

/* 输入框组 */
.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: #909399;
  font-size: 14px;
  z-index: 1;
}

.input-group .form-control,
.input-group .form-control {
  padding-left: 38px;
}

/* 表单控件 */
.form-control,
.form-control {
  width: 100%;
  padding: 10px 12px;
  padding-left: 38px;
  font-size: 14px;
  line-height: 1.5;
  color: #606266;
  background: #ffffff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  transition: all 0.25s ease;
}

.form-control:focus,
.form-control:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-control::placeholder {
  color: #c0c4cc;
}

/* 下拉选择框 */
select.form-control {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23909399' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 30px;
}

/* 文本域 */
textarea.form-control {
  resize: vertical;
  min-height: 80px;
  padding-left: 12px;
  padding-top: 10px;
}

/* 复选框 */
.form-check {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-check-input {
  width: 18px;
  height: 18px;
  border: 2px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.form-check-input:checked {
  background: #667eea;
  border-color: #667eea;
}

.form-check-label {
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  user-select: none;
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
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.module-icon {
  font-size: 18px;
  color: #667eea;
  width: 24px;
  text-align: center;
}

.module-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.module-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.module-key {
  font-size: 12px;
  color: #909399;
}

.module-id {
  font-size: 12px;
  color: #c0c4cc;
}

/* 图标预览 */
.icon-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(135deg, #f8f9fa 0%, #f0f2f5 100%);
  border-radius: 8px;
  margin-top: 12px;
  border: 1px solid #e9ecef;
}

.preview-icon {
  font-size: 24px;
  color: #667eea;
}

.preview-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: #909399;
  background: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
}

/* 辅助文本 */
.text-muted {
  font-size: 12px;
  color: #909399;
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
  .modal-body,
  .modal-footer {
    padding: 0;
  }

  .modal-footer.mobile-dialog-footer {
    display: flex !important;
    flex-direction: row !important;
    justify-content: flex-end !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    gap: 12px !important;
  }

  .modal-footer.mobile-dialog-footer :deep(.el-button) {
    width: auto !important;
    flex: 0 0 auto !important;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .menu-management {
    padding: 12px;
  }

  .menu-page-header {
    margin-bottom: 16px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .stat-card {
    padding: 14px 12px;
  }

  .menu-header-actions {
    width: 100%;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-start;
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

  .form-row {
    grid-template-columns: 1fr;
  }

  .table-responsive {
    overflow-x: hidden;
  }

  .menu-table {
    min-width: 100%;
    width: 100%;
    table-layout: fixed;
  }

  .menu-table .column-name {
    width: 42%;
  }

  .menu-table .column-url {
    width: 40%;
  }

  .menu-table .column-icon {
    width: 18%;
  }

  .menu-table .column-sort,
  .menu-table .column-status,
  .menu-table .column-actions,
  .menu-table .menu-sort-cell,
  .menu-table .menu-status-cell,
  .menu-table .menu-actions-cell {
    display: none;
  }

  .menu-table th,
  .menu-table td {
    padding: 9px 6px;
    font-size: 12px;
    vertical-align: middle;
  }

  .menu-name-cell .menu-text {
    gap: 4px;
    min-width: 0;
  }

  .menu-name-cell .menu-title {
    display: block;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
    font-weight: 700;
  }

  .menu-name-cell .menu-type,
  .menu-name-cell .menu-remarks {
    display: none;
  }

  .menu-url-cell .url-text {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 11px;
  }

  .menu-icon-cell .icon-display {
    justify-content: center;
    gap: 0;
  }

  .menu-icon-cell .icon-text {
    display: none;
  }

  .menu-icon-cell .menu-icon {
    font-size: 15px;
  }

  .child-row .child-prefix {
    margin-right: 2px;
  }

}

@media (max-width: 480px) {
  .stats-cards {
    gap: 12px;
  }

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

  .modal-body {
    padding: 0;
  }

  /* 表格在移动端的优化 */
  .menu-table {
    font-size: 14px;
  }

  .table-responsive {
    -webkit-overflow-scrolling: touch;
  }

  /* 确保触摸滚动顺畅 */
  * {
    -webkit-tap-highlight-color: transparent;
  }

  /* 按钮触摸反馈 */
  .btn:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }

  .stat-value {
    font-size: 24px;
  }

  .form-actions {
    flex-direction: column;
    width: 100%;
  }

  .btn {
    width: 100%;
    justify-content: center;
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

  /* 移动端统计卡片优化 */
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  /* 移动端搜索框优化 */
  .search-box {
    width: 100%;
    margin-bottom: 16px;
  }

  .search-box input {
    min-height: 44px;
    font-size: 16px; /* 防止iOS放大 */
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
  .table-responsive {
    margin: 0 -16px;
    padding: 0 16px;
  }

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
    gap: 4px;
    min-width: 120px;
  }

  .action-buttons .btn-sm {
    width: 100%;
    justify-content: center;
    min-height: 32px;
  }

  .menu-header-actions {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
    justify-content: flex-start;
  }

  .menu-header-actions :deep(.el-button) {
    justify-content: center;
    width: auto;
  }
}

/* 权限控制样式 */
.permission-denied-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 20px;
}

.permission-denied-content {
  text-align: center;
  max-width: 500px;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.permission-icon {
  font-size: 48px;
  color: #f56c6c;
  margin-bottom: 16px;
}

.permission-denied-content h3 {
  font-size: 24px;
  color: #303133;
  margin-bottom: 16px;
}

.permission-denied-content p {
  color: #606266;
  margin-bottom: 12px;
  line-height: 1.5;
}

.permission-hint {
  font-size: 14px;
  color: #909399;
  margin-bottom: 24px !important;
}

.permission-hint code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: #e74c3c;
}
</style>

<!-- 全局样式：模块选择器下拉框（popper-class 需要全局样式） -->
<style>
.module-select-dropdown {
  min-width: 700px !important;
  max-width: 800px !important;
  z-index: 9999 !important;
}

.module-select-dropdown .el-select-dropdown__wrap {
  max-height: 400px !important;
}

.module-select-dropdown .el-select-dropdown__list {
  padding: 8px 0 !important;
}

.module-select-dropdown .el-select-group__wrap:not(:last-of-type) {
  margin-bottom: 6px;
}

.module-select-dropdown .el-select-group__title {
  padding: 8px 16px 6px !important;
  color: #6d28d9 !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  line-height: 1.4 !important;
}

.module-select-dropdown .el-select-dropdown__item {
  min-width: 700px !important;
  height: auto !important;
  padding: 12px 16px !important;
  line-height: normal !important;
  display: flex !important;
  align-items: center !important;
}

.module-select-dropdown .el-select-dropdown__item.hover {
  background-color: #f5f7fa !important;
}

.module-select-dropdown .el-select-dropdown__item.selected {
  background-color: #ecf5ff !important;
  color: #409EFF !important;
}
</style>
