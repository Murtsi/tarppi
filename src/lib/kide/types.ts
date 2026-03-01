/**
 * Types used by the frontend — mirrors shared/interfaces.ts
 * but kept local to avoid cross-package import issues with Vercel.
 */

export type KideVariant = {
  inventoryId: string
  name: string
  availability: number
  price?: number
  pricePerItem?: number
  dateProductVariantSalesFrom?: string | null
  productVariantMaximumReservableQuantity?: number
}

export type KideUser = {
  id: string
  firstName?: string
  lastName?: string
  email?: string
}

export type EventResponse = {
  product: {
    name: string
    timeUntilSalesStart?: number
    dateSalesFrom?: string
    salesEnded?: boolean
  }
  variants: KideVariant[]
}

export type ReserveResponse = {
  success: boolean
  message: string
  retryWithQuantity?: number
}

export type ValidateTokenResponse = {
  valid: boolean
  user?: KideUser
  info?: {
    email?: string
    expiresAt?: string
  }
}

export type DeobfuscateResponse = {
  hash: string | null
  headerKey: string | null
  extractedAt: string
  cached: boolean
}
