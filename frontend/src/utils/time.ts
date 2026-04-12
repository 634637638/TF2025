/**
 * 全局时间处理工具
 * 专门适配北京时间（Asia/Shanghai）
 * 提供统一的时间格式化、计算、转换功能
 */

import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

// 配置dayjs插件
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')
import { logger } from '@/utils/logger'

// 北京时区配置
export const BEIJING_TIMEZONE = 'Asia/Shanghai'

/**
 * 时间格式类型
 */
export interface TimeFormats {
  DATE: string // 日期格式：YYYY-MM-DD
  TIME: string // 时间格式：HH:mm:ss
  DATETIME: string // 日期时间格式：YYYY-MM-DD HH:mm:ss
  DATETIME_SHORT: string // 短日期时间：YYYY/MM/DD HH:mm
  MONTH_DAY: string // 月日格式：MM-DD
  YEAR_MONTH: string // 年月格式：YYYY-MM
  TIMESTAMP: string // 时间戳格式：YYYY-MM-DD HH:mm:ss.SSS
  ISO: string // ISO格式
  DISPLAY: string // 显示格式：YYYY年MM月DD日 HH:mm
  DISPLAY_SHORT: string // 简短显示格式：MM-DD HH:mm
  DISPLAY_DATE: string // 日期显示格式：YYYY年MM月DD日
}

/**
 * 预定义的时间格式
 */
export const TIME_FORMATS: TimeFormats = {
  DATE: 'YYYY-MM-DD',
  TIME: 'HH:mm:ss',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  DATETIME_SHORT: 'YYYY/MM/DD HH:mm',
  MONTH_DAY: 'MM-DD',
  YEAR_MONTH: 'YYYY-MM',
  TIMESTAMP: 'YYYY-MM-DD HH:mm:ss.SSS',
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSS[Z]',
  DISPLAY: 'YYYY年MM月DD日 HH:mm',
  DISPLAY_SHORT: 'MM-DD HH:mm',
  DISPLAY_DATE: 'YYYY年MM月DD日'
}

/**
 * 全局时间工具类
 */
export class TimeUtil {
  /**
   * 获取当前北京时间
   */
  static now(): dayjs.Dayjs {
    return dayjs().tz(BEIJING_TIMEZONE)
  }

  /**
   * 将时间戳转换为北京时间
   */
  static fromTimestamp(timestamp: number | string): dayjs.Dayjs {
    return dayjs(timestamp).tz(BEIJING_TIMEZONE)
  }

  /**
   * 将ISO时间字符串转换为北京时间
   */
  static fromISO(isoString: string): dayjs.Dayjs {
    return dayjs(isoString).tz(BEIJING_TIMEZONE)
  }

  /**
   * 将任意时间转换为北京时间
   */
  static toBeijing(date: Date | string | number | dayjs.Dayjs): dayjs.Dayjs {
    return dayjs(date).tz(BEIJING_TIMEZONE)
  }

  /**
   * 格式化时间
   */
  static format(
    date: Date | string | number | dayjs.Dayjs,
    format: keyof TimeFormats | string = TIME_FORMATS.DATETIME
  ): string {
    const time = this.toBeijing(date)
    const formatString = TIME_FORMATS[format as keyof TimeFormats] || format
    return time.format(formatString)
  }

  /**
   * 获取格式化的当前时间
   */
  static nowFormatted(format: keyof TimeFormats | string = TIME_FORMATS.DATETIME): string {
    return this.format(this.now(), format)
  }

  /**
   * 相对时间（如：2小时前）
   */
  static fromNow(date: Date | string | number | dayjs.Dayjs): string {
    const time = this.toBeijing(date)
    return time.fromNow()
  }

  /**
   * 获取时间差
   */
  static diff(
    date1: Date | string | number | dayjs.Dayjs,
    date2?: Date | string | number | dayjs.Dayjs,
    unit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' = 'second'
  ): number {
    const time1 = this.toBeijing(date1)
    const time2 = date2 ? this.toBeijing(date2) : this.now()
    return time1.diff(time2, unit)
  }

  /**
   * 时间计算 - 加
   */
  static add(
    date: Date | string | number | dayjs.Dayjs,
    amount: number,
    unit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
  ): dayjs.Dayjs {
    const time = this.toBeijing(date)
    return time.add(amount, unit)
  }

  /**
   * 时间计算 - 减
   */
  static subtract(
    date: Date | string | number | dayjs.Dayjs,
    amount: number,
    unit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
  ): dayjs.Dayjs {
    const time = this.toBeijing(date)
    return time.subtract(amount, unit)
  }

  /**
   * 获取时间的开始（如：当天的开始）
   */
  static startOf(
    date: Date | string | number | dayjs.Dayjs,
    unit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
  ): dayjs.Dayjs {
    const time = this.toBeijing(date)
    return time.startOf(unit)
  }

