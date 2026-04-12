/**
 * 表单 Composable
 * 提供统一的表单状态管理和验证功能
 */

import { reactive, watch } from 'vue'
import type { AsyncState } from '../types'
import { isValidAppleAccount, isValidEmail, isValidIdCard, isValidMobilePhone } from '@/utils/security'
import { logger } from '@/utils/logger'

/**
 * 表单字段验证规则
 */
export interface ValidationRule {
  /**
   * 验证函数
   */
  validator: (...args: any[]) => boolean | string | void
  /**
   * 错误消息
   */
  message?: string
  /**
   * 是否立即验证
   */
  immediate?: boolean
  /**
   * 触发方式
   */
  trigger?: 'change' | 'blur' | 'submit'
}

type ValidationFormValues = Record<string, any> | undefined

const resolveValidationContext = (args: any[]): {
  value: any
  formValues: ValidationFormValues
  callback?: (error?: Error) => void
} => {
  if (args.length >= 3 && typeof args[2] === 'function') {
    const [, value, callback, source] = args
    return {
      value,
      formValues: source as ValidationFormValues,
      callback: callback as (error?: Error) => void
    }
  }

  const [value, formValues] = args
  return {
    value,
    formValues: formValues as ValidationFormValues
  }
}

const createValidationRule = (
  validator: (value: any, formValues?: ValidationFormValues) => boolean,
  message?: string
): ValidationRule => ({
  validator: (...args: any[]) => {
    const { value, formValues, callback } = resolveValidationContext(args)
    const valid = validator(value, formValues)

    if (callback) {
      callback(valid ? undefined : new Error(message || '字段校验失败'))
      return
    }

    return valid
  },
  message
})

/**
 * 表单字段配置
 */
export interface FormFieldConfig {
  /**
   * 字段值
   */
  value: any
  /**
   * 验证规则
   */
  rules?: ValidationRule[]
  /**
   * 是否必填
   */
  required?: boolean
  /**
   * 默认值
   */
  default?: any
  /**
   * 转换函数
   */
  transform?: (value: any) => any
}

/**
 * 表单配置
 */
export interface UseFormOptions<T extends Record<string, any>> {
  /**
   * 初始值
   */
  initialValues: T
  /**
   * 验证规则
   */
  validationRules?: Partial<Record<keyof T, ValidationRule[]>>
  /**
   * 提交函数
   */
  onSubmit?: (values: T) => Promise<void>
  /**
   * 重置函数
   */
  onReset?: () => void
  /**
   * 验证触发方式
   */
  validateTrigger?: 'change' | 'blur' | 'submit' | 'all'
  /**
   * 是否立即验证
   */
  immediate?: boolean
  /**
   * 防抖延迟
   */
  debounce?: number
}

/**
 * 表单状态
 */
export interface FormState<T extends Record<string, any>> {
  /**
   * 表单值
   */
  values: T
  /**
   * 字段错误
   */
  errors: Partial<Record<keyof T, string>>
  /**
   * 字段是否被触摸
   */
  touched: Partial<Record<keyof T, boolean>>
  /**
   * 字段是否正在验证
   */
  validating: Partial<Record<keyof T, boolean>>
  /**
   * 表单是否有效
   */
  isValid: boolean
  /**
   * 是否有任何字段被触摸
   */
  isDirty: boolean
  /**
   * 是否正在提交
   */
  isSubmitting: boolean
}

type FormErrors<T extends Record<string, any>> = Partial<Record<keyof T, string>>
type FormTouched<T extends Record<string, any>> = Partial<Record<keyof T, boolean>>
type MutableFormValues<T extends Record<string, any>> = T

type MutableFormState<T extends Record<string, any>> = {
  values: T
  errors: FormErrors<T>
  touched: FormTouched<T>
  validating: FormTouched<T>
  isValid: boolean
  isDirty: boolean
  isSubmitting: boolean
}

/**
 * 表单返回值
 */
