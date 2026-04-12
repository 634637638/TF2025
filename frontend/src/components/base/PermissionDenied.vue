<template>
  <!-- 无权限时显示提示 -->
  <div v-if="!canView" class="permission-denied">
    <div class="permission-denied-wrapper">
      <div class="permission-denied-card">
        <div class="permission-icon">
          <i class="fas fa-shield-alt"></i>
        </div>
        <div class="permission-content">
          <h2>访问受限</h2>
          <p class="permission-message">
            您可以访问{{ moduleName }}菜单，但需要额外权限才能查看页面内容
          </p>

          <div class="permission-info">
            <div class="info-item">
              <label>需要权限：</label>
              <span class="permission-name">{{ moduleName }}查看权限</span>
            </div>
            <div v-if="permissionCode" class="info-item">
              <label>权限代码：</label>
              <code class="permission-code">{{ permissionCode }}</code>
            </div>
          </div>

          <div class="permission-suggestion">
            <i class="fas fa-info-circle"></i>
            <p>请联系有权限的角色维护人员为您分配{{ moduleName }}查看权限，或使用已有权限访问其他功能模块</p>
          </div>

          <div class="permission-actions">
            <el-button type="primary" @click="goBack">
              <i class="fas fa-arrow-left"></i>
              返回上一页
            </el-button>
            <el-button type="success" @click="goHome">
              <i class="fas fa-home"></i>
              返回首页
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PermissionDenied - 统一权限提示组件
 *
 * 用于在用户无权限访问页面时显示友好的提示信息
 * 保持原有美观样式设计
 */

import { useRouter } from 'vue-router'

interface Props {
  /** 是否有查看权限 */
  canView: boolean
  /** 模块标识 */
  moduleKey?: string
  /** 模块名称 */
  moduleName: string
  /** 权限代码 */
  permissionCode?: string
  /** 自定义提示消息 */
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  canView: false,
  moduleKey: '',
  moduleName: '此功能',
  permissionCode: '',
  message: ''
})

const router = useRouter()

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

const goHome = () => {
  router.push('/')
}
</script>

<style scoped lang="scss">
.permission-denied {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(2px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.permission-denied-wrapper {
  width: 100%;
  max-width: 1200px;
  padding: 2rem;
  display: flex;
  justify-content: center;
}

.permission-denied-card {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  padding: 3rem;
  text-align: center;
  width: 100%;
  max-width: 600px;
  border: 1px solid #e4e7ed;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 25%, #feca57 50%, #48dbfb 75%, #0abde3 100%);
    animation: shimmer 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
}

.permission-icon {
  margin-bottom: 2rem;

  i {
    font-size: 5rem;
    color: #f56c6c;
  }
}

.permission-content h2 {
  font-size: 1.8rem;
  font-weight: 700;
  color: #303133;
  margin-bottom: 1rem;
}

.permission-message {
  font-size: 1.1rem;
  color: #606266;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.permission-info {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;

  label {
    font-weight: 600;
    color: #495057;
    min-width: 100px;
  }

  .permission-name {
    color: #28a745;
    font-weight: 500;
  }

  .permission-code {
    background: #e9ecef;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9rem;
    color: #495057;
  }
}

.permission-suggestion {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-bottom: 2rem;

  i {
    color: #0284c7;
    margin-top: 0.25rem;
  }

  p {
    margin: 0;
    color: #0c4a6e;
    font-size: 0.95rem;
    line-height: 1.5;
  }
}

.permission-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;

  .el-button {
    i {
      margin-right: 0.5rem;
    }
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .permission-denied-wrapper {
    padding: 1rem;
  }

  .permission-denied-card {
    padding: 2rem 1.5rem;
  }

  .permission-content h2 {
    font-size: 1.5rem;
  }

  .permission-message {
    font-size: 1rem;
  }

  .permission-actions {
    flex-direction: column;

    .el-button {
      width: 100%;
    }
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .permission-denied-card::before {
    animation: none;
  }
}
</style>
