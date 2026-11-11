import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseTemplate } from '@vue/compiler-dom'

const numberBadgeClass = /(?:^|\s)table-number-badge(?:\s|$)/
const legacyNumberClass = /(?:^|\s)(?:id-badge|index-badge|ranking-index|store-profit-rank|priority-rank|device-number|phone-index|item-rank|sort-badge|sort-order-display|image-index)(?:\s|$)/

function isPositionExpression(expression) {
  const compact = expression.replace(/\s+/g, '')
  return /^(?:\$?index|idx|i)(?:\+1)?$/.test(compact)
    || /(?:\$index|\.indexOf\([^)]*\))\+1$/.test(compact)
    || /\.(?:sort_order|sortOrder|rank)$/.test(compact)
    || /\.sort_order(?:\|\||\?\?)/.test(compact)
    || /\.sort_order!==undefined\?/.test(compact)
}

// 同时检查表格及卡片的独立编号，不干预分页、排名或真实 ID 的取值。
export function auditNumberColumns(source) {
  const template = parseSfc(source).descriptor.template
  if (!template) return []
  const findings = []
  function visit(node, inPublicBadge = false) {
    const classes = node.props?.find(prop => prop.type === 6 && prop.name === 'class')?.value?.content || ''
    const hasPublicBadge = inPublicBadge || numberBadgeClass.test(classes)
    if (legacyNumberClass.test(classes)) {
      findings.push({ line: template.loc.start.line + node.loc.start.line - 1, message: '旧序号/排名/排序徽章必须迁移至公共 table-number-badge' })
    }
    const contents = node.children?.filter(child => child.type !== 3 && !(child.type === 2 && !child.content.trim())) || []
    if (!hasPublicBadge && contents.length === 1 && contents[0].type === 5
      && isPositionExpression(contents[0].content.content)) {
      findings.push({ line: template.loc.start.line + node.loc.start.line - 1, message: '卡片/列表的独立编号必须使用公共 table-number-badge，不能只检查表格列' })
    }
    if (node.tag === 'el-table-column') {
      const attribute = name => node.props.find(prop => prop.type === 6 && prop.name === name)?.value?.content
      const label = attribute('label')
      // 可编辑排序是表单控件；只读排序值及所有 index 列都属于统一数字展示。
      const isEditableSort = label === '排序' && /<el-input-number\b/.test(node.loc.source)
      const isNumberColumn = !isEditableSort && (['序号', 'ID', '排名', '排序', '优先'].includes(label)
        || attribute('type') === 'index')
      if (isNumberColumn && !/class=["'][^"']*\btable-number-badge\b/.test(node.loc.source)) {
        findings.push({ line: template.loc.start.line + node.loc.start.line - 1, message: '序号/ID 列必须使用公共 table-number-badge（包括 type="index"）' })
      }
      if (isNumberColumn && !node.props.some(prop => prop.type === 7
        && ['width', 'min-width'].includes(prop.arg?.content)
        && prop.exp?.content.includes('$getNumberColumnWidth('))) {
        findings.push({ line: template.loc.start.line + node.loc.start.line - 1, message: '序号/ID 列宽必须使用公共 $getNumberColumnWidth，避免长数字被固定列宽截断' })
      }
    }
    for (const child of node.children || []) visit(child, hasPublicBadge)
  }
  visit(parseTemplate(template.content))
  return findings
}

export function auditNumberStyles(styleSource) {
  const findings = []
  const source = styleSource.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const rule of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/\.(?:table-number-badge|id-badge|index-badge|ranking-index|store-profit-rank|priority-rank|device-number|phone-index|item-rank|sort-badge|sort-order-display|image-index)(?![\w-])/.test(rule[1]) && rule[2].trim()) {
      findings.push('序号/ID 徽章的颜色、尺寸和动效只能在公共入口定义，页面及组件不得覆盖')
    }
  }
  if (/--admin-data-table-number-[\w-]+\s*:/.test(source)) {
    findings.push('序号/ID 的公共令牌不得在页面或组件重定义')
  }
  return findings
}
