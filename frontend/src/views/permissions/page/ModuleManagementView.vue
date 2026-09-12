<template>
  <div class="module-management">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="module-management"
      module-name="模块管理"
      permission-code="module-management:view"
    >
      <!-- 主要内容 - 只有有权限时才显示 -->
      <div class="admin-page-content">
        <!-- 主要内容区域 -->
        <div class="main-content admin-page-content">
          <UnifiedSearchPanel
            :expanded="searchExpanded"
            :loading="isLoading"
            @update:expanded="searchExpanded = $event"
            @search="handleSearch"
            @reset="clearFilters"
          >
            <template #primary>
              <div class="input-group">
                <i class="fas fa-search input-icon" />
                <input
                  v-model="searchText"
                  type="text"
                  placeholder="搜索模块名称或标识..."
                  class="form-control"
                  @input="handleSearch"
                >
                <button
                  v-if="searchText"
                  class="btn-clear"
                  @click="clearSearch"
                >
                  <i class="fas fa-times" />
                </button>
              </div>
            </template>
            <div class="form-group filter-item">
              <select
                v-model="filterCategory"
                class="form-control"
                @change="handleCategoryFilter"
              >
                <option value="">
                  全部分类
                </option>
                <option value="system">
                  系统模块
                </option>
                <option value="business">
                  业务模块
                </option>
                <option value="custom">
                  自定义模块
                </option>
              </select>
            </div>
            <div class="form-group filter-item">
              <select
                v-model="nameStatus"
                class="form-control"
                @change="handleNameStatusFilter"
              >
                <option value="">
                  全部名称状态
                </option>
                <option value="custom">
                  🔒 自定义名称
                </option>
                <option value="auto">
                  🤖 自动生成
                </option>
              </select>
            </div>
            <div class="form-group filter-item">
              <select
                v-model="activeStatus"
                class="form-control"
                @change="handleActiveStatusFilter"
              >
                <option value="">
                  全部启用状态
                </option>
                <option value="active">
                  已启用
                </option>
                <option value="inactive">
                  已禁用
                </option>
              </select>
            </div>
          </UnifiedSearchPanel>

          <!-- 已注册模块列表 -->
          <div class="modules-section admin-panel admin-table-panel">
            <div class="section-title">
              <div class="section-title-left">
                <i class="fas fa-list" />
                已注册模块
                <span class="record-count">共 {{ filteredModules.length }} 个模块</span>
              </div>
              <div class="section-title-actions">
                <el-button
                  v-if="canCreate"
                  type="primary"
                  size="small"
                  @click="showAddModuleDialog = true"
                >
                  <i class="fas fa-plus" />
                  手动添加模块
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  size="small"
                  title="您没有创建模块的权限"
                  disabled
                >
                  <i class="fas fa-plus" />
                  手动添加模块
                </el-button>
                <div class="view-toggles">
                  <button
                    :class="['btn', 'btn-sm', 'btn-outline', { active: viewMode === 'list' }]"
                    @click="viewMode = 'list'"
                  >
                    <i class="fas fa-list" />
                    列表
                  </button>
                  <button
                    :class="['btn', 'btn-sm', 'btn-outline', { active: viewMode === 'grid' }]"
                    @click="viewMode = 'grid'"
                  >
                    <i class="fas fa-th" />
                    网格
                  </button>
                </div>
              </div>
            </div>

            <!-- 加载状态 -->
            <div
              v-if="isLoading"
              class="loading-container"
            >
              <InlineLoading text="加载模块数据中..." />
            </div>

            <!-- 空状态 -->
            <DataEmptyState
              v-else-if="filteredModules.length === 0"
              :state="searchText || filterCategory || nameStatus || activeStatus ? 'filtered' : 'empty'"
              title="暂无模块数据"
              :description="searchText || filterCategory || nameStatus || activeStatus
                ? '没有符合筛选条件的模块'
                : '系统中还没有注册任何权限模块，请先进行模块扫描和注册'"
            >
              <el-button
                v-if="searchText || filterCategory || nameStatus || activeStatus"
                type="primary"
                plain
                size="small"
                @click="clearFilters"
              >
                清除筛选条件
              </el-button>
            </DataEmptyState>

            <!-- 模块列表 - 列表视图 -->
            <div
              v-else-if="viewMode === 'list'"
              class="table-responsive"
            >
              <el-table
                :data="paginatedModules"
                border
                stripe
                class="data-table devices-table compact-fit-table permissions-module-table"
                table-layout="fixed"
                :fit="true"
                row-key="id"
              >
                <el-table-column
                  label="状态"
                  width="76"
                  align="center"
                >
                  <template #default="{ row }">
                    <span
                      class="status-badge"
                      :class="row.is_active ? 'active' : 'inactive'"
                    >{{ row.is_active ? '启用' : '禁用' }}</span>
                  </template>
                </el-table-column>
                <el-table-column
                  label="模块标识"
                  :min-width="getModuleColumnWidth('key')"
                  align="center"
                  class-name="complete-text-column"
                >
                  <template #default="{ row }">
                    <code class="module-key">{{ row.key }}</code>
                  </template>
                </el-table-column>
                <el-table-column
                  label="模块名称"
                  :min-width="getModuleColumnWidth('name')"
                  align="center"
                  class-name="complete-text-column wrapped-text-column"
                >
                  <template #default="{ row }">
                    <div class="module-name-cell">
                      <div class="module-name">
                        {{ row.name }}<span
                          v-if="row.is_custom_name === 1"
                          class="custom-badge"
                        >自定义</span>
                      </div><div class="module-description">
                        {{ row.description }}
                      </div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  label="分类"
                  :min-width="getModuleColumnWidth('category')"
                  align="center"
                >
                  <template #default="{ row }">
                    <span
                      class="category-badge"
                      :class="row.category"
                    >{{ getCategoryName(row.category) }}</span>
                  </template>
                </el-table-column>
                <el-table-column
                  label="权限数量"
                  :min-width="getModuleColumnWidth('permission_count')"
                  align="center"
                >
                  <template #default="{ row }">
                    <span class="permission-count">{{ row.permission_count || 0 }}</span>
                  </template>
                </el-table-column>
                <el-table-column
                  label="名称状态"
                  :min-width="getModuleColumnWidth('name_status')"
                  align="center"
                >
                  <template #default="{ row }">
                    <span
                      class="name-status-badge"
                      :class="row.is_custom_name ? 'custom' : 'auto'"
                    >{{ row.name_status }}</span>
                  </template>
                </el-table-column>
                <el-table-column
                  label="创建时间"
                  :min-width="getModuleColumnWidth('created_at')"
                  align="center"
                  class-name="complete-text-column"
                >
                  <template #default="{ row }">
                    {{ formatDate(row.created_at) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showModuleActionField"
                  label="操作"
                  :width="moduleActionColumnWidth"
                  align="center"
                  class-name="actions-column"
                >
                  <template #default="{ row }">
                    <div class="action-buttons">
                      <el-button
                        v-if="canEdit"
                        :type="isProtectedModule(row) ? 'info' : (row.is_active ? 'warning' : 'success')"
                        size="small"
                        :disabled="isProtectedModule(row) && Number(row.is_active) === 1"
                        :title="isProtectedModule(row) ? '权限管理核心模块不能禁用' : (row.is_active ? '禁用模块' : '启用模块')"
                        @click.stop="toggleModuleStatus(row)"
                      >
                        <i :class="isProtectedModule(row) ? 'fas fa-shield-alt' : (row.is_active ? 'fas fa-toggle-off' : 'fas fa-toggle-on')" /><span>{{ isProtectedModule(row) && Number(row.is_active) === 1 ? '核心模块' : (row.is_active ? '禁用' : '启用') }}</span>
                      </el-button><el-button
                        v-if="canEdit"
                        type="primary"
                        size="small"
                        :title="row.is_custom_name === 1 ? '编辑自定义名称' : '设为自定义名称'"
                        @click.stop="editModuleName(row)"
                      >
                        <i class="fas fa-edit" /><span>{{ row.is_custom_name === 1 ? '编辑' : '自定义' }}</span>
                      </el-button><el-button
                        v-if="canEdit && row.is_custom_name === 1"
                        type="warning"
                        size="small"
                        title="恢复原始名称"
                        @click.stop="restoreModuleName(row)"
                      >
                        <i class="fas fa-undo" /><span>恢复</span>
                      </el-button><el-button
                        type="info"
                        size="small"
                        title="详情"
                        @click.stop="showModuleDetails(row)"
                      >
                        <i class="fas fa-info-circle" /><span>详情</span>
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 模块列表 - 网格视图 -->
            <div
              v-else
              class="module-grid"
            >
              <div
                v-for="module in paginatedModules"
                :key="module.id"
                class="module-card"
                :class="{
                  'custom-name': module.is_custom_name === 1,
                  'inactive-module': !module.is_active
                }"
              >
                <div class="card-header">
                  <div class="module-header-main">
                    <div class="module-primary-row">
                      <div
                        class="module-name"
                        :title="module.name"
                      >
                        <span class="module-name-text">{{ module.name }}</span>
                        <span
                          v-if="module.is_custom_name === 1"
                          class="custom-badge"
                        >🔒</span>
                      </div>
                      <span
                        class="category-badge"
                        :class="module.category"
                      >{{ getCategoryName(module.category) }}</span>
                      <div class="module-status">
                        <span
                          class="status-indicator"
                          :class="module.is_active ? 'active' : 'inactive'"
                        />
                        <span class="module-status-text">{{ module.is_active ? '已启用' : '已禁用' }}</span>
                      </div>
                    </div>
                    <div class="module-secondary-row">
                      <div
                        class="module-key"
                        :title="module.key"
                      >
                        {{ module.key }}
                      </div>
                      <div
                        class="module-description-text"
                        :title="module.description"
                      >
                        {{ module.description }}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="card-body">
                  <div class="module-info">
                    <div class="info-item info-chip-card">
                      <label>权限数量</label>
                      <span class="permission-count">{{ module.permission_count || 0 }} 个</span>
                    </div>
                    <div class="info-item info-chip-card">
                      <label>名称状态</label>
                      <span
                        class="name-status-badge"
                        :class="module.is_custom_name ? 'custom' : 'auto'"
                      >
                        {{ module.name_status }}
                      </span>
                    </div>
                    <div class="info-item info-meta-card">
                      <label>创建时间</label>
                      <span class="info-value">{{ formatDateOnly(module.created_at) }}</span>
                    </div>
                    <div class="info-item info-meta-card">
                      <label>模块类型</label>
                      <span class="info-value">{{ module.is_custom_name === 1 ? '自定义名称' : '自动生成' }}</span>
                    </div>
                  </div>
                </div>
                <div
                  v-if="showModuleActionField"
                  class="card-footer"
                >
                  <div class="module-actions card-actions tf-actions--fit-row">
                    <el-button
                      v-if="canEdit"
                      :type="isProtectedModule(module) ? 'info' : (module.is_active ? 'warning' : 'success')"
                      size="small"
                      :disabled="isProtectedModule(module) && Number(module.is_active) === 1"
                      :title="isProtectedModule(module) ? '权限管理核心模块不能禁用' : (module.is_active ? '禁用模块' : '启用模块')"
                      @click="toggleModuleStatus(module)"
                    >
                      <i :class="isProtectedModule(module) ? 'fas fa-shield-alt' : (module.is_active ? 'fas fa-toggle-off' : 'fas fa-toggle-on')" />
                      <span>{{ isProtectedModule(module) && Number(module.is_active) === 1 ? '核心模块' : (module.is_active ? '禁用' : '启用') }}</span>
                    </el-button>
                    <el-button
                      type="info"
                      size="small"
                      @click="showModuleDetails(module)"
                    >
                      <i class="fas fa-eye" />
                      <span>查看</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="primary"
                      size="small"
                      @click="editModuleName(module)"
                    >
                      <i class="fas fa-edit" />
                      <span>{{ module.is_custom_name === 1 ? '编辑' : '自定义' }}</span>
                    </el-button>
                    <el-button
                      v-if="canEdit && module.is_custom_name === 1"
                      type="warning"
                      size="small"
                      @click="restoreModuleName(module)"
                    >
                      <i class="fas fa-undo" />
                      <span>恢复</span>
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 分页 -->
            <div class="pagination-wrapper">
              <Pagination
                v-if="pagination.total > 0"
                v-model:current="pagination.page"
                v-model:page-size="pagination.page_size"
                :total="pagination.total"
                :page-sizes="[12, 24, 48, 96]"
                :show-total="true"
                :show-range="true"
                :show-page-sizes="true"
                :show-quick-jumper="true"
                :disabled="isLoading"
                @change="handlePaginationChange"
              />
            </div>
          </div>
        </div>

        <!-- 编辑模块名称对话框 -->
        <MobileDialog
          v-model="editDialogVisible"
          :title="editForm.is_custom ? '编辑自定义名称' : '设为自定义名称'"
          width="560px"
          dialog-class="module-management-dialog"
          :show-default-footer="false"
          :close-on-click-modal="false"
        >
          <div class="modal-body">
            <form @submit.prevent="saveModuleName">
              <div class="form-group">
                <label>模块标识</label>
                <input
                  v-model="editForm.key"
                  type="text"
                  class="form-control"
                  readonly
                >
              </div>

              <div class="form-group">
                <label>
                  模块名称 <span class="required">*</span>
                </label>
                <input
                  v-model="editForm.name"
                  type="text"
                  class="form-control"
                  placeholder="请输入模块名称"
                  required
                >
                <div class="input-hint">
                  <span
                    v-if="editForm.is_custom === true"
                    class="custom-hint"
                  >
                    🔒 此为自定义名称，扫描时不会被覆盖
                  </span>
                  <span
                    v-else
                    class="auto-hint"
                  >
                    🤖 设置为自定义名称后，扫描时不会被覆盖
                  </span>
                </div>
              </div>

              <div class="form-group">
                <label>名称保护</label>
                <el-checkbox v-model="editForm.is_custom">
                  设为自定义名称（保护不被扫描覆盖）
                </el-checkbox>
              </div>
            </form>
          </div>

          <template #footer>
            <div class="tf-dialog-actions">
              <el-button
                type="info"
                :disabled="isSubmitting"
                @click="editDialogVisible = false"
              >
                取消
              </el-button>
              <el-button
                type="primary"
                :disabled="isSubmitting"
                @click="saveModuleName"
              >
                <InlineLoading
                  v-if="isSubmitting"
                  text="保存中..."
                  size="small"
                  variant="inherit"
                />
                <template v-else>
                  保存
                </template>
              </el-button>
            </div>
          </template>
        </MobileDialog>

        <!-- 恢复确认对话框 -->
        <MobileDialog
          v-model="restoreDialogVisible"
          title="恢复原始名称"
          width="560px"
          dialog-class="module-management-dialog"
          :show-default-footer="false"
          :close-on-click-modal="false"
        >
          <div class="modal-body">
            <div class="confirm-content">
              <i
                class="fas fa-exclamation-triangle"
                style="color: #f59e0b; font-size: 48px;"
              />
              <div class="confirm-message">
                <h4>确认恢复</h4>
                <p>将模块名称恢复为扫描时的原始名称，此操作无法撤销。</p>
                <p><strong>当前名称：</strong>{{ restoreData.current_name }}</p>
                <p><strong>原始名称：</strong>{{ restoreData.original_name }}</p>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="tf-dialog-actions">
              <el-button
                type="info"
                :disabled="isSubmitting"
                @click="restoreDialogVisible = false"
              >
                取消
              </el-button>
              <el-button
                type="warning"
                :disabled="isSubmitting"
                @click="confirmRestore"
              >
                <InlineLoading
                  v-if="isSubmitting"
                  text="恢复中..."
                  size="small"
                  variant="inherit"
                />
                <template v-else>
                  确认恢复
                </template>
              </el-button>
            </div>
          </template>
        </MobileDialog>

        <!-- 模块详情对话框 -->
        <MobileDialog
          v-model="detailsDialogVisible"
          title="模块详情"
          width="680px"
          dialog-class="module-management-dialog"
          :show-default-footer="false"
        >
          <div class="modal-body">
            <div
              v-if="selectedModule"
              class="module-detail-view"
            >
              <div class="detail-section">
                <h4>基本信息</h4>
                <div class="detail-row">
                  <span class="label">模块标识：</span>
                  <span class="value"><code>{{ selectedModule.key }}</code></span>
                </div>
                <div class="detail-row">
                  <span class="label">当前名称：</span>
                  <span class="value">
                    {{ selectedModule.name }}
                    <span
                      v-if="selectedModule.is_custom_name === 1"
                      class="custom-badge"
                    >🔒 自定义</span>
                  </span>
                </div>
                <div
                  v-if="selectedModule.original_name"
                  class="detail-row"
                >
                  <span class="label">原始名称：</span>
                  <span class="value">{{ selectedModule.original_name }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">分类：</span>
                  <span class="value">
                    <span
                      class="category-badge"
                      :class="selectedModule.category"
                    >
                      {{ getCategoryName(selectedModule.category) }}
                    </span>
                  </span>
                </div>
                <div class="detail-row">
                  <span class="label">状态：</span>
                  <span class="value">
                    <span
                      class="status-badge"
                      :class="selectedModule.is_active ? 'active' : 'inactive'"
                    >
                      {{ selectedModule.is_active ? '启用' : '禁用' }}
                    </span>
                  </span>
                </div>
              </div>

              <div class="detail-section">
                <h4>时间信息</h4>
                <div class="detail-row">
                  <span class="label">创建时间：</span>
                  <span class="value">{{ formatDate(selectedModule.created_at) }}</span>
                </div>
                <div
                  v-if="selectedModule.updated_at"
                  class="detail-row"
                >
                  <span class="label">更新时间：</span>
                  <span class="value">{{ formatDate(selectedModule.updated_at) }}</span>
                </div>
              </div>

              <div class="detail-section">
                <h4>权限信息</h4>
                <div class="detail-row">
                  <span class="label">权限数量：</span>
                  <span class="value">{{ selectedModule.permission_count || 0 }} 个</span>
                </div>
                <div class="detail-row">
                  <span class="label">描述：</span>
                  <span class="value">{{ selectedModule.description }}</span>
                </div>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="tf-dialog-actions">
              <el-button
                type="info"
                @click="detailsDialogVisible = false"
              >
                关闭
              </el-button>
            </div>
          </template>
        </MobileDialog>

        <!-- 手动添加模块对话框 -->
        <MobileDialog
          v-model="showAddModuleDialog"
          title="手动添加模块"
          width="760px"
          dialog-class="module-management-dialog module-management-dialog-wide"
          :show-default-footer="false"
          :close-on-click-modal="false"
        >
          <div class="modal-body">
            <div class="form-section">
              <div class="form-group">
                <label class="form-label">
                  <span class="required">*</span>
                  模块标识 (key)
                </label>
                <input
                  v-model="newModule.key"
                  type="text"
                  class="form-control"
                  placeholder="例如: subsidy_subsidyview"
                  :class="{ 'is-invalid': formErrors.key }"
                >
                <small class="form-text">
                  模块的唯一标识符，建议使用格式: category_modulename
                </small>
                <div
                  v-if="formErrors.key"
                  class="invalid-feedback"
                >
                  {{ formErrors.key }}
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">
                  <span class="required">*</span>
                  模块名称
                </label>
                <input
                  v-model="newModule.name"
                  type="text"
                  class="form-control"
                  placeholder="例如: 国补管理"
                  :class="{ 'is-invalid': formErrors.name }"
                >
                <small class="form-text">
                  模块的显示名称，将用于菜单显示
                </small>
                <div
                  v-if="formErrors.name"
                  class="invalid-feedback"
                >
                  {{ formErrors.name }}
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">模块描述</label>
                <textarea
                  v-model="newModule.description"
                  class="form-control"
                  rows="3"
                  placeholder="简要描述该模块的功能..."
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">
                    <span class="required">*</span>
                    分类
                  </label>
                  <select
                    v-model="newModule.category"
                    class="form-control"
                  >
                    <option value="">
                      请选择分类
                    </option>
                    <option value="system">
                      系统模块
                    </option>
                    <option value="business">
                      业务模块
                    </option>
                    <option value="custom">
                      自定义模块
                    </option>
                  </select>
                  <div
                    v-if="formErrors.category"
                    class="invalid-feedback"
                  >
                    {{ formErrors.category }}
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">图标</label>
                  <select
                    v-model="newModule.icon"
                    class="form-control"
                  >
                    <option value="fas fa-cube">
                      fas fa-cube (默认)
                    </option>
                    <option value="fas fa-cog">
                      fas fa-cog (设置)
                    </option>
                    <option value="fas fa-shopping-cart">
                      fas fa-shopping-cart (购物)
                    </option>
                    <option value="fas fa-users">
                      fas fa-users (用户)
                    </option>
                    <option value="fas fa-chart-bar">
                      fas fa-chart-bar (图表)
                    </option>
                    <option value="fas fa-hand-holding-usd">
                      fas fa-hand-holding-usd (补贴)
                    </option>
                    <option value="fas fa-wrench">
                      fas fa-wrench (维修)
                    </option>
                    <option value="fas fa-box">
                      fas fa-box (库存)
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="flex-checkbox">
                  <input
                    v-model="newModule.is_active"
                    type="checkbox"
                  >
                  <span>启用模块 (模块激活后才可用)</span>
                </label>
              </div>

              <div class="form-help-text">
                模块创建后只会注册到模块表，角色权限与菜单显示需要在权限管理页单独分配，不再自动发放。
              </div>
            </div>
          </div>

          <template #footer>
            <div class="tf-dialog-actions">
              <el-button
                type="info"
                @click="showAddModuleDialog = false"
              >
                <i class="fas fa-times" />
                取消
              </el-button>
              <el-button
                type="primary"
                :disabled="isSubmitting"
                @click="handleAddModule"
              >
                <InlineLoading
                  v-if="isSubmitting"
                  text="添加中..."
                  size="small"
                  variant="inherit"
                />
                <template v-else>
                  <i class="fas fa-check" />
                  确认添加
                </template>
              </el-button>
            </div>
          </template>
        </MobileDialog>
      </div>
    </PermissionGate>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useNotification } from '@/composables/useNotification'
import { usePageState } from '@/composables/usePageState'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { getAdaptiveActionColumnWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import unifiedApi from '@/utils/unified-api'
import Pagination from '@/components/Pagination.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import { PermissionGate } from '@/components/base'

export default {
  name: 'ModuleManagementView',
  components: {
    Pagination,
    UnifiedSearchPanel,
    InlineLoading,
    PermissionGate
  },
  setup() {
    // 权限检查 - 使用 module-management 映射到 permissions_modulemanagementview
    const { canView, canCreate, canEdit, canDelete } = usePagePermissions('module-management')
    const showModuleActionField = computed(() => shouldShowActionColumn(
      fieldPermissions.isFieldVisible('permissions_modulemanagementview', 'system_info.operations'),
      [canEdit.value, canDelete.value]
    ))

    // 使用统一提示服务和状态管理
    const { success: showSuccess, error: showError, warning: showWarning } = useNotification()
    const {
      isLoading,
      isSubmitting,
      setDataLoading,
      setSubmitLoading,
      hasError,
      errorMessage,
      setError,
      clearError,
      handleApiError
    } = usePageState(24)

    // 响应式数据
    const modules = ref([])
    const searchText = ref('')
    const filterCategory = ref('')
    const nameStatus = ref('')
    const activeStatus = ref('')
    const viewMode = ref('grid')
    const searchExpanded = ref(false)

    // 统一分页数据
    const pagination = reactive({
      page: 1,
      page_size: 24,
      total: 0
    })

    // 编辑对话框
    const editDialogVisible = ref(false)
    const editForm = reactive({
      key: '',
      name: '',
      is_custom: false
    })

    // 恢复对话框
    const restoreDialogVisible = ref(false)
    const restoreData = reactive({
      key: '',
      current_name: '',
      original_name: ''
    })

    // 详情对话框
    const detailsDialogVisible = ref(false)
    const selectedModule = ref(null)

    // 手动添加模块对话框
    const showAddModuleDialog = ref(false)
    const newModule = reactive({
      key: '',
      name: '',
      description: '',
      category: '',
      icon: 'fas fa-cube',
      is_active: true
    })
    const formErrors = ref({})

    // 计算属性
    const filteredModules = computed(() => {
      let result = modules.value

      // 文本搜索
      if (searchText.value) {
        const searchLower = searchText.value.toLowerCase()
        result = result.filter(module =>
          module.key.toLowerCase().includes(searchLower) ||
          module.name.toLowerCase().includes(searchLower)
        )
      }

      // 分类筛选
      if (filterCategory.value) {
        result = result.filter(module => module.category === filterCategory.value)
      }

      // 名称状态筛选
      if (nameStatus.value) {
        if (nameStatus.value === 'custom') {
          result = result.filter(module => module.is_custom_name === 1)
        } else if (nameStatus.value === 'auto') {
          result = result.filter(module => module.is_custom_name === 0)
        }
      }

      if (activeStatus.value === 'active') {
        result = result.filter(module => Number(module.is_active) === 1)
      } else if (activeStatus.value === 'inactive') {
        result = result.filter(module => Number(module.is_active) === 0)
      }

      return result
    })

    watch(
      () => filteredModules.value.length,
      total => {
        pagination.total = total
        const lastPage = Math.max(1, Math.ceil(total / pagination.page_size))
        if (pagination.page > lastPage) pagination.page = lastPage
      },
      { immediate: true }
    )

    const paginatedModules = computed(() => {
      const start = (pagination.page - 1) * pagination.page_size
      const end = start + pagination.page_size
      return filteredModules.value.slice(start, end)
    })

    const moduleActionColumnWidth = computed(() => {
      return getAdaptiveActionColumnWidth(paginatedModules.value, [
        {
          label: module => isProtectedModule(module) && Number(module.is_active) === 1
            ? '核心模块'
            : (module.is_active ? '禁用' : '启用'),
          visible: canEdit.value
        },
        {
          label: module => module.is_custom_name === 1 ? '编辑' : '自定义',
          visible: canEdit.value
        },
        {
          label: '恢复',
          visible: module => module.is_custom_name === 1
        },
        { label: '详情', visible: true }
      ])
    })

    const getModuleColumnWidth = (field) => {
      const config = {
        key: { label: '模块标识', minWidth: 132, maxWidth: 220, padding: 24 },
        name: { label: '模块名称', minWidth: 132, maxWidth: 216, padding: 54 },
        category: { label: '分类', minWidth: 82, maxWidth: 108, padding: 28 },
        permission_count: { label: '权限数量', minWidth: 86, maxWidth: 104, padding: 24 },
        name_status: { label: '名称状态', minWidth: 92, maxWidth: 116, padding: 28 },
        created_at: { label: '创建时间', minWidth: 108, maxWidth: 132, padding: 24 }
      }[field]
      const values = paginatedModules.value.map(module => {
        if (field === 'name') return `${module.name || '-'} ${module.description || ''}`
        if (field === 'category') return getCategoryName(module.category)
        if (field === 'permission_count') return `${module.permission_count || 0} 个`
        if (field === 'created_at') return formatDate(module.created_at)
        return module[field] || '-'
      })

      return getTextColumnMinWidth([config.label, ...values], {
        minWidth: config.minWidth,
        maxWidth: config.maxWidth,
        horizontalPadding: config.padding
      })
    }

    // 方法
    const loadModules = async () => {
      try {
        setDataLoading(true)
        clearError()

        // 使用API工具获取已注册模块列表
        const response = await unifiedApi.get('/modules/registered')

        if (response.success) {
          modules.value = response.data.modules || []
        } else {
          setError(response.message || '获取模块列表失败')
          showError(response.message || '获取模块列表失败')
        }
      } catch (error) {
        handleApiError(error, '获取模块列表失败')
      } finally {
        setDataLoading(false)
      }
    }

    const handleSearch = () => {
      pagination.page = 1
    }

    const clearSearch = () => {
      searchText.value = ''
      pagination.page = 1
    }

    const clearFilters = () => {
      searchText.value = ''
      filterCategory.value = ''
      nameStatus.value = ''
      activeStatus.value = ''
      pagination.page = 1
    }

    const handleCategoryFilter = () => {
      pagination.page = 1
    }

    const handleNameStatusFilter = () => {
      pagination.page = 1
    }

    const handleActiveStatusFilter = () => {
      pagination.page = 1
    }

    const handlePaginationChange = (page, page_size) => {
      pagination.page = page
      pagination.page_size = page_size
    }

    const getCategoryName = (category) => {
      const names = {
        system: '系统模块',
        business: '业务模块',
        custom: '自定义模块'
      }
      return names[category] || category
    }

    const formatDate = (dateString) => {
      return TimeUtil.format(dateString, TIME_FORMATS.DATETIME)
    }

    const formatDateOnly = (dateString) => {
      return TimeUtil.format(dateString, TIME_FORMATS.DATE)
    }

    const editModuleName = (module) => {
      editForm.key = module.key
      editForm.name = module.name
      editForm.is_custom = module.is_custom_name === 1
      editDialogVisible.value = true
    }

    const resetEditForm = () => {
      editForm.key = ''
      editForm.name = ''
      editForm.is_custom = false
    }

    const saveModuleName = async () => {
      if (isSubmitting.value) return

      if (!editForm.name.trim()) {
        showWarning('请输入模块名称')
        return
      }

      setSubmitLoading(true)
      try {
        const response = await unifiedApi.put(`/modules/${editForm.key}/name`, {
          name: editForm.name.trim(),
          is_custom: editForm.is_custom
        })

        if (response.success) {
          showSuccess(response.message)
          editDialogVisible.value = false
          resetEditForm()
          await loadModules() // 刷新列表
        } else {
          showError(response.message || '修改模块名称失败')
        }
      } catch (error) {
        handleApiError(error, '修改模块名称失败')
      } finally {
        setSubmitLoading(false)
      }
    }

    const restoreModuleName = (module) => {
      restoreData.key = module.key
      restoreData.current_name = module.name
      restoreData.original_name = module.original_name || ''
      restoreDialogVisible.value = true
    }

    const confirmRestore = async () => {
      if (isSubmitting.value) return

      if (!restoreData.key) return

      setSubmitLoading(true)
      try {
        const response = await unifiedApi.put(`/modules/${restoreData.key}/restore-name`)

        if (response.success) {
          showSuccess(response.message)
          restoreDialogVisible.value = false
          await loadModules() // 刷新列表
        } else {
          showError(response.message || '恢复模块名称失败')
        }
      } catch (error) {
        handleApiError(error, '恢复模块名称失败')
      } finally {
        setSubmitLoading(false)
      }
    }

    const showModuleDetails = (module) => {
      selectedModule.value = module
      detailsDialogVisible.value = true
    }

    const isProtectedModule = (module) => [
      'permissions_permissionsview',
      'permissions_modulemanagementview'
    ].includes(module?.key)

    // 切换模块启用/禁用状态
    const toggleModuleStatus = async (module) => {
      const newStatus = Number(module.is_active) === 1 ? 0 : 1
      const actionText = newStatus === 1 ? '启用' : '禁用'

      if (newStatus === 0 && isProtectedModule(module)) {
        showWarning('权限管理核心模块不能禁用，否则会导致管理入口无法访问')
        return
      }

      try {
        const message = newStatus === 1
          ? `确定要启用模块“${module.name}”吗？启用后可重新用于菜单关联和权限配置。`
          : `确定要禁用模块“${module.name}”吗？禁用后将不能用于菜单关联、权限配置和模块选择，已有业务页面代码不会被删除。`

        await ElMessageBox.confirm(message, `${actionText}模块`, {
          confirmButtonText: `确认${actionText}`,
          cancelButtonText: '取消',
          type: newStatus === 1 ? 'success' : 'warning',
          customClass: 'message-box-unified'
        })

        const response = await unifiedApi.put(`/modules/${module.id}/status`, {
          is_active: newStatus
        })

        if (response.success) {
          showSuccess(`模块"${module.name}"已${actionText}`)
          await loadModules() // 重新加载模块列表
        } else {
          showError(response.message || `${actionText}失败`)
        }
      } catch (error) {
        if (error === 'cancel' || error === 'close') return
        showError(`${actionText}模块失败，请稍后重试`)
      }
    }

    // 手动添加模块
    const handleAddModule = async () => {
      // 验证表单
      formErrors.value = {}

      if (!newModule.key.trim()) {
        formErrors.value.key = '模块标识不能为空'
        return
      }

      if (!newModule.name.trim()) {
        formErrors.value.name = '模块名称不能为空'
        return
      }

      if (!newModule.category) {
        formErrors.value.category = '请选择模块分类'
        return
      }

      // 验证模块标识格式（只允许字母、数字、下划线）
      const keyRegex = /^[a-zA-Z0-9_]+$/
      if (!keyRegex.test(newModule.key)) {
        formErrors.value.key = '模块标识只能包含字母、数字和下划线'
        return
      }

      try {
        isSubmitting.value = true

        const response = await unifiedApi.post('/modules/manual-create', {
          key: newModule.key.trim().toLowerCase(),
          name: newModule.name.trim(),
          description: newModule.description.trim() || `${newModule.name}管理模块`,
          category: newModule.category,
          icon: newModule.icon,
          is_active: newModule.is_active ? 1 : 0
        })

        if (response.success) {
          showSuccess(`模块"${newModule.name}"添加成功`)
          showAddModuleDialog.value = false

          // 重置表单
          Object.assign(newModule, {
            key: '',
            name: '',
            description: '',
            category: '',
            icon: 'fas fa-cube',
            is_active: true
          })
          formErrors.value = {}

          await loadModules() // 重新加载模块列表
        } else {
          showError(response.message || '添加模块失败')
        }
      } catch (error) {
        if (error.response?.data?.message) {
          showError(error.response.data.message)
        } else {
          showError('添加模块失败，请稍后重试')
        }
      } finally {
        isSubmitting.value = false
      }
    }

    // 生命周期
    onMounted(() => {
      loadModules()
    })

    return {
      // 权限相关
      canView,
      canCreate,
      canEdit,
      canDelete,
      showModuleActionField,

      // 数据
      isLoading,
      isSubmitting,
      hasError,
      errorMessage,
      modules,
      filteredModules,
      paginatedModules,
      moduleActionColumnWidth,
      getModuleColumnWidth,
      editDialogVisible,
      editForm,
      restoreDialogVisible,
      restoreData,
      detailsDialogVisible,
      selectedModule,
      searchText,
      filterCategory,
      nameStatus,
      activeStatus,
      pagination,
      viewMode,
      searchExpanded,

      // 方法
      loadModules,
      handleSearch,
      clearSearch,
      clearFilters,
      handleCategoryFilter,
      handleNameStatusFilter,
      handleActiveStatusFilter,
      handlePaginationChange,
      getCategoryName,
      formatDate,
      formatDateOnly,
      editModuleName,
      resetEditForm,
      saveModuleName,
      restoreModuleName,
      confirmRestore,
      showModuleDetails,
      isProtectedModule,
      toggleModuleStatus,
      showAddModuleDialog,
      newModule,
      formErrors,
      handleAddModule
    }
  }
}
</script>

<style scoped>
/* 按钮禁用样式 */
.btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.module-management {
  padding: 0;
  min-height: 0;
  background: transparent;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  color: var(--tf-color-slate-legacy);
  font-weight: 500;
}

.form-help-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--tf-color-slate-500);
  background: var(--tf-color-slate-50);
  border: 1px dashed var(--tf-color-slate-300);
  border-radius: 10px;
  padding: 10px 12px;
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.input-icon {
  position: absolute;
  left: 12px;
  color: var(--tf-color-gray-legacy-500);
  z-index: 1;
}

.form-control {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--tf-color-gray-300-alt);
  border-radius: 10px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 34px;
  background: var(--color-bg-white);
  width: 100%;
  box-sizing: border-box;
}

