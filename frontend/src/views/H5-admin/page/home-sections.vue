<!--
  HomeSectionsConfig - H5首页推荐配置页面
  功能：管理首页推荐区域和商品
-->
<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="h5-admin-home-sections"
    module-name="首页推荐"
    permission-code="home-sections:view"
  />

  <div v-else class="home-sections-config-page">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton animated />
    </div>

      <!-- 推荐区域列表 -->
      <div v-else class="sections-content">
      <el-empty v-if="sections.length === 0" description="暂无推荐区域">
        <el-button v-if="canCreate" type="primary" @click="openCreateDialog">创建推荐区域</el-button>
      </el-empty>

      <div v-else class="sections-list">
        <div
          v-for="section in sections"
          :key="section.id"
          class="section-card"
        >
          <div class="section-header">
            <div class="section-info">
              <i :class="section.icon || 'fas fa-list'"></i>
              <div>
                <h4>{{ section.section_name }}</h4>
                <p class="section-key">{{ section.section_key }}</p>
              </div>
            </div>
            <div class="section-actions">
              <el-switch
                v-model="section.is_enabled"
                :disabled="!canEdit"
                @change="() => toggleSection(section)"
                active-text="启用"
                inactive-text="禁用"
              />
              <el-button v-if="canEdit" plain type="primary" size="small" @click="editSection(section)" class="btn-sm">
                <i class="fas fa-edit mr-1"></i>编辑
              </el-button>
              <el-button v-if="canDelete" plain type="danger" size="small" @click="deleteSection(section)" class="btn-sm">
                <i class="fas fa-trash mr-1"></i>删除
              </el-button>
            </div>
          </div>

          <!-- 商品列表 -->
          <div class="section-products">
            <div class="products-header">
              <div class="products-count-info">
                <span class="main-count">推荐商品 ({{ section.product_count || 0 }}/{{ section.product_limit }})</span>
                <span v-if="section.fill_count > 0" class="fill-info">
                  <i class="fas fa-magic"></i> 保底 {{ section.fill_count }}
                </span>
              </div>
              <el-button v-if="canEdit" plain type="primary" size="small" @click="manageProducts(section)" class="btn-sm">
                <i class="fas fa-cog mr-1"></i>管理
              </el-button>
            </div>
            <div v-if="section.products && section.products.length > 0" class="products-preview">
              <div
                v-for="product in section.products"
                :key="product.id"
                class="product-item"
              >
                <img :src="getImageUrl(product.main_image)" :alt="product.brand_name" />
                <div class="product-info">
                  <p class="product-name">{{ product.brand_name }} {{ product.model_name }}</p>
                  <p class="product-price">¥{{ product.min_price || product.sale_price }}</p>
                </div>
              </div>
            </div>
            <div v-else class="no-products">
              <p>暂无推荐商品</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建/编辑推荐区域对话框 -->
    <MobileDialog
      v-model="showCreateDialog"
      :title="editingSection ? '编辑推荐区域' : '创建推荐区域'"
      width="550px"
      dialog-class="home-section-dialog"
      :show-default-footer="false"
      @close="handleDialogClose"
    >
      <el-form :model="sectionForm" label-width="100px" :disabled="!canEditSectionForm">
        <!-- 快捷模板选择 -->
        <el-form-item label="快捷模板">
          <el-select
            v-model="selectedTemplate"
            placeholder="选择模板快速创建（可选）"
            clearable
            @change="applyTemplate"
            :disabled="!!editingSection"
            class="w-full"
          >
            <el-option-group label="🔥 热门推荐">
              <el-option
                label="热门推荐"
                value="hot_recommend"
              >
                <span>热门推荐</span>
                <span class="float-right text-secondary text-xs">hot_recommend</span>
              </el-option>
            </el-option-group>
            <el-option-group label="📱 手机类型">
              <el-option label="全新机" value="new_phones">
                <span>全新机</span>
                <span class="float-right text-secondary text-xs">new_phones</span>
              </el-option>
              <el-option label="二手机" value="used_phones">
                <span>二手机</span>
                <span class="float-right text-secondary text-xs">used_phones</span>
              </el-option>
              <el-option label="原装靓机" value="quality_used">
                <span>原装靓机</span>
                <span class="float-right text-secondary text-xs">quality_used</span>
              </el-option>
            </el-option-group>
            <el-option-group label="⭐ 特色商品">
              <el-option label="新品上架" value="new_arrivals">
                <span>新品上架</span>
                <span class="float-right text-secondary text-xs">new_arrivals</span>
              </el-option>
              <el-option label="限时特惠" value="flash_sale">
                <span>限时特惠</span>
                <span class="float-right text-secondary text-xs">flash_sale</span>
              </el-option>
              <el-option label="品牌专卖" value="brand_exclusive">
                <span>品牌专卖</span>
                <span class="float-right text-secondary text-xs">brand_exclusive</span>
              </el-option>
            </el-option-group>
          </el-select>
          <template #tip>
            <span class="tip-text">💡 选择模板会自动填充区域标识和名称</span>
          </template>
        </el-form-item>

        <el-divider content-position="left">或手动填写</el-divider>

        <el-form-item label="区域标识" required>
          <el-input
            v-model="sectionForm.section_key"
            placeholder="如：hot_recommend"
            :disabled="!!editingSection"
          >
            <template #append>
              <el-button @click="generateSectionKey" :disabled="!!editingSection" title="根据区域名称自动生成">
                <i class="fas fa-magic"></i>
              </el-button>
            </template>
          </el-input>
          <template #tip>
            <div class="tip-text">
              <p>✨ 唯一标识，创建后不可修改</p>
              <p>📝 命名规则：小写字母、数字、下划线</p>
            </div>
          </template>
        </el-form-item>
        <el-form-item label="区域名称" required>
          <el-input
            v-model="sectionForm.section_name"
            placeholder="如：热门推荐"
            @blur="editingSection ? null : generateSectionKey()"
          />
          <template #tip>
            <span class="tip-text">用户看到的名称，可以随时修改</span>
          </template>
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="sectionForm.icon" placeholder="如：fas fa-fire">
            <template #prepend>
              <i :class="sectionForm.icon || 'fas fa-list'"></i>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="显示数量">
          <el-input-number v-model="sectionForm.product_limit" :min="1" :max="50" />
          <template #tip>
            <span class="tip-text">📊 同时显示的商品数量。即使选择了更多商品，也只会显示前 N 条。超出部分会按排序在销售后自动补上</span>
          </template>
        </el-form-item>
        <el-form-item label="补齐数量">
          <el-input-number v-model="sectionForm.fill_count" :min="0" :max="50" />
          <template #tip>
            <span class="tip-text">🔧 自动补齐到此数量（0表示不补齐）。当已选在库商品少于此数量时，系统会从在库商品中随机补齐。通常设置为显示数量的 60%-100%</span>
          </template>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="sectionForm.sort_order" :min="0" />
          <template #tip>
            <span class="tip-text">数值越小越靠前</span>
          </template>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="sectionForm.is_enabled" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showCreateDialog = false">取消</el-button>
        <el-button v-if="canEditSectionForm" type="primary" @click="saveSection" :loading="saving">保存</el-button>
      </template>
    </MobileDialog>

    <!-- 管理商品对话框 -->
    <MobileDialog
      v-model="showProductsDialog"
      :title="`管理商品 - ${currentSection?.section_name}`"
      width="900px"
      dialog-class="home-section-products-dialog"
      :show-default-footer="false"
      @close="handleProductsDialogClose"
    >
      <div v-if="currentSection" class="products-manager">
        <UnifiedSearchPanel :expanded="true">
          <template #primary>
            <el-autocomplete
              v-model="searchKeyword"
              :fetch-suggestions="searchProducts"
              placeholder="搜索商品名称、品牌、型号"
              :trigger-on-focus="false"
              :disabled="!canEdit"
              @select="handleProductSelect"
            >
              <template #default="{ item }">
                <div class="search-result-item">
                  <img v-if="item.main_image" :src="getImageUrl(item.main_image)" class="product-thumb" />
                  <div>
                    <div class="product-name">{{ item.display_text }}</div>
                    <div class="product-price" v-if="item.price">¥{{ item.price }}</div>
                  </div>
                </div>
              </template>
            </el-autocomplete>
          </template>
          <div class="form-group filter-item">
            <el-select v-model="productType" placeholder="商品类型" class="w-28" :disabled="!canEdit">
              <el-option label="全部" value="all" />
              <el-option label="全新机" value="new" />
              <el-option label="二手机" value="used" />
            </el-select>
          </div>
        </UnifiedSearchPanel>

        <!-- 可选商品列表 -->
        <div class="available-products-section">
          <div class="list-header">
            <span>可选商品 ({{ availableProducts.length }})</span>
            <el-button text size="small" :disabled="!canEdit" @click="loadAvailableProducts">
              <i class="fas fa-sync"></i>
              <span>刷新</span>
            </el-button>
          </div>
          <el-empty v-if="availableProducts.length === 0" description="暂无商品" :image-size="60" />
          <div v-else class="available-products-grid">
            <div
              v-for="product in availableProducts"
              :key="product.template_id || product.phone_id"
              class="available-product-card"
              :class="{ 'is-added': isProductAdded(product) }"
              @click="addProductFromAvailable(product)"
            >
              <img v-if="product.main_image" :src="getImageUrl(product.main_image)" class="product-thumb" />
              <div class="product-info">
                <div class="product-name">{{ product.model_name }} {{ product.color_name }}</div>
                <div class="product-price" v-if="product.price">¥{{ product.price }}</div>
              </div>
              <div v-if="isProductAdded(product)" class="added-badge">
                <i class="fas fa-check"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- 已添加的商品列表 -->
        <div class="products-list-section">
          <div class="list-header">
            <span>已添加商品 ({{ sectionProducts.length }})</span>
            <el-button v-if="canDelete" plain type="danger" size="small" @click="clearAllProducts" class="btn-sm">
              <i class="fas fa-trash mr-1"></i>清空
            </el-button>
          </div>
          <el-empty v-if="sectionProducts.length === 0" description="暂无商品" :image-size="80" />
          <draggable
            v-else
            v-model="sectionProducts"
            item-key="id"
            @end="handleDragEnd"
            :disabled="!canEdit"
            class="products-grid"
            :animation="200"
          >
            <template #item="{ element: product }">
              <div class="product-card">
                  <div v-if="canEdit" class="product-remove" @click="removeProduct(product)">
                    <i class="fas fa-times"></i>
                  </div>
                  <img :src="getImageUrl(product.main_image)" :alt="product.brand_name" />
                  <div class="product-details">
                    <p class="product-name">{{ product.model_name }} {{ product.color_name }}</p>
                    <p class="product-price">¥{{ product.min_price || product.sale_price }}</p>
                  </div>
                  <div class="drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                  </div>
                </div>
              </template>
            </draggable>
        </div>
      </div>
      <template #footer>
        <el-button type="default" @click="showProductsDialog = false">取消</el-button>
        <el-button v-if="canEdit" type="primary" @click="saveProducts" :loading="savingProducts">保存</el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import { PermissionDenied } from '@/components/base'
