export type DeviceScanType = 'imei' | 'serial'

export interface DeviceScanParseResult {
  value: string | null
  error: string | null
}

export interface DeviceScanParseOptions {
  appleSerialBarcode?: boolean
}

const normalizeRawScanText = (rawText: string): string => rawText
  .normalize('NFKC')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  // Remove AIM symbology identifiers returned by some mobile barcode APIs:
  // ]C0/]C1 (Code 128), ]d2 (Data Matrix), ]Q3 (QR), etc.
  .replace(/^\](?:C[0-3]|d[12]|Q[0-9]|A[0-9])/, '')
  .replace(/[\x1D\x1E\x1F]/g, '')
  .trim()

export const isValidIMEIChecksum = (imei: string): boolean => {
  if (!/^\d{15}$/.test(imei)) return false

  let sum = 0
  for (let index = 0; index < imei.length; index += 1) {
    let digit = Number(imei[index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }

  return sum % 10 === 0
}

const toIMEICandidate = (value: string): string => value.replace(/\D/g, '')

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))]

const extractIMEIsByLabel = (rawText: string, labelPattern: string): string[] => {
  const candidates: string[] = []
  const pattern = new RegExp(`${labelPattern}\\s*[:：#=]?\\s*((?:\\d[\\s-]*){15})(?!\\d)`, 'gi')

  for (const match of rawText.matchAll(pattern)) {
    const candidate = toIMEICandidate(match[1] || '')
    if (candidate.length === 15) candidates.push(candidate)
  }

  return unique(candidates)
}

const extractLabeledIMEI1 = (rawText: string): string[] => extractIMEIsByLabel(rawText, 'IMEI\\s*1')

const extractLabeledIMEI2 = (rawText: string): string[] => extractIMEIsByLabel(rawText, 'IMEI\\s*2')

const extractLabeledIMEIMeid = (rawText: string): string[] => extractIMEIsByLabel(
  rawText,
  'IMEI\\s*[/\\-]\\s*MEID'
)

const extractUnlabeledIMEIs = (rawText: string): string[] => {
  const candidates: string[] = []

  for (const match of rawText.matchAll(/(?:^|\D)(\d{15})(?!\d)/g)) {
    candidates.push(match[1])
  }

  for (const match of rawText.matchAll(/(?:^|[^\d])((?:\d[\s-]*){15})(?!\d)/g)) {
    const candidate = toIMEICandidate(match[1] || '')
    if (candidate.length === 15) candidates.push(candidate)
  }

  if (/^[\d\s-]+$/.test(rawText)) {
    const candidate = toIMEICandidate(rawText)
    if (candidate.length === 15) candidates.push(candidate)
  }

  return unique(candidates)
}

export const parseIMEIScanResult = (rawText: string): DeviceScanParseResult => {
  const normalized = normalizeRawScanText(rawText)
  if (!normalized) return { value: null, error: '未识别到IMEI内容' }

  const imei1Candidates = extractLabeledIMEI1(normalized)
  const validIMEI1Candidates = imei1Candidates.filter(isValidIMEIChecksum)
  if (validIMEI1Candidates.length === 1) {
    return { value: validIMEI1Candidates[0], error: null }
  }
  if (validIMEI1Candidates.length > 1) {
    return { value: null, error: '识别到多个IMEI1，请只对准一个条码' }
  }
  if (imei1Candidates.length > 0) {
    return { value: null, error: 'IMEI1校验位不正确，请重新对准条码' }
  }

  // Apple 包装常用的 IMEI/MEID 标签对应主 IMEI，优先于不带标签的数字。
  const imeiMeidCandidates = extractLabeledIMEIMeid(normalized)
  const validIMEIMeidCandidates = imeiMeidCandidates.filter(isValidIMEIChecksum)
  if (validIMEIMeidCandidates.length === 1) {
    return { value: validIMEIMeidCandidates[0], error: null }
  }
  if (imeiMeidCandidates.length > 0) {
    return { value: null, error: 'IMEI/MEID校验位不正确，请重新对准条码' }
  }

  const labeledCandidates = extractIMEIsByLabel(
    normalized,
    '(?:IMEI(?!\\s*[12]\\b)|国际移动设备识别码)'
  )
  const validLabeledCandidates = labeledCandidates.filter(isValidIMEIChecksum)
  if (validLabeledCandidates.length === 1) {
    return { value: validLabeledCandidates[0], error: null }
  }
  if (validLabeledCandidates.length > 1) {
    return { value: null, error: '识别到多个IMEI，请只对准IMEI1条码' }
  }
  if (labeledCandidates.length > 0) {
    return { value: null, error: 'IMEI校验位不正确，请重新对准条码' }
  }

  const imei2Candidates = extractLabeledIMEI2(normalized)
  if (imei2Candidates.length > 0) {
    const validIMEI2Candidates = imei2Candidates.filter(isValidIMEIChecksum)
    if (validIMEI2Candidates.length === 1) {
      return { value: validIMEI2Candidates[0], error: null }
    }
    return { value: null, error: 'IMEI2校验位不正确，请重新对准条码' }
  }

  const candidates = extractUnlabeledIMEIs(normalized)
  const validCandidates = candidates.filter(isValidIMEIChecksum)
  if (validCandidates.length === 1) {
    return { value: validCandidates[0], error: null }
  }
  if (validCandidates.length > 1) {
    return { value: null, error: '识别到多个IMEI，请只保留一个条码在扫描框内' }
  }
  if (candidates.length > 0) {
    return { value: null, error: '识别到15位数字，但IMEI校验未通过' }
  }

  return { value: null, error: '请对准15位IMEI1条码' }
}

