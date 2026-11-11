# TF2025 全局按钮统一规范

## 目标和适用范围

本规范适用于 Vue 3 前端的页面工具栏、搜索区、表格和卡片操作、手机展开操作、模态框底部、确认提示框及所有端内按钮。业务页面只决定按钮是否显示、按钮文字、图标和点击行为，不再自行决定普通命令按钮的颜色、尺寸、圆角或悬停效果。

所有页面默认接入公共按钮规则，PC 和手机端由公共入口统一控制。确有特殊需求时，必须先在公共入口定义可复用的规格或语义，并同步本文、审计及标杆预览，再由页面引用；页面声明不能直接覆盖公共外观。页面只保留按钮位置、分组、满宽、防溢出等布局，不得在媒体查询、任意私有 class 或行内样式中重设高度、内边距、字体、固定宽度、颜色、边框、阴影或按钮变量。

## 强制组件规则

图片及图片/视频混合上传入口统一显示“上传图片”，不再使用“上传素材”“上传图片/视频”“上传图片 / 视频”或“上传照片/视频”。按钮名称不决定可上传类型，图片、视频或其他文件是否允许上传，继续由当前入口的 `accept`、文件校验及后端规则决定；格式限制和单个文件的类型提示保留准确说明，专用视频或文件入口按各自用途命名。

全局禁止原生 `<button>`。所有按钮必须使用 Element Plus `<el-button>`，包括图标按钮、分页、关闭、菜单、标签页、锁屏、媒体预览、扫描器、权限开关、登录、H5 和公开报价页按钮。普通按钮使用 `native-type="button"`，表单提交使用 `native-type="submit"`；不得通过原生标签、页面例外登记或自定义 HTML 按钮绕过全局规范。

提交或打包前必须通过 `npm run check:component-adoption`，该审计对 Vue 页面和公共组件中的原生 `<button>` 零容忍。按钮视觉统一由本文和 `frontend/src/styles/components/_buttons.scss` 控制，页面只使用 Element Plus 类型和公共语义 class。

手机端公共控件使用以下全局语义 class：`tf-button--menu`（顶部菜单入口）、`tf-button--mobile-nav`（返回/菜单）、`tf-button--dialog-close`（模态框关闭）、`tf-button--fab`（浮动操作）、`tf-button--overlay-tool`（媒体/扫码器工具）、`tf-button--dismiss`（通知关闭）、`tf-button--tab-action`（标签栏操作，含图标字号）和 `tf-button--menu-action`（侧滑菜单展开/收起）。H5 商城和筛选场景使用 `tf-button--h5-action`（带 `-neutral/-warning/-primary/-success` 变体，胶囊主操作）、`tf-button--h5-action-icon`（图标操作）、`tf-button--pill-filter`（筛选胶囊，选中态加 `is-active`）和 `tf-button--icon-badge`（图标删除角标）。这些 class 的尺寸、背景、边框、焦点和响应式行为只在 `_buttons.scss` 维护，页面组件不得重复定义。

H5 手机端操作按钮和筛选语义的规格由公共令牌控制：主操作高度 `--tf-h5-action-height`（44px）、图标按钮边长 `--tf-h5-action-icon-size`（32px）、胶囊内边距 `--tf-button-pill-padding-*`、角标直径 `--tf-button-badge-size`（18px）。变体颜色全部映射 `--tf-button-*` 公共变量，必须先在同一公共段定义默认、悬停和选中状态再开放给页面；页面只负责内容与布局（如整行容器的 width:100%），不得再写高度、圆角、字号或背景。`tf-button--h5-action`、`tf-button--h5-action-icon` 和 `tf-button--pill-filter` 已加入普通按钮基线的 `:where()` 排除列表，由 `check:buttons` 断言。

