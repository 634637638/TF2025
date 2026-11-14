'use strict'

const { parseInput } = require('../middleware/validation')

const parseAccountInput = (data, { required = false, requireName = required, allowEmptyName = false, allowEmptyPassword = false } = {}) => parseInput(data, {
  username: { type: 'string', required: required || data?.username !== undefined, minLength: 1, maxLength: 50, label: '用户名' },
  name: { type: 'personName', required: requireName || (!allowEmptyName && data?.name !== undefined), maxLength: 50, label: '姓名' },
  password: { type: 'string', required: required || (!allowEmptyPassword && data?.password !== undefined), label: '密码' },
  phone: { type: 'phone', label: '手机号' },
  email: { type: 'email', label: '邮箱' },
  store_id: { type: 'id', label: '门店' },
  salary_template_id: { type: 'id', label: '工资模板' },
  status: { type: 'number', integer: true, min: 0, max: 1, required: data?.status !== undefined, label: '状态' },
  hire_date: { type: 'string', maxLength: 10, pattern: '^$|^\\d{4}-\\d{2}-\\d{2}$', label: '入职日期' }
})

module.exports = { parseAccountInput }
