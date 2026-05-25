<template>
  <div class="price-list-view admin-page">
    <!-- 权限检查提示 - 使用全局组件 -->
    <PermissionDenied
      :canView="canView"
      module-key="price-list"
      module-name="报价管理"
      permission-code="price-list:view"
    />

    <!-- 主内容 - 只有有权限时才显示 -->
    <template v-if="canView">
    <div class="admin-page-content">
    <PageHeader title="报价管理">
      <template #actions>
        <el-button v-if="canCreate" type="primary" @click="handleCreate">
          <i class="fas fa-plus"></i>
          新增
        </el-button>
        <ImportExportActions
          :can-import="canImport"
          :can-export="canExport"
          :import-loading="importingPriceList"
          :export-loading="exportingPriceList"
          import-label="导入"
          export-label="导出"
          import-loading-label="导入中..."
          export-loading-label="导出中..."
          import-icon-class="fas fa-file-import"
          export-icon-class="fas fa-file-excel"
          import-type="warning"
          export-type="success"
          @import="triggerPriceListImport"
          @export="handleExportPriceList"
        />
        <el-dropdown trigger="click" @command="handleQuoteCommand">
          <el-button type="primary">
            <i class="fas fa-search-dollar"></i>
            报价
            <i class="fas fa-chevron-down ml-2"></i>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="wholesale">批发报价</el-dropdown-item>
              <el-dropdown-item command="sales">销售报价</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown trigger="click" @command="handleSyncSettingsCommand">
          <el-button type="info">
            <i class="fas fa-cog"></i>
            设置
            <i class="fas fa-chevron-down ml-2"></i>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="sync_logs">同步日志</el-dropdown-item>
              <el-dropdown-item v-if="canEdit" command="sync_config">同步设置</el-dropdown-item>
              <el-dropdown-item v-if="canEdit" command="markup_config">加价配置</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-if="canEdit" type="warning" @click="handleSync" :loading="syncing">
          <i class="fas fa-sync"></i>
          同步
        </el-button>
        <el-dropdown
          v-if="canEdit || canDelete"
          trigger="click"
          @command="handleDataCleanupCommand"
        >
          <el-button type="danger" plain>
            <i class="fas fa-trash-alt"></i>
            清理
            <i class="fas fa-chevron-down ml-2"></i>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-if="canEdit"
                command="clear_prices"
                :disabled="clearingPrices"
              >
                一键清零价格
              </el-dropdown-item>
              <el-dropdown-item
                v-if="canDelete"
                command="clear_history"
                :disabled="clearingAllHistory"
              >
                清理历史价格
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
    </PageHeader>
    <input
      ref="priceListImportInputRef"
      type="file"
      accept=".xlsx,.xls"
      style="display: none"
      @change="handlePriceListImportChange"
    />

    <UnifiedSearchPanel
      v-model:expanded="searchExpanded"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    >
      <template #primary>
        <el-input
          v-model="searchForm.search"
          placeholder="搜索关键词"
          clearable
          @input="debounceSearch"
          @keyup.enter="handleSearch"
          @click.stop
        />
      </template>

      <div class="form-group filter-item" data-field="brand">
          <el-select
            v-model="searchForm.brand_name"
            placeholder="品牌"
            filterable
            clearable
            @change="handleBrandChange"
            :loading="loadingOptions"
          >
            <el-option
              v-for="brand in options.brands"
              :key="brand"
              :label="brand"
              :value="brand"
            />
          </el-select>
      </div>

      <div class="form-group filter-item" data-field="model">
          <el-select
            v-model="searchForm.model_number"
            placeholder="型号"
            filterable
            clearable
            @change="handleSearch"
            :loading="loadingModels"
            :disabled="!searchForm.brand_name"
          >
            <el-option
              v-for="model in options.models"
              :key="model"
              :label="model"
              :value="model"
            />
          </el-select>
      </div>

      <div class="form-group filter-item" data-field="color">
          <el-select
            v-model="searchForm.color_name"
            placeholder="颜色"
            filterable
            clearable
            @change="handleSearch"
            :loading="loadingOptions"
          >
            <el-option
              v-for="color in options.colors"
              :key="color"
              :label="color"
              :value="color"
            />
          </el-select>
      </div>

      <div class="form-group filter-item" data-field="memory">
          <el-select
            v-model="searchForm.memory"
            placeholder="内存"
            filterable
            clearable
            @change="handleSearch"
            :loading="loadingOptions"
          >
            <el-option
              v-for="memory in options.memories"
              :key="memory"
              :label="memory"
              :value="memory"
            />
          </el-select>
      </div>

      <div class="form-group filter-item" data-field="is_collect">
          <el-select
            v-model="searchForm.is_collect"
            placeholder="采集状态"
            clearable
            @change="handleSearch"
            class="min-w-24"
          >
            <el-option label="采集" :value="1" />
            <el-option label="不采集" :value="0" />
          </el-select>
      </div>

      <div class="form-group filter-item" data-field="status">
          <el-select
            v-model="searchForm.status"
            placeholder="状态"
            clearable
            @change="handleSearch"
            class="min-w-24"
          >
            <el-option label="正常" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
      </div>
    </UnifiedSearchPanel>

    <!-- 价格列表 -->
    <el-card class="table-card admin-panel admin-table-panel">
      <div v-if="isMobile" class="table-responsive">
        <div v-if="loading" class="table-loading">
          <el-skeleton :rows="5" animated />
        </div>

        <table v-else class="data-table price-mobile-table">
          <thead>
            <tr>
              <th>型号</th>
              <th>颜色</th>
              <th>内存</th>
              <th>价格趋势</th>
              <th>批发价格</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!priceList.length">
              <td colspan="5" class="text-center py-8">
                <div class="empty-state mobile-empty-state">
                  <i class="fas fa-tags"></i>
                  <p>暂无价目表数据</p>
                </div>
              </td>
            </tr>
            <template v-for="row in priceList" :key="`${row.price_list_id || row.id}-${row.model_number}-${row.color_name}-${row.memory}`">
              <tr
                class="data-row"
                @click="handleMobileRowTap(row.price_list_id || row.id)"
                @dblclick="toggleMobileActions(row.price_list_id || row.id)"
              >
                <td>{{ row.model_number || '-' }}</td>
                <td>{{ row.color_name || '-' }}</td>
                <td>{{ row.memory || '-' }}</td>
                <td>
                  <span
                    v-if="row.price_trend === 'up'"
                    class="price-trend-up"
                    @click.stop="handleViewHistory(row)"
                  >
                    <i class="fas fa-arrow-up"></i>
                    <span v-if="row.price_change_amount && row.price_change_amount !== '='">¥{{ Math.round(Number(row.price_change_amount)) }}</span>
                  </span>
                  <span
                    v-else-if="row.price_trend === 'down'"
                    class="price-trend-down"
                    @click.stop="handleViewHistory(row)"
                  >
                    <i class="fas fa-arrow-down"></i>
                    <span v-if="row.price_change_amount && row.price_change_amount !== '='">¥{{ Math.round(Number(row.price_change_amount)) }}</span>
                  </span>
                  <span
                    v-else
                    class="price-trend-neutral"
                    @click.stop="handleViewHistory(row)"
                  >
                    =
                  </span>
                </td>
                <td>
                  <span v-if="row.wholesale_price" class="wholesale-price-tag">
                    ¥{{ Number(row.wholesale_price).toFixed(0) }}
                  </span>
                  <span v-else class="text-gray">-</span>
                </td>
              </tr>
              <tr
                v-if="mobileActionRowId === (row.price_list_id || row.id)"
                class="mobile-action-row"
              >
                <td colspan="5">
                  <div class="mobile-row-actions">
                    <el-button type="primary" size="small" @click.stop="handleViewInventory(row)">
                      <i class="fas fa-eye"></i>
                      查看
                    </el-button>
                    <el-button type="success" size="small" @click.stop="handleViewHistory(row)">
                      <i class="fas fa-history"></i>
                      历史
                    </el-button>
                    <el-button v-if="canEdit" type="warning" size="small" @click.stop="handleEdit(row)">
                      <i class="fas fa-edit"></i>
                      编辑
                    </el-button>
                    <el-button v-if="canDelete" type="danger" size="small" @click.stop="handleDelete(row)">
                      <i class="fas fa-trash"></i>
                      删除
                    </el-button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <el-table
        v-else
        v-loading="loading"
        :data="priceList"
        stripe
        border
        class="w-full"
        :table-layout="'auto'"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="brand_name" label="品牌" min-width="80" align="center" show-overflow-tooltip />
        <el-table-column prop="model_number" label="型号" min-width="120" align="center" show-overflow-tooltip />
        <el-table-column prop="color_name" label="颜色" min-width="70" align="center" show-overflow-tooltip />
        <el-table-column prop="memory" label="内存" min-width="70" align="center" show-overflow-tooltip />
        <el-table-column prop="retail_price" label="零售价" min-width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.retail_price !== null && row.retail_price !== undefined && row.retail_price > 0" class="retail-price-tag">
              ¥{{ Number(row.retail_price).toFixed(0) }}
            </span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column label="价格趋势" width="100" align="center">
          <template #default="{ row }">
            <span
              v-if="row.price_trend === 'up'"
              class="price-trend-up"
              @click="handleViewHistory(row)"
            >
              <i class="fas fa-arrow-up"></i>
              <span v-if="row.price_change_amount && row.price_change_amount !== '='">¥{{ Math.round(Number(row.price_change_amount)) }}</span>
            </span>
            <span
              v-else-if="row.price_trend === 'down'"
              class="price-trend-down"
              @click="handleViewHistory(row)"
            >
              <i class="fas fa-arrow-down"></i>
              <span v-if="row.price_change_amount && row.price_change_amount !== '='">¥{{ Math.round(Number(row.price_change_amount)) }}</span>
            </span>
            <span
              v-else
              class="price-trend-neutral"
              @click="handleViewHistory(row)"
            >
              =
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="wholesale_price" label="批发价格" min-width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.wholesale_price" class="wholesale-price-tag">
              ¥{{ Number(row.wholesale_price).toFixed(0) }}
            </span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock_quantity" label="库存数" min-width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.stock_quantity > 0" type="primary" size="small">{{ row.stock_quantity }}台</el-tag>
            <el-tag v-else type="danger" size="small">0台</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_sync_time" label="同步时间" min-width="150" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.last_sync_time" type="danger" effect="plain" size="small">
              {{ formatDateTime(row.last_sync_time) }}
            </el-tag>
            <span v-else class="text-gray">未同步</span>
          </template>
        </el-table-column>
        <el-table-column prop="is_collect" label="采集状态" min-width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.is_collect === 0" type="info" size="small">不采集</el-tag>
            <el-tag v-else type="success" size="small">采集</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="show_price" label="报价" min-width="70" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.show_price"
              :active-value="1"
              :inactive-value="0"
              @change="handleToggleShowPrice(row)"
              :disabled="!canEdit"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="260" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" @click="handleViewInventory(row)">
                <i class="fas fa-eye"></i>
                查看
              </el-button>
              <el-button type="success" size="small" @click="handleViewHistory(row)">
                <i class="fas fa-history"></i>
                历史
              </el-button>
              <el-button v-if="canEdit" type="warning" size="small" @click="handleEdit(row)">
                <i class="fas fa-edit"></i>
                编辑
              </el-button>
              <el-button v-if="canDelete" type="danger" size="small" @click="handleDelete(row)">
                <i class="fas fa-trash"></i>
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <Pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          :show-range="true"
        />
      </div>
    </el-card>
    </div>

    <!-- 编辑对话框 -->
    <MobileDialog
      v-model="showEditDialog"
      :title="editForm.id ? '编辑采集' : '新增采集'"
      width="650px"
      dialog-class="price-list-edit-dialog"
      :show-default-footer="false"
    >
      <el-form :model="editForm" label-width="110px">
        <!-- 品牌、型号、颜色、内存选择 - 确保与 phones 表数据一致 -->
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="品牌" required>
              <el-select
                v-model="editForm.brand_id"
                placeholder="请选择品牌"
                filterable
                @change="handleBrandChangeInEdit"
                class="w-full"
              >
                <el-option
                  v-for="brand in editOptions.brands"
                  :key="brand.id"
                  :label="brand.name"
                  :value="brand.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="型号" required>
              <el-select
                v-model="editForm.model_id"
                placeholder="请选择型号"
                filterable
                :disabled="!editForm.brand_id"
                @change="handleModelChangeInEdit"
                class="w-full"
              >
                <el-option
                  v-for="model in editOptions.models"
                  :key="model.id"
                  :label="model.name"
                  :value="model.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="颜色" required>
              <el-select
                v-model="editForm.color_id"
                placeholder="请选择颜色"
                filterable
                :disabled="!editForm.model_id"
                class="w-full"
              >
                <el-option
                  v-for="color in editOptions.colors"
                  :key="color.id"
                  :label="color.name"
                  :value="color.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="内存" required>
              <el-select
                v-model="editForm.memory_id"
                placeholder="请选择内存"
                filterable
                :disabled="!editForm.model_id"
                class="w-full"
              >
                <el-option
                  v-for="memory in editOptions.memories"
                  :key="memory.id"
                  :label="memory.name || memory.size"
                  :value="memory.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 显示当前选择的组合，方便确认 -->
        <el-form-item v-if="editForm.brand_id && editForm.model_id">
          <el-alert type="info" :closable="false" class="text-sm">
            <template #title>
              当前选择：
              <strong>{{ getSelectedDisplayName() }}</strong>
              <div v-if="getStockCount() > 0" class="mt-1 text-success">
                <i class="fas fa-check-circle"></i> 库存{{ getStockCount() }}台
              </div>
              <div v-else class="mt-1 text-warning">
                <i class="fas fa-exclamation-triangle"></i> 库存0台
              </div>
            </template>
          </el-alert>
        </el-form-item>

        <!-- 外部型号（用于价格采集匹配） -->
        <el-form-item label="外部型号">
          <el-input
            v-model="editForm.external_model"
            placeholder="外部系统型号（如A3521）用于价格匹配"
          />
          <div class="mt-1 text-secondary text-xs">
            <i class="fas fa-info-circle"></i>
            外部型号用于匹配采集系统的价格数据，不影响本地数据
          </div>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="采集价">
              <el-input
                v-model="editForm.wholesale_price"
                type="number"
                placeholder="输入价格或留空删除"
                clearable
              >
                <template #prepend>¥</template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="销售价">
              <el-input
                :model-value="editForm.retail_price !== null && editForm.retail_price !== undefined ? `¥${Number(editForm.retail_price).toFixed(2)}` : '未设置（保存后自动计算）'"
                type="text"
                readonly
                disabled
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="实时库存">
          <el-input
            :model-value="`${getStockCount()}台`"
            type="text"
            style="width: 200px"
            readonly
            disabled
          />
        </el-form-item>
        <el-form-item label="同步时间">
          <el-date-picker
            v-model="editForm.last_sync_time"
            type="datetime"
            placeholder="选择同步时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            :clearable="true"
            @clear="() => editForm.last_sync_time = null"
            class="w-full"
          />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="8">
            <el-form-item label="采集状态">
              <el-switch
                v-model="editForm.is_collect"
                :active-value="1"
                :inactive-value="0"
                active-text="采集"
                inactive-text="不采集"
                inline-prompt
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="启用状态">
              <el-switch
                v-model="editForm.status"
                :active-value="1"
                :inactive-value="0"
                active-text="启用"
                inactive-text="停用"
                inline-prompt
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="8">
            <el-form-item label="报价显示">
              <el-switch
                v-model="editForm.show_price"
                :active-value="1"
                :inactive-value="0"
                active-text="显示"
                inactive-text="隐藏"
                inline-prompt
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input
            v-model="editForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </MobileDialog>

    <!-- 同步设置对话框 -->
    <MobileDialog
      v-model="showConfigDialog"
      title="同步设置"
      width="900px"
      dialog-class="price-list-config-dialog"
      :show-default-footer="false"
      @open="fetchSyncConfigsList"
    >
      <div class="sync-settings-container">
        <!-- 顶部：编辑区域 -->
        <div class="edit-section">
          <div class="section-header">
            <h3>{{ syncConfig.id ? '编辑同步源' : '添加同步源' }}</h3>
            <el-tag v-if="syncConfig.is_default" type="success" size="small">默认采集源</el-tag>
          </div>

          <el-form :model="syncConfig" label-width="100px" class="config-form">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="配置名称">
                  <el-input v-model="syncConfig.config_name" placeholder="请输入配置名称" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="间隔分钟">
                  <el-input-number
                    v-model="syncConfig.sync_interval"
                    :min="10"
                    :max="1440"
                    controls-position="right"
                    style="width: 150px"
                  />
                  <span class="ml-2 text-gray-500 text-sm">分钟</span>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="数据源URL">
              <el-input v-model="syncConfig.source_url" placeholder="请输入数据源URL" />
            </el-form-item>

            <el-form-item label="登录URL">
              <el-input v-model="syncConfig.login_url" placeholder="请输入登录URL（可选）" />
            </el-form-item>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="用户名">
                  <el-input v-model="syncConfig.login_username" placeholder="请输入登录用户名" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="密码">
                  <el-input
                    v-model="syncConfig.login_password"
                    type="password"
                    placeholder="请输入登录密码"
                    show-password
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <div class="form-actions">
            <el-button @click="resetConfigForm">清空</el-button>
            <el-button type="primary" @click="handleSaveConfig" :loading="savingConfig">
              {{ syncConfig.id ? '更新' : '添加' }}
            </el-button>
          </div>
        </div>

        <!-- 分隔线 -->
        <el-divider />

        <!-- 底部：数据列表 -->
        <div class="list-section">
          <div class="section-header">
            <h3>所有同步源</h3>
          </div>

          <el-table :data="syncConfigsList" stripe border max-height="300">
            <el-table-column prop="config_name" label="配置名称" width="130" />
            <el-table-column prop="login_username" label="用户名" width="120" />
            <el-table-column prop="source_url" label="数据源" width="180" show-overflow-tooltip>
              <template #default="{ row }">
                {{ formatSourceUrl(row.source_url) }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.is_default" type="success" size="small">默认</el-tag>
                <el-tag v-else type="info" size="small">普通</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="last_sync_time" label="最后同步" width="150">
              <template #default="{ row }">
                {{ row.last_sync_time ? formatDateTime(row.last_sync_time) : '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="220" fixed="right" align="center">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-button
                    v-if="canEdit && !row.is_default"
                    type="success"
                    size="small"
                    @click="handleSetDefaultConfig(row.id)"
                  >
                    <i class="fas fa-check"></i>
                    设为默认
                  </el-button>
                  <el-button
                    v-if="canEdit"
                    type="warning"
                    size="small"
                    @click="handleEditConfig(row)"
                  >
                    <i class="fas fa-edit"></i>
                    编辑
                  </el-button>
                  <el-button
                    v-if="canDelete && !row.is_default"
                    type="danger"
                    size="small"
                    @click="handleDeleteConfig(row.id)"
                  >
                    <i class="fas fa-trash"></i>
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button type="default" @click="showConfigDialog = false">关闭</el-button>
      </template>
    </MobileDialog>

    <!-- 价格历史对话框 -->
    <MobileDialog
      v-model="showHistoryDialog"
      title="价格历史记录"
      width="900px"
      dialog-class="price-list-history-dialog"
      :show-default-footer="false"
    >
      <div class="history-header">
        <div class="product-info">
          <span class="label">产品：</span>
          <span class="value">{{ currentProduct?.brand_name }} {{ currentProduct?.model_number }}</span>
          <span v-if="currentProduct?.color_name" class="color">{{ currentProduct.color_name }}</span>
          <span v-if="currentProduct?.memory" class="memory">{{ currentProduct.memory }}</span>
        </div>
        <div class="history-actions">
          <el-button type="danger" size="small" @click="handleClearHistory" :disabled="priceHistory.length === 0">
            <i class="fas fa-trash-alt"></i>
            清空历史
          </el-button>
        </div>
      </div>
      <el-table :data="priceHistory" stripe border max-height="400" @selection-change="handleHistorySelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="recorded_at" label="记录时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.recorded_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="retail_price" label="零售价" width="100" align="right">
          <template #default="{ row, $index }">
            <span v-if="hasPriceValue(row.retail_price)" :class="getPriceChangeClass('retail', $index)">
              ¥{{ row.retail_price }}
            </span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="wholesale_price" label="批发价" width="100" align="right">
          <template #default="{ row, $index }">
            <span v-if="hasPriceValue(row.wholesale_price)" :class="getPriceChangeClass('wholesale', $index)">
              ¥{{ row.wholesale_price }}
            </span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="change_type" label="价格变动" min-width="160" align="center">
          <template #default="{ row, $index }">
            <div class="history-change-cell">
              <template v-if="getHistoryChangeItems(row, $index).length > 0">
                <span
                  v-for="item in getHistoryChangeItems(row, $index)"
                  :key="item.text"
                  class="history-change-item"
                  :class="item.className"
                >
                  <span class="history-change-value">{{ item.text }}</span>
                </span>
              </template>
              <span v-else class="text-gray">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="change_reason" label="更新方式" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getChangeReasonTagType(row.change_reason)" size="small" effect="plain">
              {{ getChangeReasonLabel(row.change_reason) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="100" align="center" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button v-if="canDelete" type="danger" size="small" @click="handleDeleteHistoryItem(row)">
                <i class="fas fa-trash-alt"></i>
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="priceHistory.length === 0" class="empty-history">
        <el-empty description="暂无历史记录" />
      </div>
      <div v-if="selectedHistoryItems.length > 0" class="history-batch-actions">
        <span class="selected-count">已选择 {{ selectedHistoryItems.length }} 条记录</span>
        <el-button v-if="canDelete" type="danger" size="small" @click="handleBatchDeleteHistory">
          <i class="fas fa-trash-alt"></i>
          批量删除
        </el-button>
      </div>
    </MobileDialog>

    <!-- 库存详情对话框 -->
    <MobileDialog
      v-model="showInventoryDialog"
      :title="`${currentInventoryItem?.brand_name || ''} ${currentInventoryItem?.model_number || ''} ${currentInventoryItem?.color_name || ''} ${currentInventoryItem?.memory || ''} - 在库详情`"
      width="950px"
      dialog-class="price-list-inventory-dialog"
      :show-default-footer="false"
    >
      <div v-loading="inventoryLoading" class="inventory-dialog-content">
        <div class="inventory-header">
          <span class="record-count">共 {{ inventoryTotal }} 条记录</span>
        </div>
        <el-table :data="inventoryData" stripe border max-height="500" class="inventory-table">
          <el-table-column label="优先" width="60" align="center">
            <template #default="{ row, $index }">
              <span v-if="$index === 0" class="priority-badge">
                <i class="fas fa-star"></i>
              </span>
              <span v-else class="priority-rank">{{ $index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="store_name" label="店铺" width="100" />
          <el-table-column prop="model" label="型号" min-width="120" />
          <el-table-column prop="color" label="颜色" width="80" />
          <el-table-column prop="memory" label="内存" width="80" />
          <el-table-column prop="serial_number" label="序列号" width="120" />
          <el-table-column prop="imei" label="IMEI" width="150" />
          <el-table-column prop="Inventorytime" label="入库时间" width="110">
            <template #default="{ row }">
              {{ formatInventoryDate(row.Inventorytime) }}
            </template>
          </el-table-column>
          <el-table-column label="在库天数" width="90" align="center">
            <template #default="{ row }">
              <span :class="['days-badge', getInventoryDaysClass(row.inventory_days)]">
                {{ row.inventory_days }}天
              </span>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="inventoryData.length === 0" class="empty-inventory">
          <el-empty description="暂无库存数据" />
        </div>
      </div>
    </MobileDialog>

    <!-- 价格加价配置对话框 -->
    <PriceMarkupConfig
      v-model="showMarkupConfigDialog"
      :config="markupConfig"
      @save="handleMarkupConfigSave"
    />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getStockPhones,
  getPriceList,
  upsertPriceItem,
  deletePriceItem,
  getSyncConfig,
  getSyncConfigById,
  getAllSyncConfigs,
  createSyncConfig,
  setDefaultSyncConfig,
  deleteSyncConfig,
  updateSyncConfig,
  updateSyncConfigById,
  triggerSync,
  getPriceHistory,
  deletePriceHistory,
  batchDeletePriceHistory,
  clearPriceHistory,
  clearAllPriceHistory,
  clearPrices
} from '@/api/price-list'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import PermissionDenied from '@/components/base/PermissionDenied.vue'
import PageHeader from '@/components/base/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'
import PriceMarkupConfig from '@/components/PriceMarkupConfig.vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import ImportExportActions from '@/components/business/ImportExportActions.vue'
import { TimeUtil } from '@/utils/time'
import { logger } from '@/utils/logger'
import { useLoadingState } from '@/composables'

// 权限检查
const { canView, canCreate, canEdit, canDelete, canExport, canImport, handleNoPermission } = usePagePermissions('price-list')

// 数据状态
const router = useRouter()
const authStore = useAuthStore()
const { loading } = useLoadingState()
const { exportFile, importFile, buildDateFilename } = useImportExport()
const clearingAllHistory = ref(false)
const importingPriceList = ref(false)
const exportingPriceList = ref(false)
const priceListImportInputRef = ref<HTMLInputElement | null>(null)
const loadingOptions = ref(false)
const loadingModels = ref(false)
const priceList = ref<any[]>([])
const priceHistoryMap = ref<Map<number, any[]>>(new Map())
let trendLoadSeq = 0
const pagination = reactive({
  page: 1,
  limit: 100, // 每页100条
  total: 0
})

// 控制搜索筛选区域的显示
const searchExpanded = ref(false) // 搜索区域展开状态（移动端默认折叠）

// 筛选选项数据
const options = reactive({
  brands: [] as string[],
  models: [] as string[],
  allModels: [] as any[], // 存储所有型号数据（包含品牌关联）
  colors: [] as string[],
  memories: [] as string[]
})

// 搜索表单
const searchForm = reactive({
  search: '',
  brand_name: '',
  model_number: '',
  color_name: '',
  memory: '',
  is_collect: undefined as number | undefined,
  status: undefined as number | undefined
})

const buildPriceListParams = (includePagination = true) => {
  const params: Record<string, any> = {}

  if (includePagination) {
    params.page = pagination.page
    params.limit = pagination.limit
  }

  if (searchForm.search) params.search = searchForm.search
  if (searchForm.brand_name) params.brand_name = searchForm.brand_name
  if (searchForm.model_number) {
    params.model_number = searchForm.model_number
    params.model_exact = 1
  }
  if (searchForm.color_name) params.color_name = searchForm.color_name
  if (searchForm.memory) params.memory = searchForm.memory
  if (searchForm.is_collect !== undefined) params.is_collect = searchForm.is_collect
  if (searchForm.status !== undefined) params.status = searchForm.status

  return params
}

// 编辑对话框
const showEditDialog = ref(false)
const saving = ref(false)
const editForm = reactive({
  id: 0,
  // 使用ID确保与phones表数据一致
  brand_id: null as number | null,
  model_id: null as number | null,
  color_id: null as number | null,
  memory_id: null as number | null,
  // 外部型号（用于价格采集匹配）
  external_model: '',
  // 价格字段
  retail_price: null as number | null,
  wholesale_price: null as number | null,
  last_sync_time: null as string | null,
  is_collect: 1,
  status: 1,
  show_price: 0,
  remark: '',
  is_manual_edit: false
})

// 编辑对话框的选项数据（从数据库加载，确保一致性）
const editOptions = reactive({
  brands: [] as Array<{id: number, name: string}>,
  models: [] as Array<{id: number, name: string}>,
  colors: [] as Array<{id: number, name: string}>,
  memories: [] as Array<{id: number, size: string, name?: string}>,
  // 当前组合的库存数量
  stockCount: 0
})

const resetEditForm = () => {
  Object.assign(editForm, {
    id: 0,
    brand_id: null,
    model_id: null,
    color_id: null,
    memory_id: null,
    external_model: '',
    retail_price: null,
    wholesale_price: null,
    last_sync_time: null,
    is_collect: 1,
    status: 1,
    show_price: 0,
    remark: '',
    is_manual_edit: false
  })
  editOptions.stockCount = 0
}

// 同步设置
const showConfigDialog = ref(false)
const savingConfig = ref(false)
const syncing = ref(false)
const clearingPrices = ref(false)
const syncConfigsList = ref<any[]>([])
const syncConfig = reactive({
  id: null as number | null,
  is_default: false,
  config_name: '',
  source_url: '',
  login_url: '',
  login_username: '',
  login_password: '',
  sync_interval: 60
})

// 价格历史
const showHistoryDialog = ref(false)
const priceHistory = ref<any[]>([])
const currentProduct = ref<any>(null)
const selectedHistoryItems = ref<any[]>([])

// 库存详情
const showInventoryDialog = ref(false)
const inventoryLoading = ref(false)
const inventoryData = ref<any[]>([])
const inventoryTotal = ref(0)
const currentInventoryItem = ref<any>(null)
const isMobile = ref(false)
const mobileActionRowId = ref<number | null>(null)
const lastTappedRowId = ref<number | null>(null)
const lastTapTimestamp = ref(0)

const updateMobileState = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) {
    mobileActionRowId.value = null
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
  }
}

const toggleMobileActions = (id: number | null) => {
  if (!isMobile.value || !id) return
  mobileActionRowId.value = mobileActionRowId.value === id ? null : id
}

const handleMobileRowTap = (id: number | null) => {
  if (!isMobile.value || !id) return

  const now = Date.now()
  if (lastTappedRowId.value === id && now - lastTapTimestamp.value <= 320) {
    toggleMobileActions(id)
    lastTappedRowId.value = null
    lastTapTimestamp.value = 0
    return
  }

  lastTappedRowId.value = id
  lastTapTimestamp.value = now
}

// 获取价格列表（从在库商品中获取，只要全新机器）
const fetchPriceList = async () => {
  if (!canView.value) {
    priceList.value = []
    pagination.total = 0
    return
  }

  loading.value = true
  try {
    const res = await getPriceList(buildPriceListParams(true))

    if (res.success && res.data) {
      const data = res.data
      const list = Array.isArray(data.list) ? data.list : []

      if (list.length > 0) {
      }

      // 转换数据格式，保持原始的大小写格式用于显示
      const formattedList = list.map((item: any) => ({
        brand_name: item.brand_name || '',
        model_number: item.model_number || '',
        external_model: item.external_model || '',
        color_name: item.color_name || '',
        memory: item.memory || '',
        // 修复：0 也应该被保留，不应该被转换为 null
        wholesale_price: item.wholesale_price != null ? Number(item.wholesale_price) : null,
        retail_price: item.retail_price != null && item.retail_price !== undefined ? Number(item.retail_price) : null,
        stock_quantity: Number(item.stock_quantity) || 0,
        last_sync_time: item.last_sync_time || null,
        is_collect: item.is_collect !== undefined ? Number(item.is_collect) : 1,
        status: item.status !== undefined ? Number(item.status) : 1,
        show_price: item.show_price !== undefined && item.show_price !== null ? Number(item.show_price) : 0,
        id: item.price_list_id || item.id || null,
        price_list_id: item.price_list_id || item.id || null
      }))


      priceList.value = formattedList
      // 确保 total 是数字类型
      pagination.total = Number(data.total) || formattedList.length || 0

      // 加载价格趋势数据（不阻塞首屏）
      const currentTrendSeq = ++trendLoadSeq
      loadPriceTrends(formattedList, currentTrendSeq)
    } else {
      priceList.value = []
      pagination.total = 0
    }
  } catch (error) {
    logger.error('获取价格列表失败:', error)
    ElMessage.error('获取价格列表失败')
  } finally {
    loading.value = false
  }
}

const handleExportPriceList = async () => {
  await exportFile({
    url: '/price-list/export',
    filename: buildDateFilename('报价管理', 'xlsx'),
    params: buildPriceListParams(false),
    allowed: canExport,
    loading: exportingPriceList,
    onNoPermission: () => handleNoPermission('export'),
    successMessage: '报价管理导出成功',
    errorMessage: '报价管理导出失败'
  })
}

const triggerPriceListImport = () => {
  if (!canImport.value) {
    handleNoPermission('import')
    return
  }

  priceListImportInputRef.value?.click()
}

const handlePriceListImportChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    const result = await importFile({
      url: '/price-list/import',
      file,
      allowed: canImport,
      loading: importingPriceList,
      onNoPermission: () => handleNoPermission('import'),
      successMessage: '报价管理导入成功',
      errorMessage: '报价管理导入失败'
    })

    if (result?.success) {
      pagination.page = 1
      await fetchPriceList()
    }
  } finally {
    input.value = ''
  }
}

// 防抖搜索
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debounceSearch = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    handleSearch()
  }, 300)
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchPriceList()
}

