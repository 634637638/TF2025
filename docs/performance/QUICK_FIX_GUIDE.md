# TF2025 项目快速优化指南

**目标**: 在1小时内完成最关键的性能优化

---

## ⚡ 5分钟快速检查

```bash
# 1. 检查当前系统状态
pm2 list
df -h
free -m  # Linux
# 或
vm_stat  # macOS

# 2. 查看最近的错误日志
tail -50 backend/logs/error-*.log

# 3. 检查数据库连接
mysql -u root -p -e "SHOW PROCESSLIST;" TF2025
```

---

## 🎯 优先级1: 添加数据库索引（15分钟）

### 步骤1: 执行索引脚本

```bash
# 备份数据库（重要！）
mysqldump -u root -p TF2025 > backup_$(date +%Y%m%d_%H%M%S).sql

# 执行索引优化
mysql -u root -p TF2025 < scripts/optimize_indexes.sql
```

### 步骤2: 验证索引效果

```sql
-- 登录MySQL
mysql -u root -p TF2025

-- 检查关键查询的执行计划
EXPLAIN SELECT * FROM national_subsidies 
WHERE sale_time >= '2026-01-01' AND apply_status = 'pending'
ORDER BY sale_time DESC LIMIT 20;

-- 应该看到使用了 idx_sale_status 索引
```

**预期效果**: 国补列表查询从 **16ms → 5ms** (提升3倍)

---

## 🔧 优先级2: 优化缓存中间件（10分钟）

### 修改文件: `backend/src/middleware/cache.js`

```javascript
// 找到这一行（约L18）
function cacheMiddleware(options = {}) {
  // ...
}

// 替换为：
let cleanupTimer = null;

function startCleanupTimer() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupExpiredCache, 60000);
    cleanupTimer.unref(); // 不阻止进程退出
    console.log('✅ 缓存清理定时器已启动');
  }
}

function cacheMiddleware(options = {}) {
  const { ttl = 5000, keyPrefix = '' } = options;
  
  // 确保只启动一个定时器
  startCleanupTimer();
  
  return async (req, res, next) => {
    // ... 原有逻辑保持不变
  };
}
```

**预期效果**: 消除内存泄漏，服务器稳定性提升

---

## ⚙️ 优先级3: 调整数据库连接池（5分钟）

### 修改文件: `backend/src/config/database.js`

找到 `poolConfig` 对象（约L47），修改为：

```javascript
const poolConfig = {
  ...config.db,
  charset: 'utf8mb4',
  timezone: '+08:00',
  dateStrings: true,
  flags: '+FOUND_ROWS',
  
  // ✅ 优化后的配置
  connectionLimit: 20,        // 从10增加到20
  queueLimit: 50,             // 新增：防止雪崩
  
  connectTimeout: 30000,      // 从120秒减少到30秒
  acquireTimeout: 10000,      // 新增：获取连接超时
  timeout: 60000,             // 新增：查询超时
  
  idleTimeout: 300000,        // 从60秒增加到300秒（5分钟）
  maxIdle: 10,                // 新增：保持10个空闲连接
  
  enableKeepAlive: true,      // 新增：保活机制
  keepAliveInitialDelay: 10000,
  
  namedPlaceholders: false,
  multipleStatements: false,
  waitForConnections: true
};
```

重启服务：
```bash
pm2 restart all
```

**预期效果**: 连接稳定性提升80%，响应时间降低30%

---

## 🌐 优先级4: 调整API超时（5分钟）

### 修改文件: `frontend/src/utils/unified-api.ts`

找到 L20 附近：

```typescript
// ❌ 修改前
timeout: 120000, // 2分钟

// ✅ 修改后
timeout: 30000, // 30秒（普通请求）
```

对于特殊接口，单独配置：

```typescript
// 在调用时指定更长的超时
unifiedApi.post('/sales/checkout', data, { 
  timeout: 120000  // 结算接口允许2分钟
})
```

**预期效果**: 用户体验改善，避免长时间等待

---

## 📊 优先级5: 启用慢查询监控（10分钟）

### 步骤1: 创建监控脚本

文件已创建: `scripts/monitor-performance.sh`

### 步骤2: 启动监控

