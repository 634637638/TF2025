import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import { mount, shallowMount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import { vTableDoubleTap } from '@/directives/table-double-tap'
import RecordDetailDialog from '@/components/RecordDetailDialog.vue'
import RecordDescriptions from '@/components/RecordDescriptions.vue'
import { ElDescriptions, ElDescriptionsItem } from 'element-plus'
import type { RecordDetailField } from '@/types/component'
import type { SalaryTemplate } from '@/types/salary'
import SalaryTemplatesTab from '@/views/salary/page/SalaryTemplatesTab.vue'

interface Row { id: number; name: string }
const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
})

function render(onOpen?: (row: Row) => void) {
  const enabled = ref(true)
  const rows = ref<Row[]>([{ id: 4, name: '当前页甲' }, { id: 7, name: '当前页乙' }])
  let detail!: ReturnType<typeof useMobileTableDetail<Row>>
  // eslint-disable-next-line vue/one-component-per-file -- 独立挂载公共行为的测试宿主
  const Harness = defineComponent({
    directives: { tableDoubleTap: vTableDoubleTap },
    setup() {
      detail = useMobileTableDetail({ enabled, rows, getKey: row => row.id, onOpen })
      return { rows, options: detail.doubleTapOptions, doubleClick: detail.handleRowDoubleClick }
    },
    template: '<table v-table-double-tap="options" class="el-table"><tbody><tr v-for="row in rows" :key="row.id" class="el-table__row" @dblclick="doubleClick(row, null, $event)"><td><span>{{ row.name }}</span><button>操作</button><input /></td></tr></tbody></table>'
  })
  const wrapper = mount(Harness, { attachTo: document.body })
  wrappers.push(wrapper)
  return { wrapper, detail, enabled, rows }
}
function touch(target: Element, type: string, x = 20, y = 20, count = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const point = { identifier: 1, clientX: x, clientY: y }
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : Array.from({ length: count }, () => point) },
    changedTouches: { value: [point] }
  })
  target.dispatchEvent(event)
  return event
}
function tap(target: Element) { touch(target, 'touchstart'); return touch(target, 'touchend') }

describe('公共手机表格详情入口', () => {
  it('单击不打开、不选择；同行完整双击打开一次，兼容 dblclick 不重复触发', async () => {
    const open = vi.fn(), { wrapper } = render(open)
    const target = wrapper.find('td span').element
    await wrapper.find('td span').trigger('click')
    tap(target); expect(open).not.toHaveBeenCalled()
    expect(tap(target).defaultPrevented).toBe(true)
    await wrapper.find('td span').trigger('dblclick')
    expect(open).toHaveBeenCalledExactlyOnceWith({ id: 4, name: '当前页甲' })
    expect(wrapper.find('input').element.checked).toBe(false)
  })
  it('跨行、滑动、滚动、多指、取消与交互控件均不误开', async () => {
    const open = vi.fn(), { wrapper } = render(open)
    const [first, second] = wrapper.findAll('td span').map(node => node.element)
    tap(first); tap(second); expect(open).not.toHaveBeenCalled()
    touch(first, 'touchstart'); touch(first, 'touchmove', 80); touch(first, 'touchend', 80)
    tap(first); expect(open).not.toHaveBeenCalled()
    wrapper.element.dispatchEvent(new Event('scroll')); tap(first); expect(open).not.toHaveBeenCalled()
    touch(first, 'touchstart', 20, 20, 2); touch(first, 'touchend'); tap(first); expect(open).not.toHaveBeenCalled()
    touch(first, 'touchcancel'); tap(first); expect(open).not.toHaveBeenCalled()
    for (const node of wrapper.findAll('button,input')) { tap(node.element); tap(node.element); await node.trigger('dblclick') }
    expect(open).not.toHaveBeenCalled()
  })
  it('跨行的单次轻触收到浏览器兼容双击也不打开，新的同行双触正常打开', async () => {
    const open = vi.fn(), { wrapper } = render(open)
    const [first, second] = wrapper.findAll('td span')
    tap(first.element); tap(second.element)
    await second.trigger('dblclick')
    expect(open).not.toHaveBeenCalled()
    tap(second.element)
    expect(open).toHaveBeenCalledExactlyOnceWith({ id: 7, name: '当前页乙' })
  })
  it('分页排序以显示数组取记录，权限撤回、记录删除关闭详情，动作先关闭且不重复运行', async () => {
    const { wrapper, detail, rows, enabled } = render()
    rows.value = [{ id: 90, name: '翻页后' }, { id: 10, name: '排序后' }]; await nextTick()
    tap(wrapper.find('td span').element); tap(wrapper.find('td span').element); await nextTick()
    expect(detail.detailRow.value?.id).toBe(90)
    const action = vi.fn(() => expect(detail.detailVisible.value).toBe(false))
    detail.runDetailAction(action); detail.runDetailAction(action)
    expect(action).toHaveBeenCalledOnce()
    detail.doubleTapOptions.value.onDoubleTap(1); enabled.value = false; await nextTick()
    expect(detail.detailVisible.value).toBe(false)
    detail.runDetailAction(action); expect(action).toHaveBeenCalledOnce()
    enabled.value = true; await nextTick(); detail.doubleTapOptions.value.onDoubleTap(1)
    rows.value.splice(1, 1); await nextTick(); expect(detail.detailVisible.value).toBe(false)
  })
  it('替换可见行对象同步详情，不同记录之间换行不继承先前轻触', async () => {
    const { wrapper, detail, rows } = render()
    const first = wrapper.find('td span').element
    tap(first); rows.value = [{ id: 20, name: '新数据' }]; await nextTick(); tap(wrapper.find('td span').element)
    expect(detail.detailVisible.value).toBe(false)
    tap(wrapper.find('td span').element); await nextTick()
    rows.value = [{ id: 20, name: '已更新' }]; await nextTick()
    expect(detail.detailRow.value?.name).toBe('已更新')
  })
})

