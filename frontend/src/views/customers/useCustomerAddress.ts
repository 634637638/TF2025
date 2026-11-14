import { computed, onMounted, ref, type Ref } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { normalizeRegion, splitCustomerAddress, joinCustomerAddress, type RegionSelection } from '@/services/region-options'

type AddressForm = RegionSelection & { address: string; region_version?: string }
type AddressCapabilities = { ready: boolean; version: string; coverage: string }

/** 地址迁移状态、旧值回显和五级选择只在此编排，不在客户页面复制状态。 */
export function useCustomerAddress<T extends AddressForm>(form: Ref<T>, canEdit: (field: string) => boolean) {
  const capabilities = ref<AddressCapabilities>({ ready: false, version: '', coverage: '' })
  const cityLocation = ref<RegionSelection>({ province: '', city: '', district: '', town: '', village: '' })
  const addressDetail = computed({
    get: () => form.value.region_version ? form.value.address : splitCustomerAddress(cityLocation.value, form.value.address).detail,
    set: (detail: string) => {
      form.value.address = form.value.region_version ? detail : joinCustomerAddress(cityLocation.value.district, detail)
    }
  })
  const addressDetailLimit = computed(() => Math.max(0, 200 - (form.value.region_version ? 0 : (
    cityLocation.value.district ? cityLocation.value.district.length + 1 : 0
  ))))
  const handleLocationChange = (location: RegionSelection) => {
    const detail = addressDetail.value
    for (const field of ['province', 'city'] as const) if (canEdit(field)) form.value[field] = location[field]
    if (capabilities.value.ready) {
      for (const field of ['district', 'town', 'village'] as const) if (canEdit(field)) form.value[field] = location[field] || ''
      form.value.region_version = capabilities.value.version
      if (canEdit('address')) form.value.address = detail
    } else if (canEdit('address')) form.value.address = joinCustomerAddress(location.district, detail)
    cityLocation.value = location
  }
  const resetAddressLocation = () => {
    const region = normalizeRegion(form.value)
    const legacy = form.value.region_version ? '' : splitCustomerAddress(region, form.value.address).district
    cityLocation.value = { ...region, district: region.district || legacy, town: region.town || '', village: region.village || '' }
  }
  onMounted(async () => {
    try {
      const response = await unifiedApi.get<AddressCapabilities>('/customers/address-capabilities', { showLoading: false, showError: false, useCache: false })
      if (response.success && response.data) capabilities.value = response.data
    } catch {
      // 能力检查失败时保留原三级读写，不能假设数据库已完成迁移。
    }
  })
  return { capabilities, cityLocation, addressDetail, addressDetailLimit, handleLocationChange, resetAddressLocation }
}
