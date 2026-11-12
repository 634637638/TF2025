<!--
  HomeSectionsConfig - H5首页推荐配置页面
  功能：管理首页推荐区域和商品
-->
<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="h5-admin-home-sections"
    module-name="首页推荐"
    permission-code="home-sections:view"
  >
    <div class="home-sections-config-page">
      <!-- 加载状态 -->
      <SectionLoading
        v-if="loading && sections.length === 0"
        text="加载首页推荐中..."
        size="large"
      />

      <!-- 推荐区域列表 -->
      <div
        v-else
        v-tf-loading="{ active: loading, text: '正在刷新首页推荐...' }"
        class="sections-content"
      >
        <DataEmptyState
          v-if="sections.length === 0"
          description="暂无推荐区域"
        >
          <el-button
            v-if="canCreate"
            type="primary"
            @click="openCreateDialog"
          >
            新增
          </el-button>
        </DataEmptyState>

        <div
          v-else
          class="sections-list"
        >
          <div
            v-for="section in sections"
            :key="section.id"
            class="section-card"
          >
            <div class="section-header">
              <div class="section-info">
                <IconRenderer
                  v-if="canViewField('section.icon')"
                  :icon="section.icon || 'fas fa-list'"
                />
                <div v-if="canViewField('section.section_name') || canViewField('section.section_key')">
                  <h4 v-if="canViewField('section.section_name')">
                    {{ section.section_name }}
                  </h4>
                  <p
                    v-if="canViewField('section.section_key')"
                    class="section-key"
                  >
                    {{ section.section_key }}
                  </p>
                </div>
              </div>
              <div
                v-if="showActionColumn"
                class="section-actions"
              >
                <el-switch
                  v-if="canViewField('section.is_enabled')"
                  v-model="section.is_enabled"
                  :disabled="!canEdit"
                  active-text="启用"
                  inactive-text="禁用"
                  @change="() => toggleSection(section)"
                />
                <el-button
                  v-if="canEdit"
                  plain
                  type="primary"
                  size="small"
                  class="btn-sm"
                  @click="editSection(section)"
                >
                  <i class="fas fa-edit mr-1" />编辑
                </el-button>
                <el-button
                  v-if="canDelete"
                  plain
                  type="danger"
                  size="small"
                  class="btn-sm"
                  @click="deleteSection(section)"
                >
                  <i class="fas fa-trash mr-1" />删除
                </el-button>
              </div>
            </div>

            <!-- 商品列表 -->
            <div class="section-products">
              <div
                v-if="canViewField('products.product_info') || shouldShowActionColumn(canViewField('system_info.operations'), [canEdit, canDelete])"
                class="products-header"
              >
                <div class="products-count-info">
                  <span
                    v-if="canViewField('products.product_info')"
                    class="main-count"
                  >推荐商品 ({{ section.product_count || 0 }}/{{ section.product_limit }})</span>
                </div>
                <el-button
                  v-if="canEdit"
                  plain
                  type="primary"
                  size="small"
                  class="btn-sm"
                  @click="manageProducts(section)"
                >
                  <i class="fas fa-cog mr-1" />管理
                </el-button>
              </div>
              <div
                v-if="canViewField('products.product_info') && section.products && section.products.length > 0"
                class="products-preview"
              >
                <div
                  v-for="product in section.products"
                  :key="product.id"
                  class="product-item"
                >
                  <img
                    v-if="product.main_image"
                    :src="getImageUrl(product.main_image)"
                    :alt="product.brand_name"
                  >
                  <div class="product-info">
                    <p class="product-name">
                      {{ product.brand_name }} {{ product.model_name }}
                    </p>
                    <p
                      v-if="canViewField('products.product_info')"
                      class="product-price"
                    >
                      ¥{{ formatAmount(product.min_price || product.sale_price) }}
                    </p>
                  </div>
                </div>
              </div>
              <DataEmptyState
                v-else-if="canViewField('products.product_info')"
                size="compact"
                description="暂无推荐商品"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 创建/编辑推荐区域对话框 -->
      <MobileDialog
        v-model="showCreateDialog"
        :title="editingSection ? '编辑推荐区域' : '新增'"
        width="550px"
        dialog-class="home-section-dialog"
        :show-default-footer="false"
        :close-on-click-modal="false"
        @close="handleDialogClose"
      >
        <el-form
          :model="sectionForm"
          label-width="100px"
          :disabled="!canEditSectionForm"
          class="home-section-form"
        >
          <!-- 快捷模板选择 -->
          <el-form-item
            v-if="canViewField('section.section_name') || canViewField('section.section_key')"
            label="快捷模板"
          >
            <el-select
              v-model="selectedTemplate"
              placeholder="选择模板快速创建（可选）"
              clearable
              :disabled="!!editingSection"
              class="w-full"
              @change="applyTemplate"
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
                <el-option
                  label="全新机"
                  value="new_phones"
                >
                  <span>全新机</span>
                  <span class="float-right text-secondary text-xs">new_phones</span>
                </el-option>
                <el-option
                  label="工作机"
                  value="used_phones"
                >
                  <span>工作机</span>
                  <span class="float-right text-secondary text-xs">used_phones</span>
                </el-option>
                <el-option
                  label="原装靓机"
                  value="quality_used"
                >
                  <span>原装靓机</span>
                  <span class="float-right text-secondary text-xs">quality_used</span>
                </el-option>
              </el-option-group>
              <el-option-group label="⭐ 特色商品">
                <el-option
                  label="新品上架"
                  value="new_arrivals"
                >
                  <span>新品上架</span>
                  <span class="float-right text-secondary text-xs">new_arrivals</span>
                </el-option>
                <el-option
                  label="限时特惠"
                  value="flash_sale"
                >
                  <span>限时特惠</span>
                  <span class="float-right text-secondary text-xs">flash_sale</span>
                </el-option>
                <el-option
                  label="品牌专卖"
                  value="brand_exclusive"
                >
                  <span>品牌专卖</span>
                  <span class="float-right text-secondary text-xs">brand_exclusive</span>
                </el-option>
              </el-option-group>
            </el-select>
            <template #tip>
              <span class="tip-text">💡 选择模板会自动填充区域标识和名称</span>
            </template>
          </el-form-item>

          <el-divider content-position="left">
            或手动填写
          </el-divider>

          <el-form-item
            v-if="canViewField('section.section_key')"
            label="区域标识"
            required
          >
            <el-input
              v-model="sectionForm.section_key"
              placeholder="如：hot_recommend"
              :disabled="!!editingSection"
            >
              <template #append>
                <el-button
                  :disabled="!!editingSection"
                  title="根据区域名称自动生成"
                  @click="generateSectionKey"
                >
                  <i class="fas fa-magic" />
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
          <el-form-item
            v-if="canViewField('section.section_name')"
            label="区域名称"
            required
          >
            <el-input
              v-model="sectionForm.section_name"
              placeholder="如：热门推荐"
              @blur="editingSection ? null : generateSectionKey()"
            />
            <template #tip>
              <span class="tip-text">用户看到的名称，可以随时修改</span>
            </template>
          </el-form-item>
          <el-form-item
            v-if="canViewField('section.icon')"
            label="图标"
          >
            <el-input
              v-model="sectionForm.icon"
              placeholder="如：fas fa-fire"
            >
              <template #prepend>
                <IconRenderer :icon="sectionForm.icon || 'fas fa-list'" />
              </template>
            </el-input>
          </el-form-item>
          <el-form-item
            v-if="canViewField('section.product_limit')"
            label="显示数量"
          >
            <el-input-number
              v-model="sectionForm.product_limit"
              :min="1"
              :max="50"
              :controls="false"
            />
            <template #tip>
              <span class="tip-text">同时显示的商品数量，只展示后台已选择且仍有效的商品。</span>
            </template>
          </el-form-item>
          <el-form-item
            v-if="canViewField('section.sort_order')"
            label="排序"
          >
            <el-input-number
              v-model="sectionForm.sort_order"
              :min="0"
              :controls="false"
            />
            <template #tip>
              <span class="tip-text">数值越小越靠前</span>
            </template>
          </el-form-item>
          <el-form-item
            v-if="canViewField('section.is_enabled')"
            label="状态"
          >
            <el-switch
              v-model="sectionForm.is_enabled"
              active-text="启用"
              inactive-text="禁用"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="tf-dialog-actions">
            <el-button
              type="default"
              @click="showCreateDialog = false"
            >
              取消
            </el-button>
            <el-button
              v-if="canEditSectionForm"
              type="primary"
              :loading="saving"
              @click="saveSection"
            >
              保存
            </el-button>
          </div>
        </template>
      </MobileDialog>

      <!-- 管理商品对话框 -->
      <MobileDialog
        v-model="showProductsDialog"
        :title="`管理商品 - ${currentSection?.section_name}`"
        width="900px"
        dialog-class="home-section-products-dialog"
        :show-default-footer="false"
        :close-on-click-modal="!canEdit"
        @close="handleProductsDialogClose"
      >
        <div
          v-if="currentSection"
          class="products-manager"
        >
          <UnifiedSearchPanel
            v-if="canViewField('products.product_search')"
            :expanded="true"
            :loading="productSearchLoading"
            @search="loadAvailableProducts"
            @reset="resetProductSearch"
          >
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
                    <img
                      v-if="item.main_image"
                      :src="getImageUrl(item.main_image)"
                      class="product-thumb"
                    >
                    <div>
                      <div class="product-name">
                        {{ item.display_text }}
                      </div>
                      <div
                        v-if="item.price"
                        class="product-price"
                      >
                        ¥{{ formatAmount(item.price) }}
                      </div>
                    </div>
                  </div>
                </template>
              </el-autocomplete>
            </template>
            <div class="form-group filter-item">
              <el-select
                v-model="productType"
                placeholder="商品类型"
                class="w-28"
                :disabled="!canEdit"
                @change="loadAvailableProducts"
              >
                <el-option
                  label="全部"
                  value="all"
                />
                <el-option
                  label="全新机"
                  value="new"
                />
                <el-option
                  label="二手机"
                  value="used"
                />
              </el-select>
            </div>
          </UnifiedSearchPanel>

          <!-- 可选商品列表 -->
          <div
            v-if="canViewField('products.product_info')"
            class="available-products-section"
          >
            <div class="list-header">
              <span>可选商品 ({{ availableProducts.length }})</span>
              <el-button
                text
                size="small"
                :disabled="!canEdit"
                @click="loadAvailableProducts"
              >
                <i class="fas fa-sync" />
                <span>刷新</span>
              </el-button>
            </div>
            <DataEmptyState
              v-if="availableProducts.length === 0"
              description="暂无商品"
              :image-size="60"
            />
            <div
              v-else
              class="available-products-grid"
            >
              <div
                v-for="product in availableProducts"
                :key="product.template_id || product.phone_id"
                class="available-product-card"
                :class="{ 'is-added': isProductAdded(product) }"
                @click="addProductFromAvailable(product)"
              >
                <img
                  v-if="product.main_image"
                  :src="getImageUrl(product.main_image)"
                  class="product-thumb"
                >
                <div class="product-info">
                  <div class="product-name">
                    {{ product.model_name }} {{ product.color_name }}
                  </div>
                  <div
                    v-if="product.price"
                    class="product-price"
                  >
                    ¥{{ formatAmount(product.price) }}
                  </div>
                </div>
                <div
                  v-if="isProductAdded(product)"
                  class="added-badge"
                >
                  <i class="fas fa-check" />
                </div>
              </div>
            </div>
          </div>

          <!-- 已添加的商品列表 -->
          <div
            v-if="canViewField('products.product_info') || shouldShowActionColumn(canViewField('system_info.operations'), [canEdit, canDelete])"
            class="products-list-section"
          >
            <div class="list-header">
              <span>已添加商品 ({{ sectionProducts.length }})</span>
              <el-button
                v-if="canDelete"
                plain
                type="danger"
                size="small"
                class="btn-sm"
                @click="clearAllProducts"
              >
                <i class="fas fa-trash mr-1" />清空
              </el-button>
            </div>
            <DataEmptyState
              v-if="sectionProducts.length === 0"
              description="暂无商品"
              :image-size="80"
            />
            <draggable
              v-else
              v-model="sectionProducts"
              item-key="id"
              :disabled="!canEdit"
              class="products-grid"
              :animation="200"
              @end="handleDragEnd"
            >
              <template #item="{ element: product }">
                <div class="product-card">
                  <div
                    v-if="canEdit"
                    class="product-remove"
                    @click="removeProduct(product)"
                  >
                    <i class="fas fa-times" />
                  </div>
                  <img
                    v-if="product.main_image && canViewField('products.product_info')"
                    :src="getImageUrl(product.main_image)"
                    :alt="product.brand_name"
                  >
                  <div
                    v-if="canViewField('products.product_info')"
                    class="product-details"
                  >
                    <p class="product-name">
                      {{ product.model_name }} {{ product.color_name }}
                    </p>
                    <p class="product-price">
                      ¥{{ formatAmount(product.min_price || product.sale_price) }}
                    </p>
                  </div>
                  <div class="drag-handle">
                    <i class="fas fa-grip-vertical" />
                  </div>
                </div>
              </template>
            </draggable>
          </div>
        </div>
        <template #footer>
          <div class="tf-dialog-actions">
            <el-button
              type="default"
              @click="showProductsDialog = false"
            >
              取消
            </el-button>
            <el-button
              v-if="canEdit"
              type="primary"
              :loading="savingProducts"
              @click="saveProducts"
            >
              保存
            </el-button>
          </div>
        </template>
      </MobileDialog>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { ref, onMounted, onUnmounted, onActivated, computed, inject, watch } from 'vue'