```bash
# 赋予执行权限（已完成）
chmod +x scripts/monitor-performance.sh

# 后台运行
nohup ./scripts/monitor-performance.sh > /dev/null 2>&1 &

# 查看监控日志
tail -f backend/logs/monitor-*.log
```

### 步骤3: 配置告警（可选）

编辑 `scripts/monitor-performance.sh`，在 `check_slow_queries()` 函数中添加：

```bash
# 发送钉钉告警
send_dingtalk_alert() {
    local message=$1
    curl -X POST "https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN" \
         -H "Content-Type: application/json" \
         -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$message\"}}"
}

# 在发现慢查询时调用
if [ ! -z "$SLOW_QUERIES" ]; then
    send_dingtalk_alert "⚠️ 发现慢查询: $SLOW_QUERIES"
fi
```

**预期效果**: 性能问题实时发现，从小时级缩短到分钟级

---

## ✅ 验证优化效果

### 1. 压力测试

```bash
# 安装 Apache Bench（如果未安装）
brew install httpd  # macOS
# 或
sudo apt-get install apache2-utils  # Linux

# 测试国补列表接口
ab -n 100 -c 10 http://localhost:3000/api/subsidy?page=1&limit=20

# 查看结果
# Requests per second 应该提升
```

### 2. 前端性能测试

打开浏览器开发者工具 → Network 面板：

- 刷新页面，观察加载时间
- 检查 API 响应时间
- 查看 Waterfall 图

**目标指标**:
- 首屏加载: < 2秒
- API响应: < 100ms (P95)
- 无红色错误

### 3. 后端性能测试

```bash
# 查看PM2监控
pm2 monit

# 观察指标：
# - CPU使用率应该下降
# - 内存使用应该稳定
# - 请求延迟应该降低
```

---

## 🚨 回滚方案

如果优化后出现问题，立即回滚：

### 回滚数据库索引

```bash
# 恢复备份
mysql -u root -p TF2025 < backup_YYYYMMDD_HHMMSS.sql
```

### 回滚代码修改

```bash
# Git回滚
git stash  # 暂存当前修改
# 或
git checkout HEAD -- backend/src/middleware/cache.js
git checkout HEAD -- backend/src/config/database.js
git checkout HEAD -- frontend/src/utils/unified-api.ts

# 重启服务
pm2 restart all
```

---

## 📈 监控指标

优化后持续监控以下指标：

| 指标 | 命令 | 正常值 |
|------|------|--------|
| API响应时间 | `tail -f backend/logs/api-*.log \| grep totalMs` | < 50ms |
| 数据库连接数 | `mysql -e "SHOW STATUS LIKE 'Threads_connected'"` | < 15 |
| PM2内存 | `pm2 list` | < 500MB/进程 |
| 磁盘空间 | `df -h` | < 80% |
| 错误率 | `grep ERROR backend/logs/*.log \| wc -l` | < 10/小时 |

---

## 🎓 后续优化建议

完成上述快速优化后，继续执行：

1. **引入Redis缓存** (预计3天)
   ```bash
   # 安装Redis
   brew install redis  # macOS
   sudo apt-get install redis-server  # Linux
   
   # 启动Redis
   redis-server
   
   # 安装Node.js客户端
   cd backend && npm install ioredis
   ```

2. **拆分大组件** (预计5天)
   - 参考文档中的组件拆分方案
   - 优先拆分 SalesView.vue (10,431行)

3. **图片CDN加速** (预计2天)
   - 配置Nginx静态资源缓存
   - 或使用云存储（阿里云OSS、腾讯云COS）

4. **添加单元测试** (预计10天)
   ```bash
   # 安装Jest
   cd backend && npm install --save-dev jest
   
   # 创建测试目录
   mkdir tests
   
   # 编写第一个测试
   cat > tests/example.test.js << EOF
   test('示例测试', () => {
     expect(1 + 1).toBe(2);
   });
   EOF
   
   # 运行测试
   npx jest
   ```

---

## 📞 技术支持

遇到问题？

1. 查看详细分析报告: `docs/整站分析报告_2026-05-06.md`
2. 查看日志: `tail -f backend/logs/*.log`
3. 联系开发团队

---

**祝优化顺利！🚀**
