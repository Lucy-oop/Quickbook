'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'

/**
 * `BarcodeDetector` is a browser API, not a DOM lib type yet, so declare the
 * slice we use rather than pulling in a polyfill's types.
 */
interface DetectedBarcode {
  rawValue: string
  format: string
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorLike
      getSupportedFormats: () => Promise<string[]>
    }
  }
}

/** Formats that actually turn up on Myanmar shelves and phone boxes. */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (code: string) => void
  /** Keep scanning after a hit — useful for stocking in a whole carton. */
  continuous?: boolean
}

/**
 * Phone-camera barcode scanning.
 *
 * Uses the native `BarcodeDetector` where available (Chrome/Edge on Android,
 * Safari 17+), which is the common case for the cheap Android handsets these
 * shops actually use. Where it is missing, the component says so plainly and
 * points at the USB-scanner path rather than silently doing nothing — see
 * `useBarcodeScanner`, which needs no permissions and always works.
 *
 * The camera stream is torn down on close, on unmount, and when the tab is
 * hidden: leaving it live drains a phone battery fast.
 */
export function CameraScanner({ open, onOpenChange, onScan, continuous = false }: Props) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastCodeRef = useRef<{ value: string; at: number } | null>(null)

  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const start = useCallback(async () => {
    if (typeof window === 'undefined') return

    if (!window.BarcodeDetector) {
      setStatus('unsupported')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }

    setStatus('starting')

    try {
      const supported = await window.BarcodeDetector.getSupportedFormats()
      const formats = FORMATS.filter((format) => supported.includes(format))
      const detector = new window.BarcodeDetector(formats.length ? { formats } : undefined)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // Rear camera, and a resolution high enough to resolve a thin EAN-13
          // without pushing decode cost up on a low-end chip.
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      const video = videoRef.current
      if (!video) return

      video.srcObject = stream
      await video.play()
      setStatus('scanning')

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }

        try {
          const results = await detector.detect(videoRef.current)
          const hit = results[0]?.rawValue?.trim()

          if (hit) {
            const now = Date.now()
            const last = lastCodeRef.current
            // Debounce: a barcode held in frame fires every animation frame.
            const isRepeat = last?.value === hit && now - last.at < 1500

            if (!isRepeat) {
              lastCodeRef.current = { value: hit, at: now }
              navigator.vibrate?.(40)
              onScan(hit)
              if (!continuous) {
                stop()
                onOpenChange(false)
                return
              }
            }
          }
        } catch {
          // A single failed frame is normal (motion blur, bad focus) — keep going.
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    } catch (error) {
      const name = (error as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied')
      } else {
        setStatus('error')
        setMessage((error as Error)?.message ?? '')
      }
      stop()
    }
  }, [continuous, onScan, onOpenChange, stop])

  useEffect(() => {
    if (open) start()
    else stop()
    return stop
  }, [open, start, stop])

  // Backgrounding the tab should release the camera, not keep the LED on.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop()
      else if (open) start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [open, start, stop])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 p-0" hideClose>
        <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <DialogTitle className="text-base">{t('pos.scanOrSearch')}</DialogTitle>
          <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="size-full object-cover"
            aria-label="Camera preview"
          />

          {/* Reticle: a centred band, because 1D barcodes are read across. */}
          {status === 'scanning' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}

          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              {status === 'starting' && <Loader2 className="size-8 animate-spin" />}

              {status === 'unsupported' && (
                <>
                  <CameraOff className="size-8" />
                  <p className="text-sm">
                    ဤဘရောက်ဆာတွင် ကင်မရာစကင်မရနိုင်ပါ။
                    <span className="mt-1 block opacity-80">
                      Use a USB or Bluetooth scanner — it works everywhere and needs no permission.
                    </span>
                  </p>
                </>
              )}

              {status === 'denied' && (
                <>
                  <CameraOff className="size-8" />
                  <p className="text-sm">
                    ကင်မရာခွင့်ပြုချက် ပိတ်ထားသည်။
                    <span className="mt-1 block opacity-80">
                      Allow camera access in your browser settings, then try again.
                    </span>
                  </p>
                  <Button size="sm" variant="secondary" onClick={start}>
                    {t('common.retry')}
                  </Button>
                </>
              )}

              {status === 'error' && (
                <>
                  <CameraOff className="size-8" />
                  <p className="text-sm">{message || t('common.retry')}</p>
                  <Button size="sm" variant="secondary" onClick={start}>
                    {t('common.retry')}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <p className="px-4 pb-4 text-center text-xs text-muted-foreground">
          ဘားကုဒ်ကို မျဉ်းကြောင်းအတွင်း ထားပါ
          {continuous && ' · ဆက်တိုက်စကင်ဖတ်နေသည်'}
        </p>
      </DialogContent>
    </Dialog>
  )
}

/** Cheap capability probe so callers can hide the camera button entirely. */
export function useCameraScanSupported(): boolean {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        !!window.BarcodeDetector &&
        !!navigator.mediaDevices?.getUserMedia,
    )
  }, [])

  return supported
}
