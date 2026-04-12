<template>
  <div class="data-check-tab">
    <!-- 操作按钮 -->
    <div class="action-bar">
      <el-button type="primary" @click="handleCheckAll" :disabled="loading">
        <i :class="loading ? 'fas fa-spinner fa-spin' : 'fas fa-search'"></i>
        <span>综合检查</span>
      </el-button>
      <el-button type="info" @click="getStatistics" :disabled="loading">
        <i class="fas fa-chart-bar"></i>
        <span>数据统计</span>
      </el-button>
    </div>

    <!-- 快捷检查卡片 -->
    <div class="check-cards">
      <div
        v-for="item in checkItems"
        :key="item.key"
        class="check-card"
        :class="{ 'has-duplicates': item.duplicateCount > 0 }"
        @click="handleViewItem(item.key)"
      >
        <div class="card-icon">
          <i :class="item.icon"></i>
        </div>
        <div class="card-content">
          <h3>{{ item.label }}</h3>
          <div class="card-stats">
            <span class="stat-item">总数: {{ item.total }}</span>
            <span v-if="item.duplicateCount > 0" class="stat-item duplicate">
              重复: {{ item.duplicateCount }} 组
            </span>
            <span v-else class="stat-item ok">
              <i class="fas fa-check-circle"></i> 无重复
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 所有数据列表视图 -->
    <div v-if="viewMode === 'all'" class="all-data-section">
      <!-- 空数据提示 -->
      <div v-if="allDataList.length === 0" class="empty-data-section">
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <h3>{{ currentCheck?.label }} - 暂无数据</h3>
          <p>该数据表当前没有数据，请先添加数据后再查看</p>
          <el-button type="primary" @click="closeAllDataView">
            <i class="fas fa-arrow-left"></i>
            返回
          </el-button>
        </div>
      </div>

      <!-- 数据表格 -->
      <div v-else>
      <div class="section-header">
        <h2>
          <i class="fas fa-list"></i>
          {{ currentCheck?.label }} - 所有数据
        </h2>
        <div class="section-actions">
          <div class="duplicate-summary">
            <span class="summary-item total">总数: {{ allDataList.length }}</span>
            <span v-if="duplicateCount > 0" class="summary-item duplicate">
              <i class="fas fa-exclamation-triangle"></i>
              重复: {{ duplicateCount }} 条
            </span>
            <span v-else class="summary-item ok">
              <i class="fas fa-check-circle"></i>
              无重复
            </span>
          </div>
          <el-button type="info" @click="closeAllDataView">
            <i class="fas fa-times"></i>
            关闭
          </el-button>
        </div>
      </div>

      <div class="data-table-container">
        <el-table
          :data="paginatedAllData"
          v-loading="loading"
          stripe
          border
          :row-class-name="getRowClassName"
        >
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="名称" min-width="150">
            <template #default="{ row }">
              <span v-if="row._isDuplicate" class="duplicate-badge">
                <i class="fas fa-exclamation-circle"></i>
                {{ getRowName(row) }}
              </span>
              <span v-else>{{ getRowName(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="phone" label="电话" width="130" v-if="['customers', 'suppliers'].includes(currentCheck?.key)" />
          <el-table-column prop="brand_name" label="品牌" width="120" v-if="currentCheck?.key === 'models'" />
          <el-table-column prop="customer_type" label="客户类型" width="100" v-if="currentCheck?.key === 'customers'" />
          <el-table-column prop="vip_level" label="VIP等级" width="100" v-if="currentCheck?.key === 'customers'" />
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
                {{ row.status === 1 ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="重复信息" width="120">
            <template #default="{ row }">
              <el-tag v-if="row._isDuplicate" type="danger" size="small">
                重复 ({{ row._duplicateCount }})
              </el-tag>
              <el-tag v-else type="success" size="small">唯一</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-wrapper">
          <Pagination
            v-model:current="allDataPagination.currentPage"
            v-model:page-size="allDataPagination.pageSize"
            :page-sizes="[20, 50, 100, 200]"
            :total="allDataList.length"
            :show-range="true"
            @change="handleAllDataPaginationChange"
          />
        </div>
      </div>
      </div>
    </div>

    <!-- 重复数据列表 -->
    <div v-if="viewMode === 'duplicates' && currentCheck && checkResult" class="duplicates-section">
      <div class="section-header">
        <h2>
          <i class="fas fa-exclamation-triangle"></i>
          {{ currentCheck.label }} - 重复数据
        </h2>
        <div class="section-actions">
          <el-button
            v-if="hasDuplicates"
            type="info"
            @click="handleSelectAll"
            :title="isAllSelected ? '取消全选' : '全选'"
          >
            <i :class="isAllSelected ? 'fas fa-check-square' : 'fas fa-square'"></i>
            <span>{{ isAllSelected ? '取消全选' : '全选' }}</span>
          </el-button>
          <el-button
            v-if="hasDuplicates"
            type="primary"
            @click="handleMergeSelected"
            :disabled="!hasSelectedDuplicates"
          >
            <i class="fas fa-compress-arrows-alt"></i>
            合并选中 ({{ selectedDuplicates.length }})
          </el-button>
          <el-button
            v-if="hasDuplicates"
            type="danger"
            @click="handleDeleteSelected"
            :disabled="!hasSelectedDuplicates"
          >
            <i class="fas fa-trash"></i>
            删除选中 ({{ selectedDuplicates.length }})
          </el-button>
          <el-button
            v-if="hasDuplicates && currentCheck?.key === 'customers'"
            type="danger"
            @click="handleCleanupAllDuplicates"
            :disabled="loading"
          >
            <i class="fas fa-broom"></i>
            一键清理所有重复行
          </el-button>
        </div>
      </div>

      <div v-if="!hasDuplicates" class="no-duplicates">
        <i class="fas fa-check-circle"></i>
        <p>没有发现重复数据</p>
      </div>

      <div v-else class="duplicates-list">
        <div
          v-for="(group, index) in currentPageDuplicates"
          :key="index"
          class="duplicate-group"
        >
          <div class="group-header">
            <div class="group-info">
              <span class="group-key">{{ group.key }}</span>
              <span class="group-count">{{ group.count }} 条记录</span>
            </div>
            <div class="group-actions">
              <el-button
                type="primary"
                size="small"
                @click="handleMergeGroup(group)"
                title="合并到第一条"
              >
                <i class="fas fa-compress-arrows-alt"></i>
                合并
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="handleDeleteGroup(group)"
                title="删除重复项"
              >
                <i class="fas fa-trash"></i>
                删除
              </el-button>
            </div>
          </div>

          <div class="group-items">
            <div
              v-for="(item, itemIndex) in [group.primary, ...group.duplicates]"
              :key="`${group.key}-${itemIndex}`"
              class="duplicate-item"
              :class="{
                'primary': itemIndex === 0,
                'duplicate': itemIndex > 0,
                'selected': isItemSelected(item, itemIndex, group)
              }"
            >
              <div class="item-select">
                <input
                  type="checkbox"
                  :id="`item-${group.key}-${itemIndex}`"
                  :value="`${group.key}-${itemIndex}`"
                  v-model="selectedDuplicates"
                  :disabled="itemIndex === 0"
                  :title="itemIndex === 0 ? '主记录不可选中' : ''"
                />
              </div>
              <div class="item-content">
                <div class="item-badge" v-if="itemIndex === 0">
                  <span class="badge badge-primary">主记录</span>
                </div>
                <div class="item-badge" v-else>
                  <span class="badge badge-duplicate">重复记录</span>
                </div>
                <div class="item-fields">
                  <div
                    v-for="(value, field) in getItemFields(item)"
                    :key="field"
                    class="item-field"
                  >
                    <label>{{ field }}:</label>
                    <span>{{ value }}</span>
                  </div>
                </div>
              </div>
              <div class="item-actions">
                <el-button
                  type="info"
                  size="small"
                  @click="handleEditItem(item)"
                  title="编辑"
                >
                  <i class="fas fa-edit"></i>
                </el-button>
                <el-button
                  v-if="itemIndex !== 0"
                  type="danger"
                  size="small"
                  @click="handleDeleteItem(item, itemIndex, group)"
                  title="删除"
                >
                  <i class="fas fa-trash"></i>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页组件 -->
      <div v-if="hasDuplicates && pagination.total > 0" class="pagination-wrapper">
        <Pagination
          v-model:current="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          :show-range="true"
          @change="handleDuplicatePaginationChange"
        />
      </div>
    </div>

    <!-- 编辑对话框 -->
    <MobileDialog
      v-model="showEditDialog"
      :title="'编辑' + (currentCheck?.label || '')"
      width="500px"
      dialog-class="data-check-edit-dialog"
      :show-default-footer="false"
    >
      <el-form :model="editForm" label-width="100px">
        <el-form-item
          v-for="(value, field) in editForm"
          :key="field"
          :label="String(field)"
        >
          <el-input v-model="editForm[field]" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span style="flex: 1">
          <el-button type="default" @click="showEditDialog = false">取消</el-button>
          <el-button type="primary" @click="handleSaveEdit">保存</el-button>
        </span>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { dataCheckApi } from '@/api/data-optimization'
import { extractResponseData } from '@/utils/api-response'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import Pagination from '@/components/Pagination.vue'

const { canView, canEdit, canDelete, handleNoPermission } = usePagePermissions('data-optimization')

const ensureViewPermission = () => {
  if (canView.value) {
    return true
  }
  handleNoPermission('view')
  return false
}

const ensureEditPermission = () => {
  if (canEdit.value) {
    return true
  }
  handleNoPermission('edit')
  return false
}

const ensureDeletePermission = () => {
  if (canDelete.value) {
    return true
  }
  handleNoPermission('delete')
  return false
}

// 检查项配置
const checkItems = reactive([
  { key: 'brands', label: '品牌', icon: 'fas fa-tags', total: 0, duplicateCount: 0 },
  { key: 'models', label: '型号', icon: 'fas fa-mobile-alt', total: 0, duplicateCount: 0 },
  { key: 'colors', label: '颜色', icon: 'fas fa-palette', total: 0, duplicateCount: 0 },
  { key: 'memories', label: '内存', icon: 'fas fa-memory', total: 0, duplicateCount: 0 },
  { key: 'suppliers', label: '供应商', icon: 'fas fa-truck', total: 0, duplicateCount: 0 },
  { key: 'stores', label: '店铺', icon: 'fas fa-store', total: 0, duplicateCount: 0 },
  { key: 'customers', label: '客户', icon: 'fas fa-users', total: 0, duplicateCount: 0 },
  { key: 'users', label: '员工', icon: 'fas fa-user-tie', total: 0, duplicateCount: 0 }
])

const { loading } = useLoadingState()
const currentCheck = ref<any>(null)
const checkResult = ref<any>(null)

// 视图模式: 'duplicates' (显示重复数据) 或 'all' (显示所有数据)
const viewMode = ref<'duplicates' | 'all'>('duplicates')

// 所有数据列表
const allDataList = ref<any[]>([])

// 所有数据分页
const allDataPagination = reactive({
  currentPage: 1,
  pageSize: 20
})

// 计算重复数据数量
const duplicateCount = computed(() => {
  return allDataList.value.filter(item => item._isDuplicate).length
})

// 当前页的所有数据
const paginatedAllData = computed(() => {
  const start = (allDataPagination.currentPage - 1) * allDataPagination.pageSize
  const end = start + allDataPagination.pageSize
  return allDataList.value.slice(start, end)
})

// 获取表格行类名（用于高亮重复数据）
const getRowClassName = ({ row }: { row: any }) => {
  return row._isDuplicate ? 'duplicate-row' : ''
}

// 获取行名称（根据不同数据类型使用不同字段）
const getRowName = (row: any) => {
  if (!row) return ''
  const currentKey = currentCheck.value?.key
  switch (currentKey) {
    case 'memories':
      return row.size || '-'
    case 'users':
      return row.username || row.name || '-'
    default:
      return row.name || row.username || '-'
  }
}
// 存储选中的记录的组合键 (格式: "组键-索引")
const selectedDuplicates = ref<string[]>([])
const showEditDialog = ref(false)
const editForm = reactive<any>({})

// 查看所有数据
const handleViewItem = async (key: string) => {
  if (!ensureViewPermission()) {
    return
  }

  loading.value = true
  currentCheck.value = checkItems.find(item => item.key === key)
  viewMode.value = 'all'

  try {
    const response = await dataCheckApi.getAllData(key)
    const responseData = extractResponseData<any>(response)

    // 检查是否为空数据
    if (responseData.isEmpty || responseData.total === 0) {
      const itemName = currentCheck.value?.label || '数据'
      ElMessage.info(`${itemName}表暂无数据，请先添加数据后再查看`)
      allDataList.value = []

      // 更新统计信息
      const item = checkItems.find(i => i.key === key)
      if (item) {
        item.total = 0
        item.duplicateCount = 0
      }

      // 重置分页
      allDataPagination.currentPage = 1
      return
    }

    allDataList.value = responseData.data || []

    // 更新统计信息
    const item = checkItems.find(i => i.key === key)
    if (item) {
      item.total = responseData.total
      item.duplicateCount = responseData.duplicateCount || 0
    }

    // 重置分页
    allDataPagination.currentPage = 1

    // 显示成功提示
    if (response.data.total > 0) {
      const duplicateInfo = response.data.duplicateCount > 0
        ? `，发现 ${response.data.duplicateCount} 条重复数据`
        : '，无重复数据'
      ElMessage.success(`获取数据成功：共 ${response.data.total} 条${duplicateInfo}`)
    }
  } catch (error: any) {
    logger.error('获取数据失败:', error)

    // 提供更友好的错误提示
    const itemName = currentCheck.value?.label || '数据'

    if (error.response?.status === 500) {
      ElMessage.error(`获取${itemName}失败：服务器内部错误，可能表不存在或数据库连接异常`)
    } else if (error.response?.status === 404) {
      ElMessage.error(`获取${itemName}失败：未找到相关数据`)
    } else {
      ElMessage.error(`获取${itemName}失败：${error.message || '未知错误'}`)
    }

    allDataList.value = []

    // 更新统计信息为空
    const item = checkItems.find(i => i.key === key)
    if (item) {
      item.total = 0
      item.duplicateCount = 0
    }
  } finally {
    loading.value = false
  }
}

// 关闭所有数据视图
const closeAllDataView = () => {
  viewMode.value = 'duplicates'
  allDataList.value = []
  currentCheck.value = null
}

// 所有数据分页大小改变
const handleAllDataSizeChange = (size: number) => {
  allDataPagination.pageSize = size
  allDataPagination.currentPage = 1
}

// 所有数据页码改变
const handleAllDataPageChange = (page: number) => {
  allDataPagination.currentPage = page
}

const handleAllDataPaginationChange = (page: number, pageSize: number) => {
  if (pageSize !== allDataPagination.pageSize) {
    handleAllDataSizeChange(pageSize)
    return
  }

  handleAllDataPageChange(page)
}
const editingItemId = ref<number | null>(null)

// 分页数据
const pagination = reactive({
  currentPage: 1,
  pageSize: 5,  // 每页显示5组，方便查看
  total: 0
})

// 计算属性
const hasDuplicates = computed(() => {
  if (!checkResult.value) return false
  return checkResult.value.duplicates?.length > 0
})

const duplicatesList = computed(() => {
  if (!checkResult.value) return []
  return checkResult.value.duplicates || []
})

// 当前页显示的重复组
const currentPageDuplicates = computed(() => {
  if (!duplicatesList.value.length) {
    return []
  }

  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  const pageData = duplicatesList.value.slice(start, end)

  return pageData
})

const hasSelectedDuplicates = computed(() => selectedDuplicates.value.length > 0)

// 计算是否全部选中（只检查当前页）
const isAllSelected = computed(() => {
  if (!checkResult.value || !currentPageDuplicates.value.length) return false

  // 获取当前页显示的所有重复记录的组合键
  const currentIds = getCurrentPageDuplicateIds()

  if (currentIds.length === 0) return false
  return currentIds.every(key => selectedDuplicates.value.includes(key))
})

// 方法
const handleCheckAll = async () => {
  if (!ensureViewPermission()) {
    return
  }

  loading.value = true
  try {
    const response = await dataCheckApi.checkAll()
    const details = response.data.details

    // 更新每个项目的统计数据
    checkItems.forEach(item => {
      const detail = details[item.key]
      if (detail) {
        item.total = detail.total
        item.duplicateCount = detail.duplicateGroups || 0
      }
    })

    // 设置当前选中的检查项（用于显示详情）
    currentCheck.value = checkItems[0]

    // 设置检查结果（显示第一个有重复数据的项）
    const firstItemWithDuplicates = checkItems.find(item => item.duplicateCount > 0)
    if (firstItemWithDuplicates) {
      currentCheck.value = firstItemWithDuplicates
      checkResult.value = details[firstItemWithDuplicates.key]
      pagination.total = firstItemWithDuplicates.duplicateCount
    } else {
      checkResult.value = null
    }

    ElMessage.success('综合检查完成')
  } catch (error: any) {
    ElMessage.error('检查失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const handleCheckItem = async (key: string) => {
  if (!ensureViewPermission()) {
    return
  }

  loading.value = true
  currentCheck.value = checkItems.find(item => item.key === key)
  viewMode.value = 'duplicates'
  try {
    const methodName = `check${key.charAt(0).toUpperCase() + key.slice(1)}`
    const response = await (dataCheckApi as any)[methodName]()

    if (!response || !response.data) {
      throw new Error('API响应格式错误')
    }

    checkResult.value = response.data

    const item = checkItems.find(i => i.key === key)
    if (item) {
      item.total = response.data.total
      item.duplicateCount = response.data.duplicateGroups || 0
    }

    // 重置分页
    pagination.currentPage = 1
    pagination.total = response.data.duplicateGroups || 0
  } catch (error: any) {
    logger.error('检查失败:', error)
    ElMessage.error('检查失败: ' + (error.message || '未知错误'))
    checkResult.value = null
  } finally {
    loading.value = false
  }
}

// 分页大小改变
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  // 切换页码时清空选中
  selectedDuplicates.value = []
}

// 页码改变
const handleCurrentChange = (page: number) => {
  pagination.currentPage = page
  // 切换页码时清空选中
  selectedDuplicates.value = []
}

const handleDuplicatePaginationChange = (page: number, pageSize: number) => {
  if (pageSize !== pagination.pageSize) {
    handleSizeChange(pageSize)
    return
  }

  handleCurrentChange(page)
}

const getStatistics = async () => {
  if (!ensureViewPermission()) {
    return
  }

  try {
    const response = await dataCheckApi.getStatistics()
    const stats = response.data

    checkItems.forEach(item => {
      // 统计 API 返回的是字符串，需要转换为数字
      item.total = parseInt(stats[item.key]) || 0
      // 重置重复数量，稍后用户点击卡片时会更新
      item.duplicateCount = 0
    })

    ElMessage.success('统计数据已更新')
  } catch (error: any) {
    ElMessage.error('获取统计失败: ' + (error.message || '未知错误'))
  }
}

const getItemFields = (item: any) => {
  const fields: any = {}
  const excludeFields = ['id', 'created_at', 'updated_at']

  Object.keys(item).forEach(key => {
    if (!excludeFields.includes(key) && item[key] !== null) {
      fields[key] = item[key]
    }
  })

  return fields
}

// 全选/取消全选（只处理当前页的数据）
const handleSelectAll = () => {
  // 获取当前页显示的所有重复记录的 ID（不包括主记录）
  const currentIds = getCurrentPageDuplicateIds()

  if (isAllSelected.value) {
    // 取消全选：清空所有选中
    selectedDuplicates.value = []
  } else {
    // 全选：只选中当前页的重复记录（不包括主记录）
    selectedDuplicates.value = [...currentIds]
  }
}

// 获取当前页显示的重复记录的组合键（不包括主记录）
const getCurrentPageDuplicateIds = () => {
  if (!duplicatesList.value.length) return []

  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  const currentGroups = duplicatesList.value.slice(start, end)

  const keys: string[] = []

  currentGroups.forEach((group: any) => {
    // 只添加重复记录的键（从索引1开始，跳过主记录索引0）
    if (Array.isArray(group.duplicates)) {
      group.duplicates.forEach((_: any, index: number) => {
        keys.push(`${group.key}-${index + 1}`)
      })
    }
  })

  return keys
}

// 检查某个记录是否被选中
const isItemSelected = (item: any, itemIndex: number, group: any) => {
  // 使用组合键来判断是否选中
  const selectKey = `${group.key}-${itemIndex}`
  return selectedDuplicates.value.includes(selectKey)
}

const handleMergeGroup = async (group: any) => {
  if (!ensureEditPermission()) {
    return
  }

  try {
    // 检查是否有重复记录
    if (!group.duplicates || group.duplicates.length === 0) {
      ElMessage.warning('该组没有重复记录需要合并')
      return
    }

    await ElMessageBox.confirm(
      `确定要将 ${group.duplicates.length} 条重复记录合并到主记录吗？`,
      '确认合并',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const duplicateIds = group.duplicates.map((d: any) => d.id)

    // 安全检查：确保主记录ID不在duplicateIds中
    if (duplicateIds.includes(group.primary.id)) {
      ElMessage.error('数据错误：主记录ID不能在待删除列表中')
      return
    }

    await dataCheckApi.mergeDuplicates({
      type: currentCheck.value.key,
      primaryId: group.primary.id,
      duplicateIds
    })

    ElMessage.success('合并成功')
    handleCheckItem(currentCheck.value.key)
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('合并失败: ' + (error.message || '未知错误'))
    }
  }
}

const handleDeleteGroup = async (group: any) => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    // 检查是否有可删除的记录
    const hasDuplicates = group.duplicates && group.duplicates.length > 0

    if (!hasDuplicates && !group.isDuplicateRows) {
      ElMessage.warning('该组没有重复记录可以删除')
      return
    }

    // 对于重复数据行，提示不同的消息
    const confirmMessage = group.isDuplicateRows
      ? `确定要删除 ${group.count - 1} 条重复数据行吗？（保留一条主记录）`
      : `确定要删除 ${group.duplicates.length} 条重复记录吗？`

    await ElMessageBox.confirm(
      confirmMessage,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 对于重复数据行，我们使用后端的清理功能
    if (group.isDuplicateRows) {
      const loading = ElLoading.service({
        lock: true,
        text: '正在清理重复数据行，请稍候...',
        background: 'rgba(0, 0, 0, 0.7)'
      })

      try {
        // 提取该组的ID（从key中解析，格式为 "ID:123"）
        const targetId = parseInt(group.key.replace('ID:', ''))

        const response = await dataCheckApi.cleanupData(currentCheck.value.key, [targetId])
        const result = response.data

        if (result && result.cleaned > 0) {
          ElMessage.success(result.message || `清理成功`)
          handleCheckItem(currentCheck.value.key)
        } else {
          ElMessage.info(result?.message || '该ID没有重复记录需要清理')
        }
      } catch (error: any) {
        ElMessage.error('清理失败: ' + (error.message || '未知错误'))
      } finally {
        loading.close()
      }
      return
    }

    // 对于重复客户记录，正常删除
    const duplicateIds = group.duplicates.map((d: any) => d.id)

    if (duplicateIds.length === 0) {
      ElMessage.warning('没有选择要删除的记录')
      return
    }

    await dataCheckApi.batchDeleteDuplicates({
      type: currentCheck.value.key,
      ids: duplicateIds
    })

    ElMessage.success('删除成功')
    selectedDuplicates.value = []
    handleCheckItem(currentCheck.value.key)
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + (error.message || '未知错误'))
    }
  }
}

const handleMergeSelected = async () => {
  if (!ensureEditPermission()) {
    return
  }

  if (selectedDuplicates.value.length === 0) {
    ElMessage.warning('请先选择要合并的记录')
    return
  }

  try {
    const selectedKeys = selectedDuplicates.value

    // 按组处理选中的记录
    const groupsToMerge: any[] = []

    for (const group of duplicatesList.value) {
      // 获取该组重复记录中被选中的记录
      const selectedDuplicatesInGroup: any[] = []

      if (Array.isArray(group.duplicates)) {
        group.duplicates.forEach((d: any, index: number) => {
          const key = `${group.key}-${index + 1}`
          if (selectedKeys.includes(key)) {
            selectedDuplicatesInGroup.push(d)
          }
        })
      }

      // 如果该组有选中的重复记录，则合并到主记录
      if (selectedDuplicatesInGroup.length > 0) {
        const duplicateIds = selectedDuplicatesInGroup.map((d: any) => d.id)
        const primaryRecord = group.primary

        groupsToMerge.push({
          primaryId: primaryRecord.id,
          duplicateIds,
          primaryName: primaryRecord.name || primaryRecord.username || primaryRecord.phone || `ID:${primaryRecord.id}`,
          count: duplicateIds.length
        })
      }
    }

    if (groupsToMerge.length === 0) {
      ElMessage.info('请选择要合并的重复记录')
      return
    }

    // 显示合并确认
    const totalToMerge = groupsToMerge.reduce((sum, g) => sum + g.count, 0)

    // 构建详细的确认信息
    let confirmMessage = `发现 ${groupsToMerge.length} 个重复组，共 ${totalToMerge} 条重复记录需要合并。\n\n`
    confirmMessage += '合并规则：\n'
    confirmMessage += '✓ 主记录（推荐保留的记录）将被保留\n'
    confirmMessage += '✓ 选中的重复记录将合并到主记录\n'
    confirmMessage += '✓ 关联的数据会自动更新到主记录\n\n'
    confirmMessage += groupsToMerge.map(g => `- 保留 "${g.primaryName}"，合并 ${g.count} 条记录`).join('\n')

    await ElMessageBox.confirm(
      confirmMessage,
      '确认批量合并',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false
      }
    )

    // 使用批量合并 API（优化版：一次请求处理所有组）
    const loading = ElLoading.service({
      lock: true,
      text: '正在批量合并，请稍候...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      // 准备批量合并的数据
      const mergeGroups = groupsToMerge.map(g => ({
        primaryId: g.primaryId,
        duplicateIds: g.duplicateIds
      }))

      await dataCheckApi.batchMergeMultipleGroups({
        type: currentCheck.value.key,
        mergeGroups
      })

      ElMessage.success(`成功合并 ${groupsToMerge.length} 个重复组，共 ${totalToMerge} 条记录`)
      selectedDuplicates.value = []
      handleCheckItem(currentCheck.value.key)
    } finally {
      loading.close()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('合并失败: ' + (error.message || '未知错误'))
    }
  }
}

const handleDeleteSelected = async () => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    const selectedKeys = selectedDuplicates.value

    if (selectedKeys.length === 0) {
      ElMessage.warning('请先选择要删除的记录')
      return
    }

    // 检查是否是重复数据行类型（duplicate_rows）
    const isDuplicateRowsType = duplicatesList.value.some((g: any) => g.field === 'duplicate_rows')

    if (isDuplicateRowsType) {
      // 对于重复数据行（同一个ID的多条记录），使用 cleanupData API
      const groupsToCleanup: any[] = []

      for (const group of duplicatesList.value) {
        if (group.isDuplicateRows && group.primary) {
          // 检查该组的哪些重复记录被选中了
          let selectedInGroup = 0
          for (let i = 1; i < group.duplicates.length + 1; i++) {
            const key = `${group.key}-${i}`
            if (selectedKeys.includes(key)) {
              selectedInGroup++
            }
          }

          if (selectedInGroup > 0) {
            groupsToCleanup.push({
              id: group.primary.id,
              deleteCount: selectedInGroup,
              totalCount: group.count
            })
          }
        }
      }

      if (groupsToCleanup.length === 0) {
        ElMessage.info('请选择要删除的重复记录')
        return
      }

      const totalToDelete = groupsToCleanup.reduce((sum, g) => sum + g.deleteCount, 0)

      await ElMessageBox.confirm(
        `确定要删除选中的 ${totalToDelete} 条重复数据行吗？\n\n将保留最早创建的主记录，只删除重复的行。`,
        '确认删除',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )

      const loading = ElLoading.service({
        lock: true,
        text: `正在删除 ${totalToDelete} 条重复数据行，请稍候...`,
        background: 'rgba(0, 0, 0, 0.7)'
      })

      try {
        const idsToCleanup = groupsToCleanup.map(g => g.id)
        const response = await dataCheckApi.cleanupData(currentCheck.value.key, idsToCleanup)
        const result = response.data

        if (result && result.cleaned > 0) {
          ElMessage.success(result.message || `清理成功，删除了 ${result.cleaned} 条重复记录`)
        } else {
          ElMessage.info(result?.message || '没有需要清理的重复数据')
        }

        selectedDuplicates.value = []
        handleCheckItem(currentCheck.value.key)
      } finally {
        loading.close()
      }
      return
    }

    // 常规重复数据（不同ID的客户）
    const deletableIds: number[] = []

    // 遍历所有组，找出选中的重复记录
    for (const group of duplicatesList.value) {
      if (Array.isArray(group.duplicates)) {
        // 检查该组的每个重复记录是否被选中
        group.duplicates.forEach((d: any, index: number) => {
          const key = `${group.key}-${index + 1}` // +1 因为索引0是主记录
          if (selectedKeys.includes(key)) {
            deletableIds.push(d.id)
          }
        })
      }
    }

    if (deletableIds.length === 0) {
      ElMessage.info('请选择要删除的重复记录（不能删除主记录）')
      return
    }

    await ElMessageBox.confirm(
      `确定要删除选中的 ${deletableIds.length} 条重复记录吗？（主记录已自动过滤，不会被删除）`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const loading = ElLoading.service({
      lock: true,
      text: `正在删除 ${deletableIds.length} 条记录，请稍候...`,
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      await dataCheckApi.batchDeleteDuplicates({
        type: currentCheck.value.key,
        ids: deletableIds
      })

      ElMessage.success('删除成功')
      selectedDuplicates.value = []
      handleCheckItem(currentCheck.value.key)
    } finally {
      loading.close()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + (error.message || '未知错误'))
    }
  }
}

// 一键清理所有重复行
const handleCleanupAllDuplicates = async () => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    await ElMessageBox.confirm(
      '此操作将自动清理所有客户的重复数据行（每个ID保留最早创建的记录，删除其余的）。此操作不可撤销，是否继续？',
      '确认清理所有重复行',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    loading.value = true
    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在清理重复数据，请稍候...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      const response = await dataCheckApi.cleanupData('customers')

      if (response.data && response.data.success !== false) {
        const result = response.data
        ElMessage.success(
          `清理完成！已清理 ${result.cleaned || 0} 条重复记录，剩余 ${result.remainingGroups || 0} 个重复组`
        )

        // 重新加载数据
        await handleCheckItem(currentCheck.value.key)
      } else {
        throw new Error(response.data?.message || '清理失败')
      }
    } finally {
      loadingInstance.close()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('清理失败: ' + (error.message || '未知错误'))
    }
  } finally {
    loading.value = false
  }
}

