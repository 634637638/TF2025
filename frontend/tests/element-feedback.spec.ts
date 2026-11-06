import { beforeEach, describe, expect, it, vi } from 'vitest'

const { messageCalls } = vi.hoisted(() => ({
  messageCalls: [] as Array<Record<string, unknown>>
}))

vi.mock('element-plus', () => ({
  ElMessage: (options: Record<string, unknown>) => {
    messageCalls.push(options)
    return { close: vi.fn() }
  },
  ElNotification: vi.fn(),
  ElLoading: { service: vi.fn() }
}))

import { showElementMessage } from '@/utils/element-feedback'

describe('global Element Plus messages', () => {
  beforeEach(() => {
    messageCalls.length = 0
  })

  it('staggers automatic dismissal and releases the interval on close', async () => {
    await showElementMessage({ message: '第一条', duration: 4000 })
    await showElementMessage({ message: '第二条', duration: 4000 })

    expect(messageCalls.map(({ placement }) => placement)).toEqual(['top', 'top'])
    expect(messageCalls.map(({ duration }) => duration)).toEqual([4000, 4400])

    const closeFirst = messageCalls[0].onClose
    expect(typeof closeFirst).toBe('function')
    if (typeof closeFirst === 'function') closeFirst()

    await showElementMessage({ message: '第三条', duration: 2000 })
    expect(messageCalls[2].duration).toBe(2400)

    for (const call of messageCalls.slice(1)) {
      const onClose = call.onClose
      if (typeof onClose === 'function') onClose()
    }
  })

  it('does not delay persistent messages or let them extend later messages', async () => {
    await showElementMessage({ message: '持续提示', duration: 0 })
    await showElementMessage({ message: '普通提示', duration: 1000 })

    expect(messageCalls.map(({ placement }) => placement)).toEqual(['top', 'top'])
    expect(messageCalls[0].duration).toBe(0)
    expect(messageCalls[1].duration).toBe(1000)
  })
})
