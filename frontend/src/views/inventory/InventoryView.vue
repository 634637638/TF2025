<template>
  <div class="inventory-view admin-page">
    <!-- 权限加载中 -->
    <div v-if="permissionLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载权限中...</p>
    </div>

    <!-- 页面头部 - 使用公共组件 -->
    <PageHeader
      icon="fas fa-warehouse"
      title="库存管理"
    >
      <template #actions>
        <el-button
          v-if="canCreate"
          type="primary"
          @click="handleStartStockIn"
        >
          <i class="fas fa-plus"></i>
          <span>入库</span>
        </el-button>
        <ImportExportActions
          :can-export="canExport"
          :export-loading="exporting"
          :export-disabled="loadingStore.isLoading || exporting"
          export-icon-class="fas fa-download"
          @export="exportInventory"
        />
        <el-button type="info" @click="handleRefresh" :disabled="refreshing">
          <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
          <span>刷新</span>
        </el-button>
      </template>
    </PageHeader>

    <!-- 权限不足提示 - 在权限加载完成后显示 -->
    <PermissionAccessNotice
      v-if="!permissionLoading"
      v-permission-not="'inventory:view'"
      module-name="库存管理"
      permission-name="库存管理查看权限"
      permission-code="inventory:view"
      :has-menu-permission-only="hasMenuPermissionOnly"
      :related-permissions="inventoryPermissions"
      detail-title="库存管理相关权限"
    />

    <!-- 权限验证通过后的内容 -->
    <div
      v-if="!permissionLoading"
      class="content admin-page-content"
      v-permission="'inventory:view'"
    >

    <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards" :class="{ 'loading': loadingStore.isLoading }">
      <div class="stat-card" v-for="(stat, index) in statCards" :key="stat.key" :style="{ 'animation-delay': `${index * 100}ms` }">
        <div class="stat-icon" :class="stat.iconClass">
          <i :class="stat.icon"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      :loading="isLoading"
      @search="loadInventory"
      @reset="resetFilters"
    >
      <template #primary>
        <el-input
          v-model="filters.search"
          placeholder="搜索关键词"
          clearable
          @input="debounceLoadInventory"
          @keyup.enter="loadInventory"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search"></i>
          </template>
        </el-input>
      </template>

      <!-- 供应商 -->
      <div v-if="canViewField('supplier_name')" class="form-group filter-item" data-field="supplier">
          <el-select
            v-model="filters.supplier_id"
            placeholder="供应商"
            filterable
            clearable
            @change="loadInventory"
          >
            <el-option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :label="supplier.name"
              :value="supplier.id"
            />
          </el-select>
      </div>

      <!-- 店铺 -->
      <div v-if="canViewField('store_name')" class="form-group filter-item" data-field="store">
          <el-select
            v-model="filters.store_id"
            placeholder="店铺"
            filterable
            clearable
            @change="loadInventory"
          >
            <el-option
              v-for="store in stores"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
      </div>

      <!-- 品牌 -->
      <div v-if="canViewField('brand')" class="form-group filter-item" data-field="brand">
          <el-select
            v-model="filters.brand"
            placeholder="品牌"
            filterable
            clearable
            @change="handleBrandChange"
          >
            <el-option
              v-for="brand in brands"
              :key="brand.id"
              :label="brand.name"
              :value="brand.name"
            />
          </el-select>
      </div>

      <!-- 型号 -->
      <div v-if="canViewField('model')" class="form-group filter-item" data-field="model">
          <el-select
            v-model="filters.model"
            placeholder="型号"
            filterable
            clearable
            @change="loadInventory"
            :disabled="!filters.brand && brandModels.length === models.length"
          >
            <el-option
              v-for="model in brandModels"
              :key="model.id"
              :label="model.name"
              :value="model.name"
            />
          </el-select>
      </div>

      <!-- 颜色 -->
      <div v-if="canViewField('color')" class="form-group filter-item" data-field="color">
          <el-select
            v-model="filters.color"
            placeholder="颜色"
            filterable
            clearable
            @change="loadInventory"
            allow-create
          >
            <el-option
              v-for="color in colors"
              :key="color"
              :label="color"
              :value="color"
            />
          </el-select>
      </div>

      <!-- 内存 -->
      <div v-if="canViewField('memory')" class="form-group filter-item" data-field="memory">
          <el-select
            v-model="filters.memory"
            placeholder="内存"
            filterable
            clearable
            @change="loadInventory"
          >
            <el-option
              v-for="memory in memories"
              :key="memory"
              :label="memory"
              :value="memory"
            />
          </el-select>
      </div>

      <!-- 机况 -->
      <div v-if="canViewField('is_new')" class="form-group filter-item" data-field="condition">
          <el-select
            v-model="filters.is_new"
            placeholder="机况"
            clearable
            @change="loadInventory"
          >
            <el-option label="全新" :value="true" />
            <el-option label="二手" :value="false" />
          </el-select>
      </div>

      <!-- 入库员 -->
      <div v-if="canViewField('inventory_operator_name')" class="form-group filter-item" data-field="operator">
          <el-select
            v-model="filters.operator_id"
            placeholder="入库员"
            filterable
            clearable
            @change="loadInventory"
          >
            <el-option
              v-for="operator in operators"
              :key="operator.id"
              :label="operator.name || operator.username"
              :value="operator.id"
            />
          </el-select>
      </div>

      <!-- 入库日期开始 -->
      <div v-if="canViewField('Inventorytime')" class="form-group filter-item">
          <el-date-picker
            v-model="filters.date_start"
            type="date"
            placeholder="开始日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="loadInventory"
            :clearable="true"
          />
      </div>

      <!-- 入库日期结束 -->
      <div v-if="canViewField('Inventorytime')" class="form-group filter-item">
          <el-date-picker
            v-model="filters.date_end"
            type="date"
            placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="loadInventory"
            :clearable="true"
          />
      </div>
    </UnifiedSearchPanel>

    <!-- 数据表格 -->
    <div class="table-section admin-panel admin-table-panel">
      <div class="section-header">
        <div class="section-title">
          <i class="fas fa-list"></i>
          库存列表
        </div>
        <div class="table-info">
          <span>共 {{ pagination.total }} 条记录</span>
        </div>
      </div>

      <div class="table-responsive table-mobile-friendly" v-loading="isLoading">
        <table class="data-table">
          <thead>
            <tr>
              <!-- 动态生成表头 -->
              <th
                v-for="column in tableColumns"
                :key="column.key"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="inventory.length === 0">
              <td :colspan="tableColumns.length" class="text-center py-8">
                <div class="empty-state">
                  <i class="fas fa-box-open"></i>
                  <p>暂无库存数据</p>
                </div>
              </td>
            </tr>
            <tr
              v-for="item in inventory"
              :key="item.id"
              @touchstart="handleRowTouch(item, $event)"
              :data-index="item.id"
              class="data-row"
            >
              <!-- 动态生成数据单元格 -->
              <template v-for="column in tableColumns" :key="column.key">
                <!-- 供应商列 -->
                <td v-if="column.key === 'supplier_name'">
                  {{ item.supplier_name || '-' }}
                </td>

                <!-- 店铺列 -->
                <td v-else-if="column.key === 'store_name'">
                  {{ item.store_name || '-' }}
                </td>

                <!-- 品牌列 -->
                <td v-else-if="column.key === 'brand'">
                  {{ item.brand_name || item.brand || '-' }}
                </td>

                <!-- 型号列 -->
                <td v-else-if="column.key === 'model'">
                  {{ item.model_name || item.model || '-' }}
                </td>

                <!-- 颜色列 -->
                <td v-else-if="column.key === 'color'">
                  {{ item.color_name || item.color || '-' }}
                </td>

                <!-- 内存列 -->
                <td v-else-if="column.key === 'memory'">
                  {{ item.memory_name || item.memory || '-' }}
                </td>

                <!-- 序列号列 -->
                <td v-else-if="column.key === 'serial_number'">
                  <span class="serial-number">{{ item.serial_number || '-' }}</span>
                </td>

                <!-- IMEI列 -->
                <td v-else-if="column.key === 'imei'">
                  <span class="imei">{{ item.imei || '-' }}</span>
                </td>

                <!-- 入库价格列 -->
                <td v-else-if="column.key === 'purchase_price'" class="price">
                  ¥{{ formatNumber(item.purchase_cost || item.purchase_price || item.purchase_unit_price) }}
                </td>

                <!-- 入库员列 -->
                <td v-else-if="column.key === 'inventory_operator_name'">
                  {{ item.inventory_operator_name || item.operator_name || '-' }}
                </td>

                <!-- 机况列 -->
                <td v-else-if="column.key === 'is_new'">
                  <span class="condition-badge" :class="getConditionClass(item.is_new ?? 0)">
                    {{ getConditionText(item.is_new ?? 0) }}
                  </span>
                </td>

                <!-- 状态列 -->
                <td v-else-if="column.key === 'is_preordered'">
                  <span :class="['status-badge', getSaleStatusClass(item)]">
                    {{ getSaleStatusLabel(item) }}
                  </span>
                </td>

                <!-- 入库时间列 -->
                <td v-else-if="column.key === 'Inventorytime'">
                  {{ formatDate(item.Inventorytime || item.created_at) }}
                </td>

                <!-- 操作列 -->
                <td v-else-if="column.key === 'actions'">
                  <div class="action-buttons">
                    <el-button
                      @click="viewDetails(item)"
                      type="primary"
                      size="small"
                      title="查看详情"
                    >
                      <i class="fas fa-eye"></i>
                      查看
                    </el-button>
                    <el-button
                      v-if="canCreate && item.status === 'in_stock'"
                      @click="quickSaleItem(item)"
                      type="warning"
                      size="small"
                      title="商品出库"
                    >
                      <i class="fas fa-shopping-cart"></i>
                      出库
                    </el-button>
                    <el-button
                      v-if="canEdit && item.status === 'in_stock'"
                      @click="editItem(item)"
                      type="success"
                      size="small"
                      title="编辑"
                    >
                      <i class="fas fa-edit"></i>
                      编辑
                    </el-button>
                    <el-button
                      v-if="canDelete && item.status === 'in_stock'"
                      @click="deleteItem(item)"
                      type="danger"
                      size="small"
                      title="删除"
                    >
                      <i class="fas fa-trash"></i>
                      删除
                    </el-button>
                  </div>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

  
      <div class="pagination-wrapper">
        <Pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.size"
          :total="Number(pagination.total)"
          :page-sizes="[20, 50, 100, 200]"
          :show-total="true"
          :show-range="true"
          :show-page-sizes="true"
          :show-quick-jumper="true"
          :disabled="loadingStore.isLoading"
          @change="(page: number, pageSize: number) => handlePaginationChange({ page, pageSize })"
        />
      </div>
    </div>

    <InventoryDetailModal
      v-model="showDetailsModal"
      :item="selectedItem"
      :permission-loading="permissionLoading"
      :can-edit="canEdit"
      :can-delete="canDelete"
      @close="handleCloseDetails"
      @edit="handleEditFromModal"
      @delete="handleDeleteFromModal"
    />

    </div>
    <!-- 权限验证通过后的内容 结束 -->

  </div>

  
  <!-- 入库弹窗组件 -->
  <StockInModal
    v-model:visible="showStockInModal"
    mode="create"
    @success="handleStockInSuccess"
    @cancel="handleStockInCancel"
  />

  <!-- Toast 通知组件 -->
  <Toast />

  <!-- 编辑设备对话框 -->
  <MobileDialog
    v-model="showEditModal"
    title="编辑设备信息"
    width="900px"
    dialog-class="inventory-edit-dialog"
    :close-on-click-modal="false"
    :show-default-footer="false"
  >
    <div class="inventory-edit-content">
      <!-- 基本信息 -->
      <div class="inventory-edit-summary-grid">
        <div v-if="canViewField('brand')" class="bg-gradient-brand">
          <div class="text-xs opacity-80 mb-1">品牌</div>
          <div class="text-base font-semibold">{{ editForm.brand || '未设置' }}</div>
        </div>
        <div v-if="canViewField('model')" class="bg-gradient-model">
          <div class="text-xs opacity-80 mb-1">型号</div>
          <div class="text-base font-semibold">{{ editForm.model || '未设置' }}</div>
        </div>
        <div v-if="canViewField('color')" class="bg-gradient-color">
          <div class="text-xs opacity-80 mb-1">颜色</div>
          <div class="text-base font-semibold">{{ editForm.color || '未设置' }}</div>
        </div>
        <div v-if="canViewField('memory')" class="bg-gradient-memory">
          <div class="text-xs opacity-80 mb-1">内存</div>
          <div class="text-base font-semibold">{{ editForm.memory || '未设置' }}</div>
        </div>
        <div v-if="canViewField('serial_number')" class="bg-gradient-serial">
          <div class="text-xs opacity-80 mb-1">序列号</div>
          <div class="text-sm font-semibold">{{ editForm.serial_number || '未设置' }}</div>
        </div>
        <div v-if="canViewField('purchase_price')" class="bg-gradient-purchase">
          <div class="text-xs opacity-80 mb-1">入库价格</div>
          <div class="text-base font-semibold">{{ editForm.purchase_cost ? `¥${Math.round(editForm.purchase_cost)}` : '未定价' }}</div>
        </div>
      </div>

      <!-- 编辑表单 -->
      <div class="inventory-edit-form-shell">
        <div class="inventory-edit-form-grid">
          <!-- 供应商 -->
          <div v-if="canViewField('supplier_name')">
            <label class="form-label">供应商</label>
            <el-select v-model="editForm.supplier_id" placeholder="选择供应商" filterable clearable reserve-keyword default-first-option teleported fit-input-width popper-class="inventory-edit-select-popper" class="w-full" :disabled="!canEditField('supplier_name')">
              <el-option v-for="supplier in suppliers" :key="supplier.id" :label="supplier.name" :value="supplier.id" />
            </el-select>
          </div>

          <!-- 入库店铺 -->
          <div v-if="canViewField('store_name')">
            <label class="form-label">入库店铺</label>
            <el-select v-model="editForm.store_id" placeholder="选择店铺" filterable clearable reserve-keyword default-first-option teleported fit-input-width popper-class="inventory-edit-select-popper" class="w-full" :disabled="!canEditField('store_name')">
              <el-option v-for="store in stores" :key="store.id" :label="store.name" :value="store.id" />
            </el-select>
          </div>

          <!-- 入库时间 -->
          <div v-if="canViewField('Inventorytime')">
            <label class="form-label">入库时间</label>
            <el-date-picker v-model="editForm.Inventorytime" type="date" placeholder="选择日期" format="YYYY-MM-DD" value-format="YYYY-MM-DD" teleported popper-class="inventory-edit-select-popper" class="w-full" :disabled="!canEditField('Inventorytime')" :prefix-icon="null" :clearable="false" />
          </div>

          <!-- 机况 -->
          <div v-if="canViewField('is_new')">
            <label class="form-label">机况</label>
            <el-select v-model="editForm.condition" placeholder="选择机况" filterable reserve-keyword default-first-option teleported fit-input-width popper-class="inventory-edit-select-popper" class="w-full" :disabled="!canEditField('is_new')">
              <el-option label="全新" value="全新" />
              <el-option label="二手" value="二手" />
            </el-select>
          </div>

          <div>
            <label class="form-label">状态</label>
            <el-select
              v-model="editForm.status"
              placeholder="选择状态"
              teleported
              fit-input-width
              popper-class="inventory-edit-select-popper"
              class="w-full"
            >
              <el-option
                v-for="option in PHONE_STATUS_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>

          <!-- 品牌 -->
          <div v-if="canViewField('brand')">
            <label class="form-label">品牌</label>
            <el-select v-model="editForm.brand" placeholder="选择品牌" filterable clearable reserve-keyword default-first-option teleported fit-input-width popper-class="inventory-edit-select-popper" @change="onEditBrandChange" class="w-full" :disabled="!canEditField('brand')">
              <el-option v-for="brand in brands" :key="brand.id" :label="brand.name" :value="brand.name" />
            </el-select>
          </div>

          <!-- 型号 -->
          <div v-if="canViewField('model')">
            <label class="form-label">型号</label>
            <el-select
              v-if="editForm.brand && editBrandModels.length > 0"
              v-model="editForm.model"
              placeholder="选择型号或输入搜索"
              filterable
              clearable
              allow-create
              remote
              reserve-keyword
              default-first-option
              remote-show-suffix
              teleported
              fit-input-width
              popper-class="inventory-edit-select-popper"
              :remote-method="remoteSearchModel"
              :loading="modelSearchLoading"
              :disabled="!canEditField('model')"
              class="w-full">
              <el-option v-for="model in editBrandModels" :key="model" :label="model" :value="model" />
            </el-select>
            <el-input
              v-else
              v-model="editForm.model"
              placeholder="请输入型号（或先选择品牌）"
              clearable
              :disabled="!canEditField('model')"
              class="w-full" />
          </div>

          <!-- 颜色 -->
          <div v-if="canViewField('color')">
            <label class="form-label">颜色</label>
            <el-select v-model="editForm.color" placeholder="选择颜色" filterable clearable reserve-keyword default-first-option teleported fit-input-width popper-class="inventory-edit-select-popper" class="w-full" :disabled="!canEditField('color')">
              <el-option v-for="color in colors" :key="color" :label="color" :value="color" />
            </el-select>
          </div>

          <!-- 内存 -->
          <div v-if="canViewField('memory')">
            <label class="form-label">内存</label>
            <el-select v-model="editForm.memory" placeholder="选择内存" filterable clearable reserve-keyword default-first-option teleported fit-input-width popper-class="inventory-edit-select-popper" class="w-full" :disabled="!canEditField('memory')">
              <el-option v-for="memory in memories" :key="memory" :label="memory" :value="memory" />
            </el-select>
          </div>

          <!-- 序列号和IMEI（手机端一行展示） -->
          <div v-if="canViewField('serial_number') || canViewField('imei')" class="inventory-edit-serial-imei-row">
            <!-- 序列号 -->
            <div v-if="canViewField('serial_number')" class="inventory-edit-serial-field">
              <label class="form-label">序列号</label>
              <el-input v-model="editForm.serial_number" placeholder="请输入序列号" maxlength="18" :disabled="!canEditField('serial_number')" />
            </div>

            <!-- IMEI -->
            <div v-if="canViewField('imei')" class="inventory-edit-imei-field">
              <label class="form-label">
                IMEI
                <span v-if="editIsNoIMEIMode" class="text-success text-xs ml-2">
                  <i class="fas fa-check-circle"></i> 无IMEI模式
                </span>
              </label>
              <div @dblclick="toggleEditNoIMEIMode" class="cursor-pointer" :title="editIsNoIMEIMode ? '双击切换回标准模式' : '双击启用无IMEI模式（支持字母+数字）'">
                <el-input
                  v-model="editForm.imei"
                  :placeholder="editIsNoIMEIMode ? '无IMEI模式' : '请输入15位IMEI'"
                  :maxlength="editIsNoIMEIMode ? 30 : 15"
                  :disabled="!canEditField('imei')"
                  @input="formatEditIMEI"
                />
              </div>
              <div v-if="editIsNoIMEIMode" class="text-xs text-gray-500 mt-1">
                双击输入框可切换回标准模式
              </div>
            </div>
          </div>

          <!-- 入库价格 -->
          <div v-if="canViewField('purchase_price')" class="inventory-edit-price-field">
            <label class="form-label">入库价格</label>
            <div class="inventory-edit-price-row">
              <el-input-number v-model="editForm.purchase_cost" placeholder="请输入入库价格" :min="0" :step="1" :precision="0" :controls="false" class="inventory-edit-price-input" :value-on-clear="null" :disabled="!canEditField('purchase_price')" />

              <!-- H5上架开关（全新机和二手商品通用） -->
              <div class="inventory-edit-publish-actions">
                <el-switch
                  v-model="editForm.is_published"
                  :active-value="1"
                  :inactive-value="0"
                  active-text="H5上架"
                  inactive-text="已下架"
                  inline-prompt
                  @change="handleQuickPublishChange"
                />
              </div>
            </div>
          </div>

          <!-- 备注 -->
          <div v-if="canViewField('remarks')" class="inventory-edit-remarks-field">
            <label class="form-label">备注</label>
            <el-input v-model="editForm.remarks" type="textarea" :rows="2" placeholder="请输入备注信息" maxlength="500" show-word-limit :disabled="!canEditField('remarks')" />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="inventory-edit-footer" :class="{ 'has-config': editForm.condition === '二手' }">
        <el-button v-if="editForm.condition === '二手'" type="success" @click="showPublishToH5Modal = true">
          <i class="fas fa-mobile-alt"></i>
          商品配置
        </el-button>
        <el-button type="default" @click="closeEditModal">取消</el-button>
        <el-button type="primary" @click="submitEdit" :loading="submitting">
          <i v-if="!submitting" class="fas fa-save"></i>
          保存修改
        </el-button>
      </div>
    </template>
  </MobileDialog>

  <!-- 上架商品到H5商城模态框 -->
  <PublishToH5Modal
    v-model="showPublishToH5Modal"
    :phone-id="selectedPhoneForEdit?.id || null"
    @success="handlePublishSuccess"
  />

