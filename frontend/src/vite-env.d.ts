/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_TIMEOUT?: string
  readonly VITE_BACKEND_URL?: string
  readonly VITE_NODE_ENV?: string
  readonly VITE_TENCENT_MAP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'swiper/css'
declare module 'swiper/css/pagination'
declare module 'swiper/css/navigation'
declare module 'swiper/css/autoplay'
