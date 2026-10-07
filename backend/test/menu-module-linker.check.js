const test = require('node:test')
const assert = require('node:assert/strict')

const MenuModuleLinker = require('../src/services/menuModuleLinker')
const ModuleScanner = require('../src/services/moduleScanner_simple')
const menuService = require('../src/services/unifiedMenu.service')

test('a visible child retains its hidden parent without granting access to hidden siblings', () => {
  const flatMenus = [
    { id: 91, parent_id: 0, module_key: 'parent_module', module_id: 1 },
    { id: 59, parent_id: 91, module_key: 'salary_salaryview', module_id: 497 },
    { id: 60, parent_id: 91, module_key: 'salary_salaryrecordsview', module_id: 559 }
  ]
  const visible = new Set(['salary_salaryview'])
  const result = menuService.filterTree(menuService.buildTree(flatMenus), visible, new Map())
  assert.deepEqual(result.map(menu => menu.id), [91])
  assert.deepEqual(result[0].children.map(menu => menu.id), [59])

  const rootMenu = { ...flatMenus[1], parent_id: 0 }
  assert.equal(menuService.filterTree([rootMenu], visible, new Map())[0].id, 59)
})

test('a nested salary menu always selects the page module despite duplicate display names', () => {
  const linker = new MenuModuleLinker()
  const page = { id: 497, key: 'salary_salaryview', name: '工资管理' }
  const records = { id: 559, key: 'salary_salaryrecordsview', name: '工资管理' }
  const menu = { name: '工资管理', url: '/Salary', parent_id: 91 }

  for (const modules of [[page, records], [records, page]]) {
    assert.equal(linker.findModuleForMenu(menu, modules), page)
  }
  assert.equal(linker.findModuleForMenu(menu, [records]), null)
})

test('nested marketing menu selects the authorized management module', () => {
  const linker = new MenuModuleLinker()
  const management = { id: 556, key: 'marketing_marketingmanagementview', name: '营销文案' }
  const publicPage = { id: 554, key: 'marketing_marketingview', name: '营销文案' }
  assert.equal(linker.findModuleForMenu(
    { name: '营销文案', url: '/marketing', parent_id: 92 },
    [publicPage, management]
  ), management)
})

test('navigation parents remain unbound even when their names contain business module names', () => {
  const linker = new MenuModuleLinker()
  assert.equal(linker.findModuleForMenu(
    { name: '考勤工资', url: '#', parent_id: 0 },
    [{ id: 1, key: 'attendance_attendanceview', name: '考勤管理' }]
  ), null)
})

test('scanner menu repair uses the shared linker without granting role permissions', async () => {
  const scanner = new ModuleScanner()
  let calls = 0
  scanner.menuLinker.syncAllMenusToModules = async () => {
    calls++
    return { success: true, linked: 1, corrected: 2 }
  }
  assert.deepEqual(await scanner.autoFixAllMenuLinks(), {
    success: true, updatedCount: 3, addedPermissionCount: 0
  })
  assert.equal(calls, 1)
})

test('automatic binding uses registered page modules and never creates guessed modules', async (t) => {
  const database = require('../src/config/database')
  const calls = []
  const page = { id: 497, key: 'salary_salaryview', name: '工资管理' }
  const records = { id: 559, key: 'salary_salaryrecordsview', name: '工资管理' }
  let modules = [records, page]
  t.mock.method(database, 'getDatabase', () => ({
    async execute(sql) {
      calls.push(sql)
      return [modules]
    }
  }))
  const binderPath = require.resolve('../src/services/menuModuleAutoBinder')
  delete require.cache[binderPath]
  const binder = require(binderPath)
  try {
    const result = await binder.autoBindModule({ name: '工资管理', url: '/Salary', parent_id: 91 })
    assert.equal(result.module_key, page.key)
    modules = [records]
    assert.equal((await binder.autoBindModule({ name: '工资管理', url: '/Salary' })).success, false)
    assert.equal((await binder.autoBindModule({ name: '考勤工资', url: '#' })).success, false)
    assert.ok(calls.every(sql => /^SELECT /i.test(sql)))
  } finally {
    delete require.cache[binderPath]
  }
})

test('salary menus map to their canonical permission modules', () => {
  const linker = new MenuModuleLinker()

  assert.equal(linker.findModuleKeyForMenu('工资管理'), 'salary_salaryview')
  assert.equal(linker.findModuleKeyForMenu('工资记录'), 'salary_salaryrecordsview')
  assert.equal(linker.findModuleKeyForMenu('我的工资'), 'salary_mysalaryview')
})

test('an existing menu with a historical module binding is relinked', () => {
  const linker = new MenuModuleLinker()
  const historicalMenu = {
    module_id: 559,
    module_key: 'salary_salaryrecordsview'
  }

  assert.equal(
    linker.needsModuleRelink(historicalMenu, 497, 'salary_salaryview'),
    true
  )
  assert.equal(
    linker.needsModuleRelink(
      { module_id: 497, module_key: 'salary_salaryview' },
      497,
      'salary_salaryview'
    ),
    false
  )
})
