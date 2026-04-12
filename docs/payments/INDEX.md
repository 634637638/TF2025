# 支付管理文档索引

本目录包含 TF2025 项目的支付、供应商打款相关文档。

## 文档列表

- [供应商打款指南](SUPPLIER_PAYMENT_GUIDE.md) - 供应商打款流程说明
- [供应商打款菜单设置](SUPPLIER_PAYMENT_MENU_SETUP.md) - 打款功能菜单配置

## 功能概述

### 供应商打款
- 向供应商批量支付货款
- 支持多种支付方式
- 打款记录查询与统计
- 打款审批流程

### 菜单配置
- 打款页面路由配置
- 权限控制设置
- 菜单显示/隐藏控制

## 使用流程

1. **创建打款单**：选择供应商，输入打款金额
2. **审核打款**：管理员审核打款申请
3. **执行打款**：确认后执行打款操作
4. **记录查询**：查看历史打款记录

## 权限要求

```javascript
'supplier-payment:read'   // 查看打款记录
'supplier-payment:create' // 创建打款单
'supplier-payment:approve' // 审核打款
'supplier-payment:delete' // 删除打款记录
```

## 相关文档

- [业务文档](../business/)
- [权限系统](../permissions/)
