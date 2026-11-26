<template>
  <div class="returngoods-page admin-page admin-page-content safe-area-top safe-area-bottom">
    <div
      v-if="canViewField('stats.summary')"
      class="returngoods-overview"
    >
      <div class="overview-card">
        <div class="overview-icon primary">
          <i class="fas fa-undo-alt" />
        </div>
        <div class="overview-content">
          <div class="overview-value">
            {{ stats.total_records }}
          </div>
          <div class="overview-label">
            退库总数
          </div>
        </div>
      </div>
      <div class="overview-card">
        <div class="overview-icon success">
          <i class="fas fa-mobile-alt" />
        </div>
        <div class="overview-content">
          <div class="overview-value">
            {{ stats.total_phones }}
          </div>
          <div class="overview-label">
            设备数量
          </div>
        </div>
      </div>
      <div class="overview-card">
        <div class="overview-icon warning">
          <i class="fas fa-calendar-alt" />
        </div>
        <div class="overview-content">
          <div class="overview-value">
            {{ stats.total_days }}
          </div>
          <div class="overview-label">
            涉及天数
          </div>
        </div>
      </div>
    </div>

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    >
      <template
        v-if="canViewField('filters.keyword')"
        #primary
      >
        <el-input
          v-model="searchForm.keyword"
          placeholder="搜索IMEI、型号、客户、备注"
          clearable
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-search" />
          </template>
        </el-input>
      </template>

      <div
        v-if="canViewField('filters.date_range')"
        class="form-group filter-item filter-item--date-range"
        data-field="date_range"
      >
        <DateRangePicker
          v-model="returnDateRange"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :format="TIME_FORMATS.DATE"
          :value-format="TIME_FORMATS.DATE"
          clearable
          @change="handleSearch"
        />
      </div>
    </UnifiedSearchPanel>

    <div class="table-section admin-panel admin-table-panel">
      <div class="panel-header">
        <div class="panel-title">
          <i class="fas fa-clipboard-list" />
          <span>退库记录</span>
        </div>
      </div>

      <div
        class="table-wrapper table-responsive"
      >
        <el-table
          v-table-double-tap="mobileDetailTapOptions"
          v-tf-loading="{ active: loading, text: '正在刷新退库记录...' }"
          class="data-table devices-table compact-fit-table base-data-table returngoods-data-table"
          :data="records"
          row-key="id"
          border
          stripe
          table-layout="fixed"
          :fit="true"
          style="width: 100%"
          @row-dblclick="mobileDetailDoubleClick"
        >
          <template #empty>
            <TableLoadingRow
              v-if="loading"
              mode="block"
              text="正在读取退库记录..."
            />
            <DataEmptyState
              v-else
              description="暂无退库记录"
            />
          </template>

          <el-table-column
            v-if="canViewField('record.product_info')"
            prop="phone_id"
            label="设备ID"
            width="88"
            align="center"
          />
          <el-table-column
            v-if="canViewField('record.product_info')"
            label="商品信息"
            min-width="250"
          >
            <template #default="{ row }">
              <div class="product-cell">
                <div class="product-name">
                  {{ [row.brand, row.model, row.color, row.memory].filter(Boolean).join(' ') || '-' }}
                </div>
                <div class="product-meta">
                  IMEI：{{ row.imei || '-' }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('record.customer')"
            prop="customer_name"
            label="客户"
            min-width="120"
          />
          <el-table-column
            v-if="canViewField('record.operator')"
            prop="operator_name"
            label="操作员"
            min-width="100"
          />
          <el-table-column
            v-if="canViewField('record.sale_info')"
            prop="original_sale_id"
            label="原销售ID"
            width="100"
            align="center"
          />
          <el-table-column
            v-if="canViewField('record.sale_info')"
            label="销售类型"
            min-width="100"
          >
            <template #default="{ row }">
              {{ getSaleTypeText(row.original_sale_type) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('record.sale_info')"
            prop="original_sale_operator_name"
            label="销售员"
            min-width="110"
          />
          <el-table-column
            v-if="canViewField('record.reversal_date')"
            label="退库时间"
            min-width="168"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.reversal_date) }}
            </template>
          </el-table-column>
          <el-table-column
            v-for="item in visibleReturnSelectFields"
            :key="item.field"
            :prop="item.field"
            :label="item.label"
            min-width="120"
          >
            <template #default="{ row }">
              {{ row[item.field] || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('record.refund_amount')"
            label="退款金额"
            min-width="110"
          >
            <template #default="{ row }">
              {{ settlementText(row) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('record.refund_method')"
            label="退款方式"
            min-width="110"
          >
            <template #default="{ row }">
              <PaymentMethodText
                :value="row.refund_method"
                :channel="row.refund_channel"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('record.created_at')"
            label="操作时间"
            min-width="168"
          >
            <template #default="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="canViewField('record.remarks')"
            prop="remarks"
            label="备注"
            min-width="220"
            class-name="complete-text-column wrapped-text-column"
          />
          <el-table-column
            v-if="!isMobile && (showActionColumn)"
            label="操作"
            :width="$getActionColumnWidth(Number(canEdit) + Number(canDelete))"
            align="center"
            class-name="actions-column"
          >
            <template #default="{ row }">
              <div class="table-actions">
                <el-text
                  v-if="!isLegacyRecord(row)"
                  type="info"
                >
                  只读
                </el-text>
                <el-button
                  v-if="canEdit && isLegacyRecord(row)"
                  type="primary"
                  link
                  @click.stop="openEditDialog(row)"
                >
                  编辑
                </el-button>
                <el-button
                  v-if="canDelete && isLegacyRecord(row)"
                  type="danger"
                  link
                  @click.stop="handleDelete(row)"
                >
                  删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <RecordDetailDialog
          v-model="mobileDetailVisible"
          title="退库记录详情"
          :record="mobileDetailRow"
          :fields="mobileDetailFields"
          :has-actions="Boolean(mobileDetailRow && isLegacyRecord(mobileDetailRow) && (canEdit || canDelete))"
        >
          <template #actions="{ row }">
            <el-button
              v-if="canEdit && isLegacyRecord(row)"
              type="primary"
              link
              @click.stop="mobileDetailRunAction(() => openEditDialog(row))"
            >
              编辑
            </el-button>
            <el-button
              v-if="canDelete && isLegacyRecord(row)"
              type="danger"
              link
              @click.stop="mobileDetailRunAction(() => handleDelete(row))"
            >
              删除
            </el-button>
          </template>
        </RecordDetailDialog>
      </div>



      <Pagination
        v-model:current="pagination.page"
        v-model:page-size="pagination.page_size"
        :total="pagination.total"
        :show-page-sizes="false"
        :show-quick-jumper="false"
        @current-change="handlePageChange"
      />
    </div>

    <MobileDialog
      v-model="editDialogVisible"
      title="编辑退库记录"
      width="620px"
      :close-on-click-modal="false"
      dialog-class="returngoods-edit-dialog"
      :show-default-footer="false"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editFormRules"
        label-position="top"
        class="edit-dialog-body tf-form-layout tf-form-grid"
      >
        <div class="edit-grid tf-form-row tf-form-row--three">
          <el-form-item
            v-if="canViewField('record.sale_info')"
            label="原销售ID"
            prop="original_sale_id_display"
            class="edit-item"
          >
            <el-input
              v-model="editForm.original_sale_id_display"
              disabled
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('record.sale_info')"
            label="销售类型"
            prop="original_sale_type"
            class="edit-item"
          >
            <el-select
              v-model="editForm.original_sale_type"
              placeholder="请选择销售类型"
              clearable
            >
              <el-option
                v-for="option in PHONE_STATUS_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="canViewField('record.sale_info')"
            label="销售员"
            prop="original_sale_operator_id"
            class="edit-item"
          >
            <el-select
              v-model="editForm.original_sale_operator_id"
              placeholder="请选择销售员"
              filterable
              remote
              reserve-keyword
              :remote-method="searchOperatorOptions"
              clearable
              @focus="searchOperatorOptions('')"
              @change="handleOperatorChange"
            >
              <el-option
                v-for="operator in operatorOptions"
                :key="operator.id"
                :label="operator.name"
                :value="operator.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="canViewField('record.reversal_date')"
            label="退库时间"
            prop="reversal_date"
            class="edit-item"
          >
            <el-date-picker
              v-model="editForm.reversal_date"
              type="datetime"
              :value-format="TIME_FORMATS.DATETIME"
              :format="TIME_FORMATS.DATETIME_MINUTE"
              placeholder="请选择退库时间"
              clearable
              style="width: 100%;"
            />
          </el-form-item>
          <el-form-item
            v-for="item in visibleReturnSelectFields"
            :key="item.field"
            :label="item.label"
            :prop="item.field"
            class="edit-item"
          >
            <el-select
              v-model="editForm[item.field]"
              :placeholder="`请选择${item.label}`"
            >
              <el-option
                v-for="option in RETURN_STOCK_OPTIONS[item.field]"
                :key="option"
                :label="option"
                :value="option"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="canViewField('record.refund_amount')"
            label="退款金额"
            prop="refund_amount"
            class="edit-item"
          >
            <AmountInput
              v-model="editForm.refund_amount"
              :min="0"
              :max="99999999.99"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('record.refund_method')"
            label="退款方式"
            prop="refund_method"
            class="edit-item"
          >
            <PaymentMethodSelect
              v-model="editForm.refund_method"
              variant="refund"
              placeholder="请选择退款方式"
              @update:model-value="editForm.refund_channel = null"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('record.refund_method') && hasPaymentChannelOptions(editForm.refund_method)"
            label="退款渠道"
            prop="refund_channel"
            class="edit-item"
          >
            <PaymentChannelSelect
              v-model="editForm.refund_channel"
              :payment-method="editForm.refund_method"
              placeholder="请选择退款渠道"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('record.remarks')"
            label="备注"
            prop="remarks"
            class="edit-item edit-item-full tf-form-field--wide"
          >
            <el-input
              v-model="editForm.remarks"
              class="tf-textarea"
              type="textarea"
              :rows="2"
              placeholder="请输入退库备注"
              maxlength="200"
              clearable
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions edit-dialog-footer">
          <el-button @click="editDialogVisible = false">
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="submitting"
            @click="handleSave"
          >
            保存
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { getPaymentMethodLabel } from '@/constants/paymentMethods'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import type { ReturnGoodsRecord } from '@/types/return-stock'
import { RETURN_STOCK_OPTIONS, RETURN_STOCK_SELECT_FIELDS } from '@/constants/returnStock'
import { PaymentMethodSelect, PaymentChannelSelect, PaymentMethodText } from '@/components/payment'
import { hasPaymentChannelOptions } from '@/constants/paymentMethods'
import { formatAmount } from '@/utils/format'
import { confirmAction } from '@/utils/message-box'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { searchOperators } from '@/services/reference-options'
import { useNotification } from '@/composables/useNotification'
import { useMobile } from '@/composables/mobile'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import MobileDialog from '@/components/MobileDialog.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import Pagination from '@/components/Pagination.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import { PHONE_STATUS_OPTIONS, getPhoneStatusLabel, normalizePhoneStatus } from '@/constants/phoneStatuses'
import { formatDateTime as formatGlobalDateTime } from '@/utils/format'
import { getRequestErrorMessage } from '@/utils/api-response'


interface OperatorOption {
  id: number
  name: string
}

interface OperatorSearchRecord { id?: number | string; name?: string; username?: string }

const { success, error } = useNotification()
const { isMobile } = useMobile()
const { canView, canEdit, canDelete, handleNoPermission } = usePagePermissions('returngoods')
const RETURNGOODS_MODULE_KEY = 'system_returngoods'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(RETURNGOODS_MODULE_KEY, fieldKey)
const visibleReturnSelectFields = computed(() => RETURN_STOCK_SELECT_FIELDS.filter(item => canViewField(item.permission)))
const showActionColumn = computed(() => shouldShowActionColumn(
  canViewField('system_info.operations'),
  [canEdit.value, canDelete.value]
))

const { loading } = useLoadingState()
loading.value = true
const submitting = ref(false)
const searchExpanded = ref(false)
const editDialogVisible = ref(false)
const editFormRef = ref<FormInstance>()
const records = ref<ReturnGoodsRecord[]>([])
const operatorOptions = ref<OperatorOption[]>([])
const stats = reactive({
  total_records: 0,
  total_phones: 0,
  total_days: 0
})
const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const searchForm = reactive({
  keyword: '',
  start_date: '',
  end_date: ''
})

const returnDateRange = computed<[string, string] | [] | null>({
  get: () => {
    if (!searchForm.start_date && !searchForm.end_date) return null
    return [searchForm.start_date, searchForm.end_date] as [string, string]
  },
  set: value => {
    searchForm.start_date = value?.[0] || ''
    searchForm.end_date = value?.[1] || ''
  }
})

const editForm = reactive({
  id: 0,
  original_sale_id_display: '',
  original_sale_type: '',
  original_sale_operator_id: null as number | null,
  original_sale_operator_name: '',
  reversal_date: '',
  return_reason: '',
  return_type: '',
  handle_method: '',
  refund_amount: null as number | null,
  refund_method: '',
  refund_channel: null as string | null,
  remarks: ''
})

const editFormRules: FormRules = {
  return_reason: [{ required: true, message: '请选择退库原因', trigger: 'change' }],
  return_type: [{ required: true, message: '请选择退库类型', trigger: 'change' }],
  handle_method: [{ required: true, message: '请选择处理方式', trigger: 'change' }],
  reversal_date: [{ required: true, message: '请选择退库时间', trigger: 'change' }],
  refund_method: [{ required: true, message: '请选择退款方式', trigger: 'change' }],
  refund_channel: [{ required: true, message: '请选择退款渠道', trigger: 'change' }],
  refund_amount: [{ required: true, message: '请填写退款金额，未退款时填写0', trigger: 'change' }]
}

const formatDateTime = (value?: string | null) => formatGlobalDateTime(value, TIME_FORMATS.DATETIME_MINUTE)

const getSaleTypeText = (value?: string | null) => getPhoneStatusLabel(value)

const loadRecords = async (isRefresh = false) => {
  if (!canView.value) {
    records.value = []
    pagination.total = 0
    stats.total_records = 0
    stats.total_phones = 0
    stats.total_days = 0
    loading.value = false
    return
  }

  loading.value = true

  try {
    const response = await unifiedApi.get('/query/returngoods', {
      showError: false,
      params: {
        page: pagination.page,
        page_size: pagination.page_size,
        keyword: searchForm.keyword || undefined,
        start_date: searchForm.start_date || undefined,
        end_date: searchForm.end_date || undefined
      }
    })

    if (!response?.success) {
      throw new Error(response?.message || '退库记录加载失败')
    }

    records.value = Array.isArray(response.data) ? response.data : []

    const meta = response.pagination || response.meta || {}
    pagination.total = Number(meta.total || 0)
    stats.total_records = Number(meta.stats?.total_records || 0)
    stats.total_phones = Number(meta.stats?.total_phones || 0)
    stats.total_days = Number(meta.stats?.total_days || 0)
  } catch (err: unknown) {
    if (isRefresh) throw err
    records.value = []
    pagination.total = 0
    stats.total_records = 0
    stats.total_phones = 0
    stats.total_days = 0
    error(getRequestErrorMessage(err, '退库记录加载失败'))
  } finally {
    loading.value = false
  }
}

const loadOperators = async () => {
  try {
    const response = await searchOperators({ page: 1, page_size: 20 })
    if (response?.success && Array.isArray(response.data)) {
      operatorOptions.value = response.data.map((item: OperatorSearchRecord) => ({
        id: Number(item.id),
        name: item.name || item.username || `用户${item.id}`
      }))
    }
  } catch (err) {
    operatorOptions.value = []
  }
}

const searchOperatorOptions = async (keyword = '') => {
  try {
    const response = await searchOperators({
      keyword: keyword.trim() || undefined,
      page: 1,
      page_size: 20
    })
    if (response?.success && Array.isArray(response.data)) {
      operatorOptions.value = response.data.map((item: OperatorSearchRecord) => ({
        id: Number(item.id),
        name: item.name || item.username || `用户${item.id}`
      }))
    }
  } catch (error) {
    operatorOptions.value = []
  }
}

const isLegacyRecord = (record: ReturnGoodsRecord): record is ReturnGoodsRecord & { id: number } =>
  record.record_source !== 'sales_aftersale' && typeof record.id === 'number' && Number.isSafeInteger(record.id) && record.id > 0

const settlementText = (record: ReturnGoodsRecord) => {
  if (record.record_source === 'sales_aftersale') {
    if (record.collection_amount === null || record.collection_amount === undefined ||
      record.refund_amount === null || record.refund_amount === undefined) return '-'
    return Number(record.collection_amount) > 0
      ? `整单补款 ${formatAmount(record.collection_amount)}`
      : `整单退款 ${formatAmount(record.refund_amount)}`
  }
  return record.refund_amount === null || record.refund_amount === undefined ? '-' : formatAmount(record.refund_amount)
}

const openEditDialog = (record: ReturnGoodsRecord) => {
  if (!isLegacyRecord(record)) return
  editForm.id = record.id
  editForm.original_sale_id_display = record.original_sale_id ? String(record.original_sale_id) : '-'
  editForm.original_sale_type = normalizePhoneStatus(record.original_sale_type)
  editForm.original_sale_operator_id = record.original_sale_operator_id || null
  editForm.original_sale_operator_name = record.original_sale_operator_name || ''
  if (record.original_sale_operator_id && !operatorOptions.value.some(item => item.id === record.original_sale_operator_id)) {
    operatorOptions.value.push({
      id: record.original_sale_operator_id,
      name: record.original_sale_operator_name || `用户${record.original_sale_operator_id}`
    })
  }
  editForm.reversal_date = TimeUtil.format(record.reversal_date, TIME_FORMATS.DATETIME)
  editForm.return_reason = record.return_reason || ''
  editForm.return_type = record.return_type || ''
  editForm.handle_method = record.handle_method || ''
  editForm.refund_amount = record.refund_amount === null || record.refund_amount === undefined ? null : Number(record.refund_amount)
  editForm.refund_method = record.refund_method || ''
  editForm.refund_channel = record.refund_channel || null
  editForm.remarks = record.remarks || ''
  editDialogVisible.value = true
  void nextTick(() => editFormRef.value?.clearValidate())
}

const handleOperatorChange = (operatorId: number | null) => {
  const matched = operatorOptions.value.find((item) => item.id === operatorId)
  if (matched) {
    editForm.original_sale_operator_name = matched.name
  }
}

const handleSave = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  if (submitting.value) return
  if (!editForm.id) return
  if (!await editFormRef.value?.validate().catch(() => false)) return

  submitting.value = true
  try {
    const payload: Record<string, string | number | null> = {}
    const fieldMap = {
      original_sale_type: 'record.sale_info',
      original_sale_operator_id: 'record.sale_info',
      original_sale_operator_name: 'record.sale_info',
      reversal_date: 'record.reversal_date',
      return_reason: 'record.return_reason',
      return_type: 'record.return_type',
      handle_method: 'record.handle_method',
      refund_amount: 'record.refund_amount',
      refund_method: 'record.refund_method',
      refund_channel: 'record.refund_method',
      remarks: 'record.remarks'
    } as const
    for (const key of Object.keys(fieldMap) as Array<keyof typeof fieldMap>) {
      if (canViewField(fieldMap[key])) payload[key] = editForm[key]
    }
    const response = await unifiedApi.put(`/query/returngoods/${editForm.id}`, payload)

    if (!response?.success) {
      throw new Error(response?.message || '退库记录更新失败')
    }

    editDialogVisible.value = false
    success('退库记录已更新')
    await loadRecords()
  } catch (err: unknown) {
    error(getRequestErrorMessage(err, '退库记录更新失败'))
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (record: ReturnGoodsRecord) => {
  if (!isLegacyRecord(record)) return
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }
  try {
    await confirmAction(
      `确定删除退库记录 #${record.id} 吗？`,
      '删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
  } catch {
    return
  }

  try {
    const response = await unifiedApi.delete(`/query/returngoods/${record.id}`)
    if (!response?.success) {
      throw new Error(response?.message || '退库记录删除失败')
    }
    success('退库记录已删除')
    await loadRecords()
  } catch (err: unknown) {
    error(getRequestErrorMessage(err, '退库记录删除失败'))
  }
}

const handleSearch = async () => {
  pagination.page = 1
  await loadRecords()
}

const handleReset = async () => {
  searchForm.keyword = ''
  searchForm.start_date = ''
  searchForm.end_date = ''
  pagination.page = 1
  await loadRecords()
}

const handlePageChange = async (page: number) => {
  pagination.page = page
  await loadRecords()
}

defineExpose({
  reload: async () => {
    unifiedApi.clearCache('/query/returngoods')
    await loadRecords(true)
  }
})

onMounted(() => {
  void fieldPermissions.init()
  if (!canView.value) {
    loading.value = false
    return
  }

  loadRecords()
  loadOperators()
})

const { detailRow: mobileDetailRow, detailVisible: mobileDetailVisible, doubleTapOptions: mobileDetailTapOptions, handleRowDoubleClick: mobileDetailDoubleClick, runDetailAction: mobileDetailRunAction } = useMobileTableDetail<ReturnGoodsRecord>({
  enabled: () => isMobile.value && canView.value, rows: () => records.value, getKey: row => row.id
})
const mobileDetailFields = computed<RecordDetailField[]>(() => {
  const row = mobileDetailRow.value
  if (!row) return []
  return [
    { key: 'phone_id', label: '设备ID', value: row.phone_id, visible: canViewField('record.product_info') },
    { key: 'product', label: '商品信息', value: [row.brand, row.model, row.color, row.memory].filter(Boolean).join(' '), visible: canViewField('record.product_info') },
    { key: 'imei', label: 'IMEI', value: row.imei, visible: canViewField('record.product_info'), wide: true },
    { key: 'customer_name', label: '客户', value: row.customer_name, visible: canViewField('record.customer') },
    { key: 'operator_name', label: '操作员', value: row.operator_name, visible: canViewField('record.operator') },
    { key: 'original_sale_id', label: '原销售ID', value: row.original_sale_id, visible: canViewField('record.sale_info') },
    { key: 'sale_type', label: '销售类型', value: getSaleTypeText(row.original_sale_type), visible: canViewField('record.sale_info') },
    { key: 'sale_operator', label: '销售员', value: row.original_sale_operator_name, visible: canViewField('record.sale_info') },
    { key: 'reversal_date', label: '退库时间', value: formatDateTime(row.reversal_date), visible: canViewField('record.reversal_date'), wide: true },
    { key: 'refund_amount', label: '退款金额', value: settlementText(row), visible: canViewField('record.refund_amount') },
    ...visibleReturnSelectFields.value.map(field => ({ key: field.field, label: field.label, value: row[field.field], visible: true })),
    { key: 'refund_method', label: '退款方式', value: [getPaymentMethodLabel(row.refund_method), row.refund_channel ? getPaymentMethodLabel(row.refund_channel) : ''].filter(Boolean).join(' / '), visible: canViewField('record.refund_method') },
    { key: 'created_at', label: '操作时间', value: formatDateTime(row.created_at), visible: canViewField('record.created_at'), wide: true },
    { key: 'remarks', label: '备注', value: row.remarks, visible: canViewField('record.remarks'), wide: true }
  ]
})
</script>

<style scoped>
.returngoods-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.returngoods-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.overview-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, var(--color-bg-white) 0%, var(--tf-color-surface-blue) 100%);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.overview-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--tf-type-scale-18);
  color: var(--color-bg-white);
}

.overview-icon.primary {
  background: linear-gradient(135deg, var(--tf-color-blue-600) 0%, var(--tf-color-blue-500) 100%);
}

.overview-icon.success {
  background: linear-gradient(135deg, var(--tf-color-emerald-600) 0%, var(--tf-color-emerald-500) 100%);
}

.overview-icon.warning {
  background: linear-gradient(135deg, var(--tf-color-amber-600) 0%, var(--tf-color-amber-500) 100%);
}

.overview-content {
  min-width: 0;
}

.overview-value {
  font-size: var(--tf-type-scale-28);
  line-height: 1;
  font-weight: 700;
  color: var(--tf-color-slate-900);
}

.overview-label {
  margin-top: 6px;
  font-size: var(--tf-type-scale-13);
  color: var(--tf-color-slate-500);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--tf-type-scale-16);
  font-weight: 700;
  color: var(--tf-color-slate-900);
}

.product-cell {
  min-width: 0;
}

.product-name {
  font-size: var(--tf-type-scale-14);
  font-weight: 600;
  color: var(--tf-color-slate-900);
  line-height: 1.4;
  word-break: break-word;
}

.product-meta {
  margin-top: 4px;
  font-size: var(--tf-type-scale-12);
  color: var(--tf-color-slate-500);
}

.table-wrapper {
  overflow-x: auto;
  overflow-y: visible;
}

.table-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  min-width: 0;
  white-space: nowrap;
}

.edit-dialog-body {
  padding: 4px 0 0;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.edit-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-item label {
  font-size: var(--tf-type-scale-13);
  font-weight: 600;
  color: var(--tf-color-slate-700);
}

.edit-item-full {
  grid-column: 1 / -1;
}

@media (max-width: 767px) {
  .returngoods-overview {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .overview-card {
    padding: 12px 10px;
    border-radius: 14px;
    gap: 10px;
  }

  .overview-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    font-size: var(--tf-type-scale-14);
  }

  .overview-value {
    font-size: var(--tf-type-scale-20);
  }

  .overview-label {
    font-size: var(--tf-type-scale-11);
    margin-top: 4px;
  }

  .edit-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    margin-bottom: 10px;
  }

}
</style>
