'use client'

import { useState } from 'react'
import {
  AlertCircle, Ban, Loader2, MoreVertical, RotateCcw, ShieldCheck, SlidersHorizontal, UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

import {
  InviteError, useInviteByEmail, useInviteMember, usePermissionCatalogue, useSetMemberStatus,
  useTeamMembers, useTenantRoles, useUpdateMember, type TeamMember,
} from '@/hooks/use-team'
import { usePermission } from '@/hooks/use-permission'
import { useSession } from '@/components/providers/session-provider'
import { useI18n, localized } from '@/lib/i18n'
import { ROLE_PRESETS, PERMISSION_MODULES } from '@/lib/permissions'
import type { SystemRoleKey } from '@/types'
import { cn, friendlyDbError } from '@/lib/utils'

/**
 * Sub-account management.
 *
 * Every mutation here goes through an RPC or an RLS-guarded update, so this
 * screen can be rendered to a manager (who has `members.read` but not
 * `members.manage`) without leaking a way to escalate: the buttons are hidden,
 * and the database refuses anyway.
 */
export function TeamManager() {
  const { t, locale } = useI18n()
  const { isOwner } = useSession()
  const { can } = usePermission()

  const members = useTeamMembers()
  const roles = useTenantRoles()
  const setStatus = useSetMemberStatus()

  const canManage = can('members.manage')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('nav.team')}</h1>
          <p className="text-sm text-muted-foreground">
            ဝန်ထမ်းအကောင့်များ ဖန်တီးပြီး ရာထူးအလိုက် ခွင့်ပြုချက်သတ်မှတ်ပါ
          </p>
        </div>
        {can('members.invite') && <InviteDialog />}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            အဖွဲ့သားများ {members.data ? `(${members.data.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <ul className="divide-y">
              {(members.data ?? []).map((member) => (
                <li key={member.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {initials(member)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.user?.full_name ?? member.invited_email ?? member.invited_phone ?? '—'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user?.email ?? member.user?.phone ?? member.invited_email ?? member.invited_phone}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <RoleBadge roleKey={member.role?.key} locale={locale} />
                    <StatusBadge status={member.status} />

                    {canManage && !member.role?.is_owner_role && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-9" aria-label="Actions">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <PermissionOverrideDialog member={member} />
                          {member.status === 'active' ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                setStatus.mutate(
                                  { membershipId: member.id, status: 'suspended' },
                                  { onError: (e) => toast.error(friendlyDbError(e)) },
                                )
                              }
                            >
                              <Ban className="size-4" />
                              ခေတ္တရပ်ဆိုင်းမည်
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() =>
                                setStatus.mutate(
                                  { membershipId: member.id, status: 'active' },
                                  { onError: (e) => toast.error(friendlyDbError(e)) },
                                )
                              }
                            >
                              <RotateCcw className="size-4" />
                              ပြန်ဖွင့်မည်
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() =>
                              setStatus.mutate(
                                { membershipId: member.id, status: 'revoked' },
                                {
                                  onSuccess: () => toast.success('ခွင့်ပြုချက် ရုပ်သိမ်းပြီး'),
                                  onError: (e) => toast.error(friendlyDbError(e)),
                                },
                              )
                            }
                          >
                            <Ban className="size-4" />
                            အပြီးရုပ်သိမ်းမည်
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Role reference so an owner can see what each preset actually allows. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            ရာထူးများ
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {(roles.data ?? []).map((role) => {
            const preset = ROLE_PRESETS[role.key as SystemRoleKey]
            return (
              <div key={role.id} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', preset?.tone)}>
                    {localized(locale, role.name_en, role.name_my)}
                  </span>
                  {role.is_owner_role && <Badge variant="outline" className="text-[10px]">full access</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {locale === 'my' ? preset?.blurbMy : preset?.blurbEn ?? role.description}
                </p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {!isOwner && !canManage && (
        <p className="text-center text-xs text-muted-foreground">
          ရာထူးပြောင်းလဲရန် ပိုင်ရှင်ထံ ဆက်သွယ်ပါ
        </p>
      )}
    </div>
  )
}

/* ── Invite ───────────────────────────────────────────────────────────── */

function InviteDialog() {
  const { locale } = useI18n()
  const { isOwner } = useSession()
  const roles = useTenantRoles()
  const invitePhone = useInviteMember()
  const inviteEmail = useInviteByEmail()

  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<'phone' | 'email'>('email')
  const [fullName, setFullName] = useState('')
  const [contact, setContact] = useState('')
  const [roleKey, setRoleKey] = useState('cashier')

  // A bad address is a blocking problem — the boss has to retype it — so it gets
  // a dialog rather than a toast that disappears while they are reading it.
  const [failure, setFailure] = useState<InviteError | null>(null)

  const pending = invitePhone.isPending || inviteEmail.isPending

  const reset = () => {
    setFullName('')
    setContact('')
  }

  const submit = async () => {
    if (method === 'email') {
      try {
        const result = await inviteEmail.mutateAsync({
          email: contact,
          roleKey,
          fullName: fullName || undefined,
        })
        toast.success(result.message, {
          description: result.emailSent ? contact : undefined,
        })
        reset()
        setOpen(false)
      } catch (error) {
        if (error instanceof InviteError) {
          // Duplicates are the user's own doing and self-explanatory; a toast is
          // proportionate. Everything else gets the dialog.
          if (error.code === 'ALREADY_MEMBER' || error.code === 'ALREADY_INVITED') {
            toast.error(error.message)
          } else {
            setFailure(error)
          }
        } else {
          toast.error(friendlyDbError(error))
        }
      }
      return
    }

    try {
      await invitePhone.mutateAsync({ roleKey, phone: contact, email: null })
      toast.success('ဖိတ်ခေါ်ပြီးပါပြီ', {
        description: 'They will join automatically when they sign up with this number.',
      })
      reset()
      setOpen(false)
    } catch (error) {
      toast.error(friendlyDbError(error))
    }
  }

  // Only an owner may hand out the owner role; the RPC enforces this too.
  const assignable = (roles.data ?? []).filter((r) => isOwner || !r.is_owner_role)

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <UserPlus className="size-4" />
            ဝန်ထမ်းထည့်မည်
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ဝန်ထမ်းဖိတ်ခေါ်ရန်</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={method === 'email' ? 'default' : 'outline'}
                className="h-11"
                disabled={pending}
                onClick={() => setMethod('email')}
              >
                Email
              </Button>
              <Button
                type="button"
                variant={method === 'phone' ? 'default' : 'outline'}
                className="h-11"
                disabled={pending}
                onClick={() => setMethod('phone')}
              >
                ဖုန်း
              </Button>
            </div>

            <div>
              <Label htmlFor="invite-name">ဝန်ထမ်းအမည် / Staff name</Label>
              <Input
                id="invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12"
                disabled={pending}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="invite-contact">
                {method === 'phone' ? 'ဖုန်းနံပါတ်' : 'အီးမေးလ် / Email'}
              </Label>
              <Input
                id="invite-contact"
                type={method === 'phone' ? 'tel' : 'email'}
                inputMode={method === 'phone' ? 'tel' : 'email'}
                autoComplete="off"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="h-12"
                disabled={pending}
              />
            </div>

            <div>
              <Label>ရာထူး</Label>
              <Select value={roleKey} onValueChange={setRoleKey} disabled={pending}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignable.map((role) => (
                    <SelectItem key={role.id} value={role.key}>
                      {localized(locale, role.name_en, role.name_my)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {locale === 'my'
                  ? ROLE_PRESETS[roleKey as SystemRoleKey]?.blurbMy
                  : ROLE_PRESETS[roleKey as SystemRoleKey]?.blurbEn}
              </p>
            </div>

            <Button
              size="lg"
              className="h-12 w-full"
              disabled={!contact.trim() || pending}
              onClick={submit}
            >
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {pending && method === 'email'
                ? 'အီးမေးလ် စစ်ဆေးပြီး ပို့ဆောင်နေပါသည်...'
                : method === 'email'
                  ? 'ပို့မည် / Send invite'
                  : 'ဖိတ်ခေါ်မည်'}
            </Button>

            {method === 'email' && (
              <p className="text-center text-xs text-muted-foreground">
                ဖိတ်ခေါ်လွှာ လင့်ခ်သည် ၄၈ နာရီအတွင်း သက်တမ်းကုန်ဆုံးပါမည်။
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <InviteFailureDialog failure={failure} onClose={() => setFailure(null)} />
    </>
  )
}

/**
 * The blocking error popup.
 *
 * `EMAIL_NOT_FOUND` gets its own wording because it is the only case the owner
 * can fix by retyping. A provider outage or a missing API key is not their
 * mistake, and telling them to check the spelling would send them hunting for a
 * typo that is not there.
 */
function InviteFailureDialog({
  failure,
  onClose,
}: {
  failure: InviteError | null
  onClose: () => void
}) {
  const addressProblem = failure?.code === 'EMAIL_NOT_FOUND' || failure?.code === 'INVALID_SYNTAX'

  return (
    <Dialog open={!!failure} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md" role="alertdialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5 shrink-0" />
            {addressProblem ? 'အီးမေးလ် မှားယွင်းနေပါသည်' : 'ဖိတ်ခေါ်လွှာ ပို့၍ မရပါ'}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-muted-foreground">
          {addressProblem
            ? 'ထည့်သွင်းထားသော အီးမေးလ်လိပ်စာသို့ စာပို့၍ မရပါ (Email does not exist or domain is unreachable)။ ကျေးဇူးပြု၍ စာလုံးပေါင်းနှင့် အီးမေးလ်ကို ပြန်လည်စစ်ဆေးပါ။'
            : failure?.message}
        </p>

        {/* The provider's own wording, kept out of the main message but available
            — it is what makes a support conversation short. */}
        {failure?.detail && (
          <p className="rounded-md bg-muted p-2 font-mono text-xs leading-relaxed text-muted-foreground">
            {failure.detail}
          </p>
        )}

        <Button className="h-12 w-full" onClick={onClose}>
          ပြန်စစ်ဆေးမည် / Check again
        </Button>
      </DialogContent>
    </Dialog>
  )
}

/* ── Per-user permission overrides ────────────────────────────────────── */

function PermissionOverrideDialog({ member }: { member: TeamMember }) {
  const { locale } = useI18n()
  const catalogue = usePermissionCatalogue()
  const update = useUpdateMember()
  const [open, setOpen] = useState(false)

  const overrides = member.permission_overrides ?? { granted: [], revoked: [] }
  const [granted, setGranted] = useState<string[]>(overrides.granted ?? [])
  const [revoked, setRevoked] = useState<string[]>(overrides.revoked ?? [])

  const toggle = (key: string, mode: 'grant' | 'revoke') => {
    if (mode === 'grant') {
      setGranted((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
      setRevoked((prev) => prev.filter((k) => k !== key))
    } else {
      setRevoked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
      setGranted((prev) => prev.filter((k) => k !== key))
    }
  }

  const save = async () => {
    try {
      await update.mutateAsync({ membershipId: member.id, overrides: { granted, revoked } })
      toast.success('ခွင့်ပြုချက် သိမ်းပြီး')
      setOpen(false)
    } catch (error) {
      toast.error(friendlyDbError(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <SlidersHorizontal className="size-4" />
          ခွင့်ပြုချက်ပြင်မည်
        </DropdownMenuItem>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {member.user?.full_name ?? member.invited_email} — ခွင့်ပြုချက်
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          ရာထူးအပေါ်တွင် ထပ်ဆောင်းခွင့်ပြုချက် သို့မဟုတ် ကန့်သတ်ချက် သတ်မှတ်နိုင်သည်။
          <span className="mt-1 block">
            A revoke beats the role; an explicit grant beats the revoke. Everything else falls back to the role.
          </span>
        </p>

        <div className="space-y-4">
          {PERMISSION_MODULES.map((module) => {
            const items = (catalogue.data ?? []).filter((p) => p.module === module.module)
            if (!items.length) return null

            return (
              <div key={module.module}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {locale === 'my' ? module.labelMy : module.labelEn}
                </p>
                <div className="space-y-1.5">
                  {items.map((permission) => (
                    <div key={permission.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {localized(locale, permission.label_en, permission.label_my)}
                        </p>
                        {permission.is_sensitive && (
                          <Badge variant="outline" className="mt-0.5 text-[10px]">sensitive</Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          ခွင့်ပြု
                          <Switch
                            checked={granted.includes(permission.key)}
                            onCheckedChange={() => toggle(permission.key, 'grant')}
                          />
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          ပိတ်
                          <Switch
                            checked={revoked.includes(permission.key)}
                            onCheckedChange={() => toggle(permission.key, 'revoke')}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        <Button size="lg" className="h-12 w-full" onClick={save} disabled={update.isPending}>
          {update.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          သိမ်းမည်
        </Button>
      </DialogContent>
    </Dialog>
  )
}

/* ── Small pieces ─────────────────────────────────────────────────────── */

function RoleBadge({ roleKey, locale }: { roleKey?: string; locale: 'en' | 'my' }) {
  const preset = ROLE_PRESETS[roleKey as SystemRoleKey]
  if (!preset) return null
  return (
    <span className={cn('hidden rounded px-2 py-1 text-xs font-medium sm:inline', preset.tone)}>
      {locale === 'my' ? preset.labelMy : preset.labelEn}
    </span>
  )
}

function StatusBadge({ status }: { status: TeamMember['status'] }) {
  const map = {
    active: { label: 'Active', variant: 'success' as const },
    // Info, not outline: a pending invitation is a state worth noticing, but it
    // is not a problem, so it must not borrow the warning or danger tint.
    invited: { label: 'Invited', variant: 'info' as const },
    suspended: { label: 'Suspended', variant: 'warning' as const },
    revoked: { label: 'Revoked', variant: 'danger' as const },
  }
  const item = map[status]
  return <Badge variant={item.variant} className="text-[10px]">{item.label}</Badge>
}

function initials(member: TeamMember): string {
  const source = member.user?.full_name ?? member.invited_email ?? member.invited_phone ?? '?'
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
