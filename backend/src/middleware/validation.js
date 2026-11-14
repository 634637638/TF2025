// 输入验证中间件
const validator = require('validator')
const inputPatterns = require('../config/input-validation.json')
const { isEmptyInput, isDecimalInput, isIntegerInput, isMoneyInput, isPersonName, normalizePhone, isMobilePhone } = require('../utils/input-values')

// 自定义验证规则
const validationRules = {
  // 字符串验证
  string: (value, options = {}) => {
    const {
      required = false,
      minLength = 0,
      maxLength = 1000,
      pattern = null,
      sanitize = false,
      multiline = false
    } = options

    if (value === undefined || value === null) {
      if (required) {
        return { valid: false, message: '该字段为必填项' }
      }
      return { valid: true, value: '' }
    }

    if (typeof value !== 'string') return { valid: false, message: '必须是字符串' }
    if (required && !value.trim()) return { valid: false, message: '该字段为必填项' }
    const controls = new RegExp(multiline ? inputPatterns.multilineControls : inputPatterns.singleLineControls)
    if (controls.test(value)) return { valid: false, message: '包含不允许的控制字符' }
    let stringValue = value

    // 清理输入
    if (sanitize) {
      stringValue = validator.escape(stringValue)
    }

    // 长度验证
    if (stringValue.length < minLength) {
      return { valid: false, message: `长度不能少于${minLength}个字符` }
    }

    if (stringValue.length > maxLength) {
      return { valid: false, message: `长度不能超过${maxLength}个字符` }
    }

    // 模式验证
    if (pattern && !new RegExp(pattern).test(stringValue)) {
      return { valid: false, message: '格式不正确' }
    }

    return { valid: true, value: stringValue }
  },

  // 数字验证
  number: (value, options = {}) => {
    const {
      required = false,
      min = Number.MIN_SAFE_INTEGER,
      max = Number.MAX_SAFE_INTEGER,
      integer = false
    } = options

    if (isEmptyInput(value)) {
      if (required) {
        return { valid: false, message: '该字段为必填项' }
      }
      return { valid: true, value: null }
    }

    if (!isDecimalInput(value)) {
      return { valid: false, message: '必须是有效数字' }
    }
    const numValue = Number(value)

    if (integer && !isIntegerInput(value)) {
      return { valid: false, message: '必须是安全整数' }
    }

    if (numValue < min) {
      return { valid: false, message: `数值不能小于${min}` }
    }

    if (numValue > max) {
      return { valid: false, message: `数值不能大于${max}` }
    }

    return { valid: true, value: numValue }
  },

  money: (value, options = {}) => {
    const result = validationRules.number(value, options)
    if (!result.valid || result.value === null) return result
    return isMoneyInput(value) ? result : { valid: false, message: '金额最多两位小数' }
  },

  boolean: (value, { required = false } = {}) => {
    if (isEmptyInput(value)) return required ? { valid: false, message: '该字段为必填项' } : { valid: true, value: null }
    if (![true, false, 0, 1, '0', '1'].includes(value)) return { valid: false, message: '必须是有效布尔值' }
    return { valid: true, value: value === true || value === 1 || value === '1' }
  },

  personName: (value, options = {}) => {
    const result = validationRules.string(value, options)
    if (!result.valid || (isEmptyInput(value) && !options.required)) return result
    return isPersonName(value, options.maxLength ?? 50) ? result : { valid: false, message: '姓名格式不正确' }
  },

  // 邮箱验证
  email: (value, options = {}) => {
    const { required = false } = options

    if (value === undefined || value === null || value === '') {
      if (required) {
        return { valid: false, message: '邮箱为必填项' }
      }
      return { valid: true, value: null }
    }

    if (typeof value !== 'string' || new RegExp(inputPatterns.singleLineControls).test(value)) return { valid: false, message: '邮箱须为单行文本' }
    const emailValue = value.toLowerCase().trim()

    if (!validator.isEmail(emailValue)) {
      return { valid: false, message: '邮箱格式不正确' }
    }

    return { valid: true, value: emailValue }
  },

  // 手机号验证
  phone: (value, options = {}) => {
    const { required = false } = options

    if (value === undefined || value === null || value === '') {
      if (required) {
        return { valid: false, message: '手机号为必填项' }
      }
      return { valid: true, value: null }
    }

    const phoneValue = normalizePhone(value)

    // 中国手机号验证
    if (!isMobilePhone(value)) {
      return { valid: false, message: '手机号格式不正确' }
    }

    return { valid: true, value: phoneValue }
  },

  // ID验证（正整数）
  id: (value, options = {}) => {
    const result = validationRules.number(value, {
      ...options,
      required: options.required ?? true,
      min: 1,
      integer: true
    })

    if (!result.valid) {
      return { valid: false, message: 'ID必须是正整数' }
    }

    return result
  },

  // 枚举值验证
  enum: (value, allowedValues, options = {}) => {
    const { required = false } = options

    if (value === undefined || value === null || value === '') {
      if (required) {
        return { valid: false, message: '该字段为必填项' }
      }
      return { valid: true, value: null }
    }

    if (!Array.isArray(allowedValues)) {
      throw new Error('allowedValues必须是数组')
    }

    if (typeof value !== 'string') return { valid: false, message: '枚举值必须是字符串' }
    const stringValue = value

    if (!allowedValues.includes(stringValue)) {
      return {
        valid: false,
        message: `值必须是以下之一: ${allowedValues.join(', ')}`
      }
    }

    return { valid: true, value: stringValue }
  },

  // 数组验证
  array: (value, options = {}) => {
    const {
      required = false,
      minItems = 0,
      maxItems = 100,
      itemType = null
    } = options

    if (value === undefined || value === null) {
      if (required) {
        return { valid: false, message: '该字段为必填项' }
      }
      return { valid: true, value: [] }
    }

    if (!Array.isArray(value)) {
      return { valid: false, message: '必须是数组' }
    }

    if (value.length < minItems) {
      return { valid: false, message: `至少需要${minItems}项` }
    }

    if (value.length > maxItems) {
      return { valid: false, message: `最多只能有${maxItems}项` }
    }

    // 验证数组项类型
    if (itemType) {
      for (let i = 0; i < value.length; i++) {
        const itemResult = validationRules[itemType](value[i], { required: true })
        if (!itemResult.valid) {
          return {
            valid: false,
            message: `第${i + 1}项${itemResult.message}`
          }
        }
      }
    }

    return { valid: true, value }
  },

  // 对象验证
  object: (value, schema, options = {}) => {
    const { required = false } = options

    if (value === undefined || value === null) {
      if (required) {
        return { valid: false, message: '该字段为必填项' }
      }
      return { valid: true, value: {} }
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      return { valid: false, message: '必须是对象' }
    }

    const result = {}
    const errors = []

    // 验证schema中的每个字段
    for (const [field, rules] of Object.entries(schema)) {
      const fieldValue = value[field]
      const fieldResult = validateField(fieldValue, rules)

      if (!fieldResult.valid) {
        errors.push(`${field}: ${fieldResult.message}`)
      } else {
        result[field] = fieldResult.value
      }
    }

    if (errors.length > 0) {
      return { valid: false, message: errors.join('; ') }
    }

    return { valid: true, value: result }
  }
}