export interface UseFormReturn<T extends Record<string, any>> {
  /**
   * 表单状态
   */
  form: FormState<T>
  /**
   * 设置字段值
   */
  setFieldValue: (field: keyof T, value: any) => void
  /**
   * 设置多个字段值
   */
  setFieldsValue: (values: Partial<T>) => void
  /**
   * 获取字段值
   */
  getFieldValue: (field: keyof T) => any
  /**
   * 重置表单
   */
  reset: () => void
  /**
   * 重置字段
   */
  resetField: (field: keyof T) => void
  /**
   * 验证字段
   */
  validateField: (field: keyof T) => Promise<boolean>
  /**
   * 验证表单
   */
  validate: () => Promise<boolean>
  /**
   * 提交表单
   */
  submit: () => Promise<void>
  /**
   * 清除字段错误
   */
  clearFieldError: (field: keyof T) => void
  /**
   * 清除所有错误
   */
  clearErrors: () => void
  /**
   * 设置字段错误
   */
  setFieldError: (field: keyof T, error: string) => void
}

/**
 * 使用表单
 */
export function useForm<T extends Record<string, any>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const {
    initialValues,
    validationRules = {},
    onSubmit,
    onReset,
    validateTrigger = 'blur',
    immediate = false,
    debounce = 0
  } = options

  const rulesMap = validationRules as Partial<Record<keyof T, ValidationRule[]>>

  // 表单状态
  const form = reactive<MutableFormState<T>>({
    values: reactive({ ...initialValues }) as T,
    errors: reactive({}) as FormErrors<T>,
    touched: reactive({}) as FormTouched<T>,
    validating: reactive({}) as FormTouched<T>,
    isValid: true,
    isDirty: false,
    isSubmitting: false
  })

  // 防抖计时器
  const debounceTimers: Record<string, number> = {}

  // 验证单个字段
  const validateField = async (field: keyof T): Promise<boolean> => {
    const rules = rulesMap[field]
    if (!rules || rules.length === 0) {
      return true
    }

    const values = form.values as T
    const errors = form.errors as FormErrors<T>
    const validating = form.validating as FormTouched<T>
    const value = values[field]
    validating[field] = true

    try {
      for (const rule of rules) {
        const result = rule.validator(value)
        if (result === false || typeof result === 'string') {
          errors[field] = typeof result === 'string' ? result : rule.message || '验证失败'
          return false
        }
      }

      // 验证通过
      delete errors[field]
      return true
    } catch (error) {
      logger.error('字段验证失败:', error)
      errors[field] = '验证出错'
      return false
    } finally {
      validating[field] = false
    }
  }

  // 验证整个表单
  const validate = async (): Promise<boolean> => {
    const fields = Object.keys(validationRules) as Array<keyof T>
    const results = await Promise.all(fields.map(field => validateField(field)))
    return results.every(result => result)
  }

  // 设置字段值
  const setFieldValue = (field: keyof T, value: any) => {
    const values = form.values as T
    const errors = form.errors as FormErrors<T>
    const touched = form.touched as FormTouched<T>
    const oldValue = values[field]
    values[field] = value
    touched[field] = true

    // 检查是否有变化
    if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
      form.isDirty = true
    }

    // 清除该字段的错误
    if (errors[field]) {
      delete errors[field]
    }

    // 根据触发方式验证
    if (validateTrigger === 'change' || validateTrigger === 'all') {
      if (debounce > 0) {
        if (debounceTimers[String(field)]) {
          clearTimeout(debounceTimers[String(field)])
        }
        debounceTimers[String(field)] = window.setTimeout(() => {
          validateField(field)
        }, debounce)
      } else {
        validateField(field)
      }
    }
  }

  // 设置多个字段值
  const setFieldsValue = (values: Partial<T>) => {
    Object.entries(values).forEach(([field, value]) => {
      setFieldValue(field as keyof T, value)
    })
  }

  // 获取字段值
  const getFieldValue = (field: keyof T): any => {
    const values = form.values as T
    return values[field]
  }

  // 重置字段
  const resetField = (field: keyof T) => {
    const values = form.values as MutableFormValues<T>
    const errors = form.errors as FormErrors<T>
    const touched = form.touched as FormTouched<T>
    const validating = form.validating as FormTouched<T>
    values[field] = initialValues[field]
    delete errors[field]
    delete touched[field]
    delete validating[field]
  }

  // 重置表单
  const reset = () => {
    const errors = form.errors as FormErrors<T>
    const touched = form.touched as FormTouched<T>
    const validating = form.validating as FormTouched<T>

    Object.assign(form.values, { ...initialValues })

    Object.keys(errors).forEach((key) => {
      delete errors[key as keyof T]
    })
    Object.keys(touched).forEach((key) => {
      delete touched[key as keyof T]
    })
    Object.keys(validating).forEach((key) => {
      delete validating[key as keyof T]
    })

    form.isDirty = false
    form.isSubmitting = false
    form.isValid = true

    // 清除所有防抖计时器
    Object.values(debounceTimers).forEach(timer => {
      clearTimeout(timer)
    })
    Object.keys(debounceTimers).forEach(key => {
      delete debounceTimers[key]
    })

    onReset?.()
  }

  // 清除字段错误
  const clearFieldError = (field: keyof T) => {
    const errors = form.errors as FormErrors<T>
    delete errors[field]
  }

  // 清除所有错误
  const clearErrors = () => {
    const errors = form.errors as FormErrors<T>
    Object.keys(errors).forEach((key) => {
      delete errors[key as keyof T]
    })
  }

  // 设置字段错误
  const setFieldError = (field: keyof T, error: string) => {
    const errors = form.errors as FormErrors<T>
    errors[field] = error
  }

  // 提交表单
  const submit = async (): Promise<void> => {
    if (form.isSubmitting) return

    try {
      form.isSubmitting = true

      // 验证所有字段
      const isValid = await validate()
      if (!isValid) {
        throw new Error('表单验证失败')
      }

      // 提交数据
      await onSubmit?.(form.values as T)
    } catch (error) {
      logger.error('表单提交失败:', error)
      throw error
    } finally {
      form.isSubmitting = false
    }
  }

  // 计算表单是否有效
  watch(
    () => form.errors,
    (errors) => {
      form.isValid = Object.keys(errors).length === 0
    },
    { deep: true, immediate: true }
  )

  // 立即验证
  if (immediate) {
    Object.keys(validationRules).forEach(field => {
      validateField(field as keyof T)
    })
  }

  return {
    form: form as FormState<T>,
    setFieldValue,
    setFieldsValue,
    getFieldValue,
    reset,
    resetField,
    validateField,
    validate,
    submit,
    clearFieldError,
    clearErrors,
    setFieldError
  }
}

