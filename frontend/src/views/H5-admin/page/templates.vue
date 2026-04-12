<template>
  <PermissionDenied
    v-if="!canView"
    :can-view="canView"
    module-key="h5-admin-templates"
    module-name="商城模板"
    permission-code="h5-templates:view"
  />

  <div v-else class="template-management-page">
    <el-card class="toolbar-card" shadow="never">
      <div class="toolbar search-toolbar">
        <div class="search-panel">
          <div class="search-panel-main">
            <el-input
              v-model="keyword"
              placeholder="输入品牌、型号或颜色关键词"
              clearable
              class="search-input"
              size="large"
            >
              <template #prefix>
                <i class="fas fa-search"></i>
              </template>
            </el-input>

            <div class="search-panel-meta">
              <span>当前共 {{ groupedTemplates.length }} 组母模板</span>
              <span v-if="keyword">匹配 {{ filteredGroups.length }} 组结果</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="table-card" shadow="never" v-loading="loading">
      <div v-if="keyword" class="sort-tip">
        搜索结果仅用于筛选查看，清空搜索后可拖拽排序母模板。
      </div>

      <div v-if="filteredGroups.length > 0" class="group-table-header">
        <div>商品</div>
        <div class="center">颜色数</div>
        <div class="center">启用</div>
        <div class="center">在库</div>
        <div class="center">排序参考</div>
        <div class="center">操作</div>
      </div>

      <draggable
        v-if="!keyword && groupedTemplates.length > 0"
        v-model="groupedTemplates"
        item-key="groupKey"
        handle=".group-drag-handle"
        :disabled="!canEdit"
        class="group-list"
        @end="handleGroupDragEnd"
      >
        <template #item="{ element: row }">
          <div class="group-row">
            <div class="group-main">
              <div class="group-drag-handle" title="拖拽排序">
                <i class="fas fa-grip-vertical"></i>
              </div>
              <div class="product-cell">
                <img
                  v-if="row.main_image && !isVideoMedia({ image_url: row.main_image, image_type: row.main_media_type })"
                  :src="getImageUrl(row.main_image)"
                  :alt="row.display_name"
                  class="product-cover"
                />
                <video
                  v-else-if="row.main_image"
                  :src="getImageUrl(row.main_image)"
                  class="product-cover"
                  muted
                  playsinline
                  preload="metadata"
                />
                <div v-else class="product-cover placeholder">
                  <i class="fas fa-mobile-alt"></i>
                </div>
                <div class="product-meta">
                  <div class="product-title">{{ row.display_name }}</div>
                  <div class="product-subtitle">品牌 {{ row.brand_name || '-' }} / 型号 {{ row.model_name || '-' }}</div>
                  <div class="color-tags">
                    <el-tag
                      v-for="child in row.templates"
                      :key="child.localKey"
                      size="small"
                      :type="child.is_active ? 'success' : 'info'"
                    >
                      {{ child.color_name || `颜色#${child.color_id}` }}
                    </el-tag>
                  </div>
                </div>
              </div>
            </div>

            <div class="group-stat center"><strong>{{ row.templates.length }}</strong></div>
            <div class="group-stat center">{{ row.active_count }}/{{ row.templates.length }}</div>
            <div class="group-stat center">{{ row.total_stock }}</div>
            <div class="group-stat center">{{ row.sort_order }}</div>
            <div class="group-actions center">
              <div class="action-buttons">
                <el-button v-if="canEdit" link type="primary" @click="openEditDialog(row)">编辑</el-button>
                <el-button v-if="canDelete" link type="danger" @click="handleDeleteGroup(row)">删除整组</el-button>
              </div>
            </div>
          </div>
        </template>
      </draggable>

      <div v-else-if="filteredGroups.length > 0" class="group-list">
        <div
          v-for="row in filteredGroups"
          :key="row.groupKey"
          class="group-row"
        >
          <div class="group-main">
            <div class="group-drag-handle disabled" title="清空搜索后可拖拽">
              <i class="fas fa-grip-vertical"></i>
            </div>
            <div class="product-cell">
              <img
                v-if="row.main_image && !isVideoMedia({ image_url: row.main_image, image_type: row.main_media_type })"
                :src="getImageUrl(row.main_image)"
                :alt="row.display_name"
                class="product-cover"
              />
              <video
                v-else-if="row.main_image"
                :src="getImageUrl(row.main_image)"
                class="product-cover"
                muted
                playsinline
                preload="metadata"
              />
              <div v-else class="product-cover placeholder">
                <i class="fas fa-mobile-alt"></i>
              </div>
              <div class="product-meta">
                <div class="product-title">{{ row.display_name }}</div>
                <div class="product-subtitle">品牌 {{ row.brand_name || '-' }} / 型号 {{ row.model_name || '-' }}</div>
                <div class="color-tags">
                  <el-tag
                    v-for="child in row.templates"
                    :key="child.localKey"
                    size="small"
                    :type="child.is_active ? 'success' : 'info'"
                  >
                    {{ child.color_name || `颜色#${child.color_id}` }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>

          <div class="group-stat center"><strong>{{ row.templates.length }}</strong></div>
          <div class="group-stat center">{{ row.active_count }}/{{ row.templates.length }}</div>
          <div class="group-stat center">{{ row.total_stock }}</div>
          <div class="group-stat center">{{ row.sort_order }}</div>
          <div class="group-actions center">
            <div class="action-buttons">
              <el-button v-if="canEdit" link type="primary" @click="openEditDialog(row)">编辑</el-button>
              <el-button v-if="canDelete" link type="danger" @click="handleDeleteGroup(row)">删除整组</el-button>
            </div>
          </div>
        </div>
      </div>

      <el-empty v-if="!loading && filteredGroups.length === 0" description="暂无母模板">
        <el-button v-if="canCreate" type="primary" @click="openCreateDialog">新增</el-button>
      </el-empty>
    </el-card>

    <MobileDialog
      v-model="showDialog"
      :title="dialogTitle"
      width="1240px"
      dialog-class="template-dialog"
      :show-default-footer="false"
      destroy-on-close
      @close="resetDialogState"
    >
      <div class="dialog-shell">
        <div class="dialog-header-form">
          <div class="header-form-item">
            <span class="form-label">品牌</span>
            <el-select
              v-model="groupForm.brand_id"
              placeholder="选择品牌"
              filterable
              :disabled="isEditMode"
              @change="handleBrandChange"
            >
              <el-option
                v-for="brand in brands"
                :key="brand.id"
                :label="brand.name"
                :value="brand.id"
              />
            </el-select>
          </div>

          <div class="header-form-item">
            <span class="form-label">型号</span>
            <el-select
              v-model="groupForm.model_id"
              placeholder="选择型号"
              filterable
              :disabled="isEditMode || !groupForm.brand_id"
            >
              <el-option
                v-for="model in availableModels"
                :key="model.id"
                :label="model.name"
                :value="model.id"
              />
            </el-select>
          </div>

          <div class="header-form-summary" v-if="groupForm.brand_id && groupForm.model_id">
            <span class="summary-title">{{ currentBrandName }} {{ currentModelName }}</span>
            <span class="summary-tip">在弹窗里按颜色维护各自的子模板</span>
          </div>
        </div>

        <div class="editor-layout">
          <aside class="children-panel">
            <div class="children-panel-header">
              <div>
                <h4>颜色子模板</h4>
                <p>点击颜色切换编辑内容</p>
              </div>
            </div>

            <div class="add-child-box">
              <el-select
                v-model="pendingColorId"
                placeholder="新增颜色子模板"
                filterable
                :disabled="!groupForm.brand_id || !groupForm.model_id"
              >
                <el-option
                  v-for="color in availableColors"
                  :key="color.id"
                  :label="color.name"
                  :value="color.id"
                />
              </el-select>
              <el-button
                type="primary"
                :disabled="!canWriteDialog || !pendingColorId || !groupForm.brand_id || !groupForm.model_id"
                @click="handleAddChild"
              >
                新增
              </el-button>
            </div>

            <div v-if="childDrafts.length > 0" class="child-list">
              <button
                v-for="child in childDrafts"
                :key="child.localKey"
                type="button"
                class="child-item"
                :class="{ active: child.localKey === selectedChildKey }"
                @click="selectedChildKey = child.localKey"
              >
                <div class="child-item-top">
                  <span class="child-name">{{ child.color_name || `颜色#${child.color_id}` }}</span>
                  <el-tag v-if="child.isNew" type="warning" size="small">新建</el-tag>
                </div>
                <div class="child-item-meta">
                  <span>{{ formatMemoryNames(child.memory_ids) || '未选内存' }}</span>
                  <span>{{ child.is_active ? '启用' : '停用' }}</span>
                </div>
              </button>
            </div>

            <el-empty v-else description="先添加颜色子模板" :image-size="80" />
          </aside>

          <section class="editor-panel">
            <template v-if="currentChild">
              <div class="editor-title-row">
                <div>
                  <h3>{{ currentBrandName }} {{ currentModelName }} · {{ currentChild.color_name || `颜色#${currentChild.color_id}` }}</h3>
                  <p>当前颜色子模板独立保存，H5 仍按子模板 ID 读取图片和价格</p>
                </div>
                <el-button
                  v-if="canDelete || canWriteDialog"
                  type="danger"
                  plain
                  @click="handleRemoveChild(currentChild)"
                >
                  删除当前颜色
                </el-button>
              </div>

              <div class="editor-form-grid">
                <div class="editor-block">
                  <div class="block-title">基础信息</div>
                  <el-form label-position="top" :disabled="!canWriteDialog">
                    <el-form-item label="颜色">
                      <el-input :model-value="currentChild.color_name || `颜色#${currentChild.color_id}`" disabled />
                    </el-form-item>
                    <el-form-item label="支持内存">
                      <el-select
                        v-model="currentChild.memory_ids"
                        multiple
                        filterable
                        placeholder="选择可用内存"
                        class="memory-select"
                      >
                        <el-option
                          v-for="memory in memories"
                          :key="memory.id"
                          :label="memory.size"
                          :value="memory.id"
                        />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="商品描述">
                      <el-input
                        v-model="currentChild.description"
                        type="textarea"
                        :rows="5"
                        placeholder="填写当前颜色的商品描述"
                      />
                    </el-form-item>
                  </el-form>
                </div>

                <div class="editor-block">
                  <div class="block-title">价格与状态</div>
                  <el-form label-position="top">
                    <el-form-item label="加价设置">
                      <div class="markup-settings">
                        <el-select v-model="currentChild.price_markup_type" class="markup-type-select">
                          <el-option label="固定金额" value="fixed" />
                          <el-option label="百分比" value="percentage" />
                        </el-select>
                        <div class="markup-row">
                          <el-input-number
                            :model-value="currentChild.price_markup_type === 'fixed' ? currentChild.price_markup : undefined"
                            :disabled="currentChild.price_markup_type !== 'fixed'"
                            :min="0"
                            :precision="2"
                            :step="100"
                            class="markup-input"
                            @update:model-value="handleFixedMarkupChange(currentChild, $event)"
                          />
                          <el-input-number
                            :model-value="currentChild.price_markup_type === 'percentage' ? currentChild.price_markup : undefined"
                            :disabled="currentChild.price_markup_type !== 'percentage'"
                            :min="0"
                            :max="100"
                            :precision="2"
                            :step="1"
                            class="markup-input"
                            @update:model-value="handlePercentageMarkupChange(currentChild, $event)"
                          >
                            <template #suffix>%</template>
                          </el-input-number>
                        </div>
                      </div>
                    </el-form-item>
                    <el-form-item label="启用状态">
                      <el-switch
                        v-model="currentChild.is_active"
                        active-text="启用"
                        inactive-text="停用"
                      />
                    </el-form-item>
                    <el-form-item label="排序">
                      <el-input-number
                        v-model="currentChild.sort_order"
                        :min="0"
                        :step="1"
                        style="width: 100%"
                      />
                    </el-form-item>
                    <div class="stock-line">
                      当前在库：<strong>{{ currentChild.stock_count || 0 }}</strong>
                    </div>
                  </el-form>
                </div>
              </div>

              <div class="editor-block image-block">
                <div class="image-block-header">
                  <div>
                    <div class="block-title">图片 / 视频管理</div>
                    <p>支持多选上传图片和视频，媒体仍按颜色子模板 ID 独立保存</p>
                  </div>
                  <el-upload
                    :show-file-list="false"
                    multiple
                    :disabled="!currentChild.id"
                    accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime,.mov"
                    :http-request="handleImageUpload"
                    :before-upload="beforeImageUpload"
                  >
                    <el-button type="primary" :loading="imageUploading" :disabled="!currentChild.id || !canEdit">
                      上传图片 / 视频
                    </el-button>
                  </el-upload>
                </div>

                <div v-if="!currentChild.id" class="unsaved-tip">
                  请先保存该颜色子模板，再上传对应媒体文件。
                </div>

                <draggable
                  v-if="currentChild.images.length > 0"
                  :list="currentChild.images"
                  item-key="id"
                  class="image-grid"
                  handle=".image-drag-handle"
                  :disabled="!canEdit"
                  @end="handleImageDragEnd(currentChild)"
                >
                  <template #item="{ element: image, index }">
                    <div class="image-card">
                      <div class="image-drag-handle" title="拖拽排序">
                        <i class="fas fa-grip-vertical"></i>
                      </div>
                      <img
                        v-if="!isVideoMedia(image)"
                        :src="getImageUrl(image.image_url)"
                        :alt="`${currentChild.color_name}-${index}`"
                      />
                      <video
                        v-else
                        :src="getImageUrl(image.image_url)"
                        controls
                        playsinline
                        preload="metadata"
                      />
                      <div class="image-card-body">
                        <div class="image-card-meta">
                          <el-tag v-if="image.is_primary" type="success" size="small">主图</el-tag>
                          <el-tag v-if="isVideoMedia(image)" type="info" size="small">视频</el-tag>
                          <span>拖拽排序</span>
                        </div>
                        <div class="image-card-actions">
                          <el-tooltip v-if="!isVideoMedia(image) && canEdit" content="设为主图" placement="top">
                            <button
                              type="button"
                              class="image-action-btn primary"
                              :class="{ active: image.is_primary }"
                              :disabled="image.is_primary"
                              @click="handleSetPrimaryImage(currentChild, image)"
                            >
                              <i class="fas fa-star"></i>
                            </button>
                          </el-tooltip>
                          <el-tooltip v-if="canDelete" content="删除图片" placement="top">
                            <button
                              type="button"
                              class="image-action-btn danger"
                              @click="handleDeleteImage(currentChild, image)"
                            >
                              <i class="fas fa-trash"></i>
                            </button>
                          </el-tooltip>
                        </div>
                      </div>
                    </div>
                  </template>
                </draggable>

                <el-empty v-else description="暂无媒体" :image-size="90" />
              </div>
            </template>

            <el-empty v-else description="请选择或新增一个颜色子模板" :image-size="100" />
          </section>
        </div>
      </div>

      <template #footer>
        <el-button type="default" @click="showDialog = false">取消</el-button>
        <el-button v-if="canWriteDialog" type="primary" :loading="saving" @click="handleSaveGroup">保存母模板</el-button>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, inject, watch } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { Refresh, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import draggable from 'vuedraggable'
import { PermissionDenied } from '@/components/base/index'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useLoadingState } from '@/composables'
import { formatImageUrl } from '@/utils/format'
import { createTempFileTracker, type TempFileTracker } from '@/utils/temp-file-cleaner'
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  reorderTemplates,
  uploadTemplateImage,
  deleteTemplateImage,
  setTemplatePrimaryImage,
  reorderTemplateImages,
  type NewTemplate,
  type TemplateImage
} from '@/api/shop'
import { baseDataApi, type Brand, type Model, type Color, type Memory } from '@/api/base-data'
import { logger } from '@/utils/logger'
import type { HeaderAction } from '@/types'
interface EditableChildTemplate extends Omit<NewTemplate, 'memory_ids' | 'images'> {
  localKey: string
  isNew: boolean
  memory_ids: number[]
  images: TemplateImage[]
  is_active: boolean
  price_markup: number
  sort_order: number
  price_markup_type: 'fixed' | 'percentage'
  stock_count: number
}

