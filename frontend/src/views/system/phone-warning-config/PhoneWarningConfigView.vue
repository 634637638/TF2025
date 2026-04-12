<template>
  <div class="phone-warning-config">
    <el-empty
      v-if="!canViewWarningConfig"
      description="当前账号暂无库存预警配置查看权限"
    />

    <el-card v-else shadow="never" class="config-card">
      <template #header>
        <div class="card-toolbar">
          <div>
            <div class="card-toolbar__title">型号母模板</div>
            <div class="card-toolbar__subtitle">展开后查看并维护颜色 / 内存 / 库存类型子模板</div>
          </div>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索品牌、型号、模板名"
            clearable
            class="search-input"
          />
        </div>
      </template>

      <el-table
        :data="filteredGroupedConfigs"
        v-loading="loading"
        stripe
        border
        row-key="groupKey"
        class="main-table"
        :table-layout="'auto'"
        :fit="false"
        style="width: 100%"
      >
        <el-table-column type="expand" width="56">
          <template #default="{ row }">
            <div class="child-panel">
              <div class="child-panel__header">
                <div>
                  <div class="child-panel__title">子模板组合</div>
                  <div class="child-panel__subtitle">
                    共 {{ row.children.length }} 条规则，可分别设置颜色、内存和预警台数
                  </div>
                </div>
                <el-space wrap>
                  <el-button
                    v-if="canEditWarningConfig"
                    type="primary"
                    size="small"
                    plain
                    @click="openEditDialog(row)"
                  >
                    批量编辑
                  </el-button>
                  <el-button
                    v-if="canEditWarningConfig"
                    type="danger"
                    size="small"
                    plain
                    @click="handleDeleteGroup(row)"
                  >
                    删除模板
                  </el-button>
                </el-space>
              </div>

              <div class="child-panel__meta">
                <el-tag size="small" type="primary">颜色 {{ row.colorCount }}</el-tag>
                <el-tag size="small" type="success">内存 {{ row.memoryCount }}</el-tag>
                <el-tag size="small" type="info">{{ row.conditionSummary }}</el-tag>
                <el-tag size="small" :type="row.enabledCount === row.children.length ? 'success' : 'warning'">
                  启用 {{ row.enabledCount }}/{{ row.children.length }}
                </el-tag>
              </div>

              <div class="table-scroll-shell">
                <el-table
                  :data="row.children"
                  stripe
                  border
                  class="child-table"
                  :table-layout="'auto'"
                  :fit="false"
                >
                  <el-table-column prop="config_name" label="子模板名称" min-width="220">
                    <template #default="{ row: child }">
                      <span>{{ child.config_name || getDisplayName(child) }}</span>
                    </template>
                  </el-table-column>

                  <el-table-column prop="color_name" label="颜色" min-width="140">
                    <template #default="{ row: child }">
                      <el-tag v-if="child.color_name" size="small">{{ child.color_name }}</el-tag>
                      <span v-else class="text-muted">全部颜色</span>
                    </template>
                  </el-table-column>

                  <el-table-column prop="memory_size" label="内存" min-width="140">
                    <template #default="{ row: child }">
                      <el-tag v-if="child.memory_size" size="small" type="info">{{ child.memory_size }}</el-tag>
                      <span v-else class="text-muted">全部内存</span>
                    </template>
                  </el-table-column>

                  <el-table-column prop="is_new" label="库存类型" min-width="120" align="center">
                    <template #default="{ row: child }">
                      <el-tag :type="getConditionTagType(child.is_new)" size="small">
                        {{ getConditionLabel(child.is_new) }}
                      </el-tag>
                    </template>
                  </el-table-column>

                  <el-table-column prop="min_stock" label="预警阈值" min-width="120" align="center">
                    <template #default="{ row: child }">
                      <el-tag :type="getThresholdTagType(child.min_stock)" size="large">
                        {{ child.min_stock }} 台
                      </el-tag>
                    </template>
                  </el-table-column>

                  <el-table-column prop="warning_enabled" label="状态" min-width="120" align="center">
                    <template #default="{ row: child }">
                      <el-switch
                        v-model="child.warning_enabled"
                        :active-value="1"
                        :inactive-value="0"
                        :disabled="!canEditWarningConfig"
                        :loading="child.toggling"
                        @change="handleToggleWarning(child)"
                      />
                    </template>
                  </el-table-column>

                  <el-table-column prop="remarks" label="备注" min-width="180" />

                  <el-table-column label="操作" min-width="150" align="center">
                    <template #default="{ row: child }">
                      <div v-if="canEditWarningConfig" class="table-actions">
                        <el-button type="primary" link size="small" @click="openEditDialog(child)">
                          编辑
                        </el-button>
                        <el-button type="danger" link size="small" @click="handleDelete(child)">
                          删除
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="config_name" label="模板名称" min-width="220">
          <template #default="{ row }">
            <div class="template-name">
              <div class="template-name__title">{{ row.config_name || `${row.brand_name} ${row.model_name}` }}</div>
              <div class="template-name__sub">{{ row.variantSummary }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="brand_name" label="品牌" min-width="100" />

        <el-table-column prop="model_name" label="型号" min-width="140" />

        <el-table-column label="颜色 / 内存" min-width="220">
          <template #default="{ row }">
            <div class="summary-tags">
              <el-tag size="small">{{ row.colorSummary }}</el-tag>
              <el-tag size="small" type="info">{{ row.memorySummary }}</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="库存类型" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="success">{{ row.conditionSummary }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="阈值范围" min-width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.thresholdTagType" size="large">
              {{ row.thresholdSummary }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="状态" min-width="110" align="center">
          <template #default="{ row }">
            <div class="status-summary">
              <span class="status-summary__value">{{ row.enabledCount }}/{{ row.children.length }}</span>
              <span class="status-summary__label">已启用</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="remarks" label="备注" min-width="160" show-overflow-tooltip />

        <el-table-column label="操作" min-width="150" align="center">
          <template #default="{ row }">
            <div v-if="canEditWarningConfig" class="table-actions">
              <el-button type="primary" link size="small" @click="openEditDialog(row)">
                编辑
              </el-button>
              <el-button type="danger" link size="small" @click="handleDeleteGroup(row)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <MobileDialog
      v-model="dialogVisible"
      :title="dialogMode === 'add' ? '新增母模板' : '编辑母模板'"
      width="960px"
      :close-on-click-modal="false"
      dialog-class="warning-dialog"
      :show-default-footer="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        label-position="left"
      >
        <div class="dialog-grid">
          <el-form-item label="选择品牌" prop="brand_id">
            <el-select
              v-model="formData.brand_id"
              placeholder="请选择品牌"
              filterable
              clearable
              @change="handleBrandChange"
            >
              <el-option
                v-for="brand in brandList"
                :key="brand.id"
                :label="brand.name"
                :value="brand.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="选择型号" prop="model_id">
            <el-select
              v-model="formData.model_id"
              placeholder="请先选择品牌，再选择型号"
              filterable
              clearable
              :disabled="!formData.brand_id"
            >
              <el-option
                v-for="model in modelList"
                :key="model.id"
                :label="model.name"
                :value="model.id"
              />
            </el-select>
          </el-form-item>
        </div>

        <div class="dialog-grid">
          <el-form-item label="选择颜色">
            <el-select
              v-model="formData.color_ids"
              placeholder="可多选，不选则表示全部颜色"
              filterable
              clearable
              multiple
            >
              <el-option
                v-for="color in colorList"
                :key="color.id"
                :label="color.name"
                :value="color.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="选择内存">
            <el-select
              v-model="formData.memory_ids"
              placeholder="可多选，不选则表示全部内存"
              filterable
              clearable
              multiple
            >
              <el-option
                v-for="memory in memoryList"
                :key="memory.id"
                :label="memory.size"
                :value="memory.id"
              />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="库存类型">
          <el-select
            v-model="formData.condition_values"
            placeholder="可多选，不选则表示全部库存"
            clearable
            multiple
          >
            <el-option
              v-for="item in conditionOptions.filter(item => item.value !== null)"
              :key="item.key"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <div class="form-tip">支持多选全新和二手，不选则生成“全部库存”子模板</div>
        </el-form-item>

        <div class="dialog-grid">
          <el-form-item label="模板名称" prop="config_name">
            <el-input
              v-model="formData.config_name"
              placeholder="如：iPhone 16 系列模板"
              clearable
            />
          </el-form-item>

          <el-form-item label="默认阈值" prop="min_stock">
            <div class="default-threshold">
              <el-input-number
                v-model="formData.min_stock"
                :min="0"
                :max="100"
                :step="1"
                controls-position="right"
              />
              <span class="unit-label">台</span>
              <el-button plain @click="applyDefaultThresholdToAll">
                应用到全部组合
              </el-button>
            </div>
            <div class="form-tip">这是默认值，下面每个颜色 / 内存组合都可以再单独改成 2 台、5 台等不同阈值</div>
          </el-form-item>
        </div>

        <el-form-item label="模板备注">
          <el-input
            v-model="formData.remarks"
            type="textarea"
            :rows="2"
            placeholder="选填"
          />
        </el-form-item>

        <el-form-item label="子模板组合" class="variant-form-item">
          <div class="variant-editor">
            <div class="variant-editor__header">
              <div>
                <div class="variant-editor__title">已生成 {{ variantDrafts.length }} 个子模板</div>
                <div class="variant-editor__subtitle">每个组合都可以分别设置阈值和启用状态</div>
              </div>
              <el-switch
                v-model="formData.warning_enabled"
                :active-value="1"
                :inactive-value="0"
                active-text="默认启用"
                inactive-text="默认禁用"
              />
            </div>

            <el-empty
              v-if="!variantDrafts.length"
              description="请先选择品牌、型号，以及颜色 / 内存 / 库存类型组合"
            />

            <div v-else class="table-scroll-shell">
              <el-table
                :data="variantDrafts"
                border
                stripe
                class="variant-table"
                :table-layout="'auto'"
                :fit="false"
              >
                <el-table-column prop="color_name" label="颜色" min-width="140">
                  <template #default="{ row }">
                    <el-tag v-if="row.color_name" size="small">{{ row.color_name }}</el-tag>
                    <span v-else class="text-muted">全部颜色</span>
                  </template>
                </el-table-column>

                <el-table-column prop="memory_size" label="内存" min-width="140">
                  <template #default="{ row }">
                    <el-tag v-if="row.memory_size" size="small" type="info">{{ row.memory_size }}</el-tag>
                    <span v-else class="text-muted">全部内存</span>
                  </template>
                </el-table-column>

                <el-table-column prop="condition_label" label="库存类型" min-width="130" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getConditionTagType(row.is_new)" size="small">
                      {{ row.condition_label }}
                    </el-tag>
                  </template>
                </el-table-column>

                <el-table-column label="预警阈值" min-width="180" align="center">
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.min_stock"
                      :min="0"
                      :max="100"
                      :step="1"
                      controls-position="right"
                    />
                  </template>
                </el-table-column>

                <el-table-column label="启用" min-width="120" align="center">
                  <template #default="{ row }">
                    <el-switch
                      v-model="row.warning_enabled"
                      :active-value="1"
                      :inactive-value="0"
                    />
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button type="default" @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!canEditWarningConfig"
          @click="handleSubmit"
        >
          {{ dialogMode === 'add' ? '新增模板' : '保存模板' }}
        </el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessageBox, type FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import phoneStockWarningsApi from '@/api/phone-stock-warnings'
import { baseDataApi } from '@/api/base-data'

const { success, error } = useNotification()
const {
  canView: canViewWarningConfig,
  canEdit: canEditWarningConfig,
  handleNoPermission
} = usePagePermissions('settings')

const { loading } = useLoadingState()
const configList = ref<any[]>([])
const dialogVisible = ref(false)
const dialogMode = ref<'add' | 'edit'>('add')
const submitting = ref(false)
const searchKeyword = ref('')

const brandList = ref<any[]>([])
const modelList = ref<any[]>([])
const colorList = ref<any[]>([])
const memoryList = ref<any[]>([])
const variantDrafts = ref<any[]>([])
const originalVariantIds = ref<number[]>([])
const editingSeedRows = ref<any[]>([])

const conditionOptions = [
  { key: 'all', label: '全部库存', value: null },
  { key: 'new', label: '全新', value: 1 },
  { key: 'used', label: '二手', value: 0 }
]

const formRef = ref<FormInstance>()
const formData = reactive({
  brand_id: null as number | null,
  model_id: null as number | null,
  color_ids: [] as number[],
  memory_ids: [] as number[],
  condition_values: [] as number[],
  min_stock: 3,
  warning_enabled: 1,
  config_name: '',
  remarks: ''
})

const formRules = {
  brand_id: [
    ValidationRules.required('请选择品牌')
  ],
  model_id: [
    ValidationRules.required('请选择型号')
  ],
  min_stock: [
    ValidationRules.required('请输入默认阈值')
  ]
}

const enabledConfigCount = computed(() => {
  return configList.value.filter(item => item.warning_enabled === 1).length
})

const groupedConfigs = computed(() => {
  const groupMap = new Map<string, any>()

  configList.value.forEach((item) => {
    const groupKey = `${item.brand_id}-${item.model_id}`
    const existingGroup = groupMap.get(groupKey)

    if (!existingGroup) {
      groupMap.set(groupKey, {
        groupKey,
        brand_id: item.brand_id,
        model_id: item.model_id,
        brand_name: item.brand_name,
        model_name: item.model_name,
        config_name: item.config_name || '',
        remarks: item.remarks || '',
        children: [item]
      })
      return
    }

    existingGroup.children.push(item)
    if (!existingGroup.config_name && item.config_name) {
      existingGroup.config_name = item.config_name
    }
    if (!existingGroup.remarks && item.remarks) {
      existingGroup.remarks = item.remarks
    }
  })

  return [...groupMap.values()]
    .map((group) => {
      const children = [...group.children].sort((a, b) => {
        const colorA = a.color_name || ''
        const colorB = b.color_name || ''
        const memoryA = a.memory_size || ''
        const memoryB = b.memory_size || ''
        return `${colorA}-${memoryA}-${a.is_new ?? 2}`.localeCompare(`${colorB}-${memoryB}-${b.is_new ?? 2}`, 'zh-CN')
      })

      const uniqueColors = [...new Set(children.map((item: any) => item.color_name).filter(Boolean))]
      const uniqueMemories = [...new Set(children.map((item: any) => item.memory_size).filter(Boolean))]
      const conditionLabels = [...new Set(children.map((item: any) => getConditionLabel(item.is_new)))]
      const thresholds = [...new Set(children.map((item: any) => Number(item.min_stock) || 0))]
      const enabledCount = children.filter((item: any) => item.warning_enabled === 1).length
      const minThreshold = Math.min(...thresholds)
      const maxThreshold = Math.max(...thresholds)

      return {
        ...group,
        children,
        colorCount: uniqueColors.length || 1,
        memoryCount: uniqueMemories.length || 1,
        enabledCount,
        conditionLabels,
        conditionSummary: conditionLabels.join(' / '),
        colorSummary: uniqueColors.length > 0 ? `${uniqueColors.slice(0, 3).join(' / ')}${uniqueColors.length > 3 ? ` 等${uniqueColors.length}种` : ''}` : '全部颜色',
        memorySummary: uniqueMemories.length > 0 ? `${uniqueMemories.slice(0, 3).join(' / ')}${uniqueMemories.length > 3 ? ` 等${uniqueMemories.length}种` : ''}` : '全部内存',
        thresholdSummary: thresholds.length === 1 ? `${thresholds[0]} 台` : `${minThreshold}-${maxThreshold} 台`,
        thresholdTagType: thresholds.length === 1 ? getThresholdTagType(thresholds[0]) : 'warning',
        variantSummary: `${children.length} 个子模板组合`
      }
    })
    .sort((a, b) => `${a.brand_name}${a.model_name}`.localeCompare(`${b.brand_name}${b.model_name}`, 'zh-CN'))
})

const filteredGroupedConfigs = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return groupedConfigs.value
  }

  return groupedConfigs.value.filter((group) => {
    const haystack = [
      group.brand_name,
      group.model_name,
      group.config_name,
      group.remarks,
      ...group.children.flatMap((item: any) => [item.color_name, item.memory_size, item.config_name, item.remarks])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(keyword)
  })
})

const filteredChildConfigCount = computed(() => {
  return filteredGroupedConfigs.value.reduce((total, group) => total + group.children.length, 0)
})

const getDisplayName = (row: any) => {
  if (row.brand_name && row.model_name) {
    return `${row.brand_name} ${row.model_name}`
  }
  return row.config_name || '配置'
}

const getThresholdTagType = (threshold: number) => {
  if (threshold === 0) return 'danger'
  if (threshold <= 2) return 'warning'
  return 'success'
}

const getConditionLabel = (value: number | null | undefined) => {
  if (value === 1) return '全新'
  if (value === 0) return '二手'
  return '全部库存'
}

const getConditionTagType = (value: number | null | undefined) => {
  if (value === 1) return 'success'
  if (value === 0) return 'warning'
  return 'info'
}

const getColorName = (colorId: number | null) => {
  if (!colorId) return ''
  return colorList.value.find(color => color.id === colorId)?.name || ''
}

const getMemoryName = (memoryId: number | null) => {
  if (!memoryId) return ''
  return memoryList.value.find(memory => memory.id === memoryId)?.size || ''
}

const getVariantKey = (colorId: number | null, memoryId: number | null, isNew: number | null) => {
  return `${colorId ?? 'all'}_${memoryId ?? 'all'}_${isNew ?? 'all'}`
}

const rebuildVariantDrafts = () => {
  if (!dialogVisible.value || !formData.model_id) {
    variantDrafts.value = []
    return
  }

  const currentMap = new Map(
    variantDrafts.value.map(item => [item.variantKey, item])
  )
  const seedMap = new Map(
    editingSeedRows.value.map(item => [getVariantKey(item.color_id ?? null, item.memory_id ?? null, item.is_new ?? null), item])
  )

  const colorOptions = formData.color_ids.length > 0 ? formData.color_ids : [null]
  const memoryOptions = formData.memory_ids.length > 0 ? formData.memory_ids : [null]
  const conditionOptions = formData.condition_values.length > 0 ? formData.condition_values : [null]
  const drafts: any[] = []
  const seen = new Set<string>()

  colorOptions.forEach((colorId) => {
    memoryOptions.forEach((memoryId) => {
      conditionOptions.forEach((conditionValue) => {
        const variantKey = getVariantKey(colorId, memoryId, conditionValue)
        if (seen.has(variantKey)) {
          return
        }
        seen.add(variantKey)

        const currentDraft = currentMap.get(variantKey)
        const seedDraft = seedMap.get(variantKey)
        const baseDraft = currentDraft || seedDraft

        drafts.push({
          variantKey,
          existingId: baseDraft?.id || baseDraft?.existingId || null,
          color_id: colorId,
          memory_id: memoryId,
          is_new: conditionValue,
          color_name: getColorName(colorId),
          memory_size: getMemoryName(memoryId),
          condition_label: getConditionLabel(conditionValue),
          min_stock: baseDraft ? Number(baseDraft.min_stock) || 0 : formData.min_stock,
          warning_enabled: baseDraft ? baseDraft.warning_enabled : formData.warning_enabled
        })
      })
    })
  })

  variantDrafts.value = drafts
}

const applyDefaultThresholdToAll = () => {
  variantDrafts.value = variantDrafts.value.map(item => ({
    ...item,
    min_stock: formData.min_stock
  }))
}

const loadConfigs = async () => {
  loading.value = true
  try {
    const response = await phoneStockWarningsApi.getAllConfigs()
    if (response.success) {
      configList.value = response.data.map((item: any) => ({
        ...item,
        toggling: false
      }))
    }
  } catch (err) {
    error('加载配置列表失败')
  } finally {
    loading.value = false
  }
}

const loadBrands = async () => {
  try {
    brandList.value = await baseDataApi.getWarningBrands()
  } catch (err) {
    error('加载品牌列表失败')
  }
}

const loadModels = async (brandId: number) => {
  if (!brandId) {
    modelList.value = []
    return
  }

  try {
    modelList.value = await baseDataApi.getWarningModels(brandId)
  } catch (err) {
    error('加载型号列表失败')
  }
}

const loadColors = async () => {
  try {
    colorList.value = await baseDataApi.getWarningColors()
  } catch (err) {
    error('加载颜色列表失败')
  }
}

const loadMemories = async () => {
  try {
    memoryList.value = await baseDataApi.getWarningMemories()
  } catch (err) {
    error('加载内存列表失败')
  }
}

const resetForm = () => {
  Object.assign(formData, {
    brand_id: null,
    model_id: null,
    color_ids: [],
    memory_ids: [],
    condition_values: [],
    min_stock: 3,
    warning_enabled: 1,
    config_name: '',
    remarks: ''
  })

  modelList.value = []
  variantDrafts.value = []
  originalVariantIds.value = []
  editingSeedRows.value = []
}

const openAddDialog = () => {
  if (!canEditWarningConfig.value) {
    handleNoPermission('edit')
    return
  }

  dialogMode.value = 'add'
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = async (row: any) => {
  if (!canEditWarningConfig.value) {
    handleNoPermission('edit')
    return
  }

  dialogMode.value = 'edit'

  const rows = row.children ? [...row.children] : [row]
  const firstRow = rows[0]
  const colorIds = [...new Set(rows.map((item: any) => item.color_id).filter(Boolean))]
  const memoryIds = [...new Set(rows.map((item: any) => item.memory_id).filter(Boolean))]
  const conditionValues = [...new Set(rows.map((item: any) => item.is_new).filter((value: any) => value === 0 || value === 1))]

  Object.assign(formData, {
    brand_id: firstRow.brand_id,
    model_id: firstRow.model_id,
    color_ids: colorIds,
    memory_ids: memoryIds,
    condition_values: conditionValues,
    min_stock: Number(firstRow.min_stock) || 0,
    warning_enabled: firstRow.warning_enabled,
    config_name: row.config_name || firstRow.config_name || '',
    remarks: row.remarks || firstRow.remarks || ''
  })

  originalVariantIds.value = rows.map((item: any) => item.id)
  editingSeedRows.value = rows

  if (firstRow.brand_id) {
    await loadModels(firstRow.brand_id)
  }

  dialogVisible.value = true
  rebuildVariantDrafts()
}

const handleBrandChange = async () => {
  formData.model_id = null
  variantDrafts.value = []

  if (formData.brand_id) {
    await loadModels(formData.brand_id)
  } else {
    modelList.value = []
  }
}

const syncTemplateVariants = async () => {
  const basePayload = {
    brand_id: formData.brand_id,
    model_id: formData.model_id,
    config_name: formData.config_name || null,
    remarks: formData.remarks || null
  }
  const affectedIds: number[] = []

  for (const draft of variantDrafts.value) {
    const payload = {
      ...basePayload,
      color_id: draft.color_id,
      memory_id: draft.memory_id,
      is_new: draft.is_new,
      min_stock: draft.min_stock,
      warning_enabled: draft.warning_enabled
    }

    const response = draft.existingId
      ? await phoneStockWarningsApi.updateConfig(draft.existingId, payload)
      : await phoneStockWarningsApi.createConfig(payload)

    if (!response.success) {
      throw new Error(response.message || '保存子模板失败')
    }

    const ids = Array.isArray(response.data?.ids)
      ? response.data.ids
      : response.data?.id
        ? [response.data.id]
        : []

    affectedIds.push(...ids)
  }

  if (dialogMode.value === 'edit') {
    const staleIds = originalVariantIds.value.filter(id => !affectedIds.includes(id))
    for (const staleId of staleIds) {
      const response = await phoneStockWarningsApi.deleteConfig(staleId)
      if (!response.success) {
        throw new Error(response.message || '删除旧子模板失败')
      }
    }
  }
}

const handleSubmit = async () => {
  if (!canEditWarningConfig.value) {
    handleNoPermission('edit')
    return
  }

  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    if (!variantDrafts.value.length) {
      error('请先生成至少一个子模板组合')
      return
    }

    submitting.value = true
    try {
      await syncTemplateVariants()
      success(dialogMode.value === 'add' ? '新增模板成功' : '保存模板成功')
      dialogVisible.value = false
      resetForm()
      loadConfigs()
    } catch (err: any) {
      error(err.message || (dialogMode.value === 'add' ? '新增失败' : '保存失败'))
    } finally {
      submitting.value = false
    }
  })
}

