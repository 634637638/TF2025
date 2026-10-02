# 模态框开发指南

> 本文档保留历史问题背景；当前实施规范以 [`dialog-standards.md`](dialog-standards.md) 为准。

## 问题概述

在国补管理模块开发过程中，遇到了 Element Plus `el-dialog` 组件的白色边框问题，以及相关的样式和时区配置问题。

---

## 问题1：Element Plus Dialog 白色边框问题

### 问题描述
使用 Element Plus 的 `el-dialog` 组件时，对话框周围会出现白色边框/白色背景层，即使设置了 `background: transparent` 也无法完全去除。

### 根本原因
Element Plus 的 `el-dialog` 组件会创建多个嵌套的包装元素：

```
.el-overlay (最外层遮罩)
  └── .el-dialog__wrapper (对话框包装器)
        └── .el-overlay-dialog (遮罩层对话框)
              └── .el-dialog (实际对话框内容)
```

这些包装元素都有默认的白色背景样式，且由于 Element Plus 的样式优先级很高，在 scoped 样式中很难覆盖。

### 解决方案

#### 当前方案：使用 MobileDialog 或登记例外

新功能统一使用 `MobileDialog`；必须使用原生 `el-dialog` 时，必须属于审计脚本登记的工作台例外，并复用全局入口。禁止新增 `modal-overlay`、`modal-content`、`BaseModal` 或重复的弹窗主题。

```vue
<MobileDialog
  v-model="visible"
  title="编辑资料"
  width="680px"
  max-width="880px"
  dialog-class="customer-edit-dialog"
  @confirm="save"
>
  <el-form class="tf-dialog-form tf-dialog-form--stacked" :model="form">
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
</MobileDialog>
```

宽度由 `width`/`maxWidth` 声明，自动根据桌面、平板、手机视口收缩。页面不得复制 `width: min(..., 100vw)`、`.el-dialog__body` padding 或 footer 按钮尺寸规则。

如果必须使用 `el-dialog`，直接复用全局入口，不要在页面或其他全局文件中新增覆盖：

- 外壳、响应式尺寸、标题、正文和安全区：`frontend/src/styles/components/_dialog.scss`
- 底部操作区：`frontend/src/styles/components/_dialog-actions.scss`
- 按钮语义：`frontend/src/styles/components/_buttons.scss`

新增视觉规则时只修改上述公共文件，并同步更新
`docs/frontend/dialog-standards.md`。

---

## 问题2：Vue scoped 样式无法覆盖模态框样式

### 问题描述
在 Vue 组件中使用 scoped 样式时，自定义模态框的样式无法生效。

### 根本原因
Vue 的 scoped 样式通过添加唯一属性选择器来实现样式隔离。但模态框通过 `v-if` 条件渲染，且通常挂载到 body 根级别，不在组件的 DOM 树内，因此 scoped 样式无法匹配。

### 解决方案

业务页面不再自行创建模态框外壳，也不通过页面级样式覆盖弹窗公共结构。统一使用
`MobileDialog`，并通过 `dialog-class` 只标记业务变体；弹窗外壳、宽度、遮罩、标题栏、正文滚动和
footer 由全局实现维护。

```vue
<MobileDialog
  v-model="visible"
  title="编辑资料"
  width="680px"
  max-width="880px"
  dialog-class="customer-edit-dialog"
>
  <!-- 这里仅维护业务内容布局；内容样式可以继续使用 scoped -->
  <el-form class="customer-edit-form" :model="form">
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
</MobileDialog>
```

如果确需调整弹窗内容布局，优先使用组件自身的 scoped class 或 `dialog-class` 对应的内容变体，
不得新增 `.modal-overlay`、`.modal-content`、`BaseModal`，也不得复制 `.el-dialog__header`、
`.el-dialog__body`、`.el-dialog__footer` 的公共规则。原生 `el-dialog` 仅限已登记的工作台例外，
并且仍必须复用 `frontend/src/styles/components/_dialog.scss` 和 `_dialog-actions.scss`。

---

## 问题3：日期选择器时区和语言问题

### 问题描述
- Element Plus 日期选择器默认使用 UTC 时区
- 界面显示为英文

### 解决方案

#### 1. 全局配置中文语言包
**文件：`/frontend/src/main.ts`**
```typescript
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

app.use(ElementPlus, {
  locale: zhCn,
})
```

