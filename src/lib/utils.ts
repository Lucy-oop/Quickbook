import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Maps a PostgREST/Postgres error onto a message a shop owner can act on. */
export function friendlyDbError(error: unknown): string {
  const err = error as { code?: string; message?: string; details?: string }
  switch (err?.code) {
    case '42501':
      return 'You do not have permission to do this. Ask the business owner for access.'
    case '23505':
      return 'That value already exists. Try a different one.'
    case '23514':
      return err.message ?? 'One of the values is not valid.'
    case '23503':
      return 'This record is still linked to something else and cannot be removed.'
    case 'PGRST116':
      return 'Not found, or you do not have access to it.'
    default:
      return err?.message ?? 'Something went wrong. Please try again.'
  }
}
