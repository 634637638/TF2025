# 数据优化与导入索引

本目录保留数据导入、匹配和同步的功能专题说明。跨数据库同步的实际页面操作见[同步文档索引](../sync/INDEX.md)；功能细节应与当前页面和服务实现交叉核对。

- [智能导入功能说明](智能导入功能说明.md) - 导入策略、公共输入校验、空值/零金额及事务边界。
- [智能匹配逻辑说明](智能匹配逻辑说明.md) - 基础资料和关联数据的匹配思路。
- [销售事件去重与历史补录核对（2026-11-21）](销售事件去重与历史补录核对-2026-11-21.md) - 云端历史销售核对、已重配批次、剩余人工复核及规格字典缺项。
- 2026-11-21 四组用户确认的多买家销售事件已修复：`F2MVT87BJCLG`、`FD2XD0EEJCLY`、`G0NCD540N742`、`X322494GWJ`；执行与回滚 SQL 见销售事件核对正文。
- 2026-11-21 多买家事件采购成本修正：`C2J34VKT27`、`C2CT66C9Y1`、`C02L7KQEF5V7` 三笔二手销售已按旧站采购成本修正销售及设备成本并回读；备份、执行/回滚 SQL 和逐条审计明细见数据优化核对正文。
- 同批继续完成 450 条 SN、手机号、销售日期和售价精确命中的采购成本修正；其后按用户核实补回 `FFXDKQTA0DYM` 第二笔独立二手销售。日期/售价与成本余项继续按买家事件核对，不按 SN 合并。
- 2026-11-21 追加规格与备注修复：`backend/旧数据/spec-alias-round-20261121.sql`、`backend/旧数据/spec-alias-round-20261121-rollback.sql`、`backend/旧数据/used-marker-note-round-20261121.sql` 及对应回滚 SQL。仅关联现有品牌、型号、颜色、内存字典并修正既有二手状态，未创建字段或基础资料；操作前备份为 `backend/backups/sql-20261121_173851.sql`。
- 2026-11-21 用户确认规格别名：`三星S6`、`S6` 关联现有三星 `S6`，`iPadmini3`、`mini3` 关联现有苹果 `iPad mini3`，`watchs6` 关联现有苹果 `Watch S6`。共 9 台设备已按原始表销售条件唯一匹配后修复并回读；执行/回滚 SQL 为 `backend/旧数据/spec-alias-s6-ipadmini3-20261121.sql` 与 `backend/旧数据/spec-alias-s6-ipadmini3-20261121-rollback.sql`，本轮更新前备份见 `backend/backups/sql-20261121_213604.sql`。
- 已确认三组销售事件修复及回滚 SQL：`backend/旧数据/sale-event-reassign-confirmed-20261121.sql`、`backend/旧数据/sale-event-reassign-confirmed-rollback-20261121.sql`；依据旧站入库日期补正三台设备的 `phones.inventory_time` 并回读验证，操作前备份为 `backend/backups/sql-20261121_152053.sql`。其后 484 组销售事件已批量重配并回读验证，批次及回滚 SQL、明细工作簿位于 `backend/旧数据/sale-event-reassign-batch-20261121*`，操作前备份为 `backend/backups/sql-20261121_164341.sql`。剩余 32 组及规格缺少的字典关联见销售事件核对正文和工作簿。
- `XJMQ9WQVTR` 两位二手买家的历史销售事件已修复并回读，执行/回滚 SQL 为 `backend/旧数据/sale-event-repair-XJMQ9WQVTR-20261121.sql` 与 `backend/旧数据/sale-event-repair-XJMQ9WQVTR-20261121-rollback.sql`；操作前备份为 `backend/backups/sql-20261121_190945.sql`。新增事件保留原已恢复设备的付款字段，未根据旧站缺失信息推断付款状态。
- `F2LVDC2FJCM0` 缺失的 2017 年首售事件已补回并回读，现有销售同步关联苹果、`iphone 8p`、白色、64GB；执行/回滚 SQL 为 `backend/旧数据/sale-event-repair-F2LVDC2FJCM0-20261121.sql` 与 `backend/旧数据/sale-event-repair-F2LVDC2FJCM0-20261121-rollback.sql`，操作前备份为 `backend/backups/sql-20261121_193407.sql`。旧站袁西婷与云端档案袁茜婷按手机号对应，姓名别名待后续整理。
- `DX3P3M8MFRC6` 后续二手销售的采购成本和备注已修复并回读，首售手机号一致但云端客户姓名与来源姓名不同，保留姓名待后续核对。执行/回滚 SQL 为 `backend/旧数据/sale-event-repair-DX3P3M8MFRC6-20261121.sql` 与 `backend/旧数据/sale-event-repair-DX3P3M8MFRC6-20261121-rollback.sql`，操作前备份为 `backend/backups/sql-20261121_194249.sql`。
旧远程备份登录方案 `cloud-backup-login-solution.md` 已移除：仓库当前没有对应的天翼云盘功能实现。
