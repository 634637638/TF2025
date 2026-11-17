/** 独立凭证打印：复制已授权的 DOM 和当前样式，不读取或补齐业务字段。 */
export function printElement(element: HTMLElement, title: string, overrides = ''): boolean {
  const printWindow = window.open('', '', 'width=800,height=600')
  if (!printWindow) return false
  const stylesheetText = Array.from(document.styleSheets).map(sheet => {
    try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n') }
    catch { return '' }
  }).join('\n')
  const printDocument = printWindow.document
  printDocument.open()
  printDocument.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>')
  printDocument.title = title
  const style = printDocument.createElement('style')
  style.textContent = `${stylesheetText}\n${overrides}`
  printDocument.head.append(style)
  printDocument.body.append(printDocument.importNode(element, true))
  printDocument.close()
  void (printDocument.fonts?.ready ?? Promise.resolve()).then(() => printWindow.print(), () => printWindow.print())
  return true
}
