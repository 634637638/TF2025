# 前端数据实时刷新规范

## 目标

所有新增、编辑、删除、审核、状态切换和批量操作成功后，当前页面必须立即展示服务端最新数据，不允许依赖手动刷新，也不允许被短时 GET 缓存覆盖。

## 全局保障

- 所有业务请求统一使用 `@/utils/unified-api`，禁止在页面中直接调用 `axios.post/put/patch/delete`。
- `POST`、`PUT`、`PATCH`、`DELETE` 成功后，`unifiedApi` 自动清除 GET 缓存。
- 写操作成功后同时清除 `usePageCache` 页面级缓存，基础资料、统计和下拉数据不会继续读取旧值。
- GET 请求带缓存代次。写操作前发出的慢 GET 即使晚返回，也不能在写成功后回填旧缓存。
- 明确要求实时读取时使用 `{ useCache: false }`，例如写成功后立即重载列表。

## 页面 CRUD 规则

写操作成功后的顺序必须保持一致：

1. 等待写接口完成并确认 `response.success`。
2. 删除当前分页最后一条时，若页码大于 1，先回退一页。
3. `await` 当前页面的列表加载函数，推荐传入 `{ useCache: false }`。
4. 列表加载完成后再结束提交状态、关闭必要的加载状态。
5. 模态框可以在写成功后关闭，但父页面必须通过 `success` 事件立即重载列表。

```ts
const response = await unifiedApi.delete(`/items/${item.id}`)

if (response.success) {
  if (rows.value.length === 1 && pagination.page > 1) {
    pagination.page -= 1
  }

  await loadList({ useCache: false })
  success('删除成功')
}
```

## 禁止模式

- 写成功后只显示提示或关闭模态框，不更新本地数据且不重载列表。
- 写成功后调用列表接口，但继续读取写操作前的缓存。
- 使用 `setTimeout` 猜测后端完成时间后再刷新。
- 先刷新列表再等待写请求完成。
- 直接使用 Axios 写接口，绕过统一缓存失效机制。

## 检查

提交前运行：

```bash
npm run check:data-freshness
npm run build
```

自动检查负责确保页面没有直接 Axios 写请求，并确保统一 API 的缓存失效与旧响应保护仍然存在。业务评审仍需确认每个成功分支会更新本地行或重新加载列表。
