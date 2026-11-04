# 全局加载动画统一规范

## 公共入口

- `GlobalLoading.vue` 只在 `App.vue` 全局挂载一次，读取 `useLoadingStore` 的可见状态。
- `useLoadingStore` 和路由守卫管理全局请求；显示延迟使用 `constants/loading.ts` 的 `GLOBAL_LOADING_SHOW_DELAY_MS`，当前为 5 秒，短请求不闪现遮罩。
- `useLoadingState` 管理局部异步状态，`useRefreshData` 管理刷新、缓存失效和提示。
- `v-tf-loading` 用于表格/列表区域刷新；`SectionLoading` 用于弹窗和非表格区块；`InlineLoading` 用于短文本和不支持内置 Loading 的按钮。
- `TableLoadingRow` 是原生表格行或空容器的公共兜底，不是已有数据刷新时的主视觉。

具体实现和审计入口由 [规范清单](standards-manifest.json) 登记，页面结构见 [页面结构规范](page-structure-standards.md)。

## 首次进入与已有数据刷新

| 场景 | 反馈与状态 |
| --- | --- |
| 首次进入或 F5 页面请求 | 统一 API/路由负责全局 Loading，遵循公共延迟；首次表格状态可以为 true，但不能额外显示局部遮罩或手写占位 spinner |
| 搜索、筛选、分页、切换 Tab、再次加载 | `v-tf-loading` 锁定表格或列表区域，已有数据保留，全屏层被公共仲裁抑制 |
| 顶部手动刷新 | 独立 `refreshing` 配合 `useRefreshData`；按钮显示内置 Loading，表格在边界内反馈 |
| 弹窗详情或独立区块 | `SectionLoading`，请求显式关闭全局层，避免同时出现两套提示 |
| 提交、删除、导入、导出、备份 | 按钮防重复状态，按实际操作范围选择局部反馈；全局长操作只允许已登记入口 |
| 后台轮询、健康检查、静默预取 | 显式 `showLoading: false`；失败记录必要日志，不打断用户操作 |

统一 Axios 默认纳入全局 Loading。关闭全局反馈时必须有合理的静默用途或局部承载，不得让用户主动操作无反馈。

`v-tf-loading` 首次绑定为 true 只登记首屏状态；首次完成后再次从 false 进入 true 才显示刷新遮罩。不得为了立刻展示局部 Loading 伪造一次已完成状态。首次没有数据时同样由全局层承载，结束后再展示 `DataEmptyState`。

遮罩仅覆盖表头、数据和列表范围，不挂在整个页面、搜索区或统计区。禁止通过 `loading ? [] : rows` 清空旧数据制造闪烁。已有数据刷新时，不能再叠加 `TableLoadingRow` 或其他 spinner。

局部 Loading 激活时立即取消全局层的等待和离场过渡；局部结束不自动恢复已被抑制的全局层。一个操作的区域反馈不能叠加另一套全屏遮罩；按钮内置动画可以同时承担防重复反馈。

## 顶部刷新

- 页面 `loading` 与按钮 `refreshing` 分开维护。
- `useRefreshData` 在刷新期间登记局部 Loading，调用真实加载函数；列表函数仍应维护表格区域状态，不得为“无全屏刷新”取消所有区域反馈。
- 使用成功文案“数据刷新成功”和失败文案“刷新失败，请重试”，调用时显式配置。
- 被调用函数失败必须抛出。提示由公共刷新或请求拦截器其中一层负责，避免重复；不能吞掉失败后弹成功。
- 刷新保留表格、卡片和图表，失效本模块必要缓存，父子页面暴露清晰刷新入口。

## 按钮和空容器

Element Plus 按钮只使用自身 `:loading`，按业务叠加禁用条件；按钮内部可切换纯文本，不得再嵌套 `InlineLoading` 或 `fa-spinner`。

```vue
<el-button :loading="saving" :disabled="saving" @click="handleSave">
  {{ saving ? '保存中...' : '保存' }}
</el-button>
```

原生按钮或没有内置动画的自定义按钮使用公共 `InlineLoading`，并绑定禁用或防重复逻辑。

```vue
<InlineLoading text="保存中..." size="small" variant="inherit" />
```

原生表格行可用 `TableLoadingRow` 默认行模式，Element Plus 空容器可用 `mode="block"`。它们仅用于没有区域遮罩、且确实需要局部加载承载的场景；不能因采用公共组件就叠加到首屏或已有遮罩。

```vue
<el-table v-tf-loading="loading" :data="rows">
  <template #empty>
    <DataEmptyState v-if="!loading" description="暂无数据" />
  </template>
</el-table>
```

`SectionLoading` 用于非表格/非列表块，不用作桌面表格的私有占位。禁止手写加载行、自定义 spinner，禁止业务页面新增 `ElLoading.service`。Element Plus `v-loading` 只允许审计内已登记且说明理由的存量例外。

## 规范页预览与例外

登录 `/standards` 的 Loading 演示必须通过同一 Store 和 App 中唯一的全局组件：等待公共延迟后，展示约 2 秒再结束。切换规范、关闭详情或卸载时清理定时器和操作；不得另建全屏组件，也不得降低生产显示延迟来迁就预览。

全局长操作例外包括规范页真实演示、数据优化页已登记的清理/批量合并/删除；它们与普通表格查询是不同操作。普通搜索、刷新和分页不得自行调用全屏 Loading。

逐文件例外、原因和上限在 `frontend/scripts/check-loading-patterns.mjs` 维护。例外是只能减少的存量债务，不是可新增额度；最后一处移除时同步删除登记，不重建基线扩大上限。

## 审计与验收边界

执行 `npm --prefix frontend run check:loading` 及相关类型、UI 和行为测试。审计解析完整 Vue SFC 模板，检查全局唯一挂载、公共入口、重复动画、空容器、按钮与已登记例外，解析失败必须失败。

静态检查不能证明每个页面的加载粒度或视觉正确。浏览器分别验证首屏短/长请求、保留数据刷新、失败、取消、连续点击、卸载清理及全局/局部互斥，不以历史使用数量或审计通过代替实际验收。
