<template>
  <PermissionGate :can-view="permissions.canView.value" module-name="导航管理">
    <div class="admin-page guide-management">
      <PageHeader title="导航管理" icon="fas fa-compass" description="维护 /DH 公开导航站的公告、分类、网址和文件">
        <template #actions>
          <el-button v-if="permissions.canCreate.value" type="primary" @click="openAnnouncementForm()"><i class="fas fa-plus" /> 新增公告</el-button>
          <el-button v-if="permissions.canCreate.value" type="success" @click="openCategoryForm()"><i class="fas fa-layer-group" /> 新增分类</el-button>
          <el-button class="tf-button--view" :loading="loading" @click="loadData"><i class="fas fa-sync-alt" /> 刷新</el-button>
        </template>
      </PageHeader>

      <div class="admin-page-content">
      <section class="guide-panel">
        <div class="guide-panel__heading"><div><h2>顶部公告</h2><p>前台会按排序展示当前有效公告。</p></div><span class="guide-count">{{ announcements.length }} 条</span></div>
        <DataEmptyState v-if="!announcements.length && !loading" size="compact" description="暂无公告" />
        <div v-else class="announcement-list">
          <div v-for="item in announcements" :key="item.id" class="announcement-row">
            <span class="drag-handle"><i class="fas fa-grip-vertical" /></span>
            <div class="announcement-row__content"><strong>{{ item.title }}</strong><span v-if="item.content">{{ item.content }}</span></div>
            <el-tag size="small" :type="item.is_enabled ? 'success' : 'info'">{{ item.is_enabled ? '启用' : '停用' }}</el-tag>
            <div class="row-actions">
              <el-button v-if="permissions.canEdit.value" class="table-action table-action--edit" @click="openAnnouncementForm(item)">编辑</el-button>
              <el-button v-if="permissions.canDelete.value" class="table-action table-action--delete" @click="removeAnnouncement(item)">删除</el-button>
            </div>
          </div>
        </div>
      </section>

      <section class="guide-panel">
        <div class="guide-panel__heading"><div><h2>导航分类</h2><p>公开分类直接展示，密码分类只展示锁定状态。</p></div><span class="guide-count">{{ categories.length }} 个</span></div>
        <DataEmptyState v-if="!categories.length && !loading" size="compact" description="暂无分类" />
        <div v-else class="category-list">
          <article v-for="category in categories" :key="category.id" class="category-admin-card">
            <div class="category-admin-card__header">
              <div class="category-admin-card__icon"><i :class="category.icon || 'fas fa-layer-group'" /></div>
              <div class="category-admin-card__title"><h3>{{ category.name }}</h3><p>{{ category.description || '未填写分类说明' }}</p></div>
              <el-tag size="small" :type="category.access_mode === 'password' ? 'warning' : 'success'">{{ category.access_mode === 'password' ? '密码访问' : '公开访问' }}</el-tag>
              <div class="row-actions">
                <el-button v-if="permissions.canCreate.value" type="primary" class="table-action" @click="openLinkForm(category)">新增连接</el-button>
                <el-button v-if="permissions.canCreate.value" type="primary" class="table-action" @click="openSubcategoryForm(category)">新增二级分类</el-button>
                <el-button v-if="permissions.canEdit.value" class="table-action table-action--edit" @click="openCategoryForm(category)">编辑</el-button>
                <el-button v-if="permissions.canDelete.value" class="table-action table-action--delete" @click="removeCategory(category)">删除</el-button>
              </div>
            </div>
            <div class="category-admin-card__links">
              <div v-if="category.children?.length" class="guide-category-tabs">
                <el-tabs v-model="activeCategoryTabs[category.id]" class="tf-page-tabs">
                  <el-tab-pane :label="category.name" :name="categoryTabName(category)" class="tf-tab-panel" />
                  <el-tab-pane v-for="subcategory in category.children" :key="subcategory.id" :label="subcategory.name" :name="categoryTabName(subcategory)" class="tf-tab-panel" />
                </el-tabs>
              </div>
              <div v-if="activeSubcategory(category)" class="subcategory-tab-actions">
                <strong>{{ activeSubcategory(category)?.name }}</strong>
                <div class="row-actions">
                  <el-button v-if="permissions.canEdit.value" class="table-action table-action--edit" title="编辑二级分类" @click="openCategoryForm(activeSubcategory(category)!)">编辑</el-button>
                  <el-button v-if="permissions.canDelete.value" class="table-action table-action--delete" title="删除二级分类" @click="removeCategory(activeSubcategory(category)!)">删除</el-button>
                </div>
              </div>
              <div v-for="link in activeCategoryLinks(category)" :key="link.id" class="link-admin-row">
                <span class="link-admin-row__icon"><i :class="link.link_type === 'file' ? 'fas fa-file' : 'fas fa-link'" /></span>
                <span class="link-admin-row__body"><strong>{{ link.title }}</strong><small>{{ link.description || (link.link_type === 'file' ? link.file_name || '文件' : link.url) }}</small></span>
                <el-tag size="small" :type="link.is_enabled ? 'success' : 'info'">{{ link.is_enabled ? '启用' : '停用' }}</el-tag>
                <div class="row-actions">
                  <el-button v-if="permissions.canEdit.value" class="table-action table-action--edit" @click="openLinkForm(activeCategoryTarget(category), link)">编辑</el-button>
                  <el-button v-if="permissions.canDelete.value" class="table-action table-action--delete" @click="removeLink(link)">删除</el-button>
                </div>
              </div>
              <DataEmptyState v-if="!activeCategoryLinks(category).length" size="compact" description="当前分类暂无连接" />
            </div>
          </article>
        </div>
      </section>

      <p class="guide-route-tip">公开地址：<a href="/DH" target="_blank" rel="noreferrer">/DH</a></p>
      </div>
    </div>

    <MobileDialog v-model="announcementVisible" :title="editingAnnouncement ? '编辑公告' : '新增公告'" width="560px" :show-default-footer="false">
      <form class="guide-form" @submit.prevent="saveAnnouncement">
        <el-form-item label="标题"><el-input v-model="announcementForm.title" maxlength="120" show-word-limit /></el-form-item>
        <el-form-item label="内容"><el-input v-model="announcementForm.content" class="tf-textarea" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
        <el-form-item label="跳转链接"><el-input v-model="announcementForm.link_url" placeholder="可选，支持 https://" /></el-form-item>
        <div class="guide-form-grid"><el-form-item label="排序"><el-input-number v-model="announcementForm.sort_order" :min="0" :max="9999" :controls="false" /></el-form-item><el-form-item label="状态"><el-switch v-model="announcementForm.is_enabled" active-text="启用" inactive-text="停用" /></el-form-item></div>
        <el-form-item label="置顶"><el-switch v-model="announcementForm.is_pinned" active-text="置顶公告" inactive-text="普通公告" /></el-form-item>
        <div class="guide-dialog-actions"><el-button @click="announcementVisible = false">取消</el-button><el-button type="primary" native-type="submit" :loading="saving">保存</el-button></div>
      </form>
    </MobileDialog>

    <MobileDialog v-model="categoryVisible" :title="editingCategory ? '编辑分类' : (categoryForm.parent_id ? '新增二级分类' : '新增分类')" width="620px" :show-default-footer="false">
      <form class="guide-form" @submit.prevent="saveCategory">
        <el-form-item label="所属一级分类"><el-select v-model="categoryForm.parent_id" clearable filterable placeholder="不选择则为一级分类" :disabled="Boolean(editingCategory?.children?.length)"><el-option v-for="parent in parentCategoryOptions" :key="parent.id" :label="parent.name" :value="parent.id" /></el-select></el-form-item>
        <div class="guide-form-grid"><el-form-item label="分类名称"><el-input v-model="categoryForm.name" maxlength="80" /></el-form-item><el-form-item label="图标"><el-input v-model="categoryForm.icon" placeholder="例如 fas fa-bookmark" /></el-form-item></div>
        <el-form-item label="说明"><el-input v-model="categoryForm.description" class="tf-textarea" type="textarea" :rows="2" maxlength="255" /></el-form-item>
        <div class="guide-form-grid"><el-form-item label="访问方式"><el-select v-model="categoryForm.access_mode"><el-option label="公开访问" value="public" /><el-option label="密码访问" value="password" /></el-select></el-form-item><el-form-item label="状态"><el-switch v-model="categoryForm.is_enabled" active-text="启用" inactive-text="停用" /></el-form-item></div>
        <template v-if="categoryForm.access_mode === 'password'">
          <div class="guide-form-grid"><el-form-item label="访问密码"><el-input v-model="categoryForm.password" type="password" show-password :placeholder="editingCategory ? '留空表示保持原密码' : '设置访问密码'" autocomplete="new-password" /></el-form-item><el-form-item label="有效期"><el-select v-model="categoryForm.password_policy"><el-option v-for="option in passwordPolicies" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item></div>
          <el-form-item v-if="categoryForm.password_policy === 'days'" label="有效天数"><el-input-number v-model="categoryForm.password_expires_days" :min="1" :max="3650" :controls="false" /></el-form-item>
        </template>
        <div class="guide-form-grid"><el-form-item label="排序"><el-input-number v-model="categoryForm.sort_order" :min="0" :max="9999" :controls="false" /></el-form-item><div /></div>
        <div class="guide-dialog-actions"><el-button @click="categoryVisible = false">取消</el-button><el-button type="primary" native-type="submit" :loading="saving">保存</el-button></div>
      </form>
    </MobileDialog>

    <MobileDialog v-model="linkVisible" :title="editingLink ? '编辑连接' : '新增连接'" width="620px" :show-default-footer="false">
      <form class="guide-form" @submit.prevent="saveLink">
        <div class="guide-form-grid"><el-form-item label="名称"><el-input v-model="linkForm.title" maxlength="120" /></el-form-item><el-form-item label="类型"><el-select v-model="linkForm.link_type"><el-option label="网址" value="url" /><el-option label="文件" value="file" /></el-select></el-form-item></div>
        <el-form-item label="所属分类"><el-select v-model="linkForm.category_id" filterable placeholder="选择连接所属分类"><el-option v-for="option in linkCategoryOptions" :key="option.id" :label="option.label" :value="option.id" /></el-select></el-form-item>
        <el-form-item label="说明"><el-input v-model="linkForm.description" class="tf-textarea" type="textarea" :rows="2" maxlength="255" /></el-form-item>
        <el-form-item v-if="linkForm.link_type === 'url'" label="网址"><el-input v-model="linkForm.url" placeholder="https://" /></el-form-item>
        <el-form-item v-else label="文件"><div class="qr-upload"><img v-if="isImageFile(linkForm.file_mime) && linkForm.preview_url" :src="linkForm.preview_url" alt="图片预览"><a v-else-if="linkForm.file_url" href="#" @click.prevent="downloadExistingFile">{{ linkForm.file_name || '已上传文件' }}</a><input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.mobileconfig,.apk,.ipa,.mp3,.m4a,.wav,.flac,.ogg,.mp4,.mov,.avi,.mkv,.webm,.3gp" @change="handleFileChange"><span>选择文件</span></div></el-form-item>
        <div class="guide-form-grid"><el-form-item label="图标"><el-input v-model="linkForm.icon" placeholder="可选，fas fa-link 或图片地址" /></el-form-item><el-form-item label="状态"><el-switch v-model="linkForm.is_enabled" active-text="启用" inactive-text="停用" /></el-form-item></div>
        <div class="guide-form-grid"><el-form-item label="排序"><el-input-number v-model="linkForm.sort_order" :min="0" :max="9999" :controls="false" /></el-form-item><div /></div>
        <div class="guide-dialog-actions"><el-button @click="linkVisible = false">取消</el-button><el-button type="primary" native-type="submit" :loading="saving">保存</el-button></div>
      </form>
    </MobileDialog>
  </PermissionGate>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { PageHeader, PermissionGate } from '@/components/base'