.input-group .form-control {
  padding-left: 36px;
  padding-right: 36px;
}

.form-control:focus {
  outline: none;
  border-color: var(--tf-color-blue-legacy);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.btn-clear {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--tf-button-tool-color);
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.btn-clear:hover {
  background: var(--tf-button-neutral-hover-bg);
}

.modules-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
  color: var(--tf-color-heading);
}

.section-title-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-count {
  font-size: 14px;
  color: var(--tf-color-gray-cool-500);
}

.view-toggles {
  display: flex;
  gap: 5px;
}

.loading-container {
  text-align: center;
  padding: 40px;
}

.loading-spinner {
  color: var(--tf-color-gray-legacy-500);
  font-size: 48px;
  margin-bottom: 16px;
}

.loading-spinner i {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: spin(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--tf-color-gray-legacy-500);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-state h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: var(--tf-color-gray-cool-500);
}

.empty-state p {
  margin: 0 0 10px 0;
  line-height: 1.5;
  color: var(--tf-color-gray-legacy-500);
}

.btn-link {
  background: transparent;
  border: none;
  color: var(--tf-button-primary-soft-color);
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.btn-link:hover {
  color: var(--tf-button-primary-soft-hover-color);
}

.module-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.module-table th,
.module-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--tf-color-gray-200-alt);
  vertical-align: middle;
}

