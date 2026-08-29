import { reactive, ref, type Ref } from 'vue'

interface SalaryEmployeeOption {
  id: number
  name?: string | null
  username?: string | null
}

interface UseSalaryMyRecordsTableOptions {
  employees: Ref<SalaryEmployeeOption[]>
  reload: () => void | Promise<void>
}

export const useSalaryMyRecordsTable = ({
  employees,
  reload
}: UseSalaryMyRecordsTableOptions) => {
  const recordsSearchExpanded = ref(false)
  const myPeriodRange = ref<[string, string] | null>(null)
  const myPagination = reactive({
    page: 1,
    page_size: 20,
    total: 0
  })
  const selectedViewEmployeeId = ref<number>()

  const getSelectedEmployeeName = () => {
    if (!selectedViewEmployeeId.value) return ''
    const employee = employees.value.find(item => item.id === selectedViewEmployeeId.value)
    return employee?.name || employee?.username || ''
  }

  const reloadFromFirstPage = () => {
    myPagination.page = 1
    void reload()
  }

  const handleViewEmployeeChange = () => {
    reloadFromFirstPage()
  }

  const handleMyPeriodChange = () => {
    reloadFromFirstPage()
  }

  const handleMyPaginationChange = (page: number, pageSize: number) => {
    myPagination.page = page
    myPagination.page_size = pageSize
    void reload()
  }

  const resetMyTableFilters = () => {
    myPeriodRange.value = null
    selectedViewEmployeeId.value = undefined
    myPagination.page = 1
  }

  return {
    getSelectedEmployeeName,
    handleMyPaginationChange,
    handleMyPeriodChange,
    handleViewEmployeeChange,
    myPagination,
    myPeriodRange,
    recordsSearchExpanded,
    resetMyTableFilters,
    selectedViewEmployeeId
  }
}
