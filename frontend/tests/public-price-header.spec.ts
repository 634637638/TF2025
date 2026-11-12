import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PublicPriceHeader from '@/components/base/PublicPriceHeader.vue'

describe('公开报价按钮声明', () => {
  it('默认继承公共规格，显式声明宽度与尺寸后可动态撤销', async () => {
    const wrapper = mount(PublicPriceHeader, { props: { title: '报价' }, slots: { actions: '<span>操作</span>' } })
    const header = wrapper.get('.public-price-header')
    expect(header.attributes('style')).toBeUndefined()
    expect(header.attributes('data-action-size')).toBeUndefined()
    await wrapper.setProps({ actionWidth: 80, actionSize: 'small' })
    expect((header.element as HTMLElement).style.getPropertyValue('--tf-price-header-action-width')).toBe('80px')
    expect(header.attributes('data-action-size')).toBe('small')
    await wrapper.setProps({ actionWidth: undefined, actionSize: undefined })
    expect((header.element as HTMLElement).style.getPropertyValue('--tf-price-header-action-width')).toBe('')
    expect(header.attributes('data-action-size')).toBeUndefined()
    wrapper.unmount()
  })

  it('支持 CSS 长度声明，空声明回到默认；无操作插槽不创建按钮区域', async () => {
    const wrapper = mount(PublicPriceHeader, { props: { title: '营销', actionWidth: ' 7rem ' } })
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--tf-price-header-action-width')).toBe('7rem')
    expect(wrapper.find('.notice-section').exists()).toBe(false)
    await wrapper.setProps({ actionWidth: ' ' })
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--tf-price-header-action-width')).toBe('')
    wrapper.unmount()
  })
})