import { Refresh, Plus } from '@element-plus/icons-vue'
import UnifiedSearchPanel from '@/components/search/UnifiedSearchPanel.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import { PermissionGate } from '@/components/base'
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
import { formatImageUrl, formatAmount } from '@/utils/format'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { useLoadingState } from '@/composables'
import { useNotification } from '@/composables/useNotification'
import { logger } from '@/utils/logger'
import { getRequestErrorMessage } from '@/utils/api-response'
import type { HeaderAction } from '@/types'
const globalNotifications = useNotification()

const homeSectionPermissions = usePagePermissions('h5-admin-home-sections')
const { confirm } = useNotification()
const { handleNoPermission } = homeSectionPermissions
const canView = computed(() => homeSectionPermissions.canView.value)
const canCreate = computed(() => homeSectionPermissions.canCreate.value)
const canEdit = computed(() => homeSectionPermissions.canEdit.value)
const canDelete = computed(() => homeSectionPermissions.canDelete.value)
const HOME_SECTIONS_MODULE_KEY = 'h5_admin_home_sectionsview'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(HOME_SECTIONS_MODULE_KEY, fieldKey)
const showActionColumn = computed(() => shouldShowActionColumn(
  canViewField('system_info.operations'),
  [canEdit.value, canDelete.value]
))

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(_actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

const { loading } = useLoadingState()
const hasInitializedPageData = ref(false)
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
  used_phones: { name: '工作机', icon: 'fas fa-recycle', key: 'used_phones' },
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
const productSearchLoading = ref(false)
const availableProducts = ref<SearchProduct[]>([])
const canEditSectionForm = computed(() => editingSection.value ? canEdit.value : canCreate.value)

const sectionForm = ref({
  section_key: '',
  section_name: '',
  section_type: 'products' as 'products' | 'banner' | 'custom',
  icon: 'fas fa-list',
  product_limit: 10,
  sort_order: 0,
  is_enabled: true
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
    sort_order: 0,
    is_enabled: true
  }
  showCreateDialog.value = true
}

// 获取图片URL - 使用统一的图片URL处理函数
const getImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return ''
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
    sections.value = (Array.isArray(data) ? data as HomeSection[] : []).map((section: HomeSection) => ({
      id: section.id,
      section_key: section.section_key,
      section_name: section.section_name,
      section_type: section.section_type,
      icon: section.icon,
      is_enabled: Boolean(section.is_enabled),
      sort_order: section.sort_order,
      product_limit: section.product_limit,
      product_count: section.product_count
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
    globalNotifications.error('加载推荐区域失败')
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
    if (!canViewField('section.is_enabled')) {
      section.is_enabled = !section.is_enabled
      return
    }
    await updateHomeSection(section.id, { id: section.id, is_enabled: section.is_enabled })
    globalNotifications.success(section.is_enabled ? '已启用' : '已禁用')
  } catch (error) {
    logger.error('更新区域状态失败:', error)
    globalNotifications.error('操作失败')
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
    sort_order: section.sort_order,
    is_enabled: Boolean(section.is_enabled)
  }
  showCreateDialog.value = true
}

// 删除区域
const deleteSection = (section: HomeSection) => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  confirmAction(
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
      globalNotifications.success('删除成功')
      loadSections()
    } catch (error) {
      logger.error('删除区域失败:', error)
      globalNotifications.error('删除失败')
    }
  })
}

