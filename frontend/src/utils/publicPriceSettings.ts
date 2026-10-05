import { TIME_FORMATS, TimeUtil } from '@/utils/time'

export interface PublicPriceContact {
  name: string
  phone: string
}

export const getPublicPriceContactKey = (contact?: PublicPriceContact | null) => {
  if (!contact) return ''
  return `${contact.name}|${contact.phone}`
}

export const parsePublicPriceContacts = (raw: string | PublicPriceContact[] | undefined): PublicPriceContact[] => {
  if (Array.isArray(raw)) {
    return raw
      .map(item => ({ name: String(item?.name || '').trim(), phone: String(item?.phone || '').trim() }))
      .filter(item => item.name && item.phone)
  }

  return String(raw || '').split(/\r?\n/).map(line => {
    const [name, ...phoneParts] = line.split('|')
    return { name: String(name || '').trim(), phone: phoneParts.join('|').trim() }
  }).filter(item => item.name && item.phone)
}

export const getDefaultPublicPriceContact = (
  contacts: PublicPriceContact[],
  configuredKey?: string
) => {
  if (!contacts.length) return undefined
  const key = String(configuredKey || '').trim()
  return contacts.find(contact => getPublicPriceContactKey(contact) === key) || contacts[0]
}

export const formatPublicPriceWatermark = (template: string | undefined, contact?: PublicPriceContact, includeTime = true): string => {
  // 兼容旧版本变量模板，但号码和名称不再由系统自动注入。
  const value = String(template || '').replace(/\{(?:name|phone)\}/g, '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  const withoutLegacyTime = value.replace(/\s*\{time\}\s*/g, ' ').trim()
  return includeTime
    ? `${withoutLegacyTime} ${TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)}`.trim()
    : withoutLegacyTime
}
