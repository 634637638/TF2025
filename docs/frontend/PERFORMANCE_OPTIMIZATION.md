# 前端性能优化指南

## 🎯 性能问题分析

### 当前性能瓶颈

1. **全量引入 Element Plus** - `main.ts:85` 全量导入导致包体积大
2. **缺少路由懒加载** - 大部分路由同步加载，首屏时间长
3. **没有代码分割** - Vite 配置中 `manualChunks: undefined`
4. **没有资源压缩优化** - 缺少 gzip/brotli 配置
5. **大量 console.log** - 38个文件包含调试日志
6. **没有图片优化** - 缺少图片懒加载和压缩
7. **没有 CDN 加速** - Element Plus 等库未使用 CDN

---

## 📦 1. Vite 构建优化

### 优化 vite.config.ts

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    vue(),
    // 打包体积分析
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true
    }),
    // Gzip 压缩
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240, // 10KB 以上才压缩
      algorithm: 'gzip',
      ext: '.gz'
    }),
    // Brotli 压缩
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'brotliCompress',
      ext: '.br'
    })
  ],

  build: {
    outDir: 'dist',
    minify: 'terser',
    // 代码分割配置
    rollupOptions: {
      output: {
        // 手动分块策略
        manualChunks: {
          // Vue 核心库
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          // Element Plus
          'element-plus': ['element-plus', '@element-plus/icons-vue'],
          // 图表库
          'echarts': ['echarts'],
          // 工具库
          'utils': ['axios', 'dompurify', '@zxing/library']
        },
        // 输出文件命名
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: '[ext]/[name]-[hash].[ext]'
      }
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 设置 chunk 大小警告限制
    chunkSizeWarningLimit: 1000
  },

  // 依赖预构建
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'element-plus',
      '@element-plus/icons-vue',
      'axios'
    ]
  },

  server: {
    port: 5176,
    host: true,
    // 开启预加载提示
    headers: {
      'X-Content-Type-Options': 'nosniff'
    }
  }
});
```

---

## 🔧 2. Element Plus 按需引入

### 安装依赖

```bash
npm install -D unplugin-vue-components unplugin-auto-import
```

### 更新 vite.config.ts

```typescript
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

export default defineConfig({
  plugins: [
    vue(),
    // 自动导入 Element Plus 组件
    AutoImport({
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts'
    })
  ]
});
```

### 修改 main.ts

```typescript
// 移除全量导入
// import ElementPlus from 'element-plus'
// import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
// import 'element-plus/dist/index.css'

// 改为按需自动导入，只需导入样式
import 'element-plus/theme-chalk/src/index.scss'
// 或者只导入使用的组件样式
// import 'element-plus/theme-chalk/el-button.scss'
// import 'element-plus/theme-chalk/el-table.scss'

// 移除 app.use(ElementPlus)
```

---

## 🛤️ 3. 路由懒加载优化

### 优化 router/index.ts

```typescript
// 所有路由改为懒加载
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginViewSimple.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: SimpleAdminView,
    children: [
      {
        path: 'dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: { title: '仪表盘' }
      },
      {
        path: 'suppliers',
        component: () => import('@/views/suppliers/SuppliersView.vue'),
        meta: { title: '供应商管理' }
      },
      // ... 其他路由全部改为懒加载
    ]
  }
]
```

### 预加载关键路由

```typescript
// 在 SimpleAdminView 中预加载常用页面
onMounted(() => {
  // 预加载仪表盘
  import('@/views/dashboard/DashboardView.vue');
  // 预加载综合查询（使用频率高）
  import('@/views/query/QueryView.vue');
});
```

---

## 🖼️ 4. 图片和资源优化

### 安装图片优化插件

```bash
npm install -D vite-plugin-imagemin
```

### 配置 vite.config.ts

```typescript
import viteImagemin from 'vite-plugin-imagemin';

export default defineConfig({
  plugins: [
    viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9] },
      svgo: { plugins: [{ name: 'removeViewBox', active: false }] }
    })
  ]
});
```

### 图片懒加载组件

```vue
<!-- components/LazyImage.vue -->
<template>
  <div class="lazy-image-container" ref="container">
    <img
      v-if="loaded"
      :src="src"
      :alt="alt"
      @load="handleLoad"
      @error="handleError"
    />
    <div v-else class="placeholder">
      <i class="fas fa-image"></i>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps(['src', 'alt']);
const loaded = ref(false);
const container = ref(null);

