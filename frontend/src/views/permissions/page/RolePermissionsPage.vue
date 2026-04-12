<template>
  <div class="permission-settings-page">
    <div v-if="!ctx.selectedRoleForPermission" class="dialog-no-permissions">
      <i class="fas fa-user-tag"></i>
      <p>请先从角色管理中选择一个角色</p>
    </div>

    <template v-else>
      <div class="permission-role-summary">
        <div>
          <div class="permission-role-summary__label">当前角色</div>
          <div class="permission-role-summary__content">
            <strong>{{ ctx.selectedRoleForPermission.name }}</strong>
            <code v-if="ctx.selectedRoleForPermission.code">{{ ctx.selectedRoleForPermission.code }}</code>
          </div>
        </div>
        <div class="permission-role-summary__meta">
          <span>{{ groupedPermissionModules.length }} 组</span>
          <span>{{ totalModuleCount }} 个页面</span>
        </div>
      </div>

      <div v-if="ctx.loadingPermissionDialog" class="dialog-loading-state">
        <GlobalLoading />
        <p>正在加载权限数据...</p>
      </div>

      <template v-else>
        <div v-if="ctx.permissionDialogMatrix.length > 0" class="permission-toolbar">
          <el-button
            size="small"
            type="success"
            @click="ctx.selectAllDialogPermissions(true)"
            :disabled="ctx.savingDialogPermissions"
          >
            <i class="fas fa-check-double"></i>
            全开页面权限
          </el-button>
          <el-button
            size="small"
            type="warning"
            @click="ctx.selectAllDialogPermissions(false)"
            :disabled="ctx.savingDialogPermissions"
          >
            <i class="fas fa-times"></i>
            清空页面权限
          </el-button>
          <el-button
            size="small"
            type="info"
            @click="ctx.toggleAllDialogMenuPermissions(true)"
            :disabled="ctx.savingDialogPermissions"
          >
            <i class="fas fa-eye"></i>
            显示所有菜单
          </el-button>
          <el-button
            size="small"
            type="info"
            @click="ctx.toggleAllDialogMenuPermissions(false)"
            :disabled="ctx.savingDialogPermissions"
          >
            <i class="fas fa-eye-slash"></i>
            隐藏所有菜单
          </el-button>
        </div>

        <div v-if="ctx.permissionDialogMatrix.length > 0" class="permission-group-list">
          <section
            v-for="group in groupedPermissionModules"
            :key="group.key"
            class="permission-group"
          >
            <div class="permission-group__header">
              <div class="permission-group__title">
                <span class="group-tag">{{ group.standalone ? '独立页面' : '母子页面' }}</span>
                <h3>
                  <i :class="group.parent.icon"></i>
                  {{ group.title }}
                </h3>
              </div>
              <p class="permission-group__description">{{ group.description }}</p>
            </div>

            <div class="permission-module-stack">
              <article
                class="permission-module-card permission-module-card--parent"
                :class="`is-${getModuleStatus(group.parent).tone}`"
              >
                <div class="permission-module-card__header">
                  <div class="permission-module-card__inline">
                    <div class="permission-module-card__title">{{ group.parent.name }}</div>
                    <span class="page-type-badge">{{ group.standalone ? '页面' : '母模块' }}</span>
                    <span
                      class="module-status-badge"
                      :class="`is-${getModuleStatus(group.parent).tone}`"
                    >
                      {{ getModuleStatus(group.parent).label }}
                    </span>
                    <div class="permission-module-card__summary">
                      {{ getEnabledSummary(group.parent) }}
                    </div>
                    <div class="permission-module-card__key">{{ group.parent.module_key }}</div>
                  </div>
                </div>

                <div class="permission-switch-grid">
                  <button
                    type="button"
                    class="permission-switch"
                    :class="{ checked: ctx.isDialogMenuPermissionSelected(group.parent.module_key), disabled: ctx.savingDialogPermissions }"
                    :disabled="ctx.savingDialogPermissions"
                    @click="toggleMenuPermission(group.parent.module_key)"
                  >
                    <span class="permission-switch__main">
                      <span class="permission-switch__icon">
                        <i :class="ctx.isDialogMenuPermissionSelected(group.parent.module_key) ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
                      </span>
                      <span class="permission-switch__text">
                        <span class="permission-switch__label">菜单查看</span>
                      </span>
                    </span>
                    <span class="permission-switch__control">
                      <span class="permission-switch__track">
                        <span class="permission-switch__thumb"></span>
                      </span>
                    </span>
                  </button>

                  <button
                    v-for="permission in group.parent.permissions"
                    :key="`${group.parent.module_key}-${getPermissionType(permission)}`"
                    type="button"
                    class="permission-switch"
                    :class="{ checked: ctx.isDialogPermissionSelected(group.parent.module_key, getPermissionType(permission)), disabled: ctx.savingDialogPermissions }"
                    :disabled="ctx.savingDialogPermissions"
                    @click="toggleActionPermission(group.parent.module_key, getPermissionType(permission))"
                  >
                    <span class="permission-switch__main">
                      <span class="permission-switch__icon">
                        <i :class="ctx.getPermissionIcon(getPermissionType(permission))"></i>
                      </span>
                      <span class="permission-switch__text">
                        <span class="permission-switch__label">
                          {{ ctx.getPermissionNameEnhanced(getPermissionType(permission)) }}
                        </span>
                      </span>
                    </span>
                    <span class="permission-switch__control">
                      <span class="permission-switch__track">
                        <span class="permission-switch__thumb"></span>
                      </span>
                    </span>
                  </button>
                </div>
              </article>

              <div v-if="group.children.length > 0" class="permission-children">
                <article
                  v-for="child in group.children"
                  :key="child.module_key"
                  class="permission-module-card permission-module-card--child"
                  :class="`is-${getModuleStatus(child).tone}`"
                >
                  <div class="permission-module-card__header">
                    <div class="permission-module-card__inline">
                      <div class="permission-module-card__title">{{ child.name }}</div>
                      <span class="page-type-badge child">子模块</span>
                      <span
                        class="module-status-badge"
                        :class="`is-${getModuleStatus(child).tone}`"
                      >
                        {{ getModuleStatus(child).label }}
                      </span>
                      <div class="permission-module-card__summary">
                        {{ getEnabledSummary(child) }}
                      </div>
                      <div class="permission-module-card__key">{{ child.module_key }}</div>
                    </div>
                  </div>

                  <div class="permission-switch-grid">
                    <button
                      type="button"
                      class="permission-switch"
                      :class="{ checked: ctx.isDialogMenuPermissionSelected(child.module_key), disabled: ctx.savingDialogPermissions }"
                      :disabled="ctx.savingDialogPermissions"
                      @click="toggleMenuPermission(child.module_key)"
                    >
                      <span class="permission-switch__main">
                        <span class="permission-switch__icon">
                          <i :class="ctx.isDialogMenuPermissionSelected(child.module_key) ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
                        </span>
                        <span class="permission-switch__text">
                          <span class="permission-switch__label">菜单查看</span>
                        </span>
                      </span>
                      <span class="permission-switch__control">
                        <span class="permission-switch__track">
                          <span class="permission-switch__thumb"></span>
                        </span>
                      </span>
                    </button>

                    <button
                      v-for="permission in child.permissions"
                      :key="`${child.module_key}-${getPermissionType(permission)}`"
                      type="button"
                      class="permission-switch"
                      :class="{ checked: ctx.isDialogPermissionSelected(child.module_key, getPermissionType(permission)), disabled: ctx.savingDialogPermissions }"
                      :disabled="ctx.savingDialogPermissions"
                      @click="toggleActionPermission(child.module_key, getPermissionType(permission))"
                    >
                      <span class="permission-switch__main">
                        <span class="permission-switch__icon">
                          <i :class="ctx.getPermissionIcon(getPermissionType(permission))"></i>
                        </span>
                        <span class="permission-switch__text">
                          <span class="permission-switch__label">
                            {{ ctx.getPermissionNameEnhanced(getPermissionType(permission)) }}
                          </span>
                        </span>
                      </span>
                      <span class="permission-switch__control">
                        <span class="permission-switch__track">
                          <span class="permission-switch__thumb"></span>
                        </span>
                      </span>
                    </button>
                  </div>

                  <div v-if="child.permissions.length === 0" class="permission-empty">
                    当前子模块还没有可分配的动作权限
                  </div>
                </article>
              </div>
            </div>
          </section>

          <div class="permission-page-footer">
            <div class="permission-hint">
              <i class="fas fa-info-circle"></i>
              主页面控制主入口，子页面控制 Tab/个人页等细分功能，当前勾选会立即保存。
            </div>
            <el-button type="primary" @click="ctx.closePermissionDialog('roles')">
              <i class="fas fa-arrow-left"></i>
              返回角色管理
            </el-button>
          </div>
        </div>

        <div v-else class="dialog-no-permissions">
          <i class="fas fa-inbox"></i>
          <p>暂无模块权限数据</p>
          <small>请先在模块管理中同步系统模块</small>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GlobalLoading from '@/components/GlobalLoading.vue'
