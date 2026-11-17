import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { computed, reactive, ref } from 'vue'
import { useSalesCustomers } from '@/views/sales/useSalesCustomers'
import type { BatchSaleFormData, SalesCheckoutFormData } from '@/views/sales/types'

const customerRights = reactive({ create: true, edit: true })
vi.mock('@/composables/usePagePermissions', () => ({ usePagePermissions: () => ({
  canCreate: computed(() => customerRights.create), canEdit: computed(() => customerRights.edit),
  requirePermission: (action: 'create' | 'edit') => customerRights[action]
}) }))
beforeEach(() => { customerRights.create = customerRights.edit = true })

const api = vi.hoisted(() => ({ put: vi.fn(), post: vi.fn() }))
const notification = vi.hoisted(() => ({ prompt: vi.fn(), warning: vi.fn(), error: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: api }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => notification }))
vi.mock('@/services/customer-options', () => ({ searchCustomerOptions: vi.fn() }))

function editor(batch: boolean) {
  const common = {
    customer_name: '旧姓名', customer_phone: '', sale_price: '', store_id: '', operator_id: '',
    sale_time: '', payment_method: '', payment_channel: '', transaction_no: '', remarks: ''
  }
  const saleForm = reactive<SalesCheckoutFormData>({ ...common, customer_apple_id: '', purchase_cost: '' })
  const batchSaleForm = reactive<BatchSaleFormData>({ ...common, apple_id: '' })
  const saleVisible = ref(true), batchSaleVisible = ref(true)
  const showError = vi.fn(), showSuccess = vi.fn()
  const state = useSalesCustomers({
    saleForm, batchSaleForm, saleVisible, batchSaleVisible,
    saleCustomerNameInputRef: ref(null), batchCustomerNameInputRef: ref(null),
    isIOS: () => true, showError, showSuccess
  })
  const selected = batch ? state.selectedBatchCustomer : state.selectedCustomer
  const editing = batch ? state.batchCustomerNameEditing : state.customerNameEditing
  const form = batch ? batchSaleForm : saleForm
  selected.value = { id: 1, name: '旧姓名', phone: '', address: '', total_orders: 0, total_amount: 0, status: 1 }
  editing.value = true
  const touch = batch ? state.handleBatchCustomerNameTouchEnd : state.handleCustomerNameTouchEnd
  return {
    ...state, selected, editing, form, showError, showSuccess,
    visible: batch ? batchSaleVisible : saleVisible,
    save: batch ? state.saveBatchCustomerNameEdit : state.saveCustomerNameEdit,
    doubleTap: () => {
      let now = 1000
      vi.spyOn(Date, 'now').mockImplementation(() => now)
      touch(new Event('touchend') as TouchEvent)
      now = 1100
      touch(new Event('touchend') as TouchEvent)
    }
  }
}

afterEach(() => vi.resetAllMocks())

describe.each([false, true])('销售姓名保存，批量模式=%s', batch => {
  it('仅销售权限不能改名或创建客户', async () => {
    const view = editor(batch)
    customerRights.edit = customerRights.create = false
    view.form.customer_name = '新姓名'
    view.editing.value = false
    if (batch) view.enableBatchCustomerNameEdit()
    else view.enableCustomerNameEdit()
    expect(view.editing.value).toBe(false)
    await view.save()
    view.doubleTap()
    expect(notification.prompt).not.toHaveBeenCalled()
    if (batch) await view.createNewBatchCustomer()
    else await view.createNewCustomer()
    expect(api.put).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('等待iOS姓名确认期间撤权，不能修改草稿或提交', async () => {
    const view = editor(batch)
    let confirm!: (value: { value: string }) => void
    notification.prompt.mockReturnValue(new Promise(resolve => { confirm = resolve }))
    view.doubleTap()
    customerRights.edit = false
    confirm({ value: '新姓名' })
    await flushPromises()
    expect(view.form.customer_name).toBe('旧姓名')
    expect(api.put).not.toHaveBeenCalled()
  })

  it('保存失败保留草稿和编辑状态，重试成功后退出编辑', async () => {
    const view = editor(batch)
    view.form.customer_name = '新姓名'
    api.put.mockResolvedValueOnce({ success: false, message: '保存失败' }).mockResolvedValueOnce({ success: true })
    await view.save()
    expect(view.form.customer_name).toBe('新姓名')
    expect(view.selected.value?.name).toBe('旧姓名')
    expect(view.editing.value).toBe(true)
    expect(view.showError).toHaveBeenCalledWith('保存失败')
    await view.save()
    expect(view.selected.value?.name).toBe('新姓名')
    expect(view.editing.value).toBe(false)
  })

  it('等待回包时防重复提交，切换客户后不覆盖新客户或草稿', async () => {
    const view = editor(batch)
    let finish!: (value: { success: boolean }) => void
    api.put.mockReturnValue(new Promise(resolve => { finish = resolve }))
    view.form.customer_name = '已提交姓名'
    const oldCustomer = view.selected.value!
    const pending = view.save()
    await view.save()
    expect(api.put).toHaveBeenCalledExactlyOnceWith('/customers/1', { name: '已提交姓名' })
    view.selected.value = { ...oldCustomer, id: 2, name: '其他客户' }
    view.form.customer_name = '其他草稿'
    finish({ success: true })
    await pending
    expect(oldCustomer.name).toBe('已提交姓名')
    expect(view.selected.value.name).toBe('其他客户')
    expect(view.form.customer_name).toBe('其他草稿')
    expect(view.editing.value).toBe(true)
    expect(view.showSuccess).not.toHaveBeenCalled()
  })

  it('同一客户继续编辑时，旧回包不退出新草稿的编辑状态', async () => {
    const view = editor(batch)
    let finish!: (value: { success: boolean }) => void
    api.put.mockReturnValue(new Promise(resolve => { finish = resolve }))
    view.form.customer_name = '已提交姓名'
    const pending = view.save()
    view.form.customer_name = '继续编辑'
    finish({ success: true })
    await pending
    expect(view.form.customer_name).toBe('继续编辑')
    expect(view.editing.value).toBe(true)
  })

  it('取消姓名输入不发送更新请求', async () => {
    const view = editor(batch)
    notification.prompt.mockResolvedValue(null)
    view.doubleTap()
    await flushPromises()
    expect(notification.prompt).toHaveBeenCalledTimes(1)
    expect(api.put).not.toHaveBeenCalled()
    expect(view.form.customer_name).toBe('旧姓名')
  })

  it.each(['关闭弹窗', '切换客户'])('输入期间%s后确认，不再提交失效流程', async action => {
    const view = editor(batch)
    let finish!: (value: { value: string }) => void
    notification.prompt.mockReturnValue(new Promise(resolve => { finish = resolve }))
    view.doubleTap()
    if (action === '关闭弹窗') view.visible.value = false
    else view.selected.value = { ...view.selected.value!, id: 2 }
    finish({ value: '确认姓名' })
    await flushPromises()
    expect(api.put).not.toHaveBeenCalled()
    expect(view.form.customer_name).toBe('旧姓名')
  })
})
