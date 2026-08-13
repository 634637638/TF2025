<template>
  <div class="field-permission-table">
    <div class="table-toolbar" v-if="showToolbar">
      <slot name="toolbar">
        <div class="toolbar-left">
          <h3>{{ title }}</h3>
        </div>
        <div class="toolbar-right">
          <el-button
            v-if="showRefresh"
            type="primary"
            :loading="loading"
            :icon="Refresh"
            @click="handleRefresh"
          >
            刷新
          </el-button>
          <el-button
            v-if="showExport"
            :icon="Download"
            :disabled="!canExport"
            @click="handleExport"
          >
            导出
          </el-button>
        </div>
      </slot>
    </div>

    <div class="search-form" v-if="showSearch">
      <el-form :model="searchForm" inline>
        <el-form-item
          v-for="field in searchFields"
          :key="field.name"
          :label="field.label"
        >
          <el-input
            v-model="searchForm[field.name]"
            :placeholder="field.placeholder"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <div class="search-actions">
            <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
            <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-scroll-shell">
      <el-table
      :data="filteredData"
      :loading="loading"
      row-key="id"
      class="tf-unified-table"
      @sort-change="handleSortChange"
    >
      <el-table-column
        v-for="column in tableColumns"
        :key="column.key"
        :prop="column.dataIndex"
        :label="column.title"
        :min-width="column.width"
        :sortable="column.sorter ? 'custom' : false"
        align="center"
      >
        <template #default="{ row }">
          <slot
            :name="`column-${column.dataIndex}`"
            :text="row[column.dataIndex]"
            :record="row"
            :column="column"
          >
            <el-tag v-if="column.type === 'BOOLEAN'" :type="row[column.dataIndex] ? 'success' : 'danger'">
              {{ row[column.dataIndex] ? '是' : '否' }}
            </el-tag>
            <span v-else-if="column.type === 'DATE'">{{ formatDate(row[column.dataIndex]) }}</span>
            <span v-else-if="column.type === 'DATETIME'">{{ formatDateTime(row[column.dataIndex]) }}</span>
            <span v-else>{{ column.customRender(row[column.dataIndex]) }}</span>
          </slot>
        </template>
      </el-table-column>

      <el-table-column
        v-if="hasEditPermission || hasDeletePermission"
        label="操作"
        :width="$getActionColumnWidth(Number(hasEditPermission) + Number(hasDeletePermission))"
        align="center"
        class-name="actions-column"
      >
        <template #default="{ row }">
          <slot name="action" :record="row">
            <div class="action-buttons">
              <el-button
              v-if="hasEditPermission"
              type="primary"
              size="small"
              :icon="Edit"
              @click.stop="handleEdit(row)"
            >
              编辑
            </el-button>
              <el-button
              v-if="hasDeletePermission"
              type="danger"
              size="small"
              :icon="Delete"
              @click.stop="handleDelete(row)"
            >
              删除
            </el-button>
            </div>
          </slot>
        </template>
      </el-table-column>
      </el-table>
    </div>

    <Pagination
      v-if="pagination.total > 0"
      class="table-pagination"
      :current="pagination.current"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="[10, 20, 50, 100]"
      :show-range="true"
      @change="handlePaginationChange"
    />

    <el-dialog
      v-model="modalVisible"
      :title="modalTitle"
      width="min(800px, 94vw)"
      class="tf-dialog"
      @closed="handleModalCancel"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
      >
        <el-form-item
          v-for="field in formFields"
          :key="field.name"
          :label="field.label"
          :prop="field.name"
        >
          <el-input
            v-if="field.type === 'TEXT' || field.type === 'EMAIL' || field.type === 'PHONE'"
            v-model="formData[field.name]"
            :placeholder="field.placeholder"
          />
          <el-input-number
            v-else-if="field.type === 'NUMBER'"
            v-model="formData[field.name]"
            :placeholder="field.placeholder"
            class="w-full"
          />
          <el-date-picker
            v-else-if="field.type === 'DATE'"
            v-model="formData[field.name]"
            type="date"
            :placeholder="field.placeholder"
            class="w-full"
            value-format="YYYY-MM-DD"
          />
          <el-date-picker
            v-else-if="field.type === 'DATETIME'"
            v-model="formData[field.name]"
            type="datetime"
            :placeholder="field.placeholder"
            class="w-full"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
          <el-select
            v-else-if="field.type === 'SELECT'"
            v-model="formData[field.name]"
            :placeholder="field.placeholder"
            class="w-full"
          >
            <el-option
              v-for="option in field.options || []"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-switch
            v-else-if="field.type === 'BOOLEAN'"
            v-model="formData[field.name]"
          />
          <el-input
            v-else-if="field.type === 'TEXTAREA'"
            v-model="formData[field.name]"
            type="textarea"
            :placeholder="field.placeholder"
            :rows="3"
          />
          <el-input
            v-else
            v-model="formData[field.name]"
            :placeholder="field.placeholder"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer tf-dialog-actions">
          <el-button @click="modalVisible = false">取消</el-button>
          <el-button type="primary" @click="handleModalOk">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Delete,
  Download,
  Edit,
  Refresh,
  RefreshLeft,
  Search
} from '@element-plus/icons-vue'
import { useFieldPermissions } from '@/services/fieldPermissionService'
import type {
  FieldFormField,
  FieldSearchField,
  FieldTableColumn,
  ModuleFieldConfig
} from '@/services/fieldPermissionService'
import type { FormInstance } from 'element-plus'
import Pagination from '@/components/Pagination.vue'
import dayjs from 'dayjs'
import { logger } from '@/utils/logger'

