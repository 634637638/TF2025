export interface PublicPriceContact {
  name: string
  phone: string
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

export const formatPublicPriceWatermark = (template: string | undefined, contact?: PublicPriceContact, includeTime = true): string => {
  // 兼容旧版本变量模板，但号码和名称不再由系统自动注入。
  const value = String(template || '').replace(/\{(?:name|phone)\}/g, '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  const withoutLegacyTime = value.replace(/\s*\{time\}\s*/g, ' ').trim()
  return includeTime
    ? `${withoutLegacyTime} ${new Date().toLocaleString('zh-CN', { hour12: false })}`.trim()
    : withoutLegacyTime
}
