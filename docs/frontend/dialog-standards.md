# TF2025 对话框/编辑框规范

## 📝 概述

本文档定义了 TF2025 项目中所有对话框（Dialog/Modal）和编辑框的统一设计规范，确保用户界面的一致性和良好的用户体验。

## 🎯 设计原则

### 1. 一致性
- 所有对话框遵循统一的视觉风格
- 统一的交互模式和动画效果
- 一致的按钮布局和操作流程

### 2. 可用性
- 清晰的标题和操作提示
- 合理的按钮位置和大小
- 支持键盘快捷键操作

### 3. 响应式
- 适配不同屏幕尺寸
- 移动端友好的触摸区域
- 合理的弹窗大小限制

## 🎨 视觉规范

### 1. 基础样式

```scss
// 遮罩层
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
  padding: 20px;
}

// 对话框容器
.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  animation: modalSlideIn 0.3s ease-out;
}

// 动画
@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-50px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### 2. 对话框头部

```scss
.modal-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 12px 12px 0 0;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-close {
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
}
```

### 3. 对话框内容

```scss
.modal-body {
  padding: 24px;
  max-height: 60vh;
  overflow-y: auto;

  .form-group {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #374151;
      font-size: 14px;

      .required {
        color: #ef4444;
      }
    }

    .form-control {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      background: white;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      &::placeholder {
        color: #9ca3af;
      }
    }

    textarea.form-control {
      resize: vertical;
      min-height: 80px;
      font-family: inherit;
      line-height: 1.5;
    }

    select.form-control {
      cursor: pointer;
      padding-right: 40px;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
      background-position: right 12px center;
      background-repeat: no-repeat;
      background-size: 16px;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
    }
  }
}
```

### 4. 对话框底部

```scss
.modal-footer {
  background: #f9fafb;
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-radius: 0 0 12px 12px;

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 80px;
    justify-content: center;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.btn-secondary {
      background: #6b7280;
      color: white;

      &:hover:not(:disabled) {
        background: #4b5563;
        transform: translateY(-1px);
      }
    }

    &.btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
      }
    }

    &.btn-danger {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
      }
    }
  }
}
```

## 📐 标准模板

### 1. 基础编辑对话框

```vue
<template>
  <!-- 对话框遮罩 -->
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content">
      <!-- 对话框头部 -->
      <div class="modal-header">
        <h3>
          <i :class="icon"></i>
          {{ title }}
        </h3>
        <button class="btn-close" @click="handleClose">×</button>
      </div>

      <!-- 对话框内容 -->
      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>
              名称 <span class="required">*</span>
            </label>
            <input
              v-model="formData.name"
              type="text"
              class="form-control"
              placeholder="请输入名称"
              required
            >
          </div>

          <div class="form-group">
            <label>描述</label>
            <textarea
              v-model="formData.description"
              class="form-control"
              placeholder="请输入描述信息"
              rows="4"
            ></textarea>
          </div>
        </form>
      </div>

      <!-- 对话框底部 -->
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleClose">
          取消
        </button>
        <button
          class="btn btn-primary"
          @click="handleSubmit"
          :disabled="submitting"
        >
          <i v-if="submitting" class="fas fa-spinner fa-spin"></i>
          {{ isEdit ? '更新' : '创建' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: 'fas fa-edit'
  },
  data: {
    type: Object,
    default: () => ({})
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['close', 'submit'])

// 状态
const submitting = ref(false)

// 表单数据
const formData = reactive({
  name: '',
  description: ''
})

// 监听数据变化
watch(() => props.data, (newData) => {
  if (newData) {
    Object.assign(formData, newData)
  }
}, { immediate: true })

// 监听显示状态
watch(() => props.visible, (visible) => {
  if (visible && !props.isEdit) {
    // 新建时重置表单
    Object.assign(formData, {
      name: '',
      description: ''
    })
  }
})

// 方法
const handleClose = () => {
  emit('close')
}

const handleSubmit = async () => {
  if (submitting.value) return

  submitting.value = true
  try {
    await emit('submit', { ...formData })
  } finally {
    submitting.value = false
  }
}
</script>
```

### 2. 确认对话框

```vue
<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content modal-confirm">
      <div class="modal-header">
        <h3>
          <i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>
          {{ title }}
        </h3>
        <button class="btn-close" @click="handleClose">×</button>
      </div>

      <div class="modal-body">
        <div class="confirm-content">
          <i :class="typeIcon" :style="{ color: typeColor }"></i>
          <div class="confirm-message">
            <p>{{ message }}</p>
            <small v-if="detail">{{ detail }}</small>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleClose">
          取消
        </button>
        <button
          class="btn"
          :class="`btn-${type}`"
          @click="handleConfirm"
          :disabled="submitting"
        >
          <i v-if="submitting" class="fas fa-spinner fa-spin"></i>
          确认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: String,
  message: String,
  detail: String,
  type: {
    type: String,
    default: 'danger',
    validator: (value) => ['danger', 'warning', 'info'].includes(value)
  }
})

