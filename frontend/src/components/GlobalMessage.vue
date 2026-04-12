<template>
  <Teleport to="body">
    <div class="global-message-container">
      <TransitionGroup name="message" tag="div">
        <div
          v-for="message in messageStore.messages"
          :key="message.id"
          :class="[
            'message-item',
            `message-${message.type}`
          ]"
        >
          <div class="message-content">
            <div class="message-icon" v-if="message.type">
              <i :class="getMessageIcon(message.type)"></i>
            </div>
            <div class="message-body">
              <div class="message-title" v-if="message.title">
                {{ message.title }}
              </div>
              <div class="message-text">
                {{ message.content }}
              </div>
            </div>
            <div
              class="message-close"
              v-if="message.showClose"
              @click="closeMessage(message.id)"
            >
              <i class="fas fa-times"></i>
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
  setup() {
    const messageStore = useMessageStore()
const { success, error, warning, info, handleApiError } = useNotification()
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
  background-color: #fff;
  position: relative;
}

.message-success {
  border-left: 4px solid #67c23a;
}

.message-error {
  border-left: 4px solid #f56c6c;
}

.message-warning {
  border-left: 4px solid #e6a23c;
}

.message-info {
  border-left: 4px solid #909399;
}

.message-icon {
  margin-right: 12px;
  margin-top: 2px;
  font-size: 16px;
}

.message-success .message-icon {
  color: #67c23a;
}

.message-error .message-icon {
  color: #f56c6c;
}

.message-warning .message-icon {
  color: #e6a23c;
}

.message-info .message-icon {
  color: #909399;
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
  line-height: 1.4;
}

.message-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.4;
  word-break: break-word;
}

.message-close {
  margin-left: 12px;
  cursor: pointer;
  color: #909399;
  font-size: 14px;
  transition: color 0.3s;
}

.message-close:hover {
  color: #606266;
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