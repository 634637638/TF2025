# customers 表结构说明

> TF2025 客户管理数据表 - 完整字段定义与备注

## 表概述

`customers` 表用于存储客户基本信息、联系方式、会员等级、消费统计等核心数据，支持个人客户和企业客户两种类型。

---

## 完整字段列表

### 1. 主键与基础字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `id` | INT | 是 | AUTO_INCREMENT | 客户唯一标识ID，主键 |
| `name` | VARCHAR(100) | 是 | - | 客户姓名/企业名称 |
| `phone` | VARCHAR(20) | 是 | - | 联系电话，主要联系方式 |
| `email` | VARCHAR(100) | 否 | NULL | 电子邮箱（也用作Apple ID存储） |

### 2. 身份与档案字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `id_card` | VARCHAR(20) | 否 | NULL | 身份证号（加密存储） |
| `gender` | ENUM('male','female','other') | 否 | NULL | 性别：男/女/其他 |
| `birthday` | DATE | 否 | NULL | 出生日期（用于生日营销） |
| `member_number` | VARCHAR(50) | 否 | NULL | 会员编号（格式：TF00001） |

### 3. 地址信息字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `address` | VARCHAR(255) | 否 | NULL | 详细地址 |
| `city` | VARCHAR(50) | 否 | NULL | 城市 |
| `province` | VARCHAR(50) | 否 | NULL | 省份 |
| `postal_code` | VARCHAR(10) | 否 | NULL | 邮政编码 |

### 4. 社交账号字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `wechat` | VARCHAR(50) | 否 | NULL | 微信号 |
| `qq` | VARCHAR(20) | 否 | NULL | QQ号 |
| `apple_id` | VARCHAR(100) | 否 | NULL | Apple ID（用于iCloud云服务） |

### 5. 客户分类字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `customer_type` | ENUM('individual','enterprise') | 否 | 'individual' | 客户类型：个人/企业 |
| `vip_level` | ENUM('normal','silver','gold','platinum') | 否 | 'normal' | VIP等级：普通/银卡/金卡/白金 |
| `blacklist` | TINYINT | 是 | 0 | 黑名单标识：0=正常，1=黑名单 |

### 6. 财务统计字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `balance` | DECIMAL(10,2) | 是 | 0.00 | 账户余额（预存款） |
| `points` | INT | 是 | 0 | 会员积分 |
| `total_spent` | DECIMAL(12,2) | 是 | 0.00 | 累计消费金额 |
| `purchase_count` | INT | 是 | 0 | 购买次数（订单数） |
| `credit_rating` | ENUM('excellent','good','average','poor') | 否 | 'good' | 信用评级 |

### 7. 业务关联字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `preferred_contact` | ENUM('phone','wechat','qq','email') | 否 | 'phone' | 首选联系方式 |
| `source` | VARCHAR(50) | 否 | NULL | 客户来源（门店/线上/推荐等） |
| `tags` | VARCHAR(255) | 否 | NULL | 客户标签（JSON格式存储） |

### 8. 时间字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `register_date` | DATE | 否 | NULL | 注册日期 |
| `last_purchase_date` | DATETIME | 否 | NULL | 最后购买时间 |
| `created_at` | DATETIME | 是 | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

### 9. 状态与备注字段

| 字段名 | 类型 | 是否必填 | 默认值 | 备注 |
|--------|------|----------|--------|------|
| `status` | TINYINT | 是 | 1 | 状态：1=正常，0=禁用 |
| `remarks` | TEXT | 否 | NULL | 备注信息 |
| `notes` | TEXT | 否 | NULL | 额外备注（与remarks二选一使用） |

---

## 索引说明

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| PRIMARY | `id` | 主键 | 主键索引 |
| `idx_phone` | `phone` | 普通索引 | 手机号查询优化 |
| `idx_member_number` | `member_number` | 普通索引 | 会员号查询优化 |
| `idx_customer_type` | `customer_type` | 普通索引 | 客户类型筛选 |
| `idx_vip_level` | `vip_level` | 普通索引 | VIP等级筛选 |
| `idx_status` | `status` | 普通索引 | 状态筛选 |
| `idx_created_at` | `created_at` | 普通索引 | 按创建时间排序 |

