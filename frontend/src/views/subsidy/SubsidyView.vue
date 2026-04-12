<template>
  <div class="subsidy-view admin-page safe-area-top">
    <!-- 权限加载中 -->
    <div v-if="permissionLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载权限中...</p>
    </div>

    <PermissionDenied
      v-else-if="!canView"
      :can-view="canView"
      module-key="subsidy"
      module-name="国补管理"
      permission-code="subsidy:view"
    />

    <template v-else>
      <!-- 页面头部 - 使用公共组件 -->
      <PageHeader
        icon="fas fa-hand-holding-usd"
        title="国补管理"
      >
        <template #actions>
          <ImportExportActions
            :can-export="canExport"
            :export-loading="exportingSubsidy"
            export-label="导出"
            export-loading-label="导出中..."
            export-icon-class="fas fa-file-excel"
            export-type="success"
            @export="handleExportSubsidy"
          />
          <el-button
            v-if="canCreate"
            type="primary"
            @click="openApplyDialog"
          >
            <i class="fas fa-plus"></i>
            <span>新增</span>
          </el-button>
          <el-button
            type="info"
            @click="handleRefresh"
            :disabled="refreshing"
            title="刷新数据"
          >
            <i :class="refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'"></i>
            <span>刷新</span>
          </el-button>
        </template>
      </PageHeader>

      <div class="content admin-page-content">
      <!-- 统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewField('stats_total_and_handler')" class="stat-card total-card">
        <div class="stat-content">
          <div class="stat-value">{{ stats.total_count || 0 }} <span class="divider">/</span> {{ stats.handler_count || 0 }}</div>
          <div class="stat-label">总办理 / 代办理</div>
        </div>
        <!-- 手机端双行显示 -->
        <div class="stat-content-mobile">
          <div class="stat-row">
            <span class="row-label">总办理</span>
            <span class="row-value">{{ stats.total_count || 0 }}单</span>
          </div>
          <div class="stat-row">
            <span class="row-label">代办理</span>
            <span class="row-value">{{ stats.handler_count || 0 }}单</span>
          </div>
        </div>
      </div>
      <div v-if="canViewField('stats_approval_progress')" class="stat-card approval-card">
        <div class="stat-content">
          <div class="stat-value">{{ stats.completed_count || 0 }} <span class="divider">/</span> {{ stats.pending_count || 0 }}</div>
          <div class="stat-label">已审批 / 未审批</div>
        </div>
        <!-- 手机端双行显示 -->
        <div class="stat-content-mobile">
          <div class="stat-row">
            <span class="row-label">已审批</span>
            <span class="row-value">{{ stats.completed_count || 0 }}单</span>
          </div>
          <div class="stat-row">
            <span class="row-label">未审批</span>
            <span class="row-value">{{ stats.pending_count || 0 }}单</span>
          </div>
        </div>
      </div>
      <div v-if="canViewField('stats_amount_progress')" class="stat-card amount-card">
        <div class="stat-content">
          <div class="stat-value">¥{{ formatAmount(stats.total_arrived_amount || 0) }} <span class="divider">/</span> ¥{{ formatAmount((stats.total_subsidy_amount || 0) - (stats.total_arrived_amount || 0)) }}</div>
          <div class="stat-label">已到账 / 未到账</div>
        </div>
        <!-- 手机端双行显示 -->
        <div class="stat-content-mobile">
          <div class="stat-row">
            <span class="row-label">已到账</span>
            <span class="row-value">¥{{ formatAmount(stats.total_arrived_amount || 0) }}</span>
          </div>
          <div class="stat-row">
            <span class="row-label">未到账</span>
            <span class="row-value">¥{{ formatAmount((stats.total_subsidy_amount || 0) - (stats.total_arrived_amount || 0)) }}</span>
          </div>
        </div>
      </div>
      <div v-if="canViewField('stats_store_overview')" class="stat-card handler-card">
        <div class="stat-content">
          <div class="stat-value">{{ stats.store_stats?.length || 0 }}</div>
          <div class="stat-label">店铺数</div>
        </div>
        <!-- 手机端店铺列表 -->
        <div class="stat-content-mobile">
          <template v-if="stats.store_stats && stats.store_stats.length > 0">
            <div class="stat-row" v-for="store in stats.store_stats.slice(0, 3)" :key="store.store_id">
              <span class="row-label">{{ store.store_name || '未知店铺' }}</span>
              <span class="row-value">{{ store.total_count || 0 }}单</span>
            </div>
            <div class="stat-row" v-if="stats.store_stats.length > 3">
              <span class="row-label">其他</span>
              <span class="row-value">+{{ stats.store_stats.length - 3 }}店</span>
            </div>
          </template>
          <div class="stat-row" v-else>
            <span class="row-label">暂无数据</span>
            <span class="row-value">-</span>
          </div>
        </div>
      </div>
    </div>

      <UnifiedSearchPanel
        v-model:expanded="searchExpanded"
        :loading="loading"
        @search="handleSearch"
        @reset="resetFilters"
      >
        <template #primary>
          <el-input
            v-model="filters.search"
            placeholder="姓名/手机/身份证/品牌/型号/颜色/内存/IMEI/序列号"
            clearable
            @input="debounceSearch"
            @keyup.enter="handleSearch"
            @click.stop
          >
            <template #prefix>
              <i class="fas fa-search"></i>
            </template>
          </el-input>
        </template>

        <div class="form-group filter-item" data-field="status">
            <el-select
              v-model="filters.status"
              placeholder="状态"
              clearable
              @change="handleSearch"
            >
              <el-option label="未审批" value="pending" />
              <el-option label="已审批" value="completed" />
              <el-option label="未到账" value="unarrived" />
              <el-option label="已到账" value="approved" />
            </el-select>
        </div>

        <div class="form-group filter-item" data-field="store">
            <el-select
              v-model="filters.store_id"
              placeholder="店铺"
              clearable
              filterable
              @change="handleSearch"
            >
              <el-option
                v-for="store in stores"
                :key="store.id"
                :label="store.name"
                :value="store.id"
              />
            </el-select>
        </div>

        <div class="form-group filter-item" data-field="saleDate">
            <el-date-picker
              v-model="saleDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="销售开始"
              end-placeholder="销售结束"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              @change="handleSaleDateChange"
            />
        </div>

        <div class="form-group filter-item" data-field="submitDate">
            <el-date-picker
              v-model="submitDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="提交开始"
              end-placeholder="提交结束"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              @change="handleSubmitDateChange"
            />
          </div>

          <!-- 到账时间 -->
          <div class="form-group filter-item" data-field="arriveDate">
            <el-date-picker
              v-model="arriveDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="到账开始"
              end-placeholder="到账结束"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              @change="handleArriveDateChange"
            />
        </div>
      </UnifiedSearchPanel>

      <!-- 数据列表 -->
      <div class="table-section admin-panel admin-table-panel">
        <div class="section-title">
          <i class="fas fa-list"></i>
          国补申请列表
          <span class="record-count">共 {{ subsidyPagination?.total || 0 }} 条记录</span>
        </div>

        <!-- 批量操作按钮区域 -->
        <div v-if="selectedItems.length > 0" class="batch-actions-bar">
          <div class="batch-info">
            <i class="fas fa-check-square"></i>
            <span>已选择 <strong>{{ selectedItems.length }}</strong> 条记录</span>
          </div>
          <div class="batch-actions-buttons">
            <el-button
              type="success"
              size="small"
              @click="pinSelectedItems"
              :disabled="selectedItems.length === 0"
            >
              <i class="fas fa-thumbtack"></i>
              <span>固定选中项 ({{ selectedItems.length }})</span>
            </el-button>
            <el-button
              v-if="pinnedItems.length > 0"
              type="warning"
              size="small"
              @click="clearPinnedItems"
            >
              <i class="fas fa-trash-alt"></i>
              <span>清除固定项 ({{ pinnedItems.length }})</span>
            </el-button>
            <el-button
              type="primary"
              size="small"
              @click="openBatchDialog"
              v-permission="'subsidy:edit'"
              :disabled="selectedItems.length === 0"
            >
              <i class="fas fa-calendar-alt"></i>
              <span>批量修改时间</span>
            </el-button>
            <el-button
              size="small"
              @click="clearSelection"
            >
              <i class="fas fa-times"></i>
              <span>取消选择</span>
            </el-button>
          </div>
        </div>

        <div class="table-container">
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <p>加载中...</p>
          </div>

          <div v-else-if="subsidyList.length === 0" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>暂无国补申请记录</p>
          </div>

          <!-- PC端表格 -->
          <table v-else-if="!isMobile" class="data-table">
            <thead>
              <tr>
                <th class="checkbox-col" style="width: 50px;">
                  <el-checkbox
                    v-model="selectAll"
                    :indeterminate="isIndeterminate"
                    @change="handleSelectAll"
                  />
                </th>
                <th v-for="column in tableColumns" :key="column.key" :class="{ 'actions-col': column.key === 'actions' }">
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in displayList"
                :key="item.id"
                @dblclick="handleRowDoubleClick(item)"
                :class="{ 'selected-row': selectedItems.includes(item.id), 'pinned-row': pinnedItems.some(p => p.id === item.id) }"
              >
                <!-- 复选框 -->
                <td class="checkbox-col">
                  <el-checkbox
                    :model-value="selectedItems.includes(item.id)"
                    @change="(value) => handleSelectItem(item.id, !!value)"
                  />
                </td>
                <!-- 店铺 -->
                <td v-if="isFieldVisible('subsidy', 'store_name')">{{ item.store_name }}</td>
                <!-- 销售日期 -->
                <td v-if="isFieldVisible('subsidy', 'sale_time')">{{ formatDate(item.sale_time) }}</td>
                <!-- 姓名 -->
                <td v-if="isFieldVisible('subsidy', 'customer_info.customer_name')">
                  <span
                    class="clickable-text customer-info-toggle"
                    :class="{
                      'has-handler-but-showing-purchaser': hasHandlerInfo(item) && !isShowingHandlerInfo(item),
                      'showing-handler': isShowingHandlerInfo(item)
                    }"
                    @click="hasHandlerInfo(item) ? toggleListItemCustomerInfo(item.id) : copyToClipboard(getDisplayInfo(item, 'name'), '姓名')"
                    :title="hasHandlerInfo(item) ? (isShowingHandlerInfo(item) ? '点击切换到购买者' : '点击切换到办理人') : '点击复制'"
                  >
                    {{ getDisplayInfo(item, 'name') }}
                  </span>
                </td>
                <!-- 手机 -->
                <td v-if="isFieldVisible('subsidy', 'customer_info.customer_phone')">
                  <span
                    class="clickable-text"
                    @click="copyToClipboard(getDisplayInfo(item, 'phone'), '手机号')"
                    :title="'点击复制'"
                  >
                    {{ getDisplayInfo(item, 'phone') }}
                  </span>
                </td>
                <!-- 身份证 -->
                <td v-if="isFieldVisible('subsidy', 'customer_info.customer_idcard')">
                  <span
                    v-if="getDisplayInfo(item, 'idcard') && canViewField('customer_idcard')"
                    class="clickable-text"
                    @click="copyToClipboard(getDisplayInfo(item, 'idcard'), '身份证号')"
                    :title="'点击复制'"
                  >
                    {{ getDisplayInfo(item, 'idcard') }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <!-- 品牌 -->
                <td v-if="isFieldVisible('subsidy', 'device_info.brand')">{{ item.phone_brand }}</td>
                <!-- 型号 -->
                <td v-if="isFieldVisible('subsidy', 'device_info.model')">{{ item.phone_model }}</td>
                <!-- 颜色 -->
                <td v-if="isFieldVisible('subsidy', 'device_info.color')">{{ item.phone_color }}</td>
                <!-- 内存 -->
                <td v-if="isFieldVisible('subsidy', 'device_info.memory')">{{ item.phone_memory }}</td>
                <!-- 序列号 -->
                <td v-if="isFieldVisible('subsidy', 'serial_number')">
                  <span
                    class="clickable-text qrcode-trigger"
                    @click="copyToClipboard(item.serial_number, '序列号')"
                    @mouseenter="showQRCode($event, item.serial_number, '序列号')"
                    @mouseleave="hideQRCode"
                    title="点击复制，悬停显示二维码"
                  >
                    {{ item.serial_number }}
                  </span>
                </td>
                <!-- IMEI1 -->
                <td v-if="isFieldVisible('subsidy', 'device_info.imei1')">
                  <span
                    class="clickable-text qrcode-trigger"
                    @click="copyToClipboard(item.imei1, 'IMEI1')"
                    @mouseenter="showQRCode($event, item.imei1, 'IMEI1')"
                    @mouseleave="hideQRCode"
                    title="点击复制，悬停显示二维码"
                  >
                    {{ item.imei1 }}
                  </span>
                </td>
                <!-- IMEI2 -->
                <td v-if="isFieldVisible('subsidy', 'device_info.imei2')">
                  <span
                    v-if="item.imei2"
                    class="clickable-text qrcode-trigger"
                    @click="copyToClipboard(item.imei2, 'IMEI2')"
                    @mouseenter="showQRCode($event, item.imei2, 'IMEI2')"
                    @mouseleave="hideQRCode"
                    title="点击复制，悬停显示二维码"
                  >
                    {{ item.imei2 }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <!-- 销售价 -->
                <td v-if="isFieldVisible('subsidy', 'price_info.sale_price')" class="text-right">¥{{ item.sale_price?.toFixed(2) }}</td>
                <!-- 国补后价 -->
                <td v-if="isFieldVisible('subsidy', 'price_info.subsidy_amount')" class="text-right">
                  <span class="subsidy-amount">¥{{ (item.sale_price - item.subsidy_amount).toFixed(2) }}</span>
                </td>
                <!-- 备注 -->
                <td v-if="isFieldVisible('subsidy', 'price_info.subsidy_amount')" class="text-left">
                  <span
                    v-if="item.remarks"
                    class="remarks-tag"
                    :title="item.remarks"
                    @click="copyRemarks(item.remarks)"
                  >备注</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <!-- 国补照片 -->
                <td class="text-center subsidy-photo-cell">
                  <div
                    class="photo-icon-wrapper clickable"
                    @click.stop="openPhotoManageDialog(item)"
                    :title="item.subsidy_photos && item.subsidy_photos.length > 0 ? '点击查看/管理国补照片' : '点击上传国补照片'"
                  >
                    <template v-if="item.subsidy_photos && item.subsidy_photos.length > 0">
                      <i class="fas fa-images photo-icon"></i>
                      <span class="photo-count">{{ item.subsidy_photos.length }}</span>
                    </template>
                    <template v-else>
                      <i class="fas fa-image photo-icon-empty"></i>
                      <span class="upload-hint">图片</span>
                    </template>
                  </div>
                </td>
                <!-- 国补提交 -->
                <td v-if="isFieldVisible('subsidy', 'time_info.apply_time')">
                  <div v-if="item.apply_time && item.apply_time !== '' && item.apply_time !== null" class="time-badge approval-time">
                    <i class="fas fa-check-circle"></i>
                    {{ formatDate(item.apply_time) }}
                  </div>
                  <el-button
                    v-else
                    v-if="canApprove"
                    type="warning"
                    @click="handleAudit(item)"
                    size="small"
                  >
                    <i class="fas fa-clipboard-check"></i>
                    <span>审批</span>
                  </el-button>
                </td>
                <!-- 国补到账 -->
                <td v-if="isFieldVisible('subsidy', 'time_info.arrival_time')">
                  <div v-if="item.arrival_time && item.arrival_time !== '' && item.arrival_time !== null" class="time-badge arrival-time">
                    <i class="fas fa-coins"></i>
                    {{ formatDate(item.arrival_time) }}
                  </div>
                  <el-button
                    v-else
                    v-permission="'subsidy:edit'"
                    type="success"
                    @click="handleConfirmArrival(item)"
                    size="small"
                  >
                    <i class="fas fa-hand-holding-usd"></i>
                    <span>到账</span>
                  </el-button>
                </td>
                <!-- 操作 -->
                <td v-if="canEdit || canDelete" class="actions-col">
                  <div class="action-buttons">
                    <!-- 编辑按钮 -->
                    <el-button
                      v-if="canEdit"
                      type="primary"
                      @click="handleEdit(item)"
                      size="small"
                      title="编辑"
                    >
                      <i class="fas fa-edit"></i>
                      <span class="btn-text">编辑</span>
                    </el-button>
                    <!-- 删除按钮 -->
                    <el-button
                      v-if="canDelete"
                      type="danger"
                      @click="handleDelete(item)"
                      size="small"
                      title="删除"
                    >
                      <i class="fas fa-trash-alt"></i>
                      <span class="btn-text">删除</span>
                    </el-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 移动端卡片布局 -->
          <div v-else class="mobile-card-list">
            <div
              v-for="item in displayList"
              :key="item.id"
              class="mobile-card"
              @dblclick="handleRowDoubleClick(item)"
              :class="{ 'pinned-card': pinnedItems.some(p => p.id === item.id) }"
            >
              <!-- 设备信息区 -->
              <div class="card-section device-section">
                <div class="section-title">
                  <i class="fas fa-mobile-alt"></i>
                  <span>设备信息</span>
                </div>
                <div class="section-grid compact-grid">
                  <div class="grid-item">
                    <span class="item-label">型号</span>
                    <span class="item-value">{{ item.phone_model }}</span>
                  </div>
                  <div class="grid-item">
                    <span class="item-label">颜色</span>
                    <span class="item-value">{{ item.phone_color }}</span>
                  </div>
                  <div class="grid-item">
                    <span class="item-label">内存</span>
                    <span class="item-value">{{ item.phone_memory }}</span>
                  </div>
                  <div class="grid-item" v-if="item.serial_number">
                    <span class="item-label">序列号</span>
                    <span class="item-value clickable-text" @click="copyToClipboard(item.serial_number, '序列号')">
                      {{ item.serial_number }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 购买信息区 -->
              <div class="card-section purchase-section">
                <div class="section-title">
                  <i class="fas fa-user"></i>
                  <span>购买信息</span>
                </div>
                <div class="customer-info-list">
                  <div class="info-row-first" v-if="getDisplayInfo(item, 'name')">
                    <span class="info-label">姓名</span>
                    <span
                      class="info-value customer-info-toggle"
                      :class="{
                        'has-handler-but-showing-purchaser': hasHandlerInfo(item) && !isShowingHandlerInfo(item),
                        'showing-handler': isShowingHandlerInfo(item)
                      }"
                      @click="hasHandlerInfo(item) ? toggleListItemCustomerInfo(item.id) : copyToClipboard(getDisplayInfo(item, 'name'), '姓名')"
                    >
                      {{ getDisplayInfo(item, 'name') }}
                    </span>
                    <span class="info-label phone-label" v-if="getDisplayInfo(item, 'phone')">手机</span>
                    <span class="info-value clickable-text" v-if="getDisplayInfo(item, 'phone')" @click="copyToClipboard(getDisplayInfo(item, 'phone'), '手机号')">
                      {{ getDisplayInfo(item, 'phone') }}
                    </span>
                  </div>
                  <div class="info-row-second" v-if="getDisplayInfo(item, 'idcard') && canViewField('customer_idcard')">
                    <span class="info-label">身份证</span>
                    <span class="info-value clickable-text" @click="copyToClipboard(getDisplayInfo(item, 'idcard'), '身份证号')">
                      {{ getDisplayInfo(item, 'idcard') }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- 价格与状态区 -->
              <div class="card-section price-section">
                <div class="section-title">
                  <i class="fas fa-tags"></i>
                  <span>价格与状态</span>
                </div>
                <div class="section-grid compact-grid">
                  <div class="grid-item" v-if="item.sale_price">
                    <span class="item-label">销售价</span>
                    <span class="item-value price-highlight">¥{{ item.sale_price?.toFixed(2) }}</span>
                  </div>
                  <div class="grid-item" v-if="item.subsidy_amount">
                    <span class="item-label">国补后价</span>
                    <span class="item-value subsidy-amount">¥{{ (item.sale_price - item.subsidy_amount).toFixed(2) }}</span>
                  </div>
                  <div class="grid-item" v-if="item.store_name">
                    <span class="item-label">店铺</span>
                    <span class="item-value">{{ item.store_name }}</span>
                  </div>
                  <div class="grid-item" v-if="item.sale_time">
                    <span class="item-label">销售日期</span>
                    <span class="item-value">{{ formatDate(item.sale_time) }}</span>
                  </div>
                  <!-- 国补提交 -->
                  <div class="grid-item" v-if="isFieldVisible('subsidy', 'time_info.apply_time')">
                    <span class="item-label">国补提交</span>
                    <div class="item-value">
                      <!-- 已提交：显示时间 -->
                      <span v-if="item.apply_time && item.apply_time !== '' && item.apply_time !== null" class="time-badge approval-time">
                        <i class="fas fa-check-circle"></i>
                        {{ formatDate(item.apply_time) }}
                      </span>
                      <!-- 未提交：显示操作按钮 -->
                      <el-button
                        v-else
                        v-if="canApprove"
                        type="warning"
                        @click.stop="handleAudit(item)"
                        size="small"
                      >
                        <i class="fas fa-clipboard-check"></i>
                        <span>提交审批</span>
                      </el-button>
                    </div>
                  </div>
                  <!-- 国补到账 -->
                  <div class="grid-item" v-if="isFieldVisible('subsidy', 'time_info.arrival_time')">
                    <span class="item-label">国补到账</span>
                    <div class="item-value">
                      <!-- 已到账：显示时间 -->
                      <span v-if="item.arrival_time && item.arrival_time !== '' && item.arrival_time !== null" class="time-badge arrival-time">
                        <i class="fas fa-coins"></i>
                        {{ formatDate(item.arrival_time) }}
                      </span>
                      <!-- 未到账：显示操作按钮 -->
                      <el-button
                        v-else
                        v-permission="'subsidy:edit'"
                        type="success"
                        @click.stop="handleConfirmArrival(item)"
                        size="small"
                      >
                        <i class="fas fa-hand-holding-usd"></i>
                        <span>确认到账</span>
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 二维码悬浮提示 -->
          <div
            v-if="qrCodeVisible"
            class="qrcode-tooltip"
            :style="qrCodePosition"
            @mouseenter="keepQRCodeVisible"
            @mouseleave="hideQRCode"
          >
            <div class="qrcode-title">{{ qrCodeTitle }}</div>
            <div class="qrcode-value">{{ qrCodeValue }}</div>
            <canvas ref="qrCodeCanvas"></canvas>
          </div>
        </div>

        <!-- 分页 -->
        <PaginationComponent
          v-if="subsidyPagination && subsidyPagination.total > 0"
          :current="subsidyPagination.current"
          :page-size="subsidyPagination.pageSize"
          :total="subsidyPagination.total"
          :page-sizes="[20, 50, 100, 200]"
          :show-total="true"
          :show-range="true"
          :show-page-sizes="true"
          :show-quick-jumper="true"
          @update:current="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
      </div>
    </div>

    <!-- 新建申请对话框 -->
    <MobileDialog
      v-model="showApplyDialog"
      title="新建国补申请"
      width="900px"
      :force-fullscreen="isMobile"
      dialog-class="subsidy-dialog subsidy-dialog-wide"
      :show-default-footer="false"
      :close-on-click-modal="false"
      @close="closeApplyDialog"
    >
      <div class="modal-body">
        <div class="apply-form">
            <!-- 步骤1：搜索设备列表 -->
            <div v-if="applyStep === 1" class="search-step">
              <h3>步骤1：搜索设备</h3>
              <p class="step-hint">输入IMEI或序列号，在搜索结果中选择正确的设备</p>

              <div class="search-box-input-only">
                <input
                  v-model="searchIdentifier"
                  type="text"
                  class="search-input-lg"
                  placeholder="输入IMEI或序列号..."
                  @keyup.enter="searchPhones"
                />
              </div>

              <!-- 设备列表搜索结果 -->
              <div v-if="deviceList.length > 0" class="device-list">
                <div class="device-list-header">
                  <h4>找到 {{ deviceList.length }} 个匹配设备</h4>
                </div>
                <div class="device-list-container">
                  <div
                    v-for="device in deviceList"
                    :key="device.phone_id"
                    :class="['device-item', { 'selected': selectedDevice?.phone_id === device.phone_id }]"
                    @click="selectDevice(device)"
                  >
                    <div class="device-main">
                      <div class="device-model">
                        <strong>{{ device.brand }} {{ device.model }}</strong>
                      </div>
                      <div class="device-specs">
                        {{ device.color }} / {{ device.memory }}
                      </div>
                      <div class="device-identifiers">
                        <span><i class="fas fa-barcode"></i> {{ device.imei }}</span>
                        <span><i class="fas fa-hashtag"></i> {{ device.serial_number }}</span>
                      </div>
                      <div class="device-customer" v-if="device.customer_name || device.customer_phone">
                        <span><i class="fas fa-user"></i> {{ device.customer_name || '未知客户' }}</span>
                        <span><i class="fas fa-phone"></i> {{ device.customer_phone || '-' }}</span>
                      </div>
                    </div>
                    <div class="device-meta">
                      <div class="device-price">¥{{ device.sale_price?.toFixed(2) }}</div>
                      <div class="device-status">
                        <span :class="['status-tag', device.can_apply_subsidy ? 'eligible' : 'not-eligible']">
                          {{ device.reason }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <!-- 空结果提示 -->
              <div v-else-if="searchCompleted && deviceList.length === 0" class="empty-devices">
                <i class="fas fa-search"></i>
                <p>未找到匹配的设备</p>
                <el-button type="info" @click="resetDeviceSearch">
                  重新搜索
                </el-button>
              </div>
            </div>

            <!-- 步骤2：确认申请信息 -->
            <div v-if="applyStep === 2 && phoneDetail" class="confirm-step">
              <h3>步骤2：确认申请信息</h3>

              <div class="confirm-info">
                <div class="info-group">
                  <h4>客户信息</h4>
                  <div class="info-row-inline">
                    <div class="inline-item">
                      <span class="info-label">姓名:</span>
                      <span class="info-value">{{ phoneDetail.customer_name }}</span>
                    </div>
                    <div class="inline-item">
                      <span class="info-label">电话:</span>
                      <span class="info-value">{{ phoneDetail.customer_phone }}</span>
                    </div>
                  </div>
                  <div class="info-row-inline">
                    <div class="inline-item">
                      <span class="info-label">身份证:</span>
                      <div class="info-value">
                        <input
                          v-model="applyForm.customer_idcard"
                          type="text"
                          class="form-input-inline"
                          :class="{ 'has-value': applyForm.customer_idcard }"
                          placeholder="请输入身份证号"
                          @input="applyForm.customer_idcard = normalizeIdCard(applyForm.customer_idcard)"
                        />
                        <span v-if="phoneDetail.customer_idcard && applyForm.customer_idcard === phoneDetail.customer_idcard" class="idcard-hint">
                          已获取
                        </span>
                        <span v-else-if="applyForm.customer_idcard" class="idcard-hint modified">
                          已修改
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 实际办理人信息（可选） -->
                <div class="info-group handler-info-section">
                  <div class="handler-info-header">
                    <h4>非本人办理</h4>
                    <label class="checkbox-inline">
                      <input
                        type="checkbox"
                        v-model="applyForm.hasDifferentHandler"
                      />
                      <span>填写其他办理人信息</span>
                    </label>
                  </div>

                  <div v-if="applyForm.hasDifferentHandler" class="handler-info-content">
                    <div class="info-row">
                      <span class="info-label required">姓名:</span>
                      <div class="info-value">
                        <input
                          v-model="applyForm.handlerName"
                          type="text"
                          class="form-input-inline"
                          placeholder="实际办理人姓名"
                          @input="applyForm.handlerName = normalizePersonName(applyForm.handlerName, 20)"
                        />
                      </div>
                    </div>
                    <div class="info-row">
                      <span class="info-label required">电话:</span>
                      <div class="info-value">
                        <input
                          v-model="applyForm.handlerPhone"
                          type="text"
                          class="form-input-inline"
                          placeholder="实际办理人电话"
                          @input="applyForm.handlerPhone = normalizePhoneDigits(applyForm.handlerPhone)"
                        />
                      </div>
                    </div>
                    <div class="info-row">
                      <span class="info-label required">身份证:</span>
                      <div class="info-value">
                        <input
                          v-model="applyForm.handlerIdcard"
                          type="text"
                          class="form-input-inline"
                          placeholder="实际办理人身份证"
                          @input="applyForm.handlerIdcard = normalizeIdCard(applyForm.handlerIdcard)"
                        />
                      </div>
                    </div>
                  </div>


                </div>

                <div class="info-group">
                  <h4>设备信息</h4>
                  <div class="info-row-inline">
                    <div class="inline-item">
                      <span class="info-label">型号:</span>
                      <span class="info-value">{{ phoneDetail.phone_brand }} {{ phoneDetail.phone_model }}</span>
                    </div>
                    <div class="inline-item">
                      <span class="info-label">颜色:</span>
                      <span class="info-value">{{ phoneDetail.phone_color }}</span>
                    </div>
                    <div class="inline-item">
                      <span class="info-label">内存:</span>
                      <span class="info-value">{{ phoneDetail.phone_memory }}</span>
                    </div>
                  </div>
                  <div class="info-row-inline">
                    <div class="inline-item">
                      <span class="info-label">IMEI1:</span>
                      <span class="info-value">{{ phoneDetail.imei1 }}</span>
                    </div>
                  </div>
                  <div class="info-row-inline">
                    <div class="inline-item">
                      <span class="info-label">IMEI2:</span>
                      <div class="info-value">
                        <input
                          v-model="applyForm.imei2"
                          type="text"
                          class="form-input-inline"
                          placeholder="请输入IMEI2"
                        />
                      </div>
                    </div>
                  </div>
                  <div class="info-row-inline">
                    <div class="inline-item">
                      <span class="info-label">序列号:</span>
                      <span class="info-value">{{ phoneDetail.serial_number }}</span>
                    </div>
                  </div>
                </div>

                <div class="info-group">
                  <h4>销售信息</h4>
                  <div class="info-row-inline">
                    <div class="inline-item">
                      <span class="info-label">销售价格:</span>
                      <span class="info-value">¥{{ phoneDetail.sale_price?.toFixed(2) }}</span>
                    </div>
                    <div class="inline-item">
                      <span class="info-label">店铺:</span>
                      <span class="info-value">{{ phoneDetail.store_name }}</span>
                    </div>
                    <div class="inline-item">
                      <span class="info-label">销售时间:</span>
                      <span class="info-value">{{ formatDate(phoneDetail.sale_time) }}</span>
                    </div>
                  </div>
                </div>

                <div class="info-group highlight">
                  <h4>补贴信息</h4>
                  <div class="info-row-inline">
                    <div class="inline-item">
                      <span class="info-label">销售价格:</span>
                      <span class="info-value">¥{{ Math.round(phoneDetail.sale_price) }}</span>
                    </div>
                    <div class="inline-item">
                      <span class="info-label">补贴金额:</span>
                      <span class="info-value discount-amount">-¥{{ Math.round(calculatedSubsidyAmount) }}</span>
                    </div>
                    <div class="inline-item">
                      <span class="info-label">到手价格:</span>
                      <span class="info-value final-price">¥{{ Math.round(phoneDetail.sale_price - calculatedSubsidyAmount) }}</span>
                    </div>
                  </div>
                  <div class="info-row subsidy-photo-row">
                    <span class="info-label">国补计算价:</span>
                    <div class="info-value">
                      <el-input-number
                        v-model="applyForm.subsidy_calc_price"
                        :precision="2"
                        :step="100"
                        :min="0"
                        :max="phoneDetail.sale_price"
                        :controls="true"
                        placeholder="国补计算价格"
                        style="width: 150px"
                        @change="calculateSubsidyAmount"
                      />
                      <span v-if="applyForm.subsidy_calc_price && applyForm.subsidy_calc_price !== phoneDetail.sale_price" class="price-diff-hint">
                        (差价: ¥{{ (phoneDetail.sale_price - applyForm.subsidy_calc_price).toFixed(2) }})
                      </span>
                      <!-- 国补照片上传按钮 -->
                      <el-upload
                        class="subsidy-photo-upload"
                        :headers="uploadHeaders"
                        :data="{
                          serial_number: phoneDetail?.serial_number || 'unknown',
                          sale_time: phoneDetail?.sale_time || ''
                        }"
                        :show-file-list="false"
                        :http-request="customUploadRequest"
                        accept="image/*,.heic,.heif,.pdf,application/pdf"
                        multiple
                      >
                        <el-button type="primary" size="small" class="photo-upload-btn">
                          <i class="fas fa-camera"></i>
                          <span>国补照片上传</span>
                        </el-button>
                      </el-upload>
                      <!-- 已上传照片预览 -->
                      <div v-if="applyForm.subsidy_photos.length > 0" class="uploaded-photos-preview">
                        <div
                          v-for="(photo, index) in applyForm.subsidy_photos"
                          :key="index"
                          class="photo-thumbnail"
                          @click="showPhotoPreview(applyForm.subsidy_photos, index)"
                        >
                          <Image :src="photo" alt="国补照片" mode="eager" class="photo-thumbnail" />
                          <i class="fas fa-times remove-photo" @click.stop="removePhoto(index)"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="!isEligibleForSubsidy" class="subsidy-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    国补计算价格超过6000元，无法享受国补补贴
                  </div>
                  <div v-if="phoneDetail.existing_subsidy" class="existing-subsidy-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    该设备已存在国补申请 (状态: {{ getStatusText(phoneDetail.existing_subsidy.apply_status) }})
                  </div>
                </div>

                <div class="form-group">
                  <label>备注</label>
                  <textarea
                    v-model="applyForm.remarks"
                    class="form-textarea"
                    rows="3"
                    placeholder="请输入备注信息（可选）"
                  ></textarea>
                </div>
              </div>

            </div>
          </div>
      </div>

      <template #footer>
        <div class="apply-dialog-footer">
          <!-- 步骤1的底部按钮 -->
          <template v-if="applyStep === 1">
            <el-button type="default" @click="closeApplyDialog">
              <i class="fas fa-times"></i>
              取消
            </el-button>
            <el-button
              v-if="deviceList.length > 0"
              type="info"
              @click="resetDeviceSearch"
            >
              <i class="fas fa-redo"></i>
              重新搜索
            </el-button>
            <el-button
              type="primary"
              @click="searchPhones"
              :disabled="!searchIdentifier || searching"
            >
              <i v-if="searching" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-search"></i>
              <span>搜索</span>
            </el-button>
            <el-button
              v-if="selectedDevice"
              type="success"
              @click="loadPhoneDetail"
              :disabled="loadingDetail || selectedDevice.has_subsidy"
            >
              <i v-if="loadingDetail" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-arrow-right"></i>
              <span>{{ selectedDevice.has_subsidy ? '该设备已记录国补' : '下一步' }}</span>
            </el-button>
          </template>

          <!-- 步骤2的底部按钮 -->
          <template v-if="applyStep === 2 && phoneDetail">
            <el-button type="default" @click="closeApplyDialog">
              <i class="fas fa-times"></i>
              取消
            </el-button>
            <el-button type="info" @click="applyStep = 1">
              <i class="fas fa-arrow-left"></i>
              上一步
            </el-button>
            <el-button
              v-if="!phoneDetail.existing_subsidy"
              type="success"
              @click="submitApply"
              :disabled="submitting"
            >
              <i v-if="submitting" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-check"></i>
              <span>提交资料</span>
            </el-button>
          </template>
        </div>
      </template>
    </MobileDialog>

    <!-- 编辑对话框 -->
    <MobileDialog
      v-model="showEditDialog"
      title="编辑国补信息"
      width="760px"
      dialog-class="subsidy-dialog"
      :show-default-footer="false"
    >
      <div class="modal-body">
        <el-form v-if="editForm" label-width="100px" class="edit-form">
            <!-- 第一行：客户姓名和手机号 -->
            <div class="form-row">
              <el-form-item label="客户姓名">
                <el-input
                  v-model="editForm.customer_name"
                  placeholder="请输入客户姓名"
                  clearable
                  @input="editForm.customer_name = normalizePersonName(editForm.customer_name, 20)"
                />
              </el-form-item>

              <el-form-item label="客户手机">
                <el-input
                  v-model="editForm.customer_phone"
                  placeholder="请输入客户手机号"
                  clearable
                  maxlength="11"
                  @input="editForm.customer_phone = normalizePhoneDigits(editForm.customer_phone)"
                />
              </el-form-item>
            </div>

            <!-- 第二行：身份证号和销售时间 -->
            <div class="form-row">
              <el-form-item
                v-if="canViewField('customer_idcard') && canEditField('customer_idcard')"
                label="身份证号"
              >
                <el-input
                  v-model="editForm.customer_idcard"
                  placeholder="请输入身份证号"
                  @input="editForm.customer_idcard = normalizeIdCard(editForm.customer_idcard)"
                />
              </el-form-item>

              <el-form-item label="销售时间">
                <el-date-picker
                  v-model="editForm.sale_time"
                  type="date"
                  placeholder="选择销售日期"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  class="form-input"
                  clearable
                />
              </el-form-item>
            </div>

            <!-- 序列号 - 可编辑字段 -->
            <el-form-item label="序列号">
              <el-input
                v-model="editForm.serial_number"
                placeholder="请输入序列号"
                clearable
                @input="formatSerialNumber"
              />
            </el-form-item>

            <!-- 店铺选择 - 可编辑字段 -->
            <el-form-item label="销售店铺">
              <el-select
                v-model="editForm.store_id"
                placeholder="请选择销售店铺"
                filterable
                clearable
              >
                <el-option
                  v-for="store in stores"
                  :key="store.id"
                  :label="store.name"
                  :value="store.id"
                />
              </el-select>
              <div class="form-tip">
                <i class="fas fa-info-circle"></i>
                修改销售店铺
              </div>
            </el-form-item>

            <!-- 第三行：IMEI1 和 IMEI2 -->
            <div class="form-row">
              <el-form-item label="IMEI1">
                <el-input
                  v-model="editForm.imei1"
                  placeholder="请输入IMEI1"
                  clearable
                  maxlength="15"
                  @input="formatIMEI1"
                />
              </el-form-item>

              <el-form-item
                v-if="canViewField('imei2') && canEditField('imei2')"
                label="IMEI2"
              >
                <el-input
                  v-model="editForm.imei2"
                  placeholder="请输入IMEI2"
                  clearable
                  maxlength="15"
                  @input="formatIMEI2"
                />
              </el-form-item>
            </div>

            <!-- 提交时间和到账时间 - 同一行显示 -->
            <div class="form-row" v-if="canViewField('apply_time') || canViewField('arrival_time')">
              <el-form-item
                v-if="canViewField('apply_time') && canEditField('apply_time')"
                label="提交时间"
              >
                <el-date-picker
                  v-model="editForm.apply_time"
                  type="date"
                  placeholder="选择提交日期"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  class="form-input"
                  clearable
                />
              </el-form-item>

              <el-form-item
                v-if="canViewField('arrival_time') && canEditField('arrival_time')"
                label="到账时间"
              >
                <el-date-picker
                  v-model="editForm.arrival_time"
                  type="date"
                  placeholder="选择到账日期"
                  format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD"
                  class="form-input"
                  clearable
                />
              </el-form-item>
            </div>

            <!-- 备注 - 可编辑字段 -->
            <el-form-item
              v-if="canViewField('remarks') && canEditField('remarks')"
              label="备注"
            >
              <el-input
                v-model="editForm.remarks"
                type="textarea"
                :rows="3"
                placeholder="请输入备注信息（可选）"
              />
            </el-form-item>

            <!-- 实际办理人信息 - 可编辑字段 -->
            <el-divider content-position="left">
              <i class="fas fa-user-edit"></i> 代办人信息
            </el-divider>

            <el-form-item label="他人代办">
              <el-switch
                v-model="editForm.hasDifferentHandler"
                active-text="是"
                inactive-text="否"
              />
              <span class="form-item-tip">
                {{ editForm.hasDifferentHandler ? '办理者信息' : '' }}
              </span>
            </el-form-item>

            <template v-if="editForm.hasDifferentHandler">
              <el-form-item label="代办人姓名">
                <el-input
                  v-model="editForm.handlerName"
                  placeholder="请输入实际代办人姓名"
                  clearable
                  @input="editForm.handlerName = normalizePersonName(editForm.handlerName, 20)"
                />
              </el-form-item>

              <el-form-item label="代办人手机">
                <el-input
                  v-model="editForm.handlerPhone"
                  placeholder="请输入实际代办人手机号"
                  clearable
                  maxlength="11"
                  @input="editForm.handlerPhone = normalizePhoneDigits(editForm.handlerPhone)"
                />
              </el-form-item>

              <el-form-item label="代办人身份证">
                <el-input
                  v-model="editForm.handlerIdcard"
                  placeholder="请输入实际代办人身份证号"
                  clearable
                  maxlength="18"
                  @input="editForm.handlerIdcard = normalizeIdCard(editForm.handlerIdcard)"
                />
              </el-form-item>
            </template>

            <!-- 只读信息展示 -->
            <el-divider v-if="hasReadOnlyFields()"></el-divider>
            <div v-if="hasReadOnlyFields()" class="readonly-fields">
              <div class="readonly-title">以下信息为只读：</div>
              <el-descriptions :column="1" border>
                <el-descriptions-item
                  v-if="canViewField('customer_idcard') && !canEditField('customer_idcard') && editForm.customer_idcard"
                  label="客户身份证号"
                >
                  {{ editForm.customer_idcard || '-' }}
                </el-descriptions-item>
                <el-descriptions-item
                  v-if="canViewField('imei2') && !canEditField('imei2') && editForm.imei2"
                  label="IMEI2"
                >
                  {{ editForm.imei2 || '-' }}
                </el-descriptions-item>
                <el-descriptions-item
                  v-if="canViewField('apply_time') && !canEditField('apply_time') && editForm.apply_time"
                  label="提交时间"
                >
                  {{ formatDateTime(editForm.apply_time) }}
                </el-descriptions-item>
                <el-descriptions-item
                  v-if="canViewField('arrival_time') && !canEditField('arrival_time') && editForm.arrival_time"
                  label="到账时间"
                >
                  {{ formatDateTime(editForm.arrival_time) }}
                </el-descriptions-item>
                <el-descriptions-item
                  v-if="canViewField('remarks') && !canEditField('remarks') && editForm.remarks"
                  label="备注"
                >
                  {{ editForm.remarks || '-' }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
        </el-form>
      </div>

      <template #footer>
        <div class="modal-footer">
          <el-button type="info" @click="closeEditDialog">
            取消
          </el-button>
          <el-button
            type="primary"
            @click="submitEdit"
            :disabled="editing"
          >
            <i v-if="editing" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            <span>保存</span>
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <!-- 批量修改时间对话框 -->
    <MobileDialog
      v-model="showBatchDialog"
      title="批量修改时间"
      width="560px"
      dialog-class="subsidy-dialog subsidy-batch-dialog"
      :show-default-footer="false"
    >
      <div class="modal-body">
        <div class="batch-info-summary">
          <i class="fas fa-thumbtack"></i>
          <span>将对 <strong>{{ selectedItems.length }}</strong> 条选中记录进行修改</span>
        </div>
        <div class="batch-info-summary info">
          <i class="fas fa-lightbulb"></i>
          <span>只更新有选择日期的字段，留空的字段不会修改</span>
        </div>

        <el-form label-width="100px" class="batch-form">
          <el-form-item label="提交时间">
            <el-date-picker
              v-model="batchForm.apply_time"
              type="date"
              placeholder="不修改则留空"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              class="w-full"
            />
            <div class="form-tip">
              <i class="fas fa-info-circle"></i>
              留空表示不修改此字段
            </div>
          </el-form-item>

          <el-form-item label="到账时间">
            <el-date-picker
              v-model="batchForm.arrival_time"
              type="date"
              placeholder="不修改则留空"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              class="w-full"
            />
            <div class="form-tip">
              <i class="fas fa-info-circle"></i>
              留空表示不修改此字段
            </div>
          </el-form-item>

          <div class="batch-quick-actions">
            <el-button size="small" @click="setTodayDate('apply_time')">
              <i class="fas fa-calendar-day"></i>
              提交时间设为今天
            </el-button>
            <el-button size="small" @click="setTodayDate('arrival_time')">
              <i class="fas fa-calendar-day"></i>
              到账时间设为今天
            </el-button>
            <el-button size="small" @click="setTodayDate('both')">
              <i class="fas fa-calendar-day"></i>
              全部设为今天
            </el-button>
          </div>
        </el-form>

        <div v-if="selectedItems.length > 0" class="pinned-items-preview">
          <div class="preview-header">
            <i class="fas fa-list"></i>
            <span>将修改的记录预览</span>
          </div>
          <div class="preview-list">
            <div v-for="item in selectedPreviewItems" :key="item.id" class="preview-item">
              <span class="item-name">{{ item.customer_name }}</span>
              <span class="item-phone">{{ item.customer_phone }}</span>
              <span class="item-model">{{ item.phone_model }}</span>
            </div>
            <div v-if="selectedItems.length > 5" class="preview-more">
              还有 {{ selectedItems.length - 5 }} 条记录...
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <el-button type="default" @click="closeBatchDialog">
            <i class="fas fa-times"></i>
            取消
          </el-button>
          <el-button
            type="primary"
            @click="submitBatchUpdate"
            :disabled="batchUpdating || (!batchForm.apply_time && !batchForm.arrival_time)"
          >
            <i v-if="batchUpdating" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            <span>确认修改 ({{ selectedItems.length }}条)</span>
          </el-button>
        </div>
      </template>
    </MobileDialog>

    <!-- 详情对话框 -->
    <MobileDialog
      v-model="showDetailDialog"
      title="国补申请详情"
      width="90%"
      dialog-class="subsidy-detail-dialog"
      :show-default-footer="false"
      :style="{ '--dialog-max-width': '700px' }"
    >
      <div v-if="currentDetail" class="detail-content">
        <!-- 客户信息(可切换显示实际办理人信息) -->
        <div
          class="detail-section customer-info-section"
          :class="{
            'showing-handler': showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo,
            'has-handler-info': currentDetail.hasDifferentHandler && currentDetail.handlerInfo
          }"
          @click="toggleCustomerInfo"
        >
          <h4>
            <span>{{ showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo ? '📋 实际办理人信息' : '客户信息' }}</span>
            <span v-if="currentDetail.hasDifferentHandler && currentDetail.handlerInfo" class="toggle-hint">
              {{ showHandlerInfo ? '👆 点击切换到购买者信息' : '👆 点击切换到办理人信息' }}
            </span>
          </h4>
          <div class="detail-row">
            <span class="detail-label">姓名:</span>
            <span class="detail-value">
              {{ showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo
                ? currentDetail.handlerInfo.handlerName
                : currentDetail.customer_name }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">电话:</span>
            <span class="detail-value">
              {{ showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo
                ? currentDetail.handlerInfo.handlerPhone
                : currentDetail.customer_phone }}
            </span>
          </div>
          <div class="detail-row" v-if="canViewField('customer_idcard')">
            <span class="detail-label">身份证:</span>
            <span class="detail-value">
              {{
                showHandlerInfo && currentDetail.hasDifferentHandler && currentDetail.handlerInfo
                  ? (currentDetail.handlerInfo.handlerIdcard || '未填写')
                  : (currentDetail.customer_idcard || '未填写')
              }}
            </span>
          </div>
        </div>

        <div class="detail-section">
          <h4>设备信息</h4>
          <div class="detail-row">
            <span class="detail-label">型号:</span>
            <span class="detail-value">{{ currentDetail.phone_brand }} {{ currentDetail.phone_model }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">规格:</span>
            <span class="detail-value">{{ currentDetail.phone_color }} / {{ currentDetail.phone_memory }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">IMEI1:</span>
            <span class="detail-value">{{ currentDetail.imei1 }}</span>
          </div>
          <div class="detail-row" v-if="currentDetail.imei2">
            <span class="detail-label">IMEI2:</span>
            <span class="detail-value">{{ currentDetail.imei2 }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">序列号:</span>
            <span class="detail-value">{{ currentDetail.serial_number }}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>销售信息</h4>
          <div class="detail-row">
            <span class="detail-label">销售价格:</span>
            <span class="detail-value">¥{{ currentDetail.sale_price?.toFixed(2) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">店铺:</span>
            <span class="detail-value">{{ currentDetail.store_name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">销售员:</span>
            <span class="detail-value">{{ currentDetail.salesman_name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">销售时间:</span>
            <span class="detail-value">{{ formatDate(currentDetail.sale_time) }}</span>
          </div>
        </div>

        <div class="detail-section highlight">
          <h4>补贴信息</h4>
          <div class="detail-row">
            <span class="detail-label">补贴比例:</span>
            <span class="detail-value">{{ currentDetail.subsidy_rate }}%</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">补贴金额:</span>
            <span class="detail-value subsidy-highlight">¥{{ currentDetail.subsidy_amount?.toFixed(2) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">申请状态:</span>
            <span :class="['detail-value', 'status-badge', `status-${currentDetail.apply_status}`]">
              {{ getStatusText(currentDetail.apply_status) }}
            </span>
          </div>
        </div>

        <div class="detail-section">
          <h4>时间信息</h4>
          <div class="detail-row" v-if="currentDetail.apply_time">
            <span class="detail-label">申请时间:</span>
            <span class="detail-value">{{ formatDateTime(currentDetail.apply_time) }}</span>
          </div>
          <div class="detail-row" v-if="currentDetail.approve_time">
            <span class="detail-label">审批时间:</span>
            <span class="detail-value">{{ formatDateTime(currentDetail.approve_time) }}</span>
          </div>
          <div class="detail-row" v-if="currentDetail.approve_user_name">
            <span class="detail-label">审批人:</span>
            <span class="detail-value">{{ currentDetail.approve_user_name }}</span>
          </div>
          <div class="detail-row" v-if="currentDetail.arrival_time">
            <span class="detail-label">到账时间:</span>
            <span class="detail-value">{{ formatDateTime(currentDetail.arrival_time) }}</span>
          </div>
        </div>

        <div v-if="currentDetail.remarks" class="detail-section">
          <h4>备注</h4>
          <p class="detail-remarks">{{ currentDetail.remarks }}</p>
        </div>
      </div>
    </MobileDialog>

    <!-- 国补照片管理模态框 -->
    <el-dialog
      v-model="showPhotoPreviewDialog"
      title="国补照片管理"
      width="900px"
      class="photo-preview-dialog"
      :close-on-click-modal="true"
      destroy-on-close
      @close="closePhotoManageDialog"
    >
      <div class="photo-preview-content">
        <!-- 上传区域 -->
        <div class="photo-upload-area">
          <el-upload
            :action="`${apiBaseUrl}/subsidy/upload/photo`"
            :headers="uploadHeaders"
            :data="{
              serial_number: currentManagingItem?.serial_number || 'unknown',
              sale_time: currentManagingItem?.sale_time || ''
            }"
            :show-file-list="false"
            :http-request="customUploadRequest"
            accept="image/*,.heic,.heif,.pdf,application/pdf"
            multiple
          >
            <el-button type="primary" size="default">
              <i class="fas fa-image"></i> 上传图片
            </el-button>
          </el-upload>
          <span class="upload-tip">支持PDF、图片批量上传</span>
        </div>

        <!-- 照片网格展示区 -->
        <div v-if="previewPhotos.length > 0" class="photo-grid-area">
          <!-- 批量操作工具栏 -->
          <div class="photo-toolbar">
            <div class="toolbar-left">
              <el-checkbox
                v-model="photoSelectAll"
                :indeterminate="photoIsIndeterminate"
                @change="handlePhotoSelectAll"
              >
                全选
              </el-checkbox>
              <span v-if="selectedPhotos.length > 0" class="selected-count">
                已选择 {{ selectedPhotos.length }} 张
              </span>
            </div>
            <div class="toolbar-right">
              <el-button
                v-if="selectedPhotos.length > 0"
                type="primary"
                size="small"
                @click="downloadSelectedPhotos"
              >
                <i class="fas fa-download"></i> 下载选中
              </el-button>
              <el-button
                v-if="selectedPhotos.length > 0"
                type="danger"
                size="small"
                @click="deleteSelectedPhotos"
              >
                <i class="fas fa-trash"></i> 删除选中
              </el-button>
            </div>
          </div>

          <!-- 照片网格 -->
          <div
            class="photo-grid"
            @mousedown="startDragSelect"
            @mousemove="onDragSelect"
            @mouseup="endDragSelect"
            @mouseleave="endDragSelect"
          >
            <div
              v-for="(photo, index) in previewPhotos"
              :key="photo"
              class="photo-grid-item"
              :class="{ selected: selectedPhotos.includes(index) }"
              :data-index="index"
              @mouseenter="onPhotoHover(index)"
            >
              <!-- 选择框 -->
              <div class="photo-checkbox" @click.stop="togglePhotoSelection(index)">
                <el-checkbox :model-value="selectedPhotos.includes(index)" />
              </div>

              <!-- 图片 -->
              <Image :src="photo" alt="国补照片" mode="eager" class="photo-viewer-image" />

              <!-- 悬停操作按钮 -->
              <div class="photo-actions">
                <el-button
                  class="action-btn view-btn"
                  circle
                  @click="openPhotoViewer(index)"
                >
                  <i class="fas fa-search-plus"></i>
                </el-button>
                <el-button
                  class="action-btn delete-btn"
                  circle
                  @click.stop="removePhotoFromPreview(index)"
                >
                  <i class="fas fa-trash-alt"></i>
                </el-button>
              </div>

              <!-- 选中遮罩 -->
              <div v-if="selectedPhotos.includes(index)" class="selected-overlay">
                <i class="fas fa-check-circle"></i>
              </div>
            </div>
          </div>

          <div class="photo-count-info">
            <i class="fas fa-images"></i> 共 {{ previewPhotos.length }} 张照片
          </div>
        </div>

        <!-- 无照片提示 -->
        <div v-else class="no-photo-hint">
          <i class="fas fa-image"></i>
          <p>暂无照片，请点击上方按钮上传</p>
        </div>
      </div>
      <template #footer>
        <div class="photo-preview-footer">
          <el-button @click="closePhotoManageDialog">
            <i class="fas fa-times"></i> 取消
          </el-button>
          <el-button v-if="previewPhotos.length > 0" type="success" @click="downloadAllPhotos">
            <i class="fas fa-download"></i> 下载全部
          </el-button>
          <el-button type="primary" @click="savePhotoChanges" :loading="savingPhotos">
            <i class="fas fa-save"></i> 保存
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 照片查看器（放大预览） -->
    <el-dialog
      v-model="showPhotoViewer"
      :title="`照片预览 (${currentPhotoIndex + 1}/${previewPhotos.length})`"
      width="90%"
      class="photo-viewer-dialog"
      :close-on-click-modal="true"
      destroy-on-close
    >
      <div class="photo-viewer-content">
        <div class="photo-viewer-main">
          <el-button
            class="photo-nav-btn prev"
            circle
            :disabled="currentPhotoIndex === 0"
            @click="prevPhoto"
          >
            <i class="fas fa-chevron-left"></i>
          </el-button>
          <div class="photo-viewer-image">
            <Image :src="previewPhotos[currentPhotoIndex]" alt="国补照片" mode="eager" />
          </div>
          <el-button
            class="photo-nav-btn next"
            circle
            :disabled="currentPhotoIndex === previewPhotos.length - 1"
            @click="nextPhoto"
          >
            <i class="fas fa-chevron-right"></i>
          </el-button>
        </div>
        <div class="photo-viewer-actions">
          <el-button type="primary" @click="downloadCurrentPhoto">
            <i class="fas fa-download"></i> 下载
          </el-button>
          <el-button type="danger" @click="removePhotoFromPreview(currentPhotoIndex)">
            <i class="fas fa-trash"></i> 删除
          </el-button>
        </div>
      </div>
    </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { unifiedApi } from '@/utils/unified-api';
import { fieldPermissions } from '@/composables/useFieldPermissions';
import { usePagePermissions } from '@/composables/usePagePermissions';
import { useRefreshData } from '@/composables/useRefreshData';
import { useLoadingState } from '@/composables';
import { useImportExport } from '@/composables/useImportExport';
import { useCachedRequest, DEFAULT_CACHE_TTL } from '@/composables/usePageCache';
import QRCode from 'qrcode';
import PaginationComponent from '@/components/Pagination.vue';
import { TimeUtil, TIME_FORMATS } from '@/utils/time';
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue';
import ImportExportActions from '@/components/business/ImportExportActions.vue';
import { PageHeader, PermissionDenied } from '@/components/base';
import Image from '@/components/Image.vue';
import { deleteTempFiles } from '@/utils/temp-file-cleaner';
import { formatImageUrl } from '@/utils/format';
import { storage } from '@/composables/core/useLocalStorage';
import { normalizeIdCard, normalizePersonName, normalizePhoneDigits } from '@/utils/security';
import { logger } from '@/utils/logger';

// 权限检查
const {
  canView,
  canCreate,
  canEdit,
  canDelete,
  canApprove,
  canExport,
  handleNoPermission
} = usePagePermissions('subsidy');
const { refreshing, refresh } = useRefreshData();
const permissionLoading = ref(false);

// 字段权限（使用全局composable）
const { isFieldVisible, isFieldEditable, permissions, init: initFieldPermissions } = fieldPermissions;

// 字段ID映射表 - 映射简单字段名到完整字段ID
const fieldIdMap: Record<string, string> = {
  'stats_total_and_handler': 'stats.total_and_handler',
  'stats_approval_progress': 'stats.approval_progress',
  'stats_amount_progress': 'stats.amount_progress',
  'stats_store_overview': 'stats.store_overview',
  // 客户信息
  'customer_name': 'customer_info.customer_name',
  'customer_phone': 'customer_info.customer_phone',
  'customer_idcard': 'customer_info.customer_idcard',
  // 设备信息
  'imei1': 'device_info.imei1',
  'imei2': 'device_info.imei2',
  'brand': 'device_info.brand',
  'model': 'device_info.model',
  'color': 'device_info.color',
  'memory': 'device_info.memory',
  // 价格信息
  'sale_price': 'price_info.sale_price',
  'subsidy_amount': 'price_info.subsidy_amount',
  // 时间信息
  'apply_time': 'time_info.apply_time',
  'arrival_time': 'time_info.arrival_time',
  // 状态信息
  'status': 'status_info.status',
  // 其他信息
  'remarks': 'other_info.remarks',
  // 店铺和时间（使用通用格式）
  'store_name': 'store_name',
  'sale_time': 'sale_time',
  'serial_number': 'serial_number'
};

// 检查字段是否可见
const canViewField = (fieldName: string): boolean => {
  const fullFieldId = fieldIdMap[fieldName] || fieldName;
  return isFieldVisible('subsidy', fullFieldId);
};

// 检查字段是否可编辑
const canEditField = (fieldName: string): boolean => {
  const fullFieldId = fieldIdMap[fieldName] || fieldName;

  if (canCreate.value || canEdit.value) {
    return canViewField(fieldName);
  }

  return isFieldEditable('subsidy', fullFieldId);
};

// 检查是否有只读字段需要显示
const hasReadOnlyFields = (): boolean => {
  const allFields = ['customer_idcard', 'imei2', 'apply_time', 'arrival_time', 'remarks'];
  return allFields.some(field => canViewField(field) && !canEditField(field));
};

const showStatsCards = computed(() => {
  return [
    'stats_total_and_handler',
    'stats_approval_progress',
    'stats_amount_progress',
    'stats_store_overview'
  ].some(field => canViewField(field));
});

// 表格列配置（参考综合查询页面实现）
const tableColumns = computed(() => {
  const hasEditPermission = canEdit.value;
  const hasDeletePermission = canDelete.value;
  const hasActionPermission = hasEditPermission || hasDeletePermission;

  return [
    { key: 'store_name', label: '店铺', visible: isFieldVisible('subsidy', 'store_name') },
    { key: 'sale_time', label: '销售日期', visible: isFieldVisible('subsidy', 'sale_time') },
    { key: 'customer_name', label: '姓名', visible: isFieldVisible('subsidy', 'customer_info.customer_name') },
    { key: 'customer_phone', label: '手机', visible: isFieldVisible('subsidy', 'customer_info.customer_phone') },
    { key: 'customer_idcard', label: '身份证', visible: isFieldVisible('subsidy', 'customer_info.customer_idcard') },
    { key: 'brand', label: '品牌', visible: isFieldVisible('subsidy', 'device_info.brand') },
    { key: 'model', label: '型号', visible: isFieldVisible('subsidy', 'device_info.model') },
    { key: 'color', label: '颜色', visible: isFieldVisible('subsidy', 'device_info.color') },
    { key: 'memory', label: '内存', visible: isFieldVisible('subsidy', 'device_info.memory') },
    { key: 'serial_number', label: '序列号', visible: isFieldVisible('subsidy', 'serial_number') },
    { key: 'imei1', label: 'IMEI1', visible: isFieldVisible('subsidy', 'device_info.imei1') },
    { key: 'imei2', label: 'IMEI2', visible: isFieldVisible('subsidy', 'device_info.imei2') },
    { key: 'sale_price', label: '销售价', visible: isFieldVisible('subsidy', 'price_info.sale_price') },
    { key: 'subsidy_amount', label: '国补后价', visible: isFieldVisible('subsidy', 'price_info.subsidy_amount') },
    { key: 'remarks', label: '备注', visible: isFieldVisible('subsidy', 'price_info.subsidy_amount') },
    { key: 'subsidy_photos', label: '国补照片', visible: true },
    { key: 'apply_time', label: '国补提交', visible: isFieldVisible('subsidy', 'time_info.apply_time') },
    { key: 'arrival_time', label: '国补到账', visible: isFieldVisible('subsidy', 'time_info.arrival_time') },
    { key: 'actions', label: '操作', visible: hasActionPermission }
  ].filter(col => col.visible);
});

// 响应式数据
const { loading } = useLoadingState();
const { exportFile, importFile, saveBlobFile, buildDateFilename } = useImportExport();
const subsidyList = ref<any[]>([]);
const exportingSubsidy = ref(false);
const pinnedItems = ref<any[]>([]); // 固定在顶部的选中项
const selectedItems = ref<number[]>([]); // 批量选中的ID列表
const showBatchDialog = ref(false); // 批量操作对话框
const batchForm = reactive({
  apply_time: '',
  arrival_time: ''
}); // 批量修改表单

// 国补照片相关
const showPhotoPreviewDialog = ref(false);
const showPhotoViewer = ref(false); // 照片查看器（放大预览）
const previewPhotos = ref<string[]>([]);
const currentPhotoIndex = ref(0);
const currentManagingItem = ref<any>(null); // 当前正在管理照片的记录
const savingPhotos = ref(false); // 保存照片的加载状态
const deletedPhotos = ref<string[]>([]); // 记录被删除的照片URL
const uploadedPhotos = ref<string[]>([]); // 记录本次上传的照片URL（未保存前）
const applyFormTempPhotos = ref<string[]>([]); // 申请表单中上传的临时照片（未提交前）
const selectedPhotos = ref<number[]>([]); // 选中的照片索引
const photoSelectAll = ref(false); // 照片全选状态
const isDragging = ref(false); // 是否正在拖动选择
const dragStartIndex = ref<number | null>(null); // 拖动起始索引
const dragMode = ref<'select' | 'deselect'>('select'); // 拖动模式：选中或取消选中

// 照片全选状态（半选）
const photoIsIndeterminate = computed(() => {
  return selectedPhotos.value.length > 0 && selectedPhotos.value.length < previewPhotos.value.length;
});
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

// 上传请求头（携带认证token）
const uploadHeaders = computed(() => {
  // 使用统一存储服务获取 token
  const token = storage.getToken();

  return {
    Authorization: token ? `Bearer ${token}` : ''
  };
});

// 计算属性：合并后的显示列表（固定项 + 普通列表）
const displayList = computed(() => {
  // 去重：从普通列表中移除已固定的项
  const pinnedIds = new Set(pinnedItems.value.map(item => item.id));
  const remainingItems = subsidyList.value.filter(item => !pinnedIds.has(item.id));
  return [...pinnedItems.value, ...remainingItems];
});

// 批量修改预览（选中项，含置顶项）
const selectedPreviewItems = computed(() => {
  if (selectedItems.value.length === 0) return [];
  const selectedSet = new Set(selectedItems.value);
  return displayList.value.filter(item => selectedSet.has(item.id)).slice(0, 5);
});
const stats = ref({
  total_count: 0,
  pending_count: 0,
  completed_count: 0,
  approved_count: 0,
  total_arrived_amount: 0,
  total_subsidy_amount: 0,
  handler_count: 0,
  store_stats: [] as Array<{
    store_id: number;
    store_name: string;
    count: number;
    total_count: number;
  }>
});

const filters = reactive({
  search: '',
  status: '',
  store_id: '',
  sale_date_start: '',
  sale_date_end: '',
  submit_date_start: '',
  submit_date_end: '',
  arrive_date_start: '',
  arrive_date_end: ''
});

// 店铺列表
const stores = ref<any[]>([]);

// 日期范围变量
const saleDateRange = ref<[string, string] | null>(null);
const submitDateRange = ref<[string, string] | null>(null);
const arriveDateRange = ref<[string, string] | null>(null);

// 判断是否为移动端
const isMobile = computed(() => {
  return window.innerWidth <= 768;
});

// 搜索展开状态 - 统一管理
const searchExpanded = ref(false)

// 防抖搜索 - 输入框输入时延迟搜索
let debounceSearchTimeoutId: ReturnType<typeof setTimeout> | null = null

const debounceSearch = () => {
  // 取消之前的搜索
  if (debounceSearchTimeoutId) {
    clearTimeout(debounceSearchTimeoutId)
  }
  // 设置延迟搜索
  debounceSearchTimeoutId = setTimeout(() => {
    handleSearch()
  }, 500) // 500ms 防抖
}

// 切换高级搜索（保留兼容性）
const toggleAdvancedSearch = () => {
  searchExpanded.value = !searchExpanded.value
}

// 处理行双击事件
const handleRowDoubleClick = (item: any) => {
  // 移动端和PC端都打开详情模态框
  handleViewDetail(item);
};

// 是否有活跃的筛选条件
const hasActiveFilters = computed(() => {
  return !!(
    filters.search ||
    filters.status ||
    filters.store_id ||
    filters.sale_date_start ||
    filters.sale_date_end ||
    filters.submit_date_start ||
    filters.submit_date_end ||
    filters.arrive_date_start ||
    filters.arrive_date_end
  );
});

interface SubsidyPagination {
  current: number
  pageSize: number
  total: number
  totalPages: number
}

const subsidyPagination: SubsidyPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
});

// 对话框状态
const showApplyDialog = ref(false);
const showDetailDialog = ref(false);
const showEditDialog = ref(false);

// 批量操作相关
const batchUpdating = ref(false);

// 计算属性：全选状态
const selectAll = computed({
  get: () => selectedItems.value.length > 0 && selectedItems.value.length === displayList.value.length,
  set: (value: boolean) => {
    if (value) {
      selectedItems.value = displayList.value.map(item => item.id);
    } else {
      selectedItems.value = [];
    }
  }
});

// 计算属性：半选状态
const isIndeterminate = computed(() => {
  const len = selectedItems.value.length;
  return len > 0 && len < displayList.value.length;
});

// 编辑相关
const editing = ref(false);
const editForm = ref<any>(null);
const currentEditId = ref<number | null>(null);

// 申请表单相关
const applyStep = ref(1);
const searchIdentifier = ref('');
const searching = ref(false);
const searchCompleted = ref(false);
const loadingDetail = ref(false);
const deviceList = ref<any[]>([]);
const selectedDevice = ref<any>(null);
const phoneDetail = ref<any>(null);
const submitting = ref(false);

const applyForm = reactive({
  imei2: '',
  customer_idcard: '',
  remarks: '',
  // 国补计算价格（默认为销售价格，但可调整）
  subsidy_calc_price: null as number | null,
  // 国补照片
  subsidy_photos: [] as string[],
  // 实际办理人信息
  hasDifferentHandler: false, // 是否启用实际办理人信息录入
  handlerName: '', // 实际办理人姓名
  handlerPhone: '', // 实际办理人电话
  handlerIdcard: '' // 实际办理人身份证
});

// 当前详情
const currentDetail = ref<any>(null);

// 客户信息切换状态(用于在购买者和实际办理人信息之间切换)
const showHandlerInfo = ref(false);

// 列表项的办理人信息显示状态 Map<itemId, boolean>
const listShowHandlerInfo = ref<Map<number, boolean>>(new Map());

const normalizeHandlerInfo = (handlerInfo?: Record<string, any> | null) => {
  if (!handlerInfo || typeof handlerInfo !== 'object') {
    return null;
  }

  return {
    ...handlerInfo,
    handlerName: normalizePersonName(handlerInfo.handlerName || '', 20),
    handlerPhone: normalizePhoneDigits(handlerInfo.handlerPhone || ''),
    handlerIdcard: normalizeIdCard(handlerInfo.handlerIdcard || '')
  };
};

const normalizeSubsidyRecord = (item?: Record<string, any> | null) => {
  if (!item || typeof item !== 'object') {
    return item;
  }

  return {
    ...item,
    customer_name: normalizePersonName(item.customer_name || '', 20),
    customer_phone: normalizePhoneDigits(item.customer_phone || ''),
    customer_idcard: normalizeIdCard(item.customer_idcard || ''),
    handlerInfo: normalizeHandlerInfo(item.handlerInfo)
  };
};

// 切换客户信息显示
const toggleCustomerInfo = () => {
  if (currentDetail.value && currentDetail.value.hasDifferentHandler && currentDetail.value.handlerInfo) {
    showHandlerInfo.value = !showHandlerInfo.value;
  }
};

// 切换列表项的客户信息显示
const toggleListItemCustomerInfo = (itemId: number) => {
  const currentState = listShowHandlerInfo.value.get(itemId) || false;
  listShowHandlerInfo.value.set(itemId, !currentState);
};

// 获取列表项应该显示的信息
const getDisplayInfo = (item: any, field: 'name' | 'phone' | 'idcard') => {
  const normalizedItem = normalizeSubsidyRecord(item) || {};
  const showHandler = listShowHandlerInfo.value.get(item.id) || false;
  const handlerInfo = normalizeHandlerInfo(normalizedItem.handlerInfo);

  if (showHandler && normalizedItem.hasDifferentHandler && handlerInfo) {
    // 显示实际办理人信息
    switch (field) {
      case 'name':
        return handlerInfo.handlerName;
      case 'phone':
        return handlerInfo.handlerPhone;
      case 'idcard':
        return handlerInfo.handlerIdcard;
    }
  }

  // 显示购买者信息
  switch (field) {
    case 'name':
      return normalizedItem.customer_name;
    case 'phone':
      return normalizedItem.customer_phone;
    case 'idcard':
      return normalizedItem.customer_idcard;
  }
};

// 检查列表项是否有办理人信息
const hasHandlerInfo = (item: any) => {
  return item.hasDifferentHandler && item.handlerInfo;
};

// 检查列表项是否显示办理人信息
const isShowingHandlerInfo = (item: any) => {
  return listShowHandlerInfo.value.get(item.id) || false;
};

// 二维码相关
const qrCodeVisible = ref(false);
const qrCodePosition = ref({ top: '0px', left: '0px' });
const qrCodeTitle = ref('');
const qrCodeValue = ref('');
const qrCodeCanvas = ref<HTMLCanvasElement | null>(null);
let qrCodeHideTimer: ReturnType<typeof setTimeout> | null = null;

// 复制到剪贴板
const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(`${label}已复制`);
  } catch (error) {
    // 降级方案：使用传统方法
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      ElMessage.success(`${label}已复制`);
    } catch (err) {
      ElMessage.error('复制失败');
    }
    document.body.removeChild(textarea);
  }
};

// 显示二维码
const showQRCode = (event: MouseEvent, value: string, title: string) => {
  if (qrCodeHideTimer) {
    clearTimeout(qrCodeHideTimer);
    qrCodeHideTimer = null;
  }

  qrCodeValue.value = value;
  qrCodeTitle.value = title;
  qrCodeVisible.value = true;

  // 计算位置 - 智能判断显示在上方还是下方
  const target = event.target as HTMLElement;
  const rect = target.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  // 二维码提示框的预估高度（包含 padding）
  const tooltipHeight = 300; // 二维码(200) + padding(32) + 标题(30) + 值显示(40)
  const tooltipWidth = 252; // min-width(220) + padding(32)
  const gap = 10; // 与目标的间距

  // 检查下方是否有足够空间
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  let top: string;
  let left: string;

  // 根据可用空间决定显示在上方还是下方
  if (spaceBelow < tooltipHeight && spaceAbove > spaceBelow) {
    // 下方空间不足，且上方空间更大，显示在上方
    top = `${rect.top + scrollTop - tooltipHeight - gap}px`;
  } else {
    // 默认显示在下方
    top = `${rect.bottom + scrollTop + gap}px`;
  }

  // 水平位置检查，避免超出右侧边界
  let leftPos = rect.left + scrollLeft;
  if (leftPos + tooltipWidth > window.innerWidth) {
    leftPos = window.innerWidth - tooltipWidth - scrollLeft - 20;
  }
  left = `${Math.max(10, leftPos)}px`;

  qrCodePosition.value = { top, left };

  // 生成二维码
  setTimeout(async () => {
    await generateQRCode(value);
  }, 100);
};

// 隐藏二维码
const hideQRCode = () => {
  qrCodeHideTimer = setTimeout(() => {
    qrCodeVisible.value = false;
  }, 200);
};

// 保持二维码可见
const keepQRCodeVisible = () => {
  if (qrCodeHideTimer) {
    clearTimeout(qrCodeHideTimer);
    qrCodeHideTimer = null;
  }
};

// 生成二维码
const generateQRCode = async (text: string) => {
  const canvas = qrCodeCanvas.value;
  if (!canvas) return;

  try {
    // 使用 qrcode 库生成可扫描的二维码
    await QRCode.toCanvas(canvas, text, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    logger.error('二维码生成失败:', error);
  }
};

// 删除不再需要的辅助函数
const drawPositionPattern = undefined;
const hashString = undefined;

const buildQueryParams = (includePagination: boolean) => {
  const params: any = {};

  if (includePagination) {
    params.page = subsidyPagination.current;
    params.limit = subsidyPagination.pageSize;
    params.sort_by = 'sale_time';
    params.sort_order = 'desc';
  }

  if (filters.status) params.status = filters.status;

  // 搜索关键词支持多个字段
  if (filters.search) {
    // 同时搜索客户电话、客户姓名、身份证、品牌、型号、颜色、内存、序列号、IMEI1、IMEI2
    params.customer_phone = filters.search;
    params.customer_name = filters.search;
    params.customer_idcard = filters.search;  // 身份证
    params.brand = filters.search;             // 品牌
    params.model = filters.search;             // 型号
    params.color = filters.search;             // 颜色
    params.memory = filters.search;            // 内存
    params.imei1 = filters.search;             // IMEI1
    params.imei2 = filters.search;             // IMEI2
    params.serial_number = filters.search;     // 序列号
  }

  if (filters.store_id) params.store_id = filters.store_id;

  // 销售时间筛选
  if (filters.sale_date_start) params.start_date = filters.sale_date_start;
  if (filters.sale_date_end) params.end_date = filters.sale_date_end;

  // 提交时间筛选
  if (filters.submit_date_start) params.apply_start_date = filters.submit_date_start;
  if (filters.submit_date_end) params.apply_end_date = filters.submit_date_end;

  // 到账时间筛选
  if (filters.arrive_date_start) params.arrival_start_date = filters.arrive_date_start;
  if (filters.arrive_date_end) params.arrival_end_date = filters.arrive_date_end;

  return params;
};

const handleExportSubsidy = async () => {
  await exportFile({
    url: '/subsidy/export/excel',
    filename: buildDateFilename('国补管理', 'xlsx'),
    params: buildQueryParams(false),
    allowed: canExport,
    loading: exportingSubsidy,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '国补数据导出成功'
  });
};

// 获取国补列表
const fetchSubsidyList = async () => {
  try {
    loading.value = true;

    const params = buildQueryParams(true);

    const response = await unifiedApi.get('/subsidy', { params });

    if (response.success) {
      subsidyList.value = Array.isArray(response.data)
        ? response.data.map(item => normalizeSubsidyRecord(item))
        : [];
      subsidyPagination.current = Number(response.pagination?.page) || 1;
      subsidyPagination.pageSize = Number(response.pagination?.limit) || 20;
      subsidyPagination.total = Number(response.pagination?.total) || 0;
      subsidyPagination.totalPages = Number(response.pagination?.pages) || 0;
    } else {
      ElMessage.error(response.message || '获取国补列表失败');
    }
  } catch (error: any) {
    logger.error('获取国补列表失败:', error);
    ElMessage.error('获取国补列表失败');
  } finally {
    loading.value = false;
  }
};

// 获取统计数据
const fetchStats = async () => {
  try {
    const params = buildQueryParams(false);
    const response = await unifiedApi.get('/subsidy/stats/summary', { params });

    if (response.success) {
      stats.value = response.data;
    }
  } catch (error: any) {
    logger.error('获取统计数据失败:', error);
  }
};

// 打开申请对话框
const openApplyDialog = () => {
  if (!canCreate.value) {
    handleNoPermission('create');
    return;
  }

  applyStep.value = 1;
  showApplyDialog.value = true;
};

// 搜索设备列表
const searchPhones = async () => {
  if (!searchIdentifier.value.trim()) {
    ElMessage.warning('请输入IMEI或序列号');
    return;
  }

  try {
    searching.value = true;
    searchCompleted.value = false;
    deviceList.value = [];
    selectedDevice.value = null;

    const response = await unifiedApi.get(`/subsidy/search-phones/${encodeURIComponent(searchIdentifier.value.trim())}`);

    if (response.success) {
      deviceList.value = Array.isArray(response.data)
        ? response.data.map(item => normalizeSubsidyRecord(item))
        : [];
    } else {
      ElMessage.error(response.message || '未找到设备');
    }
  } catch (error: any) {
    logger.error('搜索设备失败:', error);
    ElMessage.error(error.response?.data?.message || '搜索失败');
  } finally {
    searching.value = false;
    searchCompleted.value = true;
  }
};

// 选择设备
const selectDevice = (device: any) => {
  selectedDevice.value = device;
};

// 加载设备详情
const loadPhoneDetail = async () => {
  if (!selectedDevice.value) return;

  try {
    loadingDetail.value = true;

    const response = await unifiedApi.get(`/subsidy/phone-detail/${selectedDevice.value.phone_id}`);

    if (response.success) {
      const normalizedPhoneDetail = normalizeSubsidyRecord(response.data);
      phoneDetail.value = normalizedPhoneDetail;
      applyForm.customer_idcard = normalizedPhoneDetail.customer_idcard || '';
      // 初始化国补计算价格为销售价格
      applyForm.subsidy_calc_price = normalizedPhoneDetail.sale_price;

      // 自动生成备注：设备序列号、购买时间、商品销售价、实际刷卡支付、国补优惠
      const salePrice = normalizedPhoneDetail.sale_price || 0;

      // 延迟生成备注，确保subsidy_calc_price已设置，使用nextTick避免响应式未更新问题
      nextTick(() => {
        // 检查是否可以享受国补（价格6000以内）
        if (salePrice > 6000) {
          applyForm.remarks = `商品销售价${salePrice}元（超过6000元，无法享受国补优惠）`;
        } else {
          // 计算补贴金额：商品价格的15%，最高500元
          const subsidyAmount = Math.min(salePrice * 0.15, 500);
          const cardPayment = (salePrice - subsidyAmount).toFixed(2);
          const sn = normalizedPhoneDetail.serial_number || '';
          // 格式化购买时间为北京时间
          const st = normalizedPhoneDetail.sale_time ? TimeUtil.format(normalizedPhoneDetail.sale_time, TIME_FORMATS.DATE) : '';
          applyForm.remarks = `序列号：${sn}\n购买时间：${st}\n商品售价：${salePrice}元 国补优惠${subsidyAmount}元 实际刷卡支付${cardPayment}元`;
        }
      });

      applyStep.value = 2;
    } else {
      ElMessage.error(response.message || '获取详情失败');
    }
  } catch (error: any) {
    logger.error('获取详情失败:', error);
    ElMessage.error(error.response?.data?.message || '获取详情失败');
  } finally {
    loadingDetail.value = false;
  }
};

// 重置设备搜索
const resetDeviceSearch = () => {
  searchIdentifier.value = '';
  deviceList.value = [];
  selectedDevice.value = null;
  searchCompleted.value = false;
};

// 重置申请表单
const resetApplyForm = () => {
  applyStep.value = 1;
  searchIdentifier.value = '';
  deviceList.value = [];
  selectedDevice.value = null;
  phoneDetail.value = null;
  searchCompleted.value = false;
  applyForm.imei2 = '';
  applyForm.customer_idcard = '';
  applyForm.remarks = '';
  applyForm.subsidy_calc_price = null;
  applyForm.subsidy_photos = []; // 清空照片数组
  applyFormTempPhotos.value = []; // 清空临时照片记录
  // 重置实际办理人信息
  applyForm.hasDifferentHandler = false;
  applyForm.handlerName = '';
  applyForm.handlerPhone = '';
  applyForm.handlerIdcard = '';
};

// 关闭申请对话框
const closeApplyDialog = async () => {
  // 如果有未提交的临时照片，清理它们
  if (applyFormTempPhotos.value.length > 0) {
    try {
      await deleteTempFiles(applyFormTempPhotos.value);
    } catch (error) {
      logger.error('清理申请表单临时照片失败:', error);
    }
  }
  resetApplyForm();
  showApplyDialog.value = false;
};

// 计算补贴金额
const calculatedSubsidyAmount = computed(() => {
  if (!phoneDetail.value || !applyForm.subsidy_calc_price) {
    return 0;
  }

  const calcPrice = applyForm.subsidy_calc_price;
  const subsidyRate = phoneDetail.value.subsidy_rate || 15;
  const maxSubsidy = 500;

  // 只有国补计算价不超过6000才能享受补贴
  if (calcPrice > 6000) {
    return 0;
  }

  const calculated = calcPrice * (subsidyRate / 100);
  return Math.min(calculated, maxSubsidy);
});

// 判断是否符合国补条件
const isEligibleForSubsidy = computed(() => {
  if (!applyForm.subsidy_calc_price) {
    return false;
  }
  return applyForm.subsidy_calc_price <= 6000;
});

// 计算补贴金额（用于el-input-number的change事件）
const calculateSubsidyAmount = () => {
  // 这个函数不需要做任何事，因为calculatedSubsidyAmount会自动计算
  // 保留它是为了在模板中调用
};

// 提交申请
const submitApply = async () => {
  if (!canCreate.value) {
    handleNoPermission('create');
    return;
  }

  if (!phoneDetail.value) return;

  applyForm.customer_idcard = normalizeIdCard(applyForm.customer_idcard || '');
  applyForm.handlerName = normalizePersonName(applyForm.handlerName || '', 20);
  applyForm.handlerPhone = normalizePhoneDigits(applyForm.handlerPhone || '');
  applyForm.handlerIdcard = normalizeIdCard(applyForm.handlerIdcard || '');

  // 验证 IMEI2 必填
  if (!applyForm.imei2 || applyForm.imei2.trim() === '') {
    ElMessage.warning('请输入IMEI2');
    return;
  }

  // 如果启用了实际办理人信息,验证必填字段
  if (applyForm.hasDifferentHandler) {
    if (!applyForm.handlerName || applyForm.handlerName.trim() === '') {
      ElMessage.warning('请输入实际办理人姓名');
      return;
    }
    if (!applyForm.handlerPhone || applyForm.handlerPhone.trim() === '') {
      ElMessage.warning('请输入实际办理人电话');
      return;
    }
    if (!applyForm.handlerIdcard || applyForm.handlerIdcard.trim() === '') {
      ElMessage.warning('请输入实际办理人身份证（国补开票必需）');
      return;
    }
    // 简单验证电话格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(applyForm.handlerPhone.trim())) {
      ElMessage.warning('实际办理人电话格式不正确');
      return;
    }
    // 简单验证身份证格式(18位)
    const idcardRegex = /^\d{17}[\dXx]$/;
    if (!idcardRegex.test(applyForm.handlerIdcard.trim())) {
      ElMessage.warning('实际办理人身份证格式不正确');
      return;
    }
    // 关系说明改为可选,不需要验证
  }

  try {
    submitting.value = true;

    const data = {
      ...phoneDetail.value,
      imei2: applyForm.imei2.trim(),
      customer_idcard: applyForm.customer_idcard,
      remarks: applyForm.remarks,
      subsidy_photos: applyForm.subsidy_photos, // 添加照片数组
      // 使用国补计算价格和计算后的补贴金额
      subsidy_calc_price: applyForm.subsidy_calc_price || phoneDetail.value.sale_price,
      subsidy_amount: calculatedSubsidyAmount.value,
      // 实际办理人信息
      hasDifferentHandler: applyForm.hasDifferentHandler,
      handlerInfo: applyForm.hasDifferentHandler ? normalizeHandlerInfo({
        handlerName: applyForm.handlerName.trim(),
        handlerPhone: applyForm.handlerPhone.trim(),
        handlerIdcard: applyForm.handlerIdcard.trim()
      }) : null
    };

    const response = await unifiedApi.post('/subsidy/apply', data);

    if (response.success) {
      ElMessage.success('国补资料记录成功');
      applyFormTempPhotos.value = []; // 提交成功，清空临时照片记录（不需要删除文件，因为已保存）
      showApplyDialog.value = false;
      resetApplyForm();
      await fetchSubsidyList();
      await fetchStats();
    } else {
      ElMessage.error(response.message || '记录失败');
    }
  } catch (error: any) {
    logger.error('提交申请失败:', error);
    ElMessage.error(error.response?.data?.message || '记录失败');
  } finally {
    submitting.value = false;
  }
};

// 查看详情
const handleViewDetail = async (item: any) => {
  try {
    const response = await unifiedApi.get(`/subsidy/${item.id}`);

    if (response.success) {
      currentDetail.value = normalizeSubsidyRecord(response.data);
      showHandlerInfo.value = false; // 重置切换状态,默认显示购买者信息

      showDetailDialog.value = true;
    } else {
      ElMessage.error('获取详情失败');
    }
  } catch (error: any) {
    logger.error('获取详情失败:', error);
    ElMessage.error('获取详情失败');
  }
};

// 计算备注内容（用于编辑时自动填充）
const calculateRemarks = (item: any) => {
  // 如果已有备注，保留原备注
  if (item.remarks && item.remarks.trim() !== '') {
    return item.remarks;
  }

  // 如果没有销售价，返回空
  const salePrice = item.sale_price || 0;
  if (!salePrice) return '';

  // 检查是否可以享受国补（价格6000以内）
  if (salePrice > 6000) {
    return `商品售价${salePrice}元（超过6000元，无法享受国补优惠）`;
  }

  // 计算补贴金额：商品价格的15%，最高500元
  const subsidyAmount = item.subsidy_amount || Math.min(salePrice * 0.15, 500);
  const cardPayment = (salePrice - subsidyAmount).toFixed(2);
  const sn = item.serial_number || '';
  // 格式化购买时间为北京时间
  const st = item.sale_time ? TimeUtil.format(item.sale_time, TIME_FORMATS.DATE) : '';

  return `序列号：${sn}\n购买时间：${st}\n商品售价：${salePrice}元 国补优惠${subsidyAmount}元 实际刷卡支付${cardPayment}元`;
};

// 审批
// 编辑国补信息
const handleEdit = (item: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit');
    return;
  }

  currentEditId.value = item.id;

  // 格式化日期时间为 datetime-local 输入格式 (YYYY-MM-DDTHH:mm)
  // 🔥 先去除JSON引号，再截取前10个字符作为日期
  const formatDateTimeForInput = (dateStr: string) => {
    if (!dateStr) return '';
    // 去除外层引号（处理JSON字符串带引号问题）
    const cleanDateStr = dateStr.replace(/^"|"$/g, '');
    // 直接截取前10个字符 (YYYY-MM-DD) 作为日期，使用默认时间 00:00
    const datePart = cleanDateStr.substring(0, 10);
    return `${datePart}T00:00`;
  };

  // 格式化日期为 date 输入格式 (YYYY-MM-DD)
  // 🔥 先去除JSON引号，再截取前10个字符作为日期
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    // 去除外层引号（处理JSON字符串带引号问题）
    const cleanDateStr = dateStr.replace(/^"|"$/g, '');
    // 直接截取前10个字符 (YYYY-MM-DD)
    const datePart = cleanDateStr.substring(0, 10);
    return datePart;
  };

  // 获取当前北京时间 (YYYY-MM-DD)
  // 🔥 统一使用 TimeUtil 工具，避免手动时区转换
  const getCurrentBeijingDate = () => {
    return TimeUtil.nowFormatted(TIME_FORMATS.DATE);
  };

  editForm.value = {
    customer_name: normalizePersonName(item.customer_name || '', 20),
    customer_phone: normalizePhoneDigits(item.customer_phone || ''),
    sale_time: item.sale_time || '',
    customer_idcard: normalizeIdCard(item.customer_idcard || ''),
    serial_number: item.serial_number || '',
    store_id: item.store_id || null,
    imei1: item.imei1 || '',
    imei2: item.imei2 || '',
    apply_time: item.apply_time || '',
    arrival_time: item.arrival_time || '',
    // 自动计算填充备注
    remarks: calculateRemarks(item),
    // 实际办理人信息
    hasDifferentHandler: item.hasDifferentHandler || false,
    handlerName: normalizePersonName(item.handlerInfo?.handlerName || '', 20),
    handlerPhone: normalizePhoneDigits(item.handlerInfo?.handlerPhone || ''),
    handlerIdcard: normalizeIdCard(item.handlerInfo?.handlerIdcard || '')
  };
  showEditDialog.value = true;
};

// 删除国补记录
const handleDelete = async (item: any) => {
  if (!canDelete.value) {
    handleNoPermission('delete');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除这条国补记录吗？客户：${item.customer_name}，金额：¥${item.subsidy_amount?.toFixed(2)}`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await unifiedApi.delete(`/subsidy/${item.id}`);

    if (response.success) {
      ElMessage.success('删除成功');
      await fetchSubsidyList();
      await fetchStats();
    } else {
      ElMessage.error(response.message || '删除失败');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('删除失败:', error);
      ElMessage.error('删除失败');
    }
  }
};

const getTodayDateStr = () => TimeUtil.nowFormatted(TIME_FORMATS.DATE);

// 审批国补申请（记录审批时间）
const handleAudit = async (item: any) => {
  if (!canApprove.value) {
    handleNoPermission('approve');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定审批该国补申请吗？客户：${item.customer_name}，金额：¥${item.subsidy_amount?.toFixed(2)}`,
      '审批确认',
      {
        confirmButtonText: '确定审批',
        cancelButtonText: '取消',
        type: 'info'
      }
    );

    const response = await unifiedApi.put(`/subsidy/${item.id}/audit`);

    if (response.success) {
      item.apply_time = getTodayDateStr();
      ElMessage.success('审批成功');
      await fetchSubsidyList();
    } else {
      ElMessage.error(response.message || '审批失败');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('审批失败:', error);
      ElMessage.error('审批失败');
    }
  }
};

// 提交编辑
const submitEdit = async () => {
  if (!currentEditId.value) return;
  if (!canEdit.value) {
    handleNoPermission('edit');
    return;
  }

  try {
    editing.value = true;
    editForm.value.customer_name = normalizePersonName(editForm.value.customer_name || '', 20);
    editForm.value.customer_phone = normalizePhoneDigits(editForm.value.customer_phone || '');
    editForm.value.customer_idcard = normalizeIdCard(editForm.value.customer_idcard || '');
    editForm.value.handlerName = normalizePersonName(editForm.value.handlerName || '', 20);
    editForm.value.handlerPhone = normalizePhoneDigits(editForm.value.handlerPhone || '');
    editForm.value.handlerIdcard = normalizeIdCard(editForm.value.handlerIdcard || '');

    const response = await unifiedApi.put(`/subsidy/${currentEditId.value}`, editForm.value);

    if (response.success) {
      ElMessage.success('更新成功');
      showEditDialog.value = false;
      await fetchSubsidyList();
    } else {
      ElMessage.error(response.message || '更新失败');
    }
  } catch (error: any) {
    logger.error('更新失败:', error);
    ElMessage.error(error.response?.data?.message || '更新失败');
  } finally {
    editing.value = false;
  }
};

// 格式化序列号 - 只保留数字和字母，字母自动大写
const formatSerialNumber = () => {
  if (editForm.value?.serial_number) {
    editForm.value.serial_number = editForm.value.serial_number
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 30)
  }
}

// 格式化IMEI1 - 只保留数字
const formatIMEI1 = () => {
  if (editForm.value?.imei1) {
    editForm.value.imei1 = editForm.value.imei1.replace(/\D/g, '').slice(0, 15)
  }
}

// 格式化IMEI2 - 只保留数字
const formatIMEI2 = () => {
  if (editForm.value?.imei2) {
    editForm.value.imei2 = editForm.value.imei2.replace(/\D/g, '').slice(0, 15)
  }
}

// 设置当前北京日期（用于编辑表单的日期字段）
const setCurrentDate = (field: 'sale_time' | 'apply_time' | 'arrival_time') => {
  editForm.value[field] = TimeUtil.nowFormatted(TIME_FORMATS.DATE);
};

// 重置编辑表单
const resetEditForm = () => {
  editForm.value = null;
  currentEditId.value = null;
};

// 关闭编辑对话框
const closeEditDialog = () => {
  resetEditForm();
  showEditDialog.value = false;
};

// 批量选择相关函数
const handleSelectItem = (id: number, checked: boolean) => {
  if (checked) {
    if (!selectedItems.value.includes(id)) {
      selectedItems.value = [...selectedItems.value, id];
    }
    return;
  }
  selectedItems.value = selectedItems.value.filter(itemId => itemId !== id);
};

const handleSelectAll = (value: boolean) => {
  selectAll.value = value;
};

const clearSelection = () => {
  selectedItems.value = [];
};

// 固定选中项到顶部
const pinSelectedItems = () => {
  if (selectedItems.value.length === 0) {
    ElMessage.warning('请先选择要固定的记录');
    return;
  }

  // 从 subsidyList 中找到选中的项
  const itemsToPin = subsidyList.value.filter(item =>
    selectedItems.value.includes(item.id)
  );

  // 检查是否已经固定过（避免重复）
  const pinnedIds = new Set(pinnedItems.value.map(p => p.id));
  const newItems = itemsToPin.filter(item => !pinnedIds.has(item.id));

  if (newItems.length === 0) {
    ElMessage.info('这些记录已经固定了');
    return;
  }

  // 添加到固定列表
  pinnedItems.value.push(...newItems);

  ElMessage.success(`已固定 ${newItems.length} 条记录到顶部`);

  // 清空当前选择
  selectedItems.value = [];
};

// 清除固定项
const clearPinnedItems = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清除所有固定的 ${pinnedItems.value.length} 条记录吗？`,
      '清除固定项确认',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    pinnedItems.value = [];
    ElMessage.success('已清除所有固定项');
  } catch {
    // 用户取消
  }
};

// 批量修改对话框
const openBatchDialog = () => {
  batchForm.apply_time = '';
  batchForm.arrival_time = '';
  showBatchDialog.value = true;
};

const closeBatchDialog = () => {
  batchForm.apply_time = '';
  batchForm.arrival_time = '';
  showBatchDialog.value = false;
};

// 设置今天日期
  // 🔥 统一使用 TimeUtil 工具，避免手动时区转换
  const setTodayDate = (field: 'apply_time' | 'arrival_time' | 'both') => {
    batchForm[field] = TimeUtil.nowFormatted(TIME_FORMATS.DATE);
  };

// 提交批量修改
const submitBatchUpdate = async () => {
  if (!batchForm.apply_time && !batchForm.arrival_time) {
    ElMessage.warning('请至少选择一个字段进行修改');
    return;
  }

  if (selectedItems.value.length === 0) {
    ElMessage.warning('没有选中项可修改');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要批量修改 ${selectedItems.value.length} 条选中记录的时间信息吗？只更新有选择日期的字段。`,
      '批量修改确认',
      {
        confirmButtonText: '确定修改',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    batchUpdating.value = true;

    const updateData: any = {};
    if (batchForm.apply_time) {
      updateData.apply_time = batchForm.apply_time;
    }
    if (batchForm.arrival_time) {
      updateData.arrival_time = batchForm.arrival_time;
    }

    // 并发更新所有固定的记录
    const updatePromises = selectedItems.value.map(id =>
      unifiedApi.put(`/subsidy/${id}`, updateData)
    );

    const results = await Promise.allSettled(updatePromises);
    const successIds: number[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && (result.value as any).success) {
        successIds.push(selectedItems.value[index]);
      }
    });
    const successCount = successIds.length;
    const failCount = results.length - successCount;

    if (successCount > 0) {
      const updateLocalList = (list: any[]) => {
        const idSet = new Set(successIds);
        list.forEach(item => {
          if (!idSet.has(item.id)) return;
          if (batchForm.apply_time) item.apply_time = batchForm.apply_time;
          if (batchForm.arrival_time) item.arrival_time = batchForm.arrival_time;
        });
      };
      updateLocalList(subsidyList.value);
      updateLocalList(pinnedItems.value);
      ElMessage.success(`成功修改 ${successCount} 条记录${failCount > 0 ? `，失败 ${failCount} 条` : ''}`);
      await fetchSubsidyList();
      await fetchStats();
      closeBatchDialog();
      selectedItems.value = [];
    } else {
      ElMessage.error('批量修改失败');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('批量修改失败:', error);
      ElMessage.error('批量修改失败');
    }
  } finally {
    batchUpdating.value = false;
  }
};

// 确认到账
const handleConfirmArrival = async (item: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定该国补款项已到账吗？金额: ¥${item.subsidy_amount?.toFixed(2)}`,
      '确认到账',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await unifiedApi.put(`/subsidy/${item.id}/confirm-arrival`);

    if (response.success) {
      item.arrival_time = getTodayDateStr();
      ElMessage.success('确认到账成功');
      await fetchSubsidyList();
      await fetchStats();
    } else {
      ElMessage.error(response.message || '确认失败');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logger.error('确认到账失败:', error);
      ElMessage.error('确认到账失败');
    }
  }
};

// 搜索
const handleSearch = () => {
  subsidyPagination.current = 1;
  fetchSubsidyList();
  fetchStats();
};

// 移动端点击输入框切换搜索展开状态
const toggleMobileSearch = () => {
  if (isMobile.value) {
    searchExpanded.value = !searchExpanded.value;
  }
};

// 搜索框获得焦点时展开（移动端）
const handleSearchFocus = () => {
  if (isMobile.value) {
    searchExpanded.value = true;
  }
};

// 搜索框失去焦点时延迟折叠（移动端）
const handleSearchBlur = () => {
  if (isMobile.value) {
    // 延迟折叠，给用户时间点击其他元素
    setTimeout(() => {
      searchExpanded.value = false;
    }, 200);
  }
};

// 销售日期范围变化
const handleSaleDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.sale_date_start = value[0];
    filters.sale_date_end = value[1];
  } else {
    filters.sale_date_start = '';
    filters.sale_date_end = '';
  }
  handleSearch();
};

// 提交日期范围变化
const handleSubmitDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.submit_date_start = value[0];
    filters.submit_date_end = value[1];
  } else {
    filters.submit_date_start = '';
    filters.submit_date_end = '';
  }
  handleSearch();
};

// 到账日期范围变化
const handleArriveDateChange = (value: [string, string] | null) => {
  if (value && value.length === 2) {
    filters.arrive_date_start = value[0];
    filters.arrive_date_end = value[1];
  } else {
    filters.arrive_date_start = '';
    filters.arrive_date_end = '';
  }
  handleSearch();
};

// 重置筛选
const resetFilters = () => {
  filters.search = '';
  filters.status = '';
  filters.store_id = '';
  filters.sale_date_start = '';
  filters.sale_date_end = '';
  filters.submit_date_start = '';
  filters.submit_date_end = '';
  filters.arrive_date_start = '';
  filters.arrive_date_end = '';
  // 重置日期范围选择器
  saleDateRange.value = null;
  submitDateRange.value = null;
  arriveDateRange.value = null;
  handleSearch();
};

// 刷新数据
// 刷新数据 - 使用统一的 composable
const handleRefresh = () => {
  refresh(async () => {
    await Promise.all([
      fetchSubsidyList(),
      fetchStats()
    ])
  })
};

// 翻页
const handlePageChange = (page: number) => {
  subsidyPagination.current = page;
  fetchSubsidyList();
};

// 每页数量变化
const handlePageSizeChange = (pageSize: number) => {
  subsidyPagination.pageSize = pageSize;
  subsidyPagination.current = 1; // 重置到第一页
  fetchSubsidyList();
};

// 格式化日期 - 使用北京时间
const formatDate = (date: string) => {
  if (!date) return '-';
  return TimeUtil.format(date, TIME_FORMATS.DATE);
};

// 格式化日期时间 - 使用北京时间
const formatDateTime = (date: string) => {
  if (!date) return '-';
  return TimeUtil.format(date, TIME_FORMATS.DATETIME_SHORT);
};

// 复制备注到剪贴板
const copyRemarks = async (remarks: string) => {
  try {
    await navigator.clipboard.writeText(remarks);
    ElMessage.success('备注已复制');
  } catch (error) {
    // 降级方案：使用传统方法
    const textarea = document.createElement('textarea');
    textarea.value = remarks;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      ElMessage.success('备注已复制');
    } catch (err) {
      ElMessage.error('复制失败');
    }
    document.body.removeChild(textarea);
  }
};

// PDF转图片函数
const convertPDFToImage = async (pdfFile: File): Promise<File> => {
  try {
    const pdfjsLib = await import('pdfjs-dist');

    // 设置 worker 路径 - 使用部署在 public 目录的 worker 文件
    // 使用 .js 扩展名确保 Nginx 正确识别 MIME 类型
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.js';

    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    // 使用更高的缩放比例以获得更清晰的图片
    const viewport = page.getViewport({ scale: 3.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise;

    // 使用最高质量生成图片
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 1.0);
    });

    const fileName = pdfFile.name.replace('.pdf', '.jpg');
    return new File([blob], fileName, { type: 'image/jpeg' });
  } catch (error) {
    logger.error('PDF转换失败:', error);
    throw new Error('PDF转换图片失败');
  }
};

const handlePhotoUploadSuccess = (response: any, file: File) => {
  if (response.success && response.data?.url) {
    applyForm.subsidy_photos.push(response.data.url);
    ElMessage.success('照片上传成功');
  } else {
    ElMessage.error(response.message || '照片上传失败');
  }
};

const handlePhotoUploadError = (error: any) => {
  ElMessage.error('照片上传失败，请重试');
};

// 自定义上传请求（支持PDF转图片）
const customUploadRequest = async (options: any) => {
  const { file, data, onSuccess, onError } = options;
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isLt10M = file.size / 1024 / 1024 < 10;

  if (!isLt10M) {
    ElMessage.error('文件大小不能超过10MB');
    if (onError) onError(new Error('文件大小超过10MB'));
    return;
  }

  let uploadFile = file;

  // 如果是PDF，先转换为图片
  if (isPdf) {
    try {
      ElMessage.info('正在将PDF转换为图片...');
      uploadFile = await convertPDFToImage(file);
      ElMessage.success('PDF转换成功，正在上传...');
    } catch (error) {
      ElMessage.error('PDF转换图片失败');
      if (onError) onError(error);
      return;
    }
  }

  // 使用FormData上传
  const formData = new FormData();
  formData.append('file', uploadFile);

  // 获取序列号 - 按优先级获取
  const serialNumber = phoneDetail.value?.serial_number ||
                       currentManagingItem.value?.serial_number ||
                       data?.serial_number ||
                       'unknown';
  const saleTime = phoneDetail.value?.sale_time ||
                   currentManagingItem.value?.sale_time ||
                   data?.sale_time ||
                   '';

  formData.append('serial_number', serialNumber);
  formData.append('sale_time', saleTime);

  try {
    const result = await importFile({
      url: '/subsidy/upload/photo',
      formData,
      config: {
        headers: uploadHeaders.value
      },
      errorMessage: '照片上传失败',
      onError: (error) => {
        logger.error('上传照片失败:', error);
      }
    });

    if (result?.success && result.data?.url) {
      // 根据当前上下文决定添加到哪个数组
      if (showPhotoPreviewDialog.value && previewPhotos.value !== undefined) {
        // 照片管理弹窗
        previewPhotos.value.push(result.data.url);
        uploadedPhotos.value.push(result.data.url);
        ElMessage.success('照片上传成功');
      } else {
        // 申请表单
        applyForm.subsidy_photos.push(result.data.url);
        applyFormTempPhotos.value.push(result.data.url); // 记录临时文件
        ElMessage.success('照片上传成功');
      }
      if (onSuccess) onSuccess(result);
    } else {
      const errorMessage = result?.message || '照片上传失败';
      ElMessage.error(errorMessage);
      if (onError) onError(new Error(errorMessage));
    }
  } catch (error) {
    logger.error('上传请求失败:', error);
    ElMessage.error('照片上传失败，请重试');
    if (onError) onError(error);
  }
};

const downloadPhotoBlob = async (photoUrl: string, filename: string) => {
  const response = await fetch(formatImageUrl(photoUrl));
  const blob = await response.blob();

  saveBlobFile(blob, {
    filename,
    mimeType: blob.type || 'image/jpeg'
  });
};

const removePhoto = (index: number) => {
  const removedPhoto = applyForm.subsidy_photos[index];
  applyForm.subsidy_photos.splice(index, 1);

  // 如果删除的是临时照片，也从临时记录中移除
  const tempIndex = applyFormTempPhotos.value.indexOf(removedPhoto);
  if (tempIndex > -1) {
    applyFormTempPhotos.value.splice(tempIndex, 1);
  }
};

// 切换照片选中状态
const togglePhotoSelection = (index: number) => {
  const selectedIndex = selectedPhotos.value.indexOf(index);
  if (selectedIndex > -1) {
    selectedPhotos.value.splice(selectedIndex, 1);
  } else {
    selectedPhotos.value.push(index);
  }
  updateSelectAllState();
};

// 开始拖动选择
const startDragSelect = (e: MouseEvent) => {
  // 如果点击的是按钮或复选框，不启动拖动
  const target = e.target as HTMLElement;
  if (target.closest('.photo-actions') || target.closest('.photo-checkbox')) {
    return;
  }

  isDragging.value = true;
  const photoItem = target.closest('.photo-grid-item') as HTMLElement;
  if (photoItem) {
    const index = parseInt(photoItem.getAttribute('data-index') || '-1');
    if (index >= 0) {
      dragStartIndex.value = index;
      // 根据当前状态决定拖动模式
      dragMode.value = selectedPhotos.value.includes(index) ? 'deselect' : 'select';
      togglePhotoSelection(index);
    }
  }
};

// 拖动选择中
const onPhotoHover = (index: number) => {
  if (!isDragging.value) return;

  const isSelected = selectedPhotos.value.includes(index);

  if (dragMode.value === 'select' && !isSelected) {
    selectedPhotos.value.push(index);
    updateSelectAllState();
  } else if (dragMode.value === 'deselect' && isSelected) {
    const selectedIndex = selectedPhotos.value.indexOf(index);
    selectedPhotos.value.splice(selectedIndex, 1);
    updateSelectAllState();
  }
};

// 拖动选择处理（用于 mousemove）
const onDragSelect = (e: MouseEvent) => {
  if (!isDragging.value) return;

  // 防止文本选择
  e.preventDefault();
};

// 结束拖动选择
const endDragSelect = () => {
  isDragging.value = false;
  dragStartIndex.value = null;
};

// 照片全选/取消全选
const handlePhotoSelectAll = (checked: boolean) => {
  if (checked) {
    selectedPhotos.value = previewPhotos.value.map((_, index) => index);
  } else {
    selectedPhotos.value = [];
  }
};

// 更新全选状态
const updateSelectAllState = () => {
  photoSelectAll.value = selectedPhotos.value.length === previewPhotos.value.length && previewPhotos.value.length > 0;
};

// 下载选中的照片
const downloadSelectedPhotos = async () => {
  if (selectedPhotos.value.length === 0) {
    ElMessage.warning('请先选择要下载的照片');
    return;
  }

  try {
    for (const index of selectedPhotos.value) {
      const photoUrl = previewPhotos.value[index];
      await downloadPhotoBlob(
        photoUrl,
        `国补照片_${currentManagingItem.value?.serial_number || 'unknown'}_${index + 1}.jpg`
      );
      await new Promise(resolve => setTimeout(resolve, 300)); // 延迟避免浏览器阻止
    }
    ElMessage.success(`已下载 ${selectedPhotos.value.length} 张照片`);
  } catch (error) {
    logger.error('下载照片失败:', error);
    ElMessage.error('下载照片失败');
  }
};

// 删除选中的照片
const deleteSelectedPhotos = () => {
  if (selectedPhotos.value.length === 0) {
    ElMessage.warning('请先选择要删除的照片');
    return;
  }

  ElMessageBox.confirm(`确定要删除选中的 ${selectedPhotos.value.length} 张照片吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    // 按索引从大到小排序，避免删除时索引错乱
    const sortedIndexes = [...selectedPhotos.value].sort((a, b) => b - a);

    sortedIndexes.forEach(index => {
      const deletedPhoto = previewPhotos.value[index];
      deletedPhotos.value.push(deletedPhoto);
      previewPhotos.value.splice(index, 1);
    });

    selectedPhotos.value = [];
    photoSelectAll.value = false;
    ElMessage.success(`已删除 ${sortedIndexes.length} 张照片`);
  }).catch(() => {
    // 用户取消
  });
};

