/** 手机扫描需要品牌上下文；配件序列号与商品编码显式使用各自解析档位。 */
export function hasValidScannerContext(tag) {
  if (/(?:^|\s)serial-profile\s*=\s*(['"])(?:accessory|product)\1/.test(tag)) {
    return /(?:^|\s)scan-type\s*=\s*(['"])serial\1/.test(tag)
  }
  return /:phone\s*=/.test(tag)
}
