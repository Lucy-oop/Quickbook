import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Banknote, BarChart3, Boxes, Coins, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { requireSession } from '@/lib/session'
import { Card, CardContent } from '@/components/ui/card'
import type { Permission } from '@/types'

export const metadata: Metadata = { title: 'Reports · Myanmar ERP' }

const REPORTS: {
  href: string
  titleMy: string
  titleEn: string
  blurb: string
  icon: typeof TrendingUp
  permission: Permission
}[] = [
  {
    href: '/reports/sales', titleMy: 'ရောင်းအားအစီရင်ခံစာ', titleEn: 'Sales Report',
    blurb: 'Gross versus net sales, and how customers actually paid.',
    icon: Receipt, permission: 'reports.sales',
  },
  {
    href: '/reports/stock-valuation', titleMy: 'ဂိုဒေါင်လက်ကျန်', titleEn: 'Stock Balance & Valuation',
    blurb: 'What is on the shelves, per warehouse, and what it is worth.',
    icon: Boxes, permission: 'reports.inventory',
  },
  {
    href: '/reports/income', titleMy: 'ဝင်ငွေ', titleEn: 'Income',
    blurb: 'Where the money came from, grouped by account.',
    icon: TrendingUp, permission: 'reports.pnl',
  },
  {
    href: '/reports/expenses', titleMy: 'အသုံးစရိတ်', titleEn: 'Expenses',
    blurb: 'Where the money went, grouped by account.',
    icon: Banknote, permission: 'reports.pnl',
  },
  {
    href: '/reports/profit-loss', titleMy: 'အမြတ်အရှုံးစာရင်း', titleEn: 'Profit & Loss',
    blurb: 'Revenue, cost of sales and expenses for any period.',
    icon: TrendingUp, permission: 'reports.pnl',
  },
  {
    href: '/reports/cash-flow', titleMy: 'ငွေစီးဆင်းမှု', titleEn: 'Cash Flow',
    blurb: 'What actually moved through your cash and bank accounts.',
    icon: Wallet, permission: 'reports.cashflow',
  },
  {
    href: '/reports/receivables', titleMy: 'ရရန်/ပေးရန်ရှိငွေ', titleEn: 'Receivables & Payables',
    blurb: 'Who owes you, who you owe, and how overdue each is.',
    icon: Coins, permission: 'reports.ar_ap',
  },
]

export default async function ReportsPage() {
  const session = await requireSession()

  // Filtered on the server so a restricted report is not even linked. The RPCs
  // refuse independently, so this is convenience rather than protection.
  const visible = REPORTS.filter(
    (report) => session.isOwner || session.permissions.includes(report.permission),
  )

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="size-5" />
        <h1 className="text-xl font-semibold tracking-tight">အစီရင်ခံစာများ / Reports</h1>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          သင့်ရာထူးတွင် အစီရင်ခံစာများ မပါဝင်ပါ။
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((report) => (
            <Link key={report.href} href={report.href}>
              <Card className="h-full transition hover:border-primary/40 hover:bg-accent">
                <CardContent className="flex h-full items-start gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <report.icon className="size-5 text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{report.titleMy}</span>
                    <span className="block text-xs text-muted-foreground">{report.titleEn}</span>
                    <span className="mt-1.5 block text-sm text-muted-foreground">{report.blurb}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