---

## 枚举值说明

### customer_type（客户类型）
| 值 | 说明 |
|----|------|
| `individual` | 个人客户 |
| `enterprise` | 企业客户 |

### vip_level（VIP等级）
| 值 | 说明 | 折扣 |
|----|------|------|
| `normal` | 普通会员 | 无折扣 |
| `silver` | 银卡会员 | 5%折扣 |
| `gold` | 金卡会员 | 10%折扣 |
| `platinum` | 白金会员 | 15%折扣 |

### gender（性别）
| 值 | 说明 |
|----|------|
| `male` | 男 |
| `female` | 女 |
| `other` | 其他 |

### credit_rating（信用评级）
| 值 | 说明 |
|----|------|
| `excellent` | 优秀（信用极好） |
| `good` | 良好（默认值） |
| `average` | 一般 |
| `poor` | 较差 |

### preferred_contact（首选联系方式）
| 值 | 说明 |
|----|------|
| `phone` | 电话（默认） |
| `wechat` | 微信 |
| `qq` | QQ |
| `email` | 邮箱 |

---

## 使用场景与业务规则

### 1. 客户创建（销售系统）
```javascript
// 从销售页面创建客户
{
  name: '张三',                    // 必填
  phone: '13800138000',           // 必填
  apple_id: 'test@icloud.com',    // 可选
  email: 'test@icloud.com',       // 可选（与apple_id同步）
  customer_type: 'individual',    // 默认个人
  vip_level: 'normal',            // 默认普通
  source: 'sales'                 // 来源标记
}
```

### 2. 会员编号生成规则
```javascript
// 格式：TF + 5位数字
// 示例：TF00001, TF00002, ...
const memberNumber = 'TF' + Date.now().toString().slice(-5)
```

### 3. 积分与消费统计
```javascript
// 每次销售成功后更新
customer.purchase_count += 1          // 订单数+1
customer.total_spent += orderAmount   // 累计消费
customer.points += Math.floor(orderAmount) // 消费1元=1积分
customer.last_purchase_date = new Date()
```

### 4. 黑名单管理
```javascript
// blacklist = 1 的客户不能：
// - 参与会员活动
// - 享受分期付款
// - 使用优惠券
```

---

## 关联表关系

| 关联表 | 关联字段 | 关系类型 | 说明 |
|--------|----------|----------|------|
| `phones` | `customer_id` | 一对多 | 一个客户可购买多台手机 |
| `sales` | `customer_id` | 一对多 | 一个客户可有多个销售记录 |
| `repairs` | `customer_id` | 一对多 | 一个客户可有多个维修记录 |
| `rentals` | `customer_id` | 一对多 | 一个客户可租赁多个设备 |

---

## 数据安全规范

### 敏感字段处理
- `id_card`：身份证号需要加密存储
- `phone`：手机号脱敏显示（138****8000）
- `apple_id`：Apple ID属于隐私信息，需权限控制访问

### 软删除机制
```sql
-- 不使用物理删除，改用状态标记
UPDATE customers SET status = 0 WHERE id = ?
-- 查询时默认只返回 status = 1 的记录
```

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2024-01-01 | 初始版本 |
| v1.1 | 2024-06-15 | 新增 apple_id 字段支持iCloud服务 |
| v1.2 | 2025-01-20 | 新增信用评级、标签字段 |

---

## 相关文件

- **后端仓储**：[customer.repository.js](../../backend/src/repositories/customer.repository.js)
- **后端路由**：[customers.js](../../backend/src/routes/customers.js)
- **前端页面**：[CustomersView.vue](../../frontend/src/views/customers/CustomersView.vue)
- **类型定义**：[types/index.ts](../../frontend/src/types/index.ts)
