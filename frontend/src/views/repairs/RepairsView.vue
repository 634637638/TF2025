<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="repairs"
    module-name="维修管理"
    permission-code="repairs:view"
  >
    <div class="repairs-management admin-page admin-unified-base-data-page safe-area-top safe-area-bottom">
      <PageHeader
        icon="fas fa-screwdriver-wrench"
        title="维修管理"
      >
        <template #actions>
          <el-button
            v-if="canCreate && repairsApiAvailable"
            type="primary"
            @click="showAddModal"
          >
            <i class="fas fa-plus" /> 新建维修单
          </el-button>
          <el-button
            type="info"
            :loading="refreshing"
            :disabled="refreshing"
            @click="refreshData"
          >
            <i class="fas fa-refresh" />
            {{ refreshing ? '刷新中...' : '刷新' }}
          </el-button>
        </template>
      </PageHeader>

      <div class="repairs-content admin-page-content">
        <el-alert
          v-if="!repairsApiAvailable"
          title="维修服务尚未接入数据接口，当前仅展示空状态。"
          type="warning"
          :closable="false"
          show-icon
          class="repairs-unavailable-alert"
        />
        <div
          v-if="showStatsCards"
          class="stats-cards"
        >
          <div
            v-if="canViewRepairField('stats_pending')"
            class="stat-card stat-card--warning"
          >
            <div class="stat-icon">
              <i class="fas fa-clock" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.pending }}
              </div>
              <div class="stat-label">
                待维修
              </div>
            </div>
          </div>
          <div
            v-if="canViewRepairField('stats_processing')"
            class="stat-card stat-card--info"
          >
            <div class="stat-icon">
              <i class="fas fa-screwdriver-wrench" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.processing }}
              </div>
              <div class="stat-label">
                维修中
              </div>
            </div>
          </div>
          <div
            v-if="canViewRepairField('stats_completed')"
            class="stat-card stat-card--success"
          >
            <div class="stat-icon">
              <i class="fas fa-circle-check" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                {{ stats.completed }}
              </div>
              <div class="stat-label">
                已完成
              </div>
            </div>
          </div>
          <div
            v-if="canViewRepairField('stats_monthly_revenue')"
            class="stat-card stat-card--income"
          >
            <div class="stat-icon">
              <i class="fas fa-yen-sign" />
            </div>
            <div class="stat-content">
              <div class="stat-value">
                ¥{{ stats.monthly_revenue }}
              </div>
              <div class="stat-label">
                本月收入
              </div>
            </div>
          </div>
        </div>

        <UnifiedSearchPanel
          v-if="showRepairSearchPanel"
          v-model:expanded="searchExpanded"
          :loading="loading"
          @search="handleSearch"
          @reset="handleReset"
        >
          <template
            v-if="showRepairSearchField"
            #primary
          >
            <el-input
              v-model="filters.search"
              placeholder="搜索维修单号、客户、手机型号"
              clearable
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <i class="fas fa-search" />
              </template>
            </el-input>
          </template>
          <div
            v-if="canViewRepairField('status')"
            class="form-group filter-item"
          >
            <el-select
              v-model="filters.status"
              placeholder="维修状态"
              @change="handleSearch"
            >
              <el-option
                v-for="tab in statusTabs"
                :key="tab.key"
                :label="tab.label"
                :value="tab.key"
              />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <div class="repairs-table table-section admin-panel admin-table-panel">
          <div class="section-header">
            <div class="section-title">
              <i class="fas fa-list" />
              维修记录
              <span class="record-count">共 {{ pagination.total }} 条记录</span>
            </div>
          </div>

          <div class="table-responsive">
            <el-table
              :data="loading ? [] : repairs"
              border
              stripe
              class="data-table devices-table base-data-table repairs-data-table"
              table-layout="fixed"
              :fit="true"
              :row-key="getRepairRowKey"
              :expand-row-keys="isMobile && mobileActionRowId ? [mobileActionRowId] : []"
              @row-click="handleRepairRowClick"
            >
              <template #empty>
                <TableLoadingRow
                  v-if="loading"
                  mode="block"
                  text="加载维修记录中..."
                />
                <DataEmptyState
                  v-else
                  description="暂无维修记录"
                />
              </template>

              <el-table-column
                v-if="canViewRepairField('order_no')"
                label="维修单号"
                :min-width="repairNumberColumnWidth"
                align="center"
                class-name="identifier-column"
              >
                <template #default="{ row }">
                  <span class="repair-number">{{ row.order_no }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('customer_name')"
                prop="customer_name"
                label="客户"
                :min-width="customerColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  <strong>{{ row.customer_name || '-' }}</strong>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('customer_phone')"
                prop="customer_phone"
                label="客户电话"
                min-width="118"
                align="center"
              />
              <el-table-column
                v-if="canViewRepairField('brand_name')"
                prop="brand_name"
                label="品牌"
                min-width="90"
                align="center"
              />
              <el-table-column
                v-if="canViewRepairField('phone_model')"
                prop="phone_model"
                label="型号"
                :min-width="modelColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.phone_model || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('imei')"
                prop="imei"
                label="IMEI"
                min-width="145"
                align="center"
              />
              <el-table-column
                v-if="canViewRepairField('serial_number')"
                prop="serial_number"
                label="序列号"
                min-width="145"
                align="center"
              />
              <el-table-column
                v-if="canViewRepairField('problem_description')"
                prop="problem_description"
                label="故障"
                min-width="190"
                align="center"
                class-name="complete-text-column wrapped-text-column"
              />
              <el-table-column
                v-if="canViewRepairField('photos')"
                label="媒体"
                min-width="112"
                align="center"
              >
                <template #default="{ row }">
                  <el-button
                    type="primary"
                    size="small"
                    @click.stop="openMediaManager(row)"
                  >
                    <i class="fas fa-photo-film" />
                    {{ row.photos?.length ? `查看(${row.photos.length})` : '上传' }}
                  </el-button>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('actual_cost')"
                label="维修费"
                min-width="104"
                align="center"
              >
                <template #default="{ row }">
                  <span class="amount-value">{{ row.actual_cost == null ? '-' : `¥${formatAmount(row.actual_cost)}` }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showRepairStatusField"
                label="维修状态"
                :min-width="isMobile ? 118 : 168"
                align="center"
              >
                <template #default="{ row }">
                  <div class="action-buttons">
                    <span
                      v-if="canViewRepairField('status')"
                      :class="['status-badge', `status-${row.status}`]"
                    >{{ getStatusText(row.status) }}</span>
                    <el-button
                      v-if="canEdit && row.status !== 'completed' && row.status !== 'cancelled'"
                      type="success"
                      size="small"
                      title="更新状态"
                      @click.stop="updateStatus(row)"
                    >
                      <i class="fas fa-sync" /><span>状态</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('technician_name')"
                prop="technician_name"
                label="维修员"
                min-width="96"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.technician_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewRepairField('remarks')"
                prop="remarks"
                label="备注"
                min-width="150"
                align="center"
                class-name="complete-text-column wrapped-text-column"
              />
              <el-table-column
                v-if="canViewRepairField('repair_time')"
                label="维修时间"
                min-width="154"
                align="center"
              >
                <template #default="{ row }">
                  <span class="time-value">{{ formatDate(row.repair_time) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="showActionField"
                label="操作"
                :width="$getActionColumnWidth(1 + Number(canEdit) + Number(canDelete))"
                align="center"
                class-name="actions-column"
              >
                <template #default="{ row }">
                  <div class="action-buttons">
                    <el-button
                      type="primary"
                      size="small"
                      title="查看详情"
                      @click.stop="viewRepair(row)"
                    >
                      <i class="fas fa-eye" /><span>详情</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="warning"
                      size="small"
                      title="编辑"
                      @click.stop="editRepair(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      :disabled="row.status === 'completed'"
                      type="danger"
                      size="small"
                      title="删除维修单"
                      @click.stop="deleteRepair(row)"
                    >
                      <i class="fas fa-trash" /><span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                v-if="isMobile && showMobileActionField"
                type="expand"
                width="1"
                class-name="mobile-expand-column"
                label-class-name="mobile-expand-header"
              >
                <template #default="{ row }">
                  <div class="mobile-row-actions">
                    <el-button
                      type="primary"
                      size="small"
                      @click.stop="viewRepair(row)"
                    >
                      <i class="fas fa-eye" /><span>详情</span>
                    </el-button>
                    <el-button
                      v-if="canEdit"
                      type="warning"
                      size="small"
                      @click.stop="editRepair(row)"
                    >
                      <i class="fas fa-edit" /><span>编辑</span>
                    </el-button>
                    <el-button
                      v-if="canDelete"
                      :disabled="row.status === 'completed'"
                      type="danger"
                      size="small"
                      @click.stop="deleteRepair(row)"
                    >
                      <i class="fas fa-trash" /><span>删除</span>
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <Pagination
            v-if="pagination.total > 0"
            v-model:current="pagination.page"
            v-model:page-size="pagination.page_size"
            :total="pagination.total"
            :page-sizes="[20, 50, 100]"
            :show-total="true"
            :show-range="true"
            :show-page-sizes="true"
            :show-quick-jumper="true"
            :disabled="loading"
            @change="handlePaginationChange"
          />
        </div>
      </div>

      <MobileDialog
        v-model="showModal"
        :title="editingRepairId ? '编辑维修单' : '新建维修单'"
        width="600px"
        dialog-class="repairs-dialog"
        :show-default-footer="false"
        :close-on-click-modal="false"
      >
        <el-form
          :model="formData"
          label-width="88px"
          :disabled="submitting"
        >
          <el-row :gutter="16">
            <el-col
              v-if="canViewRepairField('phone_id')"
              :span="24"
            >
              <el-form-item label="设备检索">
                <el-autocomplete
                  v-model="deviceSearchKeyword"
                  class="device-search-input"
                  value-key="display_label"
                  :fetch-suggestions="searchDeviceSuggestions"
                  :loading="deviceSearching"
                  clearable
                  placeholder="输入 IMEI 或序列号检索"
                  @select="handleDeviceSelect"
                  @clear="clearSelectedDevice"
                >
                  <template #default="{ item }">
                    <div class="device-search-option">
                      <strong>{{ item.brand_name || '-' }} {{ item.model_name || '-' }}</strong>
                      <div class="device-search-identifiers">
                        <span>IMEI：{{ item.imei || '-' }}</span>
                        <span>序列号：{{ item.serial_number || '-' }}</span>
                      </div>
                      <small>{{ item.customer_name ? `购买人：${item.customer_name}` : '暂无销售客户' }}</small>
                    </div>
                  </template>
                </el-autocomplete>
                <div
                  v-if="selectedDevice"
                  class="device-linked-hint"
                >
                  已关联库存设备，修改设备字段后将解除关联，可继续手动填写。
                </div>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col
              v-if="canViewRepairField('customer_name')"
              :span="12"
              :xs="24"
            >
              <el-form-item
                label="姓名"
                required
              >
                <el-select
                  v-if="customerMode !== 'manual'"
                  v-model="formData.customer_id"
                  placeholder="输入姓名或手机号检索"
                  filterable
                  remote
                  clearable
                  :remote-method="searchCustomers"
                  :loading="customerSearching"
                  @change="handleCustomerSelect"
                  @clear="resetCustomerSelection"
                >
                  <el-option
                    v-for="customer in customers"
                    :key="customer.id"
                    :label="getCustomerOptionLabel(customer)"
                    :value="customer.id"
                  />
                  <template #empty>
                    <div class="repair-customer-empty">
                      <span>{{ customerSearchKeyword.length >= 2 ? '暂无匹配客户' : '输入至少2位姓名或手机号' }}</span>
                      <el-button
                        v-if="customerSearchKeyword.length >= 2 && canViewRepairField('customer_name') && canViewRepairField('customer_phone')"
                        link
                        type="primary"
                        @click.stop="startManualCustomer"
                      >
                        新增客户
                      </el-button>
                    </div>
                  </template>
                </el-select>
                <el-input
                  v-else
                  v-model="customerDraft.name"
                  placeholder="请输入客户姓名"
                  maxlength="100"
                >
                  <template #append>
                    <el-button
                      :loading="customerSaving"
                      @click="saveRepairCustomer"
                    >
                      保存客户
                    </el-button>
                  </template>
                </el-input>
              </el-form-item>
            </el-col>
            <el-col
              v-if="canViewRepairField('customer_phone')"
              :span="12"
              :xs="24"
            >
              <el-form-item label="手机号码">
                <el-input
                  v-if="customerMode === 'selected'"
                  :model-value="selectedCustomerPhone"
                  placeholder="选择姓名后自动显示"
                  readonly
                />
                <el-input
                  v-else
                  v-model="customerDraft.phone"
                  placeholder="请输入手机号码"
                  maxlength="11"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col
              v-if="canViewRepairField('repair_time')"
              :span="12"
              :xs="24"
            >
              <el-form-item label="维修时间">
                <el-date-picker
                  v-model="formData.repair_time"
                  type="date"
                  :value-format="TIME_FORMATS.DATE"
                  placeholder="请选择维修时间"
                  :clearable="false"
                  class="w-full"
                />
              </el-form-item>
            </el-col>
            <el-col
              v-if="canViewRepairField('technician_name')"
              :span="12"
              :xs="24"
            >
              <el-form-item label="维修员">
                <el-select
                  v-model="formData.technician_id"
                  placeholder="请选择维修员"
                  clearable
                >
                  <el-option
                    v-for="technician in technicians"
                    :key="technician.id"
                    :label="technician.name"
                    :value="technician.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col
              v-if="canViewRepairField('brand_name')"
              :span="12"
              :xs="24"
            >
              <el-form-item
                label="品牌"
                required
              >
                <el-select
                  v-model="formData.brand_id"
                  placeholder="请选择品牌"
                  filterable
                  clearable
                  @change="onBrandChange"
                >
                  <el-option
                    v-for="brand in brands"
                    :key="brand.id"
                    :label="brand.name"
                    :value="brand.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col
              v-if="canViewRepairField('phone_model')"
              :span="12"
              :xs="24"
            >
              <el-form-item
                label="型号"
                required
              >
                <el-select
                  v-model="formData.phone_model"
                  placeholder="请输入手机型号"
                  filterable
                  allow-create
                  default-first-option
                  clearable
                  @change="handleManualDeviceChange"
                >
                  <el-option
                    v-for="model in filteredModels"
                    :key="model.id"
                    :label="model.name"
                    :value="model.name"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col
              v-if="canViewRepairField('color_name')"
              :span="12"
              :xs="24"
            >
              <el-form-item label="颜色">
                <el-select
                  v-model="formData.color_id"
                  placeholder="请选择颜色"
                  filterable
                  clearable
                  @change="handleManualDeviceChange"
                >
                  <el-option
                    v-for="color in colors"
                    :key="color.id"
                    :label="color.name"
                    :value="color.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col
              v-if="canViewRepairField('memory_size')"
              :span="12"
              :xs="24"
            >
              <el-form-item label="内存">
                <el-select
                  v-model="formData.memory_id"
                  placeholder="请选择内存"
                  filterable
                  clearable
                  @change="handleManualDeviceChange"
                >
                  <el-option
                    v-for="memory in memories"
                    :key="memory.id"
                    :label="memory.size"
                    :value="memory.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col
              v-if="canViewRepairField('imei')"
              :span="12"
              :xs="24"
            >
              <el-form-item label="IMEI">
                <el-input
                  v-model="formData.imei"
                  placeholder="请输入 IMEI"
                  @input="handleManualDeviceChange"
                />
              </el-form-item>
            </el-col>
            <el-col
              v-if="canViewRepairField('serial_number')"
              :span="12"
              :xs="24"
            >
              <el-form-item label="序列号">
                <el-input
                  v-model="formData.serial_number"
                  placeholder="请输入序列号"
                  @input="handleManualDeviceChange"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item
                v-if="canViewRepairField('photos')"
                label="维修照片"
              >
                <el-upload
                  class="repair-media-upload"
                  action="#"
                  multiple
                  :show-file-list="false"
                  :http-request="uploadFormMedia"
                  accept="image/*,video/*,.heic,.heif"
                >
                  <el-button
                    type="primary"
                    :loading="mediaUploading"
                  >
                    <i class="fas fa-cloud-arrow-up" /> 上传照片/视频
                  </el-button>
                </el-upload>
                <div
                  v-if="formData.photos?.length"
                  class="repair-media-list"
                >
                  <el-button
                    v-for="(media, index) in formData.photos"
                    :key="`${media.url}-${index}`"
                    native-type="button"
                    class="repair-media-item"
                    @click="openMediaPreview(formData.photos || [], index)"
                  >
                    <video
                      v-if="isVideoMedia(media)"
                      :src="formatMediaUrl(media.url)"
                      muted
                      preload="metadata"
                    />
                    <img
                      v-else
                      :src="formatMediaUrl(media.url)"
                      :alt="media.name || '维修媒体'"
                    >
                    <span>{{ media.type === 'video' ? '视频' : '图片' }}</span>
                    <i
                      class="fas fa-trash"
                      @click.stop="removeFormMedia(index)"
                    />
                  </el-button>
                </div>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item
                v-if="canViewRepairField('problem_description')"
                label="故障"
                required
              >
                <el-select
                  v-model="selectedProblems"
                  multiple
                  filterable
                  allow-create
                  default-first-option
                  clearable
                  placeholder="选择或输入故障项目，可多选"
                  class="repair-fault-select"
                >
                  <el-option
                    v-for="fault in repairFaultOptions"
                    :key="fault"
                    :label="fault"
                    :value="fault"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col
              v-if="editingRepairId && canViewRepairField('actual_cost')"
              :span="12"
              :xs="24"
            >
              <el-form-item label="维修费">
                <el-input-number
                  v-model="formData.actual_cost"
                  :min="0"
                  :precision="2"
                  :step="10"
                  :controls="false"
                />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item
                v-if="canViewRepairField('remarks')"
                label="备注"
              >
                <el-input
                  v-model="formData.remarks"
                  class="tf-textarea"
                  type="textarea"
                  :rows="2"
                  placeholder="其他备注信息"
                />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
        <template #footer>
          <div class="tf-dialog-actions modal-footer">
            <el-button
              type="info"
              @click="closeModal"
            >
              取消
            </el-button>
            <el-button
              type="primary"
              :loading="submitting"
              :disabled="!canSubmitVisibleFields"
              @click="handleSubmit"
            >
              {{ editingRepairId ? '保存维修单' : '创建维修单' }}
            </el-button>
          </div>
        </template>
      </MobileDialog>
      <MobileDialog
        v-model="showMediaManager"
        title="维修照片"
        width="720px"
        dialog-class="repairs-media-dialog"
        :show-default-footer="false"
        :close-on-click-modal="false"
      >
        <div class="repair-media-manager">
          <el-upload
            v-if="canEdit"
            action="#"
            multiple
            :show-file-list="false"
            :http-request="uploadManagerMedia"
            accept="image/*,video/*,.heic,.heif"
          >
            <el-button
              type="primary"
              :loading="mediaUploading"
            >
              <i class="fas fa-cloud-arrow-up" /> 选择照片/视频
            </el-button>
          </el-upload>
          <div
            v-if="managerMedia.length"
            class="repair-media-list repair-media-list--manager"
          >
            <el-button
              v-for="(media, index) in managerMedia"
              :key="`${media.url}-${index}`"
              native-type="button"
              class="repair-media-item"
              @click="openMediaPreview(managerMedia, index)"
            >
              <video
                v-if="isVideoMedia(media)"
                :src="formatMediaUrl(media.url)"
                muted
                preload="metadata"
              />
              <img
                v-else
                :src="formatMediaUrl(media.url)"
                :alt="media.name || '维修媒体'"
              >
              <span>{{ media.type === 'video' ? '视频' : '图片' }}</span>
              <i
                v-if="canEdit"
                class="fas fa-trash"
                @click.stop="removeManagerMedia(index)"
              />
            </el-button>
          </div>
          <DataEmptyState
            v-else
            description="暂无维修照片或视频"
          />
        </div>
        <template #footer>
          <div class="tf-dialog-actions modal-footer">
            <el-button
              type="info"
              @click="closeMediaManager"
            >
              关闭
            </el-button>
            <el-button
              v-if="canEdit"
              type="primary"
              :loading="mediaSaving"
              @click="saveManagerMedia"
            >
              保存
            </el-button>
          </div>
        </template>
      </MobileDialog>
      <MediaPreviewViewer
        v-model="showMediaPreview"
        :items="previewMedia"
        :initial-index="previewMediaIndex"
      />
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useLoadingState } from '@/composables'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useMobile } from '@/composables/mobile'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { PageHeader, PermissionGate } from '@/components/base'
import InlineLoading from '@/components/InlineLoading.vue'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import DataEmptyState from '@/components/DataEmptyState.vue'
import MobileDialog from '@/components/MobileDialog.vue'
import MediaPreviewViewer from '@/components/MediaPreviewViewer.vue'
import type { UploadRequestOptions } from 'element-plus'
import { logger } from '@/utils/logger'
import { getIdentifierColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { repairsApi } from '@/api/repairs'
import { unifiedApi } from '@/utils/unified-api'
import { searchCustomerOptions } from '@/services/customer-options'
import type { RepairDeviceSearchResult, RepairMedia, RepairOrder, RepairOrderForm, RepairStatus } from '@/types/repair'
import { formatDate as formatGlobalDate } from '@/utils/format'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import { formatImageUrl } from '@/utils/format'
import { isVideoMedia, type MediaPreviewItem } from '@/utils/media'

interface CustomerOption { id: number; name: string; phone: string | null }
interface BrandOption { id: number; name: string }
interface ModelOption { id: number; name: string; brand_id?: number | null }
interface ColorOption { id: number; name: string }
interface MemoryOption { id: number; size: string }
interface TechnicianOption { id: number; name: string }

const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('repairs')
const repairsApiAvailable = true
const { success, error: notifyError, info, confirm } = useNotification()
const { isMobile } = useMobile()
const { loading } = useLoadingState()

const repairs = ref<RepairOrder[]>([])
const customers = ref<CustomerOption[]>([])
const customerMode = ref<'search' | 'selected' | 'manual'>('search')
const customerSearching = ref(false)
const customerSaving = ref(false)
const customerSearchKeyword = ref('')
const customerDraft = reactive({ name: '', phone: '' })
const selectedProblems = ref<string[]>([])
const repairFaultOptions = [
  '换屏幕', '换电池', '维修主板', '换框', '更换相机', '维修尾插', '换听筒', '换扬声器'
]
let customerSearchSequence = 0
const brands = ref<BrandOption[]>([])
const models = ref<ModelOption[]>([])
const colors = ref<ColorOption[]>([])
const memories = ref<MemoryOption[]>([])
const technicians = ref<TechnicianOption[]>([])
const showModal = ref(false)
const editingRepairId = ref<number | null>(null)
const submitting = ref(false)
const refreshing = ref(false)
const searchExpanded = ref(false)
const filters = reactive<{ search: string; status: 'all' | RepairStatus }>({ search: '', status: 'all' })
const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 0,
  has_next: false,
  has_prev: false
})
const mobileActionRowId = ref<string | null>(null)
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)
const deviceSearchKeyword = ref('')
const deviceSearching = ref(false)
const selectedDevice = ref<RepairDeviceSearchResult | null>(null)
const applyingDevice = ref(false)
const mediaUploading = ref(false)
const mediaSaving = ref(false)
const pendingTempMediaUrls = ref<string[]>([])
const showMediaManager = ref(false)
const managerRepair = ref<RepairOrder | null>(null)
const managerMedia = ref<RepairMedia[]>([])
const showMediaPreview = ref(false)
const previewMedia = ref<MediaPreviewItem[]>([])
const previewMediaIndex = ref(0)

