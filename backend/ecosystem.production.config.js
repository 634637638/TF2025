const { PRODUCTION_RUNTIME_ENV } = require('./start-production')

module.exports = {
  apps: [{
    name: 'backend',
    script: './start-production.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: { ...PRODUCTION_RUNTIME_ENV },
    env_production: { ...PRODUCTION_RUNTIME_ENV },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    restart_delay: 4000,
    kill_timeout: 5000,
    listen_timeout: 10000,
    ignore_watch: [
      'node_modules',
      'logs',
      'uploads',
      '.git'
    ]
  }]
}
