import { describe, expect, it } from 'vitest'
import { resolveRequestLoadingText } from '@/utils/loading-text'
import type { RequestConfig } from '@/utils/unified-api'

describe('请求 Loading 业务文案', () => {
  it.each<[RequestConfig, string]>([
    [{ url: '/employees' }, '正在读取员工资料...'],
    [{ url: '/public/auth/orders' }, '正在读取订单...'],
    [{ url: '/shop/templates' }, '正在读取商品模板...'],
    [{ url: '/system/announcements' }, '正在读取站内公告...'],
    [{ url: '/backup/create', method: 'post' }, '正在创建备份...'],
    [{ url: '/backup/cleanup', method: 'post' }, '正在清理旧备份...'],
    [{ url: '/backup/cloud/test', method: 'post' }, '正在测试云盘连接...'],
    [{ url: '/backup/download-link/synthetic-file.sql' }, '正在准备备份下载...'],
    [{ url: '/backup/synthetic-file.sql', method: 'delete' }, '正在删除备份记录...'],
    [{ url: '/backup/cloud/upload/synthetic-file.sql', method: 'post' }, '正在上传文件...'],
    [{ url: '/phones/1/images', method: 'post', data: new FormData() }, '正在上传文件...'],
    [{ url: '/menus/import/excel', method: 'post', data: new FormData() }, '正在导入菜单...'],
    [{ url: '/menus/export/excel', responseType: 'blob' }, '正在导出菜单...'],
    [{ url: '/files', responseType: 'blob' }, '正在下载文件...'],
    [{ url: '/api/public/auth/login', method: 'POST' }, '正在登录...'],
    [{ url: '/screen-lock/verify-inventory-query', method: 'post' }, '正在验证身份...'],
    [{ url: '/salary-records/batch-calculate', method: 'post' }, '正在计算工资...'],
    [{ url: '/salary-records/1/pay', method: 'post' }, '正在提交收付款信息...'],
    [{ url: '/public/orders/create', method: 'post' }, '正在提交订单...'],
    [{ url: '/public/orders/synthetic-order/confirm-payment', method: 'post' }, '正在确认支付...'],
    [{ url: '/public/orders/1/cancel', method: 'put' }, '正在取消订单...'],
    [{ url: '/public/cart/add', method: 'post' }, '正在加入购物车...'],
    [{ url: '/git/backup/archive', method: 'post' }, '正在创建代码备份...'],
    [{ url: '/git/pull', method: 'post' }, '正在拉取仓库更新...'],
    [{ url: '/price-list/sync/trigger', method: 'post' }, '正在同步报价数据...'],
    [{ url: '/data-import/analyze', method: 'post' }, '正在分析导入文件...'],
    [{ url: '/data-check/batch-merge', method: 'post' }, '正在合并数据...'],
    [{ url: '/data-check/batch-delete', method: 'post' }, '正在删除数据检查结果...'],
    [{ url: '/suppliers/1', method: 'put' }, '正在保存供应商资料...'],
    [{ url: '/phones/1/images/2', method: 'delete' }, '正在删除商品图片...'],
    [{ url: '/shop/templates/1/images/2', method: 'delete' }, '正在删除商品图片...'],
    [{ url: '/rentals/1/files/2', method: 'delete' }, '正在删除租赁附件...'],
    [{ url: '/subsidy/1/photos/2', method: 'delete' }, '正在删除国补照片...'],
    [{ url: '/employees/roles' }, '正在读取角色...'],
    [{ url: '/backup/cloud/settings' }, '正在读取云盘备份设置...'],
    [{ url: '/data-import/upload/cleanup', method: 'post' }, '正在清理导入临时文件...'],
    [{ url: '/unknown-resource' }, '正在读取数据...']
  ])('%j 显示 %s', (config, expected) => {
    expect(resolveRequestLoadingText(config)).toBe(expected)
  })

  it('显式文案优先，空白文案仍按操作解析', () => {
    expect(resolveRequestLoadingText({ url: '/backup/create', method: 'post', loadingText: ' 正在创建数据库备份... ' }))
      .toBe('正在创建数据库备份...')
    expect(resolveRequestLoadingText({ url: '/backup/create', method: 'post', loadingText: '  ' }))
      .toBe('正在创建备份...')
  })

  it('自动文案不回显域名、文件名、参数或请求体', () => {
    const config: RequestConfig = {
      url: 'https://synthetic.invalid/api/backup/download-link/synthetic-private-file.sql?token=synthetic-secret#fragment',
      params: { password: 'synthetic-password' }, data: { token: 'synthetic-body-secret' }
    }
    expect(resolveRequestLoadingText(config)).toBe('正在准备备份下载...')
    expect(resolveRequestLoadingText({ ...config, url: '/synthetic-private-resource' })).toBe('正在读取数据...')
  })
})
