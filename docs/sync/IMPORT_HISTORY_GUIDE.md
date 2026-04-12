# 导入历史功能说明

## 概述

导入历史功能已完善，所有四种导入策略（跳过重复、覆盖重复、合并重复、完全替换）在成功执行后都会自动保存历史记录到数据库。

## 功能特性

### 1. 自动保存历史记录

每次数据导入完成后，系统会自动记录以下信息：

- **基本信息**
  - `import_id`: 导入任务的唯一标识
  - `user_id`: 操作用户的ID
  - `user_name`: 操作用户名
  - `strategy`: 使用的导入策略
  - `file_name`: 导入的文件名

- **统计数据**
  - `total_records`: 总记录数
  - `imported`: 新增记录数
  - `updated`: 更新记录数
  - `skipped`: 跳过记录数
  - `error_count`: 错误数量

- **状态信息**
  - `status`: 导入状态（processing/completed/failed）
  - `error_message`: 错误信息（如果有）
  - `start_time`: 开始时间
  - `end_time`: 结束时间
  - `duration_ms`: 耗时（毫秒）

### 2. API 接口

#### 查询导入历史

**请求:**
```
GET /api/data-import/history
```

**查询参数:**
- `page`: 页码（默认: 1）
- `pageSize`: 每页数量（默认: 20）
- `status`: 状态筛选（processing/completed/failed）
- `strategy`: 策略筛选（skip/overwrite/merge/replace_all）
- `userId`: 用户ID筛选

**响应示例:**
```json
{
  "success": true,
  "message": "获取导入历史成功",
  "data": [
    {
      "id": 1,
      "import_id": "1704067200000",
      "user_id": 1,
      "user_name": "admin",
      "strategy": "merge",
      "file_name": "sales_data_2024.xlsx",
      "total_records": 1000,
      "imported": 800,
      "updated": 150,
      "skipped": 50,
      "error_count": 0,
      "status": "completed",
      "start_time": "2024-01-01 10:00:00",
      "end_time": "2024-01-01 10:01:30",
      "duration_ms": 90000
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### 3. 数据库表结构

表名: `import_history`

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | INT UNSIGNED | 主键，自增 |
| import_id | VARCHAR(50) | 导入ID |
| user_id | INT UNSIGNED | 操作用户ID |
| user_name | VARCHAR(100) | 操作用户名 |
| strategy | VARCHAR(20) | 导入策略 |
| file_name | VARCHAR(255) | 文件名 |
| total_records | INT UNSIGNED | 总记录数 |
| imported | INT UNSIGNED | 新增记录数 |
| updated | INT UNSIGNED | 更新记录数 |
| skipped | INT UNSIGNED | 跳过记录数 |
| error_count | INT UNSIGNED | 错误数量 |
| status | VARCHAR(20) | 状态 |
| error_message | TEXT | 错误信息 |
| start_time | DATETIME | 开始时间 |
| end_time | DATETIME | 结束时间 |
| duration_ms | INT UNSIGNED | 耗时（毫秒） |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 4. 导入策略对比

| 策略 | 说明 | 适用场景 |
|-----|------|---------|
| **跳过重复** (skip) | 只更新客户 Apple ID，不更新手机记录 | 已有完整数据，只需补充 Apple ID |
| **合并重复** (merge) | 保留现有数据，更新非空字段（推荐） | 日常数据更新，维护数据完整性 |
| **覆盖重复** (overwrite) | 更新所有字段（包括空值） | 完全替换现有数据 |
| **完全替换** (replace_all) | 清空所有数据，重新导入 | 初始化系统或完全重建数据 |

### 5. 使用示例

#### 前端调用示例

```javascript
// 查询导入历史
const getImportHistory = async (page = 1, pageSize = 20) => {
  const response = await unifiedApi.get('/data-import/history', {
    params: { page, pageSize }
  });
  return response.data;
};

// 按策略筛选
const getMergeHistory = async () => {
  const response = await unifiedApi.get('/data-import/history', {
    params: { strategy: 'merge' }
  });
  return response.data;
};

// 按状态筛选
const getFailedImports = async () => {
  const response = await unifiedApi.get('/data-import/history', {
    params: { status: 'failed' }
  });
  return response.data;
};
```

## 技术实现

### 1. 数据库迁移

迁移文件位置: `backend/database/migrations/create_import_history_table.sql`

### 2. 服务层

在 `data-import.service.js` 中添加了 `saveImportHistory` 方法：

```javascript
async saveImportHistory(connection, historyData) {
  try {
    await connection.execute(
      `INSERT INTO import_history (...) VALUES (...)`,
      [/* 参数 */]
    );
    console.log(`✓ 导入历史已保存到数据库: ${historyData.import_id}`);
  } catch (error) {
    console.error(`❌ 保存导入历史失败:`, error.message);
    // 不抛出错误，避免影响导入流程
  }
}
```

### 3. 路由层

在 `data-import.js` 路由中更新了 `/history` 端点，从数据库读取历史记录并支持分页筛选。

### 4. 应用配置

在 `app.js` 中将数据库连接池添加到 app 实例，供路由使用：

```javascript
const db = getDatabase();
app.set('db', db);
```

## 测试验证

已通过以下测试：

1. ✅ 数据库表创建成功
2. ✅ 导入历史记录插入成功
3. ✅ 导入历史记录查询成功
4. ✅ 分页查询功能正常
5. ✅ 统计查询功能正常
6. ✅ 测试数据清理成功

## 注意事项

1. **错误处理**: 保存导入历史失败不会影响导入流程本身
2. **性能优化**: 历史记录表已添加索引，查询性能良好
3. **数据清理**: 建议定期清理旧的历史记录，避免表过大
4. **权限控制**: 查询导入历史需要 `data-import:view` 权限

## 后续优化建议

1. 添加导入历史的导出功能（Excel/CSV）
2. 添加导入历史的统计图表展示
3. 添加导入失败记录的详细日志查看
4. 添加导入历史的定时清理任务
5. 添加导入历史的对比分析功能
