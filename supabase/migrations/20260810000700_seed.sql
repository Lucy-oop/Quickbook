-- =============================================================================
--  Myanmar Universal ERP — 0007 GLOBAL SEED
--  Currencies, the permission catalogue, and the system role templates that
--  public.create_tenant() clones for every new business.
-- =============================================================================

insert into public.currencies (code, name, name_my, symbol, decimal_digits) values
  ('MMK', 'Myanmar Kyat',   'မြန်မာကျပ်',      'K',  0),
  ('THB', 'Thai Baht',      'ထိုင်းဘတ်',        '฿',  2),
  ('USD', 'US Dollar',      'အမေရိကန်ဒေါ်လာ',  '$',  2),
  ('SGD', 'Singapore Dollar','စင်္ကာပူဒေါ်လာ',  'S$', 2),
  ('CNY', 'Chinese Yuan',   'တရုတ်ယွမ်',        '¥',  2),
  ('EUR', 'Euro',           'ယူရို',            '€',  2)
on conflict (code) do update
  set name = excluded.name, name_my = excluded.name_my,
      symbol = excluded.symbol, decimal_digits = excluded.decimal_digits;

-- -----------------------------------------------------------------------------
-- PERMISSION CATALOGUE
-- -----------------------------------------------------------------------------
insert into public.permissions (key, module, label_en, label_my, is_sensitive) values
  ('dashboard.view',            'dashboard', 'View dashboard',              'ဒက်ရှ်ဘုတ်ကြည့်ရန်',            false),

  ('members.read',              'team',      'View team members',           'ဝန်ထမ်းများကြည့်ရန်',           false),
  ('members.invite',            'team',      'Invite team members',         'ဝန်ထမ်းဖိတ်ခေါ်ရန်',            true),
  ('members.manage',            'team',      'Manage roles & access',       'အခန်းကဏ္ဍစီမံရန်',              true),

  ('settings.manage',           'settings',  'Manage business settings',    'လုပ်ငန်းဆက်တင်စီမံရန်',         true),
  ('settings.custom_fields',    'settings',  'Manage custom fields',        'စိတ်ကြိုက်အကွက်များစီမံရန်',    false),
  ('currency.manage',           'settings',  'Manage exchange rates',       'ငွေလဲနှုန်းစီမံရန်',            false),

  ('accounts.read',             'finance',   'View chart of accounts',      'စာရင်းအကောင့်များကြည့်ရန်',     false),
  ('accounts.manage',           'finance',   'Manage chart of accounts',    'စာရင်းအကောင့်များစီမံရန်',      true),

  ('transactions.create',       'finance',   'Record income & expenses',    'ဝင်ငွေ/ထွက်ငွေမှတ်တမ်းတင်ရန်',  false),
  ('transactions.read',         'finance',   'View all transactions',       'ငွေစာရင်းအားလုံးကြည့်ရန်',      true),
  ('transactions.read_own',     'finance',   'View own transactions',       'မိမိမှတ်တမ်းများကြည့်ရန်',       false),
  ('transactions.update',       'finance',   'Edit any transaction',        'ငွေစာရင်းပြင်ဆင်ရန်',           true),
  ('transactions.update_own',   'finance',   'Edit own recent entries',     'မိမိမှတ်တမ်းပြင်ဆင်ရန်',        false),
  ('transactions.delete',       'finance',   'Delete transactions',         'ငွေစာရင်းဖျက်ရန်',              true),

  ('invoices.create',           'sales',     'Create invoices',             'ငွေတောင်းခံလွှာဖန်တီးရန်',      false),
  ('invoices.read',             'sales',     'View all invoices',           'ပြေစာအားလုံးကြည့်ရန်',          false),
  ('invoices.read_own',         'sales',     'View own invoices',           'မိမိပြေစာများကြည့်ရန်',         false),
  ('invoices.update',           'sales',     'Edit issued invoices',        'ပြေစာပြင်ဆင်ရန်',               true),
  ('invoices.delete',           'sales',     'Delete draft invoices',       'မူကြမ်းပြေစာဖျက်ရန်',           true),
  ('invoices.void',             'sales',     'Void invoices',               'ပြေစာပယ်ဖျက်ရန်',               true),

  ('payments.create',           'sales',     'Record payments',             'ငွေပေးချေမှုမှတ်ရန်',           false),
  ('payments.read',             'sales',     'View all payments',           'ငွေပေးချေမှုကြည့်ရန်',          false),
  ('payments.manage',           'sales',     'Edit or delete payments',     'ငွေပေးချေမှုစီမံရန်',           true),

  ('contacts.read',             'crm',       'View customers & suppliers',  'ဖောက်သည်/ပေးသွင်းသူကြည့်ရန်',   false),
  ('contacts.manage',           'crm',       'Add & edit contacts',         'ဖောက်သည်စီမံရန်',               false),
  ('contacts.delete',           'crm',       'Delete contacts',             'ဖောက်သည်ဖျက်ရန်',               true),

  ('products.read',             'inventory', 'View products',               'ကုန်ပစ္စည်းကြည့်ရန်',            false),
  ('products.read_cost',        'inventory', 'View cost prices',            'အရင်းဈေးနှုန်းကြည့်ရန်',        true),
  ('products.manage',           'inventory', 'Add & edit products',         'ကုန်ပစ္စည်းစီမံရန်',             false),
  ('products.delete',           'inventory', 'Delete products',             'ကုန်ပစ္စည်းဖျက်ရန်',             true),

  ('inventory.read',            'inventory', 'View stock levels',           'ကုန်လက်ကျန်ကြည့်ရန်',            false),
  ('inventory.adjust',          'inventory', 'Stock in / out / adjust',     'ကုန်ဝင်/ထွက်ပြုလုပ်ရန်',         false),
  ('inventory.manage_locations','inventory', 'Manage warehouses',           'ဂိုဒေါင်များစီမံရန်',            true),

  ('reports.sales',             'reports',   'Sales reports',               'ရောင်းအားအစီရင်ခံစာ',           false),
  ('reports.pnl',               'reports',   'Profit & Loss',               'အမြတ်အရှုံးစာရင်း',             true),
  ('reports.margin',            'reports',   'Gross margin & cost',         'အမြတ်နှုန်းကြည့်ရန်',           true),
  ('reports.cashflow',          'reports',   'Cash flow',                   'ငွေစီးဆင်းမှု',                 true),
  ('reports.ar_ap',             'reports',   'Receivables & payables',      'ရရန်/ပေးရန်ရှိငွေ',             true),
  ('reports.inventory',         'reports',   'Inventory reports',           'ကုန်ပစ္စည်းအစီရင်ခံစာ',         false),

  ('pos.use',                   'pos',       'Use the POS terminal',        'POS စက်သုံးရန်',                false),
  ('audit.read',                'security',  'View activity log',           'လုပ်ဆောင်မှုမှတ်တမ်းကြည့်ရန်',   true)