describe('公共卡片和嵌套记录入口', () => {
  it('双触只打开所属子列表，后续父记录索引不受嵌套记录影响，拖拽和标签不误开', async () => {
    const parentOpen = vi.fn(), childOpen = vi.fn()
    // eslint-disable-next-line vue/one-component-per-file -- 独立挂载嵌套手势的测试宿主
    const Harness = defineComponent({
      directives: { tableDoubleTap: vTableDoubleTap },
      setup() {
        const parent = useMobileTableDetail({ enabled: true, rows: [{ id: 1 }, { id: 2 }], getKey: row => row.id,
          rowSelector: '[data-mobile-record]', onOpen: parentOpen })
        const child = useMobileTableDetail({ enabled: true, rows: [{ id: 10 }], getKey: row => row.id,
          rowSelector: '[data-mobile-record]', onOpen: childOpen })
        return { parent, child }
      },
      template: `<section v-table-double-tap="parent.doubleTapOptions.value">
        <article data-mobile-record @dblclick="parent.handleRowDoubleClick({ id: 1 }, null, $event)">
          <span class="parent-label">父记录甲</span>
          <div v-table-double-tap="child.doubleTapOptions.value">
            <article data-mobile-record @dblclick="child.handleRowDoubleClick({ id: 10 }, null, $event)"><span class="child-label">子记录</span></article>
          </div>
        </article>
        <article data-mobile-record @dblclick="parent.handleRowDoubleClick({ id: 2 }, null, $event)"><span class="parent-second">父记录乙</span><span class="drag-handle">拖动</span><span class="el-tabs__header">标签</span></article>
      </section>`
    })
    const wrapper = mount(Harness, { attachTo: document.body }); wrappers.push(wrapper)
    const childTarget = wrapper.find('.child-label')
    tap(childTarget.element); tap(childTarget.element)
    expect(childOpen).toHaveBeenCalledExactlyOnceWith({ id: 10 }); expect(parentOpen).not.toHaveBeenCalled()
    // 子列表兼容原生 dblclick 被去重，父入口同样不接管冒泡。
    await childTarget.trigger('dblclick'); expect(parentOpen).not.toHaveBeenCalled()
    const second = wrapper.find('.parent-second')
    tap(second.element); tap(second.element)
    expect(parentOpen).toHaveBeenCalledExactlyOnceWith({ id: 2 })
    for (const node of wrapper.findAll('.drag-handle,.el-tabs__header')) { tap(node.element); tap(node.element); await node.trigger('dblclick') }
    expect(parentOpen).toHaveBeenCalledOnce()
  })
  it('纯原生双击嵌套子记录只由子列表处理', async () => {
    const parentOpen = vi.fn(), childOpen = vi.fn()
    // eslint-disable-next-line vue/one-component-per-file -- 独立挂载原生冒泡的测试宿主
    const Harness = defineComponent({
      directives: { tableDoubleTap: vTableDoubleTap },
      setup() {
        const parent = useMobileTableDetail({ enabled: true, rows: [{ id: 1 }], getKey: row => row.id, rowSelector: '[data-mobile-record]', onOpen: parentOpen })
        const child = useMobileTableDetail({ enabled: true, rows: [{ id: 10 }], getKey: row => row.id, rowSelector: '[data-mobile-record]', onOpen: childOpen })
        return { parent, child }
      },
      template: '<section v-table-double-tap="parent.doubleTapOptions.value"><article data-mobile-record @dblclick="parent.handleRowDoubleClick({ id: 1 }, null, $event)"><div v-table-double-tap="child.doubleTapOptions.value"><article data-mobile-record @dblclick="child.handleRowDoubleClick({ id: 10 }, null, $event)"><span>子记录</span></article></div></article></section>'
    })
    const wrapper = mount(Harness); wrappers.push(wrapper)
    await wrapper.find('span').trigger('dblclick')
    expect(childOpen).toHaveBeenCalledExactlyOnceWith({ id: 10 }); expect(parentOpen).not.toHaveBeenCalled()
  })
})

