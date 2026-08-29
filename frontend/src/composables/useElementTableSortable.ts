import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'
import Sortable from 'sortablejs'

interface ElementTableSortableOptions {
  tableRef: Ref<HTMLElement | { $el?: HTMLElement } | null>
  enabled: Ref<boolean>
  orderKey: () => string
  onMove: (oldIndex: number, newIndex: number) => boolean | void | Promise<boolean | void>
}

export const useElementTableSortable = ({
  tableRef,
  enabled,
  orderKey,
  onMove
}: ElementTableSortableOptions) => {
  let sortable: Sortable | null = null

  const destroy = () => {
    sortable?.destroy()
    sortable = null
  }

  const setup = async () => {
    await nextTick()
    destroy()

    if (!enabled.value) return

    const table = tableRef.value
    const root = table instanceof HTMLElement ? table : table?.$el
    const body = root?.querySelector?.('.el-table__body-wrapper tbody') as HTMLElement | null
    if (!body) return

    sortable = Sortable.create(body, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'element-table-sort-ghost',
      chosenClass: 'element-table-sort-chosen',
      dragClass: 'element-table-sort-drag',
      onEnd: async (event) => {
        const oldIndex = event.oldIndex
        const newIndex = event.newIndex
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return

        const accepted = await onMove(oldIndex, newIndex)
        if (accepted === false && event.item.parentElement) {
          const parent = event.item.parentElement
          parent.removeChild(event.item)
          parent.insertBefore(event.item, parent.children[oldIndex] || null)
        }
      }
    })
  }

  watch([tableRef, enabled, orderKey], setup, { flush: 'post' })
  onBeforeUnmount(destroy)

  return { refreshSortable: setup }
}
