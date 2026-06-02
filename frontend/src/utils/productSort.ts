export const extractSeriesNumber = (model: string): number => {
  if (!model) return 0
  const match = model.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

export const getMemoryOrderWeight = (memory: string): number => {
  if (!memory) return 999
  const size = memory.toUpperCase().replace(/[^0-9A-Z]/g, '')

  if (size.includes('TB')) {
    const tb = parseInt(size) || 0
    return tb * 1000
  }

  if (size.includes('GB')) {
    const gb = parseInt(size) || 0
    return gb
  }

  return parseInt(size) || 0
}

export const getBrandOrderWeight = (brand: string): number => {
  if (!brand) return 999
  const brandClean = extractBrandName(brand)

  if (
    brandClean.includes('苹果') ||
    brandClean.includes('apple') ||
    brandClean.includes('iphone') ||
    brandClean.includes('ipad') ||
    brandClean.includes('airpods')
  ) {
    return 0
  }

  return 1000
}

export const extractBrandName = (brand: string): string => {
  if (!brand) return ''
  return brand.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').toLowerCase().trim()
}
