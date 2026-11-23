<template>
  <MobileDialog
    :model-value="modelValue"
    :title="title"
    :dialog-class="dialogClass || 'record-detail-dialog crud-dialog-md'"
    :show-default-footer="false"
    :close-on-click-modal="!editing"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="fieldGroups.length">
      <section
        v-for="group in fieldGroups"
        :key="group.key"
        class="tf-record-details-group"
      >
        <h3
          v-if="group.label"
          class="tf-record-details-group__title"
        >
          {{ group.label }}
        </h3>
        <dl
          class="tf-record-details"
          :class="{
            'tf-record-details--columns-3': desktopColumns === 3,
            'tf-record-details--columns-4': desktopColumns === 4,
            'tf-record-details--tablet-columns-3': tabletColumns === 3
          }"
        >
          <div
            v-for="field in group.fields"
            :key="field.key"
            class="tf-record-details__field"
            :class="[
              { 'tf-record-details__field--wide': field.wide },
              field.desktopColumnSpan ? `tf-record-details__field--desktop-span-${field.desktopColumnSpan}` : ''
            ]"
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
      </section>
    </div>
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
  dialogClass?: string
  desktopColumns?: 2 | 3 | 4
  tabletColumns?: 2 | 3
}
const props = defineProps<Props>()
const desktopColumns = computed(() => props.desktopColumns ?? 2)
const tabletColumns = computed(() => props.tabletColumns ?? 2)
const dialogClass = computed(() => props.dialogClass)
const emit = defineEmits<UpdateModelValueEmits & { beforeAction: [] }>()
defineSlots<{ default(): unknown; actions(props: { row: T }): unknown; field(props: { field: RecordDetailField; row: T | null }): unknown }>()
const fieldGroups = computed(() => {
  const groups: Array<{ key: string; label: string; fields: RecordDetailField[] }> = []
  for (const field of props.fields.filter(item => item.visible)) {
    const label = field.section || ''
    let group = groups.at(-1)
    if (!group || group.label !== label) {
      group = { key: `${label}:${field.key}`, label, fields: [] }
      groups.push(group)
    }
    group.fields.push({ ...field })
  }
  for (const group of groups) {
    if (desktopColumns.value === 2) {
      let pending: RecordDetailField | undefined
      for (const field of group.fields) {
        if (field.wide || field.desktopColumnSpan) {
          if (pending && !pending.desktopColumnSpan) pending.wide = true
          pending = undefined
        } else pending = pending ? undefined : field
      }
      if (pending && !pending.desktopColumnSpan) pending.wide = true
      continue
    }

    let occupiedColumns = 0
    let lastField: RecordDetailField | undefined
    for (const field of group.fields) {
      if (field.wide) {
        occupiedColumns = 0
        lastField = undefined
        continue
      }
      const span = field.desktopColumnSpan ?? 1
      if (occupiedColumns + span > desktopColumns.value) occupiedColumns = 0
      occupiedColumns += span
      lastField = field
      if (occupiedColumns === desktopColumns.value) {
        occupiedColumns = 0
        lastField = undefined
      }
    }
    if (occupiedColumns === 1 && lastField && !lastField.desktopColumnSpan) lastField.wide = true
  }
  return groups
})
const beforeAction = (event: MouseEvent) => {
  if (event.target instanceof Element && event.target.closest('button:not(:disabled)')) emit('beforeAction')
}
</script>
