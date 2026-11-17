'use strict'

/** HTTP 拒绝响应留在中间件；字段判定委托同一个 service。 */
const createFieldAccessMiddleware = service => ({
  protectFields: fieldMap => async (req, res, next) => {
    try {
      const permissions = await service.getPermissions(req.user.id)
      req.fieldPermissions = permissions
      const denied = service.findDeniedWrite(req.body, fieldMap, permissions)
      if (denied) return res.status(403).json({
        success: false, message: '不能修改无编辑权限的字段', code: 'FIELD_PERMISSION_DENIED', field: denied
      })
      const json = res.json.bind(res)
      res.json = payload => json(service.maskPayload(payload, permissions))
      return next()
    } catch (error) { return next(error) }
  },
  rejectHiddenWrites: fieldMap => async (req, res, next) => {
    try {
      const field = await service.getDeniedWrite(req.user.id, req.body, fieldMap)
      if (!field) return next()
      return res.status(403).json({
        success: false, message: '不能修改无编辑权限的字段', code: 'FIELD_PERMISSION_DENIED', field
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
