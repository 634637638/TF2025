/** 手机扫描需要品牌上下文；配件序列号显式使用独立解析档位。 */
export function hasValidScannerContext(tag) {
  if (/(?:^|\s)serial-profile\s*=\s*(['"])accessory\1/.test(tag)) {
    return /(?:^|\s)scan-type\s*=\s*(['"])serial\1/.test(tag)
  }
  return /:phone\s*=/.test(tag)
}
