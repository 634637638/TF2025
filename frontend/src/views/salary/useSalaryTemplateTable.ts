import { computed, reactive, ref, type Ref } from 'vue'

interface SalaryTemplateListItem {
  id: number
  name?: string | null
  description?: string | null
}

interface UseSalaryTemplateTableOptions {
  templates: Ref<SalaryTemplateListItem[]>
}

export const useSalaryTemplateTable = ({ templates }: UseSalaryTemplateTableOptions) => {
  const templateSearchExpanded = ref(false)
  const templateSearch = ref('')
  const templateFilters = reactive<{ is_active: boolean | undefined }>({
    is_active: undefined
  })
  const templatePage = ref(1)
  const templatePageSize = ref(20)

  const filteredTemplates = computed(() => {
    if (!templateSearch.value) return [...templates.value]

    const search = templateSearch.value.toLowerCase()
    return templates.value.filter(template =>
      template.name?.toLowerCase().includes(search) ||
      template.description?.toLowerCase().includes(search)
    )
  })

  const paginatedTemplates = computed(() => {
    const start = (templatePage.value - 1) * templatePageSize.value
    return filteredTemplates.value.slice(start, start + templatePageSize.value)
  })

  const handleTemplatePaginationChange = (page: number, pageSize: number) => {
    templatePage.value = page
    templatePageSize.value = pageSize
  }

  const resetTemplateTableFilters = () => {
    templateSearch.value = ''
    templateFilters.is_active = undefined
    templatePage.value = 1
  }

  return {
    filteredTemplates,
    handleTemplatePaginationChange,
    paginatedTemplates,
    resetTemplateTableFilters,
    templateFilters,
    templatePage,
    templatePageSize,
    templateSearch,
    templateSearchExpanded
  }
}
