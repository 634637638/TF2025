/**
 * 价目表控制器
 */
const { getDatabase } = require('../config/database');
const ApiResponse = require('../utils/response');
const XLSX = require('xlsx');
const log = require('../utils/log');

function getPriceListService() {
  return require('../services/price-list.service');
}

function getScheduler() {
  return require('../scripts/price-sync-scheduler');
}

const parseNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const normalized = typeof value === 'string'
    ? value.replace(/[,%\s]/g, '')
    : value;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseFlag = (value, defaultValue = 1, truthyLabels = ['1', 'true', '是', '启用', '显示', '采集']) => {
  if (value === '' || value === null || value === undefined) {
    return defaultValue;
  }

  const normalized = String(value).trim();
  return truthyLabels.includes(normalized) ? 1 : 0;
};

// 初始化数据库连接（延迟初始化）
let dbInitialized = false;
function initDb() {
  if (!dbInitialized) {
    try {
      const db = getDatabase();
      if (!db) {
        log.warn('数据库连接尚未就绪，将在首次请求时重试');
        return false;
      }
      const priceListService = getPriceListService();
      priceListService.setDatabase(db);
      dbInitialized = true;
      log.success('价格列表服务数据库连接已初始化');
      return true;
    } catch (error) {
      log.warn('价格列表服务数据库初始化暂时失败:', error.message);
      return false;
    }
  }
  return true;
}

async function restartPriceSyncScheduler(reason) {
  try {
    const scheduler = getScheduler();
    await scheduler.restartAllJobs();
    log.success(`价格同步调度器已重启: ${reason}`);
  } catch (error) {
    log.error(`重新加载价格同步调度器失败 (${reason}):`, error);
  }
}

class PriceListController {
  /**
   * 获取价格列表
   */
  async getPriceList(req, res) {
    try {
      initDb();
      const priceListService = getPriceListService();
      const result = await priceListService.getPriceList(req.query);
      return ApiResponse.success(res, result.data, result.message);
    } catch (error) {
      log.error('获取价格列表失败:', error);
      return ApiResponse.error(res, '获取价格列表失败', 500);
    }
  }

