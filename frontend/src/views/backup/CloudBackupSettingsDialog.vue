<template>
  <MobileDialog
    v-model="visible"
    :title="manageOnly ? '云盘文件管理' : '阿里云盘设置'"
    :show-default-footer="false"
    :dialog-class="editingAccount ? 'crud-dialog-sm' : browserVisible || manageOnly ? '' : 'crud-dialog-md-lg'"
    :close-on-click-modal="false"
    :close-on-press-escape="!browserBusy && !saving && !testing"
    :show-close="!browserBusy && !saving && !testing"
  >
    <SectionLoading
      v-if="initialLoading"
      text="正在读取云盘设置"
    />
    <el-form
      v-else-if="editingAccount"
      class="tf-dialog-form tf-dialog-form--stacked"
      label-position="top"
      @submit.prevent="saveAccount"
    >
      <el-form-item
        label="账户名称"
        :error="accountForm.errors.name"
        required
      >
        <el-input
          v-model="accountForm.values.name"
          maxlength="50"
          show-word-limit
          placeholder="例如：自己的网盘"
          :disabled="saving"
        />
      </el-form-item>
      <el-form-item
        label="云盘 Token"
        :error="accountForm.errors.token"
        :required="!editingAccountId"
      >
        <el-input
          v-model="accountForm.values.token"
          type="password"
          show-password
          autocomplete="new-password"
          :disabled="saving"
          :placeholder="editingAccountId ? '留空则保留原 Token' : '填写 refresh_token 或完整 Token JSON'"
        />
      </el-form-item>
    </el-form>
    <template v-else>
      <el-form
        class="tf-dialog-form tf-dialog-form--stacked cloud-settings-form"
        label-position="top"
        @submit.prevent="save"
      >
        <div class="cloud-settings-panel">
          <el-form-item
            :label="manageOnly ? '浏览账户' : '储存账户'"
            class="cloud-settings-field"
          >
            <div class="cloud-account-row">
              <el-select
                v-model="form.accountId"
                :disabled="initialLoading || saving || testing || browserBusy"
                placeholder="请选择云盘账户"
                @change="changeAccount"
              >
                <el-option
                  v-for="account in accounts"
                  :key="account.id"
                  :value="account.id"
                  :label="account.name"
                />
              </el-select>
              <div
                v-if="!manageOnly"
                class="tf-dialog-toolbar"
              >
                <el-button
                  v-permission="'backup:create'"
                  type="primary"
                  :disabled="busy || browserBusy"
                  @click="openAccountEditor(false)"
                >
                  新增账户
                </el-button>
                <el-button
                  v-permission="'backup:create'"
                  class="tf-button--manage"
                  :disabled="busy || browserBusy || !form.accountId"
                  @click="openAccountEditor(true)"
                >
                  编辑账户
                </el-button>
              </div>
            </div>
          </el-form-item>
        </div>
        <template v-if="!manageOnly && !browserVisible">
          <div class="cloud-settings-panel cloud-policy-panel">
            <el-form-item
              label="定时生成备份"
              class="cloud-settings-field"
            >
              <div class="cloud-setting-row">
                <span>按设定间隔自动生成本地备份。</span>
                <el-switch
                  v-model="schedule.enabled"
                  :disabled="busy"
                  aria-label="定时生成备份"
                />
              </div>
            </el-form-item>
            <div
              v-if="schedule.enabled"
              class="cloud-policy-fields"
            >
              <el-form-item
                label="备份间隔（小时）"
                :error="scheduleIntervalError"
                class="cloud-settings-field"
              >
                <el-input-number
                  v-model="schedule.intervalHours"
                  :min="1"
                  :max="720"
                  :precision="0"
                  :controls="false"
                  :disabled="busy"
                  aria-label="备份间隔（小时）"
                />
              </el-form-item>
              <el-form-item
                label="备份类型"
                class="cloud-settings-field"
              >
                <el-select
                  v-model="schedule.type"
                  :disabled="busy"
                  aria-label="定时备份类型"
                >
                  <el-option
                    label="完整 ZIP（数据库及后端文件）"
                    value="full"
                  />
                  <el-option
                    label="SQL（仅数据库）"
                    value="database"
                  />
                </el-select>
              </el-form-item>
            </div>
            <el-text v-if="schedule.enabled">
              下次执行（北京时间）：{{ scheduleUnchanged ? formatDateTime(scheduleStatus?.nextRunAt) : '保存后计算' }}
            </el-text>
            <el-text v-if="scheduleStatus?.lastRunAt">
              最近执行：{{ formatDateTime(scheduleStatus.lastRunAt) }} · {{ scheduleStatusText }}
            </el-text>
            <el-text
              v-if="scheduleStatus?.lastError"
              type="danger"
            >
              {{ scheduleStatus.lastError }}
            </el-text>
          </div>
          <div class="cloud-settings-panel">
            <el-form-item
              label="自动备份"
              class="cloud-settings-field"
            >
              <div class="cloud-setting-row">
                <span>开启自动备份backups内所有文件。</span>
                <el-switch
                  v-model="form.enabled"
                  :disabled="busy"
                  aria-label="自动备份"
                />
              </div>
            </el-form-item>
          </div>
          <div
            v-permission="'backup:delete'"
            class="cloud-settings-panel cloud-policy-panel"
          >
            <el-form-item
              label="自动清理本地旧备份"
              class="cloud-settings-field"
            >
              <div class="cloud-setting-row">
                <span>SQL 和 ZIP 分别保留最新的指定份数。</span>
                <el-switch
                  v-model="retention.enabled"
                  :disabled="busy || !canDelete"
                  aria-label="自动清理本地旧备份"
                />
              </div>
            </el-form-item>
            <div
              v-if="retention.enabled"
              class="cloud-policy-fields"
            >
              <el-form-item
                label="SQL 保留份数"
                :error="sqlCountError"
                class="cloud-settings-field"
              >
                <el-input-number
                  v-model="retention.sqlCount"
                  :min="1"
                  :max="1000"
                  :precision="0"
                  :controls="false"
                  :disabled="busy || !canDelete"
                  aria-label="SQL 保留份数"
                />
              </el-form-item>
              <el-form-item
                label="ZIP 保留份数"
                :error="zipCountError"
                class="cloud-settings-field"
              >
                <el-input-number
                  v-model="retention.zipCount"
                  :min="1"
                  :max="1000"
                  :precision="0"
                  :controls="false"
                  :disabled="busy || !canDelete"
                  aria-label="ZIP 保留份数"
                />
              </el-form-item>
            </div>
            <el-text>仅清理服务器本地备份，云盘文件保留。开启自动上传时，未上传成功的文件暂缓清理。</el-text>
            <el-text v-if="retentionStatus?.lastRunAt">
              最近清理：{{ formatDateTime(retentionStatus.lastRunAt) }} · 删除 {{ retentionStatus.lastDeleted }} 份
            </el-text>
            <el-text
              v-if="retentionStatus?.lastError"
              type="danger"
            >
              {{ retentionStatus.lastError }}
            </el-text>
          </div>
          <div class="cloud-settings-panel cloud-directory-row">
            <span class="cloud-directory-text">当前备份目录：{{ form.folderName ? `${form.driveName ? `${form.driveName}/` : ''}${form.folderName}` : '尚未选择' }}</span>
            <div class="tf-dialog-toolbar">
              <el-button
                v-permission="'backup:create'"
                class="tf-button--manage"
                :loading="connecting"
                :disabled="saving || testing || !form.accountId"
                @click="browse"
              >
                浏览云盘 / 选择目录
              </el-button>
            </div>
          </div>
        </template>
      </el-form>
      <SectionLoading
        v-if="connecting"
        text="正在连接所选云盘账户"
      />
      <CloudDriveBrowser
        v-else-if="browserVisible"
        :key="form.accountId"
        v-model="selectedDirectory"
        :account-id="form.accountId"
        :drives="drives"
        :initial-drive-id="browserDriveId"
        @changed="handleCloudChanged"
        @busy="browserBusy = $event"
      />
      <DataEmptyState
        v-else-if="manageOnly"
        :description="accounts.length ? '读取云盘失败，请重试' : '尚未添加云盘账户，请先到云盘设置中新增'"
        size="compact"
        :action-text="accounts.length ? '重试' : undefined"
        @action="browse"
      />
    </template>
    <template
      v-if="!manageOnly"
      #footer
    >
      <div
        v-if="editingAccount"
        class="tf-dialog-actions"
      >
        <el-button
          class="tf-button--neutral"
          :disabled="saving"
          @click="cancelAccountEditor"
        >
          返回设置
        </el-button>
        <el-button
          v-permission="'backup:create'"
          type="primary"
          :loading="saving"
          @click="saveAccount"
        >
          保存账户
        </el-button>
      </div>
      <div
        v-else-if="browserVisible"
        class="tf-dialog-actions"
      >
        <el-button
          class="tf-button--neutral"
          :disabled="browserBusy || connecting"
          @click="browserVisible = false"
        >
          返回设置
        </el-button>
        <el-button
          type="primary"
          :disabled="browserBusy || connecting || !selectedDirectory"
          @click="chooseDirectory"
        >
          使用此目录
        </el-button>
      </div>
      <div
        v-else
        class="tf-dialog-actions"
      >
        <el-button
          v-permission="'backup:create'"
          class="tf-button--manage"
          :loading="testing"
          :disabled="saving || connecting || initialLoading"
          @click="test"
        >
          保存并测试
        </el-button>
        <el-button
          v-permission="'backup:create'"
          type="primary"
          :loading="saving"
          :disabled="testing || connecting || initialLoading"
          @click="save"
        >
          保存设置
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { backupCloudApi } from '@/api/backup'
import { useNotification } from '@/composables/useNotification'
import { useForm, ValidationRules } from '@/composables/forms/useForm'
import { getRequestErrorMessage } from '@/utils/api-response'
import type { BackupRetention, BackupRetentionInput, BackupSchedule, BackupScheduleInput, CloudAccount, CloudConnection, CloudDirectory, CloudDrive } from '@/types/backup'
import CloudDriveBrowser from './CloudDriveBrowser.vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { formatDateTime } from '@/utils/format'

