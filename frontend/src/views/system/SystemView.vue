<template>
  <div class="system-management admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="system"
      module-name="系统管理"
      permission-code="system:view"
    >

    <!-- 页面头部 -->
    <PageHeader
      icon="fas fa-cogs"
      title="系统管理"
    >
      <template #actions>
        <el-button
          v-if="activeTab === 'warning' && canUpdateSettings"
          type="primary"
          @click="openWarningTemplateDialog"
        >
          <i class="fas fa-plus"></i>
          <span>新增</span>
        </el-button>
        <el-button type="info" @click="refreshSystemStatus" :disabled="refreshing">
          <InlineLoading v-if="refreshing" text="刷新中..." size="small" variant="inherit" />
          <template v-else>
            <i class="fas fa-sync-alt"></i>
            <span>刷新</span>
          </template>
        </el-button>
      </template>
    </PageHeader>

    <!-- 系统功能模块 -->
    <div class="system-container admin-page-content">
      <!-- TAB导航 -->
      <div class="tab-navigation tf-page-tabs">
        <el-button
          :type="activeTab === 'settings' ? 'primary' : 'default'"
          @click="activeTab = 'settings'"
          :icon="Setting"
        >
          站点信息设置
        </el-button>
        <el-button
          :type="activeTab === 'screenlock' ? 'primary' : 'default'"
          @click="activeTab = 'screenlock'"
          :icon="Lock"
        >
          锁屏设置
        </el-button>
        <el-button
          :type="activeTab === 'warning' ? 'primary' : 'default'"
          @click="activeTab = 'warning'"
        >
          <i class="fas fa-bell"></i>
          预警配置
        </el-button>
        <el-button
          v-if="canViewReturngoods"
          :type="activeTab === 'returngoods' ? 'primary' : 'default'"
          @click="activeTab = 'returngoods'"
        >
          <i class="fas fa-undo-alt"></i>
          退库管理
        </el-button>
      </div>

      <!-- TAB内容区域 -->
      <div class="tab-content tf-tab-content">
        <!-- 站点信息设置TAB -->
        <div v-if="activeTab === 'settings'" class="tab-panel tf-tab-panel">
          <div class="system-settings-section">

            <!-- 站点 Logo 设置和编辑站点信息 - PC端一行展示 -->
            <div class="site-settings-row">
              <div class="site-logo-panel admin-panel">
                <div class="card-header-with-action">
                  <h3 class="card-title">
                    <i class="fas fa-image"></i>
                    站点 Logo 设置
                  </h3>
                  <el-button
                    type="primary"
                    size="small"
                    @click="saveSiteSettings"
                    :loading="isLoading"
                    :disabled="!canUpdateSettings"
                  >
                    <span v-if="isLoading">保存中...</span>
                    <template v-else>
                      <i class="fas fa-save"></i>
                      <span>保存</span>
                    </template>
                  </el-button>
                </div>

                <div
                  class="site-logo-preview-card"
                  :class="{ clickable: canUpdateSettings && !logoUploading }"
                  :tabindex="canUpdateSettings && !logoUploading ? 0 : -1"
                  :role="canUpdateSettings && !logoUploading ? 'button' : undefined"
                  @click="triggerSiteLogoUpload"
                  @keydown.enter.prevent="triggerSiteLogoUpload"
                  @keydown.space.prevent="triggerSiteLogoUpload"
                >
                  <div v-if="siteLogoPreviewUrl" class="site-logo-preview">
                    <Image :src="siteLogoPreviewUrl" alt="站点Logo预览" mode="eager" />
                  </div>
                  <div v-else class="site-logo-empty">
                    <i class="fas fa-image"></i>
                    <span>暂无站点 Logo</span>
                  </div>
                  <div v-if="canUpdateSettings" class="site-logo-preview-tip">
                    {{ logoUploading ? '上传中...' : '点击这里选择新照片 / Logo' }}
                  </div>
                </div>

                <div class="site-logo-editor">
                  <div class="logo-editor-header">
                    <h3>
                      <i class="fas fa-image"></i>
                      站点 Logo 设置
                    </h3>
                    <el-tag type="success" size="small">页面顶部显示</el-tag>
                  </div>

                  <p class="logo-editor-tip">
                    用于页面顶部和移动端菜单展示。上传后会自动保存到系统设置，支持透明底 PNG、SVG 和 ICO。
                  </p>

                  <el-input
                    v-model="siteSettings.logoUrl"
                    placeholder="可直接输入 Logo 图片地址，或使用下方按钮上传"
                    :disabled="!canUpdateSettings"
                    clearable
                  />

                  <div class="site-logo-actions">
                    <el-button
                      type="primary"
                      @click="triggerSiteLogoUpload"
                      :loading="logoUploading"
                      :disabled="!canUpdateSettings"
                    >
                      <span v-if="logoUploading">上传中...</span>
                      <template v-else>
                        <i class="fas fa-upload"></i>
                        <span>上传 Logo</span>
                      </template>
                    </el-button>
                    <el-button
                      v-if="siteSettings.logoUrl"
                      type="default"
                      @click="clearSiteLogo"
                      :disabled="logoUploading || !canUpdateSettings"
                    >
                      <i class="fas fa-trash-alt"></i>
                      <span>清空 Logo</span>
                    </el-button>
                  </div>

                  <div class="logo-editor-help">
                    支持 JPG、PNG、GIF、SVG、ICO，文件大小不超过 5MB。上传目录：`uploads/brand/`
                  </div>

                  <input
                    ref="siteLogoInputRef"
                    type="file"
                    :accept="SITE_LOGO_ACCEPT"
                    class="site-logo-hidden-input"
                    @change="handleSiteLogoFileChange"
                  />
                </div>
              </div>

              <!-- 站点信息编辑表格 -->
              <div class="table-section site-settings-table admin-panel admin-table-panel">
                <div class="card-header-with-action">
                  <h3 class="section-subtitle">
                    <i class="fas fa-edit"></i>
                    编辑站点信息
                  </h3>
                  <el-button
                    type="primary"
                    size="small"
                    @click="saveSiteSettings"
                    :loading="isLoading"
                    :disabled="!canUpdateSettings"
                  >
                    <span v-if="isLoading">保存中...</span>
                    <template v-else>
                      <i class="fas fa-save"></i>
                      <span>保存</span>
                    </template>
                  </el-button>
                </div>
                <el-table class="data-table compact-fit-table" :data="siteSettingsList" border stripe table-layout="auto" :fit="true">
                  <el-table-column prop="category" label="分类" min-width="120" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.category === 'basic' ? 'primary' : 'success'" size="small">
                        {{ row.categoryLabel }}
                      </el-tag>
                    </template>
                  </el-table-column>

                  <el-table-column prop="label" label="设置项" min-width="150">
                    <template #default="{ row }">
                      <i :class="row.icon"></i>
                      {{ row.label }}
                    </template>
                  </el-table-column>

                  <el-table-column prop="value" label="当前值" min-width="160">
                    <template #default="{ row }">
                      <el-input
                        v-if="row.type === 'input'"
                        v-model="siteSettings[row.key]"
                        :placeholder="row.placeholder"
                        :disabled="!canUpdateSettings"
                        clearable
                      />
                      <el-input
                        v-else-if="row.type === 'textarea'"
                        v-model="siteSettings[row.key]"
                        type="textarea"
                        :rows="2"
                        :placeholder="row.placeholder"
                        :disabled="!canUpdateSettings"
                        clearable
                      />
                      <span v-else>{{ siteSettings[row.key] || row.defaultValue }}</span>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </div>
        </div>

        <!-- 锁屏设置TAB -->
        <div v-if="activeTab === 'screenlock'" class="tab-panel tf-tab-panel">
          <div class="screen-lock-settings-wrapper">
            <!-- 设置卡片组 -->
            <div class="settings-cards-group">
              <!-- 屏幕保护设置卡片 -->
              <div class="setting-card">
                <div class="card-header-custom">
                  <div class="card-title">
                    <i class="fas fa-desktop"></i>
                    <span>屏幕保护设置</span>
                  </div>
                  <el-button
                    type="primary"
                    size="small"
                    @click="saveScreenLockSettings"
                    :loading="isLoading"
                    :disabled="!canUpdateSettings"
                  >
                    <span v-if="isLoading">保存中...</span>
                    <template v-else>
                      <i class="fas fa-save"></i>
                      <span>保存</span>
                    </template>
                  </el-button>
                </div>

                <el-alert
                  title="功能说明"
                  type="info"
                  show-icon
                  :closable="false"
                  style="margin-bottom: 20px;"
                >
                  <p>• 点击顶部操作栏的"锁定"按钮即可锁定屏幕</p>
                  <p>• 解锁时需要输入您当前的登录密码</p>
                </el-alert>

                <el-form
                  ref="screenLockFormRef"
                  :model="screenLockSettings"
                  :disabled="!canUpdateSettings"
                  label-width="100px"
                  label-position="left"
                  class="screen-lock-form"
                >
                  <!-- 背景类型 -->
                  <el-form-item label="背景类型">
                    <el-radio-group v-model="screenLockSettings.backgroundType">
                      <el-radio value="default">默认背景</el-radio>
                      <el-radio value="image">图片背景</el-radio>
                      <el-radio value="video">视频背景</el-radio>
                    </el-radio-group>
                  </el-form-item>

                  <!-- 图片背景 -->
                  <el-form-item
                    v-if="screenLockSettings.backgroundType === 'image'"
                    label="背景图片"
                  >
                    <div class="image-upload-container">
                      <div v-if="screenLockSettings.imageUrl" class="image-preview">
                        <Image :src="screenLockSettings.imageUrl" alt="背景图片" mode="eager" />
                        <el-button
                          type="danger"
                          size="small"
                          @click="screenLockSettings.imageUrl = ''"
                          style="position: absolute; top: 8px; right: 8px"
                        >
                          <i class="fas fa-times"></i>
                        </el-button>
                      </div>
                      <div v-else class="upload-placeholder">
                        <i class="fas fa-image"></i>
                        <span>暂无图片</span>
                      </div>
                      <el-input
                        v-model="screenLockSettings.imageUrl"
                        placeholder="输入图片URL或上传图片"
                        clearable
                      />
                    </div>
                    <div class="form-help">
                      支持 JPG、PNG 格式，建议尺寸 1920x1080，文件大小不超过 5MB
                    </div>
                  </el-form-item>

                  <!-- 视频背景 -->
                  <el-form-item
                    v-if="screenLockSettings.backgroundType === 'video'"
                    label="背景视频"
                  >
                    <div class="video-upload-container">
                      <div v-if="screenLockSettings.videoUrl" class="video-preview">
                        <video :src="screenLockSettings.videoUrl" muted loop></video>
                        <el-button
                          type="danger"
                          size="small"
                          @click="screenLockSettings.videoUrl = ''"
                          style="position: absolute; top: 8px; right: 8px"
                        >
                          <i class="fas fa-times"></i>
                        </el-button>
                      </div>
                      <div v-else class="upload-placeholder">
                        <i class="fas fa-video"></i>
                        <span>暂无视频</span>
                      </div>
                      <el-input
                        v-model="screenLockSettings.videoUrl"
                        placeholder="输入视频URL"
                        clearable
                      />
                    </div>
                    <div class="form-help">
                      支持 MP4、WebM 格式，建议时长 10-30 秒，文件大小不超过 50MB
                    </div>
                  </el-form-item>

                  <!-- 锁定信息 -->
                  <el-form-item label="锁定标题">
                    <el-input
                      v-model="screenLockSettings.title"
                      placeholder="屏幕已锁定"
                      maxlength="30"
                      show-word-limit
                    />
                  </el-form-item>

                  <el-form-item label="锁定提示">
                    <el-input
                      v-model="screenLockSettings.message"
                      type="textarea"
                      :rows="2"
                      placeholder="请输入密码解锁"
                      maxlength="100"
                      show-word-limit
                    />
                  </el-form-item>
                </el-form>
              </div>

              <!-- 批发报价查询设置卡片 -->
              <div class="setting-card">
                <div class="card-header-custom">
                  <div class="card-title">
                    <i class="fas fa-search-dollar"></i>
                    <span>批发报价查询</span>
                  </div>
                </div>

                <!-- 密码列表 -->
                <div v-if="canManageInventoryPasswords" class="password-list-section">
                  <div class="password-list-header">
                    <h4>密码列表</h4>
                    <el-button
                      type="primary"
                      size="small"
                      @click="showAddPasswordDialog"
                      :icon="Plus"
                    >
                      添加密码
                    </el-button>
                  </div>

                  <el-table
                    :data="loadingPasswords ? [] : inventoryPasswords"
                    border
                    stripe
                    class="data-table mobile-password-table"
                    style="width: 100%; margin-top: 12px;"
                  >
                    <template #empty>
                      <TableLoadingRow v-if="loadingPasswords" mode="block" text="加载中..." />
                      <el-empty v-else description="暂无密码记录" />
                    </template>

                    <el-table-column prop="name" label="用户名" min-width="100" class-name="complete-text-column" />
                    <el-table-column prop="password" label="密码" width="100" align="center">
                      <template #default="{ row }">
                        <span class="password-mask">******</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="remarks" label="备注" min-width="100" class-name="complete-text-column wrapped-text-column" />
                    <el-table-column prop="is_active" label="状态" width="80" align="center">
                      <template #default="{ row }">
                        <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
                          {{ row.is_active ? '启用' : '禁用' }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" :width="$getActionColumnWidth(1 + Number(canDeleteInventoryPasswords))" align="center" class-name="actions-column">
                      <template #default="{ row }">
                        <div class="action-buttons">
                          <el-button
                            type="primary"
                            size="small"
                            link
                            @click.stop="editPassword(row)"
                            :icon="Edit"
                          >
                            编辑
                          </el-button>
                          <el-button
                            v-if="canDeleteInventoryPasswords"
                            type="danger"
                            size="small"
                            link
                            @click.stop="deletePassword(row.id)"
                            :icon="Delete"
                          >
                            删除
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                    </el-table>
                </div>
                <el-alert
                  v-else
                  title="需要系统设置编辑权限才能管理批发报价查询密码"
                  type="warning"
                  :closable="false"
                  show-icon
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 预警配置TAB -->
        <div v-if="activeTab === 'warning'" class="tab-panel tf-tab-panel">
          <div class="phone-warning-config-wrapper">
            <PhoneWarningConfigView ref="warningConfigRef" />
          </div>
        </div>

        <div v-if="activeTab === 'returngoods' && canViewReturngoods" class="tab-panel tf-tab-panel">
          <Returngoods ref="returngoodsRef" />
        </div>
      </div>
    </div>

    <!-- 添加/编辑密码对话框 -->
    <MobileDialog
      v-model="passwordDialogVisible"
      :title="passwordDialogMode === 'add' ? '添加密码' : '编辑密码'"
      width="500px"
      :close-on-click-modal="false"
      dialog-class="system-password-dialog"
      :show-default-footer="false"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordFormRules"
        label-width="80px"
      >
        <el-form-item label="用户名" prop="name">
          <el-input
            v-model="passwordForm.name"
            placeholder="请输入用户名（如：张三、总店、广场店等）"
            clearable
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="passwordForm.password"
            type="text"
            :placeholder="passwordDialogMode === 'edit' ? '留空表示不修改密码' : '请输入密码'"
            clearable
            show-password
          />
        </el-form-item>
        <el-form-item label="备注" prop="remarks">
          <el-input
            v-model="passwordForm.remarks"
            type="textarea"
            :rows="2"
            placeholder="请输入备注说明（可选）"
            clearable
          />
        </el-form-item>
        <el-form-item label="状态" prop="is_active">
          <el-switch
            v-model="passwordForm.is_active"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePassword" :loading="savingPassword">
          {{ passwordDialogMode === 'add' ? '添加' : '保存' }}
        </el-button>
      </template>
    </MobileDialog>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Setting, Lock, Plus, Edit, Delete } from '@element-plus/icons-vue'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { buildLogoUrl } from '@/utils/logoUtils'
