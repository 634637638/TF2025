import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { initAdminTableDragScroll } from '@/utils/admin-table-drag-scroll'

const pointer = (target: Element | Document, type: string, x: number, pointerType = 'mouse') => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    clientX: { value: x }, clientY: { value: 0 }, button: { value: 0 }, pointerType: { value: pointerType }
  })
  target.dispatchEvent(event)
  return event
}

const scrollable = (element: HTMLElement, width = 500) => {
  Object.defineProperties(element, { clientWidth: { value: 100 }, scrollWidth: { value: width } })
  return element
}

let finePointer = true

describe('统一表格横向拖动', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: finePointer })
    })
    initAdminTableDragScroll()
  })
  beforeEach(() => {
    window.dispatchEvent(new Event('blur'))
    finePointer = true
    pointer(document, 'pointerup', 0)
    document.body.innerHTML = ''
  })

  it('外层宽表容器复用全局拖动，保留阈值并在窗口失焦时清理', () => {
    document.body.innerHTML = '<div data-table-drag-scroll><span>销售明细</span></div>'
    const wrapper = scrollable(document.body.firstElementChild as HTMLElement)
    const cell = wrapper.querySelector('span')!
    wrapper.scrollLeft = 20
    pointer(cell, 'pointerdown', 100)
    expect(pointer(cell, 'pointermove', 98).defaultPrevented).toBe(false)
    expect(wrapper.scrollLeft).toBe(20)
    expect(pointer(cell, 'pointermove', 60).defaultPrevented).toBe(true)
    expect(wrapper.scrollLeft).toBe(60)
    expect(wrapper.classList.contains('is-admin-table-dragging')).toBe(true)
    window.dispatchEvent(new Event('blur'))
    expect(wrapper.classList.contains('is-admin-table-dragging')).toBe(false)
    pointer(cell, 'pointermove', 20)
    expect(wrapper.scrollLeft).toBe(60)
  })

  it('触摸、按钮和无溢出容器不被鼠标拖动接管', () => {
    document.body.innerHTML = '<div data-table-drag-scroll><button>查看</button><span>明细</span></div>'
    const wrapper = scrollable(document.body.firstElementChild as HTMLElement)
    const button = wrapper.querySelector('button')!
    const cell = wrapper.querySelector('span')!
    pointer(button, 'pointerdown', 100)
    pointer(button, 'pointermove', 60)
    pointer(cell, 'pointerdown', 100, 'touch')
    pointer(cell, 'pointermove', 60, 'touch')
    expect(wrapper.scrollLeft).toBe(0)
    const plain = scrollable(document.createElement('div'), 100)
    plain.setAttribute('data-table-drag-scroll', '')
    document.body.appendChild(plain)
    pointer(plain, 'pointerdown', 100)
    pointer(plain, 'pointermove', 60)
    expect(plain.scrollLeft).toBe(0)
  })

  it('Shift + 滚轮仅对显式宽表容器转为横向滚动', () => {
    document.body.innerHTML = '<div data-table-drag-scroll><span>明细</span></div>'
    const wrapper = scrollable(document.body.firstElementChild as HTMLElement)
    const normal = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 30 })
    wrapper.dispatchEvent(normal)
    expect(normal.defaultPrevented).toBe(false)
    const shift = new WheelEvent('wheel', { bubbles: true, cancelable: true, shiftKey: true, deltaY: 30 })
    wrapper.dispatchEvent(shift)
    expect(shift.defaultPrevented).toBe(true)
    expect(wrapper.scrollLeft).toBe(30)
  })

  it('原 Element Plus 表格仍拖动真实滚动层并同步表头', () => {
    document.body.innerHTML = '<div class="data-table"><div class="el-table__header-wrapper"><span>表头</span></div><div class="el-scrollbar__wrap"></div></div>'
    const scroller = scrollable(document.querySelector<HTMLElement>('.el-scrollbar__wrap')!)
    const header = document.querySelector<HTMLElement>('.el-table__header-wrapper')!
    const cell = header.querySelector('span')!
    pointer(cell, 'pointerdown', 100)
    pointer(cell, 'pointermove', 60)
    expect(scroller.scrollLeft).toBe(40)
    expect(header.scrollLeft).toBe(40)
    pointer(cell, 'pointerup', 60)
    expect(scroller.classList.contains('is-admin-table-dragging')).toBe(false)
  })

  it('纵向滚动不触发表格横向同步或 hover 布局扫描', () => {
    document.body.innerHTML = '<div class="data-table"><div class="el-table__header-wrapper"></div><div class="el-scrollbar__wrap"><div class="el-table__body-wrapper"><table class="el-table__body"><tbody><tr class="el-table__row"><td>报价</td></tr></tbody></table></div></div></div>'
    const scroller = document.querySelector<HTMLElement>('.el-scrollbar__wrap')!
    const header = document.querySelector<HTMLElement>('.el-table__header-wrapper')!
    const row = document.querySelector<HTMLElement>('.el-table__row')!
    const getBoundingClientRect = vi.spyOn(row, 'getBoundingClientRect')

    finePointer = false
    Object.defineProperty(scroller, 'scrollTop', { value: 120, configurable: true })
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))

    expect(header.scrollLeft).toBe(0)
    expect(getBoundingClientRect).not.toHaveBeenCalled()
    getBoundingClientRect.mockRestore()
  })

  it('触摸设备上的兼容 pointer 事件不更新整行 hover 状态', () => {
    document.body.innerHTML = '<div class="data-table"><div class="el-table__body-wrapper"><table class="el-table__body"><tbody><tr class="el-table__row"><td>报价</td></tr></tbody></table></div></div>'
    const row = document.querySelector<HTMLElement>('.el-table__row')!
    finePointer = false
    pointer(row, 'pointermove', 10, 'touch')
    expect(row.classList.contains('is-admin-table-row-hover')).toBe(false)
  })

  it('首次纵向滚动不会重设分离渲染的表头横向位置', () => {
    document.body.innerHTML = '<div class="data-table"><div class="el-table__header-wrapper"></div><div class="el-scrollbar__wrap"></div></div>'
    const table = document.querySelector<HTMLElement>('.data-table')!
    const scroller = document.querySelector<HTMLElement>('.el-scrollbar__wrap')!
    const querySelectorAll = vi.spyOn(table, 'querySelectorAll')

    Object.defineProperty(scroller, 'scrollTop', { value: 120, configurable: true })
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))

    expect(querySelectorAll).not.toHaveBeenCalled()
    querySelectorAll.mockRestore()
  })

  const touchTable = () => {
    finePointer = false
    document.body.innerHTML = '<div class="data-table"><div class="el-table__body-wrapper"><div class="el-scrollbar__wrap"><table class="el-table__body"><tbody><tr class="el-table__row"><td>报价一</td></tr><tr class="el-table__row row-selected"><td>报价二<button>编辑</button></td></tr></tbody></table></div></div></div>'
    const rows = [...document.querySelectorAll<HTMLElement>('.el-table__row')]
    const wrapper = document.querySelector<HTMLElement>('.el-table__body-wrapper')!
    wrapper.getBoundingClientRect = () => new DOMRect(0, 0, 300, 80)
    rows.forEach((row, index) => { row.getBoundingClientRect = () => new DOMRect(0, index * 40, 300, 40) })
    return { rows, wrapper, scroller: document.querySelector<HTMLElement>('.el-scrollbar__wrap')! }
  }

  it('手机轻触整行恢复外包围，切换行不改变勾选或拦截点击', () => {
    const { rows, wrapper } = touchTable()
    expect(pointer(rows[0], 'pointerdown', 10, 'touch').defaultPrevented).toBe(false)
    expect(pointer(rows[0], 'pointerup', 10, 'touch').defaultPrevented).toBe(false)
    expect(rows[0].classList.contains('is-admin-table-row-hover')).toBe(true)
    expect(wrapper.classList.contains('is-admin-table-row-framed')).toBe(true)
    expect(rows[0].classList.contains('row-selected')).toBe(false)
    pointer(rows[1], 'pointerdown', 10, 'touch')
    pointer(rows[1], 'pointerup', 10, 'touch')
    expect(rows[0].classList.contains('is-admin-table-row-hover')).toBe(false)
    expect(rows[1].classList.contains('is-admin-table-row-hover')).toBe(true)
    expect(rows[1].classList.contains('row-selected')).toBe(true)
  })

  it('手机滑动不画行外包围，滚动会清理轻触反馈且不测量行布局', () => {
    const { rows, wrapper, scroller } = touchTable()
    const measure = vi.spyOn(rows[0], 'getBoundingClientRect')
    pointer(rows[0], 'pointerdown', 10, 'touch')
    pointer(rows[0], 'pointermove', 40, 'touch')
    pointer(rows[0], 'pointerup', 10, 'touch')
    expect(rows[0].classList.contains('is-admin-table-row-hover')).toBe(false)
    expect(measure).not.toHaveBeenCalled()
    pointer(rows[0], 'pointerdown', 10, 'touch')
    pointer(rows[0], 'pointerup', 10, 'touch')
    expect(wrapper.classList.contains('is-admin-table-row-framed')).toBe(true)
    measure.mockClear()
    scroller.dispatchEvent(new Event('scroll'))
    expect(wrapper.classList.contains('is-admin-table-row-framed')).toBe(false)
    expect(rows[0].classList.contains('is-admin-table-row-hover')).toBe(false)
    expect(measure).not.toHaveBeenCalled()
    measure.mockRestore()
  })

  it('操作按钮、触摸取消和窗口失焦不会留下行外包围', () => {
    const { rows, wrapper } = touchTable()
    const button = rows[1].querySelector('button')!
    pointer(button, 'pointerdown', 10, 'touch')
    pointer(button, 'pointerup', 10, 'touch')
    expect(wrapper.classList.contains('is-admin-table-row-framed')).toBe(false)
    pointer(rows[0], 'pointerdown', 10, 'touch')
    pointer(rows[0], 'pointercancel', 10, 'touch')
    pointer(rows[0], 'pointerup', 10, 'touch')
    expect(wrapper.classList.contains('is-admin-table-row-framed')).toBe(false)
    pointer(rows[0], 'pointerdown', 10, 'touch')
    pointer(rows[0], 'pointerup', 10, 'touch')
    expect(wrapper.classList.contains('is-admin-table-row-framed')).toBe(true)
    window.dispatchEvent(new Event('blur'))
    expect(wrapper.classList.contains('is-admin-table-row-framed')).toBe(false)
  })
})
