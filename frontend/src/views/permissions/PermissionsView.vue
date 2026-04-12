<template>
  <div class="permissions-view admin-page">
    <!-- ❌ 无权限时显示提示 -->
    <PermissionDenied
      v-if="!canView"
      :can-view="canView"
      module-key="permissions"
      module-name="权限管理"
      permission-code="permissions:view"
    />

    <!-- 主要内容 - 只有有权限时才显示 -->
    <div v-else class="content admin-page-content">
    <!-- 页面头部 -->
    <PageHeader
      :icon="currentTabHeader.icon"
      :title="currentTabHeader.title"
      :description="currentTabHeader.description"
    >
      <template #actions>
        <template v-if="activeTab === 'roles'">
          <el-button
            v-if="canCreate"
            type="primary"
            @click="handleCreateRole"
          >
            <i class="fas fa-plus"></i>
            新增
          </el-button>
          <el-button
            v-else
            type="primary"
            disabled
            title="您没有新增角色的权限"
          >
            <i class="fas fa-plus"></i>
            新增
          </el-button>
        </template>

        <template v-else-if="activeTab === 'modules'">
          <el-button type="primary" @click="scanModules">
            <i class="fas fa-search"></i>
            扫描模块
          </el-button>
          <el-button type="success" @click="syncAllModules">
            <i class="fas fa-sync"></i>
            一键同步
          </el-button>
          <el-button type="info" @click="goToRegisteredModules">
            <i class="fas fa-list"></i>
            已注册模块
          </el-button>
        </template>

        <template v-else-if="activeTab === 'logs'">
          <el-button type="success" plain :loading="exportingLogs" @click="exportLogs">
            <i class="fas fa-download"></i>
            导出日志
          </el-button>
        </template>

        <template v-else-if="activeTab === 'pagePermissions'">
          <el-button
            type="info"
            plain
            :disabled="loadingPermissionDialog || savingDialogPermissions || !selectedRoleForPermission"
            @click="loadPermissionDialog"
          >
            <i class="fas fa-sync-alt"></i>
            刷新权限
          </el-button>
          <el-button
            type="primary"
            :disabled="!selectedRoleForPermission"
            @click="closePermissionDialog('roles')"
          >
            <i class="fas fa-arrow-left"></i>
            返回角色管理
          </el-button>
        </template>

        <el-button type="info" @click="handleRefresh">
          <i class="fas fa-sync-alt"></i>
          刷新
        </el-button>
      </template>
    </PageHeader>

    <!-- 权限统计卡片 -->
    <div v-if="showStatsCards" class="stats-cards">
      <div v-if="canViewPermissionsField('stats_total_roles')" class="stat-card">
        <div class="stat-icon roles">
          <i class="fas fa-user-tag"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalRoles }}</div>
          <div class="stat-label">角色总数</div>
        </div>
      </div>

      <div v-if="canViewPermissionsField('stats_total_users')" class="stat-card">
        <div class="stat-icon users">
          <i class="fas fa-users"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalUsers }}</div>
          <div class="stat-label">用户总数</div>
        </div>
      </div>

      <div v-if="canViewPermissionsField('stats_system_roles')" class="stat-card">
        <div class="stat-icon system-roles">
          <i class="fas fa-cog"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.systemRoles }}</div>
          <div class="stat-label">系统角色</div>
        </div>
      </div>

      <div v-if="canViewPermissionsField('stats_business_roles')" class="stat-card">
        <div class="stat-icon business-roles">
          <i class="fas fa-briefcase"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.businessRoles }}</div>
          <div class="stat-label">业务角色</div>
        </div>
      </div>

      <div v-if="canViewPermissionsField('stats_total_modules')" class="stat-card" @click="goToModuleManagement" style="cursor: pointer;">
        <div class="stat-icon modules">
          <i class="fas fa-cube"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalModules }}</div>
          <div class="stat-label">权限模块</div>
        </div>
      </div>

      <div v-if="canViewPermissionsField('stats_unregistered_modules')" class="stat-card" @click="goToModuleManagement" style="cursor: pointer;">
        <div class="stat-icon unregistered">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.unregisteredModules }}</div>
          <div class="stat-label">待注册模块</div>
        </div>
      </div>
    </div>

    <!-- TAB导航 -->
    <div class="tab-navigation">
      <el-button
        :type="activeTab === 'roles' ? 'primary' : 'default'"
        @click="handleTabClick('roles')"
        :icon="Avatar"
      >
        角色管理
      </el-button>
      <el-button
        :type="activeTab === 'userRoles' ? 'primary' : 'default'"
        @click="handleTabClick('userRoles')"
        :icon="User"
      >
        角色分配
      </el-button>
      <el-button
        :type="activeTab === 'storeBindings' ? 'primary' : 'default'"
        @click="handleTabClick('storeBindings')"
        :icon="Shop"
      >
        门店绑定
      </el-button>
      <el-button
        :type="activeTab === 'modules' ? 'primary' : 'default'"
        @click="handleTabClick('modules')"
        :icon="Grid"
      >
        模块管理
      </el-button>
      <el-button
        :type="activeTab === 'logs' ? 'primary' : 'default'"
        @click="handleTabClick('logs')"
        :icon="Document"
      >
        权限日志
      </el-button>
      <el-button
        v-if="selectedRoleForPermission"
        :type="activeTab === 'pagePermissions' ? 'primary' : 'default'"
        @click="handleTabClick('pagePermissions')"
        :icon="Lock"
      >
        页面权限
      </el-button>
    </div>

    <SharedSearchPanel />

    <!-- 权限管理内容 -->
    <div class="permissions-content admin-page-content">
      <RolesPage v-if="activeTab === 'roles'" />
      <UserRolesPage v-else-if="activeTab === 'userRoles'" />
      <StoreBindingsPage v-else-if="activeTab === 'storeBindings'" />
      <ModulesPage v-else-if="activeTab === 'modules'" />
      <LogsPage v-else-if="activeTab === 'logs'" />
      <RolePermissionsPage v-else-if="activeTab === 'pagePermissions'" />
    </div>

    <!-- 角色编辑对话框 -->
    <MobileDialog
      v-model="roleDialogVisible"
      :title="isEditRole ? '编辑角色' : '新增角色'"
      width="540px"
      dialog-class="permissions-dialog"
      :show-default-footer="false"
      :close-on-click-modal="false"
    >
      <div class="modal-body">
        <form @submit.prevent="saveRole">
          <div class="form-group">
            <label>角色名称 <span class="required">*</span></label>
            <input
              v-model="roleForm.name"
              type="text"
              class="form-control"
              required
              placeholder="请输入角色名称，如：门店负责人、采购专员、财务审核等"
            />
          </div>
          <div class="form-group">
            <label>角色编码</label>
            <input
              v-model="roleForm.code"
              type="text"
              class="form-control"
              placeholder="请输入稳定编码，如：store_manager，留空则系统自动生成"
            />
            <small class="form-help-text">建议使用字母、数字、下划线、中划线或冒号，作为角色的稳定标识。</small>
          </div>
          <div class="form-group">
            <label>角色描述 <span class="required">*</span></label>
            <textarea
              v-model="roleForm.description"
              class="form-control"
              rows="3"
              required
              placeholder="请输入角色描述，详细说明该角色的职责和权限范围"
            ></textarea>
          </div>
        </form>
      </div>

      <template #footer>
        <div class="modal-footer">
          <el-button type="info" @click="closeRoleDialog">取消</el-button>
          <el-button type="primary" @click="saveRole" :disabled="savingRole">
            <i v-if="savingRole" class="fas fa-spinner fa-spin"></i>
            {{ isEditRole ? '更新' : '创建' }}
          </el-button>
        </div>
      </template>
    </MobileDialog>

  
    <!-- 用户角色分配对话框 -->
    <MobileDialog
      v-model="userRoleDialogVisible"
      :title="`角色分配 - ${currentUser?.username || ''}`"
      width="1180px"
      dialog-class="permissions-dialog user-role-modal"
      :show-default-footer="false"
    >
      <div class="modal-body">
        <div v-if="currentUser" class="user-role-form role-assignment-shell">
            <div class="role-assignment-hero">
              <div class="role-assignment-user-card">
                <div class="user-avatar">
                  <i class="fas fa-user-circle"></i>
                </div>
                <div class="user-details">
                  <span class="role-assignment-caption">当前操作用户</span>
                  <h4>{{ currentUser.username }}</h4>
                  <p>{{ currentUser.full_name || currentUser.name || '未设置姓名' }}</p>
                  <div class="user-status">
                    <span :class="['status-badge', currentUser.status === 1 ? 'active' : 'inactive']">
                      {{ currentUser.status === 1 ? '活跃' : '禁用' }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="role-assignment-summary">
                <div class="summary-metric">
                  <span class="summary-metric-label">已选角色</span>
                  <strong>{{ selectedUserRoleIds.length }}</strong>
                </div>
                <div class="summary-metric">
                  <span class="summary-metric-label">当前可见</span>
                  <strong>{{ filteredRolesForAssignment.length }}</strong>
                </div>
                <div class="summary-metric">
                  <span class="summary-metric-label">角色总数</span>
                  <strong>{{ rolesData.length }}</strong>
                </div>
                <div class="summary-metric hint">
                  <span class="summary-metric-label">分配模式</span>
                  <strong>支持多选</strong>
                </div>
              </div>
            </div>

            <div class="role-assignment-layout">
              <div class="role-selection-section assignment-main-panel">
                <div class="role-search-section assignment-toolbar">
                  <div class="assignment-toolbar-title">
                    <h4>选择角色</h4>
                    <p>一行展示多个角色，点击卡片即可勾选或取消。</p>
                  </div>

                  <div class="search-input-wrapper assignment-search-box">
                    <i class="fas fa-search search-icon"></i>
                    <input
                      type="text"
                      v-model="roleSearchQuery"
                      class="form-control search-input"
                      placeholder="搜索角色名称或描述..."
                    />
                    <button
                      v-if="roleSearchQuery"
                      type="button"
                      @click="roleSearchQuery = ''"
                      class="search-clear-btn"
                    >
                      <i class="fas fa-times"></i>
                    </button>
                  </div>

                  <div class="search-results-info assignment-toolbar-meta">
                    <span class="assignment-meta-pill">
                      <i class="fas fa-layer-group"></i>
                      共 {{ rolesData.length }} 个角色
                    </span>
                    <span v-if="roleSearchQuery" class="assignment-meta-pill active">
                      <i class="fas fa-filter"></i>
                      匹配 {{ filteredRolesForAssignment.length }} 个
                    </span>
                    <span class="assignment-meta-pill">
                      <i class="fas fa-check-circle"></i>
                      已选 {{ selectedUserRoleIds.length }} 个
                    </span>
                  </div>
                </div>

                <div v-if="filteredRolesForAssignment.length > 0" class="role-group assignment-role-grid">
                  <label
                    v-for="role in filteredRolesForAssignment"
                    :key="role.id"
                    :class="[
                      'assignment-role-option',
                      { selected: isRoleSelectedForAssignment(role.id) }
                    ]"
                  >
                    <input
                      type="checkbox"
                      class="form-check-input assignment-role-input"
                      :value="role.id"
                      v-model="selectedUserRoleIds"
                    >
                    <span class="assignment-role-check">
                      <i :class="isRoleSelectedForAssignment(role.id) ? 'fas fa-check' : 'fas fa-plus'"></i>
                    </span>
                    <div class="assignment-role-card">
                      <div class="assignment-role-header">
                        <strong>{{ role.name }}</strong>
                        <span :class="['assignment-role-badge', getRoleCardBadgeClass(role.name)]">
                          {{ role.code || '角色' }}
                        </span>
                      </div>
                      <div class="assignment-role-description">
                        {{ role.description || '暂无描述' }}
                      </div>
                      <div class="assignment-role-meta">
                        <span class="user-count">
                          <i class="fas fa-users"></i>
                          {{ role.user_count || 0 }} 人使用
                        </span>
                        <span class="assignment-role-state">
                          {{ isRoleSelectedForAssignment(role.id) ? '已选择' : '点击选择' }}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>

                <div v-else class="assignment-empty-state">
                  <div class="assignment-empty-icon">
                    <i class="fas fa-search"></i>
                  </div>
                  <h4>未找到匹配角色</h4>
                  <p>请调整关键词，或清空搜索后查看全部角色。</p>
                </div>
              </div>

              <div class="selected-roles-preview assignment-side-panel">
                <div class="assignment-side-header">
                  <div>
                    <h4>已选角色</h4>
                    <p>点击下方标签可快速移除。</p>
                  </div>
                  <span class="assignment-side-count">{{ selectedUserRoleIds.length }}</span>
                </div>

                <div v-if="selectedUserRoleIds.length > 0" class="selected-roles-list assignment-selected-list">
                  <button
                    v-for="roleId in selectedUserRoleIds"
                    :key="roleId"
                    type="button"
                    class="selected-role-tag assignment-selected-tag"
                    @click="removeRoleFromSelection(roleId)"
                    title="点击移除"
                  >
                    <span>{{ getRoleNameById(roleId) }}</span>
                    <i class="fas fa-times"></i>
                  </button>
                </div>

                <div v-else class="assignment-empty-selection">
                  <i class="fas fa-user-tag"></i>
                  <span>暂未选择角色，保存后可将该用户清空角色。</span>
                </div>

	                <div class="assignment-side-tip">
	                  <i class="fas fa-info-circle"></i>
	                  <span>系统角色权限较高，请确认后再保存分配结果。</span>
	                </div>
	              </div>
	            </div>
	          </div>

	      </div>

      <template #footer>
        <div class="modal-footer user-role-footer">
          <div class="user-role-footer-info">
            <i class="fas fa-shield-alt"></i>
            <span>本次将为 {{ currentUser?.username || '该用户' }} 更新 {{ selectedUserRoleIds.length }} 个角色</span>
          </div>
          <div class="user-role-footer-actions">
            <el-button type="info" @click="closeUserRoleDialog">取消</el-button>
            <el-button type="primary" @click="saveUserRoles" :disabled="savingUserRoles">
              <i v-if="savingUserRoles" class="fas fa-spinner fa-spin me-2"></i>
              {{ savingUserRoles ? '保存中...' : '保存角色分配' }}
            </el-button>
          </div>
        </div>
      </template>
    </MobileDialog>
    </div> <!-- 结束主要内容 v-else -->

    <!-- 字段权限配置弹窗 -->
    <Teleport to="body">
      <MobileDialog
        v-model="showFieldPermissionDialog"
        :title="`${selectedModule?.name || ''} - 字段权限配置`"
        width="900px"
        dialog-class="permissions-dialog field-permission-dialog"
        :show-default-footer="false"
      >
        <div class="modal-body">
          <div class="field-permission-info">
            <div class="info-alert">
              <i class="fas fa-info-circle"></i>
              <span>配置该角色在{{ selectedModule?.name }}模块中可以查看的字段。</span>
            </div>
          </div>

          <div class="field-groups-container">
            <div v-for="group in fieldGroups" :key="group.name" class="field-group">
              <div class="group-header">
                <h4>
                  <i class="fas fa-folder"></i>
                  {{ group.name }}
                  <span class="group-count">({{ group.fields.length }}个字段)</span>
                </h4>
                <div class="group-sensitivity">
                  <span :class="['sensitivity-badge', group.sensitivity]">
                    {{ getSensitivityLabel(group.sensitivity) }}
                  </span>
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    @click="toggleGroupFields(group)"
                  >
                    {{ getGroupSelectionStatus(group) ? '取消选择' : '全选' }}
                  </el-button>
                </div>
              </div>

              <div class="fields-grid">
                <div
                  v-for="field in group.fields"
                  :key="field.id"
                  :class="['field-item', { 'field-sensitive': isFieldSensitive(field) }]"
                >
                  <label class="field-checkbox">
                    <input
                      v-model="selectedFields"
                      type="checkbox"
                      :value="field.id"
                    />
                    <span class="checkmark"></span>
                    <div class="field-info">
                      <div class="field-main">
                        <strong>{{ field.name }}</strong>
                        <div class="field-badges">
                          <span :class="['field-type', field.type]">
                            {{ getFieldTypeLabel(field.type) }}
                          </span>
                          <span v-if="field.required" class="field-required">必填</span>
                          <span :class="['field-sensitivity', field.sensitivity]">
                            {{ getSensitivityLabel(field.sensitivity) }}
                          </span>
                        </div>
                      </div>
                      <div class="field-description">
                        {{ field.description }}
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div v-if="fieldGroups.length === 0" class="no-fields">
            <i class="fas fa-exclamation-triangle"></i>
            <p>该模块暂未配置字段定义</p>
            <small>请联系有权限的角色维护人员为该模块添加字段定义</small>
          </div>
        </div>

        <template #footer>
          <div class="modal-footer">
            <div class="selection-summary">
              <span>已选择 {{ selectedFields.length }} / {{ totalFieldCount }} 个字段</span>
            </div>
            <div class="footer-actions">
              <el-button type="info" @click="closeFieldPermissionDialog">
                取消
              </el-button>
              <el-button
                type="primary"
                @click="saveFieldPermissions"
                :disabled="savingFieldPermissions"
              >
                <i v-if="savingFieldPermissions" class="fas fa-spinner fa-spin"></i>
                {{ savingFieldPermissions ? '保存中...' : '保存配置' }}
              </el-button>
            </div>
          </div>
        </template>
      </MobileDialog>

      <!-- 角色字段权限弹窗 -->
      <MobileDialog
        v-model="roleFieldPermissionDialogVisible"
        :title="`${selectedRoleForFieldPermission?.name || ''} - 字段权限配置`"
        width="1200px"
        dialog-class="permissions-dialog role-field-permission-dialog"
        :show-default-footer="false"
      >
        <div class="dialog-body">
          <div class="module-selection-area">
            <div class="section-title">
              <i class="fas fa-cube"></i>
              页面模块
              <span class="module-count">共 {{ roleFieldModuleList.length }} 个模块</span>
            </div>
            <div class="module-grid" v-loading="loadingRoleFieldModules">
              <div
                v-for="module in roleFieldModuleList"
                :key="module.module_key"
                :class="['module-item-grid', { active: selectedRoleModule?.module_key === module.module_key }]"
                @click="selectRoleModuleForField(module)"
                :title="module.name"
              >
                <div class="module-icon">
                  <i :class="module.icon"></i>
                </div>
                <div class="module-name">{{ module.name }}</div>
              </div>
            </div>
          </div>

          <div v-if="selectedRoleModule" class="field-layout-area">
            <div class="field-group-nav">
              <div class="section-title section-title--compact">
                <i class="fas fa-sitemap"></i>
                子页面 / 分组
              </div>
              <div v-if="loadingRoleFieldGroups" class="group-nav-loading" v-loading="loadingRoleFieldGroups"></div>
              <div v-else-if="roleFieldGroups.length > 0" class="group-nav-list">
                <button
                  v-for="group in roleFieldGroups"
                  :key="group.name"
                  type="button"
                  :class="['group-nav-item', { active: selectedRoleFieldGroupName === group.name }]"
                  @click="selectRoleFieldGroup(group.name)"
                >
                  <div class="group-nav-main">
                    <span class="group-nav-name">{{ group.name }}</span>
                    <span class="group-nav-count">{{ group.fields.length }}项</span>
                  </div>
                  <div class="group-nav-meta">
                    <span :class="['sensitivity-badge', group.sensitivity]">
                      {{ getSensitivityLabel(group.sensitivity) }}
                    </span>
                    <span class="group-nav-hidden">已隐藏 {{ getRoleGroupHiddenCount(group) }}</span>
                  </div>
                </button>
              </div>
              <div v-else class="no-fields no-fields--inline">
                <i class="fas fa-exclamation-triangle"></i>
                <p>该模块暂未配置字段定义</p>
              </div>
            </div>

            <div class="field-config-area">
              <div class="field-config-toolbar">
                <div class="field-config-heading">
                  <div class="field-config-heading__main">
                    <h3 class="field-config-title">{{ selectedRoleModule.name }}</h3>
                  </div>
                </div>

                <div class="field-actions">
                  <el-button size="small" type="warning" plain @click="toggleRoleModuleFields(selectedRoleModule)" v-if="roleFieldGroups.length > 0">
                    <i class="fas fa-eye-slash"></i>
                    {{ getRoleModuleSelectionStatus(selectedRoleModule) ? '显示全部' : '隐藏全部' }}
                  </el-button>
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    v-if="currentRoleFieldGroup"
                    @click="toggleRoleGroupFields(currentRoleFieldGroup)"
                  >
                    <i class="fas fa-sliders-h"></i>
                    {{ getRoleGroupSelectionStatus(currentRoleFieldGroup) ? '显示分组' : '隐藏分组' }}
                  </el-button>
                </div>
              </div>

              <div class="field-config-panel" v-if="loadingRoleFieldGroups" v-loading="loadingRoleFieldGroups" style="min-height: 240px;"></div>
              <div v-else-if="currentRoleFieldGroup" class="field-config-panel">
                <div class="field-panel-summary">
                  <div class="field-panel-summary__title">
                    {{ currentRoleFieldGroup.name }}
                    <span class="group-count">({{ currentRoleFieldGroup.fields.length }}个字段)</span>
                  </div>
                </div>

                <div class="field-switch-list">
                  <div
                    v-for="field in currentRoleFieldGroup.fields"
                    :key="field.id"
                    :class="[
                      'field-switch-item',
                      {
                        'field-sensitive': isFieldSensitive(field),
                        'field-hidden': selectedRoleFieldSet.has(field.id)
                      }
                    ]"
                  >
                    <div class="field-switch-content">
                      <div class="field-switch-header">
                        <div class="field-switch-title">
                          <strong>{{ field.name }}</strong>
                          <div class="field-badges">
                            <span :class="['field-type', field.type]">
                              {{ getFieldTypeLabel(field.type) }}
                            </span>
                            <span v-if="field.required" class="field-required">必填</span>
                            <span :class="['field-sensitivity', field.sensitivity]">
                              {{ getSensitivityLabel(field.sensitivity) }}
                            </span>
                          </div>
                        </div>
                        <div class="field-switch-action">
                          <span :class="['field-visibility-text', !selectedRoleFieldSet.has(field.id) ? 'visible' : 'hidden']">
                            {{ selectedRoleFieldSet.has(field.id) ? '已隐藏' : '已显示' }}
                          </span>
                          <el-switch
                            :model-value="!selectedRoleFieldSet.has(field.id)"
                            inline-prompt
                            active-text="开"
                            inactive-text="关"
                            @change="setRoleFieldVisibility(field.id, $event)"
                          />
                        </div>
                      </div>
                      <div class="field-description">
                        {{ field.description || '未配置字段说明' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="no-module-selected">
                <i class="fas fa-hand-pointer"></i>
                <p>请选择左侧子页面后再配置字段权限</p>
              </div>
            </div>
          </div>

          <div v-else class="no-module-selected">
            <i class="fas fa-hand-pointer"></i>
            <p>请选择左侧母页面后再配置字段权限</p>
          </div>
        </div>

        <template #footer>
          <div class="dialog-footer">
            <div class="selection-summary" v-if="selectedRoleModule">
              <span>已选择 {{ selectedRoleFields.length }} 个字段隐藏</span>
            </div>
            <div class="footer-actions">
              <el-button type="info" @click="closeRoleFieldPermissionDialog">
                取消
              </el-button>
              <el-button
                type="primary"
                @click="saveRoleFieldPermissions"
                :disabled="savingRoleFieldPermissions || !selectedRoleModule"
              >
                <i v-if="savingRoleFieldPermissions" class="fas fa-spinner fa-spin"></i>
                {{ savingRoleFieldPermissions ? '保存中...' : '保存配置' }}
              </el-button>
            </div>
          </div>
        </template>
      </MobileDialog>
    </Teleport>

    <!-- 门店绑定对话框 -->
    <Teleport to="body">
      <MobileDialog
        v-model="storeBindingDialogVisible"
        title="绑定门店（支持多选）"
        width="600px"
        dialog-class="permissions-dialog"
        :show-default-footer="false"
      >
        <div class="modal-body">
          <div class="user-info-summary">
            <p><strong>用户：</strong>{{ currentUserForBinding?.username }} ({{ currentUserForBinding?.name || '-' }})</p>
            <p><strong>已绑定门店：</strong>
              <span v-if="currentUserForBinding?.stores && currentUserForBinding.stores.length > 0">
                <span v-for="(store, index) in currentUserForBinding.stores" :key="store.store_id" class="store-badge-small">
                  {{ store.store_name }}{{ store.is_primary ? ' (主)' : '' }}
                </span>
              </span>
              <span v-else class="text-muted">未绑定</span>
            </p>
          </div>
          <form @submit.prevent="saveStoreBinding">
            <div class="form-group">
              <label>选择门店（可多选）<span class="required">*</span></label>
              <div class="store-selection">
                <div v-for="store in storeList" :key="store.id" class="store-checkbox">
                  <label>
                    <input
                      v-model="selectedStoreIds"
                      type="checkbox"
                      :value="store.id"
                    />
                    <span>{{ store.name }}</span>
                    <span v-if="isPrimaryStore(store.id)" class="primary-badge">主</span>
                  </label>
                </div>
              </div>
              <p class="help-text">提示：选中的第一个门店将自动设置为主门店</p>
            </div>
          </form>
        </div>

        <template #footer>
          <div class="modal-footer">
            <el-button type="info" @click="closeStoreBindingDialog">取消</el-button>
            <el-button
              type="primary"
              @click="saveStoreBinding"
              :disabled="savingStoreBinding || selectedStoreIds.length === 0"
            >
              <i v-if="savingStoreBinding" class="fas fa-spinner fa-spin"></i>
              {{ savingStoreBinding ? '保存中...' : '保存绑定' }}
            </el-button>
          </div>
        </template>
      </MobileDialog>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, onActivated, nextTick, provide } from 'vue'
import { User, Shop, Grid, Document, Avatar, Lock } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useRouter } from 'vue-router'
import { useNotification } from '@/composables/useNotification'
import { useLoadingState } from '@/composables'
import { useImportExport } from '@/composables/useImportExport'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useAuthStore } from '@/stores/auth'
import { useMenuStore } from '@/stores/menu'
import { useDynamicPermissions } from '@/services/permissions'
import { getModuleFields, getModuleFieldGroups } from '@/config/moduleFields.js'
import { PermissionDenied, PageHeader } from '@/components/base'
import { permissionsPageContextKey } from './page/context'
import { getActionMeta, getPermissionMeta, getRoleVisualMeta } from './page/permissionMeta'
import RolesPage from './page/RolesPage.vue'
import UserRolesPage from './page/UserRolesPage.vue'
import StoreBindingsPage from './page/StoreBindingsPage.vue'
import ModulesPage from './page/ModulesPage.vue'
import LogsPage from './page/LogsPage.vue'
import RolePermissionsPage from './page/RolePermissionsPage.vue'
import SharedSearchPanel from './page/SharedSearchPanel.vue'
import type { PermissionLog } from '@/types/system'
import { logger } from '@/utils/logger'

