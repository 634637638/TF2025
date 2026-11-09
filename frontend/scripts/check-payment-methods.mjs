import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const frontendRoot = resolve(import.meta.dirname, '..')
const sharedPath = resolve(frontendRoot, '../backend/src/config/payment-methods.json')

export function loadPaymentMethods(shared = JSON.parse(readFileSync(sharedPath, 'utf8'))) {
  const filename = resolve(frontendRoot, 'src/constants/paymentMethods.ts')
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText
  const exports = {}
  const require = createRequire(filename)
  runInNewContext(source, {
    exports,
    require: id => id.endsWith('/payment-methods.json') ? shared : require(id)
  }, { filename, timeout: 1000 })
  return exports
}

export function auditPaymentMethods(config, shared) {
  const findings = []
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
  const expectedSales = ['cash', 'mobile', 'bank_card', 'subsidy_card']
  for (const key of ['SALE_PAYMENT_METHODS', 'BATCH_SALE_PAYMENT_METHODS']) {
    if (!same(config[key]?.map(option => option.value), expectedSales) || !same(config[key], shared.sale)) {
      findings.push(`${key} 必须复用全局现金、移动支付、银行卡、国补刷卡四种顶层方式`)
    }
  }
  if (!same(config.SETTLEMENT_PAYMENT_METHODS, shared.settlement)) findings.push('结算选项与公共配置不一致')
  const refund = [...shared.sale.filter(option => !shared.refund.excludedSaleMethods.includes(option.value)), ...shared.refund.extraMethods]
  if (!same(config.REFUND_PAYMENT_METHODS, refund)) findings.push('退款方式必须从全局方式派生并保留原路退回')
  for (const [method, channels] of Object.entries(shared.channels)) {
    if (!same(config.getPaymentChannelOptions(method), channels) || config.hasPaymentChannelOptions(method) !== Boolean(channels.length)) {
      findings.push(`${method} 未复用全局支付渠道或渠道显示判断不一致`)
    }
  }
  const options = [...shared.sale, ...shared.settlement, ...shared.refund.extraMethods, ...Object.values(shared.channels).flat()]
  for (const option of options) {
    if (!option.value || !option.label || option.value.length > 30) findings.push('支付配置名称/编码无效或超过数据库字段长度')
    if (config.getPaymentMethodLabel(option.value) !== option.label) findings.push(`${option.value} 名称未从公共配置读取`)
  }
  return findings
}

function main() {
  const findings = []
  for (const file of ['PaymentMethodSelect.vue', 'PaymentChannelSelect.vue', 'PaymentMethodText.vue']) {
    if (!existsSync(resolve(frontendRoot, 'src/components/payment', file))) findings.push(`缺少公共支付组件：${file}`)
  }
  try {
    const shared = JSON.parse(readFileSync(sharedPath, 'utf8'))
    findings.push(...auditPaymentMethods(loadPaymentMethods(shared), shared))
  } catch (error) {
    findings.push(`公共支付配置加载失败：${error.message}`)
  }
  if (findings.length) {
    console.error(`支付方式统一审计失败，共 ${findings.length} 处：`)
    for (const finding of findings) console.error(`- ${finding}`)
    process.exitCode = 1
  } else console.log('支付方式统一审计通过：方式、渠道、退款派生及名称均复用全局配置。')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
