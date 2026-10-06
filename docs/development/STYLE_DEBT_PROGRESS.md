# 样式债务清理进度

历史治理记录始于 2026-08-27；当前审计结果于 2026-10-01 复核。

## 2026-10-01 令牌和断点治理

- 新增 `responsive-breakpoint-standard.md`，统一 `375/479/767/768/1024/1025/1200/1440px` 断点，并由 `check:responsive` 防止历史局部断点继续增加。
- 新增 `design-token-standard.md`，在 `_variables.scss` 集中定义间距、圆角、阴影、字号和层级令牌。
- 按钮、弹窗、标签页、分页、全局圆角/阴影工具类、消息、确认框和权限提示已接入公共令牌；`check:design-tokens` 已加入 `check:standards`。
- 全局样式和公共组件中的旧响应式边界曾从 238 处降至 111 处；2026-10-01 当前审计实测为 79 处，业务页面的特殊断点仍由专项基线管理，后续按页面批次减少。
- 本轮继续收敛根级 `styles.scss` 和 `assets/css` 的历史边界；剩余业务页面的特殊断点由专项基线管理，不能在没有内容尺寸依据时机械合并。

## 统计口径

`npm --prefix frontend run check:style-debt` 扫描 `frontend/src` 下实际运行的 Vue、SCSS 和 CSS，名称明确为 `copy/bak/backup` 的非运行备份不计入生产基线。Vue 文件只扫描 `<style>` 块；CSS 自定义属性声明视为主题令牌定义，不计入“使用点”。

## 当前状态

| 项目 | 当前数量 | 状态 |
| --- | ---: | --- |
| `!important` 总数 | 1933 | 仍有存量，不代表已经消除 |
| 已登记强制覆盖 | 1933 | 逐文件登记；总量门槛已收紧到当前值 |
| 未批准 `!important` | 0 | 已完成；构建禁止新增 |
| 颜色字面量 | 641 | 集中保留在 CSS 令牌定义中 |
| 非令牌颜色使用点 | 0 | 已完成；构建禁止新增 |

历史数字使用过不同扫描范围，不应与当前结果直接比较。当前结果以本文件记录的审计命令及最近核验日期为准；门禁上限见 `frontend/scripts/style-debt-baseline.json`。

## 2026-10-01 全局采用率门禁

- 当前复核为 1933 处 `!important`、60 个超过 300 行的 Vue 样式块、79 处历史响应式断点；`!important` 全部登记不代表已删除，样式块和断点也仍是待逐页治理的存量。
- `check:style-debt` 除全局数量外，现逐文件记录超长样式块行数；任何文件继续增长或新增超长块都会失败。拆分或删除后应下调对应上限，不能重建为更高值。
- `check:design-tokens` 现扫描所有 Vue 样式块、内联 style、CSS/SCSS 的圆角、阴影、字号、间距和层级。现存字面量登记于 `frontend/scripts/design-token-adoption-baseline.json`；新增字面量和单文件数量扩张会失败，后续页面迁移只能降低基线。
- 早期登记的设计字面量为：圆角 1336、阴影 426、字号 2840、间距 5702、层级 141。首次复核值为圆角 1335、阴影 426、字号 2839、间距 5697、层级 132；本次继续迁移后，以“2026-10-01 本次复核”章节中的实测值为准。后续改造应继续替换为 CSS 令牌并降低存量上限。
- Dashboard 和 18 个业务页的标准刷新按钮，以及销售弹窗中的两个提交按钮，已从 `InlineLoading` 嵌套改为 Element Plus `:loading`；按钮 spinner 例外从 47 降为 26（减少 21），并删除迁移完成页面的过期例外登记。
- `npm run check:design-tokens`、`npm run check:style-debt` 均作为 `check:standards` 的强制门禁。仅在存量减少并经过 UI 回归后允许收紧基线，不得用重建基线通过审计。

## 2026-10-01 本次复核

- 实测视觉字面量为 radius=1318、shadow=423、typography=2799、spacing=5636、layering=132；相比登记快照分别减少 26、8、47、146、11 处。`ComprehensiveWarnings.vue`、`WholesalePhoneSummarySection.vue` 本轮将等值圆角、字号和间距替换为公共令牌；审计按逐文件快照阻止回涨。
- `!important` 实测从 1934 降至 1933：`TableLoadingRow` 通过提高单元格选择器优先级去掉一处强制声明，并移除了对应白名单；样式总量上限同步从 1934 收紧到 1933。
- 已新增[响应式与主题视觉回归清单](../frontend/visual-regression-checklist.md)，覆盖 375/430/768/1024/1440 CSS 视口、关键业务弹窗、表格、明暗主题和日期回归。该清单是人工浏览器验收项，不伪装成自动截图测试。
- 工作区新增的 `PublicSearchBox.vue` 已接入圆角、字号、间距令牌，并将 390px 微调收敛到 375px；保留的专用阴影和 18/13px 字号、4px 按钮圆角按当前实测数登记，后续有视觉依据再收敛。

