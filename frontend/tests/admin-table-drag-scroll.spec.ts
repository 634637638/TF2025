import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
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

describe('统一表格横向拖动', () => {
  beforeAll(() => initAdminTableDragScroll())
  beforeEach(() => {
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
})
