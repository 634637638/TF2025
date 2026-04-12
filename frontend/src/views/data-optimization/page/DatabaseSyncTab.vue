<template>
  <div class="database-sync-tab">
    <!-- 一键本地到云端智能同步入口 -->
    <div v-if="!selectedConnectionId && connections.length > 0" class="smart-sync-banner">
      <el-card class="banner-card">
        <div class="banner-content">
          <div class="banner-info">
            <i class="fas fa-cloud-upload-alt"></i>
            <div>
              <h3>一键本地到云端智能同步</h3>
              <p>将本地最新数据智能导入到云端，自动创建关联数据</p>
            </div>
          </div>
          <el-button
            type="success"
            size="large"
            :loading="smartSyncLoading"
            @click="handleSmartSync"
          >
            <i class="fas fa-cloud-upload-alt"></i>
            开始导入到云端
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 步骤导航 -->
    <div class="step-navigation">
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="连接云端数据库" description="配置远程数据库连接" />
        <el-step title="选择数据表" description="选择源表与目标表" />
        <el-step title="字段映射" description="配置字段匹配关系" />
        <el-step title="预检查" description="检查数据差异" />
        <el-step title="同步数据" description="执行同步到云端" />
      </el-steps>
    </div>

    <!-- 步骤内容 -->
    <div class="step-content">
      <!-- 步骤1: 连接外部数据库 -->
      <div v-if="currentStep === 0" class="step-panel">
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <i class="fas fa-database"></i>
              <span>连接外部数据库</span>
            </div>
          </template>

          <!-- 已连接的数据库列表 -->
          <div v-if="connections.length > 0" class="connections-list">
            <h4>已连接的数据库</h4>
            <el-table :data="connections" border>
              <el-table-column prop="host" label="主机地址" />
              <el-table-column prop="port" label="端口" width="80" />
              <el-table-column prop="user" label="用户名" />
              <el-table-column prop="database" label="数据库" />
              <el-table-column prop="connectedAt" label="连接时间" width="180">
                <template #default="{ row }">
                  {{ formatDateTime(row.connectedAt) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button
                    size="small"
                    type="primary"
                    @click="selectConnection(row.id)"
                  >
                    选择
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    @click="handleCloseConnection(row.id)"
                  >
                    断开
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- 新建连接表单 -->
          <el-divider />
          <h4>新建数据库连接</h4>
          <el-form
            ref="connectionFormRef"
            :model="connectionForm"
            :rules="connectionRules"
            label-width="120px"
          >
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="主机地址" prop="host">
                  <el-input
                    v-model="connectionForm.host"
                    placeholder="例如: 192.168.1.100"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="端口" prop="port">
                  <el-input-number
                    v-model="connectionForm.port"
                    :min="1"
                    :max="65535"
                    placeholder="3306"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="用户名" prop="user">
                  <el-input
                    v-model="connectionForm.user"
                    placeholder="数据库用户名"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="密码" prop="password">
                  <el-input
                    v-model="connectionForm.password"
                    type="password"
                    placeholder="数据库密码"
                    show-password
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="数据库名" prop="database">
              <el-input
                v-model="connectionForm.database"
                placeholder="要连接的数据库名称"
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="connecting"
                @click="handleCreateConnection"
              >
                <i class="fas fa-plug"></i>
                连接数据库
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>

      <!-- 步骤2: 选择表 -->
      <div v-if="currentStep === 1" class="step-panel">
        <el-row :gutter="20">
          <!-- 外部数据库表 -->
          <el-col :span="12">
            <el-card class="config-card">
              <template #header>
                <div class="card-header">
                  <i class="fas fa-table"></i>
                  <span>外部数据库表</span>
                </div>
              </template>

              <el-input
                v-model="sourceTableSearch"
                placeholder="搜索表名..."
                prefix-icon="Search"
                clearable
                class="mb-4"
              />

              <el-table
                :data="filteredSourceTables"
                border
                height="400"
                highlight-current-row
                @current-change="handleSourceTableSelect"
              >
                <el-table-column prop="table" label="表名" />
                <el-table-column label="操作" width="80">
                  <template #default="{ row }">
                    <el-button
                      size="small"
                      type="primary"
                      @click="handleSourceTableSelect(row)"
                    >
                      选择
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>

          <!-- 本地数据库表 -->
          <el-col :span="12">
            <el-card class="config-card">
              <template #header>
                <div class="card-header">
                  <i class="fas fa-database"></i>
                  <span>本地数据库表</span>
                </div>
              </template>

              <el-input
                v-model="targetTableSearch"
                placeholder="搜索表名..."
                prefix-icon="Search"
                clearable
                class="mb-4"
              />

              <el-table
                :data="filteredTargetTables"
                border
                height="400"
                highlight-current-row
                @current-change="handleTargetTableSelect"
              >
                <el-table-column prop="table" label="表名" />
                <el-table-column label="操作" width="80">
                  <template #default="{ row }">
                    <el-button
                      size="small"
                      type="primary"
                      @click="handleTargetTableSelect(row)"
                    >
                      选择
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>
        </el-row>

        <!-- 已选择的表 -->
        <el-card v-if="selectedSourceTable || selectedTargetTable" class="selected-tables-card">
          <div class="selected-info">
            <div v-if="selectedSourceTable">
              <strong>源表:</strong> {{ selectedSourceTable }}
            </div>
            <div v-if="selectedTargetTable">
              <strong>目标表:</strong> {{ selectedTargetTable }}
            </div>
          </div>
        </el-card>
      </div>

      <!-- 步骤3: 字段映射 -->
      <div v-if="currentStep === 2" class="step-panel">
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <i class="fas fa-exchange-alt"></i>
              <span>字段映射配置</span>
              <el-button
                size="small"
                type="primary"
                :loading="suggesting"
                @click="handleSuggestMapping"
                class="ml-auto"
              >
                <i class="fas fa-magic"></i>
                智能匹配
              </el-button>
            </div>
          </template>

          <el-table :data="mappingList" border max-height="500">
            <el-table-column label="源字段" prop="sourceField" width="200" />
            <el-table-column label="源类型" prop="sourceType" width="120" />
            <el-table-column label="→" width="50" align="center" />
            <el-table-column label="目标字段" width="200">
              <template #default="{ row }">
                <el-select
                  v-model="row.targetField"
                  placeholder="选择目标字段"
                  filterable
                >
                  <el-option label="（忽略）" value="" />
                  <el-option
                    v-for="field in targetFields"
                    :key="field.field"
                    :label="field.field"
                    :value="field.field"
                  >
                    <span>{{ field.field }}</span>
                    <span class="text-secondary text-xs ml-2">
                      {{ field.type }}
                    </span>
                  </el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="目标类型" prop="targetType" width="120">
              <template #default="{ row }">
                {{ getTargetFieldType(row.targetField) }}
              </template>
            </el-table-column>
          </el-table>

          <el-divider />

          <!-- 同步选项 -->
          <h4>同步选项</h4>
          <el-form :model="syncOptions" label-width="120px">
            <el-form-item label="同步模式">
              <el-radio-group v-model="syncOptions.mode">
                <el-radio label="insert">只插入新数据</el-radio>
                <el-radio label="update">只更新已存在数据</el-radio>
                <el-radio label="upsert">存在则更新，不存在则插入（推荐）</el-radio>
                <el-radio label="replace">清空后重新导入</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="匹配字段">
              <el-select
                v-model="syncOptions.keyFields"
                multiple
                placeholder="选择用于匹配数据的字段"
                class="w-full"
              >
                <el-option
                  v-for="field in targetFields"
                  :key="field.field"
                  :label="field.field"
                  :value="field.field"
                />
              </el-select>
              <div class="text-secondary text-xs ml-2">
                系统将根据这些字段的值来判断数据是否已存在
              </div>
            </el-form-item>

            <el-form-item label="批量大小">
              <el-input-number
                v-model="syncOptions.batchSize"
                :min="1"
                :max="1000"
                :step="10"
              />
              <span style="margin-left: 10px; color: #909399; font-size: 12px">
                每批次处理的数据量
              </span>
            </el-form-item>
          </el-form>
        </el-card>
      </div>

      <!-- 步骤4: 预检查 -->
      <div v-if="currentStep === 3" class="step-panel">
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <i class="fas fa-search"></i>
              <span>数据预检查</span>
              <el-button
                size="small"
                type="primary"
                :loading="preChecking"
                @click="handlePreCheck"
                class="ml-auto"
              >
                <i class="fas fa-play"></i>
                开始检查
              </el-button>
            </div>
          </template>

          <div v-if="!preCheckResult" class="precheck-placeholder">
            <el-empty description="点击开始检查进行数据匹配分析" />
          </div>

          <div v-else class="precheck-result">
            <!-- 统计信息 -->
            <el-row :gutter="20" class="stats-row">
              <el-col :span="8">
                <el-statistic title="总数据量" :value="preCheckResult.total" />
              </el-col>
              <el-col :span="8">
                <el-statistic title="新数据" :value="preCheckResult.newRecords">
                  <template #suffix>
                    <span class="text-success">条</span>
                  </template>
                </el-statistic>
              </el-col>
              <el-col :span="8">
                <el-statistic title="需要更新" :value="preCheckResult.updateRecords">
                  <template #suffix>
                    <span class="text-warning">条</span>
                  </template>
                </el-statistic>
              </el-col>
            </el-row>

            <!-- 匹配示例 -->
            <el-divider />
            <h4>匹配示例（前10条）</h4>
            <el-table :data="preCheckResult.sampleMatches" border max-height="300">
              <el-table-column label="匹配键" prop="key" width="200" />
              <el-table-column label="源数据" width="300">
                <template #default="{ row }">
                  <pre>{{ JSON.stringify(row.source, null, 2) }}</pre>
                </template>
              </el-table-column>
              <el-table-column label="目标数据" width="300">
                <template #default="{ row }">
                  <pre>{{ JSON.stringify(row.target, null, 2) }}</pre>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </div>

      <!-- 步骤5: 同步数据 -->
      <div v-if="currentStep === 4" class="step-panel">
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <i class="fas fa-sync"></i>
              <span>数据同步</span>
            </div>
          </template>

          <!-- 同步配置摘要 -->
          <el-descriptions :column="2" border>
            <el-descriptions-item label="源表">
              {{ selectedSourceTable }}
            </el-descriptions-item>
            <el-descriptions-item label="目标表">
              {{ selectedTargetTable }}
            </el-descriptions-item>
            <el-descriptions-item label="同步模式">
              {{ syncModeText }}
            </el-descriptions-item>
            <el-descriptions-item label="匹配字段">
              {{ syncOptions.keyFields.join(', ') || '无' }}
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <!-- 执行同步 -->
          <div class="sync-actions">
            <el-button
              type="primary"
              size="large"
              :loading="syncing"
              :disabled="synced"
              @click="handleExecuteSync"
            >
              <i class="fas fa-play"></i>
              {{ synced ? '同步已完成' : '开始同步' }}
            </el-button>

            <el-button
              v-if="synced"
              size="large"
              @click="handleReset"
            >
              <i class="fas fa-redo"></i>
              重新同步
            </el-button>
          </div>

          <!-- 同步进度 -->
          <div v-if="syncing || synced" class="sync-progress">
            <el-progress
              :percentage="syncProgress"
              :status="syncStatus"
            >
              <span>{{ syncMessage }}</span>
            </el-progress>

            <!-- 同步统计 -->
            <div v-if="syncStats" class="sync-stats">
              <el-row :gutter="20">
                <el-col :span="6">
                  <el-statistic title="已插入" :value="syncStats.inserted">
                    <template #suffix>
                      <span class="text-success">条</span>
                    </template>
                  </el-statistic>
                </el-col>
                <el-col :span="6">
                  <el-statistic title="已更新" :value="syncStats.updated">
                    <template #suffix>
                      <span class="text-warning">条</span>
                    </template>
                  </el-statistic>
                </el-col>
                <el-col :span="6">
                  <el-statistic title="已跳过" :value="syncStats.skipped">
                    <template #suffix>
                      <span class="text-secondary">条</span>
                    </template>
                  </el-statistic>
                </el-col>
                <el-col :span="6">
                  <el-statistic title="失败" :value="syncStats.failed">
                    <template #suffix>
                      <span class="text-danger">条</span>
                    </template>
                  </el-statistic>
                </el-col>
              </el-row>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 步骤导航按钮 -->
    <div class="step-actions">
      <el-button
        v-if="currentStep > 0"
        @click="handlePrevStep"
      >
        <i class="fas fa-arrow-left"></i>
        上一步
      </el-button>

      <el-button
        v-if="currentStep < 4"
        type="primary"
        :disabled="!canGoNext"
        @click="handleNextStep"
      >
        下一步
        <i class="fas fa-arrow-right"></i>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { ValidationRules } from '@/composables'

const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('data-optimization')

const ensureViewPermission = () => {
  if (canView.value) {
    return true
  }
  handleNoPermission('view')
  return false
}

const ensureCreatePermission = () => {
  if (canCreate.value) {
    return true
  }
  handleNoPermission('create')
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

// ==================== 响应式数据 ====================

// 步骤和状态
const currentStep = ref(0)
const connecting = ref(false)
const suggesting = ref(false)
const preChecking = ref(false)
const syncing = ref(false)
const smartSyncLoading = ref(false)
const synced = ref(false)
const syncProgress = ref(0)
const syncMessage = ref('')
const syncStatus = ref<'success' | 'exception' | undefined>(undefined)
const syncStats = ref<any>(null)
const syncTimer = ref<number | null>(null)

// 连接表单
const connectionFormRef = ref()
const connectionForm = ref({
  host: '',
  port: 3306,
  user: '',
  password: '',
  database: ''
})

const connectionRules = {
  host: [ValidationRules.required('请输入主机地址')],
  user: [ValidationRules.required('请输入用户名')],
  password: [ValidationRules.required('请输入密码')],
  database: [ValidationRules.required('请输入数据库名')]
}

// 连接列表
const connections = ref<any[]>([])
const selectedConnectionId = ref('')

// 表数据
const sourceTables = ref<string[]>([])
const targetTables = ref<string[]>([])
const sourceTableSearch = ref('')
const targetTableSearch = ref('')
const selectedSourceTable = ref('')
const selectedTargetTable = ref('')

// 表结构
const sourceStructure = ref<any>(null)
const targetStructure = ref<any>(null)

// 字段映射
const mappingList = ref<any[]>([])
const syncOptions = ref({
  mode: 'upsert',
  keyFields: [] as string[],
  batchSize: 100
})

// 预检查结果
const preCheckResult = ref<any>(null)

// 当前映射配置ID
const currentMappingId = ref('')

// 计算属性
const filteredSourceTables = computed(() => {
  if (!sourceTableSearch.value) return sourceTables.value.map(t => ({ table: t }))
  const search = sourceTableSearch.value.toLowerCase()
  return sourceTables.value
    .filter(t => t.toLowerCase().includes(search))
    .map(t => ({ table: t }))
})

const filteredTargetTables = computed(() => {
  if (!targetTableSearch.value) return targetTables.value.map(t => ({ table: t }))
  const search = targetTableSearch.value.toLowerCase()
  return targetTables.value
    .filter(t => t.toLowerCase().includes(search))
    .map(t => ({ table: t }))
})

const sourceFields = computed(() => sourceStructure.value?.columns || [])
const targetFields = computed(() => targetStructure.value?.columns || [])

const canGoNext = computed(() => {
  switch (currentStep.value) {
    case 0:
      return !!selectedConnectionId.value
    case 1:
      return !!selectedSourceTable.value && !!selectedTargetTable.value
    case 2:
      return mappingList.value.some(m => m.targetField)
    case 3:
      return !!preCheckResult.value
    default:
      return true
  }
})

const syncModeText = computed(() => {
  const modeMap: Record<string, string> = {
    insert: '只插入新数据',
    update: '只更新已存在数据',
    upsert: '存在则更新，不存在则插入',
    replace: '清空后重新导入'
  }
  return modeMap[syncOptions.value.mode] || syncOptions.value.mode
})

// 方法
const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('zh-CN')
}

const handleCreateConnection = async () => {
  if (!ensureCreatePermission()) {
    return
  }

  const valid = await connectionFormRef.value?.validate()
  if (!valid) return

  connecting.value = true
  try {
    const res = await unifiedApi.post('/database-sync/connections', connectionForm.value)
    if (res.success) {
      ElMessage.success('数据库连接成功')
      await loadConnections()
      // 清空表单
      connectionForm.value = {
        host: '',
        port: 3306,
        user: '',
        password: '',
        database: ''
      }
    } else {
      ElMessage.error(res.message || '连接失败')
    }
  } catch (error) {
    ElMessage.error((error as Error).message || '连接失败')
  } finally {
    connecting.value = false
  }
}

const loadConnections = async () => {
  if (!canView.value) {
    connections.value = []
    return
  }

  try {
    const res = await unifiedApi.get('/database-sync/connections')
    if (res.success) {
      connections.value = res.data?.connections || []
    }
  } catch (error) {
    logger.error('加载连接列表失败:', error)
  }
}

const selectConnection = async (connectionId: string) => {
  if (!ensureViewPermission()) {
    return
  }

  selectedConnectionId.value = connectionId
  // 加载表列表
  await loadTables()
}

const handleCloseConnection = async (connectionId: string) => {
  if (!ensureDeletePermission()) {
    return
  }

  try {
    await ElMessageBox.confirm('确定要断开此连接吗？', '确认', {
      type: 'warning'
    })
    const res = await unifiedApi.delete(`/database-sync/connections/${connectionId}`)
    if (res.success) {
      ElMessage.success('连接已断开')
      await loadConnections()
      if (selectedConnectionId.value === connectionId) {
        selectedConnectionId.value = ''
      }
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error((error as Error).message || '断开连接失败')
    }
  }
}

const loadTables = async () => {
  if (!canView.value) {
    sourceTables.value = []
    targetTables.value = []
    return
  }

  if (!selectedConnectionId.value) return

  try {
    // 加载外部表
    const extRes = await unifiedApi.get(`/database-sync/connections/${selectedConnectionId.value}/tables`)
    if (extRes.success) {
      sourceTables.value = extRes.data.tables || []
    }

    // 加载本地表
    const localRes = await unifiedApi.get('/database-sync/local/tables')
    if (localRes.success) {
      targetTables.value = localRes.data.tables || []
    }
  } catch (error) {
    ElMessage.error('加载表列表失败')
  }
}

const handleSourceTableSelect = async (row?: any) => {
  if (!ensureViewPermission()) {
    return
  }

  if (!row) return
  selectedSourceTable.value = row.table
  await loadSourceStructure(row.table)
}

const handleTargetTableSelect = async (row?: any) => {
  if (!ensureViewPermission()) {
    return
  }

  if (!row) return
  selectedTargetTable.value = row.table
  await loadTargetStructure(row.table)
}

const loadSourceStructure = async (tableName: string) => {
  if (!canView.value) {
    sourceStructure.value = null
    return
  }

  try {
    const res = await unifiedApi.get(
      `/database-sync/connections/${selectedConnectionId.value}/tables/${tableName}/structure`
    )
    if (res.success) {
      sourceStructure.value = res.data
      if (targetStructure.value) {
        initMappingList()
      }
    }
  } catch (error) {
    ElMessage.error('加载表结构失败')
  }
}

const loadTargetStructure = async (tableName: string) => {
  if (!canView.value) {
    targetStructure.value = null
    return
  }

  try {
    const res = await unifiedApi.get(`/database-sync/local/tables/${tableName}/structure`)
    if (res.success) {
      targetStructure.value = res.data
      if (sourceStructure.value) {
        initMappingList()
      }
    }
  } catch (error) {
    ElMessage.error('加载表结构失败')
  }
}

const clearSyncTimer = () => {
  if (syncTimer.value !== null) {
    window.clearInterval(syncTimer.value)
    syncTimer.value = null
  }
}

const resetSyncState = () => {
  clearSyncTimer()
  syncing.value = false
  synced.value = false
  syncProgress.value = 0
  syncMessage.value = ''
  syncStatus.value = undefined
  syncStats.value = null
}

const initMappingList = () => {
  mappingList.value = sourceFields.value.map((field: any) => ({
    sourceField: field.field,
    sourceType: field.type,
    targetField: '',
    targetType: ''
  }))
}

const handleSuggestMapping = async () => {
  if (!ensureEditPermission()) {
    return
  }

  suggesting.value = true
  try {
    const res = await unifiedApi.get('/database-sync/suggest-mapping', {
      params: {
        connectionId: selectedConnectionId.value,
        sourceTable: selectedSourceTable.value,
        targetTable: selectedTargetTable.value
      }
    })

    if (res.success) {
      // 应用建议的映射
      const suggestions = res.data.suggestions || {}
      mappingList.value.forEach((item: any) => {
        item.targetField = suggestions[item.sourceField] || ''
      })
      ElMessage.success('智能匹配完成')
    }
  } catch (error) {
    ElMessage.error('智能匹配失败')
  } finally {
    suggesting.value = false
  }
}

const getTargetFieldType = (field: string) => {
  const f = targetFields.value.find((t: any) => t.field === field)
  return f?.type || ''
}

const handlePreCheck = async () => {
  if (!ensureEditPermission()) {
    return
  }

  try {
    await saveMappingConfig()
  } catch (error) {
    ElMessage.error((error as Error).message || '保存映射配置失败')
    return
  }

  preChecking.value = true
  try {
    const res = await unifiedApi.post('/database-sync/precheck', {
      connectionId: selectedConnectionId.value,
      configId: currentMappingId.value
    })

    if (res.success) {
      preCheckResult.value = res.data.analysis
      ElMessage.success('预检查完成')
    } else {
      ElMessage.error(res.message || '预检查失败')
    }
  } catch (error) {
    ElMessage.error((error as Error).message || '预检查失败')
  } finally {
    preChecking.value = false
  }
}

const saveMappingConfig = async () => {
  if (!canEdit.value) {
    return
  }

  const fieldMappings: Record<string, string> = {}
  mappingList.value.forEach((item: any) => {
    if (item.targetField) {
      fieldMappings[item.sourceField] = item.targetField
    }
  })

  currentMappingId.value = `map_${Date.now()}`

  await unifiedApi.post('/database-sync/mappings', {
    id: currentMappingId.value,
    sourceTable: selectedSourceTable.value,
    targetTable: selectedTargetTable.value,
    fieldMappings,
    syncOptions: syncOptions.value
  })
}

const handleExecuteSync = async () => {
  if (!ensureEditPermission()) {
    return
  }

  resetSyncState()
  syncing.value = true
  syncMessage.value = '正在准备同步...'

  try {
    const res = await unifiedApi.post('/database-sync/sync', {
      connectionId: selectedConnectionId.value,
      configId: currentMappingId.value
    })

    if (res.success) {
      const syncId = res.data.syncId
      // 轮询进度
      pollProgress(syncId)
    } else {
      ElMessage.error(res.message || '同步失败')
      syncing.value = false
    }
  } catch (error) {
    ElMessage.error((error as Error).message || '同步失败')
    syncing.value = false
  }
}

const pollProgress = (syncId: string) => {
  clearSyncTimer()

  syncTimer.value = window.setInterval(async () => {
    try {
      const res = await unifiedApi.get(`/database-sync/sync/${syncId}/progress`)
      if (!res.success || !res.data?.progress) {
        throw new Error(res.message || '获取同步进度失败')
      }

      const progress = res.data.progress

      syncProgress.value = progress.progress || 0
      syncMessage.value = progress.message || ''

      if (progress.status === 'completed') {
        clearSyncTimer()
        syncing.value = false
        synced.value = true
        syncStatus.value = 'success'
        syncStats.value = progress.stats || null
        ElMessage.success('同步完成！')
      } else if (progress.status === 'failed') {
        clearSyncTimer()
        syncing.value = false
        syncStatus.value = 'exception'
        syncMessage.value = progress.message || '同步失败'
        ElMessage.error(progress.message || '同步失败')
      }
    } catch (error) {
      clearSyncTimer()
      syncing.value = false
      syncStatus.value = 'exception'
      syncMessage.value = (error as Error).message || '获取进度失败'
      ElMessage.error((error as Error).message || '获取进度失败')
    }
  }, 1000)
}

const handleReset = () => {
  resetSyncState()
}

const handlePrevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const handleNextStep = () => {
  if (currentStep.value < 4) {
    currentStep.value++
  }
}

// 一键本地到云端智能同步
const handleSmartSync = async () => {
  if (!ensureEditPermission()) {
    return
  }

  if (connections.value.length === 0) {
    ElMessage.warning('请先连接云端数据库')
    return
  }

  const connectionId = connections.value[0].id

  smartSyncLoading.value = true
  try {
    await ElMessageBox.confirm(
      '本地到云端智能同步将：\n\n' +
      '✅ 自动导入本地所有数据到云端\n' +
      '✅ 本地已售商品会更新云端状态为已售\n' +
      '✅ 自动创建关联数据（客户、品牌、型号等）\n\n' +
      '• 此操作会修改云端数据库，是否继续？',
      '确认同步',
      {
        confirmButtonText: '开始同步',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    ElMessage.info('正在同步本地数据到云端，请稍候...')

    const res = await unifiedApi.post('/database-sync/local-to-cloud/sync', {
      connectionId,
      tables: ['phones', 'customers', 'sales', 'brands', 'models', 'colors', 'memories']
    })

    if (res.success) {
      ElMessage.success('同步完成！')

      // 显示详细结果
      const summary = res.data.summary
      const resultText = `✅ 同步完成！\n\n` +
        `📊 同步统计：\n` +
        `总处理: ${summary.total} 条\n` +
        `已更新: ${summary.updated} 条（云端已更新为本地状态）\n` +
        `新插入: ${summary.inserted} 条（云端新增）\n` +
        `跳过: ${summary.skipped} 条（云端已有相同数据）` +
        (summary.failed > 0 ? `失败: ${summary.failed} 条` : '') +
        (summary.relationsCreated > 0 ? `\n关联数据创建: ${summary.relationsCreated} 条` : '')

      await ElMessageBox.alert(resultText, '同步结果', {
        type: 'success'
      })

      // 刷新连接列表
      await loadConnections()
    } else {
      ElMessage.error(res.message || '同步失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error((error as Error).message || '同步失败')
    }
  } finally {
    smartSyncLoading.value = false
  }
}

// 生命周期
onMounted(() => {
  if (canView.value) {
    loadConnections()
  }
})

onBeforeUnmount(() => {
  clearSyncTimer()
})
</script>

<style lang="scss" scoped>
.database-sync-tab {
  .smart-sync-banner {
    margin-bottom: 30px;
    padding: 30px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
    color: white;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 300px;
      height: 300px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      pointer-events: none;
    }

    .banner-content {
      position: relative;
      z-index: 1;

      .banner-header {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 15px;

        .banner-icon {
          width: 50px;
          height: 50px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          backdrop-filter: blur(10px);
        }

        .banner-title {
          h3 {
            margin: 0;
          }

          p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
          }
        }
      }

      .banner-features {
        display: flex;
        gap: 30px;
        margin: 20px 0;
        flex-wrap: wrap;

        .feature-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;

          i {
            font-size: 16px;
            opacity: 0.8;
          }
        }
      }

      .banner-action {
        margin-top: 20px;

        .el-button {
          background: white;
          color: #667eea;
          border: none;
          padding: 12px 30px;
          font-size: 15px;
          font-weight: 600;
          transition: all 0.3s ease;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }

          &:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }

          i {
            margin-right: 6px;
          }
        }
      }
    }
  }

  .step-navigation {
    background: white;
    padding: 30px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .step-content {
    .step-panel {
      .config-card {
        margin-bottom: 20px;

        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;

          i {
            color: #409eff;
          }
        }
      }

      .connections-list {
        margin-bottom: 20px;

        h4 {
          margin: 0 0 15px 0;
          color: #303133;
        }
      }

      .selected-tables-card {
        margin-top: 20px;

        .selected-info {
          display: flex;
          gap: 30px;
          font-size: 14px;
        }
      }

      .precheck-placeholder {
        padding: 60px 0;
        text-align: center;
      }

      .precheck-result {
        .stats-row {
          margin-bottom: 20px;
        }

        pre {
          margin: 0;
          font-size: 12px;
          max-height: 200px;
          overflow: auto;
        }
      }

      .sync-actions {
        text-align: center;
        padding: 30px 0;
      }

      .sync-progress {
        margin-top: 30px;

        .sync-stats {
          margin-top: 30px;
          padding: 20px;
          background: #f5f7fa;
          border-radius: 8px;
        }
      }
    }
  }

  .step-actions {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-top: 20px;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    .el-button {
      margin: 0 10px;
    }
  }
}

/* 导出模式的横幅样式 */
.smart-sync-banner.export {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border: none;

  .banner-card {
    background: white;
    box-shadow: 0 4px 12px rgba(245, 87, 107, 0.15);
  }

  .banner-info {
    i {
      background: rgba(245, 87, 107, 0.1);
    }
  }
}

</style>