const handleToggleWarning = async (row: any) => {
  if (!canEditWarningConfig.value) {
    row.warning_enabled = row.warning_enabled === 1 ? 0 : 1
    handleNoPermission('edit')
    return
  }

  row.toggling = true
  try {
    const response = await phoneStockWarningsApi.toggleWarning(row.id, row.warning_enabled === 1)
    if (!response.success) {
      row.warning_enabled = row.warning_enabled === 1 ? 0 : 1
      error(response.message || '操作失败')
    }
  } catch (err) {
    row.warning_enabled = row.warning_enabled === 1 ? 0 : 1
    error('操作失败')
  } finally {
    row.toggling = false
  }
}

const handleDelete = async (row: any) => {
  if (!canEditWarningConfig.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除子模板“${row.config_name || getDisplayName(row)}”吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await phoneStockWarningsApi.deleteConfig(row.id)
    if (response.success) {
      success('删除成功')
      loadConfigs()
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      error('删除失败')
    }
  }
}

const handleDeleteGroup = async (group: any) => {
  if (!canEditWarningConfig.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除型号模板“${group.brand_name} ${group.model_name}”及其 ${group.children.length} 条子模板吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    for (const child of group.children) {
      const response = await phoneStockWarningsApi.deleteConfig(child.id)
      if (!response.success) {
        throw new Error(response.message || '删除失败')
      }
    }

    success('删除模板成功')
    loadConfigs()
  } catch (err: any) {
    if (err !== 'cancel') {
      error(err.message || '删除模板失败')
    }
  }
}

