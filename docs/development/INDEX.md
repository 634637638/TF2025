# 开发记录索引

本目录保存有日期的实施进度、审计结果和阶段性方案。它们记录某一时点的工作，不保证描述当前代码或检查结果；当前行为应以源码、自动审计及前端规范为准。

## 当前入口与持续契约

- [全局技术债务进度](TECHNICAL_DEBT_PROGRESS.md) - 当前剩余任务的唯一汇总入口；其他审计和同事清单只能提供证据，运行时数值仍须重新执行对应检查。
- [样式治理与强制覆盖契约记录](STYLE_DEBT_PROGRESS.md) - 治理历史、必要覆盖分类及最近一次可复现审计结果；未处理样式债务与受控契约分开统计。

## 已闭环专项记录

- [前端类型统一完成记录](FRONTEND_TYPE_UNIFICATION_PROGRESS.md) - 全前端显式 `any` 和重复导出归零证据；当前执行零增长门禁。
- [全局空状态统一进度](EMPTY_STATE_UNIFICATION_PROGRESS.md) - 实施记录；现行规则见[空状态规范](../frontend/empty-state-standard.md)。
- [ESLint 清理进度](ESLINT_WARNING_PROGRESS.md) - 阶段性记录，不替代当前 Lint 命令。

## 页面拆分记录

- [库存页面拆分](INVENTORY_VIEW_SPLIT_PROGRESS.md)
- [权限页面拆分](PERMISSIONS_VIEW_SPLIT_PROGRESS.md)
- [销售页面拆分](SALES_VIEW_SPLIT_PROGRESS.md)
- [工资页面拆分](SALARY_VIEW_SPLIT_PROGRESS.md)

## 历史审计快照

- [本站代码与规范分析（2026-11-02）](site-analysis-2026-11-02.md) - 已补闭环映射；旧数量只代表当时状态，当前任务统一进入全局技术债务台账。
- [前后端逐页与路由模块审计（2026-11-02）](full-stack-page-audit-2026-11-02.md) - 已补闭环映射；类型、重复导出和样式旧数字不再作为当前结论。

更早且已被替代的计划、审查和总结见[开发历史归档](../archive/development/INDEX.md)。

## 维护约定

新增记录应注明文档类型、核验日期、检查范围和未验证边界。指标变化频繁时优先链接可重复运行的命令，不要把旧数字继续称为“当前结果”。稳定规则应迁入对应的权威规范，而不是只留在进度报告中。除全局技术债务进度外，不得建立第二份当前待完善清单。
