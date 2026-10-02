# 全局交互反馈规范

## 统一入口

业务页面的确认、提示、成功、警告、失败和加载反馈必须使用项目公共入口：

- `frontend/src/composables/useNotification.ts`
- `frontend/src/services/notification-simple.ts`
- `frontend/src/utils/message-box.ts`

普通页面优先使用 `useNotification()`：

```ts
const { success, error, warning, info, confirm, alert } = useNotification()

const confirmed = await confirm('确定要删除这条记录吗？', '删除确认', {
  type: 'warning',
  confirmButtonText: '删除',
  cancelButtonText: '取消'
})

if (confirmed) {
  success('删除成功')
}
```

## 确认框

- 禁止使用浏览器原生 `window.confirm()`、`globalThis.confirm()` 或 `confirm()`。
- 删除、清空、撤销、停用、退出和提交不可逆结果前必须确认。
- 确认框必须等待异步结果，不得把 Promise 当作布尔值直接判断。
- `ElMessageBox.confirm` 的兼容调用由 `message-box.ts` 全局增强；新增页面优先使用 `useNotification().confirm()`，保持文案、按钮和关闭清理逻辑一致。
- 需要用户输入的弹窗统一使用 `useNotification().prompt()`，取消时返回 `null`；业务页不得直接调用 `ElMessageBox.prompt`。
- 历史页面批量迁移时可以使用 `message-box.ts` 的 `confirmAction()` / `alertAction()`，它们保留 Element Plus 原有的 Promise 取消语义；新页面仍优先使用 `useNotification().confirm()` / `alert()`。
- 业务页面不得直接调用 `ElMessageBox.confirm/alert`。公共实现文件 `message-box.ts`、`notification-simple.ts` 不计入业务调用审计。

## 消息提示

- 禁止使用浏览器原生 `window.alert()`、`globalThis.alert()` 或 `alert()`。
- 成功、警告、失败和普通信息统一使用 `success`、`warning`、`error`、`info`。
- 复杂说明使用项目异步 `alert()`，不要调用浏览器原生弹窗。
- 页面不得自行设置一套消息位置、层级或持续时间；具体默认值由通知服务维护。

## 按钮和加载

- 普通业务按钮使用 Element Plus `el-button`，颜色和尺寸读取全局按钮规范。
- `BaseButton.vue` 和自定义 `ConfirmDialog.vue` 已移除；普通按钮使用 Element Plus `el-button`，确认流程使用统一确认服务，不新增同名旧组件。
- 页面加载使用 `SectionLoading` 或 `GlobalLoading`，表格加载使用 `TableLoadingRow`，按钮和提交状态使用 `el-button :loading`，局部异步内容使用 `InlineLoading`。
- 同一按钮不得同时使用 Element Plus 内置 loading 和第二套 spinner。
- 原生按钮只保留在公共组件内部、H5/公开页专用交互、权限开关和其他需要专用键盘/触控语义的控件；新增普通后台命令按钮使用 `el-button`。例外登记见[公共组件采用与例外规范](component-adoption-standard.md)。

## 空状态

业务列表、表格、卡片和 H5 内容区使用 `DataEmptyState`。页面只提供状态、文案和业务操作，不得复制图标、间距、颜色或高度。

## 审计

```bash
cd frontend
npm run check:interactions
```

该审计阻止浏览器原生 `alert()` 和 `confirm()` 回归，并阻止业务页直接调用 `ElMessageBox.confirm/alert/prompt`；裸调用必须绑定到同一文件的 `useNotification()`。按钮、加载和空状态分别由 `check:buttons`、`check:loading` 和 `check:empty-states` 继续检查。

截至 2026 年 10 月 1 日，业务代码中的 `ElMessageBox.confirm/alert/prompt` 均迁移到统一入口；prompt 取消统一返回 `null`。原生按钮的当前数量与逐文件专用原因由 `check:component-adoption` 守护。