watch(
  () => [
    dialogVisible.value,
    formData.model_id,
    [...formData.color_ids].sort((a, b) => a - b).join(','),
    [...formData.memory_ids].sort((a, b) => a - b).join(','),
    [...formData.condition_values].sort((a, b) => a - b).join(',')
  ],
  () => {
    rebuildVariantDrafts()
  }
)

watch(
  () => formData.warning_enabled,
  (value) => {
    if (!dialogVisible.value || variantDrafts.value.length === 0) {
      return
    }

    const allSame = variantDrafts.value.every(item => item.warning_enabled === value)
    if (allSame) {
      return
    }

    variantDrafts.value = variantDrafts.value.map(item => ({
      ...item,
      warning_enabled: item.existingId ? item.warning_enabled : value
    }))
  }
)

onMounted(() => {
  if (!canViewWarningConfig.value) {
    return
  }

  loadConfigs()
  loadBrands()
  loadColors()
  loadMemories()
})

defineExpose({
  openAddDialog,
  loadConfigs
})
</script>

<style lang="scss" scoped>
.phone-warning-config {
  --warning-primary: #205781;
  --warning-secondary: #4f959d;
  --warning-accent: #f6b17a;
  --warning-surface: #f6f9fc;
  --warning-border: rgba(32, 87, 129, 0.1);

  padding: 20px;
  background:
    radial-gradient(circle at top right, rgba(246, 177, 122, 0.12), transparent 28%),
    linear-gradient(180deg, #f7fafc 0%, #eef3f7 100%);
  border-radius: 28px;

  .config-card {
    overflow: hidden;
    border: 1px solid var(--warning-border);
    border-radius: 24px;
    box-shadow: 0 18px 46px rgba(31, 41, 55, 0.08);
    background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);

    :deep(.el-card__header) {
      padding: 22px 24px;
      border-bottom: 1px solid rgba(32, 87, 129, 0.08);
      background: linear-gradient(180deg, #fbfdff 0%, #f4f8fb 100%);
    }

    :deep(.el-card__body) {
      padding: 20px 22px 22px;
    }
  }

  .card-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
  }

  .card-toolbar__title {
    font-size: 20px;
    font-weight: 700;
    color: #1f2937;
  }

  .card-toolbar__subtitle {
    margin-top: 6px;
    color: #8a94a0;
    font-size: 13px;
  }

  .search-input {
    width: 300px;
  }

  .template-name__title {
    font-weight: 700;
    color: #1f2937;
  }

  .template-name__sub {
    margin-top: 6px;
    color: #8a94a0;
    font-size: 12px;
  }

  .summary-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .table-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    white-space: nowrap;
  }

  .status-summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .status-summary__value {
    color: var(--warning-primary);
    font-weight: 700;
  }

  .status-summary__label {
    color: #8a94a0;
    font-size: 12px;
  }

  .child-panel {
    padding: 16px;
    border: 1px solid rgba(32, 87, 129, 0.08);
    background:
      linear-gradient(180deg, #ffffff 0%, #f7fafc 100%);
    border-radius: 18px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }

  .child-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .child-panel__title {
    font-size: 15px;
    font-weight: 700;
    color: #1f2937;
  }

  .child-panel__subtitle {
    margin-top: 4px;
    color: #8a94a0;
    font-size: 12px;
  }

  .child-panel__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .main-table,
  .child-table,
  .variant-table {
    :deep(.el-table__inner-wrapper) {
      border-radius: 16px;
    }
  }

  .table-scroll-shell {
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 2px;
  }

  .child-table,
  .variant-table {
    min-width: 100%;

    :deep(.el-table__body),
    :deep(.el-table__header) {
      width: max-content;
      min-width: 100%;
    }

    :deep(.cell) {
      white-space: nowrap;
    }
  }

  .dialog-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .default-threshold {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid rgba(32, 87, 129, 0.08);
    border-radius: 16px;
    background: linear-gradient(180deg, #fbfdff 0%, #f4f8fb 100%);
  }

  .variant-editor {
    width: 100%;
    padding: 18px;
    border: 1px solid rgba(32, 87, 129, 0.1);
    border-radius: 18px;
    background:
      radial-gradient(circle at top right, rgba(246, 177, 122, 0.1), transparent 30%),
      linear-gradient(180deg, #fcfdff 0%, #f7fafc 100%);
  }

  .variant-editor__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(32, 87, 129, 0.08);
  }

  .variant-editor__title {
    font-size: 15px;
    font-weight: 700;
    color: #1f2937;
  }

  .variant-editor__subtitle {
    margin-top: 4px;
    color: #8a94a0;
    font-size: 12px;
  }

  .variant-table {
    width: 100%;
  }

  .text-muted {
    color: #909399;
  }

  .form-tip {
    margin-top: 6px;
    color: #8a94a0;
    font-size: 12px;
    line-height: 1.6;
  }

  .unit-label {
    color: #606266;
  }

  :deep(.warning-dialog .el-dialog__body) {
    padding: 22px 24px 16px;
  }

  :deep(.warning-dialog .el-dialog__footer) {
    padding: 12px 24px 24px;
  }

  :deep(.el-table) {
    --el-table-border-color: rgba(32, 87, 129, 0.08);
    --el-table-header-bg-color: #f6f9fc;
    --el-table-row-hover-bg-color: #f8fbfd;
  }

  :deep(.el-table th.el-table__cell) {
    color: #4b5563;
    font-weight: 700;
    background: #f7fafc;
  }

  :deep(.el-table td.el-table__cell) {
    color: #374151;
  }

  :deep(.el-table .el-table__expanded-cell) {
    padding: 16px;
    background: #f7fafc;
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-textarea__inner),
  :deep(.el-input-number) {
    border-radius: 14px;
  }

  :deep(.el-button) {
    border-radius: 12px;
  }

  :deep(.el-tag) {
    border-radius: 999px;
  }

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }
}

@media (max-width: 992px) {
  .phone-warning-config {
    .dialog-grid {
      grid-template-columns: 1fr;
    }
  }
}

@media (max-width: 768px) {
  .phone-warning-config {
    padding: 12px;
    border-radius: 20px;

    .card-toolbar,
    .child-panel__header,
    .variant-editor__header {
      flex-direction: column;
      align-items: flex-start;
    }

    .search-input {
      width: 100%;
    }

    :deep(.warning-dialog .el-dialog) {
      width: 96% !important;
    }

    :deep(.el-form-item__label) {
      width: 86px !important;
    }
  }
}
</style>