// 重置
const handleReset = () => {
  searchForm.search = ''
  searchForm.brand_name = ''
  searchForm.model_number = ''
  searchForm.color_name = ''
  searchForm.memory = ''
  searchForm.is_collect = undefined
  searchForm.status = undefined
  handleSearch()
}

const handleQuoteCommand = (command: 'wholesale' | 'sales') => {
  if (command === 'wholesale') {
    router.push('/price-query')
    return
  }

  if (command === 'sales') {
    router.push('/sales-price-display')
  }
}

const handleDataCleanupCommand = async (command: 'clear_prices' | 'clear_history') => {
  if (command === 'clear_prices') {
    await handleClearPrices()
    return
  }

  if (command === 'clear_history') {
    await handleClearAllPriceHistory()
  }
}

const handleSyncSettingsCommand = (command: 'sync_logs' | 'sync_config' | 'markup_config') => {
  if (command === 'sync_logs') {
    router.push('/price-list/sync-logs')
    return
  }

  if (command === 'sync_config') {
    openConfigDialog()
    return
  }

  if (command === 'markup_config') {
    openMarkupConfigDialog()
  }
}

// 加载编辑选项（品牌、型号、颜色、内存）
const loadEditOptions = async () => {
  if (!canView.value) {
    editOptions.brands = []
    editOptions.models = []
    editOptions.colors = []
    editOptions.memories = []
    return
  }

  try {
    // 确保初始化为数组
    editOptions.brands = []
    editOptions.models = []
    editOptions.colors = []
    editOptions.memories = []

    // 使用 shop-public API 加载基础数据
    // 价格表管理不应该受库存限制，需要获取所有品牌、型号、颜色
    const [brandsRes, modelsRes, colorsRes, memoriesRes] = await Promise.all([
      api.get('/public/brands', { params: { include_empty: 'true' } }),
      api.get('/public/models', { params: { include_empty: 'true' } }),
      api.get('/public/colors', { params: { include_empty: 'true' } }),
      api.get('/public/memories')
    ])

    // unifiedApi 返回 response.data，即 { success: true, data: [...], message: "..." }
    // 所以我们需要取 .data 字段
    editOptions.brands = brandsRes.data || []
    editOptions.models = modelsRes.data || []
    editOptions.colors = colorsRes.data || []
    editOptions.memories = memoriesRes.data || []
  } catch (error) {
    logger.error('加载编辑选项失败:', error)
    // 确保即使失败也是数组
    editOptions.brands = []
    editOptions.models = []
    editOptions.colors = []
    editOptions.memories = []
  }
}

