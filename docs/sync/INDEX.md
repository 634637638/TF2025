# 数据同步文档索引

本目录包含 TF2025 项目的数据库同步、数据导入相关文档。

## 快速开始

- [快速开始同步](QUICK_START_SYNC.md) - 页面操作的简要流程
- [跨数据库同步指南](DATABASE_SYNC_GUIDE.md) - 当前接口、权限、映射和同步流程

## 同步功能

### 匹配与导入
- [智能用户匹配指南](SMART_USER_MATCHING_GUIDE.md) - 用户匹配规则说明
- [价格采集 iPad Air 尺寸匹配说明](price-sync-ipad-air-size-guide.md) - iPad Air7/Air8 11 寸与 13 寸采集匹配规范
- [报价采集归一化规范](price-list-normalization-standard.md) - 颜色标准归一化与 iPhone 型号代码匹配规范
- [价目表动态同步说明](PRICE_LIST_GUIDE.md) - 功能说明；操作前以当前价目表页面为准
- [三渠道价格规则](price-channel-pricing.md) - 销售、批发和 H5 商城价格的独立计算边界
- [智能用户匹配指南](SMART_USER_MATCHING_GUIDE.md) - 导入用户匹配规则

### 导入功能
- [导入历史记录](IMPORT_HISTORY_GUIDE.md) - 数据导入历史查看
- [导入策略报告](IMPORT_STRATEGIES_REPORT.md) - 数据导入策略分析
- [旧价格同步修复记录](price-sync-1tb-fix.md) - 单次问题记录，不是通用同步规则

自动化命令行同步说明已移除：仓库没有对应的 `auto-sync-database.js` 或配置模板。当前跨库操作通过登录后的“数据优化 > 远程数据同步”页面完成。

## 使用场景

1. **本地到云端**：将本地数据同步到云端数据库
2. **云端到本地**：从云端数据库获取数据到本地
3. **智能合并**：自动识别并合并重复数据
4. **批量导入**：从 Excel/CSV 批量导入业务数据

## 注意事项

- 同步前请**备份重要数据**
- 确保网络连接稳定
- 检查数据库权限配置

## 相关文档

- [业务文档](../business/)
- [API 标准](../guides/api-standards.md)
