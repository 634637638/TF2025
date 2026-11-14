'use strict'

const router = require('express').Router()
const { unifiedAuth } = require('../middleware/unified-auth')
const RegionController = require('../controllers/region.controller')
const controller = new RegionController()

// 公共基础地区选项不含客户信息；沿用站内登录认证，不新增模块权限或外站请求。
router.get('/', unifiedAuth, controller.children.bind(controller))

module.exports = router