import { PermissionGate, PageHeader } from '@/components/base'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import Image from '@/components/Image.vue'
import { ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import PhoneWarningConfigView from '@/views/system/phone-warning-config/PhoneWarningConfigView.vue'
import Returngoods from '@/views/system/page/Returngoods.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'

const SITE_LOGO_ALLOWED_MIME_TYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.svg': ['image/svg+xml'],
  '.ico': [
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'application/vnd.microsoft.icon',
    'application/x-ico',
    'image/ico',
    'application/octet-stream'
  ]
} as const

const SITE_LOGO_ACCEPT = Object.keys(SITE_LOGO_ALLOWED_MIME_TYPES).join(',')
const SITE_LOGO_ALLOWED_EXTENSIONS = Object.keys(SITE_LOGO_ALLOWED_MIME_TYPES)
const SITE_LOGO_ALLOWED_LABEL = 'JPG、PNG、GIF、SVG、ICO'

const getSiteLogoFileExtension = (fileName: string) => {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
  return SITE_LOGO_ALLOWED_EXTENSIONS.includes(extension) ? extension : ''
}

const isValidSiteLogoMimeType = (extension: string, mimeType: string) => {
  if (!mimeType) {
    return true
  }

  const allowedMimeTypes = (SITE_LOGO_ALLOWED_MIME_TYPES[extension as keyof typeof SITE_LOGO_ALLOWED_MIME_TYPES] ?? []) as readonly string[]
  return allowedMimeTypes.includes(mimeType.toLowerCase())
}

