module.exports = {
  apps: [{
    name: 'backend',
    script: './server.js',
    cwd: '/www/wwwroot/api2025.com/backend',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      ENV_FILE: '.env.production'
    },
    env_production: {
      NODE_ENV: 'production',
      ENV_FILE: '.env.production'
    },
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
