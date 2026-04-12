<template>
  <div class="permission-access-notice">
    <div class="notice-shell">
      <div class="notice-card">
        <div class="notice-icon">
          <i class="fas fa-shield-alt"></i>
        </div>
        <div class="notice-content">
          <h2>访问受限</h2>
          <p class="notice-message">
            您可以访问{{ moduleName }}菜单，但需要额外权限才能查看页面内容
          </p>

          <div v-if="hasMenuPermissionOnly" class="permission-status">
            <div class="status-item status-ok">
              <i class="fas fa-check-circle"></i>
              <span>菜单访问权限 ✓</span>
            </div>
            <div class="status-item status-missing">
              <i class="fas fa-times-circle"></i>
              <span>页面查看权限 ✗</span>
            </div>
          </div>

          <div class="permission-info">
            <div class="info-row">
              <label>需要权限</label>
              <span>{{ permissionName }}</span>
            </div>
            <div class="info-row">
              <label>权限代码</label>
              <code>{{ permissionCode }}</code>
            </div>
          </div>

          <div class="notice-tip">
            <i class="fas fa-info-circle"></i>
            <p>{{ suggestionText }}</p>
          </div>

          <div class="notice-actions">
            <el-button type="primary" @click="router.back()">
              <i class="fas fa-arrow-left"></i>
              返回上一页
            </el-button>
            <el-button plain @click="router.push('/dashboard')">
              <i class="fas fa-home"></i>
              返回首页
            </el-button>
            <el-button
              v-if="relatedPermissions.length > 0"
              type="info"
              plain
              @click="expanded = !expanded"
            >
              <i class="fas fa-key"></i>
              {{ expanded ? '隐藏' : '查看' }}权限详情
            </el-button>
          </div>

          <div v-if="expanded && relatedPermissions.length > 0" class="permission-details">
            <h4>{{ detailTitle }}</h4>
            <div class="permission-list">
              <span
                v-for="permission in relatedPermissions"
                :key="permission"
                class="permission-tag"
              >
                {{ permission }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

interface Props {
  moduleName: string
  permissionCode: string
  permissionName: string
  relatedPermissions?: string[]
  hasMenuPermissionOnly?: boolean
  suggestion?: string
  detailTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  relatedPermissions: () => [],
  hasMenuPermissionOnly: false,
  suggestion: '',
  detailTitle: '当前模块相关权限'
})

const router = useRouter()
const expanded = ref(false)

const suggestionText = computed(() => {
  return props.suggestion || `请联系系统管理员为您分配${props.permissionName}，或使用已有权限访问其他功能模块`
})
</script>

<style scoped lang="scss">
.permission-access-notice {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.notice-shell {
  width: 100%;
  max-width: 760px;
}

.notice-card {
  display: flex;
  gap: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  border: 1px solid #ebeef5;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.notice-icon {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fff3cd 0%, #ffe7a3 100%);
  color: #c77b00;
  font-size: 30px;
}

.notice-content {
  flex: 1;

  h2 {
    margin: 0 0 10px;
    font-size: 24px;
    color: #1f2937;
  }
}

.notice-message {
  margin: 0 0 18px;
  color: #4b5563;
  line-height: 1.7;
}

.permission-status {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.status-ok {
  background: #ecfdf3;
  color: #067647;
}

.status-missing {
  background: #fef3f2;
  color: #b42318;
}

.permission-info {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
}

.info-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;

  label {
    min-width: 72px;
    color: #6b7280;
    font-size: 13px;
  }

  span {
    color: #111827;
    font-weight: 600;
  }

  code {
    padding: 4px 8px;
    border-radius: 8px;
    background: #f3f4f6;
    color: #7c2d12;
    font-size: 12px;
  }
}

.notice-tip {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px 16px;
  margin-bottom: 20px;
  border-radius: 14px;
  background: #f8fafc;
  color: #475467;

  i {
    margin-top: 2px;
    color: #1570ef;
  }

  p {
    margin: 0;
    line-height: 1.7;
  }
}

.notice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.permission-details {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px dashed #d0d5dd;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #344054;
  }
}

.permission-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.permission-tag {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .permission-access-notice {
    padding: 16px;
  }

  .notice-card {
    flex-direction: column;
    padding: 22px;
  }

  .notice-icon {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    font-size: 24px;
  }

  .notice-content h2 {
    font-size: 20px;
  }

  .notice-actions {
    flex-direction: column;
  }
}
</style>
