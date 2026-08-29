const {
  addDaysToDateKey,
  formatLocalDate
} = require('./time')

function buildLeaveExclusionRules(leaveRows) {
  const fullDayDates = new Set();

  (leaveRows || []).forEach(row => {
    const recordDate = formatLocalDate(row.record_date)
    if (!recordDate) {
      return
    }

    const leaveDays = parseFloat(row.leave_days)
    const normalizedLeaveDays = Number.isFinite(leaveDays) && leaveDays > 0 ? leaveDays : 1
    const fullDays = Math.max(1, Math.ceil(normalizedLeaveDays))

    for (let i = 0; i < fullDays; i++) {
      const dateKey = addDaysToDateKey(recordDate, i)
      if (dateKey) {
        fullDayDates.add(dateKey)
      }
    }
  })

  return {
    fullDayDates
  }
}

function shouldExcludeSaleByLeave(saleTime, rules) {
  const saleDate = formatLocalDate(saleTime)
  if (!saleDate) {
    return false
  }

  if (rules.fullDayDates.has(saleDate)) {
    return true
  }

  return false
}

module.exports = {
  buildLeaveExclusionRules,
  shouldExcludeSaleByLeave
}
