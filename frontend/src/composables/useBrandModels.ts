/**
 * 品牌-型号管理 Composable
 * 提供品牌和型号的加载、缓存和联动功能
 */

import { ref, reactive } from 'vue'
import { unifiedApi } from '@/utils/unified-api'
import { ElMessage } from 'element-plus'
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
      const response = await unifiedApi.get('/brands?status=1&limit=100&sortBy=sort_order&sortOrder=asc')

      if (response.success) {
        let brandsData = response.data
        // 处理分页结构
        if (brandsData && typeof brandsData === 'object' && brandsData.data) {
          brandsData = brandsData.data
        }
        // 按 sort_order 排序
        brands.value = (Array.isArray(brandsData) ? brandsData : [])
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        return brands.value
      } else {
        brands.value = []
        return []
      }
    } catch (error) {
      ElMessage.error('品牌列表加载失败')
      brands.value = []
      return []
    }
  }

  // 加载指定品牌的型号
  const loadModelsForBrand = async (brandId: number, brandName?: string) => {
    if (!brandId || brandModelsLoading[brandId]) {
      return brandModels[brandId] || []
    }

    brandModelsLoading[brandId] = true

    try {
      const response = await unifiedApi.get(`/brands/${brandId}/models`)

      if (response.success) {
        const modelsData = response.data || []
        const formattedModels = modelsData
          .map((model: any) => ({
            id: model.id,
            name: model.name,
            brand_id: model.brand_id,
            sort_order: model.sort_order || 0
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order)

        // 缓存型号数据
        brandModels[brandId] = formattedModels
        return formattedModels
      } else {
        brandModels[brandId] = []
        return []
      }
    } catch (error) {
      ElMessage.error('型号列表加载失败')
      brandModels[brandId] = []
      return []
    } finally {
      brandModelsLoading[brandId] = false
    }
  }

  // 加载颜色列表
  const loadColors = async () => {
    try {
      const response = await unifiedApi.get('/colors?limit=100&sortBy=sort_order&sortOrder=asc')

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

        // 按 sort_order 排序
        colors.value = (Array.isArray(colorsData) ? colorsData : [])
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        return colors.value
      }
    } catch (error) {
      // 如果API调用失败，使用模拟数据
      colors.value = [
        { id: 1, name: '深空黑色', value: '#1C1C1E' },
        { id: 2, name: '钛金属', value: '#8E8E93' },
        { id: 3, name: '粉红色', value: '#FF3B30' },
        { id: 4, name: '银色', value: '#F2F2F7' },
        { id: 5, name: '金色', value: '#FFD700' },
        { id: 6, name: '蓝色', value: '#007AFF' },
        { id: 7, name: '绿色', value: '#34C759' },
        { id: 8, name: '紫色', value: '#AF52DE' }
      ]
    }
    return colors.value
  }

  // 加载内存列表
  const loadMemories = async () => {
    try {
      const response = await unifiedApi.get('/memories?limit=100&sortBy=sort_order&sortOrder=asc')

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

        // 按 sort_order 排序
        memories.value = (Array.isArray(memoriesData) ? memoriesData : [])
          .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        return memories.value
      }
    } catch (error) {
      // 如果API调用失败，使用模拟数据
      memories.value = [
        { id: 1, name: '64GB', capacity: '64GB' },
        { id: 2, name: '128GB', capacity: '128GB' },
        { id: 3, name: '256GB', capacity: '256GB' },
        { id: 4, name: '512GB', capacity: '512GB' },
        { id: 5, name: '1TB', capacity: '1TB' },
        { id: 6, name: '2TB', capacity: '2TB' }
      ]
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
      ElMessage.error('基础数据加载失败')
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
