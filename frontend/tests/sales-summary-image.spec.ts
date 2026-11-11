import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTableImage } from '@/utils/table-image'
import { createSettlementImage } from '@/views/payments/settlement-image'

const render = vi.hoisted(() => vi.fn<(element: HTMLElement, options: {
  width: number
  height: number
  scale: number
}) => Promise<HTMLCanvasElement>>())
vi.mock('@/utils/html2canvas', () => ({ loadHtml2Canvas: async () => render }))

const png = new Blob(['original high resolution PNG'], { type: 'image/png' })
let source: HTMLElement
let canvas: HTMLCanvasElement

beforeEach(() => {
  source = document.createElement('div')
  source.className = 'inventory-summary-capture'
  source.style.width = '1400px'
  source.innerHTML = '<div class="el-table"><div class="el-table__header-wrapper"><table><thead><tr><th><div class="cell">型号</div></th><th><div class="cell">内存</div></th></tr></thead></table></div><div class="el-table__body-wrapper"><table><tbody><tr><td><div class="cell">iPhone 17 Pro Max</div></td><td><div class="cell"><span class="memory-badge">8+256GB</span></div></td></tr></tbody></table></div></div>'
  document.body.append(source)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = this.matches('th, td')
      ? (this.textContent?.length ?? 0) * 8 + 20
      : Number.parseFloat(this.style.width) || 500
    return new DOMRect(0, 0, width, 144)
  })
  canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'toBlob').mockImplementation(callback => callback(png))
  render.mockImplementation(async (_element: HTMLElement, options: { width: number; height: number; scale: number }) => {
    canvas.width = Math.floor(options.width * options.scale)
    canvas.height = Math.floor(options.height * options.scale)
    return canvas
  })
})

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('销售对库图片导出', () => {
  it('按内容收紧宽度，原样保存高清 PNG 并保留字段和徽章', async () => {
    const before = source.outerHTML
    const result = await createTableImage(source)
    expect(result.blob).toBe(png)
    expect(result.width).toBe(canvas.width)
    expect(result.height).toBe(canvas.height)
    expect(result.width).toBeLessThan(1400)
    const [capture, options] = render.mock.calls[0]
    expect(capture).not.toBe(source)
    expect(capture.textContent).toBe(source.textContent)
    expect(capture.querySelector('.memory-badge')?.textContent).toBe('8+256GB')
    expect(result.width / options.width).toBe(3)
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(source.outerHTML).toBe(before)
    expect(document.querySelectorAll('.inventory-summary-capture')).toHaveLength(1)
  })

  it('等待 PNG 编码完成才返回导出结果', async () => {
    let complete: BlobCallback | undefined
    vi.mocked(canvas.toBlob).mockImplementation(callback => { complete = callback })
    let resolved = false
    const pending = createTableImage(source).then(result => { resolved = true; return result })
    await vi.waitFor(() => expect(complete).toBeDefined())
    expect(resolved).toBe(false)
    complete?.(png)
    expect((await pending).blob).toBe(png)
  })

  it('截图失败也清理副本并保持页面表格不变', async () => {
    const before = source.outerHTML
    render.mockRejectedValueOnce(new Error('截图失败'))
    await expect(createTableImage(source)).rejects.toThrow('截图失败')
    expect(source.outerHTML).toBe(before)
    expect(document.querySelectorAll('.inventory-summary-capture')).toHaveLength(1)
  })

  it('编码失败返回错误并清理副本', async () => {
    vi.mocked(canvas.toBlob).mockImplementation(callback => callback(null))
    await expect(createTableImage(source)).rejects.toThrow('生成图片失败')
    expect(document.querySelectorAll('.inventory-summary-capture')).toHaveLength(1)
  })
})

describe('货款结算核对图片', () => {
  it.each(['单个打款', '批量打款', '批次详情'])('%s 保留核对字段并移除利润及填写区', async mode => {
    const rows = mode === '批量打款' ? 2 : 1
    const labels = ['型号', '序列号', 'IMEI', '入库价格', '利润']
    const values = ['iPhone 17 Pro Max', 'SERIAL123456789', '123456789012345', '¥6,800.00', '内部利润500']
    const summaryHtml = mode === '批次详情'
      ? '<div class="payment-summary-cards payment-batch-summary-cards"><div class="info-row">核对供应商</div><div class="info-row">打款时间：2026-11-10</div><div class="info-row batch-summary-remarks">备注：核对备注</div><div class="info-row">支付方式：银行转账</div><div class="info-row">打款人：测试人员</div><div class="info-row">手机数量：1台</div><div class="info-row">总成本：6800</div><div class="info-row hide-in-capture">总销售：7300</div><div class="info-row hide-in-capture">内部总利润：500</div></div>'
      : '<div class="payment-summary-cards"><div class="info-row" style="grid-column: 1 / -1; width: 25%">核对供应商</div><div class="info-row">数量</div><div class="info-row">价格</div><div class="hide-in-capture">内部利润摘要</div></div>'
    source.innerHTML = `${summaryHtml}
      <div class="table-responsive"><div class="el-table">
        <table><thead><tr>${labels.map((label, index) => `<th${index === 4 ? ' class="hide-in-capture"' : ''}><div class="cell">${label}</div></th>`).join('')}</tr></thead></table>
        <table><tbody>${Array.from({ length: rows }, () => `<tr>${values.map((value, index) => `<td${index === 4 ? ' class="hide-in-capture"' : ''}><div class="cell">${value}</div></td>`).join('')}</tr>`).join('')}</tbody></table>
      </div></div>
      ${mode !== '批次详情' ? '<div class="payment-form-cards hide-in-capture">打款方式 打款时间 打款人 备注<input value="内部打款人"><textarea>内部备注</textarea></div>' : ''}`
    const before = source.outerHTML

    await createSettlementImage(source)

    const [capture] = render.mock.calls[0]
    expect(capture.querySelector('.payment-form-cards')).toBeNull()
    expect(capture.querySelector('input, textarea')).toBeNull()
    expect(capture.textContent).not.toContain('内部')
    values.slice(0, 4).forEach(value => expect(capture.textContent).toContain(value))
    expect(capture.querySelectorAll('th')).toHaveLength(4)
    expect(capture.querySelectorAll('tbody tr')).toHaveLength(rows)
    expect(Array.from(capture.querySelectorAll('colgroup')).map(group => group.children.length)).toEqual([4, 4])
    const summary = capture.querySelector<HTMLElement>('.payment-summary-cards')
    if (!summary) throw new Error('缺少结算摘要')
    if (mode === '批次详情') {
      expect(summary.children).toHaveLength(7)
      expect(summary.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
      expect(summary.querySelector<HTMLElement>('.batch-summary-remarks')?.style.gridColumn).toBe('1 / -1')
      expect(summary.textContent).not.toContain('总销售')
      for (const field of ['核对供应商', '打款时间：2026-11-10', '备注：核对备注', '支付方式：银行转账', '打款人：测试人员', '手机数量：1台', '总成本：6800']) {
        expect(summary.textContent).toContain(field)
      }
    } else {
      expect(summary.children).toHaveLength(3)
      expect(summary.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
      summary.querySelectorAll<HTMLElement>(':scope > .info-row').forEach(card => {
        expect(card.style.width).toBe('auto')
        expect(card.style.gridColumn).toBe('auto')
      })
    }
    expect(source.outerHTML).toBe(before)
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})
