'use strict'

const express = require('express')
const GuidePublicController = require('../controllers/guide-public.controller')

const router = express.Router()
const guidePublicController = new GuidePublicController()

router.get('/', guidePublicController.list.bind(guidePublicController))
router.post('/categories/:id/unlock', guidePublicController.unlock.bind(guidePublicController))
router.get('/categories/:id', guidePublicController.getCategory.bind(guidePublicController))
router.get('/files/:id', guidePublicController.getFile.bind(guidePublicController))

module.exports = router