  /**
   * 获取时间的结束（如：当天的结束）
   */
  static endOf(
    date: Date | string | number | dayjs.Dayjs,
    unit: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'
  ): dayjs.Dayjs {
    const time = this.toBeijing(date)
    return time.endOf(unit)
  }

  /**
   * 判断是否是同一天
   */
  static isSameDay(
    date1: Date | string | number | dayjs.Dayjs,
    date2?: Date | string | number | dayjs.Dayjs
  ): boolean {
    const time1 = this.toBeijing(date1)
    const time2 = date2 ? this.toBeijing(date2) : this.now()
    return time1.isSame(time2, 'day')
  }

  /**
   * 判断是否是同一周
   */
  static isSameWeek(
    date1: Date | string | number | dayjs.Dayjs,
    date2?: Date | string | number | dayjs.Dayjs
  ): boolean {
    const time1 = this.toBeijing(date1)
    const time2 = date2 ? this.toBeijing(date2) : this.now()
    return time1.isSame(time2, 'week')
  }

  /**
   * 判断是否是同一月
   */
  static isSameMonth(
    date1: Date | string | number | dayjs.Dayjs,
    date2?: Date | string | number | dayjs.Dayjs
  ): boolean {
    const time1 = this.toBeijing(date1)
    const time2 = date2 ? this.toBeijing(date2) : this.now()
    return time1.isSame(time2, 'month')
  }

  /**
   * 判断是否是同一年
   */
  static isSameYear(
    date1: Date | string | number | dayjs.Dayjs,
    date2?: Date | string | number | dayjs.Dayjs
  ): boolean {
    const time1 = this.toBeijing(date1)
    const time2 = date2 ? this.toBeijing(date2) : this.now()
    return time1.isSame(time2, 'year')
  }

  /**
   * 获取星期几
   */
  static getDay(
    date: Date | string | number | dayjs.Dayjs = this.now()
  ): number {
    const time = this.toBeijing(date)
    return time.day() // 0 = 星期日, 1 = 星期一, ...
  }

  /**
   * 获取星期几的中文名称
   */
  static getDayName(
    date: Date | string | number | dayjs.Dayjs = this.now()
  ): string {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    return days[this.getDay(date)]
  }

  /**
   * 获取月份的中文名称
   */
  static getMonthName(
    date: Date | string | number | dayjs.Dayjs = this.now()
  ): string {
    const time = this.toBeijing(date)
    const months = [
      '一月', '二月', '三月', '四月', '五月', '六月',
      '七月', '八月', '九月', '十月', '十一月', '十二月'
    ]
    return months[time.month()]
  }

  /**
   * 判断是否是工作日
   */
  static isWeekday(
    date: Date | string | number | dayjs.Dayjs = this.now()
  ): boolean {
    const day = this.getDay(date)
    return day >= 1 && day <= 5 // 1-5 为周一到周五
  }

  /**
   * 判断是否是周末
   */
  static isWeekend(
    date: Date | string | number | dayjs.Dayjs = this.now()
  ): boolean {
    return !this.isWeekday(date)
  }

  /**
   * 获取时间戳
   */
  static getTimestamp(
    date: Date | string | number | dayjs.Dayjs = this.now()
  ): number {
    const time = this.toBeijing(date)
    return time.unix()
  }

  /**
   * 获取毫秒时间戳
   */
  static getMilliseconds(
    date: Date | string | number | dayjs.Dayjs = this.now()
  ): number {
    const time = this.toBeijing(date)
    return time.valueOf()
  }

  /**
   * 判断是否是今天
   */
  static isToday(date: Date | string | number | dayjs.Dayjs): boolean {
    return this.isSameDay(date, this.now())
  }

  /**
   * 判断是否是昨天
   */
  static isYesterday(date: Date | string | number | dayjs.Dayjs): boolean {
    return this.isSameDay(date, this.subtract(this.now(), 1, 'day'))
  }

  /**
   * 判断是否是明天
   */
  static isTomorrow(date: Date | string | number | dayjs.Dayjs): boolean {
    return this.isSameDay(date, this.add(this.now(), 1, 'day'))
  }

  /**
   * 判断是否是今年
   */
  static isThisYear(date: Date | string | number | dayjs.Dayjs): boolean {
    return this.isSameYear(date, this.now())
  }

  /**
   * 判断是否是本月
   */
  static isThisMonth(date: Date | string | number | dayjs.Dayjs): boolean {
    return this.isSameMonth(date, this.now())
  }

  /**
   * 获取友好时间显示
   */
  static getFriendlyTime(
    date: Date | string | number | dayjs.Dayjs,
    showDate = true
  ): string {
    const time = this.toBeijing(date)
    const now = this.now()

    if (this.isToday(date)) {
      return `今天 ${time.format(TIME_FORMATS.TIME)}`
    } else if (this.isYesterday(date)) {
      return `昨天 ${time.format(TIME_FORMATS.TIME)}`
    } else if (this.isTomorrow(date)) {
      return `明天 ${time.format(TIME_FORMATS.TIME)}`
    } else if (this.isThisYear(date)) {
      return time.format(TIME_FORMATS.DISPLAY_SHORT)
    } else {
      return showDate ? time.format(TIME_FORMATS.DISPLAY) : time.format(TIME_FORMATS.DATE)
    }
  }

