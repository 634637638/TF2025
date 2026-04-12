# 价格同步 1TB 内存规格修复

## 问题描述
iPhone 17 Pro Max 橙色 1TB 规格的价格无法同步到，价格显示为 0.00，而 256GB 和 512GB 规格的价格能正常同步。

## 根本原因
1. **颜色名称不匹配**：外部数据源中的颜色是"星宇橙色"，数据库中存储的是"橙色"，导致颜色匹配失败
2. **内存单位格式**：外部数据源可能使用"1TB"或"1024GB"等不同格式，需要统一转换

## 修复内容

### 1. 颜色名称标准化 (price-list.service.js)
在 `normalizeColorPriceList.service.js` 方法中添加了对"星宇橙色"的处理：

```javascript
// 特别处理"星宇橙色" -> "橙色"
if (/星宇橙色/.test(normalized)) return '橙色';
```

### 2. 内存单位格式兼容 (price-list.service.js)
在内存匹配和解析逻辑中添加了内存格式标准化函数 `normalizeMemoryForMatch`：

```javascript
const normalizeMemoryForMatch = (mem) => {
  if (!mem) return mem;
  // 1TB -> 1024, 2TB1TB -> 2048
  if (mem.includes('tb')) {
    const tb = parseFloat(mem);
    return (tb * 1024).toString();
  }
  // 1024GB -> 1024, 256GB -> 256
  if (mem.includes('gb')) {
    return mem.replace('gb', '');
  }
  return mem;
};
```

### 3. 自动补全功能 (price-list.service.js)
添加了 `autoCompleteMissingMemorySpecs()` 方法，在每次同步后自动：
- 检查 phones 表中所有在库商品（in_stock, is_new=1）
- 对比 price_list 表中是否有对应的记录
- 如果缺失，自动创建新记录（价格为 null 或 0）

## 测试方法
1. 在价目表管理页面点击"手动同步"
2. 检查 17promax 橙色 1TB 的价格是否正确同步
3. 检查同步日志中是否有匹配成功的信息

## 相关文件
- `/backend/src/services/price-list.service.js` - 价格同步核心服务
- `/backend/src/controllers/price-list.controller.js` - 价格列表控制器
- `/backend/src/routes/price-list.js` - 价格列表路由