const normalizeSerialCandidate = (value: string): string => value
  .replace(/[^A-Za-z0-9/-]/g, '')
  .toUpperCase()
  .slice(0, 30)

const isValidSerialCandidate = (value: string): boolean => /^[A-Z0-9](?:[A-Z0-9]|[/-](?=[A-Z0-9])){3,29}$/.test(value)

const extractLabeledSerial = (rawText: string): string | null => {
  const patterns = [
    /\(S\)\s*SERIAL\s*(?:NO\.?|NUMBER)?\s*[:：#]?\s*([A-Z0-9/-]{4,30})/i,
    /(?:SERIAL\s*(?:NO\.?|NUMBER)?|S\s*\/\s*N|SN|序列号)\s*[:：#]?\s*([A-Z0-9/-]{4,30})/i
  ]

  for (const pattern of patterns) {
    const match = rawText.match(pattern)
    if (!match?.[1]) continue
    const candidate = normalizeSerialCandidate(match[1])
    if (isValidSerialCandidate(candidate)) return candidate
  }

  return null
}

const removeAppleSerialBarcodePrefix = (value: string, enabled: boolean): string => {
  if (!enabled) return value

  // Apple 包装的 Code128 序列号条码会使用 S 作为字段标识，
  // 例如印刷值 D2GVGWV67V 的原始条码内容是 SD2GVGWV67V。
  return /^S[A-Z0-9]{10,12}$/.test(value) ? value.slice(1) : value
}

export const parseSerialScanResult = (
  rawText: string,
  options: DeviceScanParseOptions = {}
): DeviceScanParseResult => {
  const normalized = normalizeRawScanText(rawText)
  if (!normalized) return { value: null, error: '未识别到序列号内容' }

  const labeledSerial = extractLabeledSerial(normalized)
  if (labeledSerial) return { value: labeledSerial, error: null }

  if (!/^[A-Za-z0-9/-]{4,30}$/.test(normalized)) {
    return { value: null, error: '二维码包含多个字段，请对准单独的SN条码' }
  }

  const candidate = removeAppleSerialBarcodePrefix(
    normalizeSerialCandidate(normalized),
    options.appleSerialBarcode === true
  )
  if (!isValidSerialCandidate(candidate)) {
    return { value: null, error: '序列号格式不正确' }
  }
  if (/^\d+$/.test(candidate)) {
    return { value: null, error: '纯数字条码无法确认是序列号，请扫描带SN标识的条码' }
  }

  return { value: candidate, error: null }
}

export const parseDeviceScanResult = (
  scanType: DeviceScanType,
  rawText: string,
  options: DeviceScanParseOptions = {}
): DeviceScanParseResult => (
  scanType === 'imei' ? parseIMEIScanResult(rawText) : parseSerialScanResult(rawText, options)
)
