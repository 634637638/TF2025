# 价目表动态同步功能

## 功能概述

价目表系统提供以下功能：

### 1. 管理端功能（需要登录）
- 📋 **价格列表管理** - 查看、添加、编辑、删除价格记录
- 🔄 **手动同步** - 立即从外部URL抓取最新价格
- ⚙️ **同步设置** - 配置登录信息、同步间隔等
- 📊 **批量导入** - 支持JSON格式批量导入价格
- 📜 **价格历史** - 查看价格变更历史记录
- 📝 **同步日志** - 查看同步执行记录

### 2. 公开查询页面（无需登录）
- 🔍 **关键词搜索** - 按品牌或型号搜索价格
- 🏷️ **品牌筛选** - 快速选择热门品牌查看
- 📱 **响应式设计** - 支持手机和电脑访问
- ⚡ **实时价格** - 显示最新的零售价和批发价

## 访问地址

| 功能 | 地址 | 说明 |
|------|------|------|
| 管理端 | `/price-list` | 需要登录，管理价目表 |
| 公开查询 | `/price-query` | 无需登录，客户自助查询 |

## 安装步骤

### 1. 执行数据库迁移

```bash
# 进入后端目录
cd backend

# 执行SQL文件创建数据表
mysql -u your_username -p your_database < database/create_price_list_tables.sql
```

### 2. 启动价格同步调度器

在 `backend/src/app.js` 中添加以下代码：

```javascript
// 在文件顶部引入
const priceSyncScheduler = require('./scripts/price-sync-scheduler');
```

调度器会在启动5秒后自动初始化。

### 3. 重启服务

```bash
# 重启后端
cd backend
npm run dev

# 重启前端
cd frontend
npm run dev
```

### 4. 配置同步参数

1. 登录系统，进入「价目表管理」
2. 点击「同步设置」按钮
3. 填写以下信息：
   - **配置名称**：如"默认价目表"
   - **数据源URL**：`https://81119.byb2b.cn/quoteList.action?gsdm=86112&km=&pp=苹果&network=&tykhgsdm=&policyid=`
   - **登录URL**：网站的登录地址（如果需要）
   - **用户名**：登录用户名
   - **密码**：登录密码
   - **同步间隔**：建议60分钟以上

4. 保存配置

### 5. 首次同步

点击「立即同步」按钮，系统会：
1. 登录到目标网站（如果配置了登录信息）
2. 访问价目表页面
3. 解析HTML获取价格数据
4. 保存到本地数据库

## API接口

### 公开接口（无需认证）

```bash
# 获取品牌列表
GET /api/public/price/brands

# 搜索价格
GET /api/public/price/search/:keyword

# 获取指定品牌的价格
GET /api/public/price/brand/:brand
```

### 管理接口（需要认证）

```bash
# 获取价格列表
GET /api/price-list

# 创建/更新价格
POST /api/price-list

# 批量导入
POST /api/price-list/bulk-import

# 删除价格
DELETE /api/price-list/:id

# 获取同步配置
GET /api/price-list/sync/config

# 更新同步配置
PUT /api/price-list/sync/config

# 手动触发同步
POST /api/price-list/sync/trigger

# 获取同步日志
GET /api/price-list/sync/logs
```

## 数据表结构

### price_list - 价目表主表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| brand_name | VARCHAR(100) | 品牌名称 |
| model_number | VARCHAR(100) | 型号 |
| retail_price | DECIMAL(10,2) | 零售价 |
| wholesale_price | DECIMAL(10,2) | 批发价 |
| cost_price | DECIMAL(10,2) | 进货价 |
| stock_quantity | INT | 库存数量 |
| status | TINYINT | 状态（1-正常，0-停用） |
| last_sync_time | DATETIME | 最后同步时间 |

### price_sync_config - 同步配置表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| config_name | VARCHAR(100) | 配置名称 |
| source_url | VARCHAR(500) | 数据源URL |
| login_url | VARCHAR(500) | 登录URL |
| login_username | VARCHAR(100) | 登录用户名 |
| login_password | VARCHAR(200) | 登录密码（加密） |
| sync_interval | INT | 同步间隔（分钟） |

### price_sync_log - 同步日志表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| config_id | INT | 配置ID |
| sync_type | VARCHAR(20) | 同步类型（manual/auto） |
| status | VARCHAR(20) | 状态（running/success/failed） |
| total_count | INT | 总记录数 |
| success_count | INT | 成功数量 |
| failed_count | INT | 失败数量 |

### price_history - 价格历史表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| price_list_id | INT | 价目表ID |
| retail_price | DECIMAL(10,2) | 零售价 |
| wholesale_price | DECIMAL(10,2) | 批发价 |
| cost_price | DECIMAL(10,2) | 进货价 |
| change_type | VARCHAR(20) | 变更类型（create/update） |
| recorded_at | DATETIME | 记录时间 |

## 使用说明

### 给客户的公开查询链接

客户可以直接访问以下链接查询价格：

```
https://你的域名/price-query
```

### 手动添加/修改价格

1. 进入「价目表管理」
2. 点击右上角「批量导入」或直接编辑某条记录

### 查看同步日志

1. 进入「价目表管理」
2. 点击某条记录的「历史」按钮查看价格变更

## 注意事项

1. **同步间隔**：建议设置不少于30分钟，避免频繁请求被对方封禁
2. **密码安全**：登录密码会加密存储在数据库中
3. **数据映射**：如果对方网站表格格式有变化，可能需要调整解析规则
4. **网络问题**：如果同步失败，检查网络连接和URL是否正确

## 故障排除

### 同步失败
- 检查数据源URL是否正确
- 检查登录信息是否正确
- 查看同步日志中的错误信息

### 价格数据不正确
- 检查目标网站是否更改了表格结构
- 联系开发人员调整解析规则

### 定时同步不执行
- 检查调度器是否正常启动
- 查看后端日志是否有错误信息
