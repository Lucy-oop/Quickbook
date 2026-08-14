import 'server-only'

import { Resend } from 'resend'

/**
 * Outbound mail.
 *
 * Resend is the only provider wired up, but everything above this module talks
 * in terms of `SendResult`, so swapping in SendGrid or SMTP means replacing this
 * file and nothing else.
 */

export type SendResult =
  | { ok: true; id: string | null }
  /** The provider refused the recipient itself — a wrong address, not our fault. */
  | { ok: false; code: 'EMAIL_NOT_FOUND'; detail: string }
  /** Misconfiguration or provider outage — the address may be perfectly fine. */
  | { ok: false; code: 'SEND_FAILED'; detail: string }
  | { ok: false; code: 'NOT_CONFIGURED'; detail: string }

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

/**
 * Resend rejects an unusable recipient synchronously with a 422 and a message
 * naming the address; a hard bounce arrives later by webhook. Only the
 * synchronous case can be reported in the response to the owner's click, so it
 * is the one mapped to EMAIL_NOT_FOUND.
 */
const RECIPIENT_REJECTION = /invalid.*(email|recipient|to)|(email|recipient).*invalid|not a valid email|does not exist|undeliverable|suppress/i

export async function sendInvitationEmail(args: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      detail:
        'Email sending is not configured. Set RESEND_API_KEY and EMAIL_FROM in .env.local — see .env.example.',
    }
  }

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    })

    if (error) {
      const message = error.message ?? 'Unknown provider error'
      return RECIPIENT_REJECTION.test(message)
        ? { ok: false, code: 'EMAIL_NOT_FOUND', detail: message }
        : { ok: false, code: 'SEND_FAILED', detail: message }
    }

    return { ok: true, id: data?.id ?? null }
  } catch (error) {
    // Network failure, DNS failure reaching the provider, or an SDK throw.
    return {
      ok: false,
      code: 'SEND_FAILED',
      detail: error instanceof Error ? error.message : 'Could not reach the email provider.',
    }
  }
}
