import { describe, expect, it } from 'vitest'
import { applyPriceTableImageStyles, generateRandomWatermarkPositions } from '@/utils/price-table-image'

describe('报价图片公共克隆布局', () => {
  it('只改变克隆文档，固定五列并移除滚动占位，保留联系人布局', () => {
    const original = document.implementation.createHTMLDocument('原报价')
    original.body.innerHTML = '<div id="app"><div class="public-price-query"><div class="container"><div class="results-list generating-image"><div class="contacts">客户电话</div><div class="table-wrapper"><div class="el-table"><div class="el-table__inner-wrapper"><div class="el-table__header-wrapper"><table class="el-table__header"><colgroup><col><col><col><col><col><col class="gutter"></colgroup><tr><th><div class="cell">价格</div></th></tr></table></div><div class="el-scrollbar__wrap"><table class="el-table__body"><tr><td class="price">225.02</td></tr></table></div><div class="el-scrollbar__bar"></div></div></div></div></div></div></div></div>'
    const clone = original.cloneNode(true) as Document
    applyPriceTableImageStyles(clone, 430)
    expect(original.querySelector<HTMLElement>('.results-list')!.style.width).toBe('')
    expect(clone.querySelector<HTMLElement>('.results-list')!.style.width).toBe('430px')
    expect(clone.querySelector('.gutter')).toBeNull()
    expect(Array.from(clone.querySelectorAll<HTMLTableColElement>('col')).map(col => col.style.width)).toEqual(['14%', '27%', '14%', '16%', '29%'])
    expect(clone.querySelector<HTMLElement>('.el-scrollbar__bar')!.style.display).toBe('none')
    expect(clone.querySelector<HTMLElement>('.contacts')!.getAttribute('style')).toBeNull()
    expect(clone.querySelector<HTMLElement>('.public-price-query')!.style.position).toBe('static')
  })
  it('没有截图表格时不改页面；水印位置始终位于安全区域', () => {
    const clone = document.implementation.createHTMLDocument('无表格')
    expect(() => applyPriceTableImageStyles(clone, 430)).not.toThrow()
    expect(clone.body.getAttribute('style')).toBeNull()
    for (const position of generateRandomWatermarkPositions()) {
      expect(position.top).toBeGreaterThanOrEqual(12)
      expect(position.top).toBeLessThanOrEqual(72)
      expect(position.left).toBe(8)
      expect(position.right).toBe(8)
      expect(position.rotation).toBe(-8)
    }
  })
})
