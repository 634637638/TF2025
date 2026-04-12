import { fieldPermissions } from '@/composables/useFieldPermissions'

const ANALYTICS_MODULE_KEY = 'analytics_analyticsview'

export const useAnalyticsFieldVisibility = (groupKey: string) => {
  const normalizeFieldKey = (fieldKey: string) => {
    if (fieldKey.includes('.')) {
      return fieldKey
    }

    return `${groupKey}.${fieldKey}`
  }

  const canViewField = (fieldKey: string) => {
    return fieldPermissions.isFieldVisible(ANALYTICS_MODULE_KEY, normalizeFieldKey(fieldKey))
  }

  const canViewAnyField = (fieldKeys: string[]) => {
    return fieldKeys.some(fieldKey => canViewField(fieldKey))
  }

  return {
    canViewField,
    canViewAnyField
  }
}

