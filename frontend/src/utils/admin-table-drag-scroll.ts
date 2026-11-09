const TABLE_SELECTOR = '.data-table, .admin-data-table, .devices-table'
const TABLE_BODY_WRAPPER_SELECTOR = '.el-table__body-wrapper'
const TABLE_ROW_SELECTOR = '.el-table__body tr.el-table__row'
const MANAGED_HOVER_ROW_CLASS = 'is-admin-table-row-hover'
const SCROLLER_SELECTOR = '.el-scrollbar__wrap'
const EXPLICIT_SCROLLER_SELECTOR = '[data-table-drag-scroll]'
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

let lastPointerPosition: { x: number; y: number } | null = null

const findTableScroller = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return null

  // 宽表在外层容器横向滚动时，仍走同一个全局交互入口。
  const explicitScroller = target.closest<HTMLElement>(EXPLICIT_SCROLLER_SELECTOR)
  if (explicitScroller && explicitScroller.scrollWidth > explicitScroller.clientWidth + 1) {
    return explicitScroller
  }

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

const clearStaleTableHoverRows = (table: HTMLElement) => {
  // Element Plus uses hover-row for fixed-column synchronization. During
  // vertical scrolling an old row can retain the class after the pointer
  // moves over a different physical row, leaving multiple hover backgrounds.
  table.querySelectorAll<HTMLElement>('.el-table__body tr.hover-row').forEach(row => {
    row.classList.remove('hover-row')
  })
}

const clearActiveTableRowFrame = (table: HTMLElement | null) => {
  table
    ?.querySelectorAll<HTMLElement>(`${TABLE_BODY_WRAPPER_SELECTOR}.is-admin-table-row-framed`)
    .forEach(wrapper => {
      wrapper.classList.remove('is-admin-table-row-framed')
      wrapper.style.removeProperty('--admin-table-active-row-top')
      wrapper.style.removeProperty('--admin-table-active-row-left')
      wrapper.style.removeProperty('--admin-table-active-row-height')
    })
}

const clearManagedTableHoverRows = (table: HTMLElement | null) => {
  table
    ?.querySelectorAll<HTMLElement>(`${TABLE_ROW_SELECTOR}.${MANAGED_HOVER_ROW_CLASS}`)
    .forEach(row => {
      row.classList.remove(MANAGED_HOVER_ROW_CLASS)
    })
}

const updateActiveTableRowFrame = (row: HTMLElement) => {
  const table = row.closest<HTMLElement>(TABLE_SELECTOR)
  const wrapper = row.closest<HTMLElement>(TABLE_BODY_WRAPPER_SELECTOR)
  if (!table || !wrapper || wrapper.closest(TABLE_SELECTOR) !== table) return

  const rowRect = row.getBoundingClientRect()
  const wrapperRect = wrapper.getBoundingClientRect()
  const top = Math.max(0, rowRect.top - wrapperRect.top)
  const left = Math.max(0, rowRect.left - wrapperRect.left)
  const height = Math.min(rowRect.height, wrapperRect.bottom - rowRect.top)

  if (height <= 0) {
    clearActiveTableRowFrame(table)
    return
  }

  wrapper.style.setProperty('--admin-table-active-row-top', `${top}px`)
  wrapper.style.setProperty('--admin-table-active-row-left', `${left}px`)
  wrapper.style.setProperty('--admin-table-active-row-height', `${height}px`)
  wrapper.classList.add('is-admin-table-row-framed')
}

const setManagedTableHoverRow = (row: HTMLElement) => {
  const table = row.closest<HTMLElement>(TABLE_SELECTOR)
  if (!table) return

  clearStaleTableHoverRows(table)
  table
    .querySelectorAll<HTMLElement>(`${TABLE_ROW_SELECTOR}.${MANAGED_HOVER_ROW_CLASS}`)
    .forEach(activeRow => {
      if (activeRow !== row) activeRow.classList.remove(MANAGED_HOVER_ROW_CLASS)
    })

  row.classList.add(MANAGED_HOVER_ROW_CLASS)
  updateActiveTableRowFrame(row)
}

