import { parse } from '@vue/compiler-sfc'

// 识别数字控件的金额语义；比例、数量、天数等继续使用普通数字输入。
const amountField = /price|cost|amount|balance|deposit|payment|(?:^|[._])rent|salary|commission(?:New|Used)Fixed|overtime(?:Pay|HourlyRate)|leaveDeduction|(?:low|high)Fixed|threshold|adjustment/i
const amountLabel = /金额|价格|售价|成本|底薪|租金|押金|定金|退款|余额|入库价|批发价|划拨价/

export function auditAmountInputs(source) {
  const { descriptor, errors } = parse(source)
  if (errors.length) throw new Error(`无法解析 Vue 模板：${errors[0]}`)
  const findings = []
  const visit = node => {
    const tag = node.tag?.replace(/-/g, '').toLowerCase()
    if (node.type === 1 && ['elinputnumber', 'amountinput'].includes(tag)) {
      const attribute = name => node.props.find(prop =>
        prop.type === 6 && prop.name === name || prop.type === 7 && prop.name === 'bind' && prop.arg?.content === name)
      const value = prop => prop?.type === 6 ? prop.value?.content : prop?.exp?.content
      const controls = attribute('controls')
      const precision = attribute('precision')
      if (tag === 'amountinput') {
        if (controls || precision || attribute('controls-position')) findings.push('AmountInput 的精度和步进按钮由公共组件统一维护，调用方不得覆盖')
      } else {
        if (controls?.type !== 7 || value(controls) !== 'false') findings.push('el-input-number 必须显式设置 :controls="false"')
        const model = node.props.find(prop => prop.type === 7 && prop.name === 'model')
        const expression = model?.exp?.content || value(attribute('model-value')) || ''
        const label = [value(attribute('placeholder')), value(attribute('aria-label'))].join(' ')
        const percentage = /percent|percentage/i.test(expression)
          || node.props.some(prop => prop.type === 7 && prop.name === 'on' && /Percentage/.test(prop.exp?.content || ''))
        if (!percentage && (amountField.test(expression) || amountLabel.test(label))) {
          findings.push('金额数字字段必须使用 AmountInput，整数不补零并保留真实小数')
        }
      }
    }
    for (const child of node.children || []) visit(child)
  }
  if (descriptor.template?.ast) visit(descriptor.template.ast)
  return findings
}
