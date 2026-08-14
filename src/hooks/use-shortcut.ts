'use client'

import { useEffect, useState, type RefObject } from 'react'

/**
 * Keyboard shortcuts for the screens a shop runs all day.
 *
 * Handlers are skipped while the user is typing in a field, except for the
 * explicitly allowed combinations — otherwise pressing `n` in a product name
 * would fire "new sale" mid-word.
 */

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Focus-and-select an input on ⌘K / Ctrl+K.
 *
 * Registered with `capture` so it wins over the browser's own bindings, and
 * `preventDefault` stops Chrome opening its address-bar search.
 */
export function useSearchShortcut(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      ref.current?.focus()
      ref.current?.select()
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [ref])
}

/**
 * A bare function key (F2, Escape, …). Bare letters are deliberately not
 * supported here — see `isTypingTarget`.
 */
export function useKeyShortcut(
  key: string,
  handler: (() => void) | undefined,
  options: { allowWhileTyping?: boolean; enabled?: boolean } = {},
) {
  const { allowWhileTyping = false, enabled = true } = options

  useEffect(() => {
    if (!enabled || !handler) return

    const listener = (event: KeyboardEvent) => {
      if (event.key !== key) return
      if (!allowWhileTyping && isTypingTarget(event.target)) return
      event.preventDefault()
      handler()
    }

    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [key, handler, allowWhileTyping, enabled])
}

/**
 * '⌘' on Apple hardware, 'Ctrl' everywhere else.
 *
 * Resolved after mount, not during render: `navigator` does not exist on the
 * server, and guessing wrong would make the first paint disagree with the
 * client and trip a hydration mismatch. Starts as 'Ctrl' so the hint has a
 * sensible width before it settles.
 */
export function useShortcutKey(): string {
  const [key, setKey] = useState('Ctrl ')

  useEffect(() => {
    const apple = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
      || /Mac/.test(navigator.userAgent)
    setKey(apple ? '⌘' : 'Ctrl ')
  }, [])

  return key
}