</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, ElSelect, ElOption, ElInputNumber, ElDatePicker } from 'element-plus'
import { useMobileDetection } from '@/composables/mobile'
import { useMobile } from '@/composables/mobile'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { usePermissionModuleInfo } from '@/composables/usePermissionModuleInfo'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useRefreshData } from '@/composables/useRefreshData'
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { normalizePermissionList } from '@/utils/permissionList'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import { useLoadingStore } from '@/stores/loading'
import Toast from '../../components/Toast.vue'
import CustomSearch from '@/components/CustomSearch.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import InventoryDetailModal from '@/components/InventoryDetailModal.vue'
import StockInModal from '@/components/StockInModal.vue'
import PublishToH5Modal from '@/components/PublishToH5Modal.vue'
import Pagination from '@/components/Pagination.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { PageHeader } from '@/components/base'
import PermissionAccessNotice from '@/components/base/PermissionAccessNotice.vue'
import { PHONE_STATUS_OPTIONS, getPhoneStatusClass, getPhoneStatusLabel, normalizePhoneStatus } from '@/constants/phoneStatuses'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import type { InventoryItem } from '@/types'

interface Stats {
  total: number
  inStock: number
  sold: number
  totalValue: number
}

const router = useRouter()
const route = useRoute()
const mobileDetection = useMobileDetection()
const { isMobile } = useMobile()
const { success, error, warning, info, handleApiError, confirm } = useNotification()
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  handleNoPermission
} = usePagePermissions('inventory')
const { refreshing, refresh } = useRefreshData()
const authStore = useAuthStore()
const loadingStore = useLoadingStore()
const { init: initFieldPermissions } = fieldPermissions
const { exportFile, buildDateFilename } = useImportExport()
const exporting = ref(false)

// 权限加载状态
const permissionLoading = ref(false)
const { success: showSuccess, error: showError } = useNotification()

// 搜索相关状态
const searchExpanded = ref(false) // 搜索区域展开状态（移动端默认折叠）
const showAdvancedSearch = ref(false)
const showDesktopSearch = ref(false) // 桌面端搜索区域显示状态，默认折叠
const simpleSearchQuery = ref('') // 简化搜索框的查询内容

// 实时搜索防抖
let searchDebounceTimer: any = null

// 触摸事件相关状态（用于移动端双击检测）
const touchTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())
const lastTapTime = ref<Map<string, number>>(new Map())

// 窗口宽度响应式
const windowWidth = ref(window.innerWidth)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

// 移动端触摸事件处理（模拟双击）
const handleRowTouch = (item: InventoryItem, event: TouchEvent) => {
  const rowKey = (event.currentTarget as HTMLElement).dataset.index || String(item.id)
  const now = Date.now()
  const lastTime = lastTapTime.value.get(rowKey) || 0
  const timeDiff = now - lastTime

  // 清除之前的定时器
  const existingTimer = touchTimers.value.get(rowKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
    touchTimers.value.delete(rowKey)
  }

  // 如果两次点击间隔小于 300ms，视为双击
  if (timeDiff < 300 && timeDiff > 0) {
    // 双击触发 - 打开详情模态框
    viewDetails(item)
    lastTapTime.value.delete(rowKey)
  } else {
    // 单击：等待可能的双击
    const timer = setTimeout(() => {
      lastTapTime.value.delete(rowKey)
      touchTimers.value.delete(rowKey)
    }, 300)
    touchTimers.value.set(rowKey, timer)
  }

  lastTapTime.value.set(rowKey, now)
}

const inventoryFieldMap: Record<string, string> = {
  stats_total_phones: 'stats.total_phones',
  stats_new_phones: 'stats.new_phones',
  stats_used_phones: 'stats.used_phones',
  stats_inventory_value: 'stats.inventory_value',
  supplier_name: 'supplier_info.supplier_name',
  store_name: 'store_info.store_name',
  brand: 'basic.brand',
  model: 'basic.model',
  color: 'basic.color',
  memory: 'basic.memory',
  serial_number: 'basic.serial_number',
  imei: 'basic.imei',
  purchase_price: 'price_info.purchase_price',
  inventory_operator_name: 'operator_info.inventory_operator_name',
  is_new: 'basic.is_new',
  status: 'basic.status',
  Inventorytime: 'time_info.Inventorytime',
  purchase_number: 'purchase_info.purchase_number',
  remarks: 'other_info.remarks',
  actions: 'system_info.operations'
}

const getInventoryFieldKey = (fieldName: string) => {
  return inventoryFieldMap[fieldName] || fieldName
}

const canViewField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('inventory_inventoryview', getInventoryFieldKey(fieldName))
}

const canEditField = (fieldName: string) => {
  if (!canViewField(fieldName)) {
    return false
  }

  if (canCreate.value || canEdit.value) {
    return true
  }

  return fieldPermissions.isFieldEditable('inventory_inventoryview', getInventoryFieldKey(fieldName))
}

// 根据屏幕宽度动态配置表格列
const tableColumns = computed(() => {
  const width = windowWidth.value

  // 定义所有列
  const allColumns = [
    { key: 'supplier_name', label: '供应商' },
    { key: 'store_name', label: '店铺' },
    { key: 'brand', label: '品牌' },
    { key: 'model', label: '型号' },
    { key: 'color', label: '颜色' },
    { key: 'memory', label: '内存' },
    { key: 'serial_number', label: '序列号' },
    { key: 'imei', label: 'IMEI' },
    { key: 'purchase_price', label: '入库价格' },
    { key: 'inventory_operator_name', label: '入库员' },
    { key: 'is_new', label: '机况' },
    { key: 'is_preordered', label: '状态' },
    { key: 'Inventorytime', label: '入库时间' },
    { key: 'actions', label: '操作' }
  ]

  // 根据屏幕宽度过滤字段
  let mobileColumns: string[] = []

  if (width <= 480) {
    // 小屏手机：只显示 型号、颜色、内存、序列号（无操作列）
    mobileColumns = ['model', 'color', 'memory', 'serial_number']
  } else if (width <= 768) {
    // 大屏手机：显示 品牌、型号、颜色、内存、序列号、IMEI、机况（无操作列）
    mobileColumns = ['brand', 'model', 'color', 'memory', 'serial_number', 'imei', 'is_new']
  } else if (width <= 1024) {
    // 平板：显示更多字段（无操作列）
    mobileColumns = ['brand', 'model', 'color', 'memory', 'serial_number', 'imei', 'purchase_price', 'is_new', 'Inventorytime']
  }

  // 如果是移动端，只返回指定的列（不包含操作列）
  const visibleColumns = allColumns.filter(column => {
    if (column.key === 'actions') {
      return canViewField('actions') && (canEdit.value || canDelete.value)
    }

    return canViewField(column.key)
  })

  if (width <= 1024) {
    return visibleColumns.filter(column => mobileColumns.includes(column.key))
  }

  return visibleColumns
})



// 响应式数据 - 强制初始化为空状态
const inventory = ref<InventoryItem[]>([])
const selectedItem = ref<InventoryItem | null>(null)
const showDetailsModal = ref(false)

// 入库弹窗状态
const showStockInModal = ref(false)

// 编辑弹窗相关
const showEditModal = ref(false)
const selectedPhoneForEdit = ref<any>(null)
const submitting = ref(false)
const editForm = reactive({
  brand: '',
  model: '',
  color: '',
  memory: '',
  serial_number: '',
  imei: '',
  purchase_cost: null,
  supplier_id: null,
  store_id: null,
  condition: '',
  status: 'in_stock',
  Inventorytime: null,
  remarks: '',
  is_published: 1,  // H5上架状态，1=上架，0=下架
  // 图片上传相关
  imageHover: false
})

// 编辑模式的无IMEI状态
const editIsNoIMEIMode = ref(false)

// 编辑弹窗专用的品牌型号数据
const editBrandModels = ref<string[]>([])
const modelSearchLoading = ref(false)

// 上架商品模态框
const showPublishToH5Modal = ref(false)

// 远程搜索型号方法
const remoteSearchModel = async (query: string) => {
  if (!query || query.trim() === '') {
    // 如果搜索为空，加载该品牌的默认型号列表
    if (editForm.brand) {
      await fetchEditBrandModels(editForm.brand)
    }
    return
  }


  try {
    modelSearchLoading.value = true

    // 构建搜索参数
    const params = new URLSearchParams()
    params.append('search', query.trim())
    params.append('status', '1')
    params.append('limit', '50')

    // 如果选择了品牌，添加品牌过滤
    if (editForm.brand) {
      const brand = brands.value.find((b: any) => b.name === editForm.brand)
      if (brand) {
        params.append('brand_id', String(brand.id))
      }
    }

    const response = await api.get(`/models?${params.toString()}`)
    if (response.success) {
      const modelsData = extractResponseData<any[]>(response)

      editBrandModels.value = modelsData
        .filter((m: any) => m && m.name)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m: any) => String(m.name || '').trim())

    } else {
      editBrandModels.value = []
    }
  } catch (err) {
    logger.error('搜索型号失败:', err)
    editBrandModels.value = []
  } finally {
    modelSearchLoading.value = false
  }
}

const suppliers = ref<any[]>([])
const stores = ref<any[]>([])
const operators = ref<any[]>([])
const brands = ref<Array<{id: number, name: string}>>([])
const models = ref<Array<{id: number, name: string}>>([])
const colors = ref<string[]>([])
const memories = ref<string[]>([])
const brandModels = ref<Array<{id: number, name: string}>>([])  // 存储当前品牌对应的型号列表

// 加载状态
const isLoading = computed(() => loadingStore.isLoading)

const normalizedInventoryPermissions = computed<string[]>(() => {
  return normalizePermissionList(authStore.permissions)
})

const { hasMenuPermissionOnly, modulePermissions: inventoryPermissions } = usePermissionModuleInfo(
  normalizedInventoryPermissions,
  'inventory_inventoryview'
)

// 统计数据
const stats = reactive<Stats>({
  total: 0,
  inStock: 0,
  sold: 0,
  totalValue: 0
})

const showStatsCards = computed(() => (
  canViewField('stats_total_phones') ||
  canViewField('stats_new_phones') ||
  canViewField('stats_used_phones') ||
  canViewField('stats_inventory_value')
))

// 统计卡片配置
const statCards = computed(() => ([
  {
    key: 'total',
    permission: 'stats_total_phones',
    label: '手机总数',
    value: stats.total || 0,
    icon: 'fas fa-mobile-alt',
    iconClass: ''
  },
  {
    key: 'inStock',
    permission: 'stats_new_phones',
    label: '全新机数量',
    value: stats.inStock || 0,
    icon: 'fas fa-box',
    iconClass: 'in-stock'
  },
  {
    key: 'sold',
    permission: 'stats_used_phones',
    label: '二手机数量',
    value: stats.sold || 0,
    icon: 'fas fa-check-circle',
    iconClass: 'sold'
  },
  {
    key: 'totalValue',
    permission: 'stats_inventory_value',
    label: '库存总值',
    value: `¥${formatNumber(stats.totalValue || 0)}`,
    icon: 'fas fa-dollar-sign',
    iconClass: ''
  }
]).filter(stat => canViewField(stat.permission)))

// 筛选条件 - 与销售页面保持一致的顺序
const filters = reactive({
  brand: '',
  model: '',
  color: '',
  memory: '',
  store_id: '',
  supplier_id: '',
  operator_id: '',
  is_new: '',
  status: '',        // 库存状态
  phone_condition: '', // 手机成色
  date_range: '',
  date_start: '', // 移动端开始日期
  date_end: '',   // 移动端结束日期
  search: ''
})

// CustomSearch 组件的筛选条件配置 - 与销售页面保持一致的顺序
const searchFilters = computed(() => {
  // 返回可用筛选器的统计信息
  const stats = {
    brands: brands.value.length,
    models: models.value.length,
    colors: colors.value.length,
    memories: memories.value.length,
    stores: stores.value.length,
    suppliers: suppliers.value.length,
    operators: operators.value.length
  }

  // 按照要求的顺序配置筛选条件：品牌、型号、颜色、内存、供应商、店铺、入库员、成色、入库日期
  return [
    {
      key: 'brand',
      label: '品牌',
      type: 'editable-select',
      placeholder: '请输入或选择品牌',
      editableOptions: () => brands.value,
      showOptions: true, // 默认显示选项
      highlightedIndex: -1,
      onOptionsChange: async (filter, value) => {
        // 品牌变化时，获取对应的型号列表
        await fetchBrandModels(value)
      }
    },
    {
      key: 'model',
      label: '型号',
      type: 'editable-select',
      placeholder: '请输入或选择型号',
      editableOptions: () => brandModels.value,
      showOptions: true, // 默认显示选项
      highlightedIndex: -1
    },
    {
      key: 'color',
      label: '颜色',
      type: 'editable-select',
      placeholder: '请输入或选择颜色',
      editableOptions: () => colors.value.length > 0 ? colors.value : [],
      showOptions: true, // 默认显示选项
      highlightedIndex: -1
    },
    {
      key: 'memory',
      label: '内存',
      type: 'editable-select',
      placeholder: '请输入或选择内存',
      editableOptions: () => memories.value.length > 0 ? memories.value : [],
      showOptions: true, // 默认显示选项
      highlightedIndex: -1
    },
    {
      key: 'supplier_id',
      label: '供应商',
      type: 'select',
      placeholder: '选择供应商',
      options: suppliers.value.map(supplier => ({
        label: supplier.name,
        value: supplier.id
      }))
    },
    {
      key: 'store_id',
      label: '店铺',
      type: 'select',
      placeholder: '选择店铺',
      options: stores.value.map(store => ({
        label: store.name,
        value: store.id
      }))
    },
    {
      key: 'operator_id',
      label: '入库员',
      type: 'select',
      placeholder: '选择入库员',
      options: operators.value.map(operator => ({
        label: operator.name || operator.username,
        value: operator.id
      }))
    },
    {
      key: 'is_new',
      label: '成色',
      type: 'select',
      placeholder: '选择成色',
      options: [
        { label: '全新', value: true },
        { label: '二手', value: false }
      ]
    },
    {
      key: 'date_range',
      label: '入库日期',
      type: 'daterange',
      placeholder: '选择日期范围'
    }
  ]
})

