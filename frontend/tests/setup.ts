import { createPinia, setActivePinia } from 'pinia'
import { config } from '@vue/test-utils'
import AmountInput from '@/components/AmountInput.vue'
import RecordDescriptions from '@/components/RecordDescriptions.vue'
import SearchActionButton from '@/components/search/SearchActionButton.vue'

setActivePinia(createPinia())
config.global.components.AmountInput = AmountInput
config.global.components.RecordDescriptions = RecordDescriptions
config.global.components.SearchActionButton = SearchActionButton
