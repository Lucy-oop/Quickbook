import type { Permission, SystemRoleKey } from '@/types'

/**
 * Pure permission evaluation, shared by the server (`lib/session.ts`) and the
 * client (`hooks/use-permission.ts`) so both agree on what a role can do.
 *
 * The database is still the enforcement point. Anything computed here only
 * decides whether a button renders.
 */
export function evaluate(
  permissions: readonly string[],
  isOwner: boolean,
  required: Permission | Permission[],
  mode: 'all' | 'any' = 'all',
): boolean {
  if (isOwner) return true
  const list = Array.isArray(required) ? required : [required]
  if (list.length === 0) return true
  return mode === 'any'
    ? list.some((p) => permissions.includes(p))
    : list.every((p) => permissions.includes(p))
}

/** Human-facing role metadata used by the team-management screens. */
export const ROLE_PRESETS: Record<
  SystemRoleKey,
  { labelEn: string; labelMy: string; blurbEn: string; blurbMy: string; tone: string }
> = {
  owner: {
    labelEn: 'Owner',
    labelMy: 'ပိုင်ရှင်',
    blurbEn: 'Full control, including billing and deleting the business.',
    blurbMy: 'အားလုံးကို ထိန်းချုပ်နိုင်သည်။',
    tone: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  admin: {
    labelEn: 'Admin',
    labelMy: 'စီမံခန့်ခွဲသူ',
    blurbEn: 'Everything the owner can do, except transferring ownership.',
    blurbMy: 'ပိုင်ဆိုင်မှုလွှဲပြောင်းခြင်းမှလွဲ၍ အားလုံးလုပ်နိုင်သည်။',
    tone: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  },
  manager: {
    labelEn: 'Manager',
    labelMy: 'မန်နေဂျာ',
    blurbEn: 'Sales, stock and reports. No business settings or role changes.',
    blurbMy: 'ရောင်းအား၊ ကုန်ပစ္စည်းနှင့် အစီရင်ခံစာများ။',
    tone: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  },
  accountant: {
    labelEn: 'Accountant',
    labelMy: 'စာရင်းကိုင်',
    blurbEn: 'Full books and financial reports. No inventory operations.',
    blurbMy: 'ငွေစာရင်းအပြည့်အစုံ ကိုင်တွယ်နိုင်သည်။',
    tone: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  cashier: {
    labelEn: 'Cashier',
    labelMy: 'ငွေကိုင်',
    blurbEn: 'POS and their own daily sales only. Cannot see profit or cost.',
    blurbMy: 'POS နှင့် မိမိရောင်းအားသာ။ အမြတ်နှင့်အရင်းမမြင်ရပါ။',
    tone: 'bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-200',
  },
  viewer: {
    labelEn: 'Viewer',
    labelMy: 'ကြည့်ရှုသူ',
    blurbEn: 'Read-only access to day-to-day data.',
    blurbMy: 'ကြည့်ရှုရုံသာ ခွင့်ပြုသည်။',
    tone: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-200',
  },
}

/** Permissions grouped for the role editor UI. */
export const PERMISSION_MODULES: { module: string; labelEn: string; labelMy: string }[] = [
  { module: 'dashboard', labelEn: 'Dashboard', labelMy: 'ဒက်ရှ်ဘုတ်' },
  { module: 'pos', labelEn: 'Point of Sale', labelMy: 'အရောင်းစနစ်' },
  { module: 'sales', labelEn: 'Sales & Invoices', labelMy: 'အရောင်းနှင့်ပြေစာ' },
  { module: 'finance', labelEn: 'Finance', labelMy: 'ငွေကြေး' },
  { module: 'inventory', labelEn: 'Inventory', labelMy: 'ကုန်ပစ္စည်း' },
  { module: 'crm', labelEn: 'Customers', labelMy: 'ဖောက်သည်' },
  { module: 'reports', labelEn: 'Reports', labelMy: 'အစီရင်ခံစာ' },
  { module: 'team', labelEn: 'Team', labelMy: 'အဖွဲ့သား' },
  { module: 'settings', labelEn: 'Settings', labelMy: 'ဆက်တင်' },
  { module: 'security', labelEn: 'Security', labelMy: 'လုံခြုံရေး' },
]

/** Route → permission map consumed by the sidebar and by middleware. */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/dashboard': 'dashboard.view',
  '/pos': 'pos.use',
  '/invoices': 'invoices.read_own',
  '/transactions': 'transactions.read_own',
  '/products': 'products.read',
  '/inventory': 'inventory.read',
  '/contacts': 'contacts.read',
  '/reports/profit-loss': 'reports.pnl',
  '/reports/cash-flow': 'reports.cashflow',
  '/reports/receivables': 'reports.ar_ap',
  '/reports/sales': 'reports.sales',
  '/settings': 'settings.manage',
  '/settings/custom-fields': 'settings.custom_fields',
  '/settings/team': 'members.read',
  '/settings/activity': 'audit.read',
}
