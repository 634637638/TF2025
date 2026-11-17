/** 配件SN输入与扫码共用校验；保留前导零及厂商前缀，不采用手机IMEI规则。 */
export const normalizeAccessorySerial = (value: string): string => value.trim().toUpperCase()
export const isValidAccessorySerial = (value: string): boolean => /^[A-Z0-9][A-Z0-9._/-]{0,99}$/.test(value)

/** 商品条码允许可打印 ASCII；保留大小写、符号及前导零，不套用 SN 归一化。 */
export const isValidProductCode = (value: string): boolean => /^[\x20-\x7E]{1,100}$/.test(value) && Boolean(value.trim())