interface TemplateGroup {
  groupKey: string
  brand_id: number
  model_id: number
  brand_name: string
  model_name: string
  display_name: string
  templates: EditableChildTemplate[]
  total_stock: number
  active_count: number
  sort_order: number
  main_image: string
  main_media_type?: TemplateImage['image_type']
}

const router = useRouter()
const { canView, canCreate, canEdit, canDelete, handleNoPermission } = usePagePermissions('h5-admin-templates')

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

const { loading } = useLoadingState()
const saving = ref(false)
const mediaUploadingCount = ref(0)
const sortingGroups = ref(false)
const keyword = ref('')
const showDialog = ref(false)
const isEditMode = ref(false)
const templates = ref<EditableChildTemplate[]>([])
const brands = ref<Brand[]>([])
const models = ref<Model[]>([])
const colors = ref<Color[]>([])
const memories = ref<Memory[]>([])

// 临时文件跟踪器
let tempFileTracker: TempFileTracker | null = null

const groupForm = ref({
  brand_id: undefined as number | undefined,
  model_id: undefined as number | undefined
})

const childDrafts = ref<EditableChildTemplate[]>([])
const selectedChildKey = ref('')
const pendingColorId = ref<number | undefined>()

const currentBrandName = computed(() => brands.value.find(item => item.id === groupForm.value.brand_id)?.name || '')
const currentModelName = computed(() => models.value.find(item => item.id === groupForm.value.model_id)?.name || '')
const imageUploading = computed(() => mediaUploadingCount.value > 0)