const repairFieldMap: Record<string, string> = {
  stats_pending: 'stats.pending',
  stats_processing: 'stats.processing',
  stats_completed: 'stats.completed',
  stats_monthly_revenue: 'stats.monthly_revenue',
  order_no: 'basic_info.order_no',
  customer_name: 'customer_info.customer_name',
  customer_phone: 'customer_info.customer_phone',
  brand_name: 'device_info.brand_name',
  phone_id: 'device_info.phone_id',
  phone_model: 'device_info.phone_model',
  imei: 'device_info.imei',
  serial_number: 'device_info.serial_number',
  color_name: 'device_info.color_name',
  memory_size: 'device_info.memory_size',
  problem_description: 'repair_info.problem_description',
  technician_name: 'repair_info.technician_name',
  actual_cost: 'price_info.actual_cost',
  status: 'status_info.status',
  remarks: 'other_info.remarks',
  repair_time: 'time_info.created_at',
  photos: 'repair_info.photos',
  actions: 'system_info.operations'
}

const canViewRepairField = (fieldName: string) => fieldPermissions.isFieldVisible(
  'repairs_repairsview',
  repairFieldMap[fieldName] || fieldName
)

const showStatsCards = computed(() => [
  'stats_pending', 'stats_processing', 'stats_completed', 'stats_monthly_revenue'
].some(canViewRepairField))

