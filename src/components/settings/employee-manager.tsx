'use client'

import { useState } from 'react'
import { Loader2, Pencil, Plus, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { useEmployees, useUpsertEmployee } from '@/hooks/use-employees'
import { usePermission } from '@/hooks/use-permission'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { formatMoney } from '@/lib/format'
import { friendlyDbError } from '@/lib/utils'
import { PAYMENT_METHODS } from '@/lib/payment-methods'
import type { EmployeeRow, PaymentMethod } from '@/types'

/**
 * The staff list the salary form draws from.
 *
 * Employees are not `contacts` and not `memberships`: a shop pays people who
 * have no app login, and their base salary must not appear in a customer
 * picker. Inactive staff are kept rather than deleted — `payroll_entries`
 * references them, and last year's payroll must stay readable.
 */
export function EmployeeManager() {
  const { locale } = useI18n()
  const { can } = usePermission()
  const { tenant } = useSession()
  // Includes inactive: this is the management screen, so leavers stay visible.
  const employees = useEmployees(true, true)
  const [editing, setEditing] = useState<EmployeeRow | 'new' | null>(null)

  const money = (value: number) => formatMoney(value, { currency: tenant.base_currency, locale })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4" />
          ဝန်ထမ်းများ / Employees
        </CardTitle>
        {can('employees.manage') && (
          <Button size="sm" className="gap-1.5" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            အသစ်
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-0 sm:px-2">
        {employees.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : !employees.data?.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            ဝန်ထမ်းစာရင်းမရှိပါ။ / No employees yet.
          </p>
        ) : (
          <ul className="divide-y">
            {employees.data.map((employee) => (
              <li key={employee.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  {/* A div, not a p: Badge renders a div, and a div inside a
                      paragraph is invalid HTML that trips hydration. */}
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {localized(locale, employee.name, employee.name_my)}
                    </span>
                    {employee.code && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">{employee.code}</Badge>
                    )}
                    {!employee.is_active && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">ထွက်ပြီး</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[employee.position, employee.phone].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>

                <span className="shrink-0 text-sm tabular-nums">{money(Number(employee.base_salary))}</span>

                {can('employees.manage') && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => setEditing(employee)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {editing && (
        <EmployeeEditor
          employee={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

function EmployeeEditor({
  employee,
  onClose,
}: {
  employee: EmployeeRow | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const mutation = useUpsertEmployee()

  const [name, setName] = useState(employee?.name ?? '')
  const [nameMy, setNameMy] = useState(employee?.name_my ?? '')
  const [code, setCode] = useState(employee?.code ?? '')
  const [position, setPosition] = useState(employee?.position ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [baseSalary, setBaseSalary] = useState(String(employee?.base_salary ?? ''))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(employee?.payment_method ?? 'cash')
  const [isActive, setIsActive] = useState(employee?.is_active ?? true)

  const save = async () => {
    if (!name.trim()) {
      toast.error(t('common.retry'), { description: 'Name is required.' })
      return
    }

    try {
      await mutation.mutateAsync({
        id: employee?.id,
        name,
        nameMy,
        code,
        position,
        phone,
        baseSalary: Number(baseSalary) || 0,
        paymentMethod,
        isActive,
      })
      toast.success(t('common.save'))
      onClose()
    } catch (error) {
      toast.error(friendlyDbError(error))
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? 'ဝန်ထမ်းပြင်ဆင်ရန်' : 'ဝန်ထမ်းအသစ်'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="emp-name">အမည် / Name</Label>
            <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12" autoFocus />
          </div>

          <div>
            <Label htmlFor="emp-name-my">အမည် (မြန်မာ)</Label>
            <Input id="emp-name-my" value={nameMy} onChange={(e) => setNameMy(e.target.value)} className="h-12" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="emp-code">ဝန်ထမ်း ID</Label>
              <Input id="emp-code" value={code} onChange={(e) => setCode(e.target.value)} className="h-12" />
            </div>
            <div>
              <Label htmlFor="emp-position">ရာထူး</Label>
              <Input id="emp-position" value={position} onChange={(e) => setPosition(e.target.value)} className="h-12" />
            </div>
          </div>

          <div>
            <Label htmlFor="emp-phone">ဖုန်း</Label>
            <Input id="emp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" inputMode="tel" />
          </div>

          <div>
            <Label htmlFor="emp-salary">{t('payroll.baseSalary')}</Label>
            <Input
              id="emp-salary"
              type="number"
              inputMode="decimal"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              className="h-12 text-right tabular-nums"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              လစာဖောင်တွင် အလိုအလျောက်ဖြည့်ပါမည်။
            </p>
          </div>

          <div>
            <Label>{t('pos.paymentMethod')}</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.labelMy}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="emp-active">အလုပ်လုပ်နေသည်</Label>
            <Switch id="emp-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1" onClick={save} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