// 编辑对话框中的品牌变化
const handleBrandChangeInEdit = async (brandId: number) => {
  editForm.model_id = null
  editForm.color_id = null
  editForm.memory_id = null
  editOptions.stockCount = 0

  if (brandId) {
    try {
      // 筛选该品牌的型号（包括没有库存的）
      const modelsRes = await api.get('/public/models', {
        params: { brand_id: brandId, include_empty: 'true' }
      })
      editOptions.models = extractResponseData<any[]>(modelsRes)
    } catch (error) {
      logger.error('加载型号失败:', error)
      editOptions.models = []
    }
  }
}

// 编辑对话框中的型号变化
const handleModelChangeInEdit = async (modelId: number) => {
  // 清空当前选择
  editForm.color_id = null
  editForm.memory_id = null
  editOptions.stockCount = 0

  // 不再根据库存过滤颜色和内存，编辑时应该显示所有选项
  // 价格表管理不应该受库存限制
}

// 获取当前选择的显示名称
const getSelectedDisplayName = () => {
  const brand = editOptions.brands.find(b => b.id === editForm.brand_id)
  const model = editOptions.models.find(m => m.id === editForm.model_id)
  const color = editOptions.colors.find(c => c.id === editForm.color_id)
  const memory = editOptions.memories.find(m => m.id === editForm.memory_id)

  return `${brand?.name || ''} ${model?.name || ''} ${color?.name || ''} ${memory?.name || memory?.size || ''}`.trim()
}