// 保存区域
const saveSection = async () => {
  if (saving.value) return

  const action = editingSection.value ? 'edit' : 'create'
  const allowed = editingSection.value ? canEdit.value : canCreate.value
  if (!allowed) {
    handleNoPermission(action)
    return
  }

  if (!sectionForm.value.section_key || !sectionForm.value.section_name) {
    globalNotifications.warning('请填写完整信息')
    return
  }

  saving.value = true
  try {
    const fieldMap: Record<string, string> = {
      section_key: 'section.section_key',
      section_name: 'section.section_name',
      section_type: 'section.section_key',
      icon: 'section.icon',
      product_limit: 'section.product_limit',
      sort_order: 'section.sort_order',
      is_enabled: 'section.is_enabled'
    }
    const payload = Object.fromEntries(Object.entries(sectionForm.value).filter(([key]) => (
      canViewField(fieldMap[key] || key)
    )))
    if (editingSection.value) {
      await updateHomeSection(editingSection.value.id, payload)
      globalNotifications.success('更新成功')
    } else {
      await createHomeSection(payload)
      globalNotifications.success('创建成功')
    }
    showCreateDialog.value = false
    loadSections()
  } catch (error: unknown) {
    logger.error('保存区域失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '保存失败'))
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
    globalNotifications.error('加载商品失败')
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

  productSearchLoading.value = true
  try {
    const response = await apiSearchProducts(searchKeyword.value.trim(), productType.value)
    const data = response.data || response || []
    availableProducts.value = Array.isArray(data) ? data.slice(0, 50) : []
  } catch (error) {
    logger.error('加载可选商品失败:', error)
    availableProducts.value = []
  } finally {
    productSearchLoading.value = false
  }
}

const resetProductSearch = async () => {
  searchKeyword.value = ''
  await loadAvailableProducts()
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
    globalNotifications.info('商品已添加')
    return
  }

  const section = currentSection.value
  if (!section) {
    globalNotifications.warning('推荐区域信息已失效，请重新打开')
    return
  }

  try {
    await addProductToSection(section.id, {
      template_id: product.template_id,
      phone_id: product.phone_id,
      sort_order: sectionProducts.value.length
    })
    // 重新加载商品列表
    const response = await getSectionProducts(section.id)
    const data = response.data || response || []
    sectionProducts.value = Array.isArray(data) ? data : []
    searchKeyword.value = ''
    globalNotifications.success('添加成功')
  } catch (error: unknown) {
    logger.error('添加商品失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '添加失败'))
  }
}

// 搜索商品
const searchProducts = (queryString: string, cb: (_data: SearchProduct[]) => void) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    cb([])
    return
  }

  if (!queryString) {
    cb([])
    return
  }

  productSearchLoading.value = true
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
    .finally(() => {
      productSearchLoading.value = false
    })
}

