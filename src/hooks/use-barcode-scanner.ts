'use client'

import { useEffect, useRef } from 'react'

interface Options {
  onScan: (code: string) => void
  /** Scanners emit a full code in well under this window; humans never do. */
  maxKeystrokeGapMs?: number
  minLength?: number
  enabled?: boolean
}

/**
 * USB / Bluetooth barcode scanner support.
 *
 * Hardware scanners act as keyboard wedges: they type the code very fast and
 * finish with Enter. We buffer keystrokes globally and treat a burst that ends
 * in Enter as a scan — so it works on a shop counter with a USB gun and on a
 * phone paired to a Bluetooth scanner, with no driver and no permissions.
 *
 * Camera scanning is a separate component (`<CameraScanner />`) because it needs
 * a permission prompt; this hook is always on.
 */
export function useBarcodeScanner({
  onScan,
  maxKeystrokeGapMs = 60,
  minLength = 4,
  enabled = true,
}: Options) {
  const buffer = useRef('')
  const lastKeyAt = useRef(0)

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typingInField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable

      // A scanner aimed at a focused search box is fine — the field handles it.
      if (typingInField && !target?.dataset?.scannerPassthrough) return

      const now = Date.now()
      if (now - lastKeyAt.current > maxKeystrokeGapMs) buffer.current = ''
      lastKeyAt.current = now

      if (event.key === 'Enter') {
        const code = buffer.current.trim()
        buffer.current = ''
        if (code.length >= minLength) {
          event.preventDefault()
          onScan(code)
        }
        return
      }

      if (event.key.length === 1) buffer.current += event.key
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onScan, maxKeystrokeGapMs, minLength, enabled])
}
