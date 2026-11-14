import { parse } from '@vue/compiler-sfc'

// 手机号不能硬截为有效的11位；较大的文本保护上限仍按字段契约另行校验。
export function auditPhoneInputs(source) {
  const { descriptor, errors } = parse(source)
  if (errors.length) throw new Error(`无法解析 Vue 模板：${errors[0]}`)
  const findings = []
  const visit = node => {
    if (node.type === 1 && ['input', 'elinput'].includes(node.tag?.replaceAll('-', '').toLowerCase())) {
      const attribute = name => node.props.find(prop => prop.type === 6 && prop.name === name
        || prop.type === 7 && prop.name === 'bind' && prop.arg?.content === name)
      const value = prop => prop?.type === 6 ? prop.value?.content : prop?.exp?.content
      const model = node.props.find(prop => prop.type === 7 && prop.name === 'model')
      const expression = model?.exp?.content || value(attribute('model-value')) || ''
      const label = [value(attribute('placeholder')), value(attribute('aria-label'))].join(' ')
      const field = expression.split('.').at(-1)
      const phone = value(attribute('type')) === 'tel' || /(?:phone|mobile)(?:\b|_)/i.test(field) || /手机(?:号|号码)/.test(label)
      const readonly = ['readonly', 'disabled'].some(name => {
        const prop = attribute(name)
        return prop?.type === 6 && value(prop) !== 'false' || prop?.type === 7 && value(prop) === 'true'
      })
      if (phone && !readonly && /^['"]?11['"]?$/.test(value(attribute('maxlength')) || '')) findings.push('可编辑手机号不得使用11位 maxlength 截短原文，应由公共格式校验拒绝非法内容')
    }
    for (const child of node.children || []) visit(child)
  }
  if (descriptor.template?.ast) visit(descriptor.template.ast)
  return findings
}
