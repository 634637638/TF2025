import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateTypes } from './generate-openapi-types.mjs'

test('OpenAPI 生成可重复；源码契约和生成类型任一漂移均阻断', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'tf-openapi-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const source = JSON.parse(await readFile(new URL('../../backend/src/contracts/regions.openapi.json', import.meta.url), 'utf8'))
  const input = join(directory, 'source.json'), output = join(directory, 'types.ts')
  await writeFile(input, JSON.stringify(source))
  await generateTypes(new URL(`file://${input}`), output)
  await generateTypes(new URL(`file://${input}`), output, { check: true })
  const original = await readFile(output, 'utf8')
  await writeFile(output, `${original}\n// 手工漂移`)
  await assert.rejects(generateTypes(new URL(`file://${input}`), output, { check: true }), /发生漂移/)
  await writeFile(output, original)
  source.components.schemas.RegionSelection.properties.extraTest = { type: 'string' }
  await writeFile(input, JSON.stringify(source))
  await assert.rejects(generateTypes(new URL(`file://${input}`), output, { check: true }), /发生漂移/)
})