import DataEmptyState from '@/components/DataEmptyState.vue'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useNotification } from '@/composables/useNotification'
import MobileDialog from '@/components/MobileDialog.vue'
import { guideApi } from '@/api/guide'
import { extractBlobResponse, unifiedApi } from '@/utils/unified-api'
import type { GuideAnnouncement, GuideCategory, GuideLink, GuidePasswordPolicy } from '@/types/guide'

const permissions = usePagePermissions('guide')
const { confirm } = useNotification()
const loading = ref(false)
const saving = ref(false)
const announcements = ref<GuideAnnouncement[]>([])
const categories = ref<GuideCategory[]>([])
const announcementVisible = ref(false)
const categoryVisible = ref(false)
const linkVisible = ref(false)
const editingAnnouncement = ref<GuideAnnouncement | null>(null)
const editingCategory = ref<GuideCategory | null>(null)
const editingLink = ref<GuideLink | null>(null)
const selectedCategory = ref<GuideCategory | null>(null)
const passwordPolicies: Array<{ value: GuidePasswordPolicy; label: string }> = [
  { value: 'once', label: '一次性' }, { value: 'day', label: '一天' }, { value: 'days', label: '自定义天数' },
  { value: 'month', label: '一个月' }, { value: 'quarter', label: '一季度' }, { value: 'year', label: '一年' }, { value: 'permanent', label: '永久' }
]
const announcementForm = reactive<Record<string, any>>({ title: '', content: '', link_url: '', is_pinned: false, is_enabled: true, sort_order: 0 })
const categoryForm = reactive<Record<string, any>>({ parent_id: null, name: '', description: '', icon: '', is_enabled: true, sort_order: 0, access_mode: 'public', password: '', password_policy: 'permanent', password_expires_days: 1 })
const linkForm = reactive<Record<string, any>>({ category_id: null, title: '', description: '', url: '', link_type: 'url', icon: '', file_url: '', file_name: '', file_mime: '', preview_url: '', is_enabled: true, sort_order: 0 })
const activeCategoryTabs = reactive<Record<number, string>>({})
const linkCategoryOptions = computed(() => categories.value.flatMap(category => [
  { id: category.id, label: `一级分类：${category.name}` },
  ...(category.children || []).map(child => ({ id: child.id, label: `二级分类：${category.name} / ${child.name}` }))
]))
const parentCategoryOptions = computed(() => categories.value.filter(category => category.id !== editingCategory.value?.id))
const categoryTabName = (category: GuideCategory) => `category-${category.id}`
const activeSubcategory = (category: GuideCategory) => category.children?.find(item => categoryTabName(item) === activeCategoryTabs[category.id]) || null
const activeCategoryTarget = (category: GuideCategory) => activeSubcategory(category) || category
const activeCategoryLinks = (category: GuideCategory) => activeCategoryTarget(category).links || []

