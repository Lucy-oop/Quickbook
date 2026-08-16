'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { qk } from '@/components/providers/query-provider'
import { useSession } from '@/components/providers/session-provider'
import { usePermission } from '@/hooks/use-permission'
import { useQuickTransaction } from '@/hooks/use-checkout'
import { useEmployees, useRecordSalary } from '@/hooks/use-employees'
import { useI18n, localized } from '@/lib/i18n'
import { formatDate, formatMoney, formatNumber, toISODate } from '@/lib/format'
import { cn, friendlyDbError } from '@/lib/utils'
import { PAYMENT_METHODS } from '@/lib/payment-methods'
import { CustomFieldsForm } from '@/components/custom-fields/custom-fields-form'
import type { CustomFieldValues, ExpenseGroup, PaymentMethod } from '@/types'

interface Props {
  type: 'income' | 'expense'
  trigger: ReactNode
}

/** Fixed display order — most frequent spending first. */
const EXPENSE_GROUPS: ExpenseGroup[] = ['payroll', 'office', 'inventory', 'other']

const currentMonth = () => toISODate().slice(0, 7)

/**
 * The one-screen money entry a shop owner uses on their phone: amount, category,
 * done. Everything else (currency, exchange rate, payment account) has a sane
 * default and is only shown when it differs from the tenant's base setup.
 *
 * Expenses take one extra step. Choosing an expense *group* first — salary,
 * office, inventory, other — lets the form ask only the questions that group
 * needs: a salary payment wants an employee and a pay period, an office expense
 * wants a receipt number, and neither wants the other's fields. The group lives
 * on the expense account itself (`accounts.expense_group`), so the chart of
 * accounts stays the single definition of what the categories are.
 */
