# 综合查询退库与交易撤销

退库用于撤销已经完成的零售、批发或供应商划拨交易。入口为 `/query` 的退库弹窗，记录查看与编辑位于系统管理的退库管理页面。

## 业务与事务

- 每次针对一台设备的当前交易撤销；只允许 `sold`、`peer_transfer`、`supplier_proxy` 状态，并要求存在对应销售记录。
- 锁定设备与最新销售记录后，在同一事务内调用公共 `reverseCustomerPointsForSale`、删除销售记录、恢复设备为 `in_stock`、保存退库日志。积分、库存或日志任一步失败全部回滚。
- 积分按销售实际发放凭据冲回；批发、划拨按现有规则通常为0，不额外扣分；历史无凭据的边界遵循[客户积分规范](../../guides/customer-points-standard.md)。
- 退库类型只有“退货处理”“申请换货”，两者均先撤销当前交易。“申请换货”不自动生成新销售。
- 处理方式记录后续处理意向，不自动执行维修、报废或供应商退换；退款方式与金额用于记录，不发起第三方资金退款。公共支付边界见[支付方式规范](../../frontend/payment-method-standard.md)。

## 字段与显示

| 字段 | 要求与用途 |
| --- | --- |
| `return_reason` | 必选；客户退货、质量问题、性能不达标、外观瑕疵、功能故障、配件缺失、其他原因 |
| `return_type` | 必选；退货处理、申请换货 |
| `handle_method` | 必选；重新入库、返厂维修、供应商退换、报废处理 |
| `refund_amount` | 必填非负金额，最多两位小数，上限99999999.99；0明确表示未退款，不能转换成空值 |
| `refund_method` | 必选；全局 `PaymentMethodSelect` 的 `refund` 场景：现金支付（`cash`）、移动支付（`mobile`）、银行卡（`bank_card`）、原路退回（`原路退回`） |
| `refund_channel` | 当前方式有全局渠道时必选，使用 `PaymentChannelSelect`；移动支付为微信/支付宝，银行卡为刷卡付款/银行转账。现金及原路退回保存 `null`；切换方式清空旧渠道 |
| `reversal_date` | 必填；用户选择的业务退库时间，后端按北京时间归一化保存；列表日期筛选使用此字段 |
| `remarks` | 可选，最多200字，独立保存，不覆盖原因、类型或处理方式 |
| `created_at` | 服务端实际创建日志的北京时间，与业务退库时间分别展示；编辑时不改写 |

退库原因、类型及处理方式的唯一数据源为 `backend/src/config/return-stock-options.json`。支付方式与渠道统一来自 `backend/src/config/payment-methods.json`，前端 `paymentMethods.ts` 和后端校验共用此配置；退款方式从销售方式派生并保留原路退回，退款不再维护自己的方式或渠道白名单。全局新增渠道后，退库选择、名称展示与后端校验随配置同步，无需逐页改代码；配置修改后须重新构建并部署。前端共享类型位于 `frontend/src/types/return-stock.ts`。

日志保存在 `sale_reversal_logs`，明细使用六个可空字段：`return_reason`、`return_type`、`handle_method`、`refund_amount`、`refund_method`、`refund_channel`。历史缺失值保留空值并显示 `-`，不得根据备注推测回填。新建记录必须完整提交；编辑仅更新显式提交字段，历史空值不会因只改备注而被自动补写。方式及渠道一起修改、组合校验；只改其他字段不强制补齐历史渠道。

电脑表格、手机卡片、编辑弹窗均覆盖这些字段。渠道与主方式统一使用 `record.refund_method` 字段权限，隐藏方式时也必须脱敏渠道并拒绝渠道写入。权限模块统一使用 `system_returngoods`，字段定义唯一登记在 `frontend/src/config/moduleFields.js` 的 `returngoods` 并由该模块键映射读取，权限管理弹窗不能误归入父级 `system`。查询服务端脱敏，编辑拒绝隐藏字段写入。原有设备、客户、操作员、销售与时间列按各自字段权限展示。退库时间选择器填满所在表单列，随PC和手机表单宽度自适应。

## 接口与权限

- `POST /api/query/:id/return-to-stock`：要求 `query:return-to-stock`，请求字段为上表业务字段（`created_at` 由服务端生成）。缺失选择、渠道错配、无效金额或无效时间返回400及 `INVALID_RETURN_STOCK`，未通过校验不进入数据库事务。
- `GET /api/query/returngoods`：要求 `return-goods:view`；返回完整结构化记录，保留分页、关键词与退库日期筛选。关键词可匹配原因、类型、处理方式、退款方式及原有设备、客户、备注等字段。
- `PUT /api/query/returngoods/:id`：要求 `return-goods:edit`，支持上述业务字段；日志编辑不再执行积分冲回和交易撤销。
- `DELETE /api/query/returngoods/:id`：沿用 `return-goods:delete`；仅删除日志，不恢复原交易。