import { usePermissionsPageContext } from './context'

const ctx = usePermissionsPageContext()

type DialogPermission = {
  permission_type?: string
  type?: string
}

type DialogModule = {
  module_key: string
  name: string
  description?: string
  icon?: string
  permissions: DialogPermission[]
}

type ModuleGroup = {
  key: string
  title: string
  description: string
  parent: DialogModule
  children: DialogModule[]
  standalone: boolean
}

type ModuleStatusTone = 'enabled' | 'partial' | 'disabled' | 'hidden'

type ModuleStatus = {
  label: string
  tone: ModuleStatusTone
}

const GROUP_CONFIG = [
  {
    parentKey: 'system_systemview',
    title: '系统设置',
    description: '系统主页面下面统一管理 Git 管理、数据优化等子页面权限。',
    childKeys: ['system_gitmanagement', 'data_optimization_dataoptimizationview'],
    prefix: 'system_'
  },
  {
    parentKey: 'permissions_permissionsview',
    title: '权限管理',
    description: '权限主页面下面统一管理模块管理等子页面权限。',
    childKeys: ['permissions_modulemanagementview'],
    prefix: 'permissions_'
  },
  {
    parentKey: 'salary_salaryview',
    title: '工资管理',
    description: '工资主页面下面统一管理“我的工资”“工资模板”“工资记录”等子页面权限。',
    childKeys: ['salary_mysalaryview', 'salary_salarytemplatesview', 'salary_salaryrecordsview'],
    prefix: 'salary_'
  },
  {
    parentKey: 'attendance_attendanceview',
    title: '考勤管理',
    description: '考勤主页面下面统一管理“我的考勤”等子页面权限。',
    childKeys: ['attendance_myattendanceview'],
    prefix: 'attendance_'
  },
  {
    parentKey: 'price_list_pricelistview',
    title: '价目表',
    description: '价目表主页面下面统一管理同步日志等子页面权限。',
    childKeys: ['price_list_synclogview'],
    prefix: 'price_list_'
  },
  {
    parentKey: 'h5_admin_h5_adminview',
    title: 'H5商城管理',
    description: 'H5 商城主页面下面统一管理模板、配置、轮播图、首页推荐和商城订单等子页面权限。',
    childKeys: [
      'h5_admin_templatesview',
      'h5_admin_configview',
      'h5_admin_homesectionsview',
      'h5_admin_bannersview',
      'h5_admin_ordersview'
    ],
    prefix: 'h5_admin_'
  }
] as const

