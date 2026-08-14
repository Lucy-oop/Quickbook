import type { Metadata } from 'next'
import { requirePermission } from '@/lib/session'
import { PosTerminal } from '@/components/pos/pos-terminal'

export const metadata: Metadata = { title: 'Point of Sale · Myanmar ERP' }

/** POS runs full-bleed: no app padding, no scroll chrome, keyboard-friendly. */
export default async function PosPage() {
  await requirePermission('pos.use')
  return <PosTerminal />
}