const handleEditItem = (item: any) => {
  if (!ensureEditPermission()) {
    return
  }

  editingItemId.value = item.id
  Object.assign(editForm, getItemFields(item))
  showEditDialog.value = true
}

const handleSaveEdit = async () => {
  if (!ensureEditPermission()) {
    return
  }

  try {
    await dataCheckApi.editData(
      currentCheck.value.key,
      editingItemId.value!,
      editForm
    )

    ElMessage.success('保存成功')
    showEditDialog.value = false
    handleCheckItem(currentCheck.value.key)
  } catch (error: any) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  }
}

const handleDeleteItem = async (item: any, itemIndex: number, group: any) => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    // 对于重复数据行类型，需要特殊处理
    if (group.isDuplicateRows) {
      await ElMessageBox.confirm(
        '确定要删除这条重复记录吗？',
        '确认删除',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )

      // 使用 cleanupData API 删除该ID的重复行
      const response = await dataCheckApi.cleanupData(currentCheck.value.key, [group.primary.id])
      const result = response.data

      if (result && result.cleaned > 0) {
        ElMessage.success(result.message || '删除成功')
      } else {
        ElMessage.info(result?.message || '没有需要删除的数据')
      }

      handleCheckItem(currentCheck.value.key)
      return
    }

    // 常规删除
    await ElMessageBox.confirm(
      '确定要删除这条记录吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await dataCheckApi.deleteData(currentCheck.value.key, item.id)
    ElMessage.success('删除成功')
    handleCheckItem(currentCheck.value.key)
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + (error.message || '未知错误'))
    }
  }
}

