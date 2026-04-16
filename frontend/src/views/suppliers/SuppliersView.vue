<template>
  <div class="suppliers-view admin-page">
    <!-- 页面头部 - 使用公共组件 -->
    <PageHeader
      icon="fas fa-truck"
      title="供应商管理"
    >
      <template #actions>
        <el-button
          v-if="canCreate"
          type="primary"
          @click="handleCreateSupplier"
        >
          <i class="fas fa-plus"></i>
          新增
        </el-button>
        <ImportExportActions
          :can-export="canExport"
          :export-loading="exportingSuppliers"
          export-label="导出"
          export-loading-label="导出中..."
          export-icon-class="fas fa-file-export"
          export-type="success"
          export-plain
          @export="handleExport"
        />
        <el-button
          type="info"
          :loading="refreshing"
          @click="handleRefresh"
          plain
        >
          <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
          刷新
        </el-button>
      </template>
    </PageHeader>

    <!-- 权限不足提示 - 在权限加载完成后显示 -->
    <PermissionAccessNotice
      v-if="!permissionLoading"
      v-permission-not="'suppliers:view'"
      module-name="供应商管理"
      permission-name="供应商查看权限"
      permission-code="suppliers:view"
      :has-menu-permission-only="hasMenuPermissionOnly"
      :related-permissions="supplierPermissions"
      detail-title="供应商管理相关权限"
    />

    <!-- 权限验证通过后的内容 -->
    <div class="content admin-page-content" v-permission="'suppliers:view'">

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewField('stats_total_suppliers')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-users"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">供应商总数</div>
        </div>
      </div>
      <div v-if="canViewField('stats_active_suppliers')" class="stat-card">
        <div class="stat-icon active">
          <i class="fas fa-check-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ suppliers.filter(s => s.status === 1).length }}</div>
          <div class="stat-label">正常供应商</div>
        </div>
      </div>
      <div v-if="canViewField('stats_inactive_suppliers')" class="stat-card">
        <div class="stat-icon inactive">
          <i class="fas fa-pause-circle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ suppliers.filter(s => s.status === 0).length }}</div>
          <div class="stat-label">禁用供应商</div>
        </div>
      </div>
      <div v-if="canViewField('stats_phone_completion')" class="stat-card">
        <div class="stat-icon">
          <i class="fas fa-phone"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ suppliers.filter(s => s.phone).length }}</div>
          <div class="stat-label">已留电话</div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      @search="searchSuppliers"
      @reset="resetSearch"
    >
      <template #primary>
        <el-input
          v-if="canViewField('name')"
          v-model="searchForm.name"
          placeholder="搜索关键词"
          clearable
          @keyup.enter="searchSuppliers"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <div v-if="canViewField('status')" class="form-group filter-item" data-field="status">
        <el-select
          v-model="searchForm.status"
          placeholder="状态"
          clearable
          @change="searchSuppliers"
        >
          <el-option label="正常" value="1" />
          <el-option label="禁用" value="0" />
        </el-select>
      </div>
    </UnifiedSearchPanel>

    <!-- 数据表格区域 -->
    <div class="table-section admin-panel admin-table-panel">
      <div class="section-title">
        <i class="fas fa-list"></i>
        供应商列表
        <span class="record-count">共 {{ pagination.total }} 条记录</span>
      </div>
      
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th v-if="showSortField" width="40"></th>
              <th v-if="showSortOrderField" width="60">排序</th>
              <th v-if="canViewField('id')" width="80">序号</th>
              <th v-if="canViewField('name')" width="160">供应商名称</th>
              <th v-if="showContactField" width="200">联系人</th>
              <th v-if="showPhoneField" width="160">电话</th>
              <th v-if="showAddressField" width="200">地址</th>
              <th v-if="canViewField('status')" width="200">状态</th>
              <th v-if="showCreatedAtField" width="160">创建时间</th>
              <th v-if="showActionField" width="200">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading" class="loading-row">
              <td :colspan="visibleColumnCount">
                <div class="loading-content">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span>正在加载数据...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="suppliers.length === 0" class="empty-row">
              <td :colspan="visibleColumnCount">
                <div class="empty-content">
                  <i class="fas fa-inbox"></i>
                  <div class="empty-text">
                    <h4>暂无供应商数据</h4>
                    <p>点击上方"新增供应商"按钮添加第一个供应商</p>
                    <el-button size="small" @click="loadSuppliers()" :loading="loading" plain>
                      <template #icon>
                        <i class="fas fa-sync-alt"></i>
                      </template>
                      {{ loading ? '加载中...' : '重新加载' }}
                    </el-button>
                  </div>
                </div>
              </td>
            </tr>
            <template v-else v-for="(supplier, index) in suppliers" :key="supplier.id">
            <tr
              class="data-row"
              :class="{ 'is-dragging': draggingIndex === index, 'is-drag-over': dragOverIndex === index }"
              :draggable="canEdit"
              @click="handleMobileRowTap(supplier.id)"
              @dblclick="toggleMobileActions(supplier.id)"
              @dragstart="canEdit ? handleDragStart(index, $event) : null"
              @dragend="canEdit ? handleDragEnd : null"
              @dragover="canEdit ? handleDragOver(index, $event) : null"
              @dragenter="canEdit ? handleDragEnter(index) : null"
              @dragleave="canEdit ? handleDragLeave : null"
              @drop="canEdit ? handleDrop(index, $event) : null"
            >
              <td v-if="showSortField" class="drag-handle-cell">
                <div class="drag-handle" :class="{ 'disabled': !canEdit }">
                  <i class="fas fa-grip-vertical"></i>
                </div>
              </td>
              <td v-if="showSortOrderField">
                <input
                  v-model.number="supplier.sort_order"
                  type="number"
                  class="sort-order-input"
                  :disabled="!canEdit"
                  min="0"
                  max="9999"
                  @change="canEdit ? handleSortOrderChange(index, supplier.sort_order) : null"
                />
              </td>
              <td v-if="canViewField('id')">
                <span class="id-badge">{{ index + 1 }}</span>
              </td>
              <td v-if="canViewField('name')">
                <div class="supplier-info">
                  <div class="supplier-name">
                    <strong>{{ supplier.name || '未命名供应商' }}</strong>
                    <span v-if="!supplier.name" class="warning-badge">未命名</span>
                  </div>
                  <div v-if="isMobile && canViewField('contact') && supplier.contact" class="mobile-supplier-meta">
                    <i class="fas fa-user"></i>
                    <span>{{ supplier.contact }}</span>
                  </div>
                  <div v-if="isMobile && canViewField('phone') && supplier.phone" class="mobile-supplier-meta">
                    <i class="fas fa-phone"></i>
                    <span>{{ supplier.phone }}</span>
                  </div>
                  <div v-if="isMobile && canViewField('address') && supplier.address" class="mobile-supplier-meta">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>{{ supplier.address }}</span>
                  </div>
                  <div v-if="canViewField('remarks') && supplier.remarks" class="supplier-remarks">
                    <i class="fas fa-comment"></i>
                    {{ supplier.remarks }}
                  </div>
                </div>
              </td>
              <td v-if="showContactField">
                <div class="contact-info">
                  <span v-if="supplier.contact" class="contact-name">
                    <i class="fas fa-user"></i>
                    {{ supplier.contact }}
                  </span>
                  <span v-else class="no-data">-</span>
                </div>
              </td>
              <td v-if="showPhoneField">
                <div class="phone-info">
                  <span v-if="supplier.phone" class="phone-number">
                    <i class="fas fa-phone"></i>
                    {{ supplier.phone }}
                  </span>
                  <span v-else class="no-data">-</span>
                </div>
              </td>
              <td v-if="showAddressField">
                <div class="address-info">
                  <span v-if="supplier.address" class="address-text" :title="supplier.address">
                    <i class="fas fa-map-marker-alt"></i>
                    {{ supplier.address.length > 20 ? supplier.address.substring(0, 20) + '...' : supplier.address }}
                  </span>
                  <span v-else class="no-data">-</span>
                </div>
              </td>
              <td v-if="canViewField('status')">
                <span :class="['status-badge', supplier.status ? 'status-active' : 'status-inactive']">
                  <i :class="supplier.status ? 'fas fa-check' : 'fas fa-times'"></i>
                  {{ supplier.status ? '正常' : '禁用' }}
                </span>
              </td>
              <td v-if="showCreatedAtField">
                <div class="time-info">
                  <i class="fas fa-clock"></i>
                  {{ formatDate(supplier.created_at) }}
                </div>
              </td>
              <td v-if="showActionField" class="actions">
                <el-button type="success" size="small" @click="viewSupplier(supplier)">
                  <template #icon>
                    <i class="fas fa-eye"></i>
                  </template>
                  查看
                </el-button>
                <el-button
                  v-if="canEdit"
                  v-permission="'suppliers:edit'"
                  type="primary"
                  size="small"
                  @click="editSupplier(supplier)"
                >
                  <template #icon>
                    <i class="fas fa-edit"></i>
                  </template>
                  编辑
                </el-button>
                <el-button
                  v-if="canDelete"
                  v-permission="'suppliers:delete'"
                  type="danger"
                  size="small"
                  @click="deleteSupplier(supplier)"
                >
                  <template #icon>
                    <i class="fas fa-trash"></i>
                  </template>
                  删除
                </el-button>
              </td>
            </tr>
            <tr
              v-if="isMobile && mobileActionRowId === supplier.id"
              class="mobile-action-row"
            >
              <td :colspan="visibleColumnCount">
                <div class="mobile-row-actions">
                  <el-button
                    type="success"
                    size="small"
                    class="mobile-action-btn mobile-action-btn-view"
                    @click.stop="viewSupplier(supplier)"
                  >
                    <template #icon>
                      <i class="fas fa-eye"></i>
                    </template>
                    查看
                  </el-button>
                  <el-button
                    v-if="canEdit"
                    v-permission="'suppliers:edit'"
                    type="primary"
                    size="small"
                    class="mobile-action-btn mobile-action-btn-edit"
                    @click.stop="editSupplier(supplier)"
                  >
                    <template #icon>
                      <i class="fas fa-edit"></i>
                    </template>
                    编辑
                  </el-button>
                  <el-button
                    v-if="canDelete"
                    v-permission="'suppliers:delete'"
                    type="danger"
                    size="small"
                    class="mobile-action-btn mobile-action-btn-delete"
                    @click.stop="deleteSupplier(supplier)"
                  >
                    <template #icon>
                      <i class="fas fa-trash"></i>
                    </template>
                    删除
                  </el-button>
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- 分页组件 -->
      <Pagination
        v-if="pagination.total > 0"
        v-model:current="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        :show-total="true"
        :show-range="true"
        :show-page-sizes="true"
        :show-quick-jumper="true"
        :disabled="loading"
        @change="handlePaginationChange"
      />
    </div>

    <!-- 创建/编辑模态框 -->
    <MobileDialog
      v-model="dialogVisible"
      :title="isEditMode ? '编辑供应商' : '新增供应商'"
      width="600px"
      dialog-class="suppliers-form-dialog crud-dialog-md"
      :close-on-click-modal="false"
      :show-default-footer="false"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item v-if="canViewField('name')" label="供应商名称" required>
          <el-input
            v-model="formData.name"
            placeholder="请输入供应商名称"
            clearable
            maxlength="100"
            show-word-limit
            :disabled="!canEditField('name')"
          />
        </el-form-item>

        <el-form-item v-if="canViewField('contact')" label="联系人">
          <el-input
            v-model="formData.contact"
            placeholder="请输入联系人姓名"
            clearable
            maxlength="50"
            show-word-limit
            :disabled="!canEditField('contact')"
          />
        </el-form-item>

        <el-form-item v-if="canViewField('phone')" label="电话">
          <el-input
            v-model="formData.phone"
            placeholder="请输入联系电话"
            clearable
            maxlength="20"
            show-word-limit
            :disabled="!canEditField('phone')"
          />
        </el-form-item>

        <el-form-item v-if="canViewField('address')" label="地址">
          <el-input
            v-model="formData.address"
            type="textarea"
            placeholder="请输入地址"
            :rows="3"
            maxlength="200"
            show-word-limit
            :disabled="!canEditField('address')"
          />
        </el-form-item>

        <el-form-item v-if="canViewField('bank_info')" label="银行信息">
          <el-input
            v-model="formData.bank_info"
            type="textarea"
            placeholder="请输入银行信息"
            :rows="3"
            maxlength="200"
            show-word-limit
            :disabled="!canEditField('bank_info')"
          />
        </el-form-item>

        <el-form-item v-if="canViewField('tax_number')" label="税号">
          <el-input
            v-model="formData.tax_number"
            placeholder="请输入税号"
            clearable
            maxlength="50"
            show-word-limit
            :disabled="!canEditField('tax_number')"
          />
        </el-form-item>

        <el-form-item v-if="canViewField('sort_order')" label="排序">
          <el-input-number
            v-model="formData.sort_order"
            :min="0"
            :max="9999"
            placeholder="请输入排序值"
            style="width: 100%"
            :disabled="!canEditField('sort_order')"
          />
        </el-form-item>

        <el-form-item v-if="canViewField('status')" label="状态">
          <el-radio-group v-model="formData.status" :disabled="!canEditField('status')">
            <el-radio :value="1">正常</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="canViewField('remarks')" label="备注">
          <el-input
            v-model="formData.remarks"
            type="textarea"
            placeholder="请输入备注信息"
            :rows="3"
            maxlength="500"
            show-word-limit
            :disabled="!canEditField('remarks')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button type="default" @click="attemptCloseModal">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          {{ isEditMode ? '更新' : '创建' }}
        </el-button>
      </template>
    </MobileDialog>

    <!-- 查看详情模态框 -->
    <MobileDialog
      v-model="showDetailModal"
      title="供应商详情"
      width="800px"
      dialog-class="suppliers-detail-dialog crud-dialog-lg"
      :close-on-click-modal="false"
      :show-default-footer="false"
    >
      <div v-if="detailLoading" class="loading-content">
        <i class="fas fa-spinner fa-spin"></i>
        <span>正在加载数据...</span>
      </div>
      <div v-else-if="supplierDetail" class="supplier-detail-view">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h4>基本信息</h4>
          <div v-if="canViewField('name')" class="detail-row">
            <span class="label">供应商名称：</span>
            <span class="value">{{ supplierDetail.name }}</span>
          </div>
          <div v-if="canViewField('contact')" class="detail-row">
            <span class="label">联系人：</span>
            <span class="value">{{ supplierDetail.contact || '-' }}</span>
          </div>
          <div v-if="canViewField('phone')" class="detail-row">
            <span class="label">联系电话：</span>
            <span class="value">{{ supplierDetail.phone || '-' }}</span>
          </div>
          <div v-if="canViewField('status')" class="detail-row">
            <span class="label">状态：</span>
            <span class="value">
              <span class="status-badge" :class="supplierDetail.status ? 'active' : 'inactive'">
                <i :class="supplierDetail.status ? 'fas fa-check' : 'fas fa-times'"></i>
                {{ supplierDetail.status ? '正常' : '禁用' }}
              </span>
            </span>
          </div>
          <div v-if="canViewField('address')" class="detail-row">
            <span class="label">地址：</span>
            <span class="value">{{ supplierDetail.address || '-' }}</span>
          </div>
          <div v-if="canViewField('bank_info')" class="detail-row">
            <span class="label">银行信息：</span>
            <span class="value">{{ supplierDetail.bank_info || '-' }}</span>
          </div>
          <div v-if="canViewField('tax_number')" class="detail-row">
            <span class="label">税号：</span>
            <span class="value">{{ supplierDetail.tax_number || '-' }}</span>
          </div>
          <div v-if="canViewField('remarks')" class="detail-row">
            <span class="label">备注：</span>
            <span class="value">{{ supplierDetail.remarks || '-' }}</span>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="detail-section">
          <h4>商品统计</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-number">{{ supplierDetail.stats.accessories_count }}</div>
              <div class="stat-label">配件数量</div>
              <div class="stat-amount">¥{{ supplierDetail.stats.accessories_total_cost.toFixed(2) }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ supplierDetail.stats.phones_count }}</div>
              <div class="stat-label">手机数量</div>
              <div class="stat-amount">¥{{ supplierDetail.stats.phones_total_cost.toFixed(2) }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">{{ supplierDetail.stats.accessories_count + supplierDetail.stats.phones_count }}</div>
              <div class="stat-label">商品总数</div>
              <div class="stat-amount">¥{{ (supplierDetail.stats.accessories_total_cost + supplierDetail.stats.phones_total_cost).toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <!-- 时间信息 -->
        <div v-if="canViewField('created_at')" class="detail-section">
          <h4>时间信息</h4>
          <div class="detail-row">
            <span class="label">创建时间：</span>
            <span class="value">{{ formatDate(supplierDetail.created_at) }}</span>
          </div>
          <div class="detail-row" v-if="supplierDetail.updated_at">
            <span class="label">更新时间：</span>
            <span class="value">{{ formatDate(supplierDetail.updated_at) }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button
          v-if="canEdit && supplierDetail"
          v-permission="'suppliers:edit'"
          type="primary"
          @click="editSupplier(supplierDetail!)"
        >
          <template #icon>
            <i class="fas fa-edit"></i>
          </template>
          编辑
        </el-button>
        <el-button type="default" @click="closeDetailModal">关闭</el-button>
      </template>
    </MobileDialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import unifiedApi from '@/utils/unified-api'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { useLoadingState } from '@/composables'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { usePermissionModuleInfo } from '@/composables/usePermissionModuleInfo'
import { useAuthStore } from '@/stores/auth'
import { normalizePermissionList } from '@/utils/permissionList'
import PermissionAccessNotice from '@/components/base/PermissionAccessNotice.vue'
import Pagination from '../../components/Pagination.vue'
import { PageHeader } from '@/components/base'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import DraggableRow from '../../components/DraggableRow.vue'
import { usePermissionToast } from '@/utils/permissionToastSimple'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { useMobile } from '@/composables/mobile'
import type { Supplier } from '@/types/system'
import { logger } from '@/utils/logger'

// 供应商详情扩展类型
interface SupplierDetail extends Supplier {
  accounts: SupplierAccount[]
  stats: {
    accessories_count: number
    accessories_total_cost: number
    phones_count: number
    phones_total_cost: number
  }
}

// 供应商账户类型
interface SupplierAccount {
  id: number
  type: 'payment' | 'refund' | 'adjust'
  amount: number
  balance_before: number
  balance_after: number
  remarks: string
  related_inventory_ids: string
  operator_name: string
  created_at: string
}

// 获取路由实例
const router = useRouter()
// 使用统一的 composable
const { success, error, warning, info, handleApiError, confirm } = useNotification()
const { canView, canCreate, canEdit, canDelete, canExport, handleNoPermission } = usePagePermissions('suppliers')
const { showViewDenied, showEditDenied, showDeleteDenied, showCreateDenied } = usePermissionToast()
const { refreshing, refresh } = useRefreshData()
const { exportFile, buildDateFilename } = useImportExport()
const { init: initFieldPermissions } = fieldPermissions
const { isMobile } = useMobile()

const supplierFieldMap: Record<string, string> = {
  stats_total_suppliers: 'stats.total_suppliers',
  stats_active_suppliers: 'stats.active_suppliers',
  stats_inactive_suppliers: 'stats.inactive_suppliers',
  stats_phone_completion: 'stats.phone_completion',
  id: 'supplier.id',
  name: 'supplier.name',
  contact: 'supplier.contact_person',
  phone: 'supplier.phone',
  address: 'supplier.address',
  status: 'supplier.status',
  sort_order: 'supplier.sort_order',
  created_at: 'supplier.created_at',
  bank_info: 'supplier.bank_info',
  tax_number: 'supplier.tax_number',
  remarks: 'supplier.remarks',
  actions: 'system_info.operations'
}

const getFieldKey = (fieldName: string) => supplierFieldMap[fieldName] || fieldName

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('suppliers_suppliersview', getFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('suppliers_suppliersview', getFieldKey(fieldName))
}

const showSortField = computed(() => canViewField('sort_order') && !isMobile.value)
const showSortOrderField = computed(() => canViewField('sort_order') && !isMobile.value)
const showContactField = computed(() => canViewField('contact') && !isMobile.value)
const showPhoneField = computed(() => canViewField('phone') && !isMobile.value)
const showAddressField = computed(() => canViewField('address') && !isMobile.value)
const showCreatedAtField = computed(() => canViewField('created_at') && !isMobile.value)
const showActionField = computed(() => canViewField('actions') && (canEdit.value || canDelete.value) && !isMobile.value)
const showStatsCards = computed(() => (
  canViewField('stats_total_suppliers') ||
  canViewField('stats_active_suppliers') ||
  canViewField('stats_inactive_suppliers') ||
  canViewField('stats_phone_completion')
))
const visibleColumnCount = computed(() => {
  return [
    showSortField.value,
    showSortOrderField.value,
    canViewField('id'),
    canViewField('name'),
    showContactField.value,
    showPhoneField.value,
    showAddressField.value,
    canViewField('status'),
    showCreatedAtField.value,
    showActionField.value
  ].filter(Boolean).length || 1
})
const authStore = useAuthStore()

const normalizedSupplierPermissions = computed<string[]>(() => {
  return normalizePermissionList(authStore.permissions)
})

const { hasMenuPermissionOnly, modulePermissions: supplierPermissions } = usePermissionModuleInfo(
  normalizedSupplierPermissions,
  'suppliers_suppliersview'
)

const ensureSupplierPermissionsLoaded = async (): Promise<void> => {
  if (authStore.user && normalizedSupplierPermissions.value.length > 0) {
    return
  }

  if (!authStore.user) {
    try {
      await authStore.fetchUserInfo()
    } catch (error) {
      logger.warn('加载供应商页面用户信息失败，但继续执行:', error)
    }
  }

  if (normalizedSupplierPermissions.value.length === 0) {
    try {
      await authStore.forceRefreshPermissions()
    } catch (error) {
      logger.warn('刷新供应商页面权限失败，但继续执行:', error)
    }
  }
}

// 响应式数据
const { loading } = useLoadingState()
const permissionLoading = ref(false)

// 搜索相关状态
const searchExpanded = ref(false)
const submitting = ref(false)
const detailLoading = ref(false)
const savingOrder = ref(false)
const exportingSuppliers = ref(false)
const suppliers = ref<Supplier[]>([])
const supplierDetail = ref<SupplierDetail | null>(null)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDetailModal = ref(false)
const currentEditingId = ref<number | null>(null)
const mobileActionRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

// 拖拽排序状态
const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// 搜索表单
const searchForm = ref({
  name: '',
  status: ''
})

// 表单数据
const formData = ref({
  name: '',
  contact: '',
  phone: '',
  address: '',
  bank_info: '',
  tax_number: '',
  status: 1,
  sort_order: 0,
  remarks: ''
})

// 分页数据
const pagination = ref({
  page: 1,
  limit: 100,
  total: 0,
  pages: 0
})

// 模态框显示状态
const dialogVisible = computed({
  get: () => showCreateModal.value || showEditModal.value,
  set: (value) => {
    if (!value) {
      attemptCloseModal()
    }
  }
})

// 是否为编辑模式
const isEditMode = computed(() => showEditModal.value && currentEditingId.value !== null)

// 方法
const loadSuppliers = async (bustCache: boolean = false, silentError: boolean = false, showLoadingState: boolean = true) => {
  if (!canView.value) {
    if (!silentError) {
      showViewDenied('供应商管理', 'suppliers:view')
    }
    suppliers.value = []
    return
  }

  if (showLoadingState) {
    loading.value = true
  }
  try {
    const params: any = {
      page: pagination.value.page,
      limit: pagination.value.limit
    }

    // 添加搜索参数
    if (searchForm.value.name) params.name = searchForm.value.name
    if (searchForm.value.status !== '') params.status = searchForm.value.status

    // 如果需要清除缓存
    if (bustCache) {
      params._t = Date.now()
    }

    const response = await unifiedApi.get('/suppliers', { params })

    if (response.success) {
      suppliers.value = response.data || []
      // 分页信息在响应顶层，不能从 response.data 里取
      const apiPagination = response.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 }
      pagination.value = {
        page: Number(apiPagination.page) || 1,
        limit: Number(apiPagination.limit) || pagination.value.limit || 100,
        total: Number(apiPagination.total) || 0,
        pages: Number((apiPagination as any).pages || (apiPagination as any).totalPages) || 0
      }

      // 按 sort_order 排序，确保序号和排序值一致
      suppliers.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    } else {
      logger.error('API返回失败:', response.message)
      suppliers.value = []
      pagination.value = { page: 1, limit: 10, total: 0, pages: 0 }
      if (!silentError) {
        error(response.message || '获取供应商列表失败')
      }
    }
  } catch (err: any) {
    logger.error('获取供应商列表失败:', err)
    suppliers.value = []
    pagination.value = { page: 1, limit: 10, total: 0, pages: 0 }

    // 静默处理页面卸载导致的取消错误
    if (err.name === 'CanceledError') {
      return
    }

    if (!silentError) {
      // 使用统一的错误处理
      handleApiError(error, '获取供应商列表失败')
    }
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const searchSuppliers = () => {
  pagination.value.page = 1
  loadSuppliers()
}

const resetSearch = () => {
  searchForm.value = {
    name: '',
    status: ''
  }
  pagination.value.page = 1
  loadSuppliers()
}

const changePage = (page: number) => {
  pagination.value.page = page
  loadSuppliers()
}

// 新的分页变化处理方法
const handlePaginationChange = (page: number, pageSize: number) => {
  pagination.value.page = page
  pagination.value.limit = pageSize
  // 重置到第一页（当页面大小改变时）
  if (pageSize !== pagination.value.limit) {
    pagination.value.page = 1
  }
  loadSuppliers()
}

// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await loadSuppliers(true, false, false)
  })
  success('数据刷新成功', { duration: 2000 })
}

const handleCreateSupplier = () => {
  // 检查创建权限
  if (!canCreate.value) {
    showCreateDenied('供应商管理', 'suppliers:create')
    return
  }

  // 重置表单数据
  formData.value = {
    name: '',
    contact: '',
    phone: '',
    address: '',
    bank_info: '',
    tax_number: '',
    status: 1,
    sort_order: 0,
    remarks: ''
  }

  // 确保编辑ID为空
  currentEditingId.value = null

  // 显示创建模态框
  showCreateModal.value = true
}

const viewSupplier = async (supplier: Supplier) => {
  if (!canView.value) {
    showViewDenied('供应商管理', 'suppliers:view')
    return
  }

  detailLoading.value = true
  showDetailModal.value = true
  
  try {
    const response = await unifiedApi.get(`/suppliers/${supplier.id}`)
    
    if (response.success) {
      supplierDetail.value = response.data
    } else {
      error(response.message || '获取供应商详情失败')
      closeDetailModal()
    }
  } catch (err) {
    logger.error('获取供应商详情失败:', err)
    handleApiError(err, '获取供应商详情失败')
    closeDetailModal()
  } finally {
    detailLoading.value = false
  }
}

const toggleMobileActions = (id: number) => {
  if (!isMobile.value) return
  mobileActionRowId.value = mobileActionRowId.value === id ? null : id
}

const handleMobileRowTap = (id: number) => {
  if (!isMobile.value) return

  const now = Date.now()
  if (lastTappedRowId.value === id && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(id)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = id
  lastTapTimestamp.value = now
}

const editSupplier = (supplier: Supplier | SupplierDetail) => {
  // 先检查编辑权限
  if (!canEdit.value) {
    showEditDenied('供应商管理', 'suppliers:edit')
    return
  }

  // 保存当前编辑的供应商ID
  currentEditingId.value = supplier.id

  formData.value = {
    name: supplier.name,
    contact: supplier.contact,
    phone: supplier.phone,
    address: supplier.address,
    bank_info: supplier.bank_info,
    tax_number: supplier.tax_number,
    status: typeof supplier.status === 'number' ? supplier.status : (supplier.status === 'active' ? 1 : 0),
    sort_order: supplier.sort_order || 0,
    remarks: supplier.remarks
  }

  if (showDetailModal.value) {
    closeDetailModal()
  }

  showEditModal.value = true
}

const deleteSupplier = async (supplier: Supplier) => {
  // 先检查删除权限
  if (!canDelete.value) {
    showDeleteDenied('供应商管理', 'suppliers:delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除供应商"${supplier.name}"吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )
  } catch {
    return
  }

  try {
    const response = await unifiedApi.delete(`/suppliers/${supplier.id}`, { showError: false })

    if (response.success) {
      success('供应商删除成功')
      loadSuppliers()
    } else {
      error(response.message || '删除供应商失败')
    }
  } catch (err: any) {
    logger.error('删除供应商失败:', err)
    handleApiError(err, '删除供应商失败')
  }
}

const submitForm = async () => {
  // 权限检查
  if (showCreateModal.value && !canCreate.value) {
    showCreateDenied('供应商管理', 'suppliers:create')
    return
  }

  if (showEditModal.value && !canEdit.value) {
    showEditDenied('供应商管理', 'suppliers:edit')
    return
  }

  submitting.value = true

  try {
    let response

    if (showCreateModal.value) {
      response = await unifiedApi.post('/suppliers', formData.value, { showError: false })
      if (response.success) {
        success('供应商创建成功')
        closeModal()
        loadSuppliers()
      } else {
        error(response.message || '创建供应商失败')
      }
    } else {
      // 使用保存的ID而不是通过名称查找
      if (!currentEditingId.value) {
        error('无法获取供应商ID')
        submitting.value = false
        return
      }
      response = await unifiedApi.put(`/suppliers/${currentEditingId.value}`, formData.value, { showError: false })
      if (response.success) {
        success('供应商更新成功')
        closeModal()
        loadSuppliers()
      } else {
        error(response.message || '更新供应商失败')
      }
    }
  } catch (err: any) {
    logger.error('提交表单失败:', err)
    handleApiError(err, showCreateModal.value ? '创建供应商失败' : '更新供应商失败')
  } finally {
    submitting.value = false
  }
}

const hasUnsavedChanges = (): boolean => {
  if (!showCreateModal.value && !showEditModal.value) return false

  const currentForm = formData.value

  if (showEditModal.value && currentEditingId.value) {
    const originalSupplier = suppliers.value.find(s => s.id === currentEditingId.value)
    if (originalSupplier) {
      return (
        currentForm.name !== originalSupplier.name ||
        currentForm.contact !== originalSupplier.contact ||
        currentForm.phone !== originalSupplier.phone ||
        currentForm.address !== originalSupplier.address ||
        currentForm.bank_info !== originalSupplier.bank_info ||
        currentForm.tax_number !== originalSupplier.tax_number ||
        currentForm.status !== originalSupplier.status ||
        currentForm.remarks !== originalSupplier.remarks
      )
    }
  }

  // For create modal, check if any field has been filled
  return (
    currentForm.name !== '' ||
    currentForm.contact !== '' ||
    currentForm.phone !== '' ||
    currentForm.address !== '' ||
    currentForm.bank_info !== '' ||
    currentForm.tax_number !== '' ||
    currentForm.status !== 1 ||
    currentForm.remarks !== ''
  )
}

const attemptCloseModal = async () => {
  if (hasUnsavedChanges()) {
    const confirmed = await confirm('您有未保存的更改，确定要关闭吗？', '确认关闭', {
      confirmButtonText: '确定关闭',
      cancelButtonText: '取消',
      type: 'warning'
    })
    if (confirmed) {
      closeModal()
    }
  } else {
    closeModal()
  }
}

const closeModal = () => {
  showCreateModal.value = false
  showEditModal.value = false
  currentEditingId.value = null
  formData.value = {
    name: '',
    contact: '',
    phone: '',
    address: '',
    bank_info: '',
    tax_number: '',
    status: 1,
    sort_order: 0,
    remarks: ''
  }
}

const closeDetailModal = () => {
  showDetailModal.value = false
  supplierDetail.value = null
}

const formatDate = (dateString: string) => {
  if (!dateString) return '-'
  return TimeUtil.format(dateString, TIME_FORMATS.DATETIME)
}

// 拖拽排序方法
const handleDragStart = (index: number, event: DragEvent) => {
  draggingIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragEnd = () => {
  draggingIndex.value = null
  dragOverIndex.value = null
}

const handleDragOver = (index: number, event: DragEvent) => {
  event.preventDefault()
  if (draggingIndex.value === null || draggingIndex.value === index) return
  dragOverIndex.value = index
}

const handleDragEnter = (index: number) => {
  if (draggingIndex.value === null || draggingIndex.value === index) return
  dragOverIndex.value = index
}

const handleDragLeave = () => {
  // 不清除 dragOverIndex，避免闪烁
}

const handleDrop = async (dropIndex: number, event: DragEvent) => {
  event.preventDefault()
  const dragIndex = draggingIndex.value
  if (dragIndex === null || dragIndex === dropIndex) {
    handleDragEnd()
    return
  }

  // 重新排列数组
  const newSuppliers = [...suppliers.value]
  const [movedItem] = newSuppliers.splice(dragIndex, 1)
  newSuppliers.splice(dropIndex, 0, movedItem)

  // 更新 sort_order 值
  newSuppliers.forEach((item, index) => {
    item.sort_order = index
  })

  suppliers.value = newSuppliers

  // 自动保存排序
  await saveSortOrder()

  // 保存后重新加载数据以确保与数据库同步
  await loadSuppliers(true, false, false)

  handleDragEnd()
}

// 保存排序到服务器
const saveSortOrder = async () => {
  if (savingOrder.value) return
  if (!canEdit.value) {
    showEditDenied('供应商管理', 'suppliers:edit')
    return
  }

  savingOrder.value = true
  try {
    const items = suppliers.value.map((item, index) => ({
      id: item.id,
      sort_order: index
    }))

    const response = await unifiedApi.put('/suppliers/batch/reorder', { items })
    if (response.success) {
      success('排序已保存')
    }
  } catch (err) {
    handleApiErrorWithPermission(err, '保存排序失败', '供应商管理', 'edit')
  } finally {
    savingOrder.value = false
  }
}

// 手动修改排序值
const handleSortOrderChange = async (index: number, value: number) => {
  suppliers.value[index].sort_order = value
  // 按新的 sort_order 重新排序
  suppliers.value.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  await saveSortOrder()
}

const getAccountTypeText = (type: string) => {
  const typeMap: Record<string, string> = {
    payment: '付款',
    refund: '退款',
    adjust: '调整'
  }
  return typeMap[type] || type
}

const getAmountClass = (type: string) => {
  return type === 'payment' ? 'amount-negative' : 'amount-positive'
}

const getAmountPrefix = (type: string) => {
  return type === 'payment' ? '-' : '+'
}

// 导出功能
const handleExport = async () => {
  await exportFile({
    url: '/suppliers/export',
    filename: buildDateFilename('供应商管理', 'csv'),
    params: {
      name: searchForm.value.name,
      status: searchForm.value.status
    },
    allowed: canExport,
    loading: exportingSuppliers,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '供应商数据导出成功',
    errorMessage: '导出供应商数据失败'
  })
}

// 增强的操作函数 - 带权限验证
const deleteSupplierWithPermission = async (supplier: Supplier) => {
  if (!canDelete.value) {
    error('权限不足：您没有删除供应商的权限')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除供应商"${supplier.name}"吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )
  } catch {
    return
  }

  try {
    const response = await unifiedApi.delete(`/suppliers/${supplier.id}`, { showError: false })

    if (response.success) {
      success('供应商删除成功')
      await loadSuppliers()
    } else {
      error(response.message || '删除供应商失败')
    }
  } catch (err: any) {
    logger.error('删除供应商失败:', err)
    handleApiError(err, '删除供应商失败')
  }
}

// 增强的提交函数 - 带权限验证
const submitFormWithPermission = async () => {
  const action = showCreateModal.value ? 'create' : 'edit'

  const hasPermission = action === 'create' ? canCreate.value : canEdit.value
  if (!hasPermission) {
    error(`权限不足：您没有${action === 'create' ? '创建' : '编辑'}供应商的权限`)
    return
  }

  submitting.value = true

  try {
    let response

    if (showCreateModal.value) {
      response = await unifiedApi.post('/suppliers', formData.value, { showError: false })
      if (response.success) {
        success('供应商创建成功')
        closeModal()
        await loadSuppliers()
      } else {
        error(response.message || '创建供应商失败')
      }
    } else {
      if (!currentEditingId.value) {
        error('无法获取供应商ID')
        submitting.value = false
        return
      }
      response = await unifiedApi.put(`/suppliers/${currentEditingId.value}`, formData.value, { showError: false })
      if (response.success) {
        success('供应商更新成功')
        closeModal()
        await loadSuppliers()
      } else {
        error(response.message || '更新供应商失败')
      }
    }
  } catch (err: any) {
    logger.error('提交表单失败:', err)
    handleApiError(err, `${action === 'create' ? '创建' : '更新'}供应商失败`)
  } finally {
    submitting.value = false
  }
}

let supplierReloadInterval: number | null = null

const handlePermissionsUpdated = async () => {
  permissionLoading.value = true
  try {
    await ensureSupplierPermissionsLoaded()
  } catch (refreshError) {
    logger.error('刷新供应商页面权限失败:', refreshError)
  } finally {
    permissionLoading.value = false
  }

  if (!canView.value) {
    suppliers.value = []
    supplierDetail.value = null
    return
  }

  await loadSuppliers(true, true, false)
}

// 生命周期
onMounted(async () => {
  window.addEventListener('tf2025:permissions:updated', handlePermissionsUpdated)

  permissionLoading.value = true
  try {
    await ensureSupplierPermissionsLoaded()
  } catch (error) {
    logger.error('初始化供应商页面权限失败:', error)
  } finally {
    permissionLoading.value = false
  }

  // 权限检查
  if (!canView.value) {
    return
  }

  await initFieldPermissions()
  await loadSuppliers()
})

// 监听组件可见性变化
watch(() => {
  // 检查组件是否在DOM中可见
  const element = document.getElementsByClassName('suppliers-view')[0]
  return element && element.getBoundingClientRect().height > 0
}, (isVisible) => {
  if (isVisible && canView.value) {
    loadSuppliers()
  }
})

// 添加定时器来定期检查组件是否需要重新加载数据
const checkAndReloadData = () => {
  if (!canView.value) {
    return
  }

  const element = document.getElementsByClassName('suppliers-view')[0]
  if (element && element.getBoundingClientRect().height > 0) {
    // 检查是否有数据，如果没有则重新加载
    if (suppliers.value.length === 0 && !loading.value) {
      loadSuppliers()
    }
  }
}

// 每5秒检查一次
supplierReloadInterval = window.setInterval(checkAndReloadData, 5000)

onUnmounted(() => {
  if (supplierReloadInterval) {
    clearInterval(supplierReloadInterval)
  }

  window.removeEventListener('tf2025:permissions:updated', handlePermissionsUpdated)
})


</script>

<style scoped>
.suppliers-view {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;
}

/* 权限拒绝页面样式 - 与型号页面保持一致的背景可见样式 */
.permission-denied {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: #f8f9fa;
  border-radius: 12px;
  margin: 20px 0;
}

.permission-denied-wrapper {
  width: 100%;
  max-width: 600px;
}

.permission-denied-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  overflow: hidden;
  border: 1px solid #e8ecef;
}

.permission-icon {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 30px;
  text-align: center;
  font-size: 48px;
}

.permission-icon i {
  font-size: 48px;
  opacity: 0.9;
}

.permission-content {
  padding: 40px 30px;
  text-align: center;
}

.permission-content h2 {
  color: #2c3e50;
  margin: 0 0 15px 0;
  font-size: 28px;
  font-weight: 600;
}

.permission-message {
  color: #6c757d;
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 30px;
}

.permission-status {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 30px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 25px;
  font-size: 14px;
  font-weight: 500;
}

.status-item.has-menu {
  background: #d4edda;
  color: #155724;
}

.status-item.missing-view {
  background: #f8d7da;
  color: #721c24;
}

.permission-info {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
  text-align: left;
  border-left: 4px solid #667eea;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item label {
  font-weight: 600;
  color: #495057;
  margin-right: 10px;
  min-width: 80px;
}

.permission-name {
  color: #2c3e50;
  font-weight: 500;
}

.permission-code {
  background: #e9ecef;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #495057;
}

.permission-suggestion {
  background: #e7f3ff;
  border: 1px solid #b3d9ff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.permission-suggestion i {
  color: #0066cc;
  font-size: 18px;
  margin-top: 2px;
}

.permission-suggestion p {
  margin: 0;
  color: #0066cc;
  font-size: 14px;
  line-height: 1.6;
}

.permission-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 30px;
}

.permission-details {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  text-align: left;
  border-top: 1px solid #e8ecef;
}

.permission-details h4 {
  margin: 0 0 15px 0;
  color: #495057;
  font-size: 16px;
  font-weight: 600;
}

.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.permission-tag {
  background: #e9ecef;
  color: #495057;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Monaco', 'Consolas', monospace;
}

.permission-tag.current-module {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.permission-actions .btn {
  min-width: 140px;
}

/* 统计卡片样式 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
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
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  border: 1px solid #e8ecef;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.12);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.stat-icon.active {
  background: linear-gradient(135deg, #28a745, #20c997);
}

.stat-icon.inactive {
  background: linear-gradient(135deg, #dc3545, #fd7e14);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
  font-weight: 500;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f8f9fa;
}

.section-title i {
  color: #667eea;
}

.record-count {
  margin-left: auto;
  font-size: 14px;
  color: #6c757d;
  font-weight: 400;
}

/* 按钮样式 */
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline-secondary {
  background: white;
  color: #6c757d;
  border: 2px solid #e8ecef;
}

.btn-outline-secondary:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #6c757d;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-info:hover {
  background: #138496;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-warning:hover {
  background: #e0a800;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

/* 表格区域样式 */
.table-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border: 1px solid #e8ecef;
}

.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0;
  background: white;
}

.table th {
  background: linear-gradient(135deg, #495057 0%, #343a40 100%);
  color: white;
  padding: 12px 10px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  border-right: 1px solid #dee2e6;
  border-bottom: 2px solid #dee2e6;
  position: relative;
  white-space: nowrap;
}

.table th:last-child {
  border-right: none;
}

.table td {
  padding: 6px 6px;
  font-size: 14px;
  border-right: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
  vertical-align: middle;
  text-align: center;
  color: #2c3e50;
  font-weight: 500;
}

.table td:last-child {
  border-right: none;
}

.table tbody tr {
  transition: all 0.2s ease;
  position: relative;
}

.table tbody tr:nth-child(even) {
  background: #f8f9fa;
}

.table tbody tr:hover {
  background: #e3f2fd;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.table tbody tr:hover td {
  border-bottom-color: #dee2e6;
}

.table tbody tr.is-dragging {
  opacity: 0.5;
  background: #eff6ff !important;
}

.table tbody tr.is-drag-over {
  background: #f0f9ff !important;
  border-top: 2px solid #3b82f6;
}

/* 拖拽手柄 */
.drag-handle-cell {
  padding: 8px 4px !important;
  text-align: center;
  cursor: move;
  user-select: none;
}

.drag-handle {
  color: #9ca3af;
  font-size: 16px;
  cursor: grab;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    color: #3b82f6;
    background: #eff6ff;
  }

  &:active {
    cursor: grabbing;
  }

  &.disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;

    &:hover {
      color: #9ca3af;
      background: transparent;
    }
  }
}

