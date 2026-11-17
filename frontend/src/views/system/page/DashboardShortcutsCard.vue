<template>
  <section
    class="table-section admin-panel admin-table-panel"
    aria-label="快捷方式管理"
  >
    <div class="card-header-with-action">
      <h3 class="section-subtitle">
        <i
          class="fas fa-bolt"
          aria-hidden="true"
        /> 快捷方式
      </h3>
      <el-space wrap>
        <el-button
          circle
          text
          aria-label="刷新快捷方式"
          title="刷新"
          :loading="store.loadingAdmin"
          :disabled="store.saving"
          @click="load"
        >
          <i
            class="fas fa-sync-alt"
            aria-hidden="true"
          />
        </el-button>
        <el-button
          v-if="canEdit"
          v-permission="'system:edit'"
          type="primary"
          :disabled="store.saving"
          @click="create"
        >
          <i
            class="fas fa-plus"
            aria-hidden="true"
          /> 新增快捷方式
        </el-button>
      </el-space>
    </div>
    <el-text type="info">
      显示在首页公告下方，按排序值从小到大排列；员工只看到有权限使用的入口。
    </el-text>
    <SectionLoading
      v-if="store.loadingAdmin && !store.managedItems.length"
      text="正在读取快捷方式..."
    />
    <div
      v-else-if="failed"
      class="shortcuts-empty"
    >
      <DataEmptyState description="快捷方式加载失败，请刷新重试" />
    </div>
    <div
      v-else-if="store.managedItems.length"
      v-tf-loading="{ active: store.loadingAdmin, text: '正在刷新快捷方式...' }"
      v-table-double-tap="doubleTapOptions"
      class="shortcuts-list"
    >
      <article
        v-for="item in store.managedItems"
        :key="item.id"
        class="shortcuts-item"
        data-mobile-record
        @dblclick="handleRowDoubleClick(item, null, $event)"
      >
        <div class="shortcuts-item__content">
          <IconRenderer
            :icon="item.icon"
            aria-hidden="true"
          />
          <strong>{{ item.label }}</strong>
          <el-tag
            :type="item.enabled ? 'success' : 'info'"
            size="small"
          >
            {{ item.enabled ? '已启用' : '已停用' }}
          </el-tag>
          <el-tag size="small">
            {{ item.kind === 'page' ? '页面' : '功能' }}
          </el-tag>
          <span class="shortcuts-target">{{ targetLabel(item) }}</span>
          <el-text type="info">
            排序 {{ item.sortOrder }}
          </el-text>
        </div>
        <div
          v-if="!isMobile"
          class="action-buttons"
        >
          <el-button
            v-if="canEdit"
            v-permission="'system:edit'"
            text
            circle
            title="编辑快捷方式"
            aria-label="编辑快捷方式"
            :disabled="store.saving"
            @click.stop="edit(item)"
          >
            <i
              class="fas fa-pen"
              aria-hidden="true"
            />
          </el-button>
          <el-button
            v-if="canDelete"
            v-permission="'system:delete'"
            text
            circle
            type="danger"
            title="删除快捷方式"
            aria-label="删除快捷方式"
            :disabled="store.saving"
            @click.stop="remove(item)"
          >
            <i
              class="fas fa-trash-alt"
              aria-hidden="true"
            />
          </el-button>
        </div>
      </article>
    </div>
    <DataEmptyState
      v-else
      description="暂无快捷方式，新增后在首页展示"
    />

    <RecordDetailDialog
      v-model="detailVisible"
      title="快捷方式详情"
      :fields="detailFields"
      :record="detailRow"
      :has-actions="canEdit || canDelete"
    >
      <template #actions>
        <el-button
          v-if="canEdit"
          v-permission="'system:edit'"
          type="primary"
          :disabled="store.saving"
          @click.stop="runDetailAction(edit)"
        >
          编辑
        </el-button>
        <el-button
          v-if="canDelete"
          v-permission="'system:delete'"
          type="danger"
          :disabled="store.saving"
          @click.stop="runDetailAction(remove)"
        >
          删除
        </el-button>
      </template>
    </RecordDetailDialog>

    <MobileDialog
      v-model="visible"
      :title="editingId ? '编辑快捷方式' : '新增快捷方式'"
      :close-on-click-modal="false"
      :show-default-footer="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :disabled="store.saving"
        label-position="top"
        class="tf-dialog-form tf-dialog-form--stacked tf-form-layout"
      >
        <div class="tf-form-row tf-form-row--three">
          <el-form-item
            label="显示名称"
            prop="label"
          >
            <el-input
              v-model="form.label"
              maxlength="40"
              show-word-limit
            />
          </el-form-item>
          <el-form-item
            label="入口类型"
            prop="kind"
          >
            <el-select
              v-model="form.kind"
              @change="changeKind"
            >
              <el-option
                label="页面"
                value="page"
              /><el-option
                label="功能"
                value="action"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            class="tf-form-field--wide"
            :label="form.kind === 'page' ? '目标页面' : '目标功能'"
            prop="target"
          >
            <el-select
              v-model="form.target"
              filterable
              :placeholder="form.kind === 'page' ? '搜索页面名称' : '搜索页面或功能名称'"
              @change="selectTarget"
            >
              <el-option-group
                v-for="group in targetGroups"
                :key="group.label"
                :label="group.label"
              >
                <el-option
                  v-for="option in group.options"
                  :key="option.value"
                  :value="option.value"
                  :label="option.searchLabel"
                >
                  {{ option.label }}
                </el-option>
              </el-option-group>
            </el-select>
          </el-form-item>
        </div>
        <div class="tf-form-row tf-form-row--three">
          <el-form-item
            label="图标"
            prop="icon"
          >
            <el-select v-model="form.icon">
              <template #prefix>
                <IconRenderer
                  :icon="form.icon"
                  aria-hidden="true"
                />
              </template>
              <el-option
                v-for="icon in DASHBOARD_SHORTCUT_ICONS"
                :key="icon.value"
                :value="icon.value"
                :label="icon.label"
              >
                <el-space>
                  <IconRenderer
                    :icon="icon.value"
                    aria-hidden="true"
                  /><span>{{ icon.label }}</span>
                </el-space>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item
            label="排序"
            prop="sortOrder"
          >
            <el-input-number
              v-model="form.sortOrder"
              :min="0"
              :max="9999"
              :precision="0"
              :controls="false"
            />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch
              v-model="form.enabled"
              aria-label="启用快捷方式"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="tf-dialog-actions">
          <el-button
            :disabled="store.saving"
            @click="visible = false"
          >
            取消
          </el-button>
          <el-button
            v-permission="'system:edit'"
            type="primary"
            :disabled="!canEdit"
            :loading="store.saving"
            @click="save"
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
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import type { DashboardShortcut, DashboardShortcutInput } from '@/types/dashboard-shortcut'
import type { RecordDetailField } from '@/types/component'
import { useDashboardShortcutsStore } from '@/stores/dashboard-shortcuts'
import { DASHBOARD_SHORTCUT_ICONS, getShortcutActionGroups, getShortcutPages } from '@/utils/dashboard-shortcuts'
import { useNotification } from '@/composables/useNotification'
import { useMobile } from '@/composables/mobile'
import { useMobileTableDetail } from '@/composables/useMobileTableDetail'
import { getRequestErrorMessage } from '@/utils/api-response'
import { confirmAction } from '@/utils/message-box'

