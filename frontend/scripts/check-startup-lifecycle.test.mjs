import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'tf-startup-lifecycle-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const frontend = join(root, 'frontend')
  const bin = join(root, 'node_modules/.bin')
  const log = join(root, 'invocations.jsonl')
  mkdirSync(bin, { recursive: true })
  mkdirSync(frontend)
  mkdirSync(join(root, 'scripts'))
  for (const [directory, source] of [[root, '../../package.json'], [frontend, '../package.json']]) {
    const { scripts } = JSON.parse(readFileSync(new URL(source, import.meta.url), 'utf8'))
    // 审计替身主动失败，能发现任何意外的启动前审计；不运行真实服务或数据库。
    scripts['check:standards'] = 'node audit.cjs'
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, scripts }))
    writeFileSync(join(directory, 'audit.cjs'), 'require(\'node:fs\').appendFileSync(process.env.TF_STARTUP_TEST_LOG, JSON.stringify({ command: \'audit\' }) + \'\\n\'); process.exit(79)')
  }
  copyFileSync(new URL('../../scripts/fix-ports.js', import.meta.url), join(root, 'scripts/fix-ports.js'))
  // 不结束用户进程或占用真实端口；只保留实际启动编排。
  writeFileSync(join(root, 'scripts/port-utils.js'), 'exports.getTargetPorts = () => []; exports.stopPortProcesses = async () => {}')
  for (const command of ['vite', 'concurrently']) {
    writeFileSync(join(bin, command), `#!/usr/bin/env node
require('node:fs').appendFileSync(process.env.TF_STARTUP_TEST_LOG, JSON.stringify({ command: '${command}', args: process.argv.slice(2) }) + '\\n');
process.exit(Number(process.env.TF_STARTUP_TEST_EXIT || 0));
`, { mode: 0o755 })
  }
  return {
    run(directory, command, args = [], exitCode = 0) {
      writeFileSync(log, '')
      const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--ignore-scripts=false', 'run', command, '--', ...args], {
        cwd: directory === 'root' ? root : frontend,
        env: { ...process.env, TF_STARTUP_TEST_LOG: log, TF_STARTUP_TEST_EXIT: String(exitCode) },
        encoding: 'utf8', timeout: 15000
      })
      const events = readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
      return { ...result, events }
    }
  }
}

test('日常启动只运行服务入口，不自动执行全量审计', t => {
  const f = fixture(t)
  for (const [directory, command, executable] of [
    ['root', 'dev', 'concurrently'], ['root', 'start', 'concurrently'], ['root', 'frontend', 'vite'],
    ['frontend', 'dev', 'vite'], ['frontend', 'start', 'vite'], ['frontend', 'dev:server', 'vite']
  ]) {
    const result = f.run(directory, command)
    assert.equal(result.status, 0, `${directory}/${command}: ${result.stderr}`)
    assert.deepEqual(result.events.map(event => event.command), [executable])
    if (executable === 'concurrently') {
      assert.ok(result.events[0].args.includes('npm run backend'))
      assert.ok(result.events[0].args.includes('npm run frontend:raw'))
    }
  }
})

test('普通构建、调试构建及发布检查仍必须先通过全量审计', t => {
  const f = fixture(t)
  for (const command of ['build', 'build:debug', 'check:release']) {
    const result = f.run('frontend', command)
    assert.equal(result.status, 79, `${command}: ${result.stderr}`)
    assert.deepEqual(result.events, [{ command: 'audit' }])
  }
})

test('日常启动保留服务参数和失败退出码', t => {
  const f = fixture(t)
  const frontend = f.run('frontend', 'dev', ['--host', '127.0.0.1'], 7)
  assert.equal(frontend.status, 7, frontend.stderr)
  assert.deepEqual(frontend.events, [{ command: 'vite', args: ['--host', '127.0.0.1'] }])
  const root = f.run('root', 'dev', [], 7)
  assert.equal(root.status, 7, root.stderr)
})