const emit = defineEmits(['close', 'confirm'])

const submitting = ref(false)

const typeIcon = computed(() => {
  const icons = {
    danger: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  }
  return icons[props.type] || icons.info
})

const typeColor = computed(() => {
  const colors = {
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  }
  return colors[props.type] || colors.info
})

const handleClose = () => {
  emit('close')
}

const handleConfirm = async () => {
  if (submitting.value) return

  submitting.value = true
  try {
    await emit('confirm')
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.modal-confirm {
  max-width: 400px;
}

.confirm-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;

  i {
    font-size: 48px;
    flex-shrink: 0;
    margin-top: 8px;
  }

  .confirm-message {
    flex: 1;

    p {
      font-size: 16px;
      color: #374151;
      margin: 0 0 8px 0;
    }

    small {
      color: #6b7280;
      font-size: 14px;
    }
  }
}
</style>
```

### 3. 表格选择对话框

```vue
<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleClose">
    <div class="modal-content modal-table">
      <div class="modal-header">
        <h3>
          <i :class="icon"></i>
          {{ title }}
        </h3>
        <button class="btn-close" @click="handleClose">×</button>
      </div>

      <div class="modal-body">
        <!-- 搜索栏 -->
        <div class="search-bar" v-if="searchable">
          <input
            v-model="searchQuery"
            type="text"
            class="form-control"
            :placeholder="searchPlaceholder"
          >
        </div>

        <!-- 表格内容 -->
        <div class="table-container">
          <table class="selection-table">
            <thead>
              <tr>
                <th width="40">
                  <input
                    type="checkbox"
                    :checked="isAllSelected"
                    @change="handleSelectAll"
                  >
                </th>
                <th v-for="column in columns" :key="column.key">
                  {{ column.title }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredItems"
                :key="item.id"
                :class="{ selected: isSelected(item) }"
                @click="handleToggleSelect(item)"
              >
                <td>
                  <input
                    type="checkbox"
                    :checked="isSelected(item)"
                    @change="handleToggleSelect(item)"
                  >
                </td>
                <td v-for="column in columns" :key="column.key">
                  {{ item[column.key] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal-footer">
        <div class="selection-info">
          已选择 {{ selectedItems.length }} 项
        </div>
        <div class="footer-actions">
          <button class="btn btn-secondary" @click="handleClose">
            取消
          </button>
          <button
            class="btn btn-primary"
            @click="handleConfirm"
            :disabled="selectedItems.length === 0"
          >
            确认选择
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: String,
  icon: String,
  items: Array,
  columns: Array,
  multiple: {
    type: Boolean,
    default: false
  },
  searchable: {
    type: Boolean,
    default: true
  },
  searchPlaceholder: {
    type: String,
    default: '搜索...'
  }
})

const emit = defineEmits(['close', 'confirm'])

const searchQuery = ref('')
const selectedItems = ref([])

const filteredItems = computed(() => {
  if (!searchQuery.value) return props.items
  return props.items.filter(item =>
    Object.values(item).some(value =>
      String(value).toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  )
})

const isAllSelected = computed(() => {
  return filteredItems.value.length > 0 &&
         filteredItems.value.every(item => isSelected(item))
})

const isSelected = (item) => {
  return selectedItems.value.some(selected => selected.id === item.id)
}

const handleSelectAll = () => {
  if (isAllSelected.value) {
    selectedItems.value = []
  } else {
    selectedItems.value = props.multiple
      ? [...filteredItems.value]
      : [filteredItems.value[0]]
  }
}

const handleToggleSelect = (item) => {
  if (props.multiple) {
    const index = selectedItems.value.findIndex(selected => selected.id === item.id)
    if (index > -1) {
      selectedItems.value.splice(index, 1)
    } else {
      selectedItems.value.push(item)
    }
  } else {
    selectedItems.value = [item]
  }
}

const handleClose = () => {
  emit('close')
}

const handleConfirm = () => {
  emit('confirm', props.multiple ? selectedItems.value : selectedItems.value[0])
}
</script>

<style lang="scss" scoped>
.modal-table {
  max-width: 800px;
  width: 95%;
  max-height: 90vh;
}

.search-bar {
  margin-bottom: 20px;
}

.table-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.selection-table {
  width: 100%;
  border-collapse: collapse;

  th {
    background: #f9fafb;
    padding: 12px;
    text-align: left;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
  }

  td {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  tbody tr {
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: #f9fafb;
    }

    &.selected {
      background: #eff6ff;
    }
  }
}

.selection-info {
  color: #6b7280;
  font-size: 14px;
}

.footer-actions {
  display: flex;
  gap: 12px;
}
</style>
```

## 📱 响应式适配

```scss
// 移动端适配
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px;
  }

  .modal-content {
    width: 100%;
    max-height: 95vh;
    border-radius: 12px 12px 0 0;
    margin-top: auto;
  }

  .modal-header {
    padding: 16px 20px;

    h3 {
      font-size: 16px;
    }
  }

  .modal-body {
    padding: 20px;
    max-height: calc(100vh - 180px);
  }

  .modal-footer {
    padding: 16px 20px;
    flex-direction: column;
    gap: 8px;

    .btn {
      width: 100%;
      order: 2;
    }

    .btn-secondary {
      order: 1;
    }
  }
}
```

## 🔧 使用指南

### 1. 基础使用

```vue
<template>
  <div>
    <button @click="showEditDialog = true">编辑</button>

    <EditDialog
      v-model:visible="showEditDialog"
      title="编辑用户"
      icon="fas fa-user-edit"
      :data="selectedUser"
      :is-edit="true"
      @close="showEditDialog = false"
      @submit="handleSave"
    />
  </div>
</template>
```

### 2. 确认对话框使用

```vue
<template>
  <button @click="showDeleteConfirm = true">删除</button>

  <ConfirmDialog
    v-model:visible="showDeleteConfirm"
    title="确认删除"
    message="确定要删除这条数据吗？"
    detail="删除后将无法恢复，请谨慎操作"
    type="danger"
    @close="showDeleteConfirm = false"
    @confirm="handleDelete"
  />
</template>
```

### 3. 选择对话框使用

```vue
<template>
  <button @click="showSelectDialog = true">选择用户</button>

  <SelectDialog
    v-model:visible="showSelectDialog"
    title="选择用户"
    icon="fas fa-users"
    :items="userList"
    :columns="[
      { key: 'name', title: '姓名' },
      { key: 'email', title: '邮箱' },
      { key: 'department', title: '部门' }
    ]"
    :multiple="true"
    @close="showSelectDialog = false"
    @confirm="handleSelect"
  />
</template>
```

## ⚠️ 注意事项

### 1. 可访问性
- 确保键盘可以操作（Tab导航、Enter确认、Esc取消）
- 提供合适的ARIA属性
- 确保焦点管理正确

### 2. 性能优化
- 使用v-if而非v-show控制显示
- 大数据量时使用虚拟滚动
- 及时清理事件监听器

### 3. 用户体验
- 提供加载状态反馈
- 错误信息清晰明确
- 操作结果及时提示

## 📚 相关文档

- [移动端开发规范](./mobile-development-standards.md)
- [组件开发规范](./component-standards.md)
- [样式定义规范](./style-standards.md)

---

**最后更新**：2025-12-18
**维护团队**：TF2025前端开发团队