# TF2025 对话框统一规范

## 统一入口

所有后台弹窗共用以下入口，PC、iPad 和手机通过同一套 CSS 令牌与媒体查询维护：

| 文件 | 职责 |
| --- | --- |
| `frontend/src/components/MobileDialog.vue` | 弹窗结构、关闭行为、响应式模式、默认 footer |
| `frontend/src/components/MediaPreviewViewer.vue` | 图片/视频全屏预览、缩放、切换及可选删除/下载事件 |
| `frontend/src/styles/components/_dialog.scss` | 遮罩、宽度、圆角、标题栏、关闭按钮、正文间距、确认框内容宽度、移动端边界 |
| `frontend/src/styles/components/_dialog-actions.scss` | 取消/确认按钮的排列、尺寸、间距和移动端居中等分布局 |
| `frontend/src/styles/components/_buttons.scss` | 按钮颜色、语义和普通按钮视觉 |

关闭按钮统一使用 `MobileDialog` 的 `tf-button--dialog-close` 语义。该语义同时覆盖 Element Plus 的 `--el-button-*` 变量和 SVG 图标尺寸；公共弹窗样式还按 `.mobile-dialog-sheet-close` 结构类提供兜底，禁止浏览器默认按钮外观在手机端泄漏。PC 与手机端都必须保持半透明标题栏背景、白色关闭图标和圆形触控区域；业务页面不得重新设置关闭按钮背景、颜色、宽高或 SVG 尺寸。

`MobileDialog` 在手机和平板使用 sheet 布局，在桌面使用 Element Plus Dialog。宽度按断点收敛：手机（`<=767px`）使用接近满宽的弹窗；平板（`768-1024px`）宽度上限为视口的 `80%`，并继续受页面 `width`/`maxWidth` 参数约束；桌面（`>=1025px`）优先按页面声明宽度，未声明时采用档位或默认宽度，并统一受视口边界约束。最终规则统一采用 `min(页面声明宽度, 可用视口宽度)`，与库存管理弹窗的自适应行为一致。不要在业务页面用 `!important` 再覆盖这些断点规则。

手机和平板遮罩关闭必须确认同一次主指针在遮罩上按下并抬起；正文、标题栏、footer 内开始的操作，以及移动超过 `10px`、指针取消或弹窗出现后的兼容穿透点击，均不得触发遮罩关闭。每次弹窗打开/关闭都清空记录。该规则由 `MobileDialog` 统一维护，`check:dialogs` 检查接入；不能靠业务页复制延时器或缩小正文点击区域处理。

公共遮罩的 flex 居中样式不得强制覆盖组件的隐藏状态。电脑窄窗口同样可能使用 sheet；关闭后须同时确认 `v-model` 为 false、外壳和遮罩实际不可见，不能只检查关闭事件。浏览器回归 `test:dialog-widths -- --interactions-only` 覆盖有/无遮罩、标题关闭、主动重开和业务关闭；库存明细的父子状态与查询次数另由 `tests/inventory-result-dialog.spec.ts` 验证。

### 宽度行为

`width` 只声明业务弹窗的期望宽度，`maxWidth` 用于声明更严格的上限；两者都不是固定像素锁定。全局实现会根据当前视口自动取较小值：

普通新增/编辑弹窗优先省略 `width`，由全局 CSS 依次选择页面使用的 `crud-dialog-*` 档位和公共默认令牌 `--tf-dialog-width`（当前 `880px`）。国补新增申请和编辑信息已统一采用此默认值；原新增 `900px`、编辑 `760px` 及父页面手机端强制加宽的覆盖已移除。默认宽度只在 `_dialog.scss` 定义，不能在组件中再保存一份像素默认值。

