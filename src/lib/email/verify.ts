import 'server-only'

import { promises as dns } from 'node:dns'
import { z } from 'zod'

/**
 * Recipient verification, in increasing order of cost.
 *
 * What this can and cannot prove is worth being honest about: DNS tells you the
 * *domain* can receive mail. Nothing short of delivery tells you the *mailbox*
 * exists — SMTP `RCPT TO` probing is unreliable (catch-all domains accept
 * everything, most providers greylist or blocklist probers, and Vercel blocks
 * outbound port 25 anyway). So this rejects the failure the boss actually makes
 * — a typo in the domain, `gmial.com`, `yaho.com` — and leaves genuine unknown
 * mailboxes to be reported as a bounce by the provider afterwards.
 *
 * Erring toward acceptance is deliberate: refusing to invite a real colleague is
 * worse than sending a mail that bounces.
 */

export const inviteEmailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254) // RFC 5321 §4.5.3.1
  .email()
  // A trailing dot is legal in DNS but not in an address, and it slips past the
  // usual regexes.
  .refine((value) => !value.endsWith('.'), 'Address cannot end with a dot')

export type VerifyResult =
  | { ok: true; normalized: string }
  | { ok: false; code: 'INVALID_SYNTAX' | 'EMAIL_NOT_FOUND'; detail: string }

/** Domains that resolve but are known throwaways — invitations to these never reach a colleague. */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'trashmail.com',
  'sharklasers.com', 'getnada.com', 'maildrop.cc', 'fakeinbox.com',
])

/**
 * Common typos of the providers Myanmar SMEs actually use. These resolve to
 * nothing, so the MX check would catch them anyway — naming them turns a generic
 * "domain unreachable" into a message the owner can act on.
 */
const TYPO_DOMAINS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
  'outllook.com': 'outlook.com',
}

export async function verifyEmailDeliverable(input: string): Promise<VerifyResult> {
  const parsed = inviteEmailSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: 'INVALID_SYNTAX', detail: 'Malformed email address.' }
  }

  const normalized = parsed.data.toLowerCase()
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1)

  const suggestion = TYPO_DOMAINS[domain]
  if (suggestion) {
    return {
      ok: false,
      code: 'EMAIL_NOT_FOUND',
      detail: `"${domain}" looks like a typo — did you mean "${suggestion}"?`,
    }
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, code: 'EMAIL_NOT_FOUND', detail: 'Disposable email addresses are not accepted.' }
  }

  return (await domainAcceptsMail(domain))
    ? { ok: true, normalized }
    : { ok: false, code: 'EMAIL_NOT_FOUND', detail: `No mail server found for "${domain}".` }
}

/**
 * True when the domain has somewhere to deliver to.
 *
 * A domain with no MX but with an A/AAAA record is still a valid destination —
 * RFC 5321 §5.1 says the address record is the implicit mail exchanger — so
 * checking MX alone would wrongly reject small self-hosted domains.
 */
async function domainAcceptsMail(domain: string): Promise<boolean> {
  try {
    const mx = await dns.resolveMx(domain)
    // A single "." target is the RFC 7505 null MX: the domain states explicitly
    // that it accepts no mail.
    const usable = mx.filter((record) => record.exchange && record.exchange !== '.')
    if (usable.length > 0) return true
  } catch {
    // ENOTFOUND / ENODATA both fall through to the A-record check below.
  }

  try {
    await dns.resolve4(domain)
    return true
  } catch {
    // Fall through.
  }

  try {
    await dns.resolve6(domain)
    return true
  } catch {
    return false
  }
}
