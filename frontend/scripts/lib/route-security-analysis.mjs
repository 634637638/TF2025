import ts from 'typescript'

const authenticationMiddlewarePattern = /\b(?:unifiedAuth|requirePermission|requireAnyPermission|requireBusinessUser|customerAuth|authenticate|authenticateBackupDownload|requireInventoryQueryToken|verifyToken)\b/
const routeMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'])

const getRouteReceiver = (expression) => {
  if (ts.isIdentifier(expression)) {
    return expression
  }

  if (
    ts.isCallExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)
    && expression.expression.name.text === 'route'
    && ts.isIdentifier(expression.expression.expression)
  ) {
    return expression.expression.expression
  }

  return null
}

const getPathValues = (argument) => {
  if (argument && ts.isStringLiteralLike(argument)) {
    return [argument.text]
  }

  if (argument && ts.isArrayLiteralExpression(argument)) {
    return argument.elements.map((element) => (
      ts.isStringLiteralLike(element) ? element.text : null
    ))
  }

  return [null]
}

export function collectRouteRegistrations(filePath, source) {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const globalAuthenticationPositions = []
  const routes = []

  const visit = (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
      ts.forEachChild(node, visit)
      return
    }

    const method = node.expression.name.text.toLowerCase()
    const receiver = getRouteReceiver(node.expression.expression)
    if (!receiver || !/router/i.test(receiver.text)) {
      ts.forEachChild(node, visit)
      return
    }

    if (method === 'use') {
      const hasPathArgument = node.arguments.some((argument) => ts.isStringLiteralLike(argument))
      const middlewareSource = node.arguments
        .map((argument) => source.slice(argument.getStart(sourceFile), argument.end))
        .join(' ')
      if (!hasPathArgument && authenticationMiddlewarePattern.test(middlewareSource)) {
        globalAuthenticationPositions.push(node.getStart(sourceFile))
      }
    } else if (routeMethods.has(method)) {
      const chainedRoute = ts.isCallExpression(node.expression.expression)
      const pathArgument = chainedRoute
        ? node.expression.expression.arguments[0]
        : node.arguments[0]
      const middlewareArguments = chainedRoute
        ? [...node.arguments].slice(0, -1)
        : [...node.arguments].slice(1, -1)
      const middlewareSource = middlewareArguments
        .map((argument) => source.slice(argument.getStart(sourceFile), argument.end))
        .join(' ')
      const paths = getPathValues(pathArgument)

      for (const path of paths) {
        routes.push({
          method: method.toUpperCase(),
          path,
          start: node.getStart(sourceFile),
          source: source.slice(node.getStart(sourceFile), node.end),
          middlewareAuthenticated: authenticationMiddlewarePattern.test(middlewareSource)
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return routes.map((route) => ({
    ...route,
    globallyAuthenticated: globalAuthenticationPositions.some((position) => position < route.start)
  }))
}

export function routePolicyKey(fileName, method, path) {
  return `${fileName}|${method}|${path}`
}