/**
 * 常用验证规则
 *
 * 使用示例：
 * ```typescript
 * import { useForm, ValidationRules } from '@/composables'
 *
 * const { form, validate } = useForm({
 *   initialValues: { phone: '', password: '' },
 *   validationRules: {
 *     phone: [ValidationRules.required('请输入手机号'), ValidationRules.phone()],
 *     password: [ValidationRules.required('请输入密码'), ValidationRules.minLength(6, '密码至少6位')]
 *   }
 * })
 * ```
 */
export const ValidationRules = {
  /**
   * 必填验证
   * @param message 错误提示信息
   */
  required: (message = '此字段为必填项'): ValidationRule => createValidationRule((value) => {
      if (value === null || value === undefined || value === '') return false
      if (Array.isArray(value) && value.length === 0) return false
      return true
    }, message),

  /**
   * 邮箱验证
   * @param message 错误提示信息
   */
  email: (message = '请输入有效的邮箱地址'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      return isValidEmail(String(value).trim())
    }, message),

  /**
   * 手机号验证（中国大陆）
   * @param message 错误提示信息
   */
  phone: (message = '请输入正确的手机号'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      return isValidMobilePhone(String(value).trim())
    }, message),

  /**
   * Apple ID 账号验证
   * @param message 错误提示信息
   */
  appleAccount: (message = '请输入有效的 Apple ID 手机号或邮箱'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      return isValidAppleAccount(String(value).trim())
    }, message),

  /**
   * 身份证号验证
   * @param message 错误提示信息
   */
  idCard: (message = '请输入正确的身份证号'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      return isValidIdCard(String(value).trim())
    }, message),

  /**
   * 最小长度验证
   * @param min 最小长度
   * @param message 错误提示信息
   */
  minLength: (min: number, message?: string): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      return String(value).length >= min
    }, message || `最少${min}个字符`),

  /**
   * 最大长度验证
   * @param max 最大长度
   * @param message 错误提示信息
   */
  maxLength: (max: number, message?: string): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      return String(value).length <= max
    }, message || `最多${max}个字符`),

  /**
   * 数字验证
   * @param message 错误提示信息
   */
  number: (message = '请输入有效的数字'): ValidationRule => createValidationRule((value) => {
      if (!value && value !== 0) return true
      return !isNaN(Number(value))
    }, message),

  /**
   * 正整数验证
   * @param message 错误提示信息
   */
  positiveInteger: (message = '请输入有效的正整数'): ValidationRule => createValidationRule((value) => {
      if (!value && value !== 0) return true
      const num = Number(value)
      return Number.isInteger(num) && num > 0
    }, message),

  /**
   * 正数验证（大于0）
   * @param message 错误提示信息
   */
  positiveNumber: (message = '请输入大于0的数字'): ValidationRule => createValidationRule((value) => {
      if (!value && value !== 0) return true
      const num = Number(value)
      return !isNaN(num) && num > 0
    }, message),

  /**
   * 范围验证（数字）
   * @param min 最小值
   * @param max 最大值
   * @param message 错误提示信息
   */
  range: (min: number, max: number, message?: string): ValidationRule => createValidationRule((value) => {
      if (!value && value !== 0) return true
      const num = Number(value)
      if (isNaN(num)) return false
      return num >= min && num <= max
    }, message || `数值应在${min}到${max}之间`),

  /**
   * URL验证
   * @param message 错误提示信息
   */
  url: (message = '请输入有效的URL地址'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      try {
        new URL(String(value))
        return true
      } catch {
        return false
      }
    }, message),

  /**
   * 自定义正则验证
   * @param regex 正则表达式
   * @param message 错误提示信息
   */
  pattern: (regex: RegExp, message = '格式不正确'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      return regex.test(String(value))
    }, message),

  /**
   * 枚举值验证
   * @param values 允许的值列表
   * @param message 错误提示信息
   */
  enum: (values: any[], message?: string): ValidationRule => createValidationRule((value) => {
      if (!value && value !== 0) return true
      return values.includes(value)
    }, message || `值必须是以下之一: ${values.join(', ')}`),

  /**
   * 确认密码验证（需配合表单使用）
   * @param passwordField 密码字段名
   * @param message 错误提示信息
   */
  confirmPassword: (passwordField: string, message = '两次输入的密码不一致'): ValidationRule => createValidationRule((value, formValues) => {
      if (!value) return true
      const password = formValues?.[passwordField]
      return value === password
    }, message),

  /**
   * 中文姓名验证
   * @param message 错误提示信息
   */
  chineseName: (message = '请输入正确的中文姓名'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      // 2-20个中文字符
      const nameRegex = /^[\u4e00-\u9fa5]{2,20}$/
      return nameRegex.test(String(value).trim())
    }, message),

  /**
   * 银行卡号验证
   * @param message 错误提示信息
   */
  bankCard: (message = '请输入正确的银行卡号'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      // 16-19位数字
      const cardRegex = /^\d{16,19}$/
      return cardRegex.test(String(value).trim())
    }, message),

  /**
   * 微信号验证
   * @param message 错误提示信息
   */
  wechat: (message = '请输入正确的微信号'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      // 6-20位，字母开头，可包含字母、数字、下划线、减号
      const wechatRegex = /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/
      return wechatRegex.test(String(value).trim())
    }, message),

  /**
   * QQ号验证
   * @param message 错误提示信息
   */
  qq: (message = '请输入正确的QQ号'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      // 5-11位数字
      const qqRegex = /^\d{5,11}$/
      return qqRegex.test(String(value).trim())
    }, message),

  /**
   * 非空数组验证
   * @param message 错误提示信息
   */
  nonEmptyArray: (message = '至少选择一项'): ValidationRule => createValidationRule((value) => {
      return Array.isArray(value) && value.length > 0
    }, message),

  /**
   * 日期验证
   * @param message 错误提示信息
   */
  date: (message = '请选择有效的日期'): ValidationRule => createValidationRule((value) => {
      if (!value) return true
      const date = new Date(value)
      return !isNaN(date.getTime())
    }, message),

  /**
   * 日期范围验证
   * @param startDateField 开始日期字段名
   * @param message 错误提示信息
   */
  dateRange: (startDateField: string, message = '结束日期不能早于开始日期'): ValidationRule => createValidationRule((value, formValues) => {
      if (!value) return true
      const startDate = formValues?.[startDateField]
      if (!startDate) return true
      return new Date(value) >= new Date(startDate)
    }, message)
}