// 角色类型别名 - 兼容原有代码
type Role = {
  id: number
  name: string
  code?: string | null
  description?: string
  role_type?: string | null
  status?: 'active' | 'inactive' | string | number
  is_active?: boolean | string
  user_count?: number
  permissions?: Array<{
    module_key: string
    permission_type: string
    module_category: string
  }>
  created_at: string
  updated_at: string
}

// 用户类型别名 - 基于集中化的 User 类型扩展
type User = {
  id: number
  username: string
  name?: string
  full_name?: string
  role_id?: number
  status: number
  last_login?: string
  roles?: Role[]
}

interface Module {
  key: string
  module_key?: string
  name: string
  icon: string
  category?: string
  selected?: boolean
  has_permission?: boolean
  permissions: Array<{
    type: string
    permission_type?: string
    granted: boolean
    assigned?: boolean
    selected?: boolean
    has_permission?: boolean
  }>
}

// 权限检查
const { canView, canCreate, canEdit, canDelete } = usePagePermissions('permissions')

// 状态变量
const { loading } = useLoadingState()
const { exportTextFile, buildDateFilename } = useImportExport()
const activeTab = ref('roles')
const router = useRouter()
const permissionsPageContext = reactive<Record<string, any>>({})
provide(permissionsPageContextKey, permissionsPageContext)

// 使用统一通知服务
const { success, error, warning, info, handleApiError, confirm } = useNotification()

// 角色相关状态
const rolesLoading = ref(false)
const rolesData = ref<Role[]>([])
const rolesPagination = reactive({
  page: 1,
  size: 10,
  total: 0
})
const roleSearchForm = reactive({
  name: ''
})
const roleSearchExpanded = ref(false)

// 用户相关状态
const usersLoading = ref(false)
const usersData = ref<User[]>([])
const usersPagination = reactive({
  page: 1,
  size: 10,
  total: 0
})
const userSearchForm = reactive({
  username: '',
  roleId: ''
})
const userSearchExpanded = ref(false)

// 权限相关状态
const selectedRoleId = ref('')
const permissionMatrix = ref<Module[]>([])
const selectedPermissions = ref<string[]>([])
const selectedMenuPermissions = ref<{ module_key: string; menu_visible: boolean | number }[]>([])
const savingPermissions = ref(false)

// 对话框状态
const roleDialogVisible = ref(false)
const isEditRole = ref(false)
const savingRole = ref(false)

const userRoleDialogVisible = ref(false)
const currentUser = ref<User | null>(null)

const selectedUserRoleIds = ref<number[]>([])
const savingUserRoles = ref(false)

// 门店绑定相关状态
const storeBindingsLoading = ref(false)
const storeBindingsData = ref<any[]>([])
const storeList = ref<any[]>([])
const storeBindingDialogVisible = ref(false)
const currentUserForBinding = ref<any>(null)
const selectedStoreIds = ref<number[]>([])  // 选中的门店ID数组
const savingStoreBinding = ref(false)
const storeBindingSearchForm = reactive({
  userName: '',
  storeId: '',
  hasStore: ''
})
const storeBindingSearchExpanded = ref(false)
const storeBindingsPagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 页面权限配置状态
const selectedRoleForPermission = ref<Role | null>(null)
const permissionDialogMatrix = ref<Module[]>([])
const selectedDialogPermissions = ref<string[]>([])
const selectedDialogMenuPermissions = ref<{ module_key: string; menu_visible: boolean | number }[]>([])
const savingDialogPermissions = ref(false)
const loadingPermissionDialog = ref(false)

// 角色字段权限弹窗状态
const roleFieldPermissionDialogVisible = ref(false)
const selectedRoleForFieldPermission = ref<Role | null>(null)
const roleFieldModuleList = ref<any[]>([])
const selectedRoleModule = ref<any>(null)
const roleFieldGroups = ref<any[]>([])
const selectedRoleFields = ref<string[]>([])
const selectedRoleFieldGroupName = ref('')
const savingRoleFieldPermissions = ref(false)
const loadingRoleFieldModules = ref(false)
const loadingRoleFieldGroups = ref(false)
const expandedRoleFieldGroupNames = ref<string[]>([])

const roleFieldModuleListCache = ref<any[] | null>(null)
const fieldDefinitionsCache = new Map<string, any[]>()

// 角色搜索状态
const roleSearchQuery = ref('')

// 日志相关状态
const logsLoading = ref(false)
const exportingLogs = ref(false)
const logsData = ref<PermissionLog[]>([])
const logsPagination = reactive({
  page: 1,
  size: 10,
  total: 0
})
const logSearchForm = reactive({
  action: '',
  username: '',
  dateRange: ''
})
const logSearchExpanded = ref(false)

// 表单数据
const roleForm = reactive({
  id: null as number | null,
  name: '',
  code: '',
  description: '',
})

const ROLE_CODE_PATTERN = /^[A-Za-z0-9:_-]+$/

const permissionsFieldMap: Record<string, string> = {
  stats_total_roles: 'stats.total_roles',
  stats_total_users: 'stats.total_users',
  stats_system_roles: 'stats.system_roles',
  stats_business_roles: 'stats.business_roles',
  stats_total_modules: 'stats.total_modules',
  stats_unregistered_modules: 'stats.unregistered_modules',
  actions: 'system_info.operations'
}

const getPermissionsFieldKey = (fieldName: string) => permissionsFieldMap[fieldName] || fieldName
const canViewPermissionsField = (fieldName: string) => {
  return fieldPermissions.isFieldVisible('permissions_permissionsview', getPermissionsFieldKey(fieldName))
}

const showStatsCards = computed(() => (
  canViewPermissionsField('stats_total_roles') ||
  canViewPermissionsField('stats_total_users') ||
  canViewPermissionsField('stats_system_roles') ||
  canViewPermissionsField('stats_business_roles') ||
  canViewPermissionsField('stats_total_modules') ||
  canViewPermissionsField('stats_unregistered_modules')
))




// 统计数据
const stats = reactive({
  totalRoles: 0,
  totalUsers: 0,
  totalModules: 0,
  totalPermissions: 0,
  systemRoles: 0,
  businessRoles: 0,
  activeUsers: 0,
  usersWithRoles: 0,
  unregisteredModules: 0
})

type StatsPayload = Partial<Record<
  'total_roles' | 'total_users' | 'active_users' | 'system_roles' |
  'business_roles' | 'users_with_roles' | 'total_permissions' |
  'total_modules' | 'unregistered_modules',
  string | number
>>

const resetStatsState = () => {
  stats.totalRoles = 0
  stats.totalUsers = 0
  stats.activeUsers = 0
  stats.systemRoles = 0
  stats.businessRoles = 0
  stats.usersWithRoles = 0
  stats.totalPermissions = 0
  stats.totalModules = 0
  stats.unregisteredModules = 0
}

const applyStatsState = (payload: StatsPayload = {}) => {
  stats.totalRoles = parseInt(String(payload.total_roles ?? 0)) || 0
  stats.totalUsers = parseInt(String(payload.total_users ?? 0)) || 0
  stats.activeUsers = parseInt(String(payload.active_users ?? 0)) || 0
  stats.systemRoles = parseInt(String(payload.system_roles ?? 0)) || 0
  stats.businessRoles = parseInt(String(payload.business_roles ?? 0)) || 0
  stats.usersWithRoles = parseInt(String(payload.users_with_roles ?? 0)) || 0
  stats.totalPermissions = parseInt(String(payload.total_permissions ?? 0)) || 0
  stats.totalModules = parseInt(String(payload.total_modules ?? 0)) || 0
  stats.unregisteredModules = parseInt(String(payload.unregistered_modules ?? 0)) || 0
}

const buildPermissionEventDetail = (detail: Record<string, any>) => ({
  ...detail,
  timestamp: Date.now()
})

const emitPermissionUpdated = (detail: Record<string, any>) => {
  window.dispatchEvent(new CustomEvent('tf2025:permissions:updated', {
    detail: buildPermissionEventDetail(detail)
  }))
}

const syncPermissionSideEffects = async (roleId?: number | string | null) => {
  const normalizedRoleId = roleId == null ? undefined : Number(roleId)
  const menuStore = useMenuStore()
  await menuStore.refreshMenus()

  const authStore = useAuthStore()
  if (normalizedRoleId && (authStore.user as any)?.role_id === normalizedRoleId) {
    await authStore.fetchUserInfo()
  }

  emitPermissionUpdated({ roleId: normalizedRoleId })
}

const normalizeMenuPermissions = (
  items: Array<{ module_key?: string; key?: string; menu_visible?: boolean | number }>,
  visible?: boolean
) => items.map((item) => ({
  module_key: item.module_key || item.key || '',
  menu_visible: typeof visible === 'boolean'
    ? (visible ? 1 : 0)
    : (item.menu_visible === true || item.menu_visible === 1 ? 1 : 0)
}))

const normalizePermissionPayload = (permissions: string[]) => permissions.map((permission) => {
  const [module_key, permission_type] = permission.split(':')
  return { module_key, permission_type }
})

const parseRoles = (roles: string | Role[] | null) => {
  if (!roles) {
    return {
      names: [] as string[],
      ids: [] as number[]
    }
  }

  if (Array.isArray(roles)) {
    return {
      names: roles.map((role) => role.name).filter(Boolean),
      ids: roles.map((role) => role.id).filter((id) => id != null)
    }
  }

  const roleNames = roles
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean)

  return {
    names: roleNames,
    ids: roleNames
      .map((roleName) => rolesData.value.find((role) => role.name === roleName)?.id ?? null)
      .filter((id): id is number => id != null)
  }
}

const updatePaginationState = (
  pagination: { page: number; size: number },
  page: number,
  pageSize: number,
  loader?: () => void | Promise<void>
) => {
  pagination.page = page
  pagination.size = pageSize
  if (loader) {
    return loader()
  }
}

// 字段权限相关状态
const showFieldPermissionDialog = ref(false)
const selectedModule = ref<any>(null)
const fieldGroups = ref<any[]>([])
const selectedFields = ref<string[]>([])
const savingFieldPermissions = ref(false)

// 字段权限计算属性
const totalFieldCount = computed(() => {
  return fieldGroups.value.reduce((total, group) => total + group.fields.length, 0)
})

const selectedDialogPermissionSet = computed(() => new Set(selectedDialogPermissions.value))
const selectedDialogMenuPermissionMap = computed(() => {
  const map = new Map<string, boolean>()
  selectedDialogMenuPermissions.value.forEach((perm) => {
    map.set(perm.module_key, perm.menu_visible === true || perm.menu_visible === 1)
  })
  return map
})
const selectedRoleFieldSet = computed(() => new Set(selectedRoleFields.value))
const currentRoleFieldGroup = computed(() => {
  if (!roleFieldGroups.value || roleFieldGroups.value.length === 0) {
    return null
  }

  return roleFieldGroups.value.find(group => group.name === selectedRoleFieldGroupName.value) || roleFieldGroups.value[0]
})

const currentTabHeader = computed(() => {
  if (activeTab.value === 'userRoles') {
    return {
      icon: 'fas fa-users',
      title: '角色分配',
      description: '为现有用户分配和管理系统角色'
    }
  }

  if (activeTab.value === 'storeBindings') {
    return {
      icon: 'fas fa-store',
      title: '门店绑定',
      description: '管理员工与门店的关联关系，绑定后员工只能查看自己门店的数据'
    }
  }

  if (activeTab.value === 'modules') {
    return {
      icon: 'fas fa-cube',
      title: '模块管理',
      description: '自动扫描、同步和管理系统模块权限'
    }
  }

  if (activeTab.value === 'logs') {
    return {
      icon: 'fas fa-history',
      title: '权限日志',
      description: '查看所有权限相关的操作记录和审计信息'
    }
  }

  if (activeTab.value === 'pagePermissions') {
    return {
      icon: 'fas fa-lock',
      title: '页面权限',
      description: selectedRoleForPermission.value
        ? `正在配置角色“${selectedRoleForPermission.value.name}”的页面权限`
        : '请选择角色后再配置页面权限'
    }
  }

  return {
    icon: 'fas fa-user-tag',
    title: '角色管理',
    description: '创建、编辑和管理系统中的所有角色'
  }
})