import draggable from 'vuedraggable'
import {
  getAllHomeSections,
  createHomeSection,
  updateHomeSection,
  deleteHomeSection,
  getSectionProducts,
  addProductToSection,
  removeProductFromSection,
  clearSectionProducts,
  updateProductSort,
  searchProducts as apiSearchProducts
} from '@/api/home-sections'
import type { HomeSection, HomeSectionProduct, SearchProduct } from '@/api/home-sections'
import { formatImageUrl } from '@/utils/format'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { logger } from '@/utils/logger'
import type { HeaderAction } from '@/types'
const router = useRouter()
const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('h5-admin-home-sections')

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

const { loading } = useLoadingState()
const sections = ref<HomeSection[]>([])
const showCreateDialog = ref(false)
const showProductsDialog = ref(false)
const editingSection = ref<HomeSection | null>(null)
const currentSection = ref<HomeSection | null>(null)
const selectedTemplate = ref<string>('')

// 预设模板配置
const sectionTemplates: Record<string, { name: string; icon: string; key: string }> = {
  hot_recommend: { name: '热门推荐', icon: 'fas fa-fire', key: 'hot_recommend' },
  new_phones: { name: '全新机', icon: 'fas fa-mobile-alt', key: 'new_phones' },
  used_phones: { name: '二手机', icon: 'fas fa-recycle', key: 'used_phones' },
  quality_used: { name: '原装靓机', icon: 'fas fa-certificate', key: 'quality_used' },
  new_arrivals: { name: '新品上架', icon: 'fas fa-star', key: 'new_arrivals' },
  flash_sale: { name: '限时特惠', icon: 'fas fa-bolt', key: 'flash_sale' },
  brand_exclusive: { name: '品牌专卖', icon: 'fas fa-crown', key: 'brand_exclusive' }
}
const sectionProducts = ref<HomeSectionProduct[]>([])
const saving = ref(false)
const savingProducts = ref(false)
const searchKeyword = ref('')
const productType = ref<'all' | 'new' | 'used'>('all')
const availableProducts = ref<SearchProduct[]>([])
const canEditSectionForm = computed(() => editingSection.value ? canEdit.value : canCreate.value)

