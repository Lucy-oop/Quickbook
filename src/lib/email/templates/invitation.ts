import 'server-only'

/**
 * The invitation email.
 *
 * Written as table-based HTML with inline styles on purpose — Gmail strips
 * `<style>` blocks from forwarded mail, Outlook's Word renderer ignores flexbox
 * and `div` margins, and none of them support CSS custom properties. Anything
 * more modern renders correctly in a browser preview and falls apart in the
 * client the recipient actually uses.
 *
 * Burmese needs a font stack that resolves on the recipient's device, not ours:
 * `Padauk`/`Noto Sans Myanmar` are named first and fall back to the system UI
 * font, which on Android and iOS both render Myanmar Unicode.
 */

export interface InvitationEmailInput {
  tenantName: string
  /** Role label in English, e.g. "Cashier". */
  roleEn: string
  /** Role label in Burmese, e.g. "အရောင်းဝန်ထမ်း". */
  roleMy: string | null
  inviterName: string | null
  acceptUrl: string
  /** Used only for the "expires in" line. */
  expiresAt: Date
}

/** Escapes text interpolated into the HTML — tenant and role names are user data. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FONT =
  "'Padauk','Noto Sans Myanmar',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function invitationSubject(tenantName: string): string {
  return `${tenantName} — ဖိတ်ခေါ်လွှာ / You have been invited`
}

export function invitationHtml(input: InvitationEmailInput): string {
  const { tenantName, roleEn, roleMy, inviterName, acceptUrl, expiresAt } = input

  const role = roleMy ? `${esc(roleMy)} / ${esc(roleEn)}` : esc(roleEn)
  const store = esc(tenantName)
  const hours = Math.max(
    1,
    Math.round((expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)),
  )

  return `<!doctype html>
<html lang="my">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${store}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <!-- Preheader: the grey line clients show next to the subject. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${store} တွင် ${role} အဖြစ် အလုပ်လုပ်ရန် ဖိတ်ခေါ်ခြင်း
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 28px 8px 28px;font-family:${FONT};">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
                ဖိတ်ခေါ်လွှာ / Invitation
              </p>
              <h1 style="margin:6px 0 0 0;font-size:22px;line-height:1.5;color:#18181b;font-weight:600;">
                ${store}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:16px 28px 0 28px;font-family:${FONT};">
              <p style="margin:0 0 14px 0;font-size:15px;line-height:1.9;color:#3f3f46;">
                မင်္ဂလာပါ၊<br>
                ${inviterName ? `${esc(inviterName)} က သင်ကို ` : 'သင်ကို '}<strong>${store}</strong>
                ၏ စနစ်တွင် အလုပ်လုပ်ရန် ဖိတ်ခေါ်ထားပါသည်။
              </p>

              <!-- Role card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#f4f4f5;border-radius:8px;margin:0 0 20px 0;">
                <tr>
                  <td style="padding:14px 16px;font-family:${FONT};">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
                      ရာထူး / Role
                    </p>
                    <p style="margin:4px 0 0 0;font-size:16px;line-height:1.7;color:#18181b;font-weight:600;">
                      ${role}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA. A table-wrapped anchor, because Outlook ignores padding
                   on a bare <a> and the button collapses to a text link. -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 18px auto;">
                <tr>
                  <td align="center" bgcolor="#2a78d6" style="border-radius:8px;">
                    <a href="${acceptUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;
                              line-height:1.4;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      အကောင့်ဖွင့်ရန် / Accept invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px 0;font-size:13px;line-height:1.8;color:#71717a;">
                ဤဖိတ်ခေါ်လွှာသည် <strong>${hours} နာရီ</strong> အတွင်း သက်တမ်းကုန်ဆုံးပါမည်။
              </p>
              <p style="margin:0 0 20px 0;font-size:12px;line-height:1.8;color:#a1a1aa;word-break:break-all;">
                ခလုတ်အလုပ်မလုပ်ပါက ဤလင့်ကို ကူးယူပါ:<br>
                <span style="color:#71717a;">${esc(acceptUrl)}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 28px 26px 28px;font-family:${FONT};">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 14px 0;">
              <p style="margin:0;font-size:12px;line-height:1.8;color:#a1a1aa;">
                ဤဖိတ်ခေါ်လွှာကို သင်မမျှော်လင့်ပါက လျစ်လျူရှုနိုင်ပါသည်။<br>
                If you were not expecting this invitation you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Plain-text alternative. Without one, spam filters score the message worse. */
export function invitationText(input: InvitationEmailInput): string {
  const { tenantName, roleEn, roleMy, inviterName, acceptUrl } = input
  return [
    `${tenantName} — ဖိတ်ခေါ်လွှာ / Invitation`,
    '',
    inviterName
      ? `${inviterName} has invited you to join ${tenantName}.`
      : `You have been invited to join ${tenantName}.`,
    `ရာထူး / Role: ${roleMy ? `${roleMy} / ${roleEn}` : roleEn}`,
    '',
    'Accept your invitation:',
    acceptUrl,
    '',
    'This link expires in 48 hours.',
    'If you were not expecting this invitation you can safely ignore it.',
  ].join('\n')
}
