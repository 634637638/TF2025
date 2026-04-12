import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import Compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: 'src/components.d.ts',
    }),
    // Gzip 压缩插件
    Compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 8192, // 只压缩大于 8KB 的文件
    }),
    // Brotli 压缩插件
    Compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 8192,
    }),
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
      polyfill: false,
    },
    // 智能代码分割 - 按路由分割，保持按需加载
    rollupOptions: {
      output: {
        // 手动配置代码分割策略
        manualChunks: (id) => {
          // 1. 将大型第三方库单独打包
          if (id.includes('node_modules')) {
            // Vue 生态与 Element Plus 基础能力（包括所有依赖 Vue 的包）
            if (
              id.includes('/vue/') ||
              id.includes('/pinia/') ||
              id.includes('/vue-router/') ||
              id.includes('/@vue/') ||
              id.includes('/element-plus/') ||
              id.includes('/@element-plus/') ||
              id.includes('/@element-plus/icons-vue/')
            ) {
              return 'vue-vendor';
            }

            // 图表能力 - 已使用按需引入
            if (id.includes('echarts')) {
              return 'echarts-core';
            }

            // DOM 截图与导出能力
            if (id.includes('/html2canvas/')) {
              return 'html2canvas';
            }

            // 扫码能力
            if (id.includes('/@zxing/')) {
              return 'zxing';
            }

            // 图片转换能力
            if (id.includes('/heic2any/')) {
              return 'image-convert';
            }

            // PDF.js
            if (id.includes('/pdfjs-dist/')) {
              return 'pdf';
            }

            // H5 交互与动效能力
            if (
              id.includes('/swiper/') ||
              id.includes('/aos/') ||
              id.includes('/vuedraggable/') ||
              id.includes('/v3-infinite-loading/')
            ) {
              return 'ui-extensions';
            }

            // 通用请求与安全相关工具
            if (
              id.includes('/axios/') ||
              id.includes('/dompurify/')
            ) {
              return 'core-utils';
            }

            // 其余依赖交给 Rollup 自动拆分，避免循环依赖
            // 不返回任何值，让 Rollup 自动处理
          }
          // 2. 路由页面代码自动分割（保留按需加载）
          // 不返回任何值，让 Rollup 自动按动态导入分割
        },
        // 输出文件命名带 hash，便于缓存
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(css)$/.test(assetInfo.name)) {
            return 'css/[name]-[hash].[ext]';
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name)) {
            return 'images/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        }
      }
    },
    // terser 压缩配置 - 生产环境移除所有 console 和 debugger
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
      },
      format: {
        comments: false,
      },
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
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // 转发所有请求头，特别是 Authorization
            if (req.headers['authorization']) {
              proxyReq.setHeader('Authorization', req.headers['authorization']);
            }
          });
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
});