  /**
   * 解析时间字符串
   */
  static parse(
    dateString: string,
    format?: string
  ): dayjs.Dayjs | null {
    try {
      return format ? dayjs(dateString, format) : dayjs(dateString)
    } catch (error) {
      logger.error('时间解析失败:', error)
      return null
    }
  }

  /**
   * 验证时间字符串
   */
  static isValid(dateString: string, format?: string): boolean {
    const parsed = this.parse(dateString, format)
    return parsed ? parsed.isValid() : false
  }

  /**
   * 获取时间段的文本描述
   */
  static getDurationText(
    startDate: Date | string | number | dayjs.Dayjs,
    endDate?: Date | string | number | dayjs.Dayjs
  ): string {
    const start = this.toBeijing(startDate)
    const end = endDate ? this.toBeijing(endDate) : this.now()

    const diff = end.diff(start, 'second')

    if (diff < 60) {
      return `${diff}秒`
    } else if (diff < 3600) {
      const minutes = Math.floor(diff / 60)
      const seconds = diff % 60
      return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分`
    } else if (diff < 86400) {
      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`
    } else {
      const days = Math.floor(diff / 86400)
      const hours = Math.floor((diff % 86400) / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const parts = []
      if (days > 0) parts.push(`${days}天`)
      if (hours > 0) parts.push(`${hours}小时`)
      if (minutes > 0) parts.push(`${minutes}分`)
      return parts.join(' ')
    }
  }

  /**
   * 计算倒计时
   */
  static getCountdown(
    targetDate: Date | string | number | dayjs.Dayjs
  ): {
    days: number
    hours: number
    minutes: number
    seconds: number
    total: number
    formatted: string
    isExpired: boolean
  } {
    const target = this.toBeijing(targetDate)
    const now = this.now()
    const diff = target.diff(now, 'second')

    if (diff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        total: 0,
        formatted: '已结束',
        isExpired: true
      }
    }

    const days = Math.floor(diff / 86400)
    const hours = Math.floor((diff % 86400) / 3600)
    const minutes = Math.floor((diff % 3600) / 60)
    const seconds = diff % 60

    const formatted = [
      days > 0 ? `${days}天` : '',
      hours > 0 ? `${hours}小时` : '',
      minutes > 0 ? `${minutes}分` : '',
      `${seconds}秒`
    ].filter(Boolean).join(' ')

    return {
      days,
      hours,
      minutes,
      seconds,
      total: diff,
      formatted,
      isExpired: false
    }
  }
}

/**
 * Vue插件：安装时间工具
 */
export const TimePlugin = {
  install(app: any) {
    // 全局属性
    app.config.globalProperties.$time = TimeUtil
    app.provide('timeUtil', TimeUtil)

    // 添加到全局状态
    if (window.__TF2025__) {
      window.__TF2025__.timeUtil = TimeUtil
    }
  }
}

/**
 * Composable：使用时间工具
 */
export function useTime() {
  return {
    timeUtil: TimeUtil,
    now: () => TimeUtil.now(),
    getBeijingTime: () => TimeUtil.now().toDate(),
    format: (date: any, format?: any) => TimeUtil.format(date, format),
    fromNow: (date: any) => TimeUtil.fromNow(date),
    diff: (date1: any, date2?: any, unit?: any) => TimeUtil.diff(date1, date2, unit),
    add: (date: any, amount: any, unit: any) => TimeUtil.add(date, amount, unit),
    subtract: (date: any, amount: any, unit?: any) => TimeUtil.subtract(date, amount, unit),
    startOf: (date: any, unit: any) => TimeUtil.startOf(date, unit),
    endOf: (date: any, unit: any) => TimeUtil.endOf(date, unit),
    isToday: (date: any) => TimeUtil.isToday(date),
    isWeekday: (date?: any) => TimeUtil.isWeekday(date),
    isWeekend: (date?: any) => TimeUtil.isWeekend(date),
    getDayName: (date?: any) => TimeUtil.getDayName(date),
    getMonthName: (date?: any) => TimeUtil.getMonthName(date),
    getFriendlyTime: (date: any, showDate?: any) => TimeUtil.getFriendlyTime(date, showDate),
    getCountdown: (date: any) => TimeUtil.getCountdown(date)
  }
}

/**
 * 格式化北京时间（便捷函数）
 * @param date 日期对象、时间戳或日期字符串
 * @param format 格式化字符串，默认为 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的北京时间字符串
 */
export function formatBeijingTime(
  date: Date | string | number | dayjs.Dayjs = new Date(),
  format: string = TIME_FORMATS.DATETIME
): string {
  return TimeUtil.format(date, format)
}

// 默认导出
export default TimeUtil
