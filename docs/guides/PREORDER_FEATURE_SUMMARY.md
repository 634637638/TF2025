# 新品预定功能实现总结

## 功能概述

新品预定功能已完整实现，包含以下核心功能：

1. **创建预定单** - 客户预定新款手机并支付定金
2. **智能匹配** - 入库时自动匹配待分配的预定单
3. **预定交付** - 匹配后支付尾款并完成出库
4. **预定管理** - 查看和管理所有预定单

## 文件结构

### 后端文件

```
backend/
├── src/routes/preorders.js                    # 预定管理路由
├── src/routes/index.js                        # 已注册预定路由
├── src/routes/stock-in.js                     # 已修改，支持自动匹配
└── database/migrations/
    ├── create_preorders_table.sql             # 新建表结构（参考）
    └── alter_preorders_table.sql              # 基于现有表的升级脚本
```

### 前端文件

```
frontend/
├── src/api/preorder.ts                        # 预定 API 服务
├── src/config/modules.ts                      # 已添加 PREORDERS 模块
├── src/router/index.ts                       # 已添加预定路由
└── src/views/preorders/
    ├── PreordersView.vue                      # 主页面（3个TAB）
    └── components/
        ├── CreatePreorderModal.vue            # 新增预定模态框
        ├── QuickAddCustomerModal.vue          # 快速新增客户
        ├── EditPreorderModal.vue              # 编辑预定模态框
        └── DeliverConfirmModal.vue            # 交付确认模态框
```

## 数据库表结构

### preorders 表（云端已存在）

现有字段：
- `id` - 主键
- `preorder_number` - 预定单号（PR + 时间戳）
- `customer_id` - 客户ID
- `phone_model` - 预定机型
- `color` - 颜色
- `storage` - 存储容量
- `expected_arrival` - 预计到货日期
- `expected_price` - 预期价格
- `deposit` - 押金
- `advance_payment` - 定金
- `actual_model` - 实际机型
- `imei` - IMEI号
- `arrival_date` - 实际到货日期
- `actual_price` - 实际价格
- `status` - 状态 (pending/matched/delivered/cancelled)
- `operator_id` - 操作员ID
- `remarks` - 备注
- `cancelled_at` - 取消时间
- `created_at` - 创建时间
- `updated_at` - 更新时间

### phones 表（需添加字段）

- `preorder_id` - 关联的预定单ID
- `is_preordered` - 是否已预定 (0/1)

## API 接口

### 预定管理接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/preorders` | 获取预定单列表 | preorders:view |
| GET | `/api/preorders/stats` | 获取统计数据 | preorders:view |
| GET | `/api/preorders/matchable` | 查找可匹配预定单 | preorders:match |
| GET | `/api/preorders/:id` | 获取预定单详情 | preorders:view |
| POST | `/api/preorders` | 创建预定单 | preorders:create |
| PUT | `/api/preorders/:id/match` | 匹配预定单 | preorders:match |
| PUT | `/api/preorders/:id/deliver` | 完成交付 | preorders:complete |
| PUT | `/api/preorders/:id/cancel` | 取消预定单 | preorders:cancel |
| PUT | `/api/preorders/:id` | 更新预定单 | preorders:edit |
| DELETE | `/api/preorders/:id` | 删除预定单 | preorders:delete |

## 功能流程

### 1. 创建预定单流程

```
客户到店 → 选择商品规格 → 支付定金 → 生成预定单 → 状态：pending
```

**前端页面**：
- 点击"新建预定单"按钮
- 选择客户（支持快速新增）
- 输入预定机型、颜色、存储容量
- 输入定金金额（必填）
- 可选：输入约定价格、预计到货日期
- 提交创建

### 2. 入库匹配流程

```
新手机入库 → 系统自动查找匹配预定单 → 显示可匹配列表 → 选择匹配 → 状态：matched
```

**后端逻辑**：
- 在 `stock-in.js` 的入库成功后
- 根据品牌、型号、颜色、内存查找待匹配预定单
- 将匹配的预定单返回给前端
- 前端可选择匹配

### 3. 预定交付流程