.module-table th {
  background: var(--tf-color-surface-muted);
  font-weight: 600;
  color: var(--tf-color-slate-legacy);
  font-size: 14px;
}

.module-row:hover {
  background: var(--tf-color-surface-muted);
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.status-badge.active {
  background: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border: 1px solid var(--tf-status-success-border);
}

.status-badge.inactive {
  background: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border: 1px solid var(--tf-status-danger-border);
}

.module-key {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  background: var(--tf-color-surface-google);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--tf-color-pink-500);
}

.module-name-cell {
  min-width: 150px;
}

.module-name {
  font-weight: 500;
  color: var(--tf-color-heading);
  display: flex;
  align-items: center;
  gap: 6px;
}

.module-description {
  font-size: 12px;
  color: var(--tf-color-gray-cool-500);
  line-height: 1.3;
}

.custom-badge {
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-warning-text-legacy);
  border: 1px solid var(--tf-color-amber-pastel);
  border-radius: 10px;
  font-size: 10px;
  padding: 2px 6px;
  font-weight: 500;
}

.category-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.category-badge.system {
  background: var(--tf-color-blue-100);
  color: var(--tf-color-blue-material-700);
  border: 1px solid var(--tf-color-blue-material-100);
}

.category-badge.business {
  background: var(--tf-color-surface-green-alt);
  color: var(--tf-color-green-material-700);
  border: 1px solid var(--tf-color-green-material-100);
}

