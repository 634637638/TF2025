import axios, { type AxiosAdapter } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { unifiedApi } from '@/utils/unified-api'

const previousAdapter = axios.defaults.adapter
const previousInstanceAdapter = unifiedApi.getInstance().defaults.adapter

afterEach(() => {
  axios.defaults.adapter = previousAdapter
  unifiedApi.getInstance().defaults.adapter = previousInstanceAdapter
  unifiedApi.clearCache()
  sessionStorage.clear()
})

describe('库存商城修改后的读取缓存', () => {
  it.each(['h5-product', 'inspection', 'images/2/primary'])('修改 %s 失效商城商品和模板缓存，保留无关品牌缓存', async endpoint => {
    let revision = 1
    const adapter: AxiosAdapter = async config => ({
      config, status: 200, statusText: 'OK', headers: {},
      data: config.url === '/csrf/token'
        ? { success: true, data: { csrfToken: 'unit-test-only', expiresIn: 3600 } }
        : { success: true, data: { revision } }
    })
    axios.defaults.adapter = adapter
    unifiedApi.getInstance().defaults.adapter = adapter
    const config = { showLoading: false, showError: false, cacheTTL: 60_000 }
    const read = (url: string) => unifiedApi.get<{ revision: number }>(url, config)
    const urls = ['/public/products', '/public/products/aggregate', '/shop/templates', '/brands']
    for (const url of urls) expect((await read(url)).data?.revision).toBe(1)
    revision = 2
    expect((await read('/public/products')).data?.revision).toBe(1)
    await unifiedApi.put(`/phones/12/${endpoint}`, { is_published: 0 }, config)
    for (const url of urls.slice(0, 3)) expect((await read(url)).data?.revision).toBe(2)
    expect((await read('/brands')).data?.revision).toBe(1)
  })
})
