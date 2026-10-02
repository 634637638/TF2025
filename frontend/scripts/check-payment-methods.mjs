import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const frontendRoot = resolve(import.meta.dirname, '..')
const requiredFiles = [
  'src/constants/paymentMethods.ts',
  'src/components/payment/PaymentMethodSelect.vue',
  'src/components/payment/PaymentChannelSelect.vue',
  'src/components/payment/PaymentMethodText.vue'
]
const findings = []

for (const file of requiredFiles) {
  if (!existsSync(resolve(frontendRoot, file))) findings.push(`缺少公共支付实现入口：${file}`)
}

const configPath = resolve(frontendRoot, 'src/constants/paymentMethods.ts')
if (existsSync(configPath)) {
  const config = readFileSync(configPath, 'utf8')
  for (const requiredValue of ['cash', 'mobile', 'bank_card', 'bank_transfer', 'wechat', 'alipay', 'other']) {
    if (!config.includes(`value: '${requiredValue}'`)) {
      findings.push(`公共支付配置缺少兼容值：${requiredValue}`)
    }
  }

  const readOptionValues = (constantName) => {
    const block = config.match(new RegExp(`export const ${constantName}[^=]*= \\[([\\s\\S]*?)\\n\\]`))
    if (!block) return null
    return {
      values: [...block[1].matchAll(/value: '([^']+)'/g)].map(match => match[1]),
      raw: block[1]
    }
  }
  const expectedSalesMethods = ['cash', 'mobile', 'bank_card', 'subsidy_card']
  for (const constantName of ['SALE_PAYMENT_METHODS', 'BATCH_SALE_PAYMENT_METHODS']) {
    const optionSet = readOptionValues(constantName)
    const isBatchAlias = constantName === 'BATCH_SALE_PAYMENT_METHODS' && optionSet?.raw.includes('...SALE_PAYMENT_METHODS') && !optionSet.raw.includes("value: 'transfer'")
    if (!optionSet || (!isBatchAlias && optionSet.values.join(',') !== expectedSalesMethods.join(','))) {
      findings.push(`${constantName} 必须严格包含现金、移动支付、银行卡、国补刷卡四种顶层方式，银行转账只能作为银行卡渠道`)
    }
  }
}

if (findings.length) {
  console.error(`支付方式统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('支付方式统一审计通过：公共配置、选择组件和展示组件均已存在。')
