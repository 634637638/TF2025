<template>
  <div class="icon-selector">
    <!-- 触发按钮 -->
    <div class="icon-display" @click="showSelector = true">
      <div v-if="modelValue" class="selected-icon">
        <i :class="modelValue"></i>
        <span class="icon-class">{{ modelValue }}</span>
      </div>
      <div v-else class="icon-placeholder">
        <i class="fas fa-icons"></i>
        <span>点击选择图标</span>
      </div>
    </div>
    <button type="button" class="btn btn-secondary" @click="showSelector = true">
      <i class="fas fa-icons"></i> 选择
    </button>
    <button v-if="modelValue" type="button" class="btn btn-warning" @click="clearIcon">
      <i class="fas fa-times"></i> 清除
    </button>

    <!-- 图标选择器模态框 -->
    <MobileDialog
      v-model="showSelector"
      title="选择图标"
      width="900px"
      dialog-class="icon-selector-dialog"
      :show-default-footer="false"
    >
      <div class="modal-body icon-selector-modal">
        <div class="icon-search">
          <input 
            v-model="searchQuery" 
            type="text" 
            class="form-control" 
            placeholder="搜索图标..."
            @input="filterIcons"
          />
        </div>

        <div class="icon-categories">
          <button 
            v-for="category in categories" 
            :key="category.key"
            @click="selectedCategory = category.key; filterIcons()"
            :class="['category-btn', { active: selectedCategory === category.key }]"
          >
            {{ category.name }} ({{ category.count }})
          </button>
        </div>

        <div v-if="loading" class="loading">
          <i class="fas fa-spinner fa-spin"></i> 加载图标中...
        </div>

        <div v-else-if="filteredIcons.length > 0" class="icon-grid">
          <div 
            v-for="icon in filteredIcons" 
            :key="icon.id || icon.class"
            @click="selectIcon(icon.class)"
            :class="['icon-item', { selected: modelValue === icon.class }]"
            :title="`${icon.name || icon.class} - ${icon.class}`"
          >
            <div class="icon-preview">
              <i :class="icon.class" v-if="icon.class && icon.class.startsWith('fas')"></i>
              <span v-else class="icon-fallback">{{ (icon.name || icon.class).charAt(0).toUpperCase() }}</span>
            </div>
            <span class="icon-name">{{ icon.name || icon.class.replace('fas fa-', '').replace(/-/g, ' ') }}</span>
          </div>
        </div>

        <div v-else class="no-results">
          <i class="fas fa-search"></i>
          <p>未找到匹配的图标</p>
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <button @click="closeSelector" class="btn btn-secondary">取消</button>
          <button @click="clearIcon" class="btn btn-warning">清除图标</button>
          <button @click="confirmSelection" class="btn btn-primary" :disabled="!modelValue">
            确认选择
          </button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import unifiedApi from '@/utils/unified-api'
import type { StringModelValueProps, UpdateStringModelValueEmits } from '@/types/component'

interface Icon {
  id: number
  class: string
  name: string
  category: string
  description?: string
  tags?: string
}

interface Category {
  key: string
  name: string
  count: number
}

defineProps<StringModelValueProps>()

const emit = defineEmits<UpdateStringModelValueEmits>()

// 响应式数据
const showSelector = ref(false)
const loading = ref(false)
const searchQuery = ref('')
const selectedCategory = ref('all')
const icons = ref<Icon[]>([])
const categories = ref<Category[]>([])
const filteredIcons = ref<Icon[]>([])

// 默认分类
const defaultCategories = [
  { key: 'all', name: '全部', count: 0 },
  { key: 'mobile', name: '手机应用', count: 0 },
  { key: 'business', name: '商业', count: 0 },
  { key: 'education', name: '教育', count: 0 },
  { key: 'medical', name: '医疗', count: 0 },
  { key: 'technology', name: '科技', count: 0 },
  { key: 'finance', name: '金融', count: 0 },
  { key: 'retail', name: '零售', count: 0 },
  { key: 'food', name: '餐饮', count: 0 },
  { key: 'transport', name: '交通', count: 0 },
  { key: 'entertainment', name: '娱乐', count: 0 },
  { key: 'sports', name: '体育', count: 0 },
  { key: 'common', name: '常用', count: 0 }
]

