<template>
  <section class="stock-in-section stock-in-basic-info">
    <header class="stock-in-section__header">
      <h3 class="stock-in-section__title">
        入库信息
      </h3>
    </header>

    <div class="stock-in-section__body basic-info-grid">
      <el-form-item
        label="供应商"
        prop="supplier_id"
      >
        <el-select
          v-model="formData.supplier_id"
          placeholder="请选择供应商"
          filterable
          :filter-method="handleSupplierFilter"
          clearable
          teleported
          popper-class="tf2025-form-popper"
        >
          <el-option
            v-for="supplier in suppliers"
            :key="supplier.id"
            :label="supplier.name"
            :value="supplier.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        label="入库店铺"
        prop="store_id"
      >
        <el-select
          v-model="formData.store_id"
          placeholder="请选择店铺"
          filterable
          :filter-method="handleStoreFilter"
          clearable
          teleported
          popper-class="tf2025-form-popper"
        >
          <el-option
            v-for="store in stores"
            :key="store.id"
            :label="store.name"
            :value="store.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        label="入库日期"
        prop="inventory_time"
      >
        <el-date-picker
          v-model="formData.inventory_time"
          type="date"
          placeholder="请选择入库日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          teleported
          popper-class="tf2025-form-popper"
        />
      </el-form-item>

      <el-form-item
        label="商品状态"
        prop="product_status"
      >
        <el-select
          v-model="formData.product_status"
          placeholder="请选择商品状态"
          teleported
          popper-class="tf2025-form-popper"
        >
          <el-option
            label="全新"
            value="全新"
          />
          <el-option
            label="二手"
            value="二手"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        label="入库员"
        class="operator-field"
      >
        <el-input
          :model-value="formData.operator_name"
          readonly
        />
      </el-form-item>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Supplier, Store } from '@/types/system'
import type { StockInFormModel } from './types'

interface Props {
  isMobile: boolean
  formData: StockInFormModel
  suppliers: Supplier[]
  stores: Store[]
  handleSupplierFilter: (_query: string) => boolean
  handleStoreFilter: (_query: string) => boolean
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.basic-info-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
}

.basic-info-grid :deep(.el-select),
.basic-info-grid :deep(.el-date-editor) {
  width: 100%;
}

.operator-field :deep(.el-input__wrapper) {
  background: var(--el-fill-color-light);
}

@media (max-width: 1100px) {
  .basic-info-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .basic-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}
</style>
