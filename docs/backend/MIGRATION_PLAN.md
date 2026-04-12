# 数据迁移方案 - 旧系统到新系统

## 一、迁移概述

本文档描述将旧系统 `t_info` 表数据迁移到新数据库 TF2025 的完整方案。

### 迁移功能特点

1. **自动创建缺失数据**: 自动创建新数据库中不存在的颜色、内存、供应商、品牌、型号、店铺等参考数据
2. **重复数据规避**: 使用 `ON DUPLICATE KEY UPDATE` 和 `INSERT IGNORE` 避免重复数据
3. **自动生成会员号**: 为迁移的客户自动生成会员号（格式：M + 日期 + 4位随机数）
4. **自动创建用户**: 为旧数据中的销售员和入库员自动创建用户账号（默认密码123456）
5. **完整事务支持**: 所有迁移操作在事务中执行，失败自动回滚
6. **详细日志报告**: 记录每个步骤的迁移数量、跳过数量和错误信息

### 旧表结构（t_info）
```sql
CREATE TABLE `t_info` (
  `id` int NOT NULL,
  `supplier` int DEFAULT NULL,           -- 供应商ID
  `brand` int DEFAULT NULL,              -- 品牌ID
  `model` int DEFAULT NULL,              -- 型号ID
  `imei` varchar(255) DEFAULT NULL,      -- IMEI串码
  `color` varchar(255) DEFAULT NULL,     -- 颜色名称
  `memory` varchar(255) DEFAULT NULL,    -- 内存大小
  `salesprice` int DEFAULT NULL,         -- 销售价格
  `nickname` varchar(255) DEFAULT NULL,  -- 销售员名称
  `inventorydate` date DEFAULT NULL,     -- 入库日期
  `salesdate` date DEFAULT NULL,         -- 销售日期
  `shop` int DEFAULT NULL,               -- 店铺ID
  `status` tinyint(1) DEFAULT '0',       -- 0=已售, 1=在库
  `user` varbinary(255) DEFAULT NULL,    -- 客户姓名（hex编码）
  `telephone` varchar(255) DEFAULT NULL, -- 客户手机号
  `notes` varchar(255) DEFAULT NULL,     -- 备注
  `sn` varchar(255) DEFAULT NULL,        -- 序列号
  `paytype` varchar(255) DEFAULT NULL,   -- 支付方式
  `appleid` varchar(255) DEFAULT NULL,   -- Apple ID
  `inventoryprice` int DEFAULT NULL,     -- 入库价格
  `mobile` int NOT NULL DEFAULT '0',     -- 运营商？
  `sort` bigint NOT NULL DEFAULT '0',    -- 排序
  `recorder` varchar(255) DEFAULT NULL,  -- 入库员
  `Battery` tinyint DEFAULT NULL,        -- 电池情况
  `payment_status` tinyint(1) DEFAULT '0', -- 支付状态
  `payment_date` datetime DEFAULT NULL   -- 支付日期
);
```

## 二、字段映射关系

### 2.1 客户数据映射（customers 表）

| 旧字段 | 新字段 | 说明 | 转换规则 |
|--------|--------|------|----------|
| user | name | 客户姓名 | 需要hex解码 |
| telephone | phone | 客户手机号 | 直接映射 |
| appleid | apple_id | Apple ID | 直接映射 |

**注意**：
- 需要提取唯一组合（user + telephone）创建客户档案
- 重复的客户信息只创建一次，后续关联已存在的客户ID

### 2.2 手机库存映射（phones 表）

