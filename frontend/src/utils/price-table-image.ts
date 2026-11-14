/** 报价图片克隆布局与水印位置；仅操作 html2canvas 的克隆文档。 */
// 固定安全区域并轻微倾斜，避免随机位置靠近边缘导致水印被裁剪。
interface WatermarkPosition {
  top: number
  left: number
  right: number
  rotation: number
}

export const generateRandomWatermarkPositions = (): WatermarkPosition[] => {
  return Array.from({ length: 3 }, () => ({
    // 12%-72% 的安全区间保留随机性，同时避开上下边缘。
    top: Math.floor(Math.random() * 61) + 12,
    left: 8,
    right: 8,
    rotation: -8
  }))
}

// Safari 对 html2canvas 克隆后的表格布局会重新计算，显式固定生成图宽度和五列宽度，避免价格列被裁切。
export const applyPriceTableImageStyles = (clonedDocument: Document, captureWidth: number) => {
  const results = clonedDocument.querySelector<HTMLElement>('.results-list.generating-image')
  const tableWrapper = results?.querySelector<HTMLElement>('.table-wrapper')
  const table = tableWrapper?.querySelector<HTMLElement>('.el-table')
  if (!results || !tableWrapper || !table) return

  const width = `${captureWidth}px`
  let ancestor = results.parentElement
  while (ancestor && ancestor !== clonedDocument.documentElement) {
    ancestor.style.setProperty('overflow', 'visible', 'important')
    if (ancestor.matches('.container, .results-section, .public-price-query, #app')) {
      ancestor.style.setProperty('width', width, 'important')
      ancestor.style.setProperty('min-width', width, 'important')
      ancestor.style.setProperty('max-width', 'none', 'important')
    }
    if (ancestor.matches('.public-price-query')) {
      ancestor.style.setProperty('position', 'static', 'important')
      ancestor.style.setProperty('height', 'auto', 'important')
      ancestor.style.setProperty('min-height', '0', 'important')
    }
    ancestor = ancestor.parentElement
  }

  clonedDocument.documentElement.style.setProperty('overflow', 'visible', 'important')
  clonedDocument.body.style.setProperty('overflow', 'visible', 'important')
  results.style.setProperty('width', width, 'important')
  results.style.setProperty('min-width', width, 'important')
  results.style.setProperty('max-width', width, 'important')
  results.style.setProperty('box-sizing', 'border-box', 'important')
  results.style.setProperty('overflow', 'visible', 'important')
  tableWrapper.style.setProperty('width', width, 'important')
  tableWrapper.style.setProperty('box-sizing', 'border-box', 'important')
  tableWrapper.style.setProperty('padding', '0', 'important')
  tableWrapper.style.setProperty('overflow', 'visible', 'important')
  table.style.setProperty('display', 'block', 'important')
  table.style.setProperty('width', width, 'important')
  table.style.setProperty('min-width', width, 'important')
  table.style.setProperty('box-sizing', 'border-box', 'important')
  table.style.setProperty('overflow', 'visible', 'important')

  table.querySelectorAll<HTMLElement>('.el-table__inner-wrapper, .el-table__header-wrapper, .el-table__body-wrapper').forEach((wrapper) => {
    wrapper.style.setProperty('width', width, 'important')
    wrapper.style.setProperty('min-width', width, 'important')
    wrapper.style.setProperty('box-sizing', 'border-box', 'important')
    wrapper.style.setProperty('overflow', 'visible', 'important')
  })
  table.querySelectorAll<HTMLElement>('.el-scrollbar, .el-scrollbar__wrap, .el-scrollbar__view').forEach((scrollContainer) => {
    scrollContainer.style.setProperty('width', width, 'important')
    scrollContainer.style.setProperty('min-width', width, 'important')
    scrollContainer.style.setProperty('max-width', width, 'important')
    scrollContainer.style.setProperty('box-sizing', 'border-box', 'important')
    scrollContainer.style.setProperty('margin', '0', 'important')
    scrollContainer.style.setProperty('overflow', 'visible', 'important')
  })
  table.querySelectorAll<HTMLElement>('.el-scrollbar__bar').forEach((scrollbar) => {
    scrollbar.style.setProperty('display', 'none', 'important')
  })
  const innerWrapper = table.querySelector<HTMLElement>('.el-table__inner-wrapper')
  innerWrapper?.style.setProperty('position', 'relative', 'important')
  innerWrapper?.style.setProperty('border', '1px solid var(--el-table-border-color, var(--tf-color-gray-200-alt))', 'important')
  const captureTableStyle = clonedDocument.createElement('style')
  captureTableStyle.textContent = `
    .results-list.generating-image .el-table::before,
    .results-list.generating-image .el-table::after,
    .results-list.generating-image .el-table__inner-wrapper::before,
    .results-list.generating-image .el-table__inner-wrapper::after,
    .results-list.generating-image .el-table__header-wrapper::before,
    .results-list.generating-image .el-table__header-wrapper::after,
    .results-list.generating-image .el-table__header::before,
    .results-list.generating-image .el-table__header::after,
    .results-list.generating-image .el-table__header tr::before,
    .results-list.generating-image .el-table__header tr::after,
    .results-list.generating-image .el-table__header th::before,
    .results-list.generating-image .el-table__header th::after {
      content: none !important;
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      position: static !important;
      inset: auto !important;
      width: 0 !important;
      height: 0 !important;
      background: none !important;
      background-image: none !important;
      border: 0 !important;
      box-shadow: none !important;
    }
    .results-list.generating-image .el-table__header,
    .results-list.generating-image .el-table__header tr,
    .results-list.generating-image .el-table__header th,
    .results-list.generating-image .el-table__header td,
    .results-list.generating-image .el-table__header-wrapper,
    .results-list.generating-image .el-table__header-wrapper * {
      box-shadow: none !important;
    }
  `
  clonedDocument.head.appendChild(captureTableStyle)
  const rootStyle = clonedDocument.defaultView?.getComputedStyle(clonedDocument.documentElement)
  const headerBackground = rootStyle?.getPropertyValue('--admin-data-table-header-bg').trim()
    || 'linear-gradient(135deg, #495057 0%, #343a40 100%)'
  const headerColor = rootStyle?.getPropertyValue('--admin-data-table-header-color').trim() || '#ffffff'
  table.querySelectorAll<HTMLElement>('.el-table__header th').forEach((cell) => {
    cell.style.setProperty('background', headerBackground, 'important')
    cell.style.setProperty('color', headerColor, 'important')
    cell.querySelector<HTMLElement>('.cell')?.style.setProperty('color', headerColor, 'important')
  })
  const headerWrapper = table.querySelector<HTMLElement>('.el-table__header-wrapper')
  if (headerWrapper) {
    headerWrapper.style.setProperty('position', 'relative', 'important')
    // 与正常页面一致，表头容器裁剪掉位于底部之外的伪元素。
    headerWrapper.style.setProperty('overflow', 'hidden', 'important')
  }
  table.querySelectorAll<HTMLElement>('.el-table__header, .el-table__header tr, .el-table__header th').forEach((element) => {
    element.style.setProperty('box-shadow', 'none', 'important')
  })
  if (innerWrapper) {
    const rightBorder = clonedDocument.createElement('span')
    rightBorder.setAttribute('aria-hidden', 'true')
    rightBorder.style.cssText = 'position:absolute;top:0;right:0;bottom:0;width:2px;background:var(--el-table-border-color,var(--tf-color-gray-200-alt));z-index:10000;pointer-events:none;'
    innerWrapper.appendChild(rightBorder)
  }
  // Element Plus 会为纵向滚动条渲染 gutter 占位列。截图时直接移除，避免 Safari 仍把它计入表格布局。
  table.querySelectorAll<HTMLElement>('.gutter, col.gutter, col[name="gutter"]').forEach((gutter) => gutter.remove())

  const columnWidths = ['14%', '27%', '14%', '16%', '29%']
  table.querySelectorAll<HTMLTableElement>('table').forEach((innerTable) => {
    innerTable.style.setProperty('display', 'table', 'important')
    innerTable.style.setProperty('width', width, 'important')
    innerTable.style.setProperty('min-width', width, 'important')
    innerTable.style.setProperty('table-layout', 'fixed', 'important')
    innerTable.querySelectorAll<HTMLTableColElement>('col').forEach((column, index) => {
      const columnWidth = columnWidths[index]
      if (!columnWidth) return
      column.style.setProperty('width', columnWidth, 'important')
      column.style.setProperty('min-width', '0', 'important')
    })
  })

  table.querySelectorAll<HTMLElement>('.el-table__header, .el-table__body').forEach((innerTable) => {
    innerTable.style.setProperty('display', 'table', 'important')
    innerTable.style.setProperty('width', width, 'important')
  })
  table.querySelectorAll<HTMLElement>('.el-table__header th:last-child, .el-table__body td:last-child').forEach((cell) => {
    cell.style.setProperty('border-right', '1px solid var(--el-table-border-color, var(--tf-color-gray-200-alt))', 'important')
  })
  table.querySelectorAll<HTMLElement>('.el-table__cell, .cell, .price').forEach((cell) => {
    cell.style.setProperty('box-sizing', 'border-box', 'important')
    cell.style.setProperty('white-space', 'nowrap', 'important')
    cell.style.setProperty('word-break', 'keep-all', 'important')
    cell.style.setProperty('overflow', 'visible', 'important')
    cell.style.setProperty('text-overflow', 'clip', 'important')
  })
}

