<template>
  <div class="draggable-list">
    <div
      v-for="(item, index) in items"
      :key="item.id"
      class="draggable-item"
      :class="{ 'is-dragging': draggingIndex === index }"
      draggable="true"
      @dragstart="handleDragStart(index, $event)"
      @dragend="handleDragEnd"
      @dragover="handleDragOver(index, $event)"
      @dragenter="handleDragEnter(index)"
      @dragleave="handleDragLeave"
      @drop="handleDrop(index, $event)"
    >
      <div class="drag-handle">
        <i class="fas fa-grip-vertical"></i>
      </div>
      <div class="drag-content">
        <slot :item="item" :index="index"></slot>
      </div>
      <div class="drag-sort-order" v-if="showSortOrder">
        <span class="sort-badge">{{ item.sort_order || index + 1 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface SortableItem {
  id?: string | number
  sort_order?: number
  [key: string]: unknown
}

interface Props {
  items: SortableItem[]
  showSortOrder?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSortOrder: true
})

interface Emits {
  'update:items': [items: SortableItem[]]
  'change': [items: SortableItem[], oldIndex: number, newIndex: number]
}

const emit = defineEmits<Emits>()

const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const handleDragStart = (index: number, event: DragEvent) => {
  draggingIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', String(index))
  }
}

const handleDragEnd = () => {
  draggingIndex.value = null
  dragOverIndex.value = null
}

const handleDragOver = (index: number, event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  if (draggingIndex.value === null || draggingIndex.value === index) return
  dragOverIndex.value = index
}

const handleDragEnter = (index: number) => {
  if (draggingIndex.value === null || draggingIndex.value === index) return
  dragOverIndex.value = index
}

const handleDragLeave = () => {
  // 不清除 dragOverIndex，避免闪烁
}

const handleDrop = (dropIndex: number, event: DragEvent) => {
  event.preventDefault()
  const dragIndex = draggingIndex.value
  if (dragIndex === null || dragIndex === dropIndex) {
    handleDragEnd()
    return
  }

  // 创建新数组并移动元素
  const newItems = [...props.items]
  const [movedItem] = newItems.splice(dragIndex, 1)
  newItems.splice(dropIndex, 0, movedItem)

  // 更新 sort_order 值
  newItems.forEach((item, index) => {
    item.sort_order = index
  })

  emit('update:items', newItems)
  emit('change', newItems, dragIndex, dropIndex)

  handleDragEnd()
}
</script>

<style lang="scss" scoped>
.draggable-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.draggable-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: move;
  transition: all 0.2s ease;
  user-select: none;

  &:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  }

  &.is-dragging {
    opacity: 0.5;
    border-color: #3b82f6;
    background: #eff6ff;
  }
}

.drag-handle {
  color: #9ca3af;
  font-size: 16px;
  cursor: grab;
  display: flex;
  align-items: center;

  &:active {
    cursor: grabbing;
  }
}

.drag-content {
  flex: 1;
  min-width: 0;
}

.drag-sort-order {
  .sort-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    background: #f3f4f6;
    color: #6b7280;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
  }
}
</style>