手机端图标按钮专项约束：菜单入口使用本地 `menu-bars.svg` 三条横杠，经 `IconRenderer` 渲染，背景为品牌靛蓝、图标为白色，悬停/聚焦使用深紫色，PC 端不显示手机菜单入口，顶部栏容器仍保持白色。入口按钮统一为 `40px × 40px`、圆角 `12px`、图标 `20px`、内边距 `0`，由 `--tf-button-menu-*` 令牌控制；不得使用 Element Plus `Menu` 图标代替三条横杠，该图标实际为四格图案。展开菜单后入口降到遮罩层后方隐藏，点击遮罩关闭菜单；侧滑菜单展开按钮为透明背景、白色箭头、`32px` 方形触控区域，不能增加圆形背景遮挡名称，也不得增加菜单内部关闭按钮。通知关闭、标签栏关闭等按钮必须保留公共定义的触控区域；媒体预览、扫码器工具和密码显示切换统一使用遮罩工具语义，预览导航支持触摸滑动时不得让页面滚动层抢走手势。360px 窄屏下，提示框、菜单头部和预览工具栏必须使用 `min-width: 0`、省略或自适应宽度，不得产生横向溢出。

默认按钮的中性色和普通尺寸只作为低优先级基线：筛选条件必须放入 `:where()`，不得把多个 `:not()` 直接叠在 `.el-button` 后累加优先级。公共 `tf-button--*` 语义必须能覆盖基线，尤其菜单入口、模态框关闭、移动返回及管理按钮；不能依靠页面堆叠 class 或重复 `!important` 修复。审计 `check:buttons` 检查这一约束；视觉验收必须核对浏览器最终计算的背景、图标颜色、宽高、内边距和圆角，静态审计通过不能替代显示结果。

客服卡片使用 `el-button.tf-button--service-card`，悬浮客服入口使用 `el-button.tf-button--service-float`，规格统一在 `_buttons.scss` 维护。这两种按钮排除普通按钮的固定高度与默认中性色基线：卡片最小高度读取 `--tf-service-card-min-height`，长内容自然增高；浮标宽高读取 `--tf-service-float-size` 并保持圆形。并列卡片使用布局容器的间距，公共按钮须清除 Element Plus 相邻按钮的额外左边距。页面只负责联系方式内容与布局，不得重复维护按钮尺寸或背景。

多行导航及可切换内容选项使用 `el-button.tf-button--content`：公共入口按内容自适应高度，允许换行，清除相邻按钮的附加左边距，内边距、圆角和文字读取公共令牌；通过 `aria-pressed="true"` 使用 `--tf-button-content-selected-*` 的浅紫底、紫色边框和文字，悬停及聚焦保留选中配色。页面只维护内部内容排列和列表布局。权限管理的页面模块、子页面 / 分组、角色库、本次分配和绑定门店使用此入口；多选项再次点击取消，保存期间禁用。不能通过给内部卡片另设边框、渐变或选中背景覆盖公共按钮外壳。

表格业务字段中的可点击文字（例如待办“事项”标题）统一使用 `el-button.table-inline-action`，沿用 PC 28px、手机 32px 的公共操作高度，左右内边距分别为 7px、8px，字号为公共表格操作字号（PC 13px，手机跟随公共表格字号及窄屏档位）。不得使用多行内容选项 `tf-button--content`，避免 12px 的四周留白撑高数据行。单元格留白由公共表格入口自动识别并计算，宽度使用公共文本列宽工具按当前数据扩展，长标题保持单行完整展示，由表格内部横向滚动。查看详情类文字按钮在此基础上添加 `table-action--view`，复用公共浅青蓝背景、深青蓝文字及悬停/聚焦配色，页面不得自行设置背景色。普通徽章仍使用 20px 高度。`check:buttons` 检查表格内的规格误用，媒体缩略图继续使用已登记的媒体专用语义。

可点击媒体缩略图使用 `tf-button--content tf-button--media-tile`：方形比例、零内边距和裁切由公共按钮入口维护；页面只定义网格和图片内容。扫码器文字操作使用 `tf-button--scanner-control`，通过 `aria-pressed` 表达选中状态，手动输入附加 `tf-button--overlay-warning`；闪光灯开启时在遮罩工具语义上附加同一警示语义。选中、悬停与警示配色均由公共入口维护。

内容选项与顶层 TAB、数据表格使用各自的交互语义：顶层 TAB 选中读取 `_tabs.scss` 的主色实底；表格悬停、手机轻触和勾选读取 `admin-layout.css` 的行状态令牌；授权状态徽章继续使用成功、警示和中性色，不能把业务状态色当作当前导航选中色。

富文本工具栏、颜色色板、关闭图标、拖动手柄等专用工具控件需要不同规格时，也应先在公共入口维护明确的专用 class，再由页面引用；不能通过私有 class 覆盖 `.el-button`、`.btn` 或已有语义 class。

