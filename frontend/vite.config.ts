import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'node:fs'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Compression from 'vite-plugin-compression'

// HTTPS 已暂停：如需恢复，将下方 USE_HTTPS 改回 true 即可
const USE_HTTPS = false
const localHttpsKey = resolve(__dirname, 'ssl/local-dev-key.pem')
const localHttpsCert = resolve(__dirname, 'ssl/local-dev-cert.pem')
const localHttps = USE_HTTPS && existsSync(localHttpsKey) && existsSync(localHttpsCert)
  ? {
    key: readFileSync(localHttpsKey),
    cert: readFileSync(localHttpsCert)
  }
  : undefined

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: 'src/components.d.ts'
    }),
    // Gzip 压缩插件
    Compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 8192 // 只压缩大于 8KB 的文件
    }),
    // Brotli 压缩插件
    Compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 8192
    })
  ],
  base: '/',
  resolve: {
    extensions: ['.ts', '.vue', '.js'],
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    minify: 'terser', // 使用 terser 压缩，确保移除 console
    target: 'es2020',
    // 启用模块预加载以优化性能
    modulePreload: {
      polyfill: false
    },
    // 智能代码分割 - 按路由分割，保持按需加载
    rollupOptions: {
      output: {
        // 手动配置代码分割策略
        manualChunks: (id) => {
          // Only pin the framework core. Feature libraries keep their natural
          // route/action lazy-loading boundaries instead of being merged whole.
          if (id.includes('node_modules')) {
            if (
              id.includes('/vue/') ||
              id.includes('/pinia/') ||
              id.includes('/vue-router/') ||
              id.includes('/@vue/')
            ) {
              return 'vue-core'
            }

            // H5 交互与动效库交给 Rollup 自动拆分；强制合并容易和 vue-vendor 形成循环 chunk。

            // 通用请求与安全相关工具
            if (
              id.includes('/axios/') ||
              id.includes('/dompurify/')
            ) {
              return 'core-utils'
            }

            // Element Plus, ECharts, PDF.js, ZXing, html2canvas and heic2any
            // are intentionally left to Rollup so dynamic imports remain lazy.
            // 不返回任何值，让 Rollup 自动处理
          }
          // 2. 路由页面代码自动分割（保留按需加载）
          // 不返回任何值，让 Rollup 自动按动态导入分割
        },
        // 输出文件命名带 hash，便于缓存
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo: { name?: string }) => {
          const assetName = typeof assetInfo.name === 'string' ? assetInfo.name : ''
          if (/\.(css)$/.test(assetName)) {
            return 'css/[name]-[hash].[ext]'
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetName)) {
            return 'images/[name]-[hash].[ext]'
          }
          return 'assets/[name]-[hash].[ext]'
        }
      }
    },
    // terser 压缩配置 - 生产环境移除所有 console 和 debugger
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error']
      },
      format: {
        comments: false
      }
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 设置 chunk 大小警告限制（提高到 500KB，因为使用按需引入后 ECharts 已大大减小）
    chunkSizeWarningLimit: 500,
    // 清理输出目录
    emptyOutDir: true,
    // 不生成 sourcemap（生产环境）
    sourcemap: false,
    // 报告压缩后的体积
    reportCompressedSize: true
  },
  // 依赖预构建优化
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'axios',
      'dompurify'
    ]
  },
  server: {
    port: 5176,
    host: true,
    strictPort: false,
    https: localHttps,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // 转发所有请求头，特别是 Authorization
            if (req.headers['authorization']) {
              proxyReq.setHeader('Authorization', req.headers['authorization'])
            }
          })
        },
        rewrite: (path) => path
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    }
  }
})