/* 排序输入框 */
.sort-order-input {
  width: 50px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  outline: none;
  transition: all 0.2s;

  &:focus:not(:disabled) {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  &:hover:not(:disabled) {
    border-color: #9ca3af;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: #f3f4f6;
  }
}

/* 表格内容样式 */
.sort-badge {
  background: #f3f4f6;
  color: #6b7280;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
  min-width: 32px;
  text-align: center;
}

.id-badge {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  display: inline-block;
}

.supplier-info {
  max-width: 200px;
  text-align: center;
  margin: 0 auto;
}

.supplier-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 14px;
}

.warning-badge {
  background: #ffc107;
  color: #212529;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.supplier-remarks {
  font-size: 13px;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.contact-info, .phone-info, .address-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.contact-name, .phone-number, .address-text {
  font-size: 14px;
  color: #495057;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.no-data {
  color: #adb5bd;
  font-style: italic;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-inactive {
  background: #f8d7da;
  color: #721c24;
}

.time-info {
  font-size: 13px;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.action-buttons {
  display: flex;
  gap: 6px;
}

/* 操作按钮样式 - 参考店铺管理页面 */
.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
  min-width: 60px;
  justify-content: center;
}

.btn-action i {
  font-size: 12px;
}

.btn-view {
  background: #28a745;
  color: white;
}

.btn-view:hover {
  background: #218838;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.btn-edit {
  background: #007bff;
  color: white;
}

.btn-edit:hover {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.btn-delete:hover {
  background: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
}

.btn-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 加载和空状态样式 */
.loading-row td {
  padding: 40px 12px;
  text-align: center;
}

.loading-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6c757d;
  font-size: 16px;
}

.empty-row td {
  padding: 60px 12px;
  text-align: center;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #6c757d;
}

.empty-content i {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text h4 {
  margin: 0 0 8px 0;
  color: #495057;
}

.empty-text p {
  margin: 0;
  font-size: 14px;
}

/* 分页样式 */
.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e8ecef;
}

.pagination-info {
  color: #6c757d;
  font-size: 14px;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .suppliers-view {
    padding: 16px;
  }

  .header-content {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .action-buttons {
    display: flex;
    flex-direction: row;
    width: auto;
    gap: 8px;
  }

  .action-buttons .btn {
    flex: 0 0 auto;
    padding: 8px 12px;
    font-size: 12px;
    white-space: nowrap;
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

  .form-actions {
    flex-direction: column;
  }

  .table-section {
    padding: 16px;
  }

  .pagination-section {
    flex-direction: column;
    gap: 16px;
  }

  .supplier-info {
    max-width: 150px;
  }

  .permission-denied {
    margin: 10px;
    min-height: 50vh;
  }

  .permission-denied-wrapper {
    padding: 0 10px;
  }

  .permission-content {
    padding: 30px 20px;
  }

  .permission-content h2 {
    font-size: 24px;
    margin-bottom: 12px;
  }

  .permission-message {
    font-size: 14px;
    margin-bottom: 20px;
  }

  .permission-info {
    margin: 20px 0;
    padding: 16px;
  }

  .permission-status {
    flex-direction: column;
    gap: 10px;
  }

  .permission-actions {
    flex-direction: column;
    gap: 12px;
  }
}

/* 使用上面已定义的form-group和form-control样式，避免重复 */

/* ===== 详情视图样式 ===== */
.supplier-detail-view {
  padding: 0;
}

.detail-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 16px 0;
    padding: 0;
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 8px;
  }
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: 500;
    color: #6b7280;
    min-width: 100px;
    margin-right: 16px;
    font-size: 14px;
  }

  .value {
    flex: 1;
    color: #1f2937;
    font-weight: 500;
    font-size: 14px;
    word-break: break-word;
  }
}

/* 统计网格样式 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.stat-item {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e5e7eb;

  .stat-number {
    font-size: 24px;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .stat-amount {
    font-size: 14px;
    color: #059669;
    font-weight: 600;
  }
}

/* 加载内容样式 */
.loading-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 0;
  color: #6b7280;
  font-size: 14px;

  i {
    font-size: 20px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.stat-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 5px;
}

.stat-label {
  color: #666;
  margin-bottom: 5px;
}

.stat-amount {
  font-size: 14px;
  color: #28a745;
  font-weight: 500;
}

.account-type {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.account-type.payment {
  background: #f8d7da;
  color: #721c24;
}

.account-type.refund {
  background: #d4edda;
  color: #155724;
}

.account-type.adjust {
  background: #fff3cd;
  color: #856404;
}

.amount-negative {
  color: #dc3545;
  font-weight: 500;
}

.amount-positive {
  color: #28a745;
  font-weight: 500;
}

.text-center {
  text-align: center;
}

.text-muted {
  color: #666;
}

.small {
  font-size: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .suppliers-view {
    padding: 10px;
  }
  
  .search-form {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-form .form-control {
    min-width: auto;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .pagination-section {
    flex-direction: column;
    gap: 10px;
  }
  
  /* 详情视图移动端适配 */
  .detail-row {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 0;

    .label {
      min-width: auto;
      margin-right: 0;
      margin-bottom: 8px;
    }

    .value {
      width: 100%;
    }
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
@media (max-width: 767px) {
  .suppliers-view {
    padding: 8px;
  }

  .suppliers-view .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .suppliers-view .stat-card {
    padding: 14px 12px;
    border-radius: 16px;
    gap: 12px;
  }

  .suppliers-view .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .suppliers-view .stat-value {
    font-size: 20px;
  }

  .suppliers-view .stat-label {
    font-size: 12px;
  }

  .suppliers-view .table-section {
    margin: 0;
    padding: 14px 10px;
    border-radius: 16px;
    overflow: hidden;
  }

  .suppliers-view .table-responsive {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    border-radius: 12px;
  }

  .suppliers-view .table {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    table-layout: fixed;
  }

  .suppliers-view .table th,
  .suppliers-view .table td {
    white-space: normal;
    word-break: break-word;
    box-sizing: border-box;
  }

  .suppliers-view .supplier-info {
    width: 100%;
    max-width: none;
  }

  .suppliers-view .supplier-name {
    font-size: 14px;
    line-height: 1.4;
    font-weight: 700;
    text-align: center;
  }

  .mobile-supplier-meta {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.4;
    color: #5f6b7a;
    text-align: center;
  }

  .mobile-supplier-meta i {
    margin-top: 2px;
    color: #64748b;
  }

  .suppliers-view .supplier-remarks {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.4;
    text-align: center;
  }

  .suppliers-view .status-badge.status-active,
  .suppliers-view .status-badge.status-inactive {
    width: 100%;
    max-width: 76px;
    margin: 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    white-space: normal;
    line-height: 1.35;
  }

}

@media (max-width: 480px) {
  .suppliers-view {
    padding: 12px;
  }

  .suppliers-view .stats-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 12px 0;
    padding: 0;
  }

  .suppliers-view .stat-card {
    padding: 12px 10px;
    gap: 10px;
  }

  .suppliers-view .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }

  .suppliers-view .stat-value {
    font-size: 18px;
  }

  .suppliers-view .stat-label {
    font-size: 11px;
  }

  .suppliers-view .table-section {
    margin: 0;
    padding: 12px 8px;
  }

  .suppliers-view .table th,
  .suppliers-view .table td {
    padding: 6px 4px;
    font-size: 11px;
  }

  .suppliers-view .table th:nth-child(1),
  .suppliers-view .table td:nth-child(1) {
    width: 18%;
  }

  .suppliers-view .table th:nth-child(2),
  .suppliers-view .table td:nth-child(2) {
    width: 50%;
  }

  .suppliers-view .table th:nth-child(3),
  .suppliers-view .table td:nth-child(3) {
    width: 32%;
  }

  .suppliers-view .supplier-name {
    font-size: 13px;
  }

  .mobile-supplier-meta,
  .suppliers-view .supplier-remarks {
    font-size: 10px;
  }

  .suppliers-view .id-badge {
    min-width: 44px;
    height: 28px;
    padding: 4px 8px;
    font-size: 11px;
    border-radius: 14px;
  }

  .mobile-row-actions .el-button {
    min-height: 26px;
    padding: 3px 7px;
    font-size: 10px;
    border-radius: 999px;
  }

  .mobile-row-actions .el-button .el-icon,
  .mobile-row-actions .el-button i {
    font-size: 10px;
    margin-right: 1px;
  }
}

</style>
