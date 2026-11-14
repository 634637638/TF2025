<template>
  <MobileDialog
    :model-value="modelValue"
    title="员工销售明细"
    :width="dialogWidth"
    dialog-class="salary-dialog salary-dialog-large"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      v-if="employee"
      class="sales-details admin-page"
    >
      <div class="details-info">
        <div
          v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
          class="info-row"
        >
          <label>员工姓名:</label>
          <span>{{ employee.name }}</span>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'period_start')"
          class="info-row"
        >
          <label>月份:</label>
          <span>{{ salaryMonth }}</span>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
          class="info-row"
        >
          <label>销售数量:</label>
          <span class="highlight">{{ summary.total_count }} 台</span>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
          class="info-row"
        >
          <label>销售额:</label>
          <span class="amount">¥{{ formatAmount(summary.total_sales) }}</span>
        </div>
        <div
          v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
          class="info-row"
        >
          <label>总利润:</label>
          <span class="profit">¥{{ formatAmount(summary.total_profit) }}</span>
        </div>
      </div>

      <div class="sales-details-table">
        <h4 class="section-title">
          销售明细列表
        </h4>
        <SectionLoading
          v-if="loading"
          text="正在读取员工销售明细..."
        />

        <div
          v-else-if="details.length > 0"
          class="table-responsive salary-detail-table-wrap"
          data-table-drag-scroll
          :style="{ '--salary-detail-table-width': `${tableWidth}px` }"
        >
          <el-table
            :data="details"
            border
            stripe
            class="data-table devices-table base-data-table salary-sales-detail-table"
            table-layout="fixed"
            :fit="false"
          >
            <el-table-column
              label="序号"
              :width="$getNumberColumnWidth((details || []).map((_row, $index) => $index + 1), 60)"
              align="center"
            >
              <template #default="{ $index }">
                <span class="table-number-badge">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
              label="机型"
              width="72"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  :type="row.is_new ? 'success' : 'warning'"
                  size="small"
                >
                  {{ row.is_new ? '全新' : '二手' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
              prop="model"
              label="型号"
              :width="modelColumnWidth"
              align="center"
            >
              <template #default="{ row }">
                {{ row.model || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
              prop="color"
              label="颜色"
              width="78"
              align="center"
            >
              <template #default="{ row }">
                {{ row.color || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'sales_count')"
              label="IMEI"
              :width="imeiColumnWidth"
              align="center"
              class-name="identifier-column"
            >
              <template #default="{ row }">
                <span class="imei-text">{{ row.imei || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'employee_name')"
              prop="customer_name"
              label="客户"
              :width="customerColumnWidth"
              align="center"
            >
              <template #default="{ row }">
                {{ row.customer_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
              label="销售价"
              width="96"
              align="center"
            >
              <template #default="{ row }">
                <span class="price">¥{{ formatAmount(row.sale_price) }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'commission_amount')"
              label="利润"
              width="92"
              align="center"
            >
              <template #default="{ row }">
                <span :class="row.profit >= 0 ? 'profit-positive' : 'profit-negative'">
                  ¥{{ formatAmount(row.profit) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              v-if="canViewField('salary_salaryrecordsview', 'paid_at')"
              label="销售时间"
              width="132"
              align="center"
            >
              <template #default="{ row }">
                <span class="time-cell">{{ formatSaleTime(row.sale_time) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <DataEmptyState
          v-else
          size="compact"
          description="暂无销售明细数据"
        />
      </div>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import MobileDialog from '@/components/MobileDialog.vue'
import SectionLoading from '@/components/SectionLoading.vue'

interface EmployeeSalesRecord {
  name?: string | null
  [key: string]: unknown
}

interface EmployeeSalesDetail {
  color?: string | null
  customer_name?: string | null
  imei?: string | null
  is_new?: boolean
  model?: string | null
  profit: number
  sale_price?: number | string | null
  sale_time?: string | null
  [key: string]: unknown
}

interface EmployeeSalesSummary {
  total_count: number
  total_profit: number | string
  total_sales: number | string
}

defineProps<{
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  customerColumnWidth: number
  details: EmployeeSalesDetail[]
  dialogWidth: string
  employee: EmployeeSalesRecord | null
  formatAmount: (_amount: unknown) => string
  formatSaleTime: (_time: string) => string
  imeiColumnWidth: number
  loading: boolean
  modelColumnWidth: number
  modelValue: boolean
  salaryMonth: string
  summary: EmployeeSalesSummary
  tableWidth: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

</script>

<style lang="scss" scoped src="../styles/salary-sales-details.scss"></style>