宽度优先级为：**显式 `width` → 全局档位 → 默认宽度**。页面无需强制传入尺寸：不配置时自动使用默认 `880px`，页面明确指定尺寸或引用档位时优先采用页面声明，最终按屏幕可用空间收缩。`MobileDialog` 不为 `width` 注入默认参数；没有传值或移除值时，不留下覆盖档位的内联尺寸。档位数值只在 `_dialog.scss` 的 `--tf-dialog-tier-width` 定义，组件内不复制尺寸表。客户新增、编辑及详情使用 `crud-dialog-lg`，桌面宽度为 `800px`；库存入库弹窗显式声明桌面 `1240px`，不会被默认宽度或默认上限截断。

`maxWidth` 仅限制上限，不替代期望宽度；例如 `width="900px" max-width="700px"` 最多为 `700px`，`width="500px" max-width="900px"` 仍为 `500px`。明确指定数值或固定长度（如 `1240px`）的宽工作台可以超过公共默认上限，但始终受视口边界限制。百分比、视口单位、CSS 表达式和 `auto` / `fit-content` 等自适应宽度默认受档位或公共 `--tf-dialog-max-width`（桌面 `880px`）限制，不能自动把自身当成最大宽度；工作台确需放宽时显式传入 `maxWidth`。例如综合查询双击全新/二手打开的素材管理使用 `width="90%"`，桌面最大为 `880px`，不会随大屏无限加宽。百分比保留原本语义，不再被改为 `70vw`；内容自适应关键字不能作为数值传入 CSS `min()`。当前不强制统一最小宽度，以保留小弹窗和窄屏适配。

手机端未指定 `width` 时，各档位均采用接近满宽布局；明确指定较小宽度或 `maxWidth` 时继续尊重该限制。平板上限为视口 `80%`，PC、平板和手机共享同一套尺寸来源和上限规则。

`/permissions` 角色列表的字段权限弹窗及用户角色的分配角色弹窗均不声明 `width`/`maxWidth`，使用公共默认宽度；原 `1200px`、`1180px` 声明和页面 CSS 宽度覆盖已移除。模块入口的字段权限配置仍保留自身 `900px` 声明。

角色字段权限弹窗的“子页面 / 分组”导航使用公共 `el-button.tf-button--content`，列表间距由容器管理，清除相邻按钮附加边距；每项名称与数量为首行，敏感级别与隐藏数为次行，长名称自然换行，避免窄列内错位或裁切。选中态通过 `aria-pressed` 采用公共浅紫底、紫色边框和文字；平板和手机的导航网格按内容确定行高并独立滚动。

统一的是宽度计算、上限和响应式规则，并非要求所有业务弹窗完全同宽。表格、照片管理等确需更大空间的工作台仍可通过 `width`/`maxWidth` 声明业务宽度，不能用私有 CSS 覆盖外壳、标题栏或手机端边界。

| 视口 | 统一行为 |
| --- | --- |
| 桌面 `>=1025px` | `min(width, 可用视口宽度)`，同时受 `maxWidth` 限制 |
| 平板 `768-1024px` | 最大为视口 `80%`，同时受页面宽度上限限制 |
| 手机 `<=767px` | 使用接近满宽的 sheet，并保留统一左右安全间距 |

标准写法：

```vue
<MobileDialog
  v-model="visible"
  title="编辑设备"
  width="900px"
  max-width="960px"
  dialog-class="device-edit-dialog"
>
  <!-- 内容区由业务组件负责，弹窗宽度由全局入口负责 -->
</MobileDialog>
```

业务页面不得再写 `width: min(..., 100vw)`、`width: calc(100vw - ...)` 或按断点重复覆盖 `.el-dialog` / `.mobile-dialog-sheet-panel`。需要更宽的表格或媒体工作台时，只声明 `width`/`maxWidth` 或使用已登记的工作台例外；不要复制库存页面的局部宽度 CSS。

短内容弹窗沿用 `MobileDialog` 的内容自适应布局；内容超过可用高度时，由公共正文区域滚动。客服等多行卡片必须使用公共内容按钮规格，不能继承普通按钮的固定高度，也不得通过增大弹窗高度或页面私有 `max-height` 掩盖卡片溢出。手机端验收须确认图标、标签、号码的实际边界均位于卡片和弹窗正文内。

