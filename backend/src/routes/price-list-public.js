/**
 * 价目表公开路由
 * 仅暴露无需登录的公开查询接口，避免与管理端路由重复挂载。
 */
const express = require('express');
const router = express.Router();
const priceListController = require('../controllers/price-list.controller');
const { cacheMiddleware } = require('../middleware/cache');

router.get('/all', cacheMiddleware({ ttl: 0 }), priceListController.getAllPrices);
router.get('/sales/all', cacheMiddleware({ ttl: 0 }), priceListController.getAllSalesPrices);
router.get('/sales/search/:keyword', cacheMiddleware({ ttl: 0 }), priceListController.searchSalesPrices);
router.get('/brands', cacheMiddleware({ ttl: 0 }), priceListController.getBrands);
router.get('/search/:keyword', cacheMiddleware({ ttl: 0 }), priceListController.searchPrices);
router.get('/brand/:brand', cacheMiddleware({ ttl: 0 }), priceListController.getPricesByBrand);

module.exports = router;