// 获取当前组合的库存数量
const getStockCount = () => {
  // 这个值会在用户选择组合时更新
  return editOptions.stockCount
}

// 监听选择变化，更新库存数量
watch([() => editForm.brand_id, () => editForm.model_id, () => editForm.color_id, () => editForm.memory_id],
  async ([brandId, modelId, colorId, memoryId]) => {
    if (brandId && modelId && colorId && memoryId) {
      try {
        const res = await getStockPhones({
          brand_id: brandId,
          model_id: modelId,
          color_id: colorId,
          memory_id: memoryId,
          is_new: 1,
          status: 'in_stock'
        })
        const phones = Array.isArray(res.data) ? res.data : []
        editOptions.stockCount = Number(res.pagination?.total) || phones.length
      } catch (error) {
        editOptions.stockCount = 0
      }
    } else {
      editOptions.stockCount = 0
    }
  }
)

// 编辑
const handleEdit = async (row: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  resetEditForm()

  // 先加载选项数据
  await loadEditOptions()

  // 确保数据是数组
  if (!Array.isArray(editOptions.brands)) editOptions.brands = []
  if (!Array.isArray(editOptions.models)) editOptions.models = []
  if (!Array.isArray(editOptions.colors)) editOptions.colors = []
  if (!Array.isArray(editOptions.memories)) editOptions.memories = []

  // 转换时间为北京时间格式
  const formatDateTimeForEdit = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  // 查找对应的ID（通过名称匹配）
  const brand = editOptions.brands.find(b => b.name === row.brand_name)

  // 先通过品牌筛选型号，然后再查找
  if (brand) {
    await handleBrandChangeInEdit(brand.id)
  }

  // 现在可以从筛选后的型号列表中查找
  const model = editOptions.models.find(m => m.name === row.model_number)
  const color = editOptions.colors.find(c => c.name === row.color_name)
  const memory = editOptions.memories.find(m => m.name === row.memory || m.size === row.memory)

  Object.assign(editForm, {
    id: row.id || row.price_list_id,
    brand_id: brand?.id || null,
    model_id: model?.id || null,
    color_id: color?.id || null,
    memory_id: memory?.id || null,
    external_model: row.external_model || '',
    retail_price: row.retail_price,
    wholesale_price: row.wholesale_price,
    last_sync_time: formatDateTimeForEdit(row.last_sync_time),
    is_collect: row.is_collect !== undefined ? row.is_collect : 1,
    status: row.status !== undefined ? row.status : 1,
    show_price: row.show_price !== undefined ? row.show_price : 1,
    remark: row.remark || ''
  })
  editOptions.stockCount = Number(row.stock_quantity) || 0
  showEditDialog.value = true
}

