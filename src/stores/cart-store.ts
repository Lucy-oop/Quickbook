'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CartLine, CartTotals, CurrencyCode, PaymentMethod, ProductView } from '@/types'

interface CartState {
  lines: CartLine[]
  contactId: string | null
  contactName: string | null
  warehouseId: string | null
  currency: CurrencyCode
  exchangeRate: number
  method: PaymentMethod
  /** Invoice-level discount, on top of any per-line discounts. */
  orderDiscount: number
  note: string
  /** Parked sales, so a cashier can serve the next customer mid-transaction. */
  heldSales: { id: string; label: string; lines: CartLine[]; heldAt: string }[]

  addProduct: (product: ProductView, quantity?: number) => void
  setQuantity: (lineId: string, quantity: number) => void
  setUnitPrice: (lineId: string, price: number) => void
  setLineDiscount: (lineId: string, discount: number) => void
  removeLine: (lineId: string) => void
  setContact: (id: string | null, name: string | null) => void
  setWarehouse: (id: string | null) => void
  setCurrency: (code: CurrencyCode, rate: number) => void
  setMethod: (method: PaymentMethod) => void
  setOrderDiscount: (amount: number) => void
  setNote: (note: string) => void
  hold: (label: string) => void
  resume: (id: string) => void
  clear: () => void
  totals: () => CartTotals
}

const newLineId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

function computeTotals(lines: CartLine[], orderDiscount: number): CartTotals {
  let subtotal = 0
  let discount = orderDiscount
  let tax = 0

  for (const line of lines) {
    const gross = line.quantity * line.unitPrice
    const net = Math.max(gross - line.discount, 0)
    subtotal += gross
    discount += line.discount
    tax += net * (line.taxRate / 100)
  }

  const total = Math.max(subtotal - discount + tax, 0)

  return {
    subtotal: round(subtotal),
    discount: round(discount),
    tax: round(tax),
    total: round(total),
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
  }
}

const round = (n: number) => Math.round(n * 10_000) / 10_000

/**
 * POS cart. Persisted to localStorage so a dropped connection or a reloaded
 * tab on a cheap Android device does not lose the customer's basket.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      contactId: null,
      contactName: null,
      warehouseId: null,
      currency: 'MMK',
      exchangeRate: 1,
      method: 'cash',
      orderDiscount: 0,
      note: '',
      heldSales: [],

      addProduct: (product, quantity = 1) =>
        set((state) => {
          // Same product, same price → merge instead of stacking duplicate rows.
          const existing = state.lines.find(
            (l) => l.productId === product.id && l.unitPrice === product.selling_price,
          )
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.lineId === existing.lineId ? { ...l, quantity: round(l.quantity + quantity) } : l,
              ),
            }
          }
          const line: CartLine = {
            lineId: newLineId(),
            productId: product.id,
            name: product.name,
            sku: product.sku,
            unit: product.unit,
            quantity,
            unitPrice: product.selling_price,
            discount: 0,
            taxRate: product.tax_rate ?? 0,
            customFields: {},
            unitCost: product.cost_price ?? null,
          }
          return { lines: [...state.lines, line] }
        }),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.lineId !== lineId)
              : state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: round(quantity) } : l)),
        })),

      setUnitPrice: (lineId, price) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.lineId === lineId ? { ...l, unitPrice: Math.max(round(price), 0) } : l,
          ),
        })),

      setLineDiscount: (lineId, discount) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.lineId === lineId ? { ...l, discount: Math.max(round(discount), 0) } : l,
          ),
        })),

      removeLine: (lineId) => set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

      setContact: (contactId, contactName) => set({ contactId, contactName }),
      setWarehouse: (warehouseId) => set({ warehouseId }),
      setCurrency: (currency, exchangeRate) => set({ currency, exchangeRate }),
      setMethod: (method) => set({ method }),
      setOrderDiscount: (orderDiscount) => set({ orderDiscount: Math.max(orderDiscount, 0) }),
      setNote: (note) => set({ note }),

      hold: (label) =>
        set((state) => {
          if (state.lines.length === 0) return state
          return {
            heldSales: [
              ...state.heldSales,
              { id: newLineId(), label, lines: state.lines, heldAt: new Date().toISOString() },
            ],
            lines: [],
            orderDiscount: 0,
            note: '',
            contactId: null,
            contactName: null,
          }
        }),

      resume: (id) =>
        set((state) => {
          const held = state.heldSales.find((h) => h.id === id)
          if (!held) return state
          return {
            lines: held.lines,
            heldSales: state.heldSales.filter((h) => h.id !== id),
          }
        }),

      clear: () =>
        set({
          lines: [],
          orderDiscount: 0,
          note: '',
          contactId: null,
          contactName: null,
          method: 'cash',
        }),

      totals: () => computeTotals(get().lines, get().orderDiscount),
    }),
    {
      name: 'erp-pos-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lines: state.lines,
        contactId: state.contactId,
        contactName: state.contactName,
        warehouseId: state.warehouseId,
        currency: state.currency,
        exchangeRate: state.exchangeRate,
        orderDiscount: state.orderDiscount,
        note: state.note,
        heldSales: state.heldSales,
      }),
    },
  ),
)

export { computeTotals }