const getSelectedProductIdentity = (item: unknown) => {
  if (!item || typeof item !== 'object') return null
  const record = item as { template_id?: unknown, phone_id?: unknown }
  const templateId = Number(record.template_id)
  const phoneId = Number(record.phone_id)
  if (!Number.isInteger(templateId) && !Number.isInteger(phoneId)) return null
  return {
    template_id: Number.isInteger(templateId) ? templateId : undefined,
    phone_id: Number.isInteger(phoneId) ? phoneId : undefined
  }
}

// 选择商品
const handleProductSelect = async (item: unknown) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  const selectedProduct = getSelectedProductIdentity(item)
  if (!selectedProduct) {
    globalNotifications.warning('商品数据无效，请重新搜索')
    return
  }

  const section = currentSection.value
  if (!section) {
    globalNotifications.warning('推荐区域信息已失效，请重新打开')
    return
  }

  try {
    await addProductToSection(section.id, {
      template_id: selectedProduct.template_id,
      phone_id: selectedProduct.phone_id,
      sort_order: sectionProducts.value.length
    })
    // 重新加载商品列表
    const response = await getSectionProducts(section.id)
    const data = response.data || response || []
    sectionProducts.value = Array.isArray(data) ? data : []
    searchKeyword.value = ''
    globalNotifications.success('添加成功')
  } catch (error: unknown) {
    logger.error('添加商品失败:', error)
    globalNotifications.error(getRequestErrorMessage(error, '添加失败'))
  }
}

