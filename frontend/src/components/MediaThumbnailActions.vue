<template>
  <div
    v-if="sortable || removable || canSetPrimary"
    class="tf-media-thumbnail-actions"
    @click.stop
  >
    <el-button
      v-if="removable"
      native-type="button"
      type="danger"
      circle
      :title="removeLabel"
      :aria-label="removeLabel"
      @click="$emit('remove')"
    >
      <i
        class="fas fa-trash-alt"
        aria-hidden="true"
      />
    </el-button>
    <el-button
      v-if="canSetPrimary"
      native-type="button"
      type="warning"
      circle
      title="设为主图"
      aria-label="设为主图"
      @click="$emit('set-primary')"
    >
      <i
        class="fas fa-star"
        aria-hidden="true"
      />
    </el-button>
    <span
      v-if="sortable"
      class="tf-media-thumbnail-drag-handle"
      title="拖动排序"
    >
      <i
        class="fas fa-grip-vertical"
        aria-hidden="true"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  sortable?: boolean
  removable?: boolean
  canSetPrimary?: boolean
  removeLabel?: string
}>(), {
  removeLabel: '删除素材'
})

defineEmits<{
  'set-primary': []
  remove: []
}>()
</script>
