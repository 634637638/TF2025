# 智能员工匹配功能说明

## 功能概述

数据导入功能现已支持**智能员工匹配和自动创建**，Excel 中的"入库员"和"销售员"列可以：
1. 自动匹配现有员工（支持姓名和用户名）
2. 自动创建不存在的员工（无需手动添加）

## 使用方式

### Excel 表头

| 列名 | 说明 | 示例 |
|------|------|------|
| 入库员 | 操作员工姓名 | 刘渊、黄玉婷、张三 |
| 销售员 | 操作员工姓名 | 刘渊、黄玉婷、张三 |

### 匹配规则

#### 1. 优先级匹配
```
Excel 值 → 映射缓存 → 数据库查询
  "刘渊"   →   检查 Map   →  WHERE name='刘渊' OR username='刘渊'
```

**匹配成功** → 返回现有员工 ID
**匹配失败** → 自动创建新员工

#### 2. 支持多种输入格式
- ✅ **姓名**（推荐）: `"刘渊"`, `"黄玉婷"`
- ✅ **用户名**（兼容）: `"3333"`, `"10002"`
- ✅ **空值**: `""` 或空白 → 返回 `null`（不创建）

#### 3. 自动创建新员工

当 Excel 中的员工不存在时，系统会自动创建：

| 字段 | 值 | 说明 |
|------|------|------|
| name | Excel 中的值 | 如 "张三" |
| username | 自动生成 | name 转小写，去除空格 |
| password | `123456` | bcrypt 加密 |
| role_id | `employee` 角色 | 从 roles 表查询 |
| status | `1` | 启用状态 |

**用户名生成规则：**
- 基础: `name.toLowerCase().replace(/\s+/g, '')`
- 重复: 自动添加数字后缀 `2, 3, 4...`
  - "张三" → `zhangsan`
  - 再次 "张三" → `zhangsan2`
  - 再次 "张三" → `zhangsan3`

## 代码实现

### 修改的文件
`backend/src/services/data-import.service.js`

### 关键方法

#### 1. `getOrCreateUser(connection, operatorName, map)`
```javascript
/**
 * 智能获取或创建员工
 * @param connection - 数据库连接
 * @param operatorName - Excel 中的员工姓名
 * @param map - 用户映射缓存 (name → id)
 * @returns 用户ID或null
 */
async getOrCreateUser(connection, operatorName, map) {
  // 1. 检查映射缓存
  if (map.has(operatorName)) return map.get(operatorName);

  // 2. 查询数据库（支持 name 和 username）
  const [existingUsers] = await connection.execute(
    'SELECT id, name, username FROM users WHERE name = ? OR username = ?',
    [operatorName, operatorName]
  );

  if (existingUsers.length > 0) {
    map.set(operatorName, existingUsers[0].id);
    return existingUsers[0].id;
  }

  // 3. 创建新用户
  // - 生成唯一 username
  // - 设置默认密码
  // - 分配 employee 角色
  // - 插入数据库
  // - 更新映射缓存

  return newUserId;
}
```

#### 2. `buildDataMaps(connection, data)`
```javascript
// 获取现有员工（支持多种匹配方式）
const [users] = await connection.execute('SELECT id, name, username FROM users');
users.forEach(item => {
  // name 作为主要匹配键
  maps.users.set(item.name, item.id);
  // username 作为备用匹配键（支持向后兼容）
  if (item.username && item.username !== item.name) {
    maps.users.set(item.username, item.id);
  }
});
```

#### 3. `importRow(connection, row, maps, strategy, user)`
```javascript
// 智能获取或创建操作员ID（替换原来的 maps.users.get()）
const inventoryOperatorId = await this.getOrCreateUser(connection, row['入库员'], maps.users);
const saleOperatorId = await this.getOrCreateUser(connection, row['销售员'], maps.users);
```

## 使用示例

### Excel 数据示例

| IMEI | 品牌 | 型号 | ... | 入库员 | 销售员 | 客户姓名 | 手机号 |
|------|------|------|-----|--------|--------|----------|--------|
| 865676036191642 | 苹果 | iPhone 15 Pro | ... | 刘渊 | 黄玉婷 | 张三 | 13800138000 |
| 865676036191643 | 华为 | Mate 60 Pro | ... | 新员工A | 新员工B | 李四 | 13900139000 |

### 导入结果

1. **第一行**:
   - 入库员 "刘渊" → 匹配到 ID=2
   - 销售员 "黄玉婷" → 匹配到 ID=1

2. **第二行**:
   - 入库员 "新员工A" → 创建新用户（username=`新员工a`, password=`123456`）
   - 销售员 "新员工B" → 创建新用户（username=`新员工b`, password=`123456`）

## 测试方法

运行测试脚本：
```bash
cd /Users/imac/Desktop/webtset/TF2025/backend
node test-smart-user-matching.js
```

测试内容：
- ✅ 匹配现有用户（通过 name）
- ✅ 匹配现有用户（通过 username 兼容）
- ✅ 自动创建新用户
- ✅ 用户名重复自动添加后缀
- ✅ 空值处理

## 注意事项

1. **安全性**: 新创建的员工默认密码为 `123456`，首次登录后建议修改
2. **权限**: 新员工默认分配 `employee` 角色
3. **性能**: 使用 Map 缓存机制，避免重复查询数据库
4. **兼容性**: 同时支持 name 和 username 匹配，向后兼容旧数据

## 更新日志

- **2025-01-09**: 新增智能员工匹配功能
  - 支持 name 和 username 双重匹配
  - 自动创建不存在的员工
  - 用户名重复自动添加后缀
  - 默认密码和角色配置