const searchableRepairFields = ['order_no', 'customer_name', 'customer_phone', 'phone_model', 'imei', 'serial_number']
const showRepairSearchField = computed(() => searchableRepairFields.some(canViewRepairField))
const showRepairSearchPanel = computed(() => showRepairSearchField.value || canViewRepairField('status'))
const showRepairStatusField = computed(() => canViewRepairField('status'))
const requiredCreateFields = ['customer_name', 'brand_name', 'phone_model', 'problem_description']
const canSubmitVisibleFields = computed(() => (
  Boolean(editingRepairId.value) || requiredCreateFields.every(canViewRepairField)
))

const showActionField = computed(() => (
  !isMobile.value && shouldShowActionColumn(canViewRepairField('actions'), [canEdit.value, canDelete.value])
))
const showMobileActionField = computed(() => shouldShowActionColumn(
  canViewRepairField('actions'),
  [canEdit.value, canDelete.value]
))

const repairWriteFieldMap: Record<keyof RepairOrderForm, string> = {
  customer_id: 'customer_name',
  brand_id: 'brand_name',
  phone_id: 'phone_id',
  phone_model: 'phone_model',
  imei: 'imei',
  serial_number: 'serial_number',
  color_id: 'color_name',
  memory_id: 'memory_size',
  problem_description: 'problem_description',
  actual_cost: 'actual_cost',
  technician_id: 'technician_name',
  remarks: 'remarks',
  repair_time: 'repair_time',
  photos: 'photos'
}