// 移除商品
const removeProduct = (product: HomeSectionProduct) => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  confirmAction(
    '确定要移除该商品吗？',
    '移除确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    const section = currentSection.value
    if (!section) {
      globalNotifications.warning('推荐区域信息已失效，请重新打开')
      return
    }

    try {
      await removeProductFromSection(section.id, product.id)
      sectionProducts.value = sectionProducts.value.filter(p => p.id !== product.id)
      globalNotifications.success('移除成功')
    } catch (error) {
      logger.error('移除商品失败:', error)
      globalNotifications.error('移除失败')
    }
  })
}

// 清空所有商品
const clearAllProducts = () => {
  if (!canDelete.value) {
    handleNoPermission('delete')
    return
  }

  confirmAction(
    '确定要清空所有商品吗？',
    '清空确认',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    const section = currentSection.value
    if (!section) {
      globalNotifications.warning('推荐区域信息已失效，请重新打开')
      return
    }

    try {
      await clearSectionProducts(section.id)
      sectionProducts.value = []
      globalNotifications.success('清空成功')
    } catch (error) {
      logger.error('清空失败:', error)
      globalNotifications.error('清空失败')
    }
  })
}

// 拖拽排序结束
const handleDragEnd = async () => {
  if (!canEdit.value) {
    handleNoPermission('edit')
    return
  }

  const section = currentSection.value
  if (!section) {
    globalNotifications.warning('推荐区域信息已失效，请重新打开')
    return
  }

  // 更新排序
  for (let i = 0; i < sectionProducts.value.length; i++) {
    const product = sectionProducts.value[i]
    if (product.sort_order !== i) {
      try {
        await updateProductSort(section.id, product.id, i)
        product.sort_order = i
      } catch (error) {
        logger.error('更新排序失败:', error)
      }
    }
  }
}

