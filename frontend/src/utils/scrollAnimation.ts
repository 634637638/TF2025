/**
 * AOS 滚动动画初始化配置
 * 在 App.vue 或 main.ts 中调用
 */

import AOS from 'aos'
import 'aos/dist/aos.css'

/**
 * 初始化 AOS 动画
 */
export function initScrollAnimations() {
  AOS.init({
    // 全局动画持续时间（毫秒）
    duration: 800,

    // 动画延迟
    delay: 0,

    // 动画缓动函数
    easing: 'ease-out-cubic',

    // 只执行一次动画
    once: true,

    // 提前/延后触发动画的偏移量（像素）
    offset: 50,

    // 是否在初始化时立即执行动画
    startEvent: 'DOMContentLoaded',

    // 动画使用的 CSS 类名前缀
    useClassInitial: false,

    // 禁用特定用户
    disableMutationObserver: false,

    // 针对移动端的优化
    disable: window.innerWidth < 768 ? 'mobile' : false,

    // 镜像动画（从右到左 vs 从左到右）
    mirror: false,

    // 锚点位置
    anchorPlacement: 'top-bottom'
  })
}

/**
 * 刷新 AOS（在 DOM 更新后调用）
 */
export function refreshScrollAnimations() {
  setTimeout(() => {
    AOS.refresh()
  }, 100)
}

/**
 * 为列表项生成动画延迟
 * @param index 列表索引
 * @param step 每个项目的延迟增量（毫秒）
 * @returns 延迟值
 */
export function getAnimationDelay(index: number, step: number = 100): number {
  return index * step
}

/**
 * 预设动画效果
 */
export const animationPresets = {
  // 淡入效果
  fadeIn: {
    'data-aos': 'fade-in',
    'data-aos-duration': '800'
  },

  // 向上淡入
  fadeUp: {
    'data-aos': 'fade-up',
    'data-aos-duration': '800'
  },

  // 向下淡入
  fadeDown: {
    'data-aos': 'fade-down',
    'data-aos-duration': '800'
  },

  // 从左淡入
  fadeLeft: {
    'data-aos': 'fade-left',
    'data-aos-duration': '800'
  },

  // 从右淡入
  fadeRight: {
    'data-aos': 'fade-right',
    'data-aos-duration': '800'
  },

  // 向上滑入
  slideUp: {
    'data-aos': 'slide-up',
    'data-aos-duration': '800'
  },

  // 缩放淡入
  zoomIn: {
    'data-aos': 'zoom-in',
    'data-aos-duration': '800'
  },

  // 翻转效果
  flipLeft: {
    'data-aos': 'flip-left',
    'data-aos-duration': '800'
  },

  // 快速动画
  fast: {
    'data-aos-duration': '400'
  },

  // 慢速动画
  slow: {
    'data-aos-duration': '1200'
  }
} as const

export default AOS