const availableModels = computed(() => {
  if (!groupForm.value.brand_id) {
    return []
  }
  return models.value.filter(item => item.brand_id === groupForm.value.brand_id)
})

const usedColorIds = computed(() => new Set(childDrafts.value.map(item => item.color_id)))

const availableColors = computed(() => {
  return colors.value.filter(item => !usedColorIds.value.has(item.id))
})

const currentChild = computed(() => {
  return childDrafts.value.find(item => item.localKey === selectedChildKey.value) || null
})

const dialogTitle = computed(() => {
  return isEditMode.value ? `编辑母模板 - ${currentBrandName.value} ${currentModelName.value}` : '新增母模板'
})
const canWriteDialog = computed(() => (isEditMode.value ? canEdit.value : canCreate.value))

const ensureTemplatePermission = (action: 'create' | 'edit' | 'delete') => {
  const permitted = action === 'create'
    ? canCreate.value
    : action === 'delete'
      ? canDelete.value
      : canEdit.value

  if (permitted) {
    return true
  }

  handleNoPermission(action)
  return false
}

const isVideoMedia = (media?: Pick<TemplateImage, 'image_url' | 'image_type'> | null) => {
  if (!media?.image_url) {
    return false
  }

  if (media.image_type === 'video') {
    return true
  }

  return /\.(mp4|webm|ogg|mov)$/i.test(media.image_url)
}

