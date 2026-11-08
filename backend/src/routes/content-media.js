'use strict'

const express = require('express')
const ContentMediaController = require('../controllers/content-media.controller')
const { unifiedAuth, requireAnyPermission } = require('../middleware/unified-auth')
const receiveContentMediaFile = require('../middleware/content-media-upload')

const router = express.Router()
const contentMediaController = new ContentMediaController()

router.post(
  '/',
  unifiedAuth,
  requireAnyPermission(['system:edit', 'guide:edit']),
  receiveContentMediaFile,
  contentMediaController.upload.bind(contentMediaController)
)

module.exports = router