describe('公共只读详情字段及底部操作', () => {
  it('工资模板隐藏金额且响应省略该值时仍可双击查看，只显示允许字段', async () => {
    const template: SalaryTemplate = { id: 8, name: '字段受限模板', base_salary: 0,
      overtime_hourly_rate: 0, rest_days: 2, commission_type: 'fixed' }
    Reflect.deleteProperty(template, 'base_salary')
    Reflect.deleteProperty(template, 'overtime_hourly_rate')
    const wrapper = shallowMount(SalaryTemplatesTab, {
      props: { templates: [template], filteredTemplates: [template], canDelete: false, canEdit: false,
        canViewField: (_module, field) => field === 'template_name', getEmployeeCount: () => 0,
        isMobile: true, loading: false, page: 1, pageSize: 20, searchExpanded: false, searchText: '' },
      global: { components: { RecordDetailDialog }, directives: { 'tf-loading': {}, 'table-double-tap': {} },
        stubs: { ElTabPane: { template: '<section><slot /></section>' },
          ElTable: { name: 'ElTable', template: '<div />', emits: ['row-dblclick'] } }
      }
    })
    wrappers.push(wrapper)
    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('row-dblclick', template, null, new MouseEvent('dblclick'))
    await nextTick()
    const detail = wrapper.findComponent(RecordDetailDialog)
    expect(detail.props('modelValue')).toBe(true)
    expect(detail.props('hasActions')).toBe(false)
    expect(detail.props('fields').filter(field => field.visible).map(field => field.value)).toEqual(['字段受限模板'])
  })
  it('描述列表手机标签置顶且保持两列，桌面恢复原列数和方向，属性与插槽不丢失', async () => {
    vi.stubGlobal('innerWidth', 375)
    const wrapper = mount(RecordDescriptions, {
      props: { column: 3, direction: 'horizontal' }, attrs: { border: true, title: '合同详情' },
      slots: {
        default: () => [h(ElDescriptionsItem, { label: '编号' }, () => 'TEST-1'),
          h(ElDescriptionsItem, { label: '备注', span: 2 }, () => '长备注')],
        extra: () => h('span', '业务扩展')
      }, global: { components: { ElDescriptions } }
    })
    wrappers.push(wrapper)
    await nextTick()
    const descriptions = wrapper.findComponent(ElDescriptions)
    expect(descriptions.props()).toMatchObject({ column: 2, direction: 'vertical', border: true })
    expect(wrapper.text()).toContain('TEST-1')
    expect(wrapper.text()).toContain('合同详情')
    expect(wrapper.text()).toContain('业务扩展')
    expect(wrapper.findAll('td').some(cell => cell.attributes('colspan') === '2')).toBe(true)
    vi.stubGlobal('innerWidth', 1440)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(descriptions.props()).toMatchObject({ column: 3, direction: 'horizontal' })
  })
  it('紧凑描述列表手机标签与内容同行，长字段跨列，撤销紧凑参数后恢复默认布局', async () => {
    vi.stubGlobal('innerWidth', 390)
    const wrapper = mount(RecordDescriptions, {
      props: { column: 2, compact: true }, attrs: { border: true },
      slots: { default: () => [
        h(ElDescriptionsItem, { label: '商品类型' }, () => '充电头'),
        h(ElDescriptionsItem, { label: '品牌' }, () => '苹果'),
        h(ElDescriptionsItem, { label: '配件型号', span: 2 }, () => 'MWVW3CH')
      ] }
    })
    wrappers.push(wrapper)
    await nextTick()
    expect(wrapper.findComponent(ElDescriptions).props()).toMatchObject({ column: 2, direction: 'horizontal', size: 'small' })
    const label = wrapper.findAll('.el-descriptions__label').find(cell => cell.text() === '配件型号')!
    expect(label.element.nextElementSibling?.textContent).toBe('MWVW3CH')
    expect(label.element.nextElementSibling?.getAttribute('colspan')).toBe('3')
    await wrapper.setProps({ compact: false })
    expect(wrapper.findComponent(ElDescriptions).props('direction')).toBe('vertical')
  })
  it('权限隐藏字段不泄露，零和 false 保留，长字段整行，无动作不创建 footer', async () => {
    const fields = shallowRef<RecordDetailField[]>([
      { key: 'name', label: '名称', value: '只读记录', visible: true },
      { key: 'zero', label: '数量', value: 0, visible: true },
      { key: 'false', label: '标记', value: false, visible: true },
      { key: 'empty', label: '空值', value: '', visible: true },
      { key: 'secret', label: '隐藏字段', value: '不可泄露', visible: false },
      { key: 'remark', label: '备注', value: '长内容', visible: true, wide: true }
    ])
    const hasActions = ref(false), open = ref(true), action = vi.fn()
    // eslint-disable-next-line vue/one-component-per-file -- 独立挂载公共行为的测试宿主
    const Harness = defineComponent({ setup: () => () => h(RecordDetailDialog<Row>, {
      modelValue: open.value, title: '详情', fields: fields.value, hasActions: hasActions.value,
      record: { id: 4, name: '只读记录' }, 'onUpdate:modelValue': value => { open.value = value }
    }, { actions: ({ row }: { row: Row }) => h('button', { onClick: () => action(row) }, '编辑') }) })
    const wrapper = mount(Harness, { global: { stubs: {
      MobileDialog: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></section>' },
      DataEmptyState: { template: '<div>暂无可查看的字段</div>' }
    } } })
    wrappers.push(wrapper)
    expect(wrapper.findAll('dd').map(node => node.text())).toEqual(['只读记录', '0', 'false', '-', '长内容'])
    expect(wrapper.text()).not.toContain('不可泄露'); expect(wrapper.find('footer').exists()).toBe(false)
    expect(wrapper.find('.tf-record-details__field--wide').text()).toContain('备注')
    hasActions.value = true; await nextTick(); await wrapper.find('footer button').trigger('click')
    expect(action).toHaveBeenCalledWith({ id: 4, name: '只读记录' })
    fields.value = []; hasActions.value = false; await nextTick()
    expect(wrapper.text()).toContain('暂无可查看的字段'); expect(wrapper.find('footer').exists()).toBe(false)
  })
})
