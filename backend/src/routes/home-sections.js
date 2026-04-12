/**
 * H5首页推荐路由
 */

const express = require('express');
const router = express.Router();
const homeSectionService = require('../services/home-section.service');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

// ============================================================================
// 公开API（移动端使用）
// ============================================================================

/**
 * 获取所有启用的推荐区域及其商品
 * GET /api/public/home/sections
 */
router.get('/public/home/sections', async (req, res) => {
  try {
    const sections = await homeSectionService.getActiveSections();
    res.json({
      success: true,
      data: sections
    });
  } catch (error) {
    log.error('获取推荐区域失败:', error);
    res.status(500).json({
      success: false,
      message: '获取推荐区域失败'
    });
  }
});

// ============================================================================
// 管理API（需要认证）
// ============================================================================

/**
 * 获取所有推荐区域
 * GET /api/home/sections
 */
router.get('/home/sections', unifiedAuth, requirePermission('home-sections:view'), async (req, res) => {
  try {
    const sections = await homeSectionService.getAllSections();
    res.json({
      success: true,
      data: sections
    });
  } catch (error) {
    log.error('获取推荐区域失败:', error);
    res.status(500).json({
      success: false,
      message: '获取推荐区域失败'
    });
  }
});

/**
 * 创建推荐区域
 * POST /api/home/sections
 */
router.post('/home/sections', unifiedAuth, requirePermission('home-sections:create'), async (req, res) => {
  try {
    const section = await homeSectionService.createSection(req.body);
    res.json({
      success: true,
      data: section,
      message: '创建成功'
    });
  } catch (error) {
    log.error('创建推荐区域失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '创建失败'
    });
  }
});

/**
 * 更新推荐区域
 * PUT /api/home/sections/:id
 */
router.put('/home/sections/:id', unifiedAuth, requirePermission('home-sections:edit'), async (req, res) => {
  try {
    const section = await homeSectionService.updateSection(req.params.id, req.body);
    res.json({
      success: true,
      data: section,
      message: '更新成功'
    });
  } catch (error) {
    log.error('更新推荐区域失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新失败'
    });
  }
});

/**
 * 删除推荐区域
 * DELETE /api/home/sections/:id
 */
router.delete('/home/sections/:id', unifiedAuth, requirePermission('home-sections:delete'), async (req, res) => {
  try {
    await homeSectionService.deleteSection(req.params.id);
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    log.error('删除推荐区域失败:', error);
    res.status(500).json({
      success: false,
      message: '删除失败'
    });
  }
});

/**
 * 获取推荐区域的商品列表
 * GET /api/home/sections/:id/products
 */
router.get('/home/sections/:id/products', unifiedAuth, requirePermission('home-sections:view'), async (req, res) => {
  try {
    const products = await homeSectionService.getSectionProductsAdmin(req.params.id);
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    log.error('获取推荐商品失败:', error);
    res.status(500).json({
      success: false,
      message: '获取推荐商品失败'
    });
  }
});

/**
 * 添加商品到推荐区域
 * POST /api/home/sections/:id/products
 */
router.post('/home/sections/:id/products', unifiedAuth, requirePermission('home-sections:create'), async (req, res) => {
  try {
    await homeSectionService.addProductToSection(req.params.id, req.body);
    res.json({
      success: true,
      message: '添加成功'
    });
  } catch (error) {
    log.error('添加推荐商品失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '添加失败'
    });
  }
});

/**
 * 批量添加商品到推荐区域
 * POST /api/home/sections/:id/products/batch
 */
router.post('/home/sections/:id/products/batch', unifiedAuth, requirePermission('home-sections:create'), async (req, res) => {
  try {
    await homeSectionService.addProductsToSection(req.params.id, req.body.products);
    res.json({
      success: true,
      message: '批量添加成功'
    });
  } catch (error) {
    log.error('批量添加推荐商品失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '批量添加失败'
    });
  }
});

/**
 * 移除推荐商品
 * DELETE /api/home/sections/:sectionId/products/:productId
 */
router.delete('/home/sections/:sectionId/products/:productId', unifiedAuth, requirePermission('home-sections:delete'), async (req, res) => {
  try {
    await homeSectionService.removeProductFromSection(req.params.productId);
    res.json({
      success: true,
      message: '移除成功'
    });
  } catch (error) {
    log.error('移除推荐商品失败:', error);
    res.status(500).json({
      success: false,
      message: '移除失败'
    });
  }
});

/**
 * 更新推荐商品排序
 * PUT /api/home/sections/:sectionId/products/:productId/sort
 */
router.put('/home/sections/:sectionId/products/:productId/sort', unifiedAuth, requirePermission('home-sections:edit'), async (req, res) => {
  try {
    await homeSectionService.updateProductSort(req.params.productId, req.body.sort_order);
    res.json({
      success: true,
      message: '更新排序成功'
    });
  } catch (error) {
    log.error('更新排序失败:', error);
    res.status(500).json({
      success: false,
      message: '更新排序失败'
    });
  }
});

/**
 * 清空推荐区域的所有商品
 * DELETE /api/home/sections/:id/products
 */
router.delete('/home/sections/:id/products/clear', unifiedAuth, requirePermission('home-sections:delete'), async (req, res) => {
  try {
    await homeSectionService.clearSectionProducts(req.params.id);
    res.json({
      success: true,
      message: '清空成功'
    });
  } catch (error) {
    log.error('清空推荐商品失败:', error);
    res.status(500).json({
      success: false,
      message: '清空失败'
    });
  }
});

/**
 * 搜索可添加的商品
 * GET /api/home/products/search
 */
router.get('/home/products/search', unifiedAuth, requirePermission('home-sections:view'), async (req, res) => {
  try {
    const { keyword, type } = req.query;
    const products = await homeSectionService.searchProducts(keyword, type);
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    log.error('搜索商品失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索商品失败'
    });
  }
});

module.exports = router;
