'use strict'

const { parseInput } = require('../middleware/validation')

// 现场维修兼容未关联库存的历史设备编码，仅约束文本类型、长度及控制字符。
const parseRepairInput = (body, { create = false } = {}) => parseInput(body, {
  customer_id: { type: 'id', required: create || body?.customer_id !== undefined, message: '请填写客户、手机型号和故障描述' },
  ...Object.fromEntries(['brand_id', 'color_id', 'memory_id', 'phone_id', 'technician_id'].map(field => [field, {
    type: 'id', label: field, ...(field === 'technician_id' ? { message: '维修员编号无效' } : {})
  }])),
  phone_model: { type: 'string', required: create || body?.phone_model !== undefined, minLength: 1, maxLength: 100, label: '手机型号' },
  problem_description: { type: 'string', required: create || body?.problem_description !== undefined, minLength: 1, maxLength: 1000, multiline: true, label: '故障描述' },
  imei: { type: 'string', maxLength: 100, label: '设备IMEI' },
  serial_number: { type: 'string', maxLength: 100, label: '设备序列号' },
  remarks: { type: 'string', maxLength: 1000, multiline: true, label: '备注' },
  actual_cost: { type: 'money', min: 0, required: body?.actual_cost !== undefined, label: '维修费' },
  repair_time: { type: 'string', required: !create && body?.repair_time !== undefined, maxLength: 19, pattern: '^\\d{4}-\\d{2}-\\d{2}(?:[ T]\\d{2}:\\d{2}(?::\\d{2})?)?$', message: '维修时间格式不正确' }
})

module.exports = { parseRepairInput }
