/** 测试专用资源管理：成功、准备失败、事务失败均回滚；回滚失败销毁连接。 */
async function withRollbackConnection(pool, run, prepare = async () => {}) {
  const connection = await pool.getConnection()
  const errors = []
  let result
  let reusable = true
  try {
    await prepare(connection)
    await connection.beginTransaction()
    result = await run(connection)
  } catch (error) {
    errors.push(error)
  } finally {
    try {
      await connection.rollback()
    } catch (error) {
      reusable = false
      errors.push(error)
    }
    try {
      if (reusable) connection.release()
      else connection.destroy()
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) throw new AggregateError(errors, '数据库测试执行/清理失败')
  return result
}

async function runConcurrentRollbackTasks(pool, count, run, prepare) {
  // 等待全部任务完成回滚/释放后才能关闭连接池，避免某个失败提前结束整批任务。
  const results = await Promise.allSettled(Array.from({ length: count }, () => withRollbackConnection(pool, run, prepare)))
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason)
  if (errors.length) {
    const codes = errors.map(error => error.code || error.name || 'Error').join(', ')
    throw new AggregateError(errors, `数据库并发测试失败，所有任务已完成清理（${codes}）`)
  }
  return results.map(result => result.value)
}

module.exports = { withRollbackConnection, runConcurrentRollbackTasks }
