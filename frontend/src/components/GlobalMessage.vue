<template>
  <Teleport to="body">
    <div
      v-bind="$attrs"
      class="global-message-container"
    >
      <TransitionGroup
        name="message"
        tag="div"
      >
        <div
          v-for="message in messageStore.messages"
          :key="message.id"
          :class="[
            'message-item',
            `message-${message.type}`
          ]"
        >
          <div class="message-content">
            <div
              v-if="message.type"
              class="message-icon"
            >
              <i :class="getMessageIcon(message.type)" />
            </div>
            <div class="message-body">
              <div
                v-if="message.title"
                class="message-title"
              >
                {{ message.title }}
              </div>
              <div class="message-text">
                {{ message.content }}
              </div>
            </div>
            <div
              v-if="message.showClose"
              class="message-close"
              @click="closeMessage(message.id)"
            >
              <i class="fas fa-times" />
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'GlobalMessage',
  inheritAttrs: false,
  setup() {
    const messageStore = useMessageStore()
    const { _success, _error, _warning, _info, _handleApiError } = useNotification()
    const closeMessage = (id) => {
      messageStore.removeMessage(id)
    }

    const getMessageIcon = (type) => {
      const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
      }
      return iconMap[type] || iconMap.info
    }

    return {
      messageStore,
      closeMessage,
      getMessageIcon
    }
  }
})
</script>

<style scoped>
.global-message-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  max-width: 400px;
}

.message-item {
  margin-bottom: 12px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.message-content {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background-color: var(--color-bg-white);
  position: relative;
}

.message-success {
  border-left: 4px solid var(--color-success);
}

.message-error {
  border-left: 4px solid var(--color-danger);
}

.message-warning {
  border-left: 4px solid var(--color-warning);
}

.message-info {
  border-left: 4px solid var(--color-info);
}

.message-icon {
  margin-right: 12px;
  margin-top: 2px;
  font-size: 16px;
}

.message-success .message-icon {
  color: var(--color-success);
}

.message-error .message-icon {
  color: var(--color-danger);
}

.message-warning .message-icon {
  color: var(--color-warning);
}

.message-info .message-icon {
  color: var(--color-info);
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 4px;
  line-height: 1.4;
}

.message-text {
  font-size: 13px;
  color: var(--color-text-regular);
  line-height: 1.4;
  word-break: break-word;
}

.message-close {
  margin-left: 12px;
  cursor: pointer;
  color: var(--color-info);
  font-size: 14px;
  transition: color 0.3s;
}

.message-close:hover {
  color: var(--color-text-regular);
}

/* 过渡动画 */
.message-enter-active {
  transition: all 0.3s ease-out;
}

.message-leave-active {
  transition: all 0.2s ease-in;
}

.message-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.message-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.message-move {
  transition: transform 0.3s ease;
}
</style>