// 保存商品
const saveProducts = async () => {
  if (savingProducts.value) return

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
    globalNotifications.success(`已应用模板：${template.name}`)
  }
}

// 根据区域名称自动生成区域标识
const generateSectionKey = async () => {
  if (!canEditSectionForm.value) {
    handleNoPermission(editingSection.value ? 'edit' : 'create')
    return
  }

  if (!sectionForm.value.section_name.trim()) {
    globalNotifications.warning('请先输入区域名称')
    return
  }

  if (sectionForm.value.section_key && !(await confirm('是否重新生成区域标识？', '重新生成确认', {
    type: 'warning',
    confirmButtonText: '重新生成',
    cancelButtonText: '取消'
  }))) {
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
    sort_order: 0,
    is_enabled: true
  }
}

const handleProductsDialogClose = () => {
  currentSection.value = null
  sectionProducts.value = []
  searchKeyword.value = ''
  availableProducts.value = []
}

const initializePageData = async () => {
  if (!canView.value) {
    loading.value = false
    return
  }

  if (hasInitializedPageData.value) {
    return
  }

  hasInitializedPageData.value = true
  await loadSections()
}

const registerPageHeaderActions = () => {
  if (registerHeaderActions) {
    registerHeaderActions([
      ...(canCreate.value ? [{
        label: '新增',
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
}

watch(canView, (allowed) => {
  if (allowed) {
    void initializePageData()
  }
})

watch(canCreate, () => {
  registerPageHeaderActions()
})

onMounted(() => {
  void fieldPermissions.init()
  void initializePageData()
  registerPageHeaderActions()
})

// KeepAlive 切换回来时重新注册当前页面的头部操作
onActivated(() => {
  registerPageHeaderActions()
})

onUnmounted(() => {
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped lang="scss" src="./styles/home-sections/sections.scss"></style>
<style scoped lang="scss" src="./styles/home-sections/products.scss"></style>
<style scoped lang="scss" src="./styles/home-sections/product-picker.scss"></style>
<style scoped lang="scss" src="./styles/home-sections/responsive.scss"></style>
