<template>
  <MobileDialog
    v-model="dialogVisible"
    title="设备销售信息"
    width="680px"
    :show-close="true"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    dialog-class="query-detail-dialog"
    :show-default-footer="false"
    destroy-on-close
    append-to-body
  >
    <QueryDetailContent
      :detail-item="detailItem"
      :can-edit="canEdit"
      :can-delete="canDelete"
      :can-return-to-stock="canReturnToStock"
      @edit="emit('edit')"
      @delete="emit('delete')"
      @return="emit('return')"
    />
  </MobileDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MobileDialog from '@/components/MobileDialog.vue'
import QueryDetailContent from '@/components/query/QueryDetailContent.vue'
import type { QueryItem } from '@/types'
import type { ModelValueProps, UpdateModelValueEmits } from '@/types/component'

interface Props extends ModelValueProps {
  detailItem: QueryItem | null
  canEdit: boolean
  canDelete: boolean
  canReturnToStock: boolean
}

interface Emits extends UpdateModelValueEmits {
  edit: []
  delete: []
  return: []
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

</script>

<style scoped lang="scss">
:global(.query-detail-dialog) {
  --mobile-dialog-body-padding: var(--tf-space-4);
  --tf-dialog-body-padding-inline: var(--tf-space-4);
  --tf-dialog-body-padding-block: var(--tf-space-4);
}
</style>
