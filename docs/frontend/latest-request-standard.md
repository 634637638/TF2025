# 前端最新请求规范

## 适用场景

搜索、筛选、分页、刷新这类会短时间连续触发 GET 请求的列表页面，必须使用 `useLatestRequest`。这样可以取消旧请求，并且只允许最后一次响应更新页面，避免旧接口慢返回后覆盖新数据。

当前已接入页面：

- 品牌管理：`frontend/src/views/brands/BrandsView.vue`
- 型号管理：`frontend/src/views/models/ModelsView.vue`
- 颜色管理：`frontend/src/views/colors/ColorsView.vue`
- 内存管理：`frontend/src/views/memories/MemoriesView.vue`
- 门店管理：`frontend/src/views/stores/StoresView.vue`
- 供应商管理：`frontend/src/views/suppliers/SuppliersView.vue`

## 标准写法

```ts
import { useLatestRequest } from '@/composables/useLatestRequest'

const listRequest = useLatestRequest()

const loadList = async () => {
  const request = listRequest.nextRequest()

  try {
    const response = await unifiedApi.get('/example', {
      params,
      signal: request.signal
    })

    if (!request.isLatest()) {
      return
    }

    rows.value = response.data || []
  } catch (err) {
    if (listRequest.isCanceledError(err)) {
      return
    }

    handleApiError(err, '加载数据失败')
  }
}
```

## 注意事项

- 不要在取消请求时清空表格，也不要弹错误提示；取消是正常交互，不是异常。
- 更新 `loading` 状态时，先判断 `request.isLatest()`，避免旧请求关闭新请求的加载态。
- 分页大小变化时，先保存旧 `pageSize`，再更新分页数据；如果每页条数变了，应回到第一页。
- 新增同类列表页时，优先复用这个模式，不要单独实现 `AbortController`。