const props = withDefaults(defineProps<{ manageOnly?: boolean }>(), { manageOnly: false })
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()
const { success, error } = useNotification()
const requests = useLatestRequest()
const { canDelete } = usePagePermissions('backup')
const form = reactive({ enabled: false, accountId: '', folderId: '', folderName: '', driveId: '', driveName: '' })
const schedule = reactive<BackupScheduleInput>({ enabled: false, intervalHours: 24, type: 'full' })
const retention = reactive<BackupRetentionInput>({ enabled: false, sqlCount: 10, zipCount: 10 })
const scheduleStatus = ref<BackupSchedule | null>(null)
const retentionStatus = ref<BackupRetention | null>(null)
const scheduleUnchanged = computed(() => schedule.enabled === scheduleStatus.value?.enabled
  && schedule.intervalHours === scheduleStatus.value?.intervalHours && schedule.type === scheduleStatus.value?.type)
const scheduleStatusText = computed(() => ({ idle: '尚未执行', running: '正在生成', success: '生成成功', failed: '生成失败' })[scheduleStatus.value?.lastStatus || 'idle'])
const scheduleIntervalError = computed(() => Number.isInteger(schedule.intervalHours) && schedule.intervalHours >= 1 && schedule.intervalHours <= 720 ? '' : '请输入 1–720 的整数')
const sqlCountError = computed(() => Number.isInteger(retention.sqlCount) && retention.sqlCount >= 1 && retention.sqlCount <= 1000 ? '' : '请输入 1–1000 的整数')
const zipCountError = computed(() => Number.isInteger(retention.zipCount) && retention.zipCount >= 1 && retention.zipCount <= 1000 ? '' : '请输入 1–1000 的整数')
const accounts = ref<CloudAccount[]>([])
const initialLoading = ref(false)
const saving = ref(false)
const testing = ref(false)
const connecting = ref(false)
const browserVisible = ref(false)
const browserBusy = ref(false)
const editingAccount = ref(false)
const editingAccountId = ref('')
const { form: accountForm, validate, reset } = useForm({
  initialValues: { name: '', token: '' },
  validationRules: {
    name: [ValidationRules.required('请输入账户名称'), ValidationRules.maxLength(50)],
    token: [{ validator: value => Boolean(editingAccountId.value) || Boolean(value), message: '请填写云盘 Token' }]
  }
})
const selectedDirectory = ref<CloudDirectory | null>(null)
const drives = ref<CloudDrive[]>([])
const browserDriveId = ref('')
const busy = computed(() => initialLoading.value || saving.value || testing.value || connecting.value)

