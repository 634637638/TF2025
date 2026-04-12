import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import Compression from 'vite-plugin-compression';

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
      threshold: 8192,
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
    outDir: 'dist-debug',
    minify: 'terser',
    target: 'es2020',
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
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

            if (id.includes('echarts')) {
              return 'echarts-core';
            }

            if (id.includes('/html2canvas/')) {
              return 'html2canvas';
            }

            if (id.includes('/@zxing/')) {
              return 'zxing';
            }

            if (id.includes('/heic2any/')) {
              return 'image-convert';
            }

            if (id.includes('/pdfjs-dist/')) {
              return 'pdf';
            }

            if (
              id.includes('/swiper/') ||
              id.includes('/aos/') ||
              id.includes('/vuedraggable/') ||
              id.includes('/v3-infinite-loading/')
            ) {
              return 'ui-extensions';
            }

            if (
              id.includes('/axios/') ||
              id.includes('/dompurify/')
            ) {
              return 'core-utils';
            }
          }
        },
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
    // ⚠️ 调试版本：保留 console 和 debugger
    terserOptions: {
      compress: {
        drop_console: false,  // ← 保留 console
        drop_debugger: false, // ← 保留 debugger
        // 不移除任何 console 方法
        pure_funcs: [],
      },
      format: {
        comments: false,
      },
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
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
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
