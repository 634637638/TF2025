# TF2025 通知系统规范

## 📋 概述

TF2025 采用统一的通知系统来处理所有用户交互反馈，包括成功消息、错误提示、警告信息和一般通知。该系统基于 Element Plus 消息组件，提供了统一的 API、自动错误处理、国际化支持和完整的 TypeScript 类型定义。

## 🎯 设计原则

1. **统一性**：所有通知使用相同的 API 和样式
2. **一致性**：相同类型的通知在所有页面表现一致
3. **可访问性**：支持键盘导航和屏幕阅读器
4. **性能优化**：避免重复通知，限制同时显示数量
5. **用户友好**：提供清晰的反馈和操作指引

## 🏗️ 架构设计

### 系统组件

```
通知系统架构
├── 核心服务层 (Services)
│   ├── SimpleNotificationService (主要实现)
│   └── NotificationService (扩展功能)
├── 插件层 (Plugins)
│   └── NotificationPlugin (Vue 插件)
├── 组合式函数层 (Composables)
│   └── useNotification (统一实现，支持防抖)
│       - 基础通知（success/error/warning/info）
│       - 对话框（confirm/alert/prompt）
│       - API错误处理（handleApiError）
│       - 防抖功能（可选启用）
└── 应用层 (Components)
    └── Vue 组件 (使用通知)
```

### 服务实例

```typescript
// 单例模式，确保全局唯一的通知服务
export const simpleNotification = SimpleNotificationService.getInstance()
```

## 📚 使用规范

### 1. 导入方式

```typescript
// ✅ 推荐：使用组合式函数（响应式、类型安全）
import { useNotification } from '@/composables/useNotification'

// 基础使用
const { success, error, warning, info, confirm } = useNotification()

// 启用防抖功能
const { success, error } = useNotification({ debounce: true })

// ✅ 可选：直接使用服务实例（非组件场景）
import { simpleNotification } from '@/services/notification-simple'

// ✅ 可选：使用全局属性（模板中）
// $success, $error, $warning, $info, $confirm

// ❌ 禁止：直接使用 Element Plus
import { ElMessage } from 'element-plus' // 禁止

// ❌ 禁止：使用已废弃的 composables
// 以下文件已删除，功能已合并到 useNotification：
// - useNotification.ts
// - useNotificationWithDebounce.ts
```

### 2. 基础用法

#### 2.1 成功通知

```typescript
// 基本成功消息
success('操作成功！')

// 带标题的成功消息
success('数据保存成功', {
  title: '保存成功',
  duration: 3000
})

// 持久化成功消息（重要操作）
success('系统升级完成', {
  persistent: true,
  title: '重要提示'
})
```

#### 2.2 错误通知

```typescript
// 基本错误消息
error('操作失败，请重试')

// 带上下文的错误消息
error('网络连接失败', {
  title: '连接错误',
  duration: 6000  // 错误消息显示更久
})

// API 错误自动处理
handleApiError(error, '保存失败')
```

#### 2.3 警告通知

```typescript
// 基本警告
warning('请检查输入内容')

// 需要用户注意的警告
warning('此操作将影响相关数据', {
  title: '操作警告',
  duration: 5000
})
```

#### 2.4 信息通知

```typescript
// 基本信息提示
info('系统将在5分钟后维护')

// 带链接的信息提示
info('新功能已上线', {
  title: '功能更新',
  dangerouslyUseHTMLString: true
})
```

### 3. 对话框使用

#### 3.1 确认对话框

```typescript
// 基本确认
const confirmed = await confirm('确定删除这条记录吗？')
if (confirmed) {
  // 执行删除
}

// 带标题和类型的确认
const confirmed = await confirm(
  '此操作不可恢复，确定继续吗？',
  '删除确认',
  {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  }
)
```

#### 3.2 输入对话框

```typescript
// 基本输入
const result = await prompt('请输入文件夹名称：', '新建文件夹')
if (result?.value) {
  // 使用用户输入
  createFolder(result.value)
}

// 带验证的输入
const result = await prompt(
  '请输入邮箱地址：',
  '修改邮箱',
  {
    inputPlaceholder: 'example@email.com',
    inputType: 'email',
    inputValue: currentUser.email
  }
)
```