.category-badge.custom {
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-warning-text-legacy);
  border: 1px solid var(--tf-color-amber-pastel);
}

.permission-count {
  background: var(--tf-color-warning-legacy);
  color: var(--tf-color-warning-text-legacy);
  border: 1px solid var(--tf-color-amber-pastel);
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 12px;
  font-weight: 500;
}

.name-status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.name-status-badge.custom {
  background: var(--tf-status-warning-bg);
  color: var(--tf-status-warning-color);
  border: 1px solid var(--tf-status-warning-border);
}

.name-status-badge.auto {
  background: var(--tf-status-primary-bg);
  color: var(--tf-status-primary-color);
  border: 1px solid var(--tf-status-primary-border);
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--admin-panel-gap);
  padding: var(--admin-panel-padding) 0 0;
}

.module-card {
  background: var(--color-bg-white);
  border-radius: var(--admin-panel-radius);
  border: 1px solid var(--tf-color-border-blue-muted);
  overflow: hidden;
  transition: all 0.25s ease;
  position: relative;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
}

.module-card.custom-name {
  border-color: rgba(245, 158, 11, 0.28);
  box-shadow: 0 16px 34px rgba(245, 158, 11, 0.12);
}

.module-card.inactive-module {
  border-color: rgba(100, 116, 139, 0.28);
  box-shadow: 0 12px 28px rgba(100, 116, 139, 0.1);
}

