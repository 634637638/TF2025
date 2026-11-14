import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useForm, ValidationRules as rules } from '@/composables/forms/useForm'
import { isValidAmount, isValidMobilePhone, normalizePhoneDigits, normalizePersonName, normalizeAppleId, normalizeIdCard, isValidAppleAccount, isValidIdCard } from '@/utils/security'

afterEach(() => vi.useRealTimers())

describe('公共字段格式与类型', () => {
  it.each(['12abc', '12元', '1e3', '0x10', 'NaN', 'Infinity', '12\n', ' ', true, false, [], [12], {}, Infinity, NaN])('拒绝非十进制输入 %j', value => {
    expect(rules.number().validator(value)).toBe(false)
    expect(rules.positiveNumber().validator(value)).toBe(false)
    expect(rules.positiveInteger().validator(value)).toBe(false)
    expect(rules.range(-100, 100).validator(value)).toBe(false)
  })
  it.each([0, -2, '12.02', '.02', '-0.02'])('接受完整十进制 %j', value => {
    expect(rules.number().validator(value)).toBe(true)
    expect(rules.range(-100, 100).validator(value)).toBe(true)
  })
  it('可选空值、必填零值和协议布尔值保持各自语义', () => {
    for (const value of [null, undefined, '']) {
      expect(rules.number().validator(value)).toBe(true)
      expect(rules.required().validator(value)).toBe(false)
    }
    expect(rules.required().validator('   ')).toBe(false)
    expect(rules.required().validator(0)).toBe(true)
    expect(rules.required().validator(false)).toBe(true)
    expect(rules.enum([true]).validator(false)).toBe(false)
    expect(rules.enum([true]).validator(true)).toBe(true)
    expect(rules.positiveInteger().validator('9007199254740992')).toBe(false)
    expect(rules.positiveInteger().validator('12.0')).toBe(false)
    expect(rules.positiveInteger().validator('12')).toBe(true)
  })
  it('金额不进行部分解析，保留既有非负上限与精度契约', () => {
    for (const value of ['12abc', '1e3', '0x10', '12.001', '-1', '1000000000', '12\n']) expect(isValidAmount(value)).toBe(false)
    for (const value of [0, '12.02', '999999999.99']) expect(isValidAmount(value)).toBe(true)
  })
  it.each(['13800138000', '+86 138-0013-8000', '0086 13800138000', '8613800138000'])('手机号仅标准化约定格式 %s', value => {
    expect(normalizePhoneDigits(value)).toBe('13800138000')
    expect(isValidMobilePhone(value)).toBe(true)
    expect(rules.phone().validator(value)).toBe(true)
  })
  it.each(['138a00138000', '138中00138000', '138001380001', '13800138000\n', '１３８００１３８０００', 13800138000, ['13800138000']])('手机号不删除非法内容或截断 %j', value => {
    expect(rules.phone().validator(value)).toBe(false)
  })
  it('保留合法姓名与错误原文，拒绝超长/控制字符而非洗白', () => {
    expect(normalizePersonName("  阿不都·O'Connor  Test123  ")).toBe("阿不都·O'Connor Test123")
    expect(rules.personName().validator("阿不都·O'Connor")).toBe(true)
    for (const value of ['张\n三', '\t张三', '张'.repeat(51), '123!', {}]) expect(rules.personName().validator(value)).toBe(false)
    expect(normalizeAppleId('ABC中@example.com')).toBe('abc中@example.com')
    expect(isValidAppleAccount('abc@example.com!')).toBe(false)
    expect(normalizeIdCard('11010519491231002x!')).toBe('11010519491231002x!')
    expect(isValidIdCard('11010519491231002X!')).toBe(false)
    expect(rules.singleLine().validator('姓名\n')).toBe(false)
  })
  it('全局正则重复验证不受 lastIndex 影响；URL 限定协议', () => {
    const rule = rules.pattern(/^A$/g)
    expect(rule.validator('A')).toBe(true)
    expect(rule.validator('A')).toBe(true)
    expect(rules.url().validator('javascript:alert(1)')).toBe(false)
    expect(rules.url().validator('https://example.com')).toBe(true)
  })
})

describe('真实表单验证与生命周期', () => {
  it('确认密码和日期范围收到完整表单；非法提交没有业务副作用', async () => {
    const scope = effectScope(), save = vi.fn()
    const form = scope.run(() => useForm({
      initialValues: { password: 'abc123', confirm: 'abc124', start: '2026-11-13', end: '2026-11-12', agreed: false },
      validationRules: { confirm: [rules.confirmPassword('password')], end: [rules.dateRange('start')], agreed: [rules.enum([true])] },
      onSubmit: save
    }))!
    await expect(form.submit()).rejects.toThrow('表单验证失败')
    expect(save).not.toHaveBeenCalled()
    expect(Object.keys(form.form.errors)).toEqual(expect.arrayContaining(['confirm', 'end', 'agreed']))
    form.setFieldsValue({ confirm: 'abc123', end: '2026-11-13', agreed: true })
    await form.submit()
    expect(save).toHaveBeenCalledTimes(1)
    scope.stop()
  })
  it('兼容 Element 表单回调与跨字段 source 参数', () => {
    const callback = vi.fn()
    rules.confirmPassword('password').validator({}, 'abc123', callback, { password: 'abc123' })
    expect(callback).toHaveBeenLastCalledWith(undefined)
    rules.confirmPassword('password').validator({}, 'wrong', callback, { password: 'abc123' })
    expect(callback).toHaveBeenLastCalledWith(expect.any(Error))
  })
  it('卸载后取消防抖验证', () => {
    vi.useFakeTimers()
    const scope = effectScope(), validator = vi.fn(() => true)
    const form = scope.run(() => useForm({ initialValues: { text: '' }, validationRules: { text: [{ validator }] }, validateTrigger: 'change', debounce: 50 }))!
    form.setFieldValue('text', '新值')
    scope.stop()
    vi.runAllTimers()
    expect(validator).not.toHaveBeenCalled()
  })
})
