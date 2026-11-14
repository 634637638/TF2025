import { computed } from 'vue'
import { usePagePermissions } from './usePagePermissions'
import { fieldPermissions } from './useFieldPermissions'
import { canViewAccessoryField } from '@/components/accessory-field-permissions'

/** 原采购单与当前仓库各自授权，查看核对不授予任何退供或退款动作。 */
export const useAccessoryPurchaseReturnPermissions = () => {
  const { canView } = usePagePermissions('supplier-payments')
  const { canView: canViewStock } = usePagePermissions('accessories')
  const purchaseVisible = (field: string) => fieldPermissions.isFieldVisible('payments_supplierphonepaymentsview', field)
  const canViewReturnContext = computed(() => canView.value && canViewStock.value &&
    ['purchase.quantity', 'payment.supplier_name', 'payment.store_name', 'payment.purchase_cost', 'payment.payment_status'].every(purchaseVisible) &&
    canViewAccessoryField('distribution') && canViewAccessoryField('total_quantity'))
  const canQuoteReturn = computed(() => canViewReturnContext.value &&
    canViewAccessoryField('purchase_cost') && canViewAccessoryField('usage_type') && canViewAccessoryField('serial_tracking'))
  return { canViewReturnContext, canQuoteReturn, purchaseVisible }
}
