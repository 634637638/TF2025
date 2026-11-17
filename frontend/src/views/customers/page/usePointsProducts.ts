import { computed, ref, watch, type Ref } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useSelectLoadMore } from '@/composables/useSelectLoadMore'
import { useNotification } from '@/composables/useNotification'
import type { CustomerPointsConfig, CustomerPointsProduct } from '@/types/customer-points'

/** 积分范围商品按类型分页检索；全选核对完整结果后一次应用，失败不保留半批选择。 */
export function usePointsProducts(form: Ref<CustomerPointsConfig | null>, active: () => boolean) {
  const requests = useLatestRequest()
  const notifications = useNotification()
  const products = ref<CustomerPointsProduct[]>([])
  const selected = ref<CustomerPointsProduct[]>([])
  const loading = ref(false), selectingAll = ref(false), failed = ref(false)
  const keyword = ref(''), page = ref(0), total = ref(0)
  const hasMore = computed(() => products.value.length < total.value)
  const options = computed(() => [...new Map([...selected.value, ...products.value].map(item => [item.id, item])).values()])
  const productLabel = (item: CustomerPointsProduct) => [item.name, item.brand_name, item.product_model, item.color_name, `#${item.id}`, item.status === 1 ? '' : '已停用'].filter(Boolean).join(' · ')
  const fetchPage = async (nextPage: number, signal: AbortSignal, search = keyword.value) => {
    const response = await unifiedApi.get<CustomerPointsProduct[]>('/customers/points-products', {
      params: { category_ids: form.value?.redemption.category_ids.join(','), page: nextPage, page_size: 50, search },
      signal, useCache: false, showLoading: false
    })
    if (response.success === false || !Array.isArray(response.data) || !Number.isSafeInteger(response.pagination?.total) || Number(response.pagination?.total) < 0) throw new Error('商品范围响应不完整')
    return { data: response.data, total: Number(response.pagination?.total) }
  }
  const loadProducts = async (append = false) => {
    if (!active() || !form.value?.redemption.category_ids.length || selectingAll.value || (append && loading.value)) return
    const request = requests.nextRequest()
    const nextPage = append ? page.value + 1 : 1
    if (!append) { products.value = []; page.value = 0; total.value = 0 }
    loading.value = true; failed.value = false
    try {
      const result = await fetchPage(nextPage, request.signal)
      if (!request.isLatest()) return
      products.value = append ? [...new Map([...products.value, ...result.data].map(item => [item.id, item])).values()] : result.data
      if (!result.data.length && products.value.length < result.total) throw new Error('商品分页不完整')
      page.value = nextPage; total.value = result.total
    } catch (error) {
      if (request.isLatest() && !requests.isCanceledError(error)) failed.value = true
    } finally { if (request.isLatest()) loading.value = false }
  }
  const searchProducts = (value: string) => { keyword.value = value; void loadProducts() }
  const updateSelection = (ids: number[]) => {
    if (!form.value) return
    form.value.redemption.accessory_ids = ids
    selected.value = options.value.filter(item => ids.includes(item.id))
  }
  const selectAll = async () => {
    if (!active() || !form.value?.redemption.category_ids.length || selectingAll.value) return
    const request = requests.nextRequest()
    loading.value = false; selectingAll.value = true; failed.value = false
    try {
      const found = new Map<number, CustomerPointsProduct>()
      let expected = 0
      for (let nextPage = 1; ; nextPage++) {
        const result = await fetchPage(nextPage, request.signal, '')
        if (!request.isLatest()) return
        if (result.total > 1000) { notifications.warning('所选类型超过1000个商品，请缩小类型范围或逐项选择'); return }
        if (nextPage > 1 && expected !== result.total) throw new Error('商品范围已变化，请重试')
        expected = result.total
        const before = found.size
        result.data.forEach(item => found.set(item.id, item))
        if (found.size >= expected) break
        if (found.size === before) throw new Error('商品分页不完整')
      }
      selected.value = [...found.values()]
      if (form.value) form.value.redemption.accessory_ids = [...found.keys()]
    } catch (error) {
      if (request.isLatest() && !requests.isCanceledError(error)) {
        failed.value = true
        notifications.warning('全选未完成，原选择已保留，请重试')
      }
    } finally { if (request.isLatest()) selectingAll.value = false }
  }
  const reset = (saved: CustomerPointsProduct[] = []) => {
    requests.cancelLatest(); products.value = []; selected.value = saved
    loading.value = selectingAll.value = failed.value = false
    keyword.value = ''; page.value = total.value = 0
  }
  watch(() => [active(), form.value?.redemption.all_accessory_categories, form.value?.redemption.category_ids.join(',')] as const, () => {
    requests.cancelLatest(); loading.value = selectingAll.value = failed.value = false
    products.value = []; page.value = total.value = 0; keyword.value = ''
    if (!active() || !form.value) return
    const categoryIds = form.value.redemption.category_ids
    selected.value = selected.value.filter(item => categoryIds.includes(item.category_id))
    form.value.redemption.accessory_ids = selected.value.map(item => item.id)
    if (!form.value.redemption.all_accessory_categories) void loadProducts()
  })
  const { selectRef, onPopupScroll } = useSelectLoadMore(() => loadProducts(true), () => loading.value || selectingAll.value || failed.value || !hasMore.value)
  return { options, selected, loading, selectingAll, failed, hasMore, productLabel, loadProducts, searchProducts, updateSelection, selectAll, reset, selectRef, onPopupScroll }
}