const getPreferredCoverMedia = (images: TemplateImage[] = []) => {
  return images.find(item => !isVideoMedia(item)) || images[0] || null
}

const buildTemplateGroups = (templateList: EditableChildTemplate[]): TemplateGroup[] => {
  const groups = new Map<string, EditableChildTemplate[]>()

  templateList.forEach(template => {
    const key = `${template.brand_id}-${template.model_id}`
    const list = groups.get(key) || []
    list.push(template)
    groups.set(key, list)
  })

  return Array.from(groups.entries()).map(([groupKey, items]) => {
    const sortedItems = [...items].sort((a, b) => {
      const sortDiff = (a.sort_order || 0) - (b.sort_order || 0)
      if (sortDiff !== 0) {
        return sortDiff
      }
      return (a.id || 0) - (b.id || 0)
    })

    const first = sortedItems[0]
    const brandName = first.brand_name || brands.value.find(item => item.id === first.brand_id)?.name || ''
    const modelName = first.model_name || models.value.find(item => item.id === first.model_id)?.name || ''
    const totalStock = sortedItems.reduce((sum, item) => sum + Number(item.stock_count || 0), 0)
    const activeCount = sortedItems.filter(item => item.is_active).length
    const mainMedia = sortedItems
      .map(item => getPreferredCoverMedia(item.images))
      .find(Boolean) || null

    return {
      groupKey,
      brand_id: first.brand_id,
      model_id: first.model_id,
      brand_name: brandName,
      model_name: modelName,
      display_name: `${brandName} ${modelName}`.trim(),
      templates: sortedItems,
      total_stock: totalStock,
      active_count: activeCount,
      sort_order: Math.min(...sortedItems.map(item => item.sort_order || 0)),
      main_image: mainMedia?.image_url || '',
      main_media_type: mainMedia?.image_type
    }
  }).sort((a, b) => {
    const sortDiff = a.sort_order - b.sort_order
    if (sortDiff !== 0) {
      return sortDiff
    }
    return a.display_name.localeCompare(b.display_name, 'zh-CN')
  })
}

const groupedTemplates = ref<TemplateGroup[]>([])

const filteredGroups = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) {
    return groupedTemplates.value
  }

  return groupedTemplates.value.filter(group => {
    const groupText = [
      group.brand_name,
      group.model_name,
      group.display_name,
      ...group.templates.map(item => item.color_name || '')
    ].join(' ').toLowerCase()
    return groupText.includes(text)
  })
})