const getPermissionType = (permission: DialogPermission) => permission.permission_type || permission.type || 'view'

const getSelectedPermissionCount = (module: DialogModule) =>
  (module.permissions || []).filter((permission) =>
    ctx.isDialogPermissionSelected(module.module_key, getPermissionType(permission))
  ).length

const getEnabledSummary = (module: DialogModule) => {
  const permissionCount = module.permissions?.length || 0
  const selectedCount = getSelectedPermissionCount(module)
  const menuEnabled = ctx.isDialogMenuPermissionSelected(module.module_key)
  return `菜单${menuEnabled ? '已开' : '已关'} · 动作 ${selectedCount}/${permissionCount}`
}

const createSwitchEvent = (checked: boolean) => {
  const event = { target: { checked } } as unknown as Event
  return event
}

const toggleActionPermission = (moduleKey: string, permissionType: string) => {
  const checked = !ctx.isDialogPermissionSelected(moduleKey, permissionType)
  return ctx.handleDialogPermissionChange(moduleKey, permissionType, createSwitchEvent(checked))
}

const toggleMenuPermission = (moduleKey: string) => {
  const checked = !ctx.isDialogMenuPermissionSelected(moduleKey)
  return ctx.handleDialogMenuPermissionChange(moduleKey, createSwitchEvent(checked))
}