.module-card.inactive-module .card-header {
  background: var(--tf-color-slate-50);
}

.module-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
}

.card-header {
  padding: 16px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  background: var(--tf-color-slate-50);
}

.module-header-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.module-primary-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.module-status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 6px rgba(15, 23, 42, 0.04);
}

.status-indicator.active {
  background: var(--success-color);
}

.status-indicator.inactive {
  background: var(--danger-color);
}

.module-status-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--tf-color-slate-600);
}

.module-card .module-key {
  font-family: 'Courier New', monospace;
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  font-size: 11px;
  color: var(--tf-color-slate-500);
  background: var(--tf-color-surface-blue-muted);
  padding: 4px 8px;
  border-radius: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.module-secondary-row {
  display: grid;
  grid-template-columns: minmax(96px, 44%) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.module-card .module-name {
  font-weight: 700;
  color: var(--tf-color-slate-900);
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 16px;
  line-height: 1.25;
  white-space: nowrap;
}

.module-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-card .custom-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--tf-color-warning-legacy) 0%, var(--tf-color-amber-pastel) 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--tf-color-amber-700);
  font-size: 11px;
  font-weight: 700;
}

.module-card .category-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.module-description-text {
  font-size: 13px;
  line-height: 1.4;
  color: var(--tf-color-slate-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body {
  padding: 12px 16px;
}

.module-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--tf-color-border-blue-muted);
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  background: var(--tf-color-surface-blue);
  padding: 10px 12px;
}

