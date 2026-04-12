# TF2025 通知系统使用指南

## 概述

TF2025 统一通知系统整合了项目中的所有通知方式，提供统一的API接口。支持多种通知类型，并包含丰富的错误处理和对话框功能。

## 快速开始

### 1. 安装和配置

在 `main.ts` 中注册插件：

```typescript
import { createApp } from 'vue'
import App from './App.vue'
import { NotificationPlugin } from '@/plugins/notification'

const app = createApp(App)

// 注册通知插件
app.use(NotificationPlugin, {
  method: 'auto',        // 通知方式
  duration: 4000,       // 显示时长
  showClose: true,      // 显示关闭按钮
  position: 'top-right' // 位置
})

app.mount('#app')
```

### 2. 基本使用

#### 在组件中使用

```vue
<script setup lang="ts">
// 方式1：使用组合式函数（推荐）
import { useNotification } from '@/composables/useNotification'

const { success, error, warning, info } = useNotification()

const handleSave = () => {
  success('保存成功！')
}

const handleError = () => {
  error('操作失败，请重试')
}

// 方式2：通过全局属性
const handleConfirm = async () => {
  const result = await $confirm('确定删除吗？')
  if (result) {
    $success('删除成功')
  }
}

// 方式3：直接使用服务实例
import { notification } from '@/services/notification'

const handleWarning = () => {
  notification.warning('这是一条警告')
}
</script>
```

#### 在模板中使用

```vue
<template>
  <div>
    <!-- 显示成功消息 -->
    <el-button @click="$success('操作成功')">成功</el-button>

    <!-- 显示错误消息 -->
    <el-button @click="$error('操作失败')">错误</el-button>

    <!-- 确认对话框 -->
    <el-button @click="confirmDelete">删除</el-button>
  </div>
</template>

<script setup lang="ts">
const confirmDelete = async () => {
  if (await $confirm('确定要删除吗？')) {
    // 执行删除操作
    $success('删除成功')
  }
}
</script>
```

## API 参考

### 基础通知方法

#### success(message, options)
显示成功消息

```typescript
success('数据保存成功')
success('操作完成', { title: '成功', duration: 3000 })
```

#### error(message, options)
显示错误消息

```typescript
error('网络连接失败')
error('操作失败', { title: '错误', duration: 6000 })
```

#### warning(message, options)
显示警告消息

```typescript
warning('请注意！')
warning('此操作不可恢复', { title: '警告' })
```

#### info(message, options)
显示信息消息

```typescript
info('系统将在5分钟后维护')
info('提示', { title: '信息提示' })
```

### 对话框方法

#### confirm(message, title, options)
显示确认对话框

```typescript
// 基本用法
const result = await confirm('确定删除吗？')
if (result) {
  // 用户点击确定
}

// 完整选项
const result = await confirm(
  '此操作不可恢复，确定继续吗？',
  '警告',
  {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }
)
```

#### alert(message, title, type)
显示提示对话框

```typescript
await alert('操作完成！', '提示', 'success')
await alert('发生错误！', '错误', 'error')
```

#### prompt(message, title, options)
显示输入对话框

```typescript
const result = await prompt('请输入名称：', '输入', {
  inputPlaceholder: '请输入...',
  inputValue: ''
})

if (result) {
  console.log('用户输入：', result.value)
}
```

### 特殊功能

#### loading(message)
显示加载状态

```typescript
const closeLoading = loading('正在处理数据...')

// 执行异步操作
await processData()

// 关闭加载
closeLoading()

// 自动关闭示例
const autoClose = loading('上传中...')
setTimeout(() => {
  autoClose()
}, 3000)
```

#### progress(message, progress, options)
显示进度通知

```typescript
progress('上传文件', 50)

// 更新进度
progress('上传文件', 75)
```

### API错误处理

#### handleApiError(error, defaultMessage)
统一处理API错误

```typescript
try {
  await api.saveData(data)
} catch (error) {
  handleApiError(error, '保存失败')
}
```

自动识别的错误类型：
- 400: 请求参数错误
- 401: 登录已过期
- 403: 权限不足
- 404: 资源不存在
- 500: 服务器错误

#### handleApiSuccess(response, defaultMessage)
处理API成功响应

```typescript
const response = await api.createItem(data)
handleApiSuccess(response, '创建成功')
```

### 管理功能

#### clearAll()
清除所有通知

```typescript
clearAll()
```

#### clearByType(type)
根据类型清除通知

```typescript
clearByType('error')  // 清除所有错误消息
clearByType('success') // 清除所有成功消息
```

#### getHistory()
获取通知历史