全部接口复用统一JWT认证及服务端门店范围，前端动作隐藏不能替代后端检查。撤销成功清除综合查询与统计缓存。

## 数据库升级与部署

新增列需要在部署应用代码前升级数据库。脚本默认仅预览，使用当前环境配置，不在应用启动时执行DDL。

脚本现检查上述六列，已执行过五列迁移的数据库仅补 `refund_channel VARCHAR(30) NULL`，不重复添加既有字段。各目标环境仍需单独核验，不能将一次迁移完成解释为其他数据库也已完成。

```bash
npm --prefix backend run migrate:return-stock-details
```

生产环境选择对应环境文件预览：

```bash
NODE_ENV=production ENV_FILE=.env.production npm --prefix backend run migrate:return-stock-details
```

确认目标数据库、完成备份并获得执行授权后，才运行：

```bash
NODE_ENV=production ENV_FILE=.env.production npm --prefix backend run migrate:return-stock-details -- --apply
```

脚本检查既有字段类型，重复执行不会重复加列，不回填或修改旧记录。升级后部署后端 `src`、迁移脚本、`package.json`，重新构建并发布前端，重启后端。同步 `backend/scripts/config/field-contracts.json` 的迁移状态时必须有目标数据库实测依据；未执行不能登记完成。

回滚应用时可保留新增可空列；如确需删列，脚本提供 `--rollback`，只允许所有新增字段都未保存数据时执行，已有明细必须拒绝删除。回滚前同样需要备份和目标库授权。

### 本次数据库执行记录

2026-11-09 经用户授权，对当前 `backend/.env` 所配置的云端数据库执行五列迁移，结果为 `migrated_and_verified`。新增列的类型及可空性回读一致，重复预览返回 `already_ready`。迁移前后均为15条退库日志，按主键排序的全部旧字段内容摘要一致，新增字段均为 `NULL`，没有推测回填历史数据。

迁移前的目标表结构、数据快照及校验结果保存在 `backend/backups/return-stock-details-2026-11-09T04-28-18-026Z/`，目录权限为700、文件为600，并已忽略Git提交。SQL备份已完成文件回读和摘要校验，未执行恢复演练；备份含业务资料，应保留并受控管理。

使用当前真实 `QueryRepository.getReturnGoodsRecords` 在只读事务内验证列表及关键词查询：列表返回15条、七个明细与时间字段均存在，关键词查询成功。未创建真实退库、修改积分或执行资金退款。数据库升级完成不代表云端应用代码已发布，仍须按上述部署步骤同步应用并进行浏览器与手机验收。

同日另获用户“允许备份后新增渠道列”授权后，备份到 `backend/backups/return-stock-refund-channel-2026-11-09T05-08-31-836Z/`，权限与上述备份相同，文件回读及摘要校验通过。仅新增 `refund_channel VARCHAR(30) NULL`，结构回读正确、重复预览为 `already_ready`。15条旧记录及全部既有字段摘要一致，历史渠道均为空，真实仓储列表与渠道搜索通过。未创建真实退库，未执行备份恢复演练。

PC与手机浏览器尺寸仿真使用真实组件及公共样式、隔离业务写入验证：390/768/1440px视口下，退库时间与相邻选择框等宽；移动支付显示微信、支付宝，未出现运行时异常。组件回归覆盖必选、切换清空、方式/渠道完整提交及文本回显；全局配置注入新增渠道的测试覆盖前端选项/名称与后端校验同步。浏览器尺寸仿真不代替真实手机或生产发布验收。

## 验证

```bash
node --test backend/test/query-connection-lease.check.js backend/test/return-stock-details.check.js backend/test/customer-points.check.js
npm --prefix backend test
npm --prefix frontend run type-check
npm --prefix frontend run check:fields
npm --prefix frontend run check:field-permissions
npm --prefix frontend run check:payment-methods
npm --prefix frontend run test:unit -- tests/return-stock-modal.spec.ts
```

前端回归使用真实 Element Plus 表单验证必选拦截、公共退款选项与0元请求；Vitest 在 jsdom 中内联 Element Plus 并使用浏览器版验证器，避免 Node CJS 默认导出互操作导致表单验证被误判为成功。

上述模拟测试覆盖必填、0元、时间归一化、事务回滚、字段读写、脱敏和迁移幂等，不代替云端结构验证及浏览器/真机验收。数据库测试遵循[全局测试规范](../../guides/TESTING_STANDARDS.md)。