const showPhotoPreview = (photos: string[], startIndex: number = 0) => {
  if (!photos || photos.length === 0) {
    ElMessage.warning('没有可查看的照片');
    return;
  }
  previewPhotos.value = photos;
  currentPhotoIndex.value = startIndex;
  showPhotoPreviewDialog.value = true;
};

const handlePhotoChange = (index: number) => {
  currentPhotoIndex.value = index;
};

// 打开照片查看器
const openPhotoViewer = (index: number) => {
  currentPhotoIndex.value = index;
  showPhotoViewer.value = true;
};

// 上一张照片
const prevPhoto = () => {
  if (currentPhotoIndex.value > 0) {
    currentPhotoIndex.value--;
  }
};

// 下一张照片
const nextPhoto = () => {
  if (currentPhotoIndex.value < previewPhotos.value.length - 1) {
    currentPhotoIndex.value++;
  }
};

const downloadCurrentPhoto = async () => {
  const photoUrl = previewPhotos.value[currentPhotoIndex.value];
  if (!photoUrl) return;

  try {
    await downloadPhotoBlob(photoUrl, `国补照片_${currentPhotoIndex.value + 1}.jpg`);
    ElMessage.success('照片下载成功');
  } catch (error) {
    ElMessage.error('照片下载失败');
  }
};

