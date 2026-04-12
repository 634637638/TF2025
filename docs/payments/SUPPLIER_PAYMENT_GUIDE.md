# 供应商打款功能 - 部署和测试指南

## 功能概述

供应商打款功能提供了完整的供应商付款管理流程,包括:
- 创建付款申请
- 审批流程
- 确认付款完成
- 付款记录查询
- 统计分析

## 已创建的文件

### 后端文件
1. `/backend/src/controllers/payment.controller.js` - 打款控制器
2. `/backend/src/services/payment.service.js` - 打款服务层
3. `/backend/src/repositories/payment.repository.js` - 打款数据访问层
4. `/backend/src/routes/payments.js` - 打款路由
5. `/backend/database/migrations/add_supplier_payment_permissions.sql` - 权限配置SQL

### 前端文件
1. `/frontend/src/views/payments/PaymentsView.vue` - 打款管理页面
2. `/frontend/src/assets/styles/views/payments.scss` - 打款页面样式
3. `/frontend/src/router/index.ts` - 已更新路由配置

## 部署步骤

### 1. 执行数据库迁移

```bash
# 连接到数据库
mysql -h rm-cn-x0r3j370k0011bko.rwlb.rds.aliyuncs.com -u root -pHorse2024@ tf2025

# 执行权限配置脚本
source /Users/imac/Desktop/webtset/TF2025/backend/database/migrations/add_supplier_payment_permissions.sql
```

或者在后端项目中执行:
```bash
cd /Users/imac/Desktop/webtset/TF2025/backend
mysql -h rm-cn-x0r3j370k0011bko.rwlb.rds.aliyuncs.com -u root -pHorse2024@ tf2025 < database/migrations/add_supplier_payment_permissions.sql
```

### 2. 验证数据库表结构

确保以下表已存在:
- `supplier_payments` - 付款记录表
- `supplier_settlements` - 对账记录表
- `suppliers` - 供应商信息表(含bank_info字段)

### 3. 重启后端服务

```bash
cd /Users/imac/Desktop/webtset/TF2025/backend
npm run dev
```

### 4. 重启前端服务

```bash
cd /Users/imac/Desktop/webtset/TF2025/frontend
npm run dev
```

## 权限配置

### 新增权限代码

1. `suppliers_payment:view` - 查看打款页面
2. `suppliers_payment:read` - 查看打款记录
3. `suppliers_payment:create` - 创建打款申请
4. `suppliers_payment:approve` - 审批打款申请
5. `suppliers_payment:confirm` - 确认付款完成
6. `suppliers_payment:cancel` - 取消打款申请
7. `suppliers_payment:export` - 导出打款记录

### 角色权限分配

- **管理员(sadmin)**: 自动分配所有权限
- **销售员(3333)**: 仅查看和创建权限

如需调整,请登录系统管理 → 角色管理 → 编辑角色权限

## 测试流程

### 1. 测试账号

- **管理员**: sadmin / 123456
- **销售员**: 3333 / 636363

### 2. 测试步骤

#### 步骤1: 登录系统
使用管理员账号登录

#### 步骤2: 检查菜单
确认左侧菜单显示"供应商打款"选项

#### 步骤3: 进入打款管理页面
点击菜单 → 供应商打款

#### 步骤4: 创建付款申请
1. 点击"新建打款"按钮
2. 选择供应商(例如: 苹果授权经销商)
3. 选择对账单(如果有)或直接输入金额
4. 选择付款方式(银行转账)
5. 点击"确认创建"

#### 步骤5: 审批付款申请
1. 在列表中找到刚创建的付款申请(状态:待处理)
2. 点击"审批"按钮
3. 选择审批结果(通过/拒绝)
4. 输入审批意见
5. 点击"确认通过"

#### 步骤6: 确认付款完成
1. 在列表中找到已审批的付款申请(状态:已审批)
2. 点击"确认付款"按钮
3. 输入交易流水号
4. 输入付款账户
5. 选择实际付款日期
6. 点击"确认付款完成"

#### 步骤7: 查看统计
- 查看顶部统计卡片数据
- 确认已完成付款的金额增加

#### 步骤8: 测试权限切换
1. 退出登录
2. 使用销售员账号登录(3333)
3. 确认只能查看和创建,无审批按钮

### 3. 功能验证清单

- [ ] 页面加载正常
- [ ] 统计卡片显示正确
- [ ] 创建付款申请成功
- [ ] 审批流程正常
- [ ] 确认付款成功
- [ ] 取消付款功能正常
- [ ] 搜索筛选功能正常
- [ ] 分页功能正常
- [ ] 权限控制生效
- [ ] 导出功能正常

