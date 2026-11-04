declare module '@wangeditor/editor-for-vue' {
  import type { Component } from 'vue'

  export const Editor: Component
  export const Toolbar: Component
}

declare module 'qrcode' {
  interface QRCodeCanvasOptions {
    width?: number
    margin?: number
    color?: {
      dark?: string
      light?: string
    }
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  }

  interface QRCodeApi {
    toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeCanvasOptions): Promise<void>
  }

  const QRCode: QRCodeApi
  export default QRCode
}