`/query` 页面及 `QueryDetailDialog.vue` 中的所有业务弹窗必须使用 `MobileDialog`；媒体工作台也不再以直接 `el-dialog` 作为响应式例外。`check:dialogs` 会持续检查这两个入口。

`QuickSaleModal.vue` 属于 `/query` 的标准业务弹窗。其 `dialog-class` 只能用于标识业务内容布局；不得在页面内覆盖标题栏高度、标题栏内边距、圆角、弹窗外壳最大高度、正文间距或 footer 间距。需要调整弹窗宽度时使用 `width`/`maxWidth` 属性，统一外壳视觉始终由 `MobileDialog` 和本文件规定的全局样式控制。

以上样式由 `frontend/src/main.ts` 全局加载。页面不得再维护第二套弹窗外壳样式。

`tf-dialog-body-flush` 是唯一正文贴边变体，PC 和手机共用，不在业务样式中写零 padding。销售出库、批量销售、调货/划拨、销售单据及多栏权限工作台按内容语义使用该变体。

`tf-dialog-workspace` 用于权限矩阵、角色分配等需要独立滚动的多栏工作台：桌面高度取 `min(820px, 100dvh - 48px)`，手机/平板取 `100dvh - 24px`，最终仍受公共外壳最大高度约束；标题与 footer 不收缩，正文填充剩余空间。提供 `100vh` 回退，高度参数由公共工作台令牌定义。高度与滚动由 `_dialog.scss` 唯一维护，业务只控制内部栏位，不设置私有全屏、圆角、正文 padding 或外壳高度。

`MobileDialog` 和 `MediaPreviewViewer` 共享 `useOverlayStack` 管理打开顺序、最上层键盘响应及滚动锁。关闭或卸载任何非最后一层不得解除页面锁；最终关闭恢复原有 overflow，空媒体列表不持有不可见的锁。手机分支复用 Element Plus FocusTrap 保留 Tab 环绕和焦点恢复；确认框或媒体查看在上层时 Escape 不关闭下层表单。初始可见、重复开关、销毁及嵌套弹窗继续保持 `open/opened/close/closed` 事件契约；`opened` 在进入过渡完成后发出，`opened/closed` 每轮各发一次。标题关闭、遮罩和 Escape 在 PC/手机均遵守 `beforeClose(done)`；调用 `done(true)` 或不调用 `done` 时保留弹窗，普通取消按钮和业务修改 `v-model` 仍由业务决定是否关闭。

客户姓名的 iOS 双击入口使用 `useCustomerNamePrompt` 调用公共 `useNotification().prompt`：规范化、空值、取消及提示由公共入口处理，输入/保存期间拒绝重复打开，业务校验目标客户是否仍一致。原生 `window.prompt` 与无调用兼容函数已移除；真机键盘行为仍须独立验收。

## 组件选择

- 新增业务弹窗优先使用 `MobileDialog`。
- 业务模板只使用 `MobileDialog`，自定义 header/footer、生命周期事件及手机 sheet 均由公共组件提供；`el-dialog` 只保留在公共组件内部。确认、提示和输入使用公共通知服务。
- 不新增自定义 `modal-overlay`、`modal-content`、`BaseModal` 或新的弹窗主题。
- 图片预览、富文本、表格工作台等复杂内容可以使用业务 class，但只允许调整内容布局或宽度变体。

2026-11-11 已将原 6 文件 / 12 处直接 `el-dialog` 迁入 `MobileDialog`，既有例外已全部删除。`check:dialogs` 对业务直接 Dialog、直接图片查看器、浏览器原生输入与私有外壳覆盖执行零容忍检查；不得新增白名单恢复旧入口。