const loadData = async () => {
  if (!permissions.canView.value) return
  loading.value = true
  try {
    const response = await guideApi.admin()
    announcements.value = response.data?.announcements || []
    categories.value = response.data?.categories || []
    categories.value.forEach(category => {
      if (!activeCategoryTabs[category.id]) activeCategoryTabs[category.id] = categoryTabName(category)
    })
  } catch (_) {
    ElMessage.error('导航管理数据加载失败')
  } finally { loading.value = false }
}

const openAnnouncementForm = (item?: GuideAnnouncement) => {
  editingAnnouncement.value = item || null
  Object.assign(announcementForm, item || { title: '', content: '', link_url: '', is_pinned: false, is_enabled: true, sort_order: 0 })
  announcementVisible.value = true
}
const openCategoryForm = (item?: GuideCategory) => {
  editingCategory.value = item || null
  Object.assign(categoryForm, { parent_id: item?.parent_id ?? null, name: item?.name || '', description: item?.description || '', icon: item?.icon || '', is_enabled: item?.is_enabled ?? true, sort_order: item?.sort_order || 0, access_mode: item?.access_mode || 'public', password: '', password_policy: item?.password_policy || 'permanent', password_expires_days: item?.password_expires_days || 1 })
  categoryVisible.value = true
}
const openSubcategoryForm = (parent: GuideCategory) => {
  openCategoryForm()
  categoryForm.parent_id = parent.id
}
const openLinkForm = (category: GuideCategory, item?: GuideLink) => {
  selectedCategory.value = category
  editingLink.value = item || null
  Object.assign(linkForm, { category_id: item?.category_id ?? category.id, title: item?.title || '', description: item?.description || '', url: item?.url || '', link_type: item?.link_type || 'url', icon: item?.icon || '', file_url: item?.file_url || '', file_name: item?.file_name || '', file_mime: item?.file_mime || '', preview_url: '', is_enabled: item?.is_enabled ?? true, sort_order: item?.sort_order || 0 })
  linkVisible.value = true
  if (item?.id && isImageFile(item.file_mime)) void loadExistingPreview(item.id)
}

