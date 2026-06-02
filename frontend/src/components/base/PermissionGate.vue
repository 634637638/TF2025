<template>
  <slot v-if="canView" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

type PermissionGateMode = 'notice' | 'denied'

interface Props {
  canView: boolean
  moduleName: string
  permissionCode?: string
  mode?: PermissionGateMode
  moduleKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  permissionCode: '',
  mode: 'notice',
  moduleKey: ''
})

const route = useRoute()
const router = useRouter()
let hasShownDeniedMessage = false
let redirectTimer: ReturnType<typeof setTimeout> | null = null

const clearRedirectTimer = () => {
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }
}

watch(() => props.canView, (canView) => {
  if (canView) {
    clearRedirectTimer()
    return
  }

  if (hasShownDeniedMessage) {
    return
  }

  clearRedirectTimer()
  redirectTimer = setTimeout(() => {
    if (props.canView) {
      return
    }

    hasShownDeniedMessage = true
    ElMessage.warning({
      message: '您没有访问此页面的权限',
      duration: 3000,
      showClose: true
    })

    if (route.path !== '/dashboard') {
      router.replace('/dashboard')
    }
  }, 800)
}, {
  immediate: true
})

onBeforeUnmount(() => {
  clearRedirectTimer()
})
</script>
