export type SnipePhase = 'hunting' | 'waiting' | 'landed' | 'error'

export type SnipeSession = {
  id: string
  eventId: string
  eventName: string
  variantId?: string
  variantName?: string
  variantIds?: string[]
  ticketNameQuery?: string
  quantity: number
  phase: SnipePhase
  startedAt: number
  salesStartAt?: number
  landedAt?: number
  paymentExpiresAt?: number
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
