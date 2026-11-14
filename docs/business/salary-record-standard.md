# 工资记录与已发快照

> 2026-11-14结构状态更新：用户确认可恢复备份、停写并授权后，T22本批9项迁移已在当前配置云库执行并逐项核验；发布结构检查10项均ready。未回填历史积分/采购/工资，未创建真实交易；配置启用及真实业务验收仍未完成。执行证据与剩余事项见[T22](../development/TECHNICAL_DEBT_PROGRESS.md#t22-配件商品业务闭环2026-11-12)。

> 文档类型：持续维护的业务契约
> 范围：现有工资记录创建、编辑、审批、发放、重算、考勤触发重算、工资模板商品配置、商品成交/售后的内部提成凭据，以及内部核销规划和追加账。工资金额及正式发放接入状态统一见 [T22](../development/TECHNICAL_DEBT_PROGRESS.md)。

## 已发工资保护

`SalaryRecordService → SalaryRecordRepository` 是工资写入入口。记录的 `status = paid` 或存在非空 `paid_at` 时，已发金额、`commission_detail`、员工、周期、发放时间和支付方式作为原始事实保留；普通编辑、删除、重新计算、同周期创建及再次审批返回 `409 SALARY_RECORD_PAID`。

`POST /salary-records/:id/pay` 仅将尚未发放的 `approved` 工资首次标记为 `paid`，使用公共北京时间和唯一支付方式配置。重复请求直接返回第一次发放的记录，不改写时间、方式或金额，不再次发放。已经存在发放时间但状态不一致的历史记录同样受保护，不能通过普通编辑清除时间后重算。

未发工资可以沿用现有手工录入及状态设置；本契约没有新增支付网关或现金转账动作。前端正式结算先保存 `approved`，再调用首次发放入口。工资记录与实际付款的外部核对不由“标记已发”替代。

当月退货和次月退货后，已发工资均不得被原地覆盖。商品提成及退货冲回通过下文正式工资入口核对未核销来源；跨月扣款关联原销售及原工资，不追改已发金额。代码接入不代表云端已启用，部署前置见核销结构迁移。

## 事务与竞态

- 写入由 service 编排事务，repository 只在同一连接执行参数化 SQL；共享连接 helper 在成功、回滚、提交失败和事务启动失败后均释放连接。
- 同周期首次创建先锁员工行，再锁该员工周期的全部工资行；历史重复周期返回 `409 SALARY_PERIOD_CONFLICT`，不随意选一笔覆盖。
- 按记录编辑、删除、审批和发放统一先锁员工、再锁工资，并重核员工归属；所有写事务使用 REPEATABLE READ。手机及考勤公式计算在写事务外执行，避免锁内另租连接；计算完成后在写事务再次锁读核对。计算期间发生发放时拒绝覆盖。
- 更新和删除的 SQL 额外要求未发状态且 `paid_at IS NULL`；首次发放要求 `approved` 且无发放时间。受影响记录数不符合预期时拒绝提交。
- 原工资员工及周期不可在编辑时改写；业务校验返回 400/404/409 和明确错误码，不将普通冲突当成服务器 500。

## 考勤及批量重算

考勤审批触发重算时，未建工资不自动创建，已发工资直接跳过；计算期间刚好发放也跳过，考勤审批不因已发保护而失败。未发工资继续更新最新计算金额及明细，保留原创建人。

`POST /salary-records/recalculate-month` 沿用工资编辑和团队数据范围权限，响应数据为：

| 字段 | 含义 |
| --- | --- |
| `total` | 本次参与核对的在职且已绑定工资模板员工数 |
| `recalculated` | 未发工资创建或重算成功人数 |
| `skipped_paid` | 已发工资跳过人数 |
| `errors` | 其他失败明细，包含 `employee_id`、`message` |

前端分别展示成功、跳过及失败数，不把跳过视为重算成功。工资计算 Tab 的已发行显示原记录数值，包括零值，不以当前销售、当前模板或后补考勤替换历史；原记录没有保存的休假额度显示空值。已发记录不提供重算、编辑、删除动作，也不提示“需重算”；点击处理函数和后端共同保护。

## 商品提成内部原始凭据

`SalesCheckoutService.issueGoods` 与商品退货、商品换货、手机关联配件退货共同复用 `utils/goods-commission.js`。新成交在原 `sales_order_items.snapshot.commission` 冻结实际销售员、工资模板ID、原数量、出库用途、成交净额、真实采购总成本、使用积分、规则、零提成原因及整数分提成；归属实际销售员，不以办理人或后来的员工模板替换。独立商品、手机搭售和换货新件共用该入口，与库存、SN、积分和原单同事务提交，失败一起回滚。

工资模板规则名为 `goods_commission_rule`，只接受 `enabled` 布尔值、`type: fixed/percentage`、`fixed_amount` 两位金额及 `percentage` 两位比例（0至100）四个字段。没有模板或字段时只冻结“未配置、零提成”的事实，不借用手机规则，也不按后来的配置追发旧单。损坏配置不能当成未配置继续成交，返回409 `GOODS_COMMISSION_CONFLICT`；规则校验入口自身返回400 `SALARY_GOODS_RULE_INVALID`。

按件规则为每件固定金额乘原成交件数；按利润规则以成交净额减真实总采购成本计提，按分四舍五入。赠品、任意部分积分抵扣、成本未知、亏损、关闭或零费率均无提成；当前对零毛利也采用不计提成的保守口径。固定金额不自动封顶到毛利，但同样须有正毛利才计提；这些配置口径须在启用工资配置时一并核对，当前不写死业务费率。

售后在原 `sales_aftersale_items.fact_snapshot.commission_return` 追加原销售员、模板、实际退回数量、原提成和本次冲回分值，客户退款/补款仍按原资金凭据单独记录。复用0基半开实物区间 `[start, stop)`：每段冲回为 `floor(原提成×stop/原数量) - floor(原提成×start/原数量)`；普通件按原顺序、SN按原位置，分次及不同退回顺序累计不多扣、不少扣。未退赠品的0件扣款产生0件、0分冲回；保留的收费配件不产生退回冲回，换入新件另存自己的成交凭据。

读取新凭据时按原成交金额、成本、实际销售员、数量、用途、积分重新核对，兼容MySQL JSON键重排；原单有提成凭据时，对应历史冲回不可缺失且须与原实物区间一致，异常返回409并阻止继续办理。没有提成字段的旧单保持历史边界，不补造历史提成。这些内部对象不进入客户凭证、售后上下文、试算、办理回执或商品查询的公开响应，不扩大成本或工资字段权限。

本节提供成交和售后的原始事实，规则配置通过下节工资模板入口维护。工资计算汇总、当月扣回或跨月扣款落账仍以T22进度为准。已有已发工资保护继续有效，不能把追加凭据视为已经调整员工工资。

## 商品提成工资来源核对

内部入口 `SalaryGoodsService → SalaryGoodsRepository` 提供工资核销前的原始来源集合，由正式工资服务编排金额保存及发放。`preview(employeeId, through)` 使用共享连接，在单连接只读 REPEATABLE READ 事务读取，结束回滚并释放；`readSources(connection, employeeId, through)` 供持有一致性事务的工资编排复用，不自行获得工资权限或暴露 HTTP。该来源入口不读取当前模板/商品资料，不执行 DDL、库存、积分或工资写入，也不接普通销售查询响应。

只选择已完成的共同订单商品明细，按真实销售员或原冻结员工检索并交叉核对，避免员工归属被改后悄悄漏掉。按明细ID游标分批读完截止点前历史，不限制为本月销售；次月退货仍能关联旧成交。原销售ID、商品、客户、门店、数量、金额、采购成本、出库方式及业务时间须与原共同明细一致。商品无旧提成快照仅记录历史数量，不按现行模板补造；若孤立存在冲回凭据则明确拒绝。

售后复用 `planGoodsReturn` 核对完整分次历史、原区间、SN及提成分币，不以SQL直接求和代替核验；缺头、重复、重叠或篡改阻止核对。旧件冲回归原销售员，换入商品按自己真实新销售员形成独立来源；未退赠品0件扣款保留零提成事实。未来业务时间或截止点之后才记录的售后不提前纳入当次金额，但其历史凭据仍须合法。

每条来源包含稳定键 `goods_sale:<原订单明细ID>` 或 `goods_return:<售后明细ID>`、原成交来源键、原订单/商品销售/售后ID、员工及模板、数量、整数分金额、业务时间和录入时间；摘要同时绑定冻结提成规则、原SN及退回区间，并兼容MySQL JSON键重排。成交为正、冲回为负，零值保留原因。业务时间和录入时间分别保留，补录不能伪装成当时已记录；具体工资周期、已核销来源唯一性、补录补差及已发工资冲回仍由后续工资落账编排处理，不能直接把此历史净额加入任意一期工资。

来源集合及摘要仅为服务端内部核对，不对客户公开，不因这一步新增工资字段、API或权限动作。复用公共结构检查，前置共同结算/售后表或真实录入时间字段缺失返回409 `SALARY_GOODS_NOT_READY`，不假装空结果、不用业务日期补造录入时间。BIGINT关联允许安全整数范围，不错误截为32位；不安全整数拒绝。测试使用隔离连接和事务快照替身，未证明真实MySQL执行计划、多连接快照或云端已启用；该结构依赖既有共同结算及售后迁移，部署状态仍以T22为准。

## 商品提成核销规划与内部追加账

`SalaryGoodsSettlementService → SalaryGoodsSettlementRepository` 复用上节已核对来源，提供内部 `prepare / confirm / append`。正式 `SalaryRecordService` 先锁同一员工，在同一一致性事务内保存工资、首次标记已发及追加来源账；本核销服务不自行开另一条连接、修改工资状态或提供HTTP。工资保存、发放及页面已接入代码，云端迁移已于2026-11-14执行并核验，真实工资验收尚未执行。

`prepare(connection, { employee_id, period_start, period_end, through })` 读取全部原销售、售后、该员工工资快照和已核销账；按ID游标读完所有分页，并按实际来源键补查，员工或工资归属错误不能导致来源再次领取。已发工资快照与核销账必须双向完整，员工、周期、时间、金额、摘要及原始来源逐项一致；有账无已发工资、有快照缺账、来源缺失、重复或篡改返回409 `SALARY_GOODS_SETTLEMENT_CONFLICT`。SQL不直接求历史净额替代核验。

仅把业务日期不晚于本期结束、在核对截止点已真实记录且尚未核销的来源纳入本期；旧期未领取来源可在后期补结，未来业务不提前结算。`through`使用真实核对时间，不能固定为工资月末，否则月末之后补录的旧业务将一直漏结。草稿不占来源，可重算或删除。原提成尚未领取时，同次纳入原成交和已发生的退货，按净额结算；原成交已经发放时，退货仅扣未核销的冲回，保留原工资ID。分次扣回各有唯一来源，换入商品保留自己的实际销售员。零提成仍核销原原因，不能随当前模板变化追发。

内部快照 `salary_records.goods_commission_snapshot JSON NULL` 保存版本、员工、周期、核对时间、历史无凭据数量、整数分正提成/冲回/净额和逐来源列表。每个来源附 `original_salary_record_id`：成交为空；退货的原提成已在其他工资发放时为原工资ID，同次净结时快照为空、落账关联本次工资ID。该字段独立于原手机 `commission_detail`，不将商品行混入手机销量或手机提成数组。当前普通工资仓储的公开响应和手工写入白名单均不含这个内部字段，内部规则、采购成本和来源摘要不得直接向客户或员工页面透传。

`confirm(connection, approvedRecord, through)` 在首次发放前重新规划并对比保存快照；允许核对时间前进，来源、金额、零原因或原工资归属变化返回409 `SALARY_GOODS_RECALCULATION_REQUIRED`，要求重算，不静默改变已确认金额。`append(connection, paidRecord, confirmed)` 只接受原工资已经按该快照首次变为paid的状态，逐来源插入 `salary_goods_settlements`；冲回关联原工资，唯一键冲突明确拒绝。任何一步失败均由原工资事务一起回滚；重复发放由首次发放入口返回原记录，不再次追加。历史已发工资的真实提成/净工资与内部基数也须一致，不能仅核对来源账而忽略实际工资金额。

## 正式工资金额、保存与页面

`utils/salary-goods-amounts.js` 是商品工资金额的唯一合并和公开投影入口。内部快照附 `salary_basis: { commission_cents, net_cents }`，保存原手机/手工提成和商品计提前净工资；商品净额仅加一次到 `commission_amount` 与 `net_salary`。编辑先核验、剥离旧商品净额，再应用当前来源；不能直接把含商品总提成当作手工基数。服务器公式结果按分四舍五入后以整数分汇总，外部手工金额严格拒绝超过两位、非有限或超范围输入。

- `POST /salary-records`、`PUT /salary-records/:id` 保留允许的手工工资组件，未显式提交净工资时由服务器重算；商品部分只由服务器生成。
- `POST /salary-records/calculate` 返回含商品的服务器预览；`POST /salary-records/save` 自动重算并保存，只接受身份、周期和允许的状态/付款元数据，不信任浏览器回传的金额。该路由允许 create/edit 任一动作进入，持员工/周期锁后再按实际新增或编辑校验对应权限。
- 普通新增/编辑不能提交 `status: paid`、非空 `paid_at` 或内部商品凭据。首次发放统一走 `/:id/pay`，保存工资、核销来源与首次paid由同连接事务保证；草稿保存不占来源。
- 公开响应增加只读 `goods_commission`，包含 `earned_amount`、`reversal_amount`、`net_amount` 及 `entries`。明细仅含类型、原订单/明细、售后/明细、原工资ID、数量、业务/录入时间及金额；不透传成本、规则、摘要、来源键或内部基数。
- 响应 `calculation_version` 绑定工资金额、员工/周期、手机明细及内部商品快照。前端预览保存、编辑和首次pay回传 `expected_calculation_version`；传入时服务器严格比较，变化返回409 `SALARY_GOODS_RECALCULATION_REQUIRED`。版本核对不代替动作、字段权限或发放前的来源重核；旧调用方可省略版本，仍执行服务器核验。

列表/详情在同一查询读取工资金额与内部快照，随后统一投影，避免两次查询拼接不同版本。团队模块 `salary_salaryrecordsview`、本人模块 `salary_mysalaryview` 复用严格 `FieldAccessService`；`salary.commission_amount` 同时遮蔽总提成、手机明细和商品摘要，隐藏字段写入及权限读取失败在业务写入前拒绝。本人视角仍仅能看自己的已发记录。

工资计算 Tab 对所有已保存记录展示服务器金额，未建记录的提成/净工资显示“待核对”；编辑、确认结算及详情复用 `SalaryGoodsSummary`，按需展开原订单、售后及原工资关联。手工提成输入不含只读商品净额，已发记录不能编辑或重算。顶部及员工配置页的旧本地预估仅供手机/考勤参考，不含商品来源核对，不能替代结算预览。

未迁移环境的工资只读查询可按无快照读取旧记录；保存/重算/首次发放须先具备共同结算、售后及核销结构，缺失明确409，不静默略过商品来源。旧已发无凭据记录保留原金额及幂等重试，不追发、不伪造核销历史。

### 核销结构迁移与回滚

追加账包含自增ID、员工ID、本次/原工资ID、全局唯一 `source_key`、`source_hash`、有符号整数分金额、原来源快照和真实创建时间。来源键/摘要使用`ascii_bin`，两个工资外键均为RESTRICT，禁止工资删除级联丢失核销历史；员工归属同时由服务核对。外键类型从原`salary_records.id/employee_id`元数据读取并严格限制为整数类型，保留signed/unsigned，不猜测父表类型。

迁移命令默认只预览，不在API请求内执行：

```bash
npm --prefix backend run migrate:salary-goods-settlement
```

确认连接目标、停写维护及备份位置，具备本次明确数据库写入授权后才执行：

```bash
npm --prefix backend run migrate:salary-goods-settlement -- --apply --backup-file=/secure/backups/salary-before-goods-settlement.json
```

脚本以0600独占备份原工资结构/全部记录及已有核销表，校验快照列、引擎、字段、字符排序、完整唯一索引和外键；迁移前后核对原工资逐字段摘要及新增内容为空。只增加可空快照和空核销表，不补造历史工资，不发放金额。MySQL DDL非事务，中断保留备份和已完成结构；用新的备份路径重入，只补缺项。回退应用可保留结构；仅所有快照仍为SQL `NULL`且核销表为空时，在另有删除结构授权及停写维护下追加`--rollback --apply`，先备份再按外键顺序删除。关闭/零额快照、JSON `null`或任意核销历史都禁止删结构；丢失一部分结构但已有历史时也拒绝重建掩盖缺账。维护期间必须停止工资写入，迁移后重启应用清理结构检查缓存。

2026-11-14已授权执行云端结构迁移并回读。正式测试为`backend/test/salary-goods-settlement.check.js`及`backend/test/salary-goods-settlement-migration.check.js`，正式工资接入另由`salary-record-paid.check.js`核验，使用隔离来源、连接及事务替身；不代表真实MySQL多连接锁竞争或生产工资已验收。

## 工资模板商品提成配置

`SalaryTemplateController → SalaryTemplateService → SalaryTemplateRepository` 沿用现有 `/salary-templates` 新增、编辑及查看接口，规则存于 `salary_templates.goods_commission_rule JSON NULL`。手机固定额、手机利润比例、底薪、涨薪规则和员工绑定继续使用原字段；不增加平行模板或新的权限模块。实际销售通过 `SalesCheckoutRepository.seller` 在原事务连接读取销售员所绑定模板，原成交冻结规则；调价、改模板或关闭商品提成不追改旧单。

新增/编辑请求的规则须为完整对象或 `null`，金额及比例为有限数值，不接受JSON字符串、字符串金额、隐式布尔、额外键或超过两位精度；`fixed_amount`范围0至99999999.99元，`percentage`范围0至100。省略规则表示不修改，显式`null`清除为未配置；关闭对象和零费率仍作为配置保存。读取兼容数据库返回的JSON文本并统一为对象，列表、详情以及新增/更新响应内的规则保持同一形状，旧模板的空规则返回`null`。公共激活模板选项仍只投影原`id/name/base_salary`，不携带商品规则。

工资模板表单复用`MobileDialog`、`el-form`、`AmountInput`和公共行布局，新增默认关闭、金额和比例默认0。手机与商品各自设置提成方式，商品启用后选择按件金额或利润比例；取消直接关闭，保存中禁止修改和关闭，非法配置不能提交。金额默认分币步长、两类比例使用0.01步长，合法小数不被浏览器的整数步长拦住；继续保留字段校验。

商品规则整组登记为`salary_salarytemplatesview`模块的`template.goods_commission_rule`。动作继续要求`salary-templates:create/edit/view`，前端字段查看/可编辑分别复用统一入口，不用其他工资动作绕过新规则的可编辑设置；不能编辑时请求省略该组。后端`FieldAccessService`在业务写入前拒绝隐藏组，包括显式`null`和关闭对象，并递归遮蔽列表、详情及保存响应。字段权限读取失败即拒绝，不先写后遮蔽。

### 字段迁移与回滚

迁移属于部署步骤，普通API不能执行DDL。未升级环境的查询使用`NULL AS goods_commission_rule`，未提交规则的旧接口仍可操作；显式保存规则返回409 `SALARY_GOODS_RULE_NOT_READY`，须先完成字段升级。迁移脚本默认仅预览：

```bash
npm --prefix backend run migrate:salary-goods-commission
```

确认当前环境连接目标、停写维护及备份位置后，才在已有明确数据库写入授权范围内执行：

```bash
npm --prefix backend run migrate:salary-goods-commission -- --apply --backup-file=/secure/backups/salary-templates-before-goods.json
```

脚本检查字段类型、可空及默认值；执行前以独占方式写入0600权限的原结构和模板备份，新增可空JSON列后核对全部原字段摘要及新规则全为空，不写入默认费率或改发工资。重复执行不再写；结构冲突、备份失败或迁移后数据变化均失败，保留备份供核对，不自动删字段。

回退应用代码可保留新增字段和已经冻结的成交凭据。仅当所有模板规则仍为SQL `NULL`且另有删除字段授权时，使用同一命令追加`--rollback --apply`并指定新的独占备份文件；即使规则关闭或费率为0，也拒绝删列。结构迁移测试使用隔离替身，不代表云端已应用或真实锁竞争已验收；部署状态只记录在T22。

## 验证边界

正式行为测试为 `backend/test/salary-record-paid.check.js` 和 `frontend/tests/salary-payout-paid.spec.ts`，覆盖金额与明细不可变、发放幂等、计算期间发放、考勤跳过、周期冲突、错误映射、失败回滚/释放及 PC/手机动作和快照。执行：

```bash
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/salary-record-paid.check.js
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/salary-goods.check.js
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/salary-goods-settlement.check.js backend/test/salary-goods-settlement-migration.check.js
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/salary-template-goods.check.js backend/test/salary-goods-migration.check.js
ENV_FILE=test/missing-unit-env RUN_DB_TESTS=false node --test backend/test/goods-commission.check.js backend/test/sales-checkout.check.js backend/test/sales-goods-return.check.js backend/test/sales-goods-exchange.check.js backend/test/sales-phone-return.check.js backend/test/sale-status.check.js backend/test/sales-aftersale.check.js
npm --prefix frontend run test:unit -- tests/salary-payout-paid.spec.ts --maxWorkers=1
npm --prefix frontend run test:unit -- tests/salary-goods-payout.spec.ts tests/sales-receipt-accessories.spec.ts --maxWorkers=1
npm --prefix frontend run test:input-flows -- --salary-goods
npm --prefix frontend run test:unit -- tests/salary-template-goods.spec.ts tests/amount-input.spec.ts --maxWorkers=1
```

商品正式测试覆盖规则配置及保存响应、字段拒写/遮蔽、迁移备份/幂等/回滚拒绝、真实成交与实际销售员归属、抵扣不计提、分币守恒、历史边界、JSON键重排/篡改拒绝、三条售后路径，以及内部核销的双向完整性、跨期草稿变化和失败回滚。单元测试使用隔离连接/响应，不连接云端或证明 MySQL 多连接锁竞争已验收。模板字段和核销结构均提供受控迁移脚本，正式保存/首次发放已按上文接入内部核销和服务端金额基数；相关云端迁移已于2026-11-14执行并核验，真实工资验收尚未执行；完整测试、浏览器和云端状态在 T22 中分别记录。