const sectionForm = ref({
  section_key: '',
  section_name: '',
  section_type: 'products' as 'products' | 'banner' | 'custom',
  icon: 'fas fa-list',
  product_limit: 10,
  fill_count: 0,
  sort_order: 0,
  is_enabled: true,
  auto_fill: false
})

const openCreateDialog = () => {
  if (!canCreate.value) {
    handleNoPermission('create')
    return
  }

  editingSection.value = null
  selectedTemplate.value = ''
  sectionForm.value = {
    section_key: '',
    section_name: '',
    section_type: 'products',
    icon: 'fas fa-list',
    product_limit: 10,
    fill_count: 0,
    sort_order: 0,
    is_enabled: true,
    auto_fill: false
  }
  showCreateDialog.value = true
}

// 获取图片URL - 使用统一的图片URL处理函数
const getImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%23f5f5f5%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2216%22%3ENo Image%3C/text%3E%3C/svg%3E'
  return formatImageUrl(imageUrl)
}

// 加载推荐区域列表
const loadSections = async () => {
  if (!canView.value) {
    sections.value = []
    loading.value = false
    return
  }

  loading.value = true
  try {
    const response = await getAllHomeSections()
    // response 格式: { success: true, data: [...] }
    const data = response.data || response || []
    // 转换数据格式，确保布尔值正确
    sections.value = (Array.isArray(data) ? data : []).map((section: any) => ({
      ...section,
      is_enabled: Boolean(section.is_enabled),
      auto_fill: Boolean(section.auto_fill)
    }))

    // 加载每个区域的部分商品用于预览
    for (const section of sections.value) {
      if (section.product_count && section.product_count > 0) {
        try {
          const response = await getSectionProducts(section.id)
          const data = response.data || response || []
          const products = Array.isArray(data) ? data : []
          section.products = products.slice(0, 4)
        } catch (error) {
          logger.error('获取区域商品失败:', error)
          section.products = []
        }
      }
    }
  } catch (error) {
    logger.error('加载推荐区域失败:', error)
    ElMessage.error('加载推荐区域失败')
  } finally {
    loading.value = false
  }
}

