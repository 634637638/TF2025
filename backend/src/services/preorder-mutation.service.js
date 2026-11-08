'use strict'

const PreorderMutationRepository = require('../repositories/preorder-mutation.repository')
const PreorderReadRepository = require('../repositories/preorder-read.repository')
const log = require('../utils/log')
const { PREORDER_STATUS } = require('../config/preorder-response.constants')

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const isValidDateOnly = value => {
  if (!DATE_ONLY_PATTERN.test(String(value || ''))) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const LEGACY_CREATE_FIELDS = ['expected_price', 'advance_payment', 'deposit', 'phone_model', 'color', 'storage', 'notes']
const LEGACY_UPDATE_FIELDS = [...LEGACY_CREATE_FIELDS, 'customer_name', 'customer_phone']

class PreorderMutationService {
  constructor({ repository = new PreorderMutationRepository(), readRepository = new PreorderReadRepository() } = {}) {
    this.repository = repository
    this.readRepository = readRepository
  }

  async remove(id) {
    const status = await this.repository.getStatus(id)
    if (!status) return { error: 'not_found' }
    if (status !== PREORDER_STATUS.CANCELLED && status !== PREORDER_STATUS.DELIVERED) {
      return { error: 'invalid_status' }
    }

    const deleted = await this.repository.deleteById(id)
    return deleted
      ? { data: { id: parseInt(id), deleted: true } }
      : { error: 'not_found' }
  }

  async create(input = {}, user = {}) {
    const receivedLegacyField = LEGACY_CREATE_FIELDS.find(field => Object.prototype.hasOwnProperty.call(input, field))
    if (receivedLegacyField) return { error: 'legacy_field', field: receivedLegacyField }

    const {
      customer_id,
      store_id,
      created_by,
      brand_id,
      model_id,
      color_id,
      memory_id,
      is_new,
      total_price,
      deposit_amount,
      expected_arrival,
      remarks
    } = input
    const finalStoreId = store_id ?? user.store_id ?? null
    const normalizedCondition = Number(is_new)
    const normalizedDepositAmount = Number(deposit_amount)
    const normalizedTotalPrice = total_price === undefined || total_price === null || total_price === ''
      ? null
      : Number(total_price)
    const normalizedExpectedArrival = expected_arrival || new Date().toISOString().slice(0, 10)

    if (![0, 1].includes(normalizedCondition)) return { error: 'invalid_condition' }

    return this.repository.withConnection(async connection => {
      if (!customer_id) return { error: 'customer_required' }
      if (!brand_id || !model_id || !color_id || !memory_id) return { error: 'reference_required' }
      if (!Number.isFinite(normalizedDepositAmount) || normalizedDepositAmount <= 0) {
        return { error: 'invalid_deposit' }
      }
      if (normalizedTotalPrice !== null && (!Number.isFinite(normalizedTotalPrice) || normalizedTotalPrice < 0)) {
        return { error: 'invalid_total_price' }
      }
      if (expected_arrival && !isValidDateOnly(expected_arrival)) return { error: 'invalid_expected_arrival' }

      if (!await this.repository.hasCustomer(connection, customer_id)) return { error: 'customer_not_found' }
      if (!await this.repository.hasReference(connection, 'brands', brand_id)) return { error: 'brand_not_found' }
      if (!await this.repository.hasReference(connection, 'models', model_id)) return { error: 'model_not_found' }
      if (!await this.repository.hasReference(connection, 'colors', color_id)) return { error: 'color_not_found' }
      if (!await this.repository.hasReference(connection, 'memories', memory_id)) return { error: 'memory_not_found' }

      const now = new Date()
      const preorderNumber = `PR${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      const userId = user.sub || user.id
      const preorderPersonId = created_by === undefined || created_by === null || created_by === ''
        ? userId
        : Number(created_by)
      if (!Number.isSafeInteger(Number(preorderPersonId)) || Number(preorderPersonId) <= 0) {
        return { error: 'invalid_preorder_person' }
      }
      if (!await this.repository.hasActiveUser(connection, preorderPersonId)) {
        return { error: 'preorder_person_unavailable' }
      }

      let transactionStarted = false
      const rollback = async () => {
        if (!transactionStarted) return
        try {
          await connection.rollback()
        } catch (error) {
          log.error('创建预定单事务回滚失败:', error)
        } finally {
          transactionStarted = false
        }
      }

      try {
        await connection.beginTransaction()
        transactionStarted = true
        const matchedPhone = await this.repository.findAutoMatchCandidate(connection, {
          brand_id,
          model_id,
          color_id,
          memory_id,
          is_new: normalizedCondition
        })
        const status = matchedPhone ? PREORDER_STATUS.MATCHED : PREORDER_STATUS.PENDING
        if (matchedPhone && !await this.repository.reserveAutoMatchPhone(connection, matchedPhone.id)) {
          throw new Error('匹配设备已被占用')
        }

        const preorderId = await this.repository.insertPreorder(connection, {
          preorderNumber,
          customerId: customer_id,
          storeId: finalStoreId || null,
          brandId: brand_id,
          modelId: model_id,
          colorId: color_id,
          memoryId: memory_id,
          isNew: normalizedCondition,
          depositAmount: normalizedDepositAmount,
          totalPrice: normalizedTotalPrice,
          expectedArrival: normalizedExpectedArrival,
          status,
          remarks,
          createdBy: preorderPersonId,
          matchedPhone
        })
        await connection.commit()
        transactionStarted = false
        return {
          data: {
            id: preorderId,
            preorder_number: preorderNumber,
            auto_matched: Boolean(matchedPhone),
            matched_phone_id: matchedPhone?.id || null,
            imei: matchedPhone?.imei || null
          },
          matched: Boolean(matchedPhone)
        }
      } catch (error) {
        await rollback()
        throw error
      } finally {
        await rollback()
      }
    })
  }

  async update(id, input = {}) {
    const updateData = { ...input }
    return this.repository.withConnection(async connection => {
      let transactionStarted = false
      const rollback = async () => {
        if (!transactionStarted) return
        try {
          await connection.rollback()
        } catch (error) {
          log.error('更新预定单事务回滚失败:', error)
        } finally {
          transactionStarted = false
        }
      }
      const reject = async error => {
        await rollback()
        return { error }
      }

      try {
        await connection.beginTransaction()
        transactionStarted = true
        const preorder = await this.repository.getForUpdate(connection, id)
        if (!preorder) return reject('not_found')
        if (![PREORDER_STATUS.PENDING, PREORDER_STATUS.MATCHED].includes(preorder.status)) {
          return reject('invalid_status')
        }

        const receivedLegacyField = LEGACY_UPDATE_FIELDS.find(field => (
          Object.prototype.hasOwnProperty.call(updateData, field)
        ))
        if (receivedLegacyField) {
          await rollback()
          return { error: 'legacy_field', field: receivedLegacyField }
        }
        if (updateData.expected_arrival && !isValidDateOnly(updateData.expected_arrival)) {
          return reject('invalid_expected_arrival')
        }
        if (updateData.is_new !== undefined && ![0, 1].includes(Number(updateData.is_new))) {
          return reject('invalid_condition')
        }

        if (updateData.deposit_amount !== undefined) {
          const depositAmount = Number(updateData.deposit_amount)
          if (!Number.isFinite(depositAmount) || depositAmount <= 0) return reject('invalid_deposit')
          updateData.deposit_amount = depositAmount
        }
        if (updateData.total_price !== undefined && updateData.total_price !== null && updateData.total_price !== '') {
          const totalPrice = Number(updateData.total_price)
          if (!Number.isFinite(totalPrice) || totalPrice < 0) return reject('invalid_total_price')
          updateData.total_price = totalPrice
        }
        if (updateData.customer_id !== undefined) {
          const customerId = Number(updateData.customer_id)
          if (!Number.isInteger(customerId) || customerId <= 0) return reject('invalid_customer_id')
          if (!await this.repository.hasCustomer(connection, customerId)) return reject('customer_not_found')
          updateData.customer_id = customerId
        }

        const specificationFields = ['brand_id', 'model_id', 'color_id', 'memory_id', 'is_new']
        const specificationChanged = preorder.status === PREORDER_STATUS.MATCHED && specificationFields.some(field => (
          updateData[field] !== undefined && Number(updateData[field]) !== Number(preorder[field])
        ))
        const staleMatchNeedsClearing = specificationChanged || (
          preorder.status === PREORDER_STATUS.PENDING && Boolean(preorder.matched_phone_id)
        )
        const allowedFields = [
          'customer_id', 'store_id', 'created_by', 'brand_id', 'model_id', 'color_id', 'memory_id', 'is_new',
          'expected_arrival', 'total_price', 'deposit_amount', 'remarks'
        ]
        const updates = Object.fromEntries(allowedFields
          .filter(field => updateData[field] !== undefined)
          .map(field => [field, updateData[field]]))

        if (updateData.created_by !== undefined) {
          const createdBy = Number(updateData.created_by)
          if (!Number.isSafeInteger(createdBy) || createdBy <= 0) return reject('invalid_created_by')
          if (!await this.repository.hasActiveUser(connection, createdBy)) return reject('creator_unavailable')
          updates.created_by = createdBy
        }
        if (Object.keys(updates).length === 0) return reject('no_fields')

        if (staleMatchNeedsClearing && preorder.matched_phone_id) {
          const released = await this.repository.releaseMatchedPhone(connection, preorder.matched_phone_id, id)
          if (!released && preorder.status === PREORDER_STATUS.MATCHED) return reject('release_failed')
        }

        await this.repository.updateEditablePreorder(connection, id, updates, staleMatchNeedsClearing)
        await connection.commit()
        transactionStarted = false
        const data = await this.repository.getEditablePreorderById(connection, id)
        return { data, staleMatchNeedsClearing }
      } catch (error) {
        await rollback()
        throw error
      } finally {
        await rollback()
      }
    })
  }

  async cancel(id, reason) {
    return this.repository.withConnection(async connection => {
      let transactionStarted = false
      const rollback = async () => {
        if (!transactionStarted) return
        try {
          await connection.rollback()
        } catch (error) {
          log.error('取消预定单事务回滚失败:', error)
        } finally {
          transactionStarted = false
        }
      }

      try {
        await connection.beginTransaction()
        transactionStarted = true
        const preorder = await this.repository.getForUpdate(connection, id)
        if (!preorder) {
          await rollback()
          return { error: 'not_found' }
        }
        if (preorder.status === PREORDER_STATUS.CANCELLED) {
          await rollback()
          return { error: 'already_cancelled' }
        }
        if (preorder.status === PREORDER_STATUS.DELIVERED) {
          await rollback()
          return { error: 'delivered' }
        }
        if (preorder.matched_phone_id) {
          const released = await this.repository.releaseMatchedPhone(connection, preorder.matched_phone_id, id)
          if (!released) {
            await rollback()
            return { error: 'phone_in_use' }
          }
        }

        await this.repository.markCancelled(connection, id, reason)
        await connection.commit()
        transactionStarted = false
        return { data: { id: parseInt(id), message: '预定单取消成功' } }
      } catch (error) {
        await rollback()
        throw error
      } finally {
        await rollback()
      }
    })
  }

  async restore(id) {
    return this.repository.withConnection(async connection => {
      let transactionStarted = false
      const rollback = async () => {
        if (!transactionStarted) return
        try {
          await connection.rollback()
        } catch (error) {
          log.error('恢复预定单事务回滚失败:', error)
        } finally {
          transactionStarted = false
        }
      }

      try {
        await connection.beginTransaction()
        transactionStarted = true
        const preorder = await this.repository.getForRestore(connection, id)
        if (!preorder) {
          await rollback()
          return { error: 'not_found' }
        }
        if (preorder.status !== PREORDER_STATUS.CANCELLED) {
          await rollback()
          return { error: 'invalid_status' }
        }

        if (preorder.matched_phone_id) {
          await this.repository.releaseMatchedPhone(connection, preorder.matched_phone_id, id)
        }

        const matchedPhone = await this.repository.findRestoreCandidate(connection, preorder)
        if (matchedPhone && !await this.repository.reserveRestoreCandidate(connection, matchedPhone.id)) {
          await rollback()
          return { error: 'phone_in_use' }
        }

        await this.repository.restorePreorder(connection, id, matchedPhone)
        await connection.commit()
        transactionStarted = false
        const data = await this.readRepository.getById(id, connection)
        return { data, matched: Boolean(matchedPhone) }
      } catch (error) {
        await rollback()
        throw error
      } finally {
        await rollback()
      }
    })
  }

  async match(id, input = {}) {
    const { phone_id, imei, actual_model, arrival_date, actual_price } = input
    if (!phone_id && !imei) return { error: 'phone_required' }
    if (arrival_date && !isValidDateOnly(arrival_date)) return { error: 'invalid_date' }

    return this.repository.withConnection(async connection => {
      let transactionStarted = false
      const rollback = async () => {
        if (!transactionStarted) return
        try {
          await connection.rollback()
        } catch (error) {
          log.error('匹配预定单事务回滚失败:', error)
        } finally {
          transactionStarted = false
        }
      }

      try {
        await connection.beginTransaction()
        transactionStarted = true
        const preorder = await this.repository.getForMatching(connection, id)
        if (!preorder) {
          await rollback()
          return { error: 'preorder_not_found' }
        }
        if (![PREORDER_STATUS.PENDING, PREORDER_STATUS.MATCHED].includes(preorder.status)) {
          await rollback()
          return { error: 'invalid_preorder_status' }
        }

        const previousPhoneId = preorder.matched_phone_id ? Number(preorder.matched_phone_id) : null
        const phone = await this.repository.getPhoneForMatching(connection, phone_id, imei)
        if (!phone) {
          await rollback()
          return { error: 'phone_not_found' }
        }

        const isSamePhone = previousPhoneId !== null && previousPhoneId === Number(phone.id)
        if (!['in_stock', 'reserved'].includes(phone.status) || (Number(phone.is_preordered) === 1 && !isSamePhone)) {
          await rollback()
          return { error: 'phone_unavailable' }
        }
        if (await this.repository.hasOtherActivePreorder(connection, phone.id, id)) {
          await rollback()
          return { error: 'phone_has_other_preorder' }
        }

        if (previousPhoneId !== null && !isSamePhone) {
          const previousPhone = await this.repository.getPreviousPhoneForMatching(connection, previousPhoneId)
          if (!previousPhone || !['in_stock', 'reserved'].includes(previousPhone.status)) {
            await rollback()
            return { error: 'previous_phone_unavailable' }
          }
          if (Number(previousPhone.is_preordered) !== 1) {
            await rollback()
            return { error: 'previous_phone_state_invalid' }
          }
        }

        const exactMatch = Number(phone.brand_id) === Number(preorder.brand_id) &&
          Number(phone.model_id) === Number(preorder.model_id) &&
          Number(phone.color_id) === Number(preorder.color_id) &&
          Number(phone.memory_id) === Number(preorder.memory_id) &&
          Number(phone.is_new) === Number(preorder.is_new)
        if (!exactMatch) {
          await rollback()
          return { error: 'specification_mismatch' }
        }

        const requestedPrice = actual_price === undefined || actual_price === null || actual_price === ''
          ? null
          : Number(actual_price)
        if (requestedPrice !== null && (!Number.isFinite(requestedPrice) || requestedPrice < 0)) {
          await rollback()
          return { error: 'invalid_price' }
        }

        const fallbackPrice = Number(preorder.total_price || phone.sale_price || 0)
        const finalPrice = requestedPrice !== null ? requestedPrice : fallbackPrice
        const depositAmount = Number(preorder.deposit_amount || preorder.deposit_paid || 0)
        const remainingAmount = Math.max(0, finalPrice - depositAmount)
        const resolvedModel = actual_model || [phone.brand_name, phone.model_name].filter(Boolean).join(' ')

        if (previousPhoneId !== null && !isSamePhone &&
          !await this.repository.releasePreviousPhone(connection, previousPhoneId)) {
          await rollback()
          return { error: 'previous_phone_release_failed' }
        }

        await this.repository.updateMatchedPreorder(connection, {
          id,
          phone,
          model: resolvedModel,
          arrivalDate: arrival_date,
          price: finalPrice
        })
        if (!await this.repository.reserveMatchedPhone(connection, phone.id)) {
          await rollback()
          return { error: 'phone_reservation_failed' }
        }

        await connection.commit()
        transactionStarted = false
        return {
          data: {
            id: parseInt(id),
            matched_phone_id: phone.id,
            imei: phone.imei,
            actual_model: resolvedModel,
            actual_price: finalPrice,
            remaining_amount: remainingAmount
          },
          message: isSamePhone
            ? '匹配设备未变更'
            : previousPhoneId
              ? '匹配设备更换成功，库存已重新预留'
              : '预定单匹配成功，库存已预留，尚未出库'
        }
      } catch (error) {
        await rollback()
        throw error
      } finally {
        await rollback()
      }
    })
  }
}

module.exports = PreorderMutationService