onMounted(() => {
  if (canView.value) {
    getStatistics()
  }
})
</script>

<style lang="scss" scoped>
.data-check-tab {
  .action-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }
}

.check-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;

  .check-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border: 2px solid transparent;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.has-duplicates {
      border-color: #f56c6c;
    }

    .card-icon {
      font-size: 32px;
      color: #409eff;
      margin-bottom: 12px;
    }

    .card-content {
      h3 {
        font-size: 18px;
        font-weight: 600;
        color: #303133;
        margin: 0 0 8px 0;
      }

      .card-stats {
        display: flex;
        gap: 16px;
        font-size: 14px;

        .stat-item {
          color: #909399;

          &.duplicate {
            color: #f56c6c;
            font-weight: 600;
          }

          &.ok {
            color: #67c23a;
          }
        }
      }
    }
  }
}

.duplicates-section {
  margin-top: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ebeef5;

    h2 {
      font-size: 20px;
      font-weight: 600;
      color: #303133;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        color: #e6a23c;
      }
    }

    .section-actions {
      display: flex;
      gap: 12px;
    }
  }

  .no-duplicates {
    text-align: center;
    padding: 60px 20px;
    color: #67c23a;
    background: white;
    border-radius: 8px;

    i {
      font-size: 64px;
      margin-bottom: 16px;
    }

    p {
      font-size: 16px;
      margin: 0;
    }
  }

  .duplicates-list {
    .duplicate-group {
      margin-bottom: 24px;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      overflow: hidden;
      background: white;

      .group-header {
        background: #f5f7fa;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #ebeef5;

        .group-info {
          .group-key {
            font-weight: 600;
            color: #303133;
            margin-right: 16px;
          }

          .group-count {
            font-size: 14px;
            color: #f56c6c;
          }
        }

        .group-actions {
          display: flex;
          gap: 8px;
        }
      }

      .group-items {
        .duplicate-item {
          display: flex;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #ebeef5;

          &:last-child {
            border-bottom: none;
          }

          // 主记录样式：蓝色背景
          &.primary {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
          }

          // 重复记录样式：浅红色背景
          &.duplicate {
            background: #ffebee;
            border-left: 4px solid #f44336;
          }

          &.selected {
            background: #fff3e0;
            border-left-width: 6px;
          }

          .item-select {
            margin-right: 12px;

            // 禁用复选框样式
            input[type="checkbox"]:disabled {
              cursor: not-allowed;
              opacity: 0.5;
              + * {
                cursor: not-allowed;
              }
            }
          }

          .item-content {
            flex: 1;

            .item-badge {
              margin-bottom: 8px;

              .badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;

                &.badge-primary {
                  background: #2196f3;
                  color: white;
                }

                &.badge-duplicate {
                  background: #f44336;
                  color: white;
                }
              }
            }

            .item-fields {
              display: flex;
              flex-wrap: wrap;
              gap: 16px;

              .item-field {
                label {
                  font-weight: 600;
                  color: #606266;
                  margin-right: 4px;
                }

                span {
                  color: #909399;
                }
              }
            }
          }

          .item-actions {
            display: flex;
            gap: 8px;
          }
        }
      }
    }
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background: white;
  border-radius: 8px;
  margin-top: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

