'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  /** Second line — phone number, SKU, whatever disambiguates duplicates. */
  hint?: string
  /** Extra text matched against the query but not displayed. */
  keywords?: string
}

/**
 * Searchable single-select.
 *
 * Built on Popover + a filtered list rather than pulling in `cmdk`: the project
 * has no command-palette anywhere else, and one more dependency is not worth a
 * list that needs to do nothing but filter and pick.
 *
 * Keyboard: ↑/↓ move, Enter selects, Esc closes (Popover handles Esc).
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  footer,
  className,
  id,
}: {
  options: ComboboxOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder: string
  searchPlaceholder?: string
  emptyText?: string
  /** Rendered under the list — used for "add new customer". */
  footer?: React.ReactNode
  className?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q),
    )
  }, [options, query])

  const selected = options.find((o) => o.value === value) ?? null

  const commit = (option: ComboboxOption) => {
    onChange(option.value === value ? null : option.value)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
        else setActive(0)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-11 w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="relative border-b">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
              if (e.key === 'Enter' && filtered[active]) { e.preventDefault(); commit(filtered[active]) }
            }}
            placeholder={searchPlaceholder ?? placeholder}
            className="h-11 border-0 pl-9 focus-visible:ring-0"
          />
        </div>

        <ScrollArea className="max-h-56">
          <div ref={listRef} role="listbox" className="p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyText ?? '—'}
              </p>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(option)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm',
                    index === active && 'bg-accent',
                  )}
                >
                  <Check className={cn('size-4 shrink-0', option.value === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.hint && (
                      <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {footer && <div className="border-t p-1">{footer}</div>}
      </PopoverContent>
    </Popover>
  )
}
