# 旧样式规范迁移说明

此旧路径保留用于兼容历史链接，不再定义一套平行的样式规范。原文中的目录结构、颜色变量、断点、组件示例和 `!important` 建议与当前代码及审计不一致，不应继续复制使用。

现行要求及对应入口：

- 颜色令牌和覆盖债务：[后台统计卡片颜色规范](../frontend/admin-stat-card-color-standard.md)；检查命令为 `npm --prefix frontend run check:style-debt`。
- 页面结构：[统一页面结构规范](../frontend/unified-page-structure.md)。
- 按钮样式：[按钮规范](../frontend/button-standards.md)。
- 对话框：[对话框规范](../frontend/dialog-standards.md)。
- 移动端：[移动端开发标准](../guides/mobile-development-standards.md)。
- 强制规范新增与审计：[规范审计接入指南](../frontend/standards-audit-guide.md)。

强制规范正文以[前端规范索引](../frontend/INDEX.md)登记的文件为准；本文件仅作为迁移入口。