const saveAnnouncement = async () => {
  if (!announcementForm.title.trim()) return ElMessage.warning('请输入公告标题')
  saving.value = true
  try { if (editingAnnouncement.value) await guideApi.updateAnnouncement(editingAnnouncement.value.id, announcementForm); else await guideApi.createAnnouncement(announcementForm); announcementVisible.value = false; await loadData(); ElMessage.success('公告已保存') } catch (_) {} finally { saving.value = false }
}
const saveCategory = async () => {
  if (!categoryForm.name.trim()) return ElMessage.warning('请输入分类名称')
  saving.value = true
  const payload = { ...categoryForm }
  try { if (editingCategory.value) await guideApi.updateCategory(editingCategory.value.id, payload); else await guideApi.createCategory(payload); categoryVisible.value = false; await loadData(); ElMessage.success('分类已保存') } catch (_) {} finally { saving.value = false }
}
const saveLink = async () => {
  if (!selectedCategory.value || !linkForm.title.trim()) return ElMessage.warning('请输入导航名称')
  saving.value = true
  try { if (editingLink.value) await guideApi.updateLink(editingLink.value.id, linkForm); else await guideApi.createLink(selectedCategory.value.id, linkForm); linkVisible.value = false; await loadData(); ElMessage.success('导航已保存') } catch (_) {} finally { saving.value = false }
}