  async exportPriceList(req, res) {
    try {
      initDb();
      const priceListService = getPriceListService();
      const result = await priceListService.getPriceList({
        ...req.query,
        page: 1,
        limit: 10000
      });

      if (!result.success) {
        return ApiResponse.error(res, result.message || '导出价格列表失败', 400);
      }

      const rows = (result.data?.list || []).map((item) => ({
        品牌: item.brand_name || '',
        型号: item.model_number || '',
        颜色: item.color_name || '',
        内存: item.memory || '',
        库存数量: item.stock_quantity || 0,
        零售价: item.retail_price || 0,
        批发价: item.wholesale_price || 0,
        采集状态: Number(item.is_collect) === 1 ? '采集' : '不采集',
        显示状态: Number(item.show_price) === 1 ? '显示' : '隐藏',
        状态: Number(item.status) === 1 ? '启用' : '停用',
        外部型号: item.external_model || '',
        最后同步时间: item.last_sync_time || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      const beijingDate = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date()).replace(/\//g, '-');

      XLSX.utils.book_append_sheet(workbook, worksheet, '报价管理');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(`报价管理_${beijingDate}.xlsx`)}`
      );

      return res.send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    } catch (error) {
      log.error('导出价格列表失败:', error);
      return ApiResponse.error(res, '导出价格列表失败', 500);
    }
  }

  async importPriceList(req, res) {
    try {
      initDb();
      const priceListService = getPriceListService();

      if (!req.file?.buffer) {
        return ApiResponse.error(res, '请选择要导入的 Excel 文件', 400);
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      if (!Array.isArray(rows) || rows.length === 0) {
        return ApiResponse.error(res, '导入文件没有有效数据', 400);
      }

      let imported = 0;
      let failed = 0;
      const errors = [];

      for (const [index, row] of rows.entries()) {
        const brand_name = String(row['品牌'] || row['brand_name'] || '').trim();
        const model_number = String(row['型号'] || row['model_number'] || '').trim();

        if (!brand_name || !model_number) {
          failed += 1;
          errors.push(`第 ${index + 2} 行缺少品牌或型号`);
          continue;
        }

        const payload = {
          brand_name,
          model_number,
          color_name: String(row['颜色'] || row['color_name'] || '').trim() || null,
          memory: String(row['内存'] || row['memory'] || '').trim() || null,
          external_model: String(row['外部型号'] || row['external_model'] || '').trim() || null,
          retail_price: parseNullableNumber(row['零售价'] ?? row['retail_price']),
          wholesale_price: parseNullableNumber(row['批发价'] ?? row['wholesale_price']),
          stock_quantity: parseNullableNumber(row['库存数量'] ?? row['stock_quantity']) ?? 0,
          is_collect: parseFlag(row['采集状态'] ?? row['is_collect'], 1),
          show_price: parseFlag(row['显示状态'] ?? row['show_price'], 0, ['1', 'true', '是', '启用', '显示']),
          status: parseFlag(row['状态'] ?? row['status'], 1, ['1', 'true', '是', '启用']),
          last_sync_time: String(row['最后同步时间'] || row['last_sync_time'] || '').trim() || null,
          is_manual_edit: true
        };

        const result = await priceListService.upsertPriceItem(payload, null, {
          allowCreate: true,
          isManualEdit: true,
          changeReason: 'import'
        });

        if (result.success) {
          imported += 1;
        } else {
          failed += 1;
          errors.push(`第 ${index + 2} 行导入失败: ${result.message || '未知错误'}`);
        }
      }

      return ApiResponse.success(res, {
        imported,
        failed,
        errors: errors.slice(0, 20)
      }, `价目表导入完成，成功 ${imported} 条，失败 ${failed} 条`);
    } catch (error) {
      log.error('导入价格列表失败:', error);
      return ApiResponse.error(res, '导入价格列表失败', 500);
    }
  }

  /**
   * 根据品牌获取价格（公开接口）
   */
  async getPricesByBrand(req, res) {
    try {
      const { brand } = req.params;
      const priceListService = getPriceListService();
      const result = await priceListService.getPricesByBrand(brand);
      return ApiResponse.success(res, result.data, result.message);
    } catch (error) {
      log.error('获取品牌价格失败:', error);
      return ApiResponse.error(res, '获取价格失败', 500);
    }
  }

  /**
   * 获取所有价格（公开接口，用于首页默认展示）
   */
  async getAllPrices(req, res) {
    try {
      const priceListService = getPriceListService();
      const result = await priceListService.getAllPrices();
      return ApiResponse.success(res, result.data, result.message);
    } catch (error) {
      log.error('获取所有价格失败:', error);
      return ApiResponse.error(res, '获取价格失败', 500);
    }
  }

  /**
   * 获取销售价格（公开接口，显示所有有价格的商品，不限采集状态）
   */
  async getAllSalesPrices(req, res) {
    try {
      const priceListService = getPriceListService();
      const result = await priceListService.getAllSalesPrices();
      return ApiResponse.success(res, result.data, result.message);
    } catch (error) {
      log.error('获取销售价格失败:', error);
      return ApiResponse.error(res, '获取销售价格失败', 500);
    }
  }

  /**
   * 搜索销售价格（公开接口，不限采集状态）
   */
  async searchSalesPrices(req, res) {
    try {
      const { keyword } = req.params;
      if (!keyword || keyword.length < 2) {
        return ApiResponse.error(res, '搜索关键词至少2个字符', 400);
      }
      const priceListService = getPriceListService();
      const result = await priceListService.searchSalesPrices(keyword);
      return ApiResponse.success(res, result.data, result.message);
    } catch (error) {
      log.error('搜索销售价格失败:', error);
      return ApiResponse.error(res, '搜索失败', 500);
    }
  }

  /**
   * 搜索价格（公开接口）
   */
  async searchPrices(req, res) {
    try {
      const { keyword } = req.params;
      if (!keyword || keyword.length < 2) {
        return ApiResponse.error(res, '搜索关键词至少2个字符', 400);
      }
      const priceListService = getPriceListService();
      const result = await priceListService.searchPrices(keyword);
      return ApiResponse.success(res, result.data, result.message);
    } catch (error) {
      log.error('搜索价格失败:', error);
      return ApiResponse.error(res, '搜索失败', 500);
    }
  }

  /**
   * 创建/更新价格记录
   */
  async upsertPriceItem(req, res) {
    try {
      initDb();
      const priceListService = getPriceListService();
      const result = await priceListService.upsertPriceItem(req.body);
      if (result.success) {
        return ApiResponse.success(res, result.data, result.message);
      }
      return ApiResponse.error(res, result.message, 400);
    } catch (error) {
      log.error('保存价格记录失败:', error);
      return ApiResponse.error(res, '保存失败', 500);
    }
  }

  /**
   * 删除价格记录
   */
  async deletePriceItem(req, res) {
    try {
      initDb();
      const db = getDatabase();
      const { id } = req.params;
      await db.query('DELETE FROM price_list WHERE id = ?', [id]);
      return ApiResponse.success(res, null, '删除成功');
    } catch (error) {
      log.error('删除价格记录失败:', error);
      return ApiResponse.error(res, '删除失败', 500);
    }
  }

  /**
   * 获取同步配置
   */
  async getSyncConfig(req, res) {
    try {
      initDb();
      const priceListService = getPriceListService();
      // 支持 hidePassword 参数，默认为 true（隐藏密码）
      const hidePassword = req.query.hidePassword !== 'false' && req.query.hidePassword !== false;
      const result = await priceListService.getSyncConfig(hidePassword);
      if (result.success) {
        return ApiResponse.success(res, result.data, result.message);
      }
      return ApiResponse.error(res, result.message, 404);
    } catch (error) {
      log.error('获取同步配置失败:', error);
      return ApiResponse.error(res, '获取配置失败', 500);
    }
  }

  /**
   * 更新同步配置
   */
  async updateSyncConfig(req, res) {
    try {
      initDb();
      const priceListService = getPriceListService();
      const result = await priceListService.updateSyncConfig(req.body);
      if (result.success) {
        await restartPriceSyncScheduler('更新默认同步配置');
        return ApiResponse.success(res, null, result.message);
      }
      return ApiResponse.error(res, result.message, 400);
    } catch (error) {
      log.error('更新同步配置失败:', error);
      return ApiResponse.error(res, '更新配置失败', 500);
    }
  }

  /**
   * 获取所有同步配置列表
   */
  async getAllSyncConfigs(req, res) {
    try {
      initDb();
      const priceListService = getPriceListService();
      const result = await priceListService.getAllSyncConfigs();
      if (result.success) {
        return ApiResponse.success(res, result.data, result.message);
      }
      return ApiResponse.error(res, result.message, 404);
    } catch (error) {
      log.error('获取同步配置列表失败:', error);
      return ApiResponse.error(res, '获取配置列表失败', 500);
    }
  }

  /**
   * 创建新的同步配置
   */
  async createSyncConfig(req, res) {
    try {
      initDb();
      const priceListService = getPriceListService();
      const result = await priceListService.createSyncConfig(req.body);
      if (result.success) {
        await restartPriceSyncScheduler('新增同步配置');
        return ApiResponse.success(res, null, result.message);
      }
      return ApiResponse.error(res, result.message, 400);
    } catch (error) {
      log.error('创建同步配置失败:', error);
      return ApiResponse.error(res, '创建配置失败', 500);
    }
  }

  /**
   * 设置默认同步配置
   */
  async setDefaultSyncConfig(req, res) {
    try {
      initDb();
      const { configId } = req.params;
      const priceListService = getPriceListService();
      const result = await priceListService.setDefaultSyncConfig(configId);
      if (result.success) {
        await restartPriceSyncScheduler(`切换默认同步配置: ${configId}`);
        return ApiResponse.success(res, null, result.message);
      }
      return ApiResponse.error(res, result.message, 400);
    } catch (error) {
      log.error('设置默认配置失败:', error);
      return ApiResponse.error(res, '设置默认配置失败', 500);
    }
  }

  /**
   * 删除同步配置
   */
  async deleteSyncConfig(req, res) {
    try {
      initDb();
      const { configId } = req.params;
      const priceListService = getPriceListService();
      const result = await priceListService.deleteSyncConfig(configId);
      if (result.success) {
        await restartPriceSyncScheduler(`删除同步配置: ${configId}`);
        return ApiResponse.success(res, null, result.message);
      }
      return ApiResponse.error(res, result.message, 400);
    } catch (error) {
      log.error('删除同步配置失败:', error);
      return ApiResponse.error(res, '删除配置失败', 500);
    }
  }

  /**
   * 获取指定ID的同步配置（用于编辑，包含密码）
   */
  async getSyncConfigById(req, res) {
    try {
      initDb();
      const { configId } = req.params;
      const priceListService = getPriceListService();
      const result = await priceListService.getSyncConfigById(configId);
      if (result.success) {
        return ApiResponse.success(res, result.data, result.message);
      }
      return ApiResponse.error(res, result.message, 404);
    } catch (error) {
      log.error('获取同步配置详情失败:', error);
      return ApiResponse.error(res, '获取配置详情失败', 500);
    }
  }

  /**
   * 更新指定ID的同步配置
   */
  async updateSyncConfigById(req, res) {
    try {
      initDb();
      const { configId } = req.params;
      const priceListService = getPriceListService();
      const result = await priceListService.updateSyncConfigById(configId, req.body);
      if (result.success) {
        await restartPriceSyncScheduler(`更新同步配置: ${configId}`);
        return ApiResponse.success(res, null, result.message);
      }
      return ApiResponse.error(res, result.message, 400);
    } catch (error) {
      log.error('更新同步配置失败:', error);
      return ApiResponse.error(res, '更新配置失败', 500);
    }
  }

  /**
   * 手动触发同步
   */
  async triggerSync(req, res) {
    try {
      initDb();
      const userId = req.user?.id || null;
      const priceListService = getPriceListService();

      // 获取当前默认的配置ID（使用 is_default 字段）
      const db = getDatabase();
      const [configs] = await db.query(`
        SELECT id, config_name, login_username
        FROM price_sync_config
        WHERE is_default = 1
        LIMIT 1
      `);

      if (configs.length === 0) {
        log.warn('未找到默认的同步配置');
        return ApiResponse.error(res, '未找到默认的同步配置，请先在价格列表中配置同步账户', 400);
      }

      const configId = configs[0].id;
      const configInfo = {
        id: configs[0].id,
        name: configs[0].config_name,
        username: configs[0].login_username
      };

      log.start(`[手动触发同步] 使用配置: ID=${configInfo.id}, 名称=${configInfo.name}, 账户=${configInfo.username}`);

      const result = await priceListService.executeSync(configId, 'manual', userId);
      if (result.success) {
        return ApiResponse.success(res, result.data, result.message);
      }
      return ApiResponse.error(res, result.message, 400);
    } catch (error) {
      log.error('触发同步失败:', error);
      return ApiResponse.error(res, '同步失败: ' + error.message, 500);
    }
  }

  /**
   * 获取同步日志
   */
  async getSyncLogs(req, res) {
    try {
      initDb();
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const priceListService = getPriceListService();
      const result = await priceListService.getSyncLogs(page, limit);
      return ApiResponse.success(res, result.data, result.message);
    } catch (error) {
      log.error('获取同步日志失败:', error);
      return ApiResponse.error(res, '获取日志失败', 500);
    }
  }

  /**
   * 删除同步日志
   */
  async deleteSyncLog(req, res) {
    try {
      initDb();
      const db = getDatabase();
      const { id } = req.params;
      
      // 检查日志是否存在
      const [logs] = await db.query('SELECT id FROM price_sync_log WHERE id = ?', [id]);
      if (logs.length === 0) {
        return ApiResponse.error(res, '日志不存在', 404);
      }
      
      await db.query('DELETE FROM price_sync_log WHERE id = ?', [id]);
      return ApiResponse.success(res, null, '删除成功');
    } catch (error) {
      log.error('删除同步日志失败:', error);
      return ApiResponse.error(res, '删除失败', 500);
    }
  }

  /**
   * 清空同步日志
   */
  async clearSyncLogs(req, res) {
    try {
      initDb();
      const db = getDatabase();
      
      await db.query('DELETE FROM price_sync_log');
      return ApiResponse.success(res, null, '清空成功');
    } catch (error) {
      log.error('清空同步日志失败:', error);
      return ApiResponse.error(res, '清空失败', 500);
    }
  }

  /**
   * 获取价格历史
   */
  async getPriceHistory(req, res) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const priceListService = getPriceListService();
      const result = await priceListService.getPriceHistory(id, limit);
      if (result.success) {
        return ApiResponse.success(res, result.data, result.message);
      }
      return ApiResponse.error(res, result.message, 404);
    } catch (error) {
      log.error('获取价格历史失败:', error);
      return ApiResponse.error(res, '获取历史失败', 500);
    }
  }

  /**
   * 获取品牌列表（用于筛选）
   */
  async getBrands(req, res) {
    try {
      initDb();
      const db = getDatabase();
      const [rows] = await db.query(`
        SELECT DISTINCT b.name as brand_name
        FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        WHERE p.status = 1
        ORDER BY b.name
      `);
      const brands = rows.map(row => row.brand_name);
      return ApiResponse.success(res, '获取成功', brands);
    } catch (error) {
      log.error('获取品牌列表失败:', error);
      return ApiResponse.error(res, '获取品牌列表失败', 500);
    }
  }

  /**
   * 删除单条价格历史记录
   */
  async deletePriceHistory(req, res) {
    try {
      initDb();
      const db = getDatabase();
      const { id } = req.params;
      const { historyId } = req.params;

      await db.query(
        'DELETE FROM price_history WHERE id = ? AND price_list_id = ?',
        [historyId, id]
      );

      return ApiResponse.success(res, null, '删除成功');
    } catch (error) {
      log.error('删除价格历史失败:', error);
      return ApiResponse.error(res, '删除失败', 500);
    }
  }

  /**
   * 批量删除价格历史记录
   */
  async batchDeletePriceHistory(req, res) {
    try {
      initDb();
      const db = getDatabase();
      const { id } = req.params;
      const { historyIds } = req.body;

      if (!Array.isArray(historyIds) || historyIds.length === 0) {
        return ApiResponse.error(res, '无效的历史记录ID列表', 400);
      }

      const placeholders = historyIds.map(() => '?').join(',');
      await db.query(
        `DELETE FROM price_history WHERE id IN (${placeholders}) AND price_list_id = ?`,
        [...historyIds, id]
      );

      return ApiResponse.success(res, null, `成功删除 ${historyIds.length} 条记录`);
    } catch (error) {
      log.error('批量删除价格历史失败:', error);
      return ApiResponse.error(res, '批量删除失败', 500);
    }
  }

  /**
   * 清空价格历史记录
   */
  async clearPriceHistory(req, res) {
    try {
      initDb();
      const db = getDatabase();
      const { id } = req.params;

      const [result] = await db.query(
        'DELETE FROM price_history WHERE price_list_id = ?',
        [id]
      );

      return ApiResponse.success(res, { deletedCount: result.affectedRows }, '清空成功');
    } catch (error) {
      log.error('清空价格历史失败:', error);
      return ApiResponse.error(res, '清空失败', 500);
    }
  }

  /**
   * 清空所有价格历史记录
   */
  async clearAllPriceHistory(req, res) {
    try {
      initDb();
      const db = getDatabase();

      const [result] = await db.query('DELETE FROM price_history');

      return ApiResponse.success(res, { deletedCount: result.affectedRows }, '清理成功');
    } catch (error) {
      log.error('清空全部价格历史失败:', error);
      return ApiResponse.error(res, '清理失败', 500);
    }
  }

  /**
   * 修复 is_collect 状态（临时方法）
   */
  async fixIsCollect(req, res) {
    try {
      initDb();
      const db = getDatabase();

      const [result] = await db.query(`
        UPDATE price_list
        SET is_collect = 1
        WHERE brand_id IS NOT NULL
          AND model_id IS NOT NULL
          AND color_id IS NOT NULL
      `);

      return ApiResponse.success(res, { updatedCount: result.affectedRows }, '修复成功');
    } catch (error) {
      log.error('修复 is_collect 失败:', error);
      return ApiResponse.error(res, '修复失败', 500);
    }
  }

  /**
   * 一键清零所有采集价格
   */
  async clearPrices(req, res) {
    try {
      initDb();
      const db = getDatabase();

      // 清零批发价和零售价
      const [result] = await db.query(`
        UPDATE price_list
        SET wholesale_price = 0,
            retail_price = 0,
            last_sync_time = NULL
        WHERE is_collect = 1
      `);

      return ApiResponse.success(res, { updatedCount: result.affectedRows }, `已清零 ${result.affectedRows} 条价格记录`);
    } catch (error) {
      log.error('清零价格失败:', error);
      return ApiResponse.error(res, '清零失败', 500);
    }
  }
}

module.exports = new PriceListController();
