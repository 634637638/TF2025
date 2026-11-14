<template>
  <MobileDialog
    :model-value="modelValue"
    :title="title"
    dialog-class="record-detail-dialog crud-dialog-md"
    :show-default-footer="false"
    :close-on-click-modal="!editing"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <dl
      v-if="visibleFields.length"
      class="tf-record-details"
    >
      <div
        v-for="field in visibleFields"
        :key="field.key"
        class="tf-record-details__field"
        :class="{ 'tf-record-details__field--wide': field.wide }"
      >
        <dt>{{ field.label }}</dt>
        <dd>
          <slot
            name="field"
            :field="field"
            :row="record"
          >
            {{ field.value === null || field.value === undefined || field.value === '' ? '-' : field.value }}
          </slot>
        </dd>
      </div>
    </dl>
    <DataEmptyState
      v-else
      description="暂无可查看的字段"
      size="compact"
    />
    <slot />
    <template
      v-if="hasActions && record && $slots.actions"
      #footer
    >
      <div
        class="tf-dialog-actions"
        @click.capture="beforeAction"
      >
        <slot
          name="actions"
          :row="record"
        />
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts" generic="T">
import { computed } from 'vue'
import type { ModelValueProps, UpdateModelValueEmits, RecordDetailField } from '@/types/component'

interface Props extends ModelValueProps {
  editing?: boolean
  title: string
  fields: RecordDetailField[]
  hasActions: boolean
  record: T | null
}
const props = defineProps<Props>()
const emit = defineEmits<UpdateModelValueEmits & { beforeAction: [] }>()
defineSlots<{ default(): unknown; actions(props: { row: T }): unknown; field(props: { field: RecordDetailField; row: T | null }): unknown }>()
const visibleFields = computed(() => {
  const fields = props.fields.filter(field => field.visible).map(field => ({ ...field }))
  let pending: RecordDetailField | undefined
  for (const field of fields) {
    if (field.wide) {
      if (pending) pending.wide = true
      pending = undefined
    } else pending = pending ? undefined : field
  }
  if (pending) pending.wide = true
  return fields
})
const beforeAction = (event: MouseEvent) => {
  if (event.target instanceof Element && event.target.closest('button:not(:disabled)')) emit('beforeAction')
}
</script>
