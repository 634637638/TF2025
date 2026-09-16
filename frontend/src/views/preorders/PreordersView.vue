<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="preorders"
    module-name="预定管理"
    permission-code="preorders:view"
  >
    <div class="preorders-view admin-page admin-page-content admin-unified-preorders-page safe-area-top safe-area-bottom">
      <!-- 页面标题 -->
      <PageHeader title="预定管理">
        <template #actions>
          <el-button
            v-if="canCreate"
            type="primary"
            @click="openCreateModal"
          >
            <i class="fas fa-plus" />
            新增
          </el-button>
          <el-button
            type="info"
            class="tf-button--refresh"
            :loading="refreshing"
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <i class="fas fa-sync-alt" />
            刷新
          </el-button>
        </template>
      </PageHeader>

      <!-- 统计卡片 -->
      <div
        v-if="showStatsCards"
        class="stats-cards"
      >
        <el-card
          v-if="canViewPreorderField('stats_pending_count')"
          class="stat-card stat-card--warning"
        >
          <div class="stat-content">
            <div class="stat-icon">
              <i class="fas fa-clock" />
            </div>
            <div class="stat-info">
              <div class="stat-value">
                {{ stats.pending_count }}
              </div>
              <div class="stat-label">
                待匹配
              </div>
            </div>
          </div>
        </el-card>
        <el-card
          v-if="canViewPreorderField('stats_matched_count')"
          class="stat-card stat-card--info"
        >
          <div class="stat-content">
            <div class="stat-icon">
              <i class="fas fa-link" />
            </div>
            <div class="stat-info">
              <div class="stat-value">
                {{ stats.matched_count }}
              </div>
              <div class="stat-label">
                已匹配
              </div>
            </div>
          </div>
        </el-card>
        <el-card
          v-if="canViewPreorderField('stats_delivered_count')"
          class="stat-card stat-card--success"
        >
          <div class="stat-content">
            <div class="stat-icon">
              <i class="fas fa-check-circle" />
            </div>
            <div class="stat-info">
              <div class="stat-value">
                {{ stats.delivered_count }}
              </div>
              <div class="stat-label">
                已交付
              </div>
            </div>
          </div>
        </el-card>
        <el-card
          v-if="canViewPreorderField('stats_cancelled_count')"
          class="stat-card stat-card--danger"
        >
          <div class="stat-content">
            <div class="stat-icon">
              <i class="fas fa-times-circle" />
            </div>
            <div class="stat-info">
              <div class="stat-value">
                {{ stats.cancelled_count }}
              </div>
              <div class="stat-label">
                已取消
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <UnifiedSearchPanel
        v-model:expanded="searchExpanded"
        :loading="loading"
        @search="handlePreorderSearch"
        @reset="resetPreorderSearch"
      >
        <template #primary>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索预定单号、客户、型号、IMEI、序列号"
            clearable
            @input="schedulePreorderSearch"
            @keyup.enter="handlePreorderSearch"
            @click.stop
          >
            <template #prefix>
              <i class="fas fa-search" />
            </template>
          </el-input>
        </template>

        <div
          v-if="canViewPreorderField('store_name')"
          class="form-group filter-item"
          data-field="store_id"
        >
          <el-select
            v-model="searchStoreId"
            placeholder="预定店铺"
            clearable
            filterable
            @change="handlePreorderSearch"
          >
            <el-option
              v-for="store in searchOptions.stores"
              :key="store.id"
              :label="store.name"
              :value="store.id"
            />
          </el-select>
        </div>

        <div
          class="form-group filter-item"
          data-field="brand_id"
        >
          <el-select
            v-model="searchBrandId"
            placeholder="品牌"
            clearable
            filterable
            @change="handleBrandSearchChange"
          >
            <el-option
              v-for="brand in searchOptions.brands"
              :key="brand.id"
              :label="brand.name"
              :value="brand.id"
            />
          </el-select>
        </div>

        <div
          class="form-group filter-item"
          data-field="model_id"
        >
          <el-select
            v-model="searchModelId"
            placeholder="型号"
            clearable
            filterable
            @change="handlePreorderSearch"
          >
            <el-option
              v-for="model in searchModels"
              :key="model.id"
              :label="model.name"
              :value="model.id"
            />
          </el-select>
        </div>

        <div
          class="form-group filter-item"
          data-field="color_id"
        >
          <el-select
            v-model="searchColorId"
            placeholder="颜色"
            clearable
            filterable
            @change="handlePreorderSearch"
          >
            <el-option
              v-for="color in searchOptions.colors"
              :key="color.id"
              :label="color.name"
              :value="color.id"
            />
          </el-select>
        </div>

        <div
          class="form-group filter-item"
          data-field="memory_id"
        >
          <el-select
            v-model="searchMemoryId"
            placeholder="内存"
            clearable
            filterable
            @change="handlePreorderSearch"
          >
            <el-option
              v-for="memory in searchOptions.memories"
              :key="memory.id"
              :label="memory.size"
              :value="memory.id"
            />
          </el-select>
        </div>

        <div
          class="form-group filter-item"
          data-field="created_at"
        >
          <DateRangePicker
            v-model="searchDateRange"
            value-format="YYYY-MM-DD"
            start-placeholder="创建开始日期"
            end-placeholder="创建结束日期"
            clearable
            @change="handlePreorderSearch"
          />
        </div>
      </UnifiedSearchPanel>

      <!-- TAB切换 -->
      <el-tabs
        v-model="activeTab"
        class="preorders-tabs tf-page-tabs"
        @tab-change="handleTabChange"
      >
        <!-- TAB 1: 新增预定 -->
        <el-tab-pane
          label="新增预定"
          name="new"
          class="tf-tab-panel"
        >
          <div class="tab-content tf-tab-content table-section admin-panel admin-table-panel">
            <!-- 待匹配预定单列表 -->
            <div class="table-responsive">
              <el-table
                ref="pendingTableRef"
                :data="pendingPreorders"
                border
                stripe
                class="data-table devices-table base-data-table preorders-table"
                :row-key="(row: Preorder) => String(row.id)"
                :expand-row-keys="expandedRows"
                @row-click="handleRowTap"
              >
                <template #empty>
                  <TableLoadingRow
                    v-if="loading"
                    mode="block"
                    text="加载中..."
                  />
                  <DataEmptyState
                    v-else
                    description="暂无预定单"
                  />
                </template>
                <el-table-column
                  v-if="showMobilePendingActionField"
                  type="expand"
                  width="1"
                  class-name="mobile-expand-column"
                  label-class-name="mobile-expand-header"
                >
                  <template #default="{ row }">
                    <div class="mobile-row-actions">
                      <el-button
                        v-if="canEdit"
                        type="primary"
                        size="small"
                        @click.stop="editPreorder(row)"
                      >
                        <i class="fas fa-edit" />
                        <span>编辑</span>
                      </el-button>
                      <el-button
                        v-if="canMatch"
                        type="success"
                        size="small"
                        @click.stop="openMatchModal(row)"
                      >
                        <i class="fas fa-link" />
                        <span>匹配</span>
                      </el-button>
                      <el-button
                        v-if="canCancel"
                        type="danger"
                        size="small"
                        @click.stop="cancelPreorder(row)"
                      >
                        <i class="fas fa-times" />
                        <span>取消</span>
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('preorder_number')"
                  prop="preorder_number"
                  label="预定单号"
                  :min-width="preorderNumberColumnWidth"
                  class-name="identifier-column"
                />
                <el-table-column
                  v-if="canViewPreorderField('supplier_name')"
                  label="供应商"
                  min-width="100"
                >
                  <template #default="{ row }">
                    <span :class="getStatusClass(row.status)">
                      {{ getStatusText(row.status, row.supplier_name) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('store_name')"
                  prop="store_name"
                  label="店铺"
                  min-width="80"
                />
                <el-table-column
                  v-if="canViewPreorderField('customer_name')"
                  prop="customer_name"
                  label="客户姓名"
                  min-width="90"
                />
                <el-table-column
                  v-if="canViewPreorderField('customer_phone')"
                  prop="customer_phone"
                  label="客户电话"
                  min-width="110"
                />
                <el-table-column
                  v-if="canViewPreorderField('brand_name')"
                  label="品牌"
                  min-width="90"
                >
                  <template #default="{ row }">
                    {{ row.brand_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('model_name')"
                  label="型号"
                  min-width="110"
                >
                  <template #default="{ row }">
                    {{ row.model_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('color_name')"
                  label="颜色"
                  min-width="70"
                >
                  <template #default="{ row }">
                    {{ row.color_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('memory_size')"
                  label="内存"
                  min-width="70"
                >
                  <template #default="{ row }">
                    {{ row.memory_size || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('is_new')"
                  label="机况"
                  min-width="70"
                >
                  <template #default="{ row }">
                    <el-tag
                      :type="Number(row.is_new) === 1 ? 'success' : 'info'"
                      size="small"
                    >
                      {{ Number(row.is_new) === 1 ? '全新' : '二手' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('deposit_amount')"
                  prop="deposit_amount"
                  label="定金"
                  min-width="80"
                  align="center"
                >
                  <template #default="{ row }">
                    ¥{{ formatNumber(row.deposit_amount) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('total_price')"
                  label="销售价格"
                  min-width="90"
                  align="center"
                >
                  <template #default="{ row }">
                    {{ row.total_price ? '¥' + formatNumber(row.total_price) : '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showPendingStatusField"
                  label="状态"
                  min-width="150"
                >
                  <template #default="{ row }">
                    <div class="status-cell">
                      <el-tag
                        v-if="canViewPreorderField('status')"
                        :type="getStatusTagType(row.status)"
                      >
                        {{ row.status_text }}
                      </el-tag>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showPendingMatchedTimeField"
                  label="匹配时间"
                  min-width="150"
                >
                  <template #default="{ row }">
                    <div class="status-cell">
                      <span v-if="canViewPreorderField('matched_time')">
                        {{ getMatchedTimeText(row) }}
                      </span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('created_at')"
                  prop="created_at"
                  label="预定时间"
                  min-width="140"
                >
                  <template #default="{ row }">
                    {{ formatDateTime(row.created_at) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showPendingActionField"
                  label="操作"
                  :width="pendingPreorderActionColumnWidth"
                  align="center"
                  class-name="actions-column"
                >
                  <template #default="{ row }">
                    <div class="action-buttons">
                      <el-button
                        v-if="canEdit"
                        type="primary"
                        size="small"
                        class="table-action table-action--edit"
                        @click.stop="editPreorder(row)"
                      >
                        <i class="fas fa-edit" />
                        编辑
                      </el-button>
                      <el-button
                        v-if="canMatch"
                        type="success"
                        size="small"
                        class="table-action table-action--success"
                        @click.stop="openMatchModal(row)"
                      >
                        <i class="fas fa-link" />
                        匹配
                      </el-button>
                      <el-button
                        v-if="canCancel"
                        type="danger"
                        size="small"
                        class="table-action table-action--delete"
                        @click.stop="cancelPreorder(row)"
                      >
                        <i class="fas fa-times" />
                        取消
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 分页 -->
            <div class="pagination-container">
              <Pagination
                v-model:current="pagination.page"
                v-model:page-size="pagination.page_size"
                :total="pagination.total"
                :page-sizes="[10, 20, 50, 100]"
                :show-range="true"
                @change="handlePendingPaginationChange"
              />
            </div>
          </div>
        </el-tab-pane>

        <!-- TAB 2: 已预定（包含已取消） -->
        <el-tab-pane
          label="已预定"
          name="matched"
          class="tf-tab-panel"
        >
          <div class="tab-content tf-tab-content table-section admin-panel admin-table-panel">
            <div class="filter-bar">
              <el-radio-group
                v-model="matchedStatus"
                @change="loadMatchedPreorders"
              >
                <el-radio-button value="all">
                  全部
                </el-radio-button>
                <el-radio-button value="matched">
                  已匹配
                </el-radio-button>
                <el-radio-button value="cancelled">
                  已取消
                </el-radio-button>
              </el-radio-group>
            </div>

            <div class="table-responsive">
              <el-table
                ref="matchedTableRef"
                :data="matchedPreorders"
                border
                stripe
                class="data-table devices-table base-data-table preorders-table"
                :row-key="(row: Preorder) => String(row.id)"
                :expand-row-keys="expandedRows"
                @row-click="handleRowTap"
              >
                <template #empty>
                  <TableLoadingRow
                    v-if="loading"
                    mode="block"
                    text="加载中..."
                  />
                  <DataEmptyState
                    v-else
                    description="暂无预定单"
                  />
                </template>
                <el-table-column
                  v-if="showMobileMatchedActionField"
                  type="expand"
                  width="1"
                  class-name="mobile-expand-column"
                  label-class-name="mobile-expand-header"
                >
                  <template #default="{ row }">
                    <div class="mobile-row-actions">
                      <template v-if="row.status === 'pending'">
                        <el-button
                          v-if="canEdit"
                          type="primary"
                          size="small"
                          @click.stop="editMatchedPreorder(row)"
                        >
                          <i class="fas fa-edit" />
                          <span>编辑</span>
                        </el-button>
                        <el-button
                          v-if="canMatch"
                          type="success"
                          size="small"
                          @click.stop="openMatchModal(row)"
                        >
                          <i class="fas fa-link" />
                          <span>匹配</span>
                        </el-button>
                        <el-button
                          v-if="canCancel"
                          type="danger"
                          size="small"
                          @click.stop="cancelMatchedPreorder(row)"
                        >
                          <i class="fas fa-times" />
                          <span>取消</span>
                        </el-button>
                      </template>
                      <template v-if="row.status === 'arrived'">
                        <el-button
                          v-if="canMatch"
                          type="warning"
                          size="small"
                          @click.stop="openMatchModal(row)"
                        >
                          <i class="fas fa-exchange-alt" />
                          <span>更换设备</span>
                        </el-button>
                        <el-button
                          v-if="canDeliver"
                          type="success"
                          size="small"
                          @click.stop="deliverPreorder(row)"
                        >
                          <i class="fas fa-check" />
                          <span>交付</span>
                        </el-button>
                        <el-button
                          v-if="canCancel"
                          type="danger"
                          size="small"
                          @click.stop="cancelMatchedPreorder(row)"
                        >
                          <i class="fas fa-times" />
                          <span>取消</span>
                        </el-button>
                      </template>
                      <template v-if="row.status === 'cancelled'">
                        <el-button
                          v-if="canEdit"
                          type="warning"
                          size="small"
                          @click.stop="restorePreorder(row)"
                        >
                          <i class="fas fa-undo" />
                          <span>恢复</span>
                        </el-button>
                        <el-button
                          v-if="canDelete"
                          type="danger"
                          size="small"
                          @click.stop="deletePreorder(row)"
                        >
                          <i class="fas fa-trash" />
                          <span>删除</span>
                        </el-button>
                      </template>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('preorder_number')"
                  prop="preorder_number"
                  label="预定单号"
                  :min-width="preorderNumberColumnWidth"
                  class-name="identifier-column"
                />
                <el-table-column
                  v-if="canViewPreorderField('supplier_name')"
                  label="供应商"
                  min-width="100"
                >
                  <template #default="{ row }">
                    <span :class="getStatusClass(row.status)">
                      {{ getStatusText(row.status, row.supplier_name) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('store_name')"
                  prop="store_name"
                  label="店铺"
                  min-width="80"
                />
                <el-table-column
                  v-if="canViewPreorderField('customer_name')"
                  prop="customer_name"
                  label="客户姓名"
                  min-width="90"
                />
                <el-table-column
                  v-if="canViewPreorderField('customer_phone')"
                  prop="customer_phone"
                  label="客户电话"
                  min-width="110"
                />
                <el-table-column
                  v-if="canViewPreorderField('brand_name')"
                  label="品牌"
                  min-width="90"
                >
                  <template #default="{ row }">
                    {{ row.brand_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('model_name')"
                  label="型号"
                  min-width="110"
                >
                  <template #default="{ row }">
                    {{ row.model_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('color_name')"
                  label="颜色"
                  min-width="70"
                >
                  <template #default="{ row }">
                    {{ row.color_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('memory_size')"
                  label="内存"
                  min-width="70"
                >
                  <template #default="{ row }">
                    {{ row.memory_size || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('is_new')"
                  label="机况"
                  min-width="70"
                >
                  <template #default="{ row }">
                    <el-tag
                      :type="Number(row.is_new) === 1 ? 'success' : 'info'"
                      size="small"
                    >
                      {{ Number(row.is_new) === 1 ? '全新' : '二手' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('imei')"
                  prop="imei"
                  label="IMEI"
                  :min-width="imeiColumnWidth"
                  class-name="identifier-column"
                >
                  <template #default="{ row }">
                    <span :class="getStatusClass(row.status)">
                      {{ getStatusText(row.status, row.imei) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('deposit_amount')"
                  prop="deposit_amount"
                  label="定金"
                  min-width="80"
                  align="center"
                >
                  <template #default="{ row }">
                    ¥{{ formatNumber(row.deposit_amount) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('total_price')"
                  label="销售价格"
                  min-width="90"
                  align="center"
                >
                  <template #default="{ row }">
                    {{ row.total_price ? '¥' + formatNumber(row.total_price) : '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showMatchedStatusField"
                  prop="status_text"
                  label="状态"
                  min-width="190"
                >
                  <template #default="{ row }">
                    <div class="status-cell">
                      <el-tag
                        v-if="canViewPreorderField('status')"
                        :type="getStatusTagType(row.status)"
                      >
                        {{ row.status_text }}
                      </el-tag>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showMatchedTimeField"
                  prop="matched_time"
                  label="匹配时间"
                  min-width="170"
                >
                  <template #default="{ row }">
                    <div class="status-cell">
                      <span
                        v-if="canViewPreorderField('matched_time')"
                        :class="getStatusClass(row.status)"
                      >
                        {{ getMatchedTimeText(row) }}
                      </span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showMatchedDeliveryField"
                  label="交付时间"
                  min-width="170"
                >
                  <template #default="{ row }">
                    <div class="status-cell">
                      <span v-if="canViewPreorderField('delivered_time')">
                        {{ row.delivered_time ? formatDateTime(row.delivered_time) : '-' }}
                      </span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="showMatchedActionField"
                  label="操作"
                  :width="matchedPreorderActionColumnWidth"
                  align="center"
                  class-name="actions-column"
                >
                  <template #default="{ row }">
                    <div class="action-buttons">
                      <template v-if="row.status === 'pending'">
                        <el-button
                          v-if="canEdit"
                          type="primary"
                          size="small"
                          class="table-action table-action--edit"
                          @click.stop="editMatchedPreorder(row)"
                        >
                          <i class="fas fa-edit" />
                          编辑
                        </el-button>
                        <el-button
                          v-if="canMatch"
                          type="success"
                          size="small"
                          class="table-action table-action--success"
                          @click.stop="openMatchModal(row)"
                        >
                          <i class="fas fa-link" />
                          匹配
                        </el-button>
                        <el-button
                          v-if="canCancel"
                          type="danger"
                          size="small"
                          class="table-action table-action--delete"
                          @click.stop="cancelMatchedPreorder(row)"
                        >
                          <i class="fas fa-times" />
                          取消
                        </el-button>
                      </template>
                      <template v-if="row.status === 'arrived'">
                        <el-button
                          v-if="canMatch"
                          type="warning"
                          size="small"
                          class="table-action table-action--warning"
                          @click.stop="openMatchModal(row)"
                        >
                          <i class="fas fa-exchange-alt" />
                          更换设备
                        </el-button>
                        <el-button
                          v-if="canDeliver"
                          type="success"
                          size="small"
                          class="table-action table-action--success"
                          @click.stop="deliverPreorder(row)"
                        >
                          <i class="fas fa-check" />
                          交付
                        </el-button>
                        <el-button
                          v-if="canCancel"
                          type="danger"
                          size="small"
                          class="table-action table-action--delete"
                          @click.stop="cancelMatchedPreorder(row)"
                        >
                          <i class="fas fa-times" />
                          取消
                        </el-button>
                      </template>
                      <template v-if="row.status === 'cancelled'">
                        <el-button
                          v-if="canEdit"
                          type="warning"
                          size="small"
                          class="table-action table-action--warning"
                          @click.stop="restorePreorder(row)"
                        >
                          <i class="fas fa-undo" />
                          恢复
                        </el-button>
                        <el-button
                          v-if="canDelete"
                          type="danger"
                          size="small"
                          class="table-action table-action--delete"
                          @click.stop="deletePreorder(row)"
                        >
                          <i class="fas fa-trash" />
                          删除
                        </el-button>
                      </template>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 分页 -->
            <div class="pagination-container">
              <Pagination
                v-model:current="pagination.page"
                v-model:page-size="pagination.page_size"
                :total="pagination.total"
                :page-sizes="[10, 20, 50, 100]"
                :show-range="true"
                @change="handleMatchedPaginationChange"
              />
            </div>
          </div>
        </el-tab-pane>

        <!-- TAB 3: 已交付 -->
        <el-tab-pane
          label="已交付"
          name="delivered"
          class="tf-tab-panel"
        >
          <div class="tab-content tf-tab-content table-section admin-panel admin-table-panel">
            <div class="table-responsive">
              <el-table
                ref="deliveredTableRef"
                :data="deliveredPreorders"
                border
                stripe
                class="data-table devices-table base-data-table preorders-table"
                :row-key="(row: Preorder) => String(row.id)"
                :expand-row-keys="expandedRows"
                @row-click="handleRowTap"
              >
                <template #empty>
                  <TableLoadingRow
                    v-if="loading"
                    mode="block"
                    text="加载中..."
                  />
                  <DataEmptyState
                    v-else
                    description="暂无预定单"
                  />
                </template>
                <el-table-column
                  v-if="showMobileDeliveredActionField"
                  type="expand"
                  width="1"
                  class-name="mobile-expand-column"
                  label-class-name="mobile-expand-header"
                >
                  <template #default="{ row }">
                    <div class="mobile-row-actions">
                      <el-button
                        v-if="canDelete"
                        type="danger"
                        size="small"
                        @click.stop="deletePreorder(row)"
                      >
                        <i class="fas fa-trash" />
                        <span>删除</span>
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('preorder_number')"
                  prop="preorder_number"
                  label="预定单号"
                  :min-width="preorderNumberColumnWidth"
                  class-name="identifier-column"
                />
                <el-table-column
                  v-if="canViewPreorderField('supplier_name')"
                  label="供应商"
                  min-width="100"
                >
                  <template #default="{ row }">
                    <span :class="getStatusClass(row.status)">
                      {{ getStatusText(row.status, row.supplier_name) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('store_name')"
                  prop="store_name"
                  label="店铺"
                  min-width="80"
                />
                <el-table-column
                  v-if="canViewPreorderField('customer_name')"
                  prop="customer_name"
                  label="客户姓名"
                  min-width="85"
                />
                <el-table-column
                  v-if="canViewPreorderField('customer_phone')"
                  prop="customer_phone"
                  label="客户电话"
                  min-width="105"
                />
                <el-table-column
                  v-if="canViewPreorderField('brand_name')"
                  label="品牌"
                  min-width="85"
                >
                  <template #default="{ row }">
                    {{ row.brand_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('model_name')"
                  label="型号"
                  min-width="100"
                >
                  <template #default="{ row }">
                    {{ row.model_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('color_name')"
                  label="颜色"
                  min-width="65"
                >
                  <template #default="{ row }">
                    {{ row.color_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('memory_size')"
                  label="内存"
                  min-width="65"
                >
                  <template #default="{ row }">
                    {{ row.memory_size || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('is_new')"
                  label="机况"
                  min-width="70"
                >
                  <template #default="{ row }">
                    <el-tag
                      :type="Number(row.is_new) === 1 ? 'success' : 'info'"
                      size="small"
                    >
                      {{ Number(row.is_new) === 1 ? '全新' : '二手' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('imei')"
                  prop="imei"
                  label="IMEI"
                  :min-width="imeiColumnWidth"
                  class-name="identifier-column"
                />
                <el-table-column
                  v-if="canViewPreorderField('deposit_amount')"
                  prop="deposit_amount"
                  label="定金"
                  min-width="75"
                  align="center"
                >
                  <template #default="{ row }">
                    ¥{{ formatNumber(row.deposit_amount) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('actual_price')"
                  prop="actual_price"
                  label="销售价格"
                  min-width="85"
                  align="center"
                >
                  <template #default="{ row }">
                    ¥{{ formatNumber(row.actual_price) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('remaining_amount')"
                  prop="remaining_amount"
                  label="尾款"
                  min-width="75"
                  align="center"
                >
                  <template #default="{ row }">
                    ¥{{ formatNumber(row.remaining_amount || 0) }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('delivered_time')"
                  prop="delivered_time"
                  label="交付时间"
                  min-width="140"
                >
                  <template #default="{ row }">
                    {{ row.delivered_time ? formatDateTime(row.delivered_time) : '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="canViewPreorderField('operator_name')"
                  prop="operator_name"
                  label="操作员"
                  min-width="85"
                />
                <el-table-column
                  v-if="showDeliveredActionField"
                  label="操作"
                  :width="$getActionColumnWidth(1)"
                  align="center"
                  class-name="actions-column"
                >
                  <template #default="{ row }">
                    <div class="action-buttons">
                      <el-button
                        v-if="canDelete"
                        type="danger"
                        size="small"
                        class="table-action table-action--delete"
                        @click.stop="deletePreorder(row)"
                      >
                        <i class="fas fa-trash" />
                        删除
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 分页 -->
            <div class="pagination-container">
              <Pagination
                v-model:current="pagination.page"
                v-model:page-size="pagination.page_size"
                :total="pagination.total"
                :page-sizes="[10, 20, 50, 100]"
                :show-range="true"
                @change="handleDeliveredPaginationChange"
              />
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- 预定单表单模态框（创建/编辑） -->
      <PreorderFormModal
        v-if="showFormModal"
        v-model:visible="showFormModal"
        :mode="formModalMode"
        :preorder="selectedPreorder"
        @success="handlePreorderFormSuccess"
      />
      <MatchPreorderModal
        v-if="showMatchModal && matchTarget"
        v-model:visible="showMatchModal"
        :preorder="matchTarget"
        @success="handleMatchSuccess"
      />
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { canViewPreorderField } from './preorder-field-permissions'
import { useLoadingState } from '@/composables'
import { preorderApi, Preorder, PreorderOptions, PreorderStatus } from '@/api/preorder'
import { unifiedApi } from '@/utils/unified-api'
import { PageHeader, PermissionGate } from '@/components/base'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import Pagination from '@/components/Pagination.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { logger } from '@/utils/logger'
import { getAdaptiveActionColumnWidth, getIdentifierColumnMinWidth } from '@/utils/table-layout'
import { isCurrentMobileViewport } from '@/utils/device-detection'

const PreorderFormModal = defineAsyncComponent(() => import('./page/PreorderFormModal.vue'))
const MatchPreorderModal = defineAsyncComponent(() => import('./page/MatchPreorderModal.vue'))

const { success, error, warning } = useNotification()
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  canMatch,
  canDeliver,
  canCancel,
  handleNoPermission
} = usePagePermissions('preorders')
const router = useRouter()

// 表格引用
const pendingTableRef = ref()
const matchedTableRef = ref()
const deliveredTableRef = ref()

// 当前展开的行
const expandedRows = ref<string[]>([])
const lastTappedRowId = ref<string | null>(null)
const lastTapTimestamp = ref(0)

const showStatsCards = computed(() => (
  canViewPreorderField('stats_pending_count') ||
  canViewPreorderField('stats_matched_count') ||
  canViewPreorderField('stats_delivered_count') ||
  canViewPreorderField('stats_cancelled_count')
))

// 状态
const activeTab = ref('new')
const { loading } = useLoadingState()
loading.value = true
const refreshing = ref(false)
const matchedStatus = ref('all')
const isMobile = ref(isCurrentMobileViewport())
const searchExpanded = ref(false)
const searchKeyword = ref('')
type SearchId = number | string | null | undefined

const searchStoreId = ref<SearchId>('')
const searchBrandId = ref<SearchId>('')
const searchModelId = ref<SearchId>('')
const searchColorId = ref<SearchId>('')
const searchMemoryId = ref<SearchId>('')
const searchDateRange = ref<[string, string] | null>(null)
const searchOptions = ref<PreorderOptions>({
  stores: [],
  brands: [],
  models: [],
  colors: [],
  memories: []
})
let searchTimer: ReturnType<typeof setTimeout> | null = null
const searchModels = computed(() => (
  normalizeSearchId(searchBrandId.value) === undefined
    ? searchOptions.value.models
    : searchOptions.value.models.filter(model => Number(model.brand_id) === Number(searchBrandId.value))
))

const normalizeSearchId = (value: SearchId): number | undefined => {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    value === 'null' ||
    value === 'undefined'
  ) {
    return undefined
  }

  const normalizedValue = Number(value)
  return Number.isSafeInteger(normalizedValue) && normalizedValue > 0
    ? normalizedValue
    : undefined
}

const showPendingStatusField = computed(() => canViewPreorderField('status'))
const showPendingMatchedTimeField = computed(() => canViewPreorderField('matched_time'))
const showMatchedStatusField = computed(() => shouldShowActionColumn(
  canViewPreorderField('status'),
  []
))
const showMatchedTimeField = computed(() => shouldShowActionColumn(
  canViewPreorderField('matched_time'),
  []
))
const showMatchedDeliveryField = computed(() => shouldShowActionColumn(
  canViewPreorderField('delivered_time'),
  []
))
const showPendingActionField = computed(() => (
  !isMobile.value && shouldShowActionColumn(
    canViewPreorderField('operations'),
    [canEdit.value, canMatch.value, canCancel.value]
  )
))
const showMatchedActionField = computed(() => (
  !isMobile.value && shouldShowActionColumn(
    canViewPreorderField('operations'),
    [canEdit.value, canMatch.value, canCancel.value, canDeliver.value, canDelete.value]
  )
))
const showDeliveredActionField = computed(() => (
  !isMobile.value && shouldShowActionColumn(canViewPreorderField('operations'), [canDelete.value])
))
const showMobilePendingActionField = computed(() => isMobile.value && shouldShowActionColumn(
  canViewPreorderField('operations'),
  [canEdit.value, canMatch.value, canCancel.value]
))
const showMobileMatchedActionField = computed(() => isMobile.value && shouldShowActionColumn(
  canViewPreorderField('operations'),
  [canEdit.value, canDelete.value, canCancel.value, canMatch.value, canDeliver.value]
))
const showMobileDeliveredActionField = computed(() => isMobile.value && shouldShowActionColumn(
  canViewPreorderField('operations'),
  [canDelete.value]
))

// 监听窗口大小变化
const handleResize = () => {
  isMobile.value = isCurrentMobileViewport()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (searchTimer) clearTimeout(searchTimer)
})

// 统计数据
const stats = reactive({
  pending_count: 0,
  matched_count: 0,
  delivered_count: 0,
  cancelled_count: 0
})

// 分页
const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

// 列表数据
const pendingPreorders = ref<Preorder[]>([])
const matchedPreorders = ref<Preorder[]>([])
const deliveredPreorders = ref<Preorder[]>([])
const pendingPreorderActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(
  pendingPreorders.value,
  [
    { label: '编辑', visible: canEdit.value },
    { label: '匹配', visible: canMatch.value },
    { label: '取消', visible: canCancel.value }
  ]
))
const matchedPreorderActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(
  matchedPreorders.value,
  [
    { label: '编辑', visible: row => canEdit.value && row.status === 'pending' },
    { label: '匹配', visible: row => canMatch.value && row.status === 'pending' },
    { label: '更换设备', visible: row => canMatch.value && row.status === 'arrived' },
    { label: '取消', visible: row => canCancel.value && ['pending', 'arrived'].includes(row.status) },
    { label: '交付', visible: row => canDeliver.value && row.status === 'arrived' },
    { label: '恢复', visible: row => canEdit.value && row.status === 'cancelled' },
    { label: '删除', visible: row => canDelete.value && row.status === 'cancelled' }
  ]
))
const visiblePreorders = computed(() => [
  ...pendingPreorders.value,
  ...matchedPreorders.value,
  ...deliveredPreorders.value
])
const preorderNumberColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['预定单号', ...visiblePreorders.value.map(preorder => preorder.preorder_number)],
  { minWidth: 150, horizontalPadding: 32 }
))
const imeiColumnWidth = computed(() => getIdentifierColumnMinWidth(
  ['IMEI', ...visiblePreorders.value.map(preorder => preorder.imei)],
  { minWidth: 130, horizontalPadding: 32 }
))

// 模态框状态
const showFormModal = ref(false)
const formModalMode = ref<'create' | 'edit'>('create')
const selectedPreorder = ref<Preorder | null>(null)
const showMatchModal = ref(false)
const matchTarget = ref<Preorder | null>(null)

// 加载统计数据
const loadStats = async () => {
  try {
    const data = await preorderApi.getPreorderStats()
    Object.assign(stats, data)
  } catch (err) {
    logger.error('获取统计失败:', err)
  }
}

const getPreorderSearchParams = () => {
  const params: {
    search?: string
    store_id?: number
    brand_id?: number
    model_id?: number
    color_id?: number
    memory_id?: number
    start_date?: string
    end_date?: string
  } = {}

  const search = searchKeyword.value.trim()
  if (search) params.search = search

  const idParams = {
    store_id: normalizeSearchId(searchStoreId.value),
    brand_id: normalizeSearchId(searchBrandId.value),
    model_id: normalizeSearchId(searchModelId.value),
    color_id: normalizeSearchId(searchColorId.value),
    memory_id: normalizeSearchId(searchMemoryId.value)
  }

  for (const [field, value] of Object.entries(idParams)) {
    if (value !== undefined) {
      params[field as keyof typeof idParams] = value
    }
  }

  if (searchDateRange.value?.[0]) params.start_date = searchDateRange.value[0]
  if (searchDateRange.value?.[1]) params.end_date = searchDateRange.value[1]

  return params
}

const loadSearchOptions = async () => {
  try {
    const options = await preorderApi.getPreorderOptions()
    if (options) searchOptions.value = options
  } catch (err) {
    logger.error('加载预定检索选项失败:', err)
  }
}

const loadActivePreorders = async (showLoadingState = true) => {
  if (activeTab.value === 'new') return loadPendingPreorders(showLoadingState)
  if (activeTab.value === 'matched') return loadMatchedPreorders(showLoadingState)
  return loadDeliveredPreorders(showLoadingState)
}

const handlePreorderSearch = async () => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  pagination.page = 1
  await loadActivePreorders()
}

const schedulePreorderSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void handlePreorderSearch()
  }, 350)
}

const handleBrandSearchChange = () => {
  searchModelId.value = ''
  void handlePreorderSearch()
}

const resetPreorderSearch = async () => {
  searchKeyword.value = ''
  searchStoreId.value = ''
  searchBrandId.value = ''
  searchModelId.value = ''
  searchColorId.value = ''
  searchMemoryId.value = ''
  searchDateRange.value = null
  await handlePreorderSearch()
}

// 加载待匹配预定单
const loadPendingPreorders = async (showLoadingState = true) => {
  if (showLoadingState) {
    loading.value = true
  }
  try {
    const data = await preorderApi.getPreorders({
      page: pagination.page,
      page_size: pagination.page_size,
      status: PreorderStatus.PENDING,
      ...getPreorderSearchParams()
    })
    pendingPreorders.value = data.records
    pagination.total = data.pagination.total
  } catch (err) {
    error('加载待匹配预定单失败')
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

// 加载已匹配预定单（包含待匹配、已匹配、已取消）
const loadMatchedPreorders = async (showLoadingState = true) => {
  if (showLoadingState) {
    loading.value = true
  }
  try {
    // 根据筛选状态加载不同数据
    // 'all' - 加载全部（待匹配、已匹配、已取消）
    // 'matched' - 只加载已匹配（arrived）
    // 'cancelled' - 只加载已取消
    let status: PreorderStatus | undefined
    if (matchedStatus.value === 'matched') {
      status = PreorderStatus.MATCHED  // arrived
    } else if (matchedStatus.value === 'cancelled') {
      status = PreorderStatus.CANCELLED
    }
    // 'all' 时传 undefined，后端返回所有数据

    const data = await preorderApi.getPreorders({
      page: pagination.page,
      page_size: pagination.page_size,
      status,
      ...getPreorderSearchParams()
    })
    matchedPreorders.value = data.records
    pagination.total = data.pagination.total
  } catch (err) {
    error('加载已匹配预定单失败')
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

// 加载已交付预定单
const loadDeliveredPreorders = async (showLoadingState = true) => {
  if (showLoadingState) {
    loading.value = true
  }
  try {
    const data = await preorderApi.getPreorders({
      page: pagination.page,
      page_size: pagination.page_size,
      status: PreorderStatus.DELIVERED,
      ...getPreorderSearchParams()
    })
    deliveredPreorders.value = data.records
    pagination.total = data.pagination.total
  } catch (err) {
    error('加载已交付预定单失败')
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

const handlePendingPaginationChange = (page: number, pageSize: number) => {
  pagination.page = page
  pagination.page_size = pageSize
  void loadPendingPreorders()
}

const handleMatchedPaginationChange = (page: number, pageSize: number) => {
  pagination.page = page
  pagination.page_size = pageSize
  void loadMatchedPreorders()
}

const handleDeliveredPaginationChange = (page: number, pageSize: number) => {
  pagination.page = page
  pagination.page_size = pageSize
  void loadDeliveredPreorders()
}

// TAB切换
const handleTabChange = async (tabName: string) => {
  pagination.page = 1
  if (tabName === 'new') {
    await loadPendingPreorders()
  } else if (tabName === 'matched') {
    await loadMatchedPreorders()
  } else if (tabName === 'delivered') {
    await loadDeliveredPreorders()
  }
}

// 打开创建模态框
const openCreateModal = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }
  formModalMode.value = 'create'
  selectedPreorder.value = null
  showFormModal.value = true
}

const openMatchModal = (preorder: Preorder) => {
  if (!canMatch.value) {
    handleNoPermission('match')
    return
  }

  matchTarget.value = preorder
  showMatchModal.value = true
}

const handleMatchSuccess = async () => {
  showMatchModal.value = false
  matchTarget.value = null
  await Promise.all([loadPendingPreorders(false), loadStats()])
  if (activeTab.value === 'matched') {
    await loadMatchedPreorders(false)
  }
}

// 刷新数据
const handleRefresh = async () => {
  if (refreshing.value) {
    return
  }

  refreshing.value = true
  try {
    unifiedApi.clearCache('/preorders')
    await loadStats()
    if (activeTab.value === 'new') {
      await loadPendingPreorders(false)
    } else if (activeTab.value === 'matched') {
      await loadMatchedPreorders(false)
    } else if (activeTab.value === 'delivered') {
      await loadDeliveredPreorders(false)
    }
    success('数据刷新成功')
  } catch (err) {
    logger.error('刷新预定数据失败:', err)
    error('刷新失败，请重试')
  } finally {
    refreshing.value = false
  }
}

const handleRowTap = (row: Preorder) => {
  if (!isMobile.value) return
  const rowKey = String(row.id)
  const now = Date.now()

  if (lastTappedRowId.value === rowKey && now - lastTapTimestamp.value <= 320) {
    expandedRows.value = expandedRows.value.includes(rowKey) ? [] : [rowKey]
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = rowKey
  lastTapTimestamp.value = now
}

// 编辑预定单
const editPreorder = (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  formModalMode.value = 'edit'
  selectedPreorder.value = preorder
  showFormModal.value = true
}

// 取消预定单
const cancelPreorder = async (preorder: Preorder) => {
  if (!canCancel.value) {
    handleNoPermission('cancel')
    return
  }

  try {
    const { value: reason } = await ElMessageBox.prompt('请输入取消原因', '取消预定单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入取消原因'
    })

    await preorderApi.cancelPreorder(preorder.id, reason)
    success('预定单已取消')
    loadPendingPreorders()
    loadStats()
  } catch (err: any) {
    if (err !== 'cancel') {
      error('取消预定单失败')
    }
  }
}

// 交付预定单 - 跳转到销售页面
const deliverPreorder = (preorder: Preorder) => {
  if (!canDeliver.value) {
    handleNoPermission('deliver')
    return
  }

  // 检查是否有匹配的IMEI
  if (!preorder.imei) {
    warning('该预定单尚未匹配设备，无法交付')
    return
  }

  // 跳转到销售页面，携带IMEI和预定单信息
  router.push({
    path: '/sales',
    query: {
      imei: preorder.imei,
      preorder_id: preorder.id,
      customer_id: preorder.customer_id,
      customer_name: preorder.customer_name,
      customer_phone: preorder.customer_phone,
      expected_price: preorder.actual_price || preorder.total_price || preorder.deposit_amount || '',
      advance_payment: preorder.deposit_amount || ''
    }
  })
}

// 编辑已匹配的预定单
const editMatchedPreorder = (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }
  formModalMode.value = 'edit'
  selectedPreorder.value = preorder
  showFormModal.value = true
}

// 取消已匹配的预定单
const cancelMatchedPreorder = async (preorder: Preorder) => {
  if (!canCancel.value) {
    handleNoPermission('cancel')
    return
  }

  try {
    const { value: reason } = await ElMessageBox.prompt('请输入取消原因', '取消预定单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入取消原因'
    })

    await preorderApi.cancelPreorder(preorder.id, reason)
    success('预定单已取消')
    loadMatchedPreorders()
    loadStats()
  } catch (err: any) {
    if (err !== 'cancel') {
      error('取消预定单失败')
    }
  }
}

// 恢复已取消的预定单
const restorePreorder = async (preorder: Preorder) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    await ElMessageBox.confirm('确定要恢复此预定单吗？恢复后将变为待匹配状态。', '恢复预定单', {
      confirmButtonText: '确定恢复',
      cancelButtonText: '取消',
      type: 'info'
    })

    // 调用专门的恢复API
    await preorderApi.restorePreorder(preorder.id)
    success('预定单已恢复')
    loadMatchedPreorders()
    loadStats()
  } catch (err: any) {
    if (err !== 'cancel') {
      error('恢复预定单失败')
    }
  }
}

// 删除预定单
const deletePreorder = async (preorder: Preorder) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm('确定要删除此预定单吗？删除后将无法恢复！', '删除预定单', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    })

    await preorderApi.deletePreorder(preorder.id)
    success('预定单已删除')

    // 根据当前标签页重新加载数据
    if (activeTab.value === 'matched') {
      loadMatchedPreorders()
    } else if (activeTab.value === 'delivered') {
      loadDeliveredPreorders()
    }

    loadStats()
  } catch (err: any) {
    if (err !== 'cancel') {
      error('删除预定单失败')
    }
  }
}

// 预定单表单提交成功
const handlePreorderFormSuccess = () => {
  showFormModal.value = false
  if (formModalMode.value === 'create') {
    success('预定单创建成功')
    loadPendingPreorders()
    loadStats()
  } else {
    success('预定单更新成功')
    if (activeTab.value === 'matched') {
      loadMatchedPreorders()
    } else if (activeTab.value === 'delivered') {
      loadDeliveredPreorders()
    } else {
      loadPendingPreorders()
    }
    loadStats()
  }
}

// 格式化数字
const formatNumber = (num: number | string | null | undefined) => {
  if (num === null || num === undefined) return '0.00'
  const number = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(number)) return '0.00'
  return number.toFixed(2)
}

// 格式化日期时间（只显示年月日）
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '-'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取状态标签类型
const getStatusTagType = (status: PreorderStatus) => {
  const typeMap: Record<PreorderStatus, any> = {
    [PreorderStatus.PENDING]: 'warning',
    [PreorderStatus.MATCHED]: 'primary',
    [PreorderStatus.DELIVERED]: 'success',
    [PreorderStatus.CANCELLED]: 'danger'
  }
  return typeMap[status] || ''
}

// 获取状态对应的CSS类名
const getStatusClass = (status: string) => {
  const classMap: Record<string, string> = {
    'pending': 'status-pending',
    'arrived': 'status-matched',
    'completed': 'status-delivered',
    'cancelled': 'status-cancelled'
  }
  return classMap[status] || ''
}

// 根据状态获取显示文本（供应商、IMEI）
const getStatusText = (status: string, value?: string) => {
  if (status === 'cancelled') {
    return '已取消'
  }
  if (status === 'pending') {
    return '待匹配'
  }
  return value || '待匹配'
}

// 根据状态获取匹配时间显示文本
const getMatchedTimeText = (row: Preorder) => {
  if (row.status === 'cancelled') {
    return '已取消'
  }
  if (row.status === 'pending') {
    return '待匹配'
  }
  return row.matched_time ? formatDateTime(row.matched_time) : '待匹配'
}

// 初始化
onMounted(async () => {
  if (!canView.value) {
    loading.value = false
    return
  }

  await fieldPermissions.init()
  await Promise.all([loadStats(), loadPendingPreorders(), loadSearchOptions()])
})
</script>

<!-- 全局表格样式已在 src/styles/components/_table.scss 中定义 -->
<style scoped lang="scss">
.preorders-view {
  padding: 20px;

  .preorders-tabs {
    .actions-bar,
    .filter-bar {
        margin-bottom: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--color-border-light);
      }

    .pagination-container {
        display: flex;
        justify-content: flex-end;
        padding-top: 16px;
        border-top: 1px solid var(--color-border-light);
    }

      // 修复表格固定列按钮被遮挡的问题
    :deep(.el-table) {
        .el-table__fixed,
        .el-table__fixed-right {
          z-index: 2 !important;

          .cell {
            overflow: visible !important;
          }
        }

        .el-table__fixed-right {
          right: 0 !important;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1) !important;
        }

        .el-table__fixed-right::before {
          content: '';
          position: absolute;
          top: 0;
          left: -1px;
          bottom: 0;
          width: 1px;
          background: var(--color-border-light);
        }

    }

      // 修复操作列按钮显示
    :deep(.el-table__fixed-right) {
        .el-button {
          position: relative;
          z-index: 10;
        }
    }
  }

  // 状态颜色样式
  .status-pending {
    color: var(--tf-status-warning-color);
    background: var(--tf-status-warning-bg);
    border: 1px solid var(--tf-status-warning-border);
    font-weight: 500;
  }

  .status-matched {
    color: var(--tf-status-info-color);
    background: var(--tf-status-info-bg);
    border: 1px solid var(--tf-status-info-border);
    font-weight: 500;
  }

  .status-delivered {
    color: var(--tf-status-success-color);
    background: var(--tf-status-success-bg);
    border: 1px solid var(--tf-status-success-border);
    font-weight: 500;
  }

  .status-cancelled {
    color: var(--tf-status-danger-color);
    background: var(--tf-status-danger-bg);
    border: 1px solid var(--tf-status-danger-border);
    font-weight: 500;
  }

  // 手机端响应式样式
  @media (max-width: 768px) {
    padding: 0;

    .preorders-tabs {
      .actions-bar,
      .filter-bar {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;

          .el-button {
            width: 100%;
          }
      }
    }

  }

  @media (max-width: 480px) {
    padding: 0;

  }
}
</style>