## 2026-10-01 债务下降报告

- 样式审计总量上限从 1939 收紧至 1934，再因 `TableLoadingRow` 移除一处冗余声明收紧至 1933；任何新增 `!important` 都仍受逐文件白名单约束，删除后必须同步下调对应白名单。
- 视觉令牌审计现在按类别报告相对登记快照的减少/增加数量；动效审计也报告相对快照变化。减少必须来自真实代码迁移，不能通过重建快照伪造进度。
- 当前锁定的令牌、断点和动效基线仍代表历史债务上限。每轮治理应挑选实际页面或公共样式减少存量，再同步下调对应基线并执行视觉回归。

## 2026-08-27 已完成

- 全局入口加载 `styles/_variables.scss`，确保颜色令牌在所有页面可用。
- 在 `styles.scss` 增加共享语义令牌：文本、边框、页面背景和灰阶颜色。
- 将 9 个共享样式文件中的 105 个重复颜色使用点改为 CSS 变量，保持原有视觉值和主题覆盖关系。
- 将页面中 526 个重复的 slate/blue/green/amber/red 颜色使用点改为共享调色板变量，保持原有色值。
- 将页面中 890 个高频中性色、提示色和状态色使用点改为共享调色板变量，保持原有色值。
- 增加 `check:style-debt` 审计命令，并接入 `check:standards`，后续新增硬编码颜色可以在构建前发现。
- 颜色替换工具 `scripts/normalize-style-colors.mjs` 默认只报告，使用 `--write` 才会修改共享样式；短色值匹配带边界保护。
- 分析页面共享卡片样式使用 `#app .analytics-view` 作为明确级联边界，移除该文件全部 183 个 `!important`；桌面和手机端属性值保持不变，避免继续依靠逐属性强制覆盖。
- 样式审计会先移除 CSS/SCSS 注释再统计，避免把注释中的示例误算为债务；`style-debt-baseline.json` 已接入检查，新增强制声明或非令牌颜色会直接让 `check:standards` 失败。
- 清理普通页面布局中的 242 个强制声明；保留的 Element Plus、Teleport、打印、表格状态、无障碍和移动安全区覆盖全部登记在 `scripts/style-important-allowlist.json`，包含文件上限与具体原因。2026-10-06 全局按钮迁移新增的移动端语义按钮覆盖已登记在 `_buttons.scss`，当前公共按钮入口为 264 处，不得将该登记扩展到业务页面。
- 将 1932 个非令牌颜色使用点全部迁移到共享语义色板；高频状态色统一复用，19 个需要保持视觉身份的品牌色和图表色使用明确业务令牌。
- 样式债务门禁基线当前为：`!important <= 1933`、未批准 `!important <= 0`、非令牌颜色使用点 `<= 0`。任何新增未登记存量都会让审计失败。

## 清理规则

1. 主题令牌定义集中在 `styles/_variables.scss`、`styles.scss` 和共享组件变量文件中；业务页面使用 `var(--...)`。
2. 状态色、图表色和品牌色必须先建立语义令牌，再替换使用点，不能把不同语义颜色强行合并。
3. `!important` 仅允许用于 Element Plus 浮层/表格等第三方结构覆盖、移动端安全区域和明确的层叠边界；普通页面布局和颜色规则必须移除。
4. 每批清理后运行 `check:style-debt`、`type-check`、`check:fields` 和生产构建。

## 后续守护

- 新增颜色必须先选择已有语义令牌；确需新增品牌色或图表色时，在共享色板中按用途命名。
- 新增 `!important` 默认禁止；只有第三方组件内部结构、Teleport 浮层、打印、无障碍或移动安全区等无法用正常级联解决的情况，才允许同步登记理由和精确上限。
- 审计要求白名单文件的实际数量必须等于登记上限；删除强制声明后必须同步下调文件上限和全局基线，不能把释放的额度留给后续新增代码。

## 2026-10-01 断点复核

- `npm run check:responsive`：最近复核通过；当前历史断点 79 处，旧登记上限 111 处仅作防回涨保护。
- 断点基线已同步到 `frontend/scripts/responsive-breakpoint-baseline.json`，最大历史断点数由 113 下调为 111。
- `380/390/400/420px` 等剩余值主要服务于内容密度或设备安全区适配，继续减少前必须逐页验证布局，不作为通用桌面/移动边界使用。

## 2026-10-01 早期样式债务基线复核记录

