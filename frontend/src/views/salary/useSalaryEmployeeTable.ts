import { computed, ref, watch, type Ref } from 'vue'

interface SalaryEmployeeListItem {
  id: number
  name?: string | null
  username?: string | null
  salary_template_id?: number | null
}

interface SalaryEmployeeTableInstance {
  toggleRowExpansion: (row: SalaryEmployeeListItem, expanded: boolean) => void
}

interface UseSalaryEmployeeTableOptions {
  employees: Ref<SalaryEmployeeListItem[]>
  initialMonth: string
  isMobile: Ref<boolean>
}

export const useSalaryEmployeeTable = ({
  employees,
  initialMonth,
  isMobile
}: UseSalaryEmployeeTableOptions) => {
  const employeeSearchExpanded = ref(false)
  const employeeSearch = ref('')
  const employeeTemplateFilter = ref<number | null>()
  const employeeSalaryMonth = ref(initialMonth)
  const employeePage = ref(1)
  const employeePageSize = ref(20)
  const employeeTableRef = ref<SalaryEmployeeTableInstance>()
  const mobileExpandedEmployeeId = ref<number | null>(null)
  const lastTappedEmployeeId = ref<number | null>(null)
  const lastEmployeeTapTimestamp = ref(0)

  const filteredEmployees = computed(() => {
    const search = employeeSearch.value.trim().toLowerCase()
    return employees.value.filter(employee => {
      const matchesSearch = !search ||
        employee.name?.toLowerCase().includes(search) ||
        employee.username?.toLowerCase().includes(search)
      const matchesTemplate = employeeTemplateFilter.value === undefined ||
        employeeTemplateFilter.value === null ||
        employee.salary_template_id === employeeTemplateFilter.value
      return Boolean(matchesSearch && matchesTemplate)
    })
  })

  const paginatedEmployees = computed(() => {
    const start = (employeePage.value - 1) * employeePageSize.value
    return filteredEmployees.value.slice(start, start + employeePageSize.value)
  })

  const collapseExpandedEmployee = () => {
    mobileExpandedEmployeeId.value = null
  }

  const handleEmployeePaginationChange = (page: number, pageSize: number) => {
    employeePage.value = page
    employeePageSize.value = pageSize
    collapseExpandedEmployee()
  }

  const handleEmployeeRowDblClick = (row: SalaryEmployeeListItem) => {
    if (!isMobile.value) return

    const shouldExpand = mobileExpandedEmployeeId.value !== row.id
    if (mobileExpandedEmployeeId.value && mobileExpandedEmployeeId.value !== row.id) {
      const previous = filteredEmployees.value.find(item => item.id === mobileExpandedEmployeeId.value)
      if (previous) employeeTableRef.value?.toggleRowExpansion(previous, false)
    }

    employeeTableRef.value?.toggleRowExpansion(row, shouldExpand)
    mobileExpandedEmployeeId.value = shouldExpand ? row.id : null
  }

  const handleEmployeeRowTap = (row: SalaryEmployeeListItem) => {
    if (!isMobile.value) return

    const now = Date.now()
    if (lastTappedEmployeeId.value === row.id && now - lastEmployeeTapTimestamp.value <= 320) {
      handleEmployeeRowDblClick(row)
      lastTappedEmployeeId.value = null
      lastEmployeeTapTimestamp.value = 0
      return
    }

    lastTappedEmployeeId.value = row.id
    lastEmployeeTapTimestamp.value = now
  }

  const resetEmployeeTableFilters = () => {
    employeeSearch.value = ''
    employeeTemplateFilter.value = undefined
    employeePage.value = 1
    collapseExpandedEmployee()
  }

  watch([employeeSearch, employeeTemplateFilter], () => {
    employeePage.value = 1
    collapseExpandedEmployee()
  })

  return {
    employeePage,
    employeePageSize,
    employeeSalaryMonth,
    employeeSearch,
    employeeSearchExpanded,
    employeeTableRef,
    employeeTemplateFilter,
    filteredEmployees,
    getEmployeeIndex: (index: number) => (employeePage.value - 1) * employeePageSize.value + index + 1,
    handleEmployeePaginationChange,
    handleEmployeeRowTap,
    paginatedEmployees,
    resetEmployeeTableFilters
  }
}
