# 开发记录索引

本目录保存有日期的实施进度、审计结果和阶段性方案。它们记录某一时点的工作，不保证描述当前代码或检查结果；当前行为应以源码、自动审计及前端规范为准。

## 汇总与当前规则

- [全局技术债务进度](TECHNICAL_DEBT_PROGRESS.md) - 汇总各专项当时的状态；运行时数值应重新执行对应审计。
- [全局空状态统一进度](EMPTY_STATE_UNIFICATION_PROGRESS.md) - 实施记录；现行规则见[空状态规范](../frontend/empty-state-standard.md)。
- [样式债务清理进度](STYLE_DEBT_PROGRESS.md) - 治理历史及最近一次可复现审计结果。
- [ESLint 清理进度](ESLINT_WARNING_PROGRESS.md) - 阶段性记录，不替代当前 Lint 命令。

## 页面拆分记录

- [库存页面拆分](INVENTORY_VIEW_SPLIT_PROGRESS.md)
- [权限页面拆分](PERMISSIONS_VIEW_SPLIT_PROGRESS.md)
- [销售页面拆分](SALES_VIEW_SPLIT_PROGRESS.md)
- [工资页面拆分](SALARY_VIEW_SPLIT_PROGRESS.md)

## 历史审查与计划

- [前端类型统一进展](FRONTEND_TYPE_UNIFICATION_PROGRESS.md)
- [前端代码审计记录（2026-04-15）](FRONTEND_CODE_AUDIT_VERIFIED_2026-04-15.md)
- [Git 变更分批方案（2026-04-16）](GIT_CHANGE_BATCH_PLAN_2026-04-16.md) - 仅为当日工作区快照，不是当前工作区状态。
- [项目改进记录](PROJECT_IMPROVEMENTS.md) - 历史汇总，不作为当前完成状态证明。

## 维护约定

新增记录应注明核验日期、检查范围和未验证边界。指标变化频繁时优先链接可重复运行的命令，不要把旧数字继续称为“当前结果”。稳定规则应迁入对应的权威规范，而不是只留在进度报告中。
