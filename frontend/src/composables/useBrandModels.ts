/**
 * 品牌-型号管理 Composable
 * 提供品牌和型号的加载、缓存和联动功能
 */

import { ref, reactive } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { showElementError } from '@/utils/element-feedback'
import { sortOptionsByOrder } from '@/utils/option-sort'
import type { Brand, Model, Color, MemoryOption as Memory } from '@/types'

// 全局状态 - 使用响应式数据
const brands = ref<Brand[]>([])
const brandModels = reactive<Record<number, Model[]>>({})
const brandModelsLoading = reactive<Record<number, boolean>>({})
const colors = ref<Color[]>([])
const memories = ref<Memory[]>([])
const loading = ref(false)

/**
 * 品牌-型号管理 Composable
 */
export function useBrandModels() {
  // 加载品牌列表
  const loadBrands = async () => {
    try {
      const response = await unifiedApi.get('/brands?status=1&page_size=100')

      if (response.success) {
        let brandsData = response.data
        // 处理分页结构
        if (brandsData && typeof brandsData === 'object' && brandsData.data) {
          brandsData = brandsData.data
        }
        brands.value = (Array.isArray(brandsData) ? brandsData : [])
        brands.value = sortOptionsByOrder(brands.value)
        return brands.value
      } else {
        brands.value = []
        return []
      }
    } catch (error) {
      showElementError('品牌列表加载失败')
      brands.value = []
      return []
    }
  }

  // 加载指定品牌的型号
  const loadModelsForBrand = async (brandId: number, _brandName?: string) => {
    if (!brandId || brandModelsLoading[brandId]) {
      return brandModels[brandId] || []
    }

    brandModelsLoading[brandId] = true

    try {
      const response = await unifiedApi.get(`/brands/${brandId}/models`)

      if (response.success) {
        const modelsData = Array.isArray(response.data) ? response.data : []
        const formattedModels = sortOptionsByOrder<Model>(modelsData
          .map((model: Partial<Model>) => ({
            id: model.id,
            name: model.name,
            brand_id: model.brand_id,
            sort_order: model.sort_order || 0
          } as Model)))

        // 缓存型号数据
        brandModels[brandId] = formattedModels
        return formattedModels
      } else {
        brandModels[brandId] = []
        return []
      }
    } catch (error) {
      showElementError('型号列表加载失败')
      brandModels[brandId] = []
      return []
    } finally {
      brandModelsLoading[brandId] = false
    }
  }

  // 加载颜色列表
  const loadColors = async () => {
    try {
      const response = await unifiedApi.get('/colors?page_size=100&sort_by=sort_order&sort_order=asc')

      if (response.success) {
        let colorsData = response.data

        // 处理不同的响应数据结构
        if (colorsData && typeof colorsData === 'object') {
          if (colorsData.colors) {
            colorsData = colorsData.colors
          } else if (colorsData.data) {
            colorsData = colorsData.data
          }
        }

        colors.value = (Array.isArray(colorsData) ? colorsData : [])
        colors.value = sortOptionsByOrder(colors.value)
        return colors.value
      }
      colors.value = []
    } catch (error) {
      colors.value = []
      showElementError('颜色列表加载失败')
    }
    return colors.value
  }

  // 加载内存列表
  const loadMemories = async () => {
    try {
      const response = await unifiedApi.get('/memories?page_size=100&sort_by=sort_order&sort_order=asc')

      if (response.success) {
        let memoriesData = response.data

        // 处理不同的响应数据结构
        if (memoriesData && typeof memoriesData === 'object') {
          if (memoriesData.memories) {
            memoriesData = memoriesData.memories
          } else if (memoriesData.data) {
            memoriesData = memoriesData.data
          }
        }

        memories.value = (Array.isArray(memoriesData) ? memoriesData : [])
        memories.value = sortOptionsByOrder(memories.value, { labelKeys: ['size', 'capacity', 'name'] })
        return memories.value
      }
      memories.value = []
    } catch (error) {
      memories.value = []
      showElementError('容量列表加载失败')
    }
    return memories.value
  }

  // 批量加载所有基础数据
  const loadAll = async () => {
    loading.value = true
    try {
      const requests = [
        loadBrands(),
        loadColors(),
        loadMemories()
      ]

      await Promise.all(requests)
    } catch (error) {
      showElementError('基础数据加载失败')
    } finally {
      loading.value = false
    }
  }

  // 根据品牌名称获取品牌ID
  const getBrandIdByName = (brandName: string): number | null => {
    const brand = brands.value.find(b => b.name === brandName)
    return brand ? brand.id : null
  }

  // 根据品牌ID获取品牌名称
  const getBrandNameById = (brandId: number): string => {
    const brand = brands.value.find(b => b.id === brandId)
    return brand ? brand.name : ''
  }

  // 获取品牌的型号列表
  const getModelsForBrand = (brandId: number): Model[] => {
    return brandModels[brandId] || []
  }

  // 检查品牌型号是否正在加载
  const isModelsLoading = (brandId: number): boolean => {
    return brandModelsLoading[brandId] || false
  }

  // 预加载热门品牌的型号
  const preloadPopularModels = async () => {
    const popularBrandIds = brands.value.slice(0, 5).map(b => b.id)
    await Promise.all(
      popularBrandIds.map(brandId => loadModelsForBrand(brandId))
    )
  }

  // 清除缓存
  const clearCache = () => {
    Object.keys(brandModels).forEach(key => {
      delete brandModels[parseInt(key)]
    })
    Object.keys(brandModelsLoading).forEach(key => {
      delete brandModelsLoading[parseInt(key)]
    })
  }

  return {
    // 响应式数据
    brands,
    brandModels,
    brandModelsLoading,
    colors,
    memories,
    loading,

    // 方法
    loadBrands,
    loadModelsForBrand,
    loadColors,
    loadMemories,
    loadAll,

    // 工具方法
    getBrandIdByName,
    getBrandNameById,
    getModelsForBrand,
    isModelsLoading,
    preloadPopularModels,
    clearCache
  }
}

// 导出单例
export const brandModelsStore = useBrandModels()