const downloadAllPhotos = async () => {
  for (let i = 0; i < previewPhotos.value.length; i++) {
    const photoUrl = previewPhotos.value[i];
    if (!photoUrl) continue;

    try {
      await downloadPhotoBlob(photoUrl, `国补照片_${i + 1}.jpg`);
      // 延迟避免浏览器阻止连续下载
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      logger.error(`下载第${i + 1}张照片失败:`, error);
    }
  }
  ElMessage.success(`已下载${previewPhotos.value.length}张照片`);
};

// 打开照片管理对话框
const openPhotoManageDialog = (item: any) => {
  currentManagingItem.value = item;
  previewPhotos.value = item.subsidy_photos ? [...item.subsidy_photos] : [];
  currentPhotoIndex.value = 0;
  uploadedPhotos.value = []; // 清空本次上传记录
  showPhotoPreviewDialog.value = true;
};

// 照片管理上传成功回调
const handlePhotoManageUploadSuccess = (response: any, file: File) => {
  if (response.success && response.data?.url) {
    previewPhotos.value.push(response.data.url);
    uploadedPhotos.value.push(response.data.url); // 记录本次上传的照片
    ElMessage.success('照片上传成功');
  } else {
    ElMessage.error(response.message || '照片上传失败');
  }
};

// 从预览中删除照片
const removePhotoFromPreview = (index: number) => {
  ElMessageBox.confirm('确定要删除这张照片吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const deletedPhoto = previewPhotos.value[index];
    deletedPhotos.value.push(deletedPhoto);
    previewPhotos.value.splice(index, 1);

    // 如果删除后没有照片了，关闭查看器
    if (previewPhotos.value.length === 0) {
      showPhotoViewer.value = false;
    } else {
      // 调整当前索引
      if (currentPhotoIndex.value >= previewPhotos.value.length) {
        currentPhotoIndex.value = previewPhotos.value.length - 1;
      }
    }

    ElMessage.success('照片已删除');
  }).catch(() => {
    // 用户取消
  });
};

