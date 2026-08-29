<template>
  <div class="notification-container">
    <transition-group
      name="notification"
      tag="div"
    >
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', `notification-${notification.type}`]"
      >
        <div class="notification-icon">
          <i :class="getIconClass(notification.type)" />
        </div>
        <div class="notification-content">
          <div class="notification-title">
            {{ notification.title }}
          </div>
          <div
            v-if="notification.message"
            class="notification-message"
          >
            {{ notification.message }}
          </div>
        </div>
        <button
          class="notification-close"
          @click="removeNotification(notification.id)"
        >
          <i class="fas fa-times" />
        </button>
        <div
          class="notification-progress"
          :style="{ animationDuration: `${notification.duration}ms` }"
        />
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
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
  border-left-color: var(--tf-color-green-ant);
}

.notification-error {
  border-left-color: var(--tf-color-red-ant);
}

.notification-warning {
  border-left-color: var(--tf-color-amber-ant);
}

.notification-info {
  border-left-color: var(--tf-color-blue-ant);
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
  color: var(--tf-color-green-ant);
}

.notification-error .notification-icon {
  color: var(--tf-color-red-ant);
}

.notification-warning .notification-icon {
  color: var(--tf-color-amber-ant);
}

.notification-info .notification-icon {
  color: var(--tf-color-blue-ant);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 1.4;
}

.notification-message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  word-wrap: break-word;
}

.notification-close {
  background: none;
  border: none;
  color: var(--text-muted);
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
  background: var(--tf-color-surface-soft);
  color: var(--text-secondary);
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
  background: var(--tf-color-green-ant);
}

.notification-error .notification-progress {
  background: var(--tf-color-red-ant);
}

.notification-warning .notification-progress {
  background: var(--tf-color-amber-ant);
}

.notification-info .notification-progress {
  background: var(--tf-color-blue-ant);
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
    background: var(--tf-color-gray-ant-950);
    color: var(--color-bg-white);
  }

  .notification-title {
    color: var(--color-bg-white);
  }

  .notification-message {
    color: var(--tf-color-gray-300-solid);
  }

  .notification-close {
    color: var(--text-muted);
  }

  .notification-close:hover {
    background: var(--text-primary);
    color: var(--color-bg-white);
  }
}
</style>