// 计算属性
const filteredRoles = computed(() => {
  let filtered = rolesData.value

  if (roleSearchForm.name.trim() !== '') {
    const keyword = roleSearchForm.name.trim().toLowerCase()
    filtered = filtered.filter(role =>
      role.name.toLowerCase().includes(keyword) ||
      (role.code && role.code.toLowerCase().includes(keyword)) ||
      (role.description && role.description.toLowerCase().includes(keyword))
    )
  }

  return filtered
})

// 角色分配对话框中的角色搜索过滤
const filteredRolesForAssignment = computed(() => {
  let filtered = rolesData.value

  if (roleSearchQuery.value.trim()) {
    const query = roleSearchQuery.value.toLowerCase()
    filtered = filtered.filter(role =>
      role.name.toLowerCase().includes(query) ||
      (role.description && role.description.toLowerCase().includes(query))
    )
  }

  return filtered
})

const paginatedRoles = computed(() => {
  const start = (rolesPagination.page - 1) * rolesPagination.size
  const end = start + rolesPagination.size
  return filteredRoles.value.slice(start, end)
})

const filteredUsers = computed(() => {
  let filtered = usersData.value

  if (userSearchForm.username !== '') {
    filtered = filtered.filter(user =>
      user.username.toLowerCase().includes(userSearchForm.username.toLowerCase())
    )
  }

  if (userSearchForm.roleId !== '') {
    filtered = filtered.filter(user => {
      const roleIds = getUserRoleIds(user.roles)
      return roleIds.includes(parseInt(userSearchForm.roleId))
    })
  }

  return filtered
})

const paginatedUsers = computed(() => {
  const start = (usersPagination.page - 1) * usersPagination.size
  const end = start + usersPagination.size
  return filteredUsers.value.slice(start, end)
})


const filteredLogs = computed(() => {
  let filtered = logsData.value

  if (logSearchForm.action !== '') {
    filtered = filtered.filter(log =>
      log.action === logSearchForm.action
    )
  }

  if (logSearchForm.username !== '') {
    filtered = filtered.filter(log =>
      log.username.toLowerCase().includes(logSearchForm.username.toLowerCase())
    )
  }

  if (logSearchForm.dateRange !== '') {
    filtered = filtered.filter(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0]
      return logDate === logSearchForm.dateRange
    })
  }

  return filtered
})

const paginatedLogs = computed(() => {
  const start = (logsPagination.page - 1) * logsPagination.size
  const end = start + logsPagination.size
  return filteredLogs.value.slice(start, end)
})

// 模块管理相关方法
const goToModuleManagement = () => {
  activeTab.value = 'modules'
}


const goToRegisteredModules = () => {
  router.push('/permissions/module-management')
}

const goToRoleManagement = () => {
  router.push('/roles')
}

const scanModules = async () => {
  try {
    info('开始扫描模块...')
    const response = await unifiedApi.get('/modules/scan')

    // API拦截器已经返回了response.data，所以直接使用response
    if (response.success) {
      const data = response.data || response

      success(`扫描完成，发现 ${data.total || 0} 个模块`)
      await loadModuleStats()
    } else {
      error('扫描失败: ' + (response.message || '未知错误'))
    }
  } catch (err) {
    error('扫描模块失败')
  }
}

const syncAllModules = async () => {
  try {
    info('开始同步模块...')
    const response = await unifiedApi.post('/modules/sync-all')

    // API拦截器已经返回了response.data，所以直接使用response
    if (response.success) {
      const data = response.data || response

      success(`同步完成，成功 ${data.success || 0} 个，失败 ${data.errors || 0} 个`)
      await loadModuleStats()
      await loadRoles() // 刷新角色列表以获取最新权限
    } else {
      error('同步失败: ' + (response.message || '未知错误'))
    }
  } catch (err) {
    error('同步模块失败')
  }
}

const loadModuleStats = async () => {
  try {
    const response = await unifiedApi.get('/modules/stats/overview')

    // API拦截器已经返回了response.data，所以直接使用response
    if (response.success) {
      const data = response.data || response

      stats.totalModules = data.totalModules || 0
      stats.totalPermissions = data.totalPermissions || stats.totalPermissions
      stats.totalRoles = data.totalRoles || stats.totalRoles
      stats.activeUsers = data.activeUsers || stats.activeUsers
    }
  } catch (err) {
    // 加载模块统计失败，忽略
  }
}

const loadUnregisteredModules = async () => {
  try {
    const response = await unifiedApi.get('/modules/unregistered')

    // API拦截器已经返回了response.data，所以直接使用response
    if (response.success) {
      const data = response.data || response

      stats.unregisteredModules = data.total || 0
    } else {
      stats.unregisteredModules = 0
    }
  } catch (err) {
    stats.unregisteredModules = 0
  }
}

const exportRolePermissions = async (role: Role) => {
  try {
    const [permissionResponse, menuResponse] = await Promise.all([
      unifiedApi.get(`/permissions/roles/${role.id}/permissions`),
      unifiedApi.get(`/permissions/menu/${role.id}`)
    ])

    const modules = Array.isArray(permissionResponse.data) ? permissionResponse.data : []
    const menuPermissions = menuResponse.success
      ? (menuResponse.data?.menuPermissions || menuResponse.data || [])
      : []

    const exportPayload = {
      role: {
        id: role.id,
        name: role.name,
        code: role.code || '',
        description: role.description || '',
        status: role.status ?? '',
        created_at: role.created_at,
        updated_at: role.updated_at
      },
      permissions: modules.map((module: any) => ({
        module_key: module.module_key || module.key || '',
        module_name: module.module_name || module.name || '',
        permissions: Array.isArray(module.permissions)
          ? module.permissions
            .filter((permission: any) => (
              permission.assigned === true ||
              permission.selected === true ||
              permission.has_permission === true
            ))
            .map((permission: any) => permission.permission_type)
          : []
      })),
      menu_permissions: Array.isArray(menuPermissions) ? menuPermissions : [],
      export_time: new Date().toISOString()
    }

    await exportTextFile({
      content: JSON.stringify(exportPayload, null, 2),
      filename: `role_${role.name}_permissions.json`,
      mimeType: 'application/json;charset=utf-8;',
      successMessage: '权限导出成功',
      errorMessage: '导出权限失败'
    })
  } catch (err) {
    error('导出权限失败')
  }
}

// 方法
const loadStats = async () => {
  try {
    const response = await unifiedApi.get('/permissions/overview')
    if (response.success) {
      applyStatsState(response.data || response)
    } else {
      resetStatsState()
    }
  } catch (err) {
    resetStatsState()
  }
}

const loadRoles = async (showLoading = true, showSuccess = false) => {
  try {
    if (showLoading) {
      rolesLoading.value = true
    }

    // 构建查询参数
    const params = new URLSearchParams()
    if (roleSearchForm.name) {
      params.append('search', roleSearchForm.name)
    }
    params.append('page', rolesPagination.page.toString())
    params.append('limit', rolesPagination.size.toString())

    // 调用认证的API获取角色数据
    const response = await unifiedApi.get(`/permissions/roles?${params.toString()}`)

    if (response.success) {
      // 修复：response.data 包含 roles 和分页信息
      const responseData = response.data || {}
      rolesData.value = responseData.roles || []

      // 使用后端返回的分页信息
      if (responseData.total) {
        rolesPagination.total = parseInt(responseData.total)
      } else {
        // 回退到客户端分页
        rolesPagination.total = responseData.roles?.length || 0
      }

      // 静默刷新成功提示
      if (showSuccess) {
        const total = rolesData.value.length
        success('角色数据已刷新', {
          title: `加载了 ${total} 个角色`,
          duration: 2000
        })
      }
    } else {
      error(response.message || '加载角色列表失败')
      rolesData.value = []
      rolesPagination.total = 0
      rolesPagination.page = 1
    }
  } catch (err) {
    // 检查是否是认证错误
    if (err.response?.status === 401 || err.response?.status === 403) {
      error('认证失败，请重新登录')
      // 可以在这里添加跳转到登录页的逻辑
      // 例如: router.push('/login')
    } else {
      error('加载角色列表失败')
    }

    rolesData.value = []
    rolesPagination.total = 0
    rolesPagination.page = 1
  } finally {
    rolesLoading.value = false
  }
}

const loadUsers = async (showLoading = true, showSuccess = false) => {
  try {
    if (showLoading) {
      usersLoading.value = true
    }

    // 🔥 性能优化：使用新的优化端点，一次性获取用户及其角色信息
    const startTime = Date.now()

    const response = await unifiedApi.get('/permissions/users-with-roles', {
      params: {
        page: usersPagination.page,
        limit: usersPagination.size,
        search: userSearchForm.username || undefined,
        roleId: userSearchForm.roleId || undefined
      }
    })

    if (response.success) {
      // 修复：response.data 包含 users 和 pagination 信息
      const responseData = response.data || {}
      const users = responseData.users || []

      // 静默刷新成功提示
      if (showSuccess) {
        const loadTime = Date.now() - startTime
        success('用户数据已刷新', {
          title: `加载了 ${users.length} 个用户 (耗时 ${loadTime}ms)`,
          duration: 2000
        })
      }
      const pagination = responseData.pagination || {}

      // 使用后端返回的分页信息
      usersPagination.total = pagination.total || users.length
      usersPagination.page = pagination.page || 1

      const performance = (response.data as any)?.performance || {}

      if (users.length === 0) {
        usersData.value = []
        usersPagination.total = 0
        usersPagination.page = 1
        return
      }

      // 数据已经在后端处理完成，只需要预处理显示文本
      const processedUsers = users.map((user: any) => {
        // 预处理用户角色显示文本
        // 后端返回的 roles 是字符串，需要处理
        user.rolesText = user.roles ? user.roles : '无角色'
        user.hasRoles = !!user.roles && user.roles.trim() !== ''

        return user
      })

      usersData.value = processedUsers

      // 显示成功消息
      success(`成功加载 ${processedUsers.length} 个用户 (优化版)`)

    } else {
      error(response.message || '获取用户列表失败')
      usersData.value = []
      usersPagination.total = 0
      usersPagination.page = 1
    }
  } catch (err: any) {
    error('获取用户列表失败: ' + (err.message || err))
    usersData.value = []
    usersPagination.total = 0
    usersPagination.page = 1
  } finally {
    usersLoading.value = false
  }
}

// 获取权限图标
const getPermissionIcon = (type: string): string => getPermissionMeta(type).icon

// 获取权限名称（增强版）
const getPermissionNameEnhanced = (type: string): string => getPermissionMeta(type).name || type

const loadPermissionMatrix = async (showLoading = true, showSuccess = false) => {
  if (!selectedRoleId.value) return

  try {
    const [permissionResponse, menuResponse] = await Promise.all([
      unifiedApi.get(`/permissions/roles/${selectedRoleId.value}/permissions`),
      unifiedApi.get(`/permissions/menu/${selectedRoleId.value}`)
    ])

    if (permissionResponse.success) {
      const modules = permissionResponse.data || []
      const meta = (permissionResponse.data as any)?.meta || {}

      // 静默刷新时不显示提示
      if (showSuccess) {
        if (meta.fromDatabase === false) {
          info(`加载了 ${meta.totalModules || 0} 个扫描到的模块，建议先在"模块管理"中同步模块到数据库以获得完整功能`)
        } else {
          success(`成功加载 ${meta.totalModules || 0} 个模块的权限`)
        }
      }

      permissionMatrix.value = modules.map((module: Module) => ({
        ...module,
        // 确保module_key字段存在且正确
        module_key: module.module_key || module.key,
        permissions: module.permissions || [],
        icon: getDefaultIcon(module.module_key || module.key, module.category)
      }))

      // 设置已选中的功能权限 - 检查多种可能的字段
      const selected: string[] = []
      permissionMatrix.value.forEach(module => {
        module.permissions.forEach(permission => {
          // 检查权限是否被选中（后端可能返回不同的字段名）
          if (permission.assigned === true ||
              permission.selected === true ||
              permission.has_permission === true) {
            selected.push(`${module.module_key}:${permission.permission_type}`)
          }
        })
      })
      selectedPermissions.value = selected

      // 设置菜单权限
      if (menuResponse.success) {
        const menuPerms = menuResponse.data.menuPermissions || menuResponse.data || []
        // 确保数据格式正确
        selectedMenuPermissions.value = Array.isArray(menuPerms) ? menuPerms.map(perm => ({
          module_key: perm.module_key,
          menu_visible: perm.menu_visible === true || perm.menu_visible === 1
        })) : []
      }
    } else {
      error(permissionResponse.message || '加载权限矩阵失败')
      permissionMatrix.value = []
      selectedPermissions.value = []
      selectedMenuPermissions.value = []
    }
  } catch (err: any) {
    // 忽略请求被取消的错误
    if (err.name === 'CanceledError' || err.message === 'canceled') {
      return
    }

    const errorMessage = err.response?.data?.message || err.message || '加载权限矩阵失败'
    error(errorMessage)
    permissionMatrix.value = []
    selectedPermissions.value = []
    selectedMenuPermissions.value = []
  }
}

// 搜索区域展开/收起函数
const toggleRoleSearch = () => {
  roleSearchExpanded.value = !roleSearchExpanded.value
}

const toggleUserSearch = () => {
  userSearchExpanded.value = !userSearchExpanded.value
}

const toggleStoreBindingSearch = () => {
  storeBindingSearchExpanded.value = !storeBindingSearchExpanded.value
}

const toggleLogSearch = () => {
  logSearchExpanded.value = !logSearchExpanded.value
}