const buildVisibleRepairPayload = () => Object.fromEntries(
  Object.entries(formData).filter(([field]) => (
    canViewRepairField(repairWriteFieldMap[field as keyof RepairOrderForm])
  ))
) as unknown as RepairOrderForm

const stats = ref({ pending: 0, processing: 0, completed: 0, monthly_revenue: '0' })

const statusTabs: Array<{ key: 'all' | RepairStatus; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待维修' },
  { key: 'processing', label: '维修中' },
  { key: 'completed', label: '已完成' }
]

const formData = reactive<RepairOrderForm>({
  customer_id: null as number | null,
  phone_id: null as number | null,
  brand_id: null as number | null,
  phone_model: '',
  imei: '',
  serial_number: '',
  color_id: null as number | null,
  memory_id: null as number | null,
  problem_description: '',
  actual_cost: undefined,
  technician_id: null as number | null,
  remarks: '',
  repair_time: '',
  photos: []
})

const filteredModels = computed(() => {
  if (!formData.brand_id) return models.value
  return models.value.filter(model => !model.brand_id || model.brand_id === formData.brand_id)
})

const selectedCustomerPhone = computed(() => {
  const customer = customers.value.find(item => item.id === formData.customer_id)
  return customer?.phone || ''
})

const searchCustomers = async (keyword: string) => {
  customerSearchKeyword.value = keyword.trim()
  customerMode.value = 'search'
  const sequence = ++customerSearchSequence
  if (customerSearchKeyword.value.length < 2) {
    customers.value = []
    return
  }
  customerSearching.value = true
  try {
    if (sequence === customerSearchSequence) {
      customers.value = (await searchCustomerOptions(customerSearchKeyword.value, 'repairs'))
        .filter(item => Boolean(item.name))
        .map(item => ({ id: item.id, name: item.name, phone: item.phone || null }))
    }
  } catch (error) {
    logger.error('检索维修客户失败:', error)
    if (sequence === customerSearchSequence) customers.value = []
  } finally {
    if (sequence === customerSearchSequence) customerSearching.value = false
  }
}

