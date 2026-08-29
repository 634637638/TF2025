import { computed, reactive, ref, watch, type Ref } from 'vue'

type SalaryPayoutStatus = 'paid' | 'unpaid'

export interface SalaryPayoutRecord {
  employee_id: number
  status?: string | null
  net_salary?: number | string | null
  paid_at?: string | null
  payment_method?: string | null
}

export interface SalaryPayoutEmployee {
  id: number
  name?: string | null
  username?: string | null
}

export interface SalaryPayoutRow extends SalaryPayoutEmployee {
  payoutRecord: SalaryPayoutRecord | null
}

interface UseSalaryPayoutTableOptions {
  getEmployees: () => SalaryPayoutEmployee[]
  initialMonth: string
  payoutList: Ref<SalaryPayoutRecord[]>
}

export const useSalaryPayoutTable = ({
  getEmployees,
  initialMonth,
  payoutList
}: UseSalaryPayoutTableOptions) => {
  const payoutMonth = ref(initialMonth)
  const payoutSearch = ref('')
  const payoutSearchExpanded = ref(false)
  const payoutFilters = reactive<{ status: SalaryPayoutStatus | undefined }>({
    status: undefined
  })
  const payoutPage = ref(1)
  const payoutPageSize = ref(20)

  const salaryPayoutData = computed<SalaryPayoutRow[]>(() => {
    const payoutMap = new Map<number, SalaryPayoutRecord>()
    payoutList.value.forEach(record => payoutMap.set(record.employee_id, record))

    const search = payoutSearch.value.trim().toLowerCase()
    return getEmployees()
      .map(employee => ({
        ...employee,
        payoutRecord: payoutMap.get(employee.id) || null
      }))
      .filter(item => !search ||
        item.name?.toLowerCase().includes(search) ||
        item.username?.toLowerCase().includes(search)
      )
      .filter(item => {
        if (payoutFilters.status === 'paid') return item.payoutRecord?.status === 'paid'
        if (payoutFilters.status === 'unpaid') return item.payoutRecord?.status !== 'paid'
        return true
      })
  })

  const paginatedPayoutData = computed(() => {
    const start = (payoutPage.value - 1) * payoutPageSize.value
    return salaryPayoutData.value.slice(start, start + payoutPageSize.value)
  })

  const handlePayoutPaginationChange = (page: number, pageSize: number) => {
    payoutPage.value = page
    payoutPageSize.value = pageSize
  }

  const resetPayoutTableFilters = () => {
    payoutSearch.value = ''
    payoutFilters.status = undefined
    payoutPage.value = 1
  }

  watch([payoutSearch, () => payoutFilters.status], () => {
    payoutPage.value = 1
  })

  return {
    getPayoutIndex: (index: number) => (payoutPage.value - 1) * payoutPageSize.value + index + 1,
    handlePayoutPaginationChange,
    paginatedPayoutData,
    payoutFilters,
    payoutMonth,
    payoutPage,
    payoutPageSize,
    payoutSearch,
    payoutSearchExpanded,
    resetPayoutTableFilters,
    salaryPayoutData
  }
}
