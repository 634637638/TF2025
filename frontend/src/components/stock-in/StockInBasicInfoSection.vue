<template>
  <section class="info-card stock-in-basic-info">
    <div class="card-header">
      <div class="card-icon">
        <i class="fas fa-info-circle"></i>
      </div>
      <h3 class="card-title">入库信息</h3>
    </div>
    <div class="card-content">
      <div v-if="!isMobile" class="form-row-group four-columns">
        <el-form-item label="供应商" prop="supplier_id">
          <el-select
            v-model="formData.supplier_id"
            placeholder="请选择供应商"
            filterable
            :filter-method="handleSupplierFilter"
            clearable
            teleported
            popper-class="stock-in-mobile-popper"
          >
            <el-option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :label="supplier.name"
              :value="supplier.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="入库店铺" prop="store_id">
          <el-select
            v-model="formData.store_id"
            placeholder="请选择店铺"
            filterable
            :filter-method="handleStoreFilter"
            clearable
            teleported
            popper-class="stock-in-mobile-popper"
          >
            <el-option
              v-for="store in stores"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="入库日期" prop="stock_in_date">
          <el-date-picker
            v-model="formData.stock_in_date"
            type="date"
            placeholder="请选择入库日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            teleported
            popper-class="stock-in-mobile-popper"
          />
        </el-form-item>

        <el-form-item label="商品状态" prop="product_status">
          <el-select
            v-model="formData.product_status"
            placeholder="请选择商品状态"
            teleported
            popper-class="stock-in-mobile-popper"
          >
            <el-option label="全新" value="全新" />
            <el-option label="二手" value="二手" />
          </el-select>
        </el-form-item>
      </div>

      <template v-else>
        <div class="form-row-group">
          <el-form-item label="供应商" prop="supplier_id">
            <el-select
              v-model="formData.supplier_id"
              placeholder="请选择供应商"
              filterable
              :filter-method="handleSupplierFilter"
              clearable
              teleported
              popper-class="stock-in-mobile-popper"
            >
              <el-option
                v-for="supplier in suppliers"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="入库店铺" prop="store_id">
            <el-select
              v-model="formData.store_id"
              placeholder="请选择店铺"
              filterable
              :filter-method="handleStoreFilter"
              clearable
              teleported
              popper-class="stock-in-mobile-popper"
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
          </el-form-item>
        </div>

        <div class="form-row-group">
          <el-form-item label="入库日期" prop="stock_in_date">
            <el-date-picker
              v-model="formData.stock_in_date"
              type="date"
              placeholder="请选择入库日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              teleported
              popper-class="stock-in-mobile-popper"
            />
          </el-form-item>

          <el-form-item label="商品状态" prop="product_status">
            <el-select
              v-model="formData.product_status"
              placeholder="请选择商品状态"
              teleported
              popper-class="stock-in-mobile-popper"
            >
              <el-option label="全新" value="全新" />
              <el-option label="二手" value="二手" />
            </el-select>
          </el-form-item>
        </div>
      </template>
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
  handleSupplierFilter: (query: string) => boolean
  handleStoreFilter: (query: string) => boolean
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
.info-card {
  background: #f8fafc;
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 24px;
  border: none;
  box-shadow: inset 0 0 0 1px rgba(203, 213, 225, 0.72);
  transition: all 0.24s ease;
}

.info-card:hover {
  box-shadow:
    inset 0 0 0 1px rgba(191, 219, 254, 0.9),
    0 10px 24px rgba(99, 102, 241, 0.08);
}

.card-header {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.96) 0%, rgba(241, 245, 249, 0.96) 100%);
  padding: 18px 22px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(203, 213, 225, 0.72);
}

.card-icon {
  width: 46px;
  height: 46px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex: 0 0 auto;
}

.card-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #334155;
}

.card-content {
  padding: 22px;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

.form-row-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-row-group.four-columns {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 767px) {
  .info-card {
    margin-bottom: 12px;
    border-radius: 14px;
  }

  .card-header {
    padding: 14px 14px 12px;
    gap: 10px;
    align-items: flex-start;
  }

  .card-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    font-size: 15px;
  }

  .card-title {
    font-size: 15px;
  }

  .card-content {
    padding: 12px 10px 10px;
  }

  .form-row-group {
    gap: 10px;
  }

  :deep(.el-form-item__label) {
    font-size: 13px;
    line-height: 1.4;
    padding-bottom: 4px;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-date-editor .el-input__wrapper) {
    min-height: 40px;
    border-radius: 12px;
  }
}
</style>
