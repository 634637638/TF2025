// 菜单API
export const menuApi = {
  // 获取菜单列表（树形结构）
  getList(params) {
    return unifiedApi.get('/menus', { params })
  },

  // 获取用户菜单（根据权限）- 统一使用 permissions/user-menu 接口
  getUserMenus() {
    return unifiedApi.get('/permissions/user-menu')
  },

  // 获取菜单详情
  getById(id) {
    return unifiedApi.get(`/menus/${id}`)
  },

  // 创建菜单
  create(data) {
    return unifiedApi.post('/menus', data)
  },

  // 更新菜单
  update(id, data) {
    return unifiedApi.put(`/menus/${id}`, data)
  },

  // 删除菜单
  delete(id) {
    return unifiedApi.delete(`/menus/${id}`)
  },

  // 更新菜单状态
  updateStatus(id, data) {
    return unifiedApi.patch(`/menus/${id}/status`, data)
  },

  // 批量更新菜单排序
  batchUpdateSort(data) {
    return unifiedApi.patch('/menus/sort', data)
  },

  // 复制菜单
  copy(id, data) {
    return unifiedApi.post(`/menus/${id}/copy`, data)
  },

  // 批量更新状态
  batchUpdateStatus(data) {
    return unifiedApi.patch('/menus/batch/status', data)
  },

  // 批量删除
  batchDelete(ids) {
    return unifiedApi.delete('/menus/batch', { data: { ids } })
  },

  // 导出Excel
  exportExcel() {
    return unifiedApi.get('/menus/export/excel', {
      responseType: 'blob'
    })
  },

  // 导入Excel
  importExcel(formData) {
    return unifiedApi.upload('/menus/import/excel', formData)
  },

  // 获取父菜单选项
  getParentOptions() {
    return unifiedApi.get('/menus/options/parents')
  },

  // 获取菜单统计信息
  getStats() {
    return unifiedApi.get('/menus/stats/overview')
  }
}