const handleCreate = async () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  resetEditForm()
  await loadEditOptions()
  showEditDialog.value = true
}

// 保存
const handleSave = async () => {
  const action = editForm.id ? 'edit' : 'create'
  const allowed = editForm.id ? canEdit.value : canCreate.value
  if (!allowed) {
    handleNoPermission(action)
    return
  }

  if (!editForm.brand_id || !editForm.model_id || !editForm.color_id || !editForm.memory_id) {
    ElMessage.warning('请选择品牌、型号、颜色和内存')
    return
  }

  saving.value = true
  try {
    // 将 ID 转换为名称（后端 API 需要名称）
    const brand = editOptions.brands.find(b => b.id === editForm.brand_id)
    const model = editOptions.models.find(m => m.id === editForm.model_id)
    const color = editOptions.colors.find(c => c.id === editForm.color_id)
    const memory = editOptions.memories.find(m => m.id === editForm.memory_id)

    if (!brand || !model) {
      ElMessage.error('品牌或型号不存在')
      return
    }

    const data = {
      id: editForm.id,
      // 后端需要名称，从选项中获取
      brand_name: brand.name,
      model_number: model.name,
      color_name: color?.name || null,
      // 注意：API返回的内存数据是 { id, name }，其中 name 是实际的内存规格
      // 因为后端 getMemories 使用了 "size as name"
      memory: memory?.name || memory?.size || null,
      external_model: editForm.external_model,
      wholesale_price: editForm.wholesale_price,
      last_sync_time: editForm.last_sync_time,
      is_collect: editForm.is_collect,
      status: editForm.status,
      show_price: editForm.show_price,
      remark: editForm.remark,
      is_manual_edit: true
    }

    // 处理价格字段：将 undefined、null、空字符串转换为 null
    const priceFields = ['wholesale_price']
    priceFields.forEach(field => {
      const value = data[field]
      if (value === undefined || value === null || value === '' || (typeof value === 'string' && value.trim() === '')) {
        data[field] = null
      } else if (typeof value === 'string') {
        const num = parseFloat(value)
        data[field] = isNaN(num) ? null : num
      } else if (typeof value === 'number') {
        data[field] = isNaN(value) ? null : value
      } else {
        data[field] = null
      }
    })

    // 零售价字段：不发送，让后端自动计算
    delete (data as any).retail_price

    // 处理同步时间
    if (!data.last_sync_time || data.last_sync_time === '' || data.last_sync_time.trim() === '') {
      data.last_sync_time = null
    }

    const res = await upsertPriceItem(data)
    if (res.success) {
      ElMessage.success('保存成功')
      showEditDialog.value = false
      fetchPriceList()
    }
  } catch (error) {
    logger.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 删除
const handleDelete = async (row: any) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm('确定要删除这条价格记录吗？', '提示', {
      type: 'warning'
    })
    const res = await deletePriceItem(row.id)
    if (res.success) {
      ElMessage.success('删除成功')
      fetchPriceList()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 切换报价显示状态
const handleToggleShowPrice = async (row: any) => {
  if (!canEdit.value) {
    row.show_price = row.show_price ? 0 : 1
    handleNoPermission('edit')
    return
  }

  try {
    const res = await upsertPriceItem({
      id: row.id,
      brand_name: row.brand_name,
      model_number: row.model_number,
      color_name: row.color_name,
      memory: row.memory,
      show_price: row.show_price,
      is_manual_edit: true
    })
    if (res.success) {
      ElMessage.success(row.show_price ? '已开启报价显示' : '已关闭报价显示')
      // 不重新获取数据，保持用户操作的状态
    } else {
      // 如果保存失败，恢复原值
      row.show_price = row.show_price ? 0 : 1
      ElMessage.error('操作失败')
    }
  } catch (error) {
    // 如果出错，恢复原值
    row.show_price = row.show_price ? 0 : 1
    ElMessage.error('操作失败')
  }
}

// 同步
const handleSync = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  syncing.value = true
  try {
    const res = await triggerSync()
    if (res.success) {
      ElMessage.success(`同步完成：共${res.data.total}条，成功${res.data.success}条`)
      fetchPriceList()
    }
  } catch (error) {
    ElMessage.error('同步失败')
  } finally {
    syncing.value = false
  }
}

// 一键清零采集价格
const handleClearPrices = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  // 二次确认
  try {
    await ElMessageBox.confirm(
      '确定要清零所有采集的价格吗？此操作将把批发价和零售价都设置为0。',
      '清零价格确认',
      {
        confirmButtonText: '确定清零',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch {
    return // 用户取消
  }

  clearingPrices.value = true
  try {
    const res = await clearPrices()
    if (res.success) {
      ElMessage.success(res.message || `已清零 ${res.data.updatedCount} 条价格记录`)
      fetchPriceList()
    }
  } catch (error) {
    ElMessage.error('清零价格失败')
  } finally {
    clearingPrices.value = false
  }
}

// 一键清理全部历史价格
const handleClearAllPriceHistory = async () => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定要清理所有历史价格记录吗？此操作会删除全部商品的历史价格，且不可恢复。',
      '清理历史价格确认',
      {
        confirmButtonText: '确定清理',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch {
    return
  }

  clearingAllHistory.value = true
  try {
    const res = await clearAllPriceHistory()
    if (res.success) {
      priceHistory.value = []
      priceHistoryMap.value.clear()
      ElMessage.success(res.message || `已清理 ${res.data?.deletedCount || 0} 条历史记录`)
    }
  } catch (error) {
    logger.error('清理全部历史价格失败:', error)
    ElMessage.error('清理失败')
  } finally {
    clearingAllHistory.value = false
  }
}

// 打开配置对话框
const openConfigDialog = () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  // 清空表单，准备添加新配置
  resetConfigForm()
  showConfigDialog.value = true
}

// ============ 价格加价配置 ============
const showMarkupConfigDialog = ref(false)
const markupConfig = ref<any>(null)

// 保存同步配置（支持添加新配置和更新现有配置）
const handleSaveConfig = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  // 验证必填字段
  if (!syncConfig.config_name || !syncConfig.login_username) {
    ElMessage.warning('请填写配置名称和用户名')
    return
  }

  savingConfig.value = true
  try {
    const dataToSend = { ...syncConfig }

    // 如果是更新操作且密码为空，不发送密码字段（保持原有密码）
    if (dataToSend.id && (!dataToSend.login_password || dataToSend.login_password === '')) {
      delete dataToSend.login_password
    }

    // 如果是添加新配置，必须有密码
    if (!dataToSend.id && !dataToSend.login_password) {
      ElMessage.warning('请填写登录密码')
      savingConfig.value = false
      return
    }

    let res
    if (dataToSend.id) {
      // 更新现有配置
      res = await updateSyncConfigById(dataToSend.id, dataToSend)
    } else {
      // 创建新配置
      res = await createSyncConfig(dataToSend)
    }

    if (res.success) {
      ElMessage.success(dataToSend.id ? '配置更新成功' : '配置添加成功')
      // 清空表单
      resetConfigForm()
      // 刷新列表
      await fetchSyncConfigsList()
    }
  } catch (error) {
    logger.error('保存配置失败', error)
    ElMessage.error('保存配置失败')
  } finally {
    savingConfig.value = false
  }
}

// 获取所有同步配置列表
const fetchSyncConfigsList = async () => {
  if (!canView.value) {
    syncConfigsList.value = []
    return
  }

  try {
    const res = await getAllSyncConfigs()
    if (res.success) {
      syncConfigsList.value = res.data || []
    }
  } catch (error) {
    logger.error('获取同步配置列表失败', error)
  }
}

// 设置默认同步配置
const handleSetDefaultConfig = async (configId: number) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    await ElMessageBox.confirm('确定要将此配置设为默认采集源吗？', '确认', {
      type: 'warning'
    })

    const res = await setDefaultSyncConfig(configId)
    if (res.success) {
      ElMessage.success('已设置为默认采集源')
      // 刷新列表
      await fetchSyncConfigsList()
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('设置默认配置失败', error)
      ElMessage.error('设置失败')
    }
  }
}