const isImageFile = (mime: string | null | undefined) => String(mime || '').toLowerCase().startsWith('image/')

const loadExistingPreview = async (id: number) => {
  try {
    const response = await unifiedApi.getInstance().get<Blob>(`/guide/links/${id}/preview`, { responseType: 'blob' })
    linkForm.preview_url = URL.createObjectURL(extractBlobResponse(response))
  } catch (_) {
    linkForm.preview_url = ''
  }
}

const downloadExistingFile = async () => {
  if (!editingLink.value?.id) return
  try { await unifiedApi.download(`/guide/links/${editingLink.value.id}/download`, linkForm.file_name || '导航文件') } catch (_) {}
}

const handleFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  try {
    const response = await guideApi.uploadFile(formData)
    linkForm.file_url = response.data?.url || ''
    linkForm.file_name = response.data?.name || file.name
    linkForm.file_mime = response.data?.mime || file.type || 'application/octet-stream'
    linkForm.preview_url = isImageFile(linkForm.file_mime) ? URL.createObjectURL(file) : ''
    ElMessage.success('文件上传成功')
  } catch (_) {}
}
const confirmRemove = async (message: string) => confirm(message, '请确认操作')
const removeAnnouncement = async (item: GuideAnnouncement) => { try { if (!await confirmRemove(`确定删除公告“${item.title}”吗？`)) return; await guideApi.deleteAnnouncement(item.id); await loadData() } catch (_) {} }
const removeCategory = async (item: GuideCategory) => { try { if (!await confirmRemove(`确定删除分类“${item.name}”及其导航吗？`)) return; await guideApi.deleteCategory(item.id); await loadData() } catch (_) {} }
const removeLink = async (item: GuideLink) => { try { if (!await confirmRemove(`确定删除导航“${item.title}”吗？`)) return; await guideApi.deleteLink(item.id); await loadData() } catch (_) {} }

onMounted(() => { loadData() })
</script>

