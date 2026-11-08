const PhoneOptionRepository = require('../repositories/phone-option.repository')

class PhoneOptionService {
  constructor(repository = new PhoneOptionRepository()) {
    this.repository = repository
  }

  async getPhoneOptions() {
    const {
      colors,
      memories,
      brands,
      models,
      actualModels,
      actualBrands,
      actualColors,
      actualMemories,
      purchaseNumbers,
      conditions,
      stores
    } = await this.repository.getOptionRows()

    const newConditions = [
      { value: 1, label: '全新' },
      { value: 0, label: '二手' }
    ]
    const capacityOptions = [
      ...memories.map(row => ({ id: row.id, size: String(row.size), sort_order: row.sort_order })),
      ...actualMemories.map(row => ({ id: row.id, size: String(row.memory), sort_order: row.sort_order }))
    ]
    const brandObjects = brands.map(row => ({
      id: row.id,
      name: String(row.name),
      sort_order: row.sort_order || 0,
      status: row.status
    }))
    const modelObjects = models.map(row => ({
      id: row.id,
      name: String(row.name),
      brand_id: row.brand_id,
      sort_order: row.sort_order || 0,
      status: row.status
    }))
    const colorObjects = colors.map(row => ({
      id: row.id,
      name: String(row.name),
      sort_order: row.sort_order || 0,
      status: 1
    }))
    const brandOptions = [
      ...brandObjects,
      ...actualBrands.map(row => ({ id: row.id, name: String(row.brand), sort_order: row.sort_order, status: 1 }))
    ]
    const modelOptions = [
      ...modelObjects,
      ...actualModels.map(row => ({ id: row.id, name: String(row.model), brand_id: row.brand_id, sort_order: row.sort_order, status: 1 }))
    ]
    const fullColorOptions = [
      ...colorObjects,
      ...actualColors.map(row => ({ id: row.id, name: String(row.color), sort_order: row.sort_order, status: 1 }))
    ]

    return {
      colors: fullColorOptions,
      memories: capacityOptions,
      brands: brandOptions,
      models: modelOptions,
      purchaseNumbers: purchaseNumbers.map(row => String(row.purchase_number)),
      conditions: conditions.map(row => String(row.quality_grade)),
      stores: stores.map(row => ({
        id: row.id,
        name: String(row.name),
        sort_order: row.sort_order || 0
      })),
      newConditions
    }
  }
}

module.exports = PhoneOptionService
