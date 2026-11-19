# 前端文档索引

本目录收录前端强制规范、组件指南和有明确适用范围的前端专题记录。

## 权威规范

以下文件由 [`standards-manifest.json`](standards-manifest.json) 登记；该清单同时列出对应审计命令和公共实现来源。新增或修改强制规范时，按[规范审计接入指南](standards-audit-guide.md)执行。

- [后台卡片与表格](admin-table-standards.md) — 手机双击记录查看，业务操作统一在详情底部，禁止行内按钮展开
- [后台统计卡片颜色](admin-stat-card-color-standard.md)
- [按钮](button-standards.md) — 业务按钮省略尺寸声明，默认读取公共响应式规格；标杆页保留明确标记的尺寸演示
- [全局颜色令牌与语义色](color-token-standard.md)
- [公共组件采用与例外](component-adoption-standard.md)
- [CRUD 与数据刷新](crud-standards.md)
- [视觉令牌](design-token-standard.md)
- [全局文字与排版](typography-standards.md)
- [客户搜索与姓名保护](customer-search-standard.md)
- [前端规范豁免登记](standards-exemptions.md)
- [报价页联系方式](price-contact-standard.md)
- [数据实时刷新](data-freshness-standard.md)
- [对话框与手机媒体预览](dialog-standards.md) — 复用专用详情或公共 RecordDetailDialog，短字段两列、长字段整行
- [空状态](empty-state-standard.md)
- [全局加载](global-loading-standard.md) — 区块默认全宽，区域覆盖层铺满当前宽高，手机提示文字统一单行省略
- [字段一致性](field-consistency-standards.md)
- [表单控件](form-control-standards.md) — 手机短字段两列、长字段整行及公共地区布局；公共金额输入、按字段语义防脏数据、中文输入法/粘贴及前后端校验验收；实现缺口见 T23
- [最新请求处理](latest-request-standard.md)
- [菜单图标管理](menu-icon-management-standard.md)
- [后台导航与面包屑视觉](navigation-standards.md) — 含首页可配置快捷方式、全站页面目录、按页面分组的功能目录及受控跳转
- [型号搜索](model-search-standard.md)
- [通知](notification-standards.md)
- [页面结构](page-structure-standards.md)
- [分页](pagination-standards.md)
- [支付方式](payment-method-standard.md)
- [页面权限能力](permission-capability-standards.md) — 母子页面归属、独立鉴权、模块与动作登记及验证步骤
- [提醒](reminder-standards.md)
- [搜索与筛选](search-standards.md)
- [安全与运行时审计](security-runtime-standards.md)
- [Shared 经验分享](shared-standards.md)
- [富文本内容统一规范](rich-content-standards.md)
- [导航站 `/DH` 与 `/guide`](guide-navigation-standard.md)
- [全局下载与文件预览安全](download-security-standard.md)
- [规范审计接入](standards-audit-guide.md)
- 可视化入口：登录后台访问 `/standards`（详见[规范审计接入](standards-audit-guide.md)）
- [标签页](tab-standards.md)
- [全局时间工具与日期格式](time-standards.md)
- [全局动效](motion-standards.md)
- [全局打印样式](print-standards.md)
- [全局图标](icon-standards.md) — 动态图标公共渲染、入库确认、本地显示与全量模板审计
- [基础控件与 Drawer](basic-component-standards.md)
- [快捷键](keyboard-shortcut-standards.md)
- [前端埋点](telemetry-standards.md)
- [主题切换](theme-standards.md)
- [全局交互反馈](interaction-standards.md)
- [统一页面结构旧入口](unified-page-structure.md) — 迁移导航，正文及模板统一到“页面结构”
- [前端页面与功能单元台账](page-audit-inventory.md) - 含 2026-11-14 全台账手机详情、字段布局补查及逐路由接入矩阵；保留历史验收记录。

## 专项指南与记录

- [日志收集、生产错误上报与告警边界](../guides/LOG_SYSTEM_STANDARDS.md#四环境行为) - 开发仅本地诊断、生产技术故障上报；普通输入、业务和权限提示沿用通知入口，T5 邮件实现默认关闭，待用户生产配置及收件验收。
- [响应式与主题视觉回归清单](visual-regression-checklist.md)
- [字段权限使用指南](field-permission-guide.md)
- [模态框开发旧入口](modal-development-guide.md) — 迁移导航，唯一正文为“对话框”
- [通知使用旧入口](notification-guide.md) — 迁移导航，唯一正文为“通知”
- [移动端组件旧示例入口](mobile-component-examples.md) — 迁移导航，按专项规范和当前源码选取示例
- [手机状态编辑说明](phone-status-editing.md)
- [近期 UI 与数据修复记录（2026-06-01）](recent-ui-and-data-fixes-2026-06-01.md)
- [前端性能优化旧入口](PERFORMANCE_OPTIMIZATION.md) — 迁移导航，统一使用 Telemetry、数据实时性和构建体积门禁

## 其他入口

- [端到端接口故障闭环](../guides/error-handling-standards.md#端到端接口故障闭环) — 前端请求追踪、错误状态、重试/降级、指标边界及前后端验收的唯一跨端正文。
- [权限页面扫描与模块注册](../permissions/page-module-scan-guide.md)
- [移动端开发标准](../guides/mobile-development-standards.md)
- [开发指南索引](../guides/INDEX.md)
- [文档编写规范](../guides/DOCUMENTATION_STANDARDS.md)

旧入口与兼容路径：

- [前端旧 README](README.md) - 保留历史说明并转向本索引。
- [旧规范目录索引](../standards/INDEX.md) 和[旧规范 README](../standards/README.md) - 仅用于迁移历史链接，不存放规范正文。

本索引及 `standards-manifest.json` 才是当前前端规范入口。
