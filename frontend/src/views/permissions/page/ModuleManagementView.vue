<template>
  <div class="module-management admin-page">
    <!-- ❌ 无权限时显示提示 -->
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      module-key="module-management"
      module-name="模块管理"
      permission-code="permissions:admin"
    />

    <!-- 主要内容 - 只有有权限时才显示 -->
    <div v-else class="admin-page-content">
    <PageHeader title="模块管理">
      <template #actions>
        <div class="action-buttons">
          <button class="btn btn-back" @click="$router.back()">
            <i class="fas fa-arrow-left"></i>
            返回上一步
          </button>
          <el-button type="info" plain @click="refreshModules" :disabled="isLoading">
            <i :class="isLoading ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
            <span>刷新</span>
          </el-button>
          <el-button type="primary" plain @click="handleFixMenuLinks" :disabled="isFixingMenuLinks">
            <i :class="isFixingMenuLinks ? 'fas fa-spinner fa-spin' : 'fas fa-link'"></i>
            <span>{{ isFixingMenuLinks ? '修复中...' : '修复菜单关联' }}</span>
          </el-button>
        </div>
      </template>
    </PageHeader>

    <!-- 主要内容区域 -->
    <div class="main-content admin-page-content">
      <!-- 统计信息 -->
      <div class="stats-overview">
      <div class="stat-card total">
        <div class="stat-icon">
          <i class="fas fa-cubes"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalModules }}</div>
          <div class="stat-label">已注册模块</div>
        </div>
      </div>
      <div class="stat-card custom">
        <div class="stat-icon">
          <i class="fas fa-lock"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.customModules }}</div>
          <div class="stat-label">自定义名称</div>
        </div>
      </div>
      <div class="stat-card auto">
        <div class="stat-icon">
          <i class="fas fa-robot"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.autoModules }}</div>
          <div class="stat-label">自动名称</div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      :expanded="searchExpanded"
      @update:expanded="searchExpanded = $event"
      @search="handleSearch"
      @reset="clearFilters"
    >
      <template #primary>
        <div class="input-group">
          <i class="fas fa-search input-icon"></i>
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
            <i class="fas fa-times"></i>
          </button>
        </div>
      </template>
      <div class="form-group filter-item">
        <select v-model="filterCategory" class="form-control" @change="handleCategoryFilter">
          <option value="">全部分类</option>
          <option value="system">系统模块</option>
          <option value="business">业务模块</option>
          <option value="custom">自定义模块</option>
        </select>
      </div>
      <div class="form-group filter-item">
        <select v-model="nameStatus" class="form-control" @change="handleNameStatusFilter">
          <option value="">全部状态</option>
          <option value="custom">🔒 自定义名称</option>
          <option value="auto">🤖 自动生成</option>
        </select>
      </div>
    </UnifiedSearchPanel>

    <!-- 已注册模块列表 -->
    <div class="modules-section admin-panel admin-table-panel">
      <div class="section-title">
        <div class="section-title-left">
          <i class="fas fa-list"></i>
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
            <i class="fas fa-plus"></i>
            手动添加模块
          </el-button>
          <el-button
            v-else
            type="primary"
            size="small"
            title="您没有创建模块的权限"
            disabled
          >
            <i class="fas fa-plus"></i>
            手动添加模块
          </el-button>
          <div class="view-toggles">
            <button
              :class="['btn', 'btn-sm', 'btn-outline', { active: viewMode === 'list' }]"
              @click="viewMode = 'list'"
            >
              <i class="fas fa-list"></i>
              列表
            </button>
            <button
              :class="['btn', 'btn-sm', 'btn-outline', { active: viewMode === 'grid' }]"
              @click="viewMode = 'grid'"
            >
              <i class="fas fa-th"></i>
              网格
            </button>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
          <p>加载模块数据中...</p>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredModules.length === 0" class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-inbox"></i>
        </div>
        <h3>暂无模块数据</h3>
        <p v-if="searchText || filterCategory || nameStatus">
          没有符合筛选条件的模块
          <button class="btn-link" @click="clearFilters">清除筛选条件</button>
        </p>
        <p v-else>
          系统中还没有注册任何权限模块
          <br>
          请前往"模块管理"标签页进行模块扫描和注册
        </p>
      </div>

      <!-- 模块列表 - 列表视图 -->
      <div v-else-if="viewMode === 'list'" class="table-responsive">
        <table class="module-table">
          <thead>
            <tr>
              <th width="40">状态</th>
              <th>模块标识</th>
              <th>模块名称</th>
              <th>分类</th>
              <th>权限数量</th>
              <th>名称状态</th>
              <th>创建时间</th>
              <th width="120">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="module in paginatedModules" :key="module.id" class="module-row">
              <td>
                <span class="status-badge" :class="module.is_active ? 'active' : 'inactive'">
                  {{ module.is_active ? '✅' : '❌' }}
                </span>
              </td>
              <td>
                <code class="module-key">{{ module.key }}</code>
              </td>
              <td>
                <div class="module-name-cell">
                  <div class="module-name">
                    {{ module.name }}
                    <span v-if="module.is_custom_name === 1" class="custom-badge">🔒</span>
                  </div>
                  <div class="module-description">{{ module.description }}</div>
                </div>
              </td>
              <td>
                <span class="category-badge" :class="module.category">{{ getCategoryName(module.category) }}</span>
              </td>
              <td>
                <span class="permission-count">{{ module.permission_count || 0 }}</span>
              </td>
              <td>
                <span class="name-status-badge" :class="module.is_custom_name ? 'custom' : 'auto'">
                  {{ module.name_status }}
                </span>
              </td>
              <td>
                {{ formatDate(module.created_at) }}
              </td>
              <td>
                <div class="action-buttons">
                  <el-button
                    v-if="canEdit"
                    :type="module.is_active ? 'success' : 'info'"
                    size="small"
                    @click="toggleModuleStatus(module)"
                    :title="module.is_active ? '点击禁用模块' : '点击启用模块'"
                  >
                    <i :class="module.is_active ? 'fas fa-toggle-on' : 'fas fa-toggle-off'"></i>
                    {{ module.is_active ? '已启用' : '已禁用' }}
                  </el-button>
                  <el-button
                    v-if="canEdit"
                    type="primary"
                    size="small"
                    @click="editModuleName(module)"
                    :title="module.is_custom_name === 1 ? '编辑自定义名称' : '设为自定义名称'"
                  >
                    <i class="fas fa-edit"></i>
                    {{ module.is_custom_name === 1 ? '编辑' : '自定义' }}
                  </el-button>
                  <el-button
                    v-if="module.is_custom_name === 1"
                    type="warning"
                    size="small"
                    @click="restoreModuleName(module)"
                    title="恢复原始名称"
                  >
                    <i class="fas fa-undo"></i>
                    恢复
                  </el-button>
                  <el-button
                    type="info"
                    size="small"
                    @click="showModuleDetails(module)"
                  >
                    <i class="fas fa-info-circle"></i>
                    详情
                  </el-button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 模块列表 - 网格视图 -->
      <div v-else class="module-grid">
        <div
          v-for="module in paginatedModules"
          :key="module.id"
          class="module-card"
          :class="{ 'custom-name': module.is_custom_name === 1 }"
        >
          <div class="card-header">
            <div class="module-header-main">
              <div class="module-status">
                <span class="status-indicator" :class="module.is_active ? 'active' : 'inactive'"></span>
                <span class="module-status-text">{{ module.is_active ? '已启用' : '已禁用' }}</span>
              </div>
              <div class="module-name-actions">
                <div class="module-name-row">
                  <div class="module-name">
                    {{ module.name }}
                    <span v-if="module.is_custom_name === 1" class="custom-badge">🔒</span>
                  </div>
                  <span class="category-badge" :class="module.category">{{ getCategoryName(module.category) }}</span>
                </div>
                <div class="module-key">{{ module.key }}</div>
                <div class="module-description-text">{{ module.description }}</div>
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
                <span class="name-status-badge" :class="module.is_custom_name ? 'custom' : 'auto'">
                  {{ module.name_status }}
                </span>
              </div>
              <div class="info-item info-meta-card">
                <label>创建时间</label>
                <span class="info-value">{{ formatDate(module.created_at) }}</span>
              </div>
              <div class="info-item info-meta-card">
                <label>模块类型</label>
                <span class="info-value">{{ module.is_custom_name === 1 ? '自定义名称' : '自动生成' }}</span>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <div class="module-stats">
              <el-button
                v-if="canEdit"
                :type="module.is_active ? 'success' : 'info'"
                size="small"
                @click="toggleModuleStatus(module)"
                :title="module.is_active ? '点击禁用模块' : '点击启用模块'"
              >
                <i :class="module.is_active ? 'fas fa-toggle-on' : 'fas fa-toggle-off'"></i>
                <span>{{ module.is_active ? '已启用' : '已禁用' }}</span>
              </el-button>
            </div>
            <div class="module-actions">
              <el-button
                type="info"
                size="small"
                @click="showModuleDetails(module)"
              >
                <i class="fas fa-eye"></i>
                <span>查看</span>
              </el-button>
              <el-button
                v-if="canEdit"
                type="primary"
                size="small"
                @click="editModuleName(module)"
              >
                <i class="fas fa-edit"></i>
                <span>{{ module.is_custom_name === 1 ? '编辑' : '自定义' }}</span>
              </el-button>
              <el-button
                v-if="module.is_custom_name === 1"
                type="warning"
                size="small"
                @click="restoreModuleName(module)"
              >
                <i class="fas fa-undo"></i>
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
          v-model:page-size="pagination.pageSize"
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
      :title="editForm.isCustom ? '编辑自定义名称' : '设为自定义名称'"
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
              <span v-if="editForm.isCustom === true" class="custom-hint">
                🔒 此为自定义名称，扫描时不会被覆盖
              </span>
              <span v-else class="auto-hint">
                🤖 设置为自定义名称后，扫描时不会被覆盖
              </span>
            </div>
          </div>

          <div class="form-group">
            <label>名称保护</label>
            <el-checkbox v-model="editForm.isCustom">
              设为自定义名称（保护不被扫描覆盖）
            </el-checkbox>
          </div>
        </form>
      </div>

      <template #footer>
        <div class="modal-footer">
          <el-button type="info" @click="editDialogVisible = false" :disabled="isSubmitting">
            取消
          </el-button>
          <el-button type="primary" @click="saveModuleName" :disabled="isSubmitting">
            <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
            {{ isSubmitting ? '保存中...' : '保存' }}
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
          <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 48px;"></i>
          <div class="confirm-message">
            <h4>确认恢复</h4>
            <p>将模块名称恢复为扫描时的原始名称，此操作无法撤销。</p>
            <p><strong>当前名称：</strong>{{ restoreData.currentName }}</p>
            <p><strong>原始名称：</strong>{{ restoreData.originalName }}</p>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <el-button type="info" @click="restoreDialogVisible = false" :disabled="isSubmitting">
            取消
          </el-button>
          <el-button type="warning" @click="confirmRestore" :disabled="isSubmitting">
            <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
            {{ isSubmitting ? '恢复中...' : '确认恢复' }}
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
        <div v-if="selectedModule" class="module-detail-view">
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
                <span v-if="selectedModule.is_custom_name === 1" class="custom-badge">🔒 自定义</span>
              </span>
            </div>
            <div class="detail-row" v-if="selectedModule.original_name">
              <span class="label">原始名称：</span>
              <span class="value">{{ selectedModule.original_name }}</span>
            </div>
            <div class="detail-row">
              <span class="label">分类：</span>
              <span class="value">
                <span class="category-badge" :class="selectedModule.category">
                  {{ getCategoryName(selectedModule.category) }}
                </span>
              </span>
            </div>
            <div class="detail-row">
              <span class="label">状态：</span>
              <span class="value">
                <span class="status-badge" :class="selectedModule.is_active ? 'active' : 'inactive'">
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
            <div class="detail-row" v-if="selectedModule.updated_at">
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
        <div class="modal-footer">
          <el-button type="info" @click="detailsDialogVisible = false">
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
            />
            <small class="form-text">
              模块的唯一标识符，建议使用格式: category_modulename
            </small>
            <div v-if="formErrors.key" class="invalid-feedback">
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
            />
            <small class="form-text">
              模块的显示名称，将用于菜单显示
            </small>
            <div v-if="formErrors.name" class="invalid-feedback">
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
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">
                <span class="required">*</span>
                分类
              </label>
              <select v-model="newModule.category" class="form-control">
                <option value="">请选择分类</option>
                <option value="system">系统模块</option>
                <option value="business">业务模块</option>
                <option value="custom">自定义模块</option>
              </select>
              <div v-if="formErrors.category" class="invalid-feedback">
                {{ formErrors.category }}
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">图标</label>
              <select v-model="newModule.icon" class="form-control">
                <option value="fas fa-cube">fas fa-cube (默认)</option>
                <option value="fas fa-cog">fas fa-cog (设置)</option>
                <option value="fas fa-shopping-cart">fas fa-shopping-cart (购物)</option>
                <option value="fas fa-users">fas fa-users (用户)</option>
                <option value="fas fa-chart-bar">fas fa-chart-bar (图表)</option>
                <option value="fas fa-hand-holding-usd">fas fa-hand-holding-usd (补贴)</option>
                <option value="fas fa-wrench">fas fa-wrench (维修)</option>
                <option value="fas fa-box">fas fa-box (库存)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="flex-checkbox">
              <input type="checkbox" v-model="newModule.isActive" />
              <span>启用模块 (模块激活后才可用)</span>
            </label>
          </div>

          <div class="form-help-text">
            模块创建后只会注册到模块表，角色权限与菜单显示需要在权限管理页单独分配，不再自动发放。
          </div>
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <el-button type="info" @click="showAddModuleDialog = false">
            <i class="fas fa-times"></i>
            取消
          </el-button>
          <el-button
            type="primary"
            @click="handleAddModule"
            :disabled="isSubmitting"
          >
            <i :class="isSubmitting ? 'fas fa-spinner fa-spin' : 'fas fa-check'"></i>
            {{ isSubmitting ? '添加中...' : '确认添加' }}
          </el-button>
        </div>
      </template>
    </MobileDialog>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotification } from '@/composables/useNotification'
