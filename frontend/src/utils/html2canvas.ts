import type html2canvas from 'html2canvas'

type Html2Canvas = typeof html2canvas

let html2canvasLoader: Promise<Html2Canvas> | null = null

/** 将浏览器计算出的现代单色值转为截图引擎支持的 sRGB，仅修改克隆节点。 */
export const normalizeCanvasColors = (root: HTMLElement): void => {
  const view = root.ownerDocument.defaultView
  if (!view) return
  const properties = ['color', 'background-color', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color']
  let context: CanvasRenderingContext2D | null = null
  for (const element of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    const computed = view.getComputedStyle(element)
    for (const property of properties) {
      const color = computed.getPropertyValue(property)
      if (!/^(?:color|color-mix|lab|lch|oklab|oklch)\(/i.test(color)) continue
      if (!context) {
        const canvas = root.ownerDocument.createElement('canvas')
        canvas.width = canvas.height = 1
        context = canvas.getContext('2d', { willReadFrequently: true })
      }
      if (!context) throw new Error('浏览器不支持图片颜色转换')
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
      element.style.setProperty(property, `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`, 'important')
    }
  }
}

export const loadHtml2Canvas = async (): Promise<Html2Canvas> => {
  if (!html2canvasLoader) {
    html2canvasLoader = import('html2canvas').then(module => module.default)
  }

  return html2canvasLoader
}