type FieldPermissionRecord = Record<string, unknown> & {
  id?: string | number
  created_at?: string
  updated_at?: string
}

interface TablePaginationConfig {
  current: number
  pageSize: number
  total: number
}

interface TableSorterInfo {
  field?: string
  order?: string
}

// Props定义
interface Props {
  moduleKey: string // 模块标识，用于获取字段权限
  title?: string // 表格标题
  data: FieldPermissionRecord[] // 表格数据
  loading?: boolean // 加载状态
  showToolbar?: boolean // 是否显示工具栏
  showSearch?: boolean // 是否显示搜索
  showRefresh?: boolean // 是否显示刷新按钮
  showExport?: boolean // 是否显示导出按钮
  canExport?: boolean // 是否可导出
  hasEditPermission?: boolean // 是否有编辑权限
  hasDeletePermission?: boolean // 是否有删除权限
  pagination?: TablePaginationConfig // 分页配置
  rowSelection?: Record<string, unknown> // 行选择配置
}

const props = withDefaults(defineProps<Props>(), {
  title: '数据列表',
  loading: false,
  showToolbar: true,
  showSearch: true,
  showRefresh: true,
  showExport: true,
  canExport: true,
  hasEditPermission: true,
  hasDeletePermission: true,
  pagination: () => ({ current: 1, pageSize: 10, total: 0 })
})

// Emits定义
const emit = defineEmits([
  'refresh',
  'search',
  'reset',
  'export',
  'edit',
  'delete',
  'table-change',
  'modal-ok',
  'modal-cancel'
])

// 使用字段权限服务
const {
  loading: fieldLoading,
  getModuleFieldConfig,
  getTableColumns,
  getFormFields,
  getSearchFormFields,
  filterDataByPermissions,
  watchRoleChange
} = useFieldPermissions()

// 响应式数据
const moduleConfig = ref<ModuleFieldConfig | null>(null)
const searchForm = ref<Record<string, any>>({})
const formData = ref<Record<string, any>>({})
const formRef = ref<FormInstance>()
const modalVisible = ref(false)
const modalTitle = ref('')
const currentRecord = ref<FieldPermissionRecord | null>(null)