#### 2. 为日期选择器配置时区
```vue
<el-date-picker
  v-model="editForm.apply_time"
  type="datetime"
  placeholder="选择提交时间"
  format="YYYY-MM-DD HH:mm"
  value-format="YYYY-MM-DDTHH:mm"
  :timezone="'Asia/Shanghai'"
  locale="zh-CN"
/>
```

#### 3. 设置当前时间的函数
```typescript
const setCurrentTime = (field: string) => {
  // 获取当前北京时间（UTC+8）
  const now = new Date();
  const beijingTime = new Date(
    now.getTime() + (8 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000)
  );

  const year = beijingTime.getFullYear();
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getDate()).padStart(2, '0');
  const hours = String(beijingTime.getHours()).padStart(2, '0');
  const minutes = String(beijingTime.getMinutes()).padStart(2, '0');

  editForm.value[field] = `${year}-${month}-${day}T${hours}:${minutes}`;
};
```

---

## 最佳实践总结

### ✅ 推荐做法

1. **优先使用统一弹窗组件**
   - 新增业务弹窗使用 `MobileDialog`
   - 原生 `el-dialog` 必须属于已登记例外并复用全局样式
   - 复杂内容只定义业务布局，不复制弹窗外壳

2. **统一响应式宽度**
   - 通过 `width` 声明业务期望宽度，通过 `maxWidth` 声明更严格的上限
   - 桌面、平板、手机由全局规则自动收缩，不在页面复制 `min(..., 100vw)` 或
     `calc(100vw - ...)`

3. **统一视觉风格**
   - 头部、遮罩、圆角、阴影、正文间距和关闭按钮统一读取 `_dialog.scss` 令牌
   - footer 使用 `.tf-dialog-actions`，按钮尺寸和移动端等宽行为由全局维护
   - 不在业务页面复制具体颜色、圆角、间距或按钮尺寸

4. **业务样式边界**
   - 页面样式只负责表单、表格、图片等内容布局
   - 内容样式可以使用 scoped；需要穿透子组件时只针对明确的业务 class
   - 不新增全局弹窗外壳或第二套弹窗主题

5. **全局配置**
   - 在 `main.ts` 中配置 Element Plus 中文语言包
   - 由 `main.ts` 全局加载 `_dialog.scss` 和 `_dialog-actions.scss`

### ❌ 避免做法

1. ❌ 自建 `.modal-overlay`、`.modal-content`、`BaseModal` 或重复弹窗主题
2. ❌ 直接使用未登记的 `el-dialog` 或覆盖 `.el-dialog__header/body/footer`
3. ❌ 在页面写 `width: min(..., 100vw)`、`calc(100vw - ...)` 或重复断点规则
4. ❌ 忘记配置日期选择器的时区
5. ❌ 使用内联样式覆盖全局弹窗结构（难维护）

---

## 相关文件

- **统一模态框结构**: `/frontend/src/components/MobileDialog.vue`
- **统一模态框样式**: `/frontend/src/styles/components/_dialog.scss`
- **统一底部按钮**: `/frontend/src/styles/components/_dialog-actions.scss`
- **参考实现**: `/frontend/src/views/salary/SalaryView.vue`
- **响应式宽度规范**: [`dialog-standards.md`](dialog-standards.md)
- **弹窗审计脚本**: `/frontend/scripts/check-dialog-adoption.mjs`

---

## 快速检查清单

当开发新的模态框时，确保：

- [ ] 使用 MobileDialog 或已登记的统一 el-dialog
- [ ] 通过 `width`/`maxWidth` 声明业务宽度，没有页面级 viewport 计算
- [ ] PC、平板、手机宽度均不溢出，正文超高时可滚动
- [ ] 标题、遮罩、关闭按钮、正文和圆角使用公共 Token
- [ ] footer 使用 `.tf-dialog-actions`，按钮没有页面级重复尺寸
- [ ] 支持点击遮罩关闭
- [ ] 支持 ESC 键关闭
- [ ] 日期选择器配置了时区和语言
- [ ] 关闭时重置表单状态
- [ ] 移动端按钮保持一行并避开安全区
- [ ] 没有页面级 `.el-dialog__header/body/footer` 或自建弹窗外壳
- [ ] 运行 `npm run check:dialogs`、`npm run check:ui` 和 `npm run type-check`

---

**最后更新**: 2026-10-01
**问题发现**: 国补管理模块开发
**解决方案**: MobileDialog + 全局弹窗 Token + 响应式宽度审计
