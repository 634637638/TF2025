'use strict'

const buildSubsidyFilters = (query) => {
  const {
    status, approval_status, arrival_status, customer_phone, customer_name, customer_idcard,
    imei1, imei2, serial_number, start_date, end_date, store_id, brand, model, color, memory,
    min_price, max_price, min_subsidy, max_subsidy, has_handler, apply_start_date,
    apply_end_date, arrival_start_date, arrival_end_date
  } = query
  const whereConditions = ['1=1']
  const queryParams = []

  if (approval_status) {
    if (approval_status === 'approved' || approval_status === 'completed') whereConditions.push('apply_time IS NOT NULL')
    else if (approval_status === 'pending') whereConditions.push('apply_time IS NULL')
    else {
      whereConditions.push('apply_status = ?')
      queryParams.push(approval_status)
    }
  }
  if (arrival_status === 'arrived' || arrival_status === 'approved') whereConditions.push('arrival_time IS NOT NULL')
  else if (arrival_status === 'unarrived') whereConditions.push('arrival_time IS NULL')
  if (!approval_status && !arrival_status && status) {
    if (status === 'completed') whereConditions.push('apply_time IS NOT NULL')
    else if (status === 'approved') whereConditions.push('arrival_time IS NOT NULL')
    else if (status === 'unarrived') whereConditions.push('apply_time IS NOT NULL', 'arrival_time IS NULL')
    else if (status === 'pending') whereConditions.push('apply_time IS NULL')
    else {
      whereConditions.push('apply_status = ?')
      queryParams.push(status)
    }
  }

  const keywordFilters = [
    ['customer_phone', customer_phone], ['customer_name', customer_name],
    ['customer_idcard', customer_idcard], ['imei1', imei1], ['imei2', imei2],
    ['serial_number', serial_number]
  ]
  const hasKeywordFields = keywordFilters.some(([, value]) => Boolean(value))
  const hasFilterFields = Boolean(brand || model || color || memory)
  const searchBox = hasKeywordFields && hasFilterFields
  const searchFields = []
  const searchParams = []
  for (const [field, value] of keywordFilters) {
    if (value) {
      searchFields.push(`${field} LIKE ?`)
      searchParams.push(`%${value}%`)
    }
  }
  if (searchBox) {
    for (const [field, value] of [['phone_brand', brand], ['phone_model', model], ['phone_color', color], ['phone_memory', memory]]) {
      if (value) {
        searchFields.push(`${field} LIKE ?`)
        searchParams.push(`%${value}%`)
      }
    }
  }
  if (searchFields.length) {
    whereConditions.push(`(${searchFields.join(' OR ')})`)
    queryParams.push(...searchParams)
  }
  if (!searchBox) {
    for (const [field, value] of [['phone_brand', brand], ['phone_model', model], ['phone_color', color], ['phone_memory', memory]]) {
      if (value) {
        whereConditions.push(`${field} LIKE ?`)
        queryParams.push(`%${value}%`)
      }
    }
  }
  for (const [field, value, expression = `${field} = ?`, parameter = value] of [
    ['sale_time', start_date, 'sale_time >= ?'],
    ['sale_time', end_date, 'sale_time < DATE_ADD(?, INTERVAL 1 DAY)'],
    ['store_id', store_id],
    ['sale_price', min_price, 'sale_price >= ?', parseFloat(min_price)],
    ['sale_price', max_price, 'sale_price <= ?', parseFloat(max_price)],
    ['subsidy_amount', min_subsidy, 'subsidy_amount >= ?', parseFloat(min_subsidy)],
    ['subsidy_amount', max_subsidy, 'subsidy_amount <= ?', parseFloat(max_subsidy)],
    ['apply_time', apply_start_date, 'apply_time >= ?'],
    ['apply_time', apply_end_date, 'apply_time < DATE_ADD(?, INTERVAL 1 DAY)'],
    ['arrival_time', arrival_start_date, 'arrival_time >= ?'],
    ['arrival_time', arrival_end_date, 'arrival_time < DATE_ADD(?, INTERVAL 1 DAY)']
  ]) {
    if (value) {
      whereConditions.push(expression)
      queryParams.push(parameter)
    }
  }
  if (has_handler === '1') whereConditions.push('has_different_handler = 1')
  else if (has_handler === '0') whereConditions.push('has_different_handler = 0')

  return { whereConditions, queryParams }
}

module.exports = buildSubsidyFilters
