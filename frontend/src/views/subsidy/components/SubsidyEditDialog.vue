<template>
  <MobileDialog
    :model-value="modelValue"
    title="编辑国补信息"
    width="760px"
    dialog-class="subsidy-dialog"
    :show-default-footer="false"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="modelValue" class="modal-body">
      <el-form v-if="editForm" label-width="100px" class="edit-form">
        <section class="edit-section">
          <div class="edit-section-title"><i class="fas fa-user"></i><span>客户信息</span></div>
          <div class="form-row">
            <el-form-item label="客户姓名">
              <el-input
                v-model="editForm.customer_name"
                placeholder="请输入客户姓名"
                clearable
                @input="editForm.customer_name = normalizePersonName(editForm.customer_name, 20)"
              />
            </el-form-item>

            <el-form-item label="客户手机">
              <el-input
                v-model="editForm.customer_phone"
                placeholder="请输入客户手机号"
                clearable
                maxlength="11"
                @input="editForm.customer_phone = normalizePhoneDigits(editForm.customer_phone)"
              />
            </el-form-item>
          </div>
          <el-form-item
            v-if="canViewField('customer_idcard') && canEditField('customer_idcard')"
            label="身份证号"
          >
            <el-input
              v-model="editForm.customer_idcard"
              placeholder="请输入身份证号"
              @input="editForm.customer_idcard = normalizeIdCard(editForm.customer_idcard)"
            />
          </el-form-item>
        </section>

        <section class="edit-section">
          <div class="edit-section-title"><i class="fas fa-mobile-screen-button"></i><span>设备信息</span></div>
          <div class="form-row" v-if="canViewField('brand') || canViewField('model')">
            <el-form-item v-if="canViewField('brand')" label="品牌">
              <el-select
                v-model="editForm.phone_brand"
                placeholder="请选择品牌"
                filterable
                clearable
                :disabled="!canEditField('brand')"
                @change="handleBrandChange"
              >
                <el-option
                  v-for="brand in brands"
                  :key="brand.id"
                  :label="brand.name"
                  :value="brand.name"
                />
              </el-select>
            </el-form-item>

            <el-form-item v-if="canViewField('model')" label="型号">
              <el-select
                v-model="editForm.phone_model"
                placeholder="请选择型号"
                filterable
                clearable
                :disabled="!canEditField('model') || !editForm.phone_brand"
              >
                <el-option
                  v-for="model in modelOptions"
                  :key="model.id"
                  :label="model.name"
                  :value="model.name"
                />
              </el-select>
            </el-form-item>
          </div>

          <div class="form-row" v-if="canViewField('color') || canViewField('memory')">
            <el-form-item v-if="canViewField('color')" label="颜色">
              <el-select
                v-model="editForm.phone_color"
                placeholder="请选择颜色"
                filterable
                clearable
                :disabled="!canEditField('color')"
              >
                <el-option
                  v-for="color in colors"
                  :key="color.id"
                  :label="color.name"
                  :value="color.name"
                />
              </el-select>
            </el-form-item>

            <el-form-item v-if="canViewField('memory')" label="内存">
              <el-select
                v-model="editForm.phone_memory"
                placeholder="请选择内存"
                filterable
                clearable
                :disabled="!canEditField('memory')"
              >
                <el-option
                  v-for="memory in memories"
                  :key="memory.id"
                  :label="memoryLabel(memory)"
                  :value="memoryLabel(memory)"
                />
              </el-select>
            </el-form-item>
          </div>

          <el-form-item label="序列号">
            <el-input
              v-model="editForm.serial_number"
              placeholder="请输入序列号"
              clearable
              @input="formatSerialNumber"
            />
          </el-form-item>

          <div class="form-row">
            <el-form-item label="IMEI1">
              <el-input
                v-model="editForm.imei1"
                placeholder="请输入IMEI1"
                clearable
                maxlength="15"
                @input="formatIMEI1"
              />
            </el-form-item>

            <el-form-item
              v-if="canViewField('imei2') && canEditField('imei2')"
              label="IMEI2"
            >
              <el-input
                v-model="editForm.imei2"
                placeholder="请输入IMEI2"
                clearable
                maxlength="15"
                @input="formatIMEI2"
              />
            </el-form-item>
          </div>
        </section>

        <section class="edit-section">
          <div class="edit-section-title"><i class="fas fa-receipt"></i><span>销售信息</span></div>
          <div class="form-row">
            <el-form-item v-if="canViewField('sale_price')" label="销售价格">
              <el-input
                v-model="editForm.sale_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="请输入销售价格"
                :disabled="!canEditField('sale_price')"
                @blur="normalizeSalePrice"
              >
                <template #prepend>¥</template>
              </el-input>
            </el-form-item>

            <el-form-item label="销售时间">
              <el-date-picker
                v-model="editForm.sale_time"
                type="date"
                placeholder="选择销售日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                class="form-input"
                clearable
              />
            </el-form-item>
          </div>

          <el-form-item label="销售店铺">
            <el-select
              v-model="editForm.store_id"
              placeholder="请选择销售店铺"
              filterable
              clearable
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
            <div class="form-tip">
              <i class="fas fa-info-circle"></i>
              修改销售店铺
            </div>
          </el-form-item>
        </section>

        <section class="edit-section">
          <div class="edit-section-title"><i class="fas fa-clipboard-check"></i><span>国补处理</span></div>
          <div class="form-row" v-if="canViewField('apply_time') || canViewField('arrival_time')">
            <el-form-item
              v-if="canViewField('apply_time') && canEditField('apply_time')"
              label="提交时间"
            >
              <el-date-picker
                v-model="editForm.apply_time"
                type="date"
                placeholder="选择提交日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                class="form-input"
                clearable
              />
            </el-form-item>

            <el-form-item
              v-if="canViewField('arrival_time') && canEditField('arrival_time')"
              label="到账时间"
            >
              <el-date-picker
                v-model="editForm.arrival_time"
                type="date"
                placeholder="选择到账日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                class="form-input"
                clearable
              />
            </el-form-item>
          </div>

          <el-form-item
            v-if="canViewField('remarks') && canEditField('remarks')"
            label="备注"
          >
            <el-input
              v-model="editForm.remarks"
              type="textarea"
              :rows="3"
              placeholder="请输入备注信息（可选）"
            />
          </el-form-item>
        </section>

        <section class="edit-section">
          <div class="edit-section-title"><i class="fas fa-user-pen"></i><span>代办人信息</span></div>

          <el-form-item label="他人代办">
            <el-switch
              v-model="editForm.hasDifferentHandler"
              active-text="是"
              inactive-text="否"
            />
            <span class="form-item-tip">
              {{ editForm.hasDifferentHandler ? '办理者信息' : '' }}
            </span>
          </el-form-item>

          <template v-if="editForm.hasDifferentHandler">
            <div class="form-row">
              <el-form-item label="代办人姓名">
                <el-input
                  v-model="editForm.handlerName"
                  placeholder="请输入实际代办人姓名"
                  clearable
                  @input="editForm.handlerName = normalizePersonName(editForm.handlerName, 20)"
                />
              </el-form-item>

              <el-form-item label="代办人手机">
                <el-input
                  v-model="editForm.handlerPhone"
                  placeholder="请输入实际代办人手机号"
                  clearable
                  maxlength="11"
                  @input="editForm.handlerPhone = normalizePhoneDigits(editForm.handlerPhone)"
                />
              </el-form-item>
            </div>

            <el-form-item label="代办人身份证">
              <el-input
                v-model="editForm.handlerIdcard"
                placeholder="请输入实际代办人身份证号"
                clearable
                maxlength="18"
                @input="editForm.handlerIdcard = normalizeIdCard(editForm.handlerIdcard)"
              />
            </el-form-item>
          </template>
        </section>

        <el-divider v-if="hasReadOnlyFields"></el-divider>
        <div v-if="hasReadOnlyFields" class="readonly-fields">
          <div class="readonly-title">以下信息为只读：</div>
          <el-descriptions :column="1" border>
            <el-descriptions-item
              v-if="canViewField('customer_idcard') && !canEditField('customer_idcard') && editForm.customer_idcard"
              label="客户身份证号"
            >
              {{ editForm.customer_idcard || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('imei2') && !canEditField('imei2') && editForm.imei2"
              label="IMEI2"
            >
              {{ editForm.imei2 || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('apply_time') && !canEditField('apply_time') && editForm.apply_time"
              label="提交时间"
            >
              {{ formatDateTime(editForm.apply_time) }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('arrival_time') && !canEditField('arrival_time') && editForm.arrival_time"
              label="到账时间"
            >
              {{ formatDateTime(editForm.arrival_time) }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('remarks') && !canEditField('remarks') && editForm.remarks"
              label="备注"
            >
              {{ editForm.remarks || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('brand') && !canEditField('brand')"
              label="品牌"
            >
              {{ editForm.phone_brand || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('model') && !canEditField('model')"
              label="型号"
            >
              {{ editForm.phone_model || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('color') && !canEditField('color')"
              label="颜色"
            >
              {{ editForm.phone_color || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('memory') && !canEditField('memory')"
              label="内存"
            >
              {{ editForm.phone_memory || '-' }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="canViewField('sale_price') && !canEditField('sale_price')"
              label="销售价格"
            >
              ¥{{ Number(editForm.sale_price || 0).toFixed(2) }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div v-if="modelValue" class="apply-dialog-footer">
        <el-button type="default" :disabled="editing" @click="emit('update:modelValue', false)">
          <i class="fas fa-times"></i>
          <span>取消</span>
        </el-button>
        <el-button
          type="primary"
          :disabled="editing"
          @click="submitEdit"
        >
          <InlineLoading v-if="editing" text="保存中..." size="small" variant="inherit" />
          <template v-else>
            <i class="fas fa-save"></i>
            <span>保存</span>
          </template>
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MobileDialog from '@/components/MobileDialog.vue'
import InlineLoading from '@/components/InlineLoading.vue'
import { unifiedApi } from '@/utils/unified-api'
import { normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import { useBrandModels } from '@/composables/useBrandModels'

const props = defineProps<{
  modelValue: boolean
  item: any | null
  stores: any[]
  canViewField: (field: string) => boolean
  canEditField: (field: string) => boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  updated: []
}>()

const editing = ref(false)
const editForm = ref<any>(null)
const {
  brands,
  brandModels,
  colors,
  memories,
  loadBrands,
  loadModelsForBrand,
  loadColors,
  loadMemories
} = useBrandModels()

const modelOptions = computed(() => {
  const brandName = editForm.value?.phone_brand || ''
  const brand = brands.value.find(item => item.name === brandName)
  const options = brand ? [...(brandModels[brand.id] || [])] : []
  const currentModel = editForm.value?.phone_model
  if (currentModel && !options.some(item => item.name === currentModel)) {
    options.unshift({ id: 0, name: currentModel, brand_id: brand?.id || 0 })
  }
  return options
})

const canViewField = (field: string) => props.canViewField(field)
const canEditField = (field: string) => props.canEditField(field)

const hasReadOnlyFields = computed(() => {
  const allFields = [
    'customer_idcard', 'imei2', 'apply_time', 'arrival_time', 'remarks',
    'brand', 'model', 'color', 'memory', 'sale_price'
  ]
  return allFields.some(field => canViewField(field) && !canEditField(field))
})

const formatDateTime = (date: string) => date ? TimeUtil.format(date, TIME_FORMATS.DATETIME_SHORT) : '-'

const calculateRemarks = (item: any) => {
  if (item.remarks && item.remarks.trim() !== '') return item.remarks

  const salePrice = item.sale_price || 0
  if (!salePrice) return ''

  if (salePrice > 6000) {
    return `商品售价${salePrice}元（超过6000元，无法享受国补优惠）`
  }

  const subsidyAmount = item.subsidy_amount || Math.min(salePrice * 0.15, 500)
  const cardPayment = (salePrice - subsidyAmount).toFixed(2)
  const sn = item.serial_number || ''
  const st = item.sale_time ? TimeUtil.format(item.sale_time, TIME_FORMATS.DATE) : ''

  return `序列号：${sn}\n购买时间：${st}\n商品售价：${salePrice}元 国补优惠${subsidyAmount}元 实际刷卡支付${cardPayment}元`
}

const memoryLabel = (memory: any) => String(memory?.size || memory?.capacity || memory?.name || '')

const loadBaseData = async (item: any = null) => {
  await Promise.all([loadBrands(), loadColors(), loadMemories()])
  const brandName = item?.phone_brand || editForm.value?.phone_brand
  const brand = brands.value.find(value => value.name === brandName)
  if (brand) await loadModelsForBrand(brand.id)
}

const handleBrandChange = async () => {
  if (!editForm.value) return
  editForm.value.phone_model = ''
  const brand = brands.value.find(value => value.name === editForm.value.phone_brand)
  if (brand) await loadModelsForBrand(brand.id)
}

const normalizeSalePrice = () => {
  if (!editForm.value) return
  const value = Number(editForm.value.sale_price)
  editForm.value.sale_price = Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : null
}

const fillEditForm = (item: any) => {
  if (!item) {
    editForm.value = null
    return
  }

  editForm.value = {
    customer_name: normalizePersonName(item.customer_name || '', 20),
    customer_phone: normalizePhoneDigits(item.customer_phone || ''),
    sale_time: item.sale_time || '',
    customer_idcard: normalizeIdCard(item.customer_idcard || ''),
    serial_number: item.serial_number || '',
    phone_brand: item.phone_brand || '',
    phone_model: item.phone_model || '',
    phone_color: item.phone_color || '',
    phone_memory: item.phone_memory || '',
    sale_price: item.sale_price ?? null,
    store_id: item.store_id || null,
    imei1: item.imei1 || '',
    imei2: item.imei2 || '',
    apply_time: item.apply_time || '',
    arrival_time: item.arrival_time || '',
    remarks: calculateRemarks(item),
    hasDifferentHandler: item.hasDifferentHandler || false,
    handlerName: normalizePersonName(item.handlerInfo?.handlerName || '', 20),
    handlerPhone: normalizePhoneDigits(item.handlerInfo?.handlerPhone || ''),
    handlerIdcard: normalizeIdCard(item.handlerInfo?.handlerIdcard || '')
  }
}

watch(
  () => [props.modelValue, props.item],
  ([visible, item]) => {
    if (visible && item) {
      fillEditForm(item)
      void loadBaseData(item)
    } else if (!visible) {
      editForm.value = null
    }
  },
  { immediate: true }
)

const formatSerialNumber = () => {
  if (editForm.value?.serial_number) {
    editForm.value.serial_number = editForm.value.serial_number
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 30)
  }
}

const formatIMEI1 = () => {
  if (editForm.value?.imei1) {
    editForm.value.imei1 = editForm.value.imei1.replace(/\D/g, '').slice(0, 15)
  }
}

const formatIMEI2 = () => {
  if (editForm.value?.imei2) {
    editForm.value.imei2 = editForm.value.imei2.replace(/\D/g, '').slice(0, 15)
  }
}

const submitEdit = async () => {
  if (editing.value) return
  if (!props.item?.id || !editForm.value) return

  try {
    editing.value = true
    editForm.value.customer_name = normalizePersonName(editForm.value.customer_name || '', 20)
    editForm.value.customer_phone = normalizePhoneDigits(editForm.value.customer_phone || '')
    editForm.value.customer_idcard = normalizeIdCard(editForm.value.customer_idcard || '')
    editForm.value.handlerName = normalizePersonName(editForm.value.handlerName || '', 20)
    editForm.value.handlerPhone = normalizePhoneDigits(editForm.value.handlerPhone || '')
    editForm.value.handlerIdcard = normalizeIdCard(editForm.value.handlerIdcard || '')
    normalizeSalePrice()

    const response = await unifiedApi.put(`/subsidy/${props.item.id}`, editForm.value)

    if (response.success) {
      ElMessage.success('更新成功')
      emit('update:modelValue', false)
      emit('updated')
    } else {
      ElMessage.error(response.message || '更新失败')
    }
  } catch (error: any) {
    logger.error('更新失败:', error)
    ElMessage.error(error.response?.data?.message || '更新失败')
  } finally {
    editing.value = false
  }
}
</script>

<style scoped lang="scss">
.modal-body {
  padding: 0;
}

.edit-section {
  padding: 0 0 4px;
}

.edit-section + .edit-section {
  margin-top: 16px;
}

.edit-section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--tf-border-color, #e5e7eb);
  color: var(--tf-text-primary, #1f2937);
  font-size: 14px;
  font-weight: 600;
}

.edit-section-title i {
  color: var(--tf-color-primary, #2563eb);
  font-size: 13px;
}

.edit-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.edit-form :deep(.el-input),
.edit-form :deep(.el-select),
.edit-form :deep(.el-date-editor) {
  width: 100%;
}

.apply-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form-tip,
.form-item-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6c757d;
}

.readonly-fields {
  margin-top: 16px;
}

.readonly-title {
  margin-bottom: 12px;
  font-size: 13px;
  color: #6c757d;
}

@media (max-width: 768px) {
  .edit-section + .edit-section {
    margin-top: 12px;
  }

  .edit-section-title {
    margin-bottom: 10px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .apply-dialog-footer {
    justify-content: flex-end;
  }
}
</style>
