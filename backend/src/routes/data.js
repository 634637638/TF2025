const express = require('express');
const router = express.Router();
const { getDatabase, isConnected, connectToDatabase, setConnected } = require('../config/database');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

// 模拟数据存储（用于数据库未连接时的降级方案）
let mockData = [
  { id: 1, name: '示例数据1', description: '这是第一条示例数据' },
  { id: 2, name: '示例数据2', description: '这是第二条示例数据' }
];
let nextId = 3;

// 获取数据列表
router.get('/', async (req, res) => {
  try {
    if (!isConnected()) {
      log.debug('数据库未连接，尝试重新连接...');
      const reconnected = await connectToDatabase(1);
      if (!reconnected) {
        return ApiResponse.success(res, []);
      }
    }
    
    const pool = getDatabase();
    const [rows] = await pool.execute('SELECT * FROM data_table');
    ApiResponse.success(res, rows);
  } catch (error) {
    log.error('获取数据失败:', error);
    if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      setConnected(false);
      return ApiResponse.success(res, []);
    }
    ApiResponse.success(res, []);
  }
});

// 创建数据
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return ApiResponse.error(res, '缺少必要参数: name 和 description', 400);
    }
    
    if (!isConnected()) {
      log.debug('数据库未连接，尝试重新连接...');
      const reconnected = await connectToDatabase(1);
      if (!reconnected) {
        const newItem = { id: nextId++, name, description };
        mockData.push(newItem);
        return ApiResponse.success(res, newItem, '创建成功', 201);
      }
    }
    
    const pool = getDatabase();
    const [result] = await pool.execute(
      'INSERT INTO data_table (name, description) VALUES (?, ?)',
      [name, description]
    );
    
    ApiResponse.success(res, { id: result.insertId, name, description }, '创建成功', 201);
  } catch (error) {
    log.error('添加数据失败:', error);
    if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      setConnected(false);
      const { name, description } = req.body;
      const newItem = { id: nextId++, name, description };
      mockData.push(newItem);
      return ApiResponse.success(res, newItem, '创建成功', 201);
    }
    ApiResponse.error(res, '添加数据失败', 500);
  }
});

// 更新数据
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    if (!name || !description) {
      return ApiResponse.error(res, '缺少必要参数: name 和 description', 400);
    }
    
    if (!isConnected()) {
      log.debug('数据库未连接，尝试重新连接...');
      const reconnected = await connectToDatabase(1);
      if (!reconnected) {
        const index = mockData.findIndex(item => item.id === parseInt(id));
        if (index !== -1) {
          mockData[index] = { id: parseInt(id), name, description };
          return ApiResponse.success(res, { id: parseInt(id), name, description });
        } else {
          return ApiResponse.error(res, '数据不存在', 404);
        }
      }
    }
    
    const pool = getDatabase();
    const [result] = await pool.execute(
      'UPDATE data_table SET name = ?, description = ? WHERE id = ?',
      [name, description, id]
    );
    
    if (result.affectedRows === 0) {
      return ApiResponse.error(res, '数据不存在', 404);
    }
    
    ApiResponse.success(res, { id: parseInt(id), name, description });
  } catch (error) {
    log.error('更新数据失败:', error);
    if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      setConnected(false);
      const { name, description } = req.body;
      const id = parseInt(req.params.id);
      const index = mockData.findIndex(item => item.id === id);
      if (index !== -1) {
        mockData[index] = { id, name, description };
        return ApiResponse.success(res, { id, name, description });
      } else {
        return ApiResponse.error(res, '数据不存在', 404);
      }
    }
    ApiResponse.error(res, '更新数据失败', 500);
  }
});

// 删除数据
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isConnected()) {
      log.debug('数据库未连接，尝试重新连接...');
      const reconnected = await connectToDatabase(1);
      if (!reconnected) {
        const index = mockData.findIndex(item => item.id === parseInt(id));
        if (index !== -1) {
          mockData.splice(index, 1);
          return ApiResponse.success(res, null, '删除成功');
        } else {
          return ApiResponse.error(res, '数据不存在', 404);
        }
      }
    }
    
    const pool = getDatabase();
    const [result] = await pool.execute('DELETE FROM data_table WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return ApiResponse.error(res, '数据不存在', 404);
    }
    
    ApiResponse.success(res, null, '删除成功');
  } catch (error) {
    log.error('删除数据失败:', error);
    if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
      setConnected(false);
      const index = mockData.findIndex(item => item.id === parseInt(req.params.id));
      if (index !== -1) {
        mockData.splice(index, 1);
        return ApiResponse.success(res, null, '删除成功');
      } else {
        return ApiResponse.error(res, '数据不存在', 404);
      }
    }
    ApiResponse.error(res, '删除数据失败', 500);
  }
});

module.exports = router;