// 关闭照片管理对话框
const closePhotoManageDialog = async () => {
  // 如果有未保存的上传照片，删除它们
  if (uploadedPhotos.value.length > 0) {
    try {
      await deleteTempFiles(uploadedPhotos.value);
    } catch (error) {
      logger.error('清理未保存照片失败:', error);
    }
  }

  showPhotoPreviewDialog.value = false;
  currentManagingItem.value = null;
  previewPhotos.value = [];
  currentPhotoIndex.value = 0;
  deletedPhotos.value = [];
  uploadedPhotos.value = [];
  selectedPhotos.value = []; // 清空选中状态
  photoSelectAll.value = false;
};

// 保存照片更改
const savePhotoChanges = async () => {
  if (!currentManagingItem.value) {
    ElMessage.error('未找到要更新的记录');
    return;
  }

  try {
    savingPhotos.value = true;
    const response = await unifiedApi.put(`/subsidy/${currentManagingItem.value.id}`, {
      subsidy_photos: previewPhotos.value,
      deleted_photos: deletedPhotos.value
    });

    if (response.success) {
      ElMessage.success('照片保存成功');
      // 更新本地数据
      currentManagingItem.value.subsidy_photos = [...previewPhotos.value];
      // 清空本次上传记录（已保存）
      uploadedPhotos.value = [];
      // 刷新列表
      await fetchSubsidyList();
      closePhotoManageDialog();
    } else {
      ElMessage.error(response.message || '照片保存失败');
    }
  } catch (error: any) {
    logger.error('保存照片失败:', error);
    ElMessage.error(error.message || '照片保存失败');
  } finally {
    savingPhotos.value = false;
  }
};