.info-item label {
  flex: 0 0 auto;
  margin: 0;
  font-size: 12px;
  color: var(--tf-color-slate-500);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.info-item span {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  font-size: 13px;
  color: var(--tf-color-slate-800);
  line-height: 1.45;
  text-align: right;
  white-space: nowrap;
}

.info-value {
  font-weight: 600;
}

.module-card .permission-count,
.module-card .name-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.module-card .permission-count {
  background: var(--tf-color-amber-material-50);
  color: var(--tf-color-amber-700);
  border: 1px solid rgba(245, 158, 11, 0.22);
}

.module-card .name-status-badge.custom {
  background: var(--tf-color-orange-material-50);
  color: var(--tf-color-amber-700);
  border: 1px solid rgba(245, 158, 11, 0.24);
}

.module-card .name-status-badge.auto {
  background: var(--tf-color-surface-blue-muted);
  color: var(--tf-color-blue-700);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.card-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.module-actions {
  min-width: 0;
}

/* 编辑对话框样式 */
.edit-form {
  display: grid;
  gap: 16px;
}

.form-check {
  margin: 8px 0;
}

.form-check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--tf-color-gray-bootstrap-700);
}

.form-check-input {
  margin-right: 4px;
}

.checkmark {
  color: var(--success-color);
}

