<template>
  <el-tab-pane
    data-view-permission="salary-templates:view"
    label="工资模板"
    name="templates"
    class="tf-tab-panel salary-templates-tab"
  >
    <UnifiedSearchPanel
      :expanded="searchExpanded"
      :loading="loading"
      @update:expanded="emit('update:searchExpanded', $event)"
      @search="emit('search')"
      @reset="emit('reset')"
    >
      <template #primary>
        <el-input
          :model-value="searchText"
          placeholder="搜索模板名称"
          clearable
          @update:model-value="emit('update:searchText', $event)"
          @click.stop
        >
          <template #prefix>
            <i class="fas fa-file-invoice" />
          </template>
        </el-input>
      </template>
      <div
        v-if="canViewField('salary_salarytemplatesview', 'template_is_active')"
        class="form-group filter-item"
        data-field="is_active"
      >
        <el-select
          :model-value="statusFilter"
          placeholder="状态"
          clearable
          @update:model-value="emit('update:statusFilter', $event)"
          @change="emit('statusChange')"
        >
          <el-option
            label="已启用"
            :value="true"
          />
          <el-option
            label="已禁用"
            :value="false"
          />
        </el-select>
      </div>
    </UnifiedSearchPanel>

    <div class="table-section admin-panel admin-table-panel">
      <div class="section-header">
        <div class="section-title">
          <i class="fas fa-list" />工资模板<span class="record-count">共 {{ filteredTemplates.length }} 条记录</span>
        </div>
      </div>
      <div class="table-responsive">
        <el-table
          v-table-double-tap="mobileDetailTapOptions"
          v-tf-loading="{ active: loading, text: '正在刷新工资模板...' }"
          :data="templates"
          border
          stripe
          table-layout="fixed"
          :fit="true"
          row-key="id"
          class="data-table devices-table base-data-table salary-template-table"
          @row-dblclick="mobileDetailDoubleClick"
        >
          <template #empty>
            <TableLoadingRow
              v-if="loading"
              mode="block"
              text="正在读取工资模板..."
            />
            <DataEmptyState
              v-else
              description="暂无工资模板"
            />
          </template>


          <el-table-column
            type="index"
            label="序号"
            :width="$getNumberColumnWidth((templates || []).map((_row, $index) => getTemplateIndex($index)), isMobile ? 54 : 60)"
            :index="getTemplateIndex"
            align="center"
            class-name="index-col"
          >
            <template #default="{ $index }">
              <span class="table-number-badge">{{ getTemplateIndex($index) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showNameColumn"
            prop="name"
            label="模板名称"
            :min-width="nameColumnWidth"
            align="center"
            class-name="name-col"
          >
            <template #default="{ row }">
              <div class="template-name-cell whitespace-nowrap">
                <span class="name-text">{{ row.name }}</span>
                <el-tag
                  v-if="canViewField('salary_salarytemplatesview', 'template_is_active') && !row.is_active"
                  type="info"
                  size="small"
                  class="status-badge ml-2"
                >
                  已禁用
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showDescriptionColumn && !isMobile"
            prop="description"
            label="说明"
            :min-width="descriptionColumnWidth"
            align="center"
            class-name="complete-text-column wrapped-text-column"
          />
          <el-table-column
            v-if="showBaseSalaryColumn"
            label="底薪"
            :min-width="baseSalaryColumnWidth"
            align="center"
            class-name="salary-col"
          >
            <template #default="{ row }">
              <span class="whitespace-nowrap">¥{{ formatSalaryNumber(row.base_salary) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showCommissionColumn && !isMobile"
            label="提成设置"
            :min-width="commissionColumnWidth"
            align="left"
          >
            <template #default="{ row }">
              <div class="whitespace-nowrap flex items-center">
                <el-tag
                  :type="row.commission_type === 'fixed' ? 'success' : 'primary'"
                  size="small"
                  effect="plain"
                >
                  {{ row.commission_type === 'fixed' ? '固定' : '利润' }}
                </el-tag>
                <template v-if="row.commission_type === 'fixed'">
                  <span class="ml-2">新机¥{{ formatSalaryNumber(row.commission_new_fixed || row.commission_fixed || 0) }}</span>
                  <span class="ml-2">二手¥{{ formatSalaryNumber(row.commission_used_fixed || 0) }}</span>
                </template>
                <template v-else>
                  <span class="ml-2">{{ row.commission_percentage }}%</span>
                </template>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showRateColumn && !isMobile"
            label="考勤费率"
            :min-width="rateColumnWidth"
            align="center"
          >
            <template #default="{ row }">
              <div class="whitespace-nowrap">
                <span>加班¥{{ formatSalaryNumber(row.overtime_hourly_rate) }}/h</span>
                <span class="ml-3">月休{{ row.rest_days || 0 }}天</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showEmployeeCountColumn"
            label="使用人数"
            :min-width="employeeCountColumnWidth"
            align="center"
          >
            <template #default="{ row }">
              <span class="whitespace-nowrap">{{ getEmployeeCount(row.id) }}人</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="!isMobile && showActionColumn"
            label="操作"
            :width="actionColumnWidth"
            align="center"
            class-name="actions-column"
          >
            <template #default="{ row }">
              <div class="template-action-buttons action-buttons">
                <el-button
                  v-if="!row.is_default && canEdit && canEditField('salary_salarytemplatesview', 'template_is_default')"
                  v-permission="'salary-templates:edit'"
                  type="warning"
                  plain
                  @click.stop="emit('setDefault', row)"
                >
                  <i class="fas fa-star" />
                  <span class="btn-text">默认</span>
                </el-button>
                <el-button
                  v-if="canEdit && canEditField('salary_salarytemplatesview', 'template_is_active')"
                  v-permission="'salary-templates:edit'"
                  :type="row.is_active ? 'warning' : 'success'"
                  plain
                  @click.stop="emit('toggleStatus', row)"
                >
                  <i :class="row.is_active ? 'fas fa-pause' : 'fas fa-play'" />
                  <span class="btn-text">{{ row.is_active ? '禁用' : '启用' }}</span>
                </el-button>
                <el-button
                  v-if="canEdit"
                  v-permission="'salary-templates:edit'"
                  type="primary"
                  plain
                  @click.stop="emit('edit', row)"
                >
                  <i class="fas fa-edit" />
                  <span class="btn-text">编辑</span>
                </el-button>
                <el-button
                  v-if="canDelete"
                  v-permission="'salary-templates:delete'"
                  type="danger"
                  plain
                  @click.stop="emit('delete', row)"
                >
                  <i class="fas fa-trash" />
                  <span class="btn-text">删除</span>
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <RecordDetailDialog
          v-model="mobileDetailVisible"
          title="工资模板详情"
          :fields="mobileDetailFields"
          :record="mobileDetailRow"
          :has-actions="canEdit || canDelete"
        >
          <template #actions="{ row }">
            <el-button
              v-if="!row.is_default && canEdit && canEditField('salary_salarytemplatesview', 'template_is_default')"
              v-permission="'salary-templates:edit'"
              type="warning"
              @click.stop="mobileDetailRunAction(() => emit('setDefault', row))"
            >
              <i class="fas fa-star" />
              <span>默认</span>
            </el-button>
            <el-button
              v-if="canEdit && canEditField('salary_salarytemplatesview', 'template_is_active')"
              v-permission="'salary-templates:edit'"
              :type="row.is_active ? 'warning' : 'success'"
              @click.stop="mobileDetailRunAction(() => emit('toggleStatus', row))"
            >
              <i :class="row.is_active ? 'fas fa-pause' : 'fas fa-play'" />
              <span>{{ row.is_active ? '禁用' : '启用' }}</span>
            </el-button>
            <el-button
              v-if="canEdit"
              v-permission="'salary-templates:edit'"
              type="primary"
              @click.stop="mobileDetailRunAction(() => emit('edit', row))"
            >
              <i class="fas fa-edit" />
              <span>编辑</span>
            </el-button>
            <el-button
              v-if="canDelete"
              v-permission="'salary-templates:delete'"
              type="danger"
              @click.stop="mobileDetailRunAction(() => emit('delete', row))"
            >
              <i class="fas fa-trash" />
              <span>删除</span>
            </el-button>
          </template>
        </RecordDetailDialog>
      </div>

      <Pagination
        v-if="filteredTemplates.length > 0"
        :current="page"
        :page-size="pageSize"
        :total="filteredTemplates.length"
        :page-sizes="[20, 50, 100]"
        :show-total="true"
        :show-range="true"
        :show-page-sizes="true"
        :show-quick-jumper="true"
        :disabled="loading"
        @update:current="emit('update:page', $event)"
        @update:page-size="emit('update:pageSize', $event)"
        @change="handlePaginationChange"
      />
    </div>
  </el-tab-pane>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { getActionColumnMinWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { formatSalaryNumber } from '../salary-formatters'
import type { SalaryTemplate } from '@/types/salary'


const props = defineProps<{
  canDelete: boolean
  canEdit: boolean
  canEditField: (_moduleKey: string, _fieldName: string) => boolean
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  filteredTemplates: SalaryTemplate[]
  getEmployeeCount: (_templateId: number) => number
  isMobile: boolean
  loading: boolean
  page: number
  pageSize: number
  searchExpanded: boolean
  searchText: string
  statusFilter?: boolean
  templates: SalaryTemplate[]
}>()

const emit = defineEmits<{
  delete: [row: SalaryTemplate]
  edit: [row: SalaryTemplate]
  paginationChange: [page: number, pageSize: number]
  reset: []
  search: []
  setDefault: [row: SalaryTemplate]
  statusChange: []
  toggleStatus: [row: SalaryTemplate]
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'update:searchExpanded': [value: boolean]
  'update:searchText': [value: string]
  'update:statusFilter': [value: boolean | undefined]
}>()


const showNameColumn = computed(() => props.canViewField('salary_salarytemplatesview', 'template_name'))
const showDescriptionColumn = computed(() => props.canViewField('salary_salarytemplatesview', 'template_description'))
const showBaseSalaryColumn = computed(() => props.canViewField('salary_salarytemplatesview', 'template_base_salary'))
const showCommissionColumn = computed(() => (
  props.canViewField('salary_salarytemplatesview', 'template_commission_type') ||
  props.canViewField('salary_salarytemplatesview', 'template_commission_new_fixed') ||
  props.canViewField('salary_salarytemplatesview', 'template_commission_used_fixed') ||
  props.canViewField('salary_salarytemplatesview', 'template_commission_percentage')
))
const showRateColumn = computed(() => (
  props.canViewField('salary_salarytemplatesview', 'template_overtime_hourly_rate') ||
  props.canViewField('salary_salarytemplatesview', 'template_rest_days')
))
const showEmployeeCountColumn = computed(() => props.canViewField('salary_salarytemplatesview', 'template_employee_count'))
const showActionColumn = computed(() => shouldShowActionColumn(
  props.canViewField('salary_salarytemplatesview', 'actions'),
  [props.canEdit, props.canDelete]
))

const nameColumnWidth = computed(() => getTextColumnMinWidth(
  ['模板名称', ...props.templates.map(item => `${item.name || '-'}${item.is_active ? '' : ' 已禁用'}`)],
  { minWidth: 110, maxWidth: 180, horizontalPadding: 28 }
))
const descriptionColumnWidth = computed(() => getTextColumnMinWidth(
  ['说明', ...props.templates.map(item => item.description)],
  { minWidth: 96, maxWidth: 180, horizontalPadding: 28 }
))
const baseSalaryColumnWidth = computed(() => getTextColumnMinWidth(
  ['底薪', ...props.templates.map(item => `¥${formatSalaryNumber(item.base_salary ?? 0)}`)],
  { minWidth: 88, maxWidth: 110, horizontalPadding: 24 }
))
const commissionColumnWidth = computed(() => getTextColumnMinWidth(
  [
    '提成设置',
    ...props.templates.map(item => item.commission_type === 'fixed'
      ? `固定 新机¥${formatSalaryNumber(item.commission_new_fixed || item.commission_fixed || 0)} 二手¥${formatSalaryNumber(item.commission_used_fixed || 0)}`
      : `利润 ${formatSalaryNumber(item.commission_percentage || 0)}%`)
  ],
  { minWidth: 130, maxWidth: 220, horizontalPadding: 38 }
))
const rateColumnWidth = computed(() => getTextColumnMinWidth(
  [
    '考勤费率',
    ...props.templates.map(item => `加班¥${formatSalaryNumber(item.overtime_hourly_rate ?? 0)}/h 月休${item.rest_days || 0}天`)
  ],
  { minWidth: 130, maxWidth: 180, horizontalPadding: 26 }
))
const employeeCountColumnWidth = computed(() => getTextColumnMinWidth(
  ['使用人数', ...props.templates.map(item => `${props.getEmployeeCount(item.id)}人`)],
  { minWidth: 82, maxWidth: 100, horizontalPadding: 24 }
))
const actionColumnWidth = computed(() => {
  let buttonCount = 0
  if (props.canEdit) {
    buttonCount += 2
    if (props.templates.some(item => !item.is_default)) buttonCount += 1
  }
  if (props.canDelete) buttonCount += 1
  return getActionColumnMinWidth(buttonCount)
})

const getTemplateIndex = (index: number) => (props.page - 1) * props.pageSize + index + 1



const resetInteraction = () => mobileDetailClose()

const handlePaginationChange = (page: number, pageSize: number) => {
  resetInteraction()
  emit('paginationChange', page, pageSize)
}

defineExpose({ resetInteraction })
const { detailRow: mobileDetailRow, detailVisible: mobileDetailVisible, doubleTapOptions: mobileDetailTapOptions,
  handleRowDoubleClick: mobileDetailDoubleClick, runDetailAction: mobileDetailRunAction, closeDetail: mobileDetailClose } = useMobileTableDetail<SalaryTemplate>({
    enabled: () => props.isMobile, rows: () => props.templates, getKey: row => row.id
  })
const mobileDetailFields = computed<RecordDetailField[]>(() => {
  const row = mobileDetailRow.value
  if (!row) return []
  return [
    { key: 'template_name', label: '模板名称', value: row.name, visible: props.canViewField('salary_salarytemplatesview', 'template_name') },
    { key: 'template_description', label: '说明', value: row.description, visible: props.canViewField('salary_salarytemplatesview', 'template_description'), wide: true },
    { key: 'template_base_salary', label: '底薪', value: formatSalaryNumber(row.base_salary ?? 0), visible: props.canViewField('salary_salarytemplatesview', 'template_base_salary') },
    { key: 'template_commission_type', label: '提成方式', value: row.commission_type === 'fixed' ? '固定' : '利润', visible: props.canViewField('salary_salarytemplatesview', 'template_commission_type') },
    { key: 'template_commission_new_fixed', label: '新机固定提成', value: formatSalaryNumber(row.commission_new_fixed || row.commission_fixed || 0), visible: props.canViewField('salary_salarytemplatesview', 'template_commission_new_fixed') },
    { key: 'template_commission_used_fixed', label: '二手固定提成', value: formatSalaryNumber(row.commission_used_fixed || 0), visible: props.canViewField('salary_salarytemplatesview', 'template_commission_used_fixed') },
    { key: 'template_commission_percentage', label: '提成比例', value: `${row.commission_percentage || 0}%`, visible: props.canViewField('salary_salarytemplatesview', 'template_commission_percentage') },
    { key: 'template_overtime_hourly_rate', label: '加班费率', value: formatSalaryNumber(row.overtime_hourly_rate ?? 0), visible: props.canViewField('salary_salarytemplatesview', 'template_overtime_hourly_rate') },
    { key: 'template_rest_days', label: '月休天数', value: row.rest_days, visible: props.canViewField('salary_salarytemplatesview', 'template_rest_days') },
    { key: 'template_employee_count', label: '使用人数', value: props.getEmployeeCount(row.id), visible: props.canViewField('salary_salarytemplatesview', 'template_employee_count') }
  ]
})
</script>

<style scoped>
.filter-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.template-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-name-cell .name-text {
  color: var(--color-text-primary);
  font-weight: 500;
}

.template-name-cell .status-badge {
  height: 18px;
  padding: 2px 6px;
  font-size: var(--tf-type-scale-11);
  line-height: 18px;
}

@media (max-width: 767px) {
  .table-section > .section-header {
    display: none;
  }

  .salary-template-table .template-name-cell {
    justify-content: center;
  }
}
</style>
