import { computed, ref, watch, type Ref } from 'vue'
import type { SalaryEmployeeOption } from '@/types/salary'


interface UseSalaryEmployeeTableOptions {
  employees: Ref<SalaryEmployeeOption[]>
  initialMonth: string
}

export const useSalaryEmployeeTable = ({
  employees,
  initialMonth
}: UseSalaryEmployeeTableOptions) => {
  const employeeSearchExpanded = ref(false)
  const employeeSearch = ref('')
  const employeeTemplateFilter = ref<number | undefined>()
  const employeeSalaryMonth = ref(initialMonth)
  const employeePage = ref(1)
  const employeePageSize = ref(20)

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


  const handleEmployeePaginationChange = (page: number, pageSize: number) => {
    employeePage.value = page
    employeePageSize.value = pageSize
  }



  const resetEmployeeTableFilters = () => {
    employeeSearch.value = ''
    employeeTemplateFilter.value = undefined
    employeePage.value = 1
  }

  watch([employeeSearch, employeeTemplateFilter], () => {
    employeePage.value = 1
  })

  return {
    employeePage,
    employeePageSize,
    employeeSalaryMonth,
    employeeSearch,
    employeeSearchExpanded,
    employeeTemplateFilter,
    filteredEmployees,
    getEmployeeIndex: (index: number) => (employeePage.value - 1) * employeePageSize.value + index + 1,
    handleEmployeePaginationChange,
    paginatedEmployees,
    resetEmployeeTableFilters
  }
}
