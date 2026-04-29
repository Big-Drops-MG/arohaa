export interface ArohaaApi {
  (event: string, props?: Record<string, unknown>): void
  track: (event: string, props?: Record<string, unknown>) => void
  q?: IArguments[]
  l?: number
}

export interface ArohaaQueueStub {
  (...args: unknown[]): void
  q?: IArguments[]
  l?: number
}

declare global {
  interface Window {
    arohaa?: ArohaaApi | ArohaaQueueStub
  }
}