const handleCustomerSelect = (customerId: number | null) => {
  const customer = customers.value.find(item => item.id === customerId)
  if (!customer) return
  customerMode.value = 'selected'
  customerDraft.name = customer.name
  customerDraft.phone = customer.phone || ''
  handleManualDeviceChange()
}

const resetCustomerSelection = () => {
  customerMode.value = 'search'
  customerSearchKeyword.value = ''
  customerDraft.name = ''
  customerDraft.phone = ''
  formData.customer_id = null
  customers.value = []
  handleManualDeviceChange()
}

const startManualCustomer = () => {
  const keyword = customerSearchKeyword.value
  customerMode.value = 'manual'
  formData.customer_id = null
  customerDraft.name = /^1[3-9]\d{9}$/.test(keyword) ? '' : keyword
  customerDraft.phone = /^1[3-9]\d{9}$/.test(keyword) ? keyword : ''
  handleManualDeviceChange()
}

const saveRepairCustomer = async () => {
  const name = customerDraft.name.trim()
  const phone = customerDraft.phone.trim()
  if (!name || !/^1[3-9]\d{9}$/.test(phone)) {
    notifyError('请填写客户姓名和有效的11位手机号码')
    return
  }
  customerSaving.value = true
  try {
    const response = await repairsApi.createCustomer({ name, phone })
    const customer = response.data
    if (!customer) throw new Error('客户创建响应缺少客户信息')
    customers.value = [customer, ...customers.value.filter(item => item.id !== customer.id)]
    formData.customer_id = customer.id
    customerDraft.name = customer.name
    customerDraft.phone = customer.phone
    customerMode.value = 'selected'
    customerSearchKeyword.value = customer.name
    success('客户已创建并选择')
  } catch (error: any) {
    logger.error('新建维修客户失败:', error)
    notifyError(error?.response?.data?.message || error?.message || '新建客户失败')
  } finally {
    customerSaving.value = false
  }
}

const parseRepairProblems = (value?: string) => String(value || '').split(/[、,，;；\n]+/).map(item => item.trim()).filter(Boolean)

watch(selectedProblems, values => {
  formData.problem_description = values.join('、')
}, { deep: true })

const repairNumberColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['维修单号', ...repairs.value.map(repair => repair.order_no)],
  { minWidth: 132, horizontalPadding: 30 }
))
const customerColumnWidth = computed(() => getTextColumnMinWidth(
  ['客户', ...repairs.value.map(repair => repair.customer_name)],
  { minWidth: isMobile.value ? 84 : 96, horizontalPadding: 28 }
))
const modelColumnWidth = computed(() => getTextColumnMinWidth(
  ['手机型号', ...repairs.value.map(repair => repair.phone_model || '')],
  { minWidth: isMobile.value ? 116 : 132, horizontalPadding: 28 }
))