已登记的公共搜索、客户锁、分页、弹窗及导航控件按各自专项规范维护布局与交互，普通按钮外观仍复用本文入口。`standards-manifest.json` 的公共源码登记表示专项规范归属，不是业务页面私有外观的豁免。新增公共控件应先确认已有方案，不能为绕过审计登记重复实现。

## 唯一控制入口

| 文件 | 职责 |
|---|---|
| `frontend/src/styles/components/_buttons.scss` | **唯一按钮色值源**；定义普通、浅色、工具、遮罩按钮的语义颜色，以及普通按钮尺寸和状态 |
| `frontend/src/styles/components/_table.scss` | 表格、列表卡片、手机展开区的紧凑布局；颜色只能读取 `--tf-button-*` 或其兼容别名 |
| `frontend/src/styles/components/_dialog-actions.scss` | 模态框底部和 MessageBox 按钮布局；不得维护颜色 |
| `frontend/src/styles/admin-layout.css` | 表格操作尺寸及 `--admin-action-*` 兼容别名；别名必须指向 `--tf-button-*`，不得保存第二套色值 |

上述文件由全局入口加载。实际的 `#hex`、`rgb()`、`hsl()` 等按钮色值只能出现在 `_buttons.scss`。其他公共文件和业务组件都只能引用公共变量；不得再次 `@use` 一套按钮主题，也不得在 `<style scoped>` 中复制按钮样式。

## 普通命令按钮

PC 默认值：

- 高度 `36px`；
- 小按钮 `28px`，大按钮 `44px`；
- 字号 `14px`，小按钮 `13px`；
- 水平内边距 `16px`，圆角 `6px`；
- 宽度按文字内容自适应，不设置统一固定宽度。

纯图标圆形 `el-button` 使用同一组全局高度变量作为直径：默认 `36px`、小号 `28px`、大号 `44px`；手机端随对应高度变量一起自适应。公共规则统一保证等宽、等高、无额外内边距和 `50%` 圆角，业务页面不得再修正圆形按钮的宽高或背景形状。破坏性图标操作仍使用删除语义 class，并必须提供 `title`、tooltip 或 `aria-label`。

表格标题区的批量操作统一使用 `.batch-actions-buttons` 公共入口，自动读取公共表格操作的高度、内边距、字号、颜色和响应式令牌；页面只维护分组与换行布局。圆形按钮仍保持等宽等高。PC、手机的尺寸变更只修改公共按钮和表格入口，不允许页面覆盖。

手机端 `768px` 及以下（以下自适应值全部由 `_buttons.scss` 的 `767px` 断点内公共令牌切换，页面不得感知或复制具体像素值）：

- 普通按钮高度在 `34px` 至 `36px` 范围内随可用屏宽自适应（`--tf-button-height: clamp(34px, 9.6vw, 36px)`），水平内边距 `--tf-button-padding-x` 同步收缩，字号切换为移动端统一值 `--tf-type-scale-13`，避免窄屏按钮挤压、移位或溢出；
- 小按钮高度在 `30px` 至 `32px` 范围内自适应（`--tf-button-height-small: clamp(30px, 8.54vw, 32px)`），字号固定 `12px`，水平内边距 `clamp(6px, 2.14vw, 8px)`；
- 页头操作按钮使用 `--tf-toolbar-button-height`，在手机端 `28px` 至 `30px` 范围内自适应；检索区控件高度切换为 `--input-height-default`，与搜索框保持等高；
- 尺寸一致性验收必须标注视口档位：同一个 `size="small"` 或默认档按钮在 PC 与手机端渲染出不同像素高度（如 `28px` 对 `32px`）是公共令牌自适应的正常表现，不得据此判定页面违规，也不得把 PC 固定值搬进手机端；
- 普通页面按钮宽度按内容自适应，搜索区等公共容器可让输入区自动占用按钮之外的剩余空间；
- 模态框底部按钮保持一行；PC 端按文字内容自适应并靠右，手机端居中等分且受最大宽度约束，空间不足时允许等比例收缩，其触控高度由模态框公共规则单独保证；
- 页面不得另设按钮高度、字体或固定宽度。

