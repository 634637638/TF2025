import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { isCanceledError, useLatestRequest } from '@/composables/useLatestRequest'

describe('useLatestRequest', () => {
  it('新请求会取消旧请求并只认可最新响应', () => {
    let requestManager: ReturnType<typeof useLatestRequest> | undefined
    const wrapper = mount(defineComponent({
      setup() {
        requestManager = useLatestRequest()
        return () => h('div')
      }
    }))

    const first = requestManager!.nextRequest()
    const second = requestManager!.nextRequest()

    expect(first.signal.aborted).toBe(true)
    expect(first.isLatest()).toBe(false)
    expect(second.signal.aborted).toBe(false)
    expect(second.isLatest()).toBe(true)

    requestManager!.cancelLatest()
    expect(second.signal.aborted).toBe(true)
    expect(second.isLatest()).toBe(false)
    wrapper.unmount()
  })

  it('统一识别常见取消错误', () => {
    expect(isCanceledError({ name: 'CanceledError' })).toBe(true)
    expect(isCanceledError({ code: 'ERR_CANCELED' })).toBe(true)
    expect(isCanceledError({ message: 'canceled' })).toBe(true)
    expect(isCanceledError(new Error('network failed'))).toBe(false)
  })
})