const parseMemoryIds = (value: NewTemplate['memory_ids']): number[] => {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.map(item => Number(item)).filter(item => !Number.isNaN(item))
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map(item => Number(item)).filter(item => !Number.isNaN(item))
      }
    } catch {
      return []
    }
  }

  return []
}

const sortImages = (images: TemplateImage[] = []) => {
  return [...images].sort((a, b) => {
    const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (sortDiff !== 0) {
      return sortDiff
    }
    return a.id - b.id
  })
}

const normalizeTemplate = (template: NewTemplate): EditableChildTemplate => {
  const images = sortImages(template.images || [])

  return {
    ...template,
    localKey: `template-${template.id || `${template.brand_id}-${template.model_id}-${template.color_id}`}`,
    isNew: false,
    memory_ids: parseMemoryIds(template.memory_ids),
    images,
    is_active: template.is_active === undefined ? true : Boolean(Number(template.is_active)),
    price_markup: Number(template.price_markup || 0),
    sort_order: Number(template.sort_order || 0),
    price_markup_type: template.price_markup_type || 'fixed',
    stock_count: Number(template.stock_count || 0),
    description: template.description || '',
    template_name: template.template_name || '',
    main_image: template.main_image || images[0]?.image_url || '',
    brand_name: template.brand_name || '',
    model_name: template.model_name || '',
    color_name: template.color_name || ''
  }
}

const cloneChildDraft = (template: EditableChildTemplate): EditableChildTemplate => {
  return {
    ...template,
    memory_ids: [...template.memory_ids],
    images: sortImages(template.images || []).map(image => ({ ...image }))
  }
}

const createEmptyChildDraft = (colorId: number): EditableChildTemplate => {
  const colorName = colors.value.find(item => item.id === colorId)?.name || ''
  const modelName = currentModelName.value
  const brandName = currentBrandName.value

  return {
    localKey: `new-${Date.now()}-${colorId}-${Math.random().toString(36).slice(2, 8)}`,
    isNew: true,
    brand_id: groupForm.value.brand_id as number,
    model_id: groupForm.value.model_id as number,
    color_id: colorId,
    color_name: colorName,
    brand_name: brandName,
    model_name: modelName,
    memory_ids: [],
    template_name: `${brandName} ${modelName} ${colorName}`.trim(),
    description: '',
    price_markup: 0,
    price_markup_type: 'fixed',
    is_active: true,
    sort_order: childDrafts.value.length > 0 ? Math.max(...childDrafts.value.map(item => item.sort_order || 0)) + 1 : 0,
    images: [],
    main_image: '',
    stock_count: 0
  }
}

const getImageUrl = (path: string) => formatImageUrl(path)

const formatMemoryNames = (memoryIds: number[] = []) => {
  if (!memoryIds.length) {
    return ''
  }
  return memoryIds
    .map(id => memories.value.find(item => item.id === id)?.size)
    .filter(Boolean)
    .join(' / ')
}

const buildTemplateName = (child: EditableChildTemplate) => {
  const brandName = currentBrandName.value || child.brand_name || ''
  const modelName = currentModelName.value || child.model_name || ''
  const colorName = child.color_name || colors.value.find(item => item.id === child.color_id)?.name || ''
  return `${brandName} ${modelName} ${colorName}`.trim()
}

const handleFixedMarkupChange = (child: EditableChildTemplate, value: number | string | undefined) => {
  if (child.price_markup_type !== 'fixed') {
    return
  }
  child.price_markup = Number(value || 0)
}

const handlePercentageMarkupChange = (child: EditableChildTemplate, value: number | string | undefined) => {
  if (child.price_markup_type !== 'percentage') {
    return
  }
  child.price_markup = Number(value || 0)
}

const unwrapResponseData = <T>(response: any, fallback: T): T => {
  if (response === undefined || response === null) {
    return fallback
  }
  if (response.data !== undefined) {
    return response.data as T
  }
  return response as T
}

const loadPageData = async () => {
  if (!canView.value) {
    templates.value = []
    brands.value = []
    models.value = []
    colors.value = []
    memories.value = []
    groupedTemplates.value = []
    loading.value = false
    return
  }

  loading.value = true
  try {
    const [templateResponse, brandList, modelList, colorList, memoryList] = await Promise.all([
      getTemplates(),
      baseDataApi.getAdminBrands(),
      baseDataApi.getAdminModels(),
      baseDataApi.getAdminColors(),
      baseDataApi.getAdminMemories()
    ])

    const templateList = unwrapResponseData<NewTemplate[]>(templateResponse, [])

    templates.value = (Array.isArray(templateList) ? templateList : []).map(normalizeTemplate)
    brands.value = Array.isArray(brandList) ? brandList : []
    models.value = Array.isArray(modelList) ? modelList : []
    colors.value = Array.isArray(colorList) ? colorList : []
    memories.value = Array.isArray(memoryList) ? memoryList : []
    groupedTemplates.value = buildTemplateGroups(templates.value)
  } catch (error: any) {
    logger.error('loadPageData error:', error)
    ElMessage.error(error?.message || '加载模板数据失败')
  } finally {
    loading.value = false
  }
}

const resetDialogState = async () => {
  // 取消时清理所有新上传的临时文件
  if (tempFileTracker) {
    try {
      await tempFileTracker.cleanup()
    } catch (error) {
      logger.error('清理临时文件失败:', error)
    }
    tempFileTracker = null
  }

  groupForm.value = {
    brand_id: undefined,
    model_id: undefined
  }
  childDrafts.value = []
  selectedChildKey.value = ''
  pendingColorId.value = undefined
  isEditMode.value = false
}

