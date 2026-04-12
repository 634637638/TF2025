<template>
  <div class="notification-container">
    <transition-group name="notification" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', `notification-${notification.type}`]"
      >
        <div class="notification-icon">
          <i :class="getIconClass(notification.type)"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">{{ notification.title }}</div>
          <div v-if="notification.message" class="notification-message">
            {{ notification.message }}
          </div>
        </div>
        <button class="notification-close" @click="removeNotification(notification.id)">
          <i class="fas fa-times"></i>
        </button>
        <div class="notification-progress" :style="{ animationDuration: `${notification.duration}ms` }"></div>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useNotification, notifications } from '../composables/useNotification'

const { removeNotification } = useNotification()


const getIconClass = (type: string) => {
  const iconMap = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle'
  }
  return iconMap[type as keyof typeof iconMap] || iconMap.info
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  pointer-events: none;
  max-width: 400px;
  width: 100%;
}

.notification {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  pointer-events: all;
  border-left: 4px solid;
  overflow: hidden;
}

.notification-success {
  border-left-color: #52c41a;
}

.notification-error {
  border-left-color: #ff4d4f;
}

.notification-warning {
  border-left-color: #faad14;
}

.notification-info {
  border-left-color: #1890ff;
}

.notification-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.notification-success .notification-icon {
  color: #52c41a;
}

.notification-error .notification-icon {
  color: #ff4d4f;
}

.notification-warning .notification-icon {
  color: #faad14;
}

.notification-info .notification-icon {
  color: #1890ff;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
  line-height: 1.4;
}

.notification-message {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
  word-wrap: break-word;
}

.notification-close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  transition: all 0.2s;
}

.notification-close:hover {
  background: #f5f5f5;
  color: #666;
}

.notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: currentColor;
  opacity: 0.3;
  animation: progress linear forwards;
}

.notification-success .notification-progress {
  background: #52c41a;
}

.notification-error .notification-progress {
  background: #ff4d4f;
}

.notification-warning .notification-progress {
  background: #faad14;
}

.notification-info .notification-progress {
  background: #1890ff;
}

/* 动画效果 */
.notification-enter-active {
  animation: slideIn 0.3s ease-out;
}

.notification-leave-active {
  animation: slideOut 0.3s ease-in;
}

.notification-move {
  transition: transform 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

@keyframes progress {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .notification-container {
    top: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }

  .notification {
    padding: 12px;
  }

  .notification-title {
    font-size: 13px;
  }

  .notification-message {
    font-size: 12px;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .notification {
    background: #1f1f1f;
    color: #fff;
  }

  .notification-title {
    color: #fff;
  }

  .notification-message {
    color: #ccc;
  }

  .notification-close {
    color: #999;
  }

  .notification-close:hover {
    background: #333;
    color: #fff;
  }
}
</style>