const getRepairRowKey = (repair: RepairOrder) => String(repair.id)

const getStatusText = (status: RepairStatus) => ({
  pending: '待维修', processing: '维修中', completed: '已完成', cancelled: '已取消'
}[status])

const loadRepairs = async () => {
  loading.value = true
  try {
    const filterParams = {
      search: showRepairSearchField.value ? filters.search || undefined : undefined,
      status: canViewRepairField('status') ? filters.status : undefined
    }
    const [listResponse, statsResponse] = await Promise.all([
      repairsApi.list({
        page: pagination.page,
        page_size: pagination.page_size,
        ...filterParams
      }),
      repairsApi.stats(filterParams)
    ])
    repairs.value = Array.isArray(listResponse?.data) ? listResponse.data : []
    pagination.page = Number(listResponse.pagination.page)
    pagination.page_size = Number(listResponse.pagination.page_size)
    pagination.total = Number(listResponse.pagination.total)
    pagination.total_pages = Number(listResponse.pagination.total_pages)
    pagination.has_next = Boolean(listResponse.pagination.has_next)
    pagination.has_prev = Boolean(listResponse.pagination.has_prev)
    if (!statsResponse.data) throw new Error('维修统计响应缺少 data')
    const summary = statsResponse.data
    stats.value = {
      pending: Number(summary.pending || 0),
      processing: Number(summary.processing || 0),
      completed: Number(summary.completed || 0),
      monthly_revenue: formatAmount(Number(summary.monthly_revenue || 0))
    }
  } catch (err) {
    logger.error('加载维修数据失败:', err)
    repairs.value = []
    pagination.total = 0
    pagination.total_pages = 0
    pagination.has_next = false
    pagination.has_prev = false
    throw err
  } finally {
    loading.value = false
  }
}

const loadOptions = async () => {
  const response = await repairsApi.options()
  if (!response.data) throw new Error('维修选项响应缺少 data')
  const data = response.data
  brands.value = Array.isArray(data.brands) ? data.brands : []
  models.value = Array.isArray(data.models) ? data.models : []
  colors.value = Array.isArray(data.colors) ? data.colors : []
  memories.value = Array.isArray(data.memories) ? data.memories : []
  technicians.value = Array.isArray(data.technicians) ? data.technicians : []
}

const resetForm = () => Object.assign(formData, {
  customer_id: null, phone_id: null, brand_id: null, phone_model: '', imei: '', serial_number: '',
  color_id: null, memory_id: null, problem_description: '',
  actual_cost: undefined, technician_id: null, remarks: '',
  repair_time: TimeUtil.nowFormatted(TIME_FORMATS.DATE), photos: []
})

const showAddModal = () => {
  if (!canCreate.value) return handleNoPermission('create')
  editingRepairId.value = null
  resetForm()
  customerMode.value = 'search'
  customerSearchKeyword.value = ''
  customerDraft.name = ''
  customerDraft.phone = ''
  selectedProblems.value = []
  customers.value = []
  deviceSearchKeyword.value = ''
  selectedDevice.value = null
  showModal.value = true
}

const closeModal = () => {
  void cleanupPendingMedia()
  showModal.value = false
  editingRepairId.value = null
  resetForm()
  customerMode.value = 'search'
  customerSearchKeyword.value = ''
  customerDraft.name = ''
  customerDraft.phone = ''
  selectedProblems.value = []
  customers.value = []
  deviceSearchKeyword.value = ''
  selectedDevice.value = null
}

const buildDeviceLabel = (device: RepairDeviceSearchResult) => [
  [device.brand_name, device.model_name].filter(Boolean).join(' '),
  device.color_name,
  device.memory_size,
  device.imei || device.serial_number,
  device.customer_name ? `购买人：${device.customer_name}` : '暂无销售客户'
].filter(Boolean).join(' · ')

const searchDeviceSuggestions = (
  queryString: string,
  callback: (_results: RepairDeviceSearchResult[]) => void
) => {
  const keyword = queryString.trim()
  if (keyword.length < 2) {
    callback([])
    return
  }
  void (async () => {
    deviceSearching.value = true
    try {
      const response = await repairsApi.searchDevices(keyword)
      const results = (Array.isArray(response.data) ? response.data : []).map(device => ({
        ...device,
        display_label: buildDeviceLabel(device)
      }))
      callback(results)
    } catch (err) {
      logger.error('检索维修设备失败:', err)
      callback([])
    } finally {
      deviceSearching.value = false
    }
  })()
}

const ensureCustomerOption = (device: RepairDeviceSearchResult) => {
  if (!device.customer_id || !device.customer_name) return
  if (customers.value.some(customer => customer.id === device.customer_id)) return
  customers.value.unshift({
    id: device.customer_id,
    name: device.customer_name,
    phone: device.customer_phone || ''
  })
}

const handleDeviceSelect = async (device: RepairDeviceSearchResult) => {
  applyingDevice.value = true
  ensureCustomerOption(device)
  if (device.customer_id && device.customer_name) {
    customerMode.value = 'selected'
    customerDraft.name = device.customer_name
    customerDraft.phone = device.customer_phone || ''
  }
  Object.assign(formData, {
    phone_id: device.phone_id,
    customer_id: device.customer_id || null,
    brand_id: device.brand_id || null,
    phone_model: device.model_name || '',
    color_id: device.color_id || null,
    memory_id: device.memory_id || null,
    imei: device.imei || '',
    serial_number: device.serial_number || ''
  })
  selectedDevice.value = device
  deviceSearchKeyword.value = device.display_label || buildDeviceLabel(device)
  await nextTick()
  applyingDevice.value = false
}

const clearSelectedDevice = () => {
  selectedDevice.value = null
  formData.phone_id = null
}

const handleManualDeviceChange = () => {
  if (applyingDevice.value || !formData.phone_id) return
  formData.phone_id = null
  selectedDevice.value = null
  deviceSearchKeyword.value = ''
}

const onBrandChange = () => handleManualDeviceChange()

