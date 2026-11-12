import ts from 'typescript'

/** 检查真实运行时模块引用；支持静态和动态加载，排除注释、字符串和类型引用。 */
export function hasRuntimeModuleImport(source, modulePath) {
  const file = ts.createSourceFile('runtime.ts', source, ts.ScriptTarget.Latest, true)
  let found = false
  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text === modulePath) {
      const clause = node.importClause
      const bindings = clause?.namedBindings
      if (!clause || (!clause.isTypeOnly && (clause.name || !bindings
        || ts.isNamespaceImport(bindings) || bindings.elements.some(item => !item.isTypeOnly)))) {
        found = true
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === modulePath) found = true
    if (!found) ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
