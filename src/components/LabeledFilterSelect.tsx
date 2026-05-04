import { type ReactNode, useState, useRef, useEffect, useLayoutEffect, Children, isValidElement } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export const filterSelectClass =
  'w-full min-w-0 appearance-none rounded-lg border border-border bg-bg py-2 pl-3 pr-9 text-sm text-text outline-none transition-colors hover:border-primary/40 focus:border-primary/40 focus:ring-1 focus:ring-primary/20'

type OptionItem = { value: string; label: string }

function extractOptions(children: ReactNode): OptionItem[] {
  const options: OptionItem[] = []
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === 'option') {
      const value = (child.props as { value?: string }).value ?? ''
      const label =
        typeof (child.props as { children?: ReactNode }).children === 'string'
          ? ((child.props as { children: string }).children)
          : String((child.props as { children?: ReactNode }).children ?? value)
      options.push({ value, label })
    }
  })
  return options
}

export default function LabeledFilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const options = extractOptions(children)
  const selectedOption = options.find((o) => o.value === value)
  const displayLabel = selectedOption?.label ?? options[0]?.label ?? ''

  useLayoutEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      const idx = options.findIndex((o) => o.value === value)
      setHighlightedIndex(idx >= 0 ? idx : 0)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (open && listRef.current && highlightedIndex >= 0) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          onChange(options[highlightedIndex].value)
          setOpen(false)
          buttonRef.current?.focus()
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
        break
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-[10rem] max-w-full flex-1 flex-col gap-1 sm:min-w-[11rem]"
      onKeyDown={handleKeyDown}
    >
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary"
      >
        {label}
      </label>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`${filterSelectClass} cursor-pointer text-left`}
      >
        <span className={value ? '' : 'text-text-tertiary'}>{displayLabel}</span>
      </button>
      <ChevronDown
        className={`pointer-events-none absolute right-2.5 bottom-2 h-4 w-4 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
      />

      {open && createPortal(
        <div
          ref={listRef}
          role="listbox"
          aria-activedescendant={
            highlightedIndex >= 0 ? `${id}-opt-${highlightedIndex}` : undefined
          }
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-[9999] max-h-64 overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value
            const isHighlighted = i === highlightedIndex
            return (
              <div
                key={opt.value || '__any__'}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                  buttonRef.current?.focus()
                }}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  isHighlighted ? 'bg-primary/10 text-text' : 'text-text'
                } ${isSelected ? 'font-medium' : ''}`}
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-transparent'}`}
                />
                {opt.label}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
