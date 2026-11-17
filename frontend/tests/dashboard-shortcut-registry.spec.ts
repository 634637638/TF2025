import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import config from '../../backend/src/config/dashboard-shortcuts.json'
import capabilities from '../../backend/src/config/module-permission-capabilities.json'
import { MODULE_KEY_MAP } from '@/utils/permissionMapper'
import { getShortcutActionGroups, getShortcutPages } from '@/utils/dashboard-shortcuts'

const property = (node: ts.ObjectLiteralExpression, name: string) => node.properties.find((item): item is ts.PropertyAssignment =>
  ts.isPropertyAssignment(item) && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name)?.initializer

function routesFromSource(): RouteRecordRaw[] {
  const source = ts.createSourceFile('router.ts', readFileSync(resolve('src/router/index.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
  let result: RouteRecordRaw[] = []
  const convert = (array: ts.ArrayLiteralExpression): RouteRecordRaw[] => array.elements.flatMap(item => {
    if (!ts.isObjectLiteralExpression(item)) throw new Error('路由必须明确解析，不允许漏掉无法识别的条目')
    const path = property(item, 'path')
    if (!path || !ts.isStringLiteral(path)) throw new Error('路由路径必须为字符串')
    const metaNode = property(item, 'meta')
    const meta: Record<string, string | boolean> = {}
    if (metaNode && ts.isObjectLiteralExpression(metaNode)) {
      for (const field of metaNode.properties) {
        if (!ts.isPropertyAssignment(field) || !ts.isIdentifier(field.name)) continue
        if (ts.isStringLiteral(field.initializer)) meta[field.name.text] = field.initializer.text
        else if (field.initializer.kind === ts.SyntaxKind.TrueKeyword || field.initializer.kind === ts.SyntaxKind.FalseKeyword) {
          meta[field.name.text] = field.initializer.kind === ts.SyntaxKind.TrueKeyword
        }
      }
    }
    const children = property(item, 'children')
    const nested = children && ts.isArrayLiteralExpression(children) ? { children: convert(children) } : {}
    const redirect = property(item, 'redirect')
    if (redirect) return [{ path: path.text, redirect: ts.isStringLiteral(redirect) ? redirect.text : '/404', meta, ...nested }]
    return [{ path: path.text, component: { template: '<div />' }, meta,
      ...nested }]
  })
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'routes' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      result = convert(node.initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!result.length) throw new Error('未识别真实路由清单')
  return result
}

function collectBindings(directory: string, result = new Map<string, string>()): Map<string, string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name)
    if (entry.isDirectory()) { collectBindings(file, result); continue }
    if (!entry.name.endsWith('.vue')) continue
    const content = readFileSync(file, 'utf8')
    if (!content.includes('usePageShortcuts(')) continue
    const { descriptor } = parse(content)
    const source = ts.createSourceFile(file, descriptor.scriptSetup?.content || descriptor.script?.content || '', ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'usePageShortcuts') {
        const [path, handlers] = node.arguments
        if (!path || !ts.isStringLiteral(path) || !handlers || !ts.isObjectLiteralExpression(handlers)) throw new Error(`快捷功能必须显式绑定：${file}`)
        for (const handler of handlers.properties) {
          if (!ts.isPropertyAssignment(handler) || !ts.isStringLiteral(handler.name)) throw new Error(`快捷功能编号不可静态识别：${file}`)
          const key = `${path.text}:${handler.name.text}`
          expect(result.has(key), `重复绑定 ${key}`).toBe(false)
          result.set(key, file)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return result
}

describe('全站快捷入口登记闭环', () => {
  it('全部真实后台业务页和明确开放的公开业务页自动入选，所有功能均能解析到真实页面', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: routesFromSource() })
    const pages = getShortcutPages(router)
    for (const route of router.getRoutes().filter(route => route.meta.title && !route.redirect)) {
      expect(pages.some(page => page.value === route.path), route.path).toBe(true)
    }
    for (const path of ['/price-query', '/DH', '/m', '/H5-admin/page/orders', '/accessories/catalog']) {
      expect(pages.some(page => page.value === path), path).toBe(true)
    }
    const groups = getShortcutActionGroups(router)
    expect(groups.flatMap(group => group.options).map(option => option.value).sort()).toEqual(config.actions.map(action => action.id).sort())
    expect(new Set(pages.map(page => page.value)).size).toBe(pages.length)
  })

  it('每个功能有唯一编号、实际页面绑定和已有权限能力，不登记只有下拉选项的空入口', () => {
    const bindings = collectBindings(resolve('src/views'))
    const ids = new Set<string>()
    for (const action of config.actions) {
      expect(ids.has(action.id), action.id).toBe(false); ids.add(action.id)
      for (const permission of [...action.allPermissions, ...action.anyPermissions]) {
        const [module, type] = permission.split(':')
        const moduleKey = MODULE_KEY_MAP[module]
        const actions: Record<string, readonly string[]> = capabilities.modules
        expect(actions[moduleKey], permission).toContain(type)
      }
      if ('shortcut' in action.query) {
        expect(action.query.shortcut, action.id).toBe(action.id)
        expect(bindings.delete(`${action.path}:${action.id}`), action.id).toBe(true)
      } else {
        expect(['phone-stock-in', 'goods-stock-in', 'goods-sale']).toContain(action.id)
      }
    }
    expect([...bindings.keys()]).toEqual([])
  })
})
