import assert from 'node:assert/strict'
import { test } from 'node:test'
import { auditIconTemplate } from './lib/icon-contract.mjs'

test('菜单、权限和配置数据的图标类不能绕开公共渲染器', () => {
  for (const value of ['menu.icon', "menu['icon']", "category.icon || 'fas fa-list'", '[option.icon, option.iconClass]', 'importIconClass', 'getIconClass(menu.icon)']) {
    assert.ok(auditIconTemplate(`<template><i :class="${value}" /></template>`).length)
  }
})

test('公共动态渲染和代码固定的状态切换不误报', () => {
  for (const template of ['<IconRenderer :icon="menu.icon" :svg="menu.icon_svg" />', '<i class="fas fa-plus" />', '<i :class="open ? \'fas fa-angle-up\' : \'fas fa-angle-down\'" />', '<i :class="getIconClass(notification.type)" />']) {
    assert.deepEqual(auditIconTemplate(`<template>${template}</template>`), [])
  }
})

test('普通页面不能打开在线预览，选择器候选可以显式预览', () => {
  const source = '<template><IconRenderer :icon="icon.class" :online-preview="icon.source === \'online\'" /></template>'
  assert.ok(auditIconTemplate(source, 'views/menu/MenuManagementView.vue').length)
  assert.deepEqual(auditIconTemplate(source, 'components/IconPicker.vue'), [])
})
