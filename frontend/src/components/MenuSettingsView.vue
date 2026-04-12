<template>
  <div>
    <div class="action-buttons">
      <button class="btn btn-primary" @click="$emit('add')">
        ➕ 添加菜单
      </button>
      <button class="btn btn-success" @click="$emit('save')">
        💾 保存设置
      </button>
    </div>
    <div class="data-section">
      <h2>菜单配置管理</h2>
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>菜单标题</th>
              <th>图标</th>
              <th>路径</th>
              <th>排序</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="menu in menuItems" :key="menu.id">
              <td>
                <input v-model="menu.title" class="form-input" placeholder="菜单标题">
              </td>
              <td>
                <input v-model="menu.icon" class="form-input small" placeholder="图标">
              </td>
              <td>
                <input v-model="menu.path" class="form-input" placeholder="路径">
              </td>
              <td>
                <input type="number" v-model.number="menu.order" class="form-input small" placeholder="排序">
              </td>
              <td>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="menu.enabled" class="checkbox">
                  <span class="checkbox-text">{{ menu.enabled ? '启用' : '禁用' }}</span>
                </label>
              </td>
              <td>
                <button 
                  class="btn btn-danger btn-small" 
                  @click="$emit('remove', menu.id)" 
                  v-if="menu.key !== 'dashboard'"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="help-section">
        <h4>使用说明：</h4>
        <ul class="help-list">
          <li>可以直接编辑菜单标题、图标、路径等属性</li>
          <li>图标支持emoji或图标库符号</li>
          <li>路径用于生成浏览器URL</li>
          <li>排序数字越小越靠前</li>
          <li>禁用的菜单项不会显示在侧边栏</li>
          <li>仪表盘菜单不能删除，但可以禁用</li>
        </ul>
      </div>
      
      <!-- 菜单预览 -->
      <div class="preview-section">
        <h4>菜单预览</h4>
        <div class="menu-preview">
          <div class="preview-header">
            <h5>TF2025 管理系统</h5>
            <div class="preview-user">当前角色</div>
          </div>
          <ul class="preview-menu">
            <li v-for="menu in sortedEnabledMenus" :key="menu.id" class="preview-item">
              <span>{{ menu.icon }}</span>
              {{ menu.title }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MenuItem } from '@/types'

interface Props {
  menuItems: MenuItem[]
}

interface Emits {
  save: []
  add: []
  remove: [id: number]
  toggle: [id: number]
}

const props = defineProps<Props>()
defineEmits<Emits>()

const sortedEnabledMenus = computed(() => {
  return props.menuItems
    .filter(menu => menu.enabled)
    .sort((a, b) => a.order - b.order)
})
</script>

<style scoped>
.action-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.data-section {
  background: white;
  padding: 25px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.data-section h2 {
  margin-bottom: 20px;
  color: #2c3e50;
  font-size: 18px;
}

.table-container {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  margin-bottom: 20px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ecf0f1;
}

.table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  position: sticky;
  top: 0;
  z-index: 10;
}

.table tr:hover {
  background: #f8f9fa;
}

.form-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.form-input.small {
  width: 80px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.checkbox {
  margin-right: 8px;
  width: auto;
}

.checkbox-text {
  color: #2c3e50;
  font-size: 14px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-success {
  background: #2ecc71;
  color: white;
}

.btn-success:hover {
  background: #27ae60;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-small {
  padding: 5px 10px;
  font-size: 12px;
}

.help-section {
  margin-top: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.help-section h4 {
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 16px;
}

.help-list {
  margin: 0;
  padding-left: 20px;
}

.help-list li {
  margin-bottom: 8px;
  color: #6c757d;
  font-size: 14px;
  line-height: 1.5;
}

.preview-section {
  margin-top: 30px;
}

.preview-section h4 {
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 16px;
}

.menu-preview {
  background: #2c3e50;
  border-radius: 8px;
  padding: 20px;
  color: white;
  max-width: 250px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.preview-header {
  text-align: center;
  padding-bottom: 15px;
  border-bottom: 1px solid #4a5f7a;
  margin-bottom: 15px;
}

.preview-header h5 {
  margin: 0 0 5px 0;
  font-size: 16px;
}

.preview-user {
  font-size: 12px;
  opacity: 0.8;
}

.preview-menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.preview-item {
  padding: 10px 0;
  border-bottom: 1px solid #34495e;
  display: flex;
  align-items: center;
  font-size: 14px;
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-item span {
  margin-right: 10px;
  width: 20px;
  text-align: center;
}
</style>