国补申请和照片管理中的图片查看统一使用 `MediaPreviewViewer`，不得恢复独立的照片查看 Dialog、翻页按钮或预览工具尺寸。照片管理主工作台使用 `MobileDialog`；其缩略图查看/删除使用公共小号圆形按钮，删除入口继续受原上传权限控制。全屏预览工具使用 `tf-button--overlay-tool`，删除附加 `tf-button--overlay-danger`；下载通过 `downloadable` 和 `download` 事件交回业务下载入口处理，公共查看器不直接发起下载请求。

预览中触发的删除确认必须显示在查看器上方。`_variables.scss` 将 `--tf-z-message-box` 定义为查看器层级加一，`_dialog.scss` 同时控制 MessageBox 根遮罩和内容层；禁止业务页单独提高层级。确认框处理键盘事件时，查看器不同时响应关闭或翻页。

## 统一视觉令牌

弹窗外观令牌集中在 `_dialog.scss` 的 `:root` 中；按钮布局与尺寸令牌由 `_dialog-actions.scss` 唯一维护。常用外观令牌包括：

PC、平板和手机的彩色标题栏统一为 `50px`（CSS 像素），唯一高度定义为 `--tf-dialog-header-height`。Element Plus Dialog、MessageBox 和 `MobileDialog` 的 sheet 均读取公共标题栏规则；上下内边距为零，标题与关闭按钮垂直居中。业务页面不得重复设置标题栏高度、最小高度、上下内边距或关闭按钮顶部偏移；旧的 sheet 高度和窄屏覆盖已移除。安全区在公共遮罩外层预留，不叠加到标题栏或悬浮 footer 内。

顶部关闭按钮的图标统一为 `18px`。视口至少 `480px` 时，触控区域为 `32 × 32px`、距右侧 `16px`，在 `50px` 标题栏内上下各留 `9px`；小于 `480px` 时为 `30 × 30px`、距右侧 `12px`、上下各留 `10px`。顶部偏移由 `(标题栏高度 - 按钮尺寸) / 2` 计算，所有页面读取公共令牌，不重复定义。

```scss
--tf-dialog-radius
--tf-dialog-shadow
--tf-dialog-header-bg
--tf-dialog-header-height
--tf-dialog-title-size
--tf-dialog-close-size
--tf-dialog-body-padding-inline
--tf-dialog-body-padding-block
--tf-dialog-footer-padding-inline
```

默认值适用于 PC；`768px` 以下切换到移动端宽度、间距和安全区；`480px` 以下进一步收紧标题栏左右间距、正文和 footer，标题栏高度保持一致。修改全局弹窗外观时使用 `_dialog.scss`，按钮尺寸和布局使用 `_dialog-actions.scss`，不要在页面中复制具体像素值。

### 弹窗文字字号

弹窗文字统一读取 `frontend/src/styles/_variables.scss` 的语义文字令牌：

| 文字类型 | PC | 手机 | 超窄屏（不超过 375px） |
| --- | ---: | ---: | ---: |
| 标题 | 16px | 16px | 15px |
| 正文和提示 | 14px | 15px | 14px |
| 表单标签 | 14px | 14px | 13px |
| 普通按钮（footer 与正文工具栏见下文） | 14px | 14px | 13px |

标题使用 `--tf-font-dialog-title`，正文使用 `--tf-font-body`，标签使用 `--tf-font-label`，按钮使用 `--tf-button-font-size`。`MobileDialog`、Element Plus Dialog 和 MessageBox 必须遵循同一组令牌；业务页面不得单独设置弹窗标题、提示正文或表单标签字号。业务提示可以调整换行、最大高度和行高，但不得复制字号值。

MessageBox 的默认宽度由 `--tf-dialog-message-width` 统一控制，当前为 `560px`，用于减少删除确认、清空确认等长内容的无必要换行。手机端仍通过视口可用宽度自动收缩，页面不得单独给某一个删除确认框设置宽度。

退出登录确认使用 `message-box-logout` 语义 class 隐藏标题前的警示状态图标；删除、清空等具有风险提示意义的确认框继续保留公共状态图标。页面不得通过全局选择器统一隐藏所有 MessageBox 图标。

