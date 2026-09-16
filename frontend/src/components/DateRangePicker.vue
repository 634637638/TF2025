<template>
  <div class="date-range-picker">
    <el-date-picker
      v-model="startDate"
      :type="pickerType"
      :format="format"
      :value-format="valueFormat"
      :placeholder="startPlaceholder"
      :clearable="clearable"
      :disabled="disabled"
      :size="size"
      placement="bottom-start"
      :fallback-placements="['bottom-start']"
      :disabled-date="disableStartDate"
      @change="handleDateChange"
    />
    <span class="date-range-picker__separator">至</span>
    <el-date-picker
      v-model="endDate"
      :type="pickerType"
      :format="format"
      :value-format="valueFormat"
      :placeholder="endPlaceholder"
      :clearable="clearable"
      :disabled="disabled"
      :size="size"
      placement="bottom-start"
      :fallback-placements="['bottom-start']"
      :disabled-date="disableEndDate"
      @change="handleDateChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type DateRange = [string, string]
type DateRangeValue = DateRange | [] | null | undefined

interface Props {
  modelValue?: DateRangeValue
  pickerType?: 'date' | 'month' | 'datetime'
  startPlaceholder?: string
  endPlaceholder?: string
  format?: string
  valueFormat?: string
  clearable?: boolean
  disabled?: boolean
  size?: 'large' | 'default' | 'small'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  pickerType: 'date',
  startPlaceholder: '开始日期',
  endPlaceholder: '结束日期',
  format: 'YYYY-MM-DD',
  valueFormat: 'YYYY-MM-DD',
  clearable: true,
  disabled: false,
  size: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [value: DateRangeValue]
  change: [value: DateRangeValue]
}>()

const startDate = computed<string | null>({
  get: () => props.modelValue?.[0] || null,
  set: value => updateDateRange(value || null, endDate.value)
})

const endDate = computed<string | null>({
  get: () => props.modelValue?.[1] || null,
  set: value => updateDateRange(startDate.value, value || null)
})

const hasCompleteRange = (value: DateRangeValue = props.modelValue) =>
  Boolean(value?.[0] && value?.[1])

const normalizeRange = (start: string | null, end: string | null): DateRangeValue => {
  if (!start && !end) return Array.isArray(props.modelValue) && props.modelValue.length === 0 ? [] : null
  return [start || '', end || '']
}

const updateDateRange = (start: string | null, end: string | null) => {
  const previousValue = props.modelValue
  const nextValue = normalizeRange(start, end)

  emit('update:modelValue', nextValue)

  // Match Element Plus daterange semantics: do not search until both dates exist.
  if (hasCompleteRange(nextValue) || (!start && !end) || hasCompleteRange(previousValue)) {
    emit('change', hasCompleteRange(nextValue) ? nextValue : (!start && !end ? nextValue : null))
  }
}

const handleDateChange = () => {
  // v-model setters perform the update and emit the range event.
}

const toDate = (value: string | undefined) => {
  if (!value) return null
  const date = props.pickerType === 'month'
    ? new Date(`${value}-01T00:00:00`)
    : new Date(props.pickerType === 'datetime' ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const disableStartDate = (date: Date) => {
  const end = toDate(endDate.value || undefined)
  return Boolean(end && date.getTime() > end.getTime())
}

const disableEndDate = (date: Date) => {
  const start = toDate(startDate.value || undefined)
  return Boolean(start && date.getTime() < start.getTime())
}
</script>

<style scoped>
.date-range-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.date-range-picker :deep(.el-date-editor) {
  flex: 1 1 0;
  min-width: 0;
  width: 0;
}

.date-range-picker :deep(.el-date-editor--datetime) {
  min-width: 0;
}

.date-range-picker__separator {
  flex: 0 0 auto;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
</style>
