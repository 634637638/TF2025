import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('弹窗审计接受公共尺寸规则并拒绝默认参数覆盖和档位漂移', async t => {
  const root = resolve(import.meta.dirname, '..')
  const fixture = await mkdtemp(join(tmpdir(), 'tf-dialog-audit-'))
  try {
    await mkdir(join(fixture, 'scripts'))
    await cp(join(root, 'src'), join(fixture, 'src'), { recursive: true })
    const script = join(fixture, 'scripts/check-dialog-adoption.mjs')
    await cp(join(root, 'scripts/check-dialog-adoption.mjs'), script)
    const run = () => spawnSync(process.execPath, [script], { encoding: 'utf8' })
    await t.test('当前公共实现通过', () => {
      const result = run()
      assert.equal(result.status, 0, result.stdout + result.stderr)
    })
    const component = join(fixture, 'src/components/MobileDialog.vue')
    const source = await readFile(component, 'utf8')
    for (const width of ['var(--tf-dialog-width)', '680px']) {
      await t.test(`恢复默认 width=${width} 时失败`, async () => {
        const changed = source.replace("title: '',", `title: '',\n  width: '${width}',`)
        assert.notEqual(changed, source)
        await writeFile(component, changed)
        const result = run()
        assert.equal(result.status, 1)
        assert.match(result.stdout + result.stderr, /不得把默认宽度注入 props/)
        await writeFile(component, source)
      })
    }
    await t.test('全局700档位被改写时失败', async () => {
      const stylesheet = join(fixture, 'src/styles/components/_dialog.scss')
      const styles = await readFile(stylesheet, 'utf8')
      const changed = styles.replace('--tf-dialog-tier-width: 700px;', '--tf-dialog-tier-width: 680px;')
      assert.notEqual(changed, styles)
      await writeFile(stylesheet, changed)
      const result = run()
      assert.equal(result.status, 1)
      assert.match(result.stdout + result.stderr, /crud-dialog-md-lg 的唯一档位值 700px/)
    })
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})
