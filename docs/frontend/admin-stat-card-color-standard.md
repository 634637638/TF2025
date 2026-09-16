# 管理后台统计卡片颜色规范

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

## 审计边界

- 后台统计卡片必须使用 `stats-cards` 容器和 `stat-card--*` 语义类；权限隐藏卡片或调整顺序不能改变颜色含义。
- 页面样式中不得出现 `.stat-card:nth-child(...)`、`.stat-icon.<业务状态> { background: ... }` 或统计卡片专用渐变。
- `.stat-icon` 的尺寸、间距和颜色由公共入口维护。页面只保留确实属于业务交互的布局规则，例如可点击卡片的 `cursor`。
- 错误监控、客户详情账户统计、供应商详情商品统计等非 `stats-cards` 业务组件可以保留自己的内容布局，但图标和状态颜色必须使用 `stat-icon--*` 或 `--card-accent` 语义入口；新增后台统计卡片时优先迁移到本规范。
- `Analytics` 等独立视觉体系可以保留自己的布局，但不应复制后台统计卡片的颜色令牌。