历史页面使用的 `--dialog-*` 变量仍保留为兼容别名，新增代码应使用 `--tf-dialog-*` 变量。`crud-dialog-sm/md/md-lg/lg` 只改变弹窗宽度，不改变标题、圆角和底部按钮。

### 宽度档位

标准 CRUD 表单/详情弹窗宽度由 `_dialog.scss` 定义的档位 class 统一控制，通过 `dialog-class="... crud-dialog-*"` 应用；页面不再写独立 `width` 像素：

| 档位 class | 桌面宽度 | 适用 |
| --- | ---: | --- |
| `crud-dialog-sm` | 500px | 单列表单、结算/模板设置等窄弹窗 |
| `crud-dialog-md` | 600px | 常规新增/编辑 |
| `crud-dialog-md-lg` | 700px | 需要稍宽空间的表单/详情（如员工表单、H5 商品配置、工资详情/考勤表单） |
| `crud-dialog-lg` | 800px | 多列表单、宽详情（如客户、考勤表单、工资模板） |

每档同时在手机端复用 `_dialog.scss` 的 `<=767px`、`<=479px` 边界，不得在页面重复声明 `--dialog-max-width` 或手机端弹窗变量。选择就近档位：期望宽度四舍五入到最近档位，偏差控制在 20~40px 内。

超过 `800px` 的宽数据视图（如库存 900/800 编辑/详情、销售 1000/900/1200 交易与明细、工资 960/1100 及列数自适应的销售明细）属于宽表/自适应例外：它们可保留自身 `width`/`:width` 声明，通过 `MobileDialog` 属性声明尺寸，不强制压入 `lg`；但只能声明宽度，不得用私有 CSS 覆盖弹窗外壳、标题栏或手机端边界。`InventoryView.vue` 的非 scoped 全局块已完成治理：清除了位于所有 `</style>` 之后、不被 SFC 产出的孤儿私色/私有卡片样式（旧 `device-card`/`grid-container`/`table-cell` 等，其现由 `sales-grid-view.scss`、`sales-device-info-panel.scss` 等各自 scoped 样式承载），并将编辑弹窗私有卡片外壳 `inventory-edit-form-shell` 的圆角、内边距与栅格间距回归 `--tf-radius-panel`、`--tf-space-*` 公共令牌；弹窗宽度仍按本条例外保留。`npm run check:dialogs` 校验档位定义、已归一页面引用档位且不再声明页面级 `--dialog-max-width`；`npm run check:design-tokens` 以棘轮约束非 scoped 全局块不得新增硬编码设计值。

## 标准结构

```vue
<MobileDialog
  v-model="visible"
  title="编辑资料"
  dialog-class="customer-form-dialog"
  @confirm="save"
>
  <el-form class="tf-dialog-form tf-dialog-form--stacked" :model="form">
    <el-form-item label="名称">
      <el-input v-model="form.name" />
    </el-form-item>
  </el-form>
</MobileDialog>
```

`MobileDialog` 的自定义 footer 插槽会直接渲染在唯一的 `.el-dialog__footer` 容器内。不得在公共组件中再套 `.mobile-dialog-footer` 等外壳；业务方只保留按钮组 `.tf-dialog-actions`。外层 footer 的边框、背景、间距和安全区由 `_dialog.scss` 统一控制，按钮排列由 `_dialog-actions.scss` 统一控制。这样可避免底部出现嵌套背景、重复留白或双层边界。

权限管理的角色新增/编辑、角色字段权限、模块字段权限、分配角色、绑定门店，以及模块管理内的四个弹窗均使用此结构。字段数量摘要位于正文；不再保留 `permission-summary-footer` 的固定高度/绝对定位，也不在分配角色中嵌套 `modal-footer` 外壳。

使用原生 `el-dialog` 时，footer 使用统一 class：

```vue
<template #footer>
  <div class="tf-dialog-actions">
    <el-button @click="visible = false">取消</el-button>
    <el-button type="primary" @click="save">保存</el-button>
  </div>
</template>
```

