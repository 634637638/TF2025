# 样式债务清理进度

更新时间：2026-08-27

## 统计口径

`npm --prefix frontend run check:style-debt` 扫描 `frontend/src` 下实际运行的 Vue、SCSS 和 CSS，名称明确为 `copy/bak/backup` 的非运行备份不计入生产基线。Vue 文件只扫描 `<style>` 块；CSS 自定义属性声明视为主题令牌定义，不计入“使用点”。

## 当前状态

| 项目 | 当前数量 | 状态 |
| --- | ---: | --- |
| `!important` 总数 | 2134 | 已治理；较初始基线减少 242 处 |
| 已登记强制覆盖 | 2134 | 每个文件均有精确上限和用途说明 |
| 未批准 `!important` | 0 | 已完成；构建禁止新增 |
| 主题令牌中的颜色字面量 | 672 | 合规；集中保留在令牌声明中 |
| 非令牌颜色使用点 | 0 | 已完成；构建禁止新增 |

旧报告中的“约 1790 个 `!important`、约 6173 个颜色值”使用了不同的文件范围和统计方式。本文件的命令是后续统一基线。

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
- 清理普通页面布局中的 242 个强制声明；保留的 Element Plus、Teleport、打印、表格状态、无障碍和移动安全区覆盖全部登记在 `scripts/style-important-allowlist.json`，包含文件上限与具体原因。
- 将 1932 个非令牌颜色使用点全部迁移到共享语义色板；高频状态色统一复用，19 个需要保持视觉身份的品牌色和图表色使用明确业务令牌。
- 将样式债务门禁收紧到：`!important <= 2134`、未批准 `!important = 0`、非令牌颜色使用点 `= 0`。任何新增存量都会让审计失败。

## 清理规则

1. 主题令牌定义集中在 `styles/_variables.scss`、`styles.scss` 和共享组件变量文件中；业务页面使用 `var(--...)`。
2. 状态色、图表色和品牌色必须先建立语义令牌，再替换使用点，不能把不同语义颜色强行合并。
3. `!important` 仅允许用于 Element Plus 浮层/表格等第三方结构覆盖、移动端安全区域和明确的层叠边界；普通页面布局和颜色规则必须移除。
4. 每批清理后运行 `check:style-debt`、`type-check`、`check:fields` 和生产构建。

## 后续守护

- 新增颜色必须先选择已有语义令牌；确需新增品牌色或图表色时，在共享色板中按用途命名。
- 新增 `!important` 默认禁止；只有第三方组件内部结构、Teleport 浮层、打印、无障碍或移动安全区等无法用正常级联解决的情况，才允许同步登记理由和精确上限。
- 审计要求白名单文件的实际数量必须等于登记上限；删除强制声明后必须同步下调文件上限和全局基线，不能把释放的额度留给后续新增代码。

## 本轮验证

- `npm --prefix frontend run check:style-debt`：通过，当前为 2134 个已登记 `!important`、0 个未批准 `!important`、0 个非令牌颜色使用点。
- `npm --prefix frontend run type-check`：通过。
- `npm exec vite build`：通过；Vite 完成 3071 个模块构建。
- `npm run lint:strict`：通过，0 error、0 warning。
- `git diff --check`：通过。
