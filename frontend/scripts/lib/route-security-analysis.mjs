import ts from 'typescript'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

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

export function resolveDelegatedControllerMethodSource(routeFilePath, routeSource, registration) {
  const routeFile = ts.createSourceFile(routeFilePath, routeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const controllerModules = new Map()
  const controllerInstances = new Map()
  let registeredCall = null

  const getRequiredModule = initializer => (
    initializer
    && ts.isCallExpression(initializer)
    && ts.isIdentifier(initializer.expression)
    && initializer.expression.text === 'require'
    && initializer.arguments[0]
    && ts.isStringLiteralLike(initializer.arguments[0])
      ? initializer.arguments[0].text
      : null
  )

  const findDeclarations = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const modulePath = getRequiredModule(node.initializer)
      if (modulePath?.includes('/controllers/')) controllerModules.set(node.name.text, modulePath)
    }
    if (ts.isCallExpression(node) && node.getStart(routeFile) === registration.start) {
      registeredCall = node
    }
    ts.forEachChild(node, findDeclarations)
  }
  findDeclarations(routeFile)

  const findInstances = node => {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
      && ts.isNewExpression(node.initializer)
      && ts.isIdentifier(node.initializer.expression)
      && controllerModules.has(node.initializer.expression.text)
    ) {
      controllerInstances.set(node.name.text, controllerModules.get(node.initializer.expression.text))
    }
    ts.forEachChild(node, findInstances)
  }
  findInstances(routeFile)

  let handler = registeredCall?.arguments.at(-1)
  while (handler && ts.isCallExpression(handler) && ts.isPropertyAccessExpression(handler.expression)) {
    if (handler.expression.name.text !== 'bind') return ''
    handler = handler.expression.expression
  }
  if (!handler || !ts.isPropertyAccessExpression(handler) || !ts.isIdentifier(handler.expression)) return ''

  const modulePath = controllerInstances.get(handler.expression.text)
  if (!modulePath) return ''
  let controllerPath = resolve(dirname(routeFilePath), modulePath)
  if (!existsSync(controllerPath) && existsSync(`${controllerPath}.js`)) controllerPath = `${controllerPath}.js`
  if (!existsSync(controllerPath)) return ''

  const controllerSource = readFileSync(controllerPath, 'utf8')
  const controllerFile = ts.createSourceFile(controllerPath, controllerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  let methodSource = ''
  const findMethod = node => {
    if (ts.isMethodDeclaration(node) && node.name && node.name.getText(controllerFile) === handler.name.text) {
      methodSource = controllerSource.slice(node.getStart(controllerFile), node.end)
    }
    ts.forEachChild(node, findMethod)
  }
  findMethod(controllerFile)
  return methodSource
}

export function routePolicyKey(fileName, method, path) {
  return `${fileName}|${method}|${path}`
}
