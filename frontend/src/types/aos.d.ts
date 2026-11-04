declare module 'aos' {
  export interface AosOptions {
    duration?: number
    delay?: number
    easing?: string
    once?: boolean
    offset?: number
    startEvent?: string
    useClassInitial?: boolean
    disableMutationObserver?: boolean
    disable?: boolean | string | (() => boolean)
    mirror?: boolean
    anchorPlacement?: string
  }

  interface AosApi {
    init(options?: AosOptions): void
    refresh(): void
    refreshHard(): void
  }

  const AOS: AosApi
  export default AOS
}
