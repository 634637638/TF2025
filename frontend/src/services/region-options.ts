import { areaList } from '@vant/area-data'

export interface RegionSelection {
  province: string
  city: string
  district: string
}

interface RegionOption {
  code: string
  name: string
}

const cityOptions: RegionOption[] = Object.entries(areaList.city_list).map(([code, name]) => ({ code, name }))
const districtOptions: RegionOption[] = Object.entries(areaList.county_list).map(([code, name]) => ({ code, name }))

export const provinces: RegionOption[] = Object.entries(areaList.province_list)
  .map(([code, name]) => ({ code: code.slice(0, 2), name }))

export function normalizeProvince(value: string): string {
  const raw = value.trim()
  return provinces.find(option => (
    option.name === raw || option.code === raw || `${option.code}0000` === raw
  ))?.code || raw
}

export function getProvinceName(value: string): string {
  const code = normalizeProvince(value)
  return provinces.find(option => option.code === code)?.name || value.trim()
}

export function getCities(province: string): RegionOption[] {
  const code = normalizeProvince(province)
  return code && provinces.some(option => option.code === code)
    ? cityOptions.filter(option => option.code.startsWith(code))
    : []
}

export function getDistricts(province: string, city: string): RegionOption[] {
  const parent = getCities(province).find(option => (
    option.name === city || option.code === city || option.code.slice(0, 4) === city
  ))
  return parent ? districtOptions.filter(option => option.code.startsWith(parent.code.slice(0, 4))) : []
}

export function normalizeRegion(value?: RegionSelection): RegionSelection {
  const province = normalizeProvince(value?.province || '')
  const rawCity = (value?.city || '').trim()
  const rawDistrict = (value?.district || '').trim()
  const city = getCities(province).find(option => (
    option.name === rawCity || option.code === rawCity || option.code.slice(0, 4) === rawCity
  ))?.name || rawCity
  const district = getDistricts(province, city).find(option => (
    option.name === rawDistrict || option.code === rawDistrict
  ))?.name || rawDistrict

  // 旧选择器把直辖市/港澳的县区保存在 city；只兼容明确的名称，不猜测旧的错误编码。
  const legacyDistrict = !rawDistrict && districtOptions.find(option => (
    option.code.startsWith(province) && option.name === rawCity
  ))
  const legacyCity = legacyDistrict && getCities(province)
    .find(option => option.code.startsWith(legacyDistrict.code.slice(0, 4)))
  return legacyCity && legacyDistrict
    ? { province, city: legacyCity.name, district: legacyDistrict.name }
    : { province, city, district }
}

/** customers 沿用 province/city/address 契约；县区保存在 address 的名称前缀中。 */
export function splitCustomerAddress(region: RegionSelection, address: string): { district: string; detail: string } {
  const district = getDistricts(region.province, region.city)
    .filter(option => address === option.name || address.startsWith(`${option.name} `))
    .sort((left, right) => right.name.length - left.name.length)[0]?.name || ''
  return district ? { district, detail: address.slice(district.length).replace(/^ /, '') } : { district: '', detail: address }
}

export function joinCustomerAddress(district: string, detail: string): string {
  return district ? `${district}${detail ? ` ${detail}` : ''}` : detail
}
