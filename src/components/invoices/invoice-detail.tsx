'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Download, Loader2, Printer, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { usePermission } from '@/hooks/use-permission'
import { useI18n } from '@/lib/i18n'
import { InvoiceDocument } from '@/components/invoice/invoice-document'
import { friendlyDbError } from '@/lib/utils'
import { toISODate } from '@/lib/format'
import type { PaymentMethod } from '@/types'

const METHODS: PaymentMethod[] = ['cash', 'kbz_pay', 'wave_pay', 'aya_pay', 'bank_transfer', 'card']

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const { t } = useI18n()
  const { can } = usePermission()
  const [format, setFormat] = useState<'a4' | 'receipt'>('a4')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
          နောက်သို့
        </Button>

        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4</SelectItem>
              <SelectItem value="receipt">80mm</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t('invoice.print')}
          </Button>

          {/* Server-rendered PDF of this same component, so the file matches
              the receipt the customer was handed. */}
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={`/api/invoices/${invoiceId}/pdf?format=${format}`} target="_blank" rel="noreferrer">
              <Download className="size-4" />
              PDF
            </a>
          </Button>

          {can('payments.create') && <RecordPaymentDialog invoiceId={invoiceId} />}
          {can('invoices.void') && <VoidInvoiceButton invoiceId={invoiceId} />}
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-0">
          <InvoiceDocument invoiceId={invoiceId} format={format} />
        </CardContent>
      </Card>
    </div>
  )
}

function RecordPaymentDialog({ invoiceId }: { invoiceId: string }) {
  const { tenant, user } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')

  const record = useMutation({
    mutationFn: async () => {
      const value = Number(amount)
      if (!value || value <= 0) throw new Error('Enter an amount greater than zero.')

      const { data: invoice, error: readError } = await supabase
        .from('v_invoices')
        .select('contact_id,currency_code,exchange_rate,paid_amount,total')
        .eq('id', invoiceId)
        .single()
      if (readError) throw readError

      const { error: payError } = await supabase.from('payments').insert({
        tenant_id: tenant.id,
        invoice_id: invoiceId,
        contact_id: invoice.contact_id,
        direction: 'in',
        method,
        currency_code: invoice.currency_code,
        exchange_rate: invoice.exchange_rate,
        amount: value,
        paid_on: toISODate(),
        created_by: user.id,
      })
      if (payError) throw payError

      // Roll the payment up onto the invoice so balance_due and status stay true.
      const paid = Number(invoice.paid_amount) + value
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: paid,
          status: paid >= Number(invoice.total) ? 'paid' : 'partial',
        })
        .eq('id', invoiceId)
      if (updateError) throw updateError
    },
    onSuccess: () => {
      toast.success('ငွေပေးချေမှု မှတ်တမ်းတင်ပြီး')
      queryClient.invalidateQueries({ queryKey: qk.invoice(tenant.id, invoiceId) })
      queryClient.invalidateQueries({ queryKey: qk.invoices(tenant.id) })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setAmount('')
      setOpen(false)
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Wallet className="size-4" />
        ငွေလက်ခံမည်
      </Button>

      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>ငွေပေးချေမှု မှတ်တမ်းတင်ရန်</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="pay-amount">ပမာဏ</Label>
            <Input
              id="pay-amount"
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 text-right text-lg tabular-nums"
              autoFocus
            />
          </div>

          <div>
            <Label>နည်းလမ်း</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="lg"
            className="h-12 w-full"
            disabled={record.isPending}
            onClick={() => record.mutate()}
          >
            {record.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            မှတ်တမ်းတင်မည်
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function VoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const { tenant } = useSession()
  const supabase = getSupabaseBrowserClient()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  const voidIt = useMutation({
    mutationFn: async () => {
      // void_invoice() writes counter-movements rather than deleting stock rows;
      // the ledger stays append-only and the audit trail intact.
      const { error } = await supabase.rpc('void_invoice', {
        p_invoice_id: invoiceId,
        p_reason: reason || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('ပယ်ဖျက်ပြီးပါပြီ')
      queryClient.invalidateQueries({ queryKey: qk.invoice(tenant.id, invoiceId) })
      queryClient.invalidateQueries({ queryKey: qk.invoices(tenant.id) })
      queryClient.invalidateQueries({ queryKey: qk.products(tenant.id) })
      setOpen(false)
    },
    onError: (error) => toast.error(friendlyDbError(error)),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setOpen(true)}>
        <Ban className="size-4" />
        ပယ်ဖျက်မည်
      </Button>

      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>ပြေစာပယ်ဖျက်ရန်</DialogTitle></DialogHeader>

        <p className="text-sm text-muted-foreground">
          ကုန်ပစ္စည်းလက်ကျန်ကို ပြန်လည်ထည့်သွင်းပေးပါမည်။
          <span className="mt-1 block">Stock is returned with a counter-movement; nothing is deleted.</span>
        </p>

        <div>
          <Label htmlFor="void-reason">အကြောင်းပြချက်</Label>
          <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" />
        </div>

        <Button
          size="lg"
          variant="destructive"
          className="h-12 w-full"
          disabled={voidIt.isPending}
          onClick={() => voidIt.mutate()}
        >
          {voidIt.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          အတည်ပြုပယ်ဖျက်မည်
        </Button>
      </DialogContent>
    </Dialog>
  )
}