// 获取状态文本
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '待提交',
    completed: '已审批',
    approved: '已到账'
  };
  return statusMap[status] || status;
};

// 格式化金额（移除不必要的.00后缀）
const formatAmount = (amount: number): string => {
  const formatted = amount.toFixed(2);
  // 如果是整数，移除.00
  if (formatted.endsWith('.00')) {
    return formatted.slice(0, -3);
  }
  // 如果小数点后最后一位是0，只保留一位小数
  if (formatted.endsWith('0')) {
    return formatted.slice(0, -1);
  }
  return formatted;
};

// 缓存键
const CACHE_KEYS = {
  stores: '/stores:all',
  subsidyStats: (params: any) => `/subsidy/stats/summary:${JSON.stringify(params)}`
}

// 加载店铺列表
const fetchStores = async () => {
  try {
    const response = await useCachedRequest(CACHE_KEYS.stores, () =>
      unifiedApi.get('/stores', { params: { all: true } }), DEFAULT_CACHE_TTL.STATIC)
    if (response.success && response.data) {
      // 当 all=true 时，API 直接返回数组
      stores.value = Array.isArray(response.data) ? response.data : (response.data.stores || response.data || []);
    } else {
      stores.value = [];
    }
  } catch (error) {
    logger.error('获取店铺列表失败:', error);
    stores.value = [];
  }
};

