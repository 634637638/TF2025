<!-- 公共五级地区选择器；存量三级兼容，乡村数据按父级从站内接口加载。 -->
<template>
  <div class="city-selector">
    <div
      v-if="!hideProvince"
      class="form-group"
    >
      <label :for="`${controlId}-province`">省份 <span
        v-if="required"
        class="required"
      >*</span></label>
      <el-select
        :id="`${controlId}-province`"
        v-model="selection.province"
        class="form-control"
        placeholder="搜索或选择省份"
        filterable
        :disabled="disabled || provinceDisabled || cityDisabled || (showDistrict && districtDisabled) || (showTown && townDisabled) || (showVillage && villageDisabled)"
        @change="handleProvinceChange"
      >
        <el-option
          v-for="province in availableProvinces"
          :key="province.code"
          :label="province.name"
          :value="province.code"
        />
      </el-select>
      <div
        v-if="error && !selection.province"
        class="invalid-feedback"
      >
        请选择省份
      </div>
    </div>

    <div
      v-if="!hideCity"
      class="form-group"
    >
      <label :for="`${controlId}-city`">城市 <span
        v-if="required"
        class="required"
      >*</span></label>
      <el-select
        :id="`${controlId}-city`"
        v-model="selection.city"
        class="form-control"
        placeholder="搜索或选择城市"
        filterable
        :disabled="disabled || cityDisabled || (showDistrict && districtDisabled) || (showTown && townDisabled) || (showVillage && villageDisabled) || !selection.province"
        @change="handleCityChange"
      >
        <el-option
          v-for="city in cities"
          :key="city.code"
          :label="city.name"
          :value="city.name"
        />
      </el-select>
      <div
        v-if="error && !selection.city"
        class="invalid-feedback"
      >
        请选择城市
      </div>
    </div>

    <div
      v-if="showDistrict"
      class="form-group"
    >
      <label :for="`${controlId}-district`">县/区 <span
        v-if="required"
        class="required"
      >*</span></label>
      <el-select
        :id="`${controlId}-district`"
        v-model="selection.district"
        class="form-control"
        placeholder="搜索或选择县/区"
        filterable
        clearable
        :disabled="disabled || districtDisabled || (showTown && townDisabled) || (showVillage && villageDisabled) || !selection.city"
        @change="handleDistrictChange"
      >
        <el-option
          v-for="district in districts"
          :key="district.code"
          :label="district.name"
          :value="district.name"
        />
      </el-select>
      <div
        v-if="error && !selection.district"
        class="invalid-feedback"
      >
        请选择县/区
      </div>
    </div>
    <div
      v-if="showTown"
      class="form-group"
    >
      <label :for="`${controlId}-town`">乡镇/街道</label>
      <el-select
        :id="`${controlId}-town`"
        v-model="selection.town"
        class="form-control"
        placeholder="搜索或选择乡镇/街道"
        filterable
        clearable
        :disabled="disabled || townDisabled || (showVillage && villageDisabled) || !selection.district || loading"
        @change="handleTownChange"
      >
        <el-option
          v-for="option in remote.town"
          :key="option.code"
          :label="option.name"
          :value="option.name"
        />
      </el-select>
    </div>
    <div
      v-if="showVillage"
      class="form-group form-group--wide"
    >
      <label :for="`${controlId}-village`">村委会/社区</label>
      <el-select
        :id="`${controlId}-village`"
        v-model="selection.village"
        class="form-control"
        placeholder="搜索或选择村委会/社区"
        filterable
        clearable
        :disabled="disabled || villageDisabled || !selection.town || loading"
        @change="emitChange"
      >
        <el-option
          v-for="option in remote.village"
          :key="option.code"
          :label="option.name"
          :value="option.name"
        />
      </el-select>
    </div>
    <div
      v-if="showTown"
      class="region-notice"
      role="status"
    >
      <InlineLoading
        v-if="loading"
        text="正在加载地区选项..."
      />
      <span v-else>{{ regionNotice }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useId, watch } from 'vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import InlineLoading from '@/components/InlineLoading.vue'
import {
  getCities,
  getDistricts,
  getProvinceName,
  normalizeRegion,
  provinces,
  loadRegionChildren,
  type RegionSelection,
  type RegionOption
} from '@/services/region-options'

interface Props {
  modelValue?: RegionSelection
  required?: boolean
  disabled?: boolean
  provinceDisabled?: boolean
  cityDisabled?: boolean
  districtDisabled?: boolean
  townDisabled?: boolean
  villageDisabled?: boolean
  hideProvince?: boolean
  hideCity?: boolean
  showDistrict?: boolean
  showTown?: boolean
  showVillage?: boolean
  error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ province: '', city: '', district: '' }),
  required: false,
  disabled: false,
  provinceDisabled: false,
  cityDisabled: false,
  districtDisabled: false,
  townDisabled: false,
  villageDisabled: false,
  hideProvince: false,
  hideCity: false,
  showDistrict: false,
  showTown: false,
  showVillage: false,
  error: false
})

