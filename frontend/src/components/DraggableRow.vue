<template>
  <tr
    v-if="!isHeader"
    class="draggable-row"
    :class="{ 'is-dragging': isDragging, 'is-drag-over': isDragOver }"
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @dragover="handleDragOver"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- 拖拽手柄列 -->
    <td class="drag-handle-cell">
      <div class="drag-handle">
        <i class="fas fa-grip-vertical"></i>
      </div>
    </td>
    <!-- 其他列 -->
    <slot></slot>
    <!-- 排序值显示/编辑 -->
    <td v-if="showSortOrder" class="sort-order-cell">
      <div class="sort-order-wrapper">
        <input
          v-if="isEditing"
          v-model.number="localSortOrder"
          type="number"
          class="sort-order-input"
          min="0"
          max="9999"
          @blur="handleSortOrderChange"
          @keyup.enter="handleSortOrderChange"
        />
        <span v-else class="sort-order-display" @click="startEdit">
          {{ item.sort_order !== undefined ? item.sort_order : index }}
        </span>
      </div>
    </td>
  </tr>
  <tr v-else class="draggable-header">
    <th class="drag-handle-cell"></th>
    <slot></slot>
    <th v-if="showSortOrder" class="sort-order-cell">排序</th>
  </tr>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface SortableRowItem {
  sort_order?: number
  [key: string]: unknown
}

interface Props {
  item?: SortableRowItem
  index?: number
  isHeader?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  showSortOrder?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isHeader: false,
  isDragging: false,
  isDragOver: false,
  showSortOrder: true
})

interface Emits {
  'dragstart': [event: DragEvent]
  'dragend': [event: DragEvent]
  'dragover': [event: DragEvent]
  'dragenter': [event: DragEvent]
  'dragleave': [event: DragEvent]
  'drop': [event: DragEvent]
  'sortOrderChange': [value: number]
}

const emit = defineEmits<Emits>()

const isEditing = ref(false)
const localSortOrder = ref(props.item?.sort_order || 0)

const handleDragStart = (event: DragEvent) => {
  emit('dragstart', event)
}

const handleDragEnd = (event: DragEvent) => {
  emit('dragend', event)
}

const handleDragOver = (event: DragEvent) => {
  emit('dragover', event)
}

const handleDragEnter = (event: DragEvent) => {
  emit('dragenter', event)
}

const handleDragLeave = (event: DragEvent) => {
  emit('dragleave', event)
}

const handleDrop = (event: DragEvent) => {
  emit('drop', event)
}

const startEdit = () => {
  localSortOrder.value = props.item?.sort_order || 0
  isEditing.value = true
}

const handleSortOrderChange = () => {
  isEditing.value = false
  if (localSortOrder.value !== props.item?.sort_order) {
    emit('sortOrderChange', localSortOrder.value)
  }
}
</script>

<style lang="scss" scoped>
.draggable-row {
  transition: all 0.2s ease;

  &.is-dragging {
    opacity: 0.5;
    background: #eff6ff !important;
  }

  &.is-drag-over {
    background: #f0f9ff !important;
    border-top: 2px solid #3b82f6;
  }

  &:hover {
    background: #f8f9fa;
  }
}

.drag-handle-cell {
  width: 40px;
  padding: 8px 4px !important;
  text-align: center;
  cursor: move;
  user-select: none;
}

.drag-handle {
  color: #9ca3af;
  font-size: 16px;
  cursor: grab;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    color: #3b82f6;
    background: #eff6ff;
  }

  &:active {
    cursor: grabbing;
  }
}

.draggable-header {
  .drag-handle-cell {
    cursor: default;
  }
}

.sort-order-cell {
  width: 60px;
  padding: 8px !important;
  text-align: center;
}

.sort-order-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
}

.sort-order-display {
  display: inline-block;
  min-width: 32px;
  height: 28px;
  padding: 0 8px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 28px;

  &:hover {
    background: #e5e7eb;
    color: #374151;
  }
}

.sort-order-input {
  width: 50px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  outline: none;

  &:focus {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
}
</style>