// 加载图标数据
const loadIcons = async () => {
  loading.value = true
  try {
    const response = await unifiedApi.get('/icons', { 
      params: { 
        limit: 500 
      } 
    })
    
    if (response && response.success) {
      icons.value = response.data || []
      filterIcons()
    }
  } catch (error) {
  } finally {
    loading.value = false
  }
}

// 加载分类数据
const loadCategories = async () => {
  try {
    const response = await unifiedApi.get('/icons/categories')
    
    if (response && response.success) {
      const dbCategories = response.data || []
      
      // 合并默认分类和数据库分类
      categories.value = defaultCategories.map(cat => {
        const dbCat = dbCategories.find((c: any) => c.category === cat.key)
        return {
          ...cat,
          count: dbCat ? parseInt(dbCat.count) : 0
        }
      })
      
      // 计算总数
      const totalCount = categories.value.reduce((sum, cat) => sum + cat.count, 0)
      categories.value[0].count = totalCount // 更新"全部"分类的数量
    }
  } catch (error) {
    categories.value = defaultCategories
  }
}

// 过滤图标
const filterIcons = () => {
  let result = [...icons.value]
  
  // 按分类过滤
  if (selectedCategory.value !== 'all') {
    result = result.filter(icon => icon.category === selectedCategory.value)
  }
  
  // 按搜索词过滤
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(icon => 
      icon.class.toLowerCase().includes(query) ||
      icon.name.toLowerCase().includes(query) ||
      (icon.description && icon.description.toLowerCase().includes(query))
    )
  }
  
  filteredIcons.value = result
}

// 选择图标
const selectIcon = (iconClass: string) => {
  emit('update:modelValue', iconClass)
}

// 确认选择
const confirmSelection = () => {
  closeSelector()
}

// 清除图标
const clearIcon = () => {
  emit('update:modelValue', '')
  closeSelector()
}

// 关闭选择器
const closeSelector = () => {
  showSelector.value = false
}

// 组件挂载时加载数据
onMounted(async () => {
  await Promise.all([
    loadCategories(),
    loadIcons()
  ])
})
</script>

<style scoped>
.icon-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-display {
  flex: 1;
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-display:hover {
  border-color: #007bff;
  background-color: #f8f9fa;
}

.selected-icon {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  color: #333;
}

.selected-icon i {
  font-size: 24px;
  color: #007bff;
}

.icon-class {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #666;
}

.icon-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  color: #999;
}

.icon-placeholder i {
  font-size: 24px;
}

.icon-placeholder span {
  font-size: 14px;
}

.icon-selector-modal {
  display: flex;
  flex-direction: column;
}

.modal-body {
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.icon-search {
  margin-bottom: 20px;
}

.icon-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.category-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.category-btn:hover {
  background: #f8f9fa;
}

.category-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 10px;
  border: 1px solid #eee;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.icon-item:hover {
  background: #f8f9fa;
  border-color: #007bff;
  transform: translateY(-2px);
}

.icon-item.selected {
  background: #e3f2fd;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.icon-preview {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  border-radius: 6px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.icon-item i {
  font-size: 20px;
  color: #007bff;
}

.icon-fallback {
  font-size: 16px;
  font-weight: bold;
  color: #6c757d;
}

.icon-name {
  font-size: 12px;
  color: #666;
  word-break: break-all;
  line-height: 1.2;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: #999;
}

.no-results i {
  font-size: 48px;
  margin-bottom: 10px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px;
  border-top: 1px solid #eee;
  background: #f8f9fa;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-warning {
  background: #ffc107;
  color: #212529;
}

.btn-warning:hover {
  background: #e0a800;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}
</style>
