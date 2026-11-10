import { unifiedApi } from '@/utils/unified-api'
import type { CloudAccount, CloudAccountInput, CloudAccountList, CloudBackupSettings, CloudBackupSettingsInput, CloudBackupTask, CloudConnection, CloudDirectory, CloudFilePage } from '@/types/backup'

export const backupCloudApi = {
  settings: (signal?: AbortSignal) => unifiedApi.get<CloudBackupSettings>('/backup/cloud/settings', { useCache: false, showError: false, showLoading: false, signal }),
  save: (input: CloudBackupSettingsInput) => unifiedApi.put<CloudBackupSettings>('/backup/cloud/settings', input, { showLoading: false, showError: false }),
  accounts: (signal?: AbortSignal) => unifiedApi.get<CloudAccountList>('/backup/cloud/accounts', { useCache: false, showLoading: false, showError: false, signal }),
  saveAccount: (input: CloudAccountInput, accountId?: string) => accountId
    ? unifiedApi.patch<CloudAccount>(`/backup/cloud/accounts/${encodeURIComponent(accountId)}`, input, { showLoading: false, showError: false })
    : unifiedApi.post<CloudAccount>('/backup/cloud/accounts', input, { showLoading: false, showError: false }),
  connect: (accountId: string, signal?: AbortSignal) => unifiedApi.post<CloudConnection>('/backup/cloud/connect', { accountId }, { showLoading: false, showError: false, timeout: 90_000, signal }),
  drives: (accountId: string, signal?: AbortSignal) => unifiedApi.get<CloudConnection>('/backup/cloud/drives', { params: { accountId }, useCache: false, showLoading: false, showError: false, timeout: 90_000, signal }),
  createFolder: (accountId: string, driveId: string, folderId: string, name: string) => unifiedApi.post<CloudDirectory>('/backup/cloud/folders', { accountId, driveId, folderId, name }, { showLoading: false, showError: false, timeout: 90_000 }),
  rename: (accountId: string, driveId: string, fileId: string, name: string) => unifiedApi.patch(`/backup/cloud/files/${encodeURIComponent(driveId)}/${encodeURIComponent(fileId)}`, { accountId, name }, { showLoading: false, showError: false, timeout: 90_000 }),
  files: (params: { accountId: string; driveId: string; folderId: string; trash: boolean; marker: string }, signal?: AbortSignal) =>
    unifiedApi.get<CloudFilePage>('/backup/cloud/files', { params, signal, useCache: false, showLoading: false, showError: false, timeout: 90_000 }),
  trash: (accountId: string, driveId: string, fileId: string) => unifiedApi.delete(`/backup/cloud/files/${encodeURIComponent(driveId)}/${encodeURIComponent(fileId)}`, { params: { accountId }, showLoading: false, showError: false, timeout: 90_000 }),
  restore: (accountId: string, driveId: string, fileId: string) => unifiedApi.post(`/backup/cloud/trash/${encodeURIComponent(driveId)}/${encodeURIComponent(fileId)}/restore`, { accountId }, { showLoading: false, showError: false, timeout: 90_000 }),
  purge: (accountId: string, driveId: string, fileId: string) => unifiedApi.delete(`/backup/cloud/trash/${encodeURIComponent(driveId)}/${encodeURIComponent(fileId)}`, { params: { accountId }, showLoading: false, showError: false, timeout: 90_000 }),
  test: () => unifiedApi.post<{ folderName: string }>('/backup/cloud/test', {}, { showError: false, timeout: 90_000 }),
  tasks: (signal?: AbortSignal) => unifiedApi.get<CloudBackupTask[]>('/backup/cloud/tasks', {
    useCache: false, showLoading: false, showError: false, signal
  }),
  upload: (filename: string) => unifiedApi.post<CloudBackupTask>(`/backup/cloud/upload/${encodeURIComponent(filename)}`, {}, { showError: false })
}
