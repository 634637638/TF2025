import { readonly, ref } from 'vue'
import { useNotification } from '@/composables/useNotification'
import { isValidPersonName, normalizePersonName } from '@/utils/security'

const promptingCustomerName = ref(false)

/** iOS 双击输入沿用公共 MessageBox；输入及保存期间只允许一个姓名编辑流程。 */
export function useCustomerNamePrompt() {
  const { prompt, warning, error } = useNotification()
  const promptCustomerName = async (currentName: string, onConfirm: (name: string) => Promise<void> | void) => {
    if (promptingCustomerName.value) return
    promptingCustomerName.value = true
    try {
      const result = await prompt('请输入客户姓名', '编辑客户姓名', {
        inputValue: currentName,
        inputValidator: value => (Boolean(value?.trim()) && isValidPersonName(value, 20)) || '请输入1至20字的单行客户姓名',
        inputErrorMessage: '请输入1至20字的单行客户姓名'
      })
      if (!result) return
      const name = normalizePersonName(result.value, 20)
      if (!name || !isValidPersonName(name, 20)) {
        warning('请输入1至20字的单行客户姓名')
        return
      }
      await onConfirm(name)
    } catch {
      error('客户姓名编辑失败，请重试')
    } finally {
      promptingCustomerName.value = false
    }
  }
  return { promptCustomerName, promptingCustomerName: readonly(promptingCustomerName) }
}
