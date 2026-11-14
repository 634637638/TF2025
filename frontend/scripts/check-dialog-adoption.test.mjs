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
    await t.test('业务确认、错误提示和注释不受表单关闭规则影响', async () => {
      const probe = join(fixture, 'src/components/ConfirmProbe.vue')
      await writeFile(probe, `<script setup>
        import { useNotification } from '@/composables/useNotification';
        const notices = useNotification();
        notices.confirm('确定删除这条销售记录吗？');
        notices.confirm('此操作将丢弃所有未提交的更改，是否继续？');
        notices.error('未保存内容，关闭后重试');
        // notices.confirm('尚有未提交的销售内容，确定关闭吗？');
      </script>`)
      const result = run()
      assert.equal(result.status, 0, result.stdout + result.stderr)
      await rm(probe)
    })
    for (const [extension, content] of [
      ['vue', `<script setup>
        import { useNotification } from '@/composables/useNotification';
        const { confirm: ask } = useNotification();
        ask('您有未保存的更改，确定要关闭吗？');
      </script>`],
      ['ts', `import { useNotification as feedback } from '@/composables/useNotification';
        const notices = feedback();
        notices.confirm(uncertain ? '仍要关闭当前草稿吗？' : '尚有未提交的销售内容，确定关闭吗？');`],
      ['js', `import { confirmAction as ask } from '@/utils/message-box';
        ask('Unsaved changes. Close editor?');`]
    ]) {
      await t.test(`拒绝${extension}表单关闭二次确认`, async () => {
        const probe = join(fixture, `src/components/CloseConfirmProbe.${extension}`)
        await writeFile(probe, content)
        const result = run()
        assert.equal(result.status, 1, result.stdout + result.stderr)
        assert.match(result.stdout + result.stderr, /不得弹出未保存\/未提交二次确认/)
        await rm(probe)
      })
    }
    const component = join(fixture, 'src/components/MobileDialog.vue')
    const source = await readFile(component, 'utf8')
    for (const [label, content, expected] of [
      ['关闭按钮偏移', '<template><div /></template><style>.private-dialog .mobile-dialog-sheet-close { right:14px; }</style>', /right 必须由公共弹窗入口/],
      ['正文间距覆盖', '<template><div /></template><style>.private-dialog .el-dialog__body { padding:4px; }</style>', /padding 必须由公共弹窗入口/],
      ['原生输入框', '<script setup>window.prompt("姓名")</script>', /window.prompt 必须复用公共通知/],
      ['直接业务 Dialog', '<template><el-dialog /></template>', /必须迁移到 MobileDialog/],
      ['查看弹窗禁用遮罩关闭', '<template><MobileDialog title="查看详情" :close-on-click-modal="false" /></template>', /查看类弹窗必须允许遮罩关闭/],
      ['表单沿用遮罩关闭默认值', '<template><MobileDialog><el-form><el-input /></el-form></MobileDialog></template>', /待提交表单必须禁用遮罩关闭/],
      ['无 form 的编辑器允许遮罩关闭', '<template><MobileDialog><el-input /><el-button>保存</el-button></MobileDialog></template>', /待提交表单必须禁用遮罩关闭/],
      ['百分比弹窗宽度', '<template><MobileDialog width="90%" /></template>', /不得使用 90% 宽度/],
      ['绑定百分比弹窗宽度', '<template><MobileDialog :width="\'90%\'" /></template>', /不得使用 90% 宽度/],
      ['长写绑定百分比弹窗宽度', '<template><MobileDialog v-bind:width="\'90%\'" /></template>', /不得使用 90% 宽度/],
      ['直接图片查看', '<template><el-image-viewer /></template>', /图片查看必须使用 MediaPreviewViewer/],
      ['图片内置预览', '<template><el-image :preview-src-list="images" /></template>', /图片查看必须使用 MediaPreviewViewer/]
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