- `MenuManagementView.vue` 清理后 `!important` 从白名单登记的 26 处降至实际 6 处，已同步下调该文件上限。
- 早期复核曾发现全站实际值为 2002 处，权限页白名单由过期的 19 下调至实际 12，零增长基线从 2009 收紧到 2002；该数字已被后续治理继续下调，不代表当前状态。
- `npm run check:style-debt`：通过，逐文件登记上限与源码数量一致。

## 本轮验证

- `npm run check:style-debt`（在 `frontend/`）：早期复核通过，2002 个已登记 `!important`、0 个未批准 `!important`、641 个令牌定义颜色字面量、0 个非令牌颜色使用点；当前结果以“2026-10-01 本次复核”章节和 `style-debt-baseline.json` 为准。
- `npm --prefix frontend run type-check`：通过。
- 类型检查、构建、Lint 与工作区差异检查需按当前代码重新执行；本页 2026-08-27 的相关结果仅为历史记录。

## 大型样式块评估（2026-10-01）

通过 `@vue/compiler-sfc` 按实际 `<style>` 块统计：

| 页面 | 最大样式块 | `!important` | 评估 |
| --- | ---: | ---: | --- |
| `SubsidyView.vue` + `styles/subsidy/` | 原 2874 行 scoped SCSS，已按仪表板、申请表单、详情/编辑、移动布局、展示辅助、照片、照片响应式拆为 7 个 partial | 64 | scoped 边界和顺序保持不变；除移除一条无法作用于子组件内部的冗余 `.text-muted` 覆盖外，Sass 输出结构与拆分前一致。强制声明为内嵌 29 个、partial 35 个（9/0/3/1/0/16/6） |
| `SupplierPhonePaymentsView.vue` + `styles/supplier-phone-payments/` | 原 1463 行 scoped SCSS，已按列表、批次详情、编辑弹窗、控件、表格、移动布局拆为 6 个 partial | 44 | Vue scoped 边界和 partial 顺序保持不变；Sass 输出 39619 字节及 SHA-256 均与拆分前一致。强制声明分布在控件/移动布局 partial（35/9），总量未减少 |
| `PublicPriceQuery.vue` + scoped/global SCSS entries | 原 1219 行 scoped 拆为 4 个 partial；416 行全局 SCSS 拆为 4 个 partial | 113 | 原 scoped/global partial 顺序保持不变；Teleport 通知弹窗规则移入非 scoped global partial。该页有 113 个强制声明：8 个仍内嵌、105 个全局覆盖（图片/iOS 弹窗/通知弹窗/Safari 为 77/12/1/15）；通知弹窗宽度规则匹配 `MobileDialog` 的 `.notice-dialog.el-dialog` 根节点并覆盖其行内宽度 |

`PublicPriceQuery.vue` 的 1219 行 scoped 样式已按页面/页头、结果区、反馈与通知内容、结果列表拆为 4 个 partial；全局/Teleport 样式按图片生成、iOS 保存弹窗、通知弹窗、Safari 视口拆为 4 个 partial。`SupplierPhonePaymentsView.vue` 的 scoped 块按列表、详情、弹窗、控件、表格和移动端拆为 6 个 partial；`SubsidyView.vue` 的 2874 行 scoped 块按仪表板、表单、详情、移动布局、辅助样式和照片拆为 7 个 partial。拆分均保持原作用域与顺序；删除 Subsidy 父页一条对子组件内部无效的冗余覆盖后，早期阶段的 `!important` 总量曾从 2002 降到 2001，后续治理又继续下调至当前 1933。PublicPriceQuery 当前有 113 个 `!important`，其中通知弹窗规则位于非 scoped 样式，匹配 Teleport 后的 `.notice-dialog.el-dialog` 根节点，以覆盖移动端行内宽度。每次变更需比较构建前后的选择器作用域，并对对应桌面、窄屏和 Teleport 弹窗做视觉回归。当前不把“样式债务审计通过”解释为已完成存量清理。

### 2026-10-01 冗余强制覆盖清理

- 删除 `SubsidyView` scoped 样式中的 `.text-muted` 强制声明：该规则无法匹配 `SubsidyListSection` 子组件内部元素；颜色由子组件自己的 scoped 样式提供。
- 早期阶段全局 `!important` 白名单与零增长基线曾从 2002 下调至 2001；后续仍按页面验证，不批量去除第三方组件或 Teleport 覆盖。

## 2026-10-01 本轮组件采用率复核

- `PublicSearchBox.vue` 的搜索和清除命令已统一使用 Element Plus 按钮；清除按钮保留 `native-type="button"`，移除无效的重复 `type` 属性。
- `npm run check:component-adoption` 通过：31 个文件、65 个原生 `button` 均在专用交互例外登记内，当前没有待迁移的通用按钮。
- `npm run check:design-tokens`、`check:motion`、`check:responsive`、`check:style-debt` 均通过；当前存量以本页顶部当前状态和各专项基线文件为准。
