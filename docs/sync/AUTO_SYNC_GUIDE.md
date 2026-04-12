# 自动化数据库同步工具使用指南

## 快速开始

### 1. 准备配置文件

```bash
# 复制配置模板
cp backend/auto-sync-config.example.json backend/auto-sync-config.json

# 编辑配置文件
vim backend/auto-sync-config.json
```

### 2. 配置说明

```json
{
  "source": {
    "host": "远程数据库IP地址",
    "port": 3306,
    "user": "数据库用户名",
    "password": "数据库密码",
    "database": "源数据库名"
  },
  "target": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "your_password",
    "database": "TF2025"
  },
  "syncTasks": [...]
}
```

### 3. 执行同步

```bash
# 进入后端目录
cd backend

# 运行同步脚本
node auto-sync-database.js

# 或指定配置文件
node auto-sync-database.js /path/to/config.json
```

## 同步模式说明

### 1. insert（只插入）
- 只插入新数据
- 已存在的数据跳过
- 适用于：初始化导入

### 2. update（只更新）
- 只更新已存在的数据
- 新数据跳过
- 适用于：定期更新现有数据

### 3. upsert（插入或更新）✨推荐
- 存在则更新，不存在则插入
- 适用于：日常同步

### 4. replace（完全替换）
- 清空目标表后重新导入
- ⚠️ 危险操作，会删除所有现有数据
- 适用于：完全重建数据

## 配置示例

### 同步客户数据

```json
{
  "name": "同步客户数据",
  "sourceTable": "customers",
  "targetTable": "customers",
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

### 说明

- `fieldMappings`: 字段映射关系（源字段 -> 目标字段）
- `keyFields`: 用于判断数据是否存在的字段
- `batchSize`: 每批处理的数据量（建议100-500）

## 定时同步（使用 crontab）

### Linux/Mac

```bash
# 编辑 crontab
crontab -e

# 每天凌晨2点执行同步
0 2 * * * cd /path/to/TF2025/backend && node auto-sync-database.js >> /var/log/db-sync.log 2>&1

# 每6小时执行一次
0 */6 * * * cd /path/to/TF2025/backend && node auto-sync-database.js >> /var/log/db-sync.log 2>&1
```

### Windows（任务计划程序）

1. 打开"任务计划程序"
2. 创建基本任务
3. 设置触发器（每天、每小时等）
4. 操作：启动程序
   - 程序：`node.exe` 的完整路径
   - 参数：`auto-sync-database.js`
   - 起始于：后端目录的完整路径

## 输出示例

```
========================================
🚀 自动化数据库同步工具
========================================

[步骤 1] 加载配置文件
✅ 配置文件加载成功: auto-sync-config.json
ℹ️  源数据库: 192.168.1.100:3306/old_db
ℹ️  目标数据库: localhost:3306/TF2025
ℹ️  同步任务数: 10

[步骤 2] 连接数据库
✅ 源数据库连接成功
✅ 目标数据库连接成功

[步骤 3] 执行数据同步

【任务 1/10】
ℹ️  同步表: customers -> customers
ℹ️  读取到 1500 条源数据
进度: 1500/1500 (100%)
✅ 同步完成: 插入 100 条, 更新 1400 条, 跳过 0 条

【任务 2/10】
ℹ️  同步表: brands -> brands
ℹ️  读取到 25 条源数据
进度: 25/25 (100%)
✅ 同步完成: 插入 5 条, 更新 20 条, 跳过 0 条

========================================
✅ 数据同步完成！
========================================
总计插入: 5000 条
总计更新: 15000 条
总计跳过: 0 条
========================================
```

## 注意事项

### 安全建议

1. **使用只读账号**
   - 源数据库使用只读权限账号
   - 避免误修改源数据

2. **备份重要数据**
   - 同步前先备份目标数据库
   - 特别是使用 replace 模式时

3. **测试环境验证**
   - 先在测试环境验证配置
   - 确认无误后再在生产环境使用

### 性能优化

1. **批量大小调整**
   - 小数据量：batchSize = 100
   - 大数据量：batchSize = 500
   - 网络较慢：减小 batchSize

2. **分批同步**
   - 大表可以拆分成多个任务
   - 按时间范围或ID范围分批

3. **使用索引**
   - 确保键字段有索引
   - 提高查询和更新速度

### 故障排除

#### 问题1：连接失败
```
❌ 数据库连接失败: Access denied
```
**解决方案**：
- 检查用户名和密码
- 确认数据库用户有权限访问
- 检查防火墙设置

#### 问题2：字段映射错误
```
❌ 同步任务失败: Unknown column 'xxx'
```
**解决方案**：
- 检查字段映射配置
- 确认源表和目标表结构一致
- 使用忽略不需要的字段

#### 问题3：数据冲突
```
⚠️  失败 100 条
```
**解决方案**：
- 检查键字段配置是否正确
- 查看日志了解具体错误
- 考虑使用不同的同步模式

## 高级用法

### 1. 条件同步

修改脚本中的SQL查询，添加WHERE条件：

```javascript
// 只同步最近30天的数据
const [sourceData] = await sourceConn.query(
  `SELECT * FROM \`${sourceTable}\` WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
);
```

### 2. 数据转换

在 syncRow 函数中添加数据转换逻辑：

```javascript
// 字段值转换
if (targetField === 'status') {
  targetRow[targetField] = sourceRow[sourceField] === 'active' ? 1 : 0;
}
```

### 3. 多源同步

创建多个配置文件，分别同步不同的数据源：

```bash
# 同步主数据库
node auto-sync-database.js config-master.json

# 同步分店数据库
node auto-sync-database.js config-branch1.json
node auto-sync-database.js config-branch2.json
```

## 与界面的区别

| 功能 | 自动化脚本 | Web界面 |
|------|-----------|---------|
| 使用场景 | 定时自动同步 | 手动操作同步 |
| 配置方式 | JSON配置文件 | 可视化界面 |
| 执行方式 | 命令行/Crontab | 浏览器操作 |
| 适用场景 | 定期批量同步 | 临时同步/测试 |
| 进度显示 | 命令行输出 | 实时进度条 |
| 日志记录 | 文本日志 | 数据库记录 |

## 最佳实践

1. **定期同步**：使用 crontab 设置定时任务
2. **日志记录**：重定向输出到日志文件
3. **监控告警**：检查日志中的失败记录
4. **数据备份**：同步前备份重要数据
5. **测试验证**：先在测试环境验证配置

## 技术支持

如有问题，请查看：
- 项目文档：DATABASE_SYNC_GUIDE.md
- 配置示例：auto-sync-config.example.json
- 源代码：auto-sync-database.js