| 旧字段 | 新字段 | 说明 | 转换规则 |
|--------|--------|------|----------|
| imei | imei | IMEI串码 | 直接映射 |
| sn | serial_number | 序列号 | 直接映射 |
| inventoryprice | purchase_cost | 入库成本 | 直接映射 |
| salesprice | sale_price | 销售价格 | 直接映射 |
| inventorydate | Inventorytime | 入库时间 | 直接映射 |
| salesdate | salestime | 销售时间 | 直接映射 |
| notes | remarks | 备注 | 直接映射 |
| status | status | 状态 | 0→'sold', 1→'in_stock' |
| brand | brand_id | 品牌ID | 需要映射 |
| model | model_id | 型号ID | 需要映射 |
| shop | store_id | 店铺ID | 需要映射 |
| supplier | supplier_id | 供应商ID | 需要映射 |
| color | color_id | 颜色ID | 按名称匹配 |
| memory | memory_id | 内存ID | 按大小匹配 |
| recorder | inventory_operator_id | 入库员ID | 按姓名查找users表 |
| nickname | sale_operator_id | 销售员ID | 按姓名查找users表 |

## 三、迁移步骤

### 迁移脚本位置
`/backend/migrate-data-complete.js`

### 使用方法
1. 修改脚本中的 `oldDatabase` 配置为旧数据库名称
2. 运行: `node migrate-data-complete.js`

### 步骤详解

#### 步骤 1: 迁移供应商
- 从 `t_supplier` 表读取供应商数据
- 检查新数据库是否已存在同名供应商
- 不存在则创建，存在则跳过并建立ID映射

#### 步骤 2: 迁移品牌
- 从 `t_brand` 表读取品牌数据
- 使用 `ON DUPLICATE KEY UPDATE` 避免重复

#### 步骤 3: 迁移型号
- 从 `t_model` 表读取型号数据
- 关联新品牌ID
- 品牌和型号组合唯一，避免重复

#### 步骤 4: 迁移店铺
- 从 `t_shop` 表读取店铺数据
- 按店铺名称去重

#### 步骤 5: 创建缺失的颜色和内存
- 从 `t_info` 表提取所有唯一颜色和内存值
- 与新数据库现有数据对比
- 自动创建缺失的颜色和内存记录

#### 步骤 6: 创建缺失的用户
- 从 `t_info` 表提取所有唯一的销售员（nickname）和入库员（recorder）
- 与现有用户对比
- 为缺失的用户自动创建账号：
  - 用户名格式：`user_时间戳_随机数`
  - 默认密码：`123456`
  - 状态：启用

#### 步骤 7: 迁移客户数据
- 从 `t_info` 表提取唯一客户组合（user + telephone）
- 解码 varbinary 类型的客户姓名
- **自动生成会员号**：`M + 年月日 + 4位随机数`（如：M202501041234）
- 使用手机号去重
- 创建映射表用于后续关联

#### 步骤 8: 迁移手机数据
- 从 `t_info` 表读取所有手机记录
- **允许同一 IMEI 多次记录**（无论新机还是二手机）
- 在库手机检查：IMEI + 入库日期
- 已售手机检查：IMEI + 入库日期 + 销售日期 + 客户
- 映射所有参考ID（品牌、型号、颜色、内存、店铺、供应商等）
- 映射用户ID（销售员、入库员）
- 转换状态：0 → 'sold', 1 → 'in_stock'
- 转换二手机标记：mobile=0 → is_new=1

#### 步骤 9: 创建销售记录
- 为所有已售手机创建销售记录
- 关联客户ID
- 映射支付方式
- 记录销售日期

#### 步骤 10: 数据验证
- 统计迁移后的数据量
- 对比旧数据库记录数
- 显示手机状态分布

## 四、重复数据处理策略

### 1. 供应商、品牌、型号、店铺
使用 `ON DUPLICATE KEY UPDATE`，按名称唯一索引去重

### 2. 颜色、内存
- 先从 `t_info` 提取所有唯一值
- 与现有数据对比
- 只创建缺失的记录

### 3. 客户
- 使用 `INSERT IGNORE` 配合手机号唯一索引
- 重复手机号自动跳过，使用现有客户ID

