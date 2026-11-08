'use strict'

const isBuyoutMode = value => ['buyout', 'monthly'].includes(String(value || ''))
const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100
const positiveMoney = value => Number.isFinite(Number(value)) && Number(value) >= 0
const getPrincipalAmount = (salePrice, downPayment) => roundMoney(Math.max(Number(salePrice || 0) - Number(downPayment || 0), 0))

const getInstallmentAmount = (principal, monthlyRent, termMonths, periodNumber) => {
  const term = Math.max(Number(termMonths || 1), 1)
  const basePrincipal = roundMoney(Number(principal || 0) / term)
  const principalDue = Number(periodNumber) === term
    ? roundMoney(Number(principal || 0) - basePrincipal * (term - 1))
    : basePrincipal
  return roundMoney(principalDue + Number(monthlyRent || 0))
}

const addMonthsClamped = (dateText, monthOffset) => {
  const [year, month, day] = String(dateText).split('-').map(Number)
  const targetMonthIndex = month - 1 + monthOffset
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

module.exports = { isBuyoutMode, roundMoney, positiveMoney, getPrincipalAmount, getInstallmentAmount, addMonthsClamped }