## 表单和正文

- 品牌 `/brands`、型号 `/models`、颜色 `/colors` 和内存 `/memories` 的新增弹窗点击取消、顶部关闭或按 Esc 时直接关闭并重置草稿，不弹出未保存确认；编辑已有记录时继续保留未保存确认。各页通过 `MobileDialog` 的 `v-model` 处理关闭请求，不再同时监听 `close` 重复执行关闭逻辑。页面回归见 `frontend/tests/reference-management-pages.spec.ts`，公共关闭行为见 `frontend/tests/mobile-dialog.spec.ts`。
- 普通横向表单使用 `.tf-dialog-form`。
- 标签置顶的编辑器使用 `.tf-dialog-form--stacked`。
- 弹窗中的输入框、下拉框、日期框和数字框与全局普通表单统一为 `30px` 高；各设备共用 `_form-controls.scss` 和公共表单高度令牌。
- 默认正文间距由 `_dialog.scss` 控制，页面不重复设置 `.el-dialog__body` 的 padding。
- 图片、表格或富文本确实需要贴边时使用 `.tf-dialog-body-flush`，只用于该业务变体。
- 内容超高时正文滚动，不能隐藏滚动导致按钮不可操作。
- 内容超宽时只在内容内部横向滚动，不能撑宽弹窗。

### 主屏幕书签与安全区

Safari 标签页和主屏幕书签可能返回不同的 `safe-area-inset-*`。悬浮 Dialog、手机/平板 sheet 与 MessageBox 由 `_dialog.scss` 在遮罩四边按 `max(公共间距, env(对应安全区))` 统一避让；sheet 的布局间距仍由公共组件和档位提供。外壳最大高度同时受遮罩可用内容高度限制，长图和工作台正文内部滚动。页面不得按 `standalone` 或机型复制第二套 padding。

悬浮 footer 不再额外叠加整屏底部安全区。`<=479px` 按钮上下内边距各 `10px`，`480–767px` 各 `12px`；PC/平板保留上 `16px`、下 `20px`。销售报价 `/sales-price-display` 与批发报价 `/price-query` 保存图片弹窗使用相同公共外壳及三个操作的按钮语义，普通浏览器与书签打开时 footer 间距保持一致。贴屏幕底边的页面固定操作仍遵循移动端指南的安全区规则。

`npm --prefix frontend run test:dialog-widths -- --safe-area-only` 使用两个页面的真实保存弹窗模板，模拟零安全区和主屏幕上下/左右安全区，检查长图滚动、按钮及外壳边界、销售/批发一致性和工作台高度。此项也包含在完整 `test:dialog-widths` 中；Chromium 的安全区仿真不替代 iOS 主屏幕真机验收。

## Footer 按钮

- 按钮公共尺寸：PC 高度为 `32px`、最小宽度 `64px`、水平内边距 `8px`、按钮间距 `4px`；平板（`768–1024px`）高度为 `40px`、间距 `8px`、水平内边距 `10px`；手机（`<=767px`）高度为 `clamp(30px, 8.54vw, 32px)`、字号 `12px`、间距 `6px`、水平内边距 `clamp(6px, 2.14vw, 8px)`，圆角复用公共控件令牌（`6px`）。手机和平板按钮在可用宽度内按实际数量等分，每个最大 `150px`（`--tf-dialog-action-max-width`），空间充足时每个为 `150px`，空间不足时等分收缩，整组居中；页面不设置固定宽度或最小宽度。
- 所有业务 footer 容器及详情正文末尾的操作区必须使用 `.tf-dialog-actions`（可与业务语义 class 并列）；综合查询不再维护私有按钮网格或尺寸。
- PC 端按钮靠右、按内容宽度排列；按钮使用统一最小宽度、统一高度和统一间距。
- 手机和平板按钮保持一行并在 footer 可用宽度内居中等分，取消在左、确认/保存/提交在右；操作区占满可用宽度，所有按钮等宽且不超过公共宽度上限，整组左右留白必须对称。按钮间距和底部安全区由全局令牌控制。
- 三个及以上按钮仍使用同一行居中等分布局；不在页面中改成独立 grid 或分别设置左右宽度。
- 不在页面中给 footer 按钮重复设置高度、宽度、圆角或间距。
- PC footer 按钮由全局令牌统一为 `32px`；平板维持 `40px`，手机统一使用综合查询紧凑规格（约 `30–32px`）。`MobileDialog` 不得另设按钮尺寸等级或覆盖对应断点高度。
- 公共 footer 和 `.tf-dialog-toolbar` 内的 `small/default/large` 高度别名统一映射到 `--tf-dialog-action-height`，防止页面遗留的 `size` 属性覆盖公共规格；新代码不再为这些按钮指定尺寸等级。
- 取消使用中性语义，保存/确认使用 `primary`，删除使用 `danger`，完成使用 `success`。
- 业务 footer 容器可以保留自己的 class，但应同时使用 `.tf-dialog-actions`。