#### 3.3 提示对话框

```typescript
// 成功提示
await alert('数据导入完成！', '导入成功', 'success')

// 错误提示
await alert('请检查文件格式', '格式错误', 'error')

// 警告提示
await alert('即将超时，请保存数据', '超时警告', 'warning')
```

### 4. 特殊功能

#### 4.1 加载状态

```typescript
// 基本加载
const closeLoading = loading('正在处理...')
try {
  await processData()
} finally {
  closeLoading()
}

// 自动关闭的加载
const autoClose = loading('上传中...')
setTimeout(autoClose, 3000)
```

#### 4.2 进度通知

```typescript
// 进度更新
progress('文件上传', 25)
progress('文件上传', 50)
progress('文件上传', 75)
progress('文件上传', 100)

// 带标题的进度
progress('数据处理', 60, {
  title: '批量处理进度'
})
```

#### 4.3 通知历史

```typescript
// 获取历史记录
const history = notification.getHistory()
console.log('最近通知：', history)

// 清除所有通知
clearAll()

// 按类型清除
clearByType('error')  // 清除错误消息
clearByType('success') // 清除成功消息
```

## 🔧 配置规范

### 1. 全局配置

在 `main.ts` 中配置全局默认值：

```typescript
app.use(NotificationPlugin, {
  method: NotificationMethod.ELEMENT_PLUS,
  duration: 4000,        // 默认显示时长
  showClose: true,       // 显示关闭按钮
  persistent: false,     // 默认不持久化
  position: 'top-right'  // 默认位置
})
```

### 2. 动态配置

```typescript
// 运行时修改配置
setDefaultConfig({
  duration: 5000,
  position: 'top-center'
})

// 获取当前配置
const config = getDefaultConfig()
```

### 3. 通知位置选项

```typescript
type NotificationPosition =
  | 'top-right'    // 右上角（默认）
  | 'top-left'     // 左上角
  | 'bottom-right' // 右下角
  | 'bottom-left'  // 左下角
  | 'top-center'   // 顶部中央
  | 'bottom-center' // 底部中央
```

## 📝 最佳实践

### 1. 消息编写规范

```typescript
// ✅ 好的消息
success('客户信息保存成功')
error('网络连接失败，请检查网络设置')
warning('库存不足，当前剩余 5 件')
info('系统将于今晚 22:00 进行维护')

// ❌ 避免的消息
success('成功')  // 太简单，缺少上下文
error('错误')   // 没有具体信息
warning('!')    // 使用表情符号
info('info')    // 直接使用类型名称
```

### 2. 错误处理规范

```typescript
// ✅ 统一的 API 错误处理
const handleApiCall = async () => {
  try {
    const response = await api.createOrder(orderData)
    handleApiSuccess(response, '订单创建成功')
    return response
  } catch (error) {
    handleApiError(error, '订单创建失败')
    throw error // 继续抛出错误供上层处理
  }
}

// ✅ 表单验证错误处理
const handleFormSubmit = async () => {
  if (!await validateForm()) {
    warning('请检查并填写所有必填项')
    return
  }
  // 提交表单
}
```

### 3. 异步操作模式

```typescript
// ✅ 完整的异步操作通知
const handleAsyncOperation = async () => {
  const closeLoading = loading('正在保存数据...')

  try {
    const result = await saveData()
    success('数据保存成功')
    return result
  } catch (error) {
    handleApiError(error, '保存失败')
    throw error
  } finally {
    closeLoading()
  }
}
```

### 4. 批量操作通知

```typescript
// ✅ 批量操作的通知模式
const handleBatchDelete = async (ids: number[]) => {
  if (!await confirm(`确定删除选中的 ${ids.length} 条记录吗？`)) {
    return
  }

  const closeLoading = loading(`正在删除 ${ids.length} 条记录...`)

  try {
    const results = await Promise.allSettled(
      ids.map(id => api.deleteItem(id))
    )

    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failCount = results.filter(r => r.status === 'rejected').length

    if (failCount === 0) {
      success(`成功删除 ${successCount} 条记录`)
    } else if (successCount === 0) {
      error(`删除失败，请重试`)
    } else {
      warning(`部分删除成功：成功 ${successCount} 条，失败 ${failCount} 条`)
    }
  } catch (error) {
    handleApiError(error, '批量删除失败')
  } finally {
    closeLoading()
  }
}
```

