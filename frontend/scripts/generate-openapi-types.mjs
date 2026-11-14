import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import openapiTS, { astToString } from 'openapi-typescript'
import { ESLint } from 'eslint'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const input = new URL('../../backend/src/contracts/regions.openapi.json', import.meta.url)
const output = resolve(root, 'frontend/src/types/generated/regions.ts')
export async function generateTypes(source = input, target = output, { check = false } = {}) {
  const raw = `// 本文件由 npm --prefix frontend run generate:openapi 生成，请修改唯一 OpenAPI 契约。\n${astToString(await openapiTS(source))}`
  // 使用仓库唯一规则格式化；临时测试目标也沿用正式产物的文件类型与配置。
  const [result] = await new ESLint({ cwd: root, fix: true }).lintText(raw, { filePath: output })
  if (result.errorCount || result.warningCount) throw new Error('OpenAPI 生成类型未通过仓库 ESLint 规则')
  const generated = result.output ?? raw
  if (check) {
    if (await readFile(target, 'utf8') !== generated) throw new Error('OpenAPI 生成类型发生漂移，请运行 generate:openapi 并检查契约变更')
  } else {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, generated)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateTypes(input, output, { check: process.argv.includes('--check') })
  console.log(process.argv.includes('--check') ? 'OpenAPI 试点类型与唯一契约一致。' : '已生成地区 OpenAPI 类型。')
}