const props = defineProps<{ canEdit: boolean; canDelete: boolean }>()
const router = useRouter()
const store = useDashboardShortcutsStore()
const { success, error } = useNotification()
const { isMobile } = useMobile()
const visible = ref(false)
const editingId = ref<string | null>(null)
const failed = ref(false)
const formRef = ref<FormInstance>()
const initial = (): DashboardShortcutInput => ({ label: '', kind: 'page', target: '', icon: 'fas fa-bolt', sortOrder: 0, enabled: true })
const form = reactive(initial())
const pages = computed(() => getShortcutPages(router))
const functionGroups = computed(() => getShortcutActionGroups(router))
const functions = computed(() => functionGroups.value.flatMap(group => group.options))
const targetGroups = computed(() => form.kind === 'page'
  ? [{ label: '全部页面', options: pages.value.map(page => ({ ...page, searchLabel: page.label })) }]
  : functionGroups.value)
const targetOptions = computed(() => targetGroups.value.flatMap(group => group.options))
const targetLabel = (item: DashboardShortcut) => (item.kind === 'page' ? pages.value : functions.value).find(option => option.value === item.target)?.label || `入口已失效（${item.target}）`
const { detailRow, detailVisible, doubleTapOptions, handleRowDoubleClick, runDetailAction } = useMobileTableDetail({
  enabled: isMobile, rows: () => store.managedItems, getKey: item => item.id, rowSelector: '[data-mobile-record]'
})
const detailFields = computed<RecordDetailField[]>(() => {
  const row = detailRow.value
  return row ? [
    { key: 'label', label: '名称', value: row.label, visible: true },
    { key: 'enabled', label: '状态', value: row.enabled ? '已启用' : '已停用', visible: true },
    { key: 'kind', label: '入口类型', value: row.kind === 'page' ? '页面' : '功能', visible: true },
    { key: 'target', label: '目标', value: targetLabel(row), visible: true, wide: true },
    { key: 'sortOrder', label: '排序', value: row.sortOrder, visible: true }
  ] : []
})
const rules: FormRules<DashboardShortcutInput> = {
  label: [{ required: true, whitespace: true, message: '请输入显示名称', trigger: 'blur' }],
  target: [{ validator: (_rule, value: unknown, callback) => {
    callback(typeof value === 'string' && targetOptions.value.some(option => option.value === value) ? undefined : new Error('请选择有效的目标入口'))
  }, trigger: 'change' }],
  sortOrder: [{ type: 'integer', required: true, min: 0, max: 9999, message: '排序应为0至9999的整数', trigger: 'blur' }]
}
const load = async () => {
  if (store.saving) return
  try { await store.load(true); failed.value = false } catch (err) {
    failed.value = true
    error(getRequestErrorMessage(err, '快捷方式加载失败'))
  }
}
const create = () => {
  if (!props.canEdit || store.saving) return
  editingId.value = null
  Object.assign(form, initial())
  formRef.value?.clearValidate()
  visible.value = true
}
const edit = (item: DashboardShortcut) => {
  if (!props.canEdit || store.saving) return
  const { id, ...input } = item
  editingId.value = id
  Object.assign(form, input)
  formRef.value?.clearValidate()
  visible.value = true
}
const changeKind = () => { form.target = ''; formRef.value?.clearValidate('target') }
const selectTarget = () => {
  if (!form.label.trim()) form.label = targetOptions.value.find(option => option.value === form.target)?.label || ''
}
const save = async () => {
  if (!props.canEdit || store.saving || !await formRef.value?.validate().catch(() => false)) return
  try {
    if (!await store.save(editingId.value, { ...form, label: form.label.trim() })) return
    visible.value = false
    failed.value = false
    success('快捷方式已保存')
  } catch (err) { error(getRequestErrorMessage(err, '快捷方式保存失败')) }
}
const remove = async (item: DashboardShortcut) => {
  if (!props.canDelete || store.saving) return
  if (!await confirmAction(`确定删除快捷方式“${item.label}”吗？`, '删除快捷方式', { type: 'warning' }).then(() => true).catch(() => false)) return
  if (!props.canDelete || store.saving) return
  try {
    if (await store.save(item.id, null)) { failed.value = false; success('快捷方式已删除') }
  } catch (err) { error(getRequestErrorMessage(err, '快捷方式删除失败')) }
}
onMounted(load)
</script>

<style scoped>
.shortcuts-list { display: grid; gap: var(--tf-space-3); margin-top: var(--tf-space-4); }
.shortcuts-item { display: flex; align-items: center; justify-content: space-between; gap: var(--tf-space-3); padding: var(--admin-panel-padding); border: 1px solid var(--tf-color-border-muted); border-radius: var(--tf-radius-panel); min-width: 0; }
.shortcuts-item__content { display: flex; align-items: center; flex-wrap: wrap; gap: var(--tf-space-2); min-width: 0; overflow-wrap: anywhere; }
.shortcuts-target { color: var(--tf-color-muted); }
</style>