```
匹配成功 → 客户支付尾款 → 确认交付 → 状态：delivered → 生成销售记录
```

**前端操作**：
- 在"已预定"TAB找到已匹配的预定单
- 点击"交付"按钮
- 确认/修改实际销售价格
- 提交完成交付
- 系统自动更新手机状态为已售出

### 4. 预定管理界面

**3个TAB标签页**：

1. **新增预定** (TAB: new)
   - 显示所有待匹配的预定单 (status=pending)
   - 可以编辑预定信息
   - 可以取消预定

2. **已预定** (TAB: matched)
   - 显示已匹配和已取消的预定单
   - 子筛选：全部 / 已匹配 / 已取消
   - 已匹配的可以完成交付
   - 已取消的可以删除

3. **已交付** (TAB: delivered)
   - 显示所有已交付的预定单 (status=delivered)
   - 显示完整的交易信息

## 权限配置

在 `modules.ts` 中添加的权限：

```typescript
PREORDERS: {
  id: 'preorders',
  key: 'preorders_preordersview',
  name: '预定管理',
  permissions: ['view', 'create', 'edit', 'delete', 'match', 'complete', 'cancel', 'export', 'menu_view']
}
```

**权限说明**：
- `view` - 查看预定单
- `create` - 创建预定单
- `edit` - 编辑预定单
- `delete` - 删除预定单
- `match` - 匹配预定单
- `complete` - 完成交付
- `cancel` - 取消预定单
- `export` - 导出数据
- `menu_view` - 菜单可见性

## 使用示例

### 1. 创建预定单

```typescript
import { preorderApi } from '@/api/preorder'

const preorder = await preorderApi.createPreorder({
  customer_id: 1,
  phone_model: 'iPhone 15 Pro',
  color: '原色钛金属',
  storage: '256GB',
  expected_arrival: '2025-02-01',
  expected_price: 8999,
  advance_payment: 1000,
  remarks: '客户要求到货后通知'
})
```

### 2. 查找可匹配预定单

```typescript
const matchable = await preorderApi.getMatchablePreorders({
  phone_model: 'iPhone 15 Pro',
  color: '原色钛金属',
  storage: '256GB'
})
```

### 3. 匹配预定单

```typescript
await preorderApi.matchPreorder(preorderId, {
  phone_id: 123,
  imei: '123456789012345',
  actual_price: 8999
})
```

### 4. 完成交付

```typescript
await preorderApi.deliverPreorder(preorderId, {
  actual_price: 8999,
  notes: '尾款已付清'
})
```

## 注意事项

1. **数据库兼容性**
   - 云端已存在 preorders 表
   - 使用现有字段结构
   - 不需要创建额外的审计字段

2. **状态流转**
   - pending → matched → delivered（正常流程）
   - pending/matched → cancelled（取消流程）
   - 只有 cancelled 状态可以删除

3. **尾款计算**
   - 尾款 = 约定价格 - 定金
   - 可以在交付时调整实际价格
   - 最终价格以交付时确认为准

4. **权限要求**
   - 需要在后台权限管理中添加 preorders 模块
   - 为不同角色分配相应权限

## 测试步骤

1. **创建预定单**
   - 访问 /preorders 页面
   - 点击"新建预定单"
   - 填写完整信息并提交
   - 验证预定单出现在"新增预定"TAB

2. **入库匹配**
   - 进行商品入库操作
   - 检查是否返回可匹配的预定单
   - 选择匹配并确认
   - 验证预定单状态变为 matched

3. **完成交付**
   - 在"已预定"TAB找到已匹配预定单
   - 点击"交付"
   - 确认价格并提交
   - 验证预定单出现在"已交付"TAB
   - 验证对应手机状态变为已售出

## 后续优化建议

1. **消息通知**
   - 匹配成功后通知客户
   - 到货提醒

2. **报表功能**
   - 预定统计报表
   - 定金收取统计
   - 交付周期分析

3. **批量操作**
   - 批量匹配
   - 批量取消

4. **移动端适配**
   - 响应式布局优化
   - 移动端专用组件
