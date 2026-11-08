'use strict'

async function withConnection(databaseProvider, operation) {
  if (typeof operation !== 'function') throw new TypeError('withConnection requires an operation callback')
  const database = typeof databaseProvider === 'function'
    ? await databaseProvider()
    : await databaseProvider
  if (!database || typeof database.getConnection !== 'function') {
    throw new TypeError('withConnection requires a database with getConnection()')
  }

  const connection = await database.getConnection()
  try {
    return await operation(connection)
  } finally {
    connection.release()
  }
}

module.exports = { withConnection }