// ==================== 数据排序辅助函数 ====================

// 品牌排序权重（苹果优先）
const getBrandOrderWeight = (brand: string): number => {
  if (!brand) return 999
  const brandLower = brand.toLowerCase().trim()

  // 苹果品牌优先（包含 Apple、iPhone、iPad 等关键词）
  if (brandLower.includes('apple') || brandLower.includes('iphone') || brandLower.includes('ipad')) {
    return 0
  }

  // 其他品牌按字母顺序
  return 1
}

// 从型号名称中提取系列号（如 iPhone 14 Pro -> 14）
const extractSeriesNumber = (model: string): number => {
  if (!model) return 0
  const match = model.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

// 内存排序权重（转换为统一的数字进行比较）
const getMemoryOrderWeight = (memory: string): number => {
  if (!memory) return 999
  const size = memory.toUpperCase().replace(/[^0-9A-Z]/g, '')

  if (size.includes('TB')) {
    const tb = parseInt(size) || 0
    return tb * 1000
  } else if (size.includes('GB') || size.includes('G')) {
    const gb = parseInt(size) || 0
    return gb
  }

  const num = parseInt(size) || 0
  return num
}

// 对库存数据进行排序
const sortInventoryData = (data: InventoryItem[]): InventoryItem[] => {
  if (!data || data.length === 0) return []

  const sorted = [...data]

  return sorted.sort((a, b) => {
    const brandA = a.brand_name || a.brand || ''
    const brandB = b.brand_name || b.brand || ''
    const modelA = a.model_name || a.model || ''
    const modelB = b.model_name || b.model || ''
    const memoryA = a.memory || ''
    const memoryB = b.memory || ''
    const colorA = a.color_name || a.color || ''
    const colorB = b.color_name || b.color || ''
    const conditionA = a.is_new === 1 ? '全新' : '二手'
    const conditionB = b.is_new === 1 ? '全新' : '二手'

    // 1. 优先按品牌排序（苹果优先）
    const brandWeightA = getBrandOrderWeight(brandA)
    const brandWeightB = getBrandOrderWeight(brandB)
    if (brandWeightA !== brandWeightB) {
      return brandWeightA - brandWeightB
    }

    // 2. 品牌相同，按机况排序（全新在前，二手在后）
    if (conditionA !== conditionB) {
      return conditionA === '全新' ? -1 : 1
    }

    // 3. 机况相同，按型号系列号从小到大排序
    const seriesA = extractSeriesNumber(modelA)
    const seriesB = extractSeriesNumber(modelB)
    if (seriesA !== seriesB) {
      return seriesA - seriesB
    }

    // 4. 系列号相同，按型号名称排序
    if (modelA !== modelB) {
      return (modelA || '').localeCompare(modelB || '', 'zh-CN')
    }

    // 5. 型号相同，按内存从小到大排序
    const memoryWeightA = getMemoryOrderWeight(memoryA)
    const memoryWeightB = getMemoryOrderWeight(memoryB)
    if (memoryWeightA !== memoryWeightB) {
      return memoryWeightA - memoryWeightB
    }

    // 6. 内存相同，按颜色排序
    if (colorA !== colorB) {
      return (colorA || '').localeCompare(colorB || '', 'zh-CN')
    }

    return 0
  })
}

// 分页
const pagination = reactive({
  page: 1,
  size: 100,
  total: 0
})
let basicDataWarmupTimer: ReturnType<typeof setTimeout> | null = null

// 获取库存列表 - 优化权限集成
const loadInventoryData = async (
  additionalParams: any = {},
  options: { showLoadingState?: boolean } = {}
) => {
  const { showLoadingState = true } = options

  if (showLoadingState) {
    loadingStore.setLoading(true)
  }
  try {
    const params: any = {
      page: pagination.page,
      limit: pagination.size,
      ...additionalParams // 合并传入的额外参数
    }

    // 添加筛选条件（如果additionalParams中没有覆盖的话）
    if (!params.supplier_id && filters.supplier_id) params.supplier_id = filters.supplier_id
    if (!params.store_id && filters.store_id) params.store_id = filters.store_id
    if (!params.operator_id && filters.operator_id) params.operator_id = filters.operator_id

    // 品牌：filters.brand 直接存储名称
    if (!params.brand && filters.brand) params.brand = filters.brand

    // 型号：filters.model 直接存储名称
    if (!params.model && filters.model) params.model = filters.model

    // 颜色、内存直接使用值（已经是字符串）
    if (!params.color && filters.color) params.color = filters.color
    if (!params.memory && filters.memory) params.memory = filters.memory

    // 处理 is_new 参数：确保传递布尔值或字符串
    if (filters.is_new !== '' && filters.is_new !== null && filters.is_new !== undefined) {
      params.is_new = filters.is_new
    }

    if (filters.date_start) params.date_start = filters.date_start
    if (filters.date_end) params.date_end = filters.date_end
    if (filters.search) {
      params.search = filters.search
    }

    // 清理空值
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key]
      }
    })



    // 调用后端API - 使用inventory端点获取库存数据
    const response = await api.get('/inventory/list', { params })

    if (response.success) {
      let records = []

      // 根据实际的API响应结构解析数据
      // 支持多种响应格式：
      // 1. { data: [...] } - 单层结构
      // 2. { data: { data: [...] } } - 双层嵌套结构
      // 3. { data: { phones: [...] } } 或 { data: { records: [...] } }
      const responseData = extractResponseData<any>(response)

      if (Array.isArray(responseData)) {
        // 直接是数组
        records = responseData
      } else if (responseData?.data && Array.isArray(responseData.data)) {
        // 双层嵌套结构: { success, data: [...] }
        records = responseData.data
      } else if (responseData?.phones && Array.isArray(responseData.phones)) {
        records = responseData.phones
      } else if (responseData?.records && Array.isArray(responseData.records)) {
        records = responseData.records
      } else {
        records = []
      }


      // 处理数据字段映射，确保入库价格字段正确
      const mappedData = records.map(record => ({
        ...record,
        // 使用新的后端字段结构
        purchase_price: record.purchase_price || record.purchase_cost || record.purchase_unit_price || 0,
        price: record.price || record.sale_price || 0
      }))

      // 直接使用后端返回的顺序（按入库时间降序）
      inventory.value = mappedData

      // 根据实际数据结构获取分页信息
      // 支持多层嵌套结构的分页信息提取
      let totalCount = 0
      const paginationInfo = responseData?.pagination || responseData?.data?.pagination || response.pagination
      if (paginationInfo?.total) {
        totalCount = parseInt(String(paginationInfo.total))
      } else {
        totalCount = records.length
      }
      pagination.total = totalCount

      // 检查是否有数据
      if (records.length === 0) {
        // 检查是否有筛选条件（排除搜索框和分页参数）
        const hasFilters = Object.keys(filters).some(key =>
          filters[key] && filters[key] !== '' &&
          key !== 'page' && key !== 'limit' && key !== 'search'
        )

        // 如果有筛选条件但没有数据，显示暂无数据提示
        if (hasFilters) {
          ElMessage.warning('当前筛选条件下没有找到数据，请调整筛选条件')
        }
        // 如果有搜索词但没有数据，不显示提示（让用户自己看到搜索结果为空）
        else if (filters.search && filters.search.trim()) {
          // 搜索不显示额外提示，让表格显示"暂无数据"即可
        }
        // 如果没有任何筛选条件且没有数据，显示库存为空提示
        else {
          ElMessage.info('暂无库存数据')
        }
      }

      updateStats()
    } else {
      error(response.message || '获取库存数据失败')
      inventory.value = []
      pagination.total = 0
    }
  } catch (error: any) {
    logger.error('❌ 获取库存数据失败:', error)

    // 权限相关错误处理
    if (error.response?.status === 403) {
      error('权限不足，无法访问库存数据')
    } else if (error.response?.status === 401) {
      error('登录已过期，请重新登录')
    } else {
      error(error.response?.data?.message || '获取库存数据失败')
    }

    inventory.value = []
    pagination.total = 0
  } finally {
    if (showLoadingState) {
      loadingStore.setLoading(false)
    }
  }
}

// 防抖函数
let debounceTimer: NodeJS.Timeout
const debounceLoadInventory = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    await loadInventoryData({}, { showLoadingState: false })
  }, 500)
}

// 立即搜索（点击搜索按钮或按回车）
const loadInventory = async () => {
  pagination.page = 1
  await loadInventoryData()
}

// 检查是否有复杂筛选条件（除店铺外的筛选）
const hasComplexFilters = computed(() => {
  return filters.supplier_id ||
    filters.brand ||
    filters.model ||
    filters.color ||
    filters.memory ||
    filters.status ||
    filters.is_new ||
    filters.search ||
    filters.date_start ||
    filters.date_end
})

// 更新统计数据 - 根据筛选条件选择合适的统计方式
const updateStats = async () => {
  try {
    // 如果有复杂筛选条件（除店铺外），使用前端分页数据计算
    if (hasComplexFilters.value) {
      fallbackStatsCalculation()
      return
    }

    // 无筛选或仅有店铺筛选时，调用后端统计接口获取准确数据
    const params: any = {}
    if (filters.store_id) params.store_id = filters.store_id

    const response = await api.get('/inventory/stats/overview', { params })

    if (response.success) {
      const data = extractResponseData<any>(response)
      stats.total = data.total || 0
      stats.inStock = data.new_count || 0  // 全新机数量
      stats.sold = data.used_count || 0    // 二手机数量
      stats.totalValue = data.total_value || 0
    } else {
      // 接口失败时使用当前页数据作为备用方案
      fallbackStatsCalculation()
    }
  } catch (error) {
    logger.error('获取统计数据失败:', error)
    // 使用当前页面数据作为备用方案
    fallbackStatsCalculation()
  }
}

// 备用统计计算 - 基于分页数据
const fallbackStatsCalculation = () => {
  stats.total = pagination.total || inventory.value.length
  stats.inStock = inventory.value.filter(item => item.is_new === 1).length
  stats.sold = inventory.value.filter(item => item.is_new === 0).length
  stats.totalValue = inventory.value
    .filter(item => item.status === 'in_stock')
    .reduce((total, item) => total + (item.purchase_price || item.purchase_cost || 0), 0)
}

// 重置筛选
const resetFilters = () => {

  // 重置筛选条件
  Object.assign(filters, {
    supplier_id: '',
    brand: '',
    model: '',
    color: '',
    memory: '',
    store_id: '',
    status: '',
    date_range: '',
    date_start: '',
    date_end: '',
    search: ''
  })

  // 重置CustomSearch的筛选条件
  Object.assign(searchFilters, {
    supplier_id: '',
    brand: '',
    model: '',
    color: '',
    memory: '',
    store_id: '',
    status: '',
    date_range: '',
    search: ''
  })

  // 恢复型号列表为所有型号（而不是清空）
  brandModels.value = [...models.value]

  pagination.page = 1
  loadInventoryData()

}

// 刷新数据
// 刷新数据 - 使用统一的 composable
const handleRefresh = async () => {
  await refresh(async () => {
    await Promise.all([
      loadInventoryData(),
      fetchBasicData()
    ])
  })
  success('数据刷新成功')
}

// 缓存键
const CACHE_KEYS = {
  stores: '/stores:all',
  suppliers: '/suppliers:all',
  brands: '/brands:all',
  models: '/models:all',
  colors: '/colors:all',
  memories: '/memories:all',
  operators: '/operators:all'
}

// 加载门店数据
const loadStores = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.stores, () =>
      api.get('/stores?all=true'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success) {
      let storesArray = Array.isArray(response.data) ? response.data : (response.data?.stores || response.data?.data || [])
      stores.value = storesArray.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    }
  } catch (error) {
    logger.error('加载门店列表失败:', error)
    stores.value = [{ id: 1, name: '总店', code: 'MAIN', status: 1, sort_order: 0 }]
  }
}

// 加载供应商数据
const loadSuppliers = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.suppliers, () =>
      api.get('/suppliers?page=1&limit=1000'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success) {
      let suppliersArray = response.data || []
      if (suppliersArray.data) {
        suppliersArray = suppliersArray.data
      }
      suppliers.value = suppliersArray.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
    }
  } catch (error) {
    logger.error('加载供应商列表失败:', error)
    suppliers.value = []
  }
}

// 从库存数据中动态提取品牌、型号、颜色、内存选项
const extractOptionsFromInventory = () => {
  if (inventory.value.length > 0) {

    const uniqueBrands = [...new Set(inventory.value.map(item => item.brand).filter(Boolean))]
    const uniqueModels = [...new Set(inventory.value.map(item => item.model).filter(Boolean))]
    const uniqueColors = [...new Set(inventory.value.map(item => item.color).filter(Boolean))]
    const uniqueMemories = [...new Set(inventory.value.map(item => item.memory).filter(Boolean))]

    // 合并库存数据和现有数据，避免覆盖API数据
    // 将字符串转换为对象格式
    const uniqueBrandObjects = uniqueBrands.map(name => ({ id: 0, name }))
    const uniqueModelObjects = uniqueModels.map(name => ({ id: 0, name }))

    const mergedBrands = [...brands.value, ...uniqueBrandObjects]
    const mergedModels = [...models.value, ...uniqueModelObjects]
    const mergedColors = [...new Set([...colors.value, ...uniqueColors])]
    const mergedMemories = [...new Set([...memories.value, ...uniqueMemories])]

    // 按字母排序，方便用户查找
    brands.value = mergedBrands.sort((a, b) => {
      const aName = typeof a === 'string' ? a : a.name
      const bName = typeof b === 'string' ? b : b.name
      return aName.localeCompare(bName)
    })
    models.value = mergedModels.sort((a, b) => {
      const aName = typeof a === 'string' ? a : a.name
      const bName = typeof b === 'string' ? b : b.name
      return aName.localeCompare(bName)
    })
    colors.value = mergedColors.sort((a, b) => a.localeCompare(b))
    memories.value = mergedMemories.sort((a, b) => a.localeCompare(b))


    return {
      brands: brands.value.length,
      models: models.value.length,
      colors: colors.value.length,
      memories: memories.value.length
    }
  } else {
    return {
      brands: brands.value.length,
      models: models.value.length,
      colors: colors.value.length,
      memories: memories.value.length
    }
  }
}

// 加载品牌数据（从数据库 brands 表获取所有品牌）
const loadBrands = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.brands, () =>
      api.get('/brands'), DEFAULT_CACHE_TTL.STATIC)

    if (response.success && response.data) {
      // 根据实际响应结构处理数据
      let brandList = Array.isArray(response.data) ? response.data : response.data?.data || response.data?.brands || []

      brands.value = brandList
        .filter(item => item && item.name)  // 过滤掉空值
        .map(item => ({
          id: item.id,
          name: item.name,
          sort_order: item.sort_order || 0
        }))
        .sort((a, b) => a.sort_order - b.sort_order)  // 按 sort_order 排序

    } else {
      brands.value = []
    }
  } catch (error) {
    logger.error('❌ 加载品牌数据失败:', error)
    brands.value = []
  }
}

// 加载型号数据（从数据库 models 表获取所有型号）
const loadModels = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.models, () =>
      api.get('/models'), DEFAULT_CACHE_TTL.STATIC)

    if (response.success && response.data) {
      // 根据实际响应结构处理数据
      let modelList = Array.isArray(response.data) ? response.data : response.data?.data || response.data?.models || []

      models.value = modelList
        .filter(item => item && item.name)  // 过滤掉空值
        .map(item => ({
          id: item.id,
          name: item.name,
          sort_order: item.sort_order || 0
        }))
        .sort((a, b) => a.sort_order - b.sort_order)  // 按 sort_order 排序

    } else {
      models.value = []
    }
  } catch (error) {
    logger.error('❌ 加载型号数据失败:', error)
    models.value = []
  }
}

// 处理品牌变化 - 当用户选择品牌时，更新对应的型号列表
const handleBrandChange = async () => {
  const selectedBrandName = filters.brand

  if (!selectedBrandName) {
    // 如果清空品牌，显示所有型号
    brandModels.value = models.value
  } else {
    // 先通过品牌名称找到品牌ID
    const selectedBrand = brands.value.find(b => b.name === selectedBrandName)
    if (!selectedBrand) {
      brandModels.value = []
      filters.model = ''
      loadInventory()
      return
    }

    const brandId = selectedBrand.id

    // 调用后端 API 获取该品牌下的型号
    try {
      const response = await api.get(`/brands/${brandId}/models`)

      if (response.success && response.data) {
        const modelList = Array.isArray(response.data) ? response.data : []
        brandModels.value = modelList
          .filter(item => item && item.name)
          .map(item => ({
            id: item.id,
            name: item.name,
            sort_order: item.sort_order
          }))
        // 保持后端返回的排序（基于 sort_order），不再重新排序

      } else {
        brandModels.value = []
      }
    } catch (error) {
      logger.error(`❌ 获取品牌 "${selectedBrandName}" 的型号失败:`, error)
      // 如果 API 调用失败，清空型号列表
      brandModels.value = []
    }
  }

  // 清空当前选择的型号（因为品牌变了，之前选择的型号可能不再有效）
  filters.model = ''

  // 重新加载库存数据
  loadInventory()
}

// 获取品牌对应的型号列表（从库存数据中筛选）
const fetchBrandModels = async (brandName: string) => {
  // 这个函数已经不再使用，保留以防万一
  if (!brandName) {
    brandModels.value = []
    return
  }

  try {

    // 从库存数据中筛选该品牌的型号
    if (inventory.value && inventory.value.length > 0) {
      const brandModelSet = new Set(
        inventory.value
          .filter(item => item.brand === brandName)
          .map(item => item.model)
          .filter(Boolean)
      )

      // 将字符串数组转换为对象数组
      brandModels.value = Array.from(brandModelSet)
        .map(name => ({ id: 0, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    } else {
      brandModels.value = []
    }
  } catch (error) {
    logger.error('❌ 获取品牌型号失败:', error)
    brandModels.value = []
  }
}

// 加载操作员数据
const loadOperators = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.operators, () =>
      api.get('/operators'), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      operators.value = response.data
    }
  } catch (error) {
    logger.error('加载操作员列表失败:', error)
    operators.value = []
  }
}