// 路由和权限
const route = useRoute()
const siteSettingsStore = useSiteSettingsStore()
const { success, error, warning, loading } = useNotification()

// 权限检查 - 使用 usePagePermissions
const { canView, canEdit, canDelete } = usePagePermissions('settings')
const { canView: canViewReturngoods } = usePagePermissions('returngoods')
const canUpdateSettings = computed(() => canEdit.value)
const canManageInventoryPasswords = computed(() => canEdit.value)
const canDeleteInventoryPasswords = computed(() => canDelete.value)

// 状态数据
const isLoading = ref(false)
const refreshing = ref(false)
const lastSavedTime = ref('')
const logoUploading = ref(false)
const siteLogoInputRef = ref<HTMLInputElement | null>(null)
const localSiteLogoPreviewUrl = ref('')
const warningConfigRef = ref<{
  openAddDialog: () => void
  loadConfigs: () => void
} | null>(null)
const returngoodsRef = ref<{
  reload: () => void
} | null>(null)

// TAB管理 - 支持从 URL 参数读取
const activeTab = ref((route.query.tab as string) || 'settings')

const openWarningTemplateDialog = () => {
  warningConfigRef.value?.openAddDialog()
}

// 刷新系统状态
const refreshSystemStatus = async () => {
  if (!canView.value) {
    return
  }

  if (refreshing.value) return

  refreshing.value = true
  try {
    await Promise.all([
      siteSettingsStore.loadSiteSettings(true),
      loadScreenLockSettings(),
      ...(activeTab.value === 'returngoods' ? [returngoodsRef.value?.reload?.()] : [])
    ])
    success('系统状态已刷新')
  } catch (err) {
    error('刷新失败')
  } finally {
    refreshing.value = false
  }
}

