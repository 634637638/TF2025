<!--
  SmartProductDetail - 智能商品详情页路由组件
  根据 ID 类型自动判断是模板商品还是普通商品，然后加载对应的详情页
-->
<template>
  <div v-if="loading" class="loading-state">
    <el-icon class="is-loading"><Loading /></el-icon>
    <p>加载中...</p>
  </div>
  <ProductDetail v-else-if="isUsedProduct" :product-id="productId" />
  <AggregatedProductDetail v-else />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import ProductDetail from './ProductDetail.vue'
import AggregatedProductDetail from './AggregatedProductDetail.vue'
import { getProductDetail } from '@/api/shop-public'
import { logger } from '@/utils/logger'
const route = useRoute()
const loading = ref(true)
const isUsedProduct = ref(false)
const resolveSequence = ref(0)
const productId = computed(() => {
  const rawId = route.params.id as string | undefined
  const parsedId = Number.parseInt(rawId || '', 10)
  return Number.isNaN(parsedId) ? null : parsedId
})

const resolveProductType = async (id: number | null) => {
  const sequence = ++resolveSequence.value

  if (!id) {
    if (sequence === resolveSequence.value) {
      isUsedProduct.value = true
      loading.value = false
    }
    return
  }

  loading.value = true
  try {
    // 尝试获取商品详情
    const data: any = await getProductDetail(id)
    if (sequence !== resolveSequence.value) {
      return
    }

    // 判断是模板商品还是普通商品
    if (data.template_name) {
      // 模板商品 - 使用 AggregatedProductDetail
      isUsedProduct.value = false
    } else {
      // 普通商品（二手机）- 使用 ProductDetail
      isUsedProduct.value = true
    }
  } catch (error) {
    if (sequence !== resolveSequence.value) {
      return
    }
    logger.error('获取商品信息失败:', error)
    // 出错时默认使用 ProductDetail
    isUsedProduct.value = true
  } finally {
    if (sequence === resolveSequence.value) {
      loading.value = false
    }
  }
}

watch(productId, (id) => {
  void resolveProductType(id)
}, { immediate: true })
</script>

<style scoped lang="scss">
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 12px;
  color: #999;

  .el-icon {
    font-size: 32px;
    color: #667eea;
  }
}
</style>