const applyAccount = () => {
  const account = accounts.value.find(item => item.id === form.accountId)
  Object.assign(form, { driveId: account?.driveId || '', driveName: account?.driveName || '', folderId: account?.folderId || '', folderName: account?.folderName || '' })
  selectedDirectory.value = null
}
const showBrowser = (connection: CloudConnection) => {
  drives.value = connection.drives
  form.driveName = drives.value.find(drive => drive.id === form.driveId)?.name || form.driveName
  browserDriveId.value = drives.value.some(drive => drive.id === form.driveId) ? form.driveId : connection.defaultDriveId
  selectedDirectory.value = null
  browserVisible.value = true
}
const refreshDirectory = (connection: CloudConnection) => {
  if (connection.accountId !== form.accountId) return
  const directory = connection.directory
  const matches = (target: CloudDirectory) => directory && target.folderId === directory.folderId
    && (target.driveId || connection.defaultDriveId) === directory.driveId
  const account = accounts.value.find(item => item.id === connection.accountId)
  if (directory && account && matches(account)) {
    Object.assign(account, { folderName: directory.folderName, driveName: directory.driveName })
  }
  if (directory && matches(form)) {
    Object.assign(form, { folderName: directory.folderName, driveName: directory.driveName || '' })
  }
  if (connection.directoryError) error(connection.directoryError)
}
const handleCloudChanged = (directory?: CloudDirectory) => {
  if (directory && directory.folderId === form.folderId && (!form.driveId || directory.driveId === form.driveId)) {
    form.folderName = directory.folderName
    const account = accounts.value.find(item => item.id === form.accountId)
    if (account) account.folderName = directory.folderName
  }
  emit('saved')
}

