<template>
  <div class="modules-tab-body">
      <div class="module-stats-grid">
        <div class="module-stat-card">
          <div class="stat-icon">
            <i class="fas fa-cubes"></i>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ ctx.stats.totalModules }}</div>
            <div class="stat-label">已注册模块</div>
          </div>
        </div>
        <div class="module-stat-card warning">
          <div class="stat-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ ctx.stats.unregisteredModules }}</div>
            <div class="stat-label">待注册模块</div>
          </div>
        </div>
        <div class="module-stat-card">
          <div class="stat-icon">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ ctx.stats.totalPermissions }}</div>
            <div class="stat-label">权限总数</div>
          </div>
        </div>
        <div class="module-stat-card">
          <div class="stat-icon">
            <i class="fas fa-users-cog"></i>
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ ctx.stats.totalRoles }}</div>
            <div class="stat-label">角色总数</div>
          </div>
        </div>
      </div>
 
      <div class="module-info-section">
        <div class="info-card">
          <h4><i class="fas fa-info-circle"></i> 模块管理说明</h4>
          <div class="info-content">
            <div class="info-item">
              <strong>扫描模块：</strong>自动检测 frontend/src/views 目录下的所有Vue组件
            </div>
            <div class="info-item">
              <strong>注册模块：</strong>将检测到的模块注册到权限管理系统
            </div>
            <div class="info-item">
              <strong>权限分配：</strong>为每个模块自动创建基础的增删改查权限
            </div>
            <div class="info-item">
              <strong>一键同步：</strong>批量注册所有未注册的模块并创建权限
            </div>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { usePermissionsPageContext } from './context'

const ctx = usePermissionsPageContext()
</script>