历史页面即使在 footer 插槽中直接放置 `<el-button>`，也会由 `_dialog-actions.scss` 对 Element Plus footer 直接子级统一尺寸；新代码仍必须显式使用 `.tf-dialog-actions`，便于维护一致的按钮间距和响应式排列。`MobileDialog` 不会为自定义 footer 插槽添加额外包装层。

弹窗正文中的上传、批量下载等命令按钮组使用 `.tf-dialog-toolbar`，复用 footer 的高度、字号和内边距，按内容排列且窄屏可换行；不要在页面中再写 `40px/36px` 等高度。缩略图圆形图标和全屏媒体工具遵守各自的公共按钮语义，不套用正文命令按钮组。

`_dialog.scss` 只维护 footer 的背景、分隔线和内边距；不再重复声明操作区布局、间距或对齐，避免旧 class 的较高优先级覆盖公共规则。

业务 footer 只允许维护摘要、提示和弹窗宽度等业务布局。禁止在页面样式中重新声明 footer 的 `grid`、
手机端 `flex-direction: column`、按钮 `width/min-width/max-width/height/min-height/padding`。这些规则由
`_dialog-actions.scss` 唯一维护，`npm run check:dialog-actions` 会在启动和构建前拦截重复实现。

仅复测按钮可运行 `npm --prefix frontend run test:dialog-widths -- --actions-only`。完整浏览器回归：`npm --prefix frontend run test:dialog-widths` 同时检查弹窗宽度和公共按钮在 360/375/390/430/767/768/1024/1440px 下的实际尺寸、单行等宽、宽屏宽度上限与整组居中、尺寸别名及明暗主题。测试隔离权限依赖和 Vite 缓存，不访问云端数据；浏览器模拟不能替代 iOS/Android 真机验收。

## 页面覆盖边界

允许：宽度变体、内容区网格/表格/图片布局、明确的全屏或无 padding 工作台变体。

禁止：页面重新定义 `.el-dialog__header`、`.el-dialog__body`、`.el-dialog__footer` 的公共视觉；直接写弹窗主题颜色、统一圆角和通用阴影；新增旧式 `.modal-overlay` 或重复的 `modal-styles.scss`；通过提高页面 z-index 解决弹窗层级问题。

## 全量盘点与接入判定

全站盘点使用 `npm --prefix frontend run audit:dialogs`。脚本读取实际路由树、全部 Vue 模板及 TS/JS 中的显式原生弹框，核对[页面台账](page-audit-inventory.md)的页面/组件数量。`-- --json` 输出模板实例、源码位置、路由依赖、服务调用点、原生弹框和样式覆盖候选；`-- --markdown` 输出逐路由组件矩阵。统计工具位于 `frontend/scripts/audit-dialog-coverage.mjs`；`check:dialogs` 同时运行其正式正反例和台账数量一致性测试。

必须区分以下证据：

