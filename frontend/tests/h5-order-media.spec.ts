import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import OrdersView from '@/views/H5-admin/page/orders.vue'
import MobileDialog from '@/components/MobileDialog.vue'
import MediaPreviewViewer from '@/components/MediaPreviewViewer.vue'

const access = vi.hoisted(() => ({ state: { view: true, edit: true } }))
vi.mock('@/composables/usePagePermissions', async () => {
  const { computed, reactive } = await import('vue')
  access.state = reactive(access.state)
  return { usePagePermissions: () => ({
    canView: computed(() => access.state.view), canEdit: computed(() => access.state.edit), handleNoPermission: vi.fn()
  }) }
})
vi.mock('@/composables', async () => {
  const { ref } = await import('vue')
  return { useLoadingState: (initial = false) => ({ loading: ref(initial) }) }
})
vi.mock('@/composables/useFieldPermissions', () => ({
  fieldPermissions: { init: vi.fn(async () => {}), isFieldVisible: () => true }, shouldShowActionColumn: () => true
}))
vi.mock('@/utils/unified-api', () => ({ api: { get: vi.fn(async (url: string) => {
  const order = { id: 'preview-test', order_number: 'PREVIEW-TEST', status: 'paid', total_amount: 1,
    created_at: '2026-11-12T00:00:00Z', items: [], payment_proof: '/synthetic/proof.png' }
  return { data: url.endsWith('/statistics') ? {} : url.endsWith('/preview-test') ? order : [order] }
}) } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => ({ error: vi.fn(), success: vi.fn() }) }))

let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => { wrapper?.unmount(); wrapper = undefined; access.state.view = true; access.state.edit = true })

const openProof = async () => {
  wrapper = mount(OrdersView, {
    attachTo: document.body,
    global: { plugins: [ElementPlus], components: { MobileDialog, MediaPreviewViewer },
      provide: { registerHeaderActions: vi.fn(), clearHeaderActions: vi.fn() },
      directives: { 'tf-loading': () => {} }, stubs: {
        PermissionGate: { template: '<div><slot /></div>' },
        UnifiedSearchPanel: true, Pagination: true, DateRangePicker: true, DataEmptyState: true
      } }
  })
  await flushPromises()
  const view = wrapper.findAll('button').find(button => button.text().trim() === '查看')
  if (!view) throw new Error('缺少订单查看入口')
  await view.trigger('click')
  await flushPromises()
  const proof = document.querySelector('[aria-label="预览支付凭证"]')
  if (!(proof instanceof HTMLButtonElement)) throw new Error('缺少凭证查看入口')
  proof.click()
  await flushPromises()
}

describe('商城订单凭证公共预览', () => {
  it('从真实详情入口预览，关闭详情释放查看器，不提供删除和下载', async () => {
    await openProof()
    expect(document.querySelector('.media-preview-content')?.getAttribute('src')).toBe('/synthetic/proof.png')
    expect(document.querySelector('[aria-label="删除当前素材"]')).toBeNull()
    expect(document.querySelector('[aria-label="下载当前素材"]')).toBeNull()
    expect(document.querySelector('.el-image-viewer__wrapper')).toBeNull()
    const close = document.querySelector('.h5-order-detail-dialog .el-dialog__headerbtn')
    if (!(close instanceof HTMLButtonElement)) throw new Error('缺少详情关闭入口')
    close.click()
    await flushPromises()
    expect(document.querySelector('.media-preview-overlay')).toBeNull()
  })

  it('仅失去编辑权限仍可查看，失去查看权限立即关闭且恢复权限不自动重开', async () => {
    await openProof()
    access.state.edit = false
    await flushPromises()
    expect(document.querySelector('.media-preview-overlay')).not.toBeNull()
    access.state.view = false
    await flushPromises()
    expect(document.querySelector('.media-preview-overlay')).toBeNull()
    access.state.view = true
    await flushPromises()
    expect(document.querySelector('.media-preview-overlay')).toBeNull()
  })
})
