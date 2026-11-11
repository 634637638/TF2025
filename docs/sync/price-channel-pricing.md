# 三渠道价格规则

## 规则边界

站内价格分为三个互不覆盖的展示渠道：

| 渠道 | 页面 | 计算基准 | 使用规则 |
| --- | --- | --- | --- |
| 销售报价 | `/sales-price-display` | 最新采集批发价 | 全局销售加价规则 |
| 批发报价 | `/price-query` | 最新采集批发价 | 规格独立规则优先；否则采集源／全局批发规则 |
| H5 商城 | `/m` | 最新采集批发价 | 颜色模板加价规则 |

`price_list.wholesale_price` 是采集基准价。规则修改后，展示价格在读取时重新计算，不要求重新采集。

## 三条链路的实际入口

- `/sales-price-display` 只读取公开销售报价接口的 `display_retail_price`，由全局销售规则计算。
- `/price-query` 只读取公开批发报价接口的 `display_wholesale_price`，由统一价格服务按下述优先级计算。
- `/m` 的全新机只读取商城模板对应规格的 `price_list.wholesale_price`，再由 `price_markup`、`price_markup_type` 计算；购物车、下单、聚合库存和详情也复用同一商城计算服务。二手机仍使用自己的 `H5_product.sale_price`。

因此，`price_list.retail_price` 只是历史/旧接口兼容字段，不再作为商城全新机的价格来源。修改销售规则不会修改商城价格，修改商城模板加价也不会修改销售报价和批发报价。

## 覆盖关系

- H5 模板规则不会影响销售报价。
- H5 模板规则不会影响批发报价。
- 全局销售规则不会覆盖 H5 模板规则。
- 全局批发规则不会覆盖销售报价或商城价格。
- 下单时写入订单明细成交价，后续规则修改不会改变历史订单。
- 同一商城商品在列表、详情、购物车、下单和库存分布中必须使用相同的模板价格计算结果，禁止在这些链路重新读取销售报价字段。

## 兼容说明

`price_list.retail_price` 仍保留用于旧接口和历史数据兼容，但新展示接口使用独立计算结果：

- `sales_display_price`
- `display_wholesale_price`
- H5 返回的 `sale_price`

新增或修改价格规则时，应通过后端价格服务计算，不在 Vue 页面中复制计算逻辑。

## 批发规格规则与批量设置

报价管理可先筛选品牌、型号、颜色、内存，再勾选具体规格进入“批量设置”。勾选一条也可单独设置。批量修改不等于修改整个型号，未选中的规格不变。

勾选状态以价目表 ID 为唯一依据，翻页、切换每页条数、筛选及重置筛选时保留。表头全选／取消全选仅影响当前页允许选择的记录；半选状态按当前页 ID 判断。“已选择”统计所有页，批量操作提交全部已选 ID，单次仍限制为 500 条。“清空选择”、批量保存成功或编辑／查看权限撤销时清空全部选择；保存失败、取消弹窗和列表加载失败时保留选择。站内单条删除成功时仅移除该记录的已选 ID；其他页面删除导致所选记录失效时，批量接口会整批拒绝，需刷新并调整选择。

列表刷新复用 `useLatestRequest` 取消过期请求并校验响应代次；旧响应不得覆盖当前页、提前关闭 Loading 或在查看权限撤销后回填。更换每页条数回到第一页，明确要求实时读取的列表请求关闭 GET 缓存。

采集基准价始终保留在 `price_list.wholesale_price`。全局批发规则启用时，指定采集源的金额优先于全局金额；`source_config_id = NULL` 按当前默认采集源匹配。关闭全局批发规则时，普通规则价等于采集原价。

| 规格规则 | 计算方式 | 采集价 5000、A 源＋50 | 采集价 5000、B 源－50 |
| --- | --- | --- | --- |
| 跟随规则 `inherit` | 采集价＋来源金额（无来源金额时用全局金额） | 5050 | 4950 |
| 不加价 `original` | 采集原价 | 5000 | 5000 |
| 单独加减 `adjustment`，设＋30 | 采集价＋独立金额，替代来源和全局规则 | 5030 | 5030 |
| 额外加减 `extra`，设＋20 | 普通规则价＋独立金额 | 5070 | 4970 |
| 额外加减 `extra`，设－20 | 普通规则价－20 | 5030 | 4930 |

金额支持正负及两位小数，范围为 −999999 至 999999 元。最终报价最低为 0；没有有效采集原价时不生成报价。独立规则不受全局批发开关限制；关闭时“额外加减”以采集原价为基准。重复保存替换旧金额，不在旧金额上累计。恢复“跟随规则”会清除独立金额。

规则通过 `price_list.wholesale_rule_mode` 和 `wholesale_rule_adjustment` 保存，与具体型号、颜色、内存记录绑定；重新采集、导入和更换采集源均不会清除规则。“额外加减”在更换来源后按新来源规则计算；“不加价”“单独加减”仍以该规格最新采集原价计算。销售报价、二手机和 H5 模板价格不使用这些字段。

`PUT /api/price-list/batch-settings` 需要登录及 `price-list:edit` 权限。请求格式示例（JSON 契约，不执行请求）：

```json
{
  "price_list_ids": [123, 124],
  "changes": {
    "source_config_id": 2,
    "show_price": 1,
    "wholesale_rule": { "mode": "extra", "adjustment": 20 }
  }
}
```

`changes` 只提交用户勾选的项目，允许 `source_config_id`、`is_collect`、`status`、`show_price`、`wholesale_rule`。未提交字段保持原值；来源为 `null` 恢复默认来源，三个状态严格使用数字 `0/1`。单次最多 500 条，后端锁定并核对全部记录和指定来源后，在同一事务中修改；部分记录失效则整批回滚。成功返回 `{ requested, updated }` 和消息。旧 `/batch-source` 接口保留兼容，复用同一事务实现。

## 结构迁移与部署

生产环境在发布依赖这些字段的新后端前，先备份目标表并运行专用迁移；使用服务器既有环境配置，不在命令中传凭据：

```bash
# 预览，不执行 DDL
NODE_ENV=production npm --prefix backend run migrate:price-rules
# 核对目标和预览后实施，完成后会回读结构
NODE_ENV=production npm --prefix backend run migrate:price-rules -- --apply
```

迁移在 `price_list` 新增默认 `inherit` 的模式列及默认 `0` 的金额列，不修改已有价格、状态或来源。已存在前三种模式枚举时，预览显示 `extend_enum`，仅扩展允许的 `extra` 值；其他同名但不兼容的字段拒绝覆盖。重复执行为 `already_ready`。开发环境也需显式执行该迁移（使用本机已有环境配置）；不通过启动或页面请求自动增加字段。回滚应用时保留这两个兼容字段和规则数据，不删除字段或清空规则；重新发布后仍可读取。

行为回归入口：`backend/test/price-channel-pricing.check.js`、`backend/test/price-batch-settings.check.js`、`frontend/tests/price-batch-settings.spec.ts`、`frontend/tests/price-list-row.spec.ts`、`frontend/tests/price-list-selection.spec.ts`。Mock 测试不证明实际数据库迁移或浏览器交互已经验收。