### 5. 静默刷新模式

```typescript
// ✅ 静默刷新实现（避免页面抖动）
const loadData = async (bustCache = false, silentError = false, showLoadingState = true) => {
  if (showLoadingState) {
    loading.value = true
  }

  try {
    const response = await api.get('/data', { params })
    data.value = response.data

    if (!silentError && !response.success) {
      error('获取数据失败')
    }
  } catch (error) {
    if (!silentError) {
      handleApiError(error, '获取数据失败')
    }
  } finally {
    if (showLoadingState) {
      loading.value = false
    }
  }
}

// 刷新按钮点击处理
const handleRefresh = async () => {
  // 静默刷新（不显示加载状态）
  await loadData(false, false, false)

  // 只显示成功提示
  success('数据刷新成功')
}
```

## ⚡ 性能优化

### 1. 防止重复通知

```typescript
// 使用防抖避免重复通知
import { debounce } from 'lodash-es'

const debouncedSuccess = debounce(success, 300)

// 快速点击时只会显示一次通知
const handleClick = () => {
  debouncedSuccess('操作成功')
}
```

### 2. 通知队列管理

```typescript
// 系统自动管理通知队列，避免同时显示过多消息
// 默认限制：最多同时显示 4 条消息
```

### 3. 内存管理

```typescript
// 通知历史自动限制数量（最多 100 条）
// 超出限制时自动清理旧记录
```

## 🧪 测试规范

### 1. 单元测试

```typescript
import { useNotification } from '@/composables/useNotification'

describe('通知服务', () => {
  it('应该显示成功消息', () => {
    const { success } = useNotification()
    success('测试成功')
    // 断言消息已显示
  })

  it('应该处理API错误', () => {
    const { handleApiError } = useNotification()
    const error = new Error('测试错误')
    handleApiError(error)
    // 断言错误消息已显示
  })
})
```

### 2. 集成测试

```typescript
// 在组件中测试通知功能
import { mount } from '@vue/test-utils'

it('应该在操作成功时显示通知', async () => {
  const wrapper = mount(TestComponent)
  await wrapper.find('[data-test="success-button"]').trigger('click')

  // 验证通知是否正确显示
  expect(wrapper.emitted('show-notification')).toBeTruthy()
})
```

## 🔍 故障排除

### 常见问题

1. **通知不显示**
   - 检查是否正确导入通知服务
   - 确认 Element Plus 样式是否加载
   - 验证是否在 Vue 组件上下文中使用

2. **样式异常**
   - 确保已安装 Element Plus 主题
   - 检查 CSS 变量是否被覆盖
   - 验证 z-index 是否被影响

3. **TypeScript 错误**
   - 确保导入了正确的类型定义
   - 检查 tsconfig.json 配置
   - 更新类型声明文件

### 调试技巧

```typescript
// 开启调试模式
if (import.meta.env.DEV) {
  console.log('通知配置：', getDefaultConfig())
  console.log('通知历史：', getHistory())
}
```

## 📈 迁移指南

### 从旧版本迁移

```typescript
// 旧代码
import { ElMessage, ElMessageBox } from 'element-plus'
ElMessage.success('成功')
ElMessageBox.confirm('确定吗？')

// 新代码（统一实现）
import { useNotification } from '@/composables/useNotification'
const { success, confirm } = useNotification()
success('成功')
await confirm('确定吗？')
```

### 从已废弃的 Composables 迁移

```typescript
// ❌ 已废弃（已合并到 useNotification）
// 旧实现已删除：
// - useNotification.ts
// - useNotificationWithDebounce.ts

// ✅ 新的统一实现
import { useNotification } from '@/composables/useNotification'

// 基础使用
const { success, error, warning, info, confirm } = useNotification()

// 需要防抖功能
const { success, error } = useNotification({ debounce: true })
```

