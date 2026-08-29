const express = require('express')
const router = express.Router()
const { getDatabase, isConnected, connectToDatabase, setConnected } = require('../config/database')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

const DATA_TABLE_UNAVAILABLE_MESSAGE = '数据服务暂不可用，请检查数据库连接'

const isConnectionError = (error) => error?.code === 'ECONNRESET' || error?.code === 'PROTOCOL_CONNECTION_LOST'

const respondDatabaseUnavailable = (res) => ApiResponse.error(res, DATA_TABLE_UNAVAILABLE_MESSAGE, 503)

router.use(unifiedAuth)

// 获取数据列表
router.get('/', requirePermission('data-check:view'), async (req, res) => {
  try {
    if (!isConnected()) {
      log.debug('数据库未连接，尝试重新连接...')
      const reconnected = await connectToDatabase(1)
      if (!reconnected) {
        return respondDatabaseUnavailable(res)
      }
    }
    
    const pool = getDatabase()
    const [rows] = await pool.execute('SELECT * FROM data_table')
    ApiResponse.success(res, rows)
  } catch (error) {
    log.error('获取数据失败:', error)
    if (isConnectionError(error)) {
      setConnected(false)
      return respondDatabaseUnavailable(res)
    }
    ApiResponse.error(res, '获取数据失败', 500)
  }
})

// 创建数据
router.post('/', requirePermission('data-check:edit'), async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name || !description) {
      return ApiResponse.error(res, '缺少必要参数: name 和 description', 400)
    }
    
    if (!isConnected()) {
      log.debug('数据库未连接，尝试重新连接...')
      const reconnected = await connectToDatabase(1)
      if (!reconnected) {
        return respondDatabaseUnavailable(res)
      }
    }
    
    const pool = getDatabase()
    const [result] = await pool.execute(
      'INSERT INTO data_table (name, description) VALUES (?, ?)',
      [name, description]
    )
    
    ApiResponse.success(res, { id: result.insertId, name, description }, '创建成功', 201)
  } catch (error) {
    log.error('添加数据失败:', error)
    if (isConnectionError(error)) {
      setConnected(false)
      return respondDatabaseUnavailable(res)
    }
    ApiResponse.error(res, '添加数据失败', 500)
  }
})

// 更新数据
router.put('/:id', requirePermission('data-check:edit'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, description } = req.body
    
    if (!name || !description) {
      return ApiResponse.error(res, '缺少必要参数: name 和 description', 400)
    }
    
    if (!isConnected()) {
      log.debug('数据库未连接，尝试重新连接...')
      const reconnected = await connectToDatabase(1)
      if (!reconnected) {
        return respondDatabaseUnavailable(res)
      }
    }
    
    const pool = getDatabase()
    const [result] = await pool.execute(
      'UPDATE data_table SET name = ?, description = ? WHERE id = ?',
      [name, description, id]
    )
    
    if (result.affectedRows === 0) {
      return ApiResponse.error(res, '数据不存在', 404)
    }
    
    ApiResponse.success(res, { id: parseInt(id), name, description })
  } catch (error) {
    log.error('更新数据失败:', error)
    if (isConnectionError(error)) {
      setConnected(false)
      return respondDatabaseUnavailable(res)
    }
    ApiResponse.error(res, '更新数据失败', 500)
  }
})

// 删除数据
router.delete('/:id', requirePermission('data-check:delete'), async (req, res) => {
  try {
    const { id } = req.params
    
    if (!isConnected()) {
      log.debug('数据库未连接，尝试重新连接...')
      const reconnected = await connectToDatabase(1)
      if (!reconnected) {
        return respondDatabaseUnavailable(res)
      }
    }
    
    const pool = getDatabase()
    const [result] = await pool.execute('DELETE FROM data_table WHERE id = ?', [id])
    
    if (result.affectedRows === 0) {
      return ApiResponse.error(res, '数据不存在', 404)
    }
    
    ApiResponse.success(res, null, '删除成功')
  } catch (error) {
    log.error('删除数据失败:', error)
    if (isConnectionError(error)) {
      setConnected(false)
      return respondDatabaseUnavailable(res)
    }
    ApiResponse.error(res, '删除数据失败', 500)
  }
})

module.exports = router
