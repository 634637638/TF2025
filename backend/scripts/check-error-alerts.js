'use strict'

const { readErrorAlertConfig } = require('../src/config/error-alerts')
const { createErrorAlertMailer } = require('../src/utils/error-alert-mailer')

const checkErrorAlerts = async ({ config = readErrorAlertConfig(), sendTest = false, createMailer = createErrorAlertMailer } = {}) => {
  if (config.errors.length) throw new Error(config.errors.join('；'))
  const result = {
    production: config.production, enabled: config.enabled,
    recipientCount: config.recipients.length, threshold: config.threshold, sent: false
  }
  if (!sendTest) return result
  if (!config.enabled) throw new Error('邮件告警未启用，不能发送验收邮件')
  const mailer = createMailer(config)
  try {
    await mailer.send({ subject: '[TF2025] 故障告警验收邮件', text: '这是手动触发的生产邮件告警验收，请确认已收到此邮件。邮件不包含业务数据或认证凭据。' })
    result.sent = true
    return result
  } finally {
    mailer.close()
  }
}

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.some(value => !['--production', '--send-test'].includes(value))) {
    console.error('仅支持 --production 和 --send-test；默认只检查配置，不连接 SMTP。')
    process.exitCode = 1
  } else {
    if (args.includes('--production')) require('../start-production').configureProductionEnvironment()
    try {
      // 只复用配置加载与验证；不导入 app、不启动 HTTP、不建立数据库连接。
      require('../src/config')
      checkErrorAlerts({ sendTest: args.includes('--send-test') }).then(result => {
        console.log(JSON.stringify(result))
      }, () => {
        console.error('邮件告警检查或发送失败，请在服务器本机核对配置；未输出凭据。')
        process.exitCode = 1
      })
    } catch {
      console.error('后端运行配置加载失败，请在服务器本机核对环境文件；未输出凭据。')
      process.exitCode = 1
    }
  }
}

module.exports = { checkErrorAlerts }
