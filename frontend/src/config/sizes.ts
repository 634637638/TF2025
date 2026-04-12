/**
 * TF2025 统一尺寸系统
 * 替代硬编码的宽度、高度、间距等数值
 */

import { BreakpointName } from './breakpoints'

// 基础间距单位
export const SPACING_BASE = 8 // 8px 作为基础单位

// 间距系统
export const SPACING = {
  XS: SPACING_BASE * 0.5,    // 4px
  SM: SPACING_BASE * 1,      // 8px
  MD: SPACING_BASE * 2,      // 16px
  LG: SPACING_BASE * 3,      // 24px
  XL: SPACING_BASE * 4,      // 32px
  XXL: SPACING_BASE * 6,     // 48px
  XXXL: SPACING_BASE * 8     // 64px
} as const

// 常用尺寸
export const SIZES = {
  // 最小触摸目标
  TOUCH_MIN: 44, // 44px iOS标准

  // 按钮高度
  BUTTON_SMALL: 32,
  BUTTON_DEFAULT: 40,
  BUTTON_LARGE: 48,

  // 输入框高度
  INPUT_SMALL: 32,
  INPUT_DEFAULT: 40,
  INPUT_LARGE: 48,

  // 图标尺寸
  ICON_SMALL: 16,
  ICON_DEFAULT: 20,
  ICON_LARGE: 24,
  ICON_XL: 32,

  // 头像尺寸
  AVATAR_SMALL: 32,
  AVATAR_DEFAULT: 48,
  AVATAR_LARGE: 64,
  AVATAR_XL: 96,

  // 卡片
  CARD_RADIUS: 8,
  CARD_RADIUS_LARGE: 12,

  // 阴影
  SHADOW_SMALL: '0 1px 3px rgba(0, 0, 0, 0.12)',
  SHADOW_DEFAULT: '0 2px 8px rgba(0, 0, 0, 0.15)',
  SHADOW_LARGE: '0 4px 16px rgba(0, 0, 0, 0.2)'
} as const

// 响应式尺寸系统
export const RESPONSIVE_SIZES = {
  // 容器最大宽度
  CONTAINER_MAX_WIDTH: {
    MOBILE: '100%',
    TABLET: '768px',
    DESKTOP: '1024px',
    WIDE: '1200px',
    ULTRA_WIDE: '1440px'
  },

  // 侧边栏宽度
  SIDEBAR_WIDTH: {
    COLLAPSED: 64,
    MOBILE: '100%',
    DEFAULT: 240,
    WIDE: 280
  },

  // 表格相关
  TABLE: {
    MIN_WIDTH: 600, // 最小宽度，小于此值会切换为卡片布局
    COLUMN_MIN_WIDTH: 100
  },

  // 弹窗宽度
  MODAL_WIDTH: {
    MOBILE: '95vw',
    DEFAULT: 600,
    LARGE: 800,
    EXTRA_LARGE: 1000,
    FULL_SCREEN: '100vw'
  },

  // 网格系统
  GRID: {
    COLUMNS: 12,
    GAP: {
      SMALL: SPACING.SM,
      DEFAULT: SPACING.MD,
      LARGE: SPACING.LG
    }
  }
} as const

// 字体大小系统
export const FONT_SIZES = {
  XS: 12,
  SM: 14,
  BASE: 16,
  LG: 18,
  XL: 20,
  XXL: 24,
  XXXL: 30,
  XXXXL: 36,

  // 响应式字体大小
  RESPONSIVE: {
    H1: {
      MOBILE: 24,
      DESKTOP: 36
    },
    H2: {
      MOBILE: 20,
      DESKTOP: 30
    },
    H3: {
      MOBILE: 18,
      DESKTOP: 24
    },
    BODY: {
      MOBILE: 14,
      DESKTOP: 16
    },
    SMALL: {
      MOBILE: 12,
      DESKTOP: 14
    }
  }
} as const

// Z-index 层级管理
export const Z_INDEX = {
  BASE: 1,
  DROPDOWN: 1000,
  STICKY: 1020,
  FIXED: 1030,
  MODAL_BACKDROP: 1040,
  MODAL: 1050,
  POPOVER: 1060,
  TOOLTIP: 1070,
  NOTIFICATION: 1080,
  MAXIMUM: 9999
} as const

// 断点相关的尺寸映射
export const BREAKPOINT_SIZES = {
  [BreakpointName.SMALL_MOBILE]: {
    CONTAINER_PADDING: SPACING.SM,
    BUTTON_HEIGHT: SIZES.BUTTON_LARGE, // 移动端更大的触摸目标
    FONT_SCALE: 0.9
  },
  [BreakpointName.MOBILE]: {
    CONTAINER_PADDING: SPACING.MD,
    BUTTON_HEIGHT: SIZES.BUTTON_LARGE,
    FONT_SCALE: 0.95
  },
  [BreakpointName.TABLET]: {
    CONTAINER_PADDING: SPACING.LG,
    BUTTON_HEIGHT: SIZES.BUTTON_DEFAULT,
    FONT_SCALE: 1
  },
  [BreakpointName.DESKTOP]: {
    CONTAINER_PADDING: SPACING.XL,
    BUTTON_HEIGHT: SIZES.BUTTON_DEFAULT,
    FONT_SCALE: 1
  },
  [BreakpointName.WIDE]: {
    CONTAINER_PADDING: SPACING.XXL,
    BUTTON_HEIGHT: SIZES.BUTTON_DEFAULT,
    FONT_SCALE: 1
  }
} as const

// CSS 自定义属性生成器
export const generateSizeCSSVariables = () => {
  return {
    // 间距
    '--spacing-xs': `${SPACING.XS}px`,
    '--spacing-sm': `${SPACING.SM}px`,
    '--spacing-md': `${SPACING.MD}px`,
    '--spacing-lg': `${SPACING.LG}px`,
    '--spacing-xl': `${SPACING.XL}px`,
    '--spacing-xxl': `${SPACING.XXL}px`,
    '--spacing-xxxl': `${SPACING.XXXL}px`,

    // 尺寸
    '--touch-min': `${SIZES.TOUCH_MIN}px`,
    '--button-height-small': `${SIZES.BUTTON_SMALL}px`,
    '--button-height-default': `${SIZES.BUTTON_DEFAULT}px`,
    '--button-height-large': `${SIZES.BUTTON_LARGE}px`,

    // 字体
    '--font-xs': `${FONT_SIZES.XS}px`,
    '--font-sm': `${FONT_SIZES.SM}px`,
    '--font-base': `${FONT_SIZES.BASE}px`,
    '--font-lg': `${FONT_SIZES.LG}px`,
    '--font-xl': `${FONT_SIZES.XL}px`,
    '--font-xxl': `${FONT_SIZES.XXL}px`,

    // 层级
    '--z-dropdown': Z_INDEX.DROPDOWN,
    '--z-modal': Z_INDEX.MODAL,
    '--z-tooltip': Z_INDEX.TOOLTIP
  }
}

export default {
  SPACING_BASE,
  SPACING,
  SIZES,
  RESPONSIVE_SIZES,
  FONT_SIZES,
  Z_INDEX,
  BREAKPOINT_SIZES,
  generateSizeCSSVariables
}