// 切换区域启用状态
const toggleSection = async (section: HomeSection) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    section.is_enabled = !section.is_enabled
    return
  }

  try {
    // 确保 section 对象有效
    if (!section || !section.id) {
      throw new Error('无效的区域对象')
    }
    await updateHomeSection(section.id, section)
    ElMessage.success(section.is_enabled ? '已启用' : '已禁用')
  } catch (error) {
    logger.error('更新区域状态失败:', error)
    ElMessage.error('操作失败')
    // 恢复原状态
    if (section) {
      section.is_enabled = !section.is_enabled
    }
  }
}

// 编辑区域
const editSection = (section: HomeSection) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  editingSection.value = section
  sectionForm.value = {
    section_key: section.section_key,
    section_name: section.section_name,
    section_type: section.section_type,
    icon: section.icon,
    product_limit: section.product_limit,
    fill_count: section.fill_count || 0,
    sort_order: section.sort_order,
    is_enabled: Boolean(section.is_enabled),
    auto_fill: Boolean(section.auto_fill)
  }
  showCreateDialog.value = true
}

// 删除区域
const deleteSection = (section: HomeSection) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  ElMessageBox.confirm(
    `确定要删除推荐区域"${section.section_name}"吗？`,
    '删除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await deleteHomeSection(section.id)
      ElMessage.success('删除成功')
      loadSections()
    } catch (error) {
      logger.error('删除区域失败:', error)
      ElMessage.error('删除失败')
    }
  })
}

