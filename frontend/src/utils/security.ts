/**
 * 前端安全工具
 * 提供 XSS 防护和其他安全功能
 */

import DOMPurify from 'dompurify'
import { storage } from '@/services/storage'
import { logger } from '@/utils/logger'

// ============================================================================
// XSS 防护
// ============================================================================

/**
 * DOMPurify 配置
 */
const PURIFY_CONFIG = {
  // 允许的标签（根据需要调整）
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'span', 'div'],
  // 允许的属性
  ALLOWED_ATTR: ['href', 'title', 'class', 'id'],
  // 允许的 URI 协议
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
}

/**
 * 清理 HTML 字符串，防止 XSS 攻击
 * @param html - 要清理的 HTML 字符串
 * @param config - 可选的 DOMPurify 配置
 * @returns 清理后的安全 HTML
 */
export function sanitizeHtml(html: string, config = PURIFY_CONFIG): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  return DOMPurify.sanitize(html, config)
}

/**
 * 清理文本内容（移除所有 HTML 标签）
 * @param text - 要清理的文本
 * @returns 纯文本内容
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  // 创建临时元素来提取文本
  const temp = document.createElement('div')
  temp.textContent = text
  return temp.innerHTML
}

/**
 * 转义 HTML 特殊字符
 * @param str - 要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') {
    return ''
  }

  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }

  return str.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char)
}

// ============================================================================
// 输入验证
// ============================================================================

/**
 * 验证邮箱地址
 * @param email - 邮箱地址
 * @returns 是否有效
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return emailRegex.test(email) && email.length <= 254
}

const APPLE_ACCOUNT_PHONE_REGEX = /^(?:\+?86)?1[3-9]\d{9}$/

/**
 * 验证电话号码（中国大陆）
 * @param phone - 电话号码
 * @returns 是否有效
 */
export function normalizePhoneDigits(phone: unknown, maxLength = 11): string {
  return String(phone ?? '').replace(/\D/g, '').slice(0, maxLength)
}

/**
 * 规范化姓名
 * 只保留中文、英文和空格，并压缩多余空格
 * @param value - 原始姓名
 * @param maxLength - 最大长度
 * @returns 规范化后的姓名
 */
export function normalizePersonName(value: unknown, maxLength = 50): string {
  return String(value ?? '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/**
 * 规范化 Apple ID
 * 支持手机号或邮箱形式，保留常见账号字符并统一转为小写
 * @param value - 原始 Apple ID
 * @param maxLength - 最大长度
 * @returns 规范化后的 Apple ID
 */
export function normalizeAppleId(value: unknown, maxLength = 100): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9.!#$%&'*+/=?^_`{|}~@-]/g, '')
    .toLowerCase()
    .slice(0, maxLength)
}

/**
 * 验证 Apple ID 账号
 * 支持中国大陆手机号或邮箱格式
 * @param account - Apple ID 账号
 * @returns 是否有效
 */
export function isValidAppleAccount(account: string): boolean {
  if (!account || typeof account !== 'string') {
    return false
  }

  const normalizedAccount = normalizeAppleId(account)
  return isValidEmail(normalizedAccount) || APPLE_ACCOUNT_PHONE_REGEX.test(normalizedAccount)
}

/**
 * 从 Apple ID 中解析可兼容 email 字段的值
 * 只有邮箱型 Apple ID 才写入 email，手机号型返回 null
 * @param account - Apple ID 账号
 * @returns 邮箱值或 null
 */
export function resolveAppleAccountEmail(account: unknown): string | null {
  const normalizedAccount = normalizeAppleId(account)
  return isValidEmail(normalizedAccount) ? normalizedAccount : null
}

/**
 * 规范化身份证号
 * 去除空格并统一将校验位转换为大写 X
 * @param value - 原始身份证号
 * @param maxLength - 最大长度
 * @returns 规范化后的身份证号
 */
export function normalizeIdCard(value: unknown, maxLength = 18): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^0-9X]/g, '')
    .slice(0, maxLength)
}

/**
 * 验证中国大陆手机号码
 * @param phone - 手机号码
 * @returns 是否有效
 */
export function isValidMobilePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false
  }

  const mobileRegex = /^1[3-9]\d{9}$/
  return mobileRegex.test(normalizePhoneDigits(phone))
}

/**
 * 验证电话号码（中国大陆）
 * @param phone - 电话号码
 * @returns 是否有效
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false
  }

  const normalizedPhone = normalizePhoneDigits(phone)
  const landlineRegex = /^0\d{2,3}-?\d{7,8}$/
  return isValidMobilePhone(normalizedPhone) || landlineRegex.test(phone)
}

/**
 * 验证身份证号（中国大陆）
 * @param idCard - 身份证号
 * @returns 是否有效
 */
export function isValidIdCard(idCard: string): boolean {
  if (!idCard || typeof idCard !== 'string') {
    return false
  }

  const normalizedIdCard = normalizeIdCard(idCard)
  const idCardRegex18 = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$/
  const idCardRegex15 = /^[1-9]\d{7}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}$/

  if (normalizedIdCard.length === 15) {
    return idCardRegex15.test(normalizedIdCard)
  }

  if (!idCardRegex18.test(normalizedIdCard)) {
    return false
  }

  // 18位身份证校验码验证
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(normalizedIdCard[i], 10) * weights[i]
  }

  const checkCode = checkCodes[sum % 11]
  return normalizedIdCard[17] === checkCode
}

/**
 * 验证金额
 * @param amount - 金额
 * @returns 是否有效
 */
export function isValidAmount(amount: string | number): boolean {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) {
    return false
  }
  return num >= 0 && num <= 999999999.99 && /^\d+(\.\d{1,2})?$/.test(String(num))
}

