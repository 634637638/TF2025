import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { ESLint } from 'eslint'

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const eslint = new ESLint({ cwd })
const lintVue = async source => {
  const [result] = await eslint.lintText(source, { filePath: 'frontend/src/components/LintFixture.vue' })
  assert.equal(result.fatalErrorCount, 0)
  return result.messages.filter(message => message.ruleId?.endsWith('no-unused-vars'))
}

test('Vue TS 函数类型参数不会误报未使用变量', async () => {
  const messages = await lintVue(`<script setup lang="ts">
const invoke = <Args extends unknown[]>(fn: (...args: Args) => void): ((...args: Args) => void) => {
  return (...args: Args) => fn(...args)
}
const submit = invoke((value: string) => value.trim())
</script>
<template><button @click="submit('value')">提交</button></template>`)
  assert.deepEqual(messages, [])
})

test('Vue TS 和 JS 的真实未使用变量仍被检出', async () => {
  for (const lang of [' lang="ts"', '']) {
    const messages = await lintVue(`<script setup${lang}>\nconst unused = 1\n</script>\n<template><div /></template>`)
    assert.equal(messages.length, 1)
    assert.equal(messages[0].ruleId, '@typescript-eslint/no-unused-vars')
    assert.match(messages[0].message, /unused/)
  }
})