const initPageData = async () => {
  // 首屏数据并行加载，避免字段权限请求阻塞列表和统计接口。
  await Promise.allSettled([
    initFieldPermissions(),
    fetchStores(),
    fetchSubsidyList(),
    fetchStats()
  ]);
};

// 生命周期
onMounted(async () => {
  if (!canView.value) {
    return;
  }

  await initPageData();
});
</script>

<style lang="scss" scoped>
.subsidy-view {
  min-height: 100vh;
  background: var(--bg-color, #f5f7fa);
  padding: var(--spacing-md);

  @media (max-width: 768px) {
    padding: 8px;
  }
}

.content {
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin: 0 0 24px 0;

    @media (max-width: 768px) {
      margin: 0 0 16px 0;
      gap: 12px;
      grid-template-columns: repeat(2, 1fr);
      padding: 0 4px;
    }

    @media (max-width: 480px) {
      margin: 0 0 12px 0;
      gap: 10px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      transition: all 0.3s ease;
      border: 1px solid #e8ecef;

      @media (max-width: 768px) {
        padding: 14px 12px;
        border-radius: 16px;
        border: none;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);

        @media (max-width: 768px) {
          transform: translateY(-1px);
        }
      }

      /* 总申请数卡片 */
      &.total-card {
        @media (max-width: 768px) {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
        }
      }

      /* 审批状态卡片 */
      &.approval-card {
        @media (max-width: 768px) {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
      }

      /* 金额状态卡片 */
      &.amount-card {
        @media (max-width: 768px) {
          background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        }
      }

      /* 店铺统计卡片 */
      &.handler-card {
        @media (max-width: 768px) {
          background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
        }
      }

      .stat-content {
        text-align: center;

        @media (max-width: 768px) {
          display: none;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #2c3e50;
          line-height: 1.2;
          margin-bottom: 4px;

          .divider {
            color: #adb5bd;
            margin: 0 4px;
            font-weight: 400;
          }
        }

        .stat-label {
          font-size: 0.875rem;
          color: #6c757d;
          font-weight: 500;
        }
      }

      /* 手机端双行内容 */
      .stat-content-mobile {
        display: none;
        width: 100%;
        flex-direction: column;
        gap: 6px;

        @media (max-width: 768px) {
          display: flex;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;

          .row-label {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.85);
            font-weight: 500;
          }

          .row-value {
            font-size: 14px;
            font-weight: 700;
            color: white;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
          }
        }
      }
    }
  }

  /* Element Plus 组件样式覆盖 */
  :deep(.el-input__wrapper) {
    border-radius: 8px;
    box-shadow: 0 0 0 1px #dee2e6 inset;
    transition: all 0.2s;

    &:hover {
      box-shadow: 0 0 0 1px #667eea inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #667eea inset;
    }
  }

  :deep(.el-select) {
    .el-input__wrapper {
      border-radius: 8px;
    }
  }

  :deep(.el-date-editor) {
    .el-input__wrapper {
      border-radius: 8px;
    }
  }

  .table-section {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

    @media (max-width: 768px) {
      padding: 16px;
    }

    .section-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;

      .record-count {
        margin-left: auto;
        font-size: 0.875rem;
        font-weight: 400;
        color: #6c757d;
      }
    }

    .table-container {
      .data-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin: 0;
        background: white;
        border-radius: 8px;
        overflow: hidden;

        thead {
          th {
            background: linear-gradient(135deg, #495057 0%, #343a40 100%);
            color: white;
            padding: 12px 10px;
            text-align: center;
            font-weight: 600;
            font-size: 14px;
            border-right: 1px solid #dee2e6;
            border-bottom: 2px solid #dee2e6;
            white-space: nowrap;
            position: relative;

            &:last-child {
              border-right: none;
              border-top-right-radius: 0;
            }

            &:first-child {
              border-top-left-radius: 0;
            }

            &::after {
              display: none;
            }
          }
        }

        tbody {
          tr {
            transition: all 0.2s ease;
            position: relative;
            cursor: pointer;

            /* PC端不显示提示 */
            @media (min-width: 769px) {
              &::after {
                content: none;
              }
            }

            @media (max-width: 768px) {
              /* 移动端不显示提示 */
              &::after {
                content: none;
              }
            }

            &:nth-child(even) {
              background: #f8f9fa;
            }

            &:hover {
              background: #e3f2fd !important;
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
              z-index: 1;
            }

            &:hover td {
              border-bottom-color: #dee2e6;
            }

            td {
              padding: 6px 6px;
              border-right: 1px solid #e9ecef;
              border-bottom: 1px solid #e9ecef;
              font-size: 14px;
              color: #2c3e50;
              font-weight: 500;
              transition: all 0.2s ease;
              text-align: center;

              &:last-child {
                border-right: none;
              }

              &:first-child {
                border-left: none;
              }
            }
          }
        }

        // 特殊列样式 - 设备详细信息列(统一绿色背景)
        td:nth-child(3),  /* 姓名 */
        td:nth-child(4),  /* 手机 */
        td:nth-child(5),  /* 身份证 */
        td:nth-child(6),  /* 品牌 */
        td:nth-child(7),  /* 型号 */
        td:nth-child(8),  /* 颜色 */
        td:nth-child(9),  /* 内存 */
        td:nth-child(10), /* 序列号 */
        td:nth-child(11), /* IMEI1 */
        td:nth-child(12)  /* IMEI2 */
        {
          font-size: 13px !important;
          font-weight: 500 !important;
          color: #1f2937 !important;
          background: rgba(40, 167, 69, 0.05) !important;
          font-family: inherit !important;
        }

        tbody tr:hover td:nth-child(3),
        tbody tr:hover td:nth-child(4),
        tbody tr:hover td:nth-child(5),
        tbody tr:hover td:nth-child(6),
        tbody tr:hover td:nth-child(7),
        tbody tr:hover td:nth-child(8),
        tbody tr:hover td:nth-child(9),
        tbody tr:hover td:nth-child(10),
        tbody tr:hover td:nth-child(11),
        tbody tr:hover td:nth-child(12) {
          background: rgba(40, 167, 69, 0.08);
        }

        // 价格列 - 用红色区分
        td:nth-child(14), /* 销售价 */
        td:nth-child(15)  /* 国补后价 */
        {
          font-weight: 700;
          color: #dc3545;
          text-align: right;
          background: rgba(220, 53, 69, 0.03);
        }

        tbody tr:hover td:nth-child(14),
        tbody tr:hover td:nth-child(15) {
          background: rgba(220, 53, 69, 0.06);
        }

        // 状态列 - 国补提交和国补到账
        td:nth-child(17), /* 国补提交 */
        td:nth-child(18)  /* 国补到账 */
        {
          background: rgba(102, 126, 234, 0.02);
          font-weight: 500;
          color: #1f2937;
        }

        tbody tr:hover td:nth-child(16),
        tbody tr:hover td:nth-child(17) {
          background: rgba(102, 126, 234, 0.05);
        }

        // 操作列
        td.actions-col {
          background: rgba(108, 117, 125, 0.02);
          color: #1f2937;
        }

        tbody tr:hover td.actions-col {
          background: rgba(108, 117, 125, 0.05);
        }

        // 操作按钮容器布局
        .action-buttons {
          display: flex;
          flex-direction: row;
          gap: 8px;
          align-items: center;
          justify-content: center;

          .action-btn {
            flex: 1;
            min-width: 70px;
          }
        }

        // 时间徽章样式
        .time-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
          transition: all 0.3s ease;
          border: 1px solid transparent;

          i {
            font-size: 14px;
          }

          &.approval-time {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border-color: #28a745;

            &:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
            }
          }

          &.arrival-time {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border-color: #667eea;

            &:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
          }
        }

        // 操作按钮组 - 统一使用 el-button 组件
        .action-buttons {
          display: flex;
          gap: 8px;
          justify-content: center;

          .action-btn {
            flex: 1;
            min-width: 70px;
          }
        }
      }

      .loading-state,
      .empty-state {
        padding: 60px 20px;
        text-align: center;
        color: #6c757d;

        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e9ecef;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        i {
          font-size: 4rem;
          margin-bottom: 20px;
          color: #dee2e6;
        }

        p {
          font-size: 1rem;
          margin: 0;
        }
      }
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 20px;

      .page-info {
        font-size: 14px;
        color: #495057;
        font-weight: 500;
      }
    }
  }
}

