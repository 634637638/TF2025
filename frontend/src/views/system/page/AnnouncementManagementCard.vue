<template>
  <section class="announcement-management table-section admin-panel admin-table-panel">
    <div class="card-header-with-action">
      <h3 class="section-subtitle">
        <i class="fas fa-bullhorn" />
        站内公告
      </h3>
      <div class="announcement-card-actions">
        <el-button
          circle
          text
          aria-label="刷新公告列表"
          title="刷新"
          :loading="loading"
          @click="loadAnnouncements"
        >
          <i class="fas fa-sync-alt" />
        </el-button>
        <el-button
          v-if="canEdit"
          type="primary"
          size="small"
          @click="openCreateDialog"
        >
          <i class="fas fa-plus" />
          <span>新增公告</span>
        </el-button>
      </div>
    </div>

    <SectionLoading
      v-if="loading && announcements.length === 0"
      text="加载公告..."
      size="normal"
    />
    <div
      v-else-if="announcements.length"
      v-tf-loading="{ active: loading, text: '正在刷新站内公告...' }"
      class="announcement-management-list"
    >
      <article
        v-for="announcement in announcements"
        :key="announcement.id"
        class="announcement-management-item"
      >
        <div class="announcement-management-item__heading">
          <h4>{{ announcement.title }}</h4>
          <el-tag
            :type="announcement.isPublished ? 'success' : 'info'"
            size="small"
          >
            {{ announcement.isPublished ? '已发布' : '草稿' }}
          </el-tag>
          <el-tag
            v-if="announcement.isPinned"
            type="warning"
            size="small"
          >
            置顶
          </el-tag>
        </div>
        <RichContent
          class="announcement-management-item__content"
          :content="announcement.content"
        />
        <div class="announcement-management-item__footer">
          <span>{{ formatDate(announcement.updatedAt) }}</span>
          <div class="announcement-management-item__actions">
            <el-button
              v-if="canEdit"
              text
              circle
              aria-label="编辑公告"
              title="编辑"
              @click="openEditDialog(announcement)"
            >
              <i class="fas fa-pen" />
            </el-button>
            <el-button
              v-if="canDelete"
              text
              circle
              aria-label="删除公告"
              title="删除"
              :loading="deletingId === announcement.id"
              :disabled="deletingId !== null"
              @click="deleteAnnouncement(announcement)"
            >
              <i class="fas fa-trash-alt" />
            </el-button>
          </div>
        </div>
      </article>
    </div>
    <DataEmptyState
      v-else
      description="暂无公告"
    />

    <MobileDialog
      v-model="dialogVisible"
      :title="editingId ? '编辑公告' : '新增公告'"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        class="tf-dialog-form tf-dialog-form--stacked"
        :model="form"
        :rules="rules"
        label-position="top"
      >
        <el-form-item
          label="公告标题"
          prop="title"
        >
          <el-input
            v-model="form.title"
            maxlength="150"
            show-word-limit
          />
        </el-form-item>
        <el-form-item
          label="公告内容"
          prop="content"
        >
          <RichTextEditor
            v-model="form.content"
            :upload-media="uploadMedia"
            placeholder="编辑公告内容，可插入图片和视频"
          />
        </el-form-item>
        <el-form-item label="有效期至">
          <el-date-picker
            v-model="expiresAtPickerValue"
            type="datetime"
            :format="TIME_FORMATS.DATETIME_MINUTE"
            placeholder="不设置则长期展示"
            clearable
          />
        </el-form-item>
        <div class="announcement-form-options">
          <el-form-item class="announcement-form-option">
            <el-switch
              v-model="form.isPublished"
              aria-label="发布状态"
              active-text="立即发布"
              inactive-text="保存草稿"
            />
          </el-form-item>
          <el-form-item class="announcement-form-option">
            <el-switch
              v-model="form.isPinned"
              aria-label="首页优先展示"
              active-text="置顶"
              inactive-text="普通"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button @click="dialogVisible = false">
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="saving"
            @click="saveAnnouncement"
          >
            保存
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { SiteAnnouncement } from '@/types'
import { announcementsApi, type SiteAnnouncementInput } from '@/api/announcements'
import { useNotification } from '@/composables/useNotification'
import { confirmAction } from '@/utils/message-box'
import { getRequestErrorMessage } from '@/utils/api-response'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { formatDateTime as formatDate } from '@/utils/format'
import MobileDialog from '@/components/MobileDialog.vue'
import SectionLoading from '@/components/SectionLoading.vue'
import RichTextEditor, { type RichTextMediaResult } from '@/components/RichTextEditor.vue'
import RichContent from '@/components/RichContent.vue'

const props = defineProps<{
  canEdit: boolean
  canDelete: boolean
}>()

