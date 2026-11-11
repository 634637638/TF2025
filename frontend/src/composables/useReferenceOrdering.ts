import { ref, type Ref } from 'vue'
import unifiedApi from '@/utils/unified-api'
import { sortOptionsByOrder } from '@/utils/option-sort'
import { useNotification } from '@/composables/useNotification'
import { handleApiErrorWithPermission } from '@/utils/apiPermissionError'
import type { Brand } from '@/types'

type ReferenceOrderRow = Pick<Brand, 'id' | 'sort_order'>

interface ReferenceOrderingOptions<T extends ReferenceOrderRow> {
  rows: Ref<T[]>
  endpoint: '/brands' | '/models' | '/colors' | '/memories'
  moduleName: string
  canEdit: Ref<boolean>
  reload: () => Promise<void>
  scopeKey?: (row: T) => number | undefined
}

/** 手动编辑只提交目标记录；拖拽只交换受影响记录已有的排序值，不按筛选结果重新编号。 */
export const useReferenceOrdering = <T extends ReferenceOrderRow>({
  rows, endpoint, moduleName, canEdit, reload, scopeKey
}: ReferenceOrderingOptions<T>) => {
  const savingOrder = ref(false)
  const { success, warning } = useNotification()

  const save = async (updates: ReferenceOrderRow[]): Promise<boolean> => {
    if (savingOrder.value || !canEdit.value || updates.length === 0) return false
    const previous = rows.value
    const values = new Map(updates.map(item => [item.id, item.sort_order]))
    const optimistic = sortOptionsByOrder(previous.map(row => values.has(row.id)
      ? { ...row, sort_order: values.get(row.id) }
      : row))
    rows.value = optimistic
    const appliedRows = rows.value
    savingOrder.value = true
    try {
      const response = await unifiedApi.put(`${endpoint}/batch/reorder`, { items: updates }, { showError: false })
      if (!response.success) throw new Error(response.message || '保存排序失败')
      try {
        await reload()
      } catch (error) {
        handleApiErrorWithPermission(error, '排序已保存，但刷新列表失败，请刷新页面', moduleName, 'view')
        return true
      }
      success('排序已保存')
      return true
    } catch (error) {
      // 搜索、分页可能已切换，不能用旧快照覆盖新列表。
      if (rows.value === appliedRows) rows.value = previous
      handleApiErrorWithPermission(error, '保存排序失败', moduleName, 'edit')
      return false
    } finally {
      savingOrder.value = false
    }
  }

  const handleSortOrderChange = async (id: number, value: number | undefined) => {
    if (value === undefined || !Number.isInteger(value) || value < 0 || value > 9999) {
      warning('排序值必须是 0～9999 的整数')
      return false
    }
    const row = rows.value.find(item => item.id === id)
    if (!row || row.sort_order === value) return false
    return save([{ id: row.id, sort_order: value }])
  }

  const handleRowMove = async (oldIndex: number, newIndex: number) => {
    if (savingOrder.value || !canEdit.value || oldIndex === newIndex) return false
    const moved = rows.value[oldIndex]
    const target = rows.value[newIndex]
    if (!moved || !target) return false
    const start = Math.min(oldIndex, newIndex)
    const end = Math.max(oldIndex, newIndex)
    const affected = rows.value.slice(start, end + 1)
    if (scopeKey && affected.some(row => scopeKey(row) !== scopeKey(moved))) {
      warning('只能在同一品牌内进行拖拽排序')
      return false
    }
    const orders = affected.map(row => row.sort_order ?? 0)
    if (new Set(orders).size !== orders.length) {
      warning('当前记录存在相同排序值，请先修改排序值再拖拽')
      return false
    }
    const reordered = [...affected]
    const [item] = reordered.splice(oldIndex - start, 1)
    reordered.splice(newIndex - start, 0, item)
    return save(reordered.map((row, index) => ({ id: row.id, sort_order: orders[index] })))
  }

  return { savingOrder, handleSortOrderChange, handleRowMove }
}