// 申请对话框样式
.apply-form {
  min-width: 0;

  .search-step {
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 8px;
    }

    .step-hint {
      color: #6c757d;
      margin-bottom: 24px;
      font-size: 0.95rem;
    }

    .search-box {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      min-width: 0;

      .search-input-lg {
        flex: 1;
        min-width: 0;
        padding: 14px 18px;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        font-size: 16px;
        transition: all 0.2s;

        &:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
      }
    }

    // 新样式：只有输入框的搜索区域
    .search-box-input-only {
      margin-bottom: 24px;

      .search-input-lg {
        width: 100%;
        padding: 14px 18px;
        border: 2px solid #dee2e6;
        border-radius: 8px;
        font-size: 16px;
        transition: all 0.2s;

        &:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        &::placeholder {
          color: #adb5bd;
        }
      }
    }

    // 设备列表
    .device-list {
      border: 1px solid #dee2e6;
      border-radius: 12px;
      overflow: hidden;

      .device-list-header {
        background: #f8f9fa;
        padding: 14px 20px;
        border-bottom: 1px solid #dee2e6;

        h4 {
          font-size: 1rem;
          font-weight: 600;
          color: #2c3e50;
          margin: 0;
        }
      }

      .device-list-container {
        max-height: 400px;
        overflow-y: auto;

        .device-item {
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;

          &:last-child {
            border-bottom: none;
          }

          &:hover {
            background: #f8f9fa;
          }

          &.selected {
            background: #e7f3ff;
            border-left: 4px solid #667eea;
          }

          .device-main {
            flex: 1;
            min-width: 0;

            .device-model {
              font-size: 1rem;
              font-weight: 600;
              color: #2c3e50;
              margin-bottom: 6px;
            }

            .device-specs {
              font-size: 0.875rem;
              color: #6c757d;
              margin-bottom: 8px;
            }

            .device-identifiers {
              display: flex;
              gap: 16px;
              font-size: 0.75rem;
              color: #adb5bd;
              flex-wrap: wrap;

              span {
                display: flex;
                align-items: center;
                gap: 4px;
                min-width: 0;
                word-break: break-all;

                i {
                  font-size: 0.875rem;
                }
              }
            }

            .device-customer {
              display: flex;
              gap: 16px;
              font-size: 0.8125rem;
              color: #667eea;
              margin-top: 4px;
              padding-top: 8px;
              border-top: 1px solid #e9ecef;
              flex-wrap: wrap;

              span {
                display: flex;
                align-items: center;
                gap: 4px;
                min-width: 0;
                word-break: break-all;

                i {
                  font-size: 0.875rem;
                }
              }
            }
          }

          .device-meta {
            text-align: right;

            .device-price {
              font-size: 1.25rem;
              font-weight: 700;
              color: #2c3e50;
              margin-bottom: 8px;
            }

            .status-tag {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 500;

              &.eligible {
                background: #d1fae5;
                color: #10b981;
              }

              &.not-eligible {
                background: #fee2e2;
                color: #ef4444;
              }
            }
          }
        }
      }

      .device-selected-actions {
        padding: 16px 20px;
        border-top: 1px solid #dee2e6;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f8f9fa;
      }
    }

    // 空状态
    .empty-devices {
      padding: 60px 20px;
      text-align: center;
      color: #6c757d;

      i {
        font-size: 3rem;
        margin-bottom: 16px;
        color: #dee2e6;
      }

      p {
        font-size: 1rem;
        margin-bottom: 20px;
      }
    }
  }

  .confirm-step {
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 20px;
    }

    .confirm-info {
      min-width: 0;

      .info-group {
        margin-bottom: 20px;
        background: #f8f9fa;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #e9ecef;
        min-width: 0;

        h4 {
          font-size: 0.95rem;
          font-weight: 600;
          color: #495057;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-row {
          display: flex;
          padding: 10px 0;
          border-bottom: 1px solid #e9ecef;
          gap: 12px;
          min-width: 0;

          &:last-child {
            border-bottom: none;
          }

          .info-label {
            width: 100px;
            color: #6c757d;
            font-size: 14px;
            font-weight: 500;
            flex-shrink: 0;
          }

          .info-value {
            flex: 1;
            min-width: 0;
            color: #2c3e50;
            font-size: 14px;
            font-weight: 500;
            word-break: break-word;

            .form-input-inline {
              width: 100%;
              max-width: 300px;
              padding: 6px 12px;
              border: 1px solid #dee2e6;
              border-radius: 6px;
              font-size: 14px;
              transition: all 0.2s;

              &.has-value {
                background: #f0fdf4;
                border-color: #86efac;
              }

              &:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
              }
            }

            .idcard-hint {
              margin-left: 12px;
              padding: 4px 10px;
              background: #d1fae5;
              color: #065f46;
              border-radius: 4px;
              font-size: 12px;
              display: inline-flex;
              align-items: center;
              gap: 4px;

              &::before {
                content: '✓';
                font-weight: bold;
              }

              &.modified {
                background: #fef3c7;
                color: #92400e;

                &::before {
                  content: '✎';
                }
              }
            }

            &.subsidy-amount-highlight {
              color: #10b981;
              font-weight: 700;
              font-size: 1.5rem;
            }

            .discount-amount {
              color: #f97316;
              font-weight: 600;
            }

            .final-price {
              color: #ef4444;
              font-weight: 700;
              font-size: 1.2rem;
            }
          }
        }

        .info-row-inline {
          display: flex;
          padding: 10px 0;
          border-bottom: 1px solid #e9ecef;
          gap: 24px;

          .inline-item {
            display: flex;
            align-items: center;
            gap: 8px;

            .info-label {
              color: #6c757d;
              font-size: 14px;
              font-weight: 500;
              white-space: nowrap;
            }

            .info-value {
              color: #2c3e50;
              font-size: 14px;
              font-weight: 500;

              .form-input-inline {
                padding: 6px 12px;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                font-size: 14px;
                transition: all 0.2s;
                min-width: 200px;

                &.has-value {
                  background: #f0fdf4;
                  border-color: #86efac;
                }

                &:focus {
                  outline: none;
                  border-color: #667eea;
                  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }
              }
            }
          }
        }

        // 手机端响应式布局 - 字段在上，内容在下
        @media (max-width: 768px) {
          .info-row-inline {
            flex-wrap: wrap;
            gap: 12px;

            .inline-item {
              flex-direction: row; // 默认改为水平布局
              align-items: center;
              gap: 8px;
              width: 100%; // 每个项目占满宽度

              .info-label {
                font-size: 12px;
                white-space: nowrap;
                flex-shrink: 0;
              }

              .info-value {
                font-size: 14px;
                font-weight: 600;
                flex: 1;

                .form-input-inline {
                  width: 100%;
                  min-width: 0;
                }
              }
            }
          }
        }

        &.highlight {
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          border-color: #6ee7b7;
        }

        .existing-subsidy-warning {
          margin-top: 12px;
          padding: 12px;
          background: #fff3cd;
          color: #f59e0b;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .subsidy-warning {
          margin-top: 12px;
          padding: 12px;
          background: #fee2e2;
          color: #ef4444;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }

            .price-diff-hint {
              margin-left: 8px;
              font-size: 12px;
              color: #f59e0b;
              font-weight: 500;
              word-break: break-word;
            }

        // 实际办理人信息区块样式
        &.handler-info-section {
          background: #fffbeb;
          border-color: #fde68a;

          .handler-info-header {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 16px;

            h4 {
              margin-bottom: 0;
            }

            .checkbox-inline {
              display: flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              user-select: none;
              font-size: 14px;
              color: #495057;
              padding: 8px 12px;
              background: #ffffff;
              border-radius: 6px;
              transition: background 0.2s;

              &:hover {
                background: #fef3c7;
              }

              input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: #f59e0b;
              }

              span {
                flex: 1;
              }
            }
          }

          .handler-info-content {
            animation: slideDown 0.3s ease-out;
          }

          .handler-info-placeholder {
            padding: 16px;
            background: #ffffff;
            border-radius: 8px;
            text-align: center;

            p {
              margin: 0;
              font-size: 14px;
              color: #6c757d;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;

              i {
                color: #3b82f6;
                font-size: 16px;
              }
            }
          }

          .info-label {
            &.required {
              &::after {
                content: '*';
                color: #ef4444;
                margin-left: 4px;
                font-weight: bold;
              }
            }
          }
        }
      }

      .form-group {
        margin-bottom: 20px;

        label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #495057;
          margin-bottom: 8px;
        }

        .form-textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
          transition: all 0.2s;

          &:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
        }
      }
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 20px;
      border-top: 1px solid #dee2e6;
      margin-top: 20px;
    }
  }
}

// 详情对话框
.detail-content {
  .detail-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    h4 {
      font-size: 0.95rem;
      font-weight: 600;
      color: #495057;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e9ecef;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-row {
      display: flex;
      padding: 10px 0;

      .detail-label {
        width: 120px;
        color: #6c757d;
        font-size: 14px;
        font-weight: 500;
        flex-shrink: 0;
      }

      .detail-value {
        flex: 1;
        color: #2c3e50;
        font-size: 14px;
        font-weight: 500;

        &.subsidy-highlight {
          color: #10b981;
          font-weight: 700;
          font-size: 1.25rem;
        }

        .status-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;

          &.status-pending {
            background: #fff3cd;
            color: #f59e0b;
          }

          &.status-approved {
            background: #dbeafe;
            color: #3b82f6;
          }

          &.status-rejected {
            background: #fee2e2;
            color: #ef4444;
          }

          &.status-completed {
            background: #d1fae5;
            color: #10b981;
          }
        }
      }
    }

    .detail-remarks {
      color: #495057;
      font-size: 14px;
      line-height: 1.7;
      margin: 0;
      white-space: pre-wrap;
      background: #f8f9fa;
      padding: 14px;
      border-radius: 8px;
    }

    &.highlight {
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #6ee7b7;
    }

    // 客户信息区块(支持点击切换)
    &.customer-info-section {
      cursor: default;
      transition: all 0.3s ease;
      position: relative;

      // 有办理人信息时的样式(可以点击)
      &.has-handler-info {
        cursor: pointer;
        user-select: none;

        h4 {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;

          .toggle-hint {
            font-size: 12px;
            font-weight: 500;
            color: #6c757d;
            background: #f8f9fa;
            padding: 4px 10px;
            border-radius: 12px;
            border: 1px solid #dee2e6;
            transition: all 0.2s;
          }
        }

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

          .toggle-hint {
            background: #e9ecef;
            border-color: #adb5bd;
          }
        }
      }

      // 显示办理人信息时的样式(黄色背景)
      &.showing-handler {
        background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
        padding: 16px;
        border-radius: 12px;
        border: 2px solid #fbbf24;
        box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);

        h4 {
          color: #92400e !important;
          border-bottom-color: #fcd34d !important;

          .toggle-hint {
            background: #fff7ed;
            border-color: #fbbf24;
            color: #92400e;
          }
        }

        .detail-label {
          color: #78350f;
          font-weight: 600;
        }

        .detail-value {
          color: #92400e;
          font-weight: 600;
        }
      }
    }

    // 实际办理人信息高亮样式(旧版保留,未使用)
    &.handler-info-highlight {
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #fbbf24;

      h4 {
        color: #92400e;
        border-bottom-color: #fcd34d;
        display: flex;
        align-items: center;
        gap: 8px;

        i {
          color: #f59e0b;
        }
      }

      .detail-label {
        color: #78350f;
        font-weight: 600;
      }

      .detail-value {
        color: #92400e;
        font-weight: 600;
      }
    }
  }
}

// 审批对话框
.approve-content {
  p {
    font-size: 16px;
    color: #495057;
    margin-bottom: 16px;
  }

  .approve-info {
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    font-size: 15px;

    strong {
      color: #10b981;
      font-size: 1.5rem;
    }
  }
}

.edit-form {
  padding: 0;

  // 表单行布局 - 两列
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;

    :deep(.el-form-item) {
      margin-bottom: 20px;
    }
  }

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    font-weight: 600;
    color: #303133;
    font-size: 14px;
  }

  :deep(.el-input__wrapper) {
    border-radius: 8px;
    box-shadow: 0 0 0 1px #dcdfe6 inset;
    transition: all 0.2s;
    padding: 8px 12px;

    &:hover {
      box-shadow: 0 0 0 1px #c0c4cc inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #667eea inset;
    }
  }

  :deep(.el-input__inner) {
    font-size: 14px;
  }

  :deep(.el-textarea__inner) {
    border-radius: 8px;
    font-size: 14px;
    padding: 10px 12px;
    transition: all 0.2s;

    &:focus {
      border-color: #667eea;
    }
  }

  :deep(.el-date-editor) {
    width: 100%;

    .el-input__wrapper {
      width: 100%;
    }
  }

  // 时间输入组样式
  .time-input-group {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;

    .el-date-editor {
      flex: 1;
    }

    // 设为当前时间按钮
    .btn-time-now {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      &:active {
        transform: translateY(0);
      }

      i {
        font-size: 14px;
      }
    }

    // 清除时间按钮
    .btn-time-clear {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: linear-gradient(135deg, #dc3545, #c82333);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
      }

      &:active {
        transform: translateY(0);
      }

      i {
        font-size: 14px;
      }
    }
  }

  // 只读字段区域
  .readonly-fields {
    margin-top: 20px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #dee2e6;

    .readonly-title {
      font-size: 13px;
      font-weight: 600;
      color: #6c757d;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    :deep(.el-descriptions) {
      .el-descriptions__body {
        background: transparent;
      }

      .el-descriptions__table {
        border: none;

        .el-descriptions__cell {
          border: none;
          padding: 8px 0;
        }

        .el-descriptions__label {
          font-weight: 500;
          color: #495057;
        }

        .el-descriptions__content {
          color: #212529;
        }
      }
    }
  }
}

.apply-dialog-footer {
  gap: 10px;
}