// 验证单个字段
function validateField(value, rules) {
  const { type, required, ...options } = rules

  if (Array.isArray(type)) {
    return validationRules.enum(value, type, { required })
  }

  if (typeof type === 'object' && type !== null) {
    return validationRules.object(value, type, { required })
  }

  if (typeof validationRules[type] === 'function') {
    return validationRules[type](value, { required, ...options })
  }

  throw new Error(`不支持的验证类型: ${type}`)
}

// Service 直接调用时仍走同一规则；只转换已声明且实际提交的字段，不制造默认值或移除权限检查需要的字段。
function parseInput(value, schema, { partial = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('输入必须为对象'), { statusCode: 400, code: 'VALIDATION_ERROR' })
  }
  const result = { ...value }
  for (const [field, rules] of Object.entries(schema)) {
    if (value[field] === undefined && (partial || !rules.required)) continue
    const fieldResult = validateField(value[field], { ...rules, required: rules.required ?? false })
    if (!fieldResult.valid) {
      throw Object.assign(new Error(rules.message || `${rules.label || field}：${fieldResult.message}`), { statusCode: 400, code: 'VALIDATION_ERROR' })
    }
    result[field] = fieldResult.value
  }
  return result
}

// 验证中间件生成器
function validateBody(schema) {
  return (req, res, next) => {
    const result = validationRules.object(req.body, schema)

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        error: result.message,
        code: 'VALIDATION_ERROR'
      })
    }

    // 将验证后的数据替换原始数据
    req.body = result.value
    next()
  }
}

// 验证查询参数中间件生成器
function validateQuery(schema) {
  return (req, res, next) => {
    const result = validationRules.object(req.query, schema)

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: '查询参数验证失败',
        error: result.message,
        code: 'VALIDATION_ERROR'
      })
    }

    // 将验证后的数据替换原始数据
    req.query = result.value
    next()
  }
}

// 验证路径参数中间件生成器
function validateParams(schema) {
  return (req, res, next) => {
    const result = validationRules.object(req.params, schema)

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: '路径参数验证失败',
        error: result.message,
        code: 'VALIDATION_ERROR'
      })
    }

    // 将验证后的数据替换原始数据
    req.params = result.value
    next()
  }
}

// 通用验证中间件
function validate(schema, _options = {}) {
  const { body = {}, query = {}, params = {} } = schema

  return (req, res, next) => {
    const errors = []
    const validatedData = {}

    // 验证body
    if (Object.keys(body).length > 0) {
      const bodyResult = validationRules.object(req.body, body)
      if (!bodyResult.valid) {
        errors.push(`Body: ${bodyResult.message}`)
      } else {
        validatedData.body = bodyResult.value
      }
    }

    // 验证query
    if (Object.keys(query).length > 0) {
      const queryResult = validationRules.object(req.query, query)
      if (!queryResult.valid) {
        errors.push(`Query: ${queryResult.message}`)
      } else {
        validatedData.query = queryResult.value
      }
    }

    // 验证params
    if (Object.keys(params).length > 0) {
      const paramsResult = validationRules.object(req.params, params)
      if (!paramsResult.valid) {
        errors.push(`Params: ${paramsResult.message}`)
      } else {
        validatedData.params = paramsResult.value
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors,
        code: 'VALIDATION_ERROR'
      })
    }

    // 应用验证后的数据
    if (validatedData.body) req.body = validatedData.body
    if (validatedData.query) req.query = validatedData.query
    if (validatedData.params) req.params = validatedData.params

    next()
  }
}

module.exports = {
  parseInput,
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validationRules
}
