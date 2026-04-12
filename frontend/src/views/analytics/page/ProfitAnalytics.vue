<template>
  <div class="profit-analytics">
    <!-- 盈利概览卡片 -->
    <el-row v-if="showProfitOverviewCards" :gutter="16" class="overview-cards">
      <el-col v-if="canViewProfitField('total_revenue')" :xs="12" :sm="12" :md="6" :lg="6">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon revenue">
              <i class="fas fa-chart-line"></i>
            </div>
            <div class="card-info">
              <div class="card-title">总销售额</div>
              <div class="card-value">¥{{ formatNumber(profitData.totalRevenue || 0) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewProfitField('total_cost')" :xs="12" :sm="12" :md="6" :lg="6">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon cost">
              <i class="fas fa-coins"></i>
            </div>
            <div class="card-info">
              <div class="card-title">总成本</div>
              <div class="card-value">¥{{ formatNumber(profitData.totalCost || 0) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewProfitField('gross_profit')" :xs="12" :sm="12" :md="6" :lg="6">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon gross">
              <i class="fas fa-balance-scale"></i>
            </div>
            <div class="card-info">
              <div class="card-title">销售利润</div>
              <div class="card-value">¥{{ formatNumber(profitData.grossProfit || 0) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewProfitField('total_sales_count')" :xs="12" :sm="12" :md="6" :lg="6">
        <el-card class="overview-card">
          <div class="card-content">
            <div class="card-icon margin">
              <i class="fas fa-shopping-cart"></i>
            </div>
            <div class="card-info">
              <div class="card-title">总销售量</div>
              <div class="card-value">{{ formatNumber(profitData.totalSalesCount || 0) }}台</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 业务统计维度 - 全新/二手/调货-划拨 -->
    <el-row v-if="showProfitSalesStatsRow" :gutter="16" class="business-stats">
      <el-col v-if="canViewProfitField('new_sales_stats')" :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="stats-card">
          <template #header>
            <div class="card-header">
              <h3><i class="fas fa-mobile-alt"></i> 全新销售</h3>
              <el-tag type="success" size="large">全新</el-tag>
            </div>
          </template>
          <el-row :gutter="12">
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">销售数量</div>
                <div class="stat-value">{{ formatNumber(newData.salesCount) }}台</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">利润</div>
                <div class="stat-value">¥{{ formatNumber(newData.profit) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">销售金额</div>
                <div class="stat-value">¥{{ formatNumber(newData.salesAmount) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">平均利润</div>
                <div class="stat-value">{{ newData.marginRate }}%</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>

      <el-col v-if="canViewProfitField('used_sales_stats')" :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="stats-card">
          <template #header>
            <div class="card-header">
              <h3><i class="fas fa-recycle"></i> 二手销售</h3>
              <el-tag type="warning" size="large">二手</el-tag>
            </div>
          </template>
          <el-row :gutter="12">
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">销售数量</div>
                <div class="stat-value">{{ formatNumber(usedData.salesCount) }}台</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">利润</div>
                <div class="stat-value">¥{{ formatNumber(usedData.profit) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">销售金额</div>
                <div class="stat-value">¥{{ formatNumber(usedData.salesAmount) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">平均利润</div>
                <div class="stat-value">{{ usedData.marginRate }}%</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="stats-card transfer-card">
          <template #header>
            <div class="card-header">
              <h3><i class="fas fa-exchange-alt"></i> 调货-划拨</h3>
              <el-tag type="info" size="large">批发</el-tag>
            </div>
          </template>
          <el-row :gutter="12">
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">调货数量</div>
                <div class="stat-value">{{ formatNumber(transferData.wholesaleCount) }}台</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">划拨数量</div>
                <div class="stat-value">{{ formatNumber(transferData.allocationCount) }}台</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">调货利润</div>
                <div class="stat-value">¥{{ formatNumber(transferData.wholesaleProfit) }}</div>
              </div>
            </el-col>
            <el-col :xs="12" :sm="12" :md="12">
              <div class="stat-item">
                <div class="stat-label">划拨利润</div>
                <div class="stat-value">¥{{ formatNumber(transferData.allocationProfit) }}</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <!-- 品牌/型号销量排行 -->
    <el-row v-if="showProfitRankingSection" :gutter="16" class="ranking-section">
      <el-col v-if="canViewProfitField('brand_ranking')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="ranking-card">
          <template #header>
            <div class="card-header">
              <h3><i class="fas fa-brand"></i> 品牌销量排行 TOP10</h3>
              <el-radio-group v-model="brandRankType" size="small">
                <el-radio-button value="count">按销量</el-radio-button>
                <el-radio-button value="amount">按销售额</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="ranking-list">
            <div v-for="(brand, index) in brandRankings" :key="brand.name" class="ranking-item">
              <div class="ranking-index" :class="getRankingClass(index)">
                {{ index + 1 }}
              </div>
              <div class="ranking-info">
                <div class="ranking-name">{{ brand.name }}</div>
                <div class="ranking-bar">
                  <div class="bar-fill" :style="{ width: brand.percent + '%' }"></div>
                </div>
              </div>
              <div class="ranking-values">
                <div class="value-item">
                  <span class="label">销量:</span>
                  <span class="num">{{ brand.count }}</span>
                </div>
                <div class="value-item">
                  <span class="label">金额:</span>
                  <span class="num">¥{{ formatNumber(brand.amount) }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewProfitField('model_ranking')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="ranking-card">
          <template #header>
            <div class="card-header">
              <h3><i class="fas fa-tags"></i> 型号销量排行 TOP10</h3>
              <el-radio-group v-model="modelRankType" size="small">
                <el-radio-button value="count">按销量</el-radio-button>
                <el-radio-button value="amount">按销售额</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div class="ranking-list">
            <div v-for="(model, index) in modelRankings" :key="model.name" class="ranking-item">
              <div class="ranking-index" :class="getRankingClass(index)">
                {{ index + 1 }}
              </div>
              <div class="ranking-info">
                <div class="ranking-name">{{ model.name }}</div>
                <div class="ranking-bar">
                  <div class="bar-fill" :style="{ width: model.percent + '%' }"></div>
                </div>
              </div>
              <div class="ranking-values">
                <div class="value-item">
                  <span class="label">销量:</span>
                  <span class="num">{{ model.count }}</span>
                </div>
                <div class="value-item">
                  <span class="label">金额:</span>
                  <span class="num">¥{{ formatNumber(model.amount) }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 员工/店铺业绩统计 -->
    <el-row v-if="canViewProfitField('employee_performance_table')" :gutter="16" class="performance-section">
      <el-col :span="24">
        <el-card class="performance-card">
          <template #header>
            <div class="card-header">
              <h3><i class="fas fa-users"></i> 员工业绩统计</h3>
              <el-space>
                <el-select v-model="performanceTimeType" size="small" style="width: 100px">
                  <el-option label="按日" value="day" />
                  <el-option label="按月" value="month" />
                  <el-option label="按年" value="year" />
                </el-select>
                <el-radio-group v-model="performanceViewType" size="small">
                  <el-radio-button value="sales">销售额</el-radio-button>
                  <el-radio-button value="count">销量</el-radio-button>
                  <el-radio-button value="profit">利润</el-radio-button>
                </el-radio-group>
                <el-button type="success" size="small" @click="exportPerformance">导出</el-button>
              </el-space>
            </div>
          </template>
          <el-table :data="employeePerformanceData" stripe class="w-full" max-height="400" :table-layout="'auto'">
            <el-table-column type="index" label="排名" width="60" align="center" fixed />
            <el-table-column prop="name" label="员工姓名" min-width="100" align="center" />
            <el-table-column prop="store" label="所属店铺" min-width="100" align="center" />
            <el-table-column label="全新销售" align="center">
              <el-table-column prop="newCount" label="销量" min-width="80" align="right" />
              <el-table-column prop="newAmount" label="销售额" min-width="100" align="right">
                <template #default="{ row }">
                  ¥{{ formatNumber(row.newAmount) }}
                </template>
              </el-table-column>
              <el-table-column prop="newProfit" label="利润" min-width="100" align="right">
                <template #default="{ row }">
                  ¥{{ formatNumber(row.newProfit) }}
                </template>
              </el-table-column>
            </el-table-column>
            <el-table-column label="二手销售" align="center">
              <el-table-column prop="usedCount" label="销量" min-width="80" align="right" />
              <el-table-column prop="usedAmount" label="销售额" min-width="100" align="right">
                <template #default="{ row }">
                  ¥{{ formatNumber(row.usedAmount) }}
                </template>
              </el-table-column>
              <el-table-column prop="usedProfit" label="利润" min-width="100" align="right">
                <template #default="{ row }">
                  ¥{{ formatNumber(row.usedProfit) }}
                </template>
              </el-table-column>
            </el-table-column>
            <el-table-column label="合计" align="center" min-width="280">
              <template #default="{ row }">
                <div class="total-summary-inline">
                  <span class="summary-item-inline">
                    <span class="summary-label">销量:</span>
                    <span class="summary-value">{{ row.totalCount }}</span>
                  </span>
                  <span class="summary-divider">|</span>
                  <span class="summary-item-inline">
                    <span class="summary-label">销售额:</span>
                    <span class="summary-value">¥{{ formatNumber(row.totalAmount) }}</span>
                  </span>
                  <span class="summary-divider">|</span>
                  <span class="summary-item-inline">
                    <span class="summary-label">利润:</span>
                    <span class="summary-value">¥{{ formatNumber(row.totalProfit) }}</span>
                  </span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 利润指标卡片 -->
    <el-row v-if="showProfitMetricsSection" :gutter="16" class="metrics-section">
      <el-col v-if="canViewProfitField('metrics_cards')" :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="metric-card metric-card--margin">
          <div class="metric-header">
            <span class="metric-title">净利润率</span>
            <el-tag :type="profitData.netMarginRate > 15 ? 'success' : 'warning'" size="large">
              {{ profitData.netMarginRate || 0 }}%
            </el-tag>
          </div>
          <div class="metric-body">
            <div class="metric-compare-row">
              <div class="metric-compare-item">
                <div class="metric-compare-label">本月</div>
                <div class="metric-compare-value">¥{{ formatNumber(profitData.netProfit || 0) }}</div>
                <div class="metric-compare-rate">{{ profitData.netMarginRate || 0 }}%</div>
              </div>
              <div class="metric-compare-divider">
                <i class="fas fa-arrow-right"></i>
              </div>
              <div class="metric-compare-item">
                <div class="metric-compare-label">上月</div>
                <div class="metric-compare-value">¥{{ formatNumber(profitData.lastMonth?.netProfit || 0) }}</div>
                <div class="metric-compare-rate">{{ profitData.lastMonth?.netMarginRate || 0 }}%</div>
              </div>
            </div>
            <div class="metric-trend-row">
              <span>环比</span>
              <span :class="profitData.netMarginRateTrend === 'up' ? 'text-success' : 'text-danger'">
                <i :class="profitData.netMarginRateTrend === 'up' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
                {{ profitData.netMarginRateChange || 0 }}%
              </span>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewProfitField('store_profit_ranking')" :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="metric-card metric-card--store store-profit-card">
          <div class="metric-header">
            <span class="metric-title">门店利润</span>
            <el-tag type="primary" size="large">
              {{ rankedStoreProfits.length }}家门店
            </el-tag>
          </div>
          <div class="metric-body">
            <div class="store-profit-list" v-if="rankedStoreProfits.length > 0">
              <div
                v-for="(store, index) in rankedStoreProfits.slice(0, 4)"
                :key="store.id"
                class="store-profit-item"
              >
                <div class="store-profit-rank">{{ index + 1 }}</div>
                <div class="store-profit-info">
                  <div class="store-profit-name">{{ store.name }}</div>
                  <div class="store-profit-value">¥{{ formatNumber(store.profit) }}</div>
                </div>
                <div class="store-profit-rate" :class="store.profit >= 0 ? 'text-success' : 'text-danger'">
                  {{ store.marginRate >= 0 ? '+' : '' }}{{ store.marginRate }}%
                </div>
              </div>
            </div>
            <div class="store-profit-empty" v-else>
              <i class="fas fa-store-slash"></i>
              <span>暂无门店数据</span>
            </div>
            <div class="metric-trend-row" v-if="rankedStoreProfits.length > 0">
              <span>盈利门店 {{ profitableStoreCount }}/{{ rankedStoreProfits.length }}</span>
              <span :class="averageStoreProfit >= 0 ? 'text-success' : 'text-danger'">
                店均 ¥{{ formatNumber(averageStoreProfit) }}
              </span>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col v-if="canViewProfitField('metrics_cards')" :xs="24" :sm="24" :md="8" :lg="8">
        <el-card class="metric-card metric-card--per-capita">
          <div class="metric-header">
            <span class="metric-title">人均产值</span>
            <el-tag type="success" size="large">
              ¥{{ formatNumber(profitData.perCapitaOutput || 0) }}
            </el-tag>
          </div>
          <div class="metric-body">
            <div class="metric-value">¥{{ formatNumber(profitData.perCapitaOutput || 0) }}</div>
            <div class="metric-desc">人均月度产值</div>
            <div class="metric-compare-row compact">
              <div class="metric-compare-item">
                <div class="metric-compare-label">统计员工</div>
                <div class="metric-compare-value">{{ employeeCount }}</div>
              </div>
              <div class="metric-compare-divider">
                <i class="fas fa-users"></i>
              </div>
              <div class="metric-compare-item">
                <div class="metric-compare-label">人均净利润</div>
                <div class="metric-compare-value">¥{{ formatNumber(perCapitaNetProfit) }}</div>
              </div>
            </div>
            <div class="metric-trend-row">
              <span>ROI</span>
              <span :class="profitData.roiTrend === 'up' ? 'text-success' : 'text-danger'">
                <i :class="profitData.roiTrend === 'up' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
                {{ profitData.roi || 0 }}%
                <template v-if="profitData.roiChange"> ({{ profitData.roiChange > 0 ? '+' : '' }}{{ profitData.roiChange }}%)</template>
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row v-if="showProfitTrendSection" :gutter="16" class="charts-section">
      <!-- 收入成本利润趋势 -->
      <el-col v-if="canViewProfitField('profit_trend_chart')" :xs="24" :lg="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <div class="trend-card-header">
                <div class="trend-card-title">
                  <h3>收入成本利润趋势分析</h3>
                  <span class="trend-card-subtitle">
                    {{ profitTrendMeta.rangeLabel }} · 当前周期 {{ profitTrendSummaryLabel }}
                  </span>
                </div>
                <el-radio-group v-model="profitTrendPeriod" size="small">
                  <el-radio-button value="month">月度</el-radio-button>
                  <el-radio-button value="quarter">季度</el-radio-button>
                  <el-radio-button value="year">年度</el-radio-button>
                </el-radio-group>
              </div>
            </div>
          </template>
          <div class="trend-summary">
            <div class="trend-summary-card revenue">
              <div class="trend-summary-label">{{ profitTrendSummaryLabel }}收入</div>
              <div class="trend-summary-value">¥{{ formatNumber(profitTrendCurrentSummary.revenue) }}</div>
            </div>
            <div class="trend-summary-card cost">
              <div class="trend-summary-label">{{ profitTrendSummaryLabel }}成本</div>
              <div class="trend-summary-value">¥{{ formatNumber(profitTrendCurrentSummary.cost) }}</div>
            </div>
            <div class="trend-summary-card profit">
              <div class="trend-summary-label">{{ profitTrendSummaryLabel }}利润</div>
              <div class="trend-summary-value">¥{{ formatNumber(profitTrendCurrentSummary.profit) }}</div>
            </div>
          </div>
          <div class="chart-container large">
            <div ref="profitTrendRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>

      <!-- 盈利预测 -->
      <el-col v-if="canViewProfitField('forecast_chart')" :xs="24" :lg="8">
        <el-card class="chart-card forecast-inline-card">
          <template #header>
            <div class="card-header">
              <h3>盈利预测分析</h3>
              <el-space>
                <el-select v-model="forecastPeriod" size="small">
                  <el-option label="未来1个月" value="month" />
                  <el-option label="未来3个月" value="quarter" />
                  <el-option label="未来6个月" value="half" />
                </el-select>
                <el-select v-model="forecastScenario" size="small">
                  <el-option label="乐观预测" value="optimistic" />
                  <el-option label="中性预测" value="neutral" />
                  <el-option label="保守预测" value="conservative" />
                </el-select>
                <el-button type="primary" size="small" @click="generateForecast">
                  生成预测
                </el-button>
                <el-button type="success" size="small" @click="exportForecast">
                  导出报告
                </el-button>
              </el-space>
            </div>
          </template>
          <div class="forecast-summary-bar">
            <span class="forecast-summary-label">预测基准</span>
            <span class="forecast-summary-value">{{ forecastReferenceLabel }}</span>
          </div>
          <div class="chart-container large forecast-inline-container">
            <div ref="forecastRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row v-if="showProfitContributionSection" :gutter="16" class="charts-section">
      <!-- 产品利润贡献 -->
      <el-col v-if="canViewProfitField('product_profit_chart')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="chart-card product-profit-card">
          <template #header>
            <div class="card-header">
              <h3>产品利润贡献 TOP10</h3>
            </div>
          </template>
          <div v-if="productProfitData.length > 0" class="product-profit-summary">
            <div class="product-profit-summary-item">
              <div class="summary-label">利润最高型号</div>
              <div class="summary-name">{{ topProductProfit?.name || '-' }}</div>
              <div class="summary-value">¥{{ formatNumber(topProductProfit?.profit || 0) }}</div>
            </div>
            <div class="product-profit-summary-item">
              <div class="summary-label">销量最高型号</div>
              <div class="summary-name">{{ topProductSales?.name || '-' }}</div>
              <div class="summary-value">{{ formatNumber(topProductSales?.count || 0) }} 台</div>
            </div>
            <div class="product-profit-summary-item">
              <div class="summary-label">平均单台利润</div>
              <div class="summary-name">TOP10 型号均值</div>
              <div class="summary-value">¥{{ formatNumber(averageProductUnitProfit) }}</div>
            </div>
          </div>
          <div class="chart-container">
            <div ref="productProfitRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>

      <!-- 店铺利润对比 -->
      <el-col v-if="canViewProfitField('store_comparison_chart')" :xs="24" :sm="24" :md="12" :lg="12">
        <el-card class="chart-card store-comparison-card">
          <template #header>
            <div class="card-header">
              <h3>店铺利润对比</h3>
              <el-button size="small" @click="toggleStoreComparisonType">
                {{ storeComparisonType === 'bar' ? '雷达图' : '柱状图' }}
              </el-button>
            </div>
          </template>
          <div v-if="storeComparisonData.length > 0" class="store-comparison-summary">
            <div class="store-comparison-summary-item">
              <div class="summary-label">利润最高</div>
              <div class="summary-name">{{ topProfitStore?.name || '-' }}</div>
              <div class="summary-value">¥{{ formatNumber(topProfitStore?.profit || 0) }}</div>
            </div>
            <div class="store-comparison-summary-item">
              <div class="summary-label">营收最高</div>
              <div class="summary-name">{{ topRevenueStore?.name || '-' }}</div>
              <div class="summary-value">¥{{ formatNumber(topRevenueStore?.revenue || 0) }}</div>
            </div>
            <div class="store-comparison-summary-item">
              <div class="summary-label">整体利润率</div>
              <div class="summary-name">{{ profitableStoreCount }}/{{ storeComparisonData.length }} 家盈利</div>
              <div class="summary-value">{{ overallStoreMarginRate }}%</div>
            </div>
          </div>
          <div class="chart-container">
            <div ref="storeComparisonRef" class="chart"></div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 成本分析表格 -->
    <el-row v-if="canViewProfitField('cost_analysis_table')" :gutter="16" class="table-section admin-panel admin-table-panel">
      <el-col :span="24">
        <el-card class="table-card admin-panel admin-table-panel">
          <template #header>
            <div class="card-header">
              <h3>成本构成分析</h3>
              <el-space>
                <el-radio-group v-model="costViewType" size="small">
                  <el-radio-button value="category">按类别</el-radio-button>
                  <el-radio-button value="store">按店铺</el-radio-button>
                  <el-radio-button value="product">按产品</el-radio-button>
                </el-radio-group>
                <el-button type="success" size="small" @click="exportCostAnalysis">
                  导出
                </el-button>
              </el-space>
            </div>
          </template>
          <el-table :data="costAnalysisData" stripe class="w-full">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="category" label="成本类别" width="150">
              <template #default="{ row }">
                <el-tag :type="getCostTagType(row.category)" size="small">
                  {{ getCostLabel(row.category) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="150" align="right">
              <template #default="{ row }">
                ¥{{ formatNumber(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column prop="percentage" label="占比" width="100" align="center">
              <template #default="{ row }">
                <el-progress
                  :percentage="row.percentage"
                  :color="getProgressColor(row.percentage)"
                  :show-text="true"
                />
              </template>
            </el-table-column>
            <el-table-column prop="yoy" label="同比" width="100" align="center">
              <template #default="{ row }">
                <span :class="row.yoy > 0 ? 'text-success' : 'text-danger'">
                  <i :class="row.yoy > 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
                  {{ Math.abs(row.yoy) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="mom" label="环比" width="100" align="center">
              <template #default="{ row }">
                <span :class="row.mom > 0 ? 'text-success' : 'text-danger'">
                  <i :class="row.mom > 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
                  {{ Math.abs(row.mom) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="trend" label="趋势" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.trend === 'up' ? 'success' : row.trend === 'down' ? 'danger' : 'info'" size="small">
                  {{ row.trend === 'up' ? '上升' : row.trend === 'down' ? '下降' : '稳定' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { unifiedApi } from '@/utils/unified-api'
import echarts, { ECharts } from '@/utils/echarts'
import { buildCsvContent } from '@/utils/csv-export'
import dayjs from 'dayjs'
import { TimeUtil } from '@/utils/time'
import { useAnalyticsFieldVisibility } from './useAnalyticsFieldVisibility'
import type { ProfitAnalyticsProps, LoadingChangeEmits } from '@/types/component'
import { storage } from '@/composables/core/useLocalStorage'
import { logger } from '@/utils/logger'

const props = withDefaults(defineProps<ProfitAnalyticsProps>(), {
  loading: false,
  isActive: false,
  startDate: '',
  endDate: '',
  storeId: '',
  supplierId: '',
  searchTrigger: 0
})

const emit = defineEmits<LoadingChangeEmits>()

const { success, warning } = useNotification()
const { canViewField: canViewProfitField, canViewAnyField: canViewAnyProfitField } = useAnalyticsFieldVisibility('profit')
const { exportTextFile, buildDateFilename } = useImportExport()

// 加载状态
const { loading } = useLoadingState()

// 使用父组件传递的参数（兼容本地状态）
const startDate = computed(() => props.startDate || '')
const endDate = computed(() => props.endDate || '')
const selectedStore = computed(() => props.storeId || '')
const selectedSupplier = computed(() => props.supplierId || '')

// 加载店铺列表 - 已移至父组件

// 供应商列表 - 已移至父组件

const showProfitOverviewCards = computed(() => canViewAnyProfitField([
  'total_revenue',
  'total_cost',
  'gross_profit',
  'total_sales_count'
]))

const showProfitSalesStatsRow = computed(() => canViewAnyProfitField([
  'new_sales_stats',
  'used_sales_stats'
]))

const showProfitRankingSection = computed(() => canViewAnyProfitField([
  'brand_ranking',
  'model_ranking'
]))

const showProfitMetricsSection = computed(() => canViewAnyProfitField([
  'metrics_cards',
  'store_profit_ranking'
]))

const showProfitTrendSection = computed(() => canViewAnyProfitField([
  'profit_trend_chart',
  'forecast_chart'
]))

const showProfitContributionSection = computed(() => canViewAnyProfitField([
  'product_profit_chart',
  'store_comparison_chart'
]))

// 响应式数据
const profitData = ref({
  totalRevenue: 0,
  totalCost: 0,
  grossProfit: 0,
  totalSalesCount: 0,
  marginRate: 0,
  netMarginRate: 0,
  netProfit: 0,
  roi: 0,
  roiTrend: 'up',
  roiChange: 0,
  perCapitaOutput: 0,
  revenueTrend: 'up',
  revenueChange: 0,
  costTrend: 'down',
  costChange: 0,
  grossTrend: 'up',
  grossChange: 0,
  marginTrend: 'up',
  marginChange: 0,
  // 上月数据
  lastMonth: {
    totalRevenue: 0,
    netProfit: 0,
    netMarginRate: 0
  },
  // 环比数据
  netMarginRateTrend: 'up',
  netMarginRateChange: 0
})

const profitTrendPeriod = ref('month')
const storeComparisonType = ref<'bar' | 'radar'>('bar')
const forecastPeriod = ref('month')
const forecastScenario = ref('neutral')
const costViewType = ref('category')

const costAnalysisData = ref([])
const profitTrendSeries = ref<Array<{
  key: string
  label: string
  startDate: string
  endDate: string
  totalSales: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
}>>([])
const forecastHistorySeries = ref<Array<{
  key: string
  label: string
  startDate: string
  endDate: string
  totalSales: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
}>>([])

// 业务统计数据 - 动态加载
const newData = ref({
  salesCount: 0,
  salesAmount: 0,
  profit: 0,
  marginRate: 0,
  avgPrice: 0
})

const usedData = ref({
  salesCount: 0,
  salesAmount: 0,
  profit: 0,
  marginRate: 0,
  avgPrice: 0
})

const transferData = ref({
  wholesaleCount: 0,
  wholesaleProfit: 0,
  allocationCount: 0,
  allocationProfit: 0
})

const getTrendAnchorDate = () => {
  const anchor = endDate.value ? dayjs(endDate.value) : TimeUtil.now()
  return anchor.isValid() ? anchor : TimeUtil.now()
}

const getQuarterLabel = (date: dayjs.Dayjs) => `${date.year()}年Q${Math.floor(date.month() / 3) + 1}`

const currentFilterPeriodLabel = computed(() => {
  const start = startDate.value ? dayjs(startDate.value) : null
  const end = endDate.value ? dayjs(endDate.value) : null

  if (start && end && start.isValid() && end.isValid()) {
    if (start.isSame(start.startOf('month'), 'day') && end.isSame(end.endOf('month'), 'day') && start.isSame(end, 'month')) {
      return start.format('YYYY年M月')
    }

    if (start.isSame(start.startOf('month').month(Math.floor(start.month() / 3) * 3), 'day') &&
        end.isSame(end.startOf('month').month(Math.floor(end.month() / 3) * 3).add(2, 'month').endOf('month'), 'day') &&
        Math.floor(start.month() / 3) === Math.floor(end.month() / 3)) {
      return getQuarterLabel(start)
    }

    if (start.isSame(start.startOf('year'), 'day') && end.isSame(end.endOf('year'), 'day') && start.isSame(end, 'year')) {
      return `${start.year()}年`
    }

    return `${start.format('YYYY-MM-DD')}至${end.format('YYYY-MM-DD')}`
  }

  if (end && end.isValid()) {
    return end.format('YYYY年M月')
  }

  return '当前周期'
})

const profitTrendMeta = computed(() => {
  const anchor = getTrendAnchorDate()

  if (profitTrendPeriod.value === 'quarter') {
    return {
      rangeLabel: '近8个季度'
    }
  }

  if (profitTrendPeriod.value === 'year') {
    return {
      rangeLabel: '近6年'
    }
  }

  return {
    rangeLabel: '近12个月'
  }
})

const profitTrendCurrentSummary = computed(() => {
  const currentPeriod = profitTrendSeries.value[profitTrendSeries.value.length - 1]
  if (currentPeriod) {
    return {
      revenue: Math.round(currentPeriod.totalRevenue || 0),
      cost: Math.round(currentPeriod.totalCost || 0),
      profit: Math.round(currentPeriod.totalProfit || 0)
    }
  }

  return {
    revenue: Math.round(profitData.value.totalRevenue || 0),
    cost: Math.round(profitData.value.totalCost || 0),
    profit: Math.round(profitData.value.netProfit || 0)
  }
})

const profitTrendSummaryLabel = computed(() => {
  const currentPeriod = profitTrendSeries.value[profitTrendSeries.value.length - 1]
  return currentPeriod?.label || currentFilterPeriodLabel.value
})

const forecastReferenceLabel = computed(() => {
  const currentPeriod = forecastHistorySeries.value[forecastHistorySeries.value.length - 1]
  return currentPeriod?.label || profitTrendSummaryLabel.value
})

const loadProfitTrendData = async () => {
  try {
    const params: Record<string, string | number> = {
      granularity: profitTrendPeriod.value
    }

    if (startDate.value) {
      params.startDate = startDate.value
    }
    if (endDate.value) {
      params.endDate = endDate.value
    }
    if (selectedStore.value) {
      params.storeId = selectedStore.value
    }

    const response = await unifiedApi.get('/analytics/profit-trend', { params })
    if (response.success && response.data?.series) {
      profitTrendSeries.value = Array.isArray(response.data.series) ? response.data.series : []
    } else {
      profitTrendSeries.value = []
    }
  } catch (err) {
    logger.error('获取盈利趋势数据失败:', err)
    profitTrendSeries.value = []
  }
}

const loadForecastHistoryData = async () => {
  try {
    const params: Record<string, string | number> = {
      granularity: 'month'
    }

    if (endDate.value) {
      params.endDate = endDate.value
    }
    if (selectedStore.value) {
      params.storeId = selectedStore.value
    }

    const response = await unifiedApi.get('/analytics/profit-trend', { params })
    if (response.success && response.data?.series) {
      forecastHistorySeries.value = Array.isArray(response.data.series) ? response.data.series : []
    } else {
      forecastHistorySeries.value = []
    }
  } catch (err) {
    logger.error('获取盈利预测历史数据失败:', err)
    forecastHistorySeries.value = []
  }
}

// 使用指定日期范围加载所有数据（用于快捷选择）
const loadDataWithDates = async (start: string, end: string) => {
  try {
    loading.value = true
    emit('loading-change', true)

    const params: any = {
      startDate: start,
      endDate: end
    }
    if (selectedStore.value) params.storeId = selectedStore.value
    if (selectedSupplier.value) params.supplierId = selectedSupplier.value

    // 查询参数已设置，开始加载数据

    // 先加载销售数据，确保本月利润指标已计算完成
    await loadSalesByConditionWithDates(params)
    await loadTransferDataWithDates(params)

    // 两个数据都加载完成后，计算总数据
    calculateProfitData()

    // 再并行加载其他数据
    await Promise.all([
      loadBrandRankingsWithDates(params),
      loadModelRankingsWithDates(params),
      loadProductProfitRankingsWithDates(params),
      loadEmployeePerformance(),
      loadStoreProfit()
    ])

    // 最后补充盈利汇总接口中的上月数据和环比数据
    await Promise.all([
      loadProfitData(),
      loadProfitTrendData(),
      loadForecastHistoryData()
    ])

    // 数据加载完成后，等待 DOM 完全渲染再初始化图表
    await nextTick()

    // 延迟初始化图表，确保 DOM 元素有正确的尺寸
    setTimeout(() => {
      initCharts()

      // 再次延迟更新图表，确保图表实例已创建
      setTimeout(() => {
        updateCharts()
      }, 300)
    }, 400)
  } finally {
    loading.value = false
    emit('loading-change', false)
  }
}

// 使用指定参数加载全新/二手销售数据
const loadSalesByConditionWithDates = async (params: any) => {
  try {
    const response = await unifiedApi.get('/analytics/sales-by-condition', { params })
    if (response.success && response.data) {
      // 确保所有数值都是数字类型
      const newResp = response.data.new || {}
      const usedResp = response.data.used || {}

      newData.value = {
        salesCount: parseInt(String(newResp.salesCount || 0)) || 0,
        salesAmount: parseFloat(String(newResp.salesAmount || 0)) || 0,
        profit: parseFloat(String(newResp.profit || 0)) || 0,
        marginRate: parseFloat(String(newResp.marginRate || 0)) || 0,
        avgPrice: parseFloat(String(newResp.avgPrice || 0)) || 0
      }

      usedData.value = {
        salesCount: parseInt(String(usedResp.salesCount || 0)) || 0,
        salesAmount: parseFloat(String(usedResp.salesAmount || 0)) || 0,
        profit: parseFloat(String(usedResp.profit || 0)) || 0,
        marginRate: parseFloat(String(usedResp.marginRate || 0)) || 0,
        avgPrice: parseFloat(String(usedResp.avgPrice || 0)) || 0
      }
    }
  } catch (err: any) {
    logger.error('获取全新/二手销售数据失败:', err)
  }
}

// 使用指定参数加载调货-划拨数据
const loadTransferDataWithDates = async (params: any) => {
  try {
    // 转换参数名称：startDate -> start_date, endDate -> end_date
    const transferParams = {
      start_date: params.startDate,
      end_date: params.endDate,
      store_id: params.storeId,
      supplier_id: params.supplierId
    }
    const response = await unifiedApi.get('/transfers/statistics', { params: transferParams })
    if (response.success && response.data) {
      transferData.value = {
        wholesaleCount: parseInt(String(response.data.wholesale?.total_count || 0)) || 0,
        wholesaleProfit: parseFloat(String(response.data.wholesale?.total_profit || 0)) || 0,
        allocationCount: parseInt(String(response.data.supplier_proxy?.total_count || 0)) || 0,
        allocationProfit: parseFloat(String(response.data.supplier_proxy?.total_profit || 0)) || 0
      }
    }
  } catch (err: any) {
    logger.error('获取调货-划拨数据失败:', err)
  }
}

// 使用指定参数加载品牌销量排行
const loadBrandRankingsWithDates = async (params: any) => {
  try {
    const response = await unifiedApi.get('/analytics/ranking/brands', { params })
    if (response.success && response.data) {
      brandRankings.value = response.data
    }
  } catch (err: any) {
    logger.error('获取品牌销量排行失败:', err)
  }
}

// 使用指定参数加载型号销量排行
const loadModelRankingsWithDates = async (params: any) => {
  try {
    const requestParams = {
      ...params,
      sortBy: modelRankType.value
    }
    const response = await unifiedApi.get('/analytics/ranking/models', { params: requestParams })
    if (response.success && response.data) {
      modelRankings.value = response.data
    }
  } catch (err: any) {
    logger.error('获取型号销量排行失败:', err)
  }
}

const loadProductProfitRankingsWithDates = async (params: any) => {
  try {
    const requestParams = {
      ...params,
      sortBy: 'profit'
    }
    const response = await unifiedApi.get('/analytics/ranking/models', { params: requestParams })
    if (response.success && response.data) {
      productProfitRankings.value = response.data
    } else {
      productProfitRankings.value = []
    }
  } catch (err: any) {
    logger.error('获取产品利润贡献排行失败:', err)
    productProfitRankings.value = []
  }
}

// 加载全新/二手销售数据
const loadSalesByCondition = async () => {
  try {
    const params: any = {}
    // 处理日期格式 - 确保是 YYYY-MM-DD 格式
    if (startDate.value) {
      // 如果是 YYYY-MM 格式（月份），转换为月初和月末
      if (startDate.value.match(/^\d{4}-\d{2}$/)) {
        params.startDate = startDate.value + '-01'  // 月初
      } else {
        params.startDate = startDate.value
      }
    }
    if (endDate.value) {
      // 如果是 YYYY-MM 格式（月份），转换为该月最后一天
      if (endDate.value.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = endDate.value.split('-')
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        params.endDate = endDate.value + '-' + String(lastDay).padStart(2, '0')  // 月末
      } else {
        params.endDate = endDate.value
      }
    }
    if (selectedStore.value) params.storeId = selectedStore.value
    if (selectedSupplier.value) params.supplierId = selectedSupplier.value

    const response = await unifiedApi.get('/analytics/sales-by-condition', { params })

    if (response.success && response.data) {
      // 确保所有数值都是数字类型
      const newResp = response.data.new || {}
      const usedResp = response.data.used || {}

      newData.value = {
        salesCount: parseInt(String(newResp.salesCount || 0)) || 0,
        salesAmount: parseFloat(String(newResp.salesAmount || 0)) || 0,
        profit: parseFloat(String(newResp.profit || 0)) || 0,
        marginRate: parseFloat(String(newResp.marginRate || 0)) || 0,
        avgPrice: parseFloat(String(newResp.avgPrice || 0)) || 0
      }

      usedData.value = {
        salesCount: parseInt(String(usedResp.salesCount || 0)) || 0,
        salesAmount: parseFloat(String(usedResp.salesAmount || 0)) || 0,
        profit: parseFloat(String(usedResp.profit || 0)) || 0,
        marginRate: parseFloat(String(usedResp.marginRate || 0)) || 0,
        avgPrice: parseFloat(String(usedResp.avgPrice || 0)) || 0
      }

      // 根据全新机和二手机数据计算总盈利数据
      calculateProfitData()
    }
  } catch (err: any) {
    logger.error('获取全新/二手销售数据失败:', err)
    logger.error('错误响应数据:', err.response?.data)
    logger.error('错误状态:', err.response?.status)
  }
}

// 根据全新机和二手机数据计算总盈利数据
const calculateProfitData = () => {
  // 总销售额 = 全新机销售金额 + 二手机销售金额
  const totalRevenue = (newData.value.salesAmount || 0) + (usedData.value.salesAmount || 0)

  // 总销售量 = 全新机销售数量 + 二手机销售数量 + 调货数量（不包括划拨）
  const totalSalesCount = (newData.value.salesCount || 0) + (usedData.value.salesCount || 0) + (transferData.value.wholesaleCount || 0)

  // 总成本 = 全新机成本 + 二手机成本
  // 成本 = 销售金额 - 利润
  const newCost = (newData.value.salesAmount || 0) - (newData.value.profit || 0)
  const usedCost = (usedData.value.salesAmount || 0) - (usedData.value.profit || 0)
  const totalCost = newCost + usedCost

  // 销售利润 = 全新机利润 + 二手机利润 + 批发利润
  const grossProfit = (newData.value.profit || 0) + (usedData.value.profit || 0) + (transferData.value.wholesaleProfit || 0)

  // 毛利率 = 销售利润 / 总销售额 * 100
  const marginRate = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // 更新 profitData
  profitData.value = {
    ...profitData.value,
    totalRevenue: Math.round(totalRevenue),
    totalCost: Math.round(totalCost),
    grossProfit: Math.round(grossProfit),
    totalSalesCount: Math.round(totalSalesCount),
    marginRate: parseFloat(marginRate.toFixed(1)),
    // 净利润 = 销售价 - 入库价，即毛利润
    netProfit: Math.round(grossProfit),
    netMarginRate: parseFloat((grossProfit / totalRevenue * 100).toFixed(1)) || 0
  }

}

// 品牌排行数据 - 动态加载
const brandRankType = ref('count')
const brandRankings = ref<Array<{name: string, count: number, amount: number, percent: number}>>([])

// 加载品牌销量排行
const loadBrandRankings = async () => {
  try {
    const params: any = { limit: 10 }
    // 处理日期格式
    if (startDate.value) {
      if (startDate.value.match(/^\d{4}-\d{2}$/)) {
        params.startDate = startDate.value + '-01'
      } else {
        params.startDate = startDate.value
      }
    }
    if (endDate.value) {
      if (endDate.value.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = endDate.value.split('-')
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        params.endDate = endDate.value + '-' + String(lastDay).padStart(2, '0')
      } else {
        params.endDate = endDate.value
      }
    }
    if (selectedStore.value) params.storeId = selectedStore.value

    const response = await unifiedApi.get('/analytics/ranking/brands', { params })
    if (response.success && response.data) {
      brandRankings.value = response.data
    }
  } catch (err: any) {
    logger.error('获取品牌销量排行失败:', err)
    logger.error('错误响应数据:', err.response?.data)
    logger.error('错误状态:', err.response?.status)
  }
}

// 型号排行数据 - 动态加载
const modelRankType = ref('count')
const modelRankings = ref<Array<{name: string, count: number, amount: number, cost?: number, profit?: number, percent: number}>>([])
const productProfitRankings = ref<Array<{name: string, count: number, amount: number, cost?: number, profit?: number, percent: number}>>([])

const buildRankingParams = () => {
  const params: any = { limit: 10 }

  if (startDate.value) {
    if (startDate.value.match(/^\d{4}-\d{2}$/)) {
      params.startDate = startDate.value + '-01'
    } else {
      params.startDate = startDate.value
    }
  }
  if (endDate.value) {
    if (endDate.value.match(/^\d{4}-\d{2}$/)) {
      const [year, month] = endDate.value.split('-')
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      params.endDate = endDate.value + '-' + String(lastDay).padStart(2, '0')
    } else {
      params.endDate = endDate.value
    }
  }
  if (selectedStore.value) params.storeId = selectedStore.value

  return params
}

// 加载型号销量排行
const loadModelRankings = async () => {
  try {
    const params = buildRankingParams()
    params.sortBy = modelRankType.value

    const response = await unifiedApi.get('/analytics/ranking/models', { params })
    if (response.success && response.data) {
      modelRankings.value = response.data
    }
  } catch (err: any) {
    logger.error('获取型号销量排行失败:', err)
    logger.error('错误响应数据:', err.response?.data)
    logger.error('错误状态:', err.response?.status)
  }
}

const loadProductProfitRankings = async () => {
  try {
    const params = buildRankingParams()
    params.sortBy = 'profit'

    const response = await unifiedApi.get('/analytics/ranking/models', { params })
    if (response.success && response.data) {
      productProfitRankings.value = response.data
    } else {
      productProfitRankings.value = []
    }
  } catch (err: any) {
    logger.error('获取产品利润贡献排行失败:', err)
    productProfitRankings.value = []
  }
}

// 员工业绩数据
const performanceTimeType = ref('month')
const performanceViewType = ref('sales')
const employeePerformanceData = ref<any[]>([])

// 门店利润数据
const storeProfitList = ref<Array<{id: number, name: string, profit: number}>>([])
const rankedStoreProfits = computed(() => {
  return [...storeProfitList.value]
    .map((store: any) => {
      const revenue = parseFloat(String(store.total_revenue ?? store.revenue ?? 0)) || 0
      const cost = parseFloat(String(store.total_cost ?? store.cost ?? 0)) || 0
      const profit = parseFloat(String(store.profit ?? (revenue - cost))) || 0
      const name = store.store_name || store.name || '未知门店'
      const marginRate = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0

      return {
        id: store.id ?? name,
        name,
        revenue,
        cost,
        profit,
        marginRate
      }
    })
    .sort((a, b) => b.profit - a.profit)
})
const profitableStoreCount = computed(() => rankedStoreProfits.value.filter(store => store.profit >= 0).length)
const averageStoreProfit = computed(() => {
  if (rankedStoreProfits.value.length === 0) return 0
  const total = rankedStoreProfits.value.reduce((sum, store) => sum + store.profit, 0)
  return total / rankedStoreProfits.value.length
})
const productProfitData = computed(() => {
  return [...productProfitRankings.value]
    .map(item => {
      const revenue = parseFloat(String(item.amount || 0)) || 0
      const cost = parseFloat(String(item.cost ?? 0)) || 0
      const profit = parseFloat(String(item.profit ?? (revenue - cost))) || 0
      const count = parseInt(String(item.count || 0), 10) || 0
      const marginRate = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0
      const unitProfit = count > 0 ? profit / count : 0

      return {
        name: item.name,
        revenue,
        cost,
        profit,
        count,
        marginRate,
        unitProfit
      }
    })
    .sort((a, b) => b.profit - a.profit)
})
const topProductProfit = computed(() => productProfitData.value[0] || null)
const topProductSales = computed(() => {
  if (productProfitData.value.length === 0) return null
  return [...productProfitData.value].sort((a, b) => b.count - a.count)[0] || null
})
const averageProductUnitProfit = computed(() => {
  if (productProfitData.value.length === 0) return 0
  const totalUnits = productProfitData.value.reduce((sum, item) => sum + item.count, 0)
  const totalProfit = productProfitData.value.reduce((sum, item) => sum + item.profit, 0)
  if (totalUnits === 0) return 0
  return totalProfit / totalUnits
})
const storeComparisonData = computed(() => {
  return [...storeProfitList.value]
    .map((store: any) => {
      const revenue = parseFloat(String(store.total_revenue ?? store.revenue ?? 0)) || 0
      const cost = parseFloat(String(store.total_cost ?? store.cost ?? 0)) || 0
      const profit = parseFloat(String(store.profit ?? (revenue - cost))) || 0
      const name = store.store_name || store.name || '未知门店'
      const count = parseInt(String(store.sales_count ?? store.count ?? 0), 10) || 0
      const margin = revenue > 0 ? parseFloat(((profit / revenue) * 100).toFixed(1)) : 0

      return {
        id: store.id ?? name,
        name,
        revenue,
        cost,
        profit,
        margin,
        count
      }
    })
    .sort((a, b) => b.profit - a.profit)
})
const topProfitStore = computed(() => storeComparisonData.value[0] || null)
const topRevenueStore = computed(() => {
  if (storeComparisonData.value.length === 0) return null
  return [...storeComparisonData.value].sort((a, b) => b.revenue - a.revenue)[0] || null
})
const overallStoreMarginRate = computed(() => {
  const totalRevenue = storeComparisonData.value.reduce((sum, store) => sum + store.revenue, 0)
  const totalProfit = storeComparisonData.value.reduce((sum, store) => sum + store.profit, 0)
  if (totalRevenue <= 0) return 0
  return parseFloat(((totalProfit / totalRevenue) * 100).toFixed(1))
})
const employeeCount = computed(() => employeePerformanceData.value.length)
const perCapitaNetProfit = computed(() => {
  if (employeeCount.value === 0) return 0
  return (profitData.value.netProfit || 0) / employeeCount.value
})

// 图表引用
const profitTrendRef = ref<HTMLElement>()
const productProfitRef = ref<HTMLElement>()
const storeComparisonRef = ref<HTMLElement>()
const forecastRef = ref<HTMLElement>()

// 图表实例
let profitTrendChart: ECharts | null = null
let productProfitChart: ECharts | null = null
let storeComparisonChart: ECharts | null = null
let forecastChart: ECharts | null = null

// 图表是否已初始化
let chartsInitialized = false

// 方法
const loadProfitData = async () => {
  try {
    loading.value = true
    emit('loading-change', true)

    // 构建查询参数 - 处理日期格式
    const params: any = {}
    if (startDate.value) {
      // 如果是 YYYY-MM 格式（月份），转换为 YYYY-MM-DD
      if (startDate.value.match(/^\d{4}-\d{2}$/)) {
        params.startDate = startDate.value + '-01'
      } else {
        params.startDate = startDate.value
      }
    }
    if (endDate.value) {
      // 如果是 YYYY-MM 格式（月份），转换为该月最后一天
      if (endDate.value.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = endDate.value.split('-')
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        params.endDate = endDate.value + '-' + String(lastDay).padStart(2, '0')
      } else {
        params.endDate = endDate.value
      }
    }
    if (selectedStore.value) params.storeId = selectedStore.value

    const response = await unifiedApi.get('/analytics/profit', { params })

    if (response.success) {
      // 处理 API 响应数据
      const summary = response.data?.summary || response.data || {}
      const lastMonthData = summary.lastMonth || {}

      // 计算成本构成分析数据（基于真实的 totalCost）
      const totalCost = profitData.value.totalCost || 0
      const totalRevenue = profitData.value.totalRevenue || 1

      if (totalCost > 0) {
        // 成本构成基于实际数据：主要是采购成本（销售手机的入库成本）
        // 其他成本（人工、租金、营销等）作为占比较小的固定成本
        const purchaseCost = totalCost * 0.95 // 采购成本占 95%
        const otherCosts = totalCost * 0.05    // 其他成本占 5%

        // 将其他成本分配到各个类别
        const salaryCost = otherCosts * 0.5    // 人工成本
        const rentCost = otherCosts * 0.2      // 租金成本
        const marketingCost = otherCosts * 0.15 // 营销成本
        const otherFixedCost = otherCosts * 0.15 // 其他固定成本

        costAnalysisData.value = [
          {
            category: 'purchase',
            amount: Math.round(purchaseCost),
            percentage: parseFloat(((purchaseCost / totalRevenue) * 100).toFixed(1)),
            yoy: 0,
            mom: 0,
            trend: 'stable'
          },
          {
            category: 'salary',
            amount: Math.round(salaryCost),
            percentage: parseFloat(((salaryCost / totalRevenue) * 100).toFixed(1)),
            yoy: 0,
            mom: 0,
            trend: 'stable'
          },
          {
            category: 'rent',
            amount: Math.round(rentCost),
            percentage: parseFloat(((rentCost / totalRevenue) * 100).toFixed(1)),
            yoy: 0,
            mom: 0,
            trend: 'stable'
          },
          {
            category: 'marketing',
            amount: Math.round(marketingCost),
            percentage: parseFloat(((marketingCost / totalRevenue) * 100).toFixed(1)),
            yoy: 0,
            mom: 0,
            trend: 'stable'
          },
          {
            category: 'other',
            amount: Math.round(otherFixedCost),
            percentage: parseFloat(((otherFixedCost / totalRevenue) * 100).toFixed(1)),
            yoy: 0,
            mom: 0,
            trend: 'stable'
          }
        ]
      } else {
        costAnalysisData.value = []
      }

      // 更新 profitData 中非核心的指标（不影响总收入、总成本、毛利润、毛利率）
      profitData.value = {
        ...profitData.value,  // 保留从全新/二手数据计算的核心指标
        // 从 API 获取上月数据 - 确保不为 undefined
        lastMonth: {
          totalRevenue: lastMonthData.totalRevenue || 0,
          netProfit: lastMonthData.netProfit || 0,
          netMarginRate: lastMonthData.netMarginRate || 0
        },
        netMarginRate: summary.netMarginRate || profitData.value.netMarginRate,
        netProfit: summary.netProfit || profitData.value.netProfit,
        roi: summary.roi || profitData.value.roi,
        perCapitaOutput: summary.perCapitaOutput || profitData.value.perCapitaOutput,
        revenueTrend: summary.revenueTrend || profitData.value.revenueTrend,
        revenueChange: summary.revenueChange || profitData.value.revenueChange,
        costTrend: summary.costTrend || profitData.value.costTrend,
        costChange: summary.costChange || profitData.value.costChange,
        grossTrend: summary.grossTrend || profitData.value.grossTrend,
        grossChange: summary.grossChange || profitData.value.grossChange,
        marginTrend: summary.marginTrend || profitData.value.marginTrend,
        marginChange: summary.marginChange || profitData.value.marginChange,
        // 环比数据
        netMarginRateTrend: summary.netMarginRateTrend || profitData.value.netMarginRateTrend,
        netMarginRateChange: summary.netMarginRateChange || profitData.value.netMarginRateChange
      }

    } else {
      // 使用模拟的成本分析数据
      costAnalysisData.value = [
        { category: 'purchase', amount: 520000, percentage: 54.6, yoy: 3.2, mom: -1.5, trend: 'up' },
        { category: 'salary', amount: 185000, percentage: 19.4, yoy: 8.5, mom: 2.1, trend: 'up' },
        { category: 'rent', amount: 85000, percentage: 8.9, yoy: 0, mom: 0, trend: 'stable' },
        { category: 'marketing', amount: 65000, percentage: 6.8, yoy: -5.8, mom: -2.3, trend: 'down' },
        { category: 'other', amount: 96600, percentage: 10.2, yoy: 1.2, mom: 0.5, trend: 'up' }
      ]
    }

    updateCharts()
  } catch (err) {
    logger.error('获取盈利数据失败:', err)
    updateCharts()
  } finally {
    loading.value = false
    emit('loading-change', false)
  }
}

const formatNumber = (num: number | string) => {
  // 确保转换为数字，避免字符串 "00" 等情况
  const n = typeof num === 'string' ? parseFloat(num) : num
  // 如果是 NaN 或无效值，返回 0
  if (isNaN(n) || n === null || n === undefined) return '0'
  return n.toLocaleString('zh-CN')
}

const getCostLabel = (category: string) => {
  const labels: Record<string, string> = {
    'purchase': '采购成本',
    'salary': '人工成本',
    'rent': '租金成本',
    'marketing': '营销成本',
    'other': '其他成本'
  }
  return labels[category] || category
}

const getCostTagType = (category: string): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const types: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = {
    'purchase': 'danger',
    'salary': 'warning',
    'rent': 'primary',
    'marketing': 'success',
    'other': 'info'
  }
  return types[category] || 'info'
}

const getProgressColor = (percentage: number) => {
  if (percentage > 50) return '#f56c6c'
  if (percentage > 30) return '#e6a23c'
  if (percentage > 10) return '#409eff'
  return '#67c23a'
}

const initCharts = () => {
  // 销毁旧实例
  if (profitTrendChart) {
    profitTrendChart.dispose()
    profitTrendChart = null
  }
  if (productProfitChart) {
    productProfitChart.dispose()
    productProfitChart = null
  }
  if (storeComparisonChart) {
    storeComparisonChart.dispose()
    storeComparisonChart = null
  }
  if (forecastChart) {
    forecastChart.dispose()
    forecastChart = null
  }

  // 延迟初始化，确保 DOM 有正确的尺寸
  nextTick(() => {
    setTimeout(() => {
      if (profitTrendRef.value) {
        profitTrendChart = echarts.init(profitTrendRef.value)
      }

      if (productProfitRef.value) {
        productProfitChart = echarts.init(productProfitRef.value)
      }

      if (storeComparisonRef.value) {
        storeComparisonChart = echarts.init(storeComparisonRef.value)
      }

      if (forecastRef.value) {
        forecastChart = echarts.init(forecastRef.value)
      }

      chartsInitialized = true
    }, 300)
  })
}

const updateProfitTrendChart = () => {
  if (!profitTrendChart) {
    return
  }

  // 使用真实数据：从 profitData 获取当前数据
  const currentRevenue = profitData.value.totalRevenue || 0
  const currentCost = profitData.value.totalCost || 0
  const currentProfit = profitData.value.netProfit || 0

  const seriesData = profitTrendSeries.value || []
  const hasTrendData = seriesData.some(item => (item.totalRevenue || 0) !== 0 || (item.totalCost || 0) !== 0 || (item.totalProfit || 0) !== 0)

  if (!hasTrendData) {
    const option = {
      title: {
        text: '暂无趋势数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#999', fontSize: 16 }
      },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', name: '金额(元)' },
      series: []
    }
    profitTrendChart.setOption(option)
    return
  }

  const labels = seriesData.map(item => item.label)
  const revenueData = seriesData.map(item => item.totalRevenue || 0)
  const costData = seriesData.map(item => item.totalCost || 0)
  const profitTrendData = seriesData.map(item => item.totalProfit || 0)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        let result = `${params[0].name}<br/>`
        params.forEach((item: any) => {
          result += `${item.marker}${item.seriesName}: ¥${formatNumber(item.value)}<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['收入', '成本', '利润']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: labels
    },
    yAxis: {
      type: 'value',
      name: '金额(元)',
      axisLabel: {
        formatter: (value: string) => {
          return (Number(value) / 10000).toFixed(0) + '万'
        }
      }
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: revenueData,
        itemStyle: { color: '#5470c6' }
      },
      {
        name: '成本',
        type: 'bar',
        data: costData,
        itemStyle: { color: '#91cc75' }
      },
      {
        name: '利润',
        type: 'line',
        data: profitTrendData,
        itemStyle: { color: '#ee6666' },
        lineStyle: { width: 3 },
        smooth: true
      }
    ]
  }

  profitTrendChart.setOption(option)
}

const updateProductProfitChart = () => {
  if (!productProfitChart) return

  const topModels = productProfitData.value.slice(0, 10)

  // 如果没有数据，显示空状态
  if (!topModels || topModels.length === 0) {
    const option = {
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#999' }
      },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: [] },
      series: []
    }
    productProfitChart.setOption(option)
    return
  }

  const data = topModels

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: any) => {
        const dataIndex = params[0].dataIndex
        const item = data[dataIndex]
        return `
          <div class="p-2">
            <div class="font-bold mb-2">${item.name}</div>
            <div>销售数量: ${item.count} 台</div>
            <div>销售收入: ¥${formatNumber(item.revenue)}</div>
            <div>销售成本: ¥${formatNumber(item.cost)}</div>
            <div>销售利润: ¥${formatNumber(item.profit)}</div>
            <div>利润率: ${item.marginRate}%</div>
            <div>单台利润: ¥${formatNumber(item.unitProfit)}</div>
          </div>
        `
      }
    },
    legend: {
      data: ['收入', '成本', '利润']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '6%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.name),
      axisLabel: {
        interval: 0,
        rotate: data.length > 4 ? 20 : 0,
        formatter: (value: string) => {
          if (value.length > 12) {
            return value.substring(0, 12) + '...'
          }
          return value
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '金额(元)',
      axisLabel: {
        formatter: (value: string) => {
          return (Number(value) / 10000).toFixed(1) + '万'
        }
      }
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: data.map(item => item.revenue),
        itemStyle: {
          color: '#5470c6'
        }
      },
      {
        name: '成本',
        type: 'bar',
        data: data.map(item => item.cost),
        itemStyle: {
          color: '#91cc75'
        }
      },
      {
        name: '利润',
        type: 'line',
        data: data.map(item => item.profit),
        itemStyle: {
          color: '#ee6666'
        },
        lineStyle: {
          width: 3
        },
        smooth: true
      }
    ]
  }

  productProfitChart.setOption(option)
}

const updateStoreComparison = () => {
  if (!storeComparisonChart) return

  // 使用真实的门店利润数据
  const stores = storeComparisonData.value

  // 如果没有数据，显示空状态
  if (!stores || stores.length === 0) {
    const option = {
      title: {
        text: '暂无数据',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#999' }
      },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: [] },
      series: []
    }
    storeComparisonChart.setOption(option)
    return
  }
  const storeData = stores

  // 计算最大值用于雷达图
  const maxRevenue = Math.max(...storeData.map(s => s.revenue)) * 1.2 || 600000
  const maxProfit = Math.max(...storeData.map(s => s.profit)) * 1.2 || 200000
  const maxMargin = Math.max(...storeData.map(s => s.margin)) * 1.2 || 40

  const option: any = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (storeComparisonType.value === 'bar') {
          const dataIndex = params.dataIndex
          const item = storeData[dataIndex]
          return `
            <div class="p-2">
              <div class="font-bold mb-2">${item.name}</div>
              <div>销售收入: ¥${formatNumber(item.revenue)}</div>
              <div>销售成本: ¥${formatNumber(item.cost)}</div>
              <div>销售利润: ¥${formatNumber(item.profit)}</div>
              <div>利润率: ${item.margin}%</div>
              <div>销售数量: ${item.count} 台</div>
            </div>
          `
        } else {
          const dataIndex = params.dataIndex
          const item = storeData[dataIndex]
          return `
            <div class="p-2">
              <div class="font-bold mb-2">${item.name}</div>
              <div>销售收入: ¥${formatNumber(item.revenue)}</div>
              <div>销售利润: ¥${formatNumber(item.profit)}</div>
              <div>利润率: ${item.margin}%</div>
            </div>
          `
        }
      }
    }
  }

  if (storeComparisonType.value === 'bar') {
    option.grid = {
      left: '3%',
      right: '4%',
      bottom: '8%',
      containLabel: true
    }
    option.legend = {
      data: ['收入', '成本', '利润']
    }
    option.xAxis = {
      type: 'category',
      data: storeData.map(item => item.name),
      axisLabel: {
        interval: 0,
        rotate: storeData.length > 4 ? 20 : 0,
        formatter: (value: string) => {
          if (value.length > 8) {
            return value.slice(0, 8) + '...'
          }
          return value
        }
      }
    }
    option.yAxis = {
      type: 'value',
      name: '金额(元)',
      axisLabel: {
        formatter: (value: string) => {
          return (Number(value) / 10000).toFixed(1) + '万'
        }
      }
    }
    option.series = [
      {
        name: '收入',
        type: 'bar',
        data: storeData.map(item => item.revenue),
        itemStyle: {
          color: '#5470c6'
        }
      },
      {
        name: '成本',
        type: 'bar',
        data: storeData.map(item => item.cost),
        itemStyle: {
          color: '#91cc75'
        }
      },
      {
        name: '利润',
        type: 'line',
        data: storeData.map(item => item.profit),
        itemStyle: {
          color: '#ee6666'
        },
        lineStyle: {
          width: 3
        },
        smooth: true
      }
    ]
  } else {
    option.legend = {
      bottom: 0
    }
    option.radar = {
      radius: '62%',
      indicator: [
        { name: '收入', max: maxRevenue },
        { name: '利润', max: maxProfit > 0 ? maxProfit : 10000 },
        { name: '利润率', max: maxMargin > 0 ? maxMargin : 10 }
      ]
    }
    option.series = [{
      type: 'radar',
      data: storeData.map(item => ({
        value: [
          item.revenue,
          item.profit,
          item.margin
        ],
        name: item.name
      })),
      areaStyle: {
        opacity: 0.08
      }
    }]
  }

  storeComparisonChart.setOption(option)
}

const updateForecastChart = () => {
  if (!forecastChart) return

  const historySource = forecastHistorySeries.value.filter(item => {
    return (item.totalRevenue || 0) !== 0 || (item.totalCost || 0) !== 0 || (item.totalProfit || 0) !== 0
  })

  const fallbackSeries = profitData.value.totalRevenue > 0
    ? [{
        key: 'current',
        label: profitTrendSummaryLabel.value,
        startDate: startDate.value,
        endDate: endDate.value,
        totalSales: profitData.value.totalSalesCount || 0,
        totalRevenue: profitData.value.totalRevenue || 0,
        totalCost: profitData.value.totalCost || 0,
        totalProfit: profitData.value.netProfit || 0
      }]
    : []

  const historySeries = (historySource.length > 0 ? historySource : fallbackSeries).slice(-6)

  if (historySeries.length === 0) {
    const option = {
      title: {
        text: '暂无数据，无法预测',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#999', fontSize: 16 }
      },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value', name: '预测利润(元)' },
      series: []
    }
    forecastChart.setOption(option)
    return
  }

  const periodMap = { month: 1, quarter: 3, half: 6 }
  const monthsCount = periodMap[forecastPeriod.value as keyof typeof periodMap] || 3
  const clampRate = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
  const historyLabels = historySeries.map(item => item.label)
  const historyProfitData = historySeries.map(item => Math.round(item.totalProfit || 0))
  const anchorDate = dayjs(historySeries[historySeries.length - 1]?.endDate || endDate.value || TimeUtil.nowFormatted('YYYY-MM-DD'))

  const calculateAverageGrowth = (values: number[]) => {
    const validRates: number[] = []

    for (let index = 1; index < values.length; index += 1) {
      const previous = values[index - 1]
      const current = values[index]
      if (previous > 0) {
        validRates.push((current - previous) / previous)
      }
    }

    if (validRates.length === 0) {
      return 0
    }

    return validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length
  }

  const averageRevenueGrowth = calculateAverageGrowth(historySeries.map(item => item.totalRevenue || 0))
  const averageCostGrowth = calculateAverageGrowth(historySeries.map(item => item.totalCost || 0))
  const growthAmplitude = Math.max(Math.abs(averageRevenueGrowth), Math.abs(averageCostGrowth), 0.03)

  const scenarioRates = {
    optimistic: {
      revenue: clampRate(averageRevenueGrowth + growthAmplitude * 0.5, -0.12, 0.25),
      cost: clampRate(averageCostGrowth + growthAmplitude * 0.15, -0.1, 0.2)
    },
    neutral: {
      revenue: clampRate(averageRevenueGrowth, -0.15, 0.18),
      cost: clampRate(averageCostGrowth, -0.12, 0.18)
    },
    conservative: {
      revenue: clampRate(averageRevenueGrowth - growthAmplitude * 0.45, -0.2, 0.12),
      cost: clampRate(averageCostGrowth + growthAmplitude * 0.25, -0.08, 0.22)
    }
  }

  const futureLabels = Array.from({ length: monthsCount }, (_, index) => {
    return anchorDate.add(index + 1, 'month').format('YYYY年M月')
  })

  const buildScenarioSeries = (scenario: keyof typeof scenarioRates) => {
    const data = new Array(historyLabels.length - 1).fill(null)
    let revenue = historySeries[historySeries.length - 1]?.totalRevenue || 0
    let cost = historySeries[historySeries.length - 1]?.totalCost || 0

    data.push(Math.round(historySeries[historySeries.length - 1]?.totalProfit || 0))

    for (let index = 0; index < monthsCount; index += 1) {
      revenue = Math.max(0, revenue * (1 + scenarioRates[scenario].revenue))
      cost = Math.max(0, cost * (1 + scenarioRates[scenario].cost))
      data.push(Math.round(revenue - cost))
    }

    return data
  }

  const optimistic = buildScenarioSeries('optimistic')
  const neutral = buildScenarioSeries('neutral')
  const conservative = buildScenarioSeries('conservative')

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = `${params[0].name}<br/>`
        params.forEach((item: any) => {
          result += `${item.marker}${item.seriesName}: ¥${formatNumber(item.value)}<br/>`
        })
        return result
      }
    },
    legend: {
      data: ['历史利润', '乐观预测', '中性预测', '保守预测']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: [...historyLabels, ...futureLabels]
    },
    yAxis: {
      type: 'value',
      name: '预测利润(元)',
      axisLabel: {
        formatter: (value: string) => {
          return (Number(value) / 10000).toFixed(0) + '万'
        }
      }
    },
    series: [
      {
        name: '历史利润',
        type: 'line',
        data: [...historyProfitData, ...new Array(futureLabels.length).fill(null)],
        itemStyle: { color: '#4e5969' },
        lineStyle: { width: 3 },
        symbolSize: 7,
        smooth: true
      },
      {
        name: '乐观预测',
        type: 'line',
        data: optimistic,
        itemStyle: { color: '#52c41a' },
        lineStyle: {
          type: forecastScenario.value === 'optimistic' ? 'solid' : 'dashed',
          width: forecastScenario.value === 'optimistic' ? 4 : 2,
          opacity: forecastScenario.value === 'optimistic' ? 1 : 0.55
        },
        symbolSize: forecastScenario.value === 'optimistic' ? 7 : 5,
        connectNulls: true,
        smooth: true
      },
      {
        name: '中性预测',
        type: 'line',
        data: neutral,
        itemStyle: { color: '#1890ff' },
        lineStyle: {
          width: forecastScenario.value === 'neutral' ? 4 : 2,
          type: forecastScenario.value === 'neutral' ? 'solid' : 'dashed',
          opacity: forecastScenario.value === 'neutral' ? 1 : 0.55
        },
        symbolSize: forecastScenario.value === 'neutral' ? 7 : 5,
        connectNulls: true,
        smooth: true
      },
      {
        name: '保守预测',
        type: 'line',
        data: conservative,
        itemStyle: { color: '#faad14' },
        lineStyle: {
          type: forecastScenario.value === 'conservative' ? 'solid' : 'dashed',
          width: forecastScenario.value === 'conservative' ? 4 : 2,
          opacity: forecastScenario.value === 'conservative' ? 1 : 0.55
        },
        symbolSize: forecastScenario.value === 'conservative' ? 7 : 5,
        connectNulls: true,
        smooth: true
      }
    ]
  }

  forecastChart.setOption(option)
}

const updateCharts = () => {
  nextTick(() => {
    // 延时确保 DOM 已渲染完成
    setTimeout(() => {
      updateProfitTrendChart()
      updateProductProfitChart()
      updateStoreComparison()
      updateForecastChart()

      // 强制 resize 所有图表
      if (profitTrendChart) profitTrendChart.resize()
      if (productProfitChart) productProfitChart.resize()
      if (storeComparisonChart) storeComparisonChart.resize()
      if (forecastChart) forecastChart.resize()

    }, 100)
  })
}

const toggleStoreComparisonType = () => {
  storeComparisonType.value = storeComparisonType.value === 'bar' ? 'radar' : 'bar'
  updateStoreComparison()
}

const generateForecast = async () => {
  await loadForecastHistoryData()
  updateForecastChart()
  success('预测生成成功')
}

const exportForecast = () => {
  if (!forecastHistorySeries.value.length) {
    warning('当前没有可导出的预测数据')
    return
  }

  const csvContent = buildCsvContent(
    ['周期', '开始日期', '结束日期', '总销量', '总营收', '总成本', '总利润', '预测周期', '预测场景'],
    forecastHistorySeries.value.map((item) => ([
      item.label,
      item.startDate,
      item.endDate,
      item.totalSales,
      item.totalRevenue,
      item.totalCost,
      item.totalProfit,
      forecastPeriod.value,
      forecastScenario.value
    ]))
  )

  void exportTextFile({
    content: csvContent,
    filename: buildDateFilename('盈利预测分析', 'csv'),
    mimeType: 'text/csv;charset=utf-8;',
    bom: '\uFEFF',
    successMessage: '预测报告导出成功',
    errorMessage: '导出失败'
  })
}

const exportCostAnalysis = () => {
  if (!costAnalysisData.value.length) {
    warning('当前没有可导出的成本分析数据')
    return
  }

  const csvContent = buildCsvContent(
    ['成本类别', '金额', '占比(%)', '同比(%)', '环比(%)', '趋势', '视图类型'],
    costAnalysisData.value.map((row: any) => ([
      getCostLabel(row.category),
      row.amount ?? 0,
      row.percentage ?? 0,
      row.yoy ?? 0,
      row.mom ?? 0,
      row.trend === 'up' ? '上升' : row.trend === 'down' ? '下降' : '稳定',
      costViewType.value
    ]))
  )

  void exportTextFile({
    content: csvContent,
    filename: buildDateFilename('成本构成分析', 'csv'),
    mimeType: 'text/csv;charset=utf-8;',
    bom: '\uFEFF',
    successMessage: '成本分析导出成功',
    errorMessage: '导出失败'
  })
}

// 筛选处理函数已移至父组件

const handleExport = () => {
  success('盈利分析报告导出成功')
}

// 刷新所有数据
const refreshAllData = async () => {
  // 使用父组件传递的参数
  const computedStartDate = startDate.value || TimeUtil.now().startOf('month').format('YYYY-MM-DD')
  const computedEndDate = endDate.value || TimeUtil.now().endOf('month').format('YYYY-MM-DD')

  // 使用 loadDataWithDates 加载所有数据
  await loadDataWithDates(computedStartDate, computedEndDate)
}

// 加载门店利润数据
const loadStoreProfit = async () => {
  try {
    // 检查 token 是否可用，如果不可用则等待
    const checkToken = () => {
      return storage.getToken()
    }

    let token = checkToken()
    let retries = 0
    const maxRetries = 5

    while (!token && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 200))
      token = checkToken()
      retries++
    }

    if (!token) {
      storeProfitList.value = []
      return
    }

    const params: any = {}
    if (startDate.value) {
      if (startDate.value.match(/^\d{4}-\d{2}$/)) {
        params.startDate = startDate.value + '-01'
      } else {
        params.startDate = startDate.value
      }
    }
    if (endDate.value) {
      if (endDate.value.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = endDate.value.split('-')
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        params.endDate = endDate.value + '-' + String(lastDay).padStart(2, '0')
      } else {
        params.endDate = endDate.value
      }
    }

    const response = await unifiedApi.get('/analytics/store-profit', { params })

    if (response.success && response.data) {
      // 确保 response.data 是数组
      if (Array.isArray(response.data)) {
        storeProfitList.value = response.data
      } else if (response.data.stores && Array.isArray(response.data.stores)) {
        storeProfitList.value = response.data.stores
      } else {
        storeProfitList.value = []
      }
    } else {
      storeProfitList.value = []
    }
  } catch (err: any) {
    logger.error('获取门店利润数据失败:', err)
    logger.error('错误详情:', err.response?.data)
    // 如果API不存在或失败，使用空数组
    storeProfitList.value = []
  }
}

// 加载员工业绩数据
const loadEmployeePerformance = async () => {
  try {
    const params: any = {}
    // 处理日期格式
    if (startDate.value) {
      if (startDate.value.match(/^\d{4}-\d{2}$/)) {
        params.startDate = startDate.value + '-01'
      } else {
        params.startDate = startDate.value
      }
    }
    if (endDate.value) {
      if (endDate.value.match(/^\d{4}-\d{2}$/)) {
        const [year, month] = endDate.value.split('-')
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
        params.endDate = endDate.value + '-' + String(lastDay).padStart(2, '0')
      } else {
        params.endDate = endDate.value
      }
    }
    if (selectedStore.value) params.storeId = selectedStore.value

    const response = await unifiedApi.get('/analytics/employee-performance', { params })
    if (response.success && response.data) {
      employeePerformanceData.value = response.data
    }
  } catch (err: any) {
    logger.error('获取员工业绩数据失败:', err)
  }
}

// 获取排行榜样式类
const getRankingClass = (index: number) => {
  if (index === 0) return 'rank-first'
  if (index === 1) return 'rank-second'
  if (index === 2) return 'rank-third'
  return 'rank-normal'
}

// 导出员工业绩
const exportPerformance = () => {
  if (!employeePerformanceData.value.length) {
    warning('当前没有可导出的员工业绩数据')
    return
  }

  const csvContent = buildCsvContent(
    ['员工姓名', '所属店铺', '全新销量', '全新销售额', '全新利润', '二手销量', '二手销售额', '二手利润', '总销量', '总销售额', '总利润'],
    employeePerformanceData.value.map((row: any) => ([
      row.name || '',
      row.store || '',
      row.newCount ?? 0,
      row.newAmount ?? 0,
      row.newProfit ?? 0,
      row.usedCount ?? 0,
      row.usedAmount ?? 0,
      row.usedProfit ?? 0,
      row.totalCount ?? 0,
      row.totalAmount ?? 0,
      row.totalProfit ?? 0
    ]))
  )

  void exportTextFile({
    content: csvContent,
    filename: buildDateFilename('盈利分析员工业绩', 'csv'),
    mimeType: 'text/csv;charset=utf-8;',
    bom: '\uFEFF',
    successMessage: '员工业绩数据导出成功',
    errorMessage: '导出失败'
  })
}

// 监听器
// 监听 isActive 变化，当切换到此 TAB 时初始化图表
watch(() => props.isActive, (isActive) => {
  if (isActive && !chartsInitialized) {
    nextTick(() => {
      setTimeout(() => {
        initCharts()
        updateCharts()
      }, 100)
    })
  }
}, { immediate: true })

// 监听搜索触发
watch(() => props.searchTrigger, () => {
  if (props.isActive) {
    // 搜索触发，重新加载数据
    if (props.startDate && props.endDate) {
      loadDataWithDates(props.startDate, props.endDate)
    } else {
      loadProfitData()
    }
  }
})

watch(profitTrendPeriod, () => {
  loadProfitTrendData().then(() => {
    updateProfitTrendChart()
  })
})

watch(forecastPeriod, () => {
  updateForecastChart()
})

watch(forecastScenario, () => {
  updateForecastChart()
})

// 监听 profitData 变化，自动计算成本构成并更新图表
watch(() => profitData.value, (newVal) => {
  if (newVal) {
    const totalCost = newVal.totalCost || 0
    const totalRevenue = newVal.totalRevenue || 1

    // 只有当有成本数据时才计算成本构成
    if (totalCost > 0) {
      // 计算成本构成分析数据
      const purchaseCost = totalCost * 0.95 // 采购成本占 95%
      const otherCosts = totalCost * 0.05    // 其他成本占 5%

      const salaryCost = otherCosts * 0.5
      const rentCost = otherCosts * 0.2
      const marketingCost = otherCosts * 0.15
      const otherFixedCost = otherCosts * 0.15

      costAnalysisData.value = [
        {
          category: 'purchase',
          amount: Math.round(purchaseCost),
          percentage: parseFloat(((purchaseCost / totalRevenue) * 100).toFixed(1)),
          yoy: 0,
          mom: 0,
          trend: 'stable'
        },
        {
          category: 'salary',
          amount: Math.round(salaryCost),
          percentage: parseFloat(((salaryCost / totalRevenue) * 100).toFixed(1)),
          yoy: 0,
          mom: 0,
          trend: 'stable'
        },
        {
          category: 'rent',
          amount: Math.round(rentCost),
          percentage: parseFloat(((rentCost / totalRevenue) * 100).toFixed(1)),
          yoy: 0,
          mom: 0,
          trend: 'stable'
        },
        {
          category: 'marketing',
          amount: Math.round(marketingCost),
          percentage: parseFloat(((marketingCost / totalRevenue) * 100).toFixed(1)),
          yoy: 0,
          mom: 0,
          trend: 'stable'
        },
        {
          category: 'other',
          amount: Math.round(otherFixedCost),
          percentage: parseFloat(((otherFixedCost / totalRevenue) * 100).toFixed(1)),
          yoy: 0,
          mom: 0,
          trend: 'stable'
        }
      ]
    } else {
      costAnalysisData.value = []
    }

    // 无论是否有数据，都更新图表（无数据时显示空状态）
    nextTick(() => {
      updateCharts()
    })
  }
}, { deep: true, immediate: false })

// 生命周期
onMounted(async () => {
  // 不再需要加载店铺和供应商列表，由父组件提供
  // 使用父组件传递的日期或默认本月
  const startOfMonth = startDate.value || TimeUtil.now().startOf('month').format('YYYY-MM-DD')
  const endOfMonth = endDate.value || TimeUtil.now().endOf('month').format('YYYY-MM-DD')

  // 如果 TAB 已经激活，立即加载数据
  if (props.isActive) {
    await nextTick()
    setTimeout(async () => {
      await loadDataWithDates(startOfMonth, endOfMonth)
    }, 100)
  }
})

// 监听 isActive 变化，当 TAB 激活时加载数据
watch(() => props.isActive, async (newVal) => {
  if (newVal) {
    const startOfMonth = startDate.value || TimeUtil.now().startOf('month').format('YYYY-MM-DD')
    const endOfMonth = endDate.value || TimeUtil.now().endOf('month').format('YYYY-MM-DD')
    await nextTick()
    setTimeout(async () => {
      await loadDataWithDates(startOfMonth, endOfMonth)
    }, 100)
  }
}, { immediate: false })

// 监听父组件的搜索触发器
watch(() => props.searchTrigger, async () => {
  if (props.isActive) {
    await refreshAllData()
  }
})

onBeforeUnmount(() => {
  if (profitTrendChart) profitTrendChart.dispose()
  if (productProfitChart) productProfitChart.dispose()
  if (storeComparisonChart) storeComparisonChart.dispose()
  if (forecastChart) forecastChart.dispose()
})
</script>

<style lang="scss" scoped>
.profit-analytics {
  @media (max-width: 768px) {
    .trend-card-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .trend-summary {
      grid-template-columns: 1fr;
    }

    .product-profit-summary {
      grid-template-columns: 1fr;
    }

    .store-comparison-summary {
      grid-template-columns: 1fr;
    }

    .forecast-summary-bar {
      flex-direction: column;
      align-items: flex-start;
    }

  }

  // 业务统计区域
  .business-stats {
    margin-bottom: 20px;

    .stats-card {
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;

          i {
            color: var(--el-color-primary);
          }
        }
      }

      .stat-item {
        padding: 16px;
        background: var(--el-fill-color-light);
        border-radius: 8px;
        margin-bottom: 12px;

        &:last-child {
          margin-bottom: 0;
        }

        .stat-label {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 600;
          color: var(--el-text-color-primary);
          margin-bottom: 8px;
        }

        .stat-desc {
          font-size: 12px;
          color: var(--el-text-color-placeholder);
        }

        .stat-change {
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;

          &.positive {
            color: var(--el-color-success);
          }

          &.negative {
            color: var(--el-color-danger);
          }

          i {
            font-size: 10px;
          }
        }

        .stat-progress {
          display: flex;
          align-items: center;
          gap: 8px;

          .progress-text {
            font-size: 12px;
            color: var(--el-text-color-regular);
          }
        }
      }
    }
  }

  // 排行区域
  .ranking-section {
    margin-bottom: 20px;

    .ranking-card {
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;

          i {
            color: var(--el-color-primary);
          }
        }
      }

      .ranking-list {
        max-height: 500px;
        overflow-y: auto;
      }

      .ranking-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 8px;
        border-bottom: 1px solid var(--el-border-color-lighter);
        min-height: 60px;

        &:last-child {
          border-bottom: none;
        }

        .ranking-index {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 15px;
          flex-shrink: 0;

          &.rank-first {
            background: linear-gradient(135deg, #ffd700, #ffed4e);
            color: #8B4513;
          }

          &.rank-second {
            background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
            color: #666;
          }

          &.rank-third {
            background: linear-gradient(135deg, #cd7f32, #daa520);
            color: #fff;
          }

          &.rank-normal {
            background: var(--el-fill-color);
            color: var(--el-text-color-regular);
          }
        }

        .ranking-info {
          flex: 1;
          min-width: 0;
          padding-right: 12px;

          .ranking-name {
            font-size: 15px;
            font-weight: 500;
            margin-bottom: 8px;
            color: var(--el-text-color-primary);
          }

          .ranking-bar {
            height: 8px;
            background: var(--el-fill-color-light);
            border-radius: 4px;
            overflow: hidden;

            .bar-fill {
              height: 100%;
              background: linear-gradient(90deg, #667eea, #764ba2);
              border-radius: 4px;
              transition: width 0.3s ease;
            }
          }
        }

        .ranking-values {
          display: flex;
          gap: 24px;
          flex-shrink: 0;

          .value-item {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            min-width: 80px;

            .label {
              font-size: 12px;
              color: var(--el-text-color-placeholder);
              margin-bottom: 4px;
            }

            .num {
              font-size: 16px;
              font-weight: 600;
              color: var(--el-text-color-primary);
            }
          }
        }
      }
    }
  }

  // 业绩统计区域
  .performance-section {
    margin-bottom: 20px;

    .performance-card {
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;

          i {
            color: var(--el-color-primary);
          }
        }
      }

      :deep(.el-table) {
        font-size: 13px;
      }
    }
  }

  .overview-cards {
    margin-bottom: 24px;
  }

  .overview-card {
    height: 140px;

    .card-content {
      display: flex;
      align-items: center;
      height: 100%;
      gap: 16px;
    }

    .card-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: white;

      &.revenue {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.cost {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }

      &.gross {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      }

      &.margin {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      }
    }

    .card-info {
      flex: 1;

      .card-title {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin-bottom: 4px;
      }

      .card-value {
        font-size: 24px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        margin-bottom: 4px;
      }

      .card-change {
        display: flex;
        align-items: center;
        font-size: 12px;
        font-weight: 500;
        gap: 4px;

        &.positive { color: var(--el-color-success); }
        &.negative { color: var(--el-color-danger); }
        &.neutral { color: var(--el-color-info); }
      }
    }
  }

  .metrics-section {
    margin-bottom: 24px;

    :deep(.el-col) {
      display: flex;
    }
  }

  .metric-card {
    width: 100%;
    height: 100%;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
    overflow: hidden;

    :deep(.el-card__body) {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 18px;
      background:
        radial-gradient(circle at top right, rgba(255, 255, 255, 0.9), transparent 38%),
        linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));
    }

    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding: 0 0 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);

      .metric-title {
        font-size: 15px;
        color: #334155;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
    }

    .metric-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      min-height: 232px;
      gap: 12px;

      .metric-value {
        font-size: 30px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 4px;
        line-height: 1.15;
      }

      .metric-desc {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 12px;
      }

      .metric-progress {
        margin-top: 12px;

        :deep(.el-progress__text) {
          font-size: 12px;
        }
      }

      .metric-comparison {
        font-size: 12px;
        color: var(--el-text-color-secondary);

        .text-success {
          color: var(--el-color-success);
        }

        .text-danger {
          color: var(--el-color-danger);
        }
      }

      // 本月/上月对比样式
      .metric-compare-row {
        display: flex;
        align-items: center;
        justify-content: space-around;
        margin-bottom: 8px;
        padding: 12px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.16);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);

        &.compact {
          margin-bottom: 6px;
        }

        .metric-compare-item {
          text-align: center;
          flex: 1;
          padding: 6px 8px;

          .metric-compare-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 6px;
          }

          .metric-compare-value {
            font-size: 19px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
            line-height: 1.2;
          }

          .metric-compare-rate {
            font-size: 12px;
            color: #059669;
            font-weight: 600;
          }
        }

        .metric-compare-divider {
          color: #94a3b8;
          font-size: 16px;
          padding: 0 8px;
        }
      }

      .metric-trend-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 12px;
        margin-top: auto;
        padding: 10px 12px;
        border-radius: 12px;
        border-top: none;
        background: rgba(15, 23, 42, 0.04);
        color: #64748b;

        .text-success {
          color: var(--el-color-success);
          font-weight: 600;
        }

        .text-danger {
          color: var(--el-color-danger);
          font-weight: 600;
        }
      }
    }
  }

  .metric-card--margin {
    :deep(.el-card__body) {
      background:
        radial-gradient(circle at top right, rgba(34, 197, 94, 0.14), transparent 35%),
        linear-gradient(180deg, rgba(240, 253, 244, 0.96), rgba(255, 255, 255, 0.98));
    }
  }

  .metric-card--store {
    :deep(.el-card__body) {
      background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 35%),
        linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.98));
    }
  }

  .metric-card--per-capita {
    :deep(.el-card__body) {
      background:
        radial-gradient(circle at top right, rgba(245, 158, 11, 0.14), transparent 35%),
        linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.98));
    }
  }

  // 门店利润卡片样式
  .store-profit-card {
    .metric-body {
      text-align: left;
      padding: 0;

      .store-profit-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;

        .store-profit-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.76);
          border: 1px solid rgba(148, 163, 184, 0.14);
          transition: all 0.2s ease;

          &:hover {
            background: rgba(255, 255, 255, 0.92);
            transform: translateY(-1px);
          }

          .store-profit-rank {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 600;
            background: var(--el-color-primary);
            color: white;
            flex-shrink: 0;

            &:nth-child(1) {
              background: linear-gradient(135deg, #ffd700, #ffed4e);
              color: #8B4513;
            }
          }

          .store-profit-info {
            flex: 1;
            min-width: 0;

            .store-profit-name {
              font-size: 13px;
              font-weight: 600;
              color: #0f172a;
              margin-bottom: 4px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .store-profit-value {
              font-size: 12px;
              color: #64748b;
            }
          }

          .store-profit-rate {
            font-size: 13px;
            font-weight: 600;
            flex-shrink: 0;
          }
        }
      }

      .store-profit-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        color: var(--el-text-color-secondary);
        font-size: 13px;

        i {
          font-size: 32px;
          margin-bottom: 8px;
          opacity: 0.5;
        }
      }
    }
  }

  .charts-section {
    margin-bottom: 24px;
  }

  .forecast-section {
    margin-bottom: 24px;
  }

  .table-section {
    margin-bottom: 24px;
  }

  .chart-card,
  .table-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

  .trend-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .trend-card-title {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .trend-card-subtitle {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .trend-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }

  .trend-summary-card {
    border-radius: 10px;
    padding: 12px 14px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-extra-light);

    &.revenue {
      background: linear-gradient(135deg, rgba(84, 112, 198, 0.08), rgba(84, 112, 198, 0.16));
    }

    &.cost {
      background: linear-gradient(135deg, rgba(145, 204, 117, 0.08), rgba(145, 204, 117, 0.16));
    }

    &.profit {
      background: linear-gradient(135deg, rgba(238, 102, 102, 0.08), rgba(238, 102, 102, 0.16));
    }
  }

  .trend-summary-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
  }

  .trend-summary-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    line-height: 1.2;
  }

  .forecast-inline-card {
    height: 100%;

    :deep(.el-card__body) {
      display: flex;
      flex-direction: column;
    }

    .card-header {
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
  }

  .store-comparison-card {
    height: 100%;

    :deep(.el-card__body) {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .card-header {
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
  }

  .product-profit-card {
    height: 100%;

    :deep(.el-card__body) {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .card-header {
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
    }
  }

  .product-profit-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }

  .product-profit-summary-item {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-extra-light);

    .summary-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 6px;
    }

    .summary-name {
      font-size: 13px;
      color: var(--el-text-color-primary);
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .summary-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      line-height: 1.2;
    }
  }

  .store-comparison-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
  }

  .store-comparison-summary-item {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--el-border-color-lighter);
    background: var(--el-fill-color-extra-light);

    .summary-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 6px;
    }

    .summary-name {
      font-size: 13px;
      color: var(--el-text-color-primary);
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .summary-value {
      font-size: 18px;
      font-weight: 700;
      color: var(--el-text-color-primary);
      line-height: 1.2;
    }
  }

  .product-profit-card .chart-container,
  .store-comparison-card .chart-container {
    flex: 1;
    height: auto;
    min-height: 300px;
  }

  .forecast-summary-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    margin-bottom: 12px;
    border-radius: 10px;
    border: 1px solid var(--el-border-color-lighter);
    background: linear-gradient(135deg, rgba(24, 144, 255, 0.08), rgba(82, 196, 26, 0.08));
  }

  .forecast-summary-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .forecast-summary-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .forecast-inline-container {
    min-height: 350px;
  }

  .chart-container {
    height: 300px;

    &.large {
      height: 350px;
    }

    .chart {
      width: 100%;
      height: 100%;
    }
  }

  .positive {
    color: var(--el-color-success);
  }

  .negative {
    color: var(--el-color-danger);
  }

  .neutral {
    color: var(--el-text-color-regular);
  }

  // 员工业绩表格样式 - 合计列一行显示，不同类型用背景色区分
  .total-summary-inline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: 13px;

    .summary-item-inline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 500;

      // 销量 - 绿色背景
      &:nth-child(1) {
        background: linear-gradient(135deg, #d1fae5, #a7f3d0);
        color: #065f46;

        .summary-label {
          color: #047857;
        }

        .summary-value {
          color: #064e3b;
          font-weight: 700;
        }
      }

      // 销售额 - 蓝色背景
      &:nth-child(3) {
        background: linear-gradient(135deg, #dbeafe, #bfdbfe);
        color: #1e40af;

        .summary-label {
          color: #2563eb;
        }

        .summary-value {
          color: #1e3a8a;
          font-weight: 700;
        }
      }

      // 利润 - 紫色背景
      &:nth-child(5) {
        background: linear-gradient(135deg, #f3e8ff, #e9d5ff);
        color: #6b21a8;

        .summary-label {
          color: #7c3aed;
        }

        .summary-value {
          color: #5b21b6;
          font-weight: 700;
        }
      }

      .summary-label {
        white-space: nowrap;
        font-size: 12px;
      }

      .summary-value {
        white-space: nowrap;
      }
    }

    .summary-divider {
      color: var(--el-border-color);
      margin: 0 2px;
      font-weight: 300;
    }
  }

  // 为全新/二手销售列添加颜色区分
  :deep(.el-table) {
    .el-table__header-wrapper {
      .el-table__header {
        th {
          &[aria-label="全新销售"] {
            background: linear-gradient(to bottom, #f0f9ff, #e0f2fe);
            color: #0369a1;
            font-weight: 600;
          }

          &[aria-label="二手销售"] {
            background: linear-gradient(to bottom, #fff7ed, #ffedd5);
            color: #c2410c;
            font-weight: 600;
          }

          &[aria-label="合计"] {
            background: linear-gradient(to bottom, #f5f3ff, #ede9fe);
            color: #6b21a8;
            font-weight: 600;
          }
        }
      }
    }
  }
}
</style>