// 使用全局站点设置store
const siteSettings = computed(() => siteSettingsStore.settings)
const siteLogoPreviewUrl = computed(() => {
  if (localSiteLogoPreviewUrl.value) {
    return localSiteLogoPreviewUrl.value
  }

  return siteSettings.value.logoUrl ? buildLogoUrl(siteSettings.value.logoUrl) : ''
})

const clearLocalSiteLogoPreview = () => {
  if (localSiteLogoPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(localSiteLogoPreviewUrl.value)
  }

  localSiteLogoPreviewUrl.value = ''
}

const setLocalSiteLogoPreview = (file: File) => {
  clearLocalSiteLogoPreview()
  localSiteLogoPreviewUrl.value = URL.createObjectURL(file)
}

// 站点信息表格配置
const siteSettingsList = [
  {
    key: 'logoUrl',
    label: 'Logo 地址',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-image',
    placeholder: '/uploads/brand/brand_xxx.png'
  },
  // 基本信息
  {
    key: 'siteName',
    label: '网站名称',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-building',
    placeholder: '腾飞数码管理系统'
  },
  {
    key: 'siteSubtitle',
    label: '站点副标题',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-quote-right',
    placeholder: '专业的手机销售管理解决方案'
  },
  {
    key: 'siteDomain',
    label: '网站域名',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-globe',
    placeholder: 'www.tf2025.com'
  },
  {
    key: 'icpNumber',
    label: 'ICP备案号',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-certificate',
    placeholder: '京ICP备12345678号'
  },
  // 公司信息
  {
    key: 'companyName',
    label: '公司名称',
    category: 'company',
    categoryLabel: '公司信息',
    type: 'input',
    icon: 'fas fa-building',
    placeholder: '腾飞数码科技有限公司'
  },
  {
    key: 'contactPhone',
    label: '联系电话',
    category: 'company',
    categoryLabel: '公司信息',
    type: 'input',
    icon: 'fas fa-phone',
    placeholder: '400-123-4567'
  },
  {
    key: 'contactEmail',
    label: '联系邮箱',
    category: 'company',
    categoryLabel: '公司信息',
    type: 'input',
    icon: 'fas fa-envelope',
    placeholder: 'service@tf2025.com'
  },
  {
    key: 'companyAddress',
    label: '公司地址',
    category: 'company',
    categoryLabel: '公司信息',
    type: 'textarea',
    icon: 'fas fa-map-marker-alt',
    placeholder: '北京市朝阳区建国路88号SOHO现代城A座2808室'
  }
]

