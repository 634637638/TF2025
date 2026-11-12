import { parse } from '@vue/compiler-sfc'
import { parse as parseTemplate, NodeTypes } from '@vue/compiler-dom'
import ts from 'typescript'

function isDataIcon(expression) {
  const source = ts.createSourceFile('icon.ts', `const value = ${expression}`, ts.ScriptTarget.Latest, true)
  let found = false
  const visit = node => {
    // 调用固定状态映射函数本身不是图标数据；仍检查参数，防止数据字段经函数绕过。
    const isCallTarget = node.parent && ts.isCallExpression(node.parent) && node.parent.expression === node
    if (ts.isIdentifier(node) && !isCallTarget && /^(?:icon|iconClass|icon_class)$|IconClass$/.test(node.text)) found = true
    if ((ts.isPropertyAccessExpression(node) && ['icon', 'icon_class', 'iconClass'].includes(node.name.text))
      || (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)
        && ['icon', 'icon_class', 'iconClass'].includes(node.argumentExpression.text))) found = true
    if (!found) ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** 数据驱动图标必须经过公共组件，在线预览只允许出现在选择器候选中。 */
export function auditIconTemplate(source, file = '') {
  const template = parse(source).descriptor.template
  if (!template) return []
  const findings = []
  const visit = node => {
    if (node.type === NodeTypes.ELEMENT) {
      for (const prop of node.props) {
        if (file !== 'components/IconRenderer.vue' && node.tag === 'i' && prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind'
          && prop.arg?.content === 'class' && prop.exp && isDataIcon(prop.exp.content)) {
          findings.push(`第 ${node.loc.start.line} 行：数据图标类必须使用 IconRenderer`)
        }
        if (['IconRenderer', 'icon-renderer'].includes(node.tag)
          && (prop.name === 'online-preview' || prop.arg?.content === 'online-preview')
          && file !== 'components/IconPicker.vue') findings.push('在线预览只允许用于 IconPicker 的在线搜索候选')
      }
    }
    for (const child of node.children || []) visit(child)
  }
  visit(parseTemplate(template.content))
  return findings
}
