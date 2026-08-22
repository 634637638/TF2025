/**
 * 临时文件清理工具
 * 用于管理上传但未保存的临时文件
 */

import { unifiedApi } from './unified-api'
import { logger } from '@/utils/logger'

type TempFileCleanupResponse = {
  success: boolean
  message?: string
}

/**
 * 删除临时文件
 * @param files 文件URL数组
 * @returns Promise<boolean> 是否成功
 */
export async function deleteTempFiles(files: string[]): Promise<boolean> {
  if (!files || files.length === 0) {
    return true
  }

  try {
    const subsidyFiles: string[] = []
    const sharedFiles: string[] = []
    const otherFiles: string[] = []

    files.forEach(file => {
      const normalizedFile = String(file || '')
      if (
        normalizedFile.includes('/api/subsidy/files/') ||
        normalizedFile.includes('/uploads/subsidy/') ||
        normalizedFile.startsWith('subsidy/')
      ) {
        subsidyFiles.push(normalizedFile)
      } else if (
        normalizedFile.includes('/api/shared/files/') ||
        normalizedFile.includes('/uploads/shared/') ||
        normalizedFile.startsWith('shared/')
      ) {
        sharedFiles.push(normalizedFile)
      } else {
        otherFiles.push(normalizedFile)
      }
    })

    const responses = await Promise.all<TempFileCleanupResponse>([
      subsidyFiles.length > 0
        ? unifiedApi.post('/subsidy/delete-temp-photos', { photos: subsidyFiles })
        : Promise.resolve({ success: true }),
      sharedFiles.length > 0
        ? unifiedApi.post('/shared/uploads/cleanup', { urls: sharedFiles })
        : Promise.resolve({ success: true }),
      otherFiles.length > 0
        ? unifiedApi.post('/upload/delete-temp-files', { files: otherFiles })
        : Promise.resolve({ success: true })
    ])

    if (responses.every(response => response.success)) {
      return true
    } else {
      logger.error('清理临时文件失败:', responses.find(response => !response.success)?.message)
      return false
    }
  } catch (error) {
    logger.error('清理临时文件失败:', error)
    return false
  }
}

/**
 * 临时文件跟踪器类
 * 用于跟踪对话框中上传的临时文件
 */
export class TempFileTracker {
  private uploadedFiles: string[] = []
  private originalFiles: string[] = []

  /**
   * 初始化跟踪器
   * @param originalFiles 原始已保存的文件列表
   */
  init(originalFiles: string[] = []) {
    this.originalFiles = [...originalFiles]
    this.uploadedFiles = []
  }

  /**
   * 记录新上传的文件
   * @param fileUrl 文件URL
   */
  addUploadedFile(fileUrl: string) {
    if (!this.originalFiles.includes(fileUrl)) {
      this.uploadedFiles.push(fileUrl)
    }
  }

  /**
   * 记录多个新上传的文件
   * @param fileUrls 文件URL数组
   */
  addUploadedFiles(fileUrls: string[]) {
    fileUrls.forEach(url => this.addUploadedFile(url))
  }

  /**
   * 获取所有新上传的文件
   */
  getUploadedFiles(): string[] {
    return [...this.uploadedFiles]
  }

  /**
   * 清空跟踪记录（保存成功后调用）
   */
  clear() {
    this.uploadedFiles = []
    this.originalFiles = []
  }

  /**
   * 清理所有新上传的临时文件
   * @returns Promise<boolean> 是否成功
   */
  async cleanup(): Promise<boolean> {
    if (this.uploadedFiles.length === 0) {
      return true
    }

    const result = await deleteTempFiles(this.uploadedFiles)
    if (result) {
      this.uploadedFiles = []
    }
    return result
  }
}

/**
 * 创建临时文件跟踪器实例
 */
export function createTempFileTracker(): TempFileTracker {
  return new TempFileTracker()
}