// 保存区域
const saveSection = async () => {
  const action = editingSection.value ? 'edit' : 'create'
  const allowed = editingSection.value ? canEdit.value : canCreate.value
  if (!allowed) {
    handleNoPermission(action)
    return
  }

  if (!sectionForm.value.section_key || !sectionForm.value.section_name) {
    ElMessage.warning('请填写完整信息')
    return
  }

  saving.value = true
  try {
    if (editingSection.value) {
      await updateHomeSection(editingSection.value.id, sectionForm.value)
      ElMessage.success('更新成功')
    } else {
      await createHomeSection(sectionForm.value)
      ElMessage.success('创建成功')
    }
    showCreateDialog.value = false
    loadSections()
  } catch (error: any) {
    logger.error('保存区域失败:', error)
    ElMessage.error(error.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 管理商品
const manageProducts = async (section: HomeSection) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  currentSection.value = section
  loading.value = true
  try {
    const response = await getSectionProducts(section.id)
    // response 格式: { success: true, data: [...] }
    const data = response.data || response || []
    // 确保 data 是数组
    sectionProducts.value = Array.isArray(data) ? data : []

    // 加载可选商品列表
    await loadAvailableProducts()
  } catch (error) {
    logger.error('加载商品失败:', error)
    ElMessage.error('加载商品失败')
    sectionProducts.value = []
  } finally {
    loading.value = false
  }
  showProductsDialog.value = true
}

// 加载可选商品列表
const loadAvailableProducts = async () => {
  if (!canEdit.value) {
    availableProducts.value = []
    return
  }

  try {
    // 获取前50个商品作为可选商品
    const response = await apiSearchProducts('', productType.value)
    const data = response.data || response || []
    availableProducts.value = Array.isArray(data) ? data.slice(0, 50) : []
  } catch (error) {
    logger.error('加载可选商品失败:', error)
    availableProducts.value = []
  }
}

// 检查商品是否已添加
const isProductAdded = (product: SearchProduct) => {
  return sectionProducts.value.some(p => {
    if (product.template_id) {
      return p.template_id === product.template_id
    }
    if (product.phone_id) {
      return p.phone_id === product.phone_id
    }
    return false
  })
}

// 从可选商品添加
const addProductFromAvailable = async (product: SearchProduct) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  if (isProductAdded(product)) {
    ElMessage.info('商品已添加')
    return
  }

  try {
    await addProductToSection(currentSection.value!.id, {
      template_id: product.template_id,
      phone_id: product.phone_id,
      sort_order: sectionProducts.value.length
    })
    // 重新加载商品列表
    const response = await getSectionProducts(currentSection.value!.id)
    const data = response.data || response || []
    sectionProducts.value = Array.isArray(data) ? data : []
    searchKeyword.value = ''
    ElMessage.success('添加成功')
  } catch (error: any) {
    logger.error('添加商品失败:', error)
    ElMessage.error(error.response?.data?.message || '添加失败')
  }
}

// 搜索商品
const searchProducts = (queryString: string, cb: (data: any[]) => void) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    cb([])
    return
  }

  if (!queryString) {
    cb([])
    return
  }

  apiSearchProducts(queryString, productType.value)
    .then(response => {
      const data = response.data || response || []
      const results = Array.isArray(data) ? data : []
      cb(results)
    })
    .catch(error => {
      logger.error('搜索商品失败:', error)
      cb([])
    })
}

// 选择商品
const handleProductSelect = async (item: SearchProduct) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  try {
    await addProductToSection(currentSection.value!.id, {
      template_id: item.template_id,
      phone_id: item.phone_id,
      sort_order: sectionProducts.value.length
    })
    // 重新加载商品列表
    const response = await getSectionProducts(currentSection.value!.id)
    const data = response.data || response || []
    sectionProducts.value = Array.isArray(data) ? data : []
    searchKeyword.value = ''
    ElMessage.success('添加成功')
  } catch (error: any) {
    logger.error('添加商品失败:', error)
    ElMessage.error(error.response?.data?.message || '添加失败')
  }
}

// 移除商品
const removeProduct = (product: HomeSectionProduct) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  ElMessageBox.confirm(
    '确定要移除该商品吗？',
    '移除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await removeProductFromSection(currentSection.value!.id, product.id)
      sectionProducts.value = sectionProducts.value.filter(p => p.id !== product.id)
      ElMessage.success('移除成功')
    } catch (error) {
      logger.error('移除商品失败:', error)
      ElMessage.error('移除失败')
    }
  })
}

