# TF2025 对话框统一规范

## 适用范围

本规范适用于 Vue 3 页面中的 Element Plus `el-dialog`、全局 `MobileDialog`、自定义历史模态框和 `ElMessageBox`。新增功能优先使用 `el-dialog` 或 `MobileDialog`，不得继续创建另一套遮罩、弹窗和按钮主题。

按钮颜色、尺寸和语义统一遵循《[全局按钮统一规范](button-standards.md)》。对话框文档不再维护任何页面级 `.btn-primary` 或 `.el-button--primary` CSS。

## 全局入口

| 文件 | 职责 |
|---|---|
| `frontend/src/styles/components/_dialog.scss` | 正文内边距、表单标签宽度、滚动条可见性、图片预览层级 |
| `frontend/src/styles/components/_dialog-actions.scss` | footer 按钮排列、尺寸和 MessageBox 语义 |
| `frontend/src/styles/components/_buttons.scss` | 按钮颜色、状态和普通尺寸 |

以上文件由 `frontend/src/main.ts` 全局加载。业务页面只添加弹窗用途 class、宽度和内容布局，不得复制公共正文间距或 footer 按钮规则。

## 标准结构

```vue
<el-dialog
  v-model="visible"
  title="编辑资料"
  width="min(720px, calc(100vw - 16px))"
  append-to-body
  destroy-on-close
>
  <el-form class="tf-dialog-form" :model="form">
    <el-form-item label="名称">
      <el-input v-model="form.name" />
    </el-form-item>
  </el-form>

  <template #footer>
    <div class="tf-dialog-actions">
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </div>
  </template>
</el-dialog>
```

弹窗传送到 `body` 后，页面的 scoped CSS 不一定能命中内部结构。公共视觉必须放在全局文件；页面差异使用 `custom-class` 或明确的弹窗 class，并通过非 scoped 样式只控制业务布局。

## 正文和表单

普通弹窗正文统一读取以下变量：

- PC 左右间距 `--tf-dialog-body-padding-inline: 24px`；
- PC 上下间距 `--tf-dialog-body-padding-block: 24px`；
- 手机左右间距 `16px`，`480px` 以下 `12px`；
- 普通横向表单标签宽度 `72px`，手机逐步收窄。

横向表单使用 `.tf-dialog-form`。富文本、说明、长标题等需要标签在上方时使用 `.tf-dialog-form.tf-dialog-form--stacked`。复杂全屏工具确需取消正文间距时使用 `.tf-dialog-body-flush`，不得给普通编辑框设置 `padding: 0`。

所有输入控件必须 `min-width: 0`，长文本允许自然换行。表格、富文本表格或媒体确实超出时，只在内容容器内提供一个横向滚动区域，不得撑宽弹窗或制造页面级双滚动条。

弹窗内容超过可视高度时允许正文纵向滚动，但不显示纵向滚动条轨道。鼠标滚轮、触摸滑动和键盘滚动必须继续可用，禁止用 `overflow-y: hidden` 截断内容。该规则由 `_dialog.scss` 统一覆盖 `el-dialog`、`MobileDialog` 和历史弹窗容器，业务页面不得重新显示或自定义弹窗正文滚动条。

## Footer 按钮

标准 footer 必须使用 `.tf-dialog-actions`。历史别名如 `.dialog-footer`、`.modal-footer`、`.payment-dialog-footer`、`.image-modal-footer` 已由全局兼容，但修改历史弹窗时应逐步补上 `.tf-dialog-actions`。

PC 端：

- 按钮按内容自适应，靠右排列；
- 最小宽度 `80px`，高度 `40px`；
- 多按钮间距 `10px`。

手机端：

- 取消在左，保存/确认在右；
- 所有按钮在一行等宽收缩；
- 不允许 `flex-direction: column`；
- 不允许给每个按钮写 `width: 100%` 造成上下堆叠；
- 安全区内边距由弹窗 footer 负责，按钮本身不重复增加。

关闭、取消使用默认中性按钮；保存、确认使用 `primary`；删除使用 `danger`；完成/通过使用 `success`；停用/拒绝使用 `warning`。

## 表格弹窗

模态框内表格继续遵循《[后台卡片与表格统一规范](admin-table-standards.md)》：

- 列宽按表头和完整内容计算，禁止用省略号隐藏关键字段；
- 内容较少时按紧凑列宽铺满可用空间，避免尾部大片空白；
- 内容超宽时 PC 和手机均在表格内部同步横向移动；
- 操作按钮使用 `.action-buttons` 和显式 `table-action--*`；
- 纯图标操作必须有 tooltip；
- 页面不得重新定义表头、行高和操作按钮尺寸。

## 多层弹窗和预览

图片预览使用 Element Plus `ElImageViewer` 并设置 `teleported`，公共层级为 `--tf-image-viewer-z-index: 12000`。颜色选择器、日期选择器等 popper 使用 Element Plus 传送机制，不能放在会裁切的 `overflow: hidden` 业务容器中。

禁止通过随意增加页面 z-index 解决遮挡。新增全局浮层类型时，应先确认现有遮罩、Dialog、MessageBox 和 Viewer 层级，再在全局文件中定义。

## 确认提示框

删除、停用、完成等确认操作使用 `frontend/src/utils/message-box.ts` 的统一增强。页面只传标题、正文、确认文字和业务类型，不直接写确认按钮颜色。

```ts
await ElMessageBox.confirm('确定删除该记录吗？', '删除确认', {
  type: 'warning',
  confirmButtonText: '删除',
  cancelButtonText: '取消'
})
```

全局会根据操作语义应用 `message-box-danger`、`message-box-warning`、`message-box-success` 或 `message-box-primary`。

## 检查清单

- PC 弹窗在可视区内居中，正文可滚动，footer 始终可操作；
- 弹窗正文不显示纵向滚动条，但滚轮、触摸和键盘仍可正常滚动；
- 手机宽度不超过 `100vw`，左右间距对称；
- 手机 footer 按钮保持一行；
- 取消和保存顺序一致；
- 长文本、表格、图片和富文本不撑宽弹窗；
- 图片预览位于弹窗最上层；
- 页面没有按钮颜色、固定宽度或 footer 子按钮覆盖；
- `npm run check:buttons` 和 `npm run build` 均通过。
