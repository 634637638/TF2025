<template>
  <div class="accessory-catalog-view admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="accessories-catalog"
      module-name="设置"
      permission-code="accessories-catalog:view"
    >
      <PageHeader
        icon="fas fa-sliders-h"
        title="设置"
      >
        <template #actions>
          <el-button
            class="tf-button--refresh"
            :loading="loading || warehouseLoading"
            @click="refreshSettings"
          >
            <i class="fas fa-refresh" />刷新
          </el-button>
          <el-button @click="router.push('/accessories')">
            <i class="fas fa-arrow-left" />返回配件管理
          </el-button>
        </template>
      </PageHeader>

      <div class="admin-page-content catalog-content">
        <el-tabs
          v-model="activeTab"
          class="catalog-tabs tf-page-tabs"
        >
          <el-tab-pane
            label="商品类型"
            name="categories"
            class="tf-tab-panel"
          >
            <div class="catalog-toolbar">
              <span class="catalog-hint">维护钢化膜、充电宝、数据线等商品类型</span>
              <el-button
                v-if="canCreate"
                type="primary"
                @click="openCreate('category')"
              >
                <i class="fas fa-plus" />新增类型
              </el-button>
            </div>
            <el-table
              v-table-double-tap="categoryDetailTapOptions"
              v-tf-loading="loading"
              :data="categories"
              class="data-table admin-data-table"
              border
              stripe
              :fit="true"
              table-layout="fixed"
              @row-dblclick="categoryDetailDoubleClick"
            >
              <template #empty>
                <DataEmptyState description="暂无商品类型" />
              </template>
              <el-table-column
                prop="name"
                label="类型名称"
                min-width="180"
              />

              <el-table-column
                prop="description"
                label="说明"
                min-width="240"
              />
              <el-table-column
                prop="sort_order"
                label="排序"
                :width="$getNumberColumnWidth((categories || []).map((row) => row.sort_order), 72)"
                align="center"
              >
                <template #default="{ row }">
                  <span class="table-number-badge">{{ row.sort_order }}</span>
                </template>
              </el-table-column>
              <el-table-column
                label="状态"
                width="100"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="!isMobile && (canEdit)"
                label="操作"
                :width="$getActionColumnWidth(1)"
                class-name="actions-column"
                align="center"
              >
                <template #default="{ row }">
                  <div class="action-buttons table-actions">
                    <el-button
                      class="table-action table-action--edit"
                      @click.stop="openEdit('category', row)"
                    >
                      <i class="fas fa-edit" />编辑
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <RecordDetailDialog
              v-model="categoryDetailVisible"
              title="商品类型详情"
              :record="categoryDetailRow"
              :fields="categoryDetailFields"
              :has-actions="canEdit"
            >
              <template #actions="{ row }">
                <el-button
                  v-permission="'accessories-catalog:edit'"
                  type="primary"
                  @click.stop="categoryDetailRunAction(() => openEdit('category', row))"
                >
                  <i class="fas fa-edit" />编辑
                </el-button>
              </template>
            </RecordDetailDialog>
          </el-tab-pane>

          <el-tab-pane
            label="计量单位"
            name="units"
            class="tf-tab-panel"
          >
            <div class="catalog-toolbar">
              <span class="catalog-hint">维护个、张、套、盒、条等库存计量单位</span>
              <el-button
                v-if="canCreate"
                type="primary"
                @click="openCreate('unit')"
              >
                <i class="fas fa-plus" />新增单位
              </el-button>
            </div>
            <el-table
              v-table-double-tap="unitDetailTapOptions"
              v-tf-loading="loading"
              :data="units"
              class="data-table admin-data-table"
              border
              stripe
              :fit="true"
              table-layout="fixed"
              @row-dblclick="unitDetailDoubleClick"
            >
              <template #empty>
                <DataEmptyState description="暂无计量单位" />
              </template>
              <el-table-column
                prop="name"
                label="单位名称"
                min-width="180"
              />
              <el-table-column
                prop="sort_order"
                label="排序"
                :width="$getNumberColumnWidth((units || []).map((row) => row.sort_order), 72)"
                align="center"
              >
                <template #default="{ row }">
                  <span class="table-number-badge">{{ row.sort_order }}</span>
                </template>
              </el-table-column>
              <el-table-column
                label="状态"
                width="100"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="!isMobile && (canEdit)"
                label="操作"
                :width="$getActionColumnWidth(1)"
                class-name="actions-column"
                align="center"
              >
                <template #default="{ row }">
                  <div class="action-buttons table-actions">
                    <el-button
                      class="table-action table-action--edit"
                      @click.stop="openEdit('unit', row)"
                    >
                      <i class="fas fa-edit" />编辑
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <RecordDetailDialog
              v-model="unitDetailVisible"
              title="计量单位详情"
              :record="unitDetailRow"
              :fields="unitDetailFields"
              :has-actions="canEdit"
            >
              <template #actions="{ row }">
                <el-button
                  v-permission="'accessories-catalog:edit'"
                  type="primary"
                  @click.stop="unitDetailRunAction(() => openEdit('unit', row))"
                >
                  <i class="fas fa-edit" />编辑
                </el-button>
              </template>
            </RecordDetailDialog>
          </el-tab-pane>
          <el-tab-pane
            v-if="canViewAccessoryField('distribution')"
            label="仓库设置"
            name="warehouse"
            class="tf-tab-panel"
          >
            <LoadingOverlay
              :loading="warehouseLoading"
              text="正在读取仓库设置..."
            >
              <el-alert
                title="指定任意有权限的启用店铺作为总仓。新建配件入库时默认选中总仓，也可另选入库店铺；修改设置不会移动现有库存。"
                type="info"
                :closable="false"
              />
              <el-alert
                v-if="warehouseFailed"
                title="仓库设置读取失败，请刷新后重试"
                type="error"
                :closable="false"
              />
              <el-form
                class="tf-form-layout tf-form-grid"
                label-position="top"
                @submit.prevent="saveWarehouse"
              >
                <el-form-item label="入库总仓店铺">
                  <el-select
                    v-model="warehouseStoreId"
                    placeholder="未设置时使用当前用户店铺"
                    clearable
                    filterable
                    :disabled="!canEdit || warehouseLoading || warehouseSaving || !warehouseReady"
                    aria-label="入库总仓店铺"
                  >
                    <el-option
                      v-for="store in warehouseStores"
                      :key="store.id"
                      :value="Number(store.id)"
                      :label="store.name"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item v-if="canEdit">
                  <el-button
                    v-permission="'accessories-catalog:edit'"
                    type="primary"
                    native-type="submit"
                    :loading="warehouseSaving"
                    :disabled="warehouseLoading || !warehouseReady"
                  >
                    保存仓库设置
                  </el-button>
                </el-form-item>
              </el-form>
            </LoadingOverlay>
          </el-tab-pane>
        </el-tabs>
      </div>

      <MobileDialog
        v-model="dialogVisible"
        :title="editingId ? `编辑${editingKind === 'category' ? '商品类型' : '计量单位'}` : `新增${editingKind === 'category' ? '商品类型' : '计量单位'}`"
        :close-on-click-modal="false"
        :show-default-footer="false"
        :close-on-press-escape="!saving"
        :before-close="done => { if (!saving) done() }"
        destroy-on-close
      >
        <el-form
          ref="formRef"
          class="tf-form-layout tf-form-grid"
          :model="form"
          :rules="rules"
          :disabled="saving"
          label-position="top"
        >
          <el-form-item
            label="名称"
            prop="name"
          >
            <el-input
              v-model="form.name"
              maxlength="100"
              show-word-limit
              clearable
            />
          </el-form-item>
          <el-form-item
            v-if="editingKind === 'category'"
            class="tf-form-field--wide"
            label="说明"
          >
            <el-input
              v-model="form.description"
              class="tf-textarea"
              type="textarea"
              maxlength="500"
              :rows="3"
              show-word-limit
            />
          </el-form-item>

          <el-form-item label="排序">
            <el-input-number
              v-model="form.sort_order"
              :min="0"
              :max="99999"
              :controls="false"
              class="full-width"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-switch
              v-model="form.status"
              :active-value="1"
              :inactive-value="0"
              active-text="启用"
              inactive-text="停用"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="tf-dialog-actions">
            <el-button
              :disabled="saving"
              @click="dialogVisible = false"
            >
              <i class="fas fa-times" />取消
            </el-button>
            <el-button
              type="primary"
              :loading="saving"
              @click="saveCatalogItem"
            >
              <i class="fas fa-check" />保存
            </el-button>
          </div>
        </template>
      </MobileDialog>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { usePageShortcuts } from '@/composables/useRouteDialog'
