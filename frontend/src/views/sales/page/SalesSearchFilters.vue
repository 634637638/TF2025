<template>
  <UnifiedSearchPanel
    v-model:expanded="expanded"
    :loading="loading"
    @search="emit('search')"
    @reset="emit('reset')"
  >
    <template #primary>
      <el-input
        v-if="showKeyword"
        v-model="filters.search"
        placeholder="搜索关键词"
        clearable
        @input="emit('debounced-search')"
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
        @change="emit('search')"
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
        @change="emit('search')"
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
        :disabled="!filters.brand && brandModels.length === 0"
        @change="emit('search')"
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
        @change="emit('search')"
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
        allow-create
        @change="emit('search')"
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
      v-if="canViewField('condition')"
      class="form-group filter-item"
      data-field="condition"
    >
      <el-select
        v-model="filters.is_new"
        placeholder="机况"
        clearable
        :teleported="true"
        popper-class="tf2025-form-popper"
        @change="emit('search')"
      >
        <el-option
          label="全新"
          value="1"
        />
        <el-option
          label="二手"
          value="0"
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
        @change="emit('search')"
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
      class="form-group filter-item"
    >
      <el-date-picker
        v-model="filters.start_date"
        type="date"
        placeholder="开始日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        :clearable="true"
        style="width: 140px"
        @change="emit('search')"
      />
    </div>

    <div
      v-if="canViewField('inventory_time')"
      class="form-group filter-item"
    >
      <el-date-picker
        v-model="filters.end_date"
        type="date"
        placeholder="结束日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        :clearable="true"
        @change="emit('search')"
      />
    </div>
  </UnifiedSearchPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import type { PhoneBrand, PhoneModel } from '@/types'
import type {
  SalesFilters,
  SalesOperatorOption,
  SalesStoreOption,
  SalesSupplierOption
} from '../types'

const props = defineProps<{
  filters: SalesFilters
  expanded: boolean
  loading: boolean
  showKeyword: boolean
  stores: SalesStoreOption[]
  suppliers: SalesSupplierOption[]
  operators: SalesOperatorOption[]
  brands: Array<Pick<PhoneBrand, 'id' | 'name'> & { sort_order?: number }>
  brandModels: PhoneModel[]
  colors: string[]
  memories: string[]
  canViewField: (_fieldName: string) => boolean
}>()

const emit = defineEmits<{
  'update:expanded': [value: boolean]
  search: []
  reset: []
  'debounced-search': []
  'brand-change': []
}>()

const filters = props.filters
const expanded = computed({
  get: () => props.expanded,
  set: value => emit('update:expanded', value)
})
const loading = computed(() => props.loading)
const showKeyword = computed(() => props.showKeyword)
const stores = computed(() => props.stores)
const suppliers = computed(() => props.suppliers)
const operators = computed(() => props.operators)
const brands = computed(() => props.brands)
const brandModels = computed(() => props.brandModels)
const colors = computed(() => props.colors)
const memories = computed(() => props.memories)
const canViewField = (fieldName: string) => props.canViewField(fieldName)
</script>

<style scoped lang="scss">
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