顶部页头操作区和公共检索区使用独立规格：页头操作按钮继续按按钮规范维护；公共检索输入框、下拉框、日期框及搜索/重置按钮统一使用 `30px` 的 `--tf-search-control-height`，控件外层、wrapper 和 inner 必须同高，关键词输入区占用剩余宽度。手机页头恰好有四个操作时，按钮共同收缩并等分操作区，确保四个都完整可见；操作更多时以横向浏览作为兜底，溢出内容必须从左侧可见，不得用固定大按钮挤压或遮挡相邻内容。该规则由 `_buttons.scss`、`PageHeader.vue` 和 `UnifiedSearchPanel.vue` 公共组件共同实现，业务页面不得覆盖。

顶部登录信息卡使用 `--tf-topbar-user-info-max-width` 作为统一最大宽度（当前为视口宽度的 `46%`，上限 `360px`），宽度按头像、姓名和角色等实际内容自适应；不得使用 `flex: 1 1 auto` 或 `max-width: none` 把卡片拉伸到顶部剩余空间。窄屏下允许姓名省略，但登录信息卡、锁屏和退出按钮必须同时保持可见。

主应用最顶部栏使用 `.tf-button--topbar` 规格：PC 高度 `32px`、最小宽度 `64px`、左右内边距 `8px`、按钮间距 `4px`；手机端跟随普通按钮的 `34px` 至 `36px` 自适应高度，图标按钮按顶部可用空间保持稳定尺寸。顶部用户信息卡等相邻控件必须使用同一个 `--tf-topbar-control-height` 变量，确保与锁屏、退出登录等按钮等高。顶部按钮容器使用专用名称（当前为 `.topbar-buttons`），不得使用保留给表格操作区的 `.action-buttons`，否则会被全局表格规则压缩为紧凑按钮。

PC 顶部登录时间使用 `--tf-type-scale-13`（13px），保证时间信息清晰可读；平板和手机隐藏时间信息，为用户信息及操作按钮保留空间。

推荐 Element Plus，并使用语义类型或公共 class：

| 功能 | Element 类型/公共 class | 语义 |
|---|---|---|
| 新增、保存、确认、提交、搜索 | `type="primary"`、`tf-button--save` | 主操作蓝色 |
| 完成、启用、通过 | `type="success"`、`tf-button--complete` | 成功绿色 |
| 停用、拒绝、撤销 | `type="warning"`、`tf-button--warning` | 警示琥珀色 |
| 删除、移除、退出登录、取消打款、破坏性清空 | `type="danger"`、`tf-button--delete`、`tf-button--danger` | 危险红色 |
| 查看 | `type="info"`、`tf-button--view` | 信息青色 |
| 权限、配置、管理 | `tf-button--manage` | 管理靛蓝色 |
| 打款、付款、结算 | `tf-button--finance` | 财务青绿色 |
| 入库、出库、调货 | `tf-button--transfer` | 库存紫色 |
| 导出、下载、同步、刷新 | `tf-button--export`、`tf-button--download`、`tf-button--sync`、`tf-button--refresh` | 工具蓝色 |
| 取消编辑、关闭、返回、重置 | 默认按钮、`tf-button--neutral` | 中性白灰色 |

语义按操作后果判断，不按按钮文字机械匹配。“取消编辑”不改变已保存数据，属于中性；“取消打款”会撤销已存在的业务结果，属于危险；“停用”可恢复但会改变可用状态，属于警示；“删除”通常不可恢复，属于危险。顶部退出登录与支付页取消打款必须使用同一套危险色变量，页面不得各自定义红色。

主操作和表格操作使用同一语义、两种表面：页面工具栏及模态框主命令使用实心变量（如 `--tf-button-danger-bg`）；表格、卡片的紧凑操作使用浅色变量（如 `--tf-button-danger-soft-bg`）。浅色只改变视觉层级，不改变语义。`admin-layout.css` 中的 `--admin-action-*` 仅为旧表格兼容别名。

图片预览、视频控制、扫描器及覆盖层上的图标按钮使用 `--tf-button-tool-*` 和 `--tf-button-overlay-*`；即使控件视觉特殊，也不得在页面中直接写白色、黑色或透明色值。新增语义时必须先在 `_buttons.scss` 同时定义默认、悬停、文字、边框及需要的浅色状态，再开放给页面使用。