on conflict (key) do update
  set module = excluded.module, label_en = excluded.label_en,
      label_my = excluded.label_my, is_sensitive = excluded.is_sensitive;

-- -----------------------------------------------------------------------------
-- SYSTEM ROLE TEMPLATES (tenant_id is null)
-- -----------------------------------------------------------------------------
insert into public.roles (id, tenant_id, key, name_en, name_my, description, is_system, is_owner_role, rank) values
  ('00000000-0000-0000-0000-0000000000a1', null, 'owner',      'Owner',      'ပိုင်ရှင်',      'Full control including billing and deletion.',        true, true,  10),
  ('00000000-0000-0000-0000-0000000000a2', null, 'admin',      'Admin',      'စီမံခန့်ခွဲသူ',  'Everything except transferring ownership.',           true, false, 20),
  ('00000000-0000-0000-0000-0000000000a3', null, 'manager',    'Manager',    'မန်နေဂျာ',      'Runs day-to-day sales, stock and staff oversight.',   true, false, 30),
  ('00000000-0000-0000-0000-0000000000a4', null, 'accountant', 'Accountant', 'စာရင်းကိုင်',    'Full finance access, no inventory or settings.',      true, false, 40),
  ('00000000-0000-0000-0000-0000000000a5', null, 'cashier',    'Cashier',    'ငွေကိုင်',       'POS and daily sales only. No profit visibility.',     true, false, 50),
  ('00000000-0000-0000-0000-0000000000a6', null, 'viewer',     'Viewer',     'ကြည့်ရှုသူ',     'Read-only access to operational data.',               true, false, 60)
