<template>
  <div class="field-permission-table">
    <!-- 表格工具栏 -->
    <div class="table-toolbar" v-if="showToolbar">
      <slot name="toolbar">
        <div class="toolbar-left">
          <h3>{{ title }}</h3>
        </div>
        <div class="toolbar-right">
          <a-button
            v-if="showRefresh"
            type="primary"
            :loading="loading"
            @click="handleRefresh"
          >
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
          <a-button
            v-if="showExport"
            type="default"
            :disabled="!canExport"
            @click="handleExport"
          >
            <template #icon><ExportOutlined /></template>
            导出
          </a-button>
        </div>
      </slot>
    </div>

    <!-- 搜索表单 -->
    <div class="search-form" v-if="showSearch">
      <a-form :model="searchForm" layout="inline">
        <a-form-item
          v-for="field in searchFields"
          :key="field.name"
          :label="field.label"
        >
          <a-input
            v-model="searchForm[field.name]"
            :placeholder="field.placeholder"
            allowClear
            @pressEnter="handleSearch"
          />
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSearch">
              <template #icon><SearchOutlined /></template>
              搜索
            </a-button>
            <a-button @click="handleReset">
              <template #icon><ClearOutlined /></template>
              重置
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </div>

    <!-- 数据表格 -->
    <a-table
      :columns="tableColumns"
      :data-source="filteredData"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      :row-selection="rowSelection"
      :scroll="{ x: tableWidth }"
      @change="handleTableChange"
    >
      <!-- 动态插槽：支持自定义列渲染 -->
      <template
        v-for="column in tableColumns"
        :key="column.dataIndex"
        #[column.dataIndex]="{ text, record }"
      >
        <slot
          :name="`column-${column.dataIndex}`"
          :text="text"
          :record="record"
          :column="column"
        >
          <!-- 默认渲染 -->
          <span v-if="column.type === 'BOOLEAN'">
            <a-tag :color="text ? 'green' : 'red'">
              {{ text ? '是' : '否' }}
            </a-tag>
          </span>
          <span v-else-if="column.type === 'DATE'">
            {{ formatDate(text) }}
          </span>
          <span v-else-if="column.type === 'DATETIME'">
            {{ formatDateTime(text) }}
          </span>
          <span v-else>
            {{ column.customRender ? column.customRender(text) : text }}
          </span>
        </slot>
      </template>

      <!-- 操作列 -->
      <template #action="{ record }">
        <slot name="action" :record="record">
          <a-space>
            <a-button
              v-if="hasEditPermission"
              type="link"
              size="small"
              @click="handleEdit(record)"
            >
              <template #icon><EditOutlined /></template>
              编辑
            </a-button>
            <a-button
              v-if="hasDeletePermission"
              type="link"
              size="small"
              danger
              @click="handleDelete(record)"
            >
              <template #icon><DeleteOutlined /></template>
              删除
            </a-button>
          </a-space>
        </slot>
      </template>
    </a-table>

    <!-- 编辑/新增弹窗 -->
    <a-modal
      v-model:visible="modalVisible"
      :title="modalTitle"
      :width="800"
      @ok="handleModalOk"
      @cancel="handleModalCancel"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
      >
        <a-form-item
          v-for="field in formFields"
          :key="field.name"
          :label="field.label"
          :name="field.name"
        >
          <!-- 根据字段类型渲染不同的输入组件 -->
          <a-input
            v-if="field.type === 'TEXT' || field.type === 'EMAIL' || field.type === 'PHONE'"
            v-model:value="formData[field.name]"
            :placeholder="field.placeholder"
            :type="field.type.toLowerCase()"
          />

          <a-input-number
            v-else-if="field.type === 'NUMBER'"
            v-model:value="formData[field.name]"
            :placeholder="field.placeholder"
            class="w-full"
          />

          <a-date-picker
            v-else-if="field.type === 'DATE'"
            v-model:value="formData[field.name]"
            :placeholder="field.placeholder"
            class="w-full"
            format="YYYY-MM-DD"
          />

          <a-date-picker
            v-else-if="field.type === 'DATETIME'"
            v-model:value="formData[field.name]"
            :placeholder="field.placeholder"
            class="w-full"
            format="YYYY-MM-DD HH:mm:ss"
            showTime
          />

          <a-select
            v-else-if="field.type === 'SELECT'"
            v-model:value="formData[field.name]"
            :placeholder="field.placeholder"
            :options="field.options"
            class="w-full"
          />

          <a-switch
            v-else-if="field.type === 'BOOLEAN'"
            v-model:checked="formData[field.name]"
          />

          <a-textarea
            v-else-if="field.type === 'TEXTAREA'"
            v-model:value="formData[field.name]"
            :placeholder="field.placeholder"
            :rows="3"
          />

          <!-- 其他类型默认文本输入 -->
          <a-input
            v-else
            v-model:value="formData[field.name]"
            :placeholder="field.placeholder"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  ExportOutlined,
  SearchOutlined,
  ClearOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'
import { useFieldPermissions } from '@/services/fieldPermissionService'
import type {
  FieldFormField,
  FieldSearchField,
  FieldTableColumn,
  ModuleFieldConfig
} from '@/services/fieldPermissionService'
import type { FormInstance } from 'ant-design-vue'
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
  pagination: { current: 1, pageSize: 10, total: 0 }
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
const searchForm = ref<Record<string, unknown>>({})
const formData = ref<Record<string, unknown>>({})
const formRef = ref<FormInstance>()
const modalVisible = ref(false)
const modalTitle = ref('')
const currentRecord = ref<FieldPermissionRecord | null>(null)

// 计算属性
const tableColumns = computed(() => {
  if (!moduleConfig.value) return []

  const columns = [...getTableColumns(props.moduleKey)]

  // 添加操作列
  if (props.hasEditPermission || props.hasDeletePermission) {
    columns.push({
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      fixed: 'right',
      slots: { customRender: 'action' }
    })
  }

  return columns
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

const tableWidth = computed(() => {
  return tableColumns.value.reduce((width, column) => {
    return width + (column.width || 150)
  }, 0) + 100
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
    message.error('加载字段权限失败')
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

const formatDate = (date: string) => {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

const formatDateTime = (dateTime: string) => {
  if (!dateTime) return '-'
  return dayjs(dateTime).format('YYYY-MM-DD HH:mm:ss')
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

:deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 500;
}

:deep(.ant-form-item) {
  margin-bottom: 16px;
}
</style>
