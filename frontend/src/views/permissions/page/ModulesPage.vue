<template>
  <ModuleManagementView ref="moduleManagementRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ModuleManagementView from './ModuleManagementView.vue'

const moduleManagementRef = ref<any>(null)

const refreshModules = async () => {
  await moduleManagementRef.value?.loadModules?.()
}

defineExpose({ refreshModules })
</script>
