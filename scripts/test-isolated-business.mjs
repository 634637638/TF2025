#!/usr/bin/env node
// T11：统一执行已有正式隔离测试；不把仓储替身与浏览器检查称为真实数据库 E2E。
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function createIsolatedEnvironment(base, directory) {
  const env = { ...base }
  for (const key of Object.keys(env)) if (/^(?:(?:TEST_)?DB_|JWT_|ERROR_ALERT_)/.test(key)) delete env[key]
  return { ...env, NODE_ENV: 'test', ENV_FILE: join(directory, 'no-cloud-env'), RUN_DB_TESTS: 'false', ERROR_ALERT_ENABLED: 'false' }
}

export const phases = [
  { name: '后端登录、权限、销售与取消事务替身', command: process.execPath, args: ['--test',
    'backend/test/auth-controller.check.js', 'backend/test/field-access.check.js', 'backend/test/sales-phone-service.check.js',
    'backend/test/sales-management-controller.check.js', 'backend/test/shop-public-transaction.check.js'] },
  { name: '前端登录输入、路由权限与销售表单', command: 'npm', args: ['--prefix', 'frontend', 'run', 'test:unit', '--',
    'tests/h5-auth-validation.spec.ts', 'tests/route-permissions.spec.ts', 'tests/query-amount.spec.ts', 'tests/sales-batch-form.spec.ts'] },
  { name: '真实控件浏览器输入与登录试点', command: 'npm', args: ['--prefix', 'frontend', 'run', 'test:input-flows'] }
]

async function run() {
  const directory = await mkdtemp(join(tmpdir(), 'tf-isolated-business-'))
  const env = createIsolatedEnvironment(process.env, directory)
  let success = false
  try {
    for (const [index, phase] of phases.entries()) {
      console.log(`执行隔离阶段：${phase.name}`)
      let output = ''
      const code = await new Promise((done, reject) => {
        const child = spawn(phase.command, phase.args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
        const timeout = setTimeout(() => { child.kill('SIGTERM') }, 10 * 60 * 1000)
        child.on('error', error => { clearTimeout(timeout); reject(error) })
        for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
          output = (output + chunk.toString()).slice(-2_000_000)
        })
        child.on('close', value => { clearTimeout(timeout); done(value) })
      })
      await writeFile(join(directory, `phase-${index + 1}.log`), output, { mode: 0o600 })
      if (code !== 0) throw new Error(`${phase.name} 失败；隔离日志位于 ${directory}`)
      console.log(output.split('\n').filter(line => /# (tests|pass|fail|skipped)|Test Files|Tests |Chromium.*通过/.test(line)).join('\n'))
    }
    success = true
    console.log('分层隔离测试通过；没有连接云端数据库，不代表真实库存/订单持久化 E2E 完成。')
  } finally {
    if (success) await rm(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await run()
