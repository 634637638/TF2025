# 业务文档索引

本目录包含 TF2025 项目的业务逻辑相关文档。

## 目录结构

### [考勤管理 (leave/)](leave/)
- [考勤计算规则](leave/LEAVE_CALCULATION_RULES.md) - 考勤天数计算的详细规则说明
- [考勤日期拆分指南](leave/LEAVE_DATE_SPLIT_GUIDE.md) - 跨月考勤记录拆分处理
- [工资模板考勤天数](leave/LEAVE_DAYS_FROM_SALARY_TEMPLATE.md) - 工资模板中的考勤处理
- [待计算考勤处理](leave/LEAVE_PENDING_CALCULATION.md) - 考勤数据待计算状态说明

### [销售管理 (sales/)](sales/)
销售业务相关文档（待补充）

### [库存管理 (inventory/)](inventory/)
库存业务相关文档（待补充）

## 文档使用说明

1. **新增业务文档**时，请放入对应业务模块目录
2. **文档命名**使用大写下划线格式（如：`SALE_CALCULATION_RULES.md`）
3. **更新索引**：新增文档后需更新本索引文件
4. **文档模板**：参考 [TEMPLATE.md](../TEMPLATE.md)

## 相关文档

- [开发指南](../guides/)
- [权限系统](../permissions/)
- [数据同步](../sync/)