<style scoped>
.guide-management { display: grid; gap: var(--tf-space-4); padding: var(--admin-page-padding, var(--tf-space-4)); }
.guide-panel { padding: var(--tf-space-4); border: 1px solid var(--tf-color-slate-200); border-radius: var(--tf-radius-panel); background: var(--tf-color-white); }
.guide-panel__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--tf-space-3); margin-bottom: var(--tf-space-4); }
.guide-panel__heading h2 { margin: 0; color: var(--tf-color-slate-900); font-size: var(--tf-type-scale-18); }
.guide-panel__heading p { margin: var(--tf-space-1) 0 0; color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-13); }
.guide-count { flex: none; color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-13); }
.announcement-list, .category-list { display: grid; gap: var(--tf-space-2); }
.announcement-row, .link-admin-row { display: flex; min-width: 0; align-items: center; gap: var(--tf-space-3); padding: var(--tf-space-3); border: 1px solid var(--tf-color-slate-200); border-radius: var(--tf-radius-control); }
.drag-handle { color: var(--tf-color-slate-400); }
.announcement-row__content, .link-admin-row__body { display: grid; min-width: 0; flex: 1; gap: var(--tf-space-1); }
.announcement-row__content strong, .announcement-row__content span, .link-admin-row__body strong, .link-admin-row__body small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.announcement-row__content span, .link-admin-row__body small { color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-12); }
.row-actions { display: inline-flex; flex: none; align-items: center; gap: var(--tf-space-1); }
.category-admin-card { overflow: hidden; border: 1px solid var(--tf-color-slate-200); border-radius: var(--tf-radius-panel); }
.category-admin-card__header { display: flex; min-width: 0; align-items: center; gap: var(--tf-space-3); padding: var(--tf-space-3) var(--tf-space-4); background: var(--tf-color-slate-50); }
.category-admin-card__icon, .link-admin-row__icon { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: var(--tf-radius-control); background: var(--tf-color-indigo-50); color: var(--tf-color-indigo-600); }
.category-admin-card__title { min-width: 0; flex: 1; }
.category-admin-card__title h3 { margin: 0; overflow: hidden; font-size: var(--tf-type-scale-15); text-overflow: ellipsis; white-space: nowrap; }
.category-admin-card__title p { margin: var(--tf-space-1) 0 0; color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-12); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.category-admin-card__links { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); align-items: start; gap: var(--tf-space-2); padding: var(--tf-space-3) var(--tf-space-4); }
.category-admin-card__links > .guide-category-tabs, .category-admin-card__links > .subcategory-tab-actions { grid-column: 1 / -1; }
.subcategory-tab-actions { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: var(--tf-space-2); padding: var(--tf-space-2) 0; color: var(--tf-color-slate-700); }
.link-admin-row__icon { width: 28px; height: 28px; background: var(--tf-color-slate-100); color: var(--tf-color-slate-600); }
.guide-route-tip { margin: 0; color: var(--tf-color-slate-500); font-size: var(--tf-type-scale-13); }
.guide-route-tip a { color: var(--tf-color-indigo-600); }
.guide-form { display: grid; gap: var(--tf-space-1); }
.guide-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--tf-space-3); }
.guide-form :deep(.el-form-item) { margin-bottom: var(--tf-space-2); }
.guide-form :deep(.el-input-number), .guide-form :deep(.el-select) { width: 100%; }
.guide-dialog-actions { display: flex; justify-content: flex-end; gap: var(--tf-space-2); margin-top: var(--tf-space-2); }
.qr-upload { display: flex; align-items: center; gap: var(--tf-space-3); }
.qr-upload img { width: 64px; height: 64px; object-fit: contain; border: 1px solid var(--tf-color-slate-200); border-radius: var(--tf-radius-control); }
.qr-upload input { max-width: 220px; }
@media (max-width: 767px) {
  .guide-management { padding: var(--tf-space-3); }
  .guide-panel { padding: var(--tf-space-3); }
  .guide-form-grid { grid-template-columns: 1fr; gap: 0; }
  .announcement-row, .link-admin-row { align-items: flex-start; }
  .announcement-row .el-tag, .link-admin-row .el-tag { margin-left: auto; }
  .category-admin-card__header { gap: var(--tf-space-2); }
  .category-admin-card__title { min-width: calc(100% - 52px); }
  .category-admin-card__header > .el-tag { flex: none; }
  .category-admin-card__header > .row-actions { flex: none; margin-left: auto; }
  .category-admin-card__links { grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
}
</style>