// 旋转动画（用于加载图标）
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 移动端适配
@media (max-width: 768px) {
  .subsidy-view {
    padding: 12px;
  }

  .apply-dialog-footer {
    gap: 8px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  /* 移动端卡片列表 */
  .mobile-card-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 4px;
  }

  .mobile-card {
    background: white;
    border-radius: 16px;
    padding: 0;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.06);

    /* 添加顶部装饰条 */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    }

    &:active {
      transform: scale(0.98);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .card-section {
      padding: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);

      &:last-child {
        border-bottom: none;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        font-size: 12px;
        font-weight: 700;
        color: #1a1a1a;

        i {
          font-size: 14px;
          color: #667eea;
        }
      }

      .section-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px 10px;

        /* 紧凑型网格 - 更小的间距和字体 */
        &.compact-grid {
          gap: 6px 8px;
        }

        .grid-item {
          display: flex;
          flex-direction: column;
          gap: 2px;

          &.full-width {
            grid-column: 1 / -1;
          }

          .item-label {
            font-size: 10px;
            color: #8e8e93;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .item-value {
            font-size: 13px;
            color: #1c1c1e;
            font-weight: 600;
            word-break: break-all;
            line-height: 1.3;

            &.clickable-text {
              color: #667eea;
              cursor: pointer;
              position: relative;

              &:active {
                opacity: 0.7;
              }
            }

            /* 客户信息切换样式 - 只用颜色区分，无图标 */
            .customer-info-toggle {
              cursor: pointer;

              /* 有办理人但显示购买者 - 蓝色 */
              &.has-handler-but-showing-purchaser {
                color: #1976d2;
                background: linear-gradient(135deg, rgba(25, 118, 210, 0.08), rgba(25, 118, 210, 0.12));
                padding: 3px 8px;
                border-radius: 6px;
                border: 1px solid rgba(25, 118, 210, 0.2);
              }

              /* 显示办理人 - 橙色 */
              &.showing-handler {
                color: #f57c00;
                background: linear-gradient(135deg, rgba(245, 124, 0, 0.08), rgba(245, 124, 0, 0.12));
                padding: 3px 8px;
                border-radius: 6px;
                border: 1px solid rgba(245, 124, 0, 0.2);
              }

              &:active {
                opacity: 0.7;
              }
            }

            &.price-highlight {
              color: #ff3b30;
              font-size: 14px;
            }

            &.subsidy-amount {
              color: #34c759;
              font-size: 14px;
            }

            .time-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 10px;
              border-radius: 16px;
              font-size: 10px;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

              &.approval-time {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
              }

              &.arrival-time {
                background: linear-gradient(135deg, #34c759, #30d158);
                color: white;
              }

              i {
                font-size: 9px;
              }
            }
          }
        }
      }
    }

    .device-section {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
    }

    .purchase-section {
      background: linear-gradient(135deg, rgba(52, 199, 89, 0.03) 0%, rgba(48, 209, 88, 0.03) 100%);

      /* 客户信息列表 - 2行紧凑布局 */
      .customer-info-list {
        display: flex;
        flex-direction: column;
        gap: 6px;

        /* 第一行：姓名 + 手机 */
        .info-row-first {
          display: flex;
          align-items: center;
          flex-wrap: nowrap;
          gap: 3px;
          font-size: 10px;

          .info-label {
            color: #8e8e93;
            font-weight: 600;
            font-size: 9px;
            min-width: 24px;
            flex-shrink: 0;
          }

          .phone-label {
            margin-left: 4px;
            flex-shrink: 0;
          }

          .info-value {
            color: #1c1c1e;
            font-weight: 600;
            word-break: keep-all;
            white-space: nowrap;
            font-size: 10px;
            flex-shrink: 0;

            &.clickable-text {
              color: #667eea;
              cursor: pointer;
            }

            /* 客户信息切换样式 */
            &.customer-info-toggle {
              cursor: pointer;
              display: inline-flex;
              align-items: center;

              /* 有办理人但显示购买者 - 蓝色 */
              &.has-handler-but-showing-purchaser {
                color: #1976d2;
                background: linear-gradient(135deg, rgba(25, 118, 210, 0.08), rgba(25, 118, 210, 0.12));
                padding: 3px 8px;
                border-radius: 6px;
                border: 1px solid rgba(25, 118, 210, 0.2);
              }

              /* 显示办理人 - 橙色 */
              &.showing-handler {
                color: #f57c00;
                background: linear-gradient(135deg, rgba(245, 124, 0, 0.08), rgba(245, 124, 0, 0.12));
                padding: 3px 8px;
                border-radius: 6px;
                border: 1px solid rgba(245, 124, 0, 0.2);
              }

              &:active {
                opacity: 0.7;
              }
            }
          }
        }

        /* 第二行：身份证 */
        .info-row-second {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;

          .info-label {
            color: #8e8e93;
            font-weight: 600;
            font-size: 10px;
            min-width: 32px;
            flex-shrink: 0;
          }

          .info-value {
            color: #1c1c1e;
            font-weight: 600;
            flex: 1;
            word-break: keep-all;
            font-size: 11px;

            &.clickable-text {
              color: #667eea;
              cursor: pointer;
            }
          }
        }
      }
    }

    .price-section {
      background: linear-gradient(135deg, rgba(255, 149, 0, 0.03) 0%, rgba(255, 59, 48, 0.03) 100%);
    }
  }

  .apply-form .search-step .search-box {
    flex-direction: column;
    gap: 10px;

    .search-input-lg,
    :deep(.el-button) {
      width: 100%;
    }
  }

  .apply-form {
    .search-step {
      padding: 0 10px;

      h3 {
        margin-bottom: 6px;
        font-size: 1.15rem;
      }

      .step-hint {
        margin-bottom: 12px;
        font-size: 0.9rem;
      }

      .device-list {
        .device-list-header,
        .device-list-container .device-item,
        .device-selected-actions {
          padding-left: 14px;
          padding-right: 14px;
        }

        .device-list-container {
          .device-item {
            .device-main {
              width: 100%;
            }

            .device-identifiers,
            .device-customer {
              flex-direction: column;
              gap: 6px;
              align-items: flex-start;
            }

            .device-meta {
              width: 100%;
              text-align: left;
            }
          }
        }
      }
    }

    .confirm-step {
      .confirm-info {
        .info-group {
          padding: 14px;

          .info-row {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;

            .info-label {
              width: auto;
              font-size: 13px;
            }

            .info-value {
              width: 100%;

              .form-input-inline {
                max-width: none;
              }

              .idcard-hint,
              .price-diff-hint {
                display: block;
                margin-left: 0;
                margin-top: 8px;
                width: fit-content;
              }
            }
          }
        }
      }

      :deep(.el-input-number) {
        width: 100% !important;
      }

      :deep(.el-input-number .el-input) {
        width: 100%;
      }
    }
  }

  .device-item {
    flex-direction: column !important;
    align-items: flex-start !important;

    .device-meta {
      text-align: left !important;
      width: 100%;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .confirm-actions,
  .device-selected-actions {
    flex-direction: column !important;

    .btn {
      width: 100%;
      justify-content: center;
    }
  }
}

@media (max-width: 480px) {
  .apply-dialog-footer {
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .stats-cards {
    grid-template-columns: 1fr;
  }

  .search-row {
    flex-direction: column !important;

    .search-input-group,
    .filter-select {
      width: 100%;
    }
  }
}

// 加载动画容器
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #6c757d;

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e9ecef;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  p {
    font-size: 16px;
    margin: 0;
  }
}

// 新增样式：可点击文本和二维码提示
.clickable-text {
  cursor: pointer;
  color: #667eea !important;
  text-decoration: none;
  transition: all 0.2s;
  padding: 2px 4px;
  border-radius: 4px;
  display: inline-block;

  &:hover {
    background: #e0e7ff !important;
    color: #5a67d8 !important;
  }

  &:active {
    background: #c7d2fe !important;
  }

  // 客户信息切换样式
  &.customer-info-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-weight: 500;

    // 有实际办理人但显示原始购买者信息时的样式（默认状态）
    &.has-handler-but-showing-purchaser {
      background: linear-gradient(135deg, #dbeafe, #bfdbfe) !important;
      color: #1e40af !important;
      font-weight: 500;
      border: 1px solid #3b82f6;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);

      &:hover {
        background: linear-gradient(135deg, #bfdbfe, #93c5fd) !important;
      }
    }

    // 显示办理人信息时的样式（切换后状态）
    &.showing-handler {
      background: linear-gradient(135deg, #fef3c7, #fde68a) !important;
      color: #92400e !important;
      font-weight: 600;
      border: 1px solid #fbbf24;
      box-shadow: 0 2px 4px rgba(251, 191, 36, 0.2);

      &:hover {
        background: linear-gradient(135deg, #fde68a, #fcd34d) !important;
      }
    }
  }
}

// 客户姓名容器
.customer-name-container {
  display: flex;
  align-items: center;
  gap: 8px;

  .handler-badge {
    display: inline-block;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
    white-space: nowrap;
    background-color: #3b82f6;
    color: white;

    &.showing-handler {
      background-color: #f59e0b;
      color: white;
    }
  }
}

.text-muted {
  color: #adb5bd !important;
}

.remarks-display {
  color: #6c757d;
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.remarks-tag {
  display: inline-block;
  padding: 2px 10px;
  background-color: #ffc107;
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.remarks-tag:hover {
  background-color: #ffca2c;
  transform: scale(1.05);
}

.remarks-icon {
  color: #ffc107;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  padding: 4px;
  border-radius: 4px;
}

.remarks-icon:hover {
  color: #ffca2c;
  background-color: rgba(255, 193, 7, 0.1);
  transform: scale(1.1);
}

// 国补照片上传相关样式
.subsidy-photo-row {
  flex-wrap: wrap;

  .info-value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
}

.subsidy-photo-upload {
  display: inline-flex;

  .photo-upload-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    color: #fff;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    i {
      margin-right: 6px;
    }
  }
}

.uploaded-photos-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  width: 100%;
}

.photo-thumbnail {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid #e0e0e0;
  transition: all 0.3s;

  &:hover {
    transform: scale(1.1);
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);

    .remove-photo {
      opacity: 1;
    }
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-photo {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 18px;
    height: 18px;
    background: rgba(220, 53, 69, 0.9);
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    opacity: 0;
    transition: opacity 0.2s;
    cursor: pointer;

    &:hover {
      background: #dc3545;
    }
  }
}

// 表格中的国补照片列样式
.subsidy-photo-cell {
  .photo-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    transition: all 0.3s;

    &.clickable {
      &:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
    }

    .photo-icon {
      color: #fff;
      font-size: 16px;
    }

    .photo-icon-empty {
      color: #fff;
      font-size: 14px;
      opacity: 0.8;
    }

    .upload-hint {
      color: #fff;
      font-size: 12px;
      font-weight: 500;
    }

    .photo-count {
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 6px;
      border-radius: 10px;
    }
  }
}

// 照片预览模态框样式
.photo-preview-dialog {
  .photo-preview-content {
    .photo-upload-area {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border-radius: 8px;
      margin-bottom: 20px;

      .icon-only-btn {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        transition: all 0.3s;

        &:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
        }
      }

      .upload-tip {
        color: #666;
        font-size: 13px;
      }
    }

    .photo-grid-area {
      .photo-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 16px;

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 16px;

          .selected-count {
            color: #409eff;
            font-size: 14px;
            font-weight: 500;
          }
        }

        .toolbar-right {
          display: flex;
          gap: 8px;
        }
      }

      .photo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
        padding: 16px 0;
        user-select: none; // 防止拖动时选中文本

        .photo-grid-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          border: 3px solid transparent;
          cursor: pointer;

          &.selected {
            border-color: #409eff;
            box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
          }

          &:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);

            .photo-actions {
              opacity: 1;
              transform: translateY(0);
            }
          }

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            cursor: pointer;
          }

          .photo-checkbox {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 20;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 6px;
            padding: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            cursor: pointer;
            transition: all 0.2s;

            &:hover {
              background: white;
              transform: scale(1.1);
            }

            .el-checkbox {
              margin: 0;
            }
          }

          .photo-actions {
            position: absolute;
            bottom: 12px;
            left: 50%;
            transform: translateX(-50%) translateY(10px);
            display: flex;
            gap: 8px;
            opacity: 0;
            transition: all 0.3s;
            z-index: 15;

            .action-btn {
              width: 40px !important;
              height: 40px !important;
              min-width: 40px !important;
              padding: 0 !important;
              border: none !important;
              border-radius: 50% !important;
              backdrop-filter: blur(10px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              transition: all 0.2s;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              flex-shrink: 0;

              i {
                font-size: 16px;
                margin: 0 !important;
              }

              &.view-btn {
                background: rgba(64, 158, 255, 0.95) !important;
                color: white !important;

                &:hover {
                  background: #409eff !important;
                  transform: scale(1.1);
                  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.4);
                }
              }

              &.delete-btn {
                background: rgba(245, 108, 108, 0.95) !important;
                color: white !important;

                &:hover {
                  background: #f56c6c !important;
                  transform: scale(1.1);
                  box-shadow: 0 6px 16px rgba(245, 108, 108, 0.4);
                }
              }
            }
          }

          .selected-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(64, 158, 255, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;

            i {
              color: #409eff;
              font-size: 48px;
              filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
            }
          }
        }
      }

      .photo-count-info {
        text-align: center;
        padding: 16px 0;
        color: #666;
        font-size: 14px;

        i {
          margin-right: 6px;
          color: #409eff;
        }
      }
    }

    .no-photo-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #999;

      i {
        font-size: 64px;
        margin-bottom: 16px;
        opacity: 0.3;
      }

      p {
        font-size: 14px;
        margin: 0;
      }
    }
  }

  .photo-preview-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

// 照片查看器样式
.photo-viewer-dialog {
  .photo-viewer-content {
    .photo-viewer-main {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 500px;
      background: #f5f5f5;
      border-radius: 8px;
      padding: 20px;

      .photo-nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        width: 48px;
        height: 48px;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

        &:hover:not(:disabled) {
          background: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        &.prev {
          left: 20px;
        }

        &.next {
          right: 20px;
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      }

      .photo-viewer-image {
        max-width: calc(100% - 120px);
        max-height: 70vh;
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          max-width: 100%;
          max-height: 70vh;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
      }
    }

    .photo-viewer-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 20px;
    }
  }
}

// 手机端适配
@media (max-width: 768px) {
  .subsidy-photo-row {
    .info-label {
      width: auto;
      margin-bottom: 8px;
    }

    .info-value {
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;

      .el-input-number {
        width: 140px !important;
        flex-shrink: 0;
      }

      .price-diff-hint {
        display: none; // 手机端隐藏差价提示，节省空间
      }

      .subsidy-photo-upload {
        flex-shrink: 0;
      }

      // 图片预览单独一行
      .uploaded-photos-preview {
        width: 100%;
        margin-top: 8px;
        display: flex;
        flex-direction: row;
        flex-wrap: nowrap;
        overflow-x: auto;
        gap: 8px;
        padding-bottom: 8px;

        .photo-thumbnail {
          flex-shrink: 0;
          width: 70px;
          height: 70px;
        }
      }
    }
  }

  .uploaded-photos-preview {
    justify-content: flex-start;
  }

  .photo-preview-dialog {
    .el-dialog {
      width: 95% !important;
      margin: 20px auto !important;
    }

    .photo-grid-area {
      .photo-toolbar {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;

        .toolbar-left,
        .toolbar-right {
          justify-content: center;
        }

        .toolbar-right {
          .el-button {
            flex: 1;
          }
        }
      }

      .photo-grid {
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;

        .photo-grid-item {
          border-radius: 8px;

          .photo-checkbox {
            top: 6px;
            left: 6px;
            padding: 2px;
          }

          .photo-actions {
            bottom: 8px;
            gap: 6px;

            .action-btn {
              width: 36px;
              height: 36px;

              i {
                font-size: 14px;
              }
            }
          }

          .selected-overlay i {
            font-size: 36px;
          }
        }
      }
    }

    .photo-preview-footer {
      flex-wrap: wrap;

      .el-button {
        flex: 1;
        min-width: 100px;
      }
    }
  }

  .photo-viewer-dialog {
    .el-dialog {
      width: 100% !important;
      margin: 0 !important;
    }

    .photo-viewer-main {
      min-height: 300px !important;

      .photo-nav-btn {
        width: 36px;
        height: 36px;

        &.prev {
          left: 10px;
        }

        &.next {
          right: 10px;
        }
      }

      .photo-viewer-image {
        max-width: calc(100% - 80px);

        img {
          max-height: 50vh;
        }
      }
    }
  }
}

.qrcode-tooltip {
  position: fixed;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  min-width: 220px;
  animation: fadeIn 0.2s ease-in-out;
  pointer-events: auto;

  .qrcode-title {
    font-weight: 600;
    color: #495057;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .qrcode-value {
    font-size: 12px;
    color: #6c757d;
    margin-bottom: 12px;
    word-break: break-all;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 4px;
  }

  canvas {
    display: block;
    margin: 0 auto;
    border: 1px solid #dee2e6;
    border-radius: 4px;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    max-height: 500px;
    transform: translateY(0);
  }
}
</style>

<style lang="scss">
@media (max-width: 768px) {
  .subsidy-dialog,
  .subsidy-detail-dialog {
    --dialog-side-gap: 2px;
    --dialog-vertical-gap: 24px;
    --dialog-max-width: calc(100vw - 4px);
    --mobile-dialog-body-padding: 8px 2px 8px;
    --mobile-dialog-footer-padding: 0 2px 2px;
  }

  .subsidy-dialog-wide {
    --dialog-side-gap: 0px;
    --dialog-vertical-gap: 24px;
    --dialog-max-width: calc(100vw - 2px);
    --mobile-dialog-body-padding: 6px 0 6px;
    --mobile-dialog-footer-padding: 0 0 2px;
  }

  .mobile-dialog-sheet-overlay.subsidy-dialog,
  .mobile-dialog-sheet-overlay.subsidy-detail-dialog {
    padding: 8px 2px !important;
  }

  .mobile-dialog-sheet-overlay.subsidy-dialog-wide {
    padding: 8px 1px !important;
  }

  .mobile-dialog-sheet-panel.subsidy-dialog,
  .mobile-dialog-sheet-panel.subsidy-detail-dialog {
    width: calc(100vw - 4px) !important;
    max-width: calc(100vw - 4px) !important;
    max-height: calc(100dvh - 24px) !important;
    border-radius: 24px !important;
  }

  .mobile-dialog-sheet-panel.subsidy-dialog-wide {
    width: calc(100vw - 2px) !important;
    max-width: calc(100vw - 2px) !important;
    max-height: calc(100dvh - 24px) !important;
    border-radius: 24px !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-header,
  .subsidy-detail-dialog .mobile-dialog-sheet-header {
    min-height: calc(66px + env(safe-area-inset-top)) !important;
    padding: calc(10px + env(safe-area-inset-top)) 52px 10px 16px !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-title,
  .subsidy-detail-dialog .mobile-dialog-sheet-title {
    font-size: 16px !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-close,
  .subsidy-detail-dialog .mobile-dialog-sheet-close {
    top: calc(10px + env(safe-area-inset-top)) !important;
    right: 14px !important;
    transform: none !important;
  }

  .subsidy-dialog-wide .el-dialog__body {
    padding: 6px 0 !important;
  }
}

@media (max-width: 480px) {
  .subsidy-dialog .mobile-dialog-sheet-header,
  .subsidy-detail-dialog .mobile-dialog-sheet-header {
    min-height: calc(62px + env(safe-area-inset-top)) !important;
    padding: calc(8px + env(safe-area-inset-top)) 50px 8px 14px !important;
  }

  .subsidy-dialog .mobile-dialog-sheet-close,
  .subsidy-detail-dialog .mobile-dialog-sheet-close {
    top: calc(8px + env(safe-area-inset-top)) !important;
    right: 14px !important;
  }
}
</style>

<style lang="scss" scoped>
.modal-body {
  padding: 0;
  overflow: visible;
  background: transparent;
}

.modal-footer {
  padding: 0;
  border-top: 1px solid #dee2e6 !important;
  display: flex !important;
  gap: 12px !important;
  justify-content: flex-end !important;
  background: transparent !important;
}

// 批量操作样式
.batch-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  margin-bottom: 16px;
  animation: slideDown 0.3s ease-out;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 14px;

    i {
      font-size: 16px;
    }

    strong {
      font-size: 16px;
      font-weight: 600;
    }
  }

  .batch-actions-buttons {
    display: flex;
    gap: 8px;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.batch-info-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  color: #0369a1;
  font-size: 14px;
  margin-bottom: 12px;

  &.info {
    background: #fefce8;
    border-color: #fde047;
    color: #a16207;
  }

  i {
    font-size: 16px;
  }

  strong {
    color: #0c4a6e;
    font-weight: 600;
  }
}

.batch-form {
  .form-tip {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;

    i {
      font-size: 12px;
    }
  }
}

.batch-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pinned-items-preview {
  margin-top: 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;

  .preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--el-bg-color-page);
    border-bottom: 1px solid var(--el-border-color);
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);

    i {
      font-size: 14px;
    }
  }

  .preview-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .preview-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    font-size: 13px;

    &:last-child {
      border-bottom: none;
    }

    .item-name {
      font-weight: 500;
      color: var(--el-text-color-primary);
      min-width: 80px;
    }

    .item-phone {
      color: var(--el-text-color-regular);
      min-width: 100px;
    }

    .item-model {
      color: var(--el-text-color-secondary);
      flex: 1;
    }
  }

  .preview-more {
    padding: 8px 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    background: var(--el-bg-color-page);
  }
}

.checkbox-col {
  text-align: center;

  .el-checkbox {
    margin: 0;
  }
}

.selected-row {
  background-color: var(--el-color-primary-light-9) !important;
}

.pinned-row {
  background-color: #fffbeb !important;
  border-left: 3px solid #f59e0b;

  &:hover {
    background-color: #fef3c7 !important;
  }
}

.pinned-card {
  background-color: #fffbeb;
  border-left: 3px solid #f59e0b;
}
</style>
