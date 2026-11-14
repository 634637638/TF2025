import { parse } from '@vue/compiler-sfc'

const normalize = value => value.replace(/-/g, '').toLowerCase()
export const tableAttribute = (node, name) => node.props?.find(prop => prop.type === 6 ? prop.name === name : (prop.name === name || prop.arg?.content === name))
const value = prop => prop?.type === 6 ? prop.value?.content : prop?.exp?.content

/** 页面、公共组件与弹窗逐实例核对，不以组件目录或弹窗祖先作宽泛豁免。 */
export function inspectMobileRecordDetails(source, filename, tablePurposes = []) {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) throw new Error(`${filename}: ${errors.join('; ')}`)
  const findings = [], tables = [], cards = []
  const report = (node, message) => findings.push({ line: node.loc.start.line, message })
  const childrenOf = node => [node, ...(node.children || []).flatMap(childrenOf)]
  function visit(node, parents = []) {
    if (node.type === 1) {
      const tag = normalize(node.tag)
      if (tag === 'eldescriptions' && !filename.endsWith('/RecordDescriptions.vue')) {
        report(node, '描述列表使用公共 RecordDescriptions，手机两列与标签置顶由公共入口统一')
      }
      const classes = value(tableAttribute(node, 'class')) || ''
      if (/\bmobile-(?:row-actions|inline-actions|expand-column|expand-header)\b/.test(classes)) {
        report(node, '手机业务操作必须放在查看模态框底部，禁止旧行内操作区')
      }
      if (tag === 'eltablecolumn' && value(tableAttribute(node, 'type')) === 'expand') {
        const descendants = childrenOf(node)
        if (descendants.some(child => normalize(child.tag || '') === 'elbutton')
          && !descendants.some(child => normalize(child.tag || '') === 'eltable')) {
          report(node, '禁止按钮型展开列；数据明细展开必须有真实明细结构')
        }
      }
      if (tag === 'eltable') {
        const data = value(tableAttribute(node, 'data')) || ''
        const inDialog = parents.some(parent => /dialog|modal/.test(normalize(parent.tag || '')))
        const publicDetail = Boolean(tableAttribute(node, 'table-double-tap'))
        const purpose = tablePurposes.find(item => item.data === data)
        const desktopOnly = [node, ...parents].some(parent => /(?:^|[(&| ])!isMobile(?:$|[ )&|])/.test(value(tableAttribute(parent, 'if')) || ''))
        if (!desktopOnly && !publicDetail && !purpose) report(node, `记录表 ${data} 未接公共双击详情，也未逐实例登记输入/关联明细用途`)
        tables.push({ data, line: node.loc.start.line, inDialog, publicDetail, desktopOnly, purpose: purpose?.purpose })
      }
      if (tableAttribute(node, 'data-mobile-record')) {
        const host = [node, ...parents.slice().reverse()].find(parent => tableAttribute(parent, 'table-double-tap'))
        if (!host) report(node, '记录卡片必须位于公共 v-table-double-tap 宿主内')
        cards.push({ line: node.loc.start.line, publicDetail: Boolean(host) })
      }
    }
    for (const child of node.children || []) visit(child, [...parents, node])
  }
  if (descriptor.template) visit(descriptor.template.ast)
  if (/\buseMobileRowDoubleTap\b|\btoggleRowExpansion\s*\(/.test([descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n'))) {
    findings.push({ line: 1, message: '禁止旧行点击时间窗或通过展开行承载操作，使用 v-table-double-tap / useMobileTableDetail' })
  }
  return { findings, tables, cards }
}
