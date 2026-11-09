import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // jsdom 按浏览器方式加载验证器，避免 CJS 双层 default 令 Element 表单吞掉校验异常。
      'async-validator': resolve(__dirname, 'node_modules/async-validator/dist-web/index.js')
    }
  },
  test: {
    environment: 'jsdom',
    server: { deps: { inline: ['element-plus'] } },
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['tests/setup.ts'],
    clearMocks: true,
    restoreMocks: true
  }
})
