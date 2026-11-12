<template>
  <div class="cloud-browser">
    <el-form label-position="top">
      <el-form-item label="云盘">
        <el-select
          v-model="driveId"
          :disabled="busy"
          @change="resetLocation"
        >
          <el-option
            v-for="drive in drives"
            :key="drive.id"
            :label="drive.name"
            :value="drive.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <el-alert
      v-if="driveNotice"
      :title="driveNotice"
      type="info"
      :closable="false"
      show-icon
    />
    <el-tabs
      v-model="mode"
      class="tf-page-tabs"
      @tab-change="resetLocation"
    >
      <el-tab-pane
        label="云盘文件"
        name="files"
        :disabled="busy"
        class="tf-tab-panel"
      />
      <el-tab-pane
        label="回收站"
        name="trash"
        :disabled="busy"
        class="tf-tab-panel"
      />
    </el-tabs>
    <div class="tf-dialog-toolbar">
      <el-button
        v-if="mode === 'files'"
        class="tf-button--neutral"
        :disabled="loading || busy || path.length === 1"
        @click="navigate(path.slice(0, -1))"
      >
        上一级
      </el-button>
      <el-button
        class="tf-button--refresh"
        :loading="loading"
        :disabled="busy"
        @click="load()"
      >
        刷新
      </el-button>
      <el-button
        v-if="mode === 'files' && canCreate"
        v-permission="'backup:create'"
        type="primary"
        :disabled="loading || busy || !!listError"
        @click="openNameDialog()"
      >
        新建文件夹
      </el-button>
    </div>
    <el-breadcrumb
      v-if="mode === 'files'"
      class="cloud-path"
      separator="/"
    >
      <el-breadcrumb-item
        v-for="(folder, index) in path"
        :key="folder.id"
      >
        <el-button
          link
          class="tf-button--neutral"
          :disabled="loading || busy"
          @click="navigate(path.slice(0, index + 1))"
        >
          {{ folder.name }}
        </el-button>
      </el-breadcrumb-item>
    </el-breadcrumb>
    <DataEmptyState
      v-if="listError"
      state="error"
      :description="listError"
      size="compact"
      action-text="重试"
      @action="load(false, path, retryDriveDiscovery)"
    />
    <div
      v-else
      class="table-responsive"
    >
      <el-table
        v-tf-loading="{ active: loading, text: '正在刷新云盘文件列表...' }"
        :data="rows"
        border
        stripe
        class="data-table"
        row-key="id"
        table-layout="fixed"
      >
        <el-table-column
          label="名称"
          :min-width="nameWidth"
          class-name="complete-text-column wrapped-text-column"
          prop="name"
        />
        <el-table-column
          label="类型"
          min-width="72"
          align="center"
        >
          <template #default="{ row }">
            {{ row.type === 'folder' ? '文件夹' : '文件' }}
          </template>
        </el-table-column>
        <el-table-column
          label="大小"
          min-width="100"
          align="center"
        >
          <template #default="{ row }">
            {{ row.type === 'file' ? formatFileSize(row.size) : '—' }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="showActions"
          label="操作"
          :width="fileActionColumnWidth"
          align="center"
          class-name="actions-column"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-if="mode === 'files' && row.type === 'folder'"
                class="table-action table-action--view"
                :disabled="loading || busy"
                @click.stop="navigate([...path, { id: row.id, name: row.name }])"
              >
                打开
              </el-button>
              <el-button
                v-if="mode === 'files' && canEdit"
                v-permission="'backup:edit'"
                class="table-action table-action--edit"
                :disabled="loading || busy"
                @click.stop="openNameDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="mode === 'files' && canDelete"
                v-permission="'backup:delete'"
                class="table-action table-action--delete"
                :disabled="loading || busy"
                @click.stop="trashFile(row)"
              >
                删除
              </el-button>
              <el-button
                v-if="mode === 'trash' && canDelete"
                v-permission="'backup:delete'"
                class="table-action table-action--delete"
                :disabled="loading || busy"
                @click.stop="purgeFile(row)"
              >
                删除
              </el-button>
              <el-button
                v-if="mode === 'trash' && canEdit"
                v-permission="'backup:edit'"
                class="table-action table-action--success"
                :disabled="loading || busy"
                @click.stop="restoreFile(row)"
              >
                恢复
              </el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <DataEmptyState
            v-if="!loading"
            :description="emptyDescription"
            size="compact"
          />
        </template>
      </el-table>
    </div>
    <div
      v-if="nextMarker && !listError"
      class="tf-dialog-toolbar"
    >
      <el-button
        class="tf-button--neutral"
        :loading="loading"
        :disabled="busy"
        @click="load(true)"
      >
        加载更多
      </el-button>
    </div>
    <MobileDialog
      v-model="editorVisible"
      :title="editingFile ? '重命名' : '新建文件夹'"
      dialog-class="crud-dialog-sm"
      :show-default-footer="false"
      :close-on-click-modal="false"
      :close-on-press-escape="!mutating"
      :show-close="!mutating"
    >
      <el-form
        class="tf-dialog-form tf-dialog-form--stacked"
        label-position="top"
        @submit.prevent="saveName"
      >
        <el-form-item
          :label="editingFile?.type === 'file' ? '文件名称（包含扩展名）' : '文件夹名称'"
          :error="nameError"
          required
        >
          <el-input
            v-model="nameValue"
            maxlength="255"
            show-word-limit
            :disabled="mutating"
            placeholder="请输入名称"
            @input="nameError = ''"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button
            class="tf-button--neutral"
            :disabled="mutating"
            @click="editorVisible = false"
          >
            取消
          </el-button>
          <el-button
            v-permission="editingFile ? 'backup:edit' : 'backup:create'"
            type="primary"
            :loading="mutating"
            @click="saveName"
          >
            保存
          </el-button>
        </div>
      </template>
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { backupCloudApi } from '@/api/backup'
import type { CloudDirectory, CloudDrive, CloudFile } from '@/types/backup'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { useNotification } from '@/composables/useNotification'
import { getRequestErrorMessage } from '@/utils/api-response'
import { confirmAction, isMessageBoxCanceled } from '@/utils/message-box'
import { formatFileSize } from '@/utils/format'
import { getAdaptiveActionColumnWidth, getTextColumnMinWidth } from '@/utils/table-layout'
import { shouldShowActionColumn } from '@/composables/useFieldPermissions'

const props = defineProps<{ accountId: string; drives: CloudDrive[]; initialDriveId: string }>()
const selection = defineModel<CloudDirectory | null>({ required: true })
const emit = defineEmits<{ changed: [directory?: CloudDirectory]; busy: [value: boolean] }>()
const { canCreate, canEdit, canDelete, requirePermission } = usePagePermissions('backup')
const { success, error } = useNotification()
const requests = useLatestRequest()
const driveId = ref(props.initialDriveId)
const mode = ref('files')
const path = ref([{ id: 'root', name: '根目录' }])
const rows = ref<CloudFile[]>([])
const nextMarker = ref('')
const loading = ref(false)
const mutating = ref(false)
const editorVisible = ref(false)
const editingFile = ref<CloudFile | null>(null)
const nameValue = ref('')
const nameError = ref('')
const busy = computed(() => mutating.value || editorVisible.value)
const showActions = computed(() => shouldShowActionColumn(mode.value === 'files', [canEdit.value, canDelete.value]))
const fileActionColumnWidth = computed(() => getAdaptiveActionColumnWidth(rows.value, [
  { label: '打开', visible: row => mode.value === 'files' && row.type === 'folder' },
  { label: mode.value === 'files' ? '编辑' : '恢复', visible: canEdit.value },
  { label: '删除', visible: canDelete.value }
]))
watch(busy, value => emit('busy', value), { immediate: true })
const listError = ref('')
const driveNotice = ref('')
const retryDriveDiscovery = ref(false)
const driveName = computed(() => props.drives.find(drive => drive.id === driveId.value)?.name || '当前云盘')
const emptyDescription = computed(() => mode.value === 'trash'
  ? `${driveName.value}的回收站为空`
  : `${driveName.value}的${path.value.length === 1 ? '根目录' : '当前文件夹'}暂无文件或文件夹，可切换云盘查看其他位置`)
const nameWidth = computed(() => getTextColumnMinWidth(['名称', ...rows.value.map(row => row.name)], { minWidth: 180, maxWidth: 360 }))

const load = async (more = false, location = path.value, discoverDrives = false) => {
  const request = requests.nextRequest()
  const folderId = location[location.length - 1].id
  let currentDriveId = driveId.value
  const trash = mode.value === 'trash'
  loading.value = true
  selection.value = null
  listError.value = ''
  driveNotice.value = ''
  retryDriveDiscovery.value = discoverDrives
  try {
    const readFolder = async (id: string, marker = '') => {
      const response = await backupCloudApi.files({ accountId: props.accountId, driveId: id, folderId, trash, marker }, request.signal)
      if (!response.success || !response.data) throw new Error(response.message || '读取云盘文件失败')
      return response.data
    }
    let data = await readFolder(currentDriveId, more ? nextMarker.value : '')
    if (!request.isLatest()) return
    // 只在首次浏览空根目录时寻找其他盘；手动切换、子目录和回收站均保留用户选择。
    if (discoverDrives && !more && !trash && folderId === 'root' && !data.items.length && !data.nextMarker) {
      const originalDriveName = driveName.value
      for (const drive of props.drives.filter(item => item.id !== currentDriveId)) {
        const candidate = await readFolder(drive.id)
        if (!request.isLatest()) return
        if (!candidate.items.length && !candidate.nextMarker) continue
        currentDriveId = drive.id
        data = candidate
        driveNotice.value = `${originalDriveName}根目录为空，已显示${drive.name}。请核对目录后选择保存。`
        break
      }
    }
    driveId.value = currentDriveId
    rows.value = more ? [...rows.value, ...data.items.filter(item => !rows.value.some(row => row.id === item.id))] : data.items
    nextMarker.value = data.nextMarker
    path.value = location
    selection.value = trash || !data.folder ? null : { ...data.folder, driveName: driveName.value }
  } catch (cause) {
    if (request.isLatest() && !requests.isCanceledError(cause)) listError.value = getRequestErrorMessage(cause, '读取云盘文件失败')
  } finally { if (request.isLatest()) loading.value = false }
}

const navigate = (location: typeof path.value) => { if (!loading.value && !busy.value) void load(false, location) }
const resetLocation = () => { if (!busy.value) void load(false, [{ id: 'root', name: '根目录' }]) }
const openNameDialog = (file?: CloudFile) => {
  if (loading.value || busy.value || mode.value !== 'files' || !requirePermission(file ? 'edit' : 'create')) return
  editingFile.value = file || null
  nameValue.value = file?.name || ''
  nameError.value = ''
  editorVisible.value = true
}
const saveName = async () => {
  const file = editingFile.value
  if (mutating.value || !requirePermission(file ? 'edit' : 'create')) return
  const name = nameValue.value.trim()
  if (!name || name.length > 255 || ['.', '..'].includes(name) || /[\\/:*?"<>|\u0000-\u001f\u007f]/.test(name)) {
    nameError.value = '请输入 1–255 个字符，不能包含 \\ / : * ? " < > | 或控制字符'
    return
  }
  if (file && name === file.name) { editorVisible.value = false; return }
  mutating.value = true
  try {
    const response = file ? await backupCloudApi.rename(props.accountId, driveId.value, file.id, name)
      : await backupCloudApi.createFolder(props.accountId, driveId.value, path.value[path.value.length - 1].id, name)
    if (!response.success) throw new Error(response.message || '保存云盘名称失败')
    success(file ? '重命名成功' : '文件夹创建成功')
    editorVisible.value = false
    emit('changed', file?.type === 'folder' ? { driveId: driveId.value, folderId: file.id, folderName: name } : undefined)
    await load()
  } catch (cause) { error(getRequestErrorMessage(cause, '保存失败，请重试')) }
  finally { mutating.value = false }
}
const trashFile = async (file: CloudFile) => {
  if (loading.value || busy.value || mode.value !== 'files' || !requirePermission('delete')) return
  mutating.value = true
  try {
    const message = file.type === 'folder'
      ? `将云盘文件夹“${file.name}”及其中所有文件移入回收站？本地备份文件会保留。`
      : `将云盘文件“${file.name}”移入回收站？本地备份文件会保留。`
    await confirmAction(message, '删除云盘文件', { confirmButtonText: '删除' })
    const response = await backupCloudApi.trash(props.accountId, driveId.value, file.id)
    if (!response.success) throw new Error(response.message || '移入回收站失败')
    success('已移入云盘回收站，本地文件保留')
    emit('changed')
    await load()
  } catch (cause) { if (!isMessageBoxCanceled(cause)) error(getRequestErrorMessage(cause, '移入回收站失败')) }
  finally { mutating.value = false }
}
const restoreFile = async (file: CloudFile) => {
  if (loading.value || busy.value || mode.value !== 'trash' || !requirePermission('edit')) return
  mutating.value = true
  try {
    const response = await backupCloudApi.restore(props.accountId, driveId.value, file.id)
    if (!response.success) throw new Error(response.message || '恢复失败')
    success('云盘文件已恢复')
    emit('changed')
    await load()
  } catch (cause) { error(getRequestErrorMessage(cause, '恢复失败，请重试')) }
  finally { mutating.value = false }
}
const purgeFile = async (file: CloudFile) => {
  if (loading.value || busy.value || mode.value !== 'trash' || !requirePermission('delete')) return
  mutating.value = true
  try {
    const subject = file.type === 'folder' ? `文件夹“${file.name}”及其中所有文件` : `文件“${file.name}”`
    await confirmAction(`彻底删除云盘${subject}？此操作无法恢复，本地文件会保留。`, '彻底删除云盘文件', { confirmButtonText: '彻底删除' })
    const response = await backupCloudApi.purge(props.accountId, driveId.value, file.id)
    if (!response.success) throw new Error(response.message || '彻底删除失败')
    success('云盘文件已彻底删除，本地文件保留')
    emit('changed')
    await load()
  } catch (cause) { if (!isMessageBoxCanceled(cause)) error(getRequestErrorMessage(cause, '彻底删除失败，请重试')) }
  finally { mutating.value = false }
}
onMounted(() => { void load(false, path.value, true) })
</script>

<style scoped>
.cloud-browser {
  display: flex;
  flex-direction: column;
  gap: var(--tf-space-3);
  min-width: 0;
}
.cloud-path {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tf-space-1);
}
.cloud-path .el-button {
  white-space: normal;
  overflow-wrap: anywhere;

}
</style>
