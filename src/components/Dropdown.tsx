import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  placeholder: string
  className?: string
}

export default function Dropdown({ value, onChange, options, placeholder, className = '' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-2 rounded-full border py-1.5 pl-3.5 pr-2.5 text-sm transition-colors ${
          value
            ? 'border-primary/40 bg-primary/5 font-medium text-primary'
            : 'border-border bg-bg text-text-secondary hover:border-primary/40'
        }`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
            value ? 'text-primary' : 'text-text-tertiary'
          } ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 max-h-64 min-w-[10rem] overflow-auto rounded-xl border border-border bg-surface py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors ${
              !value ? 'font-medium text-primary' : 'text-text-secondary hover:bg-bg'
            }`}
          >
            <Check className={`h-3.5 w-3.5 shrink-0 ${!value ? 'opacity-100' : 'opacity-0'}`} />
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors ${
                value === opt.value ? 'font-medium text-primary' : 'text-text hover:bg-bg'
              }`}
            >
              <Check className={`h-3.5 w-3.5 shrink-0 ${value === opt.value ? 'opacity-100' : 'opacity-0'}`} />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
