const test = require('node:test')
const assert = require('node:assert/strict')

const MenuModuleLinker = require('../src/services/menuModuleLinker')

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
