'use strict'

const express = require('express')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const HomeSectionController = require('../controllers/home-section.controller')

const router = express.Router()
const homeSectionController = new HomeSectionController()

router.get('/public/home/sections', homeSectionController.getActiveSections.bind(homeSectionController))
router.get('/home/sections', unifiedAuth, requirePermission('home-sections:view'), homeSectionController.getAllSections.bind(homeSectionController))
router.post('/home/sections', unifiedAuth, requirePermission('home-sections:create'), homeSectionController.createSection.bind(homeSectionController))
router.put('/home/sections/:id', unifiedAuth, requirePermission('home-sections:edit'), homeSectionController.updateSection.bind(homeSectionController))
router.delete('/home/sections/:id', unifiedAuth, requirePermission('home-sections:delete'), homeSectionController.deleteSection.bind(homeSectionController))
router.get('/home/sections/:id/products', unifiedAuth, requirePermission('home-sections:view'), homeSectionController.getSectionProducts.bind(homeSectionController))
router.post('/home/sections/:id/products', unifiedAuth, requirePermission('home-sections:create'), homeSectionController.addProduct.bind(homeSectionController))
router.post('/home/sections/:id/products/batch', unifiedAuth, requirePermission('home-sections:create'), homeSectionController.addProducts.bind(homeSectionController))
router.delete('/home/sections/:sectionId/products/:productId', unifiedAuth, requirePermission('home-sections:delete'), homeSectionController.removeProduct.bind(homeSectionController))
router.put('/home/sections/:sectionId/products/:productId/sort', unifiedAuth, requirePermission('home-sections:edit'), homeSectionController.updateProductSort.bind(homeSectionController))
router.delete('/home/sections/:id/products/clear', unifiedAuth, requirePermission('home-sections:delete'), homeSectionController.clearSectionProducts.bind(homeSectionController))
router.get('/home/products/search', unifiedAuth, requirePermission('home-sections:view'), homeSectionController.searchProducts.bind(homeSectionController))

module.exports = router
