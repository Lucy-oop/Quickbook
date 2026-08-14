/**
 * Constants shared between the server session resolver (`lib/session.ts`, which
 * is `server-only`) and client components such as the tenant switcher.
 * Keep this file free of any server imports.
 */
export const ACTIVE_TENANT_COOKIE = 'erp_tenant'

export const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
