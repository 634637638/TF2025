const TABLE_SELECTOR = '.data-table, .admin-data-table'
const SCROLLER_SELECTOR = '.el-scrollbar__wrap'
const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '[role="button"]',
  '[contenteditable="true"]',
  '.el-button',
  '.el-checkbox',
  '.el-radio',
  '.el-switch',
  '.el-table__expand-icon'
].join(',')

interface DragState {
  scroller: HTMLElement
  startX: number
  startScrollLeft: number
  moved: boolean
}

let initialized = false

const findTableScroller = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return null

  const table = target.closest<HTMLElement>(TABLE_SELECTOR)
  if (!table) return null

  const hasHorizontalOverflow = (scroller: HTMLElement) =>
    scroller.scrollWidth > scroller.clientWidth + 1

  // Body cells are already inside the scrollbar. Header cells are rendered in
  // a sibling layer, so fall back to the table's actual overflowing scroller.
  const closestScroller = target.closest<HTMLElement>(SCROLLER_SELECTOR)
  if (
    closestScroller &&
    closestScroller.closest(TABLE_SELECTOR) === table &&
    hasHorizontalOverflow(closestScroller)
  ) {
    return closestScroller
  }

  return Array.from(table.querySelectorAll<HTMLElement>(SCROLLER_SELECTOR)).find(scroller =>
    scroller.closest(TABLE_SELECTOR) === table && hasHorizontalOverflow(scroller)
  ) || null
}

const syncTableHorizontalPosition = (scroller: HTMLElement) => {
  const table = scroller.closest<HTMLElement>(TABLE_SELECTOR)
  if (!table) return

  const scrollLeft = scroller.scrollLeft
  table
    .querySelectorAll<HTMLElement>('.el-table__header-wrapper, .el-table__footer-wrapper')
    .forEach(wrapper => {
      if (wrapper.closest(TABLE_SELECTOR) !== table) return
      if (wrapper.scrollLeft !== scrollLeft) wrapper.scrollLeft = scrollLeft
    })
}

/**
 * Adds delegated mouse-drag scrolling to every unified Element Plus table.
 * Touch devices keep their native inertial scrolling behavior.
 */
export const initAdminTableDragScroll = () => {
  if (initialized || typeof document === 'undefined') return
  initialized = true

  let dragState: DragState | null = null
  let suppressClickScroller: HTMLElement | null = null

  // Element Plus fixed-layout tables render header and body in separate layers.
  // Keep them synchronized for native touch/trackpad scrolling as well as dragging.
  document.addEventListener('scroll', (event) => {
    const scroller = event.target
    if (!(scroller instanceof HTMLElement) || !scroller.matches(SCROLLER_SELECTOR)) return
    if (!scroller.closest(TABLE_SELECTOR)) return
    syncTableHorizontalPosition(scroller)
  }, true)

  const finishDrag = () => {
    if (!dragState) return

    if (dragState.moved) {
      suppressClickScroller = dragState.scroller
      window.setTimeout(() => {
        suppressClickScroller = null
      }, 0)
    }

    dragState.scroller.classList.remove('is-admin-table-dragging')
    document.body.classList.remove('is-admin-table-dragging')
    dragState = null
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return

    const scroller = findTableScroller(event.target)
    if (!scroller) return

    dragState = {
      scroller,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
      moved: false
    }
  })

  document.addEventListener('pointermove', (event) => {
    if (!dragState) return

    const distance = event.clientX - dragState.startX
    if (!dragState.moved && Math.abs(distance) < 4) return

    dragState.moved = true
    dragState.scroller.classList.add('is-admin-table-dragging')
    document.body.classList.add('is-admin-table-dragging')
    dragState.scroller.scrollLeft = dragState.startScrollLeft - distance
    syncTableHorizontalPosition(dragState.scroller)
    event.preventDefault()
  }, { passive: false })

  document.addEventListener('pointerup', finishDrag)
  document.addEventListener('pointercancel', finishDrag)

  document.addEventListener('click', (event) => {
    if (!suppressClickScroller || !(event.target instanceof Node)) return
    if (!suppressClickScroller.contains(event.target)) return

    event.preventDefault()
    event.stopImmediatePropagation()
    suppressClickScroller = null
  }, true)
}