/**
 * 验证 URL
 * @param url - URL 字符串
 * @returns 是否有效
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const parsed = new URL(url)
    // 只允许 http 和 https 协议
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

// ============================================================================
// 文件安全
// ============================================================================

/**
 * 允许的文件扩展名白名单
 */
const ALLOWED_FILE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx'
]

/**
 * 允许的 MIME 类型白名单
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]

/**
 * 验证文件扩展名
 * @param filename - 文件名
 * @returns 是否有效
 */
export function isValidFileExtension(filename: string): boolean {
  if (!filename || typeof filename !== 'string') {
    return false
  }

  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return ALLOWED_FILE_EXTENSIONS.includes(ext)
}

/**
 * 验证 MIME 类型
 * @param mimeType - MIME 类型
 * @returns 是否有效
 */
export function isValidMimeType(mimeType: string): boolean {
  if (!mimeType || typeof mimeType !== 'string') {
    return false
  }
  return ALLOWED_MIME_TYPES.includes(mimeType)
}

/**
 * 验证文件大小
 * @param size - 文件大小（字节）
 * @param maxSize - 最大允许大小（字节，默认 5MB）
 * @returns 是否有效
 */
export function isValidFileSize(size: number, maxSize = 5 * 1024 * 1024): boolean {
  const num = parseInt(String(size), 10)
  return !isNaN(num) && num > 0 && num <= maxSize
}

// ============================================================================
// 密码安全
// ============================================================================

/**
 * 密码强度评估结果
 */
export interface PasswordStrength {
  valid: boolean
  errors: string[]
  strength: 'weak' | 'medium' | 'strong'
}

/**
 * 验证密码强度
 * @param password - 密码
 * @returns 验证结果
 */
export function validatePassword(password: string): PasswordStrength {
  const result: PasswordStrength = {
    valid: true,
    errors: [],
    strength: 'weak'
  }

  if (!password) {
    result.valid = false
    result.errors.push('密码不能为空')
    return result
  }

  if (password.length < 8) {
    result.valid = false
    result.errors.push('密码长度至少为8位')
  }

  if (password.length > 128) {
    result.valid = false
    result.errors.push('密码长度不能超过128位')
  }

  // 计算密码强度
  let strength = 0
  if (password.length >= 8) strength++
  if (password.length >= 12) strength++
  if (/[a-z]/.test(password)) strength++
  if (/[A-Z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++
  if (/[^a-zA-Z0-9]/.test(password)) strength++

  if (strength <= 2) result.strength = 'weak'
  else if (strength <= 4) result.strength = 'medium'
  else result.strength = 'strong'

  return result
}

// ============================================================================
// Token 安全
// ============================================================================

/**
 * 从 localStorage 安全地获取 Token
 * @param key - 存储键
 * @returns Token 值
 */
export function getToken(key: string): string | null {
  try {
    return storage.get<string>(key, 'local')
  } catch {
    return null
  }
}

/**
 * 安全地设置 Token 到 localStorage
 * @param key - 存储键
 * @param value - Token 值
 */
export function setToken(key: string, value: string): void {
  try {
    storage.set(key, value, 'local')
  } catch (error) {
    logger.error('无法设置 token:', error)
  }
}

/**
 * 从 localStorage 安全地移除 Token
 * @param key - 存储键
 */
export function removeToken(key: string): void {
  try {
    storage.remove(key, 'local')
  } catch (error) {
    logger.error('无法移除 token:', error)
  }
}

/**
 * 清空所有认证数据
 */
export function clearAuthData(): void {
  try {
    storage.clearAuth()
  } catch (error) {
    logger.error('无法清空认证数据:', error)
  }
}

// ============================================================================
// 内容安全策略 (CSP) 违规报告
// ============================================================================

/**
 * 初始化 CSP 违规报告监听
 */
export function initCSPReporting(): void {
  if (typeof document === 'undefined') {
    return
  }

  document.addEventListener('securitypolicyviolation', (event) => {
    logger.warn('CSP 违规:', {
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
      blockedURI: event.blockedURI,
      originalURI: event.originalPolicy,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
      columnNumber: event.columnNumber
    })

    // 这里可以发送到服务器进行记录和分析
    // reportSecurityViolation(event)
  })
}

// ============================================================================
// 安全指令
// ============================================================================

/**
 * Vue 自定义指令：v-sanitize
 * 自动清理 v-html 绑定的内容
 */
export const vSanitize = {
  mounted(el: HTMLElement, binding: { value: string }) {
    el.innerHTML = sanitizeHtml(binding.value)
  },
  updated(el: HTMLElement, binding: { value: string }) {
    el.innerHTML = sanitizeHtml(binding.value)
  }
}

/**
 * Vue 自定义指令：v-escape-html
 * 转义 HTML 特殊字符
 */
export const vEscapeHtml = {
  mounted(el: HTMLElement, binding: { value: string }) {
    el.textContent = binding.value
  },
  updated(el: HTMLElement, binding: { value: string }) {
    el.textContent = binding.value
  }
}

// ============================================================================
// 导出
// ============================================================================

export default {
  // XSS 防护
  sanitizeHtml,
  sanitizeText,
  escapeHtml,

  // 输入验证
  isValidEmail,
  isValidPhone,
  isValidIdCard,
  isValidAppleAccount,
  normalizePhoneDigits,
  normalizePersonName,
  normalizeAppleId,
  normalizeIdCard,
  resolveAppleAccountEmail,
  isValidAmount,
  isValidUrl,

  // 文件安全
  isValidFileExtension,
  isValidMimeType,
  isValidFileSize,

  // 密码安全
  validatePassword,

  // Token 安全
  getToken,
  setToken,
  removeToken,
  clearAuthData,

  // CSP
  initCSPReporting,

  // 自定义指令
  vSanitize,
  vEscapeHtml
}