// 所有数据视图样式
.all-data-section {
  margin-top: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;

  // 空数据状态
  .empty-data-section {
    background: white;
    border-radius: 8px;
    padding: 60px 20px;
    text-align: center;

    .empty-state {
      i {
        font-size: 80px;
        color: #dcdfe6;
        margin-bottom: 20px;
        display: block;
      }

      h3 {
        font-size: 20px;
        font-weight: 600;
        color: #303133;
        margin: 0 0 12px 0;
      }

      p {
        font-size: 14px;
        color: #909399;
        margin: 0 0 24px 0;
      }
    }
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ebeef5;

    h2 {
      font-size: 20px;
      font-weight: 600;
      color: #303133;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;

      i {
        color: #409eff;
      }
    }

    .section-actions {
      display: flex;
      align-items: center;
      gap: 16px;

      .duplicate-summary {
        display: flex;
        gap: 16px;
        font-size: 14px;

        .summary-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 4px;
          background: white;

          &.total {
            color: #606266;
            font-weight: 600;
          }

          &.duplicate {
            color: #f56c6c;
            background: #fee;

            i {
              color: #f56c6c;
            }
          }

          &.ok {
            color: #67c23a;
            background: #f0f9ff;

            i {
              color: #67c23a;
            }
          }
        }
      }
    }
  }

  .data-table-container {
    background: white;
    border-radius: 8px;
    padding: 16px;

    // 重复数据行高亮样式
    :deep(.el-table .duplicate-row) {
      background-color: #fff2f0 !important;

      &:hover > td {
        background-color: #ffebe6 !important;
      }
    }

    .duplicate-badge {
      color: #f56c6c;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;

      i {
        color: #f56c6c;
      }
    }
  }
}
</style>
