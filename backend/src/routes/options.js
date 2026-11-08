const express = require('express')
const router = express.Router()
const PhoneOptionController = require('../controllers/phone-option.controller')
const { unifiedAuth, requireAnyPermission } = require('../middleware/unified-auth')

const phoneOptionController = new PhoneOptionController()

router.use(unifiedAuth)

router.get('/phone-options', requireAnyPermission(['accessories:view', 'accessories:create']), phoneOptionController.getPhoneOptions.bind(phoneOptionController))

module.exports = router
