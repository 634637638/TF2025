<template>
  <div class="menu-item" :style="{ paddingLeft: `${level * 20}px` }">
    <div class="menu-content" :class="{ 'is-disabled': !menu.is_active }">
      <div class="menu-info" @click="toggleExpand">
        <span class="expand-icon" v-if="hasChildren">
          <i :class="menu.expanded ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"></i>
        </span>
        <span class="expand-icon" v-else></span>
        
        <span class="menu-icon" v-if="menu.icon">
          <i :class="menu.icon"></i>
        </span>
        
        <div class="menu-details">
          <div class="menu-name">{{ menu.name }}</div>
          <div class="menu-meta">
            <span class="menu-url" v-if="menu.url">{{ menu.url }}</span>
            <span class="menu-order">排序: {{ menu.sort_order }}</span>
            <span class="menu-target" v-if="menu.target && menu.target !== '_self'">{{ menu.target }}</span>
            <span class="menu-id">ID: {{ menu.id }}</span>
          </div>
          <div class="menu-remarks" v-if="menu.remarks">{{ menu.remarks }}</div>
        </div>
        
        <span class="menu-status" :class="{ 'active': menu.is_active, 'inactive': !menu.is_active }">
          {{ menu.is_active ? '启用' : '禁用' }}
        </span>
      </div>
      
      <div class="menu-actions">
        <button @click="addChild" class="btn-action btn-add" title="添加子菜单">
          <i class="fas fa-plus"></i>
          <span>添加</span>
        </button>
        <button @click="edit" class="btn-action btn-edit" title="编辑">
          <i class="fas fa-edit"></i>
          <span>编辑</span>
        </button>
        <button @click="deleteMenu" class="btn-action btn-delete" title="删除">
          <i class="fas fa-trash"></i>
          <span>删除</span>
        </button>
      </div>
    </div>
    
    <div v-if="hasChildren && menu.expanded" class="menu-children">
      <menu-item
        v-for="child in menu.children"
        :key="child.id"
        :menu="child"
        :level="level + 1"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @toggle="$emit('toggle', $event)"
        @add-child="$emit('add-child', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Menu {
  id: number
  name: string
  url: string | null
  icon: string | null
  parent_id: number
  sort_order: number
  is_active: boolean
  target: string
  remarks: string | null
  created_at: string
  updated_at: string
  children?: Menu[]
  expanded?: boolean
}

interface Props {
  menu: Menu
  level: number
}

const props = defineProps<Props>()

interface Emits {
  edit: [menu: Menu]
  delete: [menu: Menu]
  toggle: [menu: Menu]
  'add-child': [menu: Menu]
}

const emit = defineEmits<Emits>()

const hasChildren = computed(() => {
  return props.menu.children && props.menu.children.length > 0
})

const toggleExpand = () => {
  emit('toggle', props.menu)
}

const edit = () => {
  emit('edit', props.menu)
}

const deleteMenu = () => {
  emit('delete', props.menu)
}

const addChild = () => {
  emit('add-child', props.menu)
}
</script>

<style scoped>
.menu-item {
  border-bottom: 1px solid #f0f0f0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-content {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  transition: background-color 0.2s;
  min-height: 48px;
}

.menu-content:hover {
  background-color: #f8f9fa;
}

.menu-content.is-disabled {
  opacity: 0.6;
}

.menu-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.expand-icon {
  width: 20px;
  text-align: center;
  color: #999;
  font-size: 12px;
}

.menu-icon {
  width: 20px;
  text-align: center;
  color: #007bff;
  font-size: 14px;
}

.menu-details {
  flex: 1;
  min-width: 0;
}

.menu-name {
  font-weight: 600;
  color: #333;
  font-size: 15px;
  margin-bottom: 4px;
}

.menu-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.menu-url {
  color: #0066cc;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  background: #e6f3ff;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #cce7ff;
}

.menu-order {
  color: #666;
  font-size: 11px;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}

.menu-target {
  color: #ff6b35;
  font-size: 11px;
  background: #fff4e6;
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid #ffd4b3;
}

.menu-id {
  color: #999;
  font-size: 11px;
  font-family: monospace;
}

.menu-remarks {
  color: #666;
  font-size: 12px;
  margin-top: 4px;
  font-style: italic;
  background: #f9f9f9;
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 3px solid #ddd;
}

.menu-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.menu-status.active {
  background: #28a745;
  color: white;
}

.menu-status.inactive {
  background: #dc3545;
  color: white;
}

.menu-actions {
  display: flex;
  gap: 6px;
  opacity: 0.3;
  transition: opacity 0.2s;
}

.menu-content:hover .menu-actions {
  opacity: 1;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
  min-width: 65px;
  justify-content: center;
}

.btn-action i {
  font-size: 12px;
}

.btn-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.btn-add {
  background: #28a745;
  color: white;
}

.btn-add:hover {
  background: #218838;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
}

.btn-edit {
  background: #007bff;
  color: white;
}

.btn-edit:hover {
  background: #0056b3;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

.btn-delete {
  background: #dc3545;
  color: white;
}

.btn-delete:hover {
  background: #c82333;
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
}

/* 保留原有的 btn-icon 样式以防其他地方使用 */
.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-icon:hover {
  transform: scale(1.1);
}

.btn-icon:not(.btn-danger) {
  background: #007bff;
  color: white;
}

.btn-icon:not(.btn-danger):hover {
  background: #0056b3;
  box-shadow: 0 2px 4px rgba(0,123,255,0.3);
}

.btn-icon.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-icon.btn-danger:hover {
  background: #c82333;
  box-shadow: 0 2px 4px rgba(220,53,69,0.3);
}

.menu-children {
  background: #fafafa;
}
</style>
