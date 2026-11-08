'use strict'

/** HTTP 拒绝响应留在中间件；字段判定委托同一个 service。 */
const createFieldAccessMiddleware = service => ({
  rejectHiddenWrites: fieldMap => async (req, res, next) => {
    try {
      const field = await service.getDeniedWrite(req.user.id, req.body, fieldMap)
      if (!field) return next()
      return res.status(403).json({
        success: false, message: '不能修改已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field
      })
    } catch (error) {
      return next(error)
    }
  },
  requireVisibleField: fieldId => async (req, res, next) => {
    try {
      if (await service.isVisible(req.user.id, fieldId)) return next()
      return res.status(403).json({
        success: false, message: '无权访问已隐藏的字段', code: 'FIELD_PERMISSION_DENIED', field: fieldId
      })
    } catch (error) {
      return next(error)
    }
  }
})

module.exports = createFieldAccessMiddleware
