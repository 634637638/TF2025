'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const nodemailer = require('nodemailer')
const { createErrorAlertMailer } = require('../src/utils/error-alert-mailer')

const config = {
  enabled: true, from: 'alerts@example.invalid', recipients: ['maintainer@example.invalid'], timeoutMs: 5000,
  smtp: { host: 'smtp.example.invalid', secure: true, requireTLS: true, tls: { rejectUnauthorized: true } }
}
const message = { subject: '[TF2025] synthetic alert', text: 'synthetic alert content' }

test('邮件独立适配器只使用 SMTP 配置和纯文本，禁用附件与 URL 读取', async t => {
  let options
  let sent
  let closes = 0
  const mailer = createErrorAlertMailer(config, {
    createTransport(value) {
      options = value
      return { async sendMail(value) { sent = value; return { accepted: config.recipients, rejected: [] } }, close() { closes++ } }
    }
  })
  t.after(() => mailer.close())
  assert.deepEqual(await mailer.send(message), { accepted: 1 })
  assert.equal(options, config.smtp)
  assert.deepEqual(sent.from, { address: config.from })
  assert.deepEqual(sent.to, [{ address: config.recipients[0] }])
  assert.equal(sent.text, message.text)
  assert.equal(sent.disableFileAccess, true)
  assert.equal(sent.disableUrlAccess, true)
  assert.equal('headers' in sent, false)
  assert.equal('attachments' in sent, false)
  assert.equal(closes, 1)
})

test('超时会中止实际发送信号并释放连接，迟到结果不能改变失败状态', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let sent
  let resolveMail
  let closes = 0
  const mailer = createErrorAlertMailer(config, {
    createTransport: () => ({
      sendMail(value) { sent = value; return new Promise(resolve => { resolveMail = resolve }) },
      close() { closes++ }
    })
  })
  t.after(() => mailer.close())
  const result = mailer.send(message)
  const rejection = assert.rejects(result, /告警邮件发送失败/)
  await Promise.resolve()
  t.mock.timers.tick(5000)
  await rejection
  assert.equal(sent.signal.aborted, true)
  assert.equal(closes, 1)
  resolveMail({ accepted: config.recipients, rejected: [] })
  await Promise.resolve()
  assert.equal(closes, 1)
})

test('关闭发生在微任务发送前时不启动 SMTP，关闭后也拒绝新发送', async () => {
  let calls = 0
  const mailer = createErrorAlertMailer(config, {
    createTransport: () => ({ sendMail() { calls++; return Promise.resolve({ accepted: config.recipients }) }, close() {} })
  })
  const result = mailer.send(message)
  const rejection = assert.rejects(result, /告警邮件发送失败/)
  mailer.close()
  await rejection
  assert.equal(calls, 0)
  await assert.rejects(mailer.send(message), /告警邮件未启用/)
})

test('SMTP 部分拒收或发送异常不会被误认为成功，也不回传底层秘密', async t => {
  for (const sendMail of [
    async () => ({ accepted: [], rejected: config.recipients }),
    async () => { throw new Error('synthetic-private-smtp-password') }
  ]) {
    const mailer = createErrorAlertMailer(config, { createTransport: () => ({ sendMail, close() {} }) })
    t.after(() => mailer.close())
    await assert.rejects(mailer.send(message), error => {
      assert.equal(error.message, '告警邮件发送失败')
      return true
    })
  }
})

test('使用真实 Nodemailer 纯内存生成邮件，不连接 SMTP 或真实收件人', async t => {
  let rendered
  const mailer = createErrorAlertMailer(config, {
    createTransport() {
      const stream = nodemailer.createTransport({ streamTransport: true, buffer: true })
      return {
        async sendMail(value) {
          const result = await stream.sendMail(value)
          rendered = result.message.toString()
          return { accepted: config.recipients, rejected: [] }
        },
        close() { stream.close() }
      }
    }
  })
  t.after(() => mailer.close())
  await mailer.send(message)
  assert.match(rendered, /Content-Type: text\/plain/)
  assert.match(rendered, /synthetic alert content/)
  assert.match(rendered, /maintainer@example.invalid/)
})

test('连接创建异常也只返回固定错误，不泄漏底层配置', async () => {
  const mailer = createErrorAlertMailer(config, {
    createTransport() { throw new Error('synthetic-private-transport-error') }
  })
  try {
    await assert.rejects(mailer.send(message), { message: '告警邮件发送失败' })
  } finally {
    mailer.close()
  }
})
