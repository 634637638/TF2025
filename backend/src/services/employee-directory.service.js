'use strict'

const { PAGINATION } = require('../config/constants')
const EmployeeDirectoryRepository = require('../repositories/employee-directory.repository')
const { formatEmployeeRoles } = require('../utils/employee-role-format')

class EmployeeDirectoryService {
  constructor({ repository = new EmployeeDirectoryRepository() } = {}) {
    this.repository = repository
  }

  async listEmployees(query = {}) {
    const page = Math.max(1, Number.parseInt(String(query.page || PAGINATION.DEFAULT_PAGE), 10) || PAGINATION.DEFAULT_PAGE)
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(query.page_size ?? PAGINATION.DEFAULT_LIMIT), 10) || PAGINATION.DEFAULT_LIMIT))
    const status = query.status
    const search = query.search
    const offset = (page - 1) * pageSize
    const { employees, total } = await this.repository.listEmployees({ status, search, pageSize, offset })
    const totalPages = Math.ceil(total / pageSize)

    return {
      employees: employees.map(formatEmployeeRoles),
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    }
  }

  async getEmployeeById(id) {
    const employee = await this.repository.getEmployeeById(id)
    return employee ? formatEmployeeRoles(employee) : null
  }
}

module.exports = EmployeeDirectoryService