## 🔧 统一规范迁移示例

### 从 ElMessage 迁移

```typescript
// ❌ 旧代码
import { ElMessage, ElMessageBox } from 'element-plus'

// 消息通知
ElMessage.success('操作成功')
ElMessage.error('操作失败')
ElMessage.warning('请检查输入')
ElMessage.info('系统提示')

// 确认对话框
await ElMessageBox.confirm(
  '确定要删除这条记录吗？',
  '删除确认',
  {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }
)

// ✅ 新代码
import { useNotification } from '@/composables/useNotification'

const { success, error, warning, info, confirm } = useNotification()

// 消息通知
success('操作成功')
error('操作失败')
warning('请检查输入')
info('系统提示')

// 确认对话框
const confirmed = await confirm(
  '确定要删除这条记录吗？',
  '删除确认',
  {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }
)
```

### 从 messageStore 迁移

```typescript
// ❌ 旧代码
const messageStore = useMessageStore()
messageStore.success('保存成功')
messageStore.error('保存失败')

// ✅ 新代码
const { success, error } = useNotification()
success('保存成功')
error('保存失败')
```

### 批量迁移脚本

对于需要更新大量文件的项目，可以使用以下脚本批量迁移：

```bash
#!/bin/bash

# 批量替换 ElMessage 调用
sed -i '' 's/ElMessage\.success(/success(/g' *.vue
sed -i '' 's/ElMessage\.error(/error(/g' *.vue
sed -i '' 's/ElMessage\.warning(/warning(/g' *.vue
sed -i '' 's/ElMessage\.info(/info(/g' *.vue

# 批量替换 ElMessageBox.confirm
sed -i '' 's/ElMessageBox\.confirm(/confirm(/g' *.vue

# 批量替换 messageStore 调用
sed -i '' 's/messageStore\.success(/success(/g' *.vue
sed -i '' 's/messageStore\.error(/error(/g' *.vue
sed -i '' 's/messageStore\.warning(/warning(/g' *.vue
sed -i '' 's/messageStore\.info(/info(/g' *.vue
```

### 已完成迁移的页面

截至 2025-01-16，以下页面已完成统一通知系统迁移：

1. **品牌管理** (`src/views/brands/BrandsView.vue`)
   - 完全迁移到 useNotification
   - 实现了静默刷新，避免页面抖动
   - 统一的成功/错误提示

2. **销售管理** (`src/views/sales/SalesView.vue`)
   - 已迁移，使用统一通知服务

3. **权限管理** (`src/views/permissions/PermissionsView.vue`)
   - 已迁移，包括 ElMessageBox.confirm 的替换

4. **客户管理** (`src/views/customers/CustomersView.vue`)
   - 已迁移，统一所有通知调用

5. **库存管理** (`src/views/inventory/InventoryView.vue`)
   - 已迁移，包括所有 ElMessage 调用

6. **门店管理** (`src/views/stores/StoresView.vue`)
   - 已迁移，从 messageStore 迁移

7. **手机管理** (`src/views/phones/PhonesView.vue`)
   - 已迁移，从 messageStore 迁移

8. **配件管理** (`src/views/accessories/AccessoriesView.vue`)
   - 已迁移，从 messageStore 迁移

9. **查询页面** (`src/views/query/QueryView.vue`)
   - 已迁移，从 messageStore 迁移

10. **入库管理** (`src/views/inventory/StockInPage.vue`)
    - 已迁移，使用统一通知服务

11. **数据分析组件**
    - `src/views/analytics/components/PerformanceAnalytics.vue`
    - `src/views/analytics/components/CustomerAnalytics.vue`

12. **公共组件**
    - `src/components/DynamicSidebar.vue`
    - `src/components/ErrorBoundary.vue`
    - `src/components/GlobalMessage.vue`
    - `src/components/PhoneDetailsModal.vue`
    - `src/components/PhoneModal.vue`

