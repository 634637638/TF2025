import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReferenceOrdering } from '@/composables/useReferenceOrdering'

const mocks = vi.hoisted(() => ({ put: vi.fn(), success: vi.fn(), warning: vi.fn(), failure: vi.fn() }))
vi.mock('@/utils/unified-api', () => ({ default: { put: mocks.put } }))
vi.mock('@/composables/useNotification', () => ({ useNotification: () => mocks }))
vi.mock('@/utils/apiPermissionError', () => ({ handleApiErrorWithPermission: mocks.failure }))

const create = (endpoint: '/brands' | '/models' | '/colors' | '/memories' = '/brands') => {
  const rows = ref([
    { id: 45, name: '甲', sort_order: 45, brand_id: 1 },
    { id: 60, name: '乙', sort_order: 60, brand_id: 1 },
    { id: 90, name: '丙', sort_order: 90, brand_id: 1 },
    { id: 120, name: '丁', sort_order: 120, brand_id: 2 }
  ])
  const canEdit = ref(true)
  const reload = vi.fn().mockResolvedValue(undefined)
  return {
    rows, canEdit, reload,
    ...useReferenceOrdering({ rows, endpoint, moduleName: '基础资料', canEdit, reload,
      scopeKey: endpoint === '/models' ? row => row.brand_id : undefined })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.put.mockResolvedValue({ success: true })
})

describe('基础资料排序保持用户设置的实际值', () => {
  it.each(['/brands', '/models', '/colors', '/memories'] as const)('%s 筛选结果按 ID 只保存一条，不重编号其他记录', async endpoint => {
    const state = create(endpoint)
    const original = structuredClone(state.rows.value.map(row => ({ ...row })))
    expect(await state.handleSortOrderChange(45, 72)).toBe(true)
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith(`${endpoint}/batch/reorder`, {
      items: [{ id: 45, sort_order: 72 }]
    }, { showError: false })
    expect(state.rows.value.find(row => row.id === 45)?.sort_order).toBe(72)
    expect(state.rows.value.filter(row => row.id !== 45)).toEqual(original.filter(row => row.id !== 45))
    expect(state.reload).toHaveBeenCalledOnce()
    expect(mocks.success).toHaveBeenCalledWith('排序已保存')
  })

  it('相同排序值仍允许单条保存，其他记录的值和 ID 保持不变', async () => {
    const state = create()
    await state.handleSortOrderChange(45, 60)
    expect(state.rows.value.map(row => [row.id, row.sort_order])).toEqual([[45, 60], [60, 60], [90, 90], [120, 120]])
    expect(mocks.put.mock.calls[0][1].items).toEqual([{ id: 45, sort_order: 60 }])
  })

  it.each([0, 9999])('边界排序值 %s 原样保存', async value => {
    const state = create()
    await state.handleSortOrderChange(45, value)
    expect(mocks.put.mock.calls[0][1].items).toEqual([{ id: 45, sort_order: value }])
  })

  it.each([undefined, -1, 0.5, 10000, NaN])('拒绝无效值 %s，不触发写入', async value => {
    const state = create()
    const original = state.rows.value
    expect(await state.handleSortOrderChange(45, value)).toBe(false)
    expect(mocks.put).not.toHaveBeenCalled()
    expect(state.rows.value).toBe(original)
    expect(mocks.warning).toHaveBeenCalledOnce()
  })

  it.each(['reject', 'unsuccessful'])('保存失败 %s 恢复原值和列表顺序并提示，允许重试', async failure => {
    const state = create()
    const original = state.rows.value
    if (failure === 'reject') mocks.put.mockRejectedValueOnce(new Error('网络错误'))
    else mocks.put.mockResolvedValueOnce({ success: false, message: '保存失败' })
    expect(await state.handleSortOrderChange(45, 80)).toBe(false)
    expect(state.rows.value).toBe(original)
    expect(state.savingOrder.value).toBe(false)
    expect(state.reload).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.failure).toHaveBeenCalledOnce()
    expect(await state.handleSortOrderChange(45, 80)).toBe(true)
  })

  it('保存期间拒绝重复提交；筛选切换后失败不会恢复旧快照', async () => {
    const state = create()
    let reject!: (error: Error) => void
    mocks.put.mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
    const pending = state.handleSortOrderChange(45, 80)
    expect(state.savingOrder.value).toBe(true)
    expect(await state.handleSortOrderChange(60, 1)).toBe(false)
    expect(await state.handleRowMove(0, 1)).toBe(false)
    state.rows.value = [{ id: 200, name: '新筛选', sort_order: 200, brand_id: 2 }]
    reject(new Error('网络错误'))
    await pending
    expect(state.rows.value.map(row => row.id)).toEqual([200])
    expect(mocks.put).toHaveBeenCalledOnce()
  })

  it('没有编辑权限、记录不存在或值未变化时不提交', async () => {
    const state = create()
    expect(await state.handleSortOrderChange(45, 45)).toBe(false)
    expect(await state.handleSortOrderChange(500, 5)).toBe(false)
    state.canEdit.value = false
    expect(await state.handleSortOrderChange(45, 5)).toBe(false)
    expect(await state.handleRowMove(0, 1)).toBe(false)
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('写入成功后刷新失败保留已提交的值，提示刷新失败而非回滚', async () => {
    const state = create()
    state.reload.mockRejectedValueOnce(new Error('读取失败'))
    expect(await state.handleSortOrderChange(45, 72)).toBe(true)
    expect(state.rows.value.find(row => row.id === 45)?.sort_order).toBe(72)
    expect(mocks.failure).toHaveBeenCalledWith(expect.any(Error), '排序已保存，但刷新列表失败，请刷新页面', '基础资料', 'view')
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('拖拽只交换区间内原有稀疏排序值，不从 0 重编号', async () => {
    const state = create('/models')
    expect(await state.handleRowMove(0, 2)).toBe(true)
    expect(mocks.put.mock.calls[0][1].items).toEqual([
      { id: 60, sort_order: 45 }, { id: 90, sort_order: 60 }, { id: 45, sort_order: 90 }
    ])
    expect(state.rows.value.map(row => [row.id, row.sort_order])).toEqual([[60, 45], [90, 60], [45, 90], [120, 120]])
  })

  it('跨品牌或区间有重复排序值时拒绝拖拽，不自动修改其他值', async () => {
    const state = create('/models')
    expect(await state.handleRowMove(0, 3)).toBe(false)
    state.rows.value[1].sort_order = 45
    expect(await state.handleRowMove(0, 1)).toBe(false)
    expect(mocks.put).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalledTimes(2)
  })
})
