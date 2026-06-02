import type html2canvas from 'html2canvas'

type Html2Canvas = typeof html2canvas

let html2canvasLoader: Promise<Html2Canvas> | null = null

export const loadHtml2Canvas = async (): Promise<Html2Canvas> => {
  if (!html2canvasLoader) {
    html2canvasLoader = import('html2canvas').then(module => module.default)
  }

  return html2canvasLoader
}