### 4. 手机（允许同一 IMEI 多次记录）
- **同一 IMEI 可以有多条记录**（完整记录手机生命周期）
- **在库手机**（status=1）：只有当 IMEI + 入库日期 都相同时才算重复
- **已售手机**（status=0）：只有当 IMEI + 入库日期 + 销售日期 + 客户 都相同时才算重复
- 支持多种场景：
  - 新机首次销售
  - 二手机回收后再销售
  - 同一手机多次回收、多次销售
  - 同一手机销售给不同客户

**示例场景**：
```
IMEI: 123456789012345（全新机）
- 2024-01-01 入库，2024-01-05 销售给客户A → 第1条记录
- 2024-03-10 回收入库（变成二手机）     → 第2条记录
- 2024-03-15 销售给客户B              → 第3条记录
- 2024-06-20 再次回收                → 第4条记录
- 2024-06-25 再次销售给客户C          → 第5条记录
```

## 五、数据映射详情

### 会员号生成规则
```javascript
// 格式：M + 年月日 + 4位随机数
// 示例：M202501041234
const memberNumber = 'M' + '20250104' + '1234';
```

### 用户账号生成规则
```javascript
// 格式：user_时间戳_随机数
// 示例：user_1704345600000_5678
const username = 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
// 默认密码：123456
```

### 支付方式映射
| 旧值 | 新值 |
|------|------|
| 现金 | cash |
| 刷卡 | card |
| 转账 | transfer |
| 微信 | mobile |
| 支付宝 | mobile |

### 状态映射
| 旧值 | 新值 |
|------|------|
| 0 | sold |
| 1 | in_stock |

### 二手机标记映射
| 旧值 | 新值 |
|------|------|
| mobile = 0 | is_new = 1 (全新) |
| mobile != 0 | is_new = 0 (二手机) |

## 六、旧数据迁移（原步骤 1：创建临时映射表）
```sql
-- 创建客户ID映射表
CREATE TABLE IF NOT EXISTS customer_mapping (
  old_user VARBINARY(255),
  old_telephone VARCHAR(255),
  new_customer_id INT,
  PRIMARY KEY (old_user, old_telephone)
);
```

### 步骤 2：迁移客户数据
```sql
-- 1. 提取唯一客户组合
INSERT INTO customers (
  name,
  phone,
  apple_id,
  customer_type,
  vip_level,
  status,
  source,
  created_at,
  updated_at
)
SELECT DISTINCT
  CONVERT(user USING utf8),
  telephone,
  appleid,
  'individual',
  'normal',
  1,
  'legacy_migration',
  NOW(),
  NOW()
FROM old_database.t_info
WHERE user IS NOT NULL
  AND telephone IS NOT NULL
  AND telephone != ''
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- 2. 创建映射关系
INSERT INTO customer_mapping (old_user, old_telephone, new_customer_id)
SELECT
  ti.user,
  ti.telephone,
  c.id
FROM old_database.t_info ti
INNER JOIN customers c ON c.phone = ti.telephone
WHERE ti.user IS NOT NULL
  AND ti.telephone IS NOT NULL;
```

### 步骤 3：迁移手机数据
```sql
INSERT INTO phones (
  imei,
  serial_number,
  purchase_cost,
  sale_price,
  Inventorytime,
  salestime,
  remarks,
  status,
  brand_id,
  model_id,
  color_id,
  memory_id,
  store_id,
  supplier_id,
  inventory_operator_id,
  sale_operator_id,
  is_new,
  quality_grade,
  created_at,
  updated_at
)
SELECT
  ti.imei,
  ti.sn,
  ti.inventoryprice,
  ti.salesprice,
  ti.inventorydate,
  ti.salesdate,
  ti.notes,
  CASE ti.status
    WHEN 0 THEN 'sold'
    WHEN 1 THEN 'in_stock'
    ELSE 'in_stock'
  END,
  ti.brand,
  ti.model,
  (SELECT id FROM colors WHERE name = ti.color LIMIT 1),
  (SELECT id FROM memories WHERE size = ti.memory LIMIT 1),
  ti.shop,
  ti.supplier,
  (SELECT id FROM users WHERE name = ti.recorder LIMIT 1),
  (SELECT id FROM users WHERE name = ti.nickname LIMIT 1),
  CASE WHEN ti.mobile = 0 THEN 1 ELSE 0 END,  -- 假设mobile=0是全新机
  CASE ti.Battery
    WHEN NULL THEN 'A'
    ELSE 'B'
  END,
  NOW(),
  NOW()
FROM old_database.t_info ti;
```

