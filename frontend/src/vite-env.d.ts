/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'swiper/css'
declare module 'swiper/css/pagination'
declare module 'swiper/css/navigation'
declare module 'swiper/css/autoplay'