import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasRuntimeModuleImport } from './lib/runtime-module-import.mjs'

const path = '@/utils/admin-table-drag-scroll'

test('公共工具允许静态、动态及并行按需加载，不限制局部命名', () => {
  for (const source of [
    `import { initAdminTableDragScroll as initialize } from '${path}'`,
    `import * as runtime from '${path}'`,
    `import '${path}'`,
    `const runtime = await import('${path}')`,
    `Promise.all([import('${path}'), import('@/utils/page-tab-scroll')])`
  ]) assert.equal(hasRuntimeModuleImport(source, path), true)
})

test('缺失、错误路径、注释、字符串及纯类型引用不能冒充运行时接入', () => {
  for (const source of [
    '', 'import("@/utils/other")', `// import('${path}')`,
    `const example = "import('${path}')"`,
    `import type { initAdminTableDragScroll } from '${path}'`,
    `import { type initAdminTableDragScroll } from '${path}'`
  ]) assert.equal(hasRuntimeModuleImport(source, path), false)
})
