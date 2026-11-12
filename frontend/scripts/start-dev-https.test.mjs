import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import test from 'node:test'

function fixture(t, { key = true, cert = true, exitCode = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tf-https-start-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const frontend = join(root, 'frontend with spaces')
  mkdirSync(join(frontend, 'scripts'), { recursive: true })
  mkdirSync(join(frontend, 'ssl'))
  copyFileSync(new URL('./start-dev-https.sh', import.meta.url), join(frontend, 'scripts/start-dev-https.sh'))
  // 只验证入口是否启用 HTTPS 和传递参数，证书不参与真实 TLS 握手。
  if (key) writeFileSync(join(frontend, 'ssl/local-dev-key.pem'), 'fixture')
  if (cert) writeFileSync(join(frontend, 'ssl/local-dev-cert.pem'), 'fixture')
  const bin = join(root, 'bin')
  mkdirSync(bin)
  const invocation = join(root, 'invocation.json')
  writeFileSync(join(bin, 'npm'), `#!/usr/bin/env node
require('node:fs').writeFileSync(process.env.TF_HTTPS_TEST_OUTPUT, JSON.stringify({
  cwd: process.cwd(), https: process.env.TF_USE_HTTPS, args: process.argv.slice(2)
}));
process.exit(${exitCode});
`, { mode: 0o755 })
  return {
    frontend, invocation,
    run: (...args) => spawnSync('bash', [join(frontend, 'scripts/start-dev-https.sh'), ...args], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, TF_USE_HTTPS: 'false', TF_HTTPS_TEST_OUTPUT: invocation },
      encoding: 'utf8', timeout: 10000
    })
  }
}

for (const credentials of [{ key: false }, { cert: false }, { key: false, cert: false }]) {
  test(`HTTPS 证书不完整时拒绝启动而不回退 HTTP：${JSON.stringify(credentials)}`, t => {
    const f = fixture(t, credentials)
    const result = f.run()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /npm run cert:local/)
    assert.equal(existsSync(f.invocation), false)
  })
}

test('从其他目录启动也启用 HTTPS，沿用 dev 门禁并传递 Vite 参数与退出码', t => {
  const f = fixture(t, { exitCode: 7 })
  const result = f.run('--host', '127.0.0.1')
  assert.equal(result.status, 7, result.stderr)
  assert.deepEqual(JSON.parse(readFileSync(f.invocation, 'utf8')), {
    cwd: realpathSync(f.frontend), https: 'true', args: ['run', 'dev', '--', '--host', '127.0.0.1']
  })
})