const formatMediaUrl = (url: string) => formatImageUrl(url)
const openMediaPreview = (media: RepairMedia[], index: number) => {
  previewMedia.value = media.map(item => ({
    url: item.url,
    type: item.type,
    name: item.name,
    label: item.name || (item.type === 'video' ? '维修视频' : '维修照片')
  }))
  previewMediaIndex.value = index
  showMediaPreview.value = true
}

const cleanupPendingMedia = async () => {
  if (!pendingTempMediaUrls.value.length) return
  const urls = [...pendingTempMediaUrls.value]
  pendingTempMediaUrls.value = []
  try {
    await unifiedApi.post('/repairs/upload/cleanup', { files: urls }, { showLoading: false })
  } catch (error) {
    logger.warn('清理未保存维修媒体失败:', error)
  }
}

const uploadMedia = async (options: UploadRequestOptions, target: RepairMedia[]) => {
  if (!canEdit.value && editingRepairId.value) {
    options.onError?.(new Error('没有维修媒体编辑权限') as Parameters<NonNullable<UploadRequestOptions['onError']>>[0])
    return
  }
  const formData = new FormData()
  formData.append('files', options.file)
  mediaUploading.value = true
  try {
    const response = await repairsApi.uploadMedia(formData)
    const uploaded = response.data?.files?.[0]
    if (!uploaded) throw new Error('上传响应缺少媒体地址')
    const media: RepairMedia = {
      ...uploaded,
      type: isVideoMedia(uploaded) ? 'video' : 'image'
    }
    target.push(media)
    if (media.url.includes('/repairs/temp/')) pendingTempMediaUrls.value.push(media.url)
    options.onSuccess?.(media)
  } catch (error) {
    logger.error('上传维修媒体失败:', error)
    options.onError?.((error instanceof Error ? error : new Error('上传维修媒体失败')) as Parameters<NonNullable<UploadRequestOptions['onError']>>[0])
    notifyError('上传维修媒体失败')
  } finally {
    mediaUploading.value = false
  }
}

const uploadFormMedia = (options: UploadRequestOptions) => uploadMedia(options, formData.photos || [])
const uploadManagerMedia = (options: UploadRequestOptions) => uploadMedia(options, managerMedia.value)
const removeFormMedia = (index: number) => {
  formData.photos?.splice(index, 1)
}
const removeManagerMedia = (index: number) => {
  managerMedia.value.splice(index, 1)
}

const openMediaManager = (repair: RepairOrder) => {
  managerRepair.value = repair
  managerMedia.value = (repair.photos || []).map(item => ({ ...item }))
  showMediaManager.value = true
}
const closeMediaManager = () => {
  showMediaManager.value = false
  managerRepair.value = null
  managerMedia.value = []
  void cleanupPendingMedia()
}
const saveManagerMedia = async () => {
  if (!managerRepair.value || !canEdit.value) return
  mediaSaving.value = true
  try {
    const response = await repairsApi.update(managerRepair.value.id, { photos: managerMedia.value })
    const updated = response.data
    const current = repairs.value.find(item => item.id === managerRepair.value?.id)
    if (current && updated) current.photos = updated.photos || managerMedia.value
    pendingTempMediaUrls.value = []
    closeMediaManager()
    success('维修媒体保存成功')
  } catch (error) {
    logger.error('保存维修媒体失败:', error)
    notifyError('保存维修媒体失败')
  } finally {
    mediaSaving.value = false
  }
}

const handleSubmit = async () => {
  if (submitting.value) return
  if (editingRepairId.value ? !canEdit.value : !canCreate.value) {
    return handleNoPermission(editingRepairId.value ? 'edit' : 'create')
  }
  if (!canSubmitVisibleFields.value) {
    notifyError('当前字段权限不足，无法提交维修单所需字段')
    return
  }
  formData.problem_description = selectedProblems.value.join('、')
  if (!formData.customer_id || !formData.brand_id || !formData.phone_model || !formData.problem_description) {
    notifyError('请完整填写必填项')
    return
  }
  submitting.value = true
  try {
    const payload = buildVisibleRepairPayload()
    if (editingRepairId.value) {
      await repairsApi.update(editingRepairId.value, payload)
      success('维修单更新成功')
    } else {
      await repairsApi.create(payload)
      success('维修单创建成功')
    }
    pendingTempMediaUrls.value = []
    closeModal()
    await loadRepairs()
  } catch (err) {
    logger.error('创建维修单失败:', err)
    notifyError('创建维修单失败')
  } finally {
    submitting.value = false
  }
}

const viewRepair = async (repair: RepairOrder) => {
  try {
    const response = await repairsApi.detail(repair.id)
    const detail = response?.data || repair
    const visibleDetail = [
      canViewRepairField('order_no') ? detail.order_no : null,
      canViewRepairField('problem_description') ? detail.problem_description : null
    ].filter(Boolean)
    info(visibleDetail.length ? visibleDetail.join('：') : '没有可查看的维修详情字段')
  } catch (err) {
    logger.error('获取维修单详情失败:', err)
    notifyError('获取维修单详情失败')
  }
}
const editRepair = (repair: RepairOrder) => {
  if (!canEdit.value) return handleNoPermission('edit')
  editingRepairId.value = repair.id
  const values: RepairOrderForm = {
    customer_id: repair.customer_id,
    phone_id: repair.phone_id || null,
    brand_id: repair.brand_id || null,
    phone_model: repair.phone_model || '',
    imei: repair.imei || '',
    serial_number: repair.serial_number || '',
    color_id: repair.color_id || null,
    memory_id: repair.memory_id || null,
    problem_description: repair.problem_description || '',
    actual_cost: repair.actual_cost === null || repair.actual_cost === undefined
      ? undefined
      : Number(repair.actual_cost),
    technician_id: repair.technician_id || null,
    remarks: repair.remarks || '',
    repair_time: repair.repair_time ? formatGlobalDate(repair.repair_time) : '',
    photos: (repair.photos || []).map(item => ({ ...item }))
  }
  if (repair.customer_id && repair.customer_name && !customers.value.some(customer => customer.id === repair.customer_id)) {
    customers.value.unshift({ id: repair.customer_id, name: repair.customer_name, phone: repair.customer_phone || '' })
  }
  customerMode.value = 'selected'
  customerSearchKeyword.value = repair.customer_name || ''
  customerDraft.name = repair.customer_name || ''
  customerDraft.phone = repair.customer_phone || ''
  selectedProblems.value = parseRepairProblems(repair.problem_description)
  selectedDevice.value = repair.phone_id
    ? {
      phone_id: repair.phone_id,
      imei: repair.imei,
      serial_number: repair.serial_number,
      brand_id: repair.brand_id,
      brand_name: repair.brand_name,
      model_name: repair.phone_model,
      color_id: repair.color_id,
      color_name: repair.color_name,
      memory_id: repair.memory_id,
      memory_size: repair.memory_size,
      customer_id: repair.customer_id,
      customer_name: repair.customer_name,
      customer_phone: repair.customer_phone
    }
    : null
  deviceSearchKeyword.value = selectedDevice.value ? buildDeviceLabel(selectedDevice.value) : ''
  Object.entries(values).forEach(([field, value]) => {
    if (canViewRepairField(repairWriteFieldMap[field as keyof RepairOrderForm])) {
      Object.assign(formData, { [field]: value })
    }
  })
  showModal.value = true
}

