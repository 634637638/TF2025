<template>
  <div class="icon-selector">
    <el-button
      native-type="button"
      class="btn btn-secondary"
      @click="showSelector = true"
    >
      <IconRenderer :icon="modelValue || 'fas fa-icons'" />
      选择图标
    </el-button>
    <el-button
      v-if="modelValue"
      native-type="button"
      type="warning"
      @click="emit('update:modelValue', '')"
    >
      清除图标
    </el-button>
    <MobileDialog
      v-model="showSelector"
      title="选择图标"
      width="900px"
      dialog-class="icon-selector-dialog"
      :show-default-footer="false"
    >
      <IconPicker
        v-if="showSelector"
        :model-value="modelValue"
        :default-collapsed="false"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </MobileDialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import IconRenderer from '@/components/IconRenderer.vue'
import IconPicker from '@/components/IconPicker.vue'
import type { StringModelValueProps, UpdateStringModelValueEmits } from '@/types/component'

defineProps<StringModelValueProps>()
const emit = defineEmits<UpdateStringModelValueEmits>()
const showSelector = ref(false)
</script>
