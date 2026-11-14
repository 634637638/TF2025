<template>
  <section v-if="summary">
    <RecordDescriptions
      :column="3"
      border
    >
      <el-descriptions-item label="商品提成">
        ¥{{ formatAmount(summary.earned_amount) }}
      </el-descriptions-item>
      <el-descriptions-item label="商品退货扣回">
        ¥{{ formatAmount(summary.reversal_amount) }}
      </el-descriptions-item>
      <el-descriptions-item label="商品提成净额">
        ¥{{ formatAmount(summary.net_amount) }}
      </el-descriptions-item>
    </RecordDescriptions>
    <el-collapse
      v-if="summary.entries.length"
      v-model="expanded"
    >
      <el-collapse-item
        name="sources"
        title="商品提成来源及原单关联"
      >
        <template v-if="expanded.length">
          <RecordDescriptions
            v-for="entry in summary.entries"
            :key="`${entry.kind}:${entry.order_item_id}:${entry.aftersale_item_id}`"
            :column="2"
            border
          >
            <el-descriptions-item label="业务">
              {{ entry.kind === 'return' ? '退货扣回' : '商品成交' }}
            </el-descriptions-item>
            <el-descriptions-item label="提成金额">
              ¥{{ formatAmount(entry.amount) }}
            </el-descriptions-item>
            <el-descriptions-item label="原订单">
              {{ entry.order_id }} / 明细 {{ entry.order_item_id }}
            </el-descriptions-item>
            <el-descriptions-item label="售后单">
              {{ entry.aftersale_id ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="原工资">
              {{ entry.original_salary_record_id ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="数量">
              {{ entry.quantity }}
            </el-descriptions-item>
            <el-descriptions-item
              label="业务时间"
              :span="2"
            >
              {{ TimeUtil.format(entry.business_time, TIME_FORMATS.DATETIME) }}
            </el-descriptions-item>
          </RecordDescriptions>
        </template>
      </el-collapse-item>
    </el-collapse>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatAmount } from '@/utils/format'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import type { SalaryGoodsCommission } from '@/types/salary'

defineProps<{ summary: SalaryGoodsCommission | null | undefined }>()
const expanded = ref<string[]>([])
</script>