```typescript
const history = notification.getHistory()
console.log('历史记录：', history)
```

### 配置管理

#### setDefaultConfig(config)
设置默认配置

```typescript
setDefaultConfig({
  duration: 5000,       // 显示时长
  showClose: true,      // 显示关闭按钮
  persistent: false,    // 是否持久化
  position: 'top-right' // 位置
})
```

#### getDefaultConfig()
获取当前配置

```typescript
const config = getDefaultConfig()
console.log('当前配置：', config)
```

## 配置选项

### NotificationMethod 枚举

```typescript
enum NotificationMethod {
  ELEMENT_PLUS = 'element-plus',    // Element Plus 原生消息（默认）
  MESSAGE_STORE = 'message-store',  // Pinia store
  COMPOSABLE = 'composable',       // useNotification composable
  AUTO = 'auto'                    // 自动选择最佳方式
}
```

### 通知位置

- `'top-right'` - 右上角（默认）
- `'top-left'` - 左上角
- `'bottom-right'` - 右下角
- `'bottom-left'` - 左下角
- `'top-center'` - 顶部中央
- `'bottom-center'` - 底部中央

### 消息类型

- `'success'` - 成功消息
- `'error'` - 错误消息
- `'warning'` - 警告消息
- `'info'` - 信息消息

## 最佳实践

### 1. 优先使用组合式函数

```typescript
// ✅ 推荐
import { useNotification } from '@/composables/useNotification'
const { success, error } = useNotification()

// ❌ 不推荐
import { ElMessage } from 'element-plus'
ElMessage.success('成功')
```

### 2. 统一错误处理

```typescript
// 创建API服务时的统一错误处理
class ApiService {
  static async handleError(error: any) {
    const { handleApiError } = useNotification()
    handleApiError(error)
  }

  static async save(data: any) {
    try {
      const response = await api.post('/save', data)
      return response
    } catch (error) {
      this.handleError(error)
      throw error
    }
  }
}
```

### 3. 操作确认

```typescript
// 危险操作前确认
const deleteItem = async (id: number) => {
  const { confirm, success, error } = useNotification()

  if (await confirm('确定要删除这条记录吗？', '删除确认')) {
    try {
      await api.delete(`/items/${id}`)
      success('删除成功')
    } catch (err) {
      error('删除失败')
    }
  }
}
```

### 4. 加载状态管理

```typescript
// 异步操作的加载状态
const loadData = async () => {
  const { loading, success, error } = useNotification()

  const closeLoading = loading('加载数据中...')

  try {
    const data = await api.fetchData()
    success('数据加载成功')
    return data
  } catch (err) {
    error('数据加载失败')
    throw err
  } finally {
    closeLoading()
  }
}
```

## 迁移指南

### 从 Element Plus 迁移

```typescript
// 旧代码
import { ElMessage } from 'element-plus'
ElMessage.success('操作成功')
ElMessage.error('操作失败')
ElMessage.warning('请注意')
ElMessage.info('提示信息')

// 新代码
import { useNotification } from '@/composables/useNotification'
const { success, error, warning, info } = useNotification()

success('操作成功')
error('操作失败')
warning('请注意')
info('提示信息')
```

### 从 Message Store 迁移

```typescript
// 旧代码
import { useMessageStore } from '@/stores/message'
const messageStore = useMessageStore()
messageStore.success('成功')
messageStore.error('失败')

// 新代码
import { useNotification } from '@/composables/useNotification'
const { success, error } = useNotification()

success('成功')
error('失败')
```

## 测试

项目包含一个测试页面：`/src/views/test/NotificationTest.vue`

访问路径：`http://localhost:5176/test/notification`

该页面包含所有功能的测试用例，可以用来验证通知系统的各项功能。

## 常见问题

### Q: 如何让错误消息不自动消失？
A: 使用 `persistent: true` 选项：
```typescript
error('严重错误', { persistent: true })
```

### Q: 如何自定义通知时长？
A: 设置 `duration` 选项（毫秒）：
```typescript
success('消息', { duration: 1000 }) // 1秒后消失
```

### Q: 如何在全局设置通知配置？
A: 在注册插件时传入配置：
```typescript
app.use(NotificationPlugin, {
  duration: 3000,
  position: 'top-center'
})
```

### Q: 如何获取用户在对话框中的输入？
A: 使用 `prompt` 方法：
```typescript
const result = await prompt('请输入内容：')
if (result && result.value) {
  console.log(result.value)
}
```

## 更新日志

### v1.0.0
- 统一通知服务
- 支持多种通知方式
- 完整的API错误处理
- 对话框功能
- 历史记录管理
- TypeScript 支持