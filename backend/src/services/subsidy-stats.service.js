'use strict'

const dataMaskingService = require('./data-masking.service')
const SubsidyStatsRepository = require('../repositories/subsidy-stats.repository')

const buildSubsidyFilters = require('../utils/subsidy-query-filters')


const normalizeCount = value => Number.parseInt(value, 10)
const normalizeAmount = value => Number.parseFloat(value)

class SubsidyStatsService {
  constructor({ repository = new SubsidyStatsRepository(), masking = dataMaskingService } = {}) {
    this.repository = repository
    this.masking = masking
  }

  async getSummary({ userId, query, onFiltersBuilt = () => {} }) {
    const permissions = await this.masking.getUserFieldPermissions(userId, 'subsidy_subsidyview')
    const hiddenFields = new Set(permissions.hiddenFields || [])
    const { whereConditions, queryParams } = buildSubsidyFilters(query)
    const includeStoreStats = query.include_store_stats === '1' && !hiddenFields.has('stats.store_overview')
    onFiltersBuilt({ includeStoreStats, filterCount: whereConditions.length, queryParamCount: queryParams.length })
    const { stats, storeStats, statsQueryMs, storeStatsQueryMs } = await this.repository.getSummary({
      whereConditions,
      queryParams,
      includeStoreStats
    })
    const visibleStats = {
      ...stats,
      total_arrived_amount: normalizeAmount(stats.total_arrived_amount),
      total_subsidy_amount: normalizeAmount(stats.total_subsidy_amount),
      store_stats: storeStats.map(store => ({
        ...store,
        total_count: normalizeCount(store.total_count),
        pending_count: normalizeCount(store.pending_count),
        completed_count: normalizeCount(store.completed_count),
        approved_count: normalizeCount(store.approved_count),
        total_arrived_amount: normalizeAmount(store.total_arrived_amount),
        total_subsidy_amount: normalizeAmount(store.total_subsidy_amount)
      }))
    }
    if (hiddenFields.has('stats.total_and_handler')) delete visibleStats.handler_count
    if (hiddenFields.has('stats.approval_progress')) {
      delete visibleStats.pending_count
      delete visibleStats.completed_count
      delete visibleStats.approved_count
      visibleStats.store_stats.forEach(store => {
        delete store.pending_count
        delete store.completed_count
        delete store.approved_count
      })
    }
    if (hiddenFields.has('stats.amount_progress')) {
      delete visibleStats.total_arrived_amount
      delete visibleStats.total_subsidy_amount
      visibleStats.store_stats.forEach(store => {
        delete store.total_arrived_amount
        delete store.total_subsidy_amount
      })
    }
    if (hiddenFields.has('stats.store_overview')) delete visibleStats.store_stats
    return {
      data: visibleStats,
      includeStoreStats,
      queryParamCount: queryParams.length,
      storeCount: storeStats.length,
      statsQueryMs,
      storeStatsQueryMs
    }
  }
}

module.exports = SubsidyStatsService