const openCreateDialog = () => {
  if (!ensureTemplatePermission('create')) {
    return
  }

  resetDialogState()
  // 初始化临时文件跟踪器
  tempFileTracker = createTempFileTracker()
  showDialog.value = true
}

const openEditDialog = (group: TemplateGroup) => {
  if (!ensureTemplatePermission('edit')) {
    return
  }

  resetDialogState()
  isEditMode.value = true
  groupForm.value = {
    brand_id: group.brand_id,
    model_id: group.model_id
  }
  childDrafts.value = group.templates.map(cloneChildDraft)
  selectedChildKey.value = childDrafts.value[0]?.localKey || ''
  // 初始化临时文件跟踪器（编辑模式下也跟踪新上传的文件）
  tempFileTracker = createTempFileTracker()
  showDialog.value = true
}

const handleBrandChange = () => {
  if (isEditMode.value) {
    return
  }
  groupForm.value.model_id = undefined
  childDrafts.value = []
  selectedChildKey.value = ''
  pendingColorId.value = undefined
}

const handleAddChild = () => {
  if (!canWriteDialog.value) {
    handleNoPermission(isEditMode.value ? 'edit' : 'create')
    return
  }

  if (!groupForm.value.brand_id || !groupForm.value.model_id) {
    ElMessage.warning('请先选择品牌和型号')
    return
  }

  if (!pendingColorId.value) {
    ElMessage.warning('请选择颜色')
    return
  }

  const draft = createEmptyChildDraft(pendingColorId.value)
  childDrafts.value.push(draft)
  selectedChildKey.value = draft.localKey
  pendingColorId.value = undefined
}

