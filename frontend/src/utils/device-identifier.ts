import { phoneSerial, imei } from '../../../backend/src/config/input-validation.json'

// 字符集和长度与服务端、导入共用；不删除非法字符或截断原文。
export const deviceSerialPattern = new RegExp(phoneSerial, 'i')
export const deviceIMEIPattern = new RegExp(imei)
export const isDeviceSerial = (value: unknown): value is string => typeof value === 'string' && deviceSerialPattern.test(value)
export const isDeviceIMEI = (value: unknown): value is string => typeof value === 'string' && deviceIMEIPattern.test(value)
export const normalizeDeviceSerial = (value: string | undefined): string => value?.toUpperCase() ?? ''
export const normalizeDeviceIMEI = (value: string | undefined, isNoIMEIMode: boolean | undefined): string => (
  isNoIMEIMode ? normalizeDeviceSerial(value) : value ?? ''
)