// 删除同步配置
const handleDeleteConfig = async (configId: number) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm('确定要删除此同步源吗？', '确认', {
      type: 'warning'
    })

    const res = await deleteSyncConfig(configId)
    if (res.success) {
      ElMessage.success('删除成功')
      await fetchSyncConfigsList()
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('删除配置失败', error)
      ElMessage.error('删除失败')
    }
  }
}

// 编辑同步配置
const handleEditConfig = async (row: any) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  // 获取该配置的完整信息（包括密码）
  try {
    const res = await getSyncConfigById(row.id)
    if (res.success && res.data) {
      Object.assign(syncConfig, {
        id: res.data.id,
        is_default: res.data.is_default,
        config_name: res.data.config_name || '',
        source_url: res.data.source_url || '',
        login_url: res.data.login_url || '',
        login_username: res.data.login_username || '',
        // 如果密码是占位符，显示为空；否则显示真实密码（用于编辑）
        login_password: (res.data.login_password && res.data.login_password !== '••••••••') ? res.data.login_password : '',
        sync_interval: res.data.sync_interval || 60
      })
    } else {
      // 如果获取失败，使用列表中的数据
      Object.assign(syncConfig, {
        id: row.id,
        is_default: row.is_default,
        config_name: row.config_name,
        source_url: row.source_url,
        login_url: row.login_url,
        login_username: row.login_username,
        login_password: '',
        sync_interval: row.sync_interval
      })
    }
  } catch (error) {
    logger.error('获取配置详情失败', error)
    ElMessage.error('获取配置详情失败')
  }
}

// 清空配置表单（用于添加新配置）
const resetConfigForm = () => {
  Object.assign(syncConfig, {
    id: null,
    is_default: false,
    config_name: '',
    source_url: '',
    login_url: '',
    login_username: '',
    login_password: '',
    sync_interval: 60
  })
}

// ============ 价格加价配置相关函数 ============
// 打开价格加价配置对话框
const openMarkupConfigDialog = () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  showMarkupConfigDialog.value = true
}

// 处理价格加价配置保存
const handleMarkupConfigSave = (config: any) => {
  markupConfig.value = config
  ElMessage.success('价格加价配置已更新')
}

// 查看历史
const handleViewHistory = async (row: any) => {
  if (!canView.value) {
    handleNoPermission('view')
    return
  }

  currentProduct.value = row
  try {
    const res = await getPriceHistory(row.id || row.price_list_id, undefined, { useCache: false })
    if (res.success) {
      priceHistory.value = res.data || []
      showHistoryDialog.value = true
    }
  } catch (error) {
    ElMessage.error('获取历史记录失败')
  }
}

// 历史记录选择变化
const handleHistorySelectionChange = (selection: any[]) => {
  selectedHistoryItems.value = selection
}

