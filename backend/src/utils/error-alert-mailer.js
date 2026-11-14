'use strict'

const nodemailer = require('nodemailer')

// 独立 SMTP 连接，不携带站内 JWT/CSRF，不读取附件或 URL 内容。
const createErrorAlertMailer = (config, { createTransport = nodemailer.createTransport } = {}) => {
  const active = new Set()
  let closed = false

  return {
    send(message) {
      if (closed || !config.enabled) return Promise.reject(new Error('告警邮件未启用'))
      return new Promise((resolve, reject) => {
        let transport
        try { transport = createTransport(config.smtp) } catch {
          reject(new Error('告警邮件发送失败'))
          return
        }
        const controller = new AbortController()
        let settled = false
        const finish = (error, result) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          active.delete(cancel)
          if (error) controller.abort()
          try { transport.close() } catch { /* 连接释放不能覆盖发送结果。 */ }
          if (error) reject(new Error('告警邮件发送失败'))
          else resolve(result)
        }
        const cancel = () => finish(new Error('告警邮件发送已取消'))
        active.add(cancel)
        const timer = setTimeout(() => finish(new Error('告警邮件发送超时')), config.timeoutMs)

        Promise.resolve().then(() => settled ? null : transport.sendMail({
          from: { address: config.from },
          to: config.recipients.map(value => ({ address: value })),
          subject: message.subject,
          text: message.text,
          signal: controller.signal,
          disableFileAccess: true,
          disableUrlAccess: true
        })).then(info => {
          if (!info || info.accepted?.length !== config.recipients.length || info.rejected?.length) {
            finish(new Error('告警邮件未被完整接收'))
          } else {
            finish(null, { accepted: info.accepted.length })
          }
        }, error => finish(error))
      })
    },
    close() {
      closed = true
      for (const cancel of [...active]) cancel()
    }
  }
}

module.exports = { createErrorAlertMailer }
