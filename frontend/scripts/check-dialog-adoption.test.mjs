import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile, symlink } from 'node:fs/promises'
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
    await cp(join(root, 'scripts/audit-dialog-coverage.mjs'), join(fixture, 'scripts/audit-dialog-coverage.mjs'))
    await symlink(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir')
    const run = () => spawnSync(process.execPath, [script], { encoding: 'utf8' })
    await t.test('当前公共实现通过', () => {
      const result = run()
      assert.equal(result.status, 0, result.stdout + result.stderr)
    })
    const component = join(fixture, 'src/components/MobileDialog.vue')
    const source = await readFile(component, 'utf8')
    for (const [label, content, expected] of [
      ['关闭按钮偏移', '<template><div /></template><style>.private-dialog .mobile-dialog-sheet-close { right:14px; }</style>', /right 必须由公共弹窗入口/],
      ['正文间距覆盖', '<template><div /></template><style>.private-dialog .el-dialog__body { padding:4px; }</style>', /padding 必须由公共弹窗入口/],
      ['原生输入框', '<script setup>window.prompt("姓名")</script>', /window.prompt 必须复用公共通知/],
      ['直接业务 Dialog', '<template><el-dialog /></template>', /必须迁移到 MobileDialog/],
      ['直接图片查看', '<template><el-image-viewer /></template>', /图片查看必须使用 MediaPreviewViewer/]
    ]) {
      await t.test(`拒绝${label}`, async () => {
        const probe = join(fixture, 'src/components/AuditProbe.vue')
        await writeFile(probe, content)
        const result = run()
        assert.equal(result.status, 1, result.stdout + result.stderr)
        assert.match(result.stdout + result.stderr, expected)
        await rm(probe)
      })
    }
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