export function QuickTransactionDialog({ type, trigger }: Props) {
  const { t, locale } = useI18n()
  const { tenant } = useSession()
  const { can } = usePermission()
  const supabase = getSupabaseBrowserClient()
  const mutation = useQuickTransaction()
  const salaryMutation = useRecordSalary()

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [group, setGroup] = useState<ExpenseGroup | ''>('')
  const [accountId, setAccountId] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [occurredOn, setOccurredOn] = useState(toISODate())
  const [customFields, setCustomFields] = useState<CustomFieldValues>({})
  const [showDetails, setShowDetails] = useState(false)

  // Salary-only fields.
  const [employeeId, setEmployeeId] = useState('')
  const [payPeriod, setPayPeriod] = useState(currentMonth)
  const [baseAmount, setBaseAmount] = useState('')
  const [bonusAmount, setBonusAmount] = useState('')
  const [deductionAmount, setDeductionAmount] = useState('')

  const isExpense = type === 'expense'
  const isSalary = isExpense && group === 'payroll'
  // A salary's date and tender genuinely vary per payment, so its detail block is
  // never folded away — unlike a quick income entry, where today/cash is right
  // almost every time.
  const detailsOpen = showDetails || isSalary
  const canReadPayroll = can('employees.read')

  const accounts = useQuery({
    queryKey: qk.accounts(tenant.id),
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id,code,name_en,name_my,type,subtype,is_cash_like,expense_group')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('code')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })

  const employees = useEmployees(open && isSalary && canReadPayroll)

  /**
   * What this form is allowed to post to.
   *
   * Income is scoped to money that is NOT a sale. `4000 Sales Revenue` is what
   * `post_invoice` writes for every POS sale and invoice, so offering it here
   * lets the same cash be recorded twice — once rung up, once typed in. Sales
   * belong in POS, where stock and receivables move with them.
   *
   * Owner capital is included even though it is `equity` rather than `income`:
   * money the owner puts in is not revenue, but it IS what someone looks for
   * under "add income". Posting it to `3000 Owner Equity` keeps it out of
   * `report_income` and `income_period` (correct — it is not earnings) while
   * still counting as cash inflow (also correct).
   */
  const allCategories = useMemo(() => {
    const rows = accounts.data ?? []
    if (isExpense) return rows.filter((a) => a.type === 'expense')
    return rows.filter(
      (a) =>
        (a.type === 'income' && a.subtype !== 'sales')
        || (a.type === 'equity' && a.subtype === 'capital'),
    )
  }, [accounts.data, isExpense])

  // Only offer groups this tenant actually has accounts for.
  const availableGroups = useMemo(
    () => EXPENSE_GROUPS.filter((g) => allCategories.some((a) => a.expense_group === g)),
    [allCategories],
  )

  // For an expense the group gates the list. Offering every expense account
  // up-front would let someone file a salary under "Salaries & Wages" without
  // ever entering the group, and the payroll detail would silently not be
  // recorded — the entry would look right and reconcile wrong.
  const categories = useMemo(() => {
    if (!isExpense) return allCategories
    return group ? allCategories.filter((a) => a.expense_group === group) : []
  }, [allCategories, group, isExpense])

  const cashAccounts = useMemo(
    () => (accounts.data ?? []).filter((a) => a.is_cash_like),
    [accounts.data],
  )

  const selectedEmployee = (employees.data ?? []).find((e) => e.id === employeeId)

  // The ledger figure for a salary is derived, not typed: base + bonus − deduction.
  const netSalary =
    (Number(baseAmount) || 0) + (Number(bonusAmount) || 0) - (Number(deductionAmount) || 0)

  // The payment account used to be a placeholder only: the trigger *displayed*
  // "Cash on Hand" while `paymentAccountId` stayed empty, so the field looked
  // filled but held nothing and the real value was quietly substituted at
  // submit time. Select the default for real once the accounts land.
  useEffect(() => {
    if (!paymentAccountId && cashAccounts[0]) setPaymentAccountId(cashAccounts[0].id)
  }, [paymentAccountId, cashAccounts])

  // Switching group invalidates the chosen category. When a group holds exactly
  // one account — the usual case for salary — pick it rather than making the
  // owner tap a list of one.
  useEffect(() => {
    if (!isExpense || !group) return
    if (categories.length === 1) setAccountId(categories[0].id)
    else if (!categories.some((c) => c.id === accountId)) setAccountId('')
  }, [group, categories, accountId, isExpense])

  // An employee carries their usual pay and how they are usually paid.
  useEffect(() => {
    if (!selectedEmployee) return
    setBaseAmount(selectedEmployee.base_salary ? String(selectedEmployee.base_salary) : '')
    setPaymentMethod(selectedEmployee.payment_method)
  }, [selectedEmployee])

  const resetAfterSave = () => {
    setAmount('')
    setDescription('')
    setReference('')
    setCustomFields({})
    setEmployeeId('')
    setBaseAmount('')
    setBonusAmount('')
    setDeductionAmount('')
    setOpen(false)
  }

  const submit = async () => {
    if (!accountId) {
      toast.error(t('common.retry'), { description: t('expense.category') })
      return
    }

    try {
      if (isSalary) {
        if (!employeeId) {
          toast.error(t('common.retry'), { description: t('payroll.employee') })
          return
        }
        if (netSalary <= 0) {
          toast.error(t('common.retry'), { description: t('payroll.net') })
          return
        }

        await salaryMutation.mutateAsync({
          accountId,
          paymentAccountId: paymentAccountId || cashAccounts[0]?.id || null,
          paymentMethod,
          employeeId,
          payPeriod,
          baseAmount: Number(baseAmount) || 0,
          bonusAmount: Number(bonusAmount) || 0,
          deductionAmount: Number(deductionAmount) || 0,
          occurredOn,
          description:
            description ||
            `${selectedEmployee ? localized(locale, selectedEmployee.name, selectedEmployee.name_my) : ''} · ${payPeriod}`,
        })
      } else {
        const value = Number(amount)
        if (!value || value <= 0) {
          toast.error(t('common.retry'), { description: 'Enter an amount greater than zero.' })
          return
        }

        await mutation.mutateAsync({
          type,
          amount: value,
          accountId,
          paymentAccountId: paymentAccountId || cashAccounts[0]?.id || null,
          method: paymentMethod,
          occurredOn,
          description: description || undefined,
          reference: reference || null,
          currency: tenant.base_currency,
          exchangeRate: 1,
          customFields,
        })
      }

      toast.success(type === 'income' ? t('dashboard.quickIncome') : t('dashboard.quickExpense'))
      resetAfterSave()
    } catch (error) {
      const err = error as { code?: string }
      toast.error(err?.code === '23505' && isSalary ? t('payroll.duplicate') : friendlyDbError(error))
    }
  }

  const pending = mutation.isPending || salaryMutation.isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {type === 'income' ? t('dashboard.quickIncome') : t('dashboard.quickExpense')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* A picker with nothing in it opens as an invisible, zero-height
              popover — indistinguishable from a dead trigger. Say so instead. */}
          {accounts.isError && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              {friendlyDbError(accounts.error)}
            </p>
          )}

          {/* ── Expense group: decides which fields the rest of the form shows ── */}
          {isExpense && (
            <div>
              <Label>{t('expense.group')}</Label>
              <Select
                value={group}
                onValueChange={(v) => setGroup(v as ExpenseGroup)}
                disabled={accounts.isLoading || availableGroups.length === 0}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t('expense.group')} />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {t(`expense.group.${g}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Amount: typed normally, derived for a salary ─────────────── */}
          {isSalary ? (
            /* Not an input — the payable amount is derived, so it recomputes as
               the three fields below change and can never be edited into
               disagreeing with them. The working is shown because a shop owner
               handing over cash wants to see where the number came from,
               especially when an advance has been taken out of it. */
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t('payroll.net')}</p>
              <p
                className={cn(
                  'text-right text-2xl font-semibold tabular-nums',
                  netSalary <= 0 && 'text-muted-foreground',
                )}
              >
                {formatMoney(netSalary, { currency: tenant.base_currency, locale })}
              </p>

              {(Number(bonusAmount) > 0 || Number(deductionAmount) > 0) && (
                <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                  {formatNumber(Number(baseAmount) || 0, 0, locale)}
                  {Number(bonusAmount) > 0 && ` + ${formatNumber(Number(bonusAmount), 0, locale)}`}
                  {Number(deductionAmount) > 0 && ` − ${formatNumber(Number(deductionAmount), 0, locale)}`}
                </p>
              )}

              {/* An advance larger than the pay is a data-entry slip, not a
                  negative wage. Saying so beats a disabled Save with no reason. */}
              {netSalary < 0 && (
                <p className="mt-1 text-right text-xs text-destructive">
                  {t('payroll.negativeNet')}
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label htmlFor="qt-amount">{t('invoice.amount')}</Label>
              <Input
                id="qt-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-14 text-right text-2xl font-semibold tabular-nums"
                autoFocus
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{tenant.base_currency}</p>
            </div>
          )}

          {/* ── Category. Hidden when the group resolved to a single account ── */}
          {!(isExpense && group && categories.length === 1) && (
            <div>
              <Label>
                {isExpense
                  ? group === 'office'
                    ? t('expense.officeType')
                    : t('expense.category')
                  : t('nav.transactions')}
              </Label>
              <AccountSelect
                value={accountId}
                onChange={setAccountId}
                options={categories}
                loading={accounts.isLoading}
                locale={locale}
                placeholder={t('expense.category')}
                emptyHint={
                  isExpense && !group ? t('expense.group') : 'စာရင်းအကောင့်မရှိပါ — စီမံခန့်ခွဲသူကို ဆက်သွယ်ပါ။'
                }
              />
            </div>
          )}

          {/* ── Salary detail ───────────────────────────────────────────── */}
          {isSalary && !canReadPayroll && (
            <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
              {t('payroll.restricted')}
            </p>
          )}

          {isSalary && canReadPayroll && (
            <div className="space-y-3 rounded-md border p-3">
              <div>
                <Label>{t('payroll.employee')}</Label>
                <Select
                  value={employeeId}
                  onValueChange={setEmployeeId}
                  disabled={employees.isLoading || !employees.data?.length}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder={t('payroll.employee')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(employees.data ?? []).map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {localized(locale, employee.name, employee.name_my)}
                        {employee.code ? ` · ${employee.code}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!employees.isLoading && !employees.data?.length && (
                  <p className="mt-1 text-xs text-muted-foreground">{t('payroll.noEmployees')}</p>
                )}
                {selectedEmployee?.position && (
                  <p className="mt-1 text-xs text-muted-foreground">{selectedEmployee.position}</p>
                )}
              </div>

              <div>
                <Label htmlFor="qt-period">{t('payroll.payPeriod')}</Label>
                <Input
                  id="qt-period"
                  type="month"
                  value={payPeriod}
                  onChange={(e) => setPayPeriod(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="qt-base" className="text-xs">{t('payroll.baseSalary')}</Label>
                  <Input
                    id="qt-base"
                    type="number"
                    inputMode="decimal"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    placeholder="0"
                    className="h-11 text-right tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="qt-bonus" className="text-xs">{t('payroll.bonus')}</Label>
                  <Input
                    id="qt-bonus"
                    type="number"
                    inputMode="decimal"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value)}
                    placeholder="0"
                    className="h-11 text-right tabular-nums"
                  />
                </div>
                <div>
                  <Label htmlFor="qt-deduct" className="text-xs" title={t('payroll.deductionHint')}>
                    {t('payroll.deduction')}
                  </Label>
                  <Input
                    id="qt-deduct"
                    type="number"
                    inputMode="decimal"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(e.target.value)}
                    placeholder="0"
                    className="h-11 text-right tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Office expense: receipt / invoice reference ──────────────── */}
          {isExpense && group === 'office' && (
            <div>
              <Label htmlFor="qt-reference">{t('expense.reference')}</Label>
              <Input
                id="qt-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-12"
                placeholder="—"
              />
            </div>
          )}

          {/* ── When & how the money moved ────────────────────────────────
              Folded away by default. Date is already today, the payment account
              already self-selects, and cash is the overwhelmingly common tender —
              so the fast path is amount → category → Save, and these only need to
              be reachable, not present. A salary always opens them, because its
              date and tender genuinely vary.

              A summary line keeps the collapsed state honest: what is hidden is
              still stated, so nothing is silently assumed on the owner's behalf. */}
          <div className="rounded-lg border border-hairline">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={detailsOpen}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-overlay-hover"
            >
              <span className="min-w-0">
                <span className="font-medium">{t('transaction.moreOptions')}</span>
                {!detailsOpen && (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {formatDate(occurredOn, locale)}
                    {' · '}
                    {localized(
                      locale,
                      PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.labelEn ?? '',
                      PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.labelMy ?? '',
                    )}
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn('size-4 shrink-0 transition-transform', detailsOpen && 'rotate-180')}
                aria-hidden
              />
            </button>

            {detailsOpen && (
              <div className="space-y-4 border-t border-hairline p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qt-date">{t('invoice.date')}</Label>
                    <Input
                      id="qt-date"
                      type="date"
                      value={occurredOn}
                      onChange={(e) => setOccurredOn(e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <div>
                    <Label>{t('pos.paymentMethod')}</Label>
                    <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {localized(locale, m.labelEn, m.labelMy)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>{t('transaction.paymentAccount')}</Label>
                  <AccountSelect
                    value={paymentAccountId}
                    onChange={setPaymentAccountId}
                    options={cashAccounts}
                    loading={accounts.isLoading}
                    locale={locale}
                    placeholder={t('transaction.paymentAccount')}
                  />
                </div>

                <div>
                  <Label htmlFor="qt-note">{t('invoice.item')}</Label>
                  <Textarea
                    id="qt-note"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Whatever this tenant added to the `transaction` entity shows
                    here. Salary detail lives in its own table, so it is skipped
                    there. CustomFieldsForm renders nothing when the tenant has
                    configured no fields, so no empty section appears. */}
                {!isSalary && (
                  <CustomFieldsForm
                    entity="transaction"
                    values={customFields}
                    onChange={setCustomFields}
                  />
                )}
              </div>
            )}
          </div>

          <Button
            size="lg"
            className="h-14 w-full text-base"
            onClick={submit}
            disabled={pending || (isSalary && !canReadPayroll)}
          >
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Shared account picker ──────────────────────────────────────────────── */

interface AccountOption {
  id: string
  name_en: string
  name_my: string | null
}

/**
 * Both the category and the payment-account picker go through here, so the
 * income and expense forms cannot drift apart in how they load, disable, or
 * report an empty list.
 *
 * The empty branch matters: Radix renders `SelectContent` with no `SelectItem`
 * children as a zero-height popover, so a trigger that is merely out of options
 * is visually identical to one whose click handler is broken. That is what the
 * "dropdown will not open" reports actually were.
 */
function AccountSelect({
  value,
  onChange,
  options,
  loading,
  locale,
  placeholder,
  emptyHint,
}: {
  value: string
  onChange: (value: string) => void
  options: AccountOption[]
  loading: boolean
  locale: Parameters<typeof localized>[0]
  placeholder: string
  emptyHint?: string
}) {
  const empty = !loading && options.length === 0

  return (
    <>
      <Select value={value} onValueChange={onChange} disabled={loading || empty}>
        <SelectTrigger className="h-12">
          {loading ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {options.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {localized(locale, account.name_en, account.name_my)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {empty && (
        <p className="mt-1 text-xs text-muted-foreground">
          {emptyHint ?? 'စာရင်းအကောင့်မရှိပါ — စီမံခန့်ခွဲသူကို ဆက်သွယ်ပါ။'}
        </p>
      )}
    </>
  )
}