// 锁屏设置
const screenLockSettings = reactive({
  backgroundType: 'default',
  imageUrl: '',
  videoUrl: '',
  title: '屏幕已锁定',
  message: '请输入密码解锁',
  inventoryQueryPassword: '' // 在库查询密码（已废弃，改用多密码管理）
})

// 在库查询密码管理
const inventoryPasswords = ref<any[]>([])
const loadingPasswords = ref(false)
const passwordDialogVisible = ref(false)
const passwordDialogMode = ref<'add' | 'edit'>('add')
const passwordFormRef = ref<FormInstance>()
const savingPassword = ref(false)
const currentPasswordId = ref<number | null>(null)

const passwordForm = reactive({
  name: '',
  password: '',
  remarks: '',
  is_active: true
})

// 动态密码验证规则
const passwordFormRules = computed(() => ({
  name: [
    ValidationRules.required('请输入用户名')
  ],
  password: passwordDialogMode.value === 'add'
    ? [ValidationRules.required('请输入密码')]
    : []
}))

// 保存站点信息设置
const saveSiteSettings = async () => {
  if (!canUpdateSettings.value) {
    error('您没有修改系统设置的权限')
    return
  }

  const closeLoading = loading('正在保存设置...')

  try {
    // 保存站点设置
    const result = await siteSettingsStore.updateSiteSettings(siteSettings.value)

    if (result) {
      lastSavedTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)

      // 保存成功后立即重新加载站点设置以确保最新数据
      await siteSettingsStore.loadSiteSettings(true)

      if (result.unsupportedFields?.length) {
        warning(`以下字段当前未写入数据库：${result.unsupportedFields.join('、')}`)
      } else {
        success('站点信息保存成功')
      }
    } else {
      throw new Error('保存失败')
    }
  } catch (err: any) {
    logger.error('保存设置失败:', err)
    error(`设置保存失败: ${err.message || '未知错误'}`)
  } finally {
    closeLoading()
  }
}

const triggerSiteLogoUpload = () => {
  if (logoUploading.value) {
    return
  }

  if (!canUpdateSettings.value) {
    error('您没有修改系统设置的权限')
    return
  }

  siteLogoInputRef.value?.click()
}

const resetSiteLogoInput = () => {
  if (siteLogoInputRef.value) {
    siteLogoInputRef.value.value = ''
  }
}

const handleSiteLogoFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  const extension = getSiteLogoFileExtension(file.name)
  if (!extension) {
    error(`仅支持 ${SITE_LOGO_ALLOWED_LABEL} 格式`)
    resetSiteLogoInput()
    return
  }

  if (!isValidSiteLogoMimeType(extension, file.type)) {
    error(`文件类型校验失败，仅支持 ${SITE_LOGO_ALLOWED_LABEL} 格式`)
    resetSiteLogoInput()
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    error('Logo 文件不能超过 5MB')
    resetSiteLogoInput()
    return
  }

  setLocalSiteLogoPreview(file)

  const formData = new FormData()
  formData.append('image', file)

  logoUploading.value = true
  const closeLoading = loading('正在上传Logo...')

  try {
    const response = await unifiedApi.upload('/system/upload-brand-image', formData)
    if (!response.success || !response.data?.url) {
      throw new Error(response.message || '上传失败')
    }

    siteSettingsStore.settings.logoUrl = response.data.url
    await siteSettingsStore.loadSiteSettings(true)
    clearLocalSiteLogoPreview()
    success('Logo上传成功')
  } catch (err: any) {
    logger.error('上传站点Logo失败:', err)
    clearLocalSiteLogoPreview()
    error(err?.message || 'Logo上传失败')
  } finally {
    logoUploading.value = false
    resetSiteLogoInput()
    closeLoading()
  }
}

const clearSiteLogo = async () => {
  if (!canUpdateSettings.value) {
    error('您没有修改系统设置的权限')
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定要清空当前站点 Logo 吗？',
      '清空 Logo',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    )

    const closeLoading = loading('正在清空Logo...')
    try {
      clearLocalSiteLogoPreview()
      const result = await siteSettingsStore.updateSiteSettings({
        ...siteSettings.value,
        logoUrl: ''
      })

      if (!result) {
        throw new Error('清空失败')
      }

      await siteSettingsStore.loadSiteSettings(true)
      success('Logo已清空')
    } finally {
      closeLoading()
    }
  } catch (err: any) {
    if (err === 'cancel' || err === 'close' || err?.message === 'cancel') {
      return
    }
    logger.error('清空站点Logo失败:', err)
    error(err?.message || '清空Logo失败')
  }
}

// 加载锁屏设置
const loadScreenLockSettings = async () => {
  try {
    const response = await unifiedApi.get('/screen-lock')
    if (response.success && response.data) {
      Object.assign(screenLockSettings, response.data)
    }
  } catch (error) {
    logger.error('加载锁屏设置失败:', error)
  }
}

// 保存锁屏设置
const saveScreenLockSettings = async () => {
  if (!canUpdateSettings.value) {
    error('您没有修改锁屏设置的权限')
    return
  }

  const closeLoading = loading('正在保存锁屏设置...')

  try {
    const response = await unifiedApi.post('/screen-lock', screenLockSettings)

    if (response.success) {
      lastSavedTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
      success('锁屏设置保存成功')
    } else {
      throw new Error(response.message || '保存失败')
    }
  } catch (err) {
    logger.error('保存锁屏设置失败:', err)
    error(`保存失败：${err.message || '未知错误'}`)
  } finally {
    closeLoading()
  }
}

