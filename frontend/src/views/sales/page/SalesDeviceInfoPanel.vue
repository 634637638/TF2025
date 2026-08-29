<template>
  <!-- 设备信息 -->
  <div class="device-info-section">
    <h4>设备信息</h4>

    <!-- 批量模式显示多台设备 -->
    <div
      v-if="batchMode"
      class="batch-devices-list"
    >
      <div
        v-for="(phone, index) in selectedPhones"
        :key="phone.id"
        class="device-item compact"
      >
        <div class="device-number">
          {{ index + 1 }}
        </div>
        <div class="device-image">
          <Image
            :src="getPhoneImageSrc(phone)"
            :alt="phone.brand + ' ' + phone.model"
            mode="eager"
            :product-info="{
              brand: phone.brand || '',
              model: phone.model || '',
              color: phone.color || '',
              memory: phone.memory || ''
            }"
          />
        </div>
        <div class="device-details">
          <div class="device-name">
            {{ [canViewSaleField('brand') ? phone.brand : '', canViewSaleField('model') ? phone.model : ''].filter(Boolean).join(' ') || '设备信息' }}
          </div>
          <div class="device-specs">
            <span
              v-if="canViewSaleField('color')"
              class="spec-item"
            >{{ phone.color }}</span>
            <span
              v-if="canViewSaleField('memory')"
              class="spec-item"
            >{{ phone.memory }}</span>
            <span
              v-if="canViewSaleField('condition')"
              class="condition-badge"
              :class="phone.is_new ? 'new' : 'used'"
            >
              {{ getNewConditionLabel(phone.is_new) }}
            </span>
          </div>
          <div
            v-if="canViewSaleField('imei')"
            class="device-id"
          >
            <span class="label">IMEI:</span>
            <span class="imei">{{ phone.imei || '-' }}</span>
          </div>
        </div>
        <div
          v-if="canViewPrice"
          class="device-pricing"
        >
          <div class="cost-info">
            <span class="cost-label">入库价格</span>
            <span class="cost-value">{{ canViewPrice ? `¥${formatNumber(phone.purchase_cost || 0)}` : '***' }}</span>
          </div>
        </div>
      </div>

      <!-- 批量统计信息 -->
      <div class="batch-summary">
        <div class="summary-item">
          <span class="label">总数量:</span>
          <span class="value">{{ selectedPhones.length }}台</span>
        </div>
        <div
          v-if="canViewPrice"
          class="summary-item"
        >
          <span class="label">总成本:</span>
          <span class="value">¥{{ getTotalCost() }}</span>
        </div>
        <div
          v-if="canViewPrice && getTotalProfit !== 0"
          class="summary-item"
        >
          <span class="label">预计总利润:</span>
          <span
            class="value"
            :class="Number(getTotalProfit) >= 0 ? 'positive' : 'negative'"
          >
            ¥{{ getTotalProfit }}
          </span>
        </div>
      </div>
    </div>

    <!-- 单台模式显示单台设备 -->
    <div
      v-else
      class="device-card compact"
    >
      <div
        v-if="!isMobile"
        class="device-image"
      >
        <Image
          :src="getPhoneImageSrc(selectedPhone)"
          :alt="selectedPhone?.model"
          mode="eager"
          :product-info="{
            brand: selectedPhone?.brand || '',
            model: selectedPhone?.model || '',
            color: selectedPhone?.color || '',
            memory: selectedPhone?.memory || ''
          }"
        />
      </div>
      <div class="device-details">
        <template v-if="isMobile">
          <div class="sale-mobile-device">
            <div class="sale-mobile-device-card">
              <div class="sale-mobile-device-head">
                <div class="sale-mobile-device-main">
                  <span class="sale-mobile-device-name">
                    {{
                      [
                        canViewSaleField('brand') ? selectedPhone?.brand : '',
                        canViewSaleField('model') ? selectedPhone?.model : ''
                      ].filter(Boolean).join(' ')
                        || '设备信息'
                    }}
                  </span>
                  <span class="sale-mobile-device-specs">
                    {{
                      [
                        canViewSaleField('color') ? selectedPhone?.color : ''
                      ].filter(Boolean).join(' ')
                        || '-'
                    }}
                  </span>
                </div>
                <div
                  v-if="canViewSaleField('condition')"
                  class="sale-mobile-device-tags"
                >
                  <span
                    v-if="canViewSaleField('condition')"
                    class="sale-mobile-device-tag"
                  >
                    {{ getNewConditionLabel(selectedPhone?.is_new ?? false) }}
                  </span>
                </div>
              </div>

              <div
                v-if="canViewSaleField('supplier_name') || canViewSaleField('inventory_operator_name')"
                class="sale-mobile-info-grid"
              >
                <div
                  v-if="canViewSaleField('supplier_name')"
                  class="sale-mobile-info-item"
                >
                  <span class="sale-mobile-info-label">供应商</span>
                  <span class="sale-mobile-info-value">{{ selectedPhone?.supplier_name || '-' }}</span>
                </div>
                <div
                  v-if="canViewSaleField('inventory_operator_name')"
                  class="sale-mobile-info-item"
                >
                  <span class="sale-mobile-info-label">入库员</span>
                  <span class="sale-mobile-info-value">{{ selectedPhone?.inventory_operator_name || '-' }}</span>
                </div>
              </div>

              <div
                v-if="canViewSaleField('memory') || canViewPrice"
                class="sale-mobile-spec-grid"
              >
                <div
                  v-if="canViewSaleField('memory')"
                  class="sale-mobile-spec-item"
                >
                  <span class="sale-mobile-spec-label">内存</span>
                  <span class="sale-mobile-spec-value">{{ selectedPhone?.memory || '-' }}</span>
                </div>
                <div
                  v-if="canViewPrice"
                  class="sale-mobile-spec-item"
                >
                  <span class="sale-mobile-spec-label">入库价格</span>
                  <span class="sale-mobile-spec-value sale-mobile-spec-price">
                    ¥{{ formatNumber(selectedPhone?.purchase_cost || 0) }}
                  </span>
                </div>
              </div>

              <div
                v-if="canViewSaleField('imei') || canViewSaleField('serial_number')"
                class="sale-mobile-code-row"
              >
                <div
                  v-if="canViewSaleField('imei')"
                  class="sale-mobile-code-item"
                >
                  <span class="sale-mobile-code-label">IMEI</span>
                  <span class="sale-mobile-code-value">{{ selectedPhone?.imei || '-' }}</span>
                </div>
                <div
                  v-if="canViewSaleField('serial_number')"
                  class="sale-mobile-code-item"
                >
                  <span class="sale-mobile-code-label">序列号</span>
                  <span class="sale-mobile-code-value">{{ selectedPhone?.serial_number || '-' }}</span>
                </div>
              </div>

              <div
                v-if="selectedPhone?.purchase_number || canViewSaleField('inventory_time')"
                class="sale-mobile-purchase-grid"
              >
                <div
                  v-if="canViewSaleField('inventory_time')"
                  class="sale-mobile-purchase-row"
                >
                  <span class="sale-mobile-purchase-label">入库时间</span>
                  <span class="sale-mobile-purchase-value">
                    {{ formatDate(selectedPhone?.inventory_time) || '-' }}
                  </span>
                </div>
                <div
                  v-if="selectedPhone?.purchase_number"
                  class="sale-mobile-purchase-row"
                >
                  <span class="sale-mobile-purchase-label">采购编号</span>
                  <span class="sale-mobile-purchase-value">{{ selectedPhone?.purchase_number }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div
          v-else
          class="device-meta"
        >
          <div
            v-if="canViewSaleField('supplier_name')"
            class="meta-item"
          >
            <span class="meta-label">供应商:</span>
            <span class="meta-value">{{ selectedPhone?.supplier_name || '-' }}</span>
          </div>
          <div
            v-if="canViewSaleField('brand')"
            class="meta-item"
          >
            <span class="meta-label">品牌:</span>
            <span class="meta-value">{{ selectedPhone?.brand || '-' }}</span>
          </div>
          <div
            v-if="canViewSaleField('model')"
            class="meta-item"
          >
            <span class="meta-label">型号:</span>
            <span class="meta-value">{{ selectedPhone?.model || '-' }}</span>
          </div>
          <div
            v-if="canViewSaleField('color')"
            class="meta-item"
          >
            <span class="meta-label">颜色:</span>
            <span class="meta-value">{{ selectedPhone?.color || '-' }}</span>
          </div>
          <div
            v-if="canViewSaleField('memory')"
            class="meta-item"
          >
            <span class="meta-label">内存:</span>
            <span class="meta-value">{{ selectedPhone?.memory || '-' }}</span>
          </div>
          <div
            v-if="canViewPrice"
            class="meta-item"
          >
            <span class="meta-label">入库价格:</span>
            <span class="meta-value price">¥{{ formatNumber(selectedPhone?.purchase_cost || 0) }}</span>
          </div>
          <div
            v-if="canViewSaleField('imei')"
            class="meta-item meta-item-wide"
          >
            <span class="meta-label">IMEI:</span>
            <span class="meta-value">{{ selectedPhone?.imei || '-' }}</span>
          </div>
          <div
            v-if="canViewSaleField('serial_number')"
            class="meta-item meta-item-wide"
          >
            <span class="meta-label">序列号:</span>
            <span class="meta-value">{{ selectedPhone?.serial_number || '-' }}</span>
          </div>
          <div
            v-if="canViewSaleField('condition')"
            class="meta-item"
          >
            <span class="meta-label">机况:</span>
            <span class="meta-value">{{ getNewConditionLabel(selectedPhone?.is_new ?? false) }}</span>
          </div>
          <div
            v-if="canViewSaleField('inventory_operator_name')"
            class="meta-item"
          >
            <span class="meta-label">入库员:</span>
            <span class="meta-value">{{ selectedPhone?.inventory_operator_name || '-' }}</span>
          </div>
          <div
            v-if="canViewSaleField('inventory_time')"
            class="meta-item meta-item-wide"
          >
            <span class="meta-label">入库时间:</span>
            <span class="meta-value">
              {{ formatDate(selectedPhone?.inventory_time) || '-' }}
            </span>
          </div>
          <div class="meta-item meta-item-wide">
            <span class="meta-label">采购编号:</span>
            <span class="meta-value">{{ selectedPhone?.purchase_number || '-' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Image from '@/components/Image.vue'
import { formatNumber } from '@/utils/format'
import type { Phone } from '@/types'
import {
  formatSalesDate as formatDate,
  getNewConditionLabel,
  getPhoneImageSrc
} from '../sales-phone-helpers'

const props = defineProps<{
  batchMode: boolean
  selectedPhones: Phone[]
  selectedPhone: Phone | null
  isMobile: boolean
  canViewField: (_fieldName: string) => boolean
  canViewPrice: boolean
  totalCost: number
  totalProfit: number | string
}>()

const batchMode = computed(() => props.batchMode)
const selectedPhones = computed(() => props.selectedPhones)
const selectedPhone = computed(() => props.selectedPhone)
const isMobile = computed(() => props.isMobile)
const canViewPrice = computed(() => props.canViewPrice)
const getTotalProfit = computed(() => props.totalProfit)
const getTotalCost = () => props.totalCost
const canViewSaleField = (fieldName: string) => props.canViewField(fieldName)
</script>

<style scoped lang="scss" src="../styles/sales-device-info-panel.scss"></style>

