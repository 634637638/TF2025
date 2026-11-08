'use strict'

// Role selectors may load several hundred rows, but should never request an unbounded list.
const PERMISSION_LIST_DEFAULT_PAGE_SIZE = 50
const PERMISSION_LIST_MAX_PAGE_SIZE = 500

module.exports = {
  PERMISSION_LIST_DEFAULT_PAGE_SIZE,
  PERMISSION_LIST_MAX_PAGE_SIZE
}