const handleRemoveChild = async (child: EditableChildTemplate) => {
  if (child.id) {
    if (!ensureTemplatePermission('delete')) {
      return
    }
  } else if (!canWriteDialog.value) {
    handleNoPermission(isEditMode.value ? 'edit' : 'create')
    return
  }

  const message = child.id
    ? `确认删除颜色「${child.color_name}」？删除后该子模板 ID 将失效。`
    : `确认移除未保存的颜色「${child.color_name}」？`

  try {
    await ElMessageBox.confirm(message, '删除颜色', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  if (child.id) {
    try {
      await deleteTemplate(child.id)
      ElMessage.success('颜色子模板已删除')
    } catch (error: any) {
      ElMessage.error(error?.message || '删除颜色子模板失败')
      return
    }
  }

  childDrafts.value = childDrafts.value.filter(item => item.localKey !== child.localKey)
  if (selectedChildKey.value === child.localKey) {
    selectedChildKey.value = childDrafts.value[0]?.localKey || ''
  }

  if (childDrafts.value.length === 0 && isEditMode.value) {
    showDialog.value = false
    await loadPageData()
  }
}

const handleDeleteGroup = async (group: TemplateGroup) => {
  if (!ensureTemplatePermission('delete')) {
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认删除母模板「${group.display_name}」？将一并删除 ${group.templates.length} 个颜色子模板。`,
      '删除母模板',
      {
        type: 'warning',
        confirmButtonText: '删除整组',
        cancelButtonText: '取消'
      }
    )
  } catch {
    return
  }

  try {
    for (const child of group.templates) {
      if (child.id) {
        await deleteTemplate(child.id)
      }
    }
    ElMessage.success('母模板已删除')
    await loadPageData()
  } catch (error: any) {
    ElMessage.error(error?.message || '删除母模板失败')
  }
}

const handleGroupDragEnd = async () => {
  if (!ensureTemplatePermission('edit')) {
    await loadPageData()
    return
  }

  if (sortingGroups.value || keyword.value.trim()) {
    return
  }

  sortingGroups.value = true
  const orders: Array<{ id: number; sort_order: number }> = []
  const nextSortMap = new Map<number, number>()

  groupedTemplates.value.forEach((group, groupIndex) => {
    const sortedChildren = [...group.templates].sort((a, b) => {
      const sortDiff = (a.sort_order || 0) - (b.sort_order || 0)
      if (sortDiff !== 0) {
        return sortDiff
      }
      return (a.id || 0) - (b.id || 0)
    })

    sortedChildren.forEach((child, childIndex) => {
      if (!child.id) {
        return
      }
      const sortOrder = groupIndex * 100 + childIndex
      orders.push({
        id: child.id,
        sort_order: sortOrder
      })
      nextSortMap.set(child.id, sortOrder)
    })
  })

  try {
    await reorderTemplates(orders)
    templates.value = templates.value.map(template => ({
      ...template,
      sort_order: template.id ? (nextSortMap.get(template.id) ?? template.sort_order) : template.sort_order
    }))
    groupedTemplates.value = buildTemplateGroups(templates.value)
    ElMessage.success('母模板排序已更新')
  } catch (error: any) {
    ElMessage.error(error?.message || '更新模板排序失败')
    await loadPageData()
  } finally {
    sortingGroups.value = false
  }
}

const validateGroupBeforeSave = () => {
  if (!groupForm.value.brand_id || !groupForm.value.model_id) {
    ElMessage.warning('请先选择品牌和型号')
    return false
  }

  if (childDrafts.value.length === 0) {
    ElMessage.warning('请至少新增一个颜色子模板')
    return false
  }

  const missingColor = childDrafts.value.find(item => !item.color_id)
  if (missingColor) {
    ElMessage.warning('存在未设置颜色的子模板')
    return false
  }

  const colorIds = childDrafts.value.map(item => item.color_id)
  if (new Set(colorIds).size !== colorIds.length) {
    ElMessage.warning('同一母模板下颜色不能重复')
    return false
  }

  return true
}

const handleSaveGroup = async () => {
  if (!canWriteDialog.value) {
    handleNoPermission(isEditMode.value ? 'edit' : 'create')
    return
  }

  if (!validateGroupBeforeSave()) {
    return
  }

  saving.value = true
  try {
    for (const child of childDrafts.value) {
      const payload: NewTemplate = {
        brand_id: groupForm.value.brand_id as number,
        model_id: groupForm.value.model_id as number,
        color_id: child.color_id,
        memory_ids: child.memory_ids,
        template_name: buildTemplateName(child),
        description: child.description || '',
        price_markup: Number(child.price_markup || 0),
        price_markup_type: child.price_markup_type || 'fixed',
        is_active: child.is_active,
        sort_order: Number(child.sort_order || 0)
      }

      if (child.id) {
        await updateTemplate(child.id, payload)
      } else {
        await createTemplate(payload)
      }
    }

    // 保存成功后清除临时文件跟踪器（不再需要清理这些文件）
    tempFileTracker?.clear()
    tempFileTracker = null

    ElMessage.success('母模板已保存')
    showDialog.value = false
    await loadPageData()
  } catch (error: any) {
    logger.error('handleSaveGroup error:', error)
    ElMessage.error(error?.message || '保存母模板失败')
  } finally {
    saving.value = false
  }
}

const beforeImageUpload = (file: File) => {
  if (!ensureTemplatePermission('edit')) {
    return false
  }

  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  if (!isImage && !isVideo) {
    ElMessage.error('只能上传图片或视频文件')
    return false
  }

  const sizeLimit = isVideo ? 50 : 10
  const isValidSize = file.size / 1024 / 1024 < sizeLimit

  if (!isValidSize) {
    ElMessage.error(`${isVideo ? '视频' : '图片'}大小不能超过 ${sizeLimit}MB`)
    return false
  }

  return true
}

const syncChildImageState = (child: EditableChildTemplate, images: TemplateImage[]) => {
  child.images = images.map((item, index) => ({
    ...item,
    sort_order: item.sort_order ?? index
  }))
  child.main_image = getPreferredCoverMedia(child.images)?.image_url || ''
}

const handleImageUpload = async (options: any) => {
  if (!ensureTemplatePermission('edit')) {
    options.onError?.(new Error('permission_denied'))
    return
  }

  const child = currentChild.value
  if (!child?.id) {
    ElMessage.warning('请先保存当前颜色子模板')
    options.onError?.(new Error('template_not_saved'))
    return
  }

  mediaUploadingCount.value += 1
  try {
    const response = await uploadTemplateImage(child.id, options.file as File)
    const image = unwrapResponseData<TemplateImage | null>(response, null)
    if (!image) {
      throw new Error('上传成功但未返回媒体数据')
    }
    syncChildImageState(child, [
      ...child.images,
      {
        ...image,
        sort_order: Number(image.sort_order ?? child.images.length)
      }
    ])
    // 跟踪新上传的文件（用于取消时清理）
    tempFileTracker?.addUploadedFile(image.image_url)
    ElMessage.success(isVideoMedia(image) ? '视频上传成功' : '图片上传成功')
    options.onSuccess?.(image)
  } catch (error: any) {
    ElMessage.error(error?.message || '媒体上传失败')
    options.onError?.(error)
  } finally {
    mediaUploadingCount.value = Math.max(0, mediaUploadingCount.value - 1)
  }
}

const handleDeleteImage = async (child: EditableChildTemplate, image: TemplateImage) => {
  if (!ensureTemplatePermission('delete')) {
    return
  }

  if (!child.id) {
    return
  }

  try {
    await ElMessageBox.confirm('确认删除这个媒体文件？', '删除媒体', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  try {
    await deleteTemplateImage(child.id, image.id)
    syncChildImageState(child, child.images.filter(item => item.id !== image.id))
    ElMessage.success(isVideoMedia(image) ? '视频已删除' : '图片已删除')
  } catch (error: any) {
    ElMessage.error(error?.message || '删除媒体失败')
  }
}

const handleSetPrimaryImage = async (child: EditableChildTemplate, image: TemplateImage) => {
  if (!ensureTemplatePermission('edit')) {
    return
  }

  if (!child.id) {
    return
  }

  try {
    await setTemplatePrimaryImage(child.id, image.id)
    syncChildImageState(
      child,
      child.images.map(item => ({
        ...item,
        is_primary: item.id === image.id
      }))
    )
    ElMessage.success('主图已更新')
  } catch (error: any) {
    ElMessage.error(error?.message || '设置主图失败')
  }
}

const handleImageDragEnd = async (child: EditableChildTemplate) => {
  if (!ensureTemplatePermission('edit')) {
    return
  }

  if (!child.id) {
    return
  }

  const reordered = child.images.map((item, idx) => ({
    ...item,
    sort_order: idx
  }))

  const orders = reordered.map((item) => ({
    id: item.id,
    sort_order: item.sort_order
  }))

  try {
    await reorderTemplateImages(child.id, orders)
    syncChildImageState(child, reordered)
  } catch (error: any) {
    ElMessage.error(error?.message || '媒体排序更新失败')
    await loadPageData()
    const reloadedGroup = groupedTemplates.value.find(group => group.brand_id === child.brand_id && group.model_id === child.model_id)
    if (reloadedGroup) {
      childDrafts.value = reloadedGroup.templates.map(cloneChildDraft)
      selectedChildKey.value = childDrafts.value.find(item => item.color_id === child.color_id)?.localKey || childDrafts.value[0]?.localKey || ''
    }
  }
}

onMounted(() => {
  if (canView.value) {
    loadPageData()
  }
  // 注册头部操作按钮
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
        handler: () => loadPageData()
      }
    ])
  }
})

// 路由守卫：页面离开时清理临时文件
onBeforeRouteLeave(async () => {
  if (tempFileTracker) {
    await tempFileTracker.cleanup()
    tempFileTracker = null
  }
  return true
})

onUnmounted(() => {
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped>
.template-management-page {
  padding: 20px;
}

.toolbar-card,
.table-card {
  margin-bottom: 16px;
}

.sort-tip {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
}

.group-table-header {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) 90px 110px 110px 120px 220px;
  gap: 12px;
  padding: 0 16px 12px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 600;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-row {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) 90px 110px 110px 120px 220px;
  gap: 12px;
  align-items: center;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #fff;
}

.group-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.group-drag-handle {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  color: #4f46e5;
  cursor: grab;
  flex-shrink: 0;
}

.group-drag-handle:active {
  cursor: grabbing;
}

.group-drag-handle.disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

.group-stat,
.group-actions {
  color: #111827;
}

.center {
  text-align: center;
}

.toolbar {
  display: flex;
}

.search-toolbar {
  width: 100%;
}

.search-panel {
  width: 100%;
  display: block;
  padding: 4px 0;
}

.search-panel-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.search-input {
  width: 100%;
}

.search-panel-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.product-cell {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.product-cover {
  width: 68px;
  height: 68px;
  border-radius: 14px;
  object-fit: cover;
  flex-shrink: 0;
  background: #f3f4f6;
}

.product-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 22px;
}

.product-meta {
  min-width: 0;
}

.product-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 4px;
}

.product-subtitle {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.color-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.dialog-shell {
  min-height: 640px;
}

.dialog-header-form {
  display: grid;
  grid-template-columns: 220px 280px 1fr;
  gap: 16px;
  margin-bottom: 18px;
  align-items: end;
}

.header-form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.header-form-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
}

.summary-title {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.summary-tip {
  font-size: 12px;
  color: #6b7280;
}

.editor-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 18px;
}

.children-panel {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 16px;
  background: #fafafa;
  min-height: 540px;
}

.children-panel-header h4 {
  margin: 0;
  font-size: 15px;
  color: #111827;
}

.children-panel-header p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.add-child-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0;
}

.child-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.child-item {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  text-align: left;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.child-item:hover,
.child-item.active {
  border-color: #2563eb;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.12);
}

.child-item-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.child-name {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.child-item-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}

.editor-panel {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 18px;
  background: #fff;
  min-height: 540px;
}

.editor-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;
}

.editor-title-row h3 {
  margin: 0 0 6px;
  font-size: 18px;
  color: #111827;
}

.editor-title-row p {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}

.editor-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 18px;
}

.editor-block {
  border: 1px solid #eef2f7;
  border-radius: 16px;
  padding: 16px;
  background: #fbfdff;
}

.markup-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.markup-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.markup-type-select,
.markup-input {
  width: 100%;
}

.block-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 14px;
}

.stock-line {
  font-size: 13px;
  color: #6b7280;
}

.image-block-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 14px;
}

.image-block-header p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.unsaved-tip {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 13px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.image-card {
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
}

.image-drag-handle {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 24, 39, 0.65);
  color: #fff;
  cursor: grab;
}

.image-drag-handle:active {
  cursor: grabbing;
}

.image-card img,
.image-card video {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
  background: #f3f4f6;
}

.image-card-body {
  padding: 12px;
}

.image-card-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6b7280;
}

.image-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.image-action-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #eef2ff;
  color: #4f46e5;
}

.image-action-btn:hover {
  transform: translateY(-1px);
}

.image-action-btn.primary.active,
.image-action-btn.primary:disabled {
  background: #dcfce7;
  color: #16a34a;
  cursor: default;
  transform: none;
}

.image-action-btn.danger {
  background: #fef2f2;
  color: #dc2626;
}

:deep(.memory-select .el-select__wrapper) {
  min-height: 42px;
  height: auto;
}

:deep(.memory-select .el-select__selection) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

:deep(.memory-select .el-tag) {
  max-width: 100%;
}

@media (max-width: 1200px) {
  .group-table-header {
    display: none;
  }

  .group-row {
    grid-template-columns: 1fr;
  }

  .group-stat,
  .group-actions,
  .center {
    text-align: left;
  }

  .dialog-header-form {
    grid-template-columns: 1fr;
  }

  .editor-layout {
    grid-template-columns: 1fr;
  }

  .editor-form-grid {
    grid-template-columns: 1fr;
  }

  .markup-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .template-management-page {
    padding: 12px;
  }

  .toolbar {
    justify-content: stretch;
  }

  .search-input {
    width: 100%;
  }

  .search-panel {
    gap: 12px;
  }

  .product-cell {
    align-items: center;
  }

  .group-main {
    align-items: flex-start;
  }

  .editor-title-row,
  .image-block-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
