'use strict'

const XLSX = require('xlsx')

const getSubsidyStatusLabel = (item) => {
  if (item.arrival_time) {
    return '已到账'
  }

  if (item.apply_time) {
    return '已提交'
  }

  return '未提交'
}

const buildSubsidyExportFile = (items = [], hiddenFields = new Set()) => {
  const exportColumns = [
    ['customer_info.customer_name', '客户姓名', item => item.customer_name || ''],
    ['customer_info.customer_phone', '客户电话', item => item.customer_phone || ''],
    ['customer_info.customer_idcard', '客户身份证', item => item.customer_idcard || ''],
    ['device_info.brand', '品牌', item => item.phone_brand || ''],
    ['device_info.model', '型号', item => item.phone_model || ''],
    ['device_info.color', '颜色', item => item.phone_color || ''],
    ['device_info.memory', '内存', item => item.phone_memory || ''],
    ['device_info.serial_number', '序列号', item => item.serial_number || ''],
    ['device_info.imei1', 'IMEI1', item => item.imei1 || ''],
    ['device_info.imei2', 'IMEI2', item => item.imei2 || ''],
    ['price_info.sale_price', '销售价', item => item.sale_price === null || item.sale_price === undefined ? '' : parseFloat(item.sale_price)],
    ['time_info.sale_time', '销售时间', item => item.sale_time || ''],
    ['store_info.store_name', '店铺', item => item.store_name || ''],
    ['sales_info.salesman_name', '销售员', item => item.salesman_name || ''],
    ['price_info.subsidy_amount', '补贴金额', item => item.subsidy_amount === null || item.subsidy_amount === undefined ? '' : parseFloat(item.subsidy_amount)],
    ['price_info.subsidy_rate', '补贴比例', item => item.subsidy_rate === null || item.subsidy_rate === undefined ? '' : `${parseFloat(item.subsidy_rate) || 0}%`],
    ['status_info.status', '当前状态', item => getSubsidyStatusLabel(item)],
    ['status_info.status', '申请状态', item => item.apply_status || ''],
    ['time_info.apply_time', '提交时间', item => item.apply_time || ''],
    ['time_info.arrival_time', '到账时间', item => item.arrival_time || ''],
    ['handler_info.has_different_handler', '代办理', item => item.has_different_handler ? '是' : '否'],
    ['handler_info.handler_name', '办理人姓名', item => item.handler_name || ''],
    ['handler_info.handler_phone', '办理人电话', item => item.handler_phone || ''],
    ['handler_info.handler_idcard', '办理人身份证', item => item.handler_idcard || ''],
    ['subsidy_info.subsidy_photos', '照片数量', item => {
      let subsidyPhotos = []
      if (item.subsidy_photos) {
        try {
          subsidyPhotos = typeof item.subsidy_photos === 'string'
            ? JSON.parse(item.subsidy_photos)
            : item.subsidy_photos
        } catch (_error) {
          subsidyPhotos = []
        }
      }
      return Array.isArray(subsidyPhotos) ? subsidyPhotos.length : 0
    }],
    ['other_info.remarks', '备注', item => item.remarks || '']
  ]
  const visibleColumns = exportColumns.filter(([fieldId]) => !hiddenFields.has(fieldId))
  const rows = items.map(item => {
    return Object.fromEntries(visibleColumns.map(([, label, getValue]) => [label, getValue(item)]))
  })

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: visibleColumns.map(([, label]) => label)
  })
  const workbook = XLSX.utils.book_new()
  const beijingDate = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).replace(/\//g, '-')

  XLSX.utils.book_append_sheet(workbook, worksheet, '国补管理')

  return {
    filename: `国补管理_${beijingDate}.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    total: rows.length
  }
}

module.exports = buildSubsidyExportFile
