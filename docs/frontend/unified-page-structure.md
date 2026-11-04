# 统一页面结构迁移入口

本文件保留原有路径，页面结构的唯一正文、公共组件边界、权限规则和可编译模板已合并到 [页面结构规范](page-structure-standards.md)。

不在这里维护第二套模板、组件创建计划或权限示例。修改页面请从 [前端索引](INDEX.md) 和 [规范清单](standards-manifest.json) 阅读对应正文；原“未来创建 PageHeader”等计划不能作为当前实现依据。

公共实现为 `frontend/src/components/base/PageHeader.vue`、`frontend/src/styles/admin-layout.css` 和既有权限、Loading、刷新 Composable。检查命令沿用页面结构规范的 `check:ui`、`check:tabs`、`check:tables`，并执行本次涉及的专项检查。