import { usePageState } from '@/composables/usePageState'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import unifiedApi from '@/utils/unified-api';
import Pagination from '@/components/Pagination.vue';
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue';
import { PageHeader, PermissionDenied } from '@/components/base';

export default {
  name: 'ModuleManagementView',
  components: {
    Pagination,
    UnifiedSearchPanel,
    PermissionDenied
  },
  setup() {
    // 路由
    const router = useRouter();

    // 权限检查 - 使用 module-management 映射到 permissions_modulemanagementview
    const { canView, canCreate, canEdit, canDelete } = usePagePermissions('module-management');

    // 使用统一提示服务和状态管理
    const { success: showSuccess, error: showError, warning: showWarning, info: showInfo } = useNotification();
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
    } = usePageState(24);

    // 响应式数据
    const modules = ref([]);
    const searchText = ref('');
    const filterCategory = ref('');
    const nameStatus = ref('');
    const viewMode = ref('grid');
    const searchExpanded = ref(false);

    // 统一分页数据
    const pagination = reactive({
      page: 1,
      pageSize: 24,
      total: 0
    });

    // 编辑对话框
    const editDialogVisible = ref(false);
    const editForm = reactive({
      key: '',
      name: '',
      isCustom: false
    });

    // 恢复对话框
    const restoreDialogVisible = ref(false);
    const restoreData = reactive({
      key: '',
      currentName: '',
      originalName: ''
    });

    // 详情对话框
    const detailsDialogVisible = ref(false);
    const selectedModule = ref(null);

    // 手动添加模块对话框
    const showAddModuleDialog = ref(false);
    const newModule = reactive({
      key: '',
      name: '',
      description: '',
      category: '',
      icon: 'fas fa-cube',
      isActive: true
    });
    const formErrors = ref({});
    const isFixingMenuLinks = ref(false);

    // 计算属性
    const filteredModules = computed(() => {
      let result = modules.value;

      // 文本搜索
      if (searchText.value) {
        const searchLower = searchText.value.toLowerCase();
        result = result.filter(module =>
          module.key.toLowerCase().includes(searchLower) ||
          module.name.toLowerCase().includes(searchLower)
        );
      }

      // 分类筛选
      if (filterCategory.value) {
        result = result.filter(module => module.category === filterCategory.value);
      }

      // 名称状态筛选
      if (nameStatus.value) {
        if (nameStatus.value === 'custom') {
          result = result.filter(module => module.is_custom_name === 1);
        } else if (nameStatus.value === 'auto') {
          result = result.filter(module => module.is_custom_name === 0);
        }
      }

      // 更新分页总数
      pagination.total = result.length;

      return result;
    });

    const paginatedModules = computed(() => {
      const start = (pagination.page - 1) * pagination.pageSize;
      const end = start + pagination.pageSize;
      return filteredModules.value.slice(start, end);
    });

    const stats = computed(() => ({
      totalModules: modules.value.length,
      customModules: modules.value.filter(m => m.is_custom_name === 1).length,
      autoModules: modules.value.filter(m => m.is_custom_name === 0).length
    }));

    // 方法
    const loadModules = async () => {
      try {
        setDataLoading(true);
        clearError();

        // 使用API工具获取已注册模块列表
        const response = await unifiedApi.get('/modules/registered');

        if (response.success) {
          modules.value = response.data.modules || [];
        } else {
          setError(response.message || '获取模块列表失败');
          showError(response.message || '获取模块列表失败');
        }
      } catch (error) {
        handleApiError(error, '获取模块列表失败');
      } finally {
        setDataLoading(false);
      }
    };

    const refreshModules = async () => {
      try {
        showInfo('正在刷新模块列表...');
        await loadModules();
        showSuccess('模块列表刷新成功');
      } catch (error) {
        showError('刷新失败，请重试');
      }
    };

    const handleSearch = () => {
      pagination.page = 1;
    };

    const clearSearch = () => {
      searchText.value = '';
      pagination.page = 1;
    };

    const clearFilters = () => {
      searchText.value = '';
      filterCategory.value = '';
      nameStatus.value = '';
      pagination.page = 1;
    };

    const handleCategoryFilter = () => {
      pagination.page = 1;
    };

    const handleNameStatusFilter = () => {
      pagination.page = 1;
    };

    const handlePaginationChange = (page, pageSize) => {
      pagination.page = page;
      pagination.pageSize = pageSize;
    };

    const getCategoryName = (category) => {
      const names = {
        system: '系统模块',
        business: '业务模块',
        custom: '自定义模块'
      };
      return names[category] || category;
    };

    const formatDate = (dateString) => {
      return TimeUtil.format(dateString, TIME_FORMATS.DATETIME)
    };

    const editModuleName = (module) => {
      editForm.key = module.key;
      editForm.name = module.name;
      editForm.isCustom = module.is_custom_name === 1;
      editDialogVisible.value = true;
    };

    const resetEditForm = () => {
      editForm.key = '';
      editForm.name = '';
      editForm.isCustom = false;
    };

    const saveModuleName = async () => {
      if (!editForm.name.trim()) {
        showWarning('请输入模块名称');
        return;
      }

      setSubmitLoading(true);
      try {
        const response = await unifiedApi.put(`/modules/${editForm.key}/name`, {
          name: editForm.name.trim(),
          isCustom: editForm.isCustom
        });

        if (response.success) {
          showSuccess(response.message);
          editDialogVisible.value = false;
          resetEditForm();
          await loadModules(); // 刷新列表
        } else {
          showError(response.message || '修改模块名称失败');
        }
      } catch (error) {
        handleApiError(error, '修改模块名称失败');
      } finally {
        setSubmitLoading(false);
      }
    };

    const restoreModuleName = (module) => {
      restoreData.key = module.key;
      restoreData.currentName = module.name;
      restoreData.originalName = module.original_name || '';
      restoreDialogVisible.value = true;
    };

    const confirmRestore = async () => {
      if (!restoreData.key) return;

      setSubmitLoading(true);
      try {
        const response = await unifiedApi.put(`/modules/${restoreData.key}/restore-name`);

        if (response.success) {
          showSuccess(response.message);
          restoreDialogVisible.value = false;
          await loadModules(); // 刷新列表
        } else {
          showError(response.message || '恢复模块名称失败');
        }
      } catch (error) {
        handleApiError(error, '恢复模块名称失败');
      } finally {
        setSubmitLoading(false);
      }
    };

    const showModuleDetails = (module) => {
      selectedModule.value = module;
      detailsDialogVisible.value = true;
    };

    // 切换模块启用/禁用状态
    const toggleModuleStatus = async (module) => {
      const newStatus = module.is_active === 1 ? 0 : 1;
      const actionText = newStatus === 1 ? '启用' : '禁用';

      try {
        const response = await unifiedApi.put(`/modules/${module.id}/status`, {
          is_active: newStatus
        });

        if (response.success) {
          showNotification.success(`模块"${module.name}"已${actionText}`);
          await loadModules(); // 重新加载模块列表
        } else {
          showNotification.error(response.message || `${actionText}失败`);
        }
      } catch (error) {
        logger.error(`${actionText}模块失败:`, error);
        showNotification.error(`${actionText}模块失败，请稍后重试`);
      }
    };

    // 手动添加模块
    const handleAddModule = async () => {
      // 验证表单
      formErrors.value = {};

      if (!newModule.key.trim()) {
        formErrors.value.key = '模块标识不能为空';
        return;
      }

      if (!newModule.name.trim()) {
        formErrors.value.name = '模块名称不能为空';
        return;
      }

      if (!newModule.category) {
        formErrors.value.category = '请选择模块分类';
        return;
      }

      // 验证模块标识格式（只允许字母、数字、下划线）
      const keyRegex = /^[a-zA-Z0-9_]+$/;
      if (!keyRegex.test(newModule.key)) {
        formErrors.value.key = '模块标识只能包含字母、数字和下划线';
        return;
      }

      try {
        isSubmitting.value = true;

        const response = await unifiedApi.post('/modules/manual-create', {
          key: newModule.key.trim().toLowerCase(),
          name: newModule.name.trim(),
          description: newModule.description.trim() || `${newModule.name}管理模块`,
          category: newModule.category,
          icon: newModule.icon,
          is_active: newModule.isActive ? 1 : 0
        });

        if (response.success) {
          showNotification.success(`模块"${newModule.name}"添加成功`);
          showAddModuleDialog.value = false;

          // 重置表单
          Object.assign(newModule, {
            key: '',
            name: '',
            description: '',
            category: '',
            icon: 'fas fa-cube',
            isActive: true
          });
          formErrors.value = {};

          await loadModules(); // 重新加载模块列表
        } else {
          showNotification.error(response.message || '添加模块失败');
        }
      } catch (error) {
        logger.error('添加模块失败:', error);
        if (error.response?.data?.message) {
          showNotification.error(error.response.data.message);
        } else {
          showNotification.error('添加模块失败，请稍后重试');
        }
      } finally {
        isSubmitting.value = false;
      }
    };

    // 修复菜单关联
    const handleFixMenuLinks = async () => {
      try {
        isFixingMenuLinks.value = true;

        const response = await unifiedApi.post('/modules/fix-menu-links');

        if (response.success) {
          showNotification.success(response.message || `修复成功：更新了 ${response.data?.updatedCount || 0} 个菜单关联`);

          // 刷新模块列表
          await loadModules();
        } else {
          showNotification.error(response.message || '修复菜单关联失败');
        }
      } catch (error) {
        logger.error('修复菜单关联失败:', error);
        showNotification.error(error.response?.data?.message || '修复菜单关联失败，请稍后重试');
      } finally {
        isFixingMenuLinks.value = false;
      }
    };

    // 生命周期
    onMounted(() => {
      loadModules();
    });

    return {
      // 权限相关
      canView,
      canCreate,
      canEdit,
      canDelete,

      // 数据
      isLoading,
      isSubmitting,
      hasError,
      errorMessage,
      modules,
      filteredModules,
      paginatedModules,
      stats,
      editDialogVisible,
      editForm,
      restoreDialogVisible,
      restoreData,
      detailsDialogVisible,
      selectedModule,
      searchText,
      filterCategory,
      nameStatus,
      pagination,
      viewMode,
      searchExpanded,

      // 方法
      loadModules,
      refreshModules,
      handleSearch,
      clearSearch,
      clearFilters,
      handleCategoryFilter,
      handleNameStatusFilter,
      handlePaginationChange,
      getCategoryName,
      formatDate,
      editModuleName,
      resetEditForm,
      saveModuleName,
      restoreModuleName,
      confirmRestore,
      showModuleDetails,
      toggleModuleStatus,
      showAddModuleDialog,
      newModule,
      formErrors,
      handleAddModule,
      isFixingMenuLinks,
      handleFixMenuLinks
    };
  }
};
</script>

