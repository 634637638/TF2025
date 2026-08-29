# 全局空状态统一规范

> 最后更新：2026-08-28

## 目标

全站的表格、列表、卡片、弹窗和移动端页面统一使用 `DataEmptyState`。业务页面只负责判断状态和提供准确文案，不再自行定义空状态图形、间距、颜色或移动端尺寸。

唯一公共入口：

- `frontend/src/components/DataEmptyState.vue`
- `frontend/src/components/PaginatedTable.vue`
- `frontend/src/components/MobileTable.vue`

## 状态边界

空状态不能代替加载和报错，页面必须按实际结果区分：

| 状态 | `state` | 使用条件 | 推荐文案 |
| --- | --- | --- | --- |
| 正常无数据 | `empty` | 请求成功，当前业务确实没有记录 | 暂无库存数据 |
| 筛选无结果 | `filtered` | 原始列表有数据，但当前条件没有匹配项 | 未找到匹配的设备 |
| 请求失败 | `error` | API、网络或解析失败 | 加载失败，请重试 |
| 无查看权限 | `permission` | 权限系统明确拒绝查看 | 当前账号暂无查看权限 |
| 等待操作 | `initial` | 尚未查询、尚未选择必要参数 | 请先选择品牌和型号 |

加载中继续使用 `TableLoadingRow`、`SectionLoading` 或 `InlineLoading`，不得显示“暂无数据”。请求失败不得清空错误后伪装成正常无数据。

## 标准用法

普通无数据：

```vue
<DataEmptyState description="暂无颜色数据" />
```

筛选无结果：

```vue
<DataEmptyState
  state="filtered"
  description="未找到匹配的设备"
>
  <el-button type="primary" @click="resetFilters">
    清空筛选条件
  </el-button>
</DataEmptyState>
```

请求失败：

```vue
<DataEmptyState
  state="error"
  title="数据加载失败"
  description="请检查网络后重试"
  action-text="重试"
  @action="loadData"
/>
```

Element Plus 表格：

```vue
<template #empty>
  <TableLoadingRow v-if="loading" mode="block" text="加载中..." />
  <DataEmptyState v-else description="暂无数据" />
</template>
```

紧凑弹窗或选择器使用 `size="compact"`，整页无内容使用 `size="page"`。默认尺寸适用于普通表格、列表和卡片区块。

## 允许自定义

- 允许设置准确的 `title`、`description` 和 `state`。
- 允许通过默认插槽放置“重试”“清空筛选”“新增”等明确操作。
- 允许通过 `image`、`image-size` 或 `#image` 适配有真实业务意义的图片。
- 操作按钮仍须遵守全局按钮规范和权限控制。

## 禁止事项

- 禁止业务页面直接使用 `el-empty`。
- 禁止新增 `.empty-state`、`.no-data` 等页面私有视觉实现。
- 禁止在加载中提前显示空状态。
- 禁止 API 失败后显示“暂无数据”。
- 禁止给正常空列表默认添加无意义的“刷新数据”按钮。

## 审计

单独执行：

```bash
cd frontend
npm run check:empty-states
```

该审计已接入 `check:standards`、开发启动和生产构建。业务代码直接使用 `el-empty`，或公共表格组件脱离 `DataEmptyState`，都会阻止启动和构建。
