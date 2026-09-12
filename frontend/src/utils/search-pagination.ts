export const SEARCH_PAGINATION_RESET_EVENT = 'tf-search-reset-pagination'

export type SearchPaginationScope = Element | Document

const SEARCH_SCOPE_SELECTOR = '[data-search-pagination-scope], .admin-page, .page-container, .view-content'

export const getSearchPaginationScope = (element: HTMLElement | null): SearchPaginationScope | null => {
  if (element) {
    return element.closest(SEARCH_SCOPE_SELECTOR) || (
      typeof document !== 'undefined' ? document : null
    )
  }

  return typeof document !== 'undefined' ? document : null
}

export const requestPaginationReset = (element: HTMLElement | null) => {
  const scope = getSearchPaginationScope(element)
  if (!scope || typeof CustomEvent === 'undefined') return

  scope.dispatchEvent(new CustomEvent(SEARCH_PAGINATION_RESET_EVENT))
}
