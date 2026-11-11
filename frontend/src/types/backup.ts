import type { BackupType } from './system'

export interface BackupFile {
  filename: string
  type: Extract<BackupType, 'full' | 'database'>
  size: string
  size_bytes: number
  created_at: string
}

export type CloudBackupStatus = 'queued' | 'uploading' | 'retrying' | 'success' | 'failed' | 'invalid'

export interface BackupScheduleInput {
  enabled: boolean
  intervalHours: number
  type: Extract<BackupType, 'full' | 'database'>
}

export interface BackupSchedule extends BackupScheduleInput {
  nextRunAt: string | null
  lastRunAt: string | null
  lastStatus: 'idle' | 'running' | 'success' | 'failed'
  lastError: string
  lastFilename: string
}

export interface BackupRetentionInput {
  enabled: boolean
  sqlCount: number
  zipCount: number
}

export interface BackupRetention extends BackupRetentionInput {
  lastRunAt: string | null
  lastDeleted: number
  lastError: string
}

export interface CloudAccount extends CloudDirectory {
  id: string
  name: string
  hasToken: boolean
}

export interface CloudAccountList {
  accountId: string
  accounts: CloudAccount[]
}

export interface CloudAccountInput {
  name: string
  token?: string
}

export interface CloudBackupSettings extends CloudAccountList {
  enabled: boolean
  hasToken: boolean
  driveId: string
  folderId: string
  folderName?: string
  lastError: string
  schedule: BackupSchedule
  retention: BackupRetention
}

export interface CloudBackupTask {
  id: string
  accountId: string
  filename: string
  status: CloudBackupStatus
  progress: number
  attempts: number
  size: number
  error: string
  folderId: string
  createdAt: string
  updatedAt: string
}

export interface CloudBackupSettingsInput {
  accountId: string
  enabled: boolean
  driveId: string
  driveName?: string
  folderId: string
  folderName?: string
  schedule?: BackupScheduleInput
  retention?: BackupRetentionInput
}

export interface CloudDrive {
  id: string
  name: string
}

export interface CloudDirectory {
  driveId: string
  driveName?: string
  folderId: string
  folderName: string
}

export interface CloudFile {
  id: string
  name: string
  type: 'file' | 'folder'
  size: number
}

export interface CloudFilePage {
  folder: CloudDirectory | null
  nextMarker: string
  items: CloudFile[]
}

export interface CloudConnection {
  accountId: string
  directory: CloudDirectory | null
  directoryError: string
  drives: CloudDrive[]
  defaultDriveId: string
  settings: CloudBackupSettings
}