.input-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--tf-color-muted);
}

.custom-hint {
  color: var(--warning-color);
}

.auto-hint {
  color: var(--info-color);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* 恢复确认对话框 */
.restore-confirmation {
  display: flex;
  gap: 16px;
  align-items: center;
}

.warning-icon {
  color: var(--warning-color);
  font-size: 48px;
  flex-shrink: 0;
}

.warning-content {
  flex: 1;
}

.warning-content h4 {
  margin: 0 0 8px 0;
  color: var(--danger-color);
}

.warning-content p {
  margin: 4px 0 0 0;
  color: var(--tf-color-gray-bootstrap-700);
  line-height: 1.5;
}

.warning-content strong {
  color: var(--danger-color);
}

/* 模块详情对话框 */
.module-details-dialog .el-dialog__body {
  padding: 0;
}

.module-details {
  padding: 24px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--tf-color-heading);
  border-bottom: 1px solid var(--tf-color-gray-200-alt);
  padding-bottom: 8px;
}

.detail-grid {
  display: grid;
  gap: 12px;
}

.detail-item {
  display: flex;
  gap: 8px;
  min-height: 20px;
  align-items: center;
}

.detail-item label {
  font-size: 13px;
  color: var(--tf-color-muted);
  font-weight: 500;
  min-width: 80px;
}

