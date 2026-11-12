import { createPinia, setActivePinia } from 'pinia'
import { config } from '@vue/test-utils'
import AmountInput from '@/components/AmountInput.vue'

setActivePinia(createPinia())
config.global.components.AmountInput = AmountInput