// 计算属性
const tableColumns = computed(() => {
  if (!moduleConfig.value) return []
  return getTableColumns(props.moduleKey)
})

const formFields = computed(() => {
  if (!moduleConfig.value) return []
  return getFormFields(props.moduleKey) as FieldFormField[]
})

const searchFields = computed(() => {
  if (!moduleConfig.value) return []
  return getSearchFormFields(props.moduleKey) as FieldSearchField[]
})

const formRules = computed(() => {
  const rules: Record<string, unknown> = {}
  formFields.value.forEach(field => {
    if (field.rules) {
      rules[field.name] = field.rules
    }
  })
  return rules
})

// 过滤后的数据（应用字段权限）
const filteredData = computed(() => {
  return props.data.map(item => filterDataByPermissions(props.moduleKey, item))
})

// 方法
const loadModuleConfig = async () => {
  try {
    moduleConfig.value = await getModuleFieldConfig(props.moduleKey)
  } catch (error) {
    ElMessage.error('加载字段权限失败')
  }
}

const handleRefresh = () => {
  emit('refresh')
}

const handleSearch = () => {
  emit('search', searchForm.value)
}

const handleReset = () => {
  searchForm.value = {}
  emit('reset')
}

const handleExport = () => {
  emit('export', filteredData.value)
}

const handleEdit = (record: FieldPermissionRecord) => {
  currentRecord.value = record
  formData.value = { ...record }
  modalTitle.value = `编辑${moduleConfig.value?.moduleName || '数据'}`
  modalVisible.value = true
}

const handleDelete = (record: FieldPermissionRecord) => {
  emit('delete', record)
}

const handleTableChange = (
  pagination: TablePaginationConfig,
  filters: Record<string, unknown>,
  sorter: TableSorterInfo
) => {
  emit('table-change', { pagination, filters, sorter })
}

const handleSortChange = ({ prop, order }: { prop?: string; order?: string }) => {
  handleTableChange(props.pagination, {}, { field: prop, order })
}

const handlePaginationChange = (current: number, pageSize: number) => {
  handleTableChange({ ...props.pagination, current, pageSize }, {}, {})
}

const handleModalOk = async () => {
  try {
    await formRef.value?.validate()
    emit('modal-ok', {
      data: formData.value,
      record: currentRecord.value
    })
  } catch (error) {
    logger.error('表单验证失败:', error)
  }
}

const handleModalCancel = () => {
  modalVisible.value = false
  formData.value = {}
  currentRecord.value = null
  formRef.value?.resetFields()
  emit('modal-cancel')
}

const formatDate = (date: unknown) => {
  if (!date) return '-'
  return dayjs(String(date)).format('YYYY-MM-DD')
}

const formatDateTime = (dateTime: unknown) => {
  if (!dateTime) return '-'
  return dayjs(String(dateTime)).format('YYYY-MM-DD HH:mm:ss')
}

// 监听角色变化
watchRoleChange(() => {
  loadModuleConfig()
})

// 监听moduleKey变化
watch(() => props.moduleKey, () => {
  loadModuleConfig()
}, { immediate: true })

// 暴露方法给父组件
defineExpose({
  openAddModal: () => {
    currentRecord.value = null
    formData.value = {}
    modalTitle.value = `新增${moduleConfig.value?.moduleName || '数据'}`
    modalVisible.value = true
  },
  openEditModal: (record: FieldPermissionRecord) => {
    handleEdit(record)
  },
  closeModal: () => {
    modalVisible.value = false
  }
})

onMounted(() => {
  loadModuleConfig()
})
</script>

<style scoped>
.field-permission-table {
  background: #fff;
  padding: 24px;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toolbar-left h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.search-form {
  margin-bottom: 16px;
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.table-scroll-shell {
  overflow-x: auto;
}

.table-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}

.w-full {
  width: 100%;
}
</style>