## API接口说明

### 基础路径
`/api/payments`

### 接口列表

#### 1. 创建付款申请
```
POST /api/payments
权限: suppliers_payment:create
```

请求体:
```json
{
  "supplier_id": 1,
  "settlement_id": null,
  "payment_amount": 10000.00,
  "payment_method": "bank_transfer",
  "notes": "预付款"
}
```

#### 2. 审批付款申请
```
PUT /api/payments/:id/approve
权限: suppliers_payment:approve
```

请求体:
```json
{
  "status": "approved",
  "approval_notes": "审批通过"
}
```

#### 3. 确认付款完成
```
PUT /api/payments/:id/confirm
权限: suppliers_payment:confirm
```

请求体:
```json
{
  "transaction_id": "TXN2025010800001",
  "payment_account": "工商银行 xxxxx",
  "actual_payment_date": "2025-01-08"
}
```

#### 4. 取消付款
```
PUT /api/payments/:id/cancel
权限: suppliers_payment:cancel
```

请求体:
```json
{
  "cancel_reason": "取消原因"
}
```

#### 5. 获取付款列表
```
GET /api/payments?page=1&limit=20&status=pending
权限: suppliers_payment:read
```

#### 6. 获取付款详情
```
GET /api/payments/:id
权限: suppliers_payment:read
```

#### 7. 获取统计数据
```
GET /api/payments/statistics
权限: suppliers_payment:read
```

#### 8. 导出记录
```
GET /api/payments/export
权限: suppliers_payment:export
```

## 业务流程说明

### 完整打款流程

```
1. 采购入库 → 生成应付账款
   ↓
2. 创建对账单 → 确认应付金额
   ↓
3. 创建付款申请 → 关联对账单
   ↓
4. 管理员审批 → 通过/拒绝
   ↓
5. 财务付款 → 确认付款完成
   ↓
6. 系统自动更新 → 供应商账户余额
```

### 付款类型

1. **预付款**: 采购前预付,不关联对账单
2. **结算款**: 根据对账单结算,关联对账单
3. **退款**: 供应商退款

### 付款方式

- `cash` - 现金
- `bank_transfer` - 银行转账(默认)
- `alipay` - 支付宝
- `wechat` - 微信
- `other` - 其他

### 付款状态

- `pending` - 待处理
- `approved` - 已审批
- `completed` - 已完成
- `failed` - 失败
- `cancelled` - 已取消

## 常见问题

### 1. 菜单不显示

**原因**: 权限未分配或SQL未执行

**解决**:
```sql
-- 检查菜单是否存在
SELECT * FROM menus WHERE name = '供应商打款';

-- 检查权限是否存在
SELECT * FROM permissions WHERE code LIKE 'suppliers_payment%';

-- 检查角色权限
SELECT rp.* FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
JOIN roles r ON rp.role_id = r.id
WHERE p.code LIKE 'suppliers_payment%';
```

### 2. 创建付款失败

**原因**: 对账单状态不正确或金额超限

**解决**:
```sql
-- 检查对账单状态
SELECT * FROM supplier_settlements WHERE status = 'confirmed';
```

### 3. 审批按钮不显示

**原因**: 当前用户无审批权限

**解决**: 分配 `suppliers_payment:approve` 权限

### 4. 付款金额显示异常

**原因**: 数据类型或精度问题

**解决**: 确保数据库字段为 `DECIMAL(12,2)`

## 维护建议

### 1. 定期备份
- 备份 `supplier_payments` 表
- 备份 `supplier_settlements` 表
- 备份 `supplier_accounts` 表

### 2. 数据校验
```sql
-- 校验付款金额与对账单金额
SELECT
  sp.payment_no,
  sp.payment_amount,
  ss.total_amount,
  ss.settled_amount,
  ss.remaining_amount
FROM supplier_payments sp
LEFT JOIN supplier_settlements ss ON sp.settlement_id = ss.id
WHERE sp.settlement_id IS NOT NULL
  AND sp.payment_amount > ss.remaining_amount;
```

### 3. 性能优化
- 定期清理历史数据
- 添加必要的索引
- 优化查询语句

## 技术支持

如有问题,请检查:
1. 后端日志: `/backend/logs/`
2. 前端控制台: 浏览器开发者工具
3. 数据库日志: MySQL慢查询日志

## 更新日志

### v1.0.0 (2025-01-08)
- ✅ 完成数据库表结构设计
- ✅ 完成后端API开发
- ✅ 完成前端页面开发
- ✅ 完成权限配置
- ✅ 完成路由注册
- 🔄 待测试验证