import { computed } from 'vue'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import type { RecordDetailField } from '@/types/component'
import { reactive, ref, watch } from 'vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { canViewAccessoryField } from '@/components/accessory-field-permissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { PageHeader, PermissionGate } from '@/components/base'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useNotification } from '@/composables/useNotification'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'
import type { AccessoryCatalogItem, AccessoryCatalogResponse, AccessoryCatalogKind, AccessorySettings } from '@/types/accessory'

const { canView, canCreate, canEdit, requirePermission } = usePagePermissions('accessories-catalog')
const router = useRouter()
const notifications = useNotification()
const activeTab = ref<'categories' | 'units' | 'warehouse'>('categories')
const loading = ref(false)
const warehouseLoading = ref(false)
const warehouseSaving = ref(false)
const warehouseFailed = ref(false)
const warehouseReady = ref(false)
const warehouseStoreId = ref<number | null>(null)
const warehouseStores = ref<AccessorySettings['stores']>([])
const warehouseRequest = useLatestRequest()
const catalogRequest = useLatestRequest()
const saving = ref(false)
const dialogVisible = ref(false)
const editingKind = ref<AccessoryCatalogKind>('category')
const editingId = ref<number | null>(null)
const categories = ref<AccessoryCatalogItem[]>([])
const units = ref<AccessoryCatalogItem[]>([])
const formRef = ref<FormInstance>()
const form = reactive({ name: '', description: '', sort_order: 0, status: 1 })
const rules: FormRules = { name: [{ required: true, message: '请输入名称', trigger: 'blur' }] }