// 加载颜色数据（从数据库 colors 表获取所有颜色）
const loadColors = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.colors, () =>
      api.get('/colors'), DEFAULT_CACHE_TTL.STATIC)

    if (response.success && response.data) {
      // 根据实际响应结构处理数据
      const colorList = Array.isArray(response.data) ? response.data : response.data.colors || []

      colors.value = colorList
        .filter(item => item && item.name)  // 过滤掉空值
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))  // 按 sort_order 排序
        .map(item => item.name)

    } else {
      colors.value = []
    }
  } catch (error) {
    logger.error('❌ 加载颜色数据失败:', error)
    colors.value = []
  }
}

// 加载内存数据（从数据库 memories 表获取所有内存）
const loadMemories = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.memories, () =>
      api.get('/memories', { params: { limit: 10000 } }), DEFAULT_CACHE_TTL.STATIC)

    if (response.success && response.data) {
      // 根据实际响应结构处理数据
      const memoryList = Array.isArray(response.data) ? response.data : response.data.memories || []

      memories.value = memoryList
        .filter(item => item && item.name)  // 过滤掉空值
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))  // 按 sort_order 排序
        .map(item => item.name)

    } else {
      memories.value = []
    }
  } catch (error) {
    logger.error('❌ 加载内存数据失败:', error)
    memories.value = []
  }
}

// 获取基础数据 - 统一调用所有数据加载函数
const fetchBasicData = async () => {
  try {
    // 加载所有筛选数据：店铺、供应商、操作员、品牌、型号、颜色、内存
    await Promise.all([
      loadStores(),
      loadSuppliers(),
      loadOperators(),
      loadBrands(),    // 从数据库加载所有品牌
      loadModels(),    // 从数据库加载所有型号
      loadColors(),    // 从数据库加载所有颜色
      loadMemories()   // 从数据库加载所有内存
    ])

  } catch (error) {
    logger.error('❌ 获取基础数据失败:', error)
  }
}

// 分页处理
const handlePaginationChange = (pag: { page: number; pageSize: number }) => {
  pagination.page = pag.page
  pagination.size = pag.pageSize
  loadInventoryData()
}

// 查看详情
const viewDetails = (item: InventoryItem) => {
  // 安全检查：确保不是误调用
  if (!item || !item.id) {
    return
  }
  selectedItem.value = item
  showDetailsModal.value = true
}

const toDateInputValue = (dateString?: string | null) => {
  if (!dateString) return null

  const rawValue = String(dateString).trim()
  if (!rawValue) return null

  const directMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directMatch) {
    return directMatch[1]
  }

  const normalizedValue = rawValue.replace(' ', 'T')
  const normalizedMatch = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/)
  if (normalizedMatch) {
    return normalizedMatch[1]
  }

  const parsedDate = new Date(rawValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 编辑项目 - 统一使用 watch 填充数据
const editItem = (item: InventoryItem) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  // 检查商品状态，只有在库商品才能编辑
  if (item.status !== 'in_stock') {
    error('只有在库状态的商品才能编辑')
    return
  }

  // 设置选中的设备并打开弹窗（数据填充通过 watch 自动完成）
  selectedPhoneForEdit.value = item
  showEditModal.value = true
}

// 上架商品成功回调
const handlePublishSuccess = () => {
  ElMessage.success('商品已上架到H5商城')
}

// 从详情模态框触发编辑
const handleEditFromModal = () => {
  if (selectedItem.value) {
    // 关闭详情模态框
    showDetailsModal.value = false
    // 延迟一点再打开编辑模态框，确保动画流畅
    setTimeout(() => {
      editItem(selectedItem.value!)
    }, 100)
  }
}

// 从详情模态框触发删除
const handleDeleteFromModal = () => {
  if (selectedItem.value) {
    // 关闭详情模态框
    showDetailsModal.value = false
    // 延迟一点再执行删除
    setTimeout(() => {
      deleteItem(selectedItem.value!)
    }, 100)
  }
}

// 监听编辑弹窗打开，填充表单数据（与销售页面保持一致）
watch(showEditModal, async (newVal) => {
  if (newVal && selectedPhoneForEdit.value) {
    const phone = selectedPhoneForEdit.value as any

    // 打印原始数据用于调试

    // 获取入库员姓名
    const operatorName = phone.inventory_operator_name ||
                         phone.purchase_operator_name ||
                         phone.operator_name ||
                         phone.created_by_name ||
                         authStore.user?.name ||
                         '当前用户'

    // 填充表单数据
    Object.assign(editForm, {
      brand: phone.brand || '',
      model: phone.model || '',
      color: phone.color || '',
      memory: phone.memory || '',
      serial_number: phone.serial_number || '',
      imei: phone.imei || '',
      purchase_cost: (phone.purchase_cost || phone.cost || phone.purchase_price) ? Math.round(Number(phone.purchase_cost || phone.cost || phone.purchase_price || 0)) : null,
      supplier_id: phone.supplier_id || null,
      store_id: phone.store_id || null,
      condition: phone.is_new ? '全新' : '二手',
      status: normalizePhoneStatus(phone.status) || 'in_stock',
      Inventorytime: toDateInputValue(phone.Inventorytime || phone.created_at),
      remarks: phone.remarks || '',
      is_published: phone.is_published ?? 1  // H5上架状态，默认1（上架）
    })

    // 加载 H5_product 的 is_published 状态
    await loadPhonePublishStatus(phone.id)

    // 检测是否为无IMEI模式
    editIsNoIMEIMode.value = detectEditNoIMEIMode(editForm.imei, editForm.serial_number)

    // 如果选择了品牌，加载对应的型号列表
    if (editForm.brand) {
      await fetchEditBrandModels(editForm.brand)
    }
  }
})

// 检测编辑模式是否为无IMEI模式
const detectEditNoIMEIMode = (imei: string | undefined, serialNumber: string | undefined): boolean => {
  if (!imei) return false

  // 1. IMEI包含字母 → 无IMEI模式
  if (/[a-zA-Z]/.test(imei)) {
    return true
  }

  // 2. IMEI与序列号相同且长度不是15位 → 无IMEI模式
  if (imei === serialNumber && imei.length !== 15) {
    return true
  }

  // 3. IMEI长度不是15位 → 无IMEI模式
  if (imei.length !== 15) {
    return true
  }

  return false
}

// 切换编辑模式的无IMEI状态
const toggleEditNoIMEIMode = () => {
  editIsNoIMEIMode.value = !editIsNoIMEIMode.value

  if (editIsNoIMEIMode.value) {
    // 启用无IMEI模式：如果有序列号，自动填充IMEI
    if (editForm.serial_number) {
      editForm.imei = editForm.serial_number
    }
    ElMessage.success('已启用无IMEI模式，IMEI将支持字母+数字')
  } else {
    // 切换回标准模式：清空IMEI，重新输入15位纯数字
    editForm.imei = ''
    ElMessage.info('已切换回标准IMEI模式，需要输入15位纯数字')
  }
}

// 格式化编辑模式的IMEI
const formatEditIMEI = () => {
  if (editForm.imei) {
    if (editIsNoIMEIMode.value) {
      // 无IMEI模式：允许数字和字母，字母转大写
      editForm.imei = editForm.imei
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 30)
    } else {
      // 标准模式：只允许数字
      editForm.imei = editForm.imei.replace(/\D/g, '').slice(0, 15)
    }
  }
}

// 编辑弹窗的品牌变更处理
const onEditBrandChange = async () => {
  editForm.model = ''
  if (editForm.brand) {
    await fetchEditBrandModels(editForm.brand)
  } else {
    editBrandModels.value = []
  }
}

// 获取编辑弹窗品牌对应的型号列表
const fetchEditBrandModels = async (brandName: string) => {
  if (!brandName) {
    editBrandModels.value = []
    return
  }

  const brandNameStr = String(brandName || '').trim()

  if (!brandNameStr) {
    editBrandModels.value = []
    return
  }

  try {
    // 先找到品牌ID
    const brand = brands.value.find((b: any) => b.name === brandNameStr)
    if (!brand) {
      editBrandModels.value = []
      return
    }

    // 使用品牌ID获取型号列表
    const response = await api.get(`/models?brand_id=${brand.id}&status=1`)
    if (response.success) {
      const modelsData = extractResponseData<any[]>(response)

      editBrandModels.value = modelsData
        .filter((m: any) => m && m.name)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m: any) => String(m.name || '').trim())

    } else {
      editBrandModels.value = []
    }
  } catch (err) {
    logger.error('获取型号列表失败:', err)
    editBrandModels.value = []
  }
}