const searchRoles = () => {
  rolesPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const resetRoleSearch = () => {
  roleSearchForm.name = ''
  rolesPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const searchUsers = () => {
  usersPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const resetUserSearch = () => {
  userSearchForm.username = ''
  userSearchForm.roleId = ''
  usersPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const refreshCurrentPage = async () => {
  // 刷新当前标签页的数据

  const promises = []

  if (activeTab.value === 'roles') {
    promises.push(loadRoles(false, false))
  } else if (activeTab.value === 'userRoles') {
    promises.push(loadUsers(false, false))
  } else if (activeTab.value === 'storeBindings') {
    promises.push(loadStoreList())
    promises.push(loadStoreBindings())
  } else if (activeTab.value === 'logs') {
    promises.push(loadLogs())
  } else if (activeTab.value === 'pagePermissions' && selectedRoleForPermission.value) {
    promises.push(loadPermissionDialog())
  } else if (activeTab.value === 'modules' && selectedRoleId.value) {
    promises.push(loadPermissionMatrix(false, false))
  }

  // 总是刷新统计数据
  promises.push(loadStats())
  promises.push(loadUnregisteredModules())

  // 并行执行，提高刷新速度
  await Promise.all(promises)
}

// 统一的刷新处理函数
const handleRefresh = async () => {
  // 不使用 loading 状态，实现完全静默刷新
  try {
    // 静默刷新当前页面数据
    await refreshCurrentPage()

    // 显示简洁的成功提示
    success('数据已刷新', {
      duration: 1500,
      position: 'top-right'
    })
  } catch (err) {
    logger.error('刷新失败:', err)
    handleApiError(err, '刷新数据失败')
  }
}


// 🚀 优化：标签页点击处理（移除重复的数据加载）
const handleTabClick = async (tabName: string) => {
  if (activeTab.value === tabName) {
    return
  }

  if (activeTab.value === 'pagePermissions' && selectedRoleForPermission.value && tabName !== 'pagePermissions') {
    const saved = await closePermissionDialog(tabName)
    if (!saved) {
      return
    }
    return
  }

  activeTab.value = tabName
}

const handleCreateRole = () => {
  isEditRole.value = false
  roleForm.id = null
  roleForm.name = ''
  roleForm.code = ''
  roleForm.description = ''
  roleDialogVisible.value = true
}

const handleEditRole = (role: Role) => {
  isEditRole.value = true
  roleForm.id = role.id
  roleForm.name = role.name
  roleForm.code = role.code || ''
  roleForm.description = role.description || ''
  roleDialogVisible.value = true
}

const saveRole = async () => {
  // 自定义表单验证
  if (!roleForm.name.trim()) {
    error('请输入角色名称')
    return
  }

  if (!roleForm.description.trim()) {
    error('请输入角色描述')
    return
  }

  if (roleForm.code.trim() && !ROLE_CODE_PATTERN.test(roleForm.code.trim())) {
    error('角色编码只能包含字母、数字、下划线、中划线或冒号')
    return
  }

  try {
    savingRole.value = true

    // 构建角色数据
    const roleData = {
      name: roleForm.name.trim(),
      code: roleForm.code.trim() || null,
      description: roleForm.description.trim()
    }

    let response: any
    if (isEditRole.value && roleForm.id) {
      response = await unifiedApi.put(`/permissions/roles/${roleForm.id}`, roleData)
    } else {
      response = await unifiedApi.post('/permissions/roles', roleData)
    }

    if (response.success) {
      success(isEditRole.value ? '角色更新成功' : '角色创建成功')

      // 记录操作日志
      try {
        await unifiedApi.post('/permission-logs/log', {
          action: isEditRole.value ? 'edit' : 'create',
          targetType: 'role',
          targetId: response.data?.id || roleForm.id,
          targetName: roleForm.name,
          description: `${isEditRole.value ? '修改' : '创建'}角色: ${roleForm.name}`,
          details: {
            code: roleData.code
          }
        })
      } catch (logError) {
        // 静默处理
      }

      closeRoleDialog()
      // 重新加载角色和统计数据
      await loadRoles()
      await loadUsers() // 用户列表也需要刷新，因为可能影响用户的角色显示
      await loadStats()

      // 如果是新创建角色，显示新角色信息
      if (!isEditRole.value && response.data) {
        const newRole = response.data
        info(`新角色"${newRole.name}"(ID: ${newRole.id})已创建并保存到角色表`)
      }
    } else {
      error(response.message || (isEditRole.value ? '更新角色失败' : '创建角色失败'))
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || (isEditRole.value ? '更新角色失败' : '创建角色失败')
    error(errorMessage)
    logger.error(err)
  } finally {
    savingRole.value = false
  }
}

const closeRoleDialog = () => {
  roleDialogVisible.value = false
  // 重置表单数据
  roleForm.id = null
  roleForm.name = ''
  roleForm.code = ''
  roleForm.description = ''
}

const handleDeleteRole = async (role: Role) => {
  if (role.user_count && role.user_count > 0) {
    warning('该角色下还有用户，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除角色"${role.name}"吗？此操作不可撤销。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )

    const response = await unifiedApi.delete(`/permissions/roles/${role.id}`)
    if (response.success) {
      success('角色删除成功')
      // 重新加载角色和用户列表，因为删除角色可能影响用户的角色显示
      await loadRoles()
      await loadUsers()
      await loadStats()
    } else {
      error(response.message || '删除角色失败')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      const errorMessage = err.response?.data?.message || err.message || '删除角色失败'
      error(errorMessage)
      logger.error(err)
    }
  }
}

const toggleRoleStatus = async (role: Role) => {
  // 系统角色不能停用
  if (role.id === 1 || role.id === 9) {
    warning('系统角色不能停用')
    return
  }

  const isActive = role.is_active == '1' || role.is_active === true
  const action = isActive ? '停用' : '启用'

  // 确认对话框
  const title = isActive ? '停用角色' : '启用角色'
  const message = isActive
    ? `确定要停用"${role.name}"角色吗？停用后，该角色下的所有用户将无法登录系统，已登录的用户将被强制下线，所有相关权限将被立即撤销。请谨慎操作！`
    : `确定要启用"${role.name}"角色吗？启用后，拥有该角色的用户将可以登录系统，相关权限将立即生效。`
  const options = {
    confirmButtonText: isActive ? '确认停用' : '确认启用',
    cancelButtonText: '取消操作',
    type: isActive ? 'warning' : 'success'
  }

  const confirmed = await confirm(message, title, options)

  if (!confirmed) return

  try {
    const response = await unifiedApi.put(`/permissions/roles/${role.id}/status`, {
      is_active: isActive ? '0' : '1'
    })

    if (response.success) {
      const affectedUsers = response.data?.affected_users || 0
      if (isActive && affectedUsers > 0) {
        success(`"${role.name}"角色已成功停用，${affectedUsers}位用户的访问权限已更新`)
      } else if (isActive) {
        success(`"${role.name}"角色已成功停用`)
      } else {
        success(`"${role.name}"角色已成功启用，相关用户现在可以正常使用系统`)
      }

      // 立即重新加载所有相关数据以确保与数据库同步
      try {
        // 并行加载以提高性能
        await Promise.all([
          loadRoles(),
          loadUsers(),
          loadStats()
        ])
      } catch (loadError) {
        logger.error('数据同步失败:', loadError)
        // 即使同步失败，至少要更新角色列表
        await loadRoles()
      }
    } else {
      error(response.message || `${action}角色失败`)
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || `${action}角色失败`
    error(errorMessage)
    logger.error(err)
  }
}

const handleAssignPermissions = async (role: Role) => {
  selectedRoleForPermission.value = role
  permissionDialogMatrix.value = []
  selectedDialogPermissions.value = []
  selectedDialogMenuPermissions.value = []
  loadingPermissionDialog.value = true
  activeTab.value = 'pagePermissions'
  await nextTick()
  void loadPermissionDialog()
}

// 加载权限弹窗数据（优化版 - 移除大量 console.log）
const loadPermissionDialog = async () => {
  if (!selectedRoleForPermission.value) return

  try {
    loadingPermissionDialog.value = true
    const [permissionResponse, menuResponse] = await Promise.all([
      unifiedApi.get(`/permissions/roles/${selectedRoleForPermission.value.id}/permissions`),
      unifiedApi.get(`/permissions/menu/${selectedRoleForPermission.value.id}`)
    ])

    if (permissionResponse.success) {
      const modules = permissionResponse.data || []

      // 🚀 优化：统一处理数据结构，减少重复判断
      permissionDialogMatrix.value = modules.map((module: Module) => {
        const moduleKey = module.module_key || module.key
        return {
          ...module,
          module_key: moduleKey,
          key: moduleKey, // 统一字段名
          permissions: (module.permissions || []).map(p => ({
            ...p,
            permission_type: p.permission_type || p.type,
            type: p.permission_type || p.type // 统一字段名
          })),
          icon: getDefaultIcon(moduleKey, module.category)
        }
      })

      // 设置已选中的功能权限
      const selected: string[] = []
      permissionDialogMatrix.value.forEach(module => {
        const moduleKey = module.module_key // 使用统一字段
        module.permissions.forEach(permission => {
          if (permission.assigned === true ||
              permission.selected === true ||
              permission.has_permission === true) {
            selected.push(`${moduleKey}:${permission.permission_type}`)
          }
        })
      })
      selectedDialogPermissions.value = selected

      // 设置菜单权限
      if (menuResponse.success) {
        const menuPerms = menuResponse.data.menuPermissions || menuResponse.data || []
        selectedDialogMenuPermissions.value = Array.isArray(menuPerms) ? menuPerms.map(perm => ({
          module_key: perm.module_key,
          menu_visible: perm.menu_visible === true || perm.menu_visible === 1
        })) : []
      }
    }
  } catch (err: any) {
    logger.error('加载权限弹窗数据失败:', err)
    error('加载权限数据失败')
  } finally {
    loadingPermissionDialog.value = false
  }
}

// 页面权限页关闭时统一保存
const closePermissionDialog = async (nextTab = 'roles') => {
  loadingPermissionDialog.value = false
  selectedRoleForPermission.value = null
  permissionDialogMatrix.value = []
  selectedDialogPermissions.value = []
  selectedDialogMenuPermissions.value = []
  activeTab.value = nextTab

  return true
}

const persistDialogPermissions = async () => {
  const roleId = selectedRoleForPermission.value?.id
  if (!roleId) return

  await unifiedApi.put(`/permissions/roles/${roleId}/permissions`, {
    permissions: normalizePermissionPayload(selectedDialogPermissions.value)
  })

  await syncPermissionSideEffects(roleId)
}

const persistDialogMenuPermissions = async () => {
  const roleId = selectedRoleForPermission.value?.id
  if (!roleId) return

  await unifiedApi.put(`/permissions/menu/${roleId}`, {
    menuPermissions: normalizeMenuPermissions(selectedDialogMenuPermissions.value)
  })

  await syncPermissionSideEffects(roleId)
}

// 页面权限点击后立即生效
const handleDialogPermissionChange = async (moduleKey: string, permissionType: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const permissionKey = `${moduleKey}:${permissionType}`
  const previousPermissions = [...selectedDialogPermissions.value]

  if (target.checked) {
    if (!selectedDialogPermissions.value.includes(permissionKey)) {
      selectedDialogPermissions.value.push(permissionKey)
    }
  } else {
    const index = selectedDialogPermissions.value.indexOf(permissionKey)
    if (index > -1) {
      selectedDialogPermissions.value.splice(index, 1)
    }
  }

  try {
    savingDialogPermissions.value = true
    await persistDialogPermissions()
    success(`${getPermissionNameEnhanced(permissionType)}已${target.checked ? '开启' : '关闭'}`)
  } catch (err: any) {
    selectedDialogPermissions.value = previousPermissions
    const errorMessage = err.response?.data?.message || err.message || '更新页面动作权限失败'
    error(errorMessage)
    logger.error('更新页面动作权限失败:', err)
  } finally {
    savingDialogPermissions.value = false
  }
}

// 菜单显示点击后立即生效
const handleDialogMenuPermissionChange = async (moduleKey: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const previousMenuPermissions = selectedDialogMenuPermissions.value.map((perm) => ({ ...perm }))

  const existingIndex = selectedDialogMenuPermissions.value.findIndex(perm => perm.module_key === moduleKey)

  if (existingIndex > -1) {
    selectedDialogMenuPermissions.value[existingIndex].menu_visible = target.checked ? 1 : 0
  } else {
    selectedDialogMenuPermissions.value.push({
      module_key: moduleKey,
      menu_visible: target.checked ? 1 : 0
    })
  }

  try {
    savingDialogPermissions.value = true
    await persistDialogMenuPermissions()
    success(`菜单显示已${target.checked ? '开启' : '关闭'}`)
  } catch (err: any) {
    selectedDialogMenuPermissions.value = previousMenuPermissions
    const errorMessage = err.response?.data?.message || err.message || '更新菜单显示失败'
    error(errorMessage)
    logger.error('更新菜单显示失败:', err)
  } finally {
    savingDialogPermissions.value = false
  }
}

// 保存权限到后端的统一函数（关闭弹窗时调用）
const savePermissionsToBackend = async () => {
  const roleId = selectedRoleForPermission.value?.id
  if (!roleId) return

  try {
    await Promise.all([
      unifiedApi.put(`/permissions/roles/${roleId}/permissions`, {
        permissions: normalizePermissionPayload(selectedDialogPermissions.value)
      }),
      unifiedApi.put(`/permissions/menu/${roleId}`, {
        menuPermissions: normalizeMenuPermissions(selectedDialogMenuPermissions.value)
      })
    ])

    await syncPermissionSideEffects(roleId)
  } catch (err: any) {
    logger.error('保存权限失败:', err)
    error('权限保存失败，请稍后重试')
    throw err
  }
}

// 弹窗中的权限检查函数
const isDialogPermissionSelected = (moduleKey: string, permissionType: string): boolean => {
  const permissionKey = `${moduleKey}:${permissionType}`
  return selectedDialogPermissionSet.value.has(permissionKey)
}

const isDialogMenuPermissionSelected = (moduleKey: string): boolean => {
  return selectedDialogMenuPermissionMap.value.get(moduleKey) === true
}

// 刷新用户权限缓存
const refreshUserPermissions = async () => {
  try {
    // 1. 触发全局权限变更事件，通知所有页面权限已变更
    import('@/events/permissionEvents').then(({ default: permissionEventBus }) => {
      permissionEventBus.emitPermissionChange('permission_page')
    })

    // 2. 使用新的强制刷新方法
    const dynamicService = useDynamicPermissions().service()
    await dynamicService.forceRefreshAll()

    // 3. 清除字段权限指令缓存
    const { clearFieldPermissionCache } = await import('@/directives/permission')
    clearFieldPermissionCache()

    // 4. 强制刷新auth store的用户信息和权限
    const authStore = useAuthStore()
    await authStore.fetchUserInfo()

    // 5. 刷新菜单数据
    const menuStore = useMenuStore()
    await menuStore.refreshMenus()

    // 6. 通知所有权限监听器
    const { refreshPermissions } = useDynamicPermissions()
    await refreshPermissions()

    // 7. 显示成功提示，并建议刷新页面以确保所有功能生效
    success('权限已更新，请刷新页面查看所有功能变化', { duration: 3000 })

    // 8. 延迟1.5秒后提示用户刷新页面
    setTimeout(() => {
      if (confirm('权限已更新成功！是否立即刷新页面以应用所有更改？')) {
        window.location.reload()
      }
    }, 1500)

  } catch (err) {
    logger.error('❌ 刷新用户权限失败:', err)
    error('权限同步失败，请刷新页面重试')
  }
}

// 角色字段权限处理函数
const handleRoleFieldPermissions = async (role: Role) => {
  selectedRoleForFieldPermission.value = role
  roleFieldPermissionDialogVisible.value = true
  roleFieldModuleList.value = []
  selectedRoleModule.value = null
  roleFieldGroups.value = []
  selectedRoleFields.value = []
  selectedRoleFieldGroupName.value = ''
  expandedRoleFieldGroupNames.value = []
  await nextTick()
  void loadRoleFieldModules()
}

// 加载角色字段权限的模块列表
const loadRoleFieldModules = async () => {
  if (!selectedRoleForFieldPermission.value) return

  try {
    loadingRoleFieldModules.value = true

    if (roleFieldModuleListCache.value) {
      roleFieldModuleList.value = roleFieldModuleListCache.value
      return
    }

    // 获取所有有字段映射的模块
    const response = await unifiedApi.get('/permissions/module-mappings')

    if (response.success) {
      const modules = response.data || []

      roleFieldModuleList.value = modules.map((module: any) => ({
        ...module,
        name: module.name,
        icon: module.icon || getDefaultIcon(module.key, module.category)
      }))
      roleFieldModuleListCache.value = roleFieldModuleList.value
    }
  } catch (err: any) {
    logger.error('加载模块列表失败:', err)
    error('加载模块列表失败')
  } finally {
    loadingRoleFieldModules.value = false
  }
}

// 选择模块查看字段权限
const selectRoleModuleForField = async (module: any) => {
  selectedRoleModule.value = module
  expandedRoleFieldGroupNames.value = []
  selectedRoleFieldGroupName.value = ''

  try {
    loadingRoleFieldGroups.value = true

    // 使用与权限分配页面相同的字段定义获取方法
    roleFieldGroups.value = await getFieldDefinitionsForModule(module.module_key || module.key)
    selectedRoleFieldGroupName.value = roleFieldGroups.value[0]?.name || ''
    autoExpandAllRoleFieldGroups()

    // 加载该角色的字段权限配置
    const moduleKey = module.module_key || module.key
    await loadRoleFieldPermissions(moduleKey)
  } catch (err: any) {
    logger.error('加载字段权限失败:', err)
    error('加载字段权限失败')
    selectedRoleFieldGroupName.value = ''
    expandedRoleFieldGroupNames.value = []
  } finally {
    loadingRoleFieldGroups.value = false
  }
}

// 加载角色的字段权限配置
const loadRoleFieldPermissions = async (moduleKey: string) => {
  if (!selectedRoleForFieldPermission.value) return

  try {
    // 重置选中字段
    selectedRoleFields.value = []

    // 获取该角色的字段权限
    const response = await unifiedApi.get(`/permissions/field-permissions/${selectedRoleForFieldPermission.value.id}`, {
      params: { moduleKey }
    })

    if (response.success && response.data) {
      // 处理可能为空的对象
      const fieldPermissions = response.data.fieldPermissions || {}

      if (fieldPermissions[moduleKey] && fieldPermissions[moduleKey].fieldConfig) {
        const fieldConfig = fieldPermissions[moduleKey].fieldConfig
        const hiddenFields = fieldConfig.hiddenFields || []
        selectedRoleFields.value = hiddenFields
      } else {
        selectedRoleFields.value = []
      }
    } else {
      selectedRoleFields.value = []
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '加载字段权限配置失败'
    selectedRoleFields.value = []

    if (err.response?.status === 404 && errorMessage.includes('角色不存在')) {
      warning('当前角色已不存在，已关闭字段权限弹窗并刷新角色列表')
      closeRoleFieldPermissionDialog()
      await loadRoles(false)
      return
    }

    error(errorMessage)
  }
}

// 保存角色字段权限
const saveRoleFieldPermissions = async () => {
  if (!selectedRoleForFieldPermission.value || !selectedRoleModule.value) return

  try {
    savingRoleFieldPermissions.value = true

    const moduleKey = selectedRoleModule.value.module_key || selectedRoleModule.value.key
    const allFields = getModuleFields(moduleKey)
    const allFieldIds = allFields.map(field => field.id)

    const hiddenFields = selectedRoleFields.value
    const visibleFields = allFieldIds.filter(fieldId => !hiddenFields.includes(fieldId))

    const fieldConfig = {
      hiddenFields: hiddenFields
    }

    const response = await unifiedApi.put(`/permissions/field-permissions/${selectedRoleForFieldPermission.value.id}`, {
      moduleKey,
      fieldConfig
    })

    if (response.success) {
      success('字段权限配置保存成功')
      // 刷新全局字段权限（等待完成以确保权限数据已更新）
      await fieldPermissions.fetchUserFieldPermissions()

      // 同步更新本地显示状态：重新加载当前角色的字段权限配置
      await loadRoleFieldPermissions(moduleKey)
    } else {
      throw new Error(response.message || '保存失败')
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '保存字段权限配置失败'
    error(errorMessage)
    logger.error('保存字段权限配置失败:', err)
  } finally {
    savingRoleFieldPermissions.value = false
  }
}

// 关闭角色字段权限弹窗
const closeRoleFieldPermissionDialog = () => {
  roleFieldPermissionDialogVisible.value = false
  selectedRoleForFieldPermission.value = null
  selectedRoleModule.value = null
  roleFieldGroups.value = []
  selectedRoleFields.value = []
  selectedRoleFieldGroupName.value = ''
  expandedRoleFieldGroupNames.value = []
}

// 切换字段选择状态
const toggleRoleField = (fieldId: string) => {
  const index = selectedRoleFields.value.indexOf(fieldId)
  if (index > -1) {
    selectedRoleFields.value.splice(index, 1)
  } else {
    selectedRoleFields.value.push(fieldId)
  }
}

const setRoleFieldVisibility = (fieldId: string, visible: boolean | string | number) => {
  const shouldShow = visible === true

  if (shouldShow) {
    selectedRoleFields.value = selectedRoleFields.value.filter(id => id !== fieldId)
    return
  }

  if (!selectedRoleFields.value.includes(fieldId)) {
    selectedRoleFields.value.push(fieldId)
  }
}

const selectRoleFieldGroup = (groupName: string) => {
  selectedRoleFieldGroupName.value = groupName
}

const isRoleFieldGroupExpanded = (group: any) => {
  return !!group?.name && expandedRoleFieldGroupNames.value.includes(group.name)
}

const autoExpandAllRoleFieldGroups = () => {
  expandedRoleFieldGroupNames.value = roleFieldGroups.value
    .map(group => group?.name)
    .filter((name): name is string => !!name)
}

const toggleRoleFieldGroupExpand = (group: any) => {
  if (!group?.name) return
  if (expandedRoleFieldGroupNames.value.includes(group.name)) {
    expandedRoleFieldGroupNames.value = expandedRoleFieldGroupNames.value.filter(name => name !== group.name)
    return
  }

  expandedRoleFieldGroupNames.value = [...expandedRoleFieldGroupNames.value, group.name]
}

const getRoleGroupHiddenCount = (group: any) => {
  if (!group?.fields || !Array.isArray(group.fields)) {
    return 0
  }

  return group.fields.filter((field: any) => selectedRoleFieldSet.value.has(field.id)).length
}

// 全选/取消全选字段（分组级别）
const toggleRoleGroupFields = (group: any) => {
  if (!group || !group.fields || !Array.isArray(group.fields)) {
    return
  }
  const groupFieldIds = group.fields.map((field: any) => field.id)
  const allSelected = groupFieldIds.every(id => selectedRoleFieldSet.value.has(id))

  if (allSelected) {
    // 取消全选
    selectedRoleFields.value = selectedRoleFields.value.filter(id => !groupFieldIds.includes(id))
  } else {
    // 全选
    groupFieldIds.forEach(id => {
      if (!selectedRoleFields.value.includes(id)) {
        selectedRoleFields.value.push(id)
      }
    })
  }
}

// 全选/取消全选字段（模块级别）
const toggleRoleModuleFields = (module: any) => {
  if (!roleFieldGroups.value || roleFieldGroups.value.length === 0) {
    return
  }

  // 收集模块所有字段的ID
  const allFieldIds: string[] = []
  roleFieldGroups.value.forEach(group => {
    if (group.fields && Array.isArray(group.fields)) {
      allFieldIds.push(...group.fields.map((field: any) => field.id))
    }
  })

  if (allFieldIds.length === 0) return

  const allSelected = allFieldIds.every(id => selectedRoleFields.value.includes(id))

  if (allSelected) {
    // 取消全选
    selectedRoleFields.value = []
  } else {
    // 全选
    allFieldIds.forEach(id => {
      if (!selectedRoleFields.value.includes(id)) {
        selectedRoleFields.value.push(id)
      }
    })
  }
}

// 获取字段选择状态
const getRoleGroupSelectionStatus = (group: any) => {
  if (!group || !group.fields || !Array.isArray(group.fields)) {
    return false
  }
  const groupFieldIds = group.fields.map((field: any) => field.id)
  if (groupFieldIds.length === 0) return false

  const selectedCount = groupFieldIds.filter(id => selectedRoleFieldSet.value.has(id)).length
  return selectedCount === groupFieldIds.length
}

// 获取模块所有字段的选择状态
const getRoleModuleSelectionStatus = (module: any) => {
  if (!roleFieldGroups.value || roleFieldGroups.value.length === 0) {
    return false
  }

  // 收集模块所有字段的ID
  const allFieldIds: string[] = []
  roleFieldGroups.value.forEach(group => {
    if (group.fields && Array.isArray(group.fields)) {
      allFieldIds.push(...group.fields.map((field: any) => field.id))
    }
  })

  if (allFieldIds.length === 0) return false

  const selectedCount = allFieldIds.filter(id => selectedRoleFields.value.includes(id)).length
  return selectedCount === allFieldIds.length
}

// 弹窗中的快速操作函数
const selectAllDialogPermissions = async (select = true) => {
  if (!permissionDialogMatrix.value.length || savingDialogPermissions.value) return
  const previousPermissions = [...selectedDialogPermissions.value]

  try {
    savingDialogPermissions.value = true

    if (select) {
      const permissionKeys = new Set<string>()
      permissionDialogMatrix.value.forEach(module => {
        module.permissions.forEach(permission => {
          const permissionType = permission.permission_type || permission.type
          permissionKeys.add(`${module.module_key || module.key}:${permissionType}`)
        })
      })
      selectedDialogPermissions.value = Array.from(permissionKeys)
    } else {
      selectedDialogPermissions.value = []
    }

    await persistDialogPermissions()
    success(select ? '已开启全部页面动作权限' : '已清空全部页面动作权限')
  } catch (err: any) {
    selectedDialogPermissions.value = previousPermissions
    const errorMessage = err.response?.data?.message || err.message || '批量更新页面动作权限失败'
    error(errorMessage)
    logger.error('批量更新页面动作权限失败:', err)
  } finally {
    savingDialogPermissions.value = false
  }
}

const toggleAllDialogMenuPermissions = async (show = true) => {
  if (!permissionDialogMatrix.value.length || savingDialogPermissions.value) return
  const previousMenuPermissions = selectedDialogMenuPermissions.value.map((perm) => ({ ...perm }))

  try {
    savingDialogPermissions.value = true
    selectedDialogMenuPermissions.value = permissionDialogMatrix.value.map(module => ({
      module_key: module.module_key || module.key,
      menu_visible: show
    }))
    await persistDialogMenuPermissions()
    success(show ? '已开启全部菜单显示' : '已隐藏全部菜单显示')
  } catch (err: any) {
    selectedDialogMenuPermissions.value = previousMenuPermissions
    const errorMessage = err.response?.data?.message || err.message || '批量更新菜单显示失败'
    error(errorMessage)
    logger.error('批量更新菜单显示失败:', err)
  } finally {
    savingDialogPermissions.value = false
  }
}

const getUserRoleNames = (roles: string | Role[] | null) => parseRoles(roles).names
const getUserRoleIds = (roles: string | Role[] | null) => parseRoles(roles).ids
const getRoleTagClass = (roleName: string) => getRoleVisualMeta(roleName).tagClass
const getRoleCardBadgeClass = (roleName: string) => getRoleVisualMeta(roleName).cardBadgeClass

const handleEditUserRoles = (user: User) => {
  currentUser.value = user
  selectedUserRoleIds.value = getUserRoleIds(user.roles)
  roleSearchQuery.value = ''
  userRoleDialogVisible.value = true
}

const saveUserRoles = async () => {
  if (!currentUser.value) return

  try {
    savingUserRoles.value = true

    const response = await unifiedApi.put(`/permissions/users/${currentUser.value.id}/roles`, {
      roleIds: selectedUserRoleIds.value
    })

    if (response.success) {
      success('用户角色分配成功')

      // 记录操作日志
      try {
        await unifiedApi.post('/permission-logs/log', {
          action: 'assign',
          targetType: 'user',
          targetId: currentUser.value.id,
          targetName: currentUser.value.username,
          description: `为用户 ${currentUser.value.username} 分配了 ${selectedUserRoleIds.value.length} 个角色`,
          details: {
            role_ids: selectedUserRoleIds.value
          }
        })
      } catch (logError) {
        // 静默处理
      }

      closeUserRoleDialog()
      await loadUsers()
    } else {
      error(response.message || '分配用户角色失败')
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '分配用户角色失败'
    error(errorMessage)
    logger.error(err)
  } finally {
    savingUserRoles.value = false
  }
}


const handleDeleteUser = async (user: User) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${user.username}" 吗？此操作不可撤销。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )

    const response = await unifiedApi.delete(`/users/${user.id}`)

    if (response.success) {
      success('用户删除成功')
      await loadUsers()
      await loadStats()
    } else {
      error(response.message || '删除用户失败')
    }
  } catch (err: any) {
    if (err !== 'cancel') {
      const errorMessage = err.response?.data?.message || err.message || '删除用户失败'
      error(errorMessage)
      logger.error(err)
    }
  }
}


const closeUserRoleDialog = () => {
  userRoleDialogVisible.value = false
  currentUser.value = null
  selectedUserRoleIds.value = []
  roleSearchQuery.value = ''
}

const removeRoleFromSelection = (roleId: number) => {
  const index = selectedUserRoleIds.value.indexOf(roleId)
  if (index > -1) {
    selectedUserRoleIds.value.splice(index, 1)
  }
}

const isRoleSelectedForAssignment = (roleId: number) => {
  return selectedUserRoleIds.value.includes(roleId)
}

const getRoleNameById = (roleId: number) => {
  const role = rolesData.value.find(r => r.id === roleId)
  return role ? role.name : '未知角色'
}

const refreshLogs = async () => {
  await loadLogs()
}

const escapeCsvValue = (value: unknown) => {
  const normalized = value === null || value === undefined ? '' : String(value)
  const escaped = normalized.replace(/"/g, '""')
  return `"${escaped}"`
}

const buildCsvContent = (headers: string[], rows: Array<Array<unknown>>) => {
  const headerLine = headers.map((item) => escapeCsvValue(item)).join(',')
  const rowLines = rows.map((row) => row.map((item) => escapeCsvValue(item)).join(','))
  return [headerLine, ...rowLines].join('\n')
}

const exportLogs = async () => {
  try {
    exportingLogs.value = true

    const exportSize = Math.max(logsPagination.total || 0, logsPagination.size || 10, 1000)
    const response = await unifiedApi.get('/permission-logs/logs', {
      params: {
        page: 1,
        size: exportSize,
        action: logSearchForm.action || undefined,
        username: logSearchForm.username || undefined
      }
    })

    if (!response.success) {
      throw new Error(response.message || '获取权限日志失败')
    }

    let exportLogsList: PermissionLog[] = response.data?.logs || []

    if (logSearchForm.dateRange !== '') {
      exportLogsList = exportLogsList.filter((log) => {
        const logDate = new Date(log.created_at).toISOString().split('T')[0]
        return logDate === logSearchForm.dateRange
      })
    }

    if (exportLogsList.length === 0) {
      warning('当前筛选条件下没有可导出的日志')
      return
    }

    const csvContent = buildCsvContent(
      ['ID', '用户名', '操作类型', '操作说明', 'IP地址', '状态', '创建时间'],
      exportLogsList.map((log) => ([
        log.id,
        log.username,
        getActionName(log.action),
        log.description,
        log.ip_address,
        log.status === 'success' ? '成功' : '失败',
        log.created_at
      ]))
    )

    await exportTextFile({
      content: csvContent,
      filename: buildDateFilename('权限操作日志', 'csv'),
      mimeType: 'text/csv;charset=utf-8;',
      bom: '\uFEFF',
      loading: exportingLogs,
      successMessage: '权限日志导出成功',
      errorMessage: '权限日志导出失败'
    })
  } catch (err) {
    handleApiError(err, '权限日志导出失败')
  } finally {
    exportingLogs.value = false
  }
}

const searchLogs = () => {
  logsPagination.page = 1
  // 客户端搜索，不需要重新加载
}

// 角色分页变化处理
const handleRolesPaginationChange = (page: number, pageSize: number) =>
  updatePaginationState(rolesPagination, page, pageSize, () => loadRoles(false, false))

// 用户分页变化处理
const handleUsersPaginationChange = (page: number, pageSize: number) =>
  updatePaginationState(usersPagination, page, pageSize, () => loadUsers(false, false))

// 日志分页变化处理
const handleLogsPaginationChange = (page: number, pageSize: number) =>
  updatePaginationState(logsPagination, page, pageSize)

const resetLogSearch = () => {
  logSearchForm.action = ''
  logSearchForm.username = ''
  logSearchForm.dateRange = ''
  logsPagination.page = 1
  // 客户端搜索，不需要重新加载
}

const loadLogs = async () => {
  try {
    logsLoading.value = true

    // 从真实 API 获取日志数据
    const response = await unifiedApi.get('/permission-logs/logs', {
      params: {
        page: logsPagination.page,
        size: logsPagination.size,
        action: logSearchForm.action || undefined,
        username: logSearchForm.username || undefined
      }
    })

    if (response.success && response.data) {
      logsData.value = response.data.logs || []
      logsPagination.total = Number(response.data.pagination?.total) || 0
    } else {
      logsData.value = []
      logsPagination.total = 0
    }
  } catch (err) {
    error('加载日志数据失败')
    logger.error('加载权限日志失败:', err)
    logsData.value = []
    logsPagination.total = 0
    logsPagination.page = 1
  } finally {
    logsLoading.value = false
  }
}

const getActionTypeClass = (action: string) => getActionMeta(action).className
const getActionIcon = (action: string) => getActionMeta(action).icon
const getActionName = (action: string) => getActionMeta(action).name

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return ''

  try {
    // 创建日期对象
    const date = new Date(dateString)

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '无效日期'
    }

    // 转换为中国时区时间
    const chinaTime = new Date(date.getTime() + (8 * 60 * 60 * 1000) + (date.getTimezoneOffset() * 60 * 1000))

    // 格式化日期时间
    const year = chinaTime.getFullYear()
    const month = String(chinaTime.getMonth() + 1).padStart(2, '0')
    const day = String(chinaTime.getDate()).padStart(2, '0')
    const hours = String(chinaTime.getHours()).padStart(2, '0')
    const minutes = String(chinaTime.getMinutes()).padStart(2, '0')
    const seconds = String(chinaTime.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (err) {
    logger.error('日期格式化错误:', err, dateString)
    return '格式错误'
  }
}

// 菜单权限检查函数
const isMenuPermissionSelected = (moduleKey: string): boolean => {
  return selectedMenuPermissions.value.some(perm =>
    perm.module_key === moduleKey &&
    perm.menu_visible === true
  )
}

// 菜单权限变化处理函数
const handleMenuPermissionChange = async (moduleKey: string, event: Event) => {
  if (!selectedRoleId.value) return
  const target = event.target as HTMLInputElement

  const originalMenuPermissions = JSON.parse(JSON.stringify(selectedMenuPermissions.value))

  try {
    const existingIndex = selectedMenuPermissions.value.findIndex(perm => perm.module_key === moduleKey)

    if (existingIndex > -1) {
      selectedMenuPermissions.value[existingIndex].menu_visible = target.checked
    } else {
      selectedMenuPermissions.value.push({
        module_key: moduleKey,
        menu_visible: target.checked
      })
    }

    const menuPermissions = normalizeMenuPermissions(selectedMenuPermissions.value)
    const response = await unifiedApi.put(`/permissions/menu/${selectedRoleId.value}`, {
      menuPermissions
    }, { showError: false })

    if (response.success) {
      const action = target.checked ? '显示' : '隐藏'
      success(`菜单${action}权限更新成功`)
      await syncPermissionSideEffects(selectedRoleId.value)
    } else {
      error(response.message || '更新菜单权限失败')
      selectedMenuPermissions.value = originalMenuPermissions
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '更新菜单权限失败'
    error(errorMessage)
    selectedMenuPermissions.value = originalMenuPermissions
    logger.error(err)
  }
}

const handlePermissionChange = async (moduleKey: string, permissionType: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const permissionKey = `${moduleKey}:${permissionType}`

  try {
    // 更新本地状态
    if (target.checked) {
      if (!selectedPermissions.value.includes(permissionKey)) {
        selectedPermissions.value.push(permissionKey)
      }
    } else {
      const index = selectedPermissions.value.indexOf(permissionKey)
      if (index > -1) {
        selectedPermissions.value.splice(index, 1)
      }
    }

    // 立即同步到后端
    const response = await unifiedApi.put(`/permissions/roles/${selectedRoleId.value}/permissions`, {
      permissions: selectedPermissions.value.map(perm => {
        const [moduleKey, permissionType] = perm.split(':')
        return { module_key: moduleKey, permission_type: permissionType }
      })
    })

    if (response.success) {
      // 重新加载权限矩阵以保持同步
      await loadPermissionMatrix()
      const action = target.checked ? '启用' : '禁用'
      const permissionName = getPermissionName(permissionType)
      success(`${action}${permissionName}权限成功`)
    } else {
      // 如果保存失败，重新加载原始状态
      await loadPermissionMatrix()
      error(response.message || '权限更新失败')
    }
  } catch (err: any) {
    // 如果发生错误，重新加载原始状态
    await loadPermissionMatrix()
    const errorMessage = err.response?.data?.message || err.message || '权限更新失败'
    error(errorMessage)
    logger.error(err)
  }
}

const getPermissionName = (type: string) => getPermissionMeta(type).name || type

const getDefaultIcon = (moduleKey: string, category?: string): string => {
  // 根据模块key或类别返回默认图标
  if (moduleKey.includes('dashboard')) return 'fas fa-tachometer-alt'
  if (moduleKey.includes('inventory') || moduleKey.includes('stock')) return 'fas fa-warehouse'
  if (moduleKey.includes('sales') || moduleKey.includes('phone')) return 'fas fa-shopping-cart'
  if (moduleKey.includes('customer')) return 'fas fa-users'
  if (moduleKey.includes('supplier')) return 'fas fa-truck'
  if (moduleKey.includes('employee')) return 'fas fa-user-tie'
  if (moduleKey.includes('permission') || moduleKey.includes('role')) return 'fas fa-shield-alt'
  if (moduleKey.includes('menu')) return 'fas fa-bars'
  if (moduleKey.includes('brand') || moduleKey.includes('model')) return 'fas fa-tag'
  if (moduleKey.includes('color')) return 'fas fa-palette'
  if (moduleKey.includes('memory')) return 'fas fa-memory'
  if (moduleKey.includes('store')) return 'fas fa-store'
  if (moduleKey.includes('rental')) return 'fas fa-handshake'
  if (moduleKey.includes('repair')) return 'fas fa-tools'
  if (moduleKey.includes('analytics')) return 'fas fa-chart-bar'
  if (moduleKey.includes('query') || moduleKey.includes('search')) return 'fas fa-search'
  if (moduleKey.includes('accessories')) return 'fas fa-box-open'
  if (moduleKey.includes('demo')) return 'fas fa-flask'

  // 根据类别返回图标
  if (category === 'system') return 'fas fa-cogs'
  if (category === 'business') return 'fas fa-briefcase'
  if (category === 'custom') return 'fas fa-cube'

  // 默认图标
  return 'fas fa-cube'
}

// 菜单权限批量操作函数
const selectAllMenuPermissions = async () => {
  if (!selectedRoleId.value || permissionMatrix.value.length === 0) return

  try {
    info('正在全选所有菜单显示权限...')

    const menuPermissions = normalizeMenuPermissions(permissionMatrix.value, true)

    const response = await unifiedApi.put(`/permissions/menu/${selectedRoleId.value}`, {
      menuPermissions
    }, { showError: false })

    if (response.success) {
      selectedMenuPermissions.value = permissionMatrix.value.map(module => ({
        module_key: module.module_key,
        menu_visible: true
      }))

      await loadPermissionMatrix()
      await syncPermissionSideEffects(selectedRoleId.value)
      success('所有菜单显示权限已开启')
    } else {
      error(response.message || '设置菜单权限失败')
      await loadPermissionMatrix()
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '设置菜单权限失败'
    error(errorMessage)
    await loadPermissionMatrix()
    logger.error('❌ 保存菜单权限失败:', err)
  }
}

const clearAllMenuPermissions = async () => {
  if (!selectedRoleId.value || permissionMatrix.value.length === 0) return

  try {
    info('正在隐藏所有菜单显示权限...')

    const menuPermissions = normalizeMenuPermissions(permissionMatrix.value, false)
    const response = await unifiedApi.put(`/permissions/menu/${selectedRoleId.value}`, {
      menuPermissions
    }, { showError: false })

    if (response.success) {
      selectedMenuPermissions.value = permissionMatrix.value.map(module => ({
        module_key: module.module_key,
        menu_visible: false
      }))

      await loadPermissionMatrix()
      await syncPermissionSideEffects(selectedRoleId.value)
      success('所有菜单显示权限已隐藏')
    } else {
      error(response.message || '设置菜单权限失败')
      await loadPermissionMatrix()
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '设置菜单权限失败'
    error(errorMessage)
    await loadPermissionMatrix()
    logger.error(err)
  }
}

// 字段权限相关方法
const openFieldPermissionDialog = async (module: any) => {
  try {
    selectedModule.value = module
    showFieldPermissionDialog.value = true

    // 加载字段定义数据
    fieldGroups.value = await getFieldDefinitionsForModule(module.module_key)

    // 加载当前角色的字段权限配置
    await loadFieldPermissions(module.module_key)

      } catch (err) {
    logger.error('打开字段权限配置失败:', err)
    error('打开字段权限配置失败')
  }
}

const closeFieldPermissionDialog = () => {
  showFieldPermissionDialog.value = false
  selectedModule.value = null
  fieldGroups.value = []
  selectedFields.value = []
}

const saveFieldPermissions = async () => {
  if (!selectedModule.value || !selectedRoleId.value) {
    error('缺少必要信息')
    return
  }

  try {
    savingFieldPermissions.value = true

    // 标准化 module key - 与加载逻辑保持一致
    let normalizedModuleKey = selectedModule.value.module_key

    // 去掉视图后缀（如 subsidy_subsidyview -> subsidy）
    // 但保留 query_queryview 这种格式
    if (normalizedModuleKey.includes('_') && !normalizedModuleKey.endsWith('view')) {
      const parts = normalizedModuleKey.split('_')
      if (parts.length >= 2) {
        normalizedModuleKey = parts.slice(0, -1).join('_')
      }
    } else if (normalizedModuleKey.endsWith('_view') || normalizedModuleKey.endsWith('View')) {
      normalizedModuleKey = normalizedModuleKey.replace(/_view$/, '').replace(/View$/, '')
    }

    // 获取当前模块的所有可用字段
    const allFields = getModuleFields(normalizedModuleKey)
    const allFieldIds = allFields.map(field => field.id)

    // 计算隐藏的字段（被选中的字段）
    const hiddenFields = selectedFields.value

    // 计算显示的字段（未被选中的字段）
    const visibleFields = allFieldIds.filter(fieldId => !hiddenFields.includes(fieldId))

    // 构建字段权限配置数据 - 直接使用完整的字段 ID（与综合查询一致）
    const fieldConfig = {
      hiddenFields: hiddenFields     // 被选中的字段将被隐藏
    }

    // 调用真实的API，使用标准化的 module key
    const response = await unifiedApi.post(`/permissions/field-permissions/${selectedRoleId.value}`, {
      moduleKey: normalizedModuleKey,
      fieldConfig: fieldConfig
    })

    if (response.success) {
      success('字段权限配置保存成功')

      // 1. 同步更新本地显示状态：重新加载当前角色的字段权限配置
      if (selectedModule.value) {
        await loadRoleFieldPermissions(normalizedModuleKey)
      }

      // 2. 清除前端 API 缓存
      if (window.__TF2025_CACHE__) {
        window.__TF2025_CACHE__.clear()
      }

      // 3. 刷新全局字段权限（等待完成以确保权限数据已更新）
      await fieldPermissions.fetchUserFieldPermissions()

      // 4. 触发自定义事件，通知其他组件刷新
      window.dispatchEvent(new CustomEvent('tf2025:permissions:updated', {
        detail: {
          moduleKey: normalizedModuleKey,
          roleId: selectedRoleId.value,
          fieldConfig: fieldConfig
        }
      }))

      closeFieldPermissionDialog()

    } else {
      throw new Error(response.message || '保存失败')
    }

  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.message || '保存字段权限配置失败'
    error(errorMessage)
    logger.error('❌ 保存字段权限配置失败:', err)
    logger.error('  错误详情:', err.response?.data)
  } finally {
    savingFieldPermissions.value = false
  }
}

const loadFieldPermissions = async (moduleKey: string) => {
  try {
    // 调用真实的API获取字段权限配置
    // 先尝试使用原始 module_key
    let response = await unifiedApi.get(`/permissions/field-permissions/${selectedRoleId.value}`, {
      params: { moduleKey: moduleKey }
    })

    // 如果原始 key 没有配置，尝试标准化后的 key
    if (!response.success || !response.data?.fieldPermissions?.[moduleKey]) {
      let normalizedModuleKey = moduleKey

      // 标准化：去掉视图后缀（如 subsidy_subsidyview -> subsidy）
      // 但保留 query_queryview 这种格式
      if (moduleKey.includes('_') && !moduleKey.endsWith('view')) {
        const parts = moduleKey.split('_')
        if (parts.length >= 2) {
          normalizedModuleKey = parts.slice(0, -1).join('_')
        }
      } else if (moduleKey.endsWith('_view') || moduleKey.endsWith('View')) {
        // 如果以 _view 结尾，去掉这个后缀
        normalizedModuleKey = moduleKey.replace(/_view$/, '').replace(/View$/, '')
      }

      if (normalizedModuleKey !== moduleKey) {
        response = await unifiedApi.get(`/permissions/field-permissions/${selectedRoleId.value}`, {
          params: { moduleKey: normalizedModuleKey }
        })
      }
    }

    if (response.success) {
      // unifiedApi 已解包一层，直接从 response 取 data
      const responseData = extractResponseData<any>(response)
      const fieldPermissions = responseData?.fieldPermissions || {}

      // 尝试匹配原始 key 或标准化后的 key
      const matchedKey = fieldPermissions[moduleKey] ? moduleKey : Object.keys(fieldPermissions).find(k => fieldPermissions[k])

      if (matchedKey && fieldPermissions[matchedKey]?.fieldConfig) {
        const fieldConfig = fieldPermissions[matchedKey].fieldConfig
        const hiddenFields = fieldConfig.hiddenFields || []

        // 标准化 moduleKey 用于获取字段定义
        // 去掉视图后缀（如 subsidy_subsidyview -> subsidy）
        let normalizedKeyForFields = moduleKey
        if (moduleKey.includes('_') && !moduleKey.endsWith('view')) {
          const parts = moduleKey.split('_')
          if (parts.length >= 2) {
            normalizedKeyForFields = parts.slice(0, -1).join('_')
          }
        } else if (moduleKey.endsWith('_view') || moduleKey.endsWith('View')) {
          normalizedKeyForFields = moduleKey.replace(/_view$/, '').replace(/View$/, '')
        }

        // 直接使用完整的字段 ID（与综合查询一致）
        // 过滤掉可能不存在的字段
        const allFields = getModuleFields(normalizedKeyForFields)
        const validHiddenFields = hiddenFields.filter(fieldId =>
          allFields.some(f => f.id === fieldId)
        )

        // 根据用户需求：被选中的字段是要隐藏的字段
        selectedFields.value = validHiddenFields
      } else {
        // 如果没有配置，默认显示所有字段（即隐藏字段列表为空）
        selectedFields.value = []
      }
    } else {
      // 如果没有权限配置，默认显示所有字段
      selectedFields.value = []
    }

  } catch (err) {
    logger.error('加载字段权限配置失败:', err)
    // 出错时默认显示所有字段
    selectedFields.value = []
  }
}

// 获取模块字段定义
const getFieldDefinitionsForModule = async (moduleKey: string) => {
  try {
    // 处理模块key映射 - 移除可能的前端视图后缀
    let normalizedModuleKey = moduleKey
    if (moduleKey.includes('_')) {
      // 如果包含下划线，可能是后端模块格式，提取基础模块名
      const parts = moduleKey.split('_')
      if (parts.length >= 2) {
        normalizedModuleKey = parts.slice(0, -1).join('_')
      }
    }

    const cachedFieldDefinitions = fieldDefinitionsCache.get(normalizedModuleKey)
    if (cachedFieldDefinitions) {
      return cachedFieldDefinitions
    }

    // 从moduleFields.js中获取字段定义
    const moduleFieldGroups = getModuleFieldGroups(normalizedModuleKey)

    if (!moduleFieldGroups || moduleFieldGroups.length === 0) {
      return []
    }

    // 转换字段格式以适配前端UI
    const formattedFieldGroups = moduleFieldGroups.map(group => ({
      name: group.name,
      fields: group.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        required: field.required || false,
        description: field.description || '',
        sensitivity: field.sensitivity,
        currency: field.currency || null,
        options: field.options || null
      }))
    }))
    fieldDefinitionsCache.set(normalizedModuleKey, formattedFieldGroups)
    return formattedFieldGroups
  } catch (err) {
    logger.error(`获取模块 ${moduleKey} 字段定义失败:`, err)
    return []
  }
}

// 辅助方法
const getSensitivityLabel = (sensitivity: string) => {
  const labels: Record<string, string> = {
    'public': '公开',
    'internal': '内部',
    'confidential': '机密'
  }
  return labels[sensitivity] || sensitivity
}

const getFieldTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'string': '文本',
    'number': '数字',
    'date': '日期',
    'enum': '枚举',
    'boolean': '布尔',
    'object': '对象',
    'percentage': '百分比'
  }
  return labels[type] || type
}

// 检查字段组的选择状态
const getGroupSelectionStatus = (group: any) => {
  if (!selectedFields.value || !group.fields) return false

  // 检查该组所有字段是否都被选中
  return group.fields.every((field: any) => {
    return selectedFields.value.includes(field.id)
  })
}

// 切换字段组的选择状态
const toggleGroupFields = (group: any) => {
  if (!group.fields) return

  const currentStatus = getGroupSelectionStatus(group)
  const newStatus = !currentStatus

  // 批量设置该组所有字段的状态
  group.fields.forEach((field: any) => {
    if (newStatus) {
      // 选中所有字段
      if (!selectedFields.value.includes(field.id)) {
        selectedFields.value.push(field.id)
      }
    } else {
      // 取消选中所有字段
      const index = selectedFields.value.indexOf(field.id)
      if (index > -1) {
        selectedFields.value.splice(index, 1)
      }
    }
  })
}

// 检查字段是否为敏感字段
const isFieldSensitive = (field: any) => {
  return field.sensitivity === 'sensitive' || field.sensitivity === 'confidential'
}

// 强制刷新权限矩阵
// ========== 门店绑定相关方法 ==========

// 加载门店列表
const loadStoreList = async () => {
  try {
    const response = await unifiedApi.get('/stores', { params: { all: true } })
    if (response.success) {
      storeList.value = response.data
    }
  } catch (err) {
    logger.error('加载门店列表失败:', err)
  }
}

// 加载员工门店绑定数据
const loadStoreBindings = async () => {
  storeBindingsLoading.value = true
  try {
    // 使用带角色信息的用户列表API（与角色分配使用相同的API）
    const response = await unifiedApi.get('/permissions/users-with-roles', {
      params: { limit: 1000 }  // 获取所有用户
    })

    if (response.success && response.data?.users) {
      // 为每个用户获取完整的门店关联信息
      const usersWithStores = await Promise.all(
        response.data.users.map(async (user: any) => {
          try {
            // 调用 user-stores API 获取用户的所有门店
            const storesResponse = await unifiedApi.get(`/user-stores/user/${user.id}`)
            // 将 full_name 映射为 name 字段以保持一致性
            return {
              ...user,
              name: user.full_name || user.name,
              stores: storesResponse.data || []
            }
          } catch (err) {
            logger.error(`获取用户 ${user.username} 门店信息失败:`, err)
            return {
              ...user,
              name: user.full_name || user.name,
              stores: []
            }
          }
        })
      )
      storeBindingsData.value = usersWithStores
      storeBindingsPagination.total = usersWithStores.length
    } else {
      storeBindingsData.value = []
      storeBindingsPagination.total = 0
    }
  } catch (err) {
    logger.error('加载员工门店绑定数据失败:', err)
    error('加载员工门店绑定数据失败')
    storeBindingsData.value = []
    storeBindingsPagination.total = 0
  } finally {
    storeBindingsLoading.value = false
  }
}

// 过滤后的门店绑定数据
const filteredStoreBindings = computed(() => {
  let filtered = [...storeBindingsData.value]

  // 按姓名筛选
  if (storeBindingSearchForm.userName) {
    const keyword = storeBindingSearchForm.userName.toLowerCase()
    filtered = filtered.filter((user: any) =>
      (user.name && user.name.toLowerCase().includes(keyword)) ||
      (user.username && user.username.toLowerCase().includes(keyword))
    )
  }

  // 按门店筛选（检查用户是否关联该门店）
  if (storeBindingSearchForm.storeId) {
    const storeId = parseInt(storeBindingSearchForm.storeId)
    filtered = filtered.filter((user: any) =>
      user.stores && user.stores.some((s: any) => s.store_id === storeId)
    )
  }

  // 按绑定状态筛选
  if (storeBindingSearchForm.hasStore === 'true') {
    filtered = filtered.filter((user: any) => user.stores && user.stores.length > 0)
  } else if (storeBindingSearchForm.hasStore === 'false') {
    filtered = filtered.filter((user: any) => !user.stores || user.stores.length === 0)
  }

  return filtered
})

// 分页后的门店绑定数据
const paginatedStoreBindings = computed(() => {
  const start = (storeBindingsPagination.page - 1) * storeBindingsPagination.size
  const end = start + storeBindingsPagination.size
  return filteredStoreBindings.value.slice(start, end)
})

// 获取门店名称
const getStoreName = (storeId: number) => {
  const store = storeList.value.find((s: any) => s.id === storeId)
  return store ? store.name : '未知门店'
}

// 判断是否为主门店
const isPrimaryStore = (storeId: number) => {
  return currentUserForBinding.value?.stores?.some((s: any) =>
    s.store_id === storeId && s.is_primary
  )
}

// 搜索门店绑定
const searchStoreBindings = () => {
  storeBindingsPagination.page = 1
}

// 重置门店绑定搜索
const resetStoreBindingSearch = () => {
  storeBindingSearchForm.userName = ''
  storeBindingSearchForm.storeId = ''
  storeBindingSearchForm.hasStore = ''
  storeBindingsPagination.page = 1
}

// 打开门店绑定对话框
const openStoreBindingDialog = (user: any) => {
  currentUserForBinding.value = { ...user }
  // 初始化已选中的门店ID
  selectedStoreIds.value = user.stores?.map((s: any) => s.store_id) || []
  storeBindingDialogVisible.value = true
}

// 关闭门店绑定对话框
const closeStoreBindingDialog = () => {
  storeBindingDialogVisible.value = false
  currentUserForBinding.value = null
  selectedStoreIds.value = []
}

// 保存门店绑定（支持多门店）
const saveStoreBinding = async () => {
  if (!currentUserForBinding.value || selectedStoreIds.value.length === 0) {
    error('请选择至少一个门店')
    return
  }

  savingStoreBinding.value = true
  try {
    // 先移除用户的所有门店关联
    await unifiedApi.delete(`/user-stores/user/${currentUserForBinding.value.id}/all`)

    // 批量关联新的门店
    await unifiedApi.post('/user-stores/assign', {
      userId: currentUserForBinding.value.id,
      storeIds: selectedStoreIds.value,
      isPrimary: true  // 第一个门店会被设为主门店
    })

    success('门店绑定成功')
    closeStoreBindingDialog()
    await loadStoreBindings()
  } catch (err) {
    logger.error('保存门店绑定失败:', err)
    error('保存门店绑定失败')
  } finally {
    savingStoreBinding.value = false
  }
}

// 解绑所有门店
const unbindStore = async (user: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要解绑用户 "${user.username}" 的所有门店吗？解绑后该用户将可以查看所有门店的数据。`,
      '解绑确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-purple'
      }
    )
  } catch {
    return
  }

  savingStoreBinding.value = true
  try {
    await unifiedApi.delete(`/user-stores/user/${user.id}/all`)

    success('门店解绑成功')
    await loadStoreBindings()
  } catch (err) {
    logger.error('解绑门店失败:', err)
    error('解绑门店失败')
  } finally {
    savingStoreBinding.value = false
  }
}

// 门店绑定分页处理
const handleStoreBindingsPaginationChange = (page: number, pageSize: number) =>
  updatePaginationState(storeBindingsPagination, page, pageSize)

Object.assign(permissionsPageContext, {
  activeTab,
  canCreate,
  canEdit,
  canDelete,
  stats,
  rolesLoading,
  rolesData,
  rolesPagination,
  roleSearchForm,
  roleSearchExpanded,
  filteredRoles,
  paginatedRoles,
  toggleRoleSearch,
  searchRoles,
  resetRoleSearch,
  handleCreateRole,
  handleEditRole,
  handleAssignPermissions,
  handleRoleFieldPermissions,
  handleDeleteRole,
  toggleRoleStatus,
  handleRolesPaginationChange,
  usersLoading,
  usersData,
  usersPagination,
  userSearchForm,
  userSearchExpanded,
  filteredUsers,
  paginatedUsers,
  toggleUserSearch,
  searchUsers,
  resetUserSearch,
  handleEditUserRoles,
  handleDeleteUser,
  handleUsersPaginationChange,
  storeBindingsLoading,
  storeBindingsPagination,
  storeBindingSearchForm,
  storeBindingSearchExpanded,
  filteredStoreBindings,
  paginatedStoreBindings,
  storeList,
  toggleStoreBindingSearch,
  searchStoreBindings,
  resetStoreBindingSearch,
  openStoreBindingDialog,
  unbindStore,
  handleStoreBindingsPaginationChange,
  logsLoading,
  logsPagination,
  logSearchForm,
  logSearchExpanded,
  filteredLogs,
  paginatedLogs,
  refreshLogs,
  exportLogs,
  toggleLogSearch,
  searchLogs,
  resetLogSearch,
  handleLogsPaginationChange,
  selectedRoleForPermission,
  permissionDialogMatrix,
  savingDialogPermissions,
  loadingPermissionDialog,
  loadPermissionDialog,
  closePermissionDialog,
  selectAllDialogPermissions,
  toggleAllDialogMenuPermissions,
  handleDialogPermissionChange,
  handleDialogMenuPermissionChange,
  isDialogPermissionSelected,
  isDialogMenuPermissionSelected,
  getPermissionIcon,
  getPermissionNameEnhanced,
  formatDate,
  getUserRoleNames,
  getRoleTagClass,
  getActionTypeClass,
  getActionIcon,
  getActionName
})

// 优化：监听标签页切换，按需加载数据
watch(activeTab, async (newTab) => {
  // 只在数据为空时加载（首次访问）
  if (newTab === 'roles' && rolesData.value.length === 0) {
    await loadRoles(false, false)
  }

  if (newTab === 'userRoles' && usersData.value.length === 0) {
    await loadUsers(false, false)
  }

  if (newTab === 'logs' && logsData.value.length === 0) {
    await loadLogs()
  }

  if (newTab === 'storeBindings' && storeList.value.length === 0) {
    await Promise.all([loadStoreList(), loadStoreBindings()])
  }

  if (newTab === 'modules' && permissionMatrix.value.length === 0 && selectedRoleId.value) {
    await loadPermissionMatrix()
  }

  if (
    newTab === 'pagePermissions' &&
    selectedRoleForPermission.value &&
    permissionDialogMatrix.value.length === 0 &&
    !loadingPermissionDialog.value
  ) {
    await loadPermissionDialog()
  }
})

// ========== 门店绑定相关方法结束 ==========

// 页面加载时获取数据（按需加载优化）
onMounted(async () => {
  await fieldPermissions.init()

  // 🚀 优化：加载基础统计数据 + 当前标签页的数据
  await Promise.all([
    loadStats(),
    loadUnregisteredModules()
  ])

  // 默认加载第一个标签页（角色管理）的数据
  await loadRoles(false, false)
})

// 监听角色选择变化
watch(selectedRoleId, async (newRoleId) => {
  if (newRoleId) {
    // 清除旧状态
    selectedPermissions.value = []
    selectedMenuPermissions.value = []
    permissionMatrix.value = []
    // 加载新角色的权限
    await loadPermissionMatrix()
  } else {
    // 清除所有状态
    selectedPermissions.value = []
    selectedMenuPermissions.value = []
    permissionMatrix.value = []
  }
})

// 页面激活时只在必要时重新加载数据
onActivated(() => {
  // 只在实际需要时才重新加载
  // 如果当前有选中的角色，且权限矩阵为空，才重新加载
  if (selectedRoleId.value && permissionMatrix.value.length === 0 && !loading.value) {
    loadPermissionMatrix()
  }

  if (
    activeTab.value === 'pagePermissions' &&
    selectedRoleForPermission.value &&
    permissionDialogMatrix.value.length === 0 &&
    !loadingPermissionDialog.value
  ) {
    loadPermissionDialog()
  }
})
</script>

<style>
/* ==================== 模态框样式 - 优化版 ==================== */

.form-help-text {
  display: block;
  margin-top: 6px;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 模态框主体 */
.modal-body {
  padding: 0;
  max-height: none;
  overflow: visible;
  background: transparent !important;
  color: #303133;
}

.modal-body .form-group {
  margin-bottom: 20px;
}

.modal-body .form-group:last-child {
  margin-bottom: 0;
}

.modal-body label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #374151;
  font-size: 14px;
}

.modal-body .required {
  color: #ef4444;
}

.modal-body .form-control {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: white;
  box-sizing: border-box;
}

.modal-body .form-control:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-body textarea.form-control {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
}

.modal-body select.form-control {
  cursor: pointer;
  padding-right: 40px;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 16px;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

.modal-footer {
  background: transparent !important;
  padding: 0;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.modal-footer .btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 80px;
  justify-content: center;
}

.modal-footer .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-footer .btn-secondary {
  background: #6b7280;
  color: white;
}

.modal-footer .btn-secondary:hover:not(:disabled) {
  background: #4b5563;
  transform: translateY(-1px);
}

.modal-footer .btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.modal-footer .btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
}

.permissions-view {
  padding: 24px;
  background: #f6f7f7;
  min-height: calc(100vh - 64px);
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-icon.roles {
  background: #f3e5f5;
  color: #9b59b6;
}

.stat-icon.users {
  background: #e3f2fd;
  color: #3498db;
}

.stat-icon.modules {
  background: #e8f5e8;
  color: #27ae60;
}

.stat-icon.permissions {
  background: #fff3e0;
  color: #f39c12;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
}

.stat-label {
  color: #7f8c8d;
  font-size: 14px;
}

/* 权限管理内容 */
.permissions-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 统一标签页样式 */
/* TAB导航样式 */
.tab-navigation {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e8ecef;
  overflow: hidden;
  flex-wrap: wrap;
}

.tab-navigation .el-button {
  flex: 0 1 auto;
  min-width: 120px;
  border-radius: 0;
  border: none;
  border-right: 1px solid #e8ecef;
  padding: 12px 20px;
}

.tab-navigation .el-button:last-child {
  border-right: none;
}

.tab-navigation .el-button--default {
  background: transparent;
  color: #6c757d;
}

.tab-navigation .el-button--default:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.tab-navigation .el-button--primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-color: #667eea;
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.tab-navigation .el-button--primary:hover {
  background: linear-gradient(135deg, #667eea, #764ba2);
  opacity: 0.9;
}

/* TAB内容样式 */
.tab-content {
  background: transparent;
}

.tab-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 标签页头部样式 */
.tab-pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 20px;
}

.tab-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.tab-info i {
  font-size: 32px;
  color: #3498db;
  padding: 12px;
  background: rgba(52, 152, 219, 0.1);
  border-radius: 12px;
}

.tab-info h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 20px;
  font-weight: 600;
}

.tab-info p {
  margin: 4px 0 0 0;
  color: #7f8c8d;
  font-size: 14px;
}

.tab-actions {
  display: flex;
  gap: 12px;
}

.tab-content {
  padding: 0 24px 24px 24px;
}

@media (max-width: 768px) {
  /* TAB导航响应式 */
  .tab-navigation {
    flex-wrap: wrap;
  }

  .tab-navigation .el-button {
    flex: 1 1 auto;
    min-width: 100px;
    padding: 12px 16px;
    font-size: 13px;
    border-right: none;
    border-bottom: 1px solid #e8ecef;
  }

  .tab-navigation .el-button:last-child {
    border-bottom: none;
  }
}

/* 表单组 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #5a6c7d;
}

.form-control {
  padding: 8px 12px;
  border: 1px solid #d1d9e6;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
  background: white;
}

.form-control:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

/* 表格区域 */
.table-section {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.record-count {
  font-size: 14px;
  color: #7f8c8d;
  font-weight: normal;
}

.table-responsive {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  font-size: 14px;
}

.role-id .id-badge,
.user-id .id-badge {
  background: #f3e5f5;
  color: #9b59b6;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.role-info .role-name,
.user-info .user-username {
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-description,
.user-name {
  color: #495057;
  font-size: 14px;
}

.user-count {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #495057;
  font-size: 14px;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  border: 2px solid;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-badge::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  transition: width 0.3s ease;
}

.status-badge:hover::before {
  width: 8px;
}

.status-badge.active {
  background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 50%, #a5d6a7 100%);
  color: #2e7d32;
  border-color: #66bb6a;
}

.status-badge.active::before {
  background-color: #4caf50;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.status-badge.active i {
  color: #4caf50;
  filter: drop-shadow(0 1px 2px rgba(76, 175, 80, 0.3));
}

.status-badge.inactive {
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 50%, #ef9a9a 100%);
  color: #c62828;
  border-color: #ef5350;
}

.status-badge.inactive::before {
  background-color: #f44336;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.status-badge.inactive i {
  color: #f44336;
  filter: drop-shadow(0 1px 2px rgba(244, 67, 54, 0.3));
}

.status-badge i {
  font-size: 10px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* 状态显示样式 */
.status-display {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  border: 2px solid;
  position: relative;
  overflow: hidden;
}

.status-display::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.status-display.active {
  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
  color: #0f5132;
  border-color: #28a745;
  box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
}

.status-display.active::before {
  background-color: #28a745;
}

.status-display.inactive {
  background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
  color: #721c24;
  border-color: #dc3545;
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
}

.status-display.inactive::before {
  background-color: #dc3545;
}

/* 操作按钮样式 */
.status-button {
  border: 2px solid;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 6px 16px;
  font-weight: 600;
  position: relative;
  overflow: hidden;
}

.status-button::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.2);
  transition: left 0.3s ease;
}

.status-button:hover::after {
  left: 100%;
}

.status-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.status-button.active {
  background: #ffc107;
  color: #856404;
  border-color: #ffc107;
}

.status-button.active:hover {
  background: #e0a800;
  border-color: #e0a800;
}

.status-button.inactive {
  background: #28a745;
  color: #fff;
  border-color: #28a745;
}

.status-button.inactive:hover {
  background: #218838;
  border-color: #218838;
}

.status-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.status-button:disabled:hover {
  background: #6c757d !important;
  border-color: #6c757d !important;
  transform: none !important;
  box-shadow: none !important;
}

.status-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status-button:active:not(:disabled) {
  transform: scale(0.95);
}

.status-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.status-button.active:hover:not(:disabled) {
  background: #c3e6cb;
  color: #155724;
}

.status-button.inactive:hover:not(:disabled) {
  background: #f5c6cb;
  color: #721c24;
}

.user-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-tag {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.role-tag.primary {
  background: #e3f2fd;
  color: #1976d2;
}

.role-tag.success {
  background: #e8f5e8;
  color: #2e7d32;
}

.role-tag.warning {
  background: #fff3cd;
  color: #f57c00;
}

.role-tag.danger {
  background: #f8d7da;
  color: #c62828;
}

.role-tag.info {
  background: #e1f5fe;
  color: #0277bd;
}

.no-roles {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.last-login {
  font-size: 14px;
  color: #495057;
}

.never-login {
  color: #dc3545;
  font-style: italic;
}

.create-time {
  font-size: 14px;
  color: #495057;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-action {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-edit {
  background: #e3f2fd;
  color: #3498db;
}

.btn-edit:hover {
  background: #3498db;
  color: white;
}

.btn-permission {
  background: #f3e5f5;
  color: #9b59b6;
}

.btn-permission:hover {
  background: #9b59b6;
  color: white;
}

.btn-field-permission {
  background: #fff3e0;
  color: #ff9800;
}

.btn-field-permission:hover {
  background: #ff9800;
  color: white;
}

.btn-role {
  background: #e8f5e8;
  color: #27ae60;
}

.btn-role:hover {
  background: #27ae60;
  color: white;
}

.btn-delete {
  background: #f8d7da;
  color: #721c24;
}

.btn-delete:hover:not(:disabled) {
  background: #dc3545;
  color: white;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 按钮样式 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  text-decoration: none;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-outline-primary {
  background: white;
  color: #3498db;
  border: 1px solid #3498db;
}

.btn-outline-primary:hover {
  background: #3498db;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-outline-secondary {
  background: white;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-outline-secondary:hover {
  background: #6c757d;
  color: white;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 12px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

/* 分页 */
.pagination-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.pagination-info {
  font-size: 14px;
  color: #7f8c8d;
}

.pagination-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-pagination {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  color: #495057;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-pagination:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #3498db;
}

.btn-pagination:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  padding: 0 12px;
  font-size: 14px;
  color: #495057;
}

/* 菜单权限特殊样式 */
.menu-permission-item {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 2px dashed #6c757d;
  position: relative;
  margin-top: 16px;
  padding: 16px 12px;
}

.menu-permission-item::before {
  content: "菜单显示";
  position: absolute;
  top: -12px;
  left: 12px;
  background: #6c757d;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.menu-permission-item .permission-info strong {
  color: #495057;
}

.menu-permission-item:hover {
  background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 117, 125, 0.2);
}

.menu-checkbox .checkmark {
  background-color: #6c757d;
  border-color: #6c757d;
}

.menu-checkbox input:checked ~ .checkmark {
  background-color: #28a745;
  border-color: #28a745;
}

.menu-checkbox .permission-info {
  color: #495057;
}

.menu-checkbox .permission-info strong i {
  color: #28a745;
}

/* 权限矩阵 */
.role-selector {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.selector-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selector-actions .form-control {
  min-width: 200px;
}

.permission-matrix {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
}

.global-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.global-actions .btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.global-actions .btn-success {
  background: #27ae60;
  color: white;
  border: none;
}

.global-actions .btn-success:hover:not(:disabled) {
  background: #219a52;
}

.global-actions .btn-warning {
  background: #f39c12;
  color: white;
  border: none;
}

.global-actions .btn-warning:hover:not(:disabled) {
  background: #e67e22;
}

.matrix-content {
  margin-top: 20px;
}

.module-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.module-header h3 {
  margin: 0;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
}

.permissions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.permission-item {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 12px;
}

.permission-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.permission-checkbox:hover {
  background: #e9ecef;
}

.permission-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin-top: 2px;
}

.checkmark {
  display: none;
}

.permission-info {
  flex: 1;
}

.permission-info strong {
  display: block;
  color: #1a1a1a;
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 14px;
}

.permission-info small {
  color: #555555;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
}

.no-role-selected {
  text-align: center;
  padding: 60px 20px;
}

.empty-state {
  color: #7f8c8d;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.empty-state p {
  margin: 0;
}

/* 用户角色表单 */
.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 16px;
}

.user-info i {
  font-size: 24px;
  color: #3498db;
}

/* 响应式设计 */
@media (max-width: 767px) {
  .permissions-view {
    padding: 16px;
  }

  
  .btn-lg {
    padding: 12px 24px;
    font-size: 16px;
  }

  .stats-cards {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .tab-content {
    padding: 16px;
  }

  .pagination-section {
    flex-direction: column;
    gap: 16px;
  }

  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }

  .permissions-grid {
    grid-template-columns: 1fr;
  }
}

/* 日志相关样式 */
.log-id .id-badge {
  background: #e3f2fd;
  color: #1976d2;
}

.action-tag {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
}

.action-tag.primary {
  background: #e3f2fd;
  color: #1976d2;
}

.action-tag.success {
  background: #e8f5e8;
  color: #2e7d32;
}

.action-tag.warning {
  background: #fff3cd;
  color: #f57c00;
}

.action-tag.danger {
  background: #f8d7da;
  color: #c62828;
}

.action-tag.info {
  background: #e1f5fe;
  color: #0277bd;
}

.action-tag.secondary {
  background: #f5f5f5;
  color: #757575;
}

.ip-address {
  font-family: 'Courier New', monospace;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
  color: #495057;
}

.log-description {
  color: #495057;
  font-size: 14px;
  line-height: 1.4;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

/* 空状态和加载状态 */
.loading-row,
.empty-row {
  text-align: center;
  padding: 40px;
  color: #7f8c8d;
}

.loading-row i,
.empty-row i {
  font-size: 24px;
  margin-bottom: 8px;
  display: block;
}

.text-center {
  text-align: center;
}

/* 角色搜索区域 */
.role-search-section {
  margin-bottom: 20px;
}

/* 搜索输入框样式 */
.search-input-wrapper {
  position: relative;
  margin-bottom: 10px;
}

.search-input {
  padding-left: 40px !important;
  padding-right: 40px !important;
  border-radius: 8px !important;
  border: 2px solid #e9ecef !important;
  transition: border-color 0.3s ease !important;
}

.search-input:focus {
  border-color: #409eff !important;
  box-shadow: 0 0 0 0.2rem rgba(64, 158, 255, 0.25) !important;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #909399;
  z-index: 10;
}

.search-clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #909399;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  z-index: 10;
}

.search-clear-btn:hover {
  background-color: #f5f7fa;
  color: #606266;
}

.search-results-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.search-results-text {
  font-size: 14px;
  color: #909399;
  font-weight: 500;
}

/* 角色选择区域 */
.role-selection-section {
  margin-bottom: 20px;
}

.role-group {
  max-height: 300px;
  overflow-y: auto;
}

.role-checkbox-item {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #e8eaec;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.role-checkbox-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

/* Tab 样式优化 */
.nav-tabs .nav-link {
  border-radius: 6px 6px 0 0;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.nav-tabs .nav-link:hover {
  border-color: #e9ecef #e9ecef #dee2e6;
  background: #f8f9fa;
}

.nav-tabs .nav-link.active {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  border-color: #007bff;
  color: white;
}

/* 已选择角色预览区域增强 */
.selected-roles-preview {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border: 1px solid #dee2e6;
  position: relative;
}

.selected-role-tag {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;
  border: none;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
}

.selected-role-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

/* 响应式设计优化 */
.form-check {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.form-check-input {
  margin-top: 4px;
  flex-shrink: 0;
}

.user-count {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 已选择角色预览 */
.selected-roles-preview {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.selected-roles-preview h6 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 14px;
  font-weight: 600;
}

.selected-roles-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-role-tag {
  margin: 0;
}

/* 对话框底部 */
.dialog-footer {
  padding: 20px 24px;
  border-top: 1px solid #e5e7eb;
  background: #fafbfc !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.footer-info {
  padding: 12px 16px;
  background: linear-gradient(135deg, #e8f5e8 0%, #f0f9ff 100%);
  border-radius: 8px;
  border-left: 4px solid #52c41a;
}

.permission-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  color: #525252;
  font-weight: 500;
}

.permission-hint i {
  color: #52c41a;
  font-size: 16px;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.footer-actions .el-button {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 模块管理相关样式 */
.module-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.module-stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.module-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.module-stat-card.warning {
  border-color: #ffc107;
  background: linear-gradient(135deg, #fff9e6 0%, #ffffff 100%);
}

.module-stat-card .stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.module-stat-card.warning .stat-icon {
  background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%);
}

.module-stat-content {
  flex: 1;
}

.stat-number {
  font-size: 32px;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 4px;
  line-height: 1;
}

.stat-label {
  color: #7f8c8d;
  font-size: 14px;
  font-weight: 500;
}

.module-info-section {
  margin-top: 30px;
}

.info-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #dee2e6;
}

.info-card h4 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-card h4 i {
  color: #3498db;
}

.info-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.info-item {
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  border-left: 4px solid #3498db;
  font-size: 14px;
  line-height: 1.5;
}

.info-item strong {
  color: #2c3e50;
  font-weight: 600;
}

/* 未注册模块的特殊样式 */
.stat-icon.unregistered {
  background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%);
  color: white;
}

/* 响应式设计优化 */
@media (max-width: 767px) {
  .module-stats-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .module-stat-card {
    padding: 20px;
  }

  .stat-number {
    font-size: 28px;
  }

  .info-content {
    grid-template-columns: 1fr;
  }

  .module-info-section {
    margin-top: 20px;
  }

  .info-card {
    padding: 20px;
  }
}

@media (max-width: 480px) {
  .module-stats-grid {
    grid-template-columns: 1fr;
  }

  .module-stat-card {
    padding: 16px;
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .module-stat-card .stat-icon {
    width: 50px;
    height: 50px;
    font-size: 20px;
  }

  .stat-number {
    font-size: 24px;
  }
}

/* 字段权限配置样式 */
.field-permission-dialog .el-dialog {
  max-width: 900px;
  width: 90vw;
  max-height: 85vh;
}

.field-permission-info {
  margin-bottom: 24px;
}

.field-permission-info .info-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  color: #1565c0;
  font-size: 14px;
}

.field-permission-info .info-alert i {
  font-size: 16px;
  flex-shrink: 0;
}

.field-permission-info .permission-tips {
  margin-top: 8px;
  padding-left: 24px;
}

.field-permission-info .permission-tips small {
  color: #666;
  font-size: 13px;
  line-height: 1.5;
}

.field-permission-info .permission-tips i {
  color: #999;
  margin-right: 5px;
}

.field-groups-container {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}

.field-group {
  margin-bottom: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
}

.field-group:last-child {
  margin-bottom: 0;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.group-header:hover {
  background: #f1f5f9;
}

.group-header.expanded {
  background: #eef4ff;
}

.field-group .group-header:not(.expanded) {
  border-radius: 8px;
  border-bottom-color: transparent;
}

.group-header-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.group-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-header h4 i {
  color: #6b7280;
  font-size: 14px;
}

.group-count {
  font-size: 12px;
  color: #6b7280;
  font-weight: 400;
}

.group-selection-summary {
  font-size: 12px;
  color: #6b7280;
}

.role-group-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.group-sensitivity .sensitivity-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.group-sensitivity .sensitivity-badge.public {
  background: #dcfce7;
  color: #166534;
}

.group-sensitivity .sensitivity-badge.internal {
  background: #fef3c7;
  color: #92400e;
}

.group-sensitivity .sensitivity-badge.confidential {
  background: #fee2e2;
  color: #991b1b;
}

.group-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #ffffff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.group-toggle-btn:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}

.group-fields {
  padding: 20px;
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-item {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.field-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
}

.field-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  cursor: pointer;
}

.field-checkbox input[type="checkbox"] {
  margin: 4px 0 0 0;
  flex-shrink: 0;
}

.field-info {
  flex: 1;
  min-width: 0;
}

.field-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.field-main strong {
  color: #374151;
  font-size: 14px;
  font-weight: 600;
}

.field-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.field-type {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.field-type.string {
  background: #e0e7ff;
  color: #3730a3;
}

.field-type.number {
  background: #f0fdf4;
  color: #166534;
}

.field-type.date {
  background: #fef3c7;
  color: #92400e;
}

.field-type.enum {
  background: #f3e8ff;
  color: #6b21a8;
}

.field-type.boolean {
  background: #fce7f3;
  color: #9f1239;
}

.field-type.object {
  background: #e0f2fe;
  color: #075985;
}

.field-type.percentage {
  background: #f0fdf4;
  color: #166534;
}

.field-description {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.4;
  margin-top: 4px;
}

.no-fields {
  text-align: center;
  padding: 40px 20px;
  color: #6b7280;
}

.no-fields i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #d1d5db;
}

.no-fields p {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
}

.no-fields small {
  font-size: 14px;
  color: #9ca3af;
}

/* 字段权限对话框响应式设计 */
@media (max-width: 767px) {
  .field-permission-dialog .el-dialog {
    width: 95vw;
    max-height: 90vh;
  }

  .field-groups-container {
    max-height: 300px;
  }

  .group-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .role-group-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .field-item {
    padding: 12px;
  }

  .field-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .field-badges {
    margin-top: 4px;
  }
}

/* 增强的权限管理样式 */
.global-controls {
  background: #f8f9fa;
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;
}

.permission-type-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  cursor: pointer;
}

.control-label {
  font-weight: 500;
  color: #666;
}

.stats-summary {
  display: flex;
  gap: 20px;
}

.stat-item {
  font-size: 14px;
  color: #666;
}

.stat-item strong {
  color: #409eff;
}

.permission-item.active {
  background: #e6f7ff;
  border-color: #409eff;
}

.permission-item.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.module-actions .btn.active {
  background: #409eff;
  color: white;
  border-color: #409eff;
}

.permission-item {
  transition: all 0.3s ease;
}

.permission-item:hover {
  background: #f5f5f5;
}

.permission-item.active:hover {
  background: #bae7ff;
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  background: #ffffff !important;
  color: #303133;
}

.dialog-global-controls {
  background: #f8f9fa;
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.dialog-matrix-content {
  max-height: 500px;
  overflow-y: auto;
  padding-right: 10px;
}

.dialog-loading-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6b7280;
}

.dialog-module-section {
  margin-bottom: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.dialog-module-header {
  background: #f3f4f6;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-module-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dialog-permissions-row {
  padding: 10px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.dialog-permission-item-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  font-size: 14px;
}

.dialog-permission-item-inline:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.dialog-permission-item-inline input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #409eff;
}

.permission-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.permission-label i {
  font-size: 12px;
  width: 14px;
  text-align: center;
}

/* 选中的权限项样式 */
.dialog-permission-item-inline.permission-selected {
  background: #e6f7ff;
  border-color: #409eff;
}

.dialog-permission-item-inline.permission-selected .permission-label {
  color: #409eff;
}

/* 菜单权限特殊样式 */
.dialog-permission-item-inline.permission-selected.menu-permission {
  background: #f0f9ff;
  border-color: #60a5fa;
}

.dialog-no-permissions {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.dialog-no-permissions i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #d1d5db;
}

/* 弹窗滚动条样式 */
.dialog-matrix-content::-webkit-scrollbar {
  width: 6px;
}

.dialog-matrix-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.dialog-matrix-content::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.dialog-matrix-content::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 响应式设计 */
@media (max-width: 767px) {
  .dialog-global-controls {
    flex-direction: column;
    align-items: flex-start;
  }

  .dialog-permissions-row {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* 角色字段权限弹窗样式 */
.role-field-permission-dialog .el-dialog {
  max-width: 1200px;
  width: min(1200px, 96vw);
}

.role-field-permission-dialog .el-dialog__body {
  padding: 0 !important;
}

.role-field-permission-dialog .dialog-body {
  display: flex;
  align-items: stretch;
  min-height: 640px;
  max-height: calc(88vh - 120px);
  padding: 0 !important;
  background: #f6f7fb !important;
  overflow: hidden;
}

.module-selection-area {
  padding: 20px 24px;
  border-right: 1px solid #e5e7eb;
  background: #f9fafb;
  width: 280px;
  min-width: 280px;
  flex-shrink: 0;
}

.module-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 560px;
  overflow-y: auto;
  padding: 10px 0;
}

.module-item-grid {
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  text-align: left;
  background: white;
  min-height: 64px;
}

.module-item-grid:hover {
  background: #f7f7ff;
  border-color: #c7d2fe;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.12);
}

.module-item-grid.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.10));
  border-color: #8b5cf6;
  color: #5b21b6;
  box-shadow: 0 10px 24px rgba(139, 92, 246, 0.16);
}

.module-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #6b7280;
  background: #f3f4f6;
}

.module-item-grid.active .module-icon {
  color: #6d28d9;
  background: rgba(255, 255, 255, 0.8);
}

.module-name {
  font-size: 13px;
  line-height: 1.45;
  word-break: break-word;
  font-weight: 600;
}

.field-layout-area {
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
}

.field-group-nav {
  width: 270px;
  min-width: 270px;
  flex-shrink: 0;
  min-height: 0;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 20px 24px;
  overflow-y: auto;
}

.group-nav-loading {
  min-height: 240px;
}

.group-nav-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-nav-item {
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  transition: all 0.25s ease;
}

.group-nav-item:hover {
  border-color: #c4b5fd;
  background: #faf7ff;
}

.group-nav-item.active {
  border-color: #8b5cf6;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.10), rgba(124, 58, 237, 0.06));
  box-shadow: 0 8px 22px rgba(139, 92, 246, 0.14);
}

.group-nav-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.group-nav-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  line-height: 1.45;
  word-break: break-word;
}

.group-nav-count {
  flex-shrink: 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.2;
  padding-top: 2px;
}

.group-nav-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.group-nav-hidden {
  font-size: 12px;
  color: #6b7280;
}

.field-config-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #fff;
  padding: 20px 24px 24px;
}

.field-config-toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0;
}

.field-config-heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-config-heading__main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.field-config-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
  font-weight: 700;
  color: #1f2937;
  word-break: break-word;
}

.section-title {
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title i {
  color: #6b7280;
}

.module-count {
  margin-left: auto;
  font-size: 14px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 12px;
}

.field-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.field-actions :deep(.el-button) {
  width: 100%;
  min-width: 0;
  height: 36px;
  margin-left: 0 !important;
  border-radius: 10px;
  font-weight: 600;
}

.section-title--compact {
  margin-bottom: 12px;
  font-size: 15px;
}

.field-config-panel {
  min-height: 0;
  max-height: calc(88vh - 290px);
  overflow-y: auto;
  padding-right: 4px;
}

.field-panel-summary {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  margin-bottom: 16px;
  padding: 0 0 12px;
  border-radius: 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #ede9fe;
}

.field-panel-summary__title {
  font-size: 15px;
  font-weight: 700;
  color: #4c1d95;
  line-height: 1.4;
  word-break: break-word;
}

.field-switch-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field-switch-item {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px;
  background: #fff;
  transition: all 0.2s ease;
}

.field-switch-item:hover {
  border-color: #c4b5fd;
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.08);
}

.field-switch-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-switch-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.field-switch-title {
  flex: 1;
  min-width: 0;
}

.field-switch-title strong {
  display: block;
  margin-bottom: 8px;
  font-size: 15px;
  color: #111827;
}

.field-switch-action {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.field-visibility-text {
  font-size: 12px;
  font-weight: 600;
}

.field-visibility-text.visible {
  color: #2563eb;
}

.field-visibility-text.hidden {
  color: #dc2626;
}

.no-fields--inline {
  padding: 24px 12px;
}

.no-module-selected {
  text-align: center;
  padding: 80px 20px;
  color: #9ca3af;
}

.no-module-selected i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #d1d5db;
}

.role-field-permission-dialog .dialog-footer {
  background: #f9fafb;
}

.selection-summary {
  font-size: 14px;
  color: #6b7280;
}

/* 字段状态样式 */
.field-status {
  margin-right: 15px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.field-status .status-badge.hidden {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fecaca 100%);
  color: #dc2626;
  border: 2px solid #f87171;
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.1);
}

.field-status .status-badge.hidden::before {
  background-color: #dc2626;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.field-status .status-badge.visible {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%);
  color: #16a34a;
  border: 2px solid #4ade80;
  box-shadow: 0 2px 4px rgba(34, 197, 94, 0.1);
}

.field-status .status-badge.visible::before {
  background-color: #22c55e;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.3);
}

/* 选中字段的特殊样式 */
.field-item.field-hidden {
  background: #fef2f2;
  border-color: #fecaca;
}

.field-item.field-hidden .field-main strong {
  color: #dc2626;
}

.field-item.field-hidden .field-checkbox {
  border-color: #fca5a5;
}

.field-item.field-hidden:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}


/* 角色字段权限响应式设计 */
@media (max-width: 1024px) {
  .role-field-permission-dialog .el-dialog {
    width: 95vw;
  }

  .role-field-permission-dialog .dialog-body {
    flex-direction: column;
    min-height: auto;
  }

  .module-selection-area {
    width: 100%;
    min-width: 100%;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
    padding: 15px;
    max-height: 200px;
  }

  .field-layout-area {
    flex-direction: column;
  }

  .field-group-nav {
    width: 100%;
    min-width: 100%;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
    padding: 15px;
  }

  .group-nav-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .field-config-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .field-actions {
    max-width: none;
    justify-content: flex-start;
  }
}

@media (max-width: 767px) {
  .role-field-permission-dialog .el-dialog {
    width: 100vw;
    max-width: 100vw;
    max-height: 95vh;
  }

  .dialog-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .footer-actions {
    justify-content: flex-end;
  }

  .field-config-area,
  .field-group-nav,
  .module-selection-area {
    padding: 14px;
  }

  .field-panel-summary,
  .field-switch-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .field-config-toolbar {
    padding: 14px;
  }

  .field-config-title {
    font-size: 18px;
  }

  .field-switch-action {
    width: 100%;
    justify-content: space-between;
  }

  .field-actions {
    width: 100%;
  }

  .field-actions :deep(.el-button) {
    min-width: 0;
  }
}

/* 下拉菜单样式 */
.btn-more {
  background: #f3f4f6 !important;
  color: #374151 !important;
  border: 1px solid #d1d5db !important;
}

.btn-more:hover {
  background: #e5e7eb !important;
  border-color: #9ca3af !important;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
}

:deep(.el-dropdown-menu__item i) {
  width: 16px;
  text-align: center;
}

:deep(.el-dropdown-menu__item.danger-item) {
  color: #f56c6c;
}

:deep(.el-dropdown-menu__item.danger-item:hover) {
  background-color: #fef0f0;
  color: #f56c6c;
}

/* 门店绑定样式 */
.store-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.store-badge i {
  font-size: 12px;
}

.user-info-summary {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.user-info-summary p {
  margin: 8px 0;
  font-size: 14px;
}

.user-info-summary strong {
  color: #2c3e50;
  display: inline-block;
  width: 80px;
}

.badge-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.badge-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.badge-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.badge-info {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.badge-secondary {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
}

/* 门店多选样式 */
.store-selection {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-height: 300px;
  overflow-y: auto;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.store-checkbox {
  flex: 0 0 calc(50% - 6px);
}

.store-checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;
}

.store-checkbox label:hover {
  background: #f0f9ff;
  border-color: #0ea5e9;
}

.store-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #3b82f6;
}

.store-checkbox span {
  font-size: 14px;
  color: #374151;
}

.primary-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 4px;
}

.store-badge-small {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-right: 4px;
  margin-bottom: 4px;
}

.stores-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 300px;
}

.help-text {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
}

/* 门店绑定状态样式 */
.store-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.store-status-bound {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.store-status-bound:hover {
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  transform: translateY(-1px);
}

.store-status-unbound {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.store-status-unbound:hover {
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  transform: translateY(-1px);
}

.store-status-badge .status-icon {
  font-size: 12px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.store-status-badge i:first-child {
  font-size: 14px;
}

/* 角色徽章样式 */
.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
}

.role-badge i {
  font-size: 13px;
}

.role-badge.badge-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.role-badge.badge-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}

.role-badge.badge-info {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.role-badge.badge-secondary {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);
}

.role-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.permissions-view {
  --permission-bg: linear-gradient(180deg, #f5f7fb 0%, #eef3f9 100%);
  --permission-card: rgba(255, 255, 255, 0.94);
  --permission-border: rgba(15, 23, 42, 0.08);
  --permission-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  --permission-shadow-soft: 0 10px 24px rgba(15, 23, 42, 0.06);
  --permission-primary: #2457f5;
  --permission-primary-soft: rgba(36, 87, 245, 0.1);
  --permission-accent: #0f172a;
  background: var(--permission-bg);
  min-height: 100%;
}

.permissions-view .content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.permissions-view .stats-cards {
  gap: 16px;
}

.permissions-view .stat-card,
.permissions-view .table-section {
  background: var(--permission-card);
  border: 1px solid var(--permission-border);
  box-shadow: var(--permission-shadow-soft);
}

.permissions-view .stat-card {
  border-radius: 22px;
  overflow: hidden;
}

.permissions-view .tab-navigation {
  position: sticky;
  top: 0;
  z-index: 8;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(148, 163, 184, 0.22);
  box-shadow: var(--permission-shadow-soft);
}

.permissions-view .tab-navigation .el-button {
  min-width: 104px;
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  border-width: 1px;
}

.permissions-view .tab-navigation .el-button--default {
  background: rgba(248, 250, 252, 0.92);
  border-color: rgba(148, 163, 184, 0.24);
  color: #334155;
}

.permissions-view .tab-navigation .el-button--default:hover {
  color: var(--permission-primary);
  border-color: rgba(36, 87, 245, 0.24);
  background: rgba(255, 255, 255, 0.98);
}

.permissions-view .tab-navigation .el-button--primary {
  border-color: transparent;
  background: linear-gradient(135deg, #2457f5 0%, #1d4ed8 100%);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.24);
}

.permissions-view .permissions-content {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
  overflow: visible;
}

.permissions-view .tab-panel {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.permissions-view .tab-pane-header {
  border-radius: 22px;
  padding: 22px 24px;
  margin-bottom: 18px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.92) 100%);
  color: #f8fafc;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.16);
}

.permissions-view .tab-pane-header h3,
.permissions-view .tab-pane-header p,
.permissions-view .tab-pane-header i {
  color: inherit;
}

.permissions-view .tab-pane-header p {
  opacity: 0.78;
}

.permissions-view .tab-pane-header .el-button:not(.el-button--primary) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
  color: #f8fafc;
}

.permissions-view .tab-pane-header .el-button--primary {
  background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%);
  border-color: transparent;
}

.permissions-view .table-section {
  border-radius: 22px;
}

.permissions-view .section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--permission-accent);
}

.permissions-view .table-section {
  padding: 18px;
}

.permissions-view .table {
  border-radius: 18px;
  overflow: hidden;
}

.permissions-view .table thead th {
  background: #eef4ff;
  color: #0f172a;
  border-bottom: 1px solid rgba(37, 99, 235, 0.12);
}

.permissions-view .table tbody tr {
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.permissions-view .table tbody tr:hover {
  background: rgba(36, 87, 245, 0.03);
}

.permissions-view .action-buttons {
  gap: 8px;
}

.permissions-view .permission-settings-page .dialog-global-controls,
.permissions-view .permission-settings-page .dialog-matrix-content {
  border-radius: 22px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: var(--permission-shadow-soft);
}

.permissions-view .permission-settings-page .dialog-module-section {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.94) 100%);
}

.permissions-view .permission-settings-page .dialog-module-header {
  background: rgba(36, 87, 245, 0.06);
}

.permissions-view .permission-settings-page .dialog-permission-item-inline {
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.92);
}

.permissions-view .permission-settings-page .dialog-permission-item-inline.permission-selected {
  border-color: rgba(36, 87, 245, 0.22);
  background: rgba(36, 87, 245, 0.08);
  box-shadow: inset 0 0 0 1px rgba(36, 87, 245, 0.08);
}

.permissions-view .user-role-modal .el-dialog {
  max-width: 1180px;
  width: min(1180px, 96vw);
}

.permissions-view .user-role-modal .modal-body {
  padding: 24px;
  max-height: min(78vh, 880px);
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%);
}

.permissions-view .user-role-modal .modal-footer.user-role-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(255, 255, 255, 0.94);
}

.permissions-view .role-assignment-shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.permissions-view .role-assignment-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
  gap: 16px;
}

.permissions-view .role-assignment-user-card,
.permissions-view .role-assignment-summary,
.permissions-view .assignment-main-panel,
.permissions-view .assignment-side-panel {
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.06);
}

.permissions-view .role-assignment-user-card {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px;
  border-radius: 22px;
  background: linear-gradient(135deg, #eff6ff 0%, #ecfeff 100%);
}

.permissions-view .role-assignment-user-card .user-avatar {
  width: 78px;
  height: 78px;
  margin: 0;
  border: 0;
  color: #1d4ed8;
  background: rgba(255, 255, 255, 0.92);
}

.permissions-view .role-assignment-caption {
  display: inline-flex;
  margin-bottom: 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.permissions-view .role-assignment-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
}

.permissions-view .summary-metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(239, 246, 255, 0.88);
  border: 1px solid rgba(59, 130, 246, 0.12);
}

.permissions-view .summary-metric.hint {
  background: rgba(240, 253, 250, 0.92);
  border-color: rgba(13, 148, 136, 0.16);
}

.permissions-view .summary-metric-label {
  color: #64748b;
  font-size: 12px;
}

.permissions-view .summary-metric strong {
  color: #0f172a;
  font-size: 24px;
  line-height: 1;
}

.permissions-view .role-assignment-layout {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) minmax(300px, 0.9fr);
  gap: 18px;
  align-items: start;
}

.permissions-view .assignment-main-panel,
.permissions-view .assignment-side-panel {
  padding: 20px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.94);
}

.permissions-view .assignment-toolbar {
  margin-bottom: 18px;
}

.permissions-view .assignment-toolbar-title {
  margin-bottom: 14px;
}

.permissions-view .assignment-toolbar-title h4,
.permissions-view .assignment-side-header h4 {
  margin: 0;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.permissions-view .assignment-toolbar-title p,
.permissions-view .assignment-side-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.permissions-view .assignment-search-box {
  margin-bottom: 12px;
}

.permissions-view .assignment-toolbar-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.permissions-view .assignment-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  background: rgba(241, 245, 249, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.permissions-view .assignment-meta-pill.active {
  color: #1d4ed8;
  background: rgba(219, 234, 254, 0.95);
  border-color: rgba(59, 130, 246, 0.22);
}

.permissions-view .assignment-role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
  max-height: 52vh;
  padding-right: 4px;
  overflow-y: auto;
}

.permissions-view .assignment-role-option {
  position: relative;
  display: block;
  cursor: pointer;
}

.permissions-view .assignment-role-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.permissions-view .assignment-role-check {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: #64748b;
  background: #fff;
  border: 1px solid rgba(148, 163, 184, 0.26);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.06);
  transition: all 0.18s ease;
}

.permissions-view .assignment-role-card {
  height: 100%;
  min-height: 152px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.permissions-view .assignment-role-option:hover .assignment-role-card {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.28);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.10);
}

.permissions-view .assignment-role-option.selected .assignment-role-card,
.permissions-view .assignment-role-input:checked + .assignment-role-check + .assignment-role-card {
  border-color: rgba(37, 99, 235, 0.3);
  background: linear-gradient(135deg, rgba(239, 246, 255, 0.96) 0%, rgba(236, 254, 255, 0.96) 100%);
  box-shadow: 0 18px 34px rgba(37, 99, 235, 0.12);
}

.permissions-view .assignment-role-option.selected .assignment-role-check,
.permissions-view .assignment-role-input:checked + .assignment-role-check {
  color: #fff;
  background: linear-gradient(135deg, #2563eb 0%, #0f766e 100%);
  border-color: transparent;
}

.permissions-view .assignment-role-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-right: 40px;
  margin-bottom: 10px;
}

.permissions-view .assignment-role-header strong {
  color: #0f172a;
  font-size: 16px;
}

.permissions-view .assignment-role-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.permissions-view .assignment-role-description {
  min-height: 40px;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 14px;
}

.permissions-view .assignment-role-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #64748b;
  font-size: 12px;
}

.permissions-view .assignment-role-state {
  font-weight: 700;
  color: #2563eb;
}

.permissions-view .assignment-empty-state,
.permissions-view .assignment-empty-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 220px;
  text-align: center;
  color: #64748b;
  border: 1px dashed rgba(148, 163, 184, 0.28);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.72);
}

.permissions-view .assignment-empty-state h4 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
}

.permissions-view .assignment-empty-state p {
  margin: 0;
  font-size: 13px;
}

.permissions-view .assignment-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  color: #2563eb;
  background: rgba(219, 234, 254, 0.9);
  font-size: 20px;
}

.permissions-view .assignment-side-panel {
  position: sticky;
  top: 0;
}

.permissions-view .assignment-side-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.permissions-view .assignment-side-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 42px;
  padding: 0 12px;
  border-radius: 14px;
  color: #1d4ed8;
  font-size: 18px;
  font-weight: 800;
  background: rgba(219, 234, 254, 0.95);
}

.permissions-view .assignment-selected-list {
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
}

.permissions-view .assignment-selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  color: #0f172a;
  background: rgba(239, 246, 255, 0.96);
  border: 1px solid rgba(59, 130, 246, 0.16);
  border-radius: 999px;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.permissions-view .assignment-selected-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.12);
  background: rgba(219, 234, 254, 1);
}

.permissions-view .assignment-side-tip,
.permissions-view .user-role-footer-info {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #0f766e;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.permissions-view .assignment-side-tip {
  margin-top: 18px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(240, 253, 250, 0.94);
  border: 1px solid rgba(13, 148, 136, 0.14);
}

.permissions-view .user-role-footer-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 1100px) {
  .permissions-view .role-assignment-hero,
  .permissions-view .role-assignment-layout {
    grid-template-columns: 1fr;
  }

  .permissions-view .assignment-side-panel {
    position: static;
  }
}

@media (max-width: 768px) {
  .permissions-view .user-role-modal .el-dialog {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    margin: 0;
    border-radius: 0;
  }

  .permissions-view .user-role-modal .el-dialog__header,
  .permissions-view .user-role-modal .modal-footer.user-role-footer {
    border-radius: 0;
  }

  .permissions-view .user-role-modal .modal-body {
    padding: 16px;
    max-height: calc(100vh - 132px);
  }

  .permissions-view .role-assignment-user-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .permissions-view .role-assignment-summary {
    grid-template-columns: 1fr 1fr;
  }

  .permissions-view .assignment-main-panel,
  .permissions-view .assignment-side-panel {
    padding: 16px;
    border-radius: 18px;
  }

  .permissions-view .assignment-role-grid {
    grid-template-columns: 1fr;
    max-height: none;
  }

  .permissions-view .user-role-modal .modal-footer.user-role-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .permissions-view .user-role-footer-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .permissions-view .permissions-content {
    padding: 0;
    border-radius: 0;
  }

  .permissions-view .tab-panel {
    padding: 0;
  }

  .permissions-view .tab-pane-header {
    padding: 18px;
    border-radius: 18px;
  }

  .permissions-view .tab-navigation {
    padding: 8px;
    gap: 8px;
  }

  .permissions-view .tab-navigation .el-button {
    flex: 1 1 calc(50% - 8px);
    min-width: 0;
    height: 32px;
    padding: 0 10px;
    border-radius: 9px;
    font-size: 12px;
  }
}
</style>
