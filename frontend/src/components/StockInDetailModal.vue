<!--
  入库详情模态框组件
  展示入库记录的详细信息，支持打印和导出
  集成全局权限、响应式设计等功能
-->
<template>
  <MobileDialog
    v-model="dialogVisible"
    :title="`入库详情 #${record?.id}`"
    :width="isMobile ? '95%' : '900px'"
    :force-fullscreen="isMobile"
    dialog-class="stock-in-detail-modal"
    :show-default-footer="false"
  >
    <div v-if="record" class="detail-content" :class="{ 'mobile': isMobile }">
      <!-- 基本信息 -->
      <div class="detail-section">
        <h3 class="section-title">
          <i class="fas fa-info-circle mr-2"></i>
          基本信息
        </h3>

        <el-descriptions :column="isMobile ? 1 : 2" border>
          <el-descriptions-item label="入库单号">
            <span class="record-id">#{{ record.id }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="商品类型">
            <el-tag :type="record.product_type === 'phone' ? 'primary' : 'success'">
              {{ record.product_type === 'phone' ? '手机' : '配件' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="操作类型">
            <el-tag :type="getOperationTypeTag(record.operation_type)">
              {{ getOperationTypeText(record.operation_type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="结算状态">
            <el-tag :type="record.is_settled ? 'success' : 'warning'">
              {{ record.is_settled ? '已结算' : '未结算' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="入库时间">
            {{ formatDateTime(record.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ record.updated_at ? formatDateTime(record.updated_at) : '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 商品信息 -->
      <div class="detail-section">
        <h3 class="section-title">
          <i class="fas fa-box mr-2"></i>
          商品信息
        </h3>

        <el-descriptions :column="isMobile ? 1 : 2" border>
          <el-descriptions-item label="商品名称">
            <span class="product-name">{{ record.product_name }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="品牌" v-if="record.brand_name">
            {{ record.brand_name }}
          </el-descriptions-item>
          <el-descriptions-item label="型号" v-if="record.model_name">
            {{ record.model_name }}
          </el-descriptions-item>
          <el-descriptions-item label="颜色" v-if="record.color_name">
            {{ record.color_name }}
          </el-descriptions-item>
          <el-descriptions-item label="内存" v-if="record.memory_name">
            {{ record.memory_name }}
          </el-descriptions-item>
          <el-descriptions-item label="IMEI号" v-if="record.imei">
            <span class="imei-text">{{ record.imei }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="序列号" v-if="record.serial_number">
            {{ record.serial_number }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 数量与价格 -->
      <div class="detail-section">
        <h3 class="section-title">
          <i class="fas fa-calculator mr-2"></i>
          数量与价格
        </h3>

        <div class="price-grid">
          <div class="price-item">
            <div class="price-label">入库数量</div>
            <div class="price-value quantity-value">{{ record.quantity }}</div>
          </div>
          <div class="price-item">
            <div class="price-label">单价</div>
            <div class="price-value">¥{{ formatCurrency(record.unit_cost) }}</div>
          </div>
          <div class="price-item">
            <div class="price-label">总价</div>
            <div class="price-value total-value">¥{{ formatCurrency(record.total_cost) }}</div>
          </div>
        </div>
      </div>

      <!-- 门店与供应商 -->
      <div class="detail-section">
        <h3 class="section-title">
          <i class="fas fa-store mr-2"></i>
          门店与供应商
        </h3>

        <el-descriptions :column="isMobile ? 1 : 2" border>
          <el-descriptions-item label="入库门店">
            {{ record.store_name }}
          </el-descriptions-item>
          <el-descriptions-item label="供应商" v-if="record.supplier_name">
            {{ record.supplier_name }}
          </el-descriptions-item>
          <el-descriptions-item label="操作人">
            {{ record.operator_name }}
          </el-descriptions-item>
          <el-descriptions-item label="参考单号" v-if="record.reference_id">
            {{ record.reference_id }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 备注信息 -->
      <div class="detail-section" v-if="record.reason || record.note">
        <h3 class="section-title">
          <i class="fas fa-comment-alt mr-2"></i>
          备注信息
        </h3>

        <el-descriptions :column="1" border>
          <el-descriptions-item label="入库原因" v-if="record.reason">
            {{ record.reason }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" v-if="record.note">
            <div class="note-content">{{ record.note }}</div>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 操作历史 -->
      <div class="detail-section" v-if="operationHistory.length > 0">
        <h3 class="section-title">
          <i class="fas fa-history mr-2"></i>
          操作历史
        </h3>

        <el-timeline>
          <el-timeline-item
            v-for="(item, index) in operationHistory"
            :key="index"
            :timestamp="formatDateTime(item.timestamp)"
            :type="getTimelineType(item.type)"
          >
            <div class="timeline-content">
              <div class="timeline-title">{{ item.title }}</div>
              <div class="timeline-description">{{ item.description }}</div>
              <div class="timeline-operator" v-if="item.operator">操作人: {{ item.operator }}</div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>

    <div v-else class="empty-content">
      <el-empty description="暂无数据" />
    </div>

    <template #footer>
      <div class="dialog-footer" :class="{ 'mobile': isMobile }">
        <el-button @click="handlePrint" :icon="Printer" :size="isMobile ? 'default' : 'large'">
          打印
        </el-button>
        <el-button @click="handleExport" :icon="Download" :size="isMobile ? 'default' : 'large'">
          导出
        </el-button>
        <el-button type="primary" @click="handleClose" :size="isMobile ? 'default' : 'large'">
          关闭
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Printer, Download } from '@element-plus/icons-vue'

// 导入全局Composables
import { useMobile } from '@/composables/mobile'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { useNotification } from '@/composables/useNotification'
import { useImportExport } from '@/composables/useImportExport'

// 导入工具函数
import { formatDateTime, formatCurrency } from '@/utils/format'

// 导入类型定义
import type { StockInRecord, OperationType } from '@/types/inventory'
import type { ModalProps, UpdateVisibleEmits } from '@/types/component'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'

// Props定义
interface Props extends ModalProps {
  record: StockInRecord | null
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  record: null
})

// Emits定义
const emit = defineEmits<UpdateVisibleEmits>()

// 使用全局Composables
const { isMobile } = useMobile()
const { handleError } = useErrorHandler()
const { showSuccess } = useNotification()
const { exportTextFile, buildDateFilename } = useImportExport()

// 响应式数据
const operationHistory = ref<Array<{
  type: 'primary' | 'success' | 'warning' | 'danger'
  title: string
  description: string
  operator?: string
  timestamp: string
}>>([])

// 计算属性
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 监听器
watch(
  () => props.record,
  (newRecord) => {
    if (newRecord) {
      loadOperationHistory(newRecord)
    }
  },
  { immediate: true }
)

// 方法定义
const loadOperationHistory = (record: StockInRecord) => {
  const history = []

  // 创建记录
  history.push({
    type: 'primary',
    title: '创建入库记录',
    description: `创建了 ${record.product_name} 的入库记录，数量 ${record.quantity}`,
    operator: record.operator_name,
    timestamp: record.created_at
  })

  // 如果有更新时间，添加更新记录
  if (record.updated_at && record.updated_at !== record.created_at) {
    history.push({
      type: 'success',
      title: '更新记录',
      description: '修改了入库记录信息',
      timestamp: record.updated_at
    })
  }

  // 如果已结算，添加结算记录
  if (record.is_settled) {
    history.push({
      type: 'success',
      title: '完成结算',
      description: '此入库记录已完成结算',
      timestamp: record.updated_at || record.created_at
    })
  }

  operationHistory.value = history.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

const getOperationTypeTag = (type: OperationType) => {
  const tagMap = {
    'in': 'success',
    'out': 'danger',
    'adjust': 'warning',
    'sale': 'info'
  }
  return tagMap[type] || 'info'
}

const getOperationTypeText = (type: OperationType) => {
  const textMap = {
    'in': '入库',
    'out': '出库',
    'adjust': '调整',
    'sale': '销售'
  }
  return textMap[type] || type
}

const getTimelineType = (type: string) => {
  const typeMap = {
    'primary': 'primary',
    'success': 'success',
    'warning': 'warning',
    'danger': 'danger'
  }
  return typeMap[type as keyof typeof typeMap] || 'primary'
}

const handlePrint = () => {
  if (!props.record) return

  try {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const printContent = generatePrintContent(props.record)
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.print()
      showSuccess('打印窗口已打开')
    }
  } catch (error) {
    handleError(error, 'handlePrint')
  }
}

const handleExport = async () => {
  if (!props.record) return

  try {
    const exportData = {
      ...props.record,
      export_time: TimeUtil.now().toISOString()
    }

    await exportTextFile({
      content: JSON.stringify(exportData, null, 2),
      filename: buildDateFilename(`入库记录_${props.record.id}`, 'json', TIME_FORMATS.DATE),
      mimeType: 'application/json;charset=utf-8;',
      successMessage: '导出成功',
      errorMessage: '导出失败'
    })
  } catch (error) {
    handleError(error, 'handleExport')
  }
}

const handleClose = () => {
  emit('update:visible', false)
}

const generatePrintContent = (record: StockInRecord) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>入库单 #${record.id}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            background: #fff;
            padding: 20px;
          }

          .print-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
          }

          .print-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
          }

          .print-subtitle {
            font-size: 16px;
            color: #666;
          }

          .section {
            margin-bottom: 25px;
          }

          .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #333;
            border-left: 4px solid #409eff;
            padding-left: 10px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 20px;
          }

          .info-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }

          .info-label {
            font-weight: 500;
            color: #666;
            min-width: 100px;
          }

          .info-value {
            color: #333;
            text-align: right;
          }

          .price-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 20px;
          }

          .price-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
          }

          .price-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
          }

          .price-value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
          }

          .price-value.total-value {
            color: #409eff;
            font-size: 20px;
          }

          .note-content {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #409eff;
            min-height: 50px;
          }

          .tag {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }

          .tag-primary {
            background: #ecf5ff;
            color: #409eff;
            border: 1px solid #b3d8ff;
          }

          .tag-success {
            background: #f0f9ff;
            color: #67c23a;
            border: 1px solid #c2e7b0;
          }

          .tag-warning {
            background: #fdf6ec;
            color: #e6a23c;
            border: 1px solid #f5dab1;
          }

          .print-footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 12px;
          }

          @media print {
            body {
              padding: 15px;
            }

            .print-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1 class="print-title">入库单</h1>
          <p class="print-subtitle">单号: #${record.id}</p>
        </div>

        <div class="section">
          <h3 class="section-title">基本信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">商品类型:</span>
              <span class="info-value">
                <span class="tag ${record.product_type === 'phone' ? 'tag-primary' : 'tag-success'}">
                  ${record.product_type === 'phone' ? '手机' : '配件'}
                </span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">操作类型:</span>
              <span class="info-value">${getOperationTypeText(record.operation_type)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">结算状态:</span>
              <span class="info-value">
                <span class="tag ${record.is_settled ? 'tag-success' : 'tag-warning'}">
                  ${record.is_settled ? '已结算' : '未结算'}
                </span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">入库时间:</span>
              <span class="info-value">${formatDateTime(record.created_at)}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">商品信息</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">商品名称:</span>
              <span class="info-value">${record.product_name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">品牌:</span>
              <span class="info-value">${record.brand_name || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">型号:</span>
              <span class="info-value">${record.model_name || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">颜色:</span>
              <span class="info-value">${record.color_name || '-'}</span>
            </div>
            ${record.imei ? `
            <div class="info-item">
              <span class="info-label">IMEI号:</span>
              <span class="info-value">${record.imei}</span>
            </div>
            ` : ''}
            ${record.serial_number ? `
            <div class="info-item">
              <span class="info-label">序列号:</span>
              <span class="info-value">${record.serial_number}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">数量与价格</h3>
          <div class="price-grid">
            <div class="price-item">
              <div class="price-label">入库数量</div>
              <div class="price-value quantity-value">${record.quantity}</div>
            </div>
            <div class="price-item">
              <div class="price-label">单价</div>
              <div class="price-value">¥${formatCurrency(record.unit_cost)}</div>
            </div>
            <div class="price-item">
              <div class="price-label">总价</div>
              <div class="price-value total-value">¥${formatCurrency(record.total_cost)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h3 class="section-title">门店与供应商</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">入库门店:</span>
              <span class="info-value">${record.store_name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">供应商:</span>
              <span class="info-value">${record.supplier_name || '-'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">操作人:</span>
              <span class="info-value">${record.operator_name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">参考单号:</span>
              <span class="info-value">${record.reference_id || '-'}</span>
            </div>
          </div>
        </div>

        ${record.reason || record.note ? `
        <div class="section">
          <h3 class="section-title">备注信息</h3>
          ${record.reason ? `
          <div class="info-item">
            <span class="info-label">入库原因:</span>
            <span class="info-value">${record.reason}</span>
          </div>
          ` : ''}
          ${record.note ? `
          <div class="note-content">
            ${record.note}
          </div>
          ` : ''}
        </div>
        ` : ''}

        <div class="print-footer">
          <p>打印时间: ${formatDateTime(TimeUtil.now().toISOString())}</p>
          <p>此单据由系统自动生成，无需签字</p>
        </div>
      </body>
    </html>
  `
}
</script>

<style scoped>
.detail-content {
  max-height: 70vh;
  overflow-y: auto;
}

.detail-content.mobile {
  max-height: 60vh;
}

.detail-section {
  margin-bottom: 24px;
  padding: 20px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
}

.record-id {
  font-weight: 600;
  color: var(--el-color-primary);
  font-family: monospace;
}

.product-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.imei-text {
  font-family: 'Courier New', monospace;
  background: var(--el-color-primary-light-9);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.price-item {
  text-align: center;
  padding: 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  transition: all 0.3s ease;
}

.price-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.price-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.price-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.quantity-value {
  color: var(--el-color-success);
}

.total-value {
  color: var(--el-color-primary);
  font-size: 24px;
}

.note-content {
  background: white;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid var(--el-color-primary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.timeline-content {
  line-height: 1.4;
}

.timeline-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.timeline-description {
  color: var(--el-text-color-regular);
  margin-bottom: 4px;
}

.timeline-operator {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-footer.mobile {
  justify-content: stretch;
}

.dialog-footer.mobile .el-button {
  flex: 1;
}

.empty-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .detail-section {
    padding: 16px;
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 14px;
    margin-bottom: 12px;
  }

  .price-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .price-item {
    padding: 16px;
  }

  .price-value {
    font-size: 18px;
  }

  .total-value {
    font-size: 20px;
  }
}

/* 滚动条样式 */
.detail-content::-webkit-scrollbar {
  width: 6px;
}

.detail-content::-webkit-scrollbar-track {
  background: var(--el-fill-color-lighter);
  border-radius: 3px;
}

.detail-content::-webkit-scrollbar-thumb {
  background: var(--el-border-color-darker);
  border-radius: 3px;
}

.detail-content::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

/* 打印样式 */
@media print {
  .detail-content {
    max-height: none;
    overflow: visible;
  }

  .dialog-footer {
    display: none;
  }
}
</style>