onMounted(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loaded.value = true;
        observer.disconnect();
      }
    });
  });

  if (container.value) {
    observer.observe(container.value);
  }
});
</script>
```

---

## 🗑️ 5. 移除调试日志

### 生产环境自动移除 console

```typescript
// vite.config.ts 已配置
terserOptions: {
  compress: {
    drop_console: true,
    drop_debugger: true,
    pure_funcs: ['console.log', 'console.info', 'console.debug']
  }
}
```

### 手动清理（可选）

使用 eslint-plugin-no-console 规则：

```bash
npm install -D eslint-plugin-no-console
```

---

## 🚀 6. CDN 加速优化

### 使用 CDN 加载大型库

```html
<!-- index.html -->
<head>
  <!-- Element Plus CDN -->
  <link
    rel="stylesheet"
    href="https://unpkg.com/element-plus/dist/index.css"
  />
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script src="https://unpkg.com/element-plus/dist/index.full.js"></script>
</head>
```

### 配置 Vite 排除 CDN 模块

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['vue', 'element-plus'],
      output: {
        globals: {
          vue: 'Vue',
          'element-plus': 'ElementPlus'
        }
      }
    }
  }
});
```

---

## 📊 7. 性能监控

### 添加性能监控

```typescript
// utils/performance.ts
export function measurePerformance() {
  // 页面加载时间
  window.addEventListener('load', () => {
    const perfData = performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    console.log(`页面加载时间: ${pageLoadTime}ms`);

    // 关键渲染时间
    const ttfb = perfData.responseStart - perfData.navigationStart;
    console.log(`首字节时间 (TTFB): ${ttfb}ms`);

    // DOM 解析时间
    const domReady = perfData.domContentLoadedEventEnd - perfData.navigationStart;
    console.log(`DOM 就绪时间: ${domReady}ms`);
  });
}

// 资源加载监控
export function monitorResources() {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 1000) {
        console.warn(`慢资源: ${entry.name} - ${entry.duration}ms`);
      }
    }
  });

  observer.observe({ entryTypes: ['resource'] });
}
```

---

## 📱 8. 移动端优化

### 触摸优化

```css
/* styles/responsive.scss */
* {
  /* 提升触摸响应速度 */
  touch-action: manipulation;
  /* 防止双击缩放 */
  -webkit-tap-highlight-color: transparent;
}

/* 避免页面抖动 */
body {
  overflow-x: hidden;
  position: fixed;
  width: 100%;
}
```

### 虚拟滚动（大数据列表）

```vue
<!-- 使用虚拟滚动组件 -->
<template>
  <el-table-v2
    :columns="columns"
    :data="largeData"
    :width="700"
    :height="400"
    fixed
  />
</template>
```

---

## 🎯 9. 缓存策略

### Service Worker 缓存

```typescript
// sw.js
const CACHE_NAME = 'tf2025-v1';
const urlsToCache = [
  '/',
  '/assets/index-[hash].js',
  '/assets/index-[hash].css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
```

### HTTP 缓存头

```nginx
# nginx 配置
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location / {
  # HTML 文件不缓存
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

---

## 📈 10. 性能指标目标

| 指标 | 当前 | 目标 | 优化措施 |
|------|------|------|---------|
| FCP (First Contentful Paint) | ~2s | <1s | 代码分割、懒加载 |
| LCP (Largest Contentful Paint) | ~3s | <2.5s | 图片优化、CDN |
| TTI (Time to Interactive) | ~4s | <3s | 减少主线程工作 |
| JS Bundle 大小 | ~2MB | <500KB | 按需引入、Tree Shaking |
| 首屏加载时间 | ~3s | <2s | 预加载关键资源 |

---

## 🛠️ 实施步骤

### 第一步：安装依赖
```bash
npm install -D \
  unplugin-vue-components \
  unplugin-auto-import \
  vite-plugin-compression \
  vite-plugin-imagemin \
  rollup-plugin-visualizer
```

### 第二步：更新配置文件
1. 优化 `vite.config.ts`
2. 修改 `main.ts` 移除全量导入
3. 优化 `router/index.ts` 添加懒加载

### 第三步：测试和验证
```bash
# 构建生产版本
npm run build

# 分析打包体积
npx vite-bundle-visualizer

# 测试构建结果
npm run serve
```

### 第四步：部署到服务器
```bash
# 上传 dist 目录到服务器
# 配置 Nginx 开启 gzip 和缓存
pm2 restart tf2025-api
```

---

## 📚 参考资源

- [Vite 性能优化](https://vitejs.dev/guide/build.html)
- [Vue 3 性能优化](https://vuejs.org/guide/best-practices/performance.html)
- [Element Plus 按需引入](https://element-plus.org/zh-CN/guide/quickstart.html#按需导入)
- [Web 性能优化](https://web.dev/performance/)
