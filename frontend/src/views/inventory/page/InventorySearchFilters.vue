<template>
  <UnifiedSearchPanel
    :expanded="expanded"
    :loading="loading"
    @update:expanded="emit('update:expanded', $event)"
    @search="emit('search')"
    @reset="emit('reset')"
  >
    <template #primary>
      <el-input
        v-model="filters.search"
        placeholder="搜索关键词"
        clearable
        @input="emit('search-input')"
        @keyup.enter="emit('search')"
        @click.stop
      >
        <template #prefix>
          <i class="fas fa-search" />
        </template>
      </el-input>
    </template>

    <div
      v-if="canViewField('supplier_name')"
      class="form-group filter-item"
      data-field="supplier"
    >
      <el-select
        v-model="filters.supplier_id"
        placeholder="供应商"
        filterable
        clearable
        @change="emit('filter-change')"
      >
        <el-option
          v-for="supplier in suppliers"
          :key="supplier.id"
          :label="supplier.name"
          :value="supplier.id"
        />
      </el-select>
    </div>

    <div
      v-if="canViewField('store_name')"
      class="form-group filter-item"
      data-field="store"
    >
      <el-select
        v-model="filters.store_id"
        placeholder="店铺"
        filterable
        clearable
        @change="emit('filter-change')"
      >
        <el-option
          v-for="store in stores"
          :key="store.id"
          :label="store.name"
          :value="store.id"
        />
      </el-select>
    </div>

    <div
      v-if="canViewField('brand')"
      class="form-group filter-item"
      data-field="brand"
    >
      <el-select
        v-model="filters.brand"
        placeholder="品牌"
        filterable
        clearable
        @change="emit('brand-change')"
      >
        <el-option
          v-for="brand in brands"
          :key="brand.id"
          :label="brand.name"
          :value="brand.name"
        />
      </el-select>
    </div>

    <div
      v-if="canViewField('model')"
      class="form-group filter-item"
      data-field="model"
    >
      <el-select
        v-model="filters.model"
        placeholder="型号"
        filterable
        clearable
        :disabled="!filters.brand && brandModels.length === modelCount"
        @change="emit('filter-change')"
      >
        <el-option
          v-for="model in brandModels"
          :key="model.id"
          :label="model.name"
          :value="model.name"
        />
      </el-select>
    </div>

    <div
      v-if="canViewField('color')"
      class="form-group filter-item"
      data-field="color"
    >
      <el-select
        v-model="filters.color"
        placeholder="颜色"
        filterable
        clearable
        allow-create
        @change="emit('filter-change')"
      >
        <el-option
          v-for="color in colors"
          :key="color"
          :label="color"
          :value="color"
        />
      </el-select>
    </div>

    <div
      v-if="canViewField('memory')"
      class="form-group filter-item"
      data-field="memory"
    >
      <el-select
        v-model="filters.memory"
        placeholder="内存"
        filterable
        clearable
        @change="emit('filter-change')"
      >
        <el-option
          v-for="memory in memories"
          :key="memory"
          :label="memory"
          :value="memory"
        />
      </el-select>
    </div>

    <div
      v-if="canViewField('is_new')"
      class="form-group filter-item"
      data-field="condition"
    >
      <el-select
        v-model="filters.is_new"
        placeholder="机况"
        clearable
        @change="emit('filter-change')"
      >
        <el-option
          label="全新"
          :value="true"
        />
        <el-option
          label="二手"
          :value="false"
        />
      </el-select>
    </div>

    <div
      v-if="canViewField('inventory_operator_name')"
      class="form-group filter-item"
      data-field="operator"
    >
      <el-select
        v-model="filters.operator_id"
        placeholder="入库员"
        filterable
        clearable
        @change="emit('filter-change')"
      >
        <el-option
          v-for="operator in operators"
          :key="operator.id"
          :label="operator.name || operator.username"
          :value="operator.id"
        />
      </el-select>
    </div>

    <div
      v-if="canViewField('inventory_time')"
      class="form-group filter-item filter-item--date-range"
      data-field="date_range"
    >
      <DateRangePicker
        v-model="dateRange"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        clearable
        @change="emit('filter-change')"
      />
    </div>
  </UnifiedSearchPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'

export interface InventoryFilters {
  brand: string
  color: string
  date_end: string
  date_start: string
  is_new: boolean | string
  memory: string
  model: string
  operator_id: number | string
  search: string
  supplier_id: number | string
  store_id: number | string
}

interface NamedOption {
  id: number
  name?: string
  username?: string
}

const props = defineProps<{
  brandModels: Array<{ id: number; name: string }>
  brands: Array<{ id: number; name: string }>
  canViewField: (_field: string) => boolean
  colors: string[]
  expanded: boolean
  filters: InventoryFilters
  loading: boolean
  memories: string[]
  modelCount: number
  operators: NamedOption[]
  stores: NamedOption[]
  suppliers: NamedOption[]
}>()

type SearchDateRange = [string, string] | [] | null

const dateRange = computed<SearchDateRange>({
  get: () => {
    if (!props.filters.date_start && !props.filters.date_end) return null
    return [props.filters.date_start, props.filters.date_end] as [string, string]
  },
  set: value => {
    props.filters.date_start = value?.[0] || ''
    props.filters.date_end = value?.[1] || ''
  }
})

const emit = defineEmits<{
  'brand-change': []
  'filter-change': []
  reset: []
  search: []
  'search-input': []
  'update:expanded': [value: boolean]
}>()
</script>