const loadCatalog = async () => {
  const request = catalogRequest.nextRequest()
  loading.value = true
  try {
    const response = await unifiedApi.get<AccessoryCatalogResponse>('/accessories/catalog', { signal: request.signal, useCache: false, showLoading: false, showError: false })
    if (!request.isLatest()) return
    categories.value = response.data?.categories || []
    units.value = response.data?.units || []
  } catch (error) {
    if (!request.isLatest() || catalogRequest.isCanceledError(error)) return
    logger.error('加载设置失败', error)
    notifications.error('加载设置失败，请重试')
  } finally {
    if (request.isLatest()) loading.value = false
  }
}

const loadWarehouse = async () => {
  if (!canViewAccessoryField('distribution')) return
  const request = warehouseRequest.nextRequest()
  warehouseLoading.value = true
  warehouseReady.value = false
  warehouseFailed.value = false
  try {
    const response = await unifiedApi.get<AccessorySettings>('/accessories/settings', { signal: request.signal, useCache: false, showLoading: false })
    if (!request.isLatest()) return
    if (!response.data) throw new Error('仓库设置响应不完整')
    warehouseStoreId.value = response.data.warehouse_store_id
    warehouseStores.value = response.data.stores
    warehouseReady.value = true
  } catch (error) {
    if (request.isLatest() && !warehouseRequest.isCanceledError(error)) warehouseFailed.value = true
  } finally { if (request.isLatest()) warehouseLoading.value = false }
}
const refreshSettings = async () => { await Promise.all([loadCatalog(), loadWarehouse()]) }
const saveWarehouse = async () => {
  if (!requirePermission('edit') || warehouseSaving.value || !warehouseReady.value || warehouseLoading.value) return
  warehouseSaving.value = true
  try {
    const response = await unifiedApi.put('/accessories/settings', { warehouse_store_id: warehouseStoreId.value || null })
    if (response.success === false) throw new Error(response.message || '保存失败')
    notifications.success('仓库设置已保存')
    await loadWarehouse()
  } catch (error) {
    logger.error('保存仓库设置失败', error)
  } finally { warehouseSaving.value = false }
}

const openCreate = (kind: AccessoryCatalogKind) => {
  if (saving.value) return
  if (!requirePermission('create')) return
  editingKind.value = kind
  editingId.value = null
  Object.assign(form, { name: '', description: '', sort_order: 0, status: 1 })
  dialogVisible.value = true
}

