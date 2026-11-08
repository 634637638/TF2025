'use strict'

const RentalScheduleRepository = require('../repositories/rental-schedule.repository')
const dataMaskingService = require('./data-masking.service')
const { ensureRentalSchema } = require('../utils/rental-schema')
const { isBuyoutMode, getInstallmentAmount, addMonthsClamped } = require('../utils/rental-calculations')
const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

const MODULE_KEY = 'rentals_rentalsview'

class RentalScheduleService {
  constructor({
    repository = new RentalScheduleRepository(),
    masking = dataMaskingService,
    ensureSchema = ensureRentalSchema,
    databaseProvider = getDatabase
  } = {}) {
    this.repository = repository
    this.masking = masking
    this.ensureSchema = ensureSchema
    this.databaseProvider = databaseProvider
  }

  async getPaymentSchedule(rentalId, userId) {
    await this.ensureSchema()
    const rental = await this.repository.getRental(rentalId)
    if (!rental) return null
    const payments = await this.repository.getPayments(rentalId)
    if (!isBuyoutMode(rental.billing_mode)) return []

    const paidMap = new Map(payments.filter(payment => payment.period_number)
      .map(payment => [Number(payment.period_number), payment]))
    const schedule = Array.from({ length: Number(rental.term_months || 0) }, (_, index) => {
      const periodNumber = index + 1
      const payment = paidMap.get(periodNumber)
      return {
        period_number: periodNumber,
        due_date: addMonthsClamped(rental.start_date, periodNumber),
        principal_amount: getInstallmentAmount(rental.principal_amount, 0, rental.term_months, periodNumber),
        monthly_rent: Number(rental.monthly_rent || 0),
        amount: getInstallmentAmount(rental.principal_amount, rental.monthly_rent, rental.term_months, periodNumber),
        paid: Boolean(payment),
        paid_at: payment?.paid_at || null,
        operator_name: payment?.operator_name || null
      }
    })

    const permissions = await this.masking.getUserFieldPermissions(userId, MODULE_KEY)
    const hiddenFields = new Set(permissions.hiddenFields || [])
    return schedule.map(item => ({
      period_number: hiddenFields.has('schedule_info.term_months') ? null : item.period_number,
      due_date: hiddenFields.has('schedule_info.next_due_date') ? null : item.due_date,
      principal_amount: hiddenFields.has('price_info.principal_amount') ? null : item.principal_amount,
      monthly_rent: hiddenFields.has('price_info.monthly_rent') ? null : item.monthly_rent,
      amount: hiddenFields.has('price_info.installment_amount') ? null : item.amount,
      paid: hiddenFields.has('price_info.paid_rent') ? null : item.paid,
      paid_at: hiddenFields.has('price_info.paid_rent') ? null : item.paid_at,
      operator_name: hiddenFields.has('operator_info.operator_name') ? null : item.operator_name
    }))
  }

  async recordPayment(rentalId, body, userId) {
    await this.ensureSchema()
    return withConnection(this.databaseProvider, async connection => {
      let transactionStarted = false
      try {
        await connection.beginTransaction()
        transactionStarted = true
        const rental = await this.repository.getPaymentRental(connection, rentalId)
        if (!rental) throw new Error('租赁合同不存在')
        if (['returned', 'damaged', 'bought_out'].includes(rental.status)) throw new Error('该合同已经结束')
        const remarks = String(body?.remarks || '').trim() || null
        const inserted = []
        if (isBuyoutMode(rental.billing_mode)) {
          const periodNumbers = [...new Set((body?.period_numbers || []).map(Number))].sort((a, b) => a - b)
          if (!periodNumbers.length || periodNumbers.some(number => !Number.isInteger(number) || number < 1 || number > Number(rental.term_months))) {
            throw new Error('请选择正确的未还期次')
          }
          const existing = await this.repository.findPaidPeriods(connection, rentalId, periodNumbers)
          if (existing.length) throw new Error(`第${existing.map(item => item.period_number).join('、')}期已经还款`)
          for (const periodNumber of periodNumbers) {
            const amount = getInstallmentAmount(rental.principal_amount, rental.monthly_rent, rental.term_months, periodNumber)
            const result = await this.repository.insertInstallment(connection, {
              rentalId, amount, periodNumber, operatorId: userId, remarks
            })
            inserted.push({ id: result.insertId })
            if (rental.sale_id) {
              await this.repository.insertPaymentRecord(connection, {
                saleId: rental.sale_id,
                customerId: rental.customer_id,
                paymentMethod: rental.sale_payment_method || 'cash',
                paymentChannel: rental.sale_payment_channel || null,
                amount,
                remarks: `租赁买断第${periodNumber}期 ${rental.contract_number || `MD${String(rentalId).padStart(8, '0')}`}${remarks ? `：${remarks}` : ''}`
              })
            }
          }
          const paidCount = await this.repository.countPaidPeriods(connection, rentalId)
          if (paidCount >= Number(rental.term_months || 0)) await this.repository.markBoughtOut(connection, rentalId)
        } else {
          const amount = Number(body?.amount)
          if (!Number.isFinite(amount) || amount <= 0) throw new Error('请输入正确的收款金额')
          const result = await this.repository.insertDailyPayment(connection, { rentalId, amount, operatorId: userId, remarks })
          inserted.push({ id: result.insertId })
        }
        await connection.commit()
        return { message: isBuyoutMode(rental.billing_mode) ? '月供已登记' : '租金还款已登记', inserted }
      } catch (error) {
        if (transactionStarted) await connection.rollback()
        throw error
      }
    })
  }

}

module.exports = RentalScheduleService