// 清空所有商品
const clearAllProducts = () => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  ElMessageBox.confirm(
    '确定要清空所有商品吗？',
    '清空确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await clearSectionProducts(currentSection.value!.id)
      sectionProducts.value = []
      ElMessage.success('清空成功')
    } catch (error) {
      logger.error('清空失败:', error)
      ElMessage.error('清空失败')
    }
  })
}

// 拖拽排序结束
const handleDragEnd = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  // 更新排序
  for (let i = 0; i < sectionProducts.value.length; i++) {
    const product = sectionProducts.value[i]
    if (product.sort_order !== i) {
      try {
        await updateProductSort(currentSection.value!.id, product.id, i)
        product.sort_order = i
      } catch (error) {
        logger.error('更新排序失败:', error)
      }
    }
  }
}

// 保存商品
const saveProducts = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  savingProducts.value = true
  try {
    showProductsDialog.value = false
    loadSections()
  } finally {
    savingProducts.value = false
  }
}

// 应用预设模板
const applyTemplate = () => {
  if (!canEditSectionForm.value) {
    handleNoPermission(editingSection.value ? 'edit' : 'create')
    return
  }

  if (!selectedTemplate.value) return

  const template = sectionTemplates[selectedTemplate.value]
  if (template) {
    sectionForm.value.section_key = template.key
    sectionForm.value.section_name = template.name
    sectionForm.value.icon = template.icon
    ElMessage.success(`已应用模板：${template.name}`)
  }
}

// 根据区域名称自动生成区域标识
const generateSectionKey = () => {
  if (!canEditSectionForm.value) {
    handleNoPermission(editingSection.value ? 'edit' : 'create')
    return
  }

  if (!sectionForm.value.section_name.trim()) {
    ElMessage.warning('请先输入区域名称')
    return
  }

  if (sectionForm.value.section_key && !confirm('是否重新生成区域标识？')) {
    return
  }

  // 中文转拼音的简单映射（常用字）
  const pinyinMap: Record<string, string> = {
    '热': 'hot', '门': 'gate', '推': 'recommend', '荐': 'recommend',
    '原': 'original', '装': 'original', '靓': 'quality', '机': 'phone',
    '新': 'new', '品': 'product', '上': 'arrive', '市': 'market',
    '优': 'quality', '惠': 'discount', '特': 'special', '价': 'price',
    '限': 'limit', '时': 'time', '抢': 'grab', '购': 'buy',
    '牌': 'brand', '专': 'exclusive', '卖': 'sell'
  }

  let key = sectionForm.value.section_name.trim()

  // 尝试拼音映射
  const mappedChars: string[] = []
  for (const char of key) {
    if (pinyinMap[char]) {
      mappedChars.push(pinyinMap[char])
    }
  }

  if (mappedChars.length >= 2) {
    // 使用拼音映射
    key = mappedChars.join('_')
  } else {
    // 使用拼音首字母或简单转换
    key = key
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
      .substring(0, 20)
  }

  // 确保只包含小写字母、数字和下划线
  key = key.toLowerCase().replace(/[^a-z0-9_]/g, '_')

  // 去除连续的下划线
  key = key.replace(/_+/g, '_').replace(/^_|_$/g, '')

  sectionForm.value.section_key = key
}

// 关闭对话框
const handleDialogClose = () => {
  editingSection.value = null
  selectedTemplate.value = ''
  sectionForm.value = {
    section_key: '',
    section_name: '',
    section_type: 'products',
    icon: 'fas fa-list',
    product_limit: 10,
    fill_count: 0,
    sort_order: 0,
    is_enabled: true,
    auto_fill: false
  }
}

const handleProductsDialogClose = () => {
  currentSection.value = null
  sectionProducts.value = []
  searchKeyword.value = ''
  availableProducts.value = []
}

onMounted(() => {
  if (canView.value) {
    loadSections()
  }
  // 注册头部操作按钮
  if (registerHeaderActions) {
    registerHeaderActions([
      ...(canCreate.value ? [{
        label: '添加推荐区域',
        type: 'primary' as const,
        icon: Plus,
        handler: () => openCreateDialog()
      }] : []),
      {
        label: '刷新',
        type: 'default',
        icon: Refresh,
        disabled: () => loading.value,
        handler: () => loadSections()
      }
    ])
  }
})

