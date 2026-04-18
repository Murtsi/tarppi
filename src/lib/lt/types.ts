export type SnipePhase = 'hunting' | 'waiting' | 'landed' | 'error'

export type SnipeSession = {
  id: string
  eventId: string
  eventName: string
  variantId?: string
  variantName?: string
  quantity: number
  phase: SnipePhase
  startedAt: number
  salesStartAt?: number
  message?: string
  attempts: number
  lastCheckedAt?: number
}

export type LogLine = {
  id: string
  ts: string
  level: 'info' | 'warn' | 'ok' | 'err'
  text: string
}