### 步骤 4：为已售手机创建销售记录
```sql
INSERT INTO sales (
  phone_id,
  customer_id,
  sale_type,
  operator_id,
  payment_method,
  sale_date,
  created_at,
  updated_at
)
SELECT
  p.id,
  cm.new_customer_id,
  'retail',
  p.sale_operator_id,
  CASE ti.paytype
    WHEN '现金' THEN 'cash'
    WHEN '刷卡' THEN 'card'
    WHEN '转账' THEN 'transfer'
    ELSE 'cash'
  END,
  ti.salesdate,
  NOW(),
  NOW()
FROM old_database.t_info ti
INNER JOIN phones p ON p.imei = ti.imei
LEFT JOIN customer_mapping cm ON cm.old_user = ti.user AND cm.old_telephone = ti.telephone
WHERE ti.status = 0  -- 已售
  AND ti.salesdate IS NOT NULL;
```

## 四、数据验证

### 4.1 迁移前后数据量对比
```sql
-- 旧系统记录数
SELECT COUNT(*) as old_total FROM old_database.t_info;
SELECT COUNT(*) as old_sold FROM old_database.t_info WHERE status = 0;
SELECT COUNT(*) as old_in_stock FROM old_database.t_info WHERE status = 1;

-- 新系统记录数
SELECT COUNT(*) as new_phones FROM phones;
SELECT COUNT(*) as new_sold FROM phones WHERE status = 'sold';
SELECT COUNT(*) as new_in_stock FROM phones WHERE status = 'in_stock';

-- 客户数对比
SELECT COUNT(DISTINCT user) as old_customers FROM old_database.t_info WHERE user IS NOT NULL;
SELECT COUNT(*) as new_customers FROM customers WHERE source = 'legacy_migration';
```

### 4.2 数据完整性检查
```sql
-- 检查IMEI是否完整迁移
SELECT COUNT(*) FROM phones WHERE imei IN (SELECT imei FROM old_database.t_info);

-- 检查销售记录是否完整
SELECT COUNT(*) FROM sales WHERE sale_date >= (SELECT MIN(salesdate) FROM old_database.t_info);
```

## 五、注意事项

### 5.1 外键约束处理
1. 确保所有参考数据（brands, models, colors, memories, stores, suppliers）已存在
2. 如遇到不存在的参考ID，设置为NULL或默认值
3. 记录无法匹配的数据到日志表

### 5.2 数据清洗
1. `user` 字段是 varbinary 类型，需要使用 `CONVERT(user USING utf8)` 解码
2. 日期字段可能存在无效值，需要过滤
3. 价格字段为int类型，新系统使用decimal，直接转换
4. 清理重复数据

### 5.3 回滚方案
```sql
-- 如需回滚，删除迁移的数据
DELETE FROM sales WHERE customer_id IN (SELECT id FROM customers WHERE source = 'legacy_migration');
DELETE FROM phones WHERE created_at >= '迁移开始时间';
DELETE FROM customers WHERE source = 'legacy_migration';
DROP TABLE customer_mapping;
```

## ��、执行检查清单

- [ ] 备份新数据库
- [ ] 确认旧数据库连接配置
- [ ] 检查参考数据完整性
- [ ] 在测试环境预演迁移
- [ ] 记录迁移开始时间
- [ ] 执行迁移脚本
- [ ] 验证数据完整性
- [ ] 检查外键约束
- [ ] 测试应用功能
- [ ] 记录迁移结束时间
- [ ] 清理临时映射表（可选）
