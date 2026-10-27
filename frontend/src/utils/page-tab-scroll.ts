const TABS_SELECTOR = '.tf-page-tabs.el-tabs'
const SCROLLER_SELECTOR = '.tf-page-tabs.el-tabs > .el-tabs__header .el-tabs__nav-scroll, .tf-page-tabs.tab-navigation'
let initialized = false

/** Native touch scrolling and wheel scrolling share one offset, without vendor arrows. */
export const initPageTabScroll = () => {
  if (initialized || typeof document === 'undefined') return
  initialized = true
  const controller = new AbortController()
  const pending = new Set<HTMLElement>()
  const observed = new Set<HTMLElement>()
  let frame = 0

  const revealActiveTab = (tabs: HTMLElement) => {
    pending.add(tabs)
    if (frame) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      for (const element of observed) {
        if (element.isConnected) continue
        resizeObserver.unobserve(element)
        observed.delete(element)
      }
      for (const root of pending) {
        const scroller = root.querySelector<HTMLElement>(':scope > .el-tabs__header .el-tabs__nav-scroll')
        const active = scroller?.querySelector<HTMLElement>('.el-tabs__item.is-active')
        if (!scroller || !active) continue
        for (const element of [scroller, scroller.querySelector<HTMLElement>('.el-tabs__nav')]) {
          if (!element || observed.has(element)) continue
          observed.add(element)
          resizeObserver.observe(element)
        }
        if (!scroller.clientWidth) continue
        const viewport = scroller.getBoundingClientRect()
        const item = active.getBoundingClientRect()
        if (item.left < viewport.left) scroller.scrollLeft += item.left - viewport.left
        else if (item.right > viewport.right) scroller.scrollLeft += item.right - viewport.right
      }
      pending.clear()
    })
  }

  const resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const root = entry.target.closest<HTMLElement>(TABS_SELECTOR)
      if (root) revealActiveTab(root)
    }
  })

  // Capture before Element Plus handles the wheel by translating its tab list.
  document.addEventListener('wheel', (event: WheelEvent) => {
    if (event.ctrlKey || !(event.target instanceof Element)) return
    const scroller = event.target.closest<HTMLElement>(SCROLLER_SELECTOR)
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? parseFloat(getComputedStyle(scroller).fontSize)
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? scroller.clientWidth : 1
    const distance = (event.deltaX || event.deltaY) * unit
    if (!distance) return
    event.stopPropagation()
    const previous = scroller.scrollLeft
    scroller.scrollLeft += distance
    if (scroller.scrollLeft !== previous) event.preventDefault()
  }, { capture: true, passive: false, signal: controller.signal })

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (!(record.target instanceof Element)) continue
      if (record.type === 'attributes' && !record.target.matches('.el-tabs__item')) continue
      const root = record.target.closest<HTMLElement>(TABS_SELECTOR)
      if (root && (record.type === 'attributes' || record.target === root || record.target.closest('.el-tabs__header'))) {
        revealActiveTab(root)
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        if (node.matches(TABS_SELECTOR)) revealActiveTab(node)
        node.querySelectorAll<HTMLElement>(TABS_SELECTOR).forEach(revealActiveTab)
      }
      if (record.removedNodes.length && observed.size) {
        const removedRoot = [...observed].find(element => !element.isConnected)
        if (removedRoot) revealActiveTab(removedRoot)
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })

  const revealAllActiveTabs = () => {
    document.querySelectorAll<HTMLElement>(TABS_SELECTOR).forEach(revealActiveTab)
  }
  window.addEventListener('resize', revealAllActiveTabs, { signal: controller.signal })
  revealAllActiveTabs()

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      controller.abort()
      observer.disconnect()
      resizeObserver.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
      pending.clear()
      observed.clear()
      initialized = false
    })
  }
}