- **组件接入**：`MobileDialog` 的模板引用数、直接 `el-dialog` 的业务引用数及媒体查看入口分别统计；公共组件自身的内部 `el-dialog` 不重复算成业务弹窗。确认/输入/提示服务按调用点另计，不能与模板数相加当作运行时弹窗总数。
- **全局外观**：使用公共组件仍可能被业务 CSS 覆盖；必须核对圆角、宽度边界、标题、关闭按钮、正文、footer、按钮与安全区。扫描候选只表示需要检查源码、引入关系与最终计算样式，不表示该规则已生效或必然违规；不能将候选清零作为允许删除业务布局的理由。
- **双端验收**：源码接入、静态审计与公共组件浏览器回归均不证明每个业务页面的 PC/手机体验已通过。逐页回归及 Android/iOS 真机按[视觉回归清单](visual-regression-checklist.md)记录。

路由依赖图包含静态和异步 `.vue` 导入、可唯一发现的公共组件标签；路由页面、所属布局、全局宿主分开统计，共享组件不能按 URL 重复累加。动态组件字符串、别名/运行时注册、服务调用链、SCSS 嵌套、内联及条件样式仍需人工核对。没有路由关联的组件只列为调用证据待确认，不能自动删除。`audit:dialogs` 是只读诊断，成功退出表示统计完成与台账数量一致，**不表示存量问题已解决**；原有 `check:dialogs` 和 `check:dialog-actions` 继续作为门禁。

2026-11-11 全量基准及逐路由矩阵见[页面台账的模态框复核](page-audit-inventory.md#全量模态框接入复核2026-11-11)，整改与验收任务统一登记在[全局技术债务 T21](../development/TECHNICAL_DEBT_PROGRESS.md#t21-全局模态框双端统一2026-11-11)。

## 检查清单

- [ ] 使用 `MobileDialog` 或复用全局 `el-dialog` 样式
- [ ] PC、iPad、手机宽度均不溢出
- [ ] 标题、关闭按钮、正文和 footer 使用公共令牌
- [ ] footer 使用 `.tf-dialog-actions`
- [ ] 自定义 footer 插槽只有一个 `.el-dialog__footer` 外壳，没有嵌套 `.mobile-dialog-footer` 背景层
- [ ] 手机端按钮保持一行且避开安全区
- [ ] 正文可滚动，footer 始终可操作
- [ ] 页面没有重复的弹窗外壳样式
- [ ] 运行 `npm run type-check`、`npm run check:ui` 和 `npm run build`
- [ ] 运行 `npm run check:dialogs`，确认业务直接 `el-dialog`、原生弹框和私有外壳覆盖均为零
- [ ] 运行 `npm run check:dialog-actions`，确认没有 footer 的 grid、纵向排列或固定按钮尺寸覆盖
- [ ] 运行 `npm run check:dialogs`，确认 `MobileDialog` 没有重复 footer 包装层
- [ ] 检查没有页面级 `width: calc(100vw - ...)` 或 `width: min(..., 100vw)` 覆盖全局宽度

### 宽度回归验证

- `npm --prefix frontend run test:unit -- tests/mobile-dialog.spec.ts`：验证尺寸参数缺省、更新和移除后的行为。
- `npm --prefix frontend run test:dialog-widths`：启动隔离的本地组件页，用 Chrome/Chromium 测量 8 种视口（含 1920px 大屏）、明暗主题、4 个档位、显式宽度、最大宽度、百分比和内容自适应。需要本机 Chrome/Chromium，可通过 `CHROME_BIN` 指定可执行文件；未安装时明确失败，不跳过。Vite `cacheDir` 位于本次临时目录内，不共用开发服务的 `node_modules/.vite`。验证不访问云端 API，结束后自动关闭服务、浏览器并删除临时用户目录及测试预构建缓存。
- `check:dialogs` 同时运行审计器正反例，防止恢复组件默认宽度或破坏全局档位定义。静态审计和参数单测不能替代浏览器实际尺寸测量；以上检查不代表业务页面逐页或 iOS/Android 真机验收。