const browse = async () => {
  if (saving.value || testing.value || !form.accountId) return
  connecting.value = true
  browserVisible.value = true
  browserBusy.value = false
  selectedDirectory.value = null
  const request = requests.nextRequest()
  try {
    const response = props.manageOnly
      ? await backupCloudApi.drives(form.accountId, request.signal)
      : await backupCloudApi.connect(form.accountId, request.signal)
    if (!request.isLatest()) return
    if (!response.success || !response.data) throw new Error(response.message || '连接云盘失败')
    refreshDirectory(response.data)
    showBrowser(response.data)
  } catch (cause) {
    if (request.isLatest() && !requests.isCanceledError(cause)) {
      browserVisible.value = false
      error(getRequestErrorMessage(cause, '连接云盘失败'))
    }
  } finally { if (request.isLatest()) connecting.value = false }
}
const loadDirectory = async () => {
  if (!form.folderId) return
  const request = requests.nextRequest()
  connecting.value = true
  try {
    const response = await backupCloudApi.connect(form.accountId, request.signal)
    if (!request.isLatest()) return
    if (!response.success || !response.data) throw new Error(response.message || '读取备份目录失败')
    refreshDirectory(response.data)
  } catch (cause) {
    if (request.isLatest() && !requests.isCanceledError(cause)) error(getRequestErrorMessage(cause, '读取备份目录失败'))
  } finally { if (request.isLatest()) connecting.value = false }
}
const changeAccount = () => {
  const shouldBrowse = browserVisible.value || props.manageOnly
  requests.cancelLatest()
  connecting.value = false
  applyAccount()
  if (shouldBrowse) void browse()
  else void loadDirectory()
}

watch(visible, async open => {
  reset()
  editingAccount.value = false
  browserVisible.value = false
  browserBusy.value = false
  requests.cancelLatest()
  connecting.value = false
  initialLoading.value = false
  if (!open) return
  const request = requests.nextRequest()
  initialLoading.value = true
  try {
    if (props.manageOnly) {
      const response = await backupCloudApi.accounts(request.signal)
      if (!request.isLatest()) return
      if (!response.success || !response.data) throw new Error(response.message || '读取账户失败')
      accounts.value = response.data.accounts
      form.accountId = response.data.accountId || accounts.value[0]?.id || ''
      applyAccount()
    } else {
      const response = await backupCloudApi.settings(request.signal)
      if (!request.isLatest()) return
      if (!response.success || !response.data) throw new Error(response.message || '读取配置失败')
      accounts.value = response.data.accounts
      form.enabled = response.data.enabled
      scheduleStatus.value = response.data.schedule
      retentionStatus.value = response.data.retention
      Object.assign(schedule, { enabled: response.data.schedule.enabled, intervalHours: response.data.schedule.intervalHours, type: response.data.schedule.type })
      Object.assign(retention, { enabled: response.data.retention.enabled, sqlCount: response.data.retention.sqlCount, zipCount: response.data.retention.zipCount })
      form.accountId = response.data.accountId || accounts.value[0]?.id || ''
      applyAccount()
    }
    initialLoading.value = false
    if (props.manageOnly && form.accountId) await browse()
    else await loadDirectory()
  } catch (cause) {
    if (!request.isLatest() || requests.isCanceledError(cause)) return
    error(getRequestErrorMessage(cause, '读取云盘配置失败'))
    visible.value = false
  } finally { if (request.isLatest()) initialLoading.value = false }
})