const getModuleStatus = (module: DialogModule): ModuleStatus => {
  const total = module.permissions?.length || 0
  const selected = getSelectedPermissionCount(module)
  const menuVisible = ctx.isDialogMenuPermissionSelected(module.module_key)

  if (selected === 0) {
    return menuVisible
      ? { label: '仅菜单开启', tone: 'partial' }
      : { label: '未开启', tone: 'disabled' }
  }

  if (selected === total && menuVisible) {
    return { label: '已开启', tone: 'enabled' }
  }

  if (selected === total && !menuVisible) {
    return { label: '权限开启 菜单隐藏', tone: 'hidden' }
  }

  return { label: '部分开启', tone: 'partial' }
}

const groupedPermissionModules = computed<ModuleGroup[]>(() => {
  const modules = (ctx.permissionDialogMatrix || []) as DialogModule[]
  const moduleMap = new Map(modules.map(module => [module.module_key, module]))
  const consumed = new Set<string>()
  const groups: ModuleGroup[] = []

  GROUP_CONFIG.forEach(config => {
    const parent = moduleMap.get(config.parentKey)
    if (!parent) return

    consumed.add(parent.module_key)
    const children: DialogModule[] = []
    const configuredChildKeys = new Set<string>(config.childKeys)

    config.childKeys.forEach(childKey => {
      const child = moduleMap.get(childKey)
      if (child) {
        children.push(child)
        consumed.add(child.module_key)
      }
    })

    modules.forEach(module => {
      if (
        !consumed.has(module.module_key) &&
        module.module_key.startsWith(config.prefix) &&
        module.module_key !== config.parentKey &&
        !configuredChildKeys.has(module.module_key)
      ) {
        children.push(module)
        consumed.add(module.module_key)
      }
    })

    groups.push({
      key: config.parentKey,
      title: config.title,
      description: config.description,
      parent,
      children,
      standalone: false
    })
  })

  modules.forEach(module => {
    if (consumed.has(module.module_key)) return
    groups.push({
      key: module.module_key,
      title: module.name,
      description: module.description || '独立页面权限。',
      parent: module,
      children: [],
      standalone: true
    })
  })

  return groups
})

const totalModuleCount = computed(() =>
  groupedPermissionModules.value.reduce((count, group) => count + 1 + group.children.length, 0)
)
</script>

<style scoped>
.permission-settings-page {
  display: grid;
  gap: 16px;
}

.permission-role-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.permission-role-summary__label {
  font-size: 12px;
  color: #64748b;
}

.permission-role-summary__content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.permission-role-summary__content strong {
  font-size: 16px;
  color: #0f172a;
}