// 加载在库查询密码列表
const loadInventoryPasswords = async () => {
  if (!canManageInventoryPasswords.value) {
    inventoryPasswords.value = []
    return
  }

  loadingPasswords.value = true
  try {
    const response = await unifiedApi.get('/screen-lock/query-users')
    if (response.success) {
      // 后端返回 { success: true, data: { total: N, data: [...] } }
      inventoryPasswords.value = extractResponseData<any[]>(response)
    } else {
      logger.warn('⚠️ 密码列表响应格式异常:', response)
    }
  } catch (err) {
    logger.error('❌ 加载密码列表失败:', err)
  } finally {
    loadingPasswords.value = false
  }
}

// 显示添加密码对话框
const showAddPasswordDialog = () => {
  if (!canManageInventoryPasswords.value) {
    error('您没有管理批发报价查询密码的权限')
    return
  }

  passwordDialogMode.value = 'add'
  currentPasswordId.value = null
  Object.assign(passwordForm, {
    name: '',
    password: '',
    remarks: '',
    is_active: true
  })
  passwordDialogVisible.value = true
}

// 编辑密码
const editPassword = (row: any) => {
  if (!canManageInventoryPasswords.value) {
    error('您没有管理批发报价查询密码的权限')
    return
  }

  passwordDialogMode.value = 'edit'
  currentPasswordId.value = row.id
  Object.assign(passwordForm, {
    name: row.name,
    password: '', // 编辑时密码为空，留空表示不修改密码
    remarks: row.remarks || '',
    is_active: row.is_active === 1 || row.is_active === true // 确保转换为布尔值
  })
  passwordDialogVisible.value = true
}

// 保存密码
const savePassword = async () => {
  if (savingPassword.value) return

  if (!canManageInventoryPasswords.value) {
    error('您没有管理批发报价查询密码的权限')
    return
  }

  if (!passwordFormRef.value) return

  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return

    savingPassword.value = true
    try {
      if (passwordDialogMode.value === 'add') {
        await unifiedApi.post('/screen-lock/query-users', passwordForm)
        success('用户添加成功')
      } else {
        await unifiedApi.put(`/screen-lock/query-users/${currentPasswordId.value}`, passwordForm)
        success('用户更新成功')
      }
      passwordDialogVisible.value = false
      await loadInventoryPasswords()
    } catch (err) {
      error(`保存失败：${err.message || '未知错误'}`)
    } finally {
      savingPassword.value = false
    }
  })
}

// 删除密码
const deletePassword = async (id: number) => {
  if (!canDeleteInventoryPasswords.value) {
    error('您没有删除批发报价查询密码的权限')
    return
  }

  try {
    await ElMessageBox.confirm('确定要删除这个密码吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await unifiedApi.delete(`/screen-lock/query-users/${id}`)
    success('删除成功')
    await loadInventoryPasswords()
  } catch (err) {
    if (err !== 'cancel') {
      error(`删除失败：${err.message || '未知错误'}`)
    }
  }
}

// 处理键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 's':
        event.preventDefault()
        saveSiteSettings()
        break
    }
  }
}

