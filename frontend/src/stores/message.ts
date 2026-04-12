import { defineStore } from 'pinia'
import { ref, readonly } from 'vue'
import type { MessageItem, MessageType } from '@/types'

type MessageOptions = Partial<Omit<MessageItem, 'id' | 'timestamp' | 'type' | 'message'>>

type MessagePayload = Omit<MessageItem, 'id' | 'timestamp'>

export const useMessageStore = defineStore('message', () => {
  const messages = ref<MessageItem[]>([])
  const nextId = ref(1)
  const maxMessages = ref(30)
  const defaultDuration = ref(4000)

  /**
   * 添加消息
   */
  const addMessage = (message: MessagePayload) => {
    const id = nextId.value++
    const timestamp = Date.now()

    const newMessage: MessageItem = {
      ...message,
      id: id.toString(),
      timestamp,
      persistent: message.persistent || false
    }

    messages.value.push(newMessage)

    // 如果不是持久消息且有时长，自动移除
    if (!newMessage.persistent && newMessage.duration && newMessage.duration > 0) {
      setTimeout(() => {
        removeMessage(id.toString())
      }, newMessage.duration)
    }

    // 限制消息数量
    if (messages.value.length > maxMessages.value) {
      messages.value = messages.value.slice(-maxMessages.value)
    }

    return newMessage
  }

  /**
   * 移除消息
   */
  const removeMessage = (id: string) => {
    const index = messages.value.findIndex(msg => msg.id === id)
    if (index > -1) {
      messages.value.splice(index, 1)
    }
  }

  /**
   * 清空所有消息
   */
  const clearMessages = () => {
    messages.value = []
  }

  /**
   * 根据类型移除消息
   */
  const removeMessagesByType = (type: string) => {
    messages.value = messages.value.filter(msg => msg.type !== type)
  }

  /**
   * 获取未解决的消息
   */
  const getUnresolvedMessages = () => {
    return messages.value.filter(msg => !msg.closable || msg.persistent)
  }

  /**
   * 标记消息为已关闭
   */
  const markMessageAsClosed = (id: string) => {
    const message = messages.value.find(msg => msg.id === id)
    if (message) {
      message.closable = true
      // 标记为关闭后，延迟移除
      setTimeout(() => {
        removeMessage(id)
      }, 300)
    }
  }

  /**
   * 成功消息
   */
  const success = (message: string, options?: MessageOptions) => {
    return addMessage({
      message,
      type: 'success',
      duration: options?.duration || defaultDuration.value,
      closable: options?.closable ?? true,
      persistent: options?.persistent || false,
      title: options?.title
    })
  }

  /**
   * 错误消息
   */
  const error = (message: string, options?: MessageOptions) => {
    return addMessage({
      message,
      type: 'error',
      duration: options?.duration || defaultDuration.value,
      closable: options?.closable ?? true,
      persistent: options?.persistent || false,
      title: options?.title
    })
  }

  /**
   * 警告消息
   */
  const warning = (message: string, options?: MessageOptions) => {
    return addMessage({
      message,
      type: 'warning',
      duration: options?.duration || defaultDuration.value,
      closable: options?.closable ?? true,
      persistent: options?.persistent || false,
      title: options?.title
    })
  }

  /**
   * 信息消息
   */
  const info = (message: string, options?: MessageOptions) => {
    return addMessage({
      message,
      type: 'info',
      duration: options?.duration || defaultDuration.value,
      closable: options?.closable ?? true,
      persistent: options?.persistent || false,
      title: options?.title
    })
  }

  return {
    // 状态
    messages: readonly(messages),
    nextId: readonly(nextId),
    maxMessages,
    defaultDuration,

    // 方法
    addMessage,
    removeMessage,
    clearMessages,
    removeMessagesByType,
    getUnresolvedMessages,
    markMessageAsClosed,
    success,
    error,
    warning,
    info
  }
})