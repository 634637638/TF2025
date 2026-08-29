<template>
  <tr
    v-if="mode === 'row'"
    class="table-loading-row"
  >
    <td
      :colspan="colspan"
      class="table-loading-row__cell"
    >
      <SectionLoading
        :text="text"
        :size="sectionSize"
      />
    </td>
  </tr>
  <div
    v-else
    class="table-loading-row__block"
  >
    <SectionLoading
      :text="text"
      :size="sectionSize"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionLoading from '@/components/SectionLoading.vue'

interface Props {
  colspan?: number
  text?: string
  size?: 'small' | 'medium' | 'large'
  mode?: 'row' | 'block'
}

const props = withDefaults(defineProps<Props>(), {
  colspan: 1,
  text: '加载中...',
  size: 'medium',
  mode: 'row'
})

const sectionSize = computed(() => props.size === 'small' ? 'compact' : props.size === 'large' ? 'large' : 'normal')
</script>

<style scoped>
.table-loading-row__cell,
.table-loading-row__block {
  padding: 0 !important;
  text-align: center;
  vertical-align: middle;
  background: transparent;
}

.table-loading-row__block {
  width: 100%;
}

.table-loading-row__cell :deep(.section-loading),
.table-loading-row__block :deep(.section-loading) {
  min-height: 132px;
  border-radius: 0;
  border-left: 0;
  border-right: 0;
  box-shadow: none;
}
</style>
