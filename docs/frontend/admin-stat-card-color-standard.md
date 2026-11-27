# 管理后台统计卡片规范

统计卡片的公共样式入口是 `frontend/src/styles/admin-layout.css`。页面不应直接写十六进制颜色或渐变，只保留业务语义类，或在卡片上声明 `--card-accent`。

## 语义色

| 语义 | 变量 | 使用场景 |
| --- | --- | --- |
| 主色 | `--admin-stat-color-primary` | 总数、库存、普通金额、默认统计 |
| 成功 | `--admin-stat-color-success` | 已完成、已支付、有效、收入/利润 |
| 信息 | `--admin-stat-color-info` | 已匹配、处理中、已发货、关联数据 |
| 待处理 | `--admin-stat-color-warning` | 待支付、待审核、待维修、提醒 |
| 异常 | `--admin-stat-color-danger` | 失败、取消、禁用、亏损 |
| 强调 | `--admin-stat-color-accent` | 管理类、权限类、需要重点关注的数据 |
| 中性 | `--admin-stat-color-neutral` | 非业务状态或辅助统计 |
| 全新设备 | `--admin-stat-color-new` | 全新机数量、全新设备统计 |
| 二手设备 | `--admin-stat-color-used` | 二手机数量、二手设备统计 |

金额语义使用以下变量：

- `--admin-stat-color-money`：普通金额、库存总值。
- `--admin-stat-color-income`：销售额、收入、利润。
- `--admin-stat-color-expense`：成本、支出、扣款。
- `--admin-stat-color-pending`：待收款、待付款、待结算金额。
- `--admin-stat-color-new-money`：全新设备相关金额，与全新设备使用同一颜色。
- `--admin-stat-color-used-money`：二手设备相关金额，与二手设备使用同一颜色。

## 新页面写法

```html
<div class="stat-card stat-card--income">
  <div class="stat-icon">
    <i class="fas fa-yen-sign" />
  </div>
  <div class="stat-value stat-value--income">¥0.00</div>
</div>
```

全新和二手必须使用稳定的成色语义类，不能在不同页面改用 `success`、`info` 或 `warning` 表示同一含义：

```html
<div class="stat-card stat-card--new">全新设备数量</div>
<div class="stat-card stat-card--used">二手设备数量</div>
<div class="stat-card stat-card--new-money">全新设备金额</div>
<div class="stat-card stat-card--used-money">二手设备金额</div>
```

也可以根据页面业务动态声明：

```css
.stat-card {
  --card-accent: var(--admin-stat-color-info);
}
```

卡片图标背景、顶部强调线和金额文字由公共样式自动使用 `--card-accent` 及对应金额变量。不要在页面中重新定义 `.stat-icon` 的 `background`，也不要使用 `nth-child` 按位置配色。

有主值和附属读数的卡片可以在 `.stat-content` 后使用 `dl.stat-card__details`，每组用 `dt` 和 `dd` 排列。空间有限时，`.stat-card--with-details` 使用较小的公共图标尺寸，带金额明细的卡片通过 `.stat-card--with-amount-details` 使用紧凑的主数值字号。货款类卡片使用公共 `.stat-main-line` 排列标签和主值，空间不足时自然换行。

全局顶部统计卡片统一采用「标题在上、主值在下」的阅读顺序。公共 `.stats-cards` 会对直属卡片的标题和主值设置统一视觉顺序，页面模板不得依赖数值先写或标题先写来改变显示结果。`.stat-main-line` 同样使用标题在上、主值在下的纵向结构。附属统计可继续按公共布局排列。有附加统计时，主标题和合计数保留在左侧，附加项目排列在卡片右侧，并通过公共 `.stat-card--summary-layout` 与 `.stat-card__details` 呈现；手机、平板和桌面均保持右侧分项，不将明细移到卡片下方。主值和分项数值使用相同计量单位，主值表达合计，分项不得替代合计。页面专用的主值计算继续由业务数据提供，排版尺寸、边界和明暗主题沿用公共令牌。

## 响应式布局与尺寸

后台顶部统计区使用公共 `.stats-cards`，卡片作为容器直属子项并使用 `.stat-card`。权限和设备条件在渲染前决定卡片是否存在，剩余卡片按实际列数等宽铺满容器。滚动区域提供 `role="region"`、无障碍名称和 `tabindex="0"`。空组自动隐藏。