// 删除单条历史记录
const handleDeleteHistoryItem = async (row: any) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm('确定要删除这条历史记录吗？', '提示', {
      type: 'warning'
    })

    const priceListId = currentProduct.value?.price_list_id || currentProduct.value?.id
    const res = await deletePriceHistory(priceListId, row.id)

    if (res.success) {
      ElMessage.success('删除成功')
      // 重新加载历史记录
      await handleViewHistory(currentProduct.value)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 批量删除历史记录
const handleBatchDeleteHistory = async () => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  if (selectedHistoryItems.value.length === 0) {
    ElMessage.warning('请选择要删除的记录')
    return
  }

  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedHistoryItems.value.length} 条历史记录吗？`, '提示', {
      type: 'warning',
      customClass: 'message-box-purple'
    })

    const priceListId = currentProduct.value?.price_list_id || currentProduct.value?.id
    const historyIds = selectedHistoryItems.value.map(item => item.id)

    const res = await batchDeletePriceHistory(priceListId, historyIds)

    if (res.success) {
      ElMessage.success(`成功删除 ${selectedHistoryItems.value.length} 条记录`)
      selectedHistoryItems.value = []
      // 重新加载历史记录
      await handleViewHistory(currentProduct.value)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  }
}

// 清空历史记录
const handleClearHistory = async () => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  try {
    await ElMessageBox.confirm('确定要清空所有历史记录吗？此操作不可恢复！', '警告', {
      type: 'error',
      confirmButtonText: '确定清空',
      cancelButtonText: '取消'
    })

    const priceListId = currentProduct.value?.price_list_id || currentProduct.value?.id
    const res = await clearPriceHistory(priceListId)

    if (res.success) {
      ElMessage.success('已清空所有历史记录')
      priceHistory.value = []
      selectedHistoryItems.value = []
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清空失败')
    }
  }
}

// 查看库存详情（在库最长时间的数据）
const handleViewInventory = async (row: any) => {
  if (!canView.value) {
    handleNoPermission('view')
    return
  }

  currentInventoryItem.value = row
  showInventoryDialog.value = true
  inventoryLoading.value = true
  inventoryData.value = []
  inventoryTotal.value = 0

  try {
    const res = await getStockPhones({
      brand: row.brand_name,
      model: row.model_number,
      model_exact: 1,
      color: row.color_name,
      memory: row.memory,
      status: 'in_stock',
      is_new: 1,
      limit: 100
    })

    if (res.success && res.data && res.data.list) {
      // 计算在库天数并按在库天数排序
      inventoryData.value = (res.data.list as any[])
        .map(item => ({
          ...item,
          inventory_days: calculateInventoryDays(item.Inventorytime)
        }))
        .sort((a, b) => b.inventory_days - a.inventory_days) // 按在库天数降序排序
      inventoryTotal.value = Number(res.pagination?.total) || inventoryData.value.length
    } else if (res.success && res.data) {
      // 处理直接返回数组的情况
      inventoryData.value = (res.data as any[])
        .map(item => ({
          ...item,
          inventory_days: calculateInventoryDays(item.Inventorytime)
        }))
        .sort((a, b) => b.inventory_days - a.inventory_days)
      inventoryTotal.value = Number(res.pagination?.total) || inventoryData.value.length
    }
  } catch (error) {
    logger.error('获取库存详情失败:', error)
    ElMessage.error('获取库存详情失败')
  } finally {
    inventoryLoading.value = false
  }
}

// 计算在库天数
const calculateInventoryDays = (inventoryTime: string) => {
  if (!inventoryTime) return 0
  const inventoryDate = TimeUtil.parse(inventoryTime)
  if (!inventoryDate || !inventoryDate.isValid()) return 0
  const today = TimeUtil.now()
  return Math.max(TimeUtil.diff(today.startOf('day'), inventoryDate.startOf('day'), 'day'), 0)
}

// 加载价格趋势数据
const loadPriceTrends = async (list: any[], seq: number) => {
  if (seq !== trendLoadSeq) return
  // 过滤出有 price_list_id 的项目
  const itemsWithId = list.filter(item => item.price_list_id)

  if (itemsWithId.length === 0) {
    return
  }

  const runWithConcurrency = async (items: any[], limit: number, worker: (item: any) => Promise<void>) => {
    const executing = new Set<Promise<void>>()
    for (const item of items) {
      const p = (async () => {
        await worker(item)
      })()
      executing.add(p)
      const clean = () => executing.delete(p)
      p.then(clean).catch(clean)
      if (executing.size >= limit) {
        await Promise.race(executing)
      }
    }
    await Promise.allSettled(executing)
  }

  const applyTrendFromHistory = (item: any, history: any[]) => {
    if (history.length >= 2) {
      const current = history[0]
      const previous = history[1]

      const currentWholesale = Number(current.wholesale_price) || 0
      const previousWholesale = Number(previous.wholesale_price) || 0

      // 只有当两个价格都存在且不为null时才比较
      const hasCurrentPrice = current.wholesale_price !== null && current.wholesale_price !== undefined && current.wholesale_price !== ''
      const hasPreviousPrice = previous.wholesale_price !== null && previous.wholesale_price !== undefined && previous.wholesale_price !== ''

      if (hasCurrentPrice && hasPreviousPrice) {
        if (currentWholesale > previousWholesale) {
          item.price_trend = 'up'
          item.price_change_amount = (currentWholesale - previousWholesale).toFixed(2)
        } else if (currentWholesale < previousWholesale) {
          item.price_trend = 'down'
          item.price_change_amount = (previousWholesale - currentWholesale).toFixed(2)
        } else {
          item.price_trend = 'neutral'
          item.price_change_amount = '='
        }
      } else {
        // 只有一个价格有值，无法比较
        item.price_trend = 'neutral'
        item.price_change_amount = '='
      }
    } else {
      item.price_trend = 'neutral'
      item.price_change_amount = '='
    }
  }

  const loadOne = async (item: any) => {
    if (seq !== trendLoadSeq) return
    try {
      const res = await getPriceHistory(item.price_list_id, { limit: 2 }, { useCache: false })
      if (seq !== trendLoadSeq) return
      if (res.success && res.data && Array.isArray(res.data)) {
        priceHistoryMap.value.set(item.price_list_id, res.data)
        applyTrendFromHistory(item, res.data)
      } else {
        item.price_trend = 'neutral'
        item.price_change_amount = '='
      }
    } catch (error) {
      logger.error('获取价格历史失败:', item.price_list_id, error)
      item.price_trend = 'neutral'
      item.price_change_percent = 0
    }
  }

  // 并发+限流，避免大量串行请求导致页面变慢
  await runWithConcurrency(itemsWithId, 6, loadOne)

  // 强制触发响应式更新
  priceList.value = [...priceList.value]
}

// 格式化入库时间
const formatInventoryDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取在库天数对应的样式类
const getInventoryDaysClass = (days: number) => {
  if (days >= 30) return 'days-critical'
  if (days >= 20) return 'days-warning'
  if (days >= 10) return 'days-caution'
  return 'days-normal'
}

// 获取价格变化样式类名
const getPriceChangeClass = (priceType: string, index: number) => {
  if (index >= priceHistory.value.length - 1) return ''
  const current = priceHistory.value[index]
  const previous = priceHistory.value[index + 1]

  const currentPrice = current[`${priceType}_price`]
  const previousPrice = previous[`${priceType}_price`]

  if (!hasPriceValue(currentPrice) || !hasPriceValue(previousPrice)) return ''

  if (currentPrice > previousPrice) return 'price-up'
  if (currentPrice < previousPrice) return 'price-down'
  return ''
}

const hasPriceValue = (price: unknown) => price !== null && price !== undefined && price !== ''

const normalizeHistoryPrice = (price: unknown) => {
  if (!hasPriceValue(price)) return null
  const num = Number(price)
  return Number.isNaN(num) ? null : num
}

const formatPriceAmount = (amount: number) => {
  const fixed = Math.abs(amount).toFixed(2)
  return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
}

const getHistoryChangeItems = (row: any, index: number) => {
  if (index >= priceHistory.value.length - 1) return []

  const previous = priceHistory.value[index + 1]
  const currentPrice = normalizeHistoryPrice(row.wholesale_price)
  const previousPrice = normalizeHistoryPrice(previous?.wholesale_price)

  if (currentPrice === previousPrice) {
    return []
  }

  if (previousPrice === null && currentPrice !== null) {
    return [{
      text: `价格上涨${formatPriceAmount(currentPrice)}`,
      className: 'is-up'
    }]
  }

  if (previousPrice !== null && currentPrice === null) {
    return [{
      text: `价格下跌${formatPriceAmount(previousPrice)}`,
      className: 'is-down'
    }]
  }

  if (currentPrice !== null && previousPrice !== null) {
    const diff = currentPrice - previousPrice
    if (diff !== 0) {
      return [{
        text: `价格${diff > 0 ? '上涨' : '下跌'}${formatPriceAmount(diff)}`,
        className: diff > 0 ? 'is-up' : 'is-down'
      }]
    }
  }

  return []
}

// 获取价格变动标签
const getChangeTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    create: '新建',
    new_price: '首次定价',
    price_increased: '价格上涨',
    price_decreased: '价格下降',
    price_dropped: '价格清空',
    unchanged: '价格未变'
  }
  return labels[type] || type || '-'
}

const getChangeTypeTagType = (type: string) => {
  const tagTypes: Record<string, string> = {
    create: 'success',
    new_price: 'success',
    price_increased: 'danger',
    price_decreased: 'success',
    price_dropped: 'warning',
    unchanged: 'info'
  }
  return tagTypes[type] || 'info'
}

// 获取更新方式标签
const getChangeReasonLabel = (reason: string) => {
  const labels: Record<string, string> = {
    manual: '手动更新',
    sync: '自动更新'
  }
  return labels[reason] || reason || '-'
}

const getChangeReasonTagType = (reason: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const tagTypes: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    manual: 'warning',
    sync: 'info'
  }
  return tagTypes[reason] || 'info'
}

// 格式化时间
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-'

  const date = new Date(dateStr)

  // 检查是否是有效日期
  if (isNaN(date.getTime())) return '-'

  // 转换为北京时间（UTC+8）
  const beijingTime = new Date(date.getTime() + (8 * 60 * 60 * 1000))

  const year = beijingTime.getUTCFullYear()
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getUTCDate()).padStart(2, '0')
  const hours = String(beijingTime.getUTCHours()).padStart(2, '0')
  const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0')
  const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

// 格式化数据源URL - 精简显示
const formatSourceUrl = (url: string) => {
  if (!url) return '-'

  try {
    // 如果是完整URL，提取域名
    if (url.startsWith('http')) {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname

      // 精简显示：例如 81119.byb2b.cn
      return hostname
    }

    // 如果不是完整URL，直接返回（可能是相对路径或其他格式）
    return url.length > 30 ? url.substring(0, 30) + '...' : url
  } catch (e) {
    // URL解析失败，直接截断显示
    return url.length > 30 ? url.substring(0, 30) + '...' : url
  }
}

// 监听分页变化
watch(() => [pagination.page, pagination.limit], () => {
  fetchPriceList()
})

// 加载筛选选项数据
const loadFilterOptions = async () => {
  if (!canView.value) {
    options.brands = []
    options.models = []
    options.allModels = []
    options.colors = []
    options.memories = []
    return
  }

  loadingOptions.value = true
  try {
    // 并行加载所有选项数据
    const [brandsRes, modelsRes, colorsRes, memoriesRes] = await Promise.all([
      api.get('/brands?status=1&limit=10000'),
      api.get('/models?limit=10000'),
      api.get('/colors?limit=10000'),
      api.get('/memories?limit=10000')
    ])

    // 处理品牌数据
    if (brandsRes.success) {
      options.brands = extractResponseData<any[]>(brandsRes)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((brand: any) => brand.name)
    }

    // 处理型号数据（存储完整数据用于品牌联动）
    if (modelsRes.success) {
      options.allModels = extractResponseData<any[]>(modelsRes)
    }

    // 处理颜色数据
    if (colorsRes.success) {
      options.colors = extractResponseData<any[]>(colorsRes)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((color: any) => color.name)
    }

    // 处理内存数据
    if (memoriesRes.success) {
      options.memories = extractResponseData<any[]>(memoriesRes)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((memory: any) => memory.size || memory.name)
        .filter(Boolean)
    }

  } catch (error) {
    logger.error('加载筛选选项失败:', error)
    // 设置默认值
    options.brands = ['苹果', '华为', '小米', 'OPPO', 'vivo', '三星']
    options.colors = ['黑色', '白色', '红色', '蓝色', '金色', '银色', '绿色', '紫色']
    options.memories = ['64GB', '128GB', '256GB', '512GB', '1TB']
  } finally {
    loadingOptions.value = false
  }
}

// 品牌变化处理 - 加载对应的型号列表
const handleBrandChange = async () => {
  // 清空型号选择
  searchForm.model_number = ''

  if (!searchForm.brand_name) {
    options.models = []
    handleSearch()
    return
  }

  loadingModels.value = true
  try {
    // 调试：输出品牌名称和型号数据

    // 根据选择的品牌筛选型号 - 尝试多种匹配方式
    const filteredModels = options.allModels
      .filter((model: any) => {
        // 尝试匹配 brand_name 字段
        if (model.brand_name === searchForm.brand_name) return true
        // 尝试匹配 brand 对象的 name 字段
        if (model.brand?.name === searchForm.brand_name) return true
        // 尝试包含匹配（处理可能的大小写或空格问题）
        if (model.brand_name && model.brand_name.includes(searchForm.brand_name)) return true
        return false
      })
      .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))

    options.models = filteredModels.map((model: any) => model.name)

  } catch (error) {
    logger.error('加载型号失败:', error)
    options.models = []
  } finally {
    loadingModels.value = false
  }

  handleSearch()
}

onMounted(() => {
  updateMobileState()
  window.addEventListener('resize', updateMobileState)

  if (!canView.value) {
    return
  }

  loadFilterOptions()
  fetchPriceList()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateMobileState)
  }
})
</script>

<style scoped lang="scss">
.price-list-view {
  padding: 20px;
}

// 同步设置样式
.sync-settings-container {
  .edit-section {
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 16px;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }
    }

    .config-form {
      background: #fff;
      padding: 16px;
      border-radius: 6px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 12px;
    }
  }

  .list-section {
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      gap: 16px;

      h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #606266;
      }
    }

    // 操作按钮样式
    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      flex-wrap: nowrap;

      .el-button {
        flex: 1;
        padding: 4px 6px;
        font-size: 13px;
        white-space: nowrap;
        min-width: fit-content;
        text-align: center;
      }
    }
  }
}

.table-card {
  .pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}

.mobile-empty-state {
  padding: 28px 16px;
  text-align: center;
}

.price-mobile-table {
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid #dbe2ea;
  border-radius: 0;
  background: #ffffff;

  th,
  td {
    padding: 12px 6px;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
    border: 1px solid #dbe2ea;
  }

  th {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    background: #f5f7fa;
  }

  td {
    font-size: 15px;
    font-weight: 600;
    color: #334155;
    background: #ffffff;
  }
}

.text-gray {
  color: #909399;
}

.ml-2 {
  margin-left: 8px;
}

.text-gray-500 {
  color: #909399;
}

// 价格历史对话框样式
.history-header {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .product-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;

    .label {
      font-weight: 600;
      color: #303133;
    }

    .value {
      font-weight: 500;
      color: #409eff;
    }

    .color {
      padding: 2px 8px;
      background: #ecf5ff;
      color: #409eff;
      border-radius: 4px;
      font-size: 12px;
    }

    .memory {
      padding: 2px 8px;
      background: #f0f9ff;
      color: #67c23a;
      border-radius: 4px;
      font-size: 12px;
    }
  }

  .history-actions {
    display: flex;
    gap: 8px;
  }
}

.history-batch-actions {
  margin-top: 12px;
  padding: 10px 16px;
  background: #fff4f4;
  border: 1px solid #ffcccc;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .selected-count {
    font-size: 14px;
    color: #f56c6c;
    font-weight: 500;
  }
}

.empty-history {
  padding: 20px 0;
}

// 批发价格紫色渐变样式
.wholesale-price-tag {
  display: inline-block;
  padding: 2px 8px;
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
  color: #ffffff;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
}

// 零售价格蓝色渐变样式
.retail-price-tag {
  display: inline-block;
  padding: 2px 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  color: #ffffff;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
}

// 价格变化样式
.price-up {
  color: #f56c6c;
  font-weight: 600;
  &::after {
    content: ' ↑';
  }
}

.price-down {
  color: #67c23a;
  font-weight: 600;
  &::after {
    content: ' ↓';
  }
}

.history-change-cell {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.history-change-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.history-change-item.is-up {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.12);
}

.history-change-item.is-down {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.12);
}

.history-change-value {
  white-space: nowrap;
}

// 价格趋势列样式
.price-trend-up,
.price-trend-down,
.price-trend-neutral {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  font-weight: 600;
  font-size: 13px;

  &:hover {
    transform: scale(1.1);
  }
}

.price-trend-up {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);

  i {
    font-size: 12px;
  }
}

.price-trend-down {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.1);

  i {
    font-size: 12px;
  }
}

.price-trend-neutral {
  color: #909399;
  background: rgba(144, 147, 153, 0.1);

  i {
    font-size: 12px;
  }
}

// 操作按钮样式
.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
  align-items: center;
}

@media (max-width: 768px) {
  .price-list-view {
    padding: 12px;
  }

  .table-card {
    border-radius: 16px;

    .pagination-container {
      justify-content: center;
      margin-top: 14px;
    }
  }
}

@media (max-width: 480px) {
  .price-mobile-table {
    th,
    td {
      padding: 11px 4px;
      font-size: 13px;
    }

    th {
      font-size: 10px;
    }
  }

}

// 库存对话框样式
.inventory-dialog-content {
  .inventory-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ebeef5;

    .record-count {
      color: #606266;
      font-size: 14px;
    }
  }

  .inventory-table {
    :deep(.el-table__row) {
      &:nth-child(1) {
        background: #fff7e6 !important;

        .priority-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #ffa500 0%, #ff6b6b 100%);
          color: white;
          border-radius: 50%;
          font-size: 11px;
          box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);

          i {
            font-size: 10px;
          }
        }
      }
    }

    .priority-rank {
      display: inline-block;
      width: 24px;
      height: 24px;
      line-height: 24px;
      text-align: center;
      background: #f5f5f5;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 500;
      color: #999;
    }
  }

  .days-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 13px;

    &.days-normal {
      background: #e8f5e9;
      color: #2e7d32;
    }

    &.days-caution {
      background: #fff3e0;
      color: #e65100;
    }

    &.days-warning {
      background: #fff8e1;
      color: #f57f17;
    }

    &.days-critical {
      background: #ffebee;
      color: #c62828;
    }
  }

  .empty-inventory {
    padding: 40px 0;
    text-align: center;
  }
}
</style>