on conflict (id) do update
  set name_en = excluded.name_en, name_my = excluded.name_my,
      description = excluded.description, rank = excluded.rank;

-- Owner bypasses permission checks (roles.is_owner_role), but we still attach
-- the full set so the UI can render its permission matrix consistently.
delete from public.roles_permissions
 where role_id in (
   '00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000a4',
   '00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000a6');

-- OWNER + ADMIN: everything
insert into public.roles_permissions (role_id, permission_key)
select r.id, p.key
  from public.roles r cross join public.permissions p
 where r.id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2');

-- MANAGER: full operations + reporting, but not tenant settings or team roles
insert into public.roles_permissions (role_id, permission_key)
select '00000000-0000-0000-0000-0000000000a3', key from public.permissions
 where key in (
  'dashboard.view','members.read','settings.custom_fields','currency.manage',
  'accounts.read',
  'transactions.create','transactions.read','transactions.read_own','transactions.update','transactions.update_own',
  'invoices.create','invoices.read','invoices.read_own','invoices.update','invoices.void',
  'payments.create','payments.read','payments.manage',
  'contacts.read','contacts.manage',
  'products.read','products.read_cost','products.manage',
  'inventory.read','inventory.adjust',
  'reports.sales','reports.pnl','reports.margin','reports.ar_ap','reports.inventory',
  'pos.use'
);

-- ACCOUNTANT: the books, all of them; nothing operational
insert into public.roles_permissions (role_id, permission_key)
select '00000000-0000-0000-0000-0000000000a4', key from public.permissions
 where key in (
  'dashboard.view','currency.manage',
  'accounts.read','accounts.manage',
  'transactions.create','transactions.read','transactions.read_own','transactions.update',
  'invoices.read','invoices.create','payments.create','payments.read','payments.manage',
  'contacts.read','contacts.manage',
  'products.read','products.read_cost','inventory.read',
  'reports.sales','reports.pnl','reports.margin','reports.cashflow','reports.ar_ap','reports.inventory',
  'audit.read'
);

-- CASHIER: ring up sales, see only their own paperwork.
-- Deliberately excludes products.read_cost, reports.pnl, reports.margin and
-- transactions.read — the whole point of the role.
insert into public.roles_permissions (role_id, permission_key)
select '00000000-0000-0000-0000-0000000000a5', key from public.permissions
 where key in (
  'dashboard.view','pos.use',
  'transactions.create','transactions.read_own','transactions.update_own',
  'invoices.create','invoices.read_own',
  'payments.create',
  'contacts.read','contacts.manage',
  'products.read','inventory.read'
);

-- VIEWER: read-only operations
insert into public.roles_permissions (role_id, permission_key)
select '00000000-0000-0000-0000-0000000000a6', key from public.permissions
 where key in (
  'dashboard.view','invoices.read','contacts.read','products.read','inventory.read',
  'transactions.read_own','reports.sales','reports.inventory'
);

-- -----------------------------------------------------------------------------
-- AUTH HOOK — provision public.users and claim pending invites on sign-up
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_auth_user();