const syncManagedTableHoverFromPointer = (table: HTMLElement) => {
  if (!lastPointerPosition) {
    clearManagedTableHoverRows(table)
    clearActiveTableRowFrame(table)
    return
  }

  const target = document.elementFromPoint(lastPointerPosition.x, lastPointerPosition.y)
  const row = target?.closest<HTMLElement>(TABLE_ROW_SELECTOR)
  if (!row || row.closest(TABLE_SELECTOR) !== table) {
    clearManagedTableHoverRows(table)
    clearActiveTableRowFrame(table)
    return
  }

  setManagedTableHoverRow(row)
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
  let touchStart: { row: HTMLElement; pointerId: number; x: number; y: number; at: number } | null = null
  let touchFeedbackTable: HTMLElement | null = null
  const clearTouchFeedback = () => {
    if (!touchFeedbackTable) return
    clearManagedTableHoverRows(touchFeedbackTable)
    clearActiveTableRowFrame(touchFeedbackTable)
    touchFeedbackTable = null
  }
  const cancelTouchFeedback = () => {
    touchStart = null
    clearTouchFeedback()
  }
  const lastScrollLeft = new WeakMap<HTMLElement, number>()
  const hasFinePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true
  const hasHoverPointer = (event: PointerEvent) =>
    (event.pointerType === 'mouse' || event.pointerType === 'pen') && hasFinePointer()

  // 触摸只在完整轻触结束后绘制一次行反馈；滑动过程不测量布局。
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return
    cancelTouchFeedback()
    lastPointerPosition = null
    if (event.isPrimary === false || !(event.target instanceof Element)
      || event.target.closest(INTERACTIVE_SELECTOR)) return
    const row = event.target.closest<HTMLElement>(TABLE_ROW_SELECTOR)
    if (!row?.closest(TABLE_SELECTOR)) return
    touchStart = { row, pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() }
  }, { capture: true, passive: true })

  document.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch') return
    const start = touchStart
    touchStart = null
    if (!start || event.pointerId !== start.pointerId || !start.row.isConnected
      || performance.now() - start.at > 400
      || Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10
      || !(event.target instanceof Element) || event.target.closest(INTERACTIVE_SELECTOR)
      || event.target.closest(TABLE_ROW_SELECTOR) !== start.row) return
    touchFeedbackTable = start.row.closest<HTMLElement>(TABLE_SELECTOR)
    setManagedTableHoverRow(start.row)
  }, { capture: true, passive: true })
  document.addEventListener('pointercancel', cancelTouchFeedback, { capture: true, passive: true })
  window.addEventListener('blur', cancelTouchFeedback)
  window.addEventListener('resize', cancelTouchFeedback)

  document.addEventListener('pointermove', (event) => {
    if (touchStart && event.pointerType === 'touch' && event.pointerId === touchStart.pointerId
      && (Math.abs(event.clientX - touchStart.x) > 10 || Math.abs(event.clientY - touchStart.y) > 10)) {
      touchStart = null
    }
    if (!hasHoverPointer(event)) return
    lastPointerPosition = { x: event.clientX, y: event.clientY }
    if (!(event.target instanceof Element)) return

    const table = event.target.closest<HTMLElement>(TABLE_SELECTOR)
    const row = event.target.closest<HTMLElement>(TABLE_ROW_SELECTOR)
    if (!table || !row || row.closest(TABLE_SELECTOR) !== table) return
    setManagedTableHoverRow(row)
  }, true)

  // Element Plus fixed-layout tables render header and body in separate layers.
  // Keep them synchronized for native touch/trackpad scrolling as well as dragging.
  document.addEventListener('scroll', (event) => {
    cancelTouchFeedback()
    const scroller = event.target
    if (!(scroller instanceof HTMLElement) || !scroller.matches(SCROLLER_SELECTOR)) return
    const table = scroller.closest<HTMLElement>(TABLE_SELECTOR)
    if (!table) return
    const scrollLeft = scroller.scrollLeft
    const previousScrollLeft = lastScrollLeft.get(scroller)
    if (scrollLeft === 0 && previousScrollLeft === undefined) {
      lastScrollLeft.set(scroller, 0)
      return
    }
    if (previousScrollLeft === scrollLeft) return
    lastScrollLeft.set(scroller, scrollLeft)
    syncTableHorizontalPosition(scroller)
    if (!hasFinePointer() || !lastPointerPosition) return
    clearStaleTableHoverRows(table)
    window.requestAnimationFrame(() => syncManagedTableHoverFromPointer(table))
  }, true)

  document.addEventListener('pointerover', (event) => {
    if (!hasHoverPointer(event)) return
    lastPointerPosition = { x: event.clientX, y: event.clientY }
    if (!(event.target instanceof Element)) return

    const row = event.target.closest<HTMLElement>(TABLE_ROW_SELECTOR)
    if (!row || !row.closest(TABLE_SELECTOR)) return
    setManagedTableHoverRow(row)
  })

  document.addEventListener('pointerout', (event) => {
    if (!hasHoverPointer(event)) return
    if (!(event.target instanceof Element)) return

    const wrapper = event.target.closest<HTMLElement>(TABLE_BODY_WRAPPER_SELECTOR)
    const table = wrapper?.closest<HTMLElement>(TABLE_SELECTOR) || null
    if (!wrapper || !table) return

    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && wrapper.contains(relatedTarget)) return
    clearManagedTableHoverRows(table)
    clearActiveTableRowFrame(table)
  })

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
  window.addEventListener('blur', finishDrag)

  document.addEventListener('wheel', (event) => {
    if (!event.shiftKey || !(event.target instanceof Element)) return
    const scroller = event.target.closest<HTMLElement>(EXPLICIT_SCROLLER_SELECTOR)
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 1) return
    event.preventDefault()
    scroller.scrollLeft += event.deltaY || event.deltaX
  }, { passive: false })

  document.addEventListener('click', (event) => {
    if (!suppressClickScroller || !(event.target instanceof Node)) return
    if (!suppressClickScroller.contains(event.target)) return

    event.preventDefault()
    event.stopImmediatePropagation()
    suppressClickScroller = null
  }, true)
}
