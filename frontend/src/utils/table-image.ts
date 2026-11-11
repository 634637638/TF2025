import { loadHtml2Canvas } from '@/utils/html2canvas'

const MAX_IMAGE_DIMENSION = 16384
const MAX_IMAGE_PIXELS = 16_000_000

export interface TableImageOptions {
  contextClass?: string
  omitSelector?: string
  prepareClone?: (capture: HTMLElement) => void
}

/** 只调整导出副本，按可见内容收紧列宽，保留页面字段权限与公共表格视觉。 */
export const createTableImage = async (source: HTMLElement, options: TableImageOptions = {}) => {
  const html2canvas = await loadHtml2Canvas()
  await document.fonts?.ready

  const capture = source.cloneNode(true)
  if (!(capture instanceof HTMLElement)) throw new Error('无法读取表格')
  capture.querySelectorAll(options.omitSelector ?? '.hide-in-capture').forEach(element => element.remove())
  options.prepareClone?.(capture)
  const tableRoot = capture.querySelector<HTMLElement>('.el-table')
  const tables = Array.from(capture.querySelectorAll<HTMLTableElement>('table'))
  if (!tableRoot || tables.length === 0) throw new Error('无法找到表格内容')

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.className = options.contextClass ?? ''
  // 离屏测量副本；不修改当前表格尺寸、滚动位置或响应式状态。
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', pointerEvents: 'none' })
  host.append(capture)
  document.body.append(host)

  try {
    capture.style.width = 'max-content'
    for (const [property, value] of Object.entries({ width: 'max-content', 'min-width': '0', 'max-width': 'none' })) {
      tableRoot.style.setProperty(property, value, 'important')
    }
    capture.querySelectorAll('.gutter, .el-scrollbar__bar').forEach(element => element.remove())
    capture.querySelectorAll<HTMLElement>('.el-scrollbar__wrap').forEach(wrap => {
      wrap.style.setProperty('overflow', 'visible', 'important')
      wrap.style.setProperty('height', 'auto', 'important')
      wrap.style.setProperty('max-height', 'none', 'important')
    })

    const cells = Array.from(capture.querySelectorAll<HTMLElement>('th .cell, td .cell'))
    cells.forEach(cell => {
      cell.style.setProperty('white-space', 'nowrap', 'important')
      cell.style.setProperty('width', 'max-content', 'important')
      cell.style.setProperty('max-width', 'none', 'important')
    })
    tables.forEach(table => {
      table.querySelectorAll('colgroup').forEach(group => group.remove())
      table.style.setProperty('width', 'max-content', 'important')
      table.style.tableLayout = 'auto'
    })

    const columnWidths: number[] = []
    capture.querySelectorAll<HTMLTableRowElement>('tr').forEach(row => {
      Array.from(row.cells).forEach((cell, index) => {
        columnWidths[index] = Math.max(columnWidths[index] ?? 0, Math.ceil(cell.getBoundingClientRect().width))
      })
    })
    const contentWidth = columnWidths.reduce((total, width) => total + width, 0)
    if (!contentWidth) throw new Error('无法读取表格尺寸')

    // 独立表头、表体使用相同列宽，避免按视口拉伸或横向滚动裁切。
    tables.forEach(table => {
      const group = document.createElement('colgroup')
      columnWidths.forEach(width => {
        const column = document.createElement('col')
        column.width = String(width)
        group.append(column)
      })
      table.prepend(group)
      table.style.setProperty('width', `${contentWidth}px`, 'important')
      table.style.tableLayout = 'fixed'
    })
    cells.forEach(cell => cell.style.setProperty('width', 'auto', 'important'))
    const captureStyle = getComputedStyle(capture)
    const outerWidth = ['padding-left', 'padding-right', 'border-left-width', 'border-right-width']
      .reduce((total, property) => total + (Number.parseFloat(captureStyle.getPropertyValue(property)) || 0), 0)
    capture.style.boxSizing = 'border-box'
    capture.style.width = `${contentWidth + 2 + Math.ceil(outerWidth)}px`
    capture.querySelectorAll<HTMLElement>('.table-responsive').forEach(container => {
      container.style.setProperty('width', '100%', 'important')
      container.style.setProperty('max-width', 'none', 'important')
      container.style.setProperty('overflow', 'visible', 'important')
    })
    tableRoot.style.setProperty('width', '100%', 'important')
    tableRoot.style.setProperty('max-width', '100%', 'important')

    const width = Math.ceil(capture.getBoundingClientRect().width)
    const height = Math.ceil(capture.getBoundingClientRect().height)
    if (!width || !height) throw new Error('无法读取表格尺寸')
    const scale = Math.min(
      Math.max(3, window.devicePixelRatio || 1),
      4,
      MAX_IMAGE_DIMENSION / Math.max(width, height),
      Math.sqrt(MAX_IMAGE_PIXELS / (width * height))
    )
    if (scale < 1) throw new Error('数据较多，请缩小筛选范围后保存图片')

    const canvas = await html2canvas(capture, {
      backgroundColor: getComputedStyle(tableRoot).backgroundColor,
      scale,
      width,
      height,
      logging: false,
      useCORS: true,
      allowTaint: false
    })
    // 直接保存原始高清 PNG，不再二次缩放画布。
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('生成图片失败')), 'image/png')
    })
    return { blob, width: canvas.width, height: canvas.height }
  } finally {
    host.remove()
  }
}