旧页面的 `.btn-primary`、`.btn-success`、`.btn-warning`、`.btn-danger`、`.btn-info`、`.btn-secondary` 及 outline 变体由全局兼容，但新增代码不得为这些 class 再写颜色。

## 表格和卡片操作

表格和列表卡片的操作容器统一使用 `.action-buttons`。该类名专用于紧凑数据操作，不得用于应用顶部栏、页面工具栏或普通表单。手机行展开可以使用 `.mobile-row-actions` 或 `.mobile-inline-actions`。按钮优先使用以下显式语义：

```vue
<div class="action-buttons">
  <el-button class="table-action table-action--view" @click.stop="view(row)">查看</el-button>
  <el-button class="table-action table-action--edit" @click.stop="edit(row)">编辑</el-button>
  <el-button class="table-action table-action--delete" @click.stop="remove(row)">删除</el-button>
</div>
```

表格操作按钮 PC 默认高度 `28px`，手机默认高度 `32px`。完整语义 class 包括 `view`、`edit`、`delete`、`pin`、`success`、`neutral`、`manage`、`finance`、`transfer`、`export`、`warning`。语义变量和列宽规则见《后台卡片与表格统一规范》。

卡片底部需要把多个操作始终放在同一行时，容器使用 `.card-actions.tf-actions--fit-row`。公共规则会根据实际按钮数量等分可用宽度、压缩水平内边距并禁止换行；业务页面不得再为按钮设置固定宽度或局部尺寸。

`.card-actions.tf-actions--fit-row` 是卡片操作的公共布局入口，由 `frontend/src/styles/components/_table.scss` 统一维护。规范与审计页面、模块管理卡片和其他业务卡片必须复用该入口；不得另建 `standard-card-actions`、`mobile-card-actions` 等同义布局，也不得在页面中重新定义按钮宽度、高度、间距或手机端排列。卡片按钮仍需按操作后果声明 `primary`、`info/view`、`success`、`danger` 或其他公共语义。

手机卡片头部需要让分类、状态和多个文字操作共处一行时，操作容器增加 `.tf-action-row--compact`。公共规则会使用工具栏紧凑尺寸，并在 `480px` 以下隐藏操作图标、保留完整文字；页面不得自行缩小按钮。

主列表操作必须显示中文文字；仅模态框紧凑工具列和公认图标工具允许只显示图标，且必须有 `title` 或 tooltip。

### 规范与审计标杆页

`/standards` 是按钮尺寸和卡片操作布局的可视验收页。按钮预览必须直接使用本文件定义的公共语义 class；普通按钮按文字内容自适应宽度，不能为了展示而设置固定 `width`、`min-width` 或页面私有高度。卡片底部的多个操作必须使用 `.card-actions.tf-actions--fit-row`，由公共样式按按钮数量等分可用空间；按钮文字过长时只能通过公共内边距和省略/换行策略处理，不能在页面中单独放大按钮。

标杆页每次新增按钮语义、调整按钮高度/宽度或修改手机端布局时，必须同时更新 `_buttons.scss`、本文、`check:buttons` 审计和 `/standards` 预览；审计通过前不得把页面视为规范接入完成。

## 模态框和确认框

Element Plus 模态框 footer 和详情正文末尾的业务操作区使用 `.tf-dialog-actions`：

```vue
<template #footer>
  <div class="tf-dialog-actions">
    <el-button @click="visible = false">取消</el-button>
    <el-button type="primary" @click="save">保存</el-button>
  </div>
</template>
```

PC 端模态框 footer 按钮按内容自适应并靠右，单个按钮最小宽度 `64px`、高度 `32px`、左右内边距 `8px`、间距 `4px`；平板（`768–1024px`）保持 `40px` 高、左右内边距 `10px`、间距 `8px`。手机（`<=767px`）以综合查询设备销售信息的紧凑按钮为标准：高度 `clamp(30px, 8.54vw, 32px)`（375px 及以上为 32px）、字号 `12px`、圆角复用公共控件令牌（`6px`）、左右内边距 `clamp(6px, 2.14vw, 8px)`、间距统一 `6px`。手机和平板操作区占满可用宽度，按钮按实际可见数量等分，每个最大 `150px`；空间不足时等分收缩，空间充足时每个按钮为 `150px`，整组居中。例如手机两个按钮连同 6px 间距最多占 `306px`，三个最多占 `462px`。不得改成上下排列或产生单侧大留白。

