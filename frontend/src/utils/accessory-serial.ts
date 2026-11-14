/** 配件SN输入与扫码共用校验；保留前导零及厂商前缀，不采用手机IMEI规则。 */
export const normalizeAccessorySerial = (value: string): string => value.trim().toUpperCase()
export const isValidAccessorySerial = (value: string): boolean => /^[A-Z0-9][A-Z0-9._/-]{0,99}$/.test(value)
