import { ref } from 'vue'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

const toasts = ref<Toast[]>([])
let toastId = 0

export function useToast() {
  const addToast = (message: string, type: Toast['type'], duration = 3000) => {
    const id = ++toastId
    const toast: Toast = { id, message, type, duration }
    
    toasts.value.push(toast)
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
    
    return id
  }
  
  const removeToast = (id: number) => {
    const index = toasts.value.findIndex(toast => toast.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }
  
  const showSuccess = (title: string, message?: string, duration?: number) => {
    const finalMessage = message ? `${title}: ${message}` : title
    return addToast(finalMessage, 'success', duration)
  }

  const showError = (title: string, message?: string, duration?: number) => {
    const finalMessage = message ? `${title}: ${message}` : title
    return addToast(finalMessage, 'error', duration)
  }
  
  const showWarning = (message: string, duration?: number) => {
    return addToast(message, 'warning', duration)
  }
  
  const showInfo = (message: string, duration?: number) => {
    return addToast(message, 'info', duration)
  }
  
  const clearAll = () => {
    toasts.value = []
  }
  
  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll
  }
}