onUnmounted(() => {
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped lang="scss">
.home-sections-config-page {
  padding: 20px;
}

.loading-state {
  padding: 40px;
}

.sections-content {
  .sections-list {
    display: grid;
    gap: 16px;
  }

  .section-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .section-info {
        display: flex;
        align-items: center;
        gap: 12px;

        i {
          font-size: 24px;
          color: #667eea;
        }

        h4 {
          font-size: 16px;
          font-weight: 500;
          margin: 0 0 4px;
        }

        .section-key {
          font-size: 12px;
          color: #999;
          margin: 0;
        }
      }

      .section-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        i {
          font-size: 14px;
        }
      }
    }

    .section-products {
      border-top: 1px solid #f0f0f0;
      padding-top: 16px;

      .products-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-size: 14px;
        color: #666;

        .products-count-info {
          display: flex;
          align-items: center;
          gap: 12px;

          .main-count {
            font-weight: 500;
            color: #333;
          }

          .fill-info {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #667eea;
            background: #f0f4ff;
            padding: 2px 8px;
            border-radius: 12px;

            i {
              font-size: 11px;
            }
          }
        }
      }

      .products-preview {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 10px;

        .product-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 10px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          transition: all 0.2s;

          &:hover {
            border-color: #667eea;
            background: #f0f4ff;
            transform: translateY(-2px);
          }

          img {
            width: 100%;
            height: 80px;
            object-fit: cover;
            border-radius: 6px;
          }

          .product-info {
            flex: 1;
            width: 100%;
            min-width: 0;
            text-align: center;

            .product-name {
              font-size: 11px;
              color: #333;
              margin: 0 0 4px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .product-price {
              font-size: 13px;
              color: #ff1744;
              font-weight: 600;
              margin: 0;
            }
          }
        }
      }

      .no-products {
        text-align: center;
        padding: 20px;
        color: #999;
        font-size: 14px;
      }
    }
  }
}

.tip-text {
  font-size: 12px;
  color: #999;
  line-height: 1.6;

  p {
    margin: 2px 0;
  }
}

.products-manager {
  :deep(.unified-search-panel) {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }

  .products-list-section {
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-size: 14px;
      font-weight: 500;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 4px 8px 4px 4px;

      /* 自定义滚动条样式 */
      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;

        &:hover {
          background: #a8a8a8;
        }
      }

      .product-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 10px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: move;
        transition: all 0.3s;

        &:hover {
          border-color: #667eea;
          background: #f0f4ff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .product-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 4px;
          cursor: pointer;
          color: #999;
          z-index: 1;

          &:hover {
            background: #fee;
            color: #f56565;
          }
        }

        img {
          width: 100%;
          height: 80px;
          object-fit: cover;
          border-radius: 6px;
        }

        .product-details {
          flex: 1;
          width: 100%;
          min-width: 0;
          text-align: center;

          p {
            margin: 0 0 4px;
          }

          .product-name {
            font-size: 11px;
            color: #333;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 500;
          }

          .product-specs {
            font-size: 11px;
            color: #999;
          }

          .product-price {
            font-size: 13px;
            color: #ff1744;
            font-weight: 600;
          }
        }

        .drag-handle {
          position: absolute;
          bottom: 8px;
          left: 8px;
          color: #ccc;
          cursor: move;

          &:hover {
            color: #667eea;
          }
        }
      }
    }
  }
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;

  .product-thumb {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
  }

  .product-name {
    font-size: 14px;
    color: #333;
  }

  .product-price {
    font-size: 12px;
    color: #ff1744;
  }
}

// 可选商品区域样式
.available-products-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;

  .available-products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
    max-height: 400px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 8px 4px 4px;

    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;

      &:hover {
        background: #a8a8a8;
      }
    }
  }

  .available-product-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #667eea;
      background: #f0f4ff;
      transform: translateY(-2px);
    }

    &.is-added {
      background: #f0fdf4;
      border-color: #22c55e;
      opacity: 0.8;

      .added-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(34, 197, 94, 0.9);
        color: #fff;
        border-radius: 50%;
        font-size: 12px;
        z-index: 1;
      }
    }

    .product-thumb {
      width: 100%;
      height: 80px;
      object-fit: cover;
      border-radius: 6px;
    }

    .product-info {
      flex: 1;
      width: 100%;
      min-width: 0;
      text-align: center;

      .product-name {
        font-size: 11px;
        color: #333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-bottom: 4px;
      }

      .product-price {
        font-size: 13px;
        color: #ff1744;
        font-weight: 600;
        margin-bottom: 4px;
      }
    }
  }
}
</style>
