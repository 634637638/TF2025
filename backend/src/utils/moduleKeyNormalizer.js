const LEGACY_MODULE_KEY_MAP = {
  accessories: 'accessories_accessoriesview',
  customers: 'customers_customersview',
  employee: 'employees_employeesview',
  employees: 'employees_employeesview',
  inventory: 'inventory_inventoryview',
  menus: 'menu_menumanagementview',
  models: 'models_modelsview',
  stores: 'stores_storesview',
  suppliers: 'suppliers_suppliersview',
  supplier: 'suppliers_suppliersview',
  users: 'users_usersview',
  query: 'query_queryview',
  permissions: 'permissions_permissionsview',
  attendance: 'attendance_attendanceview',
  'my-attendance': 'attendance_myattendanceview',
  salary: 'salary_salaryview',
  'salary-records': 'salary_salaryrecordsview',
  'my-salary': 'salary_mysalaryview',
  'price-list': 'price_list_pricelistview'
};

function normalizeModuleKey(moduleKey) {
  if (!moduleKey) {
    return moduleKey;
  }

  return LEGACY_MODULE_KEY_MAP[moduleKey] || moduleKey;
}

module.exports = {
  LEGACY_MODULE_KEY_MAP,
  normalizeModuleKey
};