.detail-item span {
  font-size: 14px;
  color: var(--tf-color-gray-bootstrap-700);
  flex: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .section-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .view-toggles {
    margin-top: 12px;
  }

  .module-grid {
    grid-template-columns: 1fr;
    gap: var(--admin-panel-gap);
    padding: var(--admin-panel-padding) 0 0;
  }

  .card-header {
    padding: 12px;
  }

  .module-info {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card-body {
    padding: 10px 12px;
  }

  .card-footer {
    padding: 10px 12px 12px;
  }

  .module-card .module-name {
    font-size: 14px;
  }

  .module-description-text {
    font-size: 12px;
    line-height: 1.4;
  }

  .info-item {
    gap: 6px;
    padding: 9px 10px;
  }

  .info-item label {
    font-size: 11px;
  }

  .info-item span {
    font-size: 12px;
  }

}

@media (max-width: 480px) {
  .module-table {
    font-size: 12px;
  }

  .module-grid {
    grid-template-columns: 1fr;
  }

}

/* 主要内容区域 */
.main-content {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

/* 统一模态框样式 */
.modal-body {
  padding: 0;
  max-height: none;
  overflow: visible;

  .form-group {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: var(--tf-color-neutral-700);
      font-size: 14px;

      .required {
        color: var(--tf-color-red-500);
      }
    }

    .form-control {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid var(--tf-color-neutral-200);
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      background: white;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: var(--tf-color-blue-500);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      &::placeholder {
        color: var(--tf-color-neutral-400);
      }

      &:read-only {
        background: var(--tf-color-neutral-50);
        color: var(--tf-color-neutral-500);
      }
    }

    .input-hint {
      margin-top: 4px;
      font-size: 12px;
      color: var(--tf-color-neutral-500);
    }

    .checkbox-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .form-checkbox {
      width: 16px;
      height: 16px;
      margin: 0;
    }

    .checkbox-label {
      margin: 0;
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checkbox-custom {
      width: 16px;
      height: 16px;
      border: 2px solid var(--tf-color-neutral-200);
      border-radius: 4px;
      position: relative;
      transition: all 0.2s;

      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 5px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        opacity: 0;
        transition: opacity 0.2s;
      }
    }

    .form-checkbox:checked + .checkbox-label .checkbox-custom {
      background: var(--tf-color-blue-500);
      border-color: var(--tf-color-blue-500);

      &::after {
        opacity: 1;
      }
    }
  }
}

.modal-footer {
  background: transparent;
  padding: 0;
  border-top: 1px solid var(--tf-color-neutral-200);
  display: flex;
  justify-content: flex-end;
  gap: 12px;

}

/* 详情对话框样式 */
.module-detail-view {
  .detail-section {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--tf-color-neutral-200);

    &:last-child {
      margin-bottom: 0;
      border-bottom: none;
    }

    h4 {
      margin: 0 0 12px 0;
      color: var(--tf-color-neutral-700);
      font-size: 16px;
      font-weight: 600;
    }
  }

  .detail-row {
    display: flex;
    align-items: flex-start;
    margin-bottom: 8px;
    padding: 4px 0;

    &.full-width {
      flex-direction: column;
      align-items: flex-start;
    }

    .label {
      flex-shrink: 0;
      width: 100px;
      color: var(--tf-color-neutral-500);
      font-weight: 500;
      font-size: 14px;
    }

    .value {
      flex: 1;
      color: var(--tf-color-neutral-700);
      font-size: 14px;
      word-break: break-word;
    }

    code {
      background: var(--tf-color-neutral-100);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }

    .custom-badge {
      background: var(--tf-color-amber-500);
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      margin-left: 8px;
    }

    .category-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;

      &.system {
        background: var(--tf-color-indigo-100);
        color: var(--tf-color-indigo-800);
      }

      &.business {
        background: var(--tf-color-green-100);
        color: var(--tf-color-success-text-strong);
      }

      &.custom {
        background: var(--tf-color-amber-100);
        color: var(--tf-color-amber-800);
      }
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;

      &.active {
        background: var(--tf-color-green-100);
        color: var(--tf-color-success-text-strong);
      }

      &.inactive {
        background: var(--tf-color-red-100);
        color: var(--tf-color-red-600);
      }
    }
  }
}

/* 确认对话框样式 */
.confirm-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;

  i {
    font-size: 48px;
    flex-shrink: 0;
    margin-top: 8px;
  }

  .confirm-message {
    flex: 1;

    h4 {
      margin: 0 0 8px 0;
      color: var(--tf-color-neutral-700);
      font-size: 16px;
    }

    p {
      margin: 0 0 4px 0;
      color: var(--tf-color-neutral-700);
      font-size: 14px;
    }

    strong {
      color: var(--tf-color-neutral-900);
    }
  }
}

/* 表单相关样式 */
.form-row {
  display: flex;
  gap: 15px;
}

.form-row .form-group {
  flex: 1;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--tf-color-neutral-700);
  font-size: 14px;
}

.form-label .required {
  color: var(--tf-color-red-500);
  margin-right: 4px;
}

.form-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--tf-color-neutral-500);
}

.invalid-feedback {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--tf-color-red-500);
}

.form-control.is-invalid {
  border-color: var(--tf-color-red-500);
}

.form-control.is-invalid:focus {
  border-color: var(--tf-color-red-500);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.flex-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.flex-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.flex-checkbox span {
  font-size: 14px;
  color: var(--tf-color-neutral-700);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-body {
    max-height: calc(100vh - 180px);
  }
}
</style>

<!-- 模态框样式 - 非 scoped，确保样式能正确应用到渲染到 body 的模态框 -->
<style lang="scss">
.module-management-dialog .el-dialog {
  max-width: min(var(--dialog-max-width, 760px), calc(100vw - 32px)) !important;
}

.module-management-dialog-wide .el-dialog {
  max-width: min(760px, calc(100vw - 32px)) !important;
}

/* 表单输入框样式 */
.module-management-dialog .modal-body {
  background: var(--color-bg-white) !important;

  .form-control {
    background: var(--color-bg-white) !important;
    border: 2px solid var(--tf-color-neutral-200);

    &:focus {
      outline: none;
      border-color: var(--tf-color-blue-500);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    &:disabled,
    &[readonly] {
      background: var(--tf-color-neutral-50) !important;
      color: var(--tf-color-neutral-500);
      cursor: not-allowed;
    }

    &::placeholder {
      color: var(--tf-color-neutral-400);
    }
  }

  /* Element Plus 复选框样式 */
  .el-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--tf-color-neutral-700);
    cursor: pointer;

    &:hover {
      color: var(--tf-color-blue-500);
    }
  }
}

</style>

<style lang="scss">
.module-management {
  --permission-bg: linear-gradient(180deg, #f5f7fb 0%, #eef3f9 100%);
  --permission-card: rgba(255, 255, 255, 0.94);
  --permission-border: rgba(15, 23, 42, 0.08);
  --permission-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  background: transparent;
  min-height: 0;
}

.module-management > div {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.module-management .modules-section {
  background: var(--permission-card);
  border: 1px solid var(--permission-border);
  box-shadow: var(--permission-shadow);
}

.module-management .modules-section {
  border-radius: 24px;
}

.module-management .section-title {
  color: var(--tf-color-slate-900);
}

.module-management .module-table thead th {
  background: var(--tf-color-surface-blue-muted);
  color: var(--tf-color-slate-900);
}

.module-management .module-table tbody tr:hover {
  background: rgba(36, 87, 245, 0.03);
}

@media (max-width: 768px) {
  .module-management .modules-section {
    border-radius: 20px;
  }
}
</style>