| 视口 | 排列 |
| --- | --- |
| 手机 `≤767px` | 每行最多 2 张，最多 2 行承载 4 张；超过 4 张时在卡片区左右滑动 |
| 平板 `768–1024px` | 4 张时单行展示；5–6 张按 3 列 2 行，7–8 张按 4 列 2 行；超过 8 张时在卡片区左右滑动 |
| PC `≥1025px` | 单行最多 6 张，1 至 6 张按实际数量等分可用宽度；超过 6 张时左右滑动 |

卡片共用 `--admin-stat-card-min-height`，平板和 PC 为 `88px`，手机为 `70px`。同组卡片按行等高，权限隐藏后按剩余卡片重新计算列数和行数。超出当前设备容量的卡片保留横向滚动，使用 `_scrollbars.scss` 的公共规则隐藏滚动条及箭头。页面刷新期间统计字段使用稳定的零值初始化，不能因接口尚未返回而先少渲染卡片，再追加卡片。接口成功后零值表示真实统计结果，接口失败必须显示明确的失败状态，不能用零值或“暂无数据”代替。

手机端带附属读数的紧凑卡片由公共 `.stat-card--summary-layout` 保持主信息与右侧明细同排。主信息内标题在上、主值在下，右侧每项的标签和值同行，例如主标题「调货划拨」、合计「49台」，右侧「调货 42台」「划拨 7台」。右侧可用宽度不足时允许单项内部按公共布局换行，不能把整组明细移到主值下方。平板和 PC 保持相同的信息顺序及左右分区。

手机端两组明细含有重复词时，可以用简短符号表达重复含义，并给明细组提供完整的无障碍名称。仪表盘的客户新增明细使用「本月 +39人」「上月 +58人」，平板和 PC 显示「本月新增」「上月新增」。

有五至六项紧凑读数的卡片可使用 `.stat-card--with-detail-columns`。平板和 PC 的明细按源顺序从上到下填满每列，排成三列两行，列间使用卡片边框色的虚线。空间不足时明细整体换到主数据下方。手机应用原有明细布局和页面显示条件。

并列展示数量和金额的明细可通过 `.stat-card--with-amount-details` 使用共用列宽，成色与数值之间使用虚线，数量和金额分别右对齐。需要在 PC 将标签和时长作为一组时，明细使用 `.stat-card__details--amount-divider`，虚线位于金额列左侧。同组的字段标签和时长分别共用左侧起点，金额标签左对齐、金额数值右对齐，各行使用相同的列宽。适用页面可在手机端通过 `.hidden-mobile` 隐藏数量。 需要在手机和平板保留件数与金额分隔线时，可在同一明细容器声明 `data-amount-divider="always"`。

紧凑排行使用 `.stat-card__details--ranked`。商品名称靠左，件数靠右，列间使用虚线，窄屏长名称以省略号显示并保留完整文本。

盈利业务统计使用公共 `.stat-card--filled`、`.stat-card__badge-icon` 和 `.stat-card__tile`。填充背景由卡片的语义色生成，全新、二手和调货-划拨分别使用全新色、二手色和主色。平板和桌面的明细在卡片内分两列，手机的明细逐项排列，标签和值有足够空间时同行。销量占比使用全新、二手和调货数量合计，划拨数量单独展示，销量总量与全新、二手统计均可见时展示占比。

48 组统计已接入该布局，范围见[前端页面与功能单元台账](page-audit-inventory.md)。数据分析依次展示分析标签页、当前标签页概览、公共检索和分析明细。六个标签页通过 [AnalyticsStatCard](../../frontend/src/views/analytics/page/AnalyticsStatCard.vue) 共用概览卡片的图标、标题、主值和紧凑明细，子页负责指标、字段权限以及库存预警详情入口。国补进度、分析明细和徽标、预警选中状态由业务组件维护，统计组外层尺寸、间距、等高和横滑由公共样式管理。

## 审计边界

- 后台统计卡片必须使用 `stats-cards` 容器和 `stat-card--*` 语义类；权限隐藏卡片或调整顺序不能改变颜色含义。
- 页面样式中不得出现 `.stat-card:nth-child(...)`、`.stat-icon.<业务状态> { background: ... }` 或统计卡片专用渐变。
- `.stat-icon` 的尺寸、间距和颜色由公共入口维护。页面只保留确实属于业务交互的布局规则，例如可点击卡片的 `cursor`。
- 客户详情账户统计和供应商详情商品统计等业务组件可保留详情布局，图标和状态颜色使用 `stat-icon--*` 或 `--card-accent` 语义入口。
- `check:ui` 检查统计组的无障碍属性、直属卡片和条件渲染。列表记录卡片、详情、分析图表和表格使用各自的公共规范。
