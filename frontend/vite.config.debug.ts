import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Compression from 'vite-plugin-compression'

/**
 * 调试版本配置
 * 用于云端排查问题，保留 console 和 sourcemap
 *
 * 使用方法：
 * npm run build:debug
 */
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
      threshold: 8192
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
    outDir: 'dist-debug',
    minify: 'terser',
    target: 'es2020',
    modulePreload: {
      polyfill: false
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
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

            if (
              id.includes('/axios/') ||
              id.includes('/dompurify/')
            ) {
              return 'core-utils'
            }
          }
        },
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
    // ⚠️ 调试版本：保留 console 和 debugger
    terserOptions: {
      compress: {
        drop_console: false,  // ← 保留 console
        drop_debugger: false, // ← 保留 debugger
        // 不移除任何 console 方法
        pure_funcs: []
      },
      format: {
        comments: false
      }
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
    emptyOutDir: true,
    // ⚠️ 调试版本：生成 sourcemap
    sourcemap: true,
    reportCompressedSize: true
  },
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
