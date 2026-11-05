'use strict'

const PRODUCTION_RUNTIME_ENV = Object.freeze({
  NODE_ENV: 'production',
  ENV_FILE: '.env.production',
  PORT: '3000'
})

const configureProductionEnvironment = (env = process.env) => {
  Object.assign(env, PRODUCTION_RUNTIME_ENV)
  return env
}

if (require.main === module) {
  configureProductionEnvironment()
  require('./server')
}

module.exports = {
  PRODUCTION_RUNTIME_ENV,
  configureProductionEnvironment
}