公共 footer、MessageBox 操作区和正文 `.tf-dialog-toolbar` 将 `small/default/large` 高度别名统一到弹窗高度令牌，避免遗留的 `size` 属性改变尺寸。正文上传/批量下载等命令按钮复用 `.tf-dialog-toolbar`，按内容宽度排列，空间不足时可换行；不允许页面重新维护按钮高度、内边距或字号。

手机端公共操作尺寸引用 `_buttons.scss` 中独立的 `--tf-button-small-base-*` 基础令牌，再由 `_dialog-actions.scss` 统一映射尺寸别名，避免循环引用或页面重复定义。浏览器回归执行 `npm --prefix frontend run test:dialog-widths`，包含真实综合查询组件、默认/自定义/原生 footer、正文工具栏、1～4 个按钮和明暗主题。

照片缩略图的查看/删除使用 `el-button` 的 `primary/danger` 语义、小号 `circle` 规格，并提供 `title` 和 `aria-label`。全屏图片预览统一接入 `MediaPreviewViewer`，其工具按钮由 `tf-button--overlay-tool` 维护，删除附加 `tf-button--overlay-danger`；这些图标工具遵循公共媒体工具规格，不与 footer 普通文字按钮混用。国补申请、国补照片管理均遵守此规则。

所有模态框（包括销售出库、批量销售、入库、划拨、批发、综合查询、权限和 H5 管理弹窗）都必须遵守同一条规则：
PC 端按钮按内容自适应并靠右，手机端按钮居中等分、保持同一行，按钮高度、最小宽度、最大宽度（手机/平板 `--tf-dialog-action-max-width`）和间距只能由
`_dialog-actions.scss` 控制。业务页面不得用 `grid-template-columns`、`flex-direction: column` 或按钮固定宽度覆盖这套规则。

删除、停用、完成等 MessageBox 必须通过 `frontend/src/utils/message-box.ts` 的统一增强调用，语义 class 为 `message-box-danger`、`message-box-warning`、`message-box-success` 或 `message-box-primary`。禁止页面传入颜色 class。

## 禁止项

业务页面和业务组件禁止：

- 重写 `.el-button--primary/success/warning/danger/info` 的背景、边框或文字色；
- 重写 `.btn-primary/.btn-delete/.btn-edit/.btn-view` 等语义颜色；
- 在任何业务文件、`_table.scss`、`_dialog-actions.scss`、`_tabs.scss` 或 `admin-layout.css` 的按钮选择器中写 `#hex`、`rgb()`、`hsl()`、`white`、`black` 等直接色值；
- 通过 `style="color: ..."`、`:style` 或新增页面变量绕开公共颜色分类；
- 在公共操作区内设置按钮 `height`、`width`、`min-width`、`padding`、`font-size`、`border-radius`、背景或阴影；
- 在模态框 footer 中将按钮改为 `flex-direction: column` 或手机端上下排列；
- 用超长固定宽度替代内容自适应；
- 复制旧页面按钮 CSS 到新页面。

业务页面允许控制按钮容器的位置、业务所需的换行策略和权限显隐。若确需新增整站语义，先在全局变量和全局样式中增加，再供所有页面使用。

## 自动审计

提交或打包前执行：

```bash
cd frontend
npm run check:buttons
npm run build
```

`check:buttons` 先执行审计器回归测试，再扫描所有 Vue、SCSS 和 CSS。它根据实际 `el-button` 的静态及动态 class 识别按钮，检查页面和业务组件的嵌套规则、PC / 手机断点、状态与 `:deep()` 覆盖，并检查行内静态声明及动态对象；按钮外壳受约束，内部图标与容器布局不作为按钮外观误报。同时保留语义颜色、直接色值、旧版普通按钮、公共操作区和 `admin-layout.css` 兼容变量检查。该审计已接入 `check:standards`，不通过时不能正常启动或构建。确属专用工具控件时先定义公共规格，而不是绕过或删除检查。

模态框 footer 的专用审计为 `npm run check:dialog-actions`，用于阻止页面级 footer grid、手机端纵向排列和固定按钮区域尺寸。