const deleteRepair = async (repair: RepairOrder) => {
  if (!canDelete.value) return handleNoPermission('delete')
  if (repair.status === 'completed') {
    notifyError('已完成的维修单不能删除')
    return
  }

  try {
    if (!await confirm(
      '删除后维修单会标记为已取消，已完成的维修单不能删除。',
      '确认删除维修单',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )) return
    await repairsApi.cancel(repair.id)
    success('维修单已删除')
    await loadRepairs()
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return
    logger.error('删除维修单失败:', err)
    notifyError(err?.response?.data?.message || '删除维修单失败')
  }
}
const updateStatus = async (repair: RepairOrder) => {
  if (!canEdit.value) return handleNoPermission('edit')
  const nextStatus: Record<RepairStatus, RepairStatus> = {
    pending: 'processing', processing: 'completed', completed: 'completed', cancelled: 'cancelled'
  }
  const next = nextStatus[repair.status]
  if (next === repair.status) return info(`维修单 ${repair.order_no} 已完成`)
  try {
    await repairsApi.updateStatus(repair.id, next)
    success('维修状态更新成功')
    await loadRepairs()
  } catch (err) {
    logger.error('更新维修状态失败:', err)
    notifyError('更新维修状态失败')
  }
}

const refreshData = async () => {
  if (refreshing.value) return
  refreshing.value = true
  try {
    unifiedApi.clearCache('/repairs')
    await Promise.all([loadRepairs(), loadOptions()])
    success('数据刷新成功')
  } catch (err) {
    logger.error('刷新维修数据失败:', err)
    notifyError('数据刷新失败')
  } finally {
    refreshing.value = false
  }
}

const handleSearch = async () => {
  pagination.page = 1
  mobileActionRowId.value = null
  try {
    await loadRepairs()
  } catch (err) {
    logger.error('检索维修记录失败:', err)
    notifyError('检索维修记录失败')
  }
}
const handleReset = () => { filters.search = ''; filters.status = 'all'; void handleSearch() }
const handlePaginationChange = (page: number, page_size: number) => {
  pagination.page = page
  pagination.page_size = page_size
  mobileActionRowId.value = null
  void loadRepairs().catch(err => {
    logger.error('切换维修分页失败:', err)
    notifyError('加载维修分页失败')
  })
}

const toggleMobileActions = (rowId: string) => {
  if (!isMobile.value) return
  mobileActionRowId.value = mobileActionRowId.value === rowId ? null : rowId
}

const handleRepairRowClick = (repair: RepairOrder, _column: unknown, event: Event) => {
  if (!isMobile.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, select, .el-button, .el-input, .el-select')) return
  const rowId = getRepairRowKey(repair)
  const now = Date.now()
  if (lastTappedRowId.value === rowId && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(rowId)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }
  lastTappedRowId.value = rowId
  lastTapTimestamp.value = now
}

const formatAmount = (amount?: number) => Number(amount || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const getCustomerOptionLabel = (customer: CustomerOption) => (
  customer.name
)
const formatDate = (date: string) => formatGlobalDate(date)

onMounted(async () => {
  if (!canView.value) return
  await fieldPermissions.init()
  await Promise.all([loadRepairs(), loadOptions()])
})
</script>

<style scoped>
.repair-number,
.amount-value,
.time-value {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-variant-numeric: tabular-nums;
}

.repair-number,
.amount-value {
  font-weight: 600;
}

.amount-value {
  color: var(--el-color-success);
}

.repair-media-upload {
  display: inline-flex;
}


.repair-media-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.repair-media-item {
  position: relative;
  min-width: 0;
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-light);
  cursor: pointer;
}

.repair-media-item img,
.repair-media-item video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.repair-media-item span {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 2px 4px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--tf-color-black) 60%, transparent);
  color: var(--color-bg-white);
  font-size: var(--tf-type-scale-11);
}

.repair-media-item > i {
  position: absolute;
  top: 4px;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--tf-color-black) 60%, transparent);
  color: var(--color-bg-white);
  font-size: var(--tf-type-scale-11);
}

.repair-media-manager {
  min-height: 150px;
}

@media (max-width: 767px) {
  .repair-media-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.status-pending {
  background: var(--tf-status-warning-bg);
  color: var(--tf-status-warning-color);
  border: 1px solid var(--tf-status-warning-border);
}

.status-processing {
  background: var(--tf-status-info-bg);
  color: var(--tf-status-info-color);
  border: 1px solid var(--tf-status-info-border);
}

.status-completed {
  background: var(--tf-status-success-bg);
  color: var(--tf-status-success-color);
  border: 1px solid var(--tf-status-success-border);
}

.status-cancelled {
  background: var(--tf-status-danger-bg);
  color: var(--tf-status-danger-color);
  border: 1px solid var(--tf-status-danger-border);
}

:deep(.repairs-dialog .el-select),
:deep(.repairs-dialog .el-input-number),
:deep(.repairs-dialog .el-autocomplete) {
  width: 100%;
}

.device-search-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  line-height: 1.35;
}

.device-search-option strong {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-search-identifiers {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  min-width: 0;
}

.device-search-option span,
.device-search-option small {
  color: var(--el-text-color-secondary);
  font-size: var(--tf-type-scale-12);
}

.device-linked-hint {
  margin-top: 4px;
  color: var(--el-color-success);
  font-size: var(--tf-type-scale-12);
  line-height: 1.4;
}
</style>
