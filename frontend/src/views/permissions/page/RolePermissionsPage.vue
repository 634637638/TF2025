<template>
  <div class="permission-settings-page">
    <div
      v-if="!ctx.selectedRoleForPermission"
      class="dialog-no-permissions"
    >
      <i class="fas fa-user-tag" />
      <p>请先从角色管理中选择一个角色</p>
    </div>

    <template v-else>
      <div class="permission-role-summary">
        <div>
          <div class="permission-role-summary__label">
            当前角色
          </div>
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

      <SectionLoading
        v-if="ctx.loadingPermissionDialog"
        text="加载中..."
      />

      <template v-else>
        <div
          v-if="ctx.permissionDialogMatrix.length > 0"
          class="permission-toolbar"
        >
          <el-button
            size="small"
            type="success"
            :disabled="ctx.savingDialogPermissions"
            @click="ctx.selectAllDialogPermissions(true)"
          >
            <i class="fas fa-check-double" />
            全开页面权限
          </el-button>
          <el-button
            size="small"
            type="warning"
            :disabled="ctx.savingDialogPermissions"
            @click="ctx.selectAllDialogPermissions(false)"
          >
            <i class="fas fa-times" />
            清空页面权限
          </el-button>
          <el-button
            size="small"
            type="info"
            :disabled="ctx.savingDialogPermissions"
            @click="ctx.toggleAllDialogMenuPermissions(true)"
          >
            <i class="fas fa-eye" />
            显示所有菜单
          </el-button>
          <el-button
            size="small"
            type="info"
            :disabled="ctx.savingDialogPermissions"
            @click="ctx.toggleAllDialogMenuPermissions(false)"
          >
            <i class="fas fa-eye-slash" />
            隐藏所有菜单
          </el-button>
          <div class="permission-bulk-action">
            <span class="permission-bulk-action__label">当前角色批量动作</span>
            <el-select
              v-model="ctx.dialogBulkPermissionType"
              size="small"
              class="permission-bulk-action__select"
              :disabled="ctx.savingDialogPermissions || ctx.dialogActionPermissionTypes.length === 0"
              placeholder="选择动作"
            >
              <el-option
                v-for="permissionType in ctx.dialogActionPermissionTypes"
                :key="permissionType"
                :label="ctx.getPermissionNameEnhanced(permissionType)"
                :value="permissionType"
              />
            </el-select>
            <el-button
              size="small"
              type="success"
              :disabled="ctx.savingDialogPermissions || !ctx.dialogBulkPermissionType"
              @click="ctx.toggleDialogActionAcrossModules(ctx.dialogBulkPermissionType, true)"
            >
              <i class="fas fa-toggle-on" />
              开启
            </el-button>
            <el-button
              size="small"
              type="warning"
              :disabled="ctx.savingDialogPermissions || !ctx.dialogBulkPermissionType"
              @click="ctx.toggleDialogActionAcrossModules(ctx.dialogBulkPermissionType, false)"
            >
              <i class="fas fa-toggle-off" />
              关闭
            </el-button>
          </div>
        </div>

        <div
          v-if="ctx.permissionDialogMatrix.length > 0"
          class="permission-group-list"
        >
          <section
            v-for="group in groupedPermissionModules"
            :key="group.key"
            class="permission-group"
          >
            <div class="permission-group__header">
              <div class="permission-group__title">
                <span class="group-tag">{{ group.standalone ? '独立页面' : '母子页面' }}</span>
                <h3>
                  <i :class="group.parent.icon" />
                  {{ group.title }}
                </h3>
              </div>
              <p class="permission-group__description">
                {{ group.description }}
              </p>
            </div>

            <div class="permission-module-stack">
              <article
                class="permission-module-card permission-module-card--parent"
                :class="`is-${getModuleStatus(group.parent).tone}`"
              >
                <div class="permission-module-card__header">
                  <div class="permission-module-card__inline">
                    <div class="permission-module-card__title">
                      {{ group.parent.name }}
                    </div>
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
                    <div class="permission-module-card__key">
                      {{ group.parent.module_key }}
                    </div>
                  </div>
                </div>

                <div class="permission-switch-grid">
                  <el-button
                    :aria-pressed="ctx.isDialogMenuPermissionSelected(group.parent.module_key)"
                    native-type="button"
                    class="permission-switch tf-button--content"
                    :class="{ checked: ctx.isDialogMenuPermissionSelected(group.parent.module_key), disabled: ctx.savingDialogPermissions }"
                    :disabled="ctx.savingDialogPermissions"
                    @click="toggleMenuPermission(group.parent.module_key)"
                  >
                    <span class="permission-switch__main">
                      <span class="permission-switch__icon">
                        <i :class="ctx.isDialogMenuPermissionSelected(group.parent.module_key) ? 'fas fa-eye' : 'fas fa-eye-slash'" />
                      </span>
                      <span class="permission-switch__text">
                        <span class="permission-switch__label">菜单查看</span>
                      </span>
                    </span>
                    <span class="permission-switch__control">
                      <span class="permission-switch__track">
                        <span class="permission-switch__thumb" />
                      </span>
                    </span>
                  </el-button>

                  <el-button
                    v-for="permission in group.parent.permissions"
                    :key="`${group.parent.module_key}-${getPermissionType(permission)}`"
                    :aria-pressed="ctx.isDialogPermissionSelected(group.parent.module_key, getPermissionType(permission))"
                    native-type="button"
                    class="permission-switch tf-button--content"
                    :class="{ checked: ctx.isDialogPermissionSelected(group.parent.module_key, getPermissionType(permission)), disabled: ctx.savingDialogPermissions }"
                    :disabled="ctx.savingDialogPermissions"
                    @click="toggleActionPermission(group.parent.module_key, getPermissionType(permission))"
                  >
                    <span class="permission-switch__main">
                      <span class="permission-switch__icon">
                        <i :class="ctx.getPermissionIcon(getPermissionType(permission))" />
                      </span>
                      <span class="permission-switch__text">
                        <span class="permission-switch__label">
                          {{ ctx.getPermissionNameEnhanced(getPermissionType(permission)) }}
                        </span>
                      </span>
                    </span>
                    <span class="permission-switch__control">
                      <span class="permission-switch__track">
                        <span class="permission-switch__thumb" />
                      </span>
                    </span>
                  </el-button>
                </div>
              </article>

              <div
                v-if="group.children.length > 0"
                class="permission-children"
              >
                <article
                  v-for="child in group.children"
                  :key="child.module_key"
                  class="permission-module-card permission-module-card--child"
                  :class="`is-${getModuleStatus(child).tone}`"
                >
                  <div class="permission-module-card__header">
                    <div class="permission-module-card__inline">
                      <div class="permission-module-card__title">
                        {{ child.name }}
                      </div>
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
                      <div class="permission-module-card__key">
                        {{ child.module_key }}
                      </div>
                    </div>
                  </div>

                  <div class="permission-switch-grid">
                    <el-button
                      :aria-pressed="ctx.isDialogMenuPermissionSelected(child.module_key)"
                      native-type="button"
                      class="permission-switch tf-button--content"
                      :class="{ checked: ctx.isDialogMenuPermissionSelected(child.module_key), disabled: ctx.savingDialogPermissions }"
                      :disabled="ctx.savingDialogPermissions"
                      @click="toggleMenuPermission(child.module_key)"
                    >
                      <span class="permission-switch__main">
                        <span class="permission-switch__icon">
                          <i :class="ctx.isDialogMenuPermissionSelected(child.module_key) ? 'fas fa-eye' : 'fas fa-eye-slash'" />
                        </span>
                        <span class="permission-switch__text">
                          <span class="permission-switch__label">菜单查看</span>
                        </span>
                      </span>
                      <span class="permission-switch__control">
                        <span class="permission-switch__track">
                          <span class="permission-switch__thumb" />
                        </span>
                      </span>
                    </el-button>

                    <el-button
                      v-for="permission in child.permissions"
                      :key="`${child.module_key}-${getPermissionType(permission)}`"
                      :aria-pressed="ctx.isDialogPermissionSelected(child.module_key, getPermissionType(permission))"
                      native-type="button"
                      class="permission-switch tf-button--content"
                      :class="{ checked: ctx.isDialogPermissionSelected(child.module_key, getPermissionType(permission)), disabled: ctx.savingDialogPermissions }"
                      :disabled="ctx.savingDialogPermissions"
                      @click="toggleActionPermission(child.module_key, getPermissionType(permission))"
                    >
                      <span class="permission-switch__main">
                        <span class="permission-switch__icon">
                          <i :class="ctx.getPermissionIcon(getPermissionType(permission))" />
                        </span>
                        <span class="permission-switch__text">
                          <span class="permission-switch__label">
                            {{ ctx.getPermissionNameEnhanced(getPermissionType(permission)) }}
                          </span>
                        </span>
                      </span>
                      <span class="permission-switch__control">
                        <span class="permission-switch__track">
                          <span class="permission-switch__thumb" />
                        </span>
                      </span>
                    </el-button>
                  </div>

                  <div
                    v-if="child.permissions.length === 0"
                    class="permission-empty"
                  >
                    当前子模块还没有可分配的动作权限
                  </div>
                </article>
              </div>
            </div>
          </section>

          <div class="permission-page-footer">
            <div class="permission-hint">
              <i class="fas fa-info-circle" />
              主页面控制主入口，子页面控制 Tab/个人页等细分功能，当前勾选会立即保存。
            </div>
            <el-button
              type="primary"
              @click="ctx.closePermissionDialog('roles')"
            >
              <i class="fas fa-arrow-left" />
              返回角色管理
            </el-button>
          </div>
        </div>

        <div
          v-else
          class="dialog-no-permissions"
        >
          <i class="fas fa-inbox" />
          <p>暂无模块权限数据</p>
          <small>请先在模块管理中同步系统模块</small>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionLoading from '@/components/SectionLoading.vue'
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

const toggleActionPermission = (moduleKey: string, permissionType: string) => {
  const checked = !ctx.isDialogPermissionSelected(moduleKey, permissionType)
  return ctx.handleDialogPermissionChange(moduleKey, permissionType, checked)
}

const toggleMenuPermission = (moduleKey: string) => {
  const checked = !ctx.isDialogMenuPermissionSelected(moduleKey)
  return ctx.handleDialogMenuPermissionChange(moduleKey, checked)
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

<style scoped src="./styles/role-permissions-page/page-and-tree.css"></style>
<style scoped src="./styles/role-permissions-page/permission-switch.css"></style>