// 提交编辑
const submitEdit = async () => {
  try {
    submitting.value = true

    // 验证必填字段
    // 如果没有IMEI但有序列号，则自动将IMEI设置为序列号（适用于无IMEI的设备如iPad、手表等）
    if (!editForm.imei && editForm.serial_number) {
      editForm.imei = editForm.serial_number
    }

    // 对于手机设备（品牌包含iPhone、小米、华为等），IMEI必须是15位
    // 对于非手机设备（AirPods、iPad等），IMEI可以不是15位
    const isPhoneDevice = /^(iPhone|华为|小米|红米|OPPO|vivo|三星|荣耀|realme|一加|魅族|诺基亚|索尼|LG|摩托罗拉)/i.test(editForm.brand || '')
    if (isPhoneDevice && editForm.imei && editForm.imei.length < 15) {
      error('请输入完整的15位IMEI号')
      return
    }

    // 构建更新数据
    const updateData = {
      brand: editForm.brand || '',
      model: editForm.model || '',
      color: editForm.color || '',
      memory: editForm.memory || '',
      serial_number: editForm.serial_number || '',
      imei: editForm.imei || '',
      purchase_cost: editForm.purchase_cost !== null && editForm.purchase_cost !== undefined && editForm.purchase_cost !== '' ?
        Math.round(Number(editForm.purchase_cost)) : null,
      supplier_id: editForm.supplier_id || null,
      store_id: editForm.store_id || null,
      condition: editForm.condition === '全新' ? 'new' : 'used',
      status: editForm.status || 'in_stock',
      Inventorytime: editForm.Inventorytime ? `${editForm.Inventorytime} 12:00:00` : null,
      remarks: editForm.remarks || ''
    }


    // 发送更新请求
    const response = await api.put(`/phones/${selectedPhoneForEdit.value.id}`, updateData, { showError: false })

    if (response.success) {
      success('更新成功')
      closeEditModal()
      await refreshInventory()
    } else {
      error(response.message || '更新失败')
    }
  } catch (err: any) {
    logger.error('更新失败:', err)
    error(err.message || '更新失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 关闭编辑弹窗
const closeEditModal = () => {
  showEditModal.value = false
  selectedPhoneForEdit.value = null
  editBrandModels.value = []
  // 重置表单数据
  Object.assign(editForm, {
    brand: '',
    model: '',
    color: '',
    memory: '',
    serial_number: '',
    imei: '',
    purchase_cost: null,
    supplier_id: null,
    store_id: null,
    condition: '',
    status: 'in_stock',
    Inventorytime: null,
    remarks: '',
    is_published: 1
  })
}

// 加载商品的上架状态
const loadPhonePublishStatus = async (phoneId: number) => {
  try {
    const response = await api.get(`/phones/${phoneId}/h5-product`)
    if (response.success && response.data) {
      editForm.is_published = response.data.is_published ?? 1
    }
  } catch (error) {
    logger.error('加载上架状态失败:', error)
    // 保持默认值1（上架）
  }
}

// 快速切换上架状态（全新机和二手商品通用）
const handleQuickPublishChange = async (value: number) => {
  if (!selectedPhoneForEdit.value) return

  try {
    // 更新 H5_product 表
    await api.put(`/phones/${selectedPhoneForEdit.value.id}/h5-product`, {
      is_published: value
    })
    const statusText = value === 1 ? '上架' : '下架'
    ElMessage.success(`已${statusText}`)
  } catch (error: any) {
    logger.error('更新上架状态失败:', error)
    ElMessage.error(error.message || '操作失败')
    // 恢复开关状态
    editForm.is_published = editForm.is_published === 1 ? 0 : 1
  }
}

// 关闭详情弹窗
const handleCloseDetails = () => {
  showDetailsModal.value = false
  selectedItem.value = null
}

// 开始入库 - 统一使用弹窗
const handleStartStockIn = () => {
  showStockInModal.value = true
}

// 入库成功回调
const handleStockInSuccess = () => {
  showStockInModal.value = false
  // 刷新库存数据
  refreshInventory()
  success('入库成功！')
}

// 刷新库存数据（用于入库成功后刷新）
const refreshInventory = async () => {
  await loadInventoryData()
}

// 入库取消回调
const handleStockInCancel = () => {
  showStockInModal.value = false
}

const quickSaleItem = (item: InventoryItem) => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  if (item.status !== 'in_stock') {
    warning('只有在库商品才能出库')
    return
  }

  router.push({
    path: '/sales',
    query: {
      sale_phone_id: String(item.id),
      auto_open_sale: '1'
    }
  })
}

// 工具方法
const getStatusClass = (status: string) => {
  return getPhoneStatusClass(status)
}

const getStatusText = (status: string) => {
  return getPhoneStatusLabel(status)
}

// 销售状态（综合判断）
const getSaleStatusClass = (item: InventoryItem) => {
  if (item.is_preordered) return 'reserved'
  if (item.status === 'repair') return 'repair'
  if (item.status === 'sold') return 'sold'
  if (item.status === 'reserved') return 'reserved'
  if (item.status === 'lost') return 'lost'
  return 'in-stock' // 可售
}

const getSaleStatusLabel = (item: InventoryItem) => {
  if (item.is_preordered) return '已预订'
  if (item.status === 'repair') return '维修中'
  if (item.status === 'sold') return '已售'
  if (item.status === 'reserved') return '预留'
  if (item.status === 'lost') return '丢失'
  return '可售'
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '-'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    const matched = String(dateString).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (matched) {
      return `${matched[1]}-${Number(matched[2])}-${Number(matched[3])}`
    }
    return '-'
  }

  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

const formatNumber = (num?: number) => {
  return num?.toLocaleString('zh-CN') || '0'
}

const getInventoryDisplayName = (item: InventoryItem) => {
  const parts = [
    canViewField('brand') ? (item.brand || item.brand_name) : '',
    canViewField('model') ? (item.model || item.model_name) : '',
    canViewField('color') ? (item.color || item.color_name) : '',
    canViewField('memory') ? (item.memory || item.memory_name) : ''
  ].filter(Boolean)

  return parts.length ? parts.join(' ') : `商品 #${item.id}`
}

// 获取成色状态的样式类
const getConditionClass = (isNew: boolean | number | string) => {
  // 处理可能的值：boolean(0/1), string('0'/'1'), number(0/1)
  const isNewValue = Number(isNew)
  return isNewValue === 1 ? 'condition-new' : 'condition-used'
}

// 获取成色状态的文本
const getConditionText = (isNew: boolean | number | string) => {
  // 处理可能的值：boolean(0/1), string('0'/'1'), number(0/1)
  const isNewValue = Number(isNew)
  return isNewValue === 1 ? '全新' : '二手'
}



// 删除商品
const deleteItem = async (item: InventoryItem) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    const identityParts = [getInventoryDisplayName(item)]

    if (canViewField('imei') && item.imei) {
      identityParts.push(`IMEI: ${item.imei}`)
    } else if (canViewField('serial_number') && item.serial_number) {
      identityParts.push(`序列号: ${item.serial_number}`)
    }

    await ElMessageBox.confirm(
      `确定要删除商品“${identityParts.join('，')}”吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loadingStore.setLoading(true)

    const response = await api.delete(`/inventory/${item.id}`, { showError: false })

    if (response.success) {
      success('商品删除成功')
      await loadInventoryData()
    } else {
      error(response.message || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('❌ 删除商品失败:', error)

      // 权限相关错误处理
      if (error.response?.status === 403) {
        error('权限不足，无法删除商品')
      } else if (error.response?.status === 401) {
        error('登录已过期，请重新登录')
      } else {
        error(error.response?.data?.message || '删除失败')
      }
    }
  } finally {
    loadingStore.setLoading(false)
  }
}

// 导出库存数据
const exportInventory = async () => {
  await exportFile({
    url: '/inventory/export',
    filename: buildDateFilename('库存数据', 'xlsx'),
    allowed: canExport,
    loading: exporting,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '库存数据导出成功',
    errorMessage: '导出失败',
    onError: (error) => {
      logger.error('导出失败:', error)
      ElMessage.error('导出失败')
    }
  })
}


// GlobalSearch 事件处理方法（增强版 - 智能识别搜索内容）
const handleGlobalSearch = async (query: string, filterValues: Record<string, any>) => {

  // 清空当前页码，从第1页开始显示结果
  pagination.page = 1

  // 智能分析搜索查询并自动填充筛选条件
  const intelligentFilters = await analyzeSearchQuery(query)

  // 合并筛选条件：用户选择的 + 智能识别的
  Object.assign(filters, filterValues, intelligentFilters)


  // 构建API参数 - 包含所有筛选条件
  const apiParams: any = {
    page: pagination.page,
    limit: pagination.size
  }

  // 添加品牌筛选
  if (filters.brand && filters.brand.trim()) {
    apiParams.brand = filters.brand.trim()
  }

  // 添加型号筛选
  if (filters.model && filters.model.trim()) {
    apiParams.model = filters.model.trim()
  }

  // 添加颜色筛选
  if (filters.color && filters.color.trim()) {
    apiParams.color = filters.color.trim()
  }

  // 添加内存筛选
  if (filters.memory && filters.memory.trim()) {
    apiParams.memory = filters.memory.trim()
  }

  // 添加店铺筛选
  if (filters.store_id) {
    apiParams.store_id = filters.store_id
  }

  // 添加状态筛选
  if (filters.phone_condition) {
    apiParams.status = filters.phone_condition
  }

  // 如果还有未识别的通用搜索查询，也添加到API参数
  const remainingQuery = getRemainingSearchQuery(query, filters)
  if (remainingQuery && remainingQuery.trim()) {
    apiParams.search = remainingQuery.trim()
  }


  // 执行API调用
  await loadInventoryData(apiParams)
}

// 智能分析搜索查询的函数
const analyzeSearchQuery = async (query: string) => {
  const detectedFilters: Record<string, any> = {}

  if (!query || !query.trim()) {
    return detectedFilters
  }


  // 品牌别名映射表
  const brandAliases: Record<string, string> = {
    '苹果': 'Apple',
    '苹果公司': 'Apple',
    'iphone': 'Apple',
    '华为': 'Huawei',
    '荣耀': 'Honor',
    '小米': 'Xiaomi',
    '米': 'Xiaomi',
    '红米': 'Redmi',
    'oppo': 'OPPO',
    'vivo': 'vivo',
    '步步高': 'vivo',
    '三星': 'Samsung',
    '萨姆': 'Samsung',
    'oneplus': 'OnePlus',
    '一加': 'OnePlus',
    'plus': 'OnePlus',
    '魅族': 'Meizu',
    '美图': 'Meitu',
    '锤子': 'Smartisan',
    '坚果': 'Smartisan',
    '摩托罗拉': 'Motorola',
    ' moto': 'Motorola',
    '联想': 'Lenovo',
    'zuk': 'Lenovo',
    '中兴': 'ZTE',
    '努比亚': 'Nubia',
    '酷派': 'Coolpad',
    '乐视': 'LeEco',
    '360': 'Qiku',
    '奇酷': 'Qiku',
    '谷歌': 'Google',
    'pixel': 'Google',
    'htc': 'HTC',
    'lg': 'LG',
    '索尼': 'Sony',
    '索爱': 'Sony',
    '诺基亚': 'Nokia',
    '微软': 'Microsoft',
    'lumia': 'Microsoft'
  }

  // 颜色别名映射表
  const colorAliases: Record<string, string> = {
    '红': '红色',
    '红红': '红色',
    '蓝': '蓝色',
    '蓝蓝': '蓝色',
    '黑': '黑色',
    '黑黑': '黑色',
    '白': '白色',
    '白白': '白色',
    '金': '金色',
    '黄金': '金色',
    '银': '银色',
    '银色': '银色',
    '灰': '灰色',
    '灰色': '灰色',
    '粉': '粉色',
    '粉红': '粉色',
    '玫瑰金': '粉色',
    '紫': '紫色',
    '绿': '绿色',
    '青': '青色',
    '橙': '橙色',
    '黄': '黄色',
    '棕': '棕色',
    '咖啡色': '棕色',
    '透明': '透明色'
  }

  // 内存规格映射表
  const memoryAliases: Record<string, string> = {
    '128': '128GB',
    '256': '256GB',
    '512': '512GB',
    '1t': '1TB',
    '1tb': '1TB',
    '1000': '1TB',
    '1024': '1TB',
    '2t': '2TB',
    '2tb': '2TB',
    '2000': '2TB',
    '2048': '2TB',
    '64': '64GB',
    '32': '32GB',
    '16': '16GB',
    '8': '8GB',
    '4': '4GB'
  }

  // 分词处理 - 支持中英文混合，按空格和常见分隔符分割
  const searchTerms = query.toLowerCase()
    .split(/[\s，,、]+/)
    .filter(term => term.trim())
    .map(term => term.trim())


  // 逐个分析搜索词
  for (const term of searchTerms) {
    // 检测品牌
    if (!detectedFilters.brand) {
      // 首先检查别名映射
      const mappedBrand = brandAliases[term]
      let matchedBrand = null

      if (mappedBrand) {
        matchedBrand = brands.value.find(brand =>
          (typeof brand === 'string' ? brand : brand.name).toLowerCase() === mappedBrand.toLowerCase()
        )
      } else {
        // 直接匹配品牌列表
        matchedBrand = brands.value.find(brand => {
          const brandName = typeof brand === 'string' ? brand : brand.name
          return brandName.toLowerCase() === term ||
            brandName.toLowerCase().includes(term) ||
            term.includes(brandName.toLowerCase()) ||
            brandName.toLowerCase().replace(/\s+/g, '') === term ||
            term.replace(/\s+/g, '') === brandName.toLowerCase()
        })
      }

      if (matchedBrand) {
        detectedFilters.brand = matchedBrand

        // 如果识别到品牌，提前加载对应型号
        await fetchBrandModels(matchedBrand)
        continue
      }
    }

    // 检测颜色
    if (!detectedFilters.color) {
      // 首先检查别名映射
      const mappedColor = colorAliases[term]
      let matchedColor = null

      if (mappedColor) {
        matchedColor = colors.value.find(color =>
          color.toLowerCase() === mappedColor.toLowerCase()
        )
      } else {
        // 直接匹配颜色列表
        matchedColor = colors.value.find(color =>
          color.toLowerCase() === term ||
          color.toLowerCase().includes(term) ||
          term.includes(color.toLowerCase())
        )
      }

      if (matchedColor) {
        detectedFilters.color = matchedColor
        continue
      }
    }

    // 检测内存
    if (!detectedFilters.memory) {
      // 首先检查别名映射
      const mappedMemory = memoryAliases[term]
      let matchedMemory = null

      if (mappedMemory) {
        matchedMemory = memories.value.find(memory =>
          memory.toLowerCase() === mappedMemory.toLowerCase()
        )
      } else {
        // 直接匹配内存列表，支持多种格式
        matchedMemory = memories.value.find(memory =>
          memory.toLowerCase() === term ||
          memory.toLowerCase().includes(term) ||
          term.includes(memory.toLowerCase()) ||
          (term.includes('gb') && memory.toLowerCase().includes('gb')) ||
          (term.includes('tb') && memory.toLowerCase().includes('tb')) ||
          (memory.includes('GB') && term === memory.replace('GB', '')) ||
          (memory.includes('TB') && term === memory.replace('TB', ''))
        )
      }

      if (matchedMemory) {
        detectedFilters.memory = matchedMemory
        continue
      }
    }

    // 检测型号（在品牌型号列表或全局型号列表中查找）
    if (!detectedFilters.model) {
      const allModels = [...brandModels.value, ...models.value]
      const matchedModel = allModels.find(model => {
        const modelName = typeof model === 'string' ? model : model.name
        return modelName.toLowerCase() === term ||
          modelName.toLowerCase().includes(term) ||
          term.includes(modelName.toLowerCase()) ||
          modelName.toLowerCase().replace(/\s+/g, '') === term ||
          term.replace(/\s+/g, '') === modelName.toLowerCase() ||
          // 支持常见的型号格式变体
          modelName.toLowerCase().replace(/[-\s]/g, '') === term.replace(/[-\s]/g, '') ||
          term.replace(/[-\s]/g, '') === modelName.toLowerCase().replace(/[-\s]/g, '')
      })

      if (matchedModel) {
        detectedFilters.model = matchedModel
        continue
      }
    }
  }

  return detectedFilters
}

// 获取剩余的未识别搜索查询
const getRemainingSearchQuery = (query: string, filters: Record<string, any>) => {
  if (!query || !query.trim()) {
    return ''
  }

  let remainingQuery = query

  // 品牌别名反向映射（用于从识别的品牌找到可能的搜索词）
  const brandReverseAliases: Record<string, string[]> = {
    'Apple': ['苹果', '苹果公司', 'iphone'],
    'Huawei': ['华为'],
    'Honor': ['荣耀'],
    'Xiaomi': ['小米', '米', '红米'],
    'OPPO': ['oppo'],
    'vivo': ['vivo', '步步高'],
    'Samsung': ['三星', '萨姆'],
    'OnePlus': ['oneplus', '一加', 'plus'],
    'Meizu': ['魅族'],
    'Meitu': ['美图'],
    'Smartisan': ['锤子', '坚果'],
    'Motorola': ['摩托罗拉', 'moto'],
    'Lenovo': ['联想', 'zuk'],
    'ZTE': ['中兴'],
    'Nubia': ['努比亚'],
    'Coolpad': ['酷派'],
    'LeEco': ['乐视'],
    'Qiku': ['360', '奇酷'],
    'Google': ['谷歌', 'pixel'],
    'HTC': ['htc'],
    'LG': ['lg'],
    'Sony': ['索尼', '索爱'],
    'Nokia': ['诺基亚'],
    'Microsoft': ['微软', 'lumia']
  }

  // 颜色别名反向映射
  const colorReverseAliases: Record<string, string[]> = {
    '红色': ['红', '红红'],
    '蓝色': ['蓝', '蓝蓝'],
    '黑色': ['黑', '黑黑'],
    '白色': ['白', '白白'],
    '金色': ['金', '黄金'],
    '银色': ['银', '银色'],
    '灰色': ['灰', '灰色'],
    '粉色': ['粉', '粉红', '玫瑰金'],
    '紫色': ['紫'],
    '绿色': ['绿'],
    '青色': ['青'],
    '橙色': ['橙'],
    '黄色': ['黄'],
    '棕色': ['棕', '咖啡色'],
    '透明色': ['透明']
  }

  // 内存别名反向映射
  const memoryReverseAliases: Record<string, string[]> = {
    '128GB': ['128'],
    '256GB': ['256'],
    '512GB': ['512'],
    '1TB': ['1t', '1tb', '1000', '1024'],
    '2TB': ['2t', '2tb', '2000', '2048'],
    '64GB': ['64'],
    '32GB': ['32'],
    '16GB': ['16'],
    '8GB': ['8'],
    '4GB': ['4']
  }

  // 移除已识别的筛选条件（包括别名）
  if (filters.brand) {
    const brandTerms = [filters.brand.toLowerCase()]
    if (brandReverseAliases[filters.brand]) {
      brandTerms.push(...brandReverseAliases[filters.brand])
    }

    for (const term of brandTerms) {
      remainingQuery = remainingQuery.replace(new RegExp(term, 'gi'), '').trim()
    }
  }

  if (filters.model) {
    remainingQuery = remainingQuery.replace(new RegExp(filters.model, 'gi'), '').trim()
  }

  if (filters.color) {
    const colorTerms = [filters.color.toLowerCase()]
    if (colorReverseAliases[filters.color]) {
      colorTerms.push(...colorReverseAliases[filters.color])
    }

    for (const term of colorTerms) {
      remainingQuery = remainingQuery.replace(new RegExp(term, 'gi'), '').trim()
    }
  }

  if (filters.memory) {
    const memoryTerms = [filters.memory.toLowerCase()]
    if (memoryReverseAliases[filters.memory]) {
      memoryTerms.push(...memoryReverseAliases[filters.memory])
    }

    for (const term of memoryTerms) {
      remainingQuery = remainingQuery.replace(new RegExp(term, 'gi'), '').trim()
    }
  }

  // 清理多余的分隔符和空格
  remainingQuery = remainingQuery
    .replace(/[\s，,、]+/g, ' ')
    .trim()

  return remainingQuery
}

// 切换高级搜索显示状态
const toggleAdvancedSearch = () => {
  // 如果在桌面端，切换桌面端搜索状态
  if (!mobileDetection.isMobile) {
    showDesktopSearch.value = !showDesktopSearch.value
  } else {
    // 移动端切换移动端搜索状态
    showAdvancedSearch.value = !showAdvancedSearch.value
  }
}

const handleGlobalReset = () => {
  // 重置所有筛选条件
  Object.keys(filters).forEach(key => {
    filters[key] = ''
  })

  // 清空品牌型号联动数据
  brandModels.value = []

  // 重置分页并重新加载数据
  pagination.page = 1
  loadInventoryData()
}

// 实时搜索输入处理方法（带防抖）
const handleSimpleSearchInput = () => {
  // 清除之前的防抖定时器
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  // 设置新的防抖定时器（500ms后执行搜索）
  searchDebounceTimer = setTimeout(async () => {
    await handleSimpleSearch()
  }, 500)
}

// 简化搜索处理方法
const handleSimpleSearch = async () => {
  if (!simpleSearchQuery.value || !simpleSearchQuery.value.trim()) {
    // 如果搜索框为空，重置搜索
    clearSimpleSearch()
    return
  }


  // 清空当前页码，从第1页开始显示结果
  pagination.page = 1

  // 使用智能分析来识别搜索内容
  const intelligentFilters = await analyzeSearchQuery(simpleSearchQuery.value)

  // 如果有识别到的筛选条件，使用筛选搜索；否则使用通用搜索
  if (Object.keys(intelligentFilters).length > 0) {

    // 清空其他筛选条件，只使用智能识别的
    Object.keys(filters).forEach(key => {
      filters[key] = intelligentFilters[key] || ''
    })

    // 构建API参数
    const apiParams: any = {
      page: pagination.page,
      limit: pagination.size
    }

    // 添加识别的筛选条件
    Object.keys(intelligentFilters).forEach(key => {
      if (intelligentFilters[key]) {
        apiParams[key] = intelligentFilters[key]
      }
    })

    // 获取剩余的未识别搜索查询
    const remainingQuery = getRemainingSearchQuery(simpleSearchQuery.value, intelligentFilters)
    if (remainingQuery && remainingQuery.trim()) {
      apiParams.search = remainingQuery.trim()
    }

    await loadInventoryData(apiParams)
  } else {

    // 通用搜索
    const apiParams = {
      page: pagination.page,
      limit: pagination.size,
      search: simpleSearchQuery.value.trim()
    }

    await loadInventoryData(apiParams)
  }
}

// 清空简化搜索
const clearSimpleSearch = () => {
  simpleSearchQuery.value = ''

  // 重置所有筛选条件并重新加载数据
  handleGlobalReset()
}

const handleFilterChange = (key: string, value: any) => {

  // 更新对应的筛选值
  if (key === 'batch') {
    // 批量更新
    Object.assign(filters, value)
  } else {
    filters[key] = value
  }

  // 处理品牌型号联动
  if (key === 'brand' || key === 'brand-changed') {
    const brandValue = key === 'brand-changed' ? value : (value.brand || value)
    filters.model = ''

    // 获取该品牌对应的型号列表
    if (brandValue) {
      fetchBrandModels(brandValue)
    } else {
      brandModels.value = []
    }
  }


  // 如果是移动端，不自动触发搜索，让用户手动点击应用筛选
  if (!mobileDetection.isMobile) {
    // 重置分页并重新加载数据以应用筛选条件
    pagination.page = 1
    loadInventoryData()
  } else {
  }
}

// 移动端筛选方法
const resetMobileFilters = () => {

  // 重置所有筛选条件
  Object.assign(filters, {
    brand: '',
    model: '',
    color: '',
    memory: '',
    supplier_id: '',
    store_id: '',
    operator_id: '',
    is_new: '',
    date_range: '',
    date_start: '',
    date_end: '',
    search: ''
  })

  // 清空品牌型号联动数据
  brandModels.value = []

  // 重新加载数据
  pagination.page = 1
  loadInventoryData()

  // 关闭高级搜索
  showAdvancedSearch.value = false
}

const applyMobileFilters = () => {

  // 重置分页并重新加载数据
  pagination.page = 1
  loadInventoryData()

  // 关闭高级搜索
  showAdvancedSearch.value = false
}

const handleDateRangeChange = () => {
  // 日期变化后自动触发搜索
  pagination.page = 1
  loadInventoryData()
}

const handleQuickSearch = () => {

  if (!filters.search || !filters.search.trim()) {
    // 如果搜索框为空，重置搜索
    resetFilters()
    return
  }

  // 重置分页
  pagination.page = 1

  // 直接使用搜索词，后端会进行智能识别
  const searchQuery = filters.search.trim()

  // 构建API参数
  const apiParams = {
    page: pagination.page,
    limit: pagination.size,
    search: searchQuery
  }

  // 添加筛选条件（除了搜索外的其他筛选）
  Object.keys(filters).forEach(key => {
    if (filters[key] && key !== 'search') {
      // 直接传递 date_start 和 date_end，不合并为 date_range
      apiParams[key] = filters[key]
    }
  })

  loadInventoryData(apiParams)
}



// 生命周期
// 确保权限数据已加载
const ensurePermissionsLoaded = async (): Promise<void> => {
  // 如果已有权限数据，直接返回
  if (authStore.user && normalizedInventoryPermissions.value.length > 0) {
    return
  }

  // 可以在这里添加权限加载逻辑
}

onMounted(async () => {
  // 首先确保权限数据已加载
  permissionLoading.value = true
  try {
    await ensurePermissionsLoaded()
  } catch (error) {
    logger.error('初始化权限加载失败:', error)
  } finally {
    permissionLoading.value = false
  }

  // 检查是否有页面访问权限
  if (!canView.value) {
    return
  }

  // 优先加载库存数据，让用户快速看到列表
  // 基础数据并行加载，不阻塞页面显示
  const initialInventoryLoad = Promise.allSettled([
    loadInventoryData(),
    initFieldPermissions()
  ])

  // 在后台延后加载基础数据，避免和首屏列表抢占请求
  initialInventoryLoad.finally(() => {
    basicDataWarmupTimer = setTimeout(() => {
      fetchBasicData().then(() => {
        // 初始化型号列表为所有型号
        brandModels.value = [...models.value]
      }).catch(error => {
        logger.error('❌ 基础数据加载失败:', error)
      })
    }, 800)
  })

  // 检查 URL 参数，如果有 openStockIn=true 则自动打开入库模态框
  if (route.query.openStockIn === 'true') {
    showStockInModal.value = true
    // 清除 URL 参数，避免刷新时再次打开
    router.replace({ query: {} })
  }

  // 添加窗口大小监听
  window.addEventListener('resize', updateWindowWidth)
})

// 清理监听器
onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)

  // 清理所有触摸定时器
  touchTimers.value.forEach(timer => clearTimeout(timer))
  touchTimers.value.clear()
  lastTapTime.value.clear()

  if (basicDataWarmupTimer) {
    clearTimeout(basicDataWarmupTimer)
  }
})

// 添加缺失的方法
const getConditionTagType = (isNew: number | undefined) => {
  return isNew === 1 ? 'success' : 'warning'
}

const handleSelect = (item: InventoryItem) => {
  // 安全检查：确保不是误调用
  if (!item || !item.id) {
    return
  }
  selectedItem.value = item
  showDetailsModal.value = true
}
</script>

<style>
.inventory-edit-content {
  padding: 0;
}

.inventory-edit-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.inventory-edit-form-shell {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
}

.inventory-edit-form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

/* 序列号和IMEI行容器 */
.inventory-edit-serial-imei-row {
  grid-column: span 3;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.inventory-edit-price-field {
  grid-column: span 1;
}

.inventory-edit-remarks-field {
  grid-column: span 3;
}

.inventory-edit-price-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inventory-edit-price-input {
  flex: 0 0 132px;
  width: 132px !important;
}

.inventory-edit-publish-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inventory-edit-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 10px;
  padding-top: 2px;
}

.inventory-edit-footer.has-config {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.inventory-edit-footer :deep(.el-button) {
  width: 100%;
  min-height: 46px;
  height: 46px;
  border-radius: 14px;
  font-size: 15px;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.inventory-edit-footer :deep(.el-button > span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1;
}

.inventory-edit-dialog .el-select,
.inventory-edit-dialog .el-date-editor.el-input,
.inventory-edit-dialog .el-date-editor.el-input__wrapper,
.inventory-edit-dialog .el-input-number {
  width: 100% !important;
}

.inventory-edit-dialog .el-select__wrapper,
.inventory-edit-dialog .el-input__wrapper,
.inventory-edit-dialog .el-textarea__inner,
.inventory-edit-dialog .el-input-number .el-input__wrapper {
  min-height: 42px;
}

.inventory-edit-select-popper .el-select-dropdown__item,
.inventory-edit-select-popper .el-picker-panel__shortcut {
  min-height: 40px;
  line-height: 1.4;
}

/* 隐藏入库时间日期选择器的图标 */
.inventory-edit-dialog .el-input__prefix,
.inventory-edit-dialog .el-input__suffix,
.inventory-edit-form-grid .el-date-picker .el-input__prefix,
.inventory-edit-form-grid .el-date-picker .el-input__suffix {
  display: none !important;
}

.inventory-edit-dialog .el-input__prefix-inner,
.inventory-edit-dialog .el-input__suffix-inner {
  display: none !important;
}

.inventory-edit-dialog {
  --dialog-side-gap: 4px;
  --dialog-vertical-gap: 24px;
  --dialog-max-width: calc(100vw - 8px);
  --mobile-dialog-body-padding: 8px 4px 8px;
  --mobile-dialog-footer-padding: 0 4px 4px;
}

.inventory-edit-dialog .el-dialog,
.inventory-detail-dialog .el-dialog {
  margin: auto !important;
  max-width: calc(100vw - 32px) !important;
  overflow: hidden;
}

.inventory-edit-dialog .el-dialog {
  width: min(900px, calc(100vw - 32px)) !important;
  border-radius: 24px !important;
}

.inventory-detail-dialog .el-dialog {
  width: min(800px, calc(100vw - 32px)) !important;
  border-radius: 20px !important;
}

.inventory-edit-dialog .el-dialog__body {
  padding: 28px !important;
  background: #ffffff !important;
}

.inventory-edit-dialog .el-dialog__footer {
  padding: 18px 28px 28px !important;
  background: #ffffff !important;
  border-top: 1px solid rgba(15, 23, 42, 0.06) !important;
}

.inventory-detail-dialog .el-dialog__body,
.inventory-detail-dialog .el-dialog__footer {
  padding: 0 !important;
  background: #ffffff !important;
}

@media (max-width: 768px) {
  .inventory-edit-dialog .el-dialog,
  .inventory-detail-dialog .el-dialog {
    width: calc(100vw - 8px) !important;
    max-width: calc(100vw - 8px) !important;
    border-radius: 18px !important;
  }

  .mobile-dialog-sheet-overlay.inventory-edit-dialog {
    padding: 8px 4px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-header {
    min-height: calc(66px + env(safe-area-inset-top)) !important;
    padding: calc(10px + env(safe-area-inset-top)) 52px 10px 16px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-title {
    font-size: 16px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-close {
    top: calc(10px + env(safe-area-inset-top)) !important;
    right: 14px !important;
    transform: none !important;
  }

  .inventory-edit-dialog .el-dialog__body {
    padding: 8px 4px !important;
  }

  .inventory-edit-dialog .el-dialog__footer {
    padding: 0 4px 4px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-body {
    padding: 8px 4px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-footer {
    padding: 0 4px 4px !important;
  }

  .inventory-edit-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .inventory-edit-form-shell {
    padding: 12px 10px;
    border-radius: 12px;
  }

  .inventory-edit-form-grid {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 0.92fr) minmax(118px, 1.16fr);
    gap: 10px;
  }

  .inventory-edit-serial-imei-row {
    grid-column: span 3;
  }

  .inventory-edit-price-field {
    grid-column: span 1;
  }

  .inventory-edit-remarks-field {
    grid-column: span 3;
  }

  .inventory-edit-price-input {
    flex: 0 0 82px;
    width: 82px !important;
  }

  .inventory-edit-price-row {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .inventory-edit-publish-actions {
    flex: 0 0 auto;
    min-width: fit-content;
    flex-shrink: 0;
    justify-content: flex-start;
  }

  .inventory-edit-footer {
    gap: 8px;
  }

  .inventory-edit-footer .el-button {
    width: 100%;
    min-width: 0;
    padding-inline: 10px;
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .inventory-edit-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .inventory-edit-form-shell {
    padding: 10px 8px;
  }

  .inventory-edit-form-grid {
    grid-template-columns: minmax(0, 0.88fr) minmax(0, 0.88fr) minmax(112px, 1.24fr);
  }

  .inventory-edit-price-input {
    flex: 0 0 74px;
    width: 74px !important;
  }
}

@media (max-width: 480px) {
  .inventory-edit-dialog {
    --dialog-vertical-gap: 24px;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-header {
    min-height: calc(62px + env(safe-area-inset-top)) !important;
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px !important;
  }

  .mobile-dialog-sheet-panel.inventory-edit-dialog .mobile-dialog-sheet-close {
    top: calc(8px + env(safe-area-inset-top)) !important;
    right: 14px !important;
  }

  /* 手机端：保持3列布局，但序列号和IMEI占据2列 */
  .inventory-edit-form-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  /* 序列号和IMEI行占据3列，内部分成两个字段 */
  .inventory-edit-serial-imei-row {
    grid-column: span 3;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .inventory-edit-price-field {
    grid-column: span 1;
  }

  .inventory-edit-remarks-field {
    grid-column: span 3;
  }
}

@media (max-width: 390px) and (min-height: 800px) {
  .inventory-detail-dialog .el-dialog {
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    border-radius: 0 !important;
  }
}
</style>

<style scoped>
.inventory-view {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;
}

/* 模态框头部 */
.inventory-modal-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0;
}

.modal-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 16px;
}

.modal-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.modal-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: white;
}

.modal-subtitle {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 400;
}

.modal-close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
}

.modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* 模态框内容 */
.inventory-modal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.details-container {
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 详情卡片 */
.detail-card {
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.2s ease;
}

.detail-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.card-header {
  background: white;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.card-icon.price-icon {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.card-content {
  padding: 20px;
}

/* 信息表格 */
.info-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  border: 1px solid #e2e8f0;
}

.table-row {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row.full-width-row {
  background: #f8fafc;
}

.table-cell {
  flex: 1;
  padding: 12px 16px;
  font-size: 14px;
  display: flex;
  align-items: center;
  min-height: 48px;
}

.label-cell {
  font-weight: 600;
  color: #374151;
  background: #f9fafb;
  border-right: 1px solid #e2e8f0;
  min-width: 120px;
  max-width: 120px;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.value-cell {
  color: #1f2937;
  font-weight: 500;
  background: white;
  word-break: break-word;
}

.value-cell.price-cell {
  color: #10b981;
  font-weight: 700;
  font-size: 16px;
}

.full-width-row .label-cell {
  background: #f1f5f9;
}

.full-width-row .value-cell {
  background: #f8fafc;
}

/* 保留原来的网格样式作为备用 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 14px;
  color: #1f2937;
  font-weight: 500;
}

/* 价格显示 */
.price-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.price-label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.price-value {
  font-size: 20px;
  font-weight: 700;
  color: #10b981;
}

/* 备注卡片 */
.remarks-card .card-content {
  padding: 16px 20px;
}

.remarks-text {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
  font-size: 14px;
  line-height: 1.6;
  color: #374151;
  font-style: italic;
}

/* 模态框底部 */
.inventory-modal-footer {
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  padding: 20px 32px;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 确保详情模态框按钮使用全局样式 */
.footer-actions .el-button {
  min-width: 120px;
  height: 44px;
  font-size: 15px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-header-content {
    padding: 20px 24px;
  }

  .modal-title {
    font-size: 20px;
  }

  .modal-icon {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }

  .details-container {
    padding: 20px 24px;
    gap: 16px;
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  /* 移动端表格样式 */
  .info-table {
    border-radius: 6px;
  }

  .table-row {
    flex-direction: column;
    border-bottom: none;
    background: white;
    margin-bottom: 8px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .table-row:last-child {
    margin-bottom: 0;
  }

  .table-row.full-width-row {
    background: white;
  }

  .table-cell {
    padding: 10px 12px;
    min-height: auto;
    border-bottom: 1px solid #f3f4f6;
  }

  .table-cell:last-child {
    border-bottom: none;
  }

  .label-cell {
    background: #f8fafc;
    border-right: none;
    min-width: auto;
    max-width: none;
    font-size: 11px;
  }

  .value-cell {
    background: white;
  }

  .full-width-row .label-cell,
  .full-width-row .value-cell {
    background: white;
  }

  .card-header {
    padding: 14px 16px;
  }

  .card-content {
    padding: 16px;
  }

  .inventory-modal-footer {
    padding: 16px 24px;
  }

  .footer-actions {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }

  .footer-actions .el-button {
    width: auto;
    flex: 1;
    min-width: calc(50% - 4px);
    font-size: 14px;
    height: 40px;
  }
}

/* ===== 桌面端搜索样式 ===== */
.desktop-search-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  overflow: hidden;
}

/* 简化搜索栏样式 */
.simple-search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  user-select: none;
  transition: all 0.3s ease;
}

.simple-search-bar:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
}

.simple-search-bar .search-input-wrapper {
  position: relative;
  flex: 1;
  max-width: 500px;
  cursor: text;
}

.simple-search-bar .search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 16px;
  z-index: 2;
  pointer-events: none;
}

.simple-search-input {
  width: 100%;
  height: 44px;
  padding: 0 48px 0 44px;
  border: none;
  border-radius: 22px;
  font-size: 15px;
  background: rgba(255, 255, 255, 0.95);
  color: #2c3e50;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.simple-search-input:focus {
  outline: none;
  background: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.simple-search-input::placeholder {
  color: #6c757d;
  font-style: italic;
}

.search-clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c757d;
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.2s ease;
  z-index: 2;
}

.search-clear-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #495057;
}

.expand-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.expand-indicator:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
}

.expand-indicator i {
  font-size: 12px;
  transition: transform 0.3s ease;
}

/* 高级筛选内容样式 */
.advanced-search-content {
  background: white;
  border-radius: 0 0 8px 8px;
  border-top: 1px solid #e8ecef;
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 600px;
  }
}

.advanced-search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e8ecef;
}

.advanced-search-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.close-advanced {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-advanced:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #495057;
}

.advanced-search-body {
  padding: 20px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .simple-search-bar {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .simple-search-bar .search-input-wrapper {
    max-width: 100%;
  }

  .expand-indicator {
    width: 100%;
    justify-content: center;
    font-size: 12px;
    padding: 8px 12px;
  }

  .advanced-search-body {
    padding: 16px;
  }
}
@media (max-width: 480px) {
  .simple-search-input {
    height: 40px;
    font-size: 14px;
    padding: 0 40px 0 38px;
  }

  .expand-indicator {
    font-size: 11px;
    padding: 6px 10px;
  }

  .advanced-search-header {
    padding: 12px 16px 8px;
  }

  .advanced-search-body {
    padding: 12px;
  }
}

.desktop-search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #909399;
  z-index: 1;
}

.desktop-search-input {
  width: 100%;
  height: 40px;
  padding: 0 40px 0 36px;
  border: 1px solid #dcdfe6;
  border-radius: 20px;
  font-size: 14px;
  background: #f5f7fa;
  transition: all 0.3s;
}

.desktop-search-input:focus {
  outline: none;
  border-color: #409eff;
  background: white;
}

.clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #909399;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.clear-btn:hover {
  background: #f0f0f0;
  color: #606266;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #dcdfe6;
  border-radius: 20px;
  background: white;
  color: #606266;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.expand-btn:hover {
  border-color: #409eff;
  color: #409eff;
}

.expand-btn.active {
  background: #409eff;
  border-color: #409eff;
  color: white;
}

.desktop-advanced-search {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e8ecef;
}

.user-info-section {
  margin-right: 16px;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

/* 统计卡片样式 - 参考销售页面布局，PC端4个一行，手机端2个一行 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr); /* PC端固定4列 */
  gap: 20px;
  margin: 0 0 24px 0;

  /* 大屏幕优化 */
  @media (min-width: 1400px) {
    gap: 24px;
  }

  /* 中等屏幕调整 */
  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }

  /* 平板调整 */
  @media (max-width: 992px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin: 0 0 20px 0;
  }

  /* 手机端调整 - 参考销售页面，使用自适应布局但保持2个一行 */
  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    margin: 0 0 16px 0;
  }

  /* 小屏手机调整 - 保持2个一行，参考销售页面 */
  @media (max-width: 480px) {
    gap: 12px;
    margin: 0 0 12px 0;
    grid-template-columns: repeat(2, 1fr); /* 强制2列，确保2个一行 */
  }

  /* 超小屏幕优化 - 保持2个一行 */
  @media (max-width: 375px) {
    gap: 8px;
    margin: 0 0 8px 0;
    grid-template-columns: repeat(2, 1fr); /* 强制2列，确保2个一行 */
  }

  /* 加载状态动画 */
  &.loading .stat-card {
    animation: slideInUp 0.6s ease-out;
  }
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
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--card-accent, linear-gradient(90deg, var(--el-color-primary), var(--el-color-success)));
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  /* 平板调整 */
  @media (max-width: 992px) {
    padding: 20px;
    gap: 14px;
  }

  /* 手机端调整 - 参考销售页面，保持水平布局 */
  @media (max-width: 768px) {
    padding: 16px;
    gap: 12px;
  }

  /* 小屏手机调整 - 参考销售页面，保持水平布局，2个一行 */
  @media (max-width: 480px) {
    padding: 12px;
    gap: 10px;
  }

  /* 超小屏幕优化 */
  @media (max-width: 375px) {
    padding: 10px;
    gap: 8px;
  }
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.12);

  &::before {
    opacity: 1;
  }

  .stat-value {
    color: var(--el-color-primary);
    transform: scale(1.02);
  }

  .stat-label {
    color: var(--el-text-color-regular);
    opacity: 0.9;
  }

  .stat-icon {
    transform: scale(1.1) rotate(5deg);
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
  }
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
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);

  /* 平板调整 */
  @media (max-width: 992px) {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }

  /* 手机端调整 - 2个一行时适中的图标 */
  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
    font-size: 16px;
    margin: 0 auto 4px;
  }

  /* 小屏幕调整 - 单个一行时稍大的图标 */
  @media (max-width: 480px) {
    width: 36px;
    height: 36px;
    font-size: 14px;
    margin: 0 auto 6px;
  }
}

.stat-icon.in-stock {
  background: linear-gradient(135deg, #28a745, #20c997);
}

.stat-icon.sold {
  background: linear-gradient(135deg, #dc3545, #fd7e14);
}

/* 为每个统计卡片设置不同的图标颜色和顶部边框 */
.stat-card:nth-child(1) {
  --card-accent: linear-gradient(90deg, #667eea, #764ba2);
}

.stat-card:nth-child(1) .stat-icon {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.stat-card:nth-child(2) {
  --card-accent: linear-gradient(90deg, #28a745, #20c997);
}

.stat-card:nth-child(2) .stat-icon {
  background: linear-gradient(135deg, #28a745, #20c997);
}

.stat-card:nth-child(3) {
  --card-accent: linear-gradient(90deg, #ffc107, #ff9800);
}

.stat-card:nth-child(3) .stat-icon {
  background: linear-gradient(135deg, #ffc107, #ff9800);
}

.stat-card:nth-child(4) {
  --card-accent: linear-gradient(90deg, #17a2b8, #6f42c1);
}

.stat-card:nth-child(4) .stat-icon {
  background: linear-gradient(135deg, #17a2b8, #6f42c1);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
  line-height: 1.2;
  transition: all 0.3s ease;

  /* 平板调整 */
  @media (max-width: 992px) {
    font-size: 22px;
  }

  /* 手机端调整 - 2个一行时适中的字体 */
  @media (max-width: 768px) {
    font-size: 20px;
    margin-bottom: 2px;
  }

  /* 小屏幕调整 - 单个一行时稍大的字体 */
  @media (max-width: 480px) {
    font-size: 18px;
    margin-bottom: 3px;
  }
}

.stat-label {
  font-size: 14px;
  color: #6c757d;
  font-weight: 500;
  line-height: 1.4;
  transition: all 0.3s ease;

  /* 平板调整 */
  @media (max-width: 992px) {
    font-size: 13px;
  }

  /* 手机端调整 - 2个一行时适中的字体 */
  @media (max-width: 768px) {
    font-size: 12px;
  }

  /* 小屏幕调整 - 单个一行时稍大的字体 */
  @media (max-width: 480px) {
    font-size: 11px;
  }
}

/* 基础表单组样式 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 14px;
  z-index: 1;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e8ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: #f8f9fa;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
  background: white;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-actions {
  display: flex;
  gap: 12px;
  grid-column: 1 / -1;
}

/* 按钮样式 - 参考销售页面 */
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
  text-decoration: none;
}

.btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.btn:hover::before {
  width: 300px;
  height: 300px;
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
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: 2px solid transparent;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
}

.btn-outline-secondary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-outline-primary {
  background: white;
  color: #007bff;
  border: 2px solid #007bff;
}

.btn-outline-primary:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #007bff;
}

.btn-outline-success {
  background: white;
  color: #28a745;
  border: 2px solid #28a745;
}

.btn-outline-success:hover:not(:disabled) {
  background: #f8fff9;
  border-color: #28a745;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.2);
}

.btn-danger {
  background: linear-gradient(135deg, #dc3545, #e74c3c);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #c82333, #c0392b);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

/* 表格区域样式 - 参考品牌页面 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.table-responsive {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 0;
  background: white;
}

.data-table th {
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

.data-table th:last-child {
  border-right: none;
}

.data-table th::after {
  display: none;
}

.data-table td {
  padding: 6px 6px;
  border-right: 1px solid #e9ecef;
  border-bottom: 1px solid #e9ecef;
  vertical-align: middle;
  font-size: 14px;
  color: #2c3e50;
  font-weight: 500;
  text-align: center;
  position: relative;
}

.data-table td:last-child {
  border-right: none;
}

.data-table tbody tr {
  transition: all 0.2s ease;
  position: relative;
}

.data-table tbody tr:nth-child(even) {
  background: #f8f9fa;
}

.data-table tbody tr:hover {
  background: #e3f2fd;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.data-table tbody tr:hover td {
  border-bottom-color: #dee2e6;
}

.imei {
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #495057;
  letter-spacing: 0.8px;
  background: #f8f9fa;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  display: inline-block;
  min-width: 80px;
  text-align: center !important;
  position: relative;
}

.imei:hover {
  background: #e9ecef;
  border-color: #dee2e6;
  transform: scale(1.02);
  transition: all 0.2s ease;
}

/* 特殊列样式 */
.data-table td:nth-child(1), /* 供应商列 */
.data-table td:nth-child(2), /* 品牌列 */
.data-table td:nth-child(3) { /* 型号列 */
  font-weight: 600;
  color: #2c3e50;
  background: rgba(102, 126, 234, 0.03);
}

.data-table td:nth-child(8), /* 入库价格列 */
.data-table td:nth-child(10) { /* 店铺列 */
  font-weight: 600;
  color: #495057;
  background: rgba(40, 167, 69, 0.05);
}

.data-table td:nth-child(9) { /* 入库员列 */
  font-weight: 500;
  color: #6c757d;
  font-style: italic;
}

/* 状态徽章样式 - 参考品牌页面 */
.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-badge.in-stock {
  background: #d4edda;
  color: #155724;
}

.status-badge.sold {
  background: #fff2e8;
  color: #fa8c16;
}

.status-badge.reserved {
  background: #d1ecf1;
  color: #0c5460;
}

/* 成色状态样式 */
.condition-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.condition-new {
  background-color: #f0f9ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.condition-used {
  background-color: #fefce8;
  color: #a16207;
  border: 1px solid #fde047;
}

/* 状态样式 - 参考综合查询页面 */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px;
  color: #ffffff !important;
}

.status-badge.in-stock {
  background: #28a745 !important;
  color: #ffffff !important;
}

.status-badge.sold {
  background: #6c757d !important;
  color: #ffffff !important;
}

.status-badge.reserved {
  background: #17a2b8 !important;
  color: #ffffff !important;
}

.status-badge.repair {
  background: #f59e0b !important;
  color: #ffffff !important;
}

.status-badge.lost {
  background: #dc3545 !important;
  color: #ffffff !important;
}

/* 价格样式 */
.price {
  font-weight: 600;
  color: #2c3e50;
}

.price.positive {
  color: #28a745;
}

.price.negative {
  color: #dc3545;
}

/* 权限拒绝页面样式 - 与其他页面保持一致的背景可见样式 */
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

/* ===== 权限加载中样式 ===== */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  background: #f8f9fa;
  border-radius: 12px;
  margin: 20px 0;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e9ecef;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 权限禁用样式 */
.permission-disabled {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #9ca3af;
  cursor: not-allowed;
  font-size: 14px;
}

.permission-disabled:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

/* 操作按钮样式 - 参考销售页面 */
.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}

.action-buttons .btn {
  white-space: nowrap;
}


/* 查看按钮 - 蓝色边框 */
.action-buttons .btn-outline-primary {
  background: white;
  color: #007bff;
  border-color: #007bff;
}

.action-buttons .btn-outline-primary:hover {
  background: #007bff;
  color: white;
  border-color: #0056b3;
}

/* 编辑按钮 - 蓝色边框 */
.action-buttons .btn-outline-primary:hover {
  background: #007bff;
  color: white;
  border-color: #0056b3;
}

/* 删除按钮 - 红色 */
.action-buttons .btn-danger {
  background: linear-gradient(135deg, #dc3545, #e74c3c);
  color: white;
  border-color: #dc3545;
}

.action-buttons .btn-danger:hover {
  background: linear-gradient(135deg, #c82333, #c0392b);
  border-color: #bd2130;
}

/* 按钮加载状态 */
.action-buttons .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-buttons .btn:disabled .fa-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 空状态样式 */
.empty-state {
  text-align: center;
  color: #6c757d;
  padding: 60px 20px;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 16px;
}

/* 分页样式 */
.pagination-wrapper {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 6px 0;
}

/* 条件样式 */
.condition-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.condition-new {
  background: #d4edda;
  color: #155724;
}

.condition-used {
  background: #f8d7da;
  color: #721c24;
}


.text-center {
  text-align: center;
}

.py-8 {
  padding: 32px 0;
}

.dialog-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* 可编辑下拉框样式 */
.editable-select {
  position: relative;
  width: 100%;
}

.editable-select .form-control {
  padding-right: 60px;
}

.clear-icon {
  position: absolute;
  right: 36px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  cursor: pointer;
  font-size: 12px;
  z-index: 2;
}

.clear-icon:hover {
  color: #dc3545;
}

.dropdown-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  cursor: pointer;
  font-size: 12px;
  z-index: 2;
}

.dropdown-icon:hover {
  color: #495057;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #dee2e6;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  list-style: none;
  margin: 0;
  padding: 0;
}

.dropdown-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f8f9fa;
  font-size: 14px;
  color: #495057;
  transition: all 0.2s ease;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover,
.dropdown-item.highlighted {
  background: #667eea;
  color: white;
}

.dropdown-item.new-item {
  background: #f8f9fa;
  color: #667eea;
  font-weight: 500;
}

.dropdown-item.new-item:hover {
  background: #e7f3ff;
}

.dropdown-item i {
  margin-right: 6px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .inventory-view {
    padding: 4px 0;
  }

  .header-content {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  .header-left {
    flex: 1;
    min-width: 120px;
  }

  .action-buttons {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
    width: auto;
  }

  /* 主要操作按钮 - 保持文字 */
  .action-buttons .btn-primary {
    min-width: 70px;
    padding: 8px 14px;
    font-size: 12px;
    gap: 6px;
  }

  .action-buttons .btn-primary i {
    font-size: 12px;
  }

  /* 次要按钮 - 可以只显示图标 */
  .action-buttons .btn-outline-secondary {
    min-width: 36px;
    padding: 8px 12px;
    font-size: 11px;
    gap: 4px;
  }

  .action-buttons .btn-outline-secondary i {
    font-size: 12px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr); /* 手机端保持2个一行 */
    gap: 12px;
    margin: 0 0 16px 0;
  }

  .form-actions {
    flex-direction: column;
  }

  .table-section {
    padding: 8px 2px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
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

  .loading-container {
    margin: 10px;
    min-height: 50vh;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    margin-bottom: 16px;
  }
}

/* ===== 移动端搜索样式 ===== */
.mobile-search-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
  padding: 16px;
}

.mobile-search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-search-input {
  flex: 1;
  height: 40px;
  border: 1px solid #dcdfe6;
  border-radius: 20px;
  padding: 0 16px 0 40px;
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;
}

.mobile-search-input:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.mobile-advanced-search {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.simple-filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-row {
  display: flex;
  gap: 12px;
}

.filter-select {
  flex: 1;
  height: 36px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 14px;
  background: white;
  outline: none;
  transition: all 0.3s ease;
}

.filter-select:focus {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

/* 移动端筛选操作按钮 */
.filter-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding: 0 4px;
}

.filter-btn {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  i {
    font-size: 12px;
  }
}

.filter-btn-reset {
  background: #f8f9fa;
  color: #6c757d;
  border: 1px solid #e9ecef;

  &:hover {
    background: #e9ecef;
    color: #495057;
    transform: translateY(-1px);
  }
}

.filter-btn-apply {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;

  &:hover {
    background: linear-gradient(135deg, #5a6fd8, #6a4190);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
}

@media (max-width: 768px) {
  /* 移动端搜索框样式 */
  .mobile-search-bar .search-input-wrapper {
    position: relative;
    flex: 1;
  }

  .mobile-search-bar .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #909399;
    z-index: 1;
  }

  .mobile-search-bar .clear-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #909399;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  .mobile-search-bar .clear-btn:hover {
    color: #409eff;
    background: rgba(64, 158, 255, 0.1);
  }

  .mobile-search-bar .expand-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 16px 32px;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    background: #f5f7fa;
    color: #606266;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .mobile-search-bar .expand-btn:hover {
    border-color: #409eff;
    color: #409eff;
    background: #ecf5ff;
  }

  .mobile-search-bar .expand-btn.active {
    background: #409eff;
    color: white;
    border-color: #409eff;
  }

  .mobile-search-bar .expand-btn i {
    font-size: 12px;
  }
}

/* ===== 移动端卡片样式 ===== */
.mobile-cards-container {
  padding: 0;
}

.mobile-empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-text {
    margin: 0;
    font-size: 16px;
  }
}

.inventory-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.inventory-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e8ecef;
  overflow: hidden;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
  }

  .card-header {
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e8ecef;

    .phone-info {
      flex: 1;

      .brand-model {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .brand {
          font-weight: 700;
          font-size: 16px;
          color: #2c3e50;
          background: linear-gradient(135deg, #667eea, #764ba2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .model {
          font-weight: 600;
          font-size: 14px;
          color: #495057;
        }
      }
    }

    .card-actions {
      display: flex;
      gap: 8px;
    }
  }

  .card-content {
    padding: 16px;

    .info-row {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      align-items: flex-start;

      &:last-child {
        margin-bottom: 0;
      }

      .info-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;

        &.full-width {
          flex: 1 1 100%;
        }

        .info-label {
          font-size: 12px;
          font-weight: 500;
          color: #6c757d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 14px;
          font-weight: 500;
          color: #2c3e50;
          word-break: break-all;

          &.price {
            color: #28a745;
            font-weight: 600;
            font-size: 16px;
          }

          &.serial-number,
          &.imei {
            font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
            font-size: 12px;
            background: #f8f9fa;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
          }
        }
      }
    }
  }
}

/* 卡片进入动画 */
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 移动端卡片动画 */
.inventory-card {
  animation: slideInUp 0.5s ease-out;

  &:nth-child(2) {
    animation-delay: 0.1s;
  }

  &:nth-child(3) {
    animation-delay: 0.2s;
  }

  &:nth-child(4) {
    animation-delay: 0.3s;
  }

  &:nth-child(5) {
    animation-delay: 0.4s;
  }
}

/* 移动端筛选器响应式优化 */
@media (max-width: 480px) {
  .filter-row {
    gap: 8px;
  }

  .filter-select {
    height: 36px;
    font-size: 13px;
    padding: 0 10px;
  }

  .filter-actions {
    gap: 8px;
    margin-top: 12px;
  }

  .filter-btn {
    height: 36px;
    font-size: 13px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 360px) {
  .filter-row {
    gap: 6px;
  }

  .filter-select {
    height: 32px;
    font-size: 12px;
    padding: 0 8px;
  }

  .filter-actions {
    gap: 6px;
    margin-top: 10px;
  }

  .filter-btn {
    height: 32px;
    font-size: 12px;
    padding: 0 12px;
  }
}

</style>
/* ===== 手机端卡片网格布局 ===== */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}

@media (max-width: 768px) {
  /* 仅在移动端确保占据全宽 */
  .grid-container {
    width: 100vw;
    margin-left: calc(-50vw + 50%);
    margin-right: calc(-50vw + 50%);
    padding-left: 16px;
    padding-right: 16px;
    box-sizing: border-box;
  }
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .grid-container {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
    padding-left: 12px;
    padding-right: 12px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 375px) {
  .grid-container {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    padding-left: 8px;
    padding-right: 8px;
  }
}

.device-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
  border-color: #28a745;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .device-card {
    padding: 12px;
    gap: 8px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 375px) {
  .device-card {
    padding: 10px;
    gap: 6px;
    border-radius: 8px;
  }
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.device-header .device-brand {
  font-weight: 600;
  font-size: 16px;
  color: #2c3e50;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-header .device-model {
  font-weight: 500;
  font-size: 14px;
  color: #6c757d;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .device-header .device-brand {
    font-size: 14px;
  }

  .device-header .device-model {
    font-size: 12px;
  }
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.device-info .info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.device-info .info-row .label {
  color: #6c757d;
  font-weight: 500;
  min-width: 60px;
  flex-shrink: 0;
}

.device-info .info-row .value {
  color: #495057;
  font-weight: 500;
  text-align: right;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.device-info .info-row .value.price {
  color: #28a745;
  font-weight: 600;
}

.device-info .info-row .value.remark {
  font-size: 12px;
  color: #6c757d;
  text-align: left;
  line-height: 1.4;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .device-info .info-row {
    font-size: 12px;
  }

  .device-info .info-row .label {
    min-width: 50px;
    font-size: 11px;
  }

  .device-info .info-row .value {
    font-size: 11px;
  }

  .device-info .info-row .value.remark {
    font-size: 10px;
  }
}

.device-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
  margin-top: auto;
}

/* 小屏幕优化 */
@media (max-width: 480px) {
  .device-actions {
    gap: 6px;
    padding-top: 6px;
  }
}

.mobile-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.mobile-empty-state .empty-icon {
  font-size: 48px;
  color: #6c757d;
  margin-bottom: 16px;
}

.mobile-empty-state .empty-text {
  font-size: 16px;
  color: #6c757d;
  margin: 0;
}

/* 桌面端分页样式优化 */
.pagination-wrapper {
  padding: 20px 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 6px 0;
  margin-top: 8px;
}

/* 移动端表格优化 */
.table-mobile-friendly {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table-mobile-friendly .data-table {
  min-width: 800px; /* 确保表格有最小宽度，可以横向滚动 */
  font-size: 14px;
}

/* 所有手机端适配 (480px 及以下) - 参考综合查询表格样式 */
@media (max-width: 480px) {
  /* 通用移动端表格样式 - 适配所有手机端 */
  .data-table {
    font-size: 11px;
  }

  .data-table th {
    font-size: 11px;
    padding: 6px 4px;
    letter-spacing: 0.3px;
  }

  .data-table th,
  .data-table td {
    white-space: nowrap;
  }

  .data-table td {
    padding: 6px 4px;
    font-size: 11px;
  }

  .data-table .btn-sm {
    padding: 3px 6px;
    font-size: 10px;
  }

  .table-mobile-friendly .data-table {
    font-size: 11px;
  }

  .table-mobile-friendly .data-table th {
    font-size: 11px;
    padding: 6px 4px;
    letter-spacing: 0.3px;
  }

  .table-mobile-friendly .data-table th,
  .table-mobile-friendly .data-table td {
    white-space: nowrap;
  }

  .table-mobile-friendly .data-table td {
    padding: 6px 4px;
    font-size: 11px;
  }

  .table-mobile-friendly .data-table .btn-sm {
    padding: 3px 6px;
    font-size: 10px;
  }

}

/* 平板适配 (481px - 768px) */
@media (min-width: 481px) and (max-width: 768px) {
  .data-table {
    font-size: 11px;
  }

  .data-table th {
    font-size: 11px;
    padding: 10px 6px;
    letter-spacing: 0.3px;
  }

  .data-table th,
  .data-table td {
    white-space: nowrap;
  }

  .data-table td {
    padding: 8px 6px;
    font-size: 10px;
  }

  .data-table .btn-sm {
    padding: 3px 6px;
    font-size: 10px;
  }

  .table-mobile-friendly .data-table {
    font-size: 11px;
  }

  .table-mobile-friendly .data-table th {
    font-size: 11px;
    padding: 10px 6px;
    letter-spacing: 0.3px;
  }

  .table-mobile-friendly .data-table th,
  .table-mobile-friendly .data-table td {
    white-space: nowrap;
  }

  .table-mobile-friendly .data-table td {
    padding: 8px 6px;
    font-size: 10px;
  }

  .table-mobile-friendly .data-table .btn-sm {
    padding: 3px 6px;
    font-size: 10px;
  }
}

/* 小屏幕手机适配 (360px 及以下) */
@media (max-width: 360px) {
  .data-table {
    font-size: 9px;
  }

  .data-table th {
    font-size: 9px;
    padding: 8px 4px;
    letter-spacing: 0.2px;
  }

  .data-table th,
  .data-table td {
    white-space: nowrap;
  }

  .data-table td {
    padding: 6px 4px;
    font-size: 8px;
  }

  .data-table .btn-sm {
    padding: 2px 4px;
    font-size: 9px;
  }

  .table-mobile-friendly .data-table {
    font-size: 9px;
  }

  .table-mobile-friendly .data-table th {
    font-size: 9px;
    padding: 8px 4px;
    letter-spacing: 0.2px;
  }

  .table-mobile-friendly .data-table td {
    padding: 6px 4px;
    font-size: 8px;
  }

  .table-mobile-friendly .data-table .btn-sm {
    padding: 2px 4px;
    font-size: 9px;
  }
}

/* iPhone SE (390x844) 适配 - 最低适配尺寸 */
@media (max-width: 390px) and (min-height: 800px) {
  .modal-header-content {
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .modal-title-group {
    padding-right: 45px;
  }

  .modal-title {
    font-size: 18px;
    line-height: 1.3;
  }

  .modal-subtitle {
    font-size: 12px;
    margin-top: 2px;
  }

  .modal-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .modal-close-btn {
    width: 32px;
    height: 32px;
    top: 50%;
    transform: translateY(-50%);
  }

  .details-container {
    padding: 12px 16px;
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .detail-card {
    margin-bottom: 16px;
    border-radius: 8px;
  }

  .card-header {
    padding: 10px 12px;
  }

  .card-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .card-title {
    font-size: 14px;
  }

  .card-content {
    padding: 12px;
  }

  .info-table {
    font-size: 13px;
  }

  .table-cell {
    padding: 8px 12px;
    min-height: 36px;
    font-size: 13px;
  }

  .table-cell.label-cell {
    font-size: 11px;
    min-width: 80px;
    max-width: 80px;
  }

  .inventory-modal-footer {
    padding: 12px 16px;
    position: sticky;
    bottom: 0;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
  }

  .footer-actions {
    gap: 10px;
  }

  .footer-actions .el-button {
    min-height: 40px;
    padding: 0 16px;
    font-size: 14px;
    flex: 1;
  }
}

/* 编辑弹窗样式已使用内联样式，此处保留旧样式以备后用 */

/* ===== 移动端适配 ===== */

/* 小屏手机优化 (≤480px) */
@media (max-width: 480px) {
  .inventory-view {
    padding: 4px 0;
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }

  body,
  html {
    overflow-x: hidden;
    width: 100%;
  }

  .table-section {
    padding: 10px 4px;
    margin-bottom: 10px;
    border-radius: 8px;
    width: 100%;
    box-sizing: border-box;
  }

  .table-section {
    padding: 8px 2px;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
  }

  .table-responsive {
    overflow-x: hidden;
    margin: 0;
    border-radius: 8px;
    width: 100%;
    max-width: 100%;
  }

  /* 表格边框优化 */
  .data-table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
  }

  /* 统计卡片 - 小屏幕2列布局 */
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .stat-card {
    padding: 6px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    min-height: 55px;
    width: 100%;
    box-sizing: border-box;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
    flex-shrink: 0;
  }

  .stat-content {
    flex: 1;
    text-align: right;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 600;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 11px;
    line-height: 1.2;
  }

  /* 表格样式 */
  .data-table {
    font-size: 11px;
    table-layout: fixed;
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .data-table th,
  .data-table td {
    padding: 10px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    line-height: 1.3;
  }

  /* 表头字体更小 - 自适应 */
  .data-table th {
    font-size: clamp(8px, 1.5vw, 9px);
    font-weight: 600;
  }

  /* 4列布局优化 - 型号、颜色、内存、序列号 - 字体自适应 */
  .data-table th:nth-child(1), /* 型号列 */
  .data-table td:nth-child(1) {
    width: 35%;
    font-size: clamp(9px, 2vw, 10px);
    font-weight: 600;
  }

  .data-table th:nth-child(2), /* 颜色列 */
  .data-table td:nth-child(2) {
    width: 20%;
    font-size: clamp(9px, 2vw, 10px);
  }

  .data-table th:nth-child(3), /* 内存列 */
  .data-table td:nth-child(3) {
    width: 18%;
    font-size: clamp(8px, 1.8vw, 9px);
  }

  .data-table th:nth-child(4), /* 序列号列 */
  .data-table td:nth-child(4) {
    width: 27%;
    font-size: clamp(9px, 2vw, 10px);
    font-weight: 500;
  }

  /* 确保所有单元格内容单行显示 */
  .data-table td {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  /* 分页 */
  .pagination-wrapper {
    flex-wrap: wrap;
    justify-content: center;
  }

  .pagination button,
  .pagination select {
    font-size: 12px;
    padding: 6px 10px;
  }

  /* 移动端数据行可点击样式 */
  .data-row {
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .data-row:active {
    background-color: #f0f0f0;
  }

  .inventory-modal-header {
    padding: 16px;
  }

  .modal-title {
    font-size: 18px;
  }

  .modal-subtitle {
    font-size: 14px;
  }

  .inventory-modal-body {
    padding: 16px;
    max-height: calc(90vh - 140px);
    overflow-y: auto;
  }

  .detail-card {
    margin-bottom: 12px;
  }

  .card-header {
    padding: 12px;
  }

  .card-content {
    padding: 12px;
  }

  .info-table {
    font-size: 13px;
  }

  .table-cell {
    padding: 8px 6px;
    font-size: 12px;
  }

  .table-cell.label-cell {
    font-size: 11px;
    min-width: 70px;
    max-width: 70px;
  }

  .footer-actions {
    flex-direction: column;
    gap: 8px;
  }

  .footer-actions .el-button {
    width: 100%;
    flex: none;
  }

}

/* 第二个480px断点 - 全局滚动和触摸优化 */
@media (max-width: 480px) {
  * {
    -webkit-overflow-scrolling: touch !important;
  }

  body {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    position: fixed !important;
    touch-action: pan-y pinch-zoom !important;
  }

  html {
    overflow-x: hidden !important;
    width: 100% !important;
    position: fixed !important;
  }

  #app {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
    height: 100vh !important;
    position: relative !important;
  }

  .inventory-view {
    overflow-x: hidden !important;
    width: 100% !important;
    max-width: 100vw !important;
    position: relative !important;
  }

  /* 按钮文字显示控制 */
  .btn-text-desktop {
    display: none !important;
  }

  .btn-text-mobile {
    display: inline !important;
  }
}

/* 430px断点 - 专门为430*932分辨率优化 */
@media (max-width: 430px) {
  /* 表格优化 - 确保四个字段一行展示 */
  .data-table {
    font-size: clamp(9px, 1.6vw, 11px);
    table-layout: fixed;
    width: 100%;
  }

  .data-table th,
  .data-table td {
    padding: 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
    line-height: 1.25;
  }

  /* 表头字体更小 - 自适应 */
  .data-table th {
    font-size: clamp(8px, 1.4vw, 9px);
    font-weight: 600;
  }

  /* 4列布局优化 - 字体自适应 */
  .data-table th:nth-child(1), /* 型号列 */
  .data-table td:nth-child(1) {
    width: 35%;
    font-size: clamp(9px, 1.9vw, 10px);
    font-weight: 600;
  }

  .data-table th:nth-child(2), /* 颜色列 */
  .data-table td:nth-child(2) {
    width: 20%;
    font-size: clamp(9px, 1.9vw, 10px);
  }

  .data-table th:nth-child(3), /* 内存列 */
  .data-table td:nth-child(3) {
    width: 18%;
    font-size: clamp(8px, 1.7vw, 9px);
  }

  .data-table th:nth-child(4), /* 序列号列 */
  .data-table td:nth-child(4) {
    width: 27%;
    font-size: clamp(9px, 1.9vw, 10px);
    font-weight: 500;
  }

  /* 确保所有单元格内容单行显示 */
  .data-table td {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
}

/* 超小屏幕优化（375px及以下 - iPhone SE） */
@media (max-width: 375px) {
  .inventory-view {
    padding: 4px 0;
  }

  .header-actions .el-button span {
    font-size: 9px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
    flex-shrink: 0;
  }

  /* 统计卡片优化 */
  .stats-cards {
    gap: 4px;
  }

  .stat-card {
    padding: 10px;
    min-height: 60px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .stat-value {
    font-size: 16px;
  }

  .stat-label {
    font-size: 10px;
  }

  /* 表格区域优化 */
  .table-section {
    padding: 4px 0;
    margin-bottom: 4px;
  }

  /* 表格优化 - 确保四个字段一行展示 */
  .data-table {
    font-size: clamp(8px, 1.5vw, 9px);
    table-layout: fixed;
    width: 100%;
  }

  .data-table th,
  .data-table td {
    padding: 6px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  /* 表头字体更小 - 自适应 */
  .data-table th {
    font-size: clamp(7px, 1.3vw, 8px);
    font-weight: 600;
  }

  /* 四列布局 - 型号、颜色、内存、序列号一行展示 - 字体自适应 */
  .data-table th:nth-child(1),
  .data-table td:nth-child(1) {
    width: 35%;
    font-size: clamp(8px, 1.8vw, 9px);
    font-weight: 600;
  }

  .data-table th:nth-child(2),
  .data-table td:nth-child(2) {
    width: 20%;
    font-size: clamp(8px, 1.8vw, 9px);
  }

  .data-table th:nth-child(3),
  .data-table td:nth-child(3) {
    width: 18%;
    font-size: clamp(7px, 1.5vw, 8px);
  }

  .data-table th:nth-child(4),
  .data-table td:nth-child(4) {
    width: 27%;
    font-size: clamp(8px, 1.8vw, 9px);
  }

  /* 确保所有单元格内容单行显示 */
  .data-table td {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  /* 分页组件优化 */
  .pagination-wrapper {
    padding: 10px;
  }
}

/* 360px断点 - 为430*932等中等尺寸屏幕优化 */
@media (max-width: 360px) {
  /* 表格优化 */
  .data-table {
    font-size: clamp(7px, 1.4vw, 9px);
    table-layout: fixed;
    width: 100%;
  }

  .data-table th,
  .data-table td {
    padding: 5px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.15;
  }

  /* 表头字体更小 - 自适应 */
  .data-table th {
    font-size: clamp(7px, 1.3vw, 8px);
    font-weight: 600;
  }

  /* 四列布局 - 字体自适应 */
  .data-table th:nth-child(1),
  .data-table td:nth-child(1) {
    width: 35%;
    font-size: clamp(8px, 1.7vw, 9px);
    font-weight: 600;
  }

  .data-table th:nth-child(2),
  .data-table td:nth-child(2) {
    width: 20%;
    font-size: clamp(8px, 1.7vw, 9px);
  }

  .data-table th:nth-child(3),
  .data-table td:nth-child(3) {
    width: 18%;
    font-size: clamp(7px, 1.5vw, 8px);
  }

  .data-table th:nth-child(4),
  .data-table td:nth-child(4) {
    width: 27%;
    font-size: clamp(8px, 1.7vw, 9px);
    font-weight: 500;
  }

  /* 确保所有单元格内容单行显示 */
  .data-table td {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
}

/* 超超小屏幕优化（320px及以下） */
@media (max-width: 320px) {
  .inventory-view {
    padding: 4px 0;
  }

  /* 统计卡片优化 */
  .stat-card {
    padding: 6px;
    min-height: 50px;
  }

  .stat-icon {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  /* 表格区域优化 */
  .table-section {
    padding: 2px 0;
    margin-bottom: 2px;
  }

  /* 表格优化 */
  .data-table {
    font-size: clamp(7px, 1.5vw, 8px);
  }

  .data-table th,
  .data-table td {
    padding: 4px 0;
    line-height: 1.1;
  }

  /* 表头字体更小 - 自适应 */
  .data-table th {
    font-size: clamp(6px, 1.2vw, 7px);
  }

  /* 四列布局 - 字体自适应 */
  .data-table th:nth-child(1),
  .data-table td:nth-child(1) {
    width: 34%;
    font-size: clamp(7px, 1.6vw, 8px);
  }

  .data-table th:nth-child(2),
  .data-table td:nth-child(2) {
    width: 20%;
    font-size: clamp(7px, 1.6vw, 8px);
  }

  .data-table th:nth-child(3),
  .data-table td:nth-child(3) {
    width: 17%;
    font-size: clamp(6px, 1.4vw, 7px);
  }

  .data-table th:nth-child(4),
  .data-table td:nth-child(4) {
    width: 29%;
    font-size: clamp(7px, 1.6vw, 8px);
  }

/* ===== 商品详情模态框移动端优化 ===== */
@media (max-width: 767px) {
  .modal-header-content {
    padding: 14px 16px;
    position: sticky;
    top: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 10;
    border-radius: 16px 16px 0 0;
  }

  .modal-title-group {
    gap: 10px;
  }

  .modal-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }

  .modal-title {
    font-size: 16px;
  }

  .modal-subtitle {
    font-size: 12px;
  }

  .modal-close-btn {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .inventory-modal-body {
    padding: 0;
    max-height: calc(90vh - 120px);
  }

  .details-container {
    padding: 14px 16px;
    gap: 14px;
  }

  /* 详情卡片优化 */
  .detail-card {
    border-radius: 10px;
    overflow: hidden;
  }

  .card-header {
    padding: 12px 14px;
  }

  .card-icon {
    width: 28px;
    height: 28px;
    font-size: 13px;
  }

  .card-title {
    font-size: 14px;
  }

  .card-content {
    padding: 12px;
  }

  /* 信息表格优化 */
  .info-table {
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .table-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    background: transparent;
    border: none;
    margin-bottom: 0;
  }

  .table-row:last-child {
    margin-bottom: 0;
  }

  .table-row.full-width-row {
    flex-wrap: nowrap;
  }

  /* 每个label-cell和value-cell组合成一个字段单元 */
  .table-cell {
    width: 50%;
    padding: 10px;
    min-height: auto;
    box-sizing: border-box;
  }

  /* 重新组织:每两个单元格组成一个完整字段 */
  .table-cell.label-cell {
    width: 35%;
    padding-right: 4px;
    text-align: left;
    font-weight: 600;
    color: #64748b;
    font-size: 11px;
    display: flex;
    align-items: center;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    border-left: 1px solid #e2e8f0;
  }

  .table-cell.value-cell {
    width: 15%;
    padding-left: 4px;
    text-align: left;
    font-weight: 500;
    color: #1e293b;
    font-size: 11px;
    word-break: break-word;
    display: flex;
    align-items: center;
    background: white;
    border-top: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
  }

  /* 调整边框,让每两个字段形成一行 */
  .table-cell:nth-child(4n+1),
  .table-cell:nth-child(4n+2) {
    border-bottom: 1px solid #e2e8f0;
  }

  .table-cell:nth-child(4n+2),
  .table-cell:nth-child(4n+4) {
    border-right: none;
  }

  /* 全宽行的特殊处理 */
  .table-row.full-width-row .table-cell {
    width: 50%;
  }

  .table-row.full-width-row .table-cell:first-child {
    border-left: 1px solid #e2e8f0;
  }

  .table-row.full-width-row .table-cell:last-child {
    border-right: none;
    background: white;
  }

  /* 机况徽章 */
  .condition-badge {
    font-size: 11px;
    padding: 3px 8px;
  }

  /* 价格单元格 */
  .price-cell {
    font-size: 14px;
  }

  /* 备注卡片 */
  .remarks-card .remarks-text {
    font-size: 13px;
    line-height: 1.5;
  }

  /* 底部操作栏 */
  .inventory-modal-footer {
    padding: 12px 16px;
    position: sticky;
    bottom: 0;
    background: white;
    border-top: 1px solid #e2e8f0;
    z-index: 10;
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  .footer-actions .el-button {
    flex: 1;
    height: 42px;
    font-size: 14px;
  }

  .footer-actions .el-button i {
    margin-right: 4px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 375px) {
  .modal-header-content {
    padding: 12px 14px;
  }

  .modal-title {
    font-size: 15px;
  }

  .modal-subtitle {
    font-size: 11px;
  }

  .modal-icon {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .details-container {
    padding: 12px 14px;
    gap: 12px;
  }

  .card-header {
    padding: 10px 12px;
  }

  .card-icon {
    width: 26px;
    height: 26px;
    font-size: 12px;
  }

  .card-title {
    font-size: 13px;
  }

  .card-content {
    padding: 10px;
  }

  /* 超小屏幕改为单列显示 */
  .table-cell {
    width: 100%;
    border-right: none;
    padding: 8px 10px;
    min-height: 40px;
  }

  .table-cell.label-cell {
    font-size: 10px;
    min-width: 45px;
  }

  .table-cell.value-cell {
    font-size: 11px;
  }

  .condition-badge {
    font-size: 10px;
    padding: 2px 6px;
  }

  .price-cell {
    font-size: 13px;
  }

  .footer-actions .el-button {
    height: 40px;
    font-size: 13px;
  }
}
