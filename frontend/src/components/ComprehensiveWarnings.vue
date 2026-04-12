<template>
  <div class="comprehensive-warnings">
    <!-- 预警概览卡片 -->
    <div class="warnings-overview">
      <div class="overview-card" @click="showWarningDetail('phones')" :class="{ active: activeTab === 'phones' }">
        <div class="card-icon phone">
          <i class="fas fa-mobile-alt"></i>
        </div>
        <div class="card-content">
          <div class="card-value">{{ warningsData.phones?.count || 0 }}</div>
          <div class="card-label">手机预警</div>
        </div>
      </div>

      <div class="overview-card" @click="showWarningDetail('accessories')" :class="{ active: activeTab === 'accessories' }">
        <div class="card-icon accessory">
          <i class="fas fa-cube"></i>
        </div>
        <div class="card-content">
          <div class="card-value">{{ warningsData.accessories?.count || 0 }}</div>
          <div class="card-label">配件预警</div>
        </div>
      </div>

      <div class="overview-card" @click="showWarningDetail('sales')" :class="{ active: activeTab === 'sales' }">
        <div class="card-icon sales">
          <i class="fas fa-chart-line"></i>
        </div>
        <div class="card-content">
          <div class="card-value">{{ salesStatus }}</div>
          <div class="card-label">销售预警</div>
        </div>
      </div>

      <div class="overview-card" @click="showWarningDetail('purchases')" :class="{ active: activeTab === 'purchases' }">
        <div class="card-icon purchase">
          <i class="fas fa-truck"></i>
        </div>
        <div class="card-content">
          <div class="card-value">{{ warningsData.purchases?.noRecent?.length || 0 }}</div>
          <div class="card-label">待入库</div>
        </div>
      </div>
    </div>

    <!-- 预警详情 -->
    <div class="warning-detail">
      <!-- 手机库存预警 -->
      <div v-show="activeTab === 'phones'" class="detail-section">
        <div class="section-header">
          <h4>
            <i class="fas fa-mobile-alt"></i>
            手机库存预警详情
          </h4>
          <div class="header-actions">
            <el-tag size="small" type="info">自定义阈值</el-tag>
            <el-button type="primary" link size="small" @click="goToWarningConfig">
              <i class="fas fa-cog"></i>
              配置预警
            </el-button>
          </div>
        </div>

        <el-table :data="phoneWarnings" stripe max-height="400">
          <el-table-column prop="brand_name" label="品牌" min-width="80" />
          <el-table-column prop="model_name" label="型号" min-width="120" />
          <el-table-column prop="color_name" label="颜色" min-width="80" />
          <el-table-column prop="memory_name" label="内存" min-width="80" />
          <el-table-column prop="warning_threshold" label="预警阈值" min-width="80" align="center">
            <template #default="{ row }">
              <span class="warning-threshold-text">{{ row.warning_threshold || 3 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="stock_count" label="库存" min-width="70" align="center">
            <template #default="{ row }">
              <span
                v-if="getStockDisplayText(row.stock_count, row.warning_threshold) === '缺货'"
                class="out-of-stock-text"
              >
                缺货
              </span>
              <el-tag v-else :type="getStockTagType(row.stock_count, row.warning_threshold)" size="small">
                {{ getStockDisplayText(row.stock_count, row.warning_threshold) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="new_count" label="全新" min-width="60" align="center" />
          <el-table-column prop="used_count" label="二手" min-width="60" align="center" />
          <el-table-column label="操作" min-width="80" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="viewPhoneDetail(row)">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!phoneWarnings.length" description="暂无手机库存预警" />
      </div>

      <!-- 配件库存预警 -->
      <div v-show="activeTab === 'accessories'" class="detail-section">
        <div class="section-header">
          <h4>
            <i class="fas fa-cube"></i>
            配件库存预警详情
          </h4>
        </div>

        <el-table :data="warningsData.accessories?.warnings || []" stripe max-height="400">
          <el-table-column prop="name" label="配件名称" />
          <el-table-column prop="stock" label="当前库存" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getStockTagType(row.stock)" size="small">
                {{ row.stock }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="min_stock" label="最低库存" width="100" align="center" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === '已缺货' ? 'danger' : 'warning'" size="small">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="goToAccessories">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!warningsData.accessories?.warnings?.length" description="暂无配件库存预警" />
      </div>

      <!-- 销售预警 -->
      <div v-show="activeTab === 'sales'" class="detail-section">
        <div class="section-header">
          <h4>
            <i class="fas fa-chart-line"></i>
            销售预警分析
          </h4>
        </div>

        <div class="sales-summary">
          <div class="summary-item">
            <span class="label">今日销售</span>
            <span class="value">{{ warningsData.sales?.today?.sales_count || 0 }} 台</span>
          </div>
          <div class="summary-item">
            <span class="label">今日金额</span>
            <span class="value">¥{{ formatNumber(warningsData.sales?.today?.total_amount || 0) }}</span>
          </div>
          <div class="summary-item">
            <span class="label">今日利润</span>
            <span class="value profit">¥{{ formatNumber(warningsData.sales?.today?.total_profit || 0) }}</span>
          </div>
          <div class="summary-item">
            <span class="label">销售人数</span>
            <span class="value">{{ warningsData.sales?.today?.operator_count || 0 }} 人</span>
          </div>
          <div class="summary-item">
            <span class="label">日均销售</span>
            <span class="value">{{ warningsData.sales?.avgDailySales || 0 }} 台</span>
          </div>
          <div class="summary-item">
            <span class="label">销售趋势</span>
            <span class="value" :class="{ below: warningsData.sales?.isBelowAverage }">
              <i :class="warningsData.sales?.isBelowAverage ? 'fas fa-arrow-down' : 'fas fa-arrow-up'"></i>
              {{ warningsData.sales?.isBelowAverage ? '低于平均' : '正常' }}
            </span>
          </div>
        </div>

        <!-- 销售趋势图表 -->
        <div class="sales-trend">
          <h5>近7天销售趋势</h5>
          <div class="trend-list">
            <div v-for="(item, index) in warningsData.sales?.trend || []" :key="index" class="trend-item">
              <span class="trend-date">{{ formatDate(item.sale_date) }}</span>
              <div class="trend-bar">
                <div class="bar-fill" :style="{ width: getTrendWidth(item.sales_count) + '%' }"></div>
              </div>
              <span class="trend-count">{{ item.sales_count }} 台</span>
              <span class="trend-amount">¥{{ formatNumber(item.total_amount) }}</span>
            </div>
          </div>
        </div>

        <!-- 销售提示 -->
        <div v-if="warningsData.sales?.today?.sales_count === 0" class="sales-alert">
          <el-alert
            title="今日暂无销售记录"
            type="info"
            :closable="false"
            show-icon
          >
            <template #default>
              今天还没有销售记录，加油！
            </template>
          </el-alert>
        </div>

        <div v-else-if="warningsData.sales?.isBelowAverage" class="sales-alert">
          <el-alert
            title="销售低于平均水平"
            type="warning"
            :closable="false"
            show-icon
          >
            <template #default>
              今日销售（{{ warningsData.sales?.today?.sales_count || 0 }} 台）低于 7 日平均水平（{{ warningsData.sales?.avgDailySales || 0 }} 台），建议加强推广
            </template>
          </el-alert>
        </div>

        <div v-else class="sales-alert">
          <el-alert
            title="销售状况良好"
            type="success"
            :closable="false"
            show-icon
          >
            <template #default>
              今日销售（{{ warningsData.sales?.today?.sales_count || 0 }} 台）达到或超过平均水平，继续保持！
            </template>
          </el-alert>
        </div>

        <el-empty v-if="!warningsData.sales?.trend?.length && !warningsData.sales?.today?.sales_count" description="暂无销售数据" />
      </div>

      <!-- 入库预警 -->
      <div v-show="activeTab === 'purchases'" class="detail-section">
        <div class="section-header">
          <h4>
            <i class="fas fa-truck"></i>
            入库预警详情
          </h4>
        </div>

        <div class="purchase-alert">
          <el-alert
            title="长期未入库供应商"
            type="warning"
            :closable="false"
            show-icon
          >
            <template #default>
              以下供应商超过 7 天未进货，建议及时联系补货
            </template>
          </el-alert>
        </div>

        <el-table :data="warningsData.purchases?.noRecent || []" stripe max-height="400">
          <el-table-column prop="supplier_name" label="供应商名称" />
          <el-table-column prop="last_purchase_date" label="最后入库日期" width="120">
            <template #default="{ row }">
              {{ row.last_purchase_date || '无记录' }}
            </template>
          </el-table-column>
          <el-table-column prop="days_since_purchase" label="未入库天数" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="getDaysTagType(row.days_since_purchase)" size="small">
                {{ row.days_since_purchase }} 天
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="goToSuppliers">
                查看
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!warningsData.purchases?.noRecent?.length" description="所有供应商入库正常" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { unifiedApi } from '@/utils/unified-api'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const activeTab = ref('phones')
const warningsData = ref<any>({
  phones: { warnings: [], count: 0, threshold: 3 },
  accessories: { warnings: [], count: 0 },
  sales: { today: {}, trend: [], avgDailySales: 0, isBelowAverage: false },
  purchases: { recent: [], noRecent: [] }
})

// 计算属性
const salesStatus = computed(() => {
  if (warningsData.value.sales?.isBelowAverage) {
    return '偏低'
  }
  return '正常'
})

const phoneWarnings = computed(() => {
  const phoneList = warningsData.value?.phones?.warnings
  if (Array.isArray(phoneList) && phoneList.length > 0) {
    return phoneList
  }

  const modelList = warningsData.value?.models?.warnings
  if (Array.isArray(modelList)) {
    return modelList
  }

  return []
})

// 获取预警数据
const fetchWarnings = async () => {
  loading.value = true
  try {
    const response = await unifiedApi.get('/dashboard/warnings/comprehensive', {
      params: { phoneThreshold: 3, limit: 20 }
    })

    if (response.success) {
      warningsData.value = {
        accessories: { warnings: [], count: 0 },
        sales: { today: {}, trend: [], avgDailySales: 0, isBelowAverage: false },
        purchases: { recent: [], noRecent: [] },
        ...response.data
      }
    }
  } catch (error) {
    // 获取预警数据失败，忽略
  } finally {
    loading.value = false
  }
}

// 切换预警详情
const showWarningDetail = (tab: string) => {
  activeTab.value = tab
}

// 获取库存标签类型（支持自定义阈值）
const getStockTagType = (stock: number, threshold?: number) => {
  const warningThreshold = threshold || 3
  if (stock === 0) return 'danger'
  if (stock < warningThreshold) return 'warning'
  return 'success'
}

const getStockDisplayText = (stock: number, threshold?: number) => {
  const warningThreshold = threshold || 3
  if (stock < warningThreshold) {
    return '缺货'
  }
  return String(stock)
}

// 获取天数标签类型
const getDaysTagType = (days: number) => {
  if (days >= 30) return 'danger'
  if (days >= 14) return 'warning'
  return 'info'
}

// 获取趋势宽度百分比
const getTrendWidth = (count: number) => {
  const maxCount = Math.max(
    ...(warningsData.value.sales?.trend?.map((t: any) => t.sales_count) || [1])
  )
  return maxCount > 0 ? (count / maxCount) * 100 : 0
}

// 格式化数字
const formatNumber = (num: number) => {
  return num.toLocaleString('zh-CN')
}

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// 查看手机详情
const viewPhoneDetail = (row: any) => {
  router.push({
    path: '/inventory',
    query: {
      brand: row.brand_name,
      model: row.model_name,
      color: row.color_name,
      memory: row.memory_name
    }
  })
}

// 跳转到配件页面
const goToAccessories = () => {
  router.push('/accessories')
}

// 跳转到供应商页面
const goToSuppliers = () => {
  router.push('/suppliers')
}

// 跳转到预警配置页面
const goToWarningConfig = () => {
  router.push('/system?tab=warning')
}

// 生命周期
onMounted(() => {
  fetchWarnings()

  // 每5分钟自动刷新
  setInterval(() => {
    fetchWarnings()
  }, 5 * 60 * 1000)
})
</script>

<style lang="scss" scoped>
.comprehensive-warnings {
  background: white;
  border-radius: 12px;
  overflow: hidden;

  .warnings-overview {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    .overview-card {
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      padding: 15px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 2px solid transparent;

      &:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: translateY(-2px);
      }

      &.active {
        border-color: rgba(255, 255, 255, 0.5);
        background: rgba(255, 255, 255, 0.25);
      }

      .card-icon {
        width: 45px;
        height: 45px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: white;

        &.phone {
          background: linear-gradient(135deg, #3498db, #2980b9);
        }

        &.accessory {
          background: linear-gradient(135deg, #e67e22, #d35400);
        }

        &.sales {
          background: linear-gradient(135deg, #2ecc71, #27ae60);
        }

        &.purchase {
          background: linear-gradient(135deg, #9b59b6, #8e44ad);
        }
      }

      .card-content {
        flex: 1;

        .card-value {
          font-size: 20px;
          font-weight: 700;
          color: white;
          line-height: 1.2;
        }

        .card-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
        }
      }
    }
  }

  .warning-detail {
    padding: 20px;

    .out-of-stock-text {
      color: #d92d20;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .warning-threshold-text {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      padding: 2px 10px;
      border-radius: 999px;
      background: #fff4e5;
      color: #b54708;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid #f7b267;
    }

    .detail-section {
      // 表格宽度自适应
      .el-table {
        width: 100%;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        flex-wrap: wrap;
        gap: 10px;

        h4 {
          margin: 0;
          font-size: 16px;
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 8px;

          i {
            color: #3498db;
          }
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
      }

      .sales-summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin-bottom: 20px;

        .summary-item {
          background: #f8f9fa;
          padding: 18px;
          border-radius: 10px;
          text-align: center;
          transition: all 0.2s ease;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .label {
            display: block;
            font-size: 12px;
            color: #7f8c8d;
            margin-bottom: 8px;
            font-weight: 500;
          }

          .value {
            font-size: 20px;
            font-weight: 700;
            color: #2c3e50;

            &.profit {
              color: #27ae60;
            }

            &.below {
              color: #e74c3c;
            }

            i {
              font-size: 14px;
              margin-right: 4px;
            }
          }
        }
      }

      .sales-trend {
        margin-top: 20px;

        h5 {
          font-size: 15px;
          color: #34495e;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid #ecf0f1;
        }

        .trend-list {
          display: flex;
          flex-direction: column;
          gap: 12px;

          .trend-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            background: #fff;
            border-radius: 8px;
            border: 1px solid #ecf0f1;
            transition: all 0.2s ease;

            &:hover {
              border-color: #3498db;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            }

            .trend-date {
              font-size: 12px;
              color: #7f8c8d;
              width: 55px;
              text-align: right;
              font-weight: 500;
            }

            .trend-bar {
              flex: 1;
              height: 28px;
              background: #ecf0f1;
              border-radius: 6px;
              overflow: hidden;
              position: relative;

              .bar-fill {
                height: 100%;
                background: linear-gradient(90deg, #3498db, #2980b9);
                border-radius: 6px;
                transition: width 0.5s ease;
                position: relative;

                &::after {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: linear-gradient(90deg, rgba(255,255,255,0.2), transparent);
                }
              }
            }

            .trend-count {
              font-size: 13px;
              color: #2c3e50;
              width: 50px;
              font-weight: 600;
            }

            .trend-amount {
              font-size: 11px;
              color: #7f8c8d;
              width: 70px;
            }
          }
        }
      }

      .sales-alert {
        margin-top: 20px;

        .el-alert {
          border-radius: 8px;
        }
      }

      .purchase-alert {
        margin-bottom: 15px;
      }
    }
  }
}

// PC端优化（宽度大于768px）
@media (min-width: 768px) {
  .comprehensive-warnings {
    .warning-detail {
      .detail-section {
        // 确保表格在PC端自适应宽度
        .el-table {
          width: 100%;

          // 表格列自适应
          .el-table__body-wrapper {
            overflow-x: auto;
          }

          // 当屏幕宽度较小时，允许水平滚动
          @media (max-width: 1200px) {
            .el-table__body-wrapper {
              overflow-x: auto;
            }
          }
        }

        // 手机库存预警表格优化
        &:has(.el-table) {
          overflow-x: auto;

          .el-table {
            min-width: 600px;

            @media (min-width: 1200px) {
              min-width: 100%;
            }
          }
        }
      }
    }
  }
}

// 响应式设计（移动端）
@media (max-width: 767px) {
  .comprehensive-warnings {
    .warnings-overview {
      grid-template-columns: repeat(2, 1fr);
      padding: 15px;
      gap: 10px;

      .overview-card {
        padding: 12px;

        .card-icon {
          width: 38px;
          height: 38px;
          font-size: 18px;
        }

        .card-content {
          .card-value {
            font-size: 18px;
          }

          .card-label {
            font-size: 11px;
          }
        }
      }
    }

    .warning-detail {
      padding: 15px;

      .detail-section {
        .sales-summary {
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;

          .summary-item {
            padding: 12px;

            .label {
              font-size: 11px;
            }

            .value {
              font-size: 16px;

              i {
                font-size: 12px;
              }
            }
          }
        }

        .trend-list {
          .trend-item {
            flex-wrap: wrap;
            padding: 8px;

            .trend-date {
              font-size: 11px;
              width: 45px;
            }

            .trend-bar {
              height: 22px;
            }

            .trend-count {
              font-size: 11px;
              width: 40px;
            }

            .trend-amount {
              font-size: 10px;
              width: 55px;
            }
          }
        }
      }
    }
  }
}
</style>