.permission-role-summary__content code {
  padding: 3px 8px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
  font-size: 12px;
}

.permission-role-summary__meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.permission-toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.permission-group-list {
  display: grid;
  gap: 16px;
}

.permission-group {
  padding: 14px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.permission-group__header {
  margin-bottom: 14px;
}

.permission-group__title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.permission-group__title h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  color: #0f172a;
}

.group-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
}

.permission-group__description {
  margin: 0;
  color: #64748b;
  line-height: 1.6;
}

.permission-module-stack {
  display: grid;
  gap: 12px;
}

.permission-children {
  display: grid;
  gap: 12px;
  padding-left: 18px;
  border-left: 2px dashed #d8b4fe;
}

.permission-module-card {
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.permission-module-card--parent {
  background: linear-gradient(180deg, #faf5ff 0%, #f5f3ff 100%);
  border-color: #d8b4fe;
}

.permission-module-card--child {
  background: #fbfdff;
}

.permission-module-card.is-enabled {
  border-color: #86efac;
  background: #f0fdf4;
}

.permission-module-card.is-partial {
  border-color: #fcd34d;
  background: #fffbeb;
}

.permission-module-card.is-disabled {
  border-color: #e2e8f0;
  background: #f8fafc;
}

.permission-module-card.is-hidden {
  border-color: #cbd5f5;
  background: #f8faff;
}

.permission-module-card__header {
  margin-bottom: 10px;
}

.permission-module-card__inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.permission-module-card__title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.permission-module-card__summary {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
}

.permission-module-card__key {
  width: fit-content;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
  color: #475569;
  font-size: 12px;
}

.page-type-badge {
  width: fit-content;
  padding: 3px 8px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
}

.page-type-badge.child {
  background: #ecfeff;
  color: #0f766e;
}

.module-status-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid transparent;
}

.module-status-badge.is-enabled {
  color: #166534;
  background: #dcfce7;
  border-color: #86efac;
}

.module-status-badge.is-partial {
  color: #a16207;
  background: #fef3c7;
  border-color: #fcd34d;
}

.module-status-badge.is-disabled {
  color: #475569;
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.module-status-badge.is-hidden {
  color: #4338ca;
  background: #e0e7ff;
  border-color: #c7d2fe;
}

.permission-switch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.permission-switch {
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #dbe3ee;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.permission-switch:hover {
  border-color: #a78bfa;
  box-shadow: 0 8px 18px rgba(139, 92, 246, 0.08);
}

.permission-switch:disabled,
.permission-switch.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.permission-switch.checked {
  border-color: #8b5cf6;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.14) 100%);
  box-shadow: 0 10px 22px rgba(139, 92, 246, 0.12);
}

.permission-switch__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.permission-switch__icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #ede9fe;
  color: #6d28d9;
  flex-shrink: 0;
  font-size: 12px;
}

.permission-switch.checked .permission-switch__icon {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: #fff;
}

.permission-switch__text {
  min-width: 0;
  display: flex;
  align-items: center;
}

.permission-switch__label {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}

.permission-switch.checked .permission-switch__label {
  color: #5b21b6;
}

.permission-switch__control {
  flex-shrink: 0;
}

.permission-switch__track {
  position: relative;
  width: 40px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #cbd5e1;
  transition: background-color 0.2s ease;
}

.permission-switch.checked .permission-switch__track {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.permission-switch__thumb {
  position: absolute;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
  transition: transform 0.2s ease;
}

.permission-switch.checked .permission-switch__thumb {
  transform: translateX(18px);
}

.permission-empty {
  color: #64748b;
  font-size: 13px;
  padding: 4px 0;
}

.permission-page-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  padding-top: 8px;
}

.permission-hint {
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 768px) {
  .permission-role-summary,
  .permission-page-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .permission-module-card__inline {
    gap: 6px;
  }

  .permission-children {
    padding-left: 12px;
  }

  .permission-switch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
