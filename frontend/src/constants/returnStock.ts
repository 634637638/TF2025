import options from '../../../backend/src/config/return-stock-options.json'

/** 退库是撤销交易；处理方式记录后续意向，不分支执行维修、换货或报废。 */
export const RETURN_STOCK_OPTIONS = options

export const RETURN_STOCK_SELECT_FIELDS = [
  { field: 'return_reason', label: '退库原因', permission: 'record.return_reason' },
  { field: 'return_type', label: '退库类型', permission: 'record.return_type' },
  { field: 'handle_method', label: '处理方式', permission: 'record.handle_method' }
] as const