13. **型号管理** (`src/views/models/ModelsView.vue`)
    - 已迁移，从 useNotification 迁移到 useNotification
    - 实现了静默刷新，避免页面抖动
    - 更新了 confirm 对话框使用方式

14. **颜色管理** (`src/views/colors/ColorsView.vue`)
    - 已迁移，从 useNotification 迁移到 useNotification
    - 实现了静默刷新，避免页面抖动
    - 更新了 confirm 对话框使用方式
    - 修复了表格标题中的多余字符问题

15. **内存管理** (`src/views/memories/MemoriesView.vue`)
    - 已迁移，从 useNotification 迁移到 useNotification
    - 实现了静默刷新，避免页面抖动
    - 更新了 confirm 对话框使用方式
    - 修复了表格标题中的多余字符问题
    - 使用 handleApiError 统一处理错误

16. **供应商管理** (`src/views/suppliers/SuppliersView.vue`)
    - 已迁移，从 useToast 迁移到 useNotification
    - 实现了静默刷新，避免页面抖动
    - 更新了 confirm 对话框使用方式
    - 使用 handleApiError 统一处理错误
    - 移除了 Toast 组件的引用

17. **员工管理** (`src/views/employees/EmployeesView.vue`)
    - 已迁移，从原生 alert 迁移到 useNotification
    - 实现了静默刷新，避免页面抖动
    - 更新了 confirm 对话框使用方式
    - 使用 handleApiError 统一处理错误
    - 使用 warning 方法处理警告消息

18. **系统管理** (`src/views/system/SystemView.vue`)
    - 已完成全面升级，集成 useNotification
    - 添加了权限控制（v-permission 指令）
    - 实现了系统状态监控和快速操作功能
    - 使用统一的通知系统进行所有消息提示
    - 添加了优雅的 UI 设计和响应式布局

### 错误处理统一模式

```typescript
// ✅ 统一的 API 错误处理
const handleApiCall = async () => {
  try {
    const response = await api.createOrder(orderData)
    success('订单创建成功')
    return response
  } catch (error) {
    error('订单创建失败')
    throw error
  }
}

// ✅ 权限错误处理
const checkPermission = (action: string, module: string) => {
  if (!hasPermission(action, module)) {
    error(`您没有${module}${action}的权限，请联系管理员`)
    return false
  }
  return true
}
```

## 🎯 实际应用示例

### 销售订单示例

```typescript
// 销售创建成功
const handleSaleSuccess = (orderData) => {
  success(`订单创建成功！订单号：${orderData.orderNo}`, {
    title: '销售成功',
    duration: 5000
  })
}

// 库存不足警告
const handleLowStock = (phone: Phone) => {
  warning(`商品 ${phone.model} 库存不足，当前库存：${phone.stock} 件`, {
    title: '库存警告',
    persistent: true
  })
}

// 批量操作结果
const handleBatchOperation = (results: any[]) => {
  const successCount = results.filter(r => r.success).length
  const failCount = results.length - successCount

  if (successCount === results.length) {
    success(`批量操作成功，共处理 ${successCount} 条记录`)
  } else if (successCount === 0) {
    error(`批量操作失败，请重试`)
  } else {
    warning(`部分操作成功：成功 ${successCount} 条，失败 ${failCount} 条`)
  }
}

// 确认对话框
const handleDeleteConfirm = async (item: any) => {
  const confirmed = await confirm(
    `确定删除 "${item.name}" 吗？此操作不可恢复。`,
    '删除确认',
    {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )

  if (confirmed) {
    await api.deleteItem(item.id)
    success('删除成功')
  }
}
```

## 📚 参考资料

- [Element Plus Message 组件](https://element-plus.org/zh-CN/component/message.html)
- [Element Plus MessageBox 组件](https://element-plus.org/zh-CN/component/message-box.html)
- [项目通知测试页面](../src/views/test/NotificationTest.vue)
- [通知服务源码](../src/services/notification-simple.ts)
- [销售页面通知使用示例](../src/views/sales/SalesView.vue)

---

**更新日期**：2026-04-10
**版本**：v3.0.0（合并通知系统）
**维护者**：TF2025 开发团队