// 生命周期
onMounted(async () => {
  // 初始化数据
  if (canView.value) {
    try {
      if (activeTab.value === 'returngoods' && !canViewReturngoods.value) {
        activeTab.value = 'settings'
      }

      // 加载数据
      await Promise.all([
        siteSettingsStore.loadSiteSettings(true), // 强制重新加载站点设置
        loadScreenLockSettings(), // 加载锁屏设置
        ...(canManageInventoryPasswords.value ? [loadInventoryPasswords()] : [])
      ])
    } catch (err) {
      logger.error('系统管理页面初始化失败:', err)
    }
  }

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  clearLocalSiteLogoPreview()
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.system-management {
  padding: 24px;
  background: var(--bg-primary, #f5f7fa);
  min-height: 100vh;
}

/* 系统容器 */
.system-container {
  background: transparent;
}

/* 站点信息设置部分 */
.system-settings-section {
  margin-bottom: 0;
}

/* 站点信息展示卡片 */
.site-settings-cards {
  margin-bottom: 32px;
}

/* 站点设置行容器 - PC端一行展示 */
.site-settings-row {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

/* 响应式：当屏幕较小时改为单列 */
@media (max-width: 1400px) {
  .site-settings-row {
    grid-template-columns: 350px 1fr;
  }
}

@media (max-width: 1200px) {
  .site-settings-row {
    grid-template-columns: 1fr;
  }
}

.site-logo-panel {
  padding: 24px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid var(--border-light, #e9ecef);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* 卡片头部带操作按钮 */
.card-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--bg-tertiary, #f8f9fa);
}

.card-header-with-action .card-title,
.card-header-with-action .section-subtitle {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-header-with-action .card-title i,
.card-header-with-action .section-subtitle i {
  color: var(--primary-color, #667eea);
}

.site-logo-preview-card {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 20px;
  border-radius: 12px;
  border: 1px dashed #d8dee9;
  background: linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%);
}

.site-logo-preview-card.clickable {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.site-logo-preview-card.clickable:hover,
.site-logo-preview-card.clickable:focus-visible {
  border-color: var(--primary-color, #667eea);
  box-shadow: 0 6px 18px rgba(102, 126, 234, 0.16);
  transform: translateY(-1px);
  outline: none;
}

.site-logo-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.site-logo-preview img {
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
}

.site-logo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted, #999);
}

.site-logo-empty i {
  font-size: 30px;
  color: #a0aec0;
}

.site-logo-preview-tip {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(44, 62, 80, 0.72);
  color: #fff;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  pointer-events: none;
}

.site-logo-editor {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  min-width: 0;
}

.logo-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.logo-editor-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-editor-header h3 i {
  color: var(--primary-color, #667eea);
}

.logo-editor-tip {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary, #6c757d);
}

.site-logo-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.logo-editor-help {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted, #999);
}

.site-logo-hidden-input {
  display: none;
}

.settings-card-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.settings-card-row:last-child {
  margin-bottom: 0;
}

.settings-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-light, #e9ecef);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.3s ease;
}

.settings-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.settings-card .card-icon {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-card .card-icon i {
  font-size: 20px;
  color: white;
}

.settings-card .card-content {
  flex: 1;
  min-width: 0;
}

.settings-card .card-content h4 {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #6c757d);
}

.settings-card .card-content p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, #2c3e50);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-subtitle {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-subtitle i {
  color: var(--primary-color, #667eea);
}

/* 移除旧的section-header样式，已不再使用 */

/* 站点信息表格 */
.site-settings-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 24px;
  max-width: 900px;
}

.site-settings-table :deep(.el-input__wrapper) {
  border-radius: 6px;
}

.site-settings-table :deep(.el-input__inner) {
  border: 1px solid var(--border-light, #e9ecef);
}

.site-settings-table :deep(.el-textarea__inner) {
  border-radius: 6px;
  border: 1px solid var(--border-light, #e9ecef);
}

.text-muted {
  color: var(--text-muted, #999);
  font-size: 13px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary, #2c3e50);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-header h2 i {
  color: var(--primary-color, #667eea);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .system-management {
    padding: 16px;
  }

  /* 站点信息卡片响应式 */
  .site-logo-panel {
    grid-template-columns: 1fr;
    padding: 16px;
    gap: 16px;
  }

  .site-logo-preview-card {
    min-height: 160px;
    padding: 16px;
  }

  .site-logo-preview img {
    max-height: 88px;
  }

  .logo-editor-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .site-logo-actions {
    width: 100%;
  }

  .site-logo-actions :deep(.el-button) {
    flex: 1 1 calc(50% - 5px);
    min-width: 0;
  }

  .settings-card-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .settings-card {
    padding: 16px;
  }

  .settings-card .card-icon {
    width: 40px;
    height: 40px;
  }

  .settings-card .card-icon i {
    font-size: 16px;
  }

  .settings-card .card-content h4 {
    font-size: 13px;
  }

  .settings-card .card-content p {
    font-size: 14px;
  }

  /* 站点信息表格响应式 */
  .site-settings-table {
    padding: 16px;
  }

  .section-subtitle {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .site-logo-actions :deep(.el-button) {
    width: 100%;
    flex-basis: 100%;
  }
}

/* 按钮样式 */
/* 锁屏设置样式 */
.screen-lock-settings-wrapper {
  background: transparent;
  padding: 0;
}

/* 设置卡片组 */
.settings-cards-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.setting-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-light, #e9ecef);
  transition: all 0.3s ease;
}

.setting-card:hover {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

.card-header-custom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--bg-tertiary, #f8f9fa);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
  margin: 0;
}

.card-title i {
  font-size: 20px;
  color: var(--primary-color, #667eea);
}

/* 功能演示框 */
.demo-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
}

.demo-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 320px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-text {
  font-size: 14px;
  color: var(--text-primary, #2c3e50);
}

.demo-arrow {
  font-size: 20px;
  color: var(--primary-color, #667eea);
  margin: 4px 0;
}

.screen-lock-form {
  max-width: 800px;
}

.screen-lock-form :deep(.el-form-item__content) {
  min-width: 0;
}

.screen-lock-form :deep(.el-form-item) {
  margin-bottom: 24px;
}

.screen-lock-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--text-primary, #2c3e50);
}

.image-upload-container,
.video-upload-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.image-preview,
.video-preview {
  width: 100%;
  max-width: 400px;
  height: 240px;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 2px solid var(--border-light, #e9ecef);
}

.image-preview img,
.video-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-placeholder {
  width: 100%;
  max-width: 400px;
  height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #999);
  background: var(--bg-tertiary, #f8f9fa);
  border: 2px dashed var(--border-light, #e9ecef);
  border-radius: 8px;
}

.upload-placeholder i {
  font-size: 48px;
  margin-bottom: 12px;
  color: var(--text-secondary, #6c757d);
}

.upload-placeholder span {
  font-size: 14px;
}

.form-help {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted, #999);
  line-height: 1.5;
}

/* 密码列表样式 */
.password-list-section {
  margin-top: 24px;
}

.password-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.password-list-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #2c3e50);
}

.password-mask {
  color: var(--text-muted, #999);
  font-family: monospace;
  letter-spacing: 2px;
}

/* 操作按钮样式 */
.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
}

/* 响应式设计 - 锁屏设置 */
@media (max-width: 768px) {
  .screen-lock-settings-wrapper {
    width: 100%;
    overflow: hidden;
  }

  .settings-cards-group {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    width: 100%;
  }

  .setting-card {
    min-width: 0;
    padding: 14px;
    border-radius: 14px;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
  }

  .card-header-custom {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 12px;
  }

  .card-title {
    min-width: 0;
    gap: 8px;
    font-size: 15px;
    line-height: 1.25;
  }

  .card-title i {
    font-size: 16px;
  }

  .card-header-custom .el-button {
    width: auto;
    flex: 0 0 auto;
    justify-content: center;
    padding: 8px 10px;
  }

  .screen-lock-settings-wrapper :deep(.el-alert) {
    margin-bottom: 14px !important;
    border-radius: 12px;
  }

  .screen-lock-settings-wrapper :deep(.el-alert__content) {
    min-width: 0;
  }

  .screen-lock-settings-wrapper :deep(.el-alert p) {
    margin: 3px 0;
    font-size: 12px;
    line-height: 1.45;
  }

  .demo-step {
    padding: 10px 16px;
    max-width: 100%;
  }

  .step-text {
    font-size: 13px;
  }

  .image-preview,
  .video-preview,
  .upload-placeholder {
    max-width: 100%;
    height: 150px;
    border-radius: 12px;
  }

  .screen-lock-form {
    max-width: 100%;
  }

  .screen-lock-form :deep(.el-form-item__label) {
    width: 100% !important;
    text-align: left !important;
  }

  .screen-lock-settings-wrapper :deep(.el-form) {
    width: 100%;
  }

  .screen-lock-settings-wrapper :deep(.el-form-item) {
    display: block;
    margin-bottom: 16px;
  }

  .screen-lock-settings-wrapper :deep(.el-form-item__label) {
    width: 100% !important;
    margin-bottom: 8px;
    padding: 0 !important;
    line-height: 1.4;
    font-size: 13px;
    font-weight: 700;
    text-align: left !important;
  }

  .screen-lock-settings-wrapper :deep(.el-form-item__content) {
    width: 100%;
    margin-left: 0 !important;
    min-width: 0;
  }

  .screen-lock-settings-wrapper :deep(.el-radio-group) {
    display: grid;
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 8px;
    width: 100%;
  }

  .screen-lock-settings-wrapper :deep(.el-radio) {
    margin-right: 0;
    height: auto;
    min-height: 38px;
    padding: 9px 10px;
    border: 1px solid var(--border-light, #e9ecef);
    border-radius: 12px;
    background: rgba(248, 250, 252, 0.9);
  }

  .screen-lock-settings-wrapper :deep(.el-radio__label) {
    font-size: 13px;
    line-height: 1.3;
  }

  .screen-lock-settings-wrapper :deep(.el-input),
  .screen-lock-settings-wrapper :deep(.el-textarea) {
    width: 100%;
  }

  .image-upload-container,
  .video-upload-container {
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  .upload-placeholder i {
    margin-bottom: 8px;
    font-size: 30px;
  }

  .upload-placeholder span,
  .form-help {
    font-size: 12px;
  }

  .form-help {
    margin-top: 6px;
  }

  .password-list-section {
    margin-top: 4px;
  }

  .screen-lock-settings-wrapper .password-list-header {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .screen-lock-settings-wrapper .password-list-header h4 {
    font-size: 15px;
  }

  .screen-lock-settings-wrapper .password-list-header .el-button {
    width: auto;
    flex: 0 0 auto;
  }

  .screen-lock-settings-wrapper .action-buttons {
    justify-content: flex-end;
  }

  .screen-lock-settings-wrapper :deep(.mobile-password-table) {
    display: block;
    width: 100% !important;
    overflow-x: auto;
    font-size: 12px;
    border-radius: 12px;
    -webkit-overflow-scrolling: touch;
  }

  .screen-lock-settings-wrapper :deep(.mobile-password-table .el-table__inner-wrapper) {
    min-width: 520px;
  }

  .screen-lock-settings-wrapper :deep(.mobile-password-table .cell) {
    padding-left: 6px;
    padding-right: 6px;
    white-space: nowrap;
  }

  :global(.system-password-dialog .el-form) {
    width: 100%;
  }

  :global(.system-password-dialog .el-form-item) {
    display: block;
    margin-bottom: 16px;
  }

  :global(.system-password-dialog .el-form-item__label) {
    width: 100% !important;
    margin-bottom: 8px;
    padding: 0 !important;
    text-align: left !important;
    font-size: 13px;
    font-weight: 700;
  }

  :global(.system-password-dialog .el-form-item__content) {
    margin-left: 0 !important;
    width: 100%;
  }

  :global(.system-password-dialog .el-input),
  :global(.system-password-dialog .el-textarea) {
    width: 100%;
  }

  .phone-warning-config-wrapper {
    background: transparent;
    padding: 0;
    height: calc(100vh - 200px);
    min-height: 600px;

    .warning-config-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: var(--bg-primary, #f5f7fa);
      border-radius: 8px;
    }
  }
}

@media (max-width: 480px) {
  .setting-card {
    padding: 12px;
    border-radius: 12px;
  }

  .card-header-custom {
    align-items: flex-start;
  }

  .card-header-custom .el-button span {
    display: none;
  }

  .image-preview,
  .video-preview,
  .upload-placeholder {
    height: 132px;
  }

  .screen-lock-settings-wrapper .password-list-header {
    align-items: stretch;
    flex-direction: column;
  }

  .screen-lock-settings-wrapper .password-list-header .el-button {
    width: 100%;
  }

  .screen-lock-settings-wrapper :deep(.mobile-password-table .el-table__inner-wrapper) {
    min-width: 500px;
  }
}
</style>
