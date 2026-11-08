'use strict'

class PriceListMaintenanceRepository {
  deletePriceItem(database, id) {
    return database.query('DELETE FROM price_list WHERE id = ?', [id])
  }

  allSyncConfigs(database) {
    return database.query('SELECT id FROM price_sync_config ORDER BY is_default DESC, id')
  }

  defaultSyncConfig(database) {
    return database.query(`
        SELECT id, config_name, login_username
        FROM price_sync_config
        WHERE is_default = 1
        LIMIT 1
      `)
  }

  findSyncLog(database, id) {
    return database.query('SELECT id FROM price_sync_log WHERE id = ?', [id])
  }

  deleteSyncLog(database, id) {
    return database.query('DELETE FROM price_sync_log WHERE id = ?', [id])
  }

  clearSyncLogs(database) {
    return database.query('TRUNCATE TABLE price_sync_log')
  }

  listBrands(database) {
    return database.query(`
        SELECT DISTINCT b.name as brand_name
        FROM price_list p
        INNER JOIN brands b ON p.brand_id = b.id
        WHERE p.status = 1
        ORDER BY b.name
      `)
  }

  deleteHistory(database, historyId, id) {
    return database.query('DELETE FROM price_history WHERE id = ? AND price_list_id = ?', [historyId, id])
  }

  deleteHistoryBatch(database, historyIds, id) {
    const placeholders = historyIds.map(() => '?').join(',')
    return database.query(`DELETE FROM price_history WHERE id IN (${placeholders}) AND price_list_id = ?`, [...historyIds, id])
  }

  clearHistory(database, id) {
    return database.query('DELETE FROM price_history WHERE price_list_id = ?', [id])
  }

  clearAllHistory(database) {
    return database.query('DELETE FROM price_history')
  }

  fixCollectionFlags(database) {
    return database.query(`
        UPDATE price_list
        SET is_collect = 1
        WHERE brand_id IS NOT NULL
          AND model_id IS NOT NULL
          AND color_id IS NOT NULL
      `)
  }

  clearPrices(database) {
    return database.query(`
        UPDATE price_list
        SET wholesale_price = 0,
            retail_price = 0,
            last_sync_time = NULL
        WHERE is_collect = 1
      `)
  }

  checkIphone16(database) {
    return database.query(`
        SELECT
          b.name as brand_name,
          m.name as model_number,
          c.name as color_name,
          mem.size as memory,
          COALESCE(pl.is_collect, 1) as is_collect,
          pl.id,
          pl.wholesale_price,
          pl.last_sync_time
        FROM price_list pl
        JOIN brands b ON pl.brand_id = b.id
        JOIN models m ON pl.model_id = m.id
        LEFT JOIN colors c ON pl.color_id = c.id
        LEFT JOIN memories mem ON pl.memory_id = mem.id
        WHERE m.name = 'iPhone 16'
        ORDER BY c.name, mem.size
      `)
  }

  updateIphone16Collection(database, is_collect) {
    return database.query(`
        UPDATE price_list pl
        JOIN models m ON pl.model_id = m.id
        SET pl.is_collect = ?
        WHERE m.name = 'iPhone 16'
      `, [is_collect])
  }

  iphone16Collection(database) {
    return database.query(`
        SELECT
          b.name as brand_name,
          m.name as model_number,
          c.name as color_name,
          mem.size as memory,
          COALESCE(pl.is_collect, 1) as is_collect,
          pl.id,
          pl.wholesale_price
        FROM price_list pl
        JOIN brands b ON pl.brand_id = b.id
        JOIN models m ON pl.model_id = m.id
        LEFT JOIN colors c ON pl.color_id = c.id
        LEFT JOIN memories mem ON pl.memory_id = mem.id
        WHERE m.name = 'iPhone 16'
        ORDER BY c.name, mem.size
      `)
  }
}

module.exports = PriceListMaintenanceRepository