const openAccountEditor = (edit: boolean) => {
  if (busy.value || browserBusy.value) return
  const account = edit ? accounts.value.find(item => item.id === form.accountId) : undefined
  editingAccountId.value = account?.id || ''
  reset()
  accountForm.values.name = account?.name || ''
  browserVisible.value = false
  editingAccount.value = true
}
const cancelAccountEditor = () => { reset(); editingAccount.value = false }
const saveAccount = async () => {
  if (busy.value) return
  saving.value = true
  try {
    accountForm.values.name = accountForm.values.name.trim()
    accountForm.values.token = accountForm.values.token.trim()
    if (!await validate()) return
    const response = await backupCloudApi.saveAccount({ name: accountForm.values.name, token: accountForm.values.token || undefined }, editingAccountId.value || undefined)
    if (!response.success || !response.data) throw new Error(response.message || '保存账户失败')
    const account = response.data
    const index = accounts.value.findIndex(item => item.id === account.id)
    if (index < 0) accounts.value.push(account)
    else accounts.value[index] = account
    // 更新授权后服务端会暂停该账户的自动上传，保持表单状态一致。
    if (editingAccountId.value && accountForm.values.token) form.enabled = false
    form.accountId = account.id
    applyAccount()
    cancelAccountEditor()
    emit('saved')
    success('云盘账户已保存')
  } catch (cause) { error(getRequestErrorMessage(cause, '保存云盘账户失败')) }
  finally { saving.value = false }
}
const chooseDirectory = () => {
  if (!selectedDirectory.value || browserBusy.value || connecting.value) return
  Object.assign(form, selectedDirectory.value)
  browserVisible.value = false
}
const persist = async () => {
  if (!form.accountId) throw new Error('请先新增并选择云盘账户')
  if (!form.folderId.trim()) throw new Error('请先选择备份保存目录')
  if (scheduleIntervalError.value) throw new Error('备份间隔须为 1–720 小时')
  if (canDelete.value && (sqlCountError.value || zipCountError.value)) throw new Error('SQL 和 ZIP 保留数量须分别为 1–1000 份')
  const response = await backupCloudApi.save({ ...form, schedule: { ...schedule }, ...(canDelete.value ? { retention: { ...retention } } : {}) })
  if (!response.success || !response.data) throw new Error(response.message || '保存失败')
  accounts.value = response.data.accounts
  scheduleStatus.value = response.data.schedule
  retentionStatus.value = response.data.retention
  emit('saved')
}
const save = async () => {
  if (busy.value) return
  saving.value = true
  try { await persist(); success('云盘设置已保存'); visible.value = false }
  catch (cause) { error(getRequestErrorMessage(cause, '保存云盘配置失败')) }
  finally { saving.value = false }
}
const test = async () => {
  if (busy.value) return
  testing.value = true
  try {
    await persist()
    const response = await backupCloudApi.test()
    if (!response.success) throw new Error(response.message || '连接失败')
    success(`连接成功，目标目录：${response.data?.folderName || form.folderId}`)
  } catch (cause) { error(getRequestErrorMessage(cause, '测试云盘连接失败')) }
  finally { testing.value = false }
}
</script>

<style scoped>
.cloud-settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--tf-space-4);
}
.cloud-settings-panel {
  padding: var(--tf-space-4);
  border-radius: var(--tf-radius-panel);
  background: var(--el-fill-color-light);
  min-width: 0;
}
.cloud-settings-field {
  margin: 0;
}
.cloud-policy-panel {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--tf-space-3);
}
.cloud-policy-panel > .el-text {
  align-self: stretch;
}
.cloud-policy-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--tf-space-3);
}
.cloud-account-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--tf-space-3);
  width: 100%;
}
.cloud-setting-row,
.cloud-directory-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--tf-space-3);
  width: 100%;
}
.cloud-setting-row > span,
.cloud-directory-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.cloud-directory-row .tf-dialog-toolbar {
  flex-shrink: 0;
}
@media (max-width: 767px) {
  .cloud-policy-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .cloud-account-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .cloud-directory-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