<style scoped>
/* 按钮禁用样式 */
.btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.disabled:hover {
  transform: none;
}

.module-management {
  padding: 0;
  background: #f8f9fa;
  min-height: calc(100vh - 60px);
}

.btn-back {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-outline-primary {
  background: white;
  color: #3498db;
  border: 1px solid #3498db;
}

.btn-outline-primary:hover {
  background: #3498db;
  color: white;
}

.btn-outline-secondary {
  background: white;
  color: #95a5a6;
  border: 1px solid #ddd;
}

.btn-outline-secondary:hover {
  background: #95a5a6;
  color: white;
}

.btn-outline-warning {
  background: white;
  color: #f39c12;
  border: 1px solid #f39c12;
}

.btn-outline-warning:hover {
  background: #f39c12;
  color: white;
}

.btn-outline-info {
  background: white;
  color: #17a2b8;
  border: 1px solid #17a2b8;
}

.btn-outline-info:hover {
  background: #17a2b8;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
  border: 1px solid #28a745;
}

.btn-success:hover {
  background: #218838;
  color: white;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.stat-card.total .stat-icon {
  background: #3498db;
}

.stat-card.custom .stat-icon {
  background: #e74c3c;
}

.stat-card.auto .stat-icon {
  background: #95a5a6;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #7f8c8d;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  color: #34495e;
  font-weight: 500;
}

.form-help-text {
  font-size: 13px;
  line-height: 1.6;
  color: #64748b;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
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
  color: #95a5a6;
  z-index: 1;
}

.form-control {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 10px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-height: 34px;
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}

.input-group .form-control {
  padding-left: 36px;
  padding-right: 36px;
}

.form-control:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.btn-clear {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #95a5a6;
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
  background: #f5f5f5;
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
  color: #2c3e50;
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
  color: #7f8c8d;
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
  color: #95a5a6;
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
  color: #95a5a6;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-state h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
  color: #7f8c8d;
}

.empty-state p {
  margin: 0 0 10px 0;
  line-height: 1.5;
  color: #95a5a6;
}

.btn-link {
  background: transparent;
  border: none;
  color: #3498db;
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.btn-link:hover {
  color: #2980b9;
}

.table-responsive {
  overflow-x: auto;
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
  border-bottom: 1px solid #eee;
  vertical-align: middle;
}

.module-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #34495e;
  font-size: 14px;
}

.module-row:hover {
  background: #f8f9fa;
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
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-badge.inactive {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.module-key {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  background: #f1f3f4;
  padding: 2px 6px;
  border-radius: 3px;
  color: #e83e8c;
}

.module-name-cell {
  min-width: 150px;
}

.module-name {
  font-weight: 500;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 6px;
}

.module-description {
  font-size: 12px;
  color: #7f8c8d;
  line-height: 1.3;
}

.custom-badge {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
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
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #bbdefb;
}

.category-badge.business {
  background: #e8f5e8;
  color: #388e3c;
  border: 1px solid #c8e6c9;
}

.category-badge.custom {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.permission-count {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
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
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.name-status-badge.auto {
  background: #e1f0fa;
  color: #607d8b;
  border: 1px #cfd8e9;
}

.action-buttons {
  display: flex;
  gap: 5px;
}

.action-buttons .btn {
  white-space: nowrap;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  padding: 10px;
}

.module-card {
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
  border-radius: 22px;
  border: 1px solid rgba(37, 99, 235, 0.12);
  overflow: hidden;
  transition: all 0.25s ease;
  position: relative;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
}

.module-card.custom-name {
  border-color: rgba(245, 158, 11, 0.28);
  box-shadow: 0 16px 34px rgba(245, 158, 11, 0.12);
}

.module-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
}

.card-header {
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  background:
    radial-gradient(circle at top right, rgba(96, 165, 250, 0.16), transparent 34%),
    linear-gradient(135deg, #f8fbff 0%, #f3f6ff 100%);
}

.module-header-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.module-status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 6px rgba(15, 23, 42, 0.04);
}

.status-indicator.active {
  background: #28a745;
}

.status-indicator.inactive {
  background: #dc3545;
}

.module-status-text {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
}

.module-key {
  font-family: 'Courier New', monospace;
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  font-size: 11px;
  color: #64748b;
  background: #eef4ff;
  padding: 4px 8px;
  border-radius: 10px;
  word-break: break-all;
}

.module-name-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.module-name-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.module-name {
  font-weight: 700;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
  line-height: 1.25;
  word-break: break-word;
}

.module-card .custom-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fff7d6 0%, #ffefb3 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #b45309;
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
  line-height: 1.55;
  color: #64748b;
  word-break: break-word;
}

.card-body {
  padding: 16px 18px;
}

.module-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-item {
  min-width: 0;
}

.info-chip-card,
.info-meta-card {
  border-radius: 16px;
  border: 1px solid #e6edf7;
  background: #f8fbff;
  padding: 12px 14px;
}

.info-item label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  line-height: 1.2;
}

.info-item span {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  color: #1e293b;
  line-height: 1.45;
  word-break: break-word;
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
  background: #fff7db;
  color: #b45309;
  border: 1px solid rgba(245, 158, 11, 0.22);
}

.module-card .name-status-badge.custom {
  background: #fff3e0;
  color: #b45309;
  border: 1px solid rgba(245, 158, 11, 0.24);
}

.module-card .name-status-badge.auto {
  background: #eef4ff;
  color: #1d4ed8;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.card-footer {
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.module-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.module-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}

.module-stats :deep(.el-button),
.module-actions :deep(.el-button) {
  height: 34px;
  padding: 0 14px;
  border-radius: 12px;
  font-weight: 600;
  min-width: 0;
}

.pagination-wrapper {
  padding: 20px 0;
  text-align: center;
  border-top: 1px solid #eee;
  margin-top: 20px;
  padding-top: 20px;
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
  color: #495057;
}

.form-check-input {
  margin-right: 4px;
}

.checkmark {
  color: #28a745;
}

.input-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #6c757d;
}

.custom-hint {
  color: #ffc107;
}

.auto-hint {
  color: #17a2b8;
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
  color: #ffc107;
  font-size: 48px;
  flex-shrink: 0;
}

.warning-content {
  flex: 1;
}

.warning-content h4 {
  margin: 0 0 8px 0;
  color: #dc3545;
}

.warning-content p {
  margin: 4px 0 0 0;
  color: #495057;
  line-height: 1.5;
}

.warning-content strong {
  color: #dc3545;
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
  color: #2c3e50;
  border-bottom: 1px solid #eee;
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
  color: #6c757d;
  font-weight: 500;
  min-width: 80px;
}

.detail-item span {
  font-size: 14px;
  color: #495057;
  flex: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .stats-overview {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .section-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .view-toggles {
    margin-top: 12px;
  }

  .action-buttons {
    flex-wrap: wrap;
    gap: 8px;
  }

  .action-buttons > * {
    flex: 1 1 calc(50% - 4px);
    min-width: calc(50% - 4px);
  }

  .module-grid {
    grid-template-columns: 1fr;
    gap: 15px;
    padding: 4px 0;
  }

  .card-header {
    padding: 16px 16px 12px;
  }

  .module-info {
    grid-template-columns: 1fr;
  }

  .card-body {
    padding: 14px 16px;
  }

  .card-footer {
    padding: 12px 16px 16px;
    flex-direction: column;
    align-items: stretch;
  }

  .module-name-row {
    align-items: flex-start;
    gap: 8px;
  }

  .module-name {
    font-size: 17px;
  }

  .module-description-text {
    font-size: 12px;
    line-height: 1.5;
  }

  .module-stats,
  .module-actions {
    width: 100%;
  }

  .module-actions {
    justify-content: flex-start;
  }

  .module-stats :deep(.el-button),
  .module-actions :deep(.el-button) {
    height: 32px;
    padding: 0 12px;
    border-radius: 11px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .module-management {
    padding: 15px;
  }

  .module-table {
    font-size: 12px;
  }

  .module-grid {
    grid-template-columns: 1fr;
  }

  .module-card {
    border-radius: 18px;
  }

  .module-name-row {
    flex-direction: column;
  }

  .module-card .category-badge {
    width: fit-content;
  }

  .module-actions {
    gap: 6px;
  }

  .module-actions :deep(.el-button) {
    flex: 1 1 calc(50% - 3px);
    padding: 0 10px;
  }
}

/* 主要内容区域 */
.main-content {
  background: white;
  border-radius: 0 0 16px 16px;
  margin: 0 24px 24px 24px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.1);
}

/* 分页样式 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding: 20px 0;
  border-top: 1px solid #eee;
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
      color: #374151;
      font-size: 14px;

      .required {
        color: #ef4444;
      }
    }

    .form-control {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      background: white;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      &::placeholder {
        color: #9ca3af;
      }

      &:read-only {
        background: #f9fafb;
        color: #6b7280;
      }
    }

    .input-hint {
      margin-top: 4px;
      font-size: 12px;
      color: #6b7280;
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
      border: 2px solid #e5e7eb;
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
      background: #3b82f6;
      border-color: #3b82f6;

      &::after {
        opacity: 1;
      }
    }
  }
}

.modal-footer {
  background: transparent;
  padding: 0;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 80px;
    justify-content: center;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.btn-secondary {
      background: #6b7280;
      color: white;

      &:hover:not(:disabled) {
        background: #4b5563;
        transform: translateY(-1px);
      }
    }

    &.btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
      }
    }

    &.btn-warning {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        transform: translateY(-1px);
      }
    }
  }
}

/* 详情对话框样式 */
.module-detail-view {
  .detail-section {
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;

    &:last-child {
      margin-bottom: 0;
      border-bottom: none;
    }

    h4 {
      margin: 0 0 12px 0;
      color: #374151;
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
      color: #6b7280;
      font-weight: 500;
      font-size: 14px;
    }

    .value {
      flex: 1;
      color: #374151;
      font-size: 14px;
      word-break: break-word;
    }

    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }

    .custom-badge {
      background: #f59e0b;
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
        background: #e0e7ff;
        color: #3730a3;
      }

      &.business {
        background: #dcfce7;
        color: #166534;
      }

      &.custom {
        background: #fef3c7;
        color: #92400e;
      }
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;

      &.active {
        background: #dcfce7;
        color: #166534;
      }

      &.inactive {
        background: #fee2e2;
        color: #dc2626;
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
      color: #374151;
      font-size: 16px;
    }

    p {
      margin: 0 0 4px 0;
      color: #374151;
      font-size: 14px;
    }

    strong {
      color: #111827;
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
  color: #374151;
  font-size: 14px;
}

.form-label .required {
  color: #ef4444;
  margin-right: 4px;
}

.form-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.invalid-feedback {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #ef4444;
}

.form-control.is-invalid {
  border-color: #ef4444;
}

.form-control.is-invalid:focus {
  border-color: #ef4444;
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
  color: #374151;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-body {
    padding: 20px;
    max-height: calc(100vh - 180px);
  }

  .modal-footer {
    padding: 16px 20px;
    flex-direction: column;
    gap: 8px;

    .btn {
      width: 100%;
      justify-content: center;
    }

    .btn-secondary {
      order: 1;
    }
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

.module-management-dialog .el-dialog__body {
  padding: 0 !important;
}

/* 表单输入框样式 */
.module-management-dialog .modal-body {
  background: #ffffff !important;

  .form-control {
    background: #ffffff !important;
    border: 2px solid #e5e7eb;

    &:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    &:disabled,
    &[readonly] {
      background: #f9fafb !important;
      color: #6b7280;
      cursor: not-allowed;
    }

    &::placeholder {
      color: #9ca3af;
    }
  }

  /* Element Plus 复选框样式 */
  .el-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #374151;
    cursor: pointer;

    &:hover {
      color: #3b82f6;
    }
  }
}

.module-management-dialog .modal-footer {
  background: #f9fafb !important;
  border-top: 1px solid #e5e7eb !important;
}
</style>

<style lang="scss">
.module-management {
  --permission-bg: linear-gradient(180deg, #f5f7fb 0%, #eef3f9 100%);
  --permission-card: rgba(255, 255, 255, 0.94);
  --permission-border: rgba(15, 23, 42, 0.08);
  --permission-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  background: var(--permission-bg);
  min-height: 100%;
}

.module-management > div:not(.permission-denied-container) {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.module-management .stats-overview .stat-card,
.module-management .modules-section {
  background: var(--permission-card);
  border: 1px solid var(--permission-border);
  box-shadow: var(--permission-shadow);
}

.module-management .stats-overview {
  gap: 16px;
}

.module-management .stats-overview .stat-card {
  border-radius: 22px;
}

.module-management .modules-section {
  border-radius: 24px;
}

.module-management .section-title {
  color: #0f172a;
}

.module-management .module-table thead th {
  background: #eef4ff;
  color: #0f172a;
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