const emit = defineEmits<{
  'update:modelValue': [value: RegionSelection]
  change: [value: RegionSelection]
}>()

const controlId = useId()
const selection = ref<RegionSelection>({ province: '', city: '', district: '' })
const remote = reactive<Record<keyof RegionSelection, RegionOption[]>>({ province: [], city: [], district: [], town: [], village: [] })
const loading = ref(false)
const regionNotice = ref('')
const { nextRequest, cancelLatest, isCanceledError } = useLatestRequest()
const availableProvinces = computed(() => remote.province.length
  ? [...remote.province, ...provinces.filter(option => !remote.province.some(item => item.code === option.code))]
  : provinces)
const cities = computed(() => remote.city.length ? remote.city : getCities(selection.value.province))
const districts = computed(() => remote.district.length ? remote.district : getDistricts(selection.value.province, selection.value.city))

watch(() => [props.showTown, selection.value.province, selection.value.city, selection.value.district, selection.value.town], async () => {
  cancelLatest()
  for (const field of ['province', 'city', 'district', 'town', 'village'] as const) remote[field] = []
  if (!props.showTown) { loading.value = false; return }
  const request = nextRequest()
  loading.value = true
  let parent = ''
  try {
    for (const field of ['province', 'city', 'district', 'town', 'village'] as const) {
      const data = await loadRegionChildren(parent, request.signal)
      if (!request.isLatest()) return
      // 存量直辖市 city 可能保存“北京市”，新目录称“市辖区”；保留旧值而继续下钻。
      const municipalityAlias = field === 'city' && ['11', '12', '31', '50'].includes(selection.value.province) &&
        selection.value.city === getProvinceName(selection.value.province)
      const options = municipalityAlias
        ? data.options.map(option => option.name === '市辖区' ? { ...option, name: selection.value.city } : option)
        : data.options
      remote[field] = options
      regionNotice.value = `地区数据版本：${data.version}；港澳台暂无乡镇、村级数据。`
      const chosen = options.find(option => option.code === selection.value[field] || option.name === selection.value[field])
      if (!chosen || field === 'village') break
      parent = chosen.code
    }
  } catch (error) {
    if (request.isLatest() && !isCanceledError(error)) regionNotice.value = '当前版本暂无该地区下级数据，或地区服务暂不可用；历史地址已保留，可重新选择上级重试。'
  } finally {
    if (request.isLatest()) loading.value = false
  }
}, { immediate: true })

const emitChange = () => {
  const value = { ...selection.value }
  emit('update:modelValue', value)
  emit('change', value)
}

const clearChildren = (fields: Array<keyof RegionSelection>) => {
  for (const field of fields) {
    // 旧三级调用不增加乡村属性，五级及已有乡村值必须随上级清空。
    if (['city', 'district'].includes(field) || selection.value[field] !== undefined ||
      (field === 'town' && props.showTown) || (field === 'village' && props.showVillage)) selection.value[field] = ''
  }
  emitChange()
}
const handleProvinceChange = () => clearChildren(['city', 'district', 'town', 'village'])
const handleCityChange = () => clearChildren(['district', 'town', 'village'])
const handleDistrictChange = () => clearChildren(['town', 'village'])
const handleTownChange = () => clearChildren(['village'])

// 回显兼容编码和名称，只更新控件，不在打开编辑时改写历史记录。
watch(() => props.modelValue, value => {
  selection.value = normalizeRegion(value)
}, { immediate: true, deep: true })

defineExpose({
  getProvinceName,
  reset: () => { selection.value = { province: '', city: '', district: '' } }
})
</script>

<style lang="scss" scoped>
.city-selector {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
  gap: var(--tf-space-4);
  align-items: stretch;

  .region-notice {
    flex-basis: 100%;
    color: var(--text-secondary);
    font-size: var(--tf-type-scale-12);
  }

  .form-group {
    flex: 1;
    min-width: 0;
    margin-bottom: 0;

    label {
      display: block;
      margin-bottom: var(--tf-space-2);
      font-weight: 500;
      color: var(--text-primary);
      font-size: var(--tf-type-scale-14);

      .required {
        color: var(--tf-color-red-500);
      }
    }

    .form-control {
      width: 100%;
    }

    .invalid-feedback {
      color: var(--tf-color-red-500);
      font-size: var(--tf-type-scale-12);
      margin-top: var(--tf-space-1);
    }
  }
}

@media (max-width: 767px) {
  .city-selector {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--tf-space-3) var(--tf-space-2);

    .form-group--wide,
    .region-notice,
    .form-group:last-child:nth-child(odd),
    .form-group:nth-child(odd):has(+ .region-notice),
    .form-group:nth-child(odd):has(+ .form-group--wide) {
      grid-column: 1 / -1;
    }

    .invalid-feedback {
      overflow-wrap: anywhere;
    }
  }
}
</style>