const openEdit = (kind: AccessoryCatalogKind, item: AccessoryCatalogItem) => {
  if (saving.value) return
  if (!requirePermission('edit')) return
  editingKind.value = kind
  editingId.value = item.id
  Object.assign(form, { name: item.name, description: item.description || '', sort_order: item.sort_order, status: item.status })
  dialogVisible.value = true
}

const saveCatalogItem = async () => {
  if (!requirePermission(editingId.value ? 'edit' : 'create')) return
  if (saving.value || !formRef.value) return
  saving.value = true
  try {
    if (!await formRef.value.validate().catch(() => false)) return
    const url = editingId.value
      ? `/accessories/catalog/${editingKind.value}/${editingId.value}`
      : `/accessories/catalog/${editingKind.value}`
    const data = { name: form.name, sort_order: form.sort_order, status: form.status,
      ...(editingKind.value === 'category' ? { description: form.description } : {}) }
    const response = editingId.value
      ? await unifiedApi.put(url, data, { showError: false })
      : await unifiedApi.post(url, data, { showError: false })
    if (response.success === false) throw new Error(response.message || '保存失败')
    notifications.success('设置保存成功')
    dialogVisible.value = false
    await loadCatalog()
  } catch (error) {
    logger.error('保存设置失败', error)
    notifications.error('保存设置失败，请重试')
  } finally {
    saving.value = false
  }
}

watch(canView, async allowed => {
  if (allowed) {
    await fieldPermissions.init()
    if (canView.value) await refreshSettings()
  }
  else {
    catalogRequest.cancelLatest()
    warehouseRequest.cancelLatest()
    warehouseReady.value = false
    warehouseStores.value = []
    categories.value = []
    units.value = []
  }
}, { immediate: true })

const { isMobile } = useMobile()
const { detailRow: categoryDetailRow, detailVisible: categoryDetailVisible, doubleTapOptions: categoryDetailTapOptions, handleRowDoubleClick: categoryDetailDoubleClick, runDetailAction: categoryDetailRunAction } = useMobileTableDetail<AccessoryCatalogItem>({
  enabled: () => isMobile.value && canView.value, rows: () => categories.value, getKey: row => row.id
})
const categoryDetailFields = computed<RecordDetailField[]>(() => {
  const row = categoryDetailRow.value
  if (!row) return []
  return [
    { key: 'name', label: '名称', value: row.name, visible: canView.value },
    { key: 'description', label: '说明', value: row.description, visible: canView.value, wide: true },
    { key: 'sort_order', label: '排序', value: row.sort_order, visible: canView.value },
    { key: 'status', label: '状态', value: row.status === 1 ? '启用' : '停用', visible: canView.value }
  ]
})


const { detailRow: unitDetailRow, detailVisible: unitDetailVisible, doubleTapOptions: unitDetailTapOptions, handleRowDoubleClick: unitDetailDoubleClick, runDetailAction: unitDetailRunAction } = useMobileTableDetail<AccessoryCatalogItem>({
  enabled: () => isMobile.value && canView.value, rows: () => units.value, getKey: row => row.id
})
const unitDetailFields = computed<RecordDetailField[]>(() => {
  const row = unitDetailRow.value
  if (!row) return []
  return [
    { key: 'name', label: '名称', value: row.name, visible: canView.value },
    { key: 'sort_order', label: '排序', value: row.sort_order, visible: canView.value },
    { key: 'status', label: '状态', value: row.status === 1 ? '启用' : '停用', visible: canView.value }
  ]
})

usePageShortcuts('/accessories/catalog', {
  'goods-type-create': { open: () => { activeTab.value = 'categories'; openCreate('category') } },
  'goods-unit-create': { open: () => { activeTab.value = 'units'; openCreate('unit') } },
  'goods-warehouse-settings': { open: () => { activeTab.value = 'warehouse' }, allowed: () => canViewAccessoryField('distribution') }
})
</script>

<style scoped>
.catalog-content { display: block; }
.catalog-toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--tf-space-3); margin-bottom: var(--tf-space-4); }
.catalog-hint { color: var(--color-text-secondary); }
.full-width { width: 100%; }
@media (max-width: 767px) {
  .catalog-toolbar { align-items: flex-start; flex-direction: column; }
  .catalog-hint { line-height: 1.5; }
}
</style>
