<template>
  <MobileDialog
    :model-value="modelValue"
    title="销售明细"
    :width="dialogWidth"
    dialog-class="salary-dialog salary-dialog-large"
    :show-default-footer="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div
      v-if="record"
      class="sales-details admin-page"
    >
      <SectionLoading
        v-if="loading"
        text="正在读取销售提成明细..."
      />

      <template v-else>
        <div class="details-info">
          <div
            v-if="canViewField('salary_mysalaryview', 'paid_at')"
            class="info-row"
          >
            <label>发放时间:</label>
            <span>{{ formatPayoutTime(record.paid_at || '') }}</span>
          </div>
          <div
            v-if="canViewField('salary_mysalaryview', 'sales_count')"
            class="info-row"
          >
            <label>销售数量:</label>
            <span class="highlight">{{ getSalesCount(record) }} 台</span>
          </div>
          <div
            v-if="canViewField('salary_mysalaryview', 'commission_amount')"
            class="info-row"
          >
            <label>提成金额:</label>
            <span class="amount">¥{{ formatAmount(record.commission_amount) }}</span>
          </div>
          <div
            v-if="canViewField('salary_mysalaryview', 'commission_amount')"
            class="info-row"
          >
            <label>销售额:</label>
            <span class="amount">¥{{ formatAmount(summaryTotalPrice) }}</span>
          </div>
        </div>

        <div class="sales-details-table">
          <h4 class="section-title">
            销售明细列表
          </h4>
          <div
            v-if="details.length > 0"
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
                v-if="canViewField('salary_mysalaryview', 'sales_count')"
                prop="model_name"
                label="型号"
                :width="modelColumnWidth"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.model_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('salary_mysalaryview', 'sales_count')"
                prop="color_name"
                label="颜色"
                width="78"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.color_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('salary_mysalaryview', 'sales_count')"
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
                v-if="canViewField('salary_mysalaryview', 'employee_name')"
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
                v-if="canViewField('salary_mysalaryview', 'commission_amount')"
                label="销售价格"
                width="96"
                align="center"
              >
                <template #default="{ row }">
                  <span class="price">¥{{ formatAmount(row.sale_price) }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-if="canViewField('salary_mysalaryview', 'paid_at')"
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
      </template>
    </div>
  </MobileDialog>
</template>

<script setup lang="ts">
import MobileDialog from '@/components/MobileDialog.vue'
import SectionLoading from '@/components/SectionLoading.vue'

interface SalesRecord {
  commission_amount?: number | string | null
  commission_detail?: string | null
  employee_id?: number
  paid_at?: string | null
  sales_count?: number | null
  [key: string]: unknown
}

interface SalesDetail {
  color_name?: string | null
  customer_name?: string | null
  imei?: string | null
  model_name?: string | null
  sale_price?: number | string | null
  sale_time?: string | null
  [key: string]: unknown
}

defineProps<{
  canViewField: (_moduleKey: string, _fieldName: string) => boolean
  customerColumnWidth: number
  details: SalesDetail[]
  dialogWidth: string
  formatAmount: (_amount: unknown) => string
  formatPayoutTime: (_time: string) => string
  formatSaleTime: (_time: string) => string
  getSalesCount: (_record: SalesRecord) => number
  imeiColumnWidth: number
  loading: boolean
  modelColumnWidth: number
  modelValue: boolean
  record: SalesRecord | null
  summaryTotalPrice: number | string
  tableWidth: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

</script>

<style lang="scss" scoped src="../styles/salary-sales-details.scss"></style>
