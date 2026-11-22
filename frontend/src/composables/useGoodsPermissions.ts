import { computed } from 'vue'
import { usePagePermissions } from '@/composables/usePagePermissions'

/** 业务能力来源与页面访问分离；调用方仍独立核验所属页面查看权限。 */
export const useGoodsPermissions = (preferredSource?: 'accessories' | 'query') => {
  const accessories = usePagePermissions('accessories')
  const query = usePagePermissions('query')
  const canQuery = computed(() => query.canView.value && query.hasPermission('goods-view'))
  const source = computed(() => preferredSource || (accessories.canView.value ? 'accessories' as const : 'query' as const))
  const canView = computed(() => source.value === 'accessories' ? accessories.canView.value : canQuery.value)
  const canCreate = computed(() => source.value === 'accessories'
    ? accessories.canView.value && accessories.hasPermission('sell')
    : canQuery.value && query.hasPermission('goods-sell'))
  const canGift = computed(() => source.value === 'accessories'
    ? accessories.canView.value && accessories.hasPermission('gift')
    : canQuery.value && query.hasPermission('goods-gift'))
  const hasPermission = (action: string) => action === 'view' ? canView.value
    : action === 'create' ? canCreate.value : action === 'gift' ? canGift.value : false
  return { canQuery, canView, canCreate, canGift, source, hasPermission }
}
