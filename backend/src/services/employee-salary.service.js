'use strict'

const EmployeeSalaryRepository = require('../repositories/employee-salary.repository')
const { getSalaryAccessScope } = require('./access-control.service')
const log = require('../utils/log')

class EmployeeSalaryService {
  constructor({
    repository = new EmployeeSalaryRepository(),
    getSalaryAccessScope: resolveSalaryScope = getSalaryAccessScope,
    logger = log,
    now = () => new Date()
  } = {}) {
    this.repository = repository
    this.getSalaryAccessScope = resolveSalaryScope
    this.logger = logger
    this.now = now
  }

  async getSalaryList(userId) {
    const { isAdmin } = await this.getSalaryAccessScope(userId)
    const employees = await this.repository.getSalaryList({ isAdmin, userId })
    return { employees: employees || [], total: employees.length }
  }

  async getCurrentSalaries(userId, date) {
    const { isAdmin } = await this.getSalaryAccessScope(userId)
    const employees = await this.repository.getCurrentSalaryRows({ isAdmin, userId })
    return employees.map(employee => this.mapCurrentSalary(employee, date))
  }

  mapCurrentSalary(employee, date) {
    const baseSalary = parseFloat(employee.base_salary) || 0
    let currentSalary = baseSalary
    let salaryAdjustment = 0
    let salaryNote = ''

    if (employee.auto_raise_rule && employee.hire_date) {
      try {
        const rule = typeof employee.auto_raise_rule === 'string'
          ? JSON.parse(employee.auto_raise_rule)
          : employee.auto_raise_rule

        if (rule.enabled && rule.months && rule.amount) {
          const hireDate = new Date(employee.hire_date)
          let calculationDate
          if (date) {
            const [year, month] = date.split('-').map(Number)
            calculationDate = new Date(year, month - 1, 1)
          } else {
            calculationDate = this.now()
          }

          const years = calculationDate.getFullYear() - hireDate.getFullYear()
          const months = calculationDate.getMonth() - hireDate.getMonth()
          const monthsOfService = years * 12 + months
          const raiseCount = Math.floor(monthsOfService / rule.months)

          if (raiseCount > 0) {
            const potentialAdjustment = raiseCount * parseFloat(rule.amount)
            const maxSalary = parseFloat(rule.max_salary) || 0
            const newSalary = baseSalary + potentialAdjustment
            if (maxSalary > 0 && newSalary > maxSalary) {
              salaryAdjustment = maxSalary - baseSalary
              currentSalary = maxSalary
              salaryNote = `工龄涨薪：每${rule.months}个月涨${rule.amount}元，已达到上限`
            } else {
              salaryAdjustment = potentialAdjustment
              currentSalary = newSalary
              salaryNote = `工龄涨薪：每${rule.months}个月涨${rule.amount}元，已涨薪${raiseCount}次`
            }
          }
        }
      } catch (error) {
        this.logger.warn('解析自动涨薪规则失败:', error)
      }
    }

    return {
      id: employee.id,
      username: employee.username,
      name: employee.name,
      salary_template_id: employee.salary_template_id,
      base_salary: baseSalary,
      current_salary: currentSalary,
      salary_adjustment: salaryAdjustment,
      salary_note: salaryNote,
      commission_type: employee.commission_type || 'fixed',
      commission_fixed: parseFloat(employee.commission_fixed) || 0,
      commission_new_fixed: parseFloat(employee.commission_new_fixed || employee.commission_fixed) || 0,
      commission_used_fixed: parseFloat(employee.commission_used_fixed) || 0,
      commission_percentage: parseFloat(employee.commission_percentage) || 0,
      overtime_hourly_rate: parseFloat(employee.overtime_hourly_rate) || 0,
      rest_days: parseFloat(employee.rest_days) || 0
    }
  }
}

module.exports = EmployeeSalaryService
