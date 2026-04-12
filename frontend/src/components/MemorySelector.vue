<!--
  MemorySelector - 全新机内存选择对话框
  功能：显示模板下不同内存的商品供用户选择
-->
<template>
  <MobileDialog
    v-model="visible"
    title="选择内存规格"
    width="90%"
    :style="{ '--dialog-max-width': '500px' }"
    dialog-class="memory-selector-dialog"
    :show-default-footer="false"
    @close="handleClose"
  >
    <div v-if="template" class="memory-selector">
      <!-- 商品基本信息 -->
      <div class="product-summary">
        <Image :src="template.main_image" :alt="template.template_name" mode="eager" class="product-thumb" />
        <div class="product-info">
          <h4>{{ template.template_name || template.brand_name + ' ' + template.model_name + ' ' + template.color_name }}</h4>
          <p class="price-range">¥{{ minPrice }} - ¥{{ maxPrice }}</p>
        </div>
      </div>

      <!-- 内存选项列表 -->
      <div class="memory-options">
        <div
          v-for="option in memoryOptions"
          :key="option.phone_id"
          class="memory-option"
          :class="{ selected: selectedPhoneId === option.phone_id }"
          @click="selectMemory(option)"
        >
          <div class="option-info">
            <span class="memory-name">{{ option.memory_name }}</span>
            <span v-if="option.store_name" class="store-name">{{ option.store_name }}</span>
          </div>
          <div class="option-price">
            <span class="price">¥{{ option.sale_price }}</span>
            <span v-if="option.stock_count > 1" class="stock-count">库存{{ option.stock_count }}</span>
          </div>
        </div>

        <el-empty v-if="memoryOptions.length === 0" description="暂无可用规格" />
      </div>
    </div>

    <template #footer>
      <el-button type="default" @click="handleClose">取消</el-button>
      <el-button type="primary" :disabled="!selectedPhoneId" @click="handleConfirm">
        确定
      </el-button>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import Image from './Image.vue'
import type { ModelValueProps, UpdateModelValueEmits } from '@/types/component'
import { logger } from '@/utils/logger'

interface MemoryTemplate {
  id: number
  main_image?: string
  template_name?: string
  brand_name?: string
  model_name?: string
  color_name?: string
}

interface TemplatePhoneItem {
  id: number
  memory_id: number
  memory_name: string
  sale_price: number
  store_name?: string
}

interface MemoryOption {
  phone_id: number
  memory_id: number
  memory_name: string
  sale_price: number
  store_name?: string
  stock_count: number
}

interface TemplatePhonesResponse {
  success?: boolean
  data?: TemplatePhoneItem[]
}

// Props
interface Props extends ModelValueProps {
  template: MemoryTemplate | null
}

const props = defineProps<Props>()

interface Emits extends UpdateModelValueEmits {
  confirm: [phoneId: number | null]
}

const emit = defineEmits<Emits>()

// 状态
const visible = ref(false)
const selectedPhoneId = ref<number | null>(null)

// 内存选项（这里需要从后端API获取模板对应的手机列表）
const memoryOptions = ref<MemoryOption[]>([])

// 价格范围
const minPrice = computed(() => {
  if (memoryOptions.value.length === 0) return 0
  return Math.min(...memoryOptions.value.map(o => o.sale_price))
})

const maxPrice = computed(() => {
  if (memoryOptions.value.length === 0) return 0
  return Math.max(...memoryOptions.value.map(o => o.sale_price))
})

// 监听显示状态
watch(() => props.modelValue, (newVal) => {
  visible.value = newVal
  if (newVal && props.template) {
    loadMemoryOptions()
  } else {
    selectedPhoneId.value = null
    memoryOptions.value = []
  }
})

watch(visible, (newVal) => {
  emit('update:modelValue', newVal)
})

// 加载内存选项
const loadMemoryOptions = async () => {
  if (!props.template) return

  try {
    // 调用后端API获取模板下的商品列表（按内存分组）
    const response = await fetch(`/api/public/templates/${props.template.id}/phones`)
    const data = await response.json() as TemplatePhonesResponse

    if (data.success !== false && Array.isArray(data.data)) {
      // 按内存分组并合并相同内存的商品
      const grouped = new Map<number, MemoryOption>()

      data.data.forEach((phone) => {
        const key = phone.memory_id
        if (grouped.has(key)) {
          const existing = grouped.get(key)
          if (!existing) return
          existing.stock_count = (existing.stock_count || 1) + 1
          // 选择最低价
          if (phone.sale_price < existing.sale_price) {
            existing.sale_price = phone.sale_price
            existing.phone_id = phone.id
          }
        } else {
          grouped.set(key, {
            phone_id: phone.id,
            memory_id: phone.memory_id,
            memory_name: phone.memory_name,
            sale_price: phone.sale_price,
            store_name: phone.store_name,
            stock_count: 1
          })
        }
      })

      memoryOptions.value = Array.from(grouped.values()).sort((a, b) => {
        // 按内存大小排序
        const sizeA = parseFloat(a.memory_name) || 0
        const sizeB = parseFloat(b.memory_name) || 0
        return sizeA - sizeB
      })
    }
  } catch (error) {
    logger.error('加载内存选项失败:', error)
    ElMessage.error('加载规格失败')
  }
}

// 选择内存
const selectMemory = (option: MemoryOption) => {
  selectedPhoneId.value = option.phone_id
}

// 确认
const handleConfirm = () => {
  if (!selectedPhoneId.value) {
    ElMessage.warning('请选择内存规格')
    return
  }

  emit('confirm', selectedPhoneId.value)
  handleClose()
}

// 关闭
const handleClose = () => {
  visible.value = false
  selectedPhoneId.value = null
}
</script>

<style scoped lang="scss">
.memory-selector {
  padding: 8px 0;
}

// 商品摘要
.product-summary {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 16px;

  .product-thumb {
    width: 60px;
    height: 60px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .product-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;

    h4 {
      font-size: 14px;
      font-weight: 500;
      color: #333;
      margin: 0 0 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .price-range {
      font-size: 13px;
      color: #ff1744;
      margin: 0;
    }
  }
}

// 内存选项列表
.memory-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;

  .memory-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #ff6b00;
      background: #fff8f0;
    }

    &.selected {
      border-color: #ff6b00;
      background: #fff8f0;
      box-shadow: 0 0 0 2px rgba(255, 107, 0, 0.1);
    }

    .option-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .memory-name {
        font-size: 15px;
        font-weight: 500;
        color: #333;
      }

      .store-name {
        font-size: 12px;
        color: #999;
      }
    }

    .option-price {
      text-align: right;

      .price {
        display: block;
        font-size: 16px;
        font-weight: 500;
        color: #ff1744;
      }

      .stock-count {
        display: block;
        font-size: 11px;
        color: #999;
        margin-top: 2px;
      }
    }
  }
}
</style>