const { success, error } = useNotification()
const announcements = ref<SiteAnnouncement[]>([])
const loading = ref(false)
const saving = ref(false)
const deletingId = ref<number | null>(null)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<SiteAnnouncementInput>({
  title: '',
  content: '',
  isPublished: true,
  isPinned: false,
  expiresAt: null
})
const expiresAtPickerValue = computed<Date | null>({
  get: () => TimeUtil.toDatePickerValue(form.expiresAt),
  set: value => {
    form.expiresAt = value
      ? TimeUtil.formatDatePickerValue(value, TIME_FORMATS.DATETIME)
      : null
  }
})
const rules: FormRules<SiteAnnouncementInput> = {
  title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入公告内容', trigger: 'blur' }]
}

const loadAnnouncements = async () => {
  loading.value = true
  try {
    const response = await announcementsApi.listForManagement()
    announcements.value = response.success && Array.isArray(response.data) ? response.data : []
  } catch (err) {
    error(`公告列表加载失败：${getRequestErrorMessage(err, '请求失败')}`)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.title = ''
  form.content = ''
  form.isPublished = true
  form.isPinned = false
  form.expiresAt = null
  editingId.value = null
  formRef.value?.clearValidate()
}

const openCreateDialog = () => {
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (announcement: SiteAnnouncement) => {
  resetForm()
  editingId.value = announcement.id
  form.title = announcement.title
  form.content = announcement.content
  form.isPublished = announcement.isPublished
  form.isPinned = announcement.isPinned
  form.expiresAt = announcement.expiresAt
  dialogVisible.value = true
}

const saveAnnouncement = async () => {
  if (!props.canEdit || !formRef.value || saving.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (editingId.value) {
      await announcementsApi.update(editingId.value, { ...form })
      success('公告更新成功')
    } else {
      await announcementsApi.create({ ...form })
      success(form.isPublished ? '公告发布成功' : '公告草稿已保存')
    }
    dialogVisible.value = false
    await loadAnnouncements()
  } catch (err) {
    error(`公告保存失败：${getRequestErrorMessage(err, '请求失败')}`)
  } finally {
    saving.value = false
  }
}

const uploadMedia = async (file: File, _kind: 'image' | 'video'): Promise<RichTextMediaResult> => {
  if (file.size > 100 * 1024 * 1024) throw new Error('文件不能超过100MB')
  const body = new FormData()
  body.append('file', file)
  const response = await announcementsApi.uploadMedia(body)
  const url = response.data?.url
  if (!response.success || !url) throw new Error(response.message || '媒体上传失败')
  return _kind === 'video' ? { url } : { url, alt: response.data?.name, href: url }
}

const deleteAnnouncement = async (announcement: SiteAnnouncement) => {
  if (!props.canDelete || deletingId.value !== null) return
  const confirmed = await confirmAction(`确定删除公告“${announcement.title}”吗？`, '删除公告', { type: 'warning' })
    .then(() => true)
    .catch(() => false)
  if (!confirmed) return

  deletingId.value = announcement.id
  try {
    await announcementsApi.remove(announcement.id)
    success('公告已删除')
    await loadAnnouncements()
  } catch (err) {
    error(`公告删除失败：${getRequestErrorMessage(err, '请求失败')}`)
  } finally {
    deletingId.value = null
  }
}

onMounted(loadAnnouncements)
</script>

<style scoped>
.announcement-management {
  min-width: 0;
}

.announcement-card-actions,
.announcement-management-item__heading,
.announcement-management-item__footer,
.announcement-management-item__actions {
  display: flex;
  align-items: center;
}

.announcement-card-actions {
  gap: var(--tf-space-2);
  flex-shrink: 0;
}

.announcement-management-list {
  display: flex;
  flex-direction: column;
  gap: var(--admin-panel-gap);
  max-height: 70vh;
  overflow-y: auto;
}

.announcement-management-item {
  min-width: 0;
  padding: var(--admin-panel-padding);
  border: 1px solid var(--tf-color-border-muted);
  border-radius: var(--mobile-card-radius);
}

.announcement-management-item__heading,
.announcement-management-item__footer {
  justify-content: space-between;
  gap: var(--tf-space-2);
}

.announcement-management-item__heading h4 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--tf-color-heading);
  font-size: var(--tf-font-body);
}

.announcement-management-item__content { max-height: 88px; margin-block: var(--tf-space-2); overflow: hidden; color: var(--tf-color-muted); font-size: var(--tf-font-body); }

.announcement-management-item__footer {
  color: var(--tf-color-muted);
  font-size: var(--tf-font-caption);
}

.announcement-management-item__actions {
  gap: var(--tf-space-2);
  flex-shrink: 0;
}

.announcement-management :deep(.el-date-editor) {
  width: 100%;
}

.announcement-form-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--tf-space-6);
}

.announcement-form-option {
  margin-bottom: 0;
}
</style>
