<template>
  <div class="inventory-warnings">
    <!-- 预警头部 -->
    <div class="warnings-header">
      <h3>
        <i class="fas fa-exclamation-triangle"></i>
        库存预警
        <el-badge v-if="totalWarnings > 0" :value="totalWarnings" class="warning-badge" />
      </h3>
      <div class="header-actions">
        <el-button size="small" type="info" @click="refreshWarnings" :loading="loading">
          <i class="fas fa-sync-alt"></i>
          刷新
        </el-button>
        <el-button size="small" @click="goToInventory">
          <i class="fas fa-boxes"></i>
          查看库存
        </el-button>
      </div>
    </div>

    <!-- 无预警状态 -->
    <el-empty v-if="!loading && totalWarnings === 0" description="暂无库存预警" :image-size="80">

      <template #description>
        <p class="no-warning-text">当前库存状况良好</p>
      </template>
    </el-empty>

    <!-- 预警内容 -->
    <div v-else class="warnings-content">
      <!-- 手机库存预警 -->
      <div v-if="phoneWarnings.length > 0" class="warning-section phone-warning">
        <div class="section-header">
          <h4>
            <i class="fas fa-mobile-alt"></i>
            手机库存预警
          </h4>
          <el-tag type="danger" size="small">{{ phoneWarnings.length }} 项</el-tag>
        </div>
        <div class="warning-list">
          <div v-for="(item, index) in phoneWarnings" :key="index" class="warning-item">
            <div class="item-info">
              <div class="item-model">{{ item.brand_name }} {{ item.model_name }}</div>
              <div class="item-details">
                <span class="detail-item">{{ item.color_name }}</span>
                <span class="detail-item">{{ item.memory_name }}</span>
              </div>
            </div>
            <div class="item-stock" :class="getStockClass(item.stock_count)">
              <span class="stock-count">{{ item.stock_count }}</span>
              <span class="stock-label">台</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 配件库存预警 -->
      <div v-if="accessoryWarnings.length > 0" class="warning-section accessory-warning">
        <div class="section-header">
          <h4>
            <i class="fas fa-cube"></i>
            配件库存预警
          </h4>
          <el-tag type="warning" size="small">{{ accessoryWarnings.length }} 项</el-tag>
        </div>
        <div class="warning-list">
          <div v-for="(item, index) in accessoryWarnings" :key="index" class="warning-item">
            <div class="item-info">
              <div class="item-name">{{ item.name }}</div>
              <div class="item-min-stock">最低库存: {{ item.min_stock }}</div>
            </div>
            <div class="item-stock" :class="getStockClass(item.stock)">
              <span class="stock-count">{{ item.stock }}</span>
              <span class="stock-label">{{ item.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElNotification } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'

const router = useRouter()

// 响应式数据
const loading = ref(false)
const phoneWarnings = ref<any[]>([])
const accessoryWarnings = ref<any[]>([])
const salesWarnings = ref<any>(null)

// 计算属性
const totalWarnings = computed(() => {
  return phoneWarnings.value.length + accessoryWarnings.value.length
})

// 获取预警数据
const fetchWarnings = async () => {
  loading.value = true
  try {
    const response = await unifiedApi.get('/dashboard/warnings/comprehensive', {
      params: { phoneThreshold: 3, limit: 10 }
    })

    if (response.success) {
      const data = response.data
      phoneWarnings.value = data.phones?.warnings || []
      accessoryWarnings.value = data.accessories?.warnings || []
      salesWarnings.value = data.sales || null

      // 如果有预警，显示通知
      if (data.summary?.hasWarnings && data.summary?.totalWarnings > 0) {
        ElNotification.warning({
          title: '库存预警',
          message: `发现 ${data.summary.totalWarnings} 项库存预警，请及时处理`,
          duration: 5000,
          position: 'top-right'
        })
      }
    }
  } catch (error) {
    logger.error('获取预警数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 刷新预警
const refreshWarnings = () => {
  fetchWarnings()
  ElNotification.success({
    title: '刷新成功',
    message: '预警数据已更新',
    duration: 2000
  })
}

// 跳转到库存页面
const goToInventory = () => {
  router.push('/inventory')
}

// 获取库存状态样式
const getStockClass = (stock: number) => {
  if (stock === 0) return 'stock-out'
  if (stock <= 2) return 'stock-critical'
  return 'stock-low'
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
.inventory-warnings {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

  .warnings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #f0f0f0;

    h3 {
      margin: 0;
      font-size: 18px;
      color: #2c3e50;
      display: flex;
      align-items: center;
      gap: 10px;

      i {
        color: #f39c12;
      }
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }
  }

  .no-warning-text {
    color: #27ae60;
    font-size: 14px;
    margin-top: 10px;
  }

  .warnings-content {
    .warning-section {
      margin-bottom: 20px;

      &:last-child {
        margin-bottom: 0;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding: 10px 15px;
        background: #f8f9fa;
        border-radius: 8px;

        h4 {
          margin: 0;
          font-size: 15px;
          color: #34495e;
          display: flex;
          align-items: center;
          gap: 8px;

          i {
            &.fa-mobile-alt {
              color: #3498db;
            }

            &.fa-cube {
              color: #e67e22;
            }
          }
        }
      }

      .warning-list {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .warning-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 15px;
          background: #fff;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          transition: all 0.2s ease;

          &:hover {
            border-color: #bdc3c7;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }

          .item-info {
            flex: 1;

            .item-model,
            .item-name {
              font-size: 14px;
              font-weight: 500;
              color: #2c3e50;
              margin-bottom: 4px;
            }

            .item-details {
              display: flex;
              gap: 12px;
              font-size: 12px;
              color: #7f8c8d;

              .detail-item {
                display: flex;
                align-items: center;
                gap: 4px;

                &::before {
                  content: '';
                  width: 4px;
                  height: 4px;
                  border-radius: 50%;
                  background: #bdc3c7;
                }
              }
            }

            .item-min-stock {
              font-size: 12px;
              color: #95a5a6;
            }
          }

          .item-stock {
            display: flex;
            align-items: baseline;
            gap: 4px;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: 600;

            &.stock-out {
              background: #fee;
              color: #e74c3c;

              .stock-label {
                font-size: 11px;
                font-weight: normal;
              }
            }

            &.stock-critical {
              background: #fff3cd;
              color: #856404;

              .stock-label {
                font-size: 11px;
                font-weight: normal;
              }
            }

            &.stock-low {
              background: #e8f5e9;
              color: #2e7d32;

              .stock-label {
                font-size: 11px;
                font-weight: normal;
              }
            }

            .stock-count {
              font-size: 18px;
            }

            .stock-label {
              font-size: 11px;
            }
          }
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 767px) {
  .inventory-warnings {
    padding: 15px;

    .warnings-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;

      h3 {
        font-size: 16px;
      }

      .header-actions {
        width: 100%;

        .el-button {
          flex: 1;
        }
      }
    }

    .warnings-content {
      .warning-section {
        .section-header {
          padding: 8px 12px;

          h4 {
            font-size: 14px;
          }
        }

        .warning-list {
          .warning-item {
            padding: 10px 12px;

            .item-info {
              .item-model,
              .item-name {
                font-size: 13px;
              }

              .item-details {
                font-size: 11px;
                gap: 8px;
              }
            }

            .item-stock {
              padding: 4px 10px;

              .stock-count {
                font-size: 16px;
              }
            }
          }
        }
      }
    }
  }
}
</style>
