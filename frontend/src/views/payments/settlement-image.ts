import { createTableImage } from '@/utils/table-image'

/** 对外核对图片保留摘要与明细，排除内部销售、利润和打款填写区。 */
export const createSettlementImage = (source: HTMLElement) => createTableImage(source, {
  contextClass: 'supplier-phone-payments-view supplier-phone-payments-dialog',
  prepareClone: capture => {
    capture.querySelectorAll<HTMLElement>('.payment-summary-cards').forEach(summary => {
      const isBatchDetails = summary.classList.contains('payment-batch-summary-cards')
      const columns = Math.max(1, isBatchDetails ? Math.min(3, summary.children.length) : summary.children.length)
      // 隐藏内部数据后重新排布，批次详情保留信息分组和独占一行的备注。
      summary.style.setProperty('display', 'grid', 'important')
      summary.style.setProperty('grid-template-columns', `repeat(${columns}, minmax(0, 1fr))`, 'important')
      summary.querySelectorAll<HTMLElement>(':scope > .info-row').forEach(card => {
        // 页面手机布局使用四分之一宽度及首卡跨列，导出按剩余项目均分。
        card.style.setProperty('width', 'auto', 'important')
        card.style.setProperty('grid-column', isBatchDetails && card.classList.contains('batch-summary-remarks') ? '1 / -1' : 'auto', 'important')
      })
    })
  }
})
