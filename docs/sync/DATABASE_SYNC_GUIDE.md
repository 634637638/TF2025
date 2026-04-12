# 跨数据库数据同步功能使用指南

## 功能概述

远程数据同步功能允许您直接连接其他MySQL数据库，自动匹配数据并执行同步操作。支持多种同步策略，可以灵活处理数据迁移和更新需求。

## 核心特性

### 1. 多数据库连接管理
- 同时连接多个外部MySQL数据库
- 安全的连接存储和管理
- 实时连接状态监控

### 2. 智能表映射
- 自动读取表结构和字段信息
- 智能字段匹配建议
- 可视化配置映射关系

### 3. 灵活的同步策略
- **insert**: 只插入新数据
- **update**: 只更新已存在的数据
- **upsert**: 存在则更新，不存在则插入（推荐）
- **replace**: 清空目标表后重新导入

### 4. 数据预检查
- 分析数据匹配情况
- 统计新增和更新数据量
- 展示匹配示例，便于验证

### 5. 实时进度跟踪
- 同步进度实时显示
- 详细的统计信息
- 错误处理和日志

## 使用步骤

### 第一步：连接外部数据库

1. 访问 `数据优化 > 远程数据同步`
2. 填写外部数据库连接信息：
   - **主机地址**: 数据库服务器地址（如：192.168.1.100）
   - **端口**: MySQL端口（默认3306）
   - **用户名**: 数据库用户名
   - **密码**: 数据库密码
   - **数据库名**: 要连接的数据库名称
3. 点击"连接数据库"按钮
4. 连接成功后，数据库会显示在已连接列表中

### 第二步：选择源表和目标表

1. **左侧列表**: 外部数据库的表列表
2. **右侧列表**: 本地数据库的表列表
3. 使用搜索框快速查找表名
4. 分别选择要同步的源表和目标表

### 第三步：配置字段映射

1. 系统会自动显示源表的所有字段
2. 点击"智能匹配"按钮，系统会自动建议字段映射关系
3. 手动调整映射关系：
   - 在"目标字段"列选择对应的字段
   - 选择"（忽略）"表示不导入该字段
4. 配置同步选项：
   - **同步模式**: 选择数据处理方式
   - **匹配字段**: 选择用于判断数据是否存在的字段（如：phone, imei等）
   - **批量大小**: 每批次处理的数据量

### 第四步：数据预检查

1. 点击"开始检查"按钮
2. 系统会分析：
   - 总数据量
   - 新数据数量（需要插入）
   - 需要更新的数据数量
3. 查看匹配示例，确认映射关系正确

### 第五步：执行同步

1. 确认同步配置摘要
2. 点击"开始同步"按钮
3. 实时查看同步进度：
   - 已插入数量
   - 已更新数量
   - 已跳过数量
   - 失败数量
4. 同步完成后可以查看详细统计

## 数据匹配规则

系统根据**匹配字段**的值来判断数据是否已存在：

- **单个匹配字段**: 例如 `phone`，如果手机号相同则认为是同一条记录
- **多个匹配字段**: 例如 `phone + name`，只有当手机号和姓名都相同时才认为是同一条记录
- 匹配字段建议选择具有唯一性的字段，如：IMEI、序列号、手机号等

## 常见使用场景

### 场景1: 从老系统迁移数据到新系统
```
源表: old_phones (老系统)
目标表: phones (新系统)
匹配字段: imei
同步模式: upsert
```

### 场景2: 定期同步客户信息
```
源表: remote_customers (远程数据库)
目标表: customers (本地数据库)
匹配字段: phone
同步模式: upsert
```

### 场景3: 完全替换数据
```
源表: inventory_data (外部库存表)
目标表: phones (本地手机表)
同步模式: replace
```

## 注意事项

### 安全性
- ⚠️ 数据库密码会被安全存储，但建议使用只读权限的数据库账号
- ⚠️ 生产环境操作前先在测试环境验证
- ⚠️ 建议在同步前备份目标数据库

### 性能优化
- 📊 大数据量同步时，适当增加批量大小（建议100-500）
- 📊 使用索引字段作为匹配字段，提高查询速度
- 📊 分批次同步大量数据，避免长时间占用连接

### 数据一致性
- 🔄 同步过程中不要修改目标表数据
- 🔄 如果同步失败，检查字段映射和数据类型是否匹配
- 🔄 使用"预检查"功能验证配置是否正确

## API接口说明

### 连接管理
```javascript
// 创建连接
POST /api/database-sync/connections
{
  "host": "192.168.1.100",
  "port": 3306,
  "user": "root",
  "password": "password",
  "database": "mydb"
}

// 获取所有连接
GET /api/database-sync/connections

// 关闭连接
DELETE /api/database-sync/connections/:connectionId
```

### 表操作
```javascript
// 获取外部数据库表列表
GET /api/database-sync/connections/:connectionId/tables

// 获取表结构
GET /api/database-sync/connections/:connectionId/tables/:tableName/structure

// 获取本地数据库表列表
GET /api/database-sync/local/tables

// 获取本地表结构
GET /api/database-sync/local/tables/:tableName/structure
```

### 映射配置
```javascript
// 智能字段匹配
GET /api/database-sync/suggest-mapping?connectionId=xxx&sourceTable=xxx&targetTable=xxx

// 保存映射配置
POST /api/database-sync/mappings
{
  "id": "map_001",
  "sourceTable": "source_phones",
  "targetTable": "phones",
  "fieldMappings": {
    "id": "id",
    "name": "name",
    "phone": "phone"
  },
  "syncOptions": {
    "mode": "upsert",
    "keyFields": ["phone"],
    "batchSize": 100
  }
}
```

### 数据同步
```javascript
// 预检查
POST /api/database-sync/precheck
{
  "connectionId": "ext_xxx",
  "configId": "map_001"
}

// 执行同步
POST /api/database-sync/sync
{
  "connectionId": "ext_xxx",
  "configId": "map_001"
}

// 获取同步进度
GET /api/database-sync/sync/:syncId/progress
```

## 故障排除

### 问题1: 连接失败
- 检查数据库地址和端口是否正确
- 确认数据库服务是否运行
- 检查防火墙设置
- 验证用户名和密码

### 问题2: 表不存在
- 确认数据库名称正确
- 检查表名拼写
- 确认数据库用户有权限访问该表

### 问题3: 字段映射错误
- 检查字段名称拼写
- 确认数据类型兼容
- 使用"智能匹配"功能自动映射

### 问题4: 同步失败
- 检查匹配字段配置是否正确
- 确认目标表有足够的空间
- 查看错误日志获取详细信息

## 技术支持

如有问题，请联系技术支持或查看项目文档。
