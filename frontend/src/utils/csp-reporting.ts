import { logger } from '@/utils/logger'

/** 注册全局 CSP 违规监听，不引入完整安全输入工具，避免首屏加载净化器。 */
export function initCSPReporting(): void {
  if (typeof document === 'undefined') return

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
  })
}
