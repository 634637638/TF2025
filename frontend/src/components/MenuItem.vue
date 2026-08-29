<template>
  <div
    class="menu-item"
    :style="{ paddingLeft: `${level * 20}px` }"
  >
    <div
      class="menu-content"
      :class="{ 'is-disabled': !menu.is_active }"
    >
      <div
        class="menu-info"
        @click="toggleExpand"
      >
        <span
          v-if="hasChildren"
          class="expand-icon"
        >
          <i :class="menu.expanded ? 'fas fa-chevron-down' : 'fas fa-chevron-right'" />
        </span>
        <span
          v-else
          class="expand-icon"
        />
        
        <span
          v-if="menu.icon"
          class="menu-icon"
        >
          <IconRenderer
            :icon="menu.icon"
            :svg="menu.icon_svg"
          />
        </span>
        
        <div class="menu-details">
          <div class="menu-name">
            {{ menu.name }}
          </div>
          <div class="menu-meta">
            <span
              v-if="menu.url"
              class="menu-url"
            >{{ menu.url }}</span>
            <span class="menu-order">排序: {{ menu.sort_order }}</span>
            <span
              v-if="menu.target && menu.target !== '_self'"
              class="menu-target"
            >{{ menu.target }}</span>
            <span class="menu-id">ID: {{ menu.id }}</span>
          </div>
          <div
            v-if="menu.remarks"
            class="menu-remarks"
          >
            {{ menu.remarks }}
          </div>
        </div>
        
        <span
          class="menu-status"
          :class="{ 'active': menu.is_active, 'inactive': !menu.is_active }"
        >
          {{ menu.is_active ? '启用' : '禁用' }}
        </span>
      </div>
      
      <div class="menu-actions">
        <button
          class="btn-action btn-add"
          title="添加子菜单"
          @click="addChild"
        >
          <i class="fas fa-plus" />
          <span>添加</span>
        </button>
        <button
          class="btn-action btn-edit"
          title="编辑"
          @click="edit"
        >
          <i class="fas fa-edit" />
          <span>编辑</span>
        </button>
        <button
          class="btn-action btn-delete"
          title="删除"
          @click="deleteMenu"
        >
          <i class="fas fa-trash" />
          <span>删除</span>
        </button>
      </div>
    </div>
    
    <div
      v-if="hasChildren && menu.expanded"
      class="menu-children"
    >
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
import IconRenderer from '@/components/IconRenderer.vue'

interface Menu {
  id: number
  name: string
  url: string | null
  icon: string | null
  icon_svg?: string | null
  icon_source?: string | null
  icon_is_valid?: number | boolean | null
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
  border-bottom: 1px solid var(--tf-color-gray-200);
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
  background-color: var(--tf-color-surface-muted);
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
  color: var(--text-muted);
  font-size: 12px;
}

.menu-icon {
  width: 20px;
  text-align: center;
  color: var(--tf-color-blue-bootstrap);
  font-size: 14px;
}

.menu-details {
  flex: 1;
  min-width: 0;
}

.menu-name {
  font-weight: 600;
  color: var(--text-primary);
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
  color: var(--tf-color-blue-corporate);
  font-size: 12px;
  font-family: 'Courier New', monospace;
  background: var(--tf-color-blue-pale);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--tf-color-blue-tailwind-100);
}

.menu-order {
  color: var(--text-secondary);
  font-size: 11px;
  background: var(--tf-color-gray-200);
  padding: 2px 6px;
  border-radius: 3px;
}

.menu-target {
  color: var(--tf-color-orange-coral);
  font-size: 11px;
  background: var(--tf-color-orange-ant-surface);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--tf-color-orange-tailwind-200);
}

.menu-id {
  color: var(--text-muted);
  font-size: 11px;
  font-family: monospace;
}

.menu-remarks {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 4px;
  font-style: italic;
  background: var(--tf-color-surface-plain);
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 3px solid var(--tf-color-gray-300-alt);
}

.menu-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.menu-status.active {
  background: var(--success-color);
  color: white;
}

.menu-status.inactive {
  background: var(--danger-color);
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
.btn-add {
  background: var(--tf-button-success-bg);
  color: var(--tf-button-on-color);
}

.btn-add:hover {
  background: var(--tf-button-success-hover-bg);
  box-shadow: var(--tf-button-success-shadow);
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

.menu-children {
  background: var(--tf-color-neutral-25);
}
</style>
