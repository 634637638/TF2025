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
        :text="displayText"
        :size="sectionSize"
      />
    </td>
  </tr>
  <div
    v-else
    class="table-loading-row__block"
  >
    <SectionLoading
      :text="displayText"
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
const displayText = computed(() => props.text === '加载中...' ? '加载数据中...' : props.text)
</script>

<style scoped>
.table-loading-row__cell,
.table-loading-row__block {
  text-align: center;
  vertical-align: middle;
  background: transparent;
}

td.table-loading-row__cell,
.table-loading-row__block {
  padding: 0;
}

.table-loading-row__block {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  line-height: normal;
}

.table-loading-row__cell :deep(.section-loading),
.table-loading-row__block :deep(.section-loading) {
  width: 100%;
  min-height: 0;
  padding: var(--tf-space-3) var(--tf-space-4);
  box-sizing: border-box;
  border-radius: var(--tf-radius-card);
  border: 0;
  box-shadow: none;
  background: transparent;
}

.table-loading-row__cell :deep(.section-loading)::before,
.table-loading-row__block :deep(.section-loading)::before {
  display: none;
}